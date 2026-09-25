/**
 * The yields of one tax year, as the income-tax form brings them in.
 *
 * Read from the yields summary's own data (`gatherYieldsReport`), so the form
 * and the summary never tell two stories about one year: the same days, the
 * same estimate for the months before the app began working an account out,
 * and every figure in pesos at the rate of its own day (rule 3). Asked for by
 * Jose on 2026-09-25, after the form had been bringing only the days worked
 * out - from September, for him - and adding dollars as if they were pesos.
 *
 * **Accounts of type Inversión are left out, even with products.** What such
 * an account earns stays inside it until it is taken out, and only what the
 * fund certifies as realized in the year is taxed - 48 of Jose's 55 million
 * in Fiducuenta, one year. The app cannot know that figure; the person types
 * it into casilla 58 from the certificate (Jose's choice, the same day).
 *
 * An estimated day carries what was PAID, net of withholding, as its gross
 * (`estimate.ts` measures a rate on what landed), so the estimated part is a
 * little short of the gross the bank will certify. Said on screen, never
 * hidden in the total.
 */

import type { YieldsReportData } from './yields-data';

export interface TaxYearYields {
  /** Worked out by the engine, gross, in pesos. */
  workedMinor: number;
  /** Estimated for the days before the engine began, in pesos. */
  estimatedMinor: number;
  /** Withheld on the days worked out, in pesos. Estimates carry none. */
  withheldMinor: number;
  workedDays: number;
  estimatedDays: number;
  /** Days of a currency with no rate on record: left out, and counted. */
  leftOutDays: number;
  /** The investment accounts that earn here and were left out, by name. */
  investmentsLeftOut: string[];
}

export function yieldsOfTaxYear(data: YieldsReportData, year: number): TaxYearYields {
  const from = `${year}-01-01`;
  const to = `${year}-12-31`;
  const kind = new Map(data.accounts.map(account => [account.id, account]));
  const out: TaxYearYields = {
    workedMinor: 0, estimatedMinor: 0, withheldMinor: 0,
    workedDays: 0, estimatedDays: 0, leftOutDays: 0, investmentsLeftOut: [],
  };
  const skipped = new Set<string>();

  for (const day of data.days) {
    if (day.on_date < from || day.on_date > to) continue;
    const account = kind.get(day.account_id);
    if (account?.type === 'investment') {
      skipped.add(account.name);
      continue;
    }
    const gross = data.inReportCurrency(day.gross_minor, day.account_id, day.on_date);
    const withheld = data.inReportCurrency(day.withholding_minor, day.account_id, day.on_date);
    if (gross === null || withheld === null) {
      out.leftOutDays += 1;
      continue;
    }
    if (day.estimated) {
      out.estimatedMinor += gross;
      out.estimatedDays += 1;
    } else {
      out.workedMinor += gross;
      out.withheldMinor += withheld;
      out.workedDays += 1;
    }
  }

  // Whole pesos' cents: the form holds integers (rule 2).
  out.workedMinor = Math.round(out.workedMinor);
  out.estimatedMinor = Math.round(out.estimatedMinor);
  out.withheldMinor = Math.round(out.withheldMinor);
  out.investmentsLeftOut = [...skipped].sort();
  return out;
}
