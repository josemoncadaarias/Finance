/**
 * Accounts, and the balances derived from them.
 *
 * A balance is never stored: it is the opening balance plus the sum of the
 * account's transactions, worked out on demand. A stored balance is a second
 * source of truth that drifts out of step with the ledger the first time a
 * write is interrupted.
 */

import type { SqlDriver } from '../sql-driver';
import type { AccountBalance, AccountRow, IsoDate } from '../types';
import { availableCreditMinor } from '../money';

export interface NewAccount {
  name: string;
  type: AccountRow['type'];
  currency_code: string;
  builtin_icon?: string | null;
  custom_icon_id?: number | null;
  color?: string;
  credit_limit_minor?: number | null;
  include_in_net_worth?: boolean;
  opening_balance_minor?: number;
  /** Same amount in the base currency. Defaults to the account-currency value. */
  opening_balance_base_minor?: number;
  opened_on: IsoDate;
  sort_order?: number;
}

export type AccountUpdate = Partial<Omit<NewAccount, 'currency_code'>> & { archived?: boolean };

const COLUMNS = `id, name, type, currency_code, builtin_icon, custom_icon_id, color,
  credit_limit_minor, include_in_net_worth, opening_balance_minor, opening_balance_base_minor, opened_on,
  archived, sort_order, created_at, updated_at`;

export class AccountsRepository {
  private readonly db: SqlDriver;
  private readonly now: () => string;

  constructor(db: SqlDriver, now: () => string = () => new Date().toISOString()) {
    this.db = db;
    this.now = now;
  }

  async list(options: { includeArchived?: boolean } = {}): Promise<AccountRow[]> {
    const where = options.includeArchived ? '' : 'WHERE archived = 0';
    return this.db.query<AccountRow>(
      `SELECT ${COLUMNS} FROM accounts ${where} ORDER BY sort_order, name`,
    );
  }

  async findById(id: number): Promise<AccountRow | null> {
    return this.db.queryOne<AccountRow>(`SELECT ${COLUMNS} FROM accounts WHERE id = ?`, [id]);
  }

  async findByName(name: string): Promise<AccountRow | null> {
    return this.db.queryOne<AccountRow>(`SELECT ${COLUMNS} FROM accounts WHERE name = ?`, [name]);
  }

  async create(account: NewAccount): Promise<number> {
    const timestamp = this.now();
    const result = await this.db.run(
      `INSERT INTO accounts (name, type, currency_code, builtin_icon, custom_icon_id, color,
         credit_limit_minor, include_in_net_worth, opening_balance_minor, opening_balance_base_minor, opened_on,
         sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        account.name,
        account.type,
        account.currency_code,
        account.builtin_icon ?? null,
        account.custom_icon_id ?? null,
        account.color ?? '#607D8B',
        account.credit_limit_minor ?? null,
        account.include_in_net_worth === false ? 0 : 1,
        account.opening_balance_minor ?? 0,
        account.opening_balance_base_minor ?? account.opening_balance_minor ?? 0,
        account.opened_on,
        account.sort_order ?? 0,
        timestamp,
        timestamp,
      ],
    );
    return result.lastId!;
  }

  async update(id: number, changes: AccountUpdate): Promise<void> {
    const columns: string[] = [];
    const values: unknown[] = [];

    const set = (column: string, value: unknown) => {
      columns.push(`${column} = ?`);
      values.push(value);
    };

    if (changes.name !== undefined) set('name', changes.name);
    if (changes.type !== undefined) set('type', changes.type);
    if (changes.color !== undefined) set('color', changes.color);
    if (changes.credit_limit_minor !== undefined) set('credit_limit_minor', changes.credit_limit_minor);
    if (changes.opening_balance_minor !== undefined) set('opening_balance_minor', changes.opening_balance_minor);
    if (changes.opening_balance_base_minor !== undefined) set('opening_balance_base_minor', changes.opening_balance_base_minor);
    if (changes.opened_on !== undefined) set('opened_on', changes.opened_on);
    if (changes.sort_order !== undefined) set('sort_order', changes.sort_order);
    if (changes.include_in_net_worth !== undefined) set('include_in_net_worth', changes.include_in_net_worth ? 1 : 0);
    if (changes.archived !== undefined) set('archived', changes.archived ? 1 : 0);

    // The two icon columns move together: setting one clears the other, so the
    // schema's "exactly one" rule cannot be broken by a partial update.
    if (changes.builtin_icon !== undefined || changes.custom_icon_id !== undefined) {
      const builtin = changes.builtin_icon ?? null;
      const custom = changes.custom_icon_id ?? null;
      if ((builtin === null) === (custom === null)) {
        throw new Error('An account needs exactly one of builtin_icon or custom_icon_id');
      }
      set('builtin_icon', builtin);
      set('custom_icon_id', custom);
    }

    if (columns.length === 0) {
      return;
    }

    set('updated_at', this.now());
    values.push(id);
    await this.db.run(`UPDATE accounts SET ${columns.join(', ')} WHERE id = ?`, values);
  }

  /**
   * Archiving, not deleting, is what the UI should offer: an account with
   * history cannot be removed without taking the history with it, and the
   * schema refuses on purpose.
   */
  async archive(id: number): Promise<void> {
    await this.update(id, { archived: true });
  }

  async balance(id: number): Promise<AccountBalance | null> {
    const balances = await this.balances({ accountId: id, includeArchived: true });
    return balances.length > 0 ? balances[0] : null;
  }

  /**
   * Balances for every account, in one query rather than one per account.
   * `asOf` gives the balance as it stood at the end of that day, which is what
   * a report for a past month needs.
   */
  async balances(options: { accountId?: number; asOf?: IsoDate; includeArchived?: boolean } = {}): Promise<AccountBalance[]> {
    const conditions: string[] = [];
    const values: unknown[] = [];

    if (options.asOf) {
      // The date filter belongs to the join, not to WHERE: in WHERE it would
      // drop accounts that had no movement yet, instead of showing them at
      // their opening balance.
      values.push(options.asOf);
    }
    if (!options.includeArchived) {
      conditions.push('a.archived = 0');
    }
    if (options.accountId !== undefined) {
      conditions.push('a.id = ?');
      values.push(options.accountId);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const dateFilter = options.asOf ? 'AND t.occurred_on <= ?' : '';

    const rows = await this.db.query<AccountRow & { balance_minor: number }>(
      `SELECT ${COLUMNS.split(',').map(c => `a.${c.trim()}`).join(', ')},
              a.opening_balance_minor + COALESCE(SUM(t.amount_minor), 0) AS balance_minor
       FROM accounts a
       LEFT JOIN transactions t ON t.account_id = a.id ${dateFilter}
       ${where}
       GROUP BY a.id
       ORDER BY a.sort_order, a.name`,
      values,
    );

    return rows.map(row => {
      const { balance_minor, ...account } = row;
      return {
        account: account as AccountRow,
        balance_minor,
        available_credit_minor:
          account.type === 'credit' && account.credit_limit_minor !== null
            ? availableCreditMinor(account.credit_limit_minor, balance_minor)
            : null,
      };
    });
  }

  /**
   * Net worth in the base currency, from the frozen base amounts rather than
   * from today's rate. Accounts flagged out of net worth are left out;
   * credit-card debt is already negative, so it subtracts on its own.
   */
  async netWorthMinor(asOf?: IsoDate): Promise<number> {
    const dateFilter = asOf ? 'AND t.occurred_on <= ?' : '';
    const row = await this.db.queryOne<{ total: number | null }>(
      `SELECT SUM(a.opening_balance_base_minor + COALESCE(base.total, 0)) AS total
       FROM accounts a
       LEFT JOIN (
         SELECT t.account_id, SUM(t.amount_base_minor) AS total
         FROM transactions t
         WHERE 1 = 1 ${dateFilter}
         GROUP BY t.account_id
       ) base ON base.account_id = a.id
       WHERE a.include_in_net_worth = 1 AND a.archived = 0`,
      asOf ? [asOf] : [],
    );
    return row?.total ?? 0;
  }
}
