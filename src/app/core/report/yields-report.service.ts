/**
 * Gathers what the yields summary reads, once, and runs its analyses.
 *
 * The one place that talks to the database for it. The period and the
 * account are the app's own - the same `FilterService` the summary screen
 * and the money summary answer to - so arriving here from an account's
 * yields, or changing the dates on this screen, is one question asked once.
 *
 * Four queries however long the period: the accounts, their products, the
 * days, and the exchange rates. The days reach back a year before the end of
 * the period, for the month-by-month trend.
 */

import { inject, Injectable } from '@angular/core';

import { DatabaseService } from '../database/database.service';
import { AccountsRepository } from '../database/repositories/accounts.repository';
import { YieldsRepository } from '../database/repositories/yields.repository';
import { convertToBaseMinor } from '../database/money';
import { FilterService } from '../filters/filter.service';
import { periodLabel } from '../filters/period';
import { I18nService } from '../i18n/i18n.service';
import { InflationService } from '../inflation/inflation.service';
import { todayIso } from '../yields/days';
import type { Block } from './blocks';
import { daysBetween, equivalentBefore } from './report-data';
import { reportWords } from './report-words';
import { buildYieldsReport } from './sections-yields';
import type { InvestmentData, YieldDayRow, YieldsReportData } from './yields-data';

@Injectable({ providedIn: 'root' })
export class YieldsReportService {
  private readonly database = inject(DatabaseService);
  private readonly filter = inject(FilterService);
  private readonly i18n = inject(I18nService);
  private readonly inflation = inject(InflationService);

  async build(): Promise<{ data: YieldsReportData; blocks: Block[] }> {
    const data = await this.gather();
    return { data, blocks: buildYieldsReport(data) };
  }

  async gather(): Promise<YieldsReportData> {
    const db = this.database.driver;
    const period = this.filter.period();
    const locale = this.i18n.dateLocale();
    const today = todayIso();
    const words = reportWords(key => this.i18n.t(key));

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
    const chosen = this.filter.accountId();
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

    const days = ids.length === 0 ? [] : await db.query<YieldDayRow>(
      `SELECT account_id, product_id, component, on_date, paid_on, balance_minor,
              annual_rate_scaled, gross_minor, withholding_minor, net_minor,
              actual_net_minor, locked
       FROM yield_days
       WHERE account_id IN (${ids.map(() => '?').join(', ')})
         AND on_date <= ? ${from === null ? '' : 'AND on_date >= ?'}
       ORDER BY on_date`,
      [...ids, end, ...(from === null ? [] : [from])]);

    // Newer months are asked for without waiting: they show next time.
    const inflation = await this.inflation.months();
    void this.inflation.refreshIfDue(inflation);

    const investments = await this.investmentsOf(
      accounts.filter(one => invested.has(one.id)), from, end);

    const currencyOf = new Map(accounts.map(one => [one.id, one.currency_code]));
    const currency = account ? account.currency_code : 'COP';
    const inReportCurrency = account
      ? (minor: number) => minor
      : await this.toPesos(currencyOf);

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
      periodLabel: periodLabel(period, locale, this.i18n.t('period.all')),
      account,
      accounts,
      products,
      days,
      before: earlier === null ? null : {
        period: earlier,
        label: periodLabel(earlier, locale, this.i18n.t('period.all')),
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
   * Each investment account's balance where the window opens and its
   * movements from there: two queries for all of them.
   */
  private async investmentsOf(
    accounts: readonly { id: number; opening_balance_minor: number }[], from: string | null, end: string,
  ): Promise<InvestmentData[]> {
    if (accounts.length === 0) return [];
    const db = this.database.driver;
    const ids = accounts.map(one => one.id);
    const marks = ids.map(() => '?').join(', ');
    const before = from === null ? [] : await db.query<{ account_id: number; total: number }>(
      `SELECT account_id, SUM(amount_minor) AS total FROM transactions
       WHERE account_id IN (${marks}) AND occurred_on < ? GROUP BY account_id`, [...ids, from]);
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
        from: from ?? own[0]?.on_date ?? end,
        opening_minor: account.opening_balance_minor
          + (before.find(row => row.account_id === account.id)?.total ?? 0),
        movements: own.map(({ on_date, amount_minor, is_return }) => ({ on_date, amount_minor, is_return })),
      };
    });
  }

  /**
   * Pesos at the rate of the day (rule 3): the rate on record for that day or
   * the last one before it, or failing that the first one after. Null for a
   * currency with no rate at all, which the report then counts and names.
   */
  private async toPesos(currencyOf: ReadonlyMap<number, string>): Promise<
    (minor: number, accountId: number, day: string) => number | null
  > {
    const foreign = [...new Set([...currencyOf.values()].filter(code => code !== 'COP'))];
    const rates = new Map<string, { on_date: string; rate_scaled: number }[]>();
    if (foreign.length > 0) {
      const rows = await this.database.driver.query<{ base_code: string; on_date: string; rate_scaled: number }>(
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
}
