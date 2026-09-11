/**
 * Walking calendar days as ISO text.
 *
 * The accrual runs one day at a time and has to be able to say "the next day"
 * and "the month this day belongs to" without ever drifting. `Date` in a
 * browser is local time, so adding 24 hours across the start of daylight
 * saving gives the same day back or skips one. Everything here works in UTC
 * and returns `YYYY-MM-DD`, which also sorts chronologically as plain text -
 * the same property the whole schema relies on.
 */

import type { IsoDate } from '../database/types';

/** `2026-09-09` -> the UTC instant at midnight of that day. */
function asUtc(day: IsoDate): number {
  const [year, month, date] = day.split('-').map(Number);
  return Date.UTC(year, month - 1, date);
}

function toIso(ms: number): IsoDate {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDays(day: IsoDate, count: number): IsoDate {
  return toIso(asUtc(day) + count * 86_400_000);
}

export function nextDay(day: IsoDate): IsoDate {
  return addDays(day, 1);
}

/** Whole days from one day to another; negative when the second is earlier. */
export function daysBetween(from: IsoDate, to: IsoDate): number {
  return Math.round((asUtc(to) - asUtc(from)) / 86_400_000);
}

/** `2026-09-09` -> `2026-09-01`. */
export function startOfMonth(day: IsoDate): IsoDate {
  return `${day.slice(0, 7)}-01`;
}

/** `2026-09-09` -> `2026-09-30`. */
export function endOfMonth(day: IsoDate): IsoDate {
  const [year, month] = day.split('-').map(Number);
  return toIso(Date.UTC(year, month, 0));
}

/** `2026-09-09` -> `2026-09`, the key a monthly condition is grouped by. */
export function monthOf(day: IsoDate): string {
  return day.slice(0, 7);
}

/** Every day from `from` to `to` inclusive. Empty when `to` is earlier. */
export function eachDay(from: IsoDate, to: IsoDate): IsoDate[] {
  const out: IsoDate[] = [];
  for (let day = from; day <= to; day = nextDay(day)) out.push(day);
  return out;
}

/**
 * Today, where the user is standing.
 *
 * `new Date().toISOString().slice(0, 10)` is the obvious way to write this and
 * it is wrong: it gives the UTC day. In Colombia, five hours behind, every
 * evening after seven o'clock it answers with tomorrow — so the yields screen
 * showed a day of interest for the 11th while it was still the 10th, and the
 * accrual wrote a day that had not happened yet.
 *
 * The parts come from the local calendar instead. `getMonth` is zero-based;
 * `getDate` is the day of the month, not `getDay`, which is the day of the
 * week and is the other half of this mistake.
 *
 * Every screen asks this one function, so the next copy cannot be the wrong
 * one — it was already written twice, once each way.
 */
export function todayIso(): IsoDate {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}
