/**
 * The credit limit of a card, and how it got there.
 *
 * A limit change is not a movement: no money changes hands, the debt stays
 * exactly where it was, and only the room left over moves. That is why it
 * lives here and never in `transactions` — recording it as a deposit is what
 * made Monefy report a card balance that was 300,000 off.
 *
 * `accounts.credit_limit_minor` stays the limit in force today, because that
 * is what available credit is computed from on every screen. This table is the
 * history behind that number, and the two are kept in step here: setting a
 * limit writes the history row and, when that row is the most recent one,
 * updates the account as well.
 */

import type { SqlDriver } from '../sql-driver';
import type { IsoDate } from '../types';

export interface CreditLimitChange {
  id: number;
  account_id: number;
  limit_minor: number;
  effective_on: IsoDate;
  note: string | null;
  source: 'manual' | 'import';
  created_at: string;
}

export interface NewCreditLimit {
  account_id: number;
  /** The limit as of `effective_on`, not the size of the change. */
  limit_minor: number;
  effective_on: IsoDate;
  note?: string | null;
  source?: 'manual' | 'import';
}

const COLUMNS = 'id, account_id, limit_minor, effective_on, note, source, created_at';

export class CreditLimitsRepository {
  private readonly db: SqlDriver;
  private readonly now: () => string;

  constructor(db: SqlDriver, now: () => string = () => new Date().toISOString()) {
    this.db = db;
    this.now = now;
  }

  /** Every limit this card has had, oldest first. */
  async history(accountId: number): Promise<CreditLimitChange[]> {
    return this.db.query<CreditLimitChange>(
      `SELECT ${COLUMNS} FROM credit_limit_changes
       WHERE account_id = ?
       ORDER BY effective_on, id`,
      [accountId],
    );
  }

  /** The limit in force on a given day, or null if the card had none yet. */
  async limitOn(accountId: number, on: IsoDate): Promise<number | null> {
    const row = await this.db.queryOne<{ limit_minor: number }>(
      `SELECT limit_minor FROM credit_limit_changes
       WHERE account_id = ? AND effective_on <= ?
       ORDER BY effective_on DESC, id DESC
       LIMIT 1`,
      [accountId, on],
    );
    return row?.limit_minor ?? null;
  }

  /**
   * Records a limit, up or down — the two are the same act, so there is one
   * way to do both.
   *
   * Stating a limit for a day that already has one replaces it: a day cannot
   * end with two different limits, and correcting a typo should not leave the
   * wrong figure behind next to the right one.
   */
  async set(change: NewCreditLimit): Promise<void> {
    await this.db.run(
      `INSERT INTO credit_limit_changes
         (account_id, limit_minor, effective_on, note, source, created_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(account_id, effective_on) DO UPDATE SET
         limit_minor = excluded.limit_minor,
         note = excluded.note,
         source = excluded.source`,
      [
        change.account_id,
        change.limit_minor,
        change.effective_on,
        change.note ?? null,
        change.source ?? 'manual',
        this.now(),
      ],
    );

    await this.syncAccount(change.account_id);
  }

  /**
   * Adds a limit only if that day has no answer yet, and leaves the limit in
   * force alone.
   *
   * What the import uses. Re-running it must not overwrite a figure the user
   * corrected by hand, and the backup states the same changes every time. It
   * deliberately does not touch `accounts.credit_limit_minor`: a backup can be
   * missing a change — the exported file may only reach as far as the opening
   * 800,000 while the card is really at 1,100,000 — and the confirmed limit
   * must win over a history reconstructed from it. When the two disagree the
   * import raises `credit_limit_mismatch` rather than quietly choosing.
   */
  async addIfMissing(change: NewCreditLimit): Promise<boolean> {
    const result = await this.db.run(
      `INSERT INTO credit_limit_changes
         (account_id, limit_minor, effective_on, note, source, created_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(account_id, effective_on) DO NOTHING`,
      [
        change.account_id,
        change.limit_minor,
        change.effective_on,
        change.note ?? null,
        change.source ?? 'import',
        this.now(),
      ],
    );

    return (result.changes ?? 0) > 0;
  }

  async remove(id: number): Promise<void> {
    const row = await this.db.queryOne<{ account_id: number }>(
      'SELECT account_id FROM credit_limit_changes WHERE id = ?',
      [id],
    );
    if (!row) return;

    await this.db.run('DELETE FROM credit_limit_changes WHERE id = ?', [id]);
    await this.syncAccount(row.account_id);
  }

  /**
   * Copies the newest limit onto the account.
   *
   * A change dated in the future is not in force yet, so it is not copied —
   * someone can enter next month's increase the day the bank tells them, and
   * the available credit shown today stays honest.
   */
  private async syncAccount(accountId: number): Promise<void> {
    const current = await this.limitOn(accountId, todayIso());
    if (current === null) return;

    await this.db.run(
      'UPDATE accounts SET credit_limit_minor = ?, updated_at = ? WHERE id = ? AND type = ?',
      [current, this.now(), accountId, 'credit'],
    );
  }
}

function todayIso(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}
