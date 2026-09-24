/**
 * Everything the yields summary is allowed to look at, gathered once.
 *
 * The second report built on the first one's machinery (rule 20): the same
 * blocks, the same screen, the same spreadsheet writer, a different list of
 * analyses reading a different set of facts. Asked for by Jose on 2026-09-24:
 * what the app worked out day by day, what the bank actually paid, how it
 * grew, and how months compare.
 *
 * **No analysis queries the database** here either. The days are read in one
 * query, reaching back far enough for the month-by-month trend, and every
 * analysis picks what it needs out of them.
 */

import type { Period } from '../filters/period';
import type { AccountRow } from '../database/types';
import type { ReportWords } from './report-words';

/** One worked-out day of one part of one product's rate. */
export interface YieldDayRow {
  account_id: number;
  product_id: number;
  component: string;
  /** The day the money is handed over (rule 15). */
  on_date: string;
  /** For a part paid monthly, the day it actually lands. */
  paid_on: string | null;
  balance_minor: number;
  annual_rate_scaled: number;
  gross_minor: number;
  withholding_minor: number;
  net_minor: number;
  /** What the bank paid, where Jose typed it in from a statement. */
  actual_net_minor: number | null;
  locked: number;
}

export interface YieldsReportData {
  period: Period;
  periodLabel: string;

  /** The account chosen, or null for every account that earns. */
  account: AccountRow | null;
  /** The accounts in scope: only ones that earn. */
  accounts: readonly AccountRow[];
  /** Their products, for naming the rows of one account. */
  products: readonly { id: number; account_id: number; name: string }[];

  /**
   * Every day from far enough back for the trend - a year before the end of
   * the period, or the start of the period if that is earlier - up to its end.
   * The analyses of THIS period filter these by date themselves.
   */
  days: readonly YieldDayRow[];

  /** The same stretch of the period before, or null where none makes sense. */
  before: { period: Period; label: string; clipped: boolean } | null;

  /**
   * An amount in the report's currency: the account's own for one account,
   * pesos at the rate of its own day for all of them (rule 3). Null when a
   * currency has no rate on record - such a day is left out and counted,
   * never guessed at.
   */
  inReportCurrency: (minor: number, accountId: number, day: string) => number | null;
  currency: string;

  today: string;
  locale: string;
  words: ReportWords;
}

/** A day's yield as it reached the account: the bank's figure where known. */
export function paidOf(day: YieldDayRow): number {
  return day.actual_net_minor ?? day.net_minor;
}

/** Whether a day falls inside the period being looked at. */
export function inPeriod(data: YieldsReportData, day: string): boolean {
  const { from, to } = data.period;
  return (from === null || day >= from) && (to === null || day <= to) && day <= data.today;
}
