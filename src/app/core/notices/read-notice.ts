/**
 * Reading a bank's message - a push notification or an SMS - by its SHAPE.
 *
 * Nothing here names a bank, a sender or a format, and nothing ever may
 * (Jose, 2026-10-02: "no puedes pretender hacer algo quemado que me funcione
 * a mi solamente y al resto no"). Every bank words its messages differently,
 * in every country; what they share is what a movement IS:
 *
 *   - **an amount**, written the way money is written - a currency sign or
 *     code beside it, or its thousands grouped - so a one-time code, a card's
 *     last digits, a date or an hour are never taken for money;
 *   - **a direction**, said with ordinary words of both languages: money
 *     going out (compra, pago, retiro, enviaste, purchase, paid) or coming
 *     in (recibiste, abono, consignación, received, deposit);
 *   - often **a balance** after it: an amount right after "saldo",
 *     "disponible", "balance" is what is left, never the movement;
 *   - often **where**: the words after "en" or "a" (the shop, the person),
 *     or after "de" for money coming in;
 *   - sometimes **the card or account**: its last digits after `*`, "final",
 *     "terminada en", "ending in";
 *   - sometimes **a date** written inside the text.
 *
 * What it cannot tell, it says it cannot: the direction stays null rather
 * than guessed, the merchant empty. A message with money and no movement
 * word is `unclear`, never dropped - rule 22: a message from a bank the
 * person ticked that could not be read is still proposed, saying so.
 *
 * Pure and offline. Each bank's own wording is learned later from what the
 * person corrects (the "mold" of rule 22), on their phone and for them; this
 * is the first reading every message gets, for anybody.
 */

import type { IsoDate } from '../database/types';
import { parseTypedAmountToMinor } from '../database/money';
import { foldText } from '../text/fold-text';

export type NoticeKind =
  /** Money moved: an amount and a direction. */
  | 'movement'
  /** Money and nothing saying which way: the person decides. */
  | 'unclear'
  /** Only a balance ("Tu saldo es ..."): nothing moved. */
  | 'balance'
  /** A purchase or transfer the bank refused: nothing moved. */
  | 'declined'
  /** A code, an offer, a reminder: no money that moved. */
  | 'none';

export interface NoticeReading {
  kind: NoticeKind;
  /** The movement's amount in minor units, always positive; null when none. */
  amountMinor: number | null;
  /** The currency written beside the amount, when one was. */
  currency: string | null;
  direction: 'out' | 'in' | null;
  /** What the message says is left afterwards, when it says. */
  balanceMinor: number | null;
  /** Where the money went or came from, as written; '' when not said. */
  merchant: string;
  /** The card's or account's last digits, when written. */
  digits: string | null;
  /** A date written in the text; null means the day it arrived. */
  date: IsoDate | null;
}

/** An amount found in the text, with where it sits. */
export interface Found {
  minor: number;
  currency: string | null;
  start: number;
  end: number;
}

// --- money ---------------------------------------------------------------

const CODES = 'COP|USD|EUR|MXN|PEN|CLP|ARS|BRL|GBP|CAD|US\\$|COL\\$|R\\$|S\\/';
const SIGNS = '\\$|€|£';
const NUMBER = '\\d{1,3}(?:[.,\\s]\\d{3})+(?:[.,]\\d{1,2})?|\\d+(?:[.,]\\d{1,2})?';

/**
 * Money is a number with a sign or code beside it, or with its thousands
 * grouped. The two alternatives, in one expression so the matches never
 * overlap: sign/code first, then the number (with an optional code after);
 * or a grouped number on its own with an optional code after.
 */
const MONEY = new RegExp(
  `(?:(${CODES}|${SIGNS})\\s?(${NUMBER})(?:\\s?(${CODES}))?)` +
  `|(?:(?<![\\d.,])(\\d{1,3}(?:[.,]\\d{3})+(?:[.,]\\d{1,2})?)(?![\\d])(?:\\s?(${CODES}|pesos|dolares|dólares))?)` +
  `|(?:(?<![\\d.,])(\\d+(?:[.,]\\d{1,2})?)\\s?(${CODES}|pesos|dolares|dólares)\\b)`,
  'gi',
);

function currencyOf(mark: string | undefined): string | null {
  if (!mark) return null;
  const m = mark.toUpperCase();
  if (m === '$') return null;
  if (m === '€') return 'EUR';
  if (m === '£') return 'GBP';
  if (m === 'US$' || m.startsWith('DOL') || m.startsWith('DÓL')) return 'USD';
  if (m === 'COL$' || m === 'PESOS') return 'COP';
  if (m === 'R$') return 'BRL';
  if (m === 'S/') return 'PEN';
  return m;
}

export function moneyIn(text: string): Found[] {
  const found: Found[] = [];
  for (const match of text.matchAll(MONEY)) {
    const number = match[2] ?? match[4] ?? match[6];
    // A code written after the number says more than a bare "$" before it.
    const mark = match[3] ?? match[1] ?? match[5] ?? match[7];
    if (!number) continue;
    // A grouped number with spaces is only money with a sign in front: "1 500"
    // on its own is as likely two numbers.
    const plain = number.replace(/\s/g, '');
    if (/\s/.test(number) && match[1] === undefined) continue;
    let minor: number;
    try {
      minor = parseTypedAmountToMinor(plain, 2);
    } catch {
      continue;
    }
    if (minor <= 0) continue;
    found.push({ minor, currency: currencyOf(mark), start: match.index ?? 0, end: (match.index ?? 0) + match[0].length });
  }
  return found;
}

// --- words ---------------------------------------------------------------

/** Ordinary words for money leaving, folded (no accents, lower case). */
const OUT = [
  'compraste', 'compra', 'pagaste', 'pago', 'pagado', 'retiraste', 'retiro', 'debito', 'debitamos', 'debitado',
  'realizaste una transferencia', 'hiciste una transferencia', 'desde tu cuenta',
  'cargo', 'cobro', 'cobramos', 'transferiste', 'enviaste', 'envio', 'enviado', 'avance', 'consumo', 'gastaste',
  'purchase', 'paid', 'payment', 'spent', 'withdrawal', 'withdrew', 'sent', 'charged', 'charge', 'debit', 'debited',
];

/** Ordinary words for money arriving, folded. */
const IN = [
  'recibiste', 'recibio', 'recibido', 'recibida', 'abono', 'abonamos', 'abonado', 'consignacion', 'consignaron',
  'deposito', 'depositaron', 'te transfirieron', 'te enviaron', 'te pagaron', 'reembolso', 'devolucion', 'devolv', 'reintegr',
  'nomina', 'ingreso', 'llego', 'llegaron', 'cashback', 'ganaste', 'rendimiento',
  'received', 'earned', 'deposit', 'deposited', 'refund', 'refunded', 'credited', 'incoming', 'you got',
];

/** A balance is what follows one of these. */
const BALANCE = ['saldo', 'disponible', 'balance', 'cupo', 'available'];

const DECLINED = ['rechazad', 'declinad', 'no fue exitos', 'no exitos', 'fallid', 'no aprobad', 'no pudo', 'declined', 'failed', 'denied', 'insuficiente'];

/** Codes and offers: money may be named, none moved - unless a movement word says otherwise. */
const NOT_A_MOVEMENT = [
  'codigo', 'clave', 'otp', 'contrasena', 'verification', 'code',
  'gana ', 'ganate', 'oferta', 'promo', 'descuento', 'aprovecha', 'hasta el', 'participa', 'sorteo', 'pre-aprobad', 'preaprobad',
];

/** A reminder of something to pay is never a movement, whatever words it uses. */
const REMINDER = [
  'te recordamos que', 'recordatorio', 'vence', 'vencimiento', 'proximo pago', 'fecha limite', 'reminder', 'is due', 'due on', 'due date',
];

/** Where the first of these words appears as a word: its start and end, or null. */
function firstOf(folded: string, words: readonly string[]): { start: number; end: number } | null {
  let best: { start: number; end: number } | null = null;
  for (const word of words) {
    const at = new RegExp(`(^|[^a-z])(${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})[a-z]*`).exec(folded);
    if (!at) continue;
    const start = at.index + at[1].length;
    if (!best || start < best.start) best = { start, end: at.index + at[0].length };
  }
  return best;
}

function hasAny(folded: string, words: readonly string[]): boolean {
  return words.some(word => folded.includes(word));
}

// --- the rest ------------------------------------------------------------

const DIGITS = [
  /\*+\s?(\d{3,4})\b/,
  /\b(?:final|finalizada en|terminada en|terminado en|termina en|ending in|ending)\s*\*?\s*(\d{3,4})\b/i,
  /\b[xX]{2,}(\d{3,4})\b/,
  /\bno\.?\s?\*?(\d{4})\b/i,
];

export function digitsIn(text: string): string | null {
  for (const pattern of DIGITS) {
    const match = pattern.exec(text);
    if (match) return match[1];
  }
  return null;
}

function dateIn(text: string, year: number): IsoDate | null {
  const iso = /\b(20\d{2})[-/](\d{1,2})[-/](\d{1,2})\b/.exec(text);
  if (iso) return dateOf(+iso[1], +iso[2], +iso[3]);
  const dmy = /\b(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})\b/.exec(text);
  if (dmy) return dateOf(+dmy[3] < 100 ? 2000 + +dmy[3] : +dmy[3], +dmy[2], +dmy[1]);
  const dm = /\b(\d{1,2})\/(\d{1,2})\b(?![/\d])/.exec(text);
  if (dm) return dateOf(year, +dm[2], +dm[1]);
  return null;
}

function dateOf(year: number, month: number, day: number): IsoDate | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return new Date(`${iso}T00:00:00Z`).toISOString().slice(0, 10) === iso ? (iso as IsoDate) : null;
}

/**
 * The words naming where money went or came from: after "en" or "a" (or
 * "de", "desde" for money coming in), up to a word that starts something else.
 */
const STOP = /\s(?:con|desde|por|para|via|vía|tu|su|saldo|disponible|ref|referencia|aprobado|aprobada|exitos[oa]|on|at|from|with|using|card|tarjeta|cuenta|cta|fecha|hora|a las|(?:el|la) (?:dia|día|\d)|(?:en|a|in|to) (?:tu|su|la cuenta|your))\b|[.,;:|()\n]|\s\d{1,2}[/:-]\d|\s\*|\s[$€£]/i;

function merchantAfter(text: string, from: number, direction: 'out' | 'in' | null): string {
  const rest = text.slice(from);
  // The name follows its little word at once, or after a word or two
  // ("Compra aprobada en TIENDA").
  const lead = direction === 'in'
    ? /^\s*(?:[^\s$€£\d]+\s+){0,2}?(?:de|desde|from|por parte de)\s+/i
    : /^\s*(?:[^\s$€£\d]+\s+){0,2}?(?:en|a|al|at|to|in|para)\s+/i;
  const match = lead.exec(rest);
  if (!match) return '';
  const tail = rest.slice(match[0].length);
  const stop = STOP.exec(` ${tail}`);
  const name = (stop ? ` ${tail}`.slice(0, stop.index) : ` ${tail}`).trim();
  // A name of a single letter, or only digits, is not one.
  if (name.length < 2 || /^[\d\s*]+$/.test(name)) return '';
  return name.slice(0, 60);
}

/**
 * Is this amount what is LEFT? A balance word shortly before it, with no
 * other amount and no movement word in between: "Saldo disponible en tu
 * cuenta *1111: $54.300" is a balance, while in "Saldo anterior $500.000.
 * Compra $20.000" the purchase is not.
 */
function isBalance(folded: string, money: Found, all: readonly Found[]): boolean {
  const from = Math.max(0, money.start - 45);
  const before = folded.slice(from, money.start);
  let at = -1;
  for (const word of BALANCE) at = Math.max(at, before.lastIndexOf(word));
  if (at === -1) return false;
  const start = from + at;
  if (all.some(other => other !== money && other.start > start && other.start < money.start)) return false;
  const between = folded.slice(start, money.start);
  return !firstOf(between, OUT) && !firstOf(between, IN);
}

/**
 * Reads one message. `title` is the notification's title (the sender, for an
 * SMS); `arrivedOn` gives the year to a date written without one.
 */
export function readNotice(text: string, title = '', arrivedOn: IsoDate | null = null): NoticeReading {
  const whole = `${title ? `${title}. ` : ''}${text}`.normalize('NFC').replace(/\s+/g, ' ').trim();
  // Folding keeps every character's position: only accents go, and those are
  // combining marks removed one for one after NFD... so fold per character.
  const folded = [...whole].map(ch => foldText(ch) || ' ').join('');
  const year = arrivedOn ? +arrivedOn.slice(0, 4) : new Date().getFullYear();

  const empty: NoticeReading = {
    kind: 'none', amountMinor: null, currency: null, direction: null, balanceMinor: null, merchant: '', digits: null, date: null,
  };

  const money = moneyIn(whole);
  if (money.length === 0) return empty;

  const balances = money.filter(m => isBalance(folded, m, money));
  const moved = money.filter(m => !isBalance(folded, m, money));
  const balanceMinor = balances.length ? balances[0].minor : null;
  const digits = digitsIn(whole);
  const date = dateIn(whole.replace(/\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{1,2})?/g, ' '), year);

  if (hasAny(folded, DECLINED)) {
    return { ...empty, kind: 'declined', amountMinor: moved[0]?.minor ?? null, currency: moved[0]?.currency ?? null, balanceMinor, digits, date };
  }

  if (hasAny(folded, REMINDER)) return { ...empty, balanceMinor, digits };

  const outAt = firstOf(folded, OUT);
  const inAt = firstOf(folded, IN);
  // The word said first decides: "Recibiste un pago" is money in.
  const said = !outAt ? inAt : !inAt ? outAt : (inAt.start < outAt.start ? inAt : outAt);
  const direction: 'out' | 'in' | null = !said ? null : said === inAt ? 'in' : 'out';

  if (moved.length === 0) {
    // Only a balance: nothing moved.
    return { ...empty, kind: 'balance', balanceMinor, digits, date };
  }

  // The movement is the first amount that is not a balance.
  const amount = moved[0];
  if (direction === null && hasAny(folded, NOT_A_MOVEMENT)) return empty;

  // Where: after the amount ("$45.900 en EXITO"), or after the word that said
  // what happened ("Compra en EXITO por $45.900").
  const merchant = merchantAfter(whole, amount.end, direction)
    || (said ? merchantAfter(whole, said.end, direction) : '');

  return {
    kind: direction === null ? 'unclear' : 'movement',
    amountMinor: amount.minor,
    currency: amount.currency ?? balances[0]?.currency ?? null,
    direction,
    balanceMinor,
    merchant,
    digits,
    date,
  };
}

/** Whether a message looks like a bank's: money moved, or a balance. */
export function looksLikeMoney(text: string, title = ''): boolean {
  const kind = readNotice(text, title).kind;
  return kind === 'movement' || kind === 'balance' || kind === 'declined';
}
