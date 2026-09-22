/**
 * The engine: walking an account day by day and writing what it earned.
 *
 * One pass per account, from the day after its opening figure up to the day
 * asked for. Each day needs three things, and each of them is a decision that
 * was made deliberately:
 *
 *   * **The balance it earns on** is the account's ledger balance plus the
 *     cushion accumulated so far. The bank did pay those yields in even though
 *     The ledger never recorded them, so the money earning interest tomorrow
 *     includes them. Leaving them out would under-pay, more so every year.
 *
 *   * **The rate** is the band in force on that day whose range the balance
 *     falls into. A rate that carries a spend condition (Uala asks for
 *     400,000 spent in the month) applies only in a period that met it: the
 *     month for a rate paid monthly or daily, the N months of a rate paid
 *     every N. The spend of the whole period is what decides, so a period
 *     still running turns the rate on as soon as the threshold is passed and
 *     the earlier days fill in on the next pass. That is why a recompute
 *     restarts at the beginning of the period.
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
  CushionEntry, NewYieldDay, PocketBalance, YieldPocket, YieldRate, YieldsRepository,
} from '../database/repositories/yields.repository';
import type { TaxParametersRepository } from '../database/repositories/tax-parameters.repository';
import type { OnProgress } from '../database/export/progress';
import {
  accrueDay, accruePayment, bandFor, rateWhenConditionMissed, ruleForProduct, type RateBand, type WithholdingRule,
} from './yield-math';
import { addDays, addMonthsClamped, daysBetween, eachDay, endOfMonth, monthOf, nextDay, startOfMonth } from './days';

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
 * them. Every row seeded into the app names no product, so this is the
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

  /**
   * The withholding rule per month, for as long as this engine lives. The
   * figures are dated configuration and do not change while a screen is being
   * drawn, and every account was asking for the same months over again.
   */
  private readonly rules = new Map<string, WithholdingRule | null>();

  /** True while a whole pass is running, so the months are asked for once for all of it. */
  private sharingRules = false;

  constructor(db: SqlDriver, yields: YieldsRepository, tax: TaxParametersRepository) {
    this.db = db;
    this.yields = yields;
    this.tax = tax;
  }

  /**
   * Every enrolled account, up to the same day - or only the ones in `only`,
   * which is how the yields screen works out just the accounts that changed.
   */
  async accrueAll(upTo: IsoDate, onProgress?: OnProgress, only?: readonly number[]): Promise<AccrualResult[]> {
    // Asked once for the whole pass rather than once per account. Cleared
    // first: a parameter confirmed since the last pass has to be seen.
    this.rules.clear();
    this.sharingRules = true;
    try {
      return await this.accrueEach(upTo, onProgress, only);
    } finally {
      this.sharingRules = false;
    }
  }

  private async accrueEach(upTo: IsoDate, onProgress?: OnProgress, only?: readonly number[]): Promise<AccrualResult[]> {
    const accounts = (await this.yields.accounts())
      .filter(account => only === undefined || only.includes(account.account_id));
    const out: AccrualResult[] = [];
    for (const account of accounts) {
      out.push(await this.accrue(account.account_id, upTo));
      await onProgress?.({ done: out.length, total: accounts.length });
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
  async heldByPocket(accountId: number, on: IsoDate, known?: readonly YieldPocket[]): Promise<Map<number, number>> {
    // The caller usually has the products in hand already; asking for them
    // again is a call a phone pays for.
    const pockets = known ?? await this.yields.pockets(accountId);
    return (await this.heldByPockets(on, new Map([[accountId, pockets]]))).get(accountId)!;
  }

  /**
   * The same, for several accounts in five questions however many there are.
   * The yields screen draws every account, and five questions per account is
   * what it used to spend its time on.
   */
  async heldByPockets(
    on: IsoDate, pocketsOf: ReadonlyMap<number, readonly YieldPocket[]>,
  ): Promise<Map<number, Map<number, number>>> {
    const out = new Map<number, Map<number, number>>();
    for (const accountId of pocketsOf.keys()) out.set(accountId, new Map());
    const ids = [...pocketsOf].filter(([, pockets]) => pockets.length > 0).map(([id]) => id);
    if (ids.length === 0) return out;
    const list = `(${ids.map(() => '?').join(', ')})`;

    const openings = new Map((await this.db.query<{ account_id: number; opening_on: IsoDate }>(
      `SELECT account_id, opening_on FROM yield_accounts WHERE account_id IN ${list}`, ids))
      .map(row => [row.account_id, row.opening_on]));

    // What the whole account holds at the end of `on`: its opening balance
    // and every movement up to that day. The balance a product that follows
    // the account shows.
    const accountOn = new Map((await this.db.query<{ id: number; balance_minor: number }>(
      `SELECT a.id, a.opening_balance_minor + COALESCE((
                SELECT SUM(t.amount_minor) FROM transactions t
                WHERE t.account_id = a.id AND t.occurred_on <= ?), 0) AS balance_minor
       FROM accounts a WHERE a.id IN ${list}`, [on, ...ids]))
      .map(row => [row.id, row.balance_minor]));

    // Every product's stated balances, and what has moved through each of
    // them, in one question each rather than two per product.
    const histories = await this.yields.pocketBalancesOf(ids);
    const asked = new Map<number, { since: Map<number, IsoDate>; absorbs: number | null }>();
    for (const accountId of ids) {
      const pockets = pocketsOf.get(accountId)!;
      const opening = openings.get(accountId) ?? on;
      const since = new Map<number, IsoDate>();
      for (const pocket of pockets) {
        if (pocket.source !== 'manual') continue;
        // No balance at all means no start date has been chosen, so counting
        // starts where this module started: the day the account was enrolled.
        since.set(pocket.id, (histories.get(pocket.id) ?? []).at(-1)?.valid_from ?? opening);
      }
      asked.set(accountId, { since, absorbs: absorbsUnassigned(pockets) });
    }
    const moved = await this.yields.movedInPocketsOf(asked);

    for (const accountId of ids) {
      heldIn(pocketsOf.get(accountId)!, out.get(accountId)!, accountOn.get(accountId) ?? 0, histories, moved);
    }
    return out;
  }

  async accrue(accountId: number, upTo: IsoDate): Promise<AccrualResult> {
    // On its own, the rule is read again: a tax parameter may have been
    // confirmed since the last time this engine was asked. Inside a whole
    // pass it is read once, in accrueAll.
    if (!this.sharingRules) this.rules.clear();
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

    // Where to resume. A period already partly accrued is redone from its first
    // day, because a spend condition can only be judged on the whole period:
    // the month, or the N months of a bonus paid every N.
    const last = await this.yields.lastAccruedDay(accountId);
    const rates = await this.yields.rateHistory(accountId);

    // Where the walk starts.
    //
    // The opening figure covers everything up to the day it was measured, so
    // the first day this app can work out is the day after: starting earlier
    // would work out days that figure already contains.
    //
    // A rate reaching further back pulls it back only where there is nothing
    // recorded before that date to overlap with.
    //
    // The boundary used to be "the opening figure is not zero". Migration 040
    // turned every one of those figures into an ordinary income to a product,
    // dated the day before, so that test would now be true of every account
    // and each would start a day early and invent a day of yield. What the
    // figure really meant is what is asked now: is there a record of what this
    // account had already earned before this date? If there is, it covers
    // everything up to it and nothing earlier is worked out again. If there is
    // none - Plata, whose products began on the 7th and the 8th - the rates
    // decide, which is what Jose asked for on 2026-09-17.
    const earliestRate = rates.map(rate => rate.valid_from).sort()[0];
    const recorded = await this.yields.earnedBefore(accountId, enrolled.opening_on);
    const earliest = !recorded && earliestRate !== undefined && earliestRate < enrolled.opening_on
      ? earliestRate
      : enrolled.opening_on;
    const firstEver = nextDay(earliest);

    let resume = last === null ? firstEver : startOfMonth(last);
    if (last !== null) {
      for (const rate of rates) {
        if (rate.requires_monthly_spend_minor === null || rate.valid_from > last) continue;
        const period = spendPeriodFor(rate.payout, rate.payout_months ?? 1, rate.valid_from, last);
        if (period.from < resume) resume = period.from;
      }
    }
    const from = resume < firstEver ? firstEver : resume;
    if (from > upTo) return nothing;

    return this.db.transaction(async () => {
      await this.yields.clearDays(accountId, from);

      const balances = await this.dailyBalances(accountId, upTo);

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
      const spentBetween = await this.spendCounter(accountId, upTo);
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

      // Locked days that no rate in force reaches on its own still count, and
      // still land: a closed CDT's payment, kept on the product it matured
      // into under a name of its own.
      const usedLocked = new Set<string>();

      // The rule can change from one day to the next, and asking the database
      // for it on every one of two thousand days would be the slow part. Kept
      // on the engine rather than on the walk: every account asks the same
      // question of the same months, and thirteen accounts asked it again each.
      const ruleFor = async (day: IsoDate): Promise<WithholdingRule | null> => {
        const key = monthOf(day);
        if (!this.rules.has(key)) this.rules.set(key, await this.tax.withholdingRule(day));
        return this.rules.get(key) ?? null;
      };

      // Every day the walk works out, written in one go at the end of it. One
      // call per day is what made opening the screen slow on the phone.
      const written: NewYieldDay[] = [];

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
      //
      // Keyed by pocket and payday, so a component paid every six months and
      // one paid every month can wait side by side.
      const waiting = new Map<string, number>();

      const creditTo = (pocketId: number, payout: 'daily' | 'monthly', paidOn: IsoDate, net: number) => {
        if (payout === 'daily') {
          cushionOf.set(pocketId, (cushionOf.get(pocketId) ?? 0) + net);
          return;
        }
        const key = `${pocketId}|${paidOn}`;
        waiting.set(key, (waiting.get(key) ?? 0) + net);
      };

      // A payment can span more than the stretch this walk redoes: a rate paid
      // every three months, worked out again from the first of its second
      // month, still owes what its first month earned. Those days sit before
      // `from` and are not redone, so what they are owed is carried in here to
      // land on the payday it belongs to.
      for (const earlier of await this.yields.days(accountId, undefined, addDays(from, -1))) {
        if (earlier.payout !== 'monthly' || earlier.paid_on === null || earlier.paid_on < from) continue;
        const key = `${earlier.pocket_id}|${earlier.paid_on}`;
        waiting.set(key, (waiting.get(key) ?? 0) + (earlier.actual_net_minor ?? earlier.net_minor));
      }
      const pocketOf = (id: number | null) =>
        pockets.some(pocket => pocket.id === id) ? (id as number) : fallbackPocket;

      // What landed before this stretch still earns in it. Every product used
      // to start the walk at zero, which was right only while the stretch began
      // on the first day ever: from the second month on, the yield already paid
      // and every entry made before the 1st fell out of the base, and the month
      // was worked out on less than the product held. An entry made on the day
      // the account started lands that night, so it earns from the first day.
      const before = from > firstEver ? await this.yields.days(accountId, firstEver, addDays(from, -1)) : [];
      for (const earlier of before) {
        const paid = earlier.paid_on ?? (earlier.payout === 'monthly' ? endOfMonth(earlier.on_date) : earlier.on_date);
        // Still owed on `from`: carried into `waiting` above instead.
        if (paid >= from) continue;
        cushionOf.set(earlier.pocket_id,
          (cushionOf.get(earlier.pocket_id) ?? 0) + (earlier.actual_net_minor ?? earlier.net_minor));
      }
      // The opening figure summarises everything before its date, so an entry
      // back there would be counted twice.
      for (const entry of entries) {
        if (entry.on_date < enrolled.opening_on || entry.on_date >= from) continue;
        const id = pocketOf(entry.pocket_id);
        cushionOf.set(id, (cushionOf.get(id) ?? 0) + entry.amount_minor);
      }
      for (const taken of takenOut) {
        if (taken.on_date < enrolled.opening_on || taken.on_date >= from) continue;
        const id = pocketOf(taken.pocket_id ?? null);
        cushionOf.set(id, (cushionOf.get(id) ?? 0) - taken.amount_minor);
      }

      for (const entry of entries) {
        if (entry.on_date < from || entry.on_date > upTo) continue;
        land(entry.on_date, pocketOf(entry.pocket_id), entry.amount_minor);
      }
      for (const taken of takenOut) {
        if (taken.on_date < from || taken.on_date > upTo) continue;
        // From the product it left, when it says - a CDT's yield paid into the
        // product it matured into - and otherwise where unassigned money goes.
        land(taken.on_date, pocketOf(taken.pocket_id ?? null), -taken.amount_minor);
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

          /*
           * The floor is on the WHOLE base, not on the ledger half of it.
           *
           * A pocket's ledger share goes negative when more has been moved
           * out of it than the ledger ever put in - which is exactly what
           * happens when the yields it had gathered are transferred out with
           * the rest. Jose emptied Plata's savings product into its other
           * product, and the transfer carried the 379.94 of yield with it,
           * because that is the money the bank really had there.
           *
           * Clamping the ledger share to zero first threw that away and then
           * added the cushion back on top, so the product went on earning
           * 0.07 a day on 380.08 that had already left it. He read the screen
           * and asked where the balance had come from; it had come from
           * counting the same yield twice.
           *
           * Taking what was moved out off the cushion first leaves nothing,
           * which is what the product holds. Where the ledger share is not
           * negative - every other product in his data - both spellings give
           * the same figure, because both halves are already positive.
           */
          const base = Math.max(0, held + (cushionOf.get(pocket.id) ?? 0));

          // Every component earns on the same base and is worked out apart:
          // each has its own rate, its own condition and its own payday, and
          // the withholding threshold in articulo 1.2.4.2.87 is measured per
          // payment. Two components are two payments.
          for (const [component, bands] of componentsInForce(ratesFor(rates, pocket.id), day)) {
            const lockedDay = locked.get(`${pocket.id}|${component}|${day}`);

            if (lockedDay) {
              usedLocked.add(`${pocket.id}|${component}|${day}`);
              // Left exactly as it was, and still part of the cushion.
              const net = lockedDay.actual_net_minor ?? lockedDay.net_minor;
              creditTo(pocket.id, lockedDay.payout,
                lockedDay.paid_on ?? (lockedDay.payout === 'daily' ? day : endOfMonth(day)), net);
              result.daysLocked += 1;
              continue;
            }

            let band = bandFor(bands, base);
            if (band === null) continue;
            // A CDT is never worked out day by day: it pays once, on the day it
            // matures, for its whole term. Every other day earns it nothing, and
            // a CDT whose terms are not set earns nothing at all.
            const cdt = pocket.kind === 'cdt';
            if (cdt && !(pocket.opened_on && pocket.term_months
                && addMonthsClamped(pocket.opened_on, pocket.term_months) === day)) continue;
            const payout = cdt ? 'monthly' : band.payout;
            const paidOn = cdt ? day : paidOnFor(payout, band.payoutMonths, band.payoutFrom, day);

            if (band.requiresMonthlySpendMinor != null) {
              const period = spendPeriodFor(band.payout, band.payoutMonths, band.payoutFrom, day);
              if (spentBetween(period.from, period.to) < band.requiresMonthlySpendMinor) {
                // A spending bonus that was not earned pays nothing, and says
                // so with a rate of zero. Rates recorded before the bonus
                // was its own line may still name a fallback rate.
                band = { ...band, annual_rate_scaled: rateWhenConditionMissed(band.fallbackAnnualRateScaled) };
                result.daysConditionNotMet += 1;
              }
            }

            // The kind of product decides the withholding - a CDT has none of
            // the daily threshold a savings product has - and how the yield is
            // worked out: a CDT's whole term at once, on its balance the day it
            // matures.
            const withholdingRule = ruleForProduct(pocket.kind, rule);
            const accrued = cdt
              ? accruePayment(base, band, daysBetween(pocket.opened_on!, day), withholdingRule, pocket.withholding === 1)
              : accrueDay(base, band, withholdingRule, pocket.withholding === 1);

            written.push({
              pocket_id: pocket.id,
              account_id: accountId,
              component,
              payout,
              on_date: day,
              paid_on: paidOn,
              balance_minor: accrued.balance_minor,
              annual_rate_scaled: accrued.annual_rate_scaled,
              gross_minor: accrued.gross_minor,
              withholding_minor: accrued.withholding_minor,
              net_minor: accrued.net_minor,
              withholding_unknown: accrued.withholding_unknown ? 1 : 0,
            });

            creditTo(pocket.id, payout, paidOn, accrued.net_minor);
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

        for (const [key, fixed] of locked) {
          if (fixed.on_date !== day || usedLocked.has(key)) continue;
          if (!pockets.some(pocket => pocket.id === fixed.pocket_id)) continue;
          creditTo(fixed.pocket_id, 'monthly', day, fixed.actual_net_minor ?? fixed.net_minor);
        }

        // Payday: everything worked out for a payment that falls today lands at
        // once, and starts earning tomorrow.
        for (const [key, owed] of waiting) {
          const [pocket, paidOn] = key.split('|');
          if (paidOn !== day) continue;
          cushionOf.set(Number(pocket), (cushionOf.get(Number(pocket)) ?? 0) + owed);
          waiting.delete(key);
        }

      }

      await this.yields.putDays(written);
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
   * How much was spent on the account between two days, both included.
   *
   * Expenses only, as a positive figure: a condition asks "did you spend
   * 400,000 this month", and money coming in is not spending. Transfer legs
   * are left out — moving your own money between your own accounts is not
   * spending either, and counting it would meet the condition for free.
   * Read once; each period is added up once and remembered.
   */
  private async spendCounter(accountId: number, upTo: IsoDate): Promise<(from: IsoDate, to: IsoDate) => number> {
    const rows = await this.db.query<{ day: IsoDate; spent: number }>(
      `SELECT occurred_on AS day, -SUM(amount_minor) AS spent
       FROM transactions
       WHERE account_id = ? AND occurred_on <= ? AND amount_minor < 0 AND transfer_id IS NULL
       GROUP BY occurred_on`,
      [accountId, upTo]);
    const totals = new Map<string, number>();
    return (from, to) => {
      const key = `${from}|${to}`;
      let total = totals.get(key);
      if (total === undefined) {
        total = rows.reduce((sum, row) => row.day >= from && row.day <= to ? sum + row.spent : sum, 0);
        totals.set(key, total);
      }
      return total;
    };
  }
}

/** A rate band that may only apply in a month where enough was spent. */
interface ConditionalBand extends RateBand {
  requiresMonthlySpendMinor: number | null;
  fallbackAnnualRateScaled: number | null;
  component: string;
  payout: 'daily' | 'monthly';
  /** Months each payment covers, for a monthly band. */
  payoutMonths: number;
  /** Where those months are counted from: the day the rate started. */
  payoutFrom: IsoDate;
}

/**
 * The day the yield of `day` is handed over.
 *
 * The same day for a daily component. For a monthly one, the last day of the
 * payment period `day` falls in: periods of `months` months, counted from the
 * month the rate starts in. With one month that is simply the end of the
 * month, which is how every monthly rate was paid before a payment could cover
 * more than one.
 */
export function paidOnFor(payout: 'daily' | 'monthly', months: number, rateFrom: IsoDate, day: IsoDate): IsoDate {
  if (payout === 'daily') return day;
  const every = Math.max(1, months);
  const index = (iso: IsoDate) => Number(iso.slice(0, 4)) * 12 + Number(iso.slice(5, 7)) - 1;
  const start = index(rateFrom);
  const offset = Math.max(0, index(day) - start);
  const last = start + Math.floor(offset / every) * every + every - 1;
  const year = Math.floor(last / 12);
  const month = (last % 12) + 1;
  return endOfMonth(`${year}-${String(month).padStart(2, '0')}-01`);
}

/**
 * The days whose spending decides a conditional rate on `day`.
 *
 * The payment period for a rate paid every N months - a bonus judged on two
 * months is judged on both. The calendar month otherwise, which is what a
 * daily rate with a condition always meant: 400,000 spent in the month.
 */
export function spendPeriodFor(
  payout: 'daily' | 'monthly', months: number, rateFrom: IsoDate, day: IsoDate,
): { from: IsoDate; to: IsoDate } {
  if (payout === 'daily') return { from: startOfMonth(day), to: endOfMonth(day) };
  const every = Math.max(1, months);
  const to = paidOnFor('monthly', every, rateFrom, day);
  const first = Number(to.slice(0, 4)) * 12 + Number(to.slice(5, 7)) - 1 - (every - 1);
  return { from: `${Math.floor(first / 12)}-${String((first % 12) + 1).padStart(2, '0')}-01`, to };
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
      payoutMonths: rate.payout_months ?? 1,
      payoutFrom: rate.valid_from,
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

/** Fills `held` with what each product of one account holds. See `heldByPocket`. */
function heldIn(
  pockets: readonly YieldPocket[],
  held: Map<number, number>,
  accountBalance: number,
  histories: ReadonlyMap<number, PocketBalance[]>,
  moved: ReadonlyMap<number, number>,
): void {
  for (const pocket of pockets) {
    if (pocket.source !== 'manual') {
      held.set(pocket.id, accountBalance);
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
    const history = histories.get(pocket.id) ?? [];

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
    const statedFrom: IsoDate | null = latest?.valid_from ?? null;

    if (statedFrom === null) {
      held.set(pocket.id, moved.get(pocket.id) ?? 0);
      continue;
    }

    held.set(pocket.id, stated + (moved.get(pocket.id) ?? 0));
  }
}
