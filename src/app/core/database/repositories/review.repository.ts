/**
 * What the importer could not settle on its own.
 *
 * Every time the import has to assume something — a dollar amount Monefy never
 * stored, an account whose currency had to be inferred, half a transfer whose
 * other half was deleted — it writes the assumption down here instead of
 * making it quietly. This repository is how those get looked at and closed.
 *
 * The point of the whole app is knowing what tax will be owed. An assumption
 * nobody ever reviewed is a number that looks exact and is not, which is worse
 * than a number marked uncertain.
 */

import type { SqlDriver } from '../sql-driver';

export interface ReviewItem {
  id: number;
  kind: string;
  entity_type: 'transaction' | 'transfer' | 'account' | 'category' | 'cashback' | null;
  entity_id: number | null;
  reason: string;
  resolved: number;
  created_at: string;

  /** Filled in from the row the item points at, so a list can be read. */
  subject: string | null;
  occurred_on: string | null;
  amount_minor: number | null;
  currency_code: string | null;
}

export interface ReviewGroup {
  kind: string;
  count: number;
}

export class ReviewRepository {
  private readonly db: SqlDriver;
  private readonly now: () => string;

  constructor(db: SqlDriver, now: () => string = () => new Date().toISOString()) {
    this.db = db;
    this.now = now;
  }

  /** How many of each kind are still open, most numerous first. */
  async openGroups(): Promise<ReviewGroup[]> {
    return this.db.query<ReviewGroup>(
      `SELECT kind, COUNT(*) AS count FROM review_queue
       WHERE resolved = 0 GROUP BY kind ORDER BY count DESC`,
    );
  }

  /**
   * The open items of one kind, each carrying enough of its subject to be
   * recognised without a second query per row.
   *
   * The two joins are left joins on purpose: an item whose subject was deleted
   * since is still worth showing, so it can be closed rather than haunting the
   * count forever.
   */
  async open(kind: string, limit = 200): Promise<ReviewItem[]> {
    return this.db.query<ReviewItem>(
      `SELECT r.id, r.kind, r.entity_type, r.entity_id, r.reason, r.resolved, r.created_at,
              CASE r.entity_type
                WHEN 'transaction' THEN COALESCE(t.description, c.name, a2.name)
                WHEN 'account' THEN a.name
                ELSE NULL
              END AS subject,
              t.occurred_on AS occurred_on,
              t.amount_minor AS amount_minor,
              COALESCE(a2.currency_code, a.currency_code) AS currency_code
       FROM review_queue r
       LEFT JOIN transactions t ON r.entity_type = 'transaction' AND t.id = r.entity_id
       LEFT JOIN categories c ON c.id = t.category_id
       LEFT JOIN accounts a2 ON a2.id = t.account_id
       LEFT JOIN accounts a ON r.entity_type = 'account' AND a.id = r.entity_id
       WHERE r.resolved = 0 AND r.kind = ?
       ORDER BY t.occurred_on DESC, r.id
       LIMIT ?`,
      [kind, limit],
    );
  }

  async resolve(id: number, note?: string): Promise<void> {
    await this.db.run(
      'UPDATE review_queue SET resolved = 1, resolved_at = ?, note = ? WHERE id = ?',
      [this.now(), note ?? null, id],
    );
  }

  /**
   * Closes every open item of one kind at once.
   *
   * For the kinds that are information rather than a question — the two limit
   * increases, the multi-currency split — going through them one by one is
   * ceremony. The note says it was a batch, so a later reader knows none of
   * them was inspected individually.
   */
  async resolveKind(kind: string, note?: string): Promise<number> {
    const result = await this.db.run(
      'UPDATE review_queue SET resolved = 1, resolved_at = ?, note = ? WHERE resolved = 0 AND kind = ?',
      [this.now(), note ?? null, kind],
    );
    return result.changes ?? 0;
  }

  /** Undoes a resolution, for when it was closed too eagerly. */
  async reopen(id: number): Promise<void> {
    await this.db.run(
      'UPDATE review_queue SET resolved = 0, resolved_at = NULL, note = NULL WHERE id = ?',
      [id],
    );
  }

  async openCount(): Promise<number> {
    const row = await this.db.queryOne<{ n: number }>(
      'SELECT COUNT(*) AS n FROM review_queue WHERE resolved = 0');
    return row?.n ?? 0;
  }
}
