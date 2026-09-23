/**
 * Recognising a date and an amount inside a line of a statement.
 *
 * This is the whole reason a PDF can ask less than a spreadsheet. A
 * spreadsheet column only has a heading, and every bank words it differently;
 * here, what a thing IS shows in its shape. A date looks like a date and an
 * amount looks like an amount, whatever the bank decided to call the column
 * it sits in. Rule 22.
 */

import type { IsoDate } from '../database/types';
import { parseTypedAmountToMinor } from '../database/money';

/** A piece of text and where on the page it was. */
export interface TextItem {
  text: string;
  x: number;
  y: number;
  page: number;
}

/** An amount found in a line, and where it was found. */
export interface MoneyToken {
  /** In minor units, always positive. The sign is decided elsewhere. */
  minor: number;
  /** True when the statement itself marked it negative. */
  negative: boolean;
  x: number;
  text: string;
}

const MONTHS: Record<string, number> = {
  ENE: 1, JAN: 1, FEB: 2, MAR: 3, ABR: 4, APR: 4, MAY: 5, JUN: 6, JUL: 7,
  AGO: 8, AUG: 8, SEP: 9, SET: 9, OCT: 10, NOV: 11, DIC: 12, DEC: 12,
};

const TWO_DIGITS = /^\d{1,2}$/;

/**
 * The date a line begins with, or null.
 *
 * Statements write it every way there is: `10/09/2026`, `2026-09-10`,
 * `10-SEP-2026`, and - the awkward one - `10/09` with the year only in the
 * heading. That is what `year` is for.
 *
 * Only ever read from the start of a line, because a reference number further
 * along can look exactly like a date and a movement's date is never in the
 * middle of its description.
 */
export function dateIn(text: string, year: number | null): IsoDate | null {
  const start = text.trim();

  // 2026-09-10, the unambiguous one.
  const iso = start.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (iso) return dateOf(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  // 10/09/2026 and 10/09/26.
  const dmy = start.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
  if (dmy) {
    const written = Number(dmy[3]);
    return dateOf(written < 100 ? 2000 + written : written, Number(dmy[2]), Number(dmy[1]));
  }

  // 10-SEP-2026, 10 SEP 26, 10 SEP.
  const named = start.match(/^(\d{1,2})[-\s.]*([A-Za-zÁÉÍÓÚáéíóú]{3,10})\.?[-\s.]*(\d{2,4})?/);
  if (named) {
    const month = MONTHS[named[2].slice(0, 3).toUpperCase()];
    if (month !== undefined) {
      const written = named[3] === undefined ? null : Number(named[3]);
      const inYear = written === null ? year : (written < 100 ? 2000 + written : written);
      if (inYear !== null) return dateOf(inYear, month, Number(named[1]));
    }
  }

  // 10/09, with the year coming from the statement's own heading.
  const dm = start.match(/^(\d{1,2})[-/.](\d{1,2})(?![\d/.-])/);
  if (dm && year !== null) return dateOf(year, Number(dm[2]), Number(dm[1]));

  return null;
}

function dateOf(year: number, month: number, day: number): IsoDate | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  if (year < 1990 || year > 2999) return null;
  const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  // A day that does not exist - the 31st of a thirty-day month - is not a date
  // this was reading, whatever it looked like.
  const back = new Date(`${iso}T00:00:00Z`);
  return back.toISOString().slice(0, 10) === iso ? (iso as IsoDate) : null;
}

/** The year this statement is about, as written anywhere on its first page. */
export function yearIn(text: string): number | null {
  const years = [...text.matchAll(/\b(20\d{2})\b/g)].map(match => Number(match[1]));
  if (years.length === 0) return null;
  // The most repeated one, and the latest where they tie: a statement names
  // its own year far more often than it names any other.
  const seen = new Map<number, number>();
  for (const year of years) seen.set(year, (seen.get(year) ?? 0) + 1);
  return [...seen.entries()].sort((a, b) => (b[1] - a[1]) || (b[0] - a[0]))[0][0];
}

/**
 * Whether a piece of text is an amount, and what it is worth.
 *
 * Wants a separator, a currency sign or at least four digits, so a reference
 * number, a card's last four digits and a branch code are left alone. What
 * makes it negative is anything a statement uses to say so: a minus in front,
 * a minus behind, brackets, or DB/DÉBITO beside it.
 */
export function moneyIn(text: string, minorUnits: number): MoneyToken | null {
  const raw = text.trim();
  if (raw.length === 0) return null;

  const negative = /^\(.*\)$/.test(raw) || /^-/.test(raw) || /-$/.test(raw)
    || /\b(DB|DEBITO|DÉBITO)\b/i.test(raw);

  const digits = raw
    .replace(/\((.*)\)/, '$1')
    .replace(/\b(COP|USD|EUR|CR|DB|DEBITO|DÉBITO|CREDITO|CRÉDITO)\b/gi, '')
    .replace(/[$\s]/g, '')
    .replace(/^[-+]/, '')
    .replace(/[-+]$/, '');
  if (!/^\d[\d.,]*$/.test(digits)) return null;

  const separated = /[.,]/.test(digits);
  // Five digits, not four: a card's last four and a branch code are four,
  // and an amount written without a separator at all is rare and larger.
  const long = digits.replace(/[.,]/g, '').length >= 5;
  const signed = /[$]/.test(raw) || /\b(COP|USD|EUR)\b/i.test(raw);
  if (!separated && !long && !signed) return null;

  try {
    const minor = parseTypedAmountToMinor(digits, minorUnits);
    return { minor, negative, x: 0, text: raw };
  } catch {
    return null;
  }
}

/**
 * The amounts in a line, in the order they appear, each with its position.
 *
 * Position is what later tells the running balance apart from the movement:
 * they sit in different columns on every page of the statement, and the
 * column is the only thing about them that never changes.
 */
export function moneyTokensIn(items: readonly TextItem[], minorUnits: number): MoneyToken[] {
  const found: MoneyToken[] = [];
  for (const item of items) {
    // A bank may put the number and its sign in separate pieces of text, so
    // each piece is tried whole before it is split.
    const whole = moneyIn(item.text, minorUnits);
    if (whole) {
      found.push({ ...whole, x: item.x });
      continue;
    }
    for (const piece of item.text.split(/\s{2,}/)) {
      const money = moneyIn(piece, minorUnits);
      if (money) found.push({ ...money, x: item.x });
    }
  }
  return found;
}
