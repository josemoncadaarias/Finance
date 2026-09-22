/**
 * What the products have earned, and what has been done with it.
 *
 * Four things add up to what an account has earned today:
 *
 *   opening + sum(net accrued) + sum(adjustments) - sum(withdrawals)
 *
 * The opening figure was typed in once because the history before it cannot be
 * recovered. The accrual is what this app worked out day by day. The
 * adjustments are the gap against what the bank actually paid — most of these
 * banks deposit once a month, so a daily accrual is an estimate until the
 * deposit lands. The withdrawals are money moved into the account, where it
 * stops sitting apart and becomes net worth.
 *
 * None of it touches the balance of the account, and none of it enters net
 * worth. That separation is the whole point of the module.
 */

import type { SqlDriver } from '../sql-driver';
import type { IsoDate } from '../types';
import { addDays, todayIso } from '../../yields/days';
import type { ProductKind } from '../../yields/yield-math';

/** An account enrolled for accrual. Not being here means never accrued. */
export interface YieldAccount {
  account_id: number;
  /** The day the accrual starts from. Nothing before it is ever worked out. */
  opening_on: IsoDate;
  withholding: 0 | 1;
  enabled: 0 | 1;
  /**
   * When the bank actually hands the yield over.
   *
   * A yield that has not been paid is not in the account and is not
   * earning. Most of these banks work it out daily and pay once a month;
   * only a few pay every day. Treating a monthly payer as a daily one pays
   * interest on money the bank has not handed over yet.
   */
  payout: 'daily' | 'monthly';
  note: string | null;
}

export interface YieldRate {
  id: number;
  account_id: number;
  /** Whose rate it is. Null is the account's own, used by every product that
   *  has none of its own. */
  product_id: number | null;
  /** Which part of the rate this is. An ordinary account has one, 'base'. */
  component: string;
  /** When this part is handed over. Not a property of the account: Uala pays
   *  half of its rate daily and half at the end of the month. */
  payout: 'daily' | 'monthly';
  /**
   * For a monthly component, how many months each payment covers - 6 for a
   * product that pays every semester. Counted from the month the rate starts
   * in. Always 1 for a daily one.
   */
  payout_months: number;
  valid_from: IsoDate;
  /** When it stopped. Null while it is still running. */
  valid_to: IsoDate | null;
  annual_rate_scaled: number;
  min_balance_minor: number;
  max_balance_minor: number | null;
  requires_monthly_spend_minor: number | null;
  /** What the band pays in a month that missed its condition. Null: nothing. */
  fallback_annual_rate_scaled: number | null;
  note: string | null;
}


/**
 * A pot of money inside one account that earns on its own.
 *
 * Dale is two of them. The bank pays each separately, so each is its own
 * pago o abono en cuenta and the withholding threshold is measured per
 * product. Adding them up first would charge withholding that is not owed.
 *
 * `source` says where the balance comes from: `ledger` follows the account's
 * own balance, `manual` is a figure typed in and dated, because a movement
 * never says which product it landed in.
 */
export interface YieldProduct {
  id: number;
  account_id: number;
  name: string;
  source: 'ledger' | 'manual';
  /** Which withholding rule it follows: a savings product's, or a CDT's. */
  kind: ProductKind;
  /**
   * How a high-yield product is paid: every day, or at the end of every so
   * many months. Copied onto its rates, which the engine reads; a rate with a
   * spending condition is paid at the end of the month regardless.
   */
  payout: 'daily' | 'monthly';
  payout_months: number;
  /**
   * The day this product starts earning. Nothing before it is worked out.
   *
   * It used to be one date per account (`yield_accounts.opening_on`), which
   * overruled what each product said about itself. It belongs here: what earns
   * is the product. Empty on a product of an account that was never enrolled.
   */
  earns_from: IsoDate;
  /** A CDT's opening day and term in months. Null for any other product. */
  opened_on: IsoDate | null;
  term_months: number | null;
  /** Where a CDT's capital and yield go when it matures. Null: the usual product. */
  matures_into_product_id: number | null;
  /** The income category a CDT's yield is recorded under when it pays. */
  income_category_id: number | null;
  /** 1 when its yield is withheld; 0 when nothing at all is taken from it. */
  withholding: 0 | 1;
  /**
   * 0 when the product sits outside net worth: its movements are left off the
   * account's balance and off net worth. The usual product is always 1.
   */
  include_in_net_worth: 0 | 1;
  sort_order: number;
  /**
   * The product money lands in when nobody says otherwise. 1 or null.
   *
   * Null rather than 0 because the index that keeps it to one per account is
   * partial, and SQLite treats NULLs as distinct - a column of zeroes would
   * collide with itself.
   */
  is_default: 1 | null;
  note: string | null;
}

/**
 * Money that landed on a product on a date, for a reason.
 *
 * `kind` is what it IS: `cashback` that arrived, a `correction` against what
 * the bank actually paid, or something `other` the note explains. They are
 * kept apart because their tax treatment is not the same - cashback is not
 * withheld and interest is - and because a screen has to be able to say what
 * a figure was.
 *
 * Signed: a correction can go either way.
 */
export interface ProductEntry {
  id: number;
  account_id: number;
  source: 'yield' | 'cashback';
  kind: 'correction' | 'cashback' | 'other';
  product_id: number | null;
  on_date: IsoDate;
  amount_minor: number;
  note: string | null;
  /** The movement this is the other half of, when it is half of a cash-in. */
  transaction_id: number | null;
  /**
   * Which of the user's own kinds it is - cashback, a correction, whatever
   * they have added. Null on an entry written before they were rows, which
   * still has `kind` to fall back on.
   */
  product_kind_id: number | null;
  /** The ordinary income or expense category, since migration 037. */
  category_id: number | null;
}

/** What a manual product held, from a date. */
export interface ProductBalance {
  id: number;
  product_id: number;
  valid_from: IsoDate;
  amount_minor: number;
  note: string | null;
  /**
   * When the figure was written down, to the second.
   *
   * `valid_from` is the day it describes; this is the moment it was recorded.
   * The two differ on the day that matters most - the day someone types
   * today's balance and then goes on recording today's movements - and only
   * the second can tell a movement that happened before the reading from one
   * that happened after it.
   */
  created_at: string;
}
export interface YieldDay {
  product_id: number;
  account_id: number;
  component: string;
  payout: 'daily' | 'monthly';
  on_date: IsoDate;
  /**
   * The day this day's yield is handed over. Null on days worked out before it
   * was recorded, which keep their old rule: the same day if daily, the end of
   * the month if monthly.
   */
  paid_on: IsoDate | null;
  balance_minor: number;
  annual_rate_scaled: number;
  gross_minor: number;
  withholding_minor: number;
  net_minor: number;
  actual_net_minor: number | null;
  withholding_unknown: 0 | 1;
  locked: 0 | 1;
  computed_at: string;
}

/** A day of yield on its way into the database, before it is stamped and stored. */
export type NewYieldDay = Omit<YieldDay, 'actual_net_minor' | 'locked' | 'computed_at' | 'paid_on'> & {
  actual_net_minor?: number | null;
  paid_on?: IsoDate | null;
};

/** What an account's accumulated yield is made of, so a total can be explained. */
export interface EarnedBalance {
  account_id: number;
  accrued_minor: number;
  adjusted_minor: number;
  withdrawn_minor: number;
  totalMinor: number;
  /**
   * Worked out but not handed over yet.
   *
   * A bank that pays once a month has not paid you anything for the month
   * that is still running. The app knows what it will be, day by day, and
   * it is not money you have: it is money you are owed. Reporting it as
   * part of it without saying so is what made Rappi cuenta look
   * like it had already earned in September when September was not over.
   */
  pendingMinor: number;
  /** What has been earned, less what is still owed: what could actually be moved. */
  availableMinor: number;
  /** Day the pending amount is handed over, or null when nothing is pending. */
  paidOn: IsoDate | null;
  /** Days whose withholding could not be worked out for lack of parameters. */
  daysWithUnknownWithholding: number;
}

const ACCOUNT_COLUMNS =
  'account_id, opening_on, withholding, enabled, payout, note';
const RATE_COLUMNS =
  `id, account_id, product_id, component, payout, payout_months, valid_from, valid_to, annual_rate_scaled, min_balance_minor,
   max_balance_minor, requires_monthly_spend_minor, fallback_annual_rate_scaled, note`;
const DAY_COLUMNS =
  `product_id, account_id, component, payout, on_date, paid_on, balance_minor, annual_rate_scaled, gross_minor,
   withholding_minor, net_minor, actual_net_minor, withholding_unknown,
   locked, computed_at`;

export class YieldsRepository {
  private readonly db: SqlDriver;
  private readonly now: () => string;

  constructor(db: SqlDriver, now: () => string = () => new Date().toISOString()) {
    this.db = db;
    this.now = now;
  }

  // -------------------------------------------------------------------------
  // Which accounts accrue
  // -------------------------------------------------------------------------

  /** Every enrolled account. An account missing from this list never accrues. */
  async accounts(): Promise<YieldAccount[]> {
    return this.db.query<YieldAccount>(
      `SELECT ${ACCOUNT_COLUMNS} FROM yield_accounts ORDER BY account_id`);
  }

  async account(accountId: number): Promise<YieldAccount | null> {
    return this.db.queryOne<YieldAccount>(
      `SELECT ${ACCOUNT_COLUMNS} FROM yield_accounts WHERE account_id = ?`, [accountId]);
  }

  /**
   * Enrols an account, or moves the date one already enrolled starts from.
   *
   * Moving the date does not touch the days already worked out: that is a
   * different question, and the next pass writes them again from the new date.
   */
  async enrol(input: {
    account_id: number;
    opening_on: IsoDate;
    withholding?: boolean;
    enabled?: boolean;
    payout?: 'daily' | 'monthly';
    note?: string | null;
    /** What to call the product every account starts with. */
    default_product_name?: string;
  }): Promise<void> {
    const now = this.now();
    const before = await this.db.queryOne<{ withholding: number }>(
      'SELECT withholding FROM yield_accounts WHERE account_id = ?', [input.account_id]);
    await this.db.run(
      `INSERT INTO yield_accounts
         (account_id, opening_on, withholding, enabled, payout, note, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(account_id) DO UPDATE SET
         opening_on            = excluded.opening_on,
         withholding           = excluded.withholding,
         enabled               = excluded.enabled,
         payout                = excluded.payout,
         note                  = excluded.note,
         updated_at            = excluded.updated_at`,
      [
        input.account_id,
        input.opening_on,
        input.withholding === false ? 0 : 1,
        input.enabled === false ? 0 : 1,
        input.payout ?? 'daily',
        input.note ?? null,
        now, now,
      ],
    );

    // Withholding is each product's own switch. Changing the account's answer
    // changes every product's; saving the same answer again leaves a product
    // set apart exactly as it is.
    const withholding = input.withholding === false ? 0 : 1;
    if (before && before.withholding !== withholding) {
      await this.db.run('UPDATE products SET withholding = ?, updated_at = ? WHERE account_id = ?',
        [withholding, now, input.account_id]);
    }

    // An account with no product has nothing to accrue on, so enrolling one
    // gives it a product that simply holds the account's own balance. That is
    // what every account had before products existed, and it stays the default:
    // splitting is something someone does on purpose.
    const existing = await this.db.queryOne<{ n: number }>(
      'SELECT COUNT(*) AS n FROM products WHERE account_id = ?', [input.account_id]);

    if ((existing?.n ?? 0) === 0) {
      const account = await this.db.queryOne<{ name: string }>(
        'SELECT name FROM accounts WHERE id = ?', [input.account_id]);

      // Named for what it is, not for the account it is in. Every bank
      // account starts as one savings product, and naming it after the account
      // read as a placeholder - which it was, until Jose started splitting
      // accounts up and needed the parts to have real names.
      //
      // The name comes from the caller because it is the caller that knows
      // which language the user reads. It is the user's data from the moment
      // it is written - renameable, and never translated again afterwards.
      await this.addProduct({
        account_id: input.account_id,
        name: input.default_product_name ?? 'Savings account',
        source: 'ledger',
        sort_order: 0,
      });
    }
  }

  /**
   * Stops accruing an account, keeping everything already worked out.
   *
   * Deliberately not a delete: the days, the rates and the opening figure are
   * the evidence behind a figure someone may still want to look at.
   */
  async setEnabled(accountId: number, enabled: boolean): Promise<void> {
    await this.db.run(
      'UPDATE yield_accounts SET enabled = ?, updated_at = ? WHERE account_id = ?',
      [enabled ? 1 : 0, this.now(), accountId]);
  }

  // -------------------------------------------------------------------------
  // Rates
  // -------------------------------------------------------------------------

  /** Every rate this account has had, oldest first. */
  async rateHistory(accountId: number): Promise<YieldRate[]> {
    return this.db.query<YieldRate>(
      `SELECT ${RATE_COLUMNS} FROM yield_rates
       WHERE account_id = ?
       ORDER BY valid_from, min_balance_minor, id`,
      [accountId]);
  }

  /**
   * The bands in force on a day: for each band, the most recent row on or
   * before that date.
   *
   * A band is identified by where it starts, so a rate change that keeps the
   * same bands simply adds newer rows and the older ones fall away here.
   */
  async bandsInForce(accountId: number, asOf: IsoDate): Promise<YieldRate[]> {
    return this.db.query<YieldRate>(
      `SELECT ${RATE_COLUMNS} FROM yield_rates r
       WHERE r.account_id = ? AND r.valid_from <= ?
         AND r.valid_from = (
           SELECT MAX(valid_from) FROM yield_rates
           WHERE account_id = r.account_id
             AND min_balance_minor = r.min_balance_minor
             AND valid_from <= ?)
       ORDER BY r.min_balance_minor, r.id`,
      [accountId, asOf, asOf]);
  }

  /** Records a rate from a date. A change is a new row, never an edit. */
  async setRate(input: {
    account_id: number;
    product_id?: number | null;
    component?: string;
    payout?: 'daily' | 'monthly';
    payout_months?: number;
    valid_from: IsoDate;
    valid_to?: IsoDate | null;
    annual_rate_scaled: number;
    min_balance_minor?: number;
    max_balance_minor?: number | null;
    requires_monthly_spend_minor?: number | null;
    fallback_annual_rate_scaled?: number | null;
    note?: string | null;
  }): Promise<void> {
    const component = input.component ?? 'base';
    const band = input.min_balance_minor ?? 0;
    const product = input.product_id ?? null;

    const existing = await this.db.queryOne<{ id: number }>(
      `SELECT id FROM yield_rates
       WHERE account_id = ? AND component = ? AND valid_from = ? AND min_balance_minor = ?
         AND ((product_id IS NULL AND ? IS NULL) OR product_id = ?)`,
      [input.account_id, component, input.valid_from, band, product, product]);

    if (existing) {
      await this.correctRate(existing.id, {
        annual_rate_scaled: input.annual_rate_scaled,
        payout: input.payout ?? 'daily',
        payout_months: input.payout_months ?? 1,
        valid_to: input.valid_to ?? null,
        max_balance_minor: input.max_balance_minor ?? null,
        requires_monthly_spend_minor: input.requires_monthly_spend_minor ?? null,
        fallback_annual_rate_scaled: input.fallback_annual_rate_scaled ?? null,
        note: input.note ?? null,
      });
      return;
    }

    await this.db.run(
      `INSERT INTO yield_rates
         (account_id, product_id, component, payout, payout_months, valid_from, valid_to, annual_rate_scaled,
          min_balance_minor, max_balance_minor, requires_monthly_spend_minor,
          fallback_annual_rate_scaled, note, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.account_id,
        product,
        component,
        input.payout ?? 'daily',
        input.payout_months ?? 1,
        input.valid_from,
        input.valid_to ?? null,
        input.annual_rate_scaled,
        band,
        input.max_balance_minor ?? null,
        input.requires_monthly_spend_minor ?? null,
        input.fallback_annual_rate_scaled ?? null,
        input.note ?? null,
        this.now(),
      ],
    );
  }




  /**
   * Corrects a rate that was recorded wrong.
   *
   * Different from `setRate`, and the difference matters. A rate CHANGE is
   * a new row from a date, because what was true last month stays true.
   * A rate that was simply entered wrong was never true, so there is
   * nothing to preserve: Plata advertises 11% and pays 11.047%, and the
   * 11% was never the rate, it was a reading of the marketing.
   *
   * The caller works the days out again from `valid_from` afterwards.
   */
  async correctRate(id: number, changes: {
    component?: string;
    payout?: 'daily' | 'monthly';
    payout_months?: number;
    valid_from?: IsoDate;
    valid_to?: IsoDate | null;
    annual_rate_scaled?: number;
    min_balance_minor?: number;
    max_balance_minor?: number | null;
    requires_monthly_spend_minor?: number | null;
    fallback_annual_rate_scaled?: number | null;
    note?: string | null;
  }): Promise<void> {
    const columns: string[] = [];
    const values: unknown[] = [];

    for (const [column, value] of Object.entries(changes)) {
      if (value === undefined) continue;
      columns.push(`${column} = ?`);
      values.push(value);
    }
    if (columns.length === 0) return;

    values.push(id);
    await this.db.run(`UPDATE yield_rates SET ${columns.join(', ')} WHERE id = ?`, values);
  }

  async removeRate(id: number): Promise<void> {
    await this.db.run('DELETE FROM yield_rates WHERE id = ?', [id]);
  }

  // -------------------------------------------------------------------------
  // Products
  // -------------------------------------------------------------------------

  /** The products of an account, in the order they are shown. */
  async products(accountId: number): Promise<YieldProduct[]> {
    return this.db.query<YieldProduct>(
      `SELECT id, account_id, name, source, kind, sort_order, is_default, note,
              earns_from, payout, payout_months, opened_on, term_months,
              matures_into_product_id, income_category_id, withholding,
              include_in_net_worth
       FROM products WHERE account_id = ? ORDER BY sort_order, id`,
      [accountId]);
  }

  /** Every product of every enrolled account, for one pass over them all. */
  async allProducts(): Promise<YieldProduct[]> {
    return this.db.query<YieldProduct>(
      `SELECT id, account_id, name, source, kind, sort_order, is_default, note,
              earns_from, payout, payout_months, opened_on, term_months,
              matures_into_product_id, income_category_id, withholding,
              include_in_net_worth
       FROM products ORDER BY account_id, sort_order, id`);
  }

  async addProduct(input: {
    account_id: number;
    name: string;
    source?: 'ledger' | 'manual';
    kind?: ProductKind;
    sort_order?: number;
    note?: string | null;
    /** The day it starts earning. Its account's own day when nothing says otherwise. */
    earns_from?: IsoDate;
    payout?: 'daily' | 'monthly';
    payout_months?: number;
    opened_on?: IsoDate | null;
    term_months?: number | null;
    matures_into_product_id?: number | null;
    income_category_id?: number | null;
  }): Promise<number> {
    const now = this.now();
    // A product of an account that already earns starts where that account
    // starts. That is what the account's single date did for all of them, so
    // keeping it means adding a product moves no figure; the product's own
    // stated balance is what decides when it really begins to earn. Only a
    // product of an account with no date at all starts today.
    const earnsFrom = input.earns_from
      ?? (await this.db.queryOne<{ opening_on: IsoDate }>(
            'SELECT opening_on FROM yield_accounts WHERE account_id = ?',
            [input.account_id]))?.opening_on
      ?? todayIso();
    const result = await this.db.run(
      `INSERT INTO products (account_id, name, source, kind, sort_order, note, earns_from,
                                  payout, payout_months, opened_on, term_months,
                                  matures_into_product_id, income_category_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [input.account_id, input.name, input.source ?? 'manual', input.kind ?? 'high_yield',
       input.sort_order ?? 0, input.note ?? null, earnsFrom,
       input.payout ?? 'daily', input.payout_months ?? 1, input.opened_on ?? null, input.term_months ?? null,
       input.matures_into_product_id ?? null, input.income_category_id ?? null, now, now]);
    const id = result.lastId ?? 0;
    // A new product starts with its account's answer on withholding.
    await this.db.run(
      `UPDATE products SET withholding = COALESCE(
         (SELECT withholding FROM yield_accounts WHERE account_id = ?), 1) WHERE id = ?`,
      [input.account_id, id]);

    await this.nameTheProductOfLooseMovements(input.account_id, id);
    return id;
  }

  /**
   * Writes the product a movement already belonged to, before a second one
   * exists to argue about it.
   *
   * A movement in an account with one product names no product: there is
   * nothing to choose, and the one product holds everything. That stays true
   * until a second product is added - and from then on those movements follow
   * whichever product is the usual one, because "no product named" is read as
   * "the usual one". Change the usual and they move.
   *
   * Jose hit it on 2026-09-21: he made Cuenta Ahorros the usual product of
   * Plata and 200,000 pesos moved out of Bolsillo. His question was the right
   * one - the movement went to Bolsillo when it was saved, so it should say
   * Bolsillo and stay there. Nothing had ever written it down.
   *
   * The moment to write it down is this one: a second product is being born,
   * so every movement still unnamed belonged to the one product there was.
   * Afterwards they are ordinary movements naming a product, which the person
   * can change one at a time if any of them really belongs elsewhere.
   */
  private async nameTheProductOfLooseMovements(accountId: number, newProductId: number): Promise<void> {
    const others = await this.db.query<{ id: number }>(
      'SELECT id FROM products WHERE account_id = ? AND id <> ? ORDER BY sort_order, id',
      [accountId, newProductId]);
    // Only when the new one is the SECOND: with three already there, whatever
    // is still unnamed was left unnamed on purpose.
    if (others.length !== 1) return;

    for (const table of ['transactions', 'product_entries', 'product_cashouts']) {
      await this.db.run(
        `UPDATE "${table}" SET product_id = ? WHERE account_id = ? AND product_id IS NULL`,
        [others[0].id, accountId]);
    }
  }

  /**
   * Changes where a product takes its balance from.
   *
   * Only one product of an account can follow the ledger; two of them would
   * each claim the whole balance. The caller is what enforces that, because
   * SQLite has no partial unique constraint that would say it here.
   */
  async setProductSource(id: number, source: 'ledger' | 'manual'): Promise<void> {
    await this.db.run('UPDATE products SET source = ?, updated_at = ? WHERE id = ?',
      [source, this.now(), id]);
  }

  /**
   * How a product is paid, onto the product and onto its rates.
   *
   * The engine reads the payout of each rate, so a product's setting is
   * written to every rate of it without a spending condition. A rate with one
   * is a bonus judged on the month and paid at its end, and keeps that.
   */
  async setProductPayout(id: number, payout: 'daily' | 'monthly', months: number): Promise<void> {
    const now = this.now();
    await this.db.run('UPDATE products SET payout = ?, payout_months = ?, updated_at = ? WHERE id = ?',
      [payout, months, now, id]);
    await this.db.run(
      `UPDATE yield_rates SET payout = ?, payout_months = ?
       WHERE product_id = ? AND requires_monthly_spend_minor IS NULL`,
      [payout, months, id]);
  }

  /** A CDT's terms. Only the fields given are changed. */
  async setCdtTerms(id: number, terms: {
    opened_on?: IsoDate | null;
    term_months?: number | null;
    matures_into_product_id?: number | null;
    income_category_id?: number | null;
  }): Promise<void> {
    const columns: string[] = [];
    const values: unknown[] = [];
    for (const [column, value] of Object.entries(terms)) {
      if (value === undefined) continue;
      columns.push(`${column} = ?`);
      values.push(value);
    }
    if (columns.length === 0) return;
    values.push(this.now(), id);
    await this.db.run(`UPDATE products SET ${columns.join(', ')}, updated_at = ? WHERE id = ?`, values);
  }

  /**
   * Makes one day's figure permanent, under a name of its own.
   *
   * For a CDT's payment once the CDT is closed: the product it was worked out
   * on is gone, so no recompute could ever produce it again. Locked, it is never
   * rewritten; renamed, it shows in the payments list as what it was.
   */
  async fixPayment(productId: number, component: string, onDate: IsoDate, asComponent: string): Promise<void> {
    await this.db.run(
      `UPDATE yield_days SET locked = 1, component = ?
       WHERE product_id = ? AND component = ? AND on_date = ?`,
      [asComponent, productId, component, onDate]);
  }

  /** Changes which withholding rule a product follows. The caller works its days out again. */
  async setProductKind(id: number, kind: ProductKind): Promise<void> {
    await this.db.run('UPDATE products SET kind = ?, updated_at = ? WHERE id = ?',
      [kind, this.now(), id]);
  }

  /** Whether the product's yield is withheld. Off means nothing is taken from it. */
  async setProductWithholding(id: number, withholds: boolean): Promise<void> {
    await this.db.run('UPDATE products SET withholding = ?, updated_at = ? WHERE id = ?',
      [withholds ? 1 : 0, this.now(), id]);
  }

  /**
   * Puts a product inside net worth or leaves it out. The usual product cannot
   * be left out: every movement that names no product lands in it, so leaving
   * it out would take those off the account too.
   */
  async setProductNetWorth(id: number, counts: boolean): Promise<void> {
    if (!counts) {
      const product = await this.db.queryOne<{ is_default: number | null }>(
        'SELECT is_default FROM products WHERE id = ?', [id]);
      if (product?.is_default === 1) throw new Error('The usual product always counts towards net worth.');
    }
    await this.db.run('UPDATE products SET include_in_net_worth = ?, updated_at = ? WHERE id = ?',
      [counts ? 1 : 0, this.now(), id]);
  }

  /**
   * Makes one product the account's usual one, and the others not.
   *
   * Both halves in one call, because the index allows at most one per account
   * and clearing the old one afterwards would leave a moment where two are
   * marked - which is a moment long enough for the write to fail.
   */
  async setDefaultProduct(accountId: number, productId: number): Promise<void> {
    const now = this.now();
    await this.db.run(
      'UPDATE products SET is_default = NULL, updated_at = ? WHERE account_id = ?',
      [now, accountId]);
    // The usual product holds every movement that names none, so it counts.
    await this.db.run(
      'UPDATE products SET is_default = 1, include_in_net_worth = 1, updated_at = ? WHERE id = ?',
      [now, productId]);
  }

  /**
   * Moves the day a product starts earning from.
   *
   * Everything already worked out for its account goes, because the days
   * behind the new date are not days any more and the ones in front of it may
   * never have been written. Days corrected by hand stay: `clearDays` leaves
   * them alone.
   */
  async setProductEarnsFrom(id: number, on: IsoDate): Promise<void> {
    await this.db.run('UPDATE products SET earns_from = ?, updated_at = ? WHERE id = ?',
      [on, this.now(), id]);
  }

  async renameProduct(id: number, name: string): Promise<void> {
    await this.db.run('UPDATE products SET name = ?, updated_at = ? WHERE id = ?',
      [name, this.now(), id]);
  }

  /**
   * Hands everything one product carried to another product of the same account.
   *
   * The half of removing a product that keeps it from losing anything. The
   * movements, entries and cashouts that named it name the other
   * one. Every day it earned is added to the other one's day - summed where
   * both earned on the same day, moved where only it did - so what the account
   * earned, and what was withheld from it, stays exactly what it was, and the
   * tax simulator reads the same year it read before.
   */
  async mergeProductInto(fromId: number, toId: number): Promise<void> {
    // Written into the statements below rather than bound, because the same
    // id appears in several subqueries. Being integers is what makes that safe.
    if (!Number.isInteger(fromId) || !Number.isInteger(toId)) {
      throw new Error('Product ids must be integers');
    }

    for (const table of ['transactions', 'product_entries', 'product_cashouts']) {
      await this.db.run(`UPDATE ${table} SET product_id = ? WHERE product_id = ?`, [toId, fromId]);
    }

    const theirs = (expression: string) =>
      `(SELECT ${expression} FROM yield_days f WHERE f.product_id = ${fromId}
          AND f.component = yield_days.component AND f.on_date = yield_days.on_date)`;

    await this.db.run(
      `UPDATE yield_days SET
         balance_minor       = balance_minor + ${theirs('f.balance_minor')},
         gross_minor         = gross_minor + ${theirs('f.gross_minor')},
         withholding_minor   = withholding_minor + ${theirs('f.withholding_minor')},
         net_minor           = net_minor + ${theirs('f.net_minor')},
         actual_net_minor    = CASE
           WHEN actual_net_minor IS NULL AND ${theirs('f.actual_net_minor')} IS NULL THEN NULL
           ELSE COALESCE(actual_net_minor, net_minor) + ${theirs('COALESCE(f.actual_net_minor, f.net_minor)')}
         END,
         withholding_unknown = MAX(withholding_unknown, ${theirs('f.withholding_unknown')}),
         locked              = MAX(locked, ${theirs('f.locked')})
       WHERE product_id = ${toId} AND EXISTS ${theirs('1')}`);

    await this.db.run(
      `UPDATE yield_days SET product_id = ${toId}
       WHERE product_id = ${fromId} AND NOT EXISTS (
         SELECT 1 FROM yield_days t WHERE t.product_id = ${toId}
           AND t.component = yield_days.component AND t.on_date = yield_days.on_date)`);

    // What is left had a partner day on the other product and is in it now.
    await this.db.run(`DELETE FROM yield_days WHERE product_id = ${fromId}`);
  }

  /**
   * Removes a product and every day it earned.
   *
   * The days go with it because they were worked out on a balance that no
   * longer exists; what they added is worked out again on the
   * next pass, from whatever products are left.
   */
  /**
   * Whether anything is on record as earned before a date.
   *
   * What the opening figure used to say by being non-zero. It is an entry on
   * a product now - "rendimientos que el banco ya había pagado" - and the
   * question is the same one: is there a record covering everything up to
   * this day? If there is, the walk does not go behind it.
   */
  async earnedBefore(accountId: number, on: IsoDate): Promise<boolean> {
    const row = await this.db.queryOne<{ total: number }>(
      `SELECT COUNT(*) AS total FROM product_entries
       WHERE account_id = ? AND on_date < ?`, [accountId, on]);
    return (row?.total ?? 0) > 0;
  }

  async removeProduct(id: number): Promise<void> {
    await this.db.run('DELETE FROM products WHERE id = ?', [id]);
  }

  /**
   * What has moved through a product since a date, that date included.
   *
   * One rule, and the one Jose stated: movements before the date a product's
   * balance was set do not touch it, and everything from that date on does.
   * An earlier attempt split the day the balance was set by the clock-time it
   * was written at, which was more precise and less predictable - and being
   * able to say what the screen will show matters more here than a few hours
   * of exactness.
   *
   * There is no upper bound. A movement dated next week has been recorded, and
   * the account's own balance counts it, so a product that did not would be
   * disagreeing with the account it lives in.
   *
   * `takesUnassigned` is for the first product, which is where a movement that
   * names no product has always gone.
   */
  async movedInProductSince(
    accountId: number,
    productId: number,
    since: IsoDate,
    takesUnassigned: boolean,
  ): Promise<number> {
    const which = takesUnassigned
      ? '(product_id IS NULL OR product_id = ?)'
      : 'product_id = ?';

    const row = await this.db.queryOne<{ total: number | null }>(
      `SELECT SUM(amount_minor) AS total FROM transactions
       WHERE account_id = ? AND ${which} AND occurred_on >= ?`,
      [accountId, productId, since]);
    return row?.total ?? 0;
  }

  /**
   * Moves a balance that is already recorded to another date or figure.
   *
   * `setProductBalance` is keyed on the date, so changing the date through it
   * writes a SECOND balance and leaves the first one standing - and the first
   * one, being later, goes on winning. Which is exactly what it looked like
   * from outside: editing the date appeared to do nothing at all.
   *
   * Any other balance of the product dated on or after the new date is
   * removed first. The latest balance is the one that governs, so one left
   * standing after the new date went on winning: Jose's products each had a
   * balance on the 9th and another on the 10th, the form edited the 10th's,
   * and moving it back to the 1st put the 9th's in charge again - the save
   * looked like it had undone itself. One on the same date would also be a
   * unique-constraint failure in front of someone who only changed a date.
   */
  async moveProductBalance(
    id: number,
    input: { valid_from: IsoDate; amount_minor: number },
  ): Promise<void> {
    const now = this.now();
    const row = await this.db.queryOne<{ product_id: number }>(
      'SELECT product_id FROM product_balances WHERE id = ?', [id]);
    if (!row) return;
    await this.db.run(
      `DELETE FROM product_balances
       WHERE product_id = ? AND valid_from >= ? AND id <> ?`,
      [row.product_id, input.valid_from, id]);

    await this.db.run(
      `UPDATE product_balances
       SET valid_from = ?, amount_minor = ?, updated_at = ? WHERE id = ?`,
      [input.valid_from, input.amount_minor, now, id]);
  }

  /** Every balance a product has been given, oldest first. */
  /**
   * The stated balances of every product of one account, in one question.
   *
   * Asked per product it was one call each, and the yields screen asks twice
   * per product on every open - which on a phone is where its seconds went.
   */
  async productBalancesOf(accountId: number | readonly number[]): Promise<Map<number, ProductBalance[]>> {
    // Several accounts at once for the yields screen, which draws them all.
    // A product belongs to one account, so the answer has the same shape.
    const ids = typeof accountId === 'number' ? [accountId] : accountId;
    const rows = await this.db.query<ProductBalance>(
      `SELECT b.id, b.product_id, b.valid_from, b.amount_minor, b.note, b.created_at
       FROM product_balances b
       JOIN products p ON p.id = b.product_id
       WHERE p.account_id IN ${placeholders(ids)}
       ORDER BY b.valid_from, b.id`,
      ids);

    const out = new Map<number, ProductBalance[]>();
    for (const row of rows) out.set(row.product_id, [...(out.get(row.product_id) ?? []), row]);
    return out;
  }

  /**
   * What has moved through each product of an account since its own day.
   *
   * The same sum as `movedInProductSince`, asked once for all of them: the
   * movements are read once, grouped by product and day, and each product's
   * own starting day picks out its share. A movement naming no product
   * belongs to the usual one, the rule the balances follow.
   */
  async movedInProductsSince(
    accountId: number,
    since: ReadonlyMap<number, IsoDate>,
    absorbs: number | null,
  ): Promise<Map<number, number>> {
    return this.movedInProductsOf(new Map([[accountId, { since, absorbs }]]));
  }

  /**
   * The same for several accounts, in one question. Products belong to one
   * account each, so the answer is keyed by product.
   */
  async movedInProductsOf(
    accounts: ReadonlyMap<number, { since: ReadonlyMap<number, IsoDate>; absorbs: number | null }>,
  ): Promise<Map<number, number>> {
    const out = new Map<number, number>();
    const asked = [...accounts].filter(([, entry]) => entry.since.size > 0);
    if (asked.length === 0) return out;

    const ids = asked.map(([accountId]) => accountId);
    const earliest = asked.flatMap(([, entry]) => [...entry.since.values()]).sort()[0];
    const rowsOf = new Map<number, { product_id: number | null; on_date: IsoDate; total: number }[]>();
    for (const row of await this.db.query<{ account_id: number; product_id: number | null; on_date: IsoDate; total: number }>(
      `SELECT account_id, product_id, occurred_on AS on_date, SUM(amount_minor) AS total
       FROM transactions
       WHERE account_id IN ${placeholders(ids)} AND occurred_on >= ?
       GROUP BY account_id, product_id, occurred_on`,
      [...ids, earliest])) {
      const rows = rowsOf.get(row.account_id);
      if (rows) rows.push(row); else rowsOf.set(row.account_id, [row]);
    }

    for (const [accountId, { since, absorbs }] of asked) {
      const rows = rowsOf.get(accountId) ?? [];
      for (const [productId, from] of since) {
        let total = 0;
        for (const row of rows) {
          if (row.on_date < from) continue;
          const belongs = row.product_id === productId || (row.product_id === null && productId === absorbs);
          if (belongs) total += row.total;
        }
        out.set(productId, total);
      }
    }
    return out;
  }

  async productBalances(productId: number): Promise<ProductBalance[]> {
    return this.db.query<ProductBalance>(
      `SELECT id, product_id, valid_from, amount_minor, note, created_at
       FROM product_balances WHERE product_id = ? ORDER BY valid_from, id`,
      [productId]);
  }

  /** Every balance of every product, for the engine to walk in memory. */
  async allProductBalances(): Promise<ProductBalance[]> {
    return this.db.query<ProductBalance>(
      `SELECT id, product_id, valid_from, amount_minor, note
       FROM product_balances ORDER BY product_id, valid_from, id`);
  }

  /**
   * Money moved into a CDT while it runs - the transfer that opened it, when
   * it was funded from another product. A CDT takes no deposits once open, so
   * every entry from the day before it opened to the day it matures is that.
   */
  async cdtFunding(productId: number, openedOn: IsoDate, maturesOn: IsoDate): Promise<number> {
    const row = await this.db.queryOne<{ total: number }>(
      `SELECT COALESCE(SUM(amount_minor), 0) AS total FROM transactions
       WHERE product_id = ? AND amount_minor > 0 AND occurred_on >= ? AND occurred_on < ?`,
      [productId, addDays(openedOn, -1), maturesOn]);
    return row?.total ?? 0;
  }

  /**
   * States a CDT's capital again: what it holds the day it opens.
   *
   * The transfer that funded it already puts money in, so the figure stated
   * the day before is the capital minus that transfer. Writing the whole
   * capital on the opening day, as saving the form did, counted the transfer
   * twice: Jose's 1.000.000 CDT read 2.000.000 on 2026-09-12.
   */
  async setCdtCapital(productId: number, input: { opened_on: IsoDate; matures_on: IsoDate; capital_minor: number }): Promise<void> {
    for (const old of await this.productBalances(productId)) await this.removeProductBalance(old.id);
    const funded = await this.cdtFunding(productId, input.opened_on, input.matures_on);
    await this.setProductBalance({
      product_id: productId,
      valid_from: addDays(input.opened_on, -1),
      amount_minor: Math.max(0, input.capital_minor - funded),
    });
  }

  async setProductBalance(input: {
    product_id: number;
    valid_from: IsoDate;
    amount_minor: number;
    note?: string | null;
  }): Promise<void> {
    const now = this.now();
    await this.db.run(
      `INSERT INTO product_balances (product_id, valid_from, amount_minor, note, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(product_id, valid_from) DO UPDATE SET
         amount_minor = excluded.amount_minor,
         note         = excluded.note,
         updated_at   = excluded.updated_at`,
      [input.product_id, input.valid_from, input.amount_minor, input.note ?? null, now, now]);
  }

  async removeProductBalance(id: number): Promise<void> {
    await this.db.run('DELETE FROM product_balances WHERE id = ?', [id]);
  }


  // -------------------------------------------------------------------------
  // The days themselves
  // -------------------------------------------------------------------------

  /** Every product's days for an account, oldest first. */
  /**
   * The days whose yield is handed over ON `day`, whenever they were earned:
   * what a daily product paid that day, plus a whole period when `day` is
   * its payday. Rows from before `paid_on` existed keep their old rule.
   */
  async paidOn(accountId: number, day: IsoDate): Promise<YieldDay[]> {
    return this.db.query<YieldDay>(
      `SELECT ${DAY_COLUMNS} FROM yield_days
       WHERE account_id = ?
         AND COALESCE(paid_on, CASE WHEN payout = 'daily' THEN on_date
                                    ELSE date(on_date, 'start of month', '+1 month', '-1 day') END) = ?
       ORDER BY on_date, product_id, component`,
      [accountId, day]);
  }

  async days(accountId: number, from?: IsoDate, to?: IsoDate): Promise<YieldDay[]> {
    const where = ['account_id = ?'];
    const values: unknown[] = [accountId];
    if (from) { where.push('on_date >= ?'); values.push(from); }
    if (to) { where.push('on_date <= ?'); values.push(to); }

    return this.db.query<YieldDay>(
      `SELECT ${DAY_COLUMNS} FROM yield_days
       WHERE ${where.join(' AND ')}
       ORDER BY on_date, product_id, component`,
      values);
  }

  /** One product, for the engine and for a detail that names the product. */
  async productDays(productId: number, from?: IsoDate, to?: IsoDate): Promise<YieldDay[]> {
    const where = ['product_id = ?'];
    const values: unknown[] = [productId];
    if (from) { where.push('on_date >= ?'); values.push(from); }
    if (to) { where.push('on_date <= ?'); values.push(to); }

    return this.db.query<YieldDay>(
      `SELECT ${DAY_COLUMNS} FROM yield_days
       WHERE ${where.join(' AND ')}
       ORDER BY on_date`,
      values);
  }

  /** The last day already worked out, so a recompute knows where to resume. */
  /**
   * What every enrolled account worked out over one calendar year.
   *
   * For the tax simulator, as a starting point and never as the figure: these
   * are yields accrued day by day, where the return counts what the bank
   * actually paid, and the bank's own certificate is what belongs on the form.
   * Cashback is reported apart from the yields: it goes to rentas de capital
   * too, but it is not a financial yield, so it carries no componente
   * inflacionario and no withholding.
   */
  async yearTotals(year: number): Promise<{
    grossMinor: number; withheldMinor: number; days: number; cashbackMinor: number;
  }> {
    const range = [`${year}-01-01`, `${year}-12-31`];
    const row = await this.db.queryOne<{ gross: number | null; withheld: number | null; days: number }>(
      `SELECT SUM(gross_minor) AS gross, SUM(withholding_minor) AS withheld, COUNT(*) AS days
       FROM yield_days WHERE on_date >= ? AND on_date <= ?`,
      range);
    const cashback = await this.db.queryOne<{ total: number | null }>(
      `SELECT SUM(amount_minor) AS total FROM product_entries
       WHERE kind = 'cashback' AND on_date >= ? AND on_date <= ?`,
      range);
    return {
      grossMinor: row?.gross ?? 0,
      withheldMinor: row?.withheld ?? 0,
      days: row?.days ?? 0,
      cashbackMinor: cashback?.total ?? 0,
    };
  }

  async lastAccruedDay(accountId: number): Promise<IsoDate | null> {
    const row = await this.db.queryOne<{ on_date: IsoDate }>(
      'SELECT MAX(on_date) AS on_date FROM yield_days WHERE account_id = ?', [accountId]);
    return row?.on_date ?? null;
  }

  /**
   * What the yields screen shows about the last day worked out, for several
   * accounts in four questions rather than four per account.
   *
   * Per account: that day, the bands in force today, the rows of that day,
   * and the rows handed over on it - the same answers as `lastAccruedDay`,
   * `bandsInForce`, `days(id, last, last)` and `paidOn(id, last)`.
   */
  async lastDaysOf(accountIds: readonly number[], asOf: IsoDate): Promise<Map<number, {
    last: IsoDate | null; bands: YieldRate[]; daysOfLast: YieldDay[]; paidThatDay: YieldDay[];
  }>> {
    const out = new Map(accountIds.map(id => [id, {
      last: null as IsoDate | null, bands: [] as YieldRate[], daysOfLast: [] as YieldDay[], paidThatDay: [] as YieldDay[],
    }]));
    if (accountIds.length === 0) return out;
    const ids = placeholders(accountIds);

    for (const row of await this.db.query<{ account_id: number; on_date: IsoDate | null }>(
      `SELECT account_id, MAX(on_date) AS on_date FROM yield_days
       WHERE account_id IN ${ids} GROUP BY account_id`, accountIds)) {
      out.get(row.account_id)!.last = row.on_date ?? null;
    }

    for (const rate of await this.db.query<YieldRate>(
      `SELECT ${RATE_COLUMNS} FROM yield_rates r
       WHERE r.account_id IN ${ids} AND r.valid_from <= ?
         AND r.valid_from = (
           SELECT MAX(valid_from) FROM yield_rates
           WHERE account_id = r.account_id
             AND min_balance_minor = r.min_balance_minor
             AND valid_from <= ?)
       ORDER BY r.min_balance_minor, r.id`,
      [...accountIds, asOf, asOf])) {
      out.get(rate.account_id)!.bands.push(rate);
    }

    // Each account's own last day, found through the (account_id, on_date) index.
    const lastOf = `(SELECT MAX(x.on_date) FROM yield_days x WHERE x.account_id = yield_days.account_id)`;
    for (const day of await this.db.query<YieldDay>(
      `SELECT ${DAY_COLUMNS} FROM yield_days
       WHERE account_id IN ${ids} AND on_date = ${lastOf}
       ORDER BY on_date, product_id, component`, accountIds)) {
      out.get(day.account_id)!.daysOfLast.push(day);
    }
    for (const day of await this.db.query<YieldDay>(
      `SELECT ${DAY_COLUMNS} FROM yield_days
       WHERE account_id IN ${ids}
         AND COALESCE(paid_on, CASE WHEN payout = 'daily' THEN on_date
                                    ELSE date(on_date, 'start of month', '+1 month', '-1 day') END) = ${lastOf}
       ORDER BY on_date, product_id, component`, accountIds)) {
      out.get(day.account_id)!.paidThatDay.push(day);
    }
    return out;
  }

  /**
   * Writes one day, unless that day was corrected by hand.
   *
   * `locked` is the same protection a hand-edited movement gets from a
   * re-import: a recompute must never quietly undo a correction. Returns
   * whether the row was actually written, so a recompute can report what it
   * left alone.
   */
  async putDay(day: NewYieldDay): Promise<boolean> {
    return (await this.putDays([day])) === 1;
  }

  /**
   * Writes a whole walk's worth of days at once.
   *
   * One day at a time was two calls each - is it locked, then write it - and
   * opening the yields screen wrote a couple of hundred of them. That is
   * nothing for SQLite and everything for the phone: each call crosses into
   * the native side, and the crossing is the cost. Jose's screen took seconds
   * to open because of it.
   *
   * A day corrected by hand is still never overwritten; they are all asked
   * for in one question instead of one each.
   */
  async putDays(days: readonly NewYieldDay[]): Promise<number> {
    if (days.length === 0) return 0;

    const accountIds = [...new Set(days.map(day => day.account_id))];
    const lockedRows = await this.db.query<{ product_id: number; component: string; on_date: IsoDate }>(
      `SELECT product_id, component, on_date FROM yield_days
       WHERE locked = 1 AND account_id IN (${accountIds.map(() => '?').join(', ')})`,
      accountIds);
    const locked = new Set(lockedRows.map(row => `${row.product_id}|${row.component}|${row.on_date}`));

    const wanted = days.filter(day => !locked.has(`${day.product_id}|${day.component}|${day.on_date}`));
    if (wanted.length === 0) return 0;

    // SQLite on Android binds at most 999 values in one statement, so the
    // rows go in batches that stay well under it.
    const PER_ROW = 14;
    const perStatement = Math.floor(900 / PER_ROW);
    const now = this.now();

    for (let at = 0; at < wanted.length; at += perStatement) {
      const batch = wanted.slice(at, at + perStatement);
      const rows = batch.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)').join(', ');
      await this.db.run(
        `INSERT INTO yield_days
           (product_id, account_id, component, payout, on_date, paid_on, balance_minor, annual_rate_scaled,
            gross_minor, withholding_minor, net_minor, actual_net_minor, withholding_unknown,
            locked, computed_at)
         VALUES ${rows}
         ON CONFLICT(product_id, component, on_date) DO UPDATE SET
           balance_minor       = excluded.balance_minor,
           annual_rate_scaled  = excluded.annual_rate_scaled,
           gross_minor         = excluded.gross_minor,
           withholding_minor   = excluded.withholding_minor,
           net_minor           = excluded.net_minor,
           actual_net_minor    = excluded.actual_net_minor,
           withholding_unknown = excluded.withholding_unknown,
           paid_on             = excluded.paid_on,
           computed_at         = excluded.computed_at`,
        batch.flatMap(day => [
          day.product_id, day.account_id, day.component, day.payout, day.on_date, day.paid_on ?? null,
          day.balance_minor, day.annual_rate_scaled,
          day.gross_minor, day.withholding_minor, day.net_minor,
          day.actual_net_minor ?? null, day.withholding_unknown, now,
        ]),
      );
    }

    return wanted.length;
  }

  /**
   * Corrects one day by hand and locks it against recomputation.
   *
   * What the app worked out stays in `gross_minor` and `net_minor`; the
   * correction goes to `actual_net_minor`, so the two can be compared later.
   */
  async correctDay(productId: number, on: IsoDate, actualNetMinor: number): Promise<void> {
    await this.db.run(
      `UPDATE yield_days
       SET actual_net_minor = ?, locked = 1, computed_at = ?
       WHERE product_id = ? AND on_date = ?`,
      [actualNetMinor, this.now(), productId, on]);
  }

  async unlockDay(productId: number, on: IsoDate): Promise<void> {
    await this.db.run(
      'UPDATE yield_days SET locked = 0 WHERE product_id = ? AND on_date = ?',
      [productId, on]);
  }

  /** Throws away computed days so they can be worked out again. Locked days stay. */
  /**
   * Removes days that have not happened yet.
   *
   * A day after today is never right, whatever it says. These appeared because
   * "today" was once read as the UTC day, which in Colombia is tomorrow every
   * evening after seven - so the engine accrued a day in the future and then
   * had no reason to revisit it: it resumes from the last day it wrote, and
   * that day was already past the day it was being asked to reach, so it
   * returned early without clearing anything.
   *
   * `locked` is ignored on purpose. Locking a day means a statement disagreed
   * with the arithmetic and the statement won, which cannot be true of a day
   * the bank has not reached either.
   */
  async clearFutureDays(accountId: number, after: IsoDate): Promise<void> {
    await this.db.run(
      'DELETE FROM yield_days WHERE account_id = ? AND on_date > ?', [accountId, after]);
  }

  async clearDays(accountId: number, from?: IsoDate): Promise<void> {
    const values: unknown[] = [accountId];
    let sql = 'DELETE FROM yield_days WHERE account_id = ? AND locked = 0';
    if (from) { sql += ' AND on_date >= ?'; values.push(from); }
    await this.db.run(sql, values);
  }

  // -------------------------------------------------------------------------
  // Adjustments and withdrawals
  // -------------------------------------------------------------------------

  /**
   * Records the gap between what the app accrued and what the bank paid.
   *
   * Signed: the bank may have paid more or less. This is the easy correction —
   * it leaves the daily history intact, which is evidence of what was worked
   * out and why, and puts the difference where anyone can see it.
   */
  async adjust(input: {
    account_id: number;
    on_date: IsoDate;
    amount_minor: number;
    kind?: 'correction' | 'cashback' | 'other';
    /** The user's own kind. `kind` above stays as the coarse one, for old readers. */
    product_kind_id?: number | null;
    /** The ordinary income or expense category, since migration 037. */
    category_id?: number | null;
    product_id?: number | null;
    source?: 'yield' | 'cashback';
    note?: string | null;
    /** The movement this is the other half of, when it is half of a cash-in. */
    transaction_id?: number | null;
  }): Promise<number> {
    const now = this.now();
    const result = await this.db.run(
      `INSERT INTO product_entries
         (account_id, source, kind, product_kind_id, category_id, product_id, on_date,
          amount_minor, note, transaction_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [input.account_id, input.source ?? 'yield', input.kind ?? 'correction',
       input.product_kind_id ?? null, input.category_id ?? null,
       input.product_id ?? null, input.on_date,
       input.amount_minor, input.note ?? null, input.transaction_id ?? null, now, now]);
    return result.lastId ?? 0;
  }

  async adjustments(accountId: number): Promise<ProductEntry[]> {
    return this.db.query<ProductEntry>(
      `SELECT id, account_id, source, kind, product_kind_id, category_id, product_id, on_date,
              amount_minor, note, transaction_id
       FROM product_entries WHERE account_id = ? ORDER BY on_date, id`,
      [accountId]);
  }

  async removeAdjustment(id: number): Promise<void> {
    await this.db.run('DELETE FROM product_entries WHERE id = ?', [id]);
  }

  async removeWithdrawal(id: number): Promise<void> {
    await this.db.run('DELETE FROM product_cashouts WHERE id = ?', [id]);
  }

  /**
   * How many rows name a product: movements, entries, withdrawals and days it
   * earned. Removing a product with any of them has to say where they go, even
   * when its balance is zero - otherwise its history is left pointing nowhere.
   */
  async productHistoryCount(productId: number): Promise<number> {
    const row = await this.db.queryOne<{ n: number }>(
      `SELECT (SELECT COUNT(*) FROM transactions WHERE product_id = ?)
            + (SELECT COUNT(*) FROM product_entries WHERE product_id = ?)
            + (SELECT COUNT(*) FROM product_cashouts WHERE product_id = ?)
            + (SELECT COUNT(*) FROM yield_days WHERE product_id = ?) AS n`,
      [productId, productId, productId, productId]);
    return row?.n ?? 0;
  }

  /** Corrects an entry on a product: its amount, day, kind, product or note. */
  async updateAdjustment(id: number, changes: {
    on_date: IsoDate;
    amount_minor: number;
    kind: 'correction' | 'cashback' | 'other';
    product_kind_id?: number | null;
    category_id?: number | null;
    product_id: number | null;
    note: string | null;
  }): Promise<void> {
    await this.db.run(
      `UPDATE product_entries
       SET on_date = ?, amount_minor = ?, kind = ?, product_kind_id = ?, category_id = ?, product_id = ?, note = ?,
           updated_at = ?
       WHERE id = ?`,
      [changes.on_date, changes.amount_minor, changes.kind, changes.product_kind_id ?? null,
       changes.category_id ?? null,
       changes.product_id, changes.note, this.now(), id]);
  }

  /**
   * Takes money out of what a product earned, having become a real movement.
   *
   * The caller creates the movement first and passes its id: the two belong
   * together, and the link is what stops the money being counted twice — once
   * as earned and once as balance.
   */
  async withdraw(input: {
    account_id: number;
    on_date: IsoDate;
    amount_minor: number;
    transaction_id?: number | null;
    source?: 'yield' | 'cashback';
    note?: string | null;
    /** The product it leaves from. Null: the one unassigned money uses. */
    product_id?: number | null;
  }): Promise<number> {
    const result = await this.db.run(
      `INSERT INTO product_cashouts
         (account_id, source, on_date, amount_minor, transaction_id, note, product_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [input.account_id, input.source ?? 'yield', input.on_date,
       input.amount_minor, input.transaction_id ?? null, input.note ?? null, input.product_id ?? null, this.now()]);
    return result.lastId ?? 0;
  }

  async withdrawals(accountId: number): Promise<{
    id: number; account_id: number; source: 'yield' | 'cashback';
    on_date: IsoDate; amount_minor: number; transaction_id: number | null; note: string | null;
    product_id: number | null;
  }[]> {
    return this.db.query(
      `SELECT id, account_id, source, on_date, amount_minor, transaction_id, note, product_id
       FROM product_cashouts WHERE account_id = ? ORDER BY on_date, id`,
      [accountId]);
  }

  // -------------------------------------------------------------------------
  // What it all adds up to
  // -------------------------------------------------------------------------

  /**
   * What one account has earned, broken into the four parts it is made of.
   *
   * Returned in pieces rather than as a single figure on purpose: a total
   * nobody can take apart is a total nobody can check. `asOf` lets the same
   * question be asked about an earlier day.
   *
   * A day corrected by hand counts as what the bank paid, not as what the app
   * worked out — that is what `actual_net_minor` is for.
   */
  /**
   * Whether anything an accrual depends on has changed since the last one.
   *
   * Opening the yields screen worked the whole thing out again every time,
   * which on a phone is hundreds of crossings into the native side for an
   * answer that is usually the one already stored. So the state of everything
   * the accrual reads is reduced to one short string - how many rows each
   * table holds, its highest id, and the latest time any of them was touched -
   * and kept beside the day it was worked out for.
   *
   * It errs towards working: anything it cannot tell apart, and any error
   * reading it, means yes.
   */
  async needsAccrual(today: IsoDate): Promise<boolean> {
    return (await this.staleAccounts(today)).length > 0;
  }

  /**
   * The enrolled accounts whose yields are out of date on `today`.
   *
   * The state used to be one string for the whole database, so a coffee paid
   * with the credit card - an account that earns nothing - made all thirteen
   * accounts be worked out again the next time the yields screen opened. It is
   * one string per account now, beside one for what every account shares: the
   * day and the tax parameters. When the shared part moved, every account is
   * stale; otherwise only the ones whose own string did.
   *
   * An account works out from its own rows only - its movements, products,
   * balances, rates and product entries - so a change to one account can never
   * make another one wrong. A transfer is two movements, one in each account,
   * and marks both.
   */
  async staleAccounts(today: IsoDate): Promise<number[]> {
    const stored = await this.db.queryOne<{ value: string }>(
      'SELECT value FROM settings WHERE key = ?', [ACCRUAL_MARK]);
    const current = await this.accrualMarks(today);
    const enrolled = Object.keys(current.accounts).map(Number);

    // A mark written before marks were kept per account is a plain string,
    // and says nothing about any one account.
    let before: AccrualMarks | null = null;
    try {
      const parsed = stored ? JSON.parse(stored.value) : null;
      if (parsed && typeof parsed.shared === 'string' && parsed.accounts) before = parsed;
    } catch { /* an old mark: every account is worked out once */ }

    if (!before || before.shared !== current.shared) return enrolled;
    return enrolled.filter(id => before.accounts[id] !== current.accounts[id]);
  }

  /**
   * Records that today's accrual is done, against the data it was done on.
   *
   * `onlyIfKnown` is for the screens that accrue ONE account after changing
   * it: they may re-mark only if a mark is already there, because a mark
   * standing means every other account was up to date a moment ago and the
   * one that changed has just been worked out. With no mark at all, nothing
   * is claimed - a whole pass has never run, and the next open owes one.
   */
  async markAccrued(today: IsoDate, options: { onlyIfKnown?: boolean } = {}): Promise<void> {
    if (options.onlyIfKnown) {
      const stored = await this.db.queryOne<{ value: string }>(
        'SELECT value FROM settings WHERE key = ?', [ACCRUAL_MARK]);
      if (!stored) return;
    }

    const now = this.now();
    await this.db.run(
      'INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)',
      [ACCRUAL_MARK, JSON.stringify(await this.accrualMarks(today)), now]);
  }

  /**
   * The state of everything an accrual reads, as one string per account and
   * one for what they all share - asked in a single question.
   *
   * Counts as well as timestamps, because a deleted row leaves the latest
   * timestamp exactly where it was. The day is in the shared part: tomorrow
   * is a day more to work out for every account even if nothing else moved.
   *
   * A rate is corrected in place and carries no time of change, so the rates
   * are compared by what they say. So is the account's opening balance, which
   * the walk starts from: the old single mark never looked at it, and only got
   * away with that because any movement anywhere redid everything.
   */
  private async accrualMarks(today: IsoDate): Promise<AccrualMarks> {
    const enrolled = 'account_id IN (SELECT account_id FROM yield_accounts)';
    const part = (tag: string, table: string, stamp: string) =>
      `SELECT '${tag}' AS part, account_id,
              COUNT(*) || ':' || COALESCE(MAX(rowid), 0) || ':' || COALESCE(MAX(${stamp}), '') AS sig
       FROM ${table} WHERE ${enrolled} GROUP BY account_id`;

    const rows = await this.db.query<{ part: string; account_id: number | null; sig: string | null }>(
      [
        `SELECT 'shared' AS part, NULL AS account_id,
                (SELECT COUNT(*) || ':' || COALESCE(MAX(rowid), 0) || ':' || COALESCE(MAX(updated_at), '')
                 FROM tax_parameters) AS sig`,
        `SELECT 'enrolled' AS part, account_id,
                enabled || ':' || opening_on || ':' || COALESCE(updated_at, '') AS sig
         FROM yield_accounts`,
        `SELECT 'account' AS part, id AS account_id,
                opening_balance_minor || ':' || COALESCE(updated_at, '') AS sig
         FROM accounts WHERE id IN (SELECT account_id FROM yield_accounts)`,
        part('movements', 'transactions', 'updated_at'),
        part('products', 'products', 'updated_at'),
        `SELECT 'balances' AS part, p.account_id,
                COUNT(*) || ':' || COALESCE(MAX(b.rowid), 0) || ':' || COALESCE(MAX(b.updated_at), '') AS sig
         FROM product_balances b JOIN products p ON p.id = b.product_id
         WHERE p.${enrolled} GROUP BY p.account_id`,
        `SELECT 'rates' AS part, account_id, group_concat(line, ';') AS sig FROM (
           SELECT account_id, ${RATE_COLUMNS.split(',').map(column => `quote(${column.trim()})`).join(" || ',' || ")} AS line
           FROM yield_rates WHERE ${enrolled} ORDER BY account_id, id)
         GROUP BY account_id`,
        part('entries', 'product_entries', 'updated_at'),
        part('taken', 'product_cashouts', 'created_at'),
        part('days', 'yield_days', 'computed_at'),
      ].join(' UNION ALL '));

    // Put together in a fixed order, so the string never depends on the order
    // the database happened to hand the rows back in.
    const marks: AccrualMarks = { shared: today, accounts: {} };
    const parts = new Map<number, string[]>();
    for (const row of rows) {
      if (row.part === 'shared') marks.shared = `${today}|${row.sig ?? ''}`;
      else if (row.account_id !== null) {
        parts.set(row.account_id, [...(parts.get(row.account_id) ?? []), `${row.part}=${row.sig ?? ''}`]);
      }
    }
    for (const [accountId, sigs] of parts) {
      if (sigs.some(sig => sig.startsWith('enrolled='))) marks.accounts[accountId] = sigs.sort().join('|');
    }
    return marks;
  }

  async earned(accountId: number, asOf?: IsoDate): Promise<EarnedBalance> {
    return (await this.earnedAll(asOf)).get(accountId) ?? nothingEarned(accountId);
  }

  /**
   * The same, for every account at once.
   *
   * Ten questions per account, asked one account at a time, is what the yields
   * screen opened with - and on a phone every question crosses into the native
   * side, which is where the seconds went. These are the same sums, grouped by
   * account: six questions however many accounts there are.
   */
  async earnedAll(asOf?: IsoDate): Promise<Map<number, EarnedBalance>> {
    const upTo = asOf ?? '9999-12-31';
    const day = asOf ?? todayIso();
    const [year, month] = day.split('-').map(Number);
    const monthEnd = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);

    const accounts = await this.accounts();

    const accrued = await this.db.query<{ account_id: number; net: number | null; unknown: number }>(
      `SELECT account_id,
              SUM(COALESCE(actual_net_minor, net_minor)) AS net,
              SUM(withholding_unknown) AS unknown
       FROM yield_days WHERE on_date <= ? GROUP BY account_id`, [upTo]);

    const adjusted = await this.db.query<{ account_id: number; total: number | null }>(
      'SELECT account_id, SUM(amount_minor) AS total FROM product_entries WHERE on_date <= ? GROUP BY account_id',
      [upTo]);

    const withdrawn = await this.db.query<{ account_id: number; total: number | null }>(
      'SELECT account_id, SUM(amount_minor) AS total FROM product_cashouts WHERE on_date <= ? GROUP BY account_id',
      [upTo]);

    // What a monthly account has worked out this month is owed, not held. A
    // day written since `paid_on` existed says when it is handed over, which
    // for a rate paid every several months can be months away.
    const owed = await this.db.query<{ account_id: number; net: number | null; paid: IsoDate | null }>(
      `SELECT account_id, SUM(COALESCE(actual_net_minor, net_minor)) AS net, MIN(paid_on) AS paid
       FROM yield_days
       WHERE paid_on IS NOT NULL AND on_date <= ? AND paid_on > ?
       GROUP BY account_id`, [day, day]);

    // A day written before that keeps the rule it was worked out under: a
    // monthly one is paid at the end of its own month.
    const legacy = day < monthEnd
      ? await this.db.query<{ account_id: number; net: number | null }>(
          `SELECT account_id, SUM(COALESCE(actual_net_minor, net_minor)) AS net
           FROM yield_days
           WHERE payout = 'monthly' AND paid_on IS NULL AND on_date >= ? AND on_date <= ?
           GROUP BY account_id`, [`${day.slice(0, 7)}-01`, day])
      : [];

    const by = <T extends { account_id: number }>(rows: readonly T[]) =>
      new Map(rows.map(row => [row.account_id, row]));
    const accruedBy = by(accrued);
    const adjustedBy = by(adjusted);
    const withdrawnBy = by(withdrawn);
    const owedBy = by(owed);
    const legacyBy = by(legacy);

    // Every account that has a figure of any kind, not only the enrolled ones:
    // an account can carry days from before it was paused.
    const ids = new Set<number>([
      ...accounts.map(account => account.account_id),
      ...accrued.map(row => row.account_id),
      ...adjusted.map(row => row.account_id),
      ...withdrawn.map(row => row.account_id),
    ]);

    const out = new Map<number, EarnedBalance>();

    for (const accountId of ids) {
      const accruedMinor = accruedBy.get(accountId)?.net ?? 0;
      const adjustedMinor = adjustedBy.get(accountId)?.total ?? 0;
      const withdrawnMinor = withdrawnBy.get(accountId)?.total ?? 0;

      let pendingMinor = owedBy.get(accountId)?.net ?? 0;
      let paidOn = pendingMinor > 0 ? owedBy.get(accountId)?.paid ?? null : null;

      const legacyMinor = legacyBy.get(accountId)?.net ?? 0;
      if (legacyMinor > 0) {
        pendingMinor += legacyMinor;
        paidOn = paidOn === null || monthEnd < paidOn ? monthEnd : paidOn;
      }

      out.set(accountId, {
        account_id: accountId,
        accrued_minor: accruedMinor,
        adjusted_minor: adjustedMinor,
        withdrawn_minor: withdrawnMinor,
        totalMinor: accruedMinor + adjustedMinor - withdrawnMinor,
        pendingMinor,
        availableMinor: accruedMinor + adjustedMinor - withdrawnMinor - pendingMinor,
        paidOn,
        daysWithUnknownWithholding: accruedBy.get(accountId)?.unknown ?? 0,
      });
    }

    return out;
  }

  /**
   * What each product has earned, had added or taken out. A row that names no
   * product - an entry from before a product could be named - belongs to the
   * product that follows the account balance, or else the first, the same rule
   * the accrual follows. The parts add up to `earned().totalMinor`.
   */
  async earnedByProduct(accountId: number, asOf?: IsoDate): Promise<Map<number, number>> {
    const upTo = asOf ?? '9999-12-31';
    const products = await this.products(accountId);
    const out = new Map<number, number>(products.map(product => [product.id, 0]));
    if (products.length === 0) return out;

    const fallback = (products.find(product => product.source === 'ledger') ?? products[0]).id;
    const add = (productId: number | null, amount: number | null) => {
      const id = productId !== null && out.has(productId) ? productId : fallback;
      out.set(id, (out.get(id) ?? 0) + (amount ?? 0));
    };
    type Row = { product_id: number | null; total: number | null };

    for (const row of await this.db.query<Row>(
      `SELECT product_id, SUM(COALESCE(actual_net_minor, net_minor)) AS total
       FROM yield_days WHERE account_id = ? AND on_date <= ? GROUP BY product_id`, [accountId, upTo])) {
      add(row.product_id, row.total);
    }
    for (const row of await this.db.query<Row>(
      `SELECT product_id, SUM(amount_minor) AS total
       FROM product_entries WHERE account_id = ? AND on_date <= ? GROUP BY product_id`, [accountId, upTo])) {
      add(row.product_id, row.total);
    }
    for (const row of await this.db.query<Row>(
      `SELECT product_id, SUM(amount_minor) AS total
       FROM product_cashouts WHERE account_id = ? AND on_date <= ? GROUP BY product_id`, [accountId, upTo])) {
      add(row.product_id, -(row.total ?? 0));
    }
    return out;
  }

  /**
   * What has landed IN each product's balance since that balance was last
   * stated: days the bank already paid, and income or expenses entered on the
   * product. `total` is all of it; `yields` is only what the bank paid, since
   * an income or expense someone enters is not a yield. This is what makes a product's balance read as its bank shows
   * it, and it moves no net worth - the account's own balance is untouched.
   *
   * Only what comes after the balance was stated: a figure read off the bank
   * already holds everything paid up to that day, so counting it again would
   * double it. A product that follows the account balance counts from the
   * day the account started accruing. Rows naming no product belong where the
   * accrual puts them.
   */
  async landedByProduct(
    accountId: number, today: IsoDate, known?: readonly YieldProduct[],
  ): Promise<{ total: Map<number, number>; yields: Map<number, number> }> {
    const products = known ?? await this.products(accountId);
    return (await this.landedByProducts(today, new Map([[accountId, products]]))).get(accountId)!;
  }

  /**
   * The same, for several accounts in five questions however many there
   * are: the yields screen draws every account, and asking five per account
   * is what it used to spend its time on.
   */
  async landedByProducts(
    today: IsoDate, productsOf: ReadonlyMap<number, readonly YieldProduct[]>,
  ): Promise<Map<number, { total: Map<number, number>; yields: Map<number, number> }>> {
    const out = new Map<number, { total: Map<number, number>; yields: Map<number, number> }>();
    for (const [accountId, products] of productsOf) {
      out.set(accountId, {
        total: new Map<number, number>(products.map(product => [product.id, 0])),
        yields: new Map<number, number>(products.map(product => [product.id, 0])),
      });
    }
    const ids = [...productsOf].filter(([, products]) => products.length > 0).map(([id]) => id);
    if (ids.length === 0) return out;

    const openings = new Map((await this.db.query<{ account_id: number; opening_on: IsoDate }>(
      `SELECT account_id, opening_on FROM yield_accounts WHERE account_id IN ${placeholders(ids)}`, ids))
      .map(row => [row.account_id, row.opening_on]));
    const histories = await this.productBalancesOf(ids);

    // Per account, what each of its rows is weighed against.
    const accountsOf = new Map<number, {
      since: Map<number, { day: IsoDate; typedAt: string | null }>;
      idOf: (productId: number | null) => number;
      total: Map<number, number>;
      paid: Map<number, number>;
    }>();
    for (const accountId of ids) {
      const products = productsOf.get(accountId)!;
      const { total, yields: paid } = out.get(accountId)!;
      const opening = openings.get(accountId) ?? '0000-01-01';
      // Where each product's balance was last stated, and when it was typed in.
      const since = new Map<number, { day: IsoDate; typedAt: string | null }>();
      for (const product of products) {
        const stated = product.source === 'manual'
          ? (histories.get(product.id) ?? []).filter(entry => entry.valid_from <= today).at(-1)
          : undefined;
        since.set(product.id, stated
          ? { day: stated.valid_from, typedAt: stated.created_at ?? null }
          : { day: opening, typedAt: null });
      }
      const fallback = (products.find(product => product.source === 'ledger') ?? products[0]).id;
      const idOf = (productId: number | null) => productId !== null && total.has(productId) ? productId : fallback;
      accountsOf.set(accountId, { since, idOf, total, paid });
    }

    const credit = (into: Map<number, number>, id: number, amount: number | null) =>
      into.set(id, (into.get(id) ?? 0) + (amount ?? 0));

    // A day paid on the day the balance was read is already in that figure.
    const addPaid = (accountId: number, productId: number | null, day: IsoDate, amount: number | null) => {
      const { since, idOf, total, paid } = accountsOf.get(accountId)!;
      const id = idOf(productId);
      if (day > since.get(id)!.day) {
        credit(total, id, amount);
        credit(paid, id, amount);
      }
    };
    // An entry on that same day counts when it was recorded after the balance
    // was: a product created today and given an income today holds it. Without
    // this the income showed in the account's yields and never in the product.
    const addEntry = (accountId: number, productId: number | null, day: IsoDate, createdAt: string, amount: number | null) => {
      const { since, idOf, total } = accountsOf.get(accountId)!;
      const id = idOf(productId);
      const base = since.get(id)!;
      if (day > base.day || (day === base.day && (base.typedAt === null || createdAt >= base.typedAt))) {
        credit(total, id, amount);
      }
    };
    type Row = { account_id: number; product_id: number | null; day: IsoDate; created_at: string; total: number | null };
    const inIds = `account_id IN ${placeholders(ids)}`;

    // A day's yield is in the product once it is paid, not while it is owed.
    for (const row of await this.db.query<Row>(
      `SELECT account_id, product_id, paid AS day, SUM(net) AS total FROM (
         SELECT account_id, product_id, COALESCE(actual_net_minor, net_minor) AS net,
                COALESCE(paid_on, CASE WHEN payout = 'daily' THEN on_date
                                       ELSE date(on_date, 'start of month', '+1 month', '-1 day') END) AS paid
         FROM yield_days WHERE ${inIds})
       WHERE paid <= ? GROUP BY account_id, product_id, paid`, [...ids, today])) {
      addPaid(row.account_id, row.product_id, row.day, row.total);
    }
    for (const row of await this.db.query<Row>(
      `SELECT account_id, product_id, on_date AS day, created_at, amount_minor AS total
       FROM product_entries WHERE ${inIds}`, ids)) {
      addEntry(row.account_id, row.product_id, row.day, row.created_at, row.total);
    }
    for (const row of await this.db.query<Row>(
      `SELECT account_id, product_id, on_date AS day, created_at, amount_minor AS total
       FROM product_cashouts WHERE ${inIds}`, ids)) {
      addEntry(row.account_id, row.product_id, row.day, row.created_at, -(row.total ?? 0));
    }
    return out;
  }

  /**
   * The day from which each product's balance counts movements: the day its
   * balance was last stated (on or before `today`), or the day the account
   * started, for a product with no figure of its own. The same rule the
   * balances follow, so a history shows exactly what they add up.
   */
  async productStartDays(accountId: number, today: IsoDate): Promise<Map<number, IsoDate>> {
    const opening = (await this.account(accountId))?.opening_on ?? '0000-01-01';
    const out = new Map<number, IsoDate>();
    for (const product of await this.products(accountId)) {
      const stated = product.source === 'manual'
        ? (await this.productBalances(product.id)).filter(entry => entry.valid_from <= today).at(-1)
        : undefined;
      out.set(product.id, stated?.valid_from ?? opening);
    }
    return out;
  }

  /** What every enrolled account has earned, for the screen that lists them. */
  async allEarned(asOf?: IsoDate): Promise<EarnedBalance[]> {
    const accounts = await this.accounts();
    const out: EarnedBalance[] = [];
    for (const account of accounts) {
      out.push(await this.earned(account.account_id, asOf));
    }
    return out;
  }
}

/** Where the fingerprint of the last accrual is kept. */
const ACCRUAL_MARK = 'yields.accrual.mark';

/** The fingerprint itself: what every account shares, and each account's own. */
interface AccrualMarks {
  shared: string;
  accounts: Record<number, string>;
}

/** An account that has earned nothing and owes nothing. */
function nothingEarned(accountId: number): EarnedBalance {
  return {
    account_id: accountId,
    accrued_minor: 0,
    adjusted_minor: 0,
    withdrawn_minor: 0,
    totalMinor: 0,
    pendingMinor: 0,
    availableMinor: 0,
    paidOn: null,
    daysWithUnknownWithholding: 0,
  };
}

/** `(?, ?, ?)` for an IN list of that many values. */
function placeholders(values: readonly unknown[]): string {
  return `(${values.map(() => '?').join(', ')})`;
}
