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
  /**
   * The account at the other end when the person saved it as a transfer
   * (Jose, 2026-10-08): the next message of this shape is proposed as a
   * transfer to (or from) it.
   */
  otherAccountId?: number | null;
  /**
   * Saved as a transfer: the note and the products chosen at each end
   * (Jose, 2026-10-16: everything chosen is learned), so the next one opens
   * exactly as it was saved, only its amount new.
   */
  transfer?: TransferMemory | null;
  /** How many saves taught it, and when last: the newest is tried first. */
  uses: number;
  at: number;
}

/** What a transfer saved from a message carried besides its two accounts. */
export interface TransferMemory {
  note: string | null;
  fromProductId: number | null;
  toProductId: number | null;
}

/** What a mold reads out of a message that fits it. */
export interface MoldReading {
  amountMinor: number;
  direction: 'in' | 'out';
  merchant: string;
  accountId: number | null;
  categoryId: number | null;
  /** Saved as a transfer before: the account at its other end. */
  otherAccountId: number | null;
  /** And its note and products. */
  transfer: TransferMemory | null;
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
  otherAccountId?: number | null;
  transfer?: TransferMemory | null;
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
    otherAccountId: input.otherAccountId ?? null,
    ...(input.transfer ? { transfer: input.transfer } : {}),
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
      otherAccountId: mold.otherAccountId ?? null,
      transfer: mold.otherAccountId != null ? mold.transfer ?? null : null,
    };
  }
  return null;
}

// ---------------------------------------------------------------------------
// "No es un movimiento" (Jose, 2026-10-14, mockups 24a-24d)
// ---------------------------------------------------------------------------

/**
 * A message the person said is not a movement - an advert, a notice, a
 * balance - kept as the shape of its words for its source: every number is
 * a slot, so the same advert with another price or date fits it too.
 */
export interface NotMold {
  source: string;
  pattern: string;
  /** The message itself, so "Sí era un movimiento" finds what to forget. */
  text: string;
  at: number;
}

/** What the person taught about each source that is NOT a movement. */
export interface Quiet {
  notMolds: NotMold[];
  /**
   * Sources offered only messages that say money DID move ("compraste",
   * "recibiste"...), or that fit a mold the person saved. Switched on by the
   * second "No es un movimiento" from the same source, and off on its page.
   */
  strict: string[];
}

/** After this many answers "No es un movimiento" from one source, it is strict. */
export const STRICT_AFTER = 2;

/** At most this many per source; the oldest go first. */
const NOT_PER_SOURCE = 20;

/** The shape of a message that is not a movement, or null for an empty one. */
export function notMoldFrom(source: string, text: string, at: number): NotMold | null {
  const whole = normalise(text);
  if (!whole) return null;
  return { source, pattern: `^${numbersLoose(whole)}$`, text: whole, at };
}

/** Whether a message fits one of its source's "not a movement" shapes. */
export function fitsNotMold(source: string, text: string, notMolds: readonly NotMold[]): boolean {
  const folded = fold(normalise(text));
  return notMolds.some(one => {
    if (one.source !== source) return false;
    try { return new RegExp(one.pattern).test(folded); } catch { return false; }
  });
}

/**
 * "No es un movimiento": the message's shape is kept, and the second such
 * answer from one source makes it strict.
 */
export function learnNotMovement(quiet: Quiet, source: string, text: string, at: number): Quiet {
  const mold = notMoldFrom(source, text, at);
  if (!mold) return quiet;
  const others = quiet.notMolds.filter(one => !(one.source === source && one.pattern === mold.pattern));
  const mine = [...others.filter(one => one.source === source), mold]
    .sort((a, b) => b.at - a.at).slice(0, NOT_PER_SOURCE);
  const notMolds = [...others.filter(one => one.source !== source), ...mine];
  const strict = mine.length >= STRICT_AFTER && !quiet.strict.includes(source)
    ? [...quiet.strict, source] : quiet.strict;
  return { notMolds, strict };
}

/**
 * "Sí era un movimiento": the shapes this message fits are forgotten, and
 * the source is no longer strict - the person just said one of its
 * messages without "compraste" was money that moved.
 */
export function unlearnNotMovement(quiet: Quiet, source: string, text: string): Quiet {
  const folded = fold(normalise(text));
  const notMolds = quiet.notMolds.filter(one => {
    if (one.source !== source) return true;
    try { return !new RegExp(one.pattern).test(folded); } catch { return true; }
  });
  return { notMolds, strict: quiet.strict.filter(one => one !== source) };
}

/**
 * Why a message is not offered, by what the person taught: 'taught' when it
 * fits a "not a movement" shape, 'strict' when its source only takes money
 * that moved and it does not say so; null when it may be offered. A message
 * that fits a mold the person SAVED is always offered.
 */
export function silencedBy(
  source: string, text: string, quiet: Quiet, molds: readonly Mold[], happened: boolean,
): 'taught' | 'strict' | null {
  if (readWithMolds(source, text, molds)) return null;
  if (fitsNotMold(source, text, quiet.notMolds)) return 'taught';
  if (quiet.strict.includes(source) && !happened) return 'strict';
  return null;
}

/** What the phone's notice needs of what was taught: the shapes, never more. */
export function quietForPhone(quiet: Quiet, molds: readonly Mold[]): string {
  return JSON.stringify({
    notMolds: quiet.notMolds.map(one => ({ source: one.source, pattern: one.pattern })),
    strict: quiet.strict,
    molds: molds.map(one => ({ source: one.source, pattern: one.pattern })),
  });
}
