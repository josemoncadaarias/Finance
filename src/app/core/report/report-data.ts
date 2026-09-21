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
import type { Period } from '../filters/period';
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

  /** Today, so a part-finished period can be recognised as one. */
  today: string;

  /** The report's words, in the app's language. */
  words: ReportWords;
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
