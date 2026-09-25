/**
 * Gathers what the yields summary reads, once - the part of
 * `YieldsReportService` that is not Angular, so the same code that feeds the
 * screen can be run over a restored backup from Node. That is how a figure on
 * this report is checked against Jose's own data (2026-09-24).
 *
 * Four queries however long the period: the accounts, their products, the
 * days, and the exchange rates, plus two for investment accounts. The days
 * reach back a year before the end of the period, for the month-by-month trend.
 */

import type { SqlDriver } from '../database/sql-driver';
import { AccountsRepository } from '../database/repositories/accounts.repository';
import { YieldsRepository } from '../database/repositories/yields.repository';
import { convertToBaseMinor } from '../database/money';
import { periodLabel, type Period } from '../filters/period';
import type { InflationMonth } from '../inflation/inflation';
import { daysBetween, equivalentBefore } from './report-data';
import { estimateBeforeRecord } from './estimate';
import type { ReportWords } from './report-words';
import type { InvestmentData, YieldDayRow, YieldsReportData } from './yields-data';

/** What the screen asks for: the app's own filter, language and today. */
export interface YieldsAsk {
  period: Period;
  accountId: number | null;
  today: string;
  locale: string;
  words: ReportWords;
  /** How the period "all" is called. */
  allLabel: string;
  inflation: readonly InflationMonth[];
}

export async function gatherYieldsReport(db: SqlDriver, ask: YieldsAsk): Promise<YieldsReportData> {
  const { period, today, locale, words, allLabel, inflation } = ask;

  // Only accounts that earn are in scope. One chosen that does not earn
  // leaves the scope empty, and the screen says there is nothing to show.
  const yields = new YieldsRepository(db);
  const enrolled = new Set((await yields.accounts()).map(entry => entry.account_id));
  // And investments without products that write down what they earned: an
  // account of that type with a movement under a category marked as a
  // return (migration 047). eToro and XTB record none, so they stay out
  // rather than sit in the average earning nothing.
  const withReturns = await db.query<{ account_id: number }>(
    `SELECT DISTINCT t.account_id FROM transactions t
     JOIN categories c ON c.id = t.category_id
     JOIN accounts a ON a.id = t.account_id
     WHERE c.counts_as_return = 1 AND a.type = 'investment'`);
  const invested = new Set(withReturns.map(row => row.account_id).filter(id => !enrolled.has(id)));
  const all = (await new AccountsRepository(db).list({ includeArchived: true }))
    .filter(account => enrolled.has(account.id) || invested.has(account.id));
  const chosen = ask.accountId;
  const account = chosen === null ? null : all.find(one => one.id === chosen) ?? null;
  const accounts = chosen === null ? all : (account ? [account] : []);
  const ids = accounts.map(one => one.id);

  const products = (await yields.allProducts())
    .filter(product => ids.includes(product.account_id))
    .map(product => ({ id: product.id, account_id: product.account_id, name: product.name }));

  // A year before the end of the period, or its start if that is earlier.
  const end = period.to && period.to < today ? period.to : today;
  const yearBack = `${Number(end.slice(0, 4)) - 1}-${end.slice(5, 7)}-01`;
  const from = period.from === null ? null : (period.from < yearBack ? period.from : yearBack);

  const worked = ids.length === 0 ? [] : await db.query<YieldDayRow>(
    `SELECT account_id, product_id, component, on_date, paid_on, balance_minor,
            annual_rate_scaled, gross_minor, withholding_minor, net_minor,
            actual_net_minor, locked
     FROM yield_days
     WHERE account_id IN (${ids.map(() => '?').join(', ')})
       AND on_date <= ? ${from === null ? '' : 'AND on_date >= ?'}
     ORDER BY on_date`,
    [...ids, end, ...(from === null ? [] : [from])]);

  const investments = await investmentsOf(db,
    accounts.filter(one => invested.has(one.id)), from, end);

  // The days before an account with products began to be worked out, estimated
  // and marked (`estimate.ts`). With no start to the period, a year before
  // today at most: an estimate is not history.
  const earning = accounts.filter(one => enrolled.has(one.id));
  const estimateFrom = from ?? `${Number(today.slice(0, 4)) - 1}${today.slice(4)}`;
  const ledgers = await investmentsOf(db, earning, estimateFrom, end);
  const estimated = estimateBeforeRecord(
    worked, ledgers, new Map(earning.map(one => [one.id, one.opened_on])), estimateFrom, today);
  const days = estimated.length === 0 ? worked
    : [...estimated, ...worked].sort((a, b) => a.on_date.localeCompare(b.on_date));

  const currencyOf = new Map(accounts.map(one => [one.id, one.currency_code]));
  const currency = account ? account.currency_code : 'COP';
  const inReportCurrency = account
    ? (minor: number) => minor
    : await toPesos(db, currencyOf);

  // The same stretch of the period before: as many days as have gone by.
  const elapsed = period.from && period.to
    ? daysBetween(period.from, period.to < today ? period.to : today)
    : 0;
  const earlier = elapsed > 0 ? equivalentBefore(period, elapsed) : null;
  const clipped = !!(period.to && period.to > today);

  return {
    inflation,
    investments,
    period,
    periodLabel: periodLabel(period, locale, allLabel),
    account,
    accounts,
    products,
    days,
    before: earlier === null ? null : {
      period: earlier,
      label: periodLabel(earlier, locale, allLabel),
      clipped,
    },
    inReportCurrency,
    currency,
    today,
    locale,
    words,
  };
}

/**
 * Each account's balance where the window opens and its movements from there,
 * with the last return written down before it: three queries for all of them.
 * Investments read it for their returns, accounts with products for the
 * balance an estimate is worked on.
 */
async function investmentsOf(
  db: SqlDriver,
  accounts: readonly { id: number; opening_balance_minor: number; opened_on: string }[], from: string | null, end: string,
): Promise<InvestmentData[]> {
  if (accounts.length === 0) return [];
  const ids = accounts.map(one => one.id);
  const marks = ids.map(() => '?').join(', ');
  const before = from === null ? [] : await db.query<{ account_id: number; total: number }>(
    `SELECT account_id, SUM(amount_minor) AS total FROM transactions
     WHERE account_id IN (${marks}) AND occurred_on < ? GROUP BY account_id`, [...ids, from]);
  const previous = from === null ? [] : await db.query<{ account_id: number; on_date: string }>(
    `SELECT t.account_id, MAX(t.occurred_on) AS on_date FROM transactions t
     JOIN categories c ON c.id = t.category_id
     WHERE t.account_id IN (${marks}) AND c.counts_as_return = 1 AND t.occurred_on < ?
     GROUP BY t.account_id`, [...ids, from]);
  const movements = await db.query<{ account_id: number; on_date: string; amount_minor: number; is_return: number }>(
    `SELECT t.account_id, t.occurred_on AS on_date, t.amount_minor,
            COALESCE(c.counts_as_return, 0) AS is_return
     FROM transactions t LEFT JOIN categories c ON c.id = t.category_id
     WHERE t.account_id IN (${marks}) AND t.occurred_on <= ? ${from === null ? '' : 'AND t.occurred_on >= ?'}
     ORDER BY t.occurred_on, t.id`, [...ids, end, ...(from === null ? [] : [from])]);

  return accounts.map(account => {
    const own = movements.filter(row => row.account_id === account.id);
    return {
      account_id: account.id,
      // Never before the account existed in the app: nothing is known of it
      // then, and its opening balance is not a balance it held.
      from: [from ?? own[0]?.on_date ?? end, account.opened_on].sort()[1],
      opening_minor: account.opening_balance_minor
        + (before.find(row => row.account_id === account.id)?.total ?? 0),
      previous_return_on: previous.find(row => row.account_id === account.id)?.on_date ?? null,
      movements: own.map(({ on_date, amount_minor, is_return }) => ({ on_date, amount_minor, is_return })),
    };
  });
}

/**
 * Pesos at the rate of the day (rule 3): the rate on record for that day or
 * the last one before it, or failing that the first one after. Null for a
 * currency with no rate at all, which the report then counts and names.
 */
async function toPesos(db: SqlDriver, currencyOf: ReadonlyMap<number, string>): Promise<
  (minor: number, accountId: number, day: string) => number | null
> {
  const foreign = [...new Set([...currencyOf.values()].filter(code => code !== 'COP'))];
  const rates = new Map<string, { on_date: string; rate_scaled: number }[]>();
  if (foreign.length > 0) {
    const rows = await db.query<{ base_code: string; on_date: string; rate_scaled: number }>(
      `SELECT base_code, on_date, rate_scaled FROM exchange_rates
       WHERE quote_code = 'COP' AND base_code IN (${foreign.map(() => '?').join(', ')})
       ORDER BY on_date`, foreign);
    for (const row of rows) rates.set(row.base_code, [...(rates.get(row.base_code) ?? []), row]);
  }

  return (minor, accountId, day) => {
    const code = currencyOf.get(accountId) ?? 'COP';
    if (code === 'COP') return minor;
    const list = rates.get(code);
    if (!list || list.length === 0) return null;
    let pick = list[0];
    for (const one of list) {
      if (one.on_date <= day) pick = one;
      else break;
    }
    return convertToBaseMinor(minor, pick.rate_scaled);
  };
}
