/**
 * Multi-currency accounts.
 *
 * A group is one account the user actually has — Global66, ARQ — and the rows
 * in `accounts` that point at it are the currencies it holds. The group carries
 * no balance of its own: adding 500 USD to 300 EUR is not a number, and the
 * rate to use for such a total is a decision for whoever is asking.
 */

import type { SqlDriver } from '../sql-driver';
import type { AccountGroupRow, AccountRow } from '../types';

export interface NewAccountGroup {
  name: string;
  builtin_icon?: string | null;
  custom_icon_id?: number | null;
  color?: string;
  sort_order?: number;
}

export type AccountGroupUpdate = Partial<NewAccountGroup>;

const COLUMNS = `id, name, builtin_icon, custom_icon_id, color, sort_order, created_at, updated_at`;

export class AccountGroupsRepository {
  private readonly db: SqlDriver;
  private readonly now: () => string;

  constructor(db: SqlDriver, now: () => string = () => new Date().toISOString()) {
    this.db = db;
    this.now = now;
  }

  async list(): Promise<AccountGroupRow[]> {
    return this.db.query<AccountGroupRow>(
      `SELECT ${COLUMNS} FROM account_groups ORDER BY sort_order, name`,
    );
  }

  async findById(id: number): Promise<AccountGroupRow | null> {
    return this.db.queryOne<AccountGroupRow>(`SELECT ${COLUMNS} FROM account_groups WHERE id = ?`, [id]);
  }

  async findByName(name: string): Promise<AccountGroupRow | null> {
    return this.db.queryOne<AccountGroupRow>(`SELECT ${COLUMNS} FROM account_groups WHERE name = ?`, [name]);
  }

  async create(group: NewAccountGroup): Promise<number> {
    const timestamp = this.now();
    const result = await this.db.run(
      `INSERT INTO account_groups (name, builtin_icon, custom_icon_id, color, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        group.name,
        group.builtin_icon ?? null,
        group.custom_icon_id ?? null,
        group.color ?? '#607D8B',
        group.sort_order ?? 0,
        timestamp,
        timestamp,
      ],
    );
    return result.lastId!;
  }

  async update(id: number, changes: AccountGroupUpdate): Promise<void> {
    const columns: string[] = [];
    const values: unknown[] = [];

    const set = (column: string, value: unknown) => {
      columns.push(`${column} = ?`);
      values.push(value);
    };

    if (changes.name !== undefined) set('name', changes.name);
    if (changes.color !== undefined) set('color', changes.color);
    if (changes.sort_order !== undefined) set('sort_order', changes.sort_order);

    if (changes.builtin_icon !== undefined || changes.custom_icon_id !== undefined) {
      const builtin = changes.builtin_icon ?? null;
      const custom = changes.custom_icon_id ?? null;
      if ((builtin === null) === (custom === null)) {
        throw new Error('An account group needs exactly one of builtin_icon or custom_icon_id');
      }
      set('builtin_icon', builtin);
      set('custom_icon_id', custom);
    }

    if (columns.length === 0) return;

    set('updated_at', this.now());
    values.push(id);
    await this.db.run(`UPDATE account_groups SET ${columns.join(', ')} WHERE id = ?`, values);
  }

  /** The currency rows belonging to this group. */
  async currenciesOf(id: number): Promise<AccountRow[]> {
    return this.db.query<AccountRow>(
      `SELECT * FROM accounts WHERE group_id = ? AND archived = 0 ORDER BY currency_code`,
      [id],
    );
  }

  /**
   * Deleting a group leaves its accounts in place, ungrouped. Their history is
   * untouched — the grouping is a presentation concern, not the money.
   */
  async delete(id: number): Promise<void> {
    await this.db.run('DELETE FROM account_groups WHERE id = ?', [id]);
  }
}
