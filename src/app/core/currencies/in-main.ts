/**
 * Showing money in a main currency other than the peso (mockup 37d; Jose,
 * 2026-10-19). Only how figures are SHOWN changes: every movement keeps its
 * peso value (`amount_base_minor`) and every rule that reads pesos - the
 * yields, the tax simulator, loans, caps, goals - keeps reading them.
 *
 * - A movement already in the main currency is shown with its own amount,
 *   exactly: no conversion goes there and back.
 * - Any other movement is its peso value at the main currency's rate of its
 *   own day (rule 3: what it cost that day), or the nearest rate the app
 *   has when that day has none.
 * - Net worth is what is held today, at today's rate (rule 3 again).
 *
 * Pure: no Angular, so the tests read it as it is.
 */

import { RATE_SCALE } from '../database/money';

/** One currency's rate to pesos by day, sorted by day. */
export interface RateBook {
  days: string[];
  rates: number[];
}

/** A book from rates on record; on a day given twice the first one stays. */
export function rateBook(points: readonly { on_date: string; rate_scaled: number }[]): RateBook {
  const byDay = new Map<string, number>();
  for (const point of points) {
    if (point.rate_scaled > 0 && !byDay.has(point.on_date)) byDay.set(point.on_date, point.rate_scaled);
  }
  const days = [...byDay.keys()].sort();
  return { days, rates: days.map(day => byDay.get(day)!) };
}

/**
 * The rate of a day: the last on or before it, as a bank would use; a day
 * before every rate on record takes the first one. Null for an empty book.
 */
export function rateOn(book: RateBook, day: string): number | null {
  if (book.days.length === 0) return null;
  let low = 0;
  let high = book.days.length - 1;
  if (day < book.days[0]) return book.rates[0];
  while (low < high) {
    const mid = (low + high + 1) >> 1;
    if (book.days[mid] <= day) low = mid; else high = mid - 1;
  }
  return book.rates[low];
}

/** Pesos (in cents) into the main currency's cents at a rate to pesos. */
export function pesosToMain(pesosMinor: number, rateScaled: number): number {
  return Math.round((pesosMinor * RATE_SCALE) / rateScaled);
}

/** What a movement is worth in the main currency. */
export function movementInMain(
  movement: { amount_minor: number; amount_base_minor: number; currency_code: string; occurred_on: string },
  main: string,
  book: RateBook,
): number {
  if (main === 'COP') return movement.amount_base_minor;
  if (movement.currency_code === main) return movement.amount_minor;
  const rate = rateOn(book, movement.occurred_on);
  return rate === null ? movement.amount_base_minor : pesosToMain(movement.amount_base_minor, rate);
}

/** A line of net worth, as the accounts repository gives it. */
export interface WorthLineLike {
  currency_code: string;
  balance_minor: number;
  baseMinor: number | null;
}

/**
 * Net worth's lines in the main currency, at today's rate, and their total -
 * the sum of the lines, so what you have and what you owe still add up to it.
 */
export function worthInMain<T extends WorthLineLike>(
  lines: readonly T[], main: string, todayRate: number | null,
): { lines: T[]; totalMinor: number } {
  const converted = lines.map(line => {
    if (main === 'COP') return line;
    if (line.currency_code === main) return { ...line, baseMinor: line.balance_minor };
    if (line.baseMinor === null || todayRate === null) return line;
    return { ...line, baseMinor: pesosToMain(line.baseMinor, todayRate) };
  });
  const totalMinor = converted.reduce((sum, line) => sum + (line.baseMinor ?? 0), 0);
  return { lines: converted, totalMinor };
}
