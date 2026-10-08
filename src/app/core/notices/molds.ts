/**
 * The MOLD of a bank's message, learned from the person (rule 22; Jose,
 * 2026-10-08: "que ya sepa qué cuenta es, qué categoría y todo eso para que
 * sea solo darle guardar").
 *
 * When a person saves a proposal that came from a message, the message's
 * text becomes a mold for its source: the amount, the shop and every other
 * number are slots, the bank's fixed words stay. The next message of that
 * source that fits the mold is read with it - the amount, the shop, which
 * way the money went - and carries the account and category the person
 * chose last time. A bank never seen before costs one save, not a release.
 *
 * Pure: molds in, molds out. Nothing here names a bank; every word in a mold
 * came from the person's own phone.
 */

import { moneyIn } from './read-notice';

export interface Mold {
  /** The source it belongs to: an app's package, or `package|sender`. */
  source: string;
  /** The message with its slots, as a regular expression over folded text. */
  pattern: string;
  /** 1 money in, -1 money out. */
  sign: 1 | -1;
  /** Whether the shop is a slot; without one, the category is the mold's. */
  hasMerchant: boolean;
  accountId: number | null;
  categoryId: number | null;
  /** How many saves taught it, and when last: the newest is tried first. */
  uses: number;
  at: number;
}

/** What a mold reads out of a message that fits it. */
export interface MoldReading {
  amountMinor: number;
  direction: 'in' | 'out';
  merchant: string;
  accountId: number | null;
  categoryId: number | null;
}

/** At most this many molds per source; the least used go first. */
const PER_SOURCE = 8;

/** Lower case without accents, keeping every character's place (no trim). */
function fold(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function normalise(text: string): string {
  return text.normalize('NFC').replace(/\s+/g, ' ').trim();
}

function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** The fixed words of a piece of message, folded, its spaces loosened. */
function fixed(text: string): string {
  return escape(fold(text)).replace(/ /g, '\\s*');
}

/**
 * A mold from a message the person saved, or null when the saved amount is
 * not written in it (then nothing about it can be trusted).
 */
export function moldFrom(input: {
  source: string; text: string; amountMinor: number; merchant: string | null;
  accountId: number | null; categoryId: number | null; at: number;
}): Mold | null {
  const text = normalise(input.text);
  if (!text) return null;
  const amount = Math.abs(input.amountMinor);
  const money = moneyIn(text);
  const hit = money.find(found => found.minor === amount);
  if (!hit) return null;

  // Slots, by position: the amount, the other money, the shop.
  const slots: { start: number; end: number; slot: string }[] = [{ start: hit.start, end: hit.end, slot: 'AMOUNT' }];
  for (const other of money) if (other !== hit) slots.push({ start: other.start, end: other.end, slot: 'MONEY' });
  const merchant = (input.merchant ?? '').trim();
  let hasMerchant = false;
  if (merchant.length >= 2) {
    const at = fold(text).indexOf(fold(merchant));
    if (at >= 0 && !slots.some(slot => at < slot.end && at + merchant.length > slot.start)) {
      slots.push({ start: at, end: at + merchant.length, slot: 'MERCHANT' });
      hasMerchant = true;
    }
  }
  slots.sort((a, b) => a.start - b.start);

  let pattern = '';
  let from = 0;
  for (const slot of slots) {
    pattern += numbersLoose(text.slice(from, slot.start));
    pattern += slot.slot === 'AMOUNT' ? '(?<amount>.+?)'
      : slot.slot === 'MERCHANT' ? '(?<merchant>.+?)'
      : '.+?';
    from = slot.end;
  }
  pattern += numbersLoose(text.slice(from));
  return {
    source: input.source,
    pattern: `^${pattern}$`,
    sign: input.amountMinor > 0 ? 1 : -1,
    hasMerchant,
    accountId: input.accountId,
    categoryId: input.categoryId,
    uses: 1,
    at: input.at,
  };
}

/** Fixed words, every run of digits a slot: dates, hours, card digits, codes change. */
function numbersLoose(piece: string): string {
  return piece.split(/(\d+)/).map((part, i) => i % 2 === 1 ? '\\d+' : fixed(part)).join('');
}

/** Adds a mold, or strengthens the same one, keeping each source's few best. */
export function learnMold(molds: readonly Mold[], mold: Mold): Mold[] {
  const same = molds.find(one => one.source === mold.source && one.pattern === mold.pattern);
  const others = molds.filter(one => one !== same);
  const merged: Mold = same
    ? { ...mold, uses: same.uses + 1, accountId: mold.accountId ?? same.accountId, categoryId: mold.categoryId ?? same.categoryId }
    : mold;
  const mine = [merged, ...others.filter(one => one.source === mold.source)]
    .sort((a, b) => b.uses - a.uses || b.at - a.at)
    .slice(0, PER_SOURCE);
  return [...others.filter(one => one.source !== mold.source), ...mine];
}

/** The first mold of a source that fits the message, read; null when none does. */
export function readWithMolds(source: string, text: string, molds: readonly Mold[]): MoldReading | null {
  const whole = normalise(text);
  const folded = fold(whole);
  // Folding keeps every position, so a group found in the folded text is cut
  // from the original with its accents and case.
  if (folded.length !== whole.length) return null;
  const mine = molds.filter(one => one.source === source).sort((a, b) => b.at - a.at);
  for (const mold of mine) {
    let match: RegExpExecArray | null;
    try {
      match = new RegExp(mold.pattern, 'd').exec(folded);
    } catch {
      continue;
    }
    const amountAt = match?.indices?.groups?.['amount'];
    if (!match || !amountAt) continue;
    const found = moneyIn(whole.slice(amountAt[0], amountAt[1]))[0];
    if (!found) continue;
    const merchantAt = match.indices?.groups?.['merchant'];
    return {
      amountMinor: found.minor,
      direction: mold.sign > 0 ? 'in' : 'out',
      merchant: merchantAt ? whole.slice(merchantAt[0], merchantAt[1]).trim() : '',
      accountId: mold.accountId,
      // A shop in the slot lets the dictionary say the category; without one,
      // the mold's is the one the person gave.
      categoryId: mold.hasMerchant ? null : mold.categoryId,
    };
  }
  return null;
}
