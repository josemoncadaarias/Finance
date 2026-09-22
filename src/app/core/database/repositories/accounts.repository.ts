/**
 * Accounts, and the balances derived from them.
 *
 * A balance is never stored: it is the opening balance plus the sum of the
 * account's transactions, worked out on demand. A stored balance is a second
 * source of truth that drifts out of step with the ledger the first time a
 * write is interrupted.
 */

import type { SqlDriver } from '../sql-driver';
import type { AccountBalance, AccountGroupRow, AccountRow, GroupedBalance, IsoDate } from '../types';
import { RatesRepository, convertAt, type Rate } from './rates.repository';

/** Everything is valued against the peso; that is the currency Jose lives in. */
const BASE_CURRENCY = 'COP';

/**
 * One account's contribution to net worth.
 *
 * `baseMinor` is null when the account holds a currency with no rate on
 * record: the balance is real, its peso value is simply unknown, and inventing
 * one would be worse than saying so.
 */
export interface NetWorthLine {
  account_id: number;
  name: string;
  currency_code: string;
  balance_minor: number;
  rate: Rate | null;
  baseMinor: number | null;
}

export interface NetWorth {
  totalMinor: number;
  asOf: IsoDate;
  lines: NetWorthLine[];
  /** Currencies holding money that could not be valued. */
  missingRatesFor: string[];
}
import { availableCreditMinor } from '../money';

export interface NewAccount {
  name: string;
  type: AccountRow['type'];
  currency_code: string;
  group_id?: number | null;
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

/**
 * A movement that counts as the account's own money: it names no product, or a
 * product that has not been set outside net worth. Written against `t`.
 */
const COUNTED_MOVEMENT = `(t.product_id IS NULL OR t.product_id NOT IN
  (SELECT id FROM products WHERE include_in_net_worth = 0))`;

/** How a balance treats the products set outside net worth. */
export interface SetAsideOption {
  /**
   * True: their movements are left off, the balance a summary shows. False or
   * absent: every movement counts, the balance the bank shows - which is what
   * the yields screen compares its products against.
   */
  leaveOutSetAside?: boolean;
}

const COLUMNS = `id, name, type, currency_code, group_id, builtin_icon, custom_icon_id, color,
  credit_limit_minor, include_in_net_worth, opening_balance_minor, opening_balance_base_minor, opened_on,
  archived, sort_order, created_at, updated_at`;

export class AccountsRepository {
  /**
   * The account a backup calls by this name, when it is not called that here.
   *
   * The importer matches on the exact name the file carries, so renaming an
   * account inside the app made the next import stop recognising it and
   * create a second one. Renaming is a normal thing to do; remembering the
   * old name is what makes it survivable.
   */
  async findBySourceName(name: string): Promise<AccountRow | null> {
    return this.db.queryOne<AccountRow>(
      `SELECT a.* FROM accounts a
       JOIN account_aliases alias ON alias.account_id = a.id
       WHERE lower(alias.source_name) = lower(?)`,
      [name]);
  }

  /**
   * Records that a backup still calls this account something else.
   *
   * Called when a name changes, so the alias is a by-product of renaming
   * rather than something to remember to do. Ignored when the name is already
   * the account's own, and when another account already claims it - an alias
   * is a name pointing at one account and nothing good comes of two.
   */
  async rememberSourceName(accountId: number, name: string): Promise<void> {
    const now = this.now();
    await this.db.run(
      `INSERT INTO account_aliases (source_name, account_id, note, created_at, updated_at)
       VALUES (?, ?, NULL, ?, ?)
       ON CONFLICT(source_name) DO NOTHING`,
      [name, accountId, now, now]);
  }

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

  /**
   * How many movements each account carries, for ordering a picker by use.
   *
   * One query rather than one per account: on the phone each call crosses
   * into the native side, and a picker has to open at once.
   */
  async timesUsed(): Promise<Map<number, number>> {
    const rows = await this.db.query<{ account_id: number; times: number }>(
      'SELECT account_id, COUNT(*) AS times FROM transactions GROUP BY account_id',
    );
    return new Map(rows.map(row => [row.account_id, row.times]));
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
      `INSERT INTO accounts (name, type, currency_code, group_id, builtin_icon, custom_icon_id, color,
         credit_limit_minor, include_in_net_worth, opening_balance_minor, opening_balance_base_minor, opened_on,
         sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        account.name,
        account.type,
        account.currency_code,
        account.group_id ?? null,
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

  /**
   * Removes an account and everything that belonged to it.
   *
   * Every table that points at an account cascades except one:
   * `transactions.account_id` is ON DELETE RESTRICT, so an account with
   * movements cannot be deleted at all until they are gone. That rule is
   * right — deleting an account must never quietly delete money — and it
   * makes this a deliberate act rather than a side effect, which is why it
   * lives in its own method and asks for confirmation before it is called.
   *
   * Three things have to happen before the account itself:
   *
   * A transfer is two legs in two accounts, and deleting one of them would
   * leave the other describing money that came from nowhere. The whole
   * transfer goes.
   *
   * Every fingerprint is recorded in `deleted_imports`, so the next import of
   * the backup does not meet these rows as new and build the account all over
   * again. That is the same rule a deleted movement already follows, and
   * without it deleting an imported account is undone by the next import.
   *
   * Then the movements, then the account, and the cascades take the rest.
   */
  async deleteWithHistory(id: number): Promise<void> {
    await this.db.transaction(async () => {
      const now = this.now();

      // Both ends of any transfer this account is one end of.
      const transfers = await this.db.query<{ transfer_id: number }>(
        'SELECT DISTINCT transfer_id FROM transactions WHERE account_id = ? AND transfer_id IS NOT NULL',
        [id]);

      for (const { transfer_id } of transfers) {
        await this.db.run(
          `INSERT INTO deleted_imports (import_fingerprint, import_seq, deleted_at)
           SELECT import_fingerprint, import_seq, ?
           FROM transactions
           WHERE transfer_id = ? AND import_fingerprint IS NOT NULL
           ON CONFLICT(import_fingerprint, import_seq) DO NOTHING`,
          [now, transfer_id]);
        await this.db.run('DELETE FROM transactions WHERE transfer_id = ?', [transfer_id]);
        await this.db.run('DELETE FROM transfers WHERE id = ?', [transfer_id]);
      }

      await this.db.run(
        `INSERT INTO deleted_imports (import_fingerprint, import_seq, deleted_at)
         SELECT import_fingerprint, import_seq, ?
         FROM transactions
         WHERE account_id = ? AND import_fingerprint IS NOT NULL
         ON CONFLICT(import_fingerprint, import_seq) DO NOTHING`,
        [now, id]);

      await this.db.run('DELETE FROM transactions WHERE account_id = ?', [id]);
      await this.db.run('DELETE FROM accounts WHERE id = ?', [id]);
    });
  }

  /** How much would be lost, for the question asked before deleting. */
  async movementCount(id: number): Promise<number> {
    const row = await this.db.queryOne<{ total: number }>(
      'SELECT COUNT(*) AS total FROM transactions WHERE account_id = ?', [id]);
    return row?.total ?? 0;
  }

  async update(id: number, changes: AccountUpdate): Promise<void> {
    // A rename keeps the old name as an alias, so the next import still knows
    // where this account's history goes. Done here rather than at the call
    // site because there is more than one way to rename an account and only
    // one of them has to be remembered - all of them come through here.
    if (changes.name !== undefined) {
      const before = await this.findById(id);
      if (before && before.name !== changes.name) {
        await this.rememberSourceName(id, before.name);
      }
    }

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
    if (changes.group_id !== undefined) set('group_id', changes.group_id);
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

  async balance(id: number, options: SetAsideOption = {}): Promise<AccountBalance | null> {
    const balances = await this.balances({ ...options, accountId: id, includeArchived: true });
    return balances.length > 0 ? balances[0] : null;
  }

  /**
   * Balances for every account, in one query rather than one per account.
   * `asOf` gives the balance as it stood at the end of that day, which is what
   * a report for a past month needs.
   */
  async balances(
    options: { accountId?: number; asOf?: IsoDate; includeArchived?: boolean } & SetAsideOption = {},
  ): Promise<AccountBalance[]> {
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
    const setAsideFilter = options.leaveOutSetAside ? `AND ${COUNTED_MOVEMENT}` : '';

    const rows = await this.db.query<AccountRow & { balance_minor: number }>(
      `SELECT ${COLUMNS.split(',').map(c => `a.${c.trim()}`).join(', ')},
              a.opening_balance_minor + COALESCE(SUM(t.amount_minor), 0) AS balance_minor
       FROM accounts a
       LEFT JOIN transactions t ON t.account_id = a.id ${dateFilter} ${setAsideFilter}
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
   * The same balances, gathered by multi-currency account.
   *
   * Global66 comes back once with its COP and USD balances side by side, ARQ
   * with its USD and EUR. Single-currency accounts come back under a null
   * group, one balance each.
   *
   * There is no total per group on purpose: 500 USD and 300 EUR do not add up
   * without choosing a rate, and choosing it is the caller's decision.
   */
  async balancesByGroup(
    options: { asOf?: IsoDate; includeArchived?: boolean } & SetAsideOption = {},
  ): Promise<GroupedBalance[]> {
    const balances = await this.balances(options);
    const groups = await this.db.query<AccountGroupRow>(
      `SELECT id, name, builtin_icon, custom_icon_id, color, sort_order, created_at, updated_at
       FROM account_groups ORDER BY sort_order, name`,
    );
    const groupsById = new Map(groups.map(group => [group.id, group]));

    const grouped: GroupedBalance[] = [];
    const byGroupId = new Map<number, GroupedBalance>();

    for (const balance of balances) {
      const groupId = balance.account.group_id;

      // An ungrouped account stands alone rather than being lumped in with
      // every other ungrouped one.
      if (groupId === null) {
        grouped.push({ group: null, balances: [balance] });
        continue;
      }

      const existing = byGroupId.get(groupId);
      if (existing) {
        existing.balances.push(balance);
      } else {
        const entry: GroupedBalance = { group: groupsById.get(groupId) ?? null, balances: [balance] };
        byGroupId.set(groupId, entry);
        grouped.push(entry);
      }
    }

    return grouped;
  }

  /**
   * Net worth in the base currency, from the frozen base amounts rather than
   * from today's rate. Accounts flagged out of net worth are left out;
   * credit-card debt is already negative, so it subtracts on its own.
   */
  /**
   * What everything is worth today, in pesos.
   *
   * Deliberately **not** the sum of each movement's historical peso value.
   * Those rates answer "what did this cost me", which is a different question
   * and stays where it belongs, on the movements. Net worth asks "what do I
   * have", and two thousand dollars bought across five years at five different
   * rates are still two thousand dollars — worth what a dollar is worth now.
   *
   * A currency with no rate on record is **not** guessed at. Its accounts are
   * left out of the total and reported separately, so a missing rate shows up
   * as a question rather than as a wrong number.
   *
   * A product set outside net worth - a CDT holding the tax money - is left
   * out with its movements, so the transfer that fed it reads as money gone.
   */
  async netWorth(options: { asOf?: IsoDate } = {}): Promise<NetWorth> {
    const asOf = options.asOf ?? todayIso();

    const rows = await this.db.query<{
      account_id: number;
      name: string;
      currency_code: string;
      balance_minor: number;
    }>(
      `SELECT a.id AS account_id, a.name, a.currency_code,
              a.opening_balance_minor + COALESCE(own.total, 0) AS balance_minor
       FROM accounts a
       LEFT JOIN (
         SELECT t.account_id, SUM(t.amount_minor) AS total
         FROM transactions t
         WHERE t.occurred_on <= ? AND ${COUNTED_MOVEMENT}
         GROUP BY t.account_id
       ) own ON own.account_id = a.id
       WHERE a.include_in_net_worth = 1 AND a.archived = 0`,
      [asOf],
    );

    const rates = await new RatesRepository(this.db).allInForce(BASE_CURRENCY, asOf);

    const lines: NetWorthLine[] = [];
    let totalMinor = 0;
    const missing = new Set<string>();

    for (const row of rows) {
      if (row.currency_code === BASE_CURRENCY) {
        lines.push({ ...row, rate: null, baseMinor: row.balance_minor });
        totalMinor += row.balance_minor;
        continue;
      }

      const rate = rates.get(row.currency_code) ?? null;
      if (rate === null) {
        // Nothing to convert it with. Shown, counted by nobody.
        lines.push({ ...row, rate: null, baseMinor: null });
        if (row.balance_minor !== 0) missing.add(row.currency_code);
        continue;
      }

      const baseMinor = convertAt(row.balance_minor, rate.rate_scaled);
      lines.push({ ...row, rate, baseMinor });
      totalMinor += baseMinor;
    }

    lines.sort((a, b) => (b.baseMinor ?? 0) - (a.baseMinor ?? 0));

    return { totalMinor, asOf, lines, missingRatesFor: [...missing].sort() };
  }

  /** Just the figure, for screens that only show the total. */
  async netWorthMinor(asOf?: IsoDate): Promise<number> {
    return (await this.netWorth({ asOf })).totalMinor;
  }
}

/** Today as an ISO day, in local time. */
function todayIso(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}
