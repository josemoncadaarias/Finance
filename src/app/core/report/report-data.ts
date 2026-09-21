/**
 * Everything the analyses are allowed to look at, gathered once.
 *
 * **No analysis queries the database.** Twenty analyses asking for what they
 * need would be twenty round trips to SQLite, and on the phone every one of
 * those crosses to native code; the report would open on a blank screen for
 * seconds. They all read this, and an analysis that needs something nobody
 * loaded gets it added here - in this one place, once, for all of them.
 *
 * The movements are the ones the summary screen is showing: the same period,
 * the same accounts, the same rules about transfers and products set aside.
 * Not a second query that asks the same question its own way - two answers
 * differing by a peso would cost the trust of both.
 */

import type { Movement, AmountBasis } from '../../features/movements/group-movements';
import { shiftPeriod, type Period } from '../filters/period';
import type { AccountRow } from '../database/types';
import type { ReportWords } from './report-words';

export interface ReportData {
  /** The dates on screen, and how they read. */
  period: Period;
  periodLabel: string;

  /**
   * The account chosen, or null when the summary is showing all of them.
   * The report says which, because "spent 9.8M" means a different thing.
   */
  account: AccountRow | null;
  /** Every account in scope, for naming them and for breaking figures down. */
  accounts: readonly AccountRow[];

  /**
   * The movements, exactly as the summary screen has them.
   *
   * Which means already filtered: transfers between two accounts both in
   * scope are out, and so are products set aside from net worth unless the
   * user asked to see them.
   */
  movements: readonly Movement[];

  /**
   * Which figure of a movement to add up, and what currency that is.
   *
   * One account: its own currency, because every movement in it is already in
   * it. All of them: pesos, at the rate of each movement's own day - a
   * movement is worth what it cost when it happened, which is rule 3 and is
   * also what the summary screen shows.
   */
  basis: AmountBasis;
  currency: string;

  /**
   * The same stretch of the period before, and what happened in it.
   *
   * Null when there is nothing to compare against - every movement ever, a
   * hand-typed range, or a first period with nothing before it. The analyses
   * that compare then have nothing to say and remove themselves.
   */
  before: {
    period: Period;
    label: string;
    movements: readonly Movement[];
    /** True when only part of this period is being compared, as it usually is. */
    clipped: boolean;
  } | null;

  /** Today, so a part-finished period can be recognised as one. */
  today: string;

  /** For month names and for grouping digits: the reader's own locale. */
  locale: string;

  /** The report's words, in the app's language. */
  words: ReportWords;
}

/**
 * The stretch a period is compared against, and what to compare of it.
 *
 * Not simply "last month". On the 21st, this month against all of last month
 * compares 21 days against 31 and calls the difference a trend - a lie told
 * to one decimal place, and always in the direction that flatters. So the
 * earlier stretch is cut to the same number of days from ITS start: 21
 * against 21.
 *
 * Returns null where there is nothing sensible to compare against: every
 * movement ever has no "before", and a hand-typed range is a question about
 * those dates and no others.
 */
export function equivalentBefore(period: Period, elapsed: number): Period | null {
  if (period.kind === 'all' || period.kind === 'range') return null;

  const earlier = shiftPeriod(period, -1);
  if (earlier.from === null || earlier.to === null) return null;
  if (earlier.from === period.from) return null;

  // As many days as have actually happened here, from the start of there.
  const last = addDays(earlier.from, elapsed - 1);
  return { kind: period.kind, from: earlier.from, to: last < earlier.to ? last : earlier.to };
}

/** A date some days on from another. */
export function addDays(iso: string, days: number): string {
  const at = new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86_400_000);
  return at.toISOString().slice(0, 10);
}

/**
 * The months a period touches, in order, as `YYYY-MM`.
 *
 * What the per-month analyses count over: the months themselves, not the
 * months that happen to carry a movement, so a month where nothing was spent
 * is a zero in the list rather than a gap nobody notices.
 */
export function monthsIn(period: Period, today: string): string[] {
  const from = period.from ?? null;
  const to = period.to ?? null;
  if (from === null || to === null) return [];

  const last = to < today ? to : today;
  if (last < from) return [];

  const months: string[] = [];
  let at = from.slice(0, 7);
  const end = last.slice(0, 7);
  while (at <= end && months.length < 120) {
    months.push(at);
    const [year, month] = at.split('-').map(Number);
    at = month === 12
      ? `${year + 1}-01`
      : `${year}-${String(month + 1).padStart(2, '0')}`;
  }
  return months;
}

/**
 * How many days of the period have actually happened.
 *
 * A period running past today is only part-finished, and nearly every average
 * and comparison in the report depends on knowing that: a daily average over
 * 30 days on the 21st is wrong by a third, and it is wrong in the direction
 * that makes the user feel better, which is the worse direction to be wrong in.
 */
export function daysElapsed(data: ReportData): { days: number; whole: boolean } {
  const { from, to } = data.period;

  // No dates at all: every movement ever. The span is what the movements
  // themselves cover, and it is whole by definition.
  if (!from || !to) {
    const dates = data.movements.map(movement => movement.transaction.occurred_on).sort();
    if (dates.length === 0) return { days: 1, whole: true };
    return { days: daysBetween(dates[0], dates[dates.length - 1]), whole: true };
  }

  const last = to <= data.today ? to : data.today;
  // A period entirely in the future has no days behind it, and no average.
  if (last < from) return { days: 0, whole: false };

  return { days: daysBetween(from, last), whole: to <= data.today };
}

/** Whole days from one date to another, both ends counted. */
export function daysBetween(from: string, to: string): number {
  const ms = Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`);
  return Math.max(1, Math.round(ms / 86_400_000) + 1);
}
