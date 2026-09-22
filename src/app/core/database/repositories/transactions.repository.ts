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
  /**
   * Which product inside the account the money went to or came from.
   *
   * Only ever asked when an account has more than one: with one there is
   * nothing to choose, and the column stays empty - which is also every row
   * that existed before a movement could say.
   */
  pocket_id?: number | null;
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
  /** The account's own icon, for a list where the account is what varies. */
  account_builtin_icon: string | null;
  account_custom_icon_id: number | null;
  currency_code: string;
  account_archived: number;
  account_type: string;
  category_name: string | null;
  category_icon: string | null;
  /**
   * The image a category wears, when it wears one.
   *
   * A category has exactly one of the two - the schema enforces it - so a
   * category given a real picture has `builtin_icon` null, and a screen
   * reading only that column draws nothing at all. Which is what every screen
   * did: every category Jose gave his own image to appeared with no icon.
   */
  category_custom_icon_id: number | null;
  /** The other side of a transfer, for labelling it. Null otherwise. */
  other_account_name: string | null;
  /**
   * And its icon. A transfer's row said "swap-horizontal-outline" and nothing
   * else, which is the one thing the reader already knows: the amount is
   * painted as moved and the label reads "a Pibank". What it does not say is
   * which account that is, and a bank's own logo says it at a glance.
   */
  other_account_builtin_icon: string | null;
  other_account_custom_icon_id: number | null;
  /** The far account's id, so a caller can tell inside a scope from outside. */
  other_account_id: number | null;
  /** 1 when this movement's product sits outside net worth. */
  pocket_set_aside: 0 | 1;
  /** The product on the other side of a transfer, and whether it sits outside net worth. */
  other_pocket_name: string | null;
  other_pocket_set_aside: 0 | 1;
}

export interface DetailedFilter {
  /** Accounts in scope. Empty or absent means every account. */
  accountIds?: readonly number[];
  from?: IsoDate;
  to?: IsoDate;
  /** Leave out transfer legs, which is what "all accounts" wants. */
  excludeTransfers?: boolean;
}

const COLUMNS = `id, account_id, category_id, pocket_id, occurred_on, amount_minor, rate_scaled,
  amount_base_minor, rate_source, confidence, description, transfer_id, transfer_leg,
  source, import_fingerprint, import_seq, import_batch_id, locked, created_at, updated_at`;

/** Fields a user can edit. Touching any of them locks the row. */
const EDITABLE = [
  'account_id', 'category_id', 'pocket_id', 'occurred_on', 'amount_minor', 'rate_scaled',
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
      `INSERT INTO transactions (account_id, category_id, pocket_id, occurred_on, amount_minor, rate_scaled,
         amount_base_minor, rate_source, confidence, description, transfer_id, transfer_leg,
         source, import_fingerprint, import_seq, import_batch_id, locked, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        transaction.account_id,
        transaction.category_id ?? null,
        transaction.pocket_id ?? null,
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

    if (changes.amount_minor !== undefined || changes.occurred_on !== undefined || changes.pocket_id !== undefined) {
      await this.followCashIn(id);
    }
  }

  /**
   * Keeps the other half of a cash-in in step with its movement.
   *
   * Cashing in is a movement plus the same amount out of what a product
   * gathered (a withdrawal) - or, for an expense, back into it (an entry) - so
   * that the product's balance does not move. Correcting the movement alone
   * would leave the two halves disagreeing, and the product's balance moving
   * by the difference.
   */
  private async followCashIn(id: number): Promise<void> {
    const row = await this.findById(id);
    if (!row) return;
    await this.db.run(
      `UPDATE product_cashouts SET amount_minor = ?, on_date = ?, pocket_id = COALESCE(?, pocket_id)
       WHERE transaction_id = ?`,
      [Math.abs(row.amount_minor), row.occurred_on, row.pocket_id, id]);
    await this.db.run(
      `UPDATE product_entries SET amount_minor = ?, on_date = ?, pocket_id = COALESCE(?, pocket_id), updated_at = ?
       WHERE transaction_id = ?`,
      [-row.amount_minor, row.occurred_on, row.pocket_id, this.now(), id]);
  }

  /**
   * Deletes a movement, and remembers that it was deleted.
   *
   * A row that came from an import carries a fingerprint, and the importer
   * skips rows whose fingerprint it has already stored. Deleting the row takes
   * the fingerprint with it, so the next import would meet the row as new and
   * put it back — someone deletes a movement, re-imports, and it returns with
   * nothing to explain why.
   *
   * The fingerprint outlives the row instead. A deletion is a decision, the
   * same as an edit, and `locked` already protects the edited case.
   */
  async delete(id: number): Promise<void> {
    const row = await this.db.queryOne<{ import_fingerprint: string | null; import_seq: number | null }>(
      'SELECT import_fingerprint, import_seq FROM transactions WHERE id = ?', [id]);

    await this.db.transaction(async () => {
      // A cash-in is this movement plus the same amount out of, or into, what a
      // product gathered. Left behind, that half would move the product's
      // balance on its own, so it goes with the movement.
      await this.db.run('DELETE FROM product_cashouts WHERE transaction_id = ?', [id]);
      await this.db.run('DELETE FROM product_entries WHERE transaction_id = ?', [id]);
      await this.db.run('DELETE FROM transactions WHERE id = ?', [id]);

      if (row?.import_fingerprint != null && row.import_seq != null) {
        await this.db.run(
          `INSERT INTO deleted_imports (import_fingerprint, import_seq, deleted_at)
           VALUES (?, ?, ?)
           ON CONFLICT(import_fingerprint, import_seq) DO NOTHING`,
          [row.import_fingerprint, row.import_seq, this.now()],
        );
      }
    });
  }

  /**
   * Fingerprints of rows deleted by hand, so an import leaves them alone.
   *
   * Same shape as `importedFingerprints`, and used the same way.
   */
  async deletedFingerprints(): Promise<Map<string, number>> {
    const rows = await this.db.query<{ import_fingerprint: string; max_seq: number }>(
      `SELECT import_fingerprint, MAX(import_seq) AS max_seq
       FROM deleted_imports GROUP BY import_fingerprint`,
    );
    return new Map(rows.map(row => [row.import_fingerprint, row.max_seq]));
  }

  /** Lets a deliberate deletion be undone, so nothing is permanent by accident. */
  async forgetDeletion(fingerprint: string, seq: number): Promise<void> {
    await this.db.run(
      'DELETE FROM deleted_imports WHERE import_fingerprint = ? AND import_seq = ?',
      [fingerprint, seq]);
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
              a.builtin_icon AS account_builtin_icon,
              a.custom_icon_id AS account_custom_icon_id,
              a.currency_code,
              a.archived AS account_archived,
              a.type AS account_type,
              c.name AS category_name,
              c.builtin_icon AS category_icon,
              c.custom_icon_id AS category_custom_icon_id,
              other.name AS other_account_name,
              other.builtin_icon AS other_account_builtin_icon,
              other.custom_icon_id AS other_account_custom_icon_id,
              other.id AS other_account_id,
              CASE WHEN own_pocket.include_in_net_worth = 0 THEN 1 ELSE 0 END AS pocket_set_aside,
              other_pocket.name AS other_pocket_name,
              CASE WHEN other_pocket.include_in_net_worth = 0 THEN 1 ELSE 0 END AS other_pocket_set_aside
       FROM transactions t
       JOIN accounts a ON a.id = t.account_id
       LEFT JOIN categories c ON c.id = t.category_id
       LEFT JOIN transactions sibling
              ON sibling.transfer_id = t.transfer_id AND sibling.id <> t.id
       LEFT JOIN accounts other ON other.id = sibling.account_id
       LEFT JOIN yield_pockets own_pocket ON own_pocket.id = t.pocket_id
       LEFT JOIN yield_pockets other_pocket ON other_pocket.id = sibling.pocket_id
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

  /**
   * Notes already used that contain `fragment`, most-used first.
   *
   * The notes people write repeat far more than they vary — the same shop,
   * the same rent, the same monthly transfer — so the history is already the
   * list of suggestions, and no separate table has to be kept in step with it.
   * Ordered by how often each note was written and then by how recently, so
   * the everyday one wins over something typed once two years ago.
   *
   * The history is all three places a note can be written, not only the
   * movements. A product's own income - a cashback the bank paid in - is a
   * row of `product_entries` and never a movement, so its note was
   * offered to nobody: Jose wrote "Cashback RappiCard" on one on 2026-09-21
   * and the next one did not suggest it back.
   */
  async suggestNotes(fragment: string, limit = 6): Promise<string[]> {
    const needle = fragment.trim();
    if (needle === '') return [];

    // `%` and `_` are wildcards in LIKE. Someone typing them means the
    // characters themselves.
    const escaped = needle.replace(/[\\%_]/g, character => `\\${character}`);
    const like = `%${escaped}%`;

    const rows = await this.db.query<{ note: string }>(
      `SELECT note, COUNT(*) AS times, MAX(on_date) AS last_used FROM (
         SELECT description AS note, occurred_on AS on_date FROM transactions
         UNION ALL
         SELECT note, on_date FROM product_entries
         UNION ALL
         SELECT note, on_date FROM product_cashouts
       )
       WHERE note IS NOT NULL AND TRIM(note) <> '' AND note LIKE ? ESCAPE '\\'
       GROUP BY note COLLATE NOCASE
       ORDER BY times DESC, last_used DESC
       LIMIT ?`,
      [like, limit],
    );
    return rows.map(row => row.note);
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
