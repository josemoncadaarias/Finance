/**
 * The cushion: yields earned, and what has been done with them.
 *
 * Four things add up to what an account's cushion is worth today:
 *
 *   opening + sum(net accrued) + sum(adjustments) - sum(withdrawals)
 *
 * The opening figure was typed in once because the history before it cannot be
 * recovered. The accrual is what this app worked out day by day. The
 * adjustments are the gap against what the bank actually paid — most of these
 * banks deposit once a month, so a daily accrual is an estimate until the
 * deposit lands. The withdrawals are money moved into the account, where it
 * stops being a cushion and becomes net worth.
 *
 * None of it touches the balance of the account, and none of it enters net
 * worth. That separation is the whole point of the module.
 */

import type { SqlDriver } from '../sql-driver';
import type { IsoDate } from '../types';
import { todayIso } from '../../yields/days';

/** An account enrolled for accrual. Not being here means never accrued. */
export interface YieldAccount {
  account_id: number;
  opening_cushion_minor: number;
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
  /** Whose rate it is. Null is the account's own, used by every pocket that
   *  has none of its own. */
  pocket_id: number | null;
  /** Which part of the rate this is. An ordinary account has one, 'base'. */
  component: string;
  /** When this part is handed over. Not a property of the account: Uala pays
   *  half of its rate daily and half at the end of the month. */
  payout: 'daily' | 'monthly';
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
 * pocket. Adding them up first would charge withholding that is not owed.
 *
 * `source` says where the balance comes from: `ledger` follows the account's
 * own balance, `manual` is a figure typed in and dated, because a movement
 * never says which pocket it landed in.
 */
export interface YieldPocket {
  id: number;
  account_id: number;
  name: string;
  source: 'ledger' | 'manual';
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
 * Money that landed in the cushion on a date, for a reason.
 *
 * `kind` is what it IS: `cashback` that arrived, a `correction` against what
 * the bank actually paid, or something `other` the note explains. They are
 * kept apart because their tax treatment is not the same - cashback is not
 * withheld and interest is - and because a screen has to be able to say what
 * a figure was.
 *
 * Signed: a correction can go either way.
 */
export interface CushionEntry {
  id: number;
  account_id: number;
  source: 'yield' | 'cashback';
  kind: 'correction' | 'cashback' | 'other';
  pocket_id: number | null;
  on_date: IsoDate;
  amount_minor: number;
  note: string | null;
}

/** What a manual pocket held, from a date. */
export interface PocketBalance {
  id: number;
  pocket_id: number;
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
  pocket_id: number;
  account_id: number;
  component: string;
  payout: 'daily' | 'monthly';
  on_date: IsoDate;
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

/** What an account's cushion is made of, so a total can be explained. */
export interface CushionBalance {
  account_id: number;
  opening_minor: number;
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
   * part of the cushion without saying so is what made Rappi cuenta look
   * like it had already earned in September when September was not over.
   */
  pendingMinor: number;
  /** The cushion less what is still owed: what could actually be moved. */
  availableMinor: number;
  /** Day the pending amount is handed over, or null when nothing is pending. */
  paidOn: IsoDate | null;
  /** Days whose withholding could not be worked out for lack of parameters. */
  daysWithUnknownWithholding: number;
}

const ACCOUNT_COLUMNS =
  'account_id, opening_cushion_minor, opening_on, withholding, enabled, payout, note';
const RATE_COLUMNS =
  `id, account_id, pocket_id, component, payout, valid_from, valid_to, annual_rate_scaled, min_balance_minor,
   max_balance_minor, requires_monthly_spend_minor, fallback_annual_rate_scaled, note`;
const DAY_COLUMNS =
  `pocket_id, account_id, component, payout, on_date, balance_minor, annual_rate_scaled, gross_minor,
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
   * Enrols an account, or corrects the opening figure of one already enrolled.
   *
   * Changing the opening figure does not touch the days already accrued: it is
   * a different question. The opening figure is what was there before the app
   * started counting; the days are what it counted afterwards.
   */
  async enrol(input: {
    account_id: number;
    opening_cushion_minor: number;
    opening_on: IsoDate;
    withholding?: boolean;
    enabled?: boolean;
    payout?: 'daily' | 'monthly';
    note?: string | null;
    /** What to call the product every account starts with. */
    default_pocket_name?: string;
  }): Promise<void> {
    const now = this.now();
    await this.db.run(
      `INSERT INTO yield_accounts
         (account_id, opening_cushion_minor, opening_on, withholding, enabled, payout, note, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(account_id) DO UPDATE SET
         opening_cushion_minor = excluded.opening_cushion_minor,
         opening_on            = excluded.opening_on,
         withholding           = excluded.withholding,
         enabled               = excluded.enabled,
         payout                = excluded.payout,
         note                  = excluded.note,
         updated_at            = excluded.updated_at`,
      [
        input.account_id,
        input.opening_cushion_minor,
        input.opening_on,
        input.withholding === false ? 0 : 1,
        input.enabled === false ? 0 : 1,
        input.payout ?? 'daily',
        input.note ?? null,
        now, now,
      ],
    );

    // An account with no pocket has nothing to accrue on, so enrolling one
    // gives it a pocket that simply holds the account's own balance. That is
    // what every account had before pockets existed, and it stays the default:
    // splitting is something someone does on purpose.
    const existing = await this.db.queryOne<{ n: number }>(
      'SELECT COUNT(*) AS n FROM yield_pockets WHERE account_id = ?', [input.account_id]);

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
      await this.addPocket({
        account_id: input.account_id,
        name: input.default_pocket_name ?? 'Savings account',
        source: 'ledger',
        sort_order: 0,
      });
    }
  }

  /**
   * Stops accruing an account, keeping everything already worked out.
   *
   * Deliberately not a delete: the days, the rates and the opening figure are
   * the evidence behind a cushion someone may still want to look at.
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
       ORDER BY r.min_balance_minor`,
      [accountId, asOf, asOf]);
  }

  /** Records a rate from a date. A change is a new row, never an edit. */
  async setRate(input: {
    account_id: number;
    pocket_id?: number | null;
    component?: string;
    payout?: 'daily' | 'monthly';
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
    const pocket = input.pocket_id ?? null;

    const existing = await this.db.queryOne<{ id: number }>(
      `SELECT id FROM yield_rates
       WHERE account_id = ? AND component = ? AND valid_from = ? AND min_balance_minor = ?
         AND ((pocket_id IS NULL AND ? IS NULL) OR pocket_id = ?)`,
      [input.account_id, component, input.valid_from, band, pocket, pocket]);

    if (existing) {
      await this.correctRate(existing.id, {
        annual_rate_scaled: input.annual_rate_scaled,
        payout: input.payout ?? 'daily',
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
         (account_id, pocket_id, component, payout, valid_from, valid_to, annual_rate_scaled,
          min_balance_minor, max_balance_minor, requires_monthly_spend_minor,
          fallback_annual_rate_scaled, note, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.account_id,
        pocket,
        component,
        input.payout ?? 'daily',
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
  // Pockets
  // -------------------------------------------------------------------------

  /** The pockets of an account, in the order they are shown. */
  async pockets(accountId: number): Promise<YieldPocket[]> {
    return this.db.query<YieldPocket>(
      `SELECT id, account_id, name, source, sort_order, is_default, note
       FROM yield_pockets WHERE account_id = ? ORDER BY sort_order, id`,
      [accountId]);
  }

  /** Every pocket of every enrolled account, for one pass over them all. */
  async allPockets(): Promise<YieldPocket[]> {
    return this.db.query<YieldPocket>(
      `SELECT id, account_id, name, source, sort_order, is_default, note
       FROM yield_pockets ORDER BY account_id, sort_order, id`);
  }

  async addPocket(input: {
    account_id: number;
    name: string;
    source?: 'ledger' | 'manual';
    sort_order?: number;
    note?: string | null;
  }): Promise<number> {
    const now = this.now();
    const result = await this.db.run(
      `INSERT INTO yield_pockets (account_id, name, source, sort_order, note, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [input.account_id, input.name, input.source ?? 'manual',
       input.sort_order ?? 0, input.note ?? null, now, now]);
    return result.lastId ?? 0;
  }

  /**
   * Changes where a pocket takes its balance from.
   *
   * Only one pocket of an account can follow the ledger; two of them would
   * each claim the whole balance. The caller is what enforces that, because
   * SQLite has no partial unique constraint that would say it here.
   */
  async setPocketSource(id: number, source: 'ledger' | 'manual'): Promise<void> {
    await this.db.run('UPDATE yield_pockets SET source = ?, updated_at = ? WHERE id = ?',
      [source, this.now(), id]);
  }

  /**
   * Makes one product the account's usual one, and the others not.
   *
   * Both halves in one call, because the index allows at most one per account
   * and clearing the old one afterwards would leave a moment where two are
   * marked - which is a moment long enough for the write to fail.
   */
  async setDefaultPocket(accountId: number, pocketId: number): Promise<void> {
    const now = this.now();
    await this.db.run(
      'UPDATE yield_pockets SET is_default = NULL, updated_at = ? WHERE account_id = ?',
      [now, accountId]);
    await this.db.run(
      'UPDATE yield_pockets SET is_default = 1, updated_at = ? WHERE id = ?',
      [now, pocketId]);
  }

  async renamePocket(id: number, name: string): Promise<void> {
    await this.db.run('UPDATE yield_pockets SET name = ?, updated_at = ? WHERE id = ?',
      [name, this.now(), id]);
  }

  /**
   * Removes a pocket and every day it earned.
   *
   * The days go with it because they were worked out on a balance that no
   * longer exists; what they added to the cushion is worked out again on the
   * next pass, from whatever pockets are left.
   */
  async removePocket(id: number): Promise<void> {
    await this.db.run('DELETE FROM yield_pockets WHERE id = ?', [id]);
  }

  /**
   * What moved through a product on one day, after a given moment.
   *
   * The awkward, and commonest, case: the balance is typed at nine in the
   * morning and the day's spending is recorded through the afternoon. Counting
   * the whole day would count what the reading already contained; counting
   * none of it loses the afternoon. The moment the figure was written down is
   * what separates the two.
   */
  async movedOnDayAfter(pocketId: number, on: IsoDate, after: string): Promise<number> {
    const row = await this.db.queryOne<{ total: number | null }>(
      `SELECT SUM(amount_minor) AS total FROM transactions
       WHERE pocket_id = ? AND occurred_on = ? AND created_at > ?`,
      [pocketId, on, after]);
    return row?.total ?? 0;
  }

  /** Every balance a pocket has been given, oldest first. */
  async pocketBalances(pocketId: number): Promise<PocketBalance[]> {
    return this.db.query<PocketBalance>(
      `SELECT id, pocket_id, valid_from, amount_minor, note, created_at
       FROM yield_pocket_balances WHERE pocket_id = ? ORDER BY valid_from, id`,
      [pocketId]);
  }

  /** Every balance of every pocket, for the engine to walk in memory. */
  async allPocketBalances(): Promise<PocketBalance[]> {
    return this.db.query<PocketBalance>(
      `SELECT id, pocket_id, valid_from, amount_minor, note
       FROM yield_pocket_balances ORDER BY pocket_id, valid_from, id`);
  }

  async setPocketBalance(input: {
    pocket_id: number;
    valid_from: IsoDate;
    amount_minor: number;
    note?: string | null;
  }): Promise<void> {
    const now = this.now();
    await this.db.run(
      `INSERT INTO yield_pocket_balances (pocket_id, valid_from, amount_minor, note, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(pocket_id, valid_from) DO UPDATE SET
         amount_minor = excluded.amount_minor,
         note         = excluded.note,
         updated_at   = excluded.updated_at`,
      [input.pocket_id, input.valid_from, input.amount_minor, input.note ?? null, now, now]);
  }

  async removePocketBalance(id: number): Promise<void> {
    await this.db.run('DELETE FROM yield_pocket_balances WHERE id = ?', [id]);
  }


  // -------------------------------------------------------------------------
  // The days themselves
  // -------------------------------------------------------------------------

  /** Every pocket's days for an account, oldest first. */
  async days(accountId: number, from?: IsoDate, to?: IsoDate): Promise<YieldDay[]> {
    const where = ['account_id = ?'];
    const values: unknown[] = [accountId];
    if (from) { where.push('on_date >= ?'); values.push(from); }
    if (to) { where.push('on_date <= ?'); values.push(to); }

    return this.db.query<YieldDay>(
      `SELECT ${DAY_COLUMNS} FROM yield_days
       WHERE ${where.join(' AND ')}
       ORDER BY on_date, pocket_id, component`,
      values);
  }

  /** One pocket, for the engine and for a detail that names the pocket. */
  async pocketDays(pocketId: number, from?: IsoDate, to?: IsoDate): Promise<YieldDay[]> {
    const where = ['pocket_id = ?'];
    const values: unknown[] = [pocketId];
    if (from) { where.push('on_date >= ?'); values.push(from); }
    if (to) { where.push('on_date <= ?'); values.push(to); }

    return this.db.query<YieldDay>(
      `SELECT ${DAY_COLUMNS} FROM yield_days
       WHERE ${where.join(' AND ')}
       ORDER BY on_date`,
      values);
  }

  /** The last day already worked out, so a recompute knows where to resume. */
  async lastAccruedDay(accountId: number): Promise<IsoDate | null> {
    const row = await this.db.queryOne<{ on_date: IsoDate }>(
      'SELECT MAX(on_date) AS on_date FROM yield_days WHERE account_id = ?', [accountId]);
    return row?.on_date ?? null;
  }

  /**
   * Writes one day, unless that day was corrected by hand.
   *
   * `locked` is the same protection a hand-edited movement gets from a
   * re-import: a recompute must never quietly undo a correction. Returns
   * whether the row was actually written, so a recompute can report what it
   * left alone.
   */
  async putDay(day: Omit<YieldDay, 'actual_net_minor' | 'locked' | 'computed_at'> & {
    actual_net_minor?: number | null;
  }): Promise<boolean> {
    const existing = await this.db.queryOne<{ locked: 0 | 1 }>(
      'SELECT locked FROM yield_days WHERE pocket_id = ? AND component = ? AND on_date = ?',
      [day.pocket_id, day.component, day.on_date]);
    if (existing?.locked === 1) return false;

    await this.db.run(
      `INSERT INTO yield_days
         (pocket_id, account_id, component, payout, on_date, balance_minor, annual_rate_scaled,
          gross_minor, withholding_minor, net_minor, actual_net_minor, withholding_unknown,
          locked, computed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
       ON CONFLICT(pocket_id, component, on_date) DO UPDATE SET
         balance_minor       = excluded.balance_minor,
         annual_rate_scaled  = excluded.annual_rate_scaled,
         gross_minor         = excluded.gross_minor,
         withholding_minor   = excluded.withholding_minor,
         net_minor           = excluded.net_minor,
         actual_net_minor    = excluded.actual_net_minor,
         withholding_unknown = excluded.withholding_unknown,
         computed_at         = excluded.computed_at`,
      [
        day.pocket_id, day.account_id, day.component, day.payout, day.on_date,
        day.balance_minor, day.annual_rate_scaled,
        day.gross_minor, day.withholding_minor, day.net_minor,
        day.actual_net_minor ?? null, day.withholding_unknown, this.now(),
      ],
    );
    return true;
  }

  /**
   * Corrects one day by hand and locks it against recomputation.
   *
   * What the app worked out stays in `gross_minor` and `net_minor`; the
   * correction goes to `actual_net_minor`, so the two can be compared later.
   */
  async correctDay(pocketId: number, on: IsoDate, actualNetMinor: number): Promise<void> {
    await this.db.run(
      `UPDATE yield_days
       SET actual_net_minor = ?, locked = 1, computed_at = ?
       WHERE pocket_id = ? AND on_date = ?`,
      [actualNetMinor, this.now(), pocketId, on]);
  }

  async unlockDay(pocketId: number, on: IsoDate): Promise<void> {
    await this.db.run(
      'UPDATE yield_days SET locked = 0 WHERE pocket_id = ? AND on_date = ?',
      [pocketId, on]);
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
    pocket_id?: number | null;
    source?: 'yield' | 'cashback';
    note?: string | null;
  }): Promise<number> {
    const now = this.now();
    const result = await this.db.run(
      `INSERT INTO cushion_adjustments
         (account_id, source, kind, pocket_id, on_date, amount_minor, note, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [input.account_id, input.source ?? 'yield', input.kind ?? 'correction',
       input.pocket_id ?? null, input.on_date,
       input.amount_minor, input.note ?? null, now, now]);
    return result.lastId ?? 0;
  }

  async adjustments(accountId: number): Promise<CushionEntry[]> {
    return this.db.query<CushionEntry>(
      `SELECT id, account_id, source, kind, pocket_id, on_date, amount_minor, note
       FROM cushion_adjustments WHERE account_id = ? ORDER BY on_date, id`,
      [accountId]);
  }

  async removeAdjustment(id: number): Promise<void> {
    await this.db.run('DELETE FROM cushion_adjustments WHERE id = ?', [id]);
  }

  /**
   * Takes money out of the cushion, having become a real movement.
   *
   * The caller creates the movement first and passes its id: the two belong
   * together, and the link is what stops the money being counted twice — once
   * as cushion and once as balance.
   */
  async withdraw(input: {
    account_id: number;
    on_date: IsoDate;
    amount_minor: number;
    transaction_id?: number | null;
    source?: 'yield' | 'cashback';
    note?: string | null;
  }): Promise<number> {
    const result = await this.db.run(
      `INSERT INTO cushion_withdrawals
         (account_id, source, on_date, amount_minor, transaction_id, note, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [input.account_id, input.source ?? 'yield', input.on_date,
       input.amount_minor, input.transaction_id ?? null, input.note ?? null, this.now()]);
    return result.lastId ?? 0;
  }

  async withdrawals(accountId: number): Promise<{
    id: number; account_id: number; source: 'yield' | 'cashback';
    on_date: IsoDate; amount_minor: number; transaction_id: number | null; note: string | null;
  }[]> {
    return this.db.query(
      `SELECT id, account_id, source, on_date, amount_minor, transaction_id, note
       FROM cushion_withdrawals WHERE account_id = ? ORDER BY on_date, id`,
      [accountId]);
  }

  // -------------------------------------------------------------------------
  // What it all adds up to
  // -------------------------------------------------------------------------

  /**
   * The cushion of one account, broken into the four parts it is made of.
   *
   * Returned in pieces rather than as a single figure on purpose: a total
   * nobody can take apart is a total nobody can check. `asOf` lets the same
   * question be asked about an earlier day.
   *
   * A day corrected by hand counts as what the bank paid, not as what the app
   * worked out — that is what `actual_net_minor` is for.
   */
  async cushion(accountId: number, asOf?: IsoDate): Promise<CushionBalance> {
    const upTo = asOf ?? '9999-12-31';

    const account = await this.account(accountId);
    const opening = account?.opening_cushion_minor ?? 0;

    const accrued = await this.db.queryOne<{ net: number | null; unknown: number }>(
      `SELECT SUM(COALESCE(actual_net_minor, net_minor)) AS net,
              SUM(withholding_unknown) AS unknown
       FROM yield_days WHERE account_id = ? AND on_date <= ?`,
      [accountId, upTo]);

    const adjusted = await this.db.queryOne<{ total: number | null }>(
      'SELECT SUM(amount_minor) AS total FROM cushion_adjustments WHERE account_id = ? AND on_date <= ?',
      [accountId, upTo]);

    const withdrawn = await this.db.queryOne<{ total: number | null }>(
      'SELECT SUM(amount_minor) AS total FROM cushion_withdrawals WHERE account_id = ? AND on_date <= ?',
      [accountId, upTo]);

    // What a monthly account has worked out this month is owed, not held.
    // Any earlier month has already ended, so only the current one can be
    // outstanding - and if `upTo` IS the last day of its month, that month
    // has been paid too.
    let pendingMinor = 0;
    let paidOn: IsoDate | null = null;

    // Which part of what has been worked out is still owed is a property of
    // the days themselves: each one knows how its component is paid.
    {
      const day = asOf ?? todayIso();
      const [year, month] = day.split('-').map(Number);
      const monthEnd = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);

      if (day < monthEnd) {
        const owed = await this.db.queryOne<{ net: number | null }>(
          `SELECT SUM(COALESCE(actual_net_minor, net_minor)) AS net
           FROM yield_days
           WHERE account_id = ? AND payout = 'monthly' AND on_date >= ? AND on_date <= ?`,
          [accountId, `${day.slice(0, 7)}-01`, day]);
        pendingMinor = owed?.net ?? 0;
        paidOn = pendingMinor > 0 ? monthEnd : null;
      }
    }

    const accruedMinor = accrued?.net ?? 0;
    const adjustedMinor = adjusted?.total ?? 0;
    const withdrawnMinor = withdrawn?.total ?? 0;

    return {
      account_id: accountId,
      opening_minor: opening,
      accrued_minor: accruedMinor,
      adjusted_minor: adjustedMinor,
      withdrawn_minor: withdrawnMinor,
      totalMinor: opening + accruedMinor + adjustedMinor - withdrawnMinor,
      pendingMinor,
      availableMinor: opening + accruedMinor + adjustedMinor - withdrawnMinor - pendingMinor,
      paidOn,
      daysWithUnknownWithholding: accrued?.unknown ?? 0,
    };
  }

  /** Every enrolled account's cushion, for the screen that lists them. */
  async allCushions(asOf?: IsoDate): Promise<CushionBalance[]> {
    const accounts = await this.accounts();
    const out: CushionBalance[] = [];
    for (const account of accounts) {
      out.push(await this.cushion(account.account_id, asOf));
    }
    return out;
  }
}
