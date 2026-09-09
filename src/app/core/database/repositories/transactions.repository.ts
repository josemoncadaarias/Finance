/**
 * Transactions, including the two legs that make up a transfer.
 *
 * Two rules this repository enforces on top of the schema:
 *
 *   - Editing an imported row sets `locked`, so a later re-import leaves it
 *     alone. That is the point of editing it: the hand-corrected version is
 *     the true one.
 *   - `amount_base_minor` is derived once, on write, from the rate that
 *     applied then. Nothing recomputes it afterwards.
 */

import type { SqlDriver } from '../sql-driver';
import type { Confidence, IsoDate, RateSource, TransactionRow, TransactionSource, TransferLeg } from '../types';
import { convertToBaseMinor } from '../money';

export interface NewTransaction {
  account_id: number;
  category_id: number | null;
  occurred_on: IsoDate;
  amount_minor: number;
  /** Omit on a base-currency transaction. */
  rate_scaled?: number | null;
  /**
   * The base-currency equivalent. Derived from `rate_scaled` when left out,
   * and equal to `amount_minor` when there is no rate at all.
   */
  amount_base_minor?: number;
  rate_source?: RateSource | null;
  confidence?: Confidence;
  description?: string | null;
  transfer_id?: number | null;
  transfer_leg?: TransferLeg | null;
  source?: TransactionSource;
  import_fingerprint?: string | null;
  import_seq?: number | null;
  import_batch_id?: number | null;
  locked?: boolean;
}

export interface TransactionFilter {
  accountId?: number;
  categoryId?: number;
  /** Inclusive. */
  from?: IsoDate;
  /** Inclusive. */
  to?: IsoDate;
  confidence?: Confidence;
  source?: TransactionSource;
  /** Leave out transfer legs, which is what a spending report wants. */
  excludeTransfers?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
}

/** A movement with everything a screen needs, fetched in one query. */
export interface DetailedTransaction extends TransactionRow {
  account_name: string;
  currency_code: string;
  account_archived: number;
  account_type: string;
  category_name: string | null;
  category_icon: string | null;
  /** The other side of a transfer, for labelling it. Null otherwise. */
  other_account_name: string | null;
  /** The far account's id, so a caller can tell inside a scope from outside. */
  other_account_id: number | null;
}

export interface DetailedFilter {
  /** Accounts in scope. Empty or absent means every account. */
  accountIds?: readonly number[];
  from?: IsoDate;
  to?: IsoDate;
  /** Leave out transfer legs, which is what "all accounts" wants. */
  excludeTransfers?: boolean;
}

const COLUMNS = `id, account_id, category_id, occurred_on, amount_minor, rate_scaled,
  amount_base_minor, rate_source, confidence, description, transfer_id, transfer_leg,
  source, import_fingerprint, import_seq, import_batch_id, locked, created_at, updated_at`;

/** Fields a user can edit. Touching any of them locks the row. */
const EDITABLE = [
  'account_id', 'category_id', 'occurred_on', 'amount_minor', 'rate_scaled',
  'amount_base_minor', 'rate_source', 'confidence', 'description',
] as const;

export type TransactionUpdate = Partial<Pick<NewTransaction, (typeof EDITABLE)[number]>>;

export class TransactionsRepository {
  private readonly db: SqlDriver;
  private readonly now: () => string;

  constructor(db: SqlDriver, now: () => string = () => new Date().toISOString()) {
    this.db = db;
    this.now = now;
  }

  async findById(id: number): Promise<TransactionRow | null> {
    return this.db.queryOne<TransactionRow>(`SELECT ${COLUMNS} FROM transactions WHERE id = ?`, [id]);
  }

  async list(filter: TransactionFilter = {}): Promise<TransactionRow[]> {
    const conditions: string[] = [];
    const values: unknown[] = [];

    if (filter.accountId !== undefined) {
      conditions.push('account_id = ?');
      values.push(filter.accountId);
    }
    if (filter.categoryId !== undefined) {
      conditions.push('category_id = ?');
      values.push(filter.categoryId);
    }
    if (filter.from) {
      conditions.push('occurred_on >= ?');
      values.push(filter.from);
    }
    if (filter.to) {
      conditions.push('occurred_on <= ?');
      values.push(filter.to);
    }
    if (filter.confidence) {
      conditions.push('confidence = ?');
      values.push(filter.confidence);
    }
    if (filter.source) {
      conditions.push('source = ?');
      values.push(filter.source);
    }
    if (filter.excludeTransfers) {
      conditions.push('transfer_id IS NULL');
    }
    if (filter.search) {
      conditions.push('description LIKE ?');
      values.push(`%${filter.search}%`);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    // Newest first, with id as a tiebreaker so paging cannot repeat or skip a
    // row when several share a date.
    let sql = `SELECT ${COLUMNS} FROM transactions ${where} ORDER BY occurred_on DESC, id DESC`;

    if (filter.limit !== undefined) {
      sql += ' LIMIT ?';
      values.push(filter.limit);
      if (filter.offset !== undefined) {
        sql += ' OFFSET ?';
        values.push(filter.offset);
      }
    }

    return this.db.query<TransactionRow>(sql, values);
  }

  async create(transaction: NewTransaction): Promise<number> {
    const timestamp = this.now();
    const result = await this.db.run(
      `INSERT INTO transactions (account_id, category_id, occurred_on, amount_minor, rate_scaled,
         amount_base_minor, rate_source, confidence, description, transfer_id, transfer_leg,
         source, import_fingerprint, import_seq, import_batch_id, locked, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        transaction.account_id,
        transaction.category_id ?? null,
        transaction.occurred_on,
        transaction.amount_minor,
        transaction.rate_scaled ?? null,
        baseAmountOf(transaction),
        transaction.rate_source ?? null,
        transaction.confidence ?? 'high',
        transaction.description ?? null,
        transaction.transfer_id ?? null,
        transaction.transfer_leg ?? null,
        transaction.source ?? 'manual',
        transaction.import_fingerprint ?? null,
        transaction.import_seq ?? null,
        transaction.import_batch_id ?? null,
        transaction.locked ? 1 : 0,
        timestamp,
        timestamp,
      ],
    );
    return result.lastId!;
  }

  /**
   * Applies a user's edit and locks the row against future re-imports.
   *
   * When the rate changes but the base amount is not given, the base amount is
   * recomputed from the new rate: the user is saying the old rate was wrong,
   * not that history moved.
   */
  async update(id: number, changes: TransactionUpdate): Promise<void> {
    const columns: string[] = [];
    const values: unknown[] = [];

    for (const field of EDITABLE) {
      const value = changes[field];
      if (value !== undefined) {
        columns.push(`${field} = ?`);
        values.push(value);
      }
    }

    if (columns.length === 0) return;

    if (changes.rate_scaled != null && changes.amount_base_minor === undefined) {
      const current = await this.findById(id);
      if (current) {
        const amount = changes.amount_minor ?? current.amount_minor;
        columns.push('amount_base_minor = ?');
        values.push(convertToBaseMinor(amount, changes.rate_scaled));
      }
    }

    columns.push('locked = 1', 'updated_at = ?');
    values.push(this.now(), id);
    await this.db.run(`UPDATE transactions SET ${columns.join(', ')} WHERE id = ?`, values);
  }

  async delete(id: number): Promise<void> {
    await this.db.run('DELETE FROM transactions WHERE id = ?', [id]);
  }

  /**
   * Movements with everything a screen needs, in one query.
   *
   * The alternative — fetching transactions, then accounts, then categories,
   * and stitching them in TypeScript — costs three round trips and a pair of
   * lookup maps for every render. With five years of history the join is the
   * cheaper and the simpler of the two.
   *
   * The self-join finds the far side of a transfer, so a leg can be labelled
   * with the account the money went to or came from rather than left blank.
   */
  async listDetailed(filter: DetailedFilter = {}): Promise<DetailedTransaction[]> {
    const conditions: string[] = [];
    const values: unknown[] = [];

    if (filter.accountIds && filter.accountIds.length > 0) {
      conditions.push(`t.account_id IN (${filter.accountIds.map(() => '?').join(', ')})`);
      values.push(...filter.accountIds);
    }
    if (filter.from) {
      conditions.push('t.occurred_on >= ?');
      values.push(filter.from);
    }
    if (filter.to) {
      conditions.push('t.occurred_on <= ?');
      values.push(filter.to);
    }
    if (filter.excludeTransfers) {
      conditions.push('t.transfer_id IS NULL');
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    return this.db.query<DetailedTransaction>(
      `SELECT t.*,
              a.name AS account_name,
              a.currency_code,
              a.archived AS account_archived,
              a.type AS account_type,
              c.name AS category_name,
              c.builtin_icon AS category_icon,
              other.name AS other_account_name,
              other.id AS other_account_id
       FROM transactions t
       JOIN accounts a ON a.id = t.account_id
       LEFT JOIN categories c ON c.id = t.category_id
       LEFT JOIN transactions sibling
              ON sibling.transfer_id = t.transfer_id AND sibling.id <> t.id
       LEFT JOIN accounts other ON other.id = sibling.account_id
       ${where}
       ORDER BY t.occurred_on DESC, t.id DESC`,
      values,
    );
  }

  /**
   * Looks up the fingerprints already stored, so the importer can tell new rows
   * from ones it has seen. Returns the highest `import_seq` per fingerprint,
   * which is how repeated identical rows get their slot.
   */
  async importedFingerprints(): Promise<Map<string, number>> {
    const rows = await this.db.query<{ import_fingerprint: string; max_seq: number }>(
      `SELECT import_fingerprint, MAX(import_seq) AS max_seq
       FROM transactions
       WHERE import_fingerprint IS NOT NULL
       GROUP BY import_fingerprint`,
    );
    return new Map(rows.map(row => [row.import_fingerprint, row.max_seq]));
  }

  /** Totals per category over a period, for reports. Transfer legs are left out. */
  async totalsByCategory(filter: { from?: IsoDate; to?: IsoDate; accountId?: number } = {}): Promise<
    { category_id: number; total_minor: number; total_base_minor: number; count: number }[]
  > {
    const conditions = ['transfer_id IS NULL', 'category_id IS NOT NULL'];
    const values: unknown[] = [];

    if (filter.from) {
      conditions.push('occurred_on >= ?');
      values.push(filter.from);
    }
    if (filter.to) {
      conditions.push('occurred_on <= ?');
      values.push(filter.to);
    }
    if (filter.accountId !== undefined) {
      conditions.push('account_id = ?');
      values.push(filter.accountId);
    }

    return this.db.query(
      `SELECT category_id,
              SUM(amount_minor) AS total_minor,
              SUM(amount_base_minor) AS total_base_minor,
              COUNT(*) AS count
       FROM transactions
       WHERE ${conditions.join(' AND ')}
       GROUP BY category_id
       ORDER BY total_base_minor`,
      values,
    );
  }
}

/**
 * The base-currency amount for a new transaction: given explicitly, derived
 * from the rate, or — with no rate at all — the amount itself, because the
 * account is already in the base currency.
 */
function baseAmountOf(transaction: NewTransaction): number {
  if (transaction.amount_base_minor !== undefined) {
    return transaction.amount_base_minor;
  }
  if (transaction.rate_scaled != null) {
    return convertToBaseMinor(transaction.amount_minor, transaction.rate_scaled);
  }
  return transaction.amount_minor;
}
