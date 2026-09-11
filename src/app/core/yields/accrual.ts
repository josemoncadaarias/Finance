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
  CushionEntry, PocketBalance, YieldPocket, YieldRate, YieldsRepository,
} from '../database/repositories/yields.repository';
import type { TaxParametersRepository } from '../database/repositories/tax-parameters.repository';
import { accrueDay, bandFor, rateWhenConditionMissed, type RateBand, type WithholdingRule } from './yield-math';
import { addDays, eachDay, endOfMonth, monthOf, nextDay, startOfMonth } from './days';

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
}

/**
 * Which product takes a movement that names none.
 *
 * The usual one, marked by the user - not the first in the list. Sort order
 * records only when each product was created, and Jose created his savings
 * products last, so "the first" is whichever alcancía happened to predate
 * them. Every row the Monefy importer writes names no product, so this is the
 * rule that decides where a re-imported history lands.
 *
 * The first is the fallback for an account where nothing is marked, which the
 * schema makes unlikely: every account had one set when the flag was added.
 */
function absorbsUnassigned(pockets: readonly YieldPocket[]): number | null {
  const usual = pockets.find(pocket => pocket.is_default === 1);
  return (usual ?? pockets[0])?.id ?? null;
}

/** Past any date a person will type. Used where an answer has no upper bound. */
const FAR_FUTURE = '9999-12-31';

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

  /**
   * What each product holds today.
   *
   * The figure someone checks against the bank, product by product, and the
   * one thing this module was missing: an account's own balance is a summary
   * of everything inside it and says nothing about how the parts are doing.
   *
   * It is the stated figure plus what has moved through THAT product since -
   * the same rule the accrual earns on, so the two can never disagree about
   * what a product holds.
   *
   * It can come out negative, and that is worth seeing rather than hiding. A
   * product goes negative when money was taken out of the account against it
   * and never moved in from the product that really had it: the savings
   * account was at zero, a transfer left from it, and the move from the
   * alcancia beside it was forgotten. The negative is the reminder. Earning
   * still floors at zero — a product in the red earns nothing, it does not
   * charge interest.
   */
  async heldByPocket(accountId: number, on: IsoDate): Promise<Map<number, number>> {
    const pockets = await this.yields.pockets(accountId);
    const held = new Map<number, number>();
    if (pockets.length === 0) return held;

    const enrolled = await this.yields.account(accountId);
    const opening = enrolled?.opening_on ?? on;
    const absorbs = absorbsUnassigned(pockets);

    // No upper bound: the account's own balance counts a movement dated next
    // week, so a product that did not would disagree with the account it is
    // inside.
    const balances = await this.dailyBalances(accountId, FAR_FUTURE);

    for (const [at, pocket] of pockets.entries()) {
      if (pocket.source !== 'manual') {
        held.set(pocket.id, balanceOn(balances, on));
        continue;
      }

      // Deliberately NOT `statedOn`, which is the earning base and stops a day
      // short: money arriving today earns from tomorrow, so for that purpose
      // today's movements do not count yet.
      //
      // This is a different question - how much is in it right now - and there
      // today's movements are exactly what must count. Jose spent a peso from
      // the savings product and watched the figure stay where it was, because
      // the screen was showing him what the product would earn on rather than
      // what it holds.
      // One rule, and the one Jose stated: the figure he typed IS the balance,
      // movements before the date it was set do not touch it, and everything
      // from that date on does.
      //
      // A product with no figure of its own starts from the day the account
      // was enrolled rather than from the beginning of time. Without that, a
      // product Jose knows to be empty was adding up sixty-six million of
      // history - every movement ever made had been filed against it.
      //
      // No upper bound either. A movement dated next week has been recorded,
      // and the account's own balance counts it, so a product that did not
      // would be disagreeing with the account it lives in.
      const history = await this.yields.pocketBalances(pocket.id);

      // The last balance recorded, whatever date it carries - not the last one
      // in force today.
      //
      // Today has nothing to do with this. A balance is a figure and a date it
      // starts counting from, and once one is recorded it governs, even if
      // that date is tomorrow: Jose set a balance to start on the 11th and an
      // expense on the 15th, and bounding the answer at today reported neither.
      // The engine still asks the other question, day by day, through
      // `statedOn`, and that one does depend on which day it is working out.
      const latest = history.at(-1);
      const stated = latest?.amount_minor ?? 0;
      const since: IsoDate | null = latest?.valid_from ?? null;

      if (since === null) {
        // No balance at all means no start date has been chosen, so counting
        // starts where this module started: the day the account was enrolled.
        held.set(pocket.id, await this.yields.movedInPocketSince(
          accountId, pocket.id, opening, pocket.id === absorbs));
        continue;
      }

      held.set(pocket.id, stated + await this.yields.movedInPocketSince(
        accountId, pocket.id, since, pocket.id === absorbs));
    }

    return held;
  }

  async accrue(accountId: number, upTo: IsoDate): Promise<AccrualResult> {
    const nothing: AccrualResult = {
      account_id: accountId, from: null, to: null, daysWritten: 0, daysLocked: 0,
      netMinor: 0, withheldMinor: 0, daysWithUnknownWithholding: 0,
      daysConditionNotMet: 0, pockets: 0,
    };

    const enrolled = await this.yields.account(accountId);
    if (!enrolled || enrolled.enabled === 0) return nothing;

    // Before anything else, and outside the decision about where to resume:
    // a day after today is wrong whatever the rest of this concludes, and the
    // early return below is exactly the path that used to leave one behind.
    await this.yields.clearFutureDays(accountId, upTo);

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

      // An account always has at least one pocket. Without one there is
      // nothing to accrue on, and saying so beats writing zeroes.
      const pockets = await this.yields.pockets(accountId);
      if (pockets.length === 0) return nothing;

      const entries: CushionEntry[] = await this.yields.adjustments(accountId);
      const takenOut = await this.yields.withdrawals(accountId);

      // What each product's own movements add up to, day by day. A movement
      // that names no product is the first product's, which is the rule that
      // held for every account before one could be named at all.
      const movedInto = new Map<number, DayBalance[]>();
      const takesUnassigned = absorbsUnassigned(pockets);
      for (const pocket of pockets) {
        movedInto.set(pocket.id, await this.dailyBalances(
          accountId, upTo, pocket.id, pocket.id === takesUnassigned));
      }

      const balancesOf = new Map<number, PocketBalance[]>();
      for (const pocket of pockets) {
        balancesOf.set(pocket.id, await this.yields.pocketBalances(pocket.id));
      }
      const spendByMonth = await this.monthlySpend(accountId, upTo);
      // Anything that lands in the cushion inside the range being worked
      // out has to be part of it from that day on. The starting figure
      // above only covers what happened BEFORE the range, so without this
      // an entry dated on the Wednesday left Thursday onwards still
      // earning on the old balance: the total came out right and every
      // day after it was quietly too small.
      const arriving = new Map<string, number>();
      const land = (day: IsoDate, pocketId: number, amount: number) => {
        const key = `${pocketId}|${day}`;
        arriving.set(key, (arriving.get(key) ?? 0) + amount);
      };
      const locked = new Map(
        (await this.yields.days(accountId, from, upTo))
          .filter(day => day.locked === 1)
          .map(day => [`${day.pocket_id}|${day.component}|${day.on_date}`, day]));

      // The rule can change from one day to the next, and asking the database
      // for it on every one of two thousand days would be the slow part.
      const rules = new Map<string, WithholdingRule | null>();
      const ruleFor = async (day: IsoDate): Promise<WithholdingRule | null> => {
        const key = monthOf(day);
        if (!rules.has(key)) rules.set(key, await this.tax.withholdingRule(day));
        return rules.get(key) ?? null;
      };

      const result: AccrualResult = { ...nothing, from, to: upTo, pockets: pockets.length };

      // The opening cushion is a RECORD, not money to add to the balance.
      //
      // This took four attempts to get right, so it is worth stating plainly:
      // the figure Jose entered per account is what that account had already
      // earned historically, and that money is already sitting inside the
      // balance. Adding it to the base counts it twice - it is what made
      // Rappi cuenta earn on 72.8 million when the account holds 67.9, and
      // what pushed one of Dale's alcancias over the withholding threshold.
      //
      // So every pocket starts at zero here. What grows during the walk is
      // only what THIS app worked out, which the balance genuinely does not
      // know about yet, and which therefore genuinely does compound.
      const cushionOf = new Map<number, number>(pockets.map(pocket => [pocket.id, 0]));
      const ledgerPocket = pockets.find(pocket => pocket.source === 'ledger');

      // An entry says which pocket it landed in when the user knows. When
      // it does not, it goes to the pocket that follows the account
      // balance, and failing that to the first one - the same order the
      // cushion itself follows.
      const fallbackPocket = ledgerPocket?.id ?? pockets[0].id;

      // A component paid monthly works its yield out every day and hands it
      // over at the end of the month. Until then the money is not in the
      // account and is not earning: it waits here, keyed by pocket and
      // component, and joins the base on the day it is actually paid.
      const waiting = new Map<string, number>();

      const creditTo = (pocketId: number, component: string, payout: 'daily' | 'monthly', net: number) => {
        if (payout === 'daily') {
          cushionOf.set(pocketId, (cushionOf.get(pocketId) ?? 0) + net);
          return;
        }
        const key = `${pocketId}|${component}`;
        waiting.set(key, (waiting.get(key) ?? 0) + net);
      };
      const pocketOf = (id: number | null) =>
        pockets.some(pocket => pocket.id === id) ? (id as number) : fallbackPocket;

      for (const entry of entries) {
        if (entry.on_date < from || entry.on_date > upTo) continue;
        land(entry.on_date, pocketOf(entry.pocket_id), entry.amount_minor);
      }
      for (const taken of takenOut) {
        if (taken.on_date < from || taken.on_date > upTo) continue;
        land(taken.on_date, fallbackPocket, -taken.amount_minor);
      }

      for (const day of eachDay(from, upTo)) {
        const rule = await ruleFor(day);

        for (const pocket of pockets) {
          // What the pocket holds on this day.
          //
          // A stated balance is a figure Jose read off the bank on a date, and
          // it is the whole truth about that pocket on that date - not a part
          // of a sum. Everything that has moved in or out of the account since
          // then is added on top, so a deposit made afterwards earns like any
          // other money.
          //
          // The movements go to the first pocket. A movement never says which
          // pocket it landed in, and putting it in all of them would count it
          // once per pocket; the drift check is what surfaces a guess gone
          // stale. With one pocket - which is every account but Dale - there is
          // nothing to guess.
          // A product that names a figure is that figure, plus whatever has
          // moved through THAT product since - not whatever moved through the
          // account. Before movements could name a product, the first one
          // absorbed all of them, which is why a transfer between two products
          // of one account moved neither.
          const held = pocket.source === 'manual'
            ? statedOn(balancesOf.get(pocket.id) ?? [], day,
                       movedInto.get(pocket.id) ?? [], true)
            : balanceOn(balances, day);

          const base = Math.max(0, held) + (cushionOf.get(pocket.id) ?? 0);

          // Every component earns on the same base and is worked out apart:
          // each has its own rate, its own condition and its own payday, and
          // the withholding threshold in articulo 1.2.4.2.87 is measured per
          // payment. Two components are two payments.
          for (const [component, bands] of componentsInForce(ratesFor(rates, pocket.id), day)) {
            const lockedDay = locked.get(`${pocket.id}|${component}|${day}`);

            if (lockedDay) {
              // Left exactly as it was, and still part of the cushion.
              const net = lockedDay.actual_net_minor ?? lockedDay.net_minor;
              creditTo(pocket.id, component, lockedDay.payout, net);
              result.daysLocked += 1;
              continue;
            }

            let band = bandFor(bands, base);
            if (band === null) continue;
            const payout = band.payout;

            if (band.requiresMonthlySpendMinor != null) {
              const spent = spendByMonth.get(monthOf(day)) ?? 0;
              if (spent < band.requiresMonthlySpendMinor) {
                // Missing the condition is not the same as earning nothing:
                // a band can fall back to a lower rate. One with no fallback
                // does pay nothing, and says so with a rate of zero.
                band = { ...band, annual_rate_scaled: rateWhenConditionMissed(band.fallbackAnnualRateScaled) };
                result.daysConditionNotMet += 1;
              }
            }

            const accrued = accrueDay(base, band, rule, enrolled.withholding === 1);

            await this.yields.putDay({
              pocket_id: pocket.id,
              account_id: accountId,
              component,
              payout,
              on_date: day,
              balance_minor: accrued.balance_minor,
              annual_rate_scaled: accrued.annual_rate_scaled,
              gross_minor: accrued.gross_minor,
              withholding_minor: accrued.withholding_minor,
              net_minor: accrued.net_minor,
              withholding_unknown: accrued.withholding_unknown ? 1 : 0,
            });

            creditTo(pocket.id, component, payout, accrued.net_minor);
            result.daysWritten += 1;
            result.netMinor += accrued.net_minor;
            result.withheldMinor += accrued.withholding_minor;
            if (accrued.withholding_unknown) result.daysWithUnknownWithholding += 1;
          }
        }

        // At the close of the day, so what arrived earns from the next one.
        // That is the same rule the opening figure follows: a figure
        // recorded on a day already covers that day.
        for (const pocket of pockets) {
          const landed = arriving.get(`${pocket.id}|${day}`);
          if (landed) cushionOf.set(pocket.id, (cushionOf.get(pocket.id) ?? 0) + landed);
        }

        // Payday: everything a monthly component has worked out since the
        // last one lands at once, and starts earning tomorrow.
        if (day === endOfMonth(day)) {
          for (const [key, owed] of waiting) {
            if (owed === 0) continue;
            const pocketId = Number(key.split('|')[0]);
            cushionOf.set(pocketId, (cushionOf.get(pocketId) ?? 0) + owed);
            waiting.set(key, 0);
          }
        }

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
  private async dailyBalances(
    accountId: number,
    upTo: IsoDate,
    pocketId?: number,
    takesUnassigned = false,
  ): Promise<DayBalance[]> {
    // The opening balance belongs to the account, not to any one product, so
    // a per-product walk starts from zero and counts only what moved.
    const opening = pocketId === undefined
      ? await this.db.queryOne<{ opening_balance_minor: number }>(
          'SELECT opening_balance_minor FROM accounts WHERE id = ?', [accountId])
      : { opening_balance_minor: 0 };

    // `pocketId` undefined means the whole account. Otherwise it is one
    // product's own movements - and for the first product, the movements that
    // named no product at all as well, which is where they have always gone.
    //
    // Both halves matter for the first product. Taking only the unnamed ones
    // lost every movement filed against it by name, so moving money out of
    // the savings account into a CDT credited the CDT and left the savings
    // account where it was.
    const scope = pocketId === undefined ? ''
      : takesUnassigned ? 'AND (pocket_id IS NULL OR pocket_id = ?)'
      : 'AND pocket_id = ?';
    const values: unknown[] = [accountId, upTo];
    if (pocketId !== undefined) values.push(pocketId);

    const moves = await this.db.query<{ on_date: IsoDate; total: number }>(
      `SELECT occurred_on AS on_date, SUM(amount_minor) AS total
       FROM transactions
       WHERE account_id = ? AND occurred_on <= ? ${scope}
       GROUP BY occurred_on
       ORDER BY occurred_on`,
      values);

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
  component: string;
  payout: 'daily' | 'monthly';
}

/**
 * What a pocket holds on a day: the figure stated for it, plus whatever has
 * moved in the account since that figure was read.
 *
 * The stated figure is the starting point and it is not negotiable - it is
 * what the bank said on the day it was read. What the ledger contributes is
 * only the CHANGE since then, which is exactly what "new movements are added
 * here too" means.
 */
function statedOn(
  history: PocketBalance[],
  day: IsoDate,
  balances: DayBalance[],
  takesMovements: boolean,
): number {
  let stated = 0;
  let statedFrom: IsoDate | null = null;
  for (const entry of history) {
    if (entry.valid_from > day) break;
    stated = entry.amount_minor;
    statedFrom = entry.valid_from;
  }

  if (statedFrom === null || !takesMovements) return stated;

  // What moved up to the END of the day before, not up to this one. A deposit
  // made today is in the account today, but the yield of a day is worked out
  // on what was there when the day started - which is the same rule the stated
  // figure follows, and the same rule an entry in the cushion follows. Money
  // that arrives today earns from tomorrow.
  return stated + (balanceOn(balances, addDays(day, -1)) - balanceOn(balances, statedFrom));
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


/**
 * The bands in force on a day, out of the account's whole rate history.
 *
 * Worked out in memory rather than with a query per day. A band is identified
 * by where it starts, so for each of those the newest row on or before the day
 * wins — which is what makes a future-dated rate (Plata dropping to 9% on
 * 2026-11-09) simply wait its turn instead of needing to be remembered.
 */
/**
 * The rates that apply to one pocket: its own if it has any, the account's
 * otherwise.
 *
 * Not a merge and not a precedence order - a pocket with a rate of its own
 * is a pocket the bank treats differently, and mixing in the account rate
 * would earn at both. One sentence, and no surprises at midnight.
 */
function ratesFor(rates: YieldRate[], pocketId: number): YieldRate[] {
  const own = rates.filter(rate => rate.pocket_id === pocketId);
  return own.length > 0 ? own : rates.filter(rate => rate.pocket_id === null);
}

/**
 * The bands in force on a day, grouped by component.
 *
 * An account earns the SUM of its components: Uala pays 5% E.A. every day
 * and 5.5% E.A. at the end of a month it spent enough in. Each one is its
 * own set of balance bands, its own condition and its own payday, so each
 * is worked out on its own and written as its own row.
 */
function componentsInForce(rates: YieldRate[], day: IsoDate): Map<string, ConditionalBand[]> {
  const newest = new Map<string, YieldRate>();
  for (const rate of rates) {
    if (rate.valid_from > day) continue;

    const key = `${rate.component}|${rate.min_balance_minor}`;
    const current = newest.get(key);
    if (!current || rate.valid_from > current.valid_from ||
        (rate.valid_from === current.valid_from && rate.id > current.id)) {
      newest.set(key, rate);
    }
  }

  const byComponent = new Map<string, ConditionalBand[]>();
  for (const rate of newest.values()) {
    // An ended rate is not replaced by the one before it: that one had
    // already been superseded. Past the end the component earns nothing,
    // until a new rate says otherwise.
    if (rate.valid_to !== null && rate.valid_to < day) continue;
    const bands = byComponent.get(rate.component) ?? [];
    bands.push({
      annual_rate_scaled: rate.annual_rate_scaled,
      min_balance_minor: rate.min_balance_minor,
      max_balance_minor: rate.max_balance_minor,
      requiresMonthlySpendMinor: rate.requires_monthly_spend_minor,
      fallbackAnnualRateScaled: rate.fallback_annual_rate_scaled,
      component: rate.component,
      payout: rate.payout,
    });
    byComponent.set(rate.component, bands);
  }

  for (const bands of byComponent.values()) {
    bands.sort((a, b) => a.min_balance_minor - b.min_balance_minor);
  }
  return byComponent;
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

