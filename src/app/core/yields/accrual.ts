/**
 * The engine: walking an account day by day and writing what it earned.
 *
 * One pass per account, from the day after its opening figure up to the day
 * asked for. Each day needs three things, and each of them is a decision that
 * was made deliberately:
 *
 *   * **The balance it earns on** is the account's ledger balance plus the
 *     cushion accumulated so far. The bank did pay those yields in even though
 *     Monefy never recorded them, so the money earning interest tomorrow
 *     includes them. Leaving them out would under-pay, more so every year.
 *
 *   * **The rate** is the band in force on that day whose range the balance
 *     falls into. A rate that carries a monthly-spend condition (Uala asks for
 *     400,000 spent in the month) applies only in a month that met it; the
 *     spend of the whole calendar month is what decides, so a month still
 *     running turns the rate on as soon as the threshold is passed and the
 *     earlier days fill in on the next pass. That is why a recompute always
 *     restarts at the beginning of a month.
 *
 *   * **The withholding** comes from `tax_parameters`, and is null until every
 *     part of the rule is entered and confirmed. A day it could not decide is
 *     written with the full yield and flagged, never with a silent zero.
 *
 * A day marked `locked` — corrected by hand against a statement — is never
 * rewritten. It still counts towards the cushion, at the corrected figure.
 *
 * The balances are read once and walked in memory rather than queried per day:
 * five years is under two thousand days, but one query each would be two
 * thousand round trips through the plugin bridge on a phone.
 */

import type { SqlDriver } from '../database/sql-driver';
import type { IsoDate } from '../database/types';
import type {
  ExcludedBalance, PocketBalance, YieldRate, YieldsRepository,
} from '../database/repositories/yields.repository';
import type { TaxParametersRepository } from '../database/repositories/tax-parameters.repository';
import { accrueDay, bandFor, rateWhenConditionMissed, type RateBand, type WithholdingRule } from './yield-math';
import { addDays, eachDay, monthOf, nextDay, startOfMonth } from './days';

export interface AccrualResult {
  account_id: number;
  /** Null when nothing was done: not enrolled, disabled, or nothing to do. */
  from: IsoDate | null;
  to: IsoDate | null;
  daysWritten: number;
  /** Days left alone because they were corrected by hand. */
  daysLocked: number;
  /** Net added to the cushion by this pass. */
  netMinor: number;
  withheldMinor: number;
  /** Days whose withholding could not be worked out for lack of parameters. */
  daysWithUnknownWithholding: number;
  /** How many pockets the account was split into. */
  pockets: number;
  /** Days that fell back to a lower rate because a monthly condition was missed. */
  daysConditionNotMet: number;
  /** Part of the balance that was sitting in something that pays nothing. */
  excludedMinor: number;
}

export class AccrualEngine {
  private readonly db: SqlDriver;
  private readonly yields: YieldsRepository;
  private readonly tax: TaxParametersRepository;

  constructor(db: SqlDriver, yields: YieldsRepository, tax: TaxParametersRepository) {
    this.db = db;
    this.yields = yields;
    this.tax = tax;
  }

  /** Every enrolled account, up to the same day. */
  async accrueAll(upTo: IsoDate): Promise<AccrualResult[]> {
    const accounts = await this.yields.accounts();
    const out: AccrualResult[] = [];
    for (const account of accounts) {
      out.push(await this.accrue(account.account_id, upTo));
    }
    return out;
  }

  async accrue(accountId: number, upTo: IsoDate): Promise<AccrualResult> {
    const nothing: AccrualResult = {
      account_id: accountId, from: null, to: null, daysWritten: 0, daysLocked: 0,
      netMinor: 0, withheldMinor: 0, daysWithUnknownWithholding: 0,
      daysConditionNotMet: 0, excludedMinor: 0, pockets: 0,
    };

    const enrolled = await this.yields.account(accountId);
    if (!enrolled || enrolled.enabled === 0) return nothing;

    // Where to resume. A month already partly accrued is redone from its first
    // day, because a monthly condition can only be judged on the whole month.
    const last = await this.yields.lastAccruedDay(accountId);
    const firstEver = nextDay(enrolled.opening_on);
    const from = last === null ? firstEver : startOfMonth(last) < firstEver ? firstEver : startOfMonth(last);
    if (from > upTo) return nothing;

    return this.db.transaction(async () => {
      await this.yields.clearDays(accountId, from);

      const balances = await this.dailyBalances(accountId, upTo);
      const rates = await this.yields.rateHistory(accountId);
      const excluded = await this.yields.excludedHistory(accountId);

      // An account always has at least one pocket. Without one there is
      // nothing to accrue on, and saying so beats writing zeroes.
      const pockets = await this.yields.pockets(accountId);
      if (pockets.length === 0) return nothing;

      const balancesOf = new Map<number, PocketBalance[]>();
      for (const pocket of pockets) {
        balancesOf.set(pocket.id, await this.yields.pocketBalances(pocket.id));
      }
      const spendByMonth = await this.monthlySpend(accountId, upTo);
      const cushionBefore = await this.yields.cushion(accountId, addDays(from, -1));
      const locked = new Map(
        (await this.yields.days(accountId, from, upTo))
          .filter(day => day.locked === 1)
          .map(day => [`${day.pocket_id}|${day.on_date}`, day]));

      // The rule can change from one day to the next, and asking the database
      // for it on every one of two thousand days would be the slow part.
      const rules = new Map<string, WithholdingRule | null>();
      const ruleFor = async (day: IsoDate): Promise<WithholdingRule | null> => {
        const key = monthOf(day);
        if (!rules.has(key)) rules.set(key, await this.tax.withholdingRule(day));
        return rules.get(key) ?? null;
      };

      const cushion = cushionBefore.totalMinor;
      const result: AccrualResult = { ...nothing, from, to: upTo, pockets: pockets.length };

      // Where the cushion earns depends on what the pocket balance means.
      //
      // A figure typed in for a pocket is what the BANK says that pocket
      // holds, and a bank balance already contains every yield it has ever
      // paid in. Adding the cushion on top of it would count that money
      // twice - which it did, until Jose read the real figures off Dale on
      // 2026-09-10 and they were 263,309 lower than this app believed.
      //
      // The ledger pocket is the opposite case. Its balance comes from the
      // movements, and the movements never recorded those yields - that is
      // the whole reason the cushion is a separate figure. So the cushion
      // earns there, which is exactly what a single-pocket account always
      // did.
      //
      // With no ledger pocket the cushion earns nowhere: it is already
      // inside the figures typed in. It stays recorded, and it is still
      // money that can be moved into net worth.
      const cushionOf = new Map<number, number>(pockets.map(pocket => [pocket.id, 0]));
      const ledgerPocket = pockets.find(pocket => pocket.source === 'ledger');
      if (ledgerPocket) cushionOf.set(ledgerPocket.id, cushion);

      for (const day of eachDay(from, upTo)) {
        const rule = await ruleFor(day);

        // What the ledger pocket is left with, once the pockets holding a
        // figure of their own have taken theirs.
        const manualTotal = pockets
          .filter(pocket => pocket.source === 'manual')
          .reduce((sum, pocket) => sum + amountOn(balancesOf.get(pocket.id) ?? [], day), 0);
        const ledger = balanceOn(balances, day) - excludedOn(excluded, day) - manualTotal;

        for (const pocket of pockets) {
          const lockedDay = locked.get(`${pocket.id}|${day}`);
          if (lockedDay) {
            // Left exactly as it was, and still part of the cushion.
            const net = lockedDay.actual_net_minor ?? lockedDay.net_minor;
            cushionOf.set(pocket.id, (cushionOf.get(pocket.id) ?? 0) + net);
            result.daysLocked += 1;
            continue;
          }

          const held = pocket.source === 'manual'
            ? amountOn(balancesOf.get(pocket.id) ?? [], day)
            : ledger;
          const base = Math.max(0, held) + (cushionOf.get(pocket.id) ?? 0);

          let band = bandFor(bandsInForce(rates, day), base);

          if (band?.requiresMonthlySpendMinor != null) {
            const spent = spendByMonth.get(monthOf(day)) ?? 0;
            if (spent < band.requiresMonthlySpendMinor) {
              // Missing the condition is not the same as earning nothing:
              // Uala drops to 5% E.A. rather than to zero. A band with no
              // fallback does pay nothing, and says so with a rate of zero.
              band = { ...band, annual_rate_scaled: rateWhenConditionMissed(band.fallbackAnnualRateScaled) };
              result.daysConditionNotMet += 1;
            }
          }

          // The withholding is worked out here, on this pocket alone. That
          // is the whole reason pockets exist: the threshold in articulo
          // 1.2.4.2.87 applies to a payment, and the bank pays each pocket
          // separately. Summing first and taxing the total charges
          // withholding that is not owed.
          const accrued = accrueDay(base, band, rule, enrolled.withholding === 1);

          await this.yields.putDay({
            pocket_id: pocket.id,
            account_id: accountId,
            on_date: day,
            balance_minor: accrued.balance_minor,
            annual_rate_scaled: accrued.annual_rate_scaled,
            gross_minor: accrued.gross_minor,
            withholding_minor: accrued.withholding_minor,
            net_minor: accrued.net_minor,
            withholding_unknown: accrued.withholding_unknown ? 1 : 0,
          });

          cushionOf.set(pocket.id, (cushionOf.get(pocket.id) ?? 0) + accrued.net_minor);
          result.daysWritten += 1;
          result.netMinor += accrued.net_minor;
          result.withheldMinor += accrued.withholding_minor;
          if (accrued.withholding_unknown) result.daysWithUnknownWithholding += 1;
        }

        result.excludedMinor = excludedOn(excluded, day);
      }

      return result;
    });
  }

  /**
   * The account's ledger balance at the end of every day it moved on.
   *
   * Read as one row per day with a running total, so the walk above can find
   * any day's balance without another query.
   */
  private async dailyBalances(accountId: number, upTo: IsoDate): Promise<DayBalance[]> {
    const opening = await this.db.queryOne<{ opening_balance_minor: number }>(
      'SELECT opening_balance_minor FROM accounts WHERE id = ?', [accountId]);

    const moves = await this.db.query<{ on_date: IsoDate; total: number }>(
      `SELECT occurred_on AS on_date, SUM(amount_minor) AS total
       FROM transactions
       WHERE account_id = ? AND occurred_on <= ?
       GROUP BY occurred_on
       ORDER BY occurred_on`,
      [accountId, upTo]);

    let running = opening?.opening_balance_minor ?? 0;
    const out: DayBalance[] = [{ on_date: '0000-01-01', balance_minor: running }];
    for (const move of moves) {
      running += move.total;
      out.push({ on_date: move.on_date, balance_minor: running });
    }
    return out;
  }

  /**
   * How much was spent on the account in each calendar month.
   *
   * Expenses only, as a positive figure: a condition asks "did you spend
   * 400,000 this month", and money coming in is not spending. Transfer legs
   * are left out — moving your own money between your own accounts is not
   * spending either, and counting it would meet the condition for free.
   */
  private async monthlySpend(accountId: number, upTo: IsoDate): Promise<Map<string, number>> {
    const rows = await this.db.query<{ month: string; spent: number }>(
      `SELECT substr(occurred_on, 1, 7) AS month, -SUM(amount_minor) AS spent
       FROM transactions
       WHERE account_id = ? AND occurred_on <= ? AND amount_minor < 0 AND transfer_id IS NULL
       GROUP BY month`,
      [accountId, upTo]);
    return new Map(rows.map(row => [row.month, row.spent]));
  }
}

/** A rate band that may only apply in a month where enough was spent. */
interface ConditionalBand extends RateBand {
  requiresMonthlySpendMinor: number | null;
  fallbackAnnualRateScaled: number | null;
}

/** What a manual pocket held on a day: the newest figure on or before it. */
function amountOn(history: PocketBalance[], day: IsoDate): number {
  let amount = 0;
  for (const entry of history) {
    if (entry.valid_from > day) break;
    amount = entry.amount_minor;
  }
  return amount;
}

/** How much of the account was not earning on a day. */
function excludedOn(history: ExcludedBalance[], day: IsoDate): number {
  let amount = 0;
  for (const entry of history) {
    if (entry.valid_from > day) break;
    amount = entry.amount_minor;
  }
  return amount;
}

/**
 * The bands in force on a day, out of the account's whole rate history.
 *
 * Worked out in memory rather than with a query per day. A band is identified
 * by where it starts, so for each of those the newest row on or before the day
 * wins — which is what makes a future-dated rate (Plata dropping to 9% on
 * 2026-11-09) simply wait its turn instead of needing to be remembered.
 */
function bandsInForce(rates: YieldRate[], day: IsoDate): ConditionalBand[] {
  const newest = new Map<number, YieldRate>();
  for (const rate of rates) {
    if (rate.valid_from > day) continue;
    const current = newest.get(rate.min_balance_minor);
    if (!current || rate.valid_from > current.valid_from ||
        (rate.valid_from === current.valid_from && rate.id > current.id)) {
      newest.set(rate.min_balance_minor, rate);
    }
  }

  return [...newest.values()]
    .sort((a, b) => a.min_balance_minor - b.min_balance_minor)
    .map(rate => ({
      annual_rate_scaled: rate.annual_rate_scaled,
      min_balance_minor: rate.min_balance_minor,
      max_balance_minor: rate.max_balance_minor,
      requiresMonthlySpendMinor: rate.requires_monthly_spend_minor,
      fallbackAnnualRateScaled: rate.fallback_annual_rate_scaled,
    }));
}

interface DayBalance {
  on_date: IsoDate;
  balance_minor: number;
}

/** The balance at the end of `day`: the newest entry on or before it. */
function balanceOn(balances: DayBalance[], day: IsoDate): number {
  let found = 0;
  for (const entry of balances) {
    if (entry.on_date > day) break;
    found = entry.balance_minor;
  }
  return found;
}

