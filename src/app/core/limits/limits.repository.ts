/**
 * Spending limits written and read (migration 053), and the movements they
 * count, read once for every limit.
 *
 * What a limit has spent is worked out by `limits.ts`; this only fetches.
 */

import type { SqlDriver } from '../database/sql-driver';
import type { LimitTerms, SpendRow } from './limits';

export interface LimitInput {
  amountMinor: number;
  accountId: number | null;
  warnAt80: boolean;
  categoryIds: readonly number[];
}

/** Which notices the person wants (`14p`): kept in `settings`, so they travel in the backup. */
export interface LimitNotices {
  /** The sheet when a saved movement takes a limit or the total past it. */
  atSave: boolean;
  /** The phone's own notification. */
  phone: boolean;
  /** The notification at 80 %. */
  at80: boolean;
}

const NOTICE_KEYS: Record<keyof LimitNotices, string> = {
  atSave: 'limits.notice.atSave',
  phone: 'limits.notice.phone',
  at80: 'limits.notice.at80',
};

interface SpendSql {
  id: number;
  category_id: number;
  account_id: number;
  type: string;
  include_in_net_worth: number;
  occurred_on: string;
  amount_base_minor: number;
  description: string | null;
}

export class LimitsRepository {
  private readonly db: SqlDriver;
  private readonly now: () => string;

  constructor(db: SqlDriver, now: () => string = () => new Date().toISOString()) {
    this.db = db;
    this.now = now;
  }

  async all(): Promise<LimitTerms[]> {
    const limits = await this.db.query<{ id: number; amount_minor: number; account_id: number | null; warn_at_80: number }>(
      'SELECT id, amount_minor, account_id, warn_at_80 FROM spending_limits ORDER BY id');
    const links = await this.db.query<{ limit_id: number; category_id: number }>(
      'SELECT limit_id, category_id FROM spending_limit_categories ORDER BY limit_id, category_id');
    return limits.map(row => ({
      id: row.id,
      amountMinor: row.amount_minor,
      accountId: row.account_id,
      warnAt80: row.warn_at_80 === 1,
      categoryIds: links.filter(link => link.limit_id === row.id).map(link => link.category_id),
    }));
  }

  async create(input: LimitInput): Promise<number> {
    return this.db.transaction(async () => {
      const at = this.now();
      const { lastId } = await this.db.run(
        `INSERT INTO spending_limits (amount_minor, period, account_id, warn_at_80, created_at, updated_at)
         VALUES (?, 'month', ?, ?, ?, ?)`,
        [input.amountMinor, input.accountId, input.warnAt80 ? 1 : 0, at, at]);
      const id = Number(lastId);
      await this.link(id, input.categoryIds);
      return id;
    });
  }

  async update(id: number, input: LimitInput): Promise<void> {
    await this.db.transaction(async () => {
      await this.db.run(
        'UPDATE spending_limits SET amount_minor = ?, account_id = ?, warn_at_80 = ?, updated_at = ? WHERE id = ?',
        [input.amountMinor, input.accountId, input.warnAt80 ? 1 : 0, this.now(), id]);
      await this.db.run('DELETE FROM spending_limit_categories WHERE limit_id = ?', [id]);
      await this.link(id, input.categoryIds);
    });
  }

  /** Only the figure: "Usar" on a limit's page. */
  async setAmount(id: number, amountMinor: number): Promise<void> {
    await this.db.run('UPDATE spending_limits SET amount_minor = ?, updated_at = ? WHERE id = ?', [amountMinor, this.now(), id]);
  }

  async remove(id: number): Promise<void> {
    await this.db.run('DELETE FROM spending_limits WHERE id = ?', [id]);
  }

  private async link(id: number, categoryIds: readonly number[]): Promise<void> {
    if (categoryIds.length === 0) throw new Error('A limit needs at least one category');
    for (const category of new Set(categoryIds)) {
      await this.db.run('INSERT INTO spending_limit_categories (limit_id, category_id) VALUES (?, ?)', [id, category]);
    }
  }

  /**
   * Every movement under the given categories (every limit's when none are
   * given) from `since`: one query for all of them. Transfers never.
   */
  async rows(since: string, categoryIds?: readonly number[]): Promise<SpendRow[]> {
    const which = categoryIds
      ? `t.category_id IN (${categoryIds.map(() => '?').join(', ') || 'NULL'})`
      : 't.category_id IN (SELECT category_id FROM spending_limit_categories)';
    const rows = await this.db.query<SpendSql>(
      `SELECT t.id, t.category_id, t.account_id, a.type, a.include_in_net_worth,
              t.occurred_on, t.amount_base_minor, t.description
         FROM transactions t JOIN accounts a ON a.id = t.account_id
        WHERE t.transfer_id IS NULL AND t.occurred_on >= ? AND ${which}`,
      [since, ...(categoryIds ?? [])]);
    return rows.map(row => ({
      id: row.id,
      categoryId: row.category_id,
      accountId: row.account_id,
      accountType: row.type,
      inNetWorth: row.include_in_net_worth === 1,
      occurredOn: row.occurred_on,
      amountMinor: row.amount_base_minor,
      description: row.description,
    }));
  }

  async notices(): Promise<LimitNotices> {
    const rows = await this.db.query<{ key: string; value: string }>(
      `SELECT key, value FROM settings WHERE key LIKE 'limits.notice.%'`);
    const set = new Map(rows.map(row => [row.key, row.value]));
    const read = (key: keyof LimitNotices) => set.get(NOTICE_KEYS[key]) !== '0';
    return { atSave: read('atSave'), phone: read('phone'), at80: read('at80') };
  }

  async setNotice(key: keyof LimitNotices, on: boolean): Promise<void> {
    await this.db.run(
      `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      [NOTICE_KEYS[key], on ? '1' : '0', this.now()]);
  }
}
