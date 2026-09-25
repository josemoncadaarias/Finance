/**
 * The note a new movement probably wants: the one most often written for the
 * same thing before.
 *
 * Jose, 2026-09-25: "ya hay notas que se usan bastante, y se puede dejar de
 * una vez la más usada". Paying the card from Rappi cuenta is "Pago tarjeta
 * de crédito RappiCard" nearly every time; an income on a product is
 * "cashback rappicard". So a new movement starts with that note written, and
 * the person keeps it, changes it, or clears it with the X.
 *
 * "The same thing" is as narrow as the form can already say:
 *
 *   - a spending or an income: the same account and the same side, and the
 *     same category once one is chosen;
 *   - a transfer: the same two accounts, in that direction;
 *   - a product's own spending or income: the same account, product and side,
 *     and the same category once one is chosen;
 *   - a move between products: the same two products of the account.
 *
 * A note written once is not a habit: it takes two to be offered. The last
 * year is asked first, so a note that stopped being used stops being
 * offered; then all of it, for a history that is older than that. Notes are
 * compared without regard to case or the spaces around them. Generic: it
 * reads only the person's own movements, whatever their accounts are called.
 */

import type { SqlDriver } from '../database/sql-driver';

export type NoteContext =
  | { kind: 'movement'; accountId: number; side: 'in' | 'out'; categoryId: number | null }
  | { kind: 'transfer'; fromAccountId: number; toAccountId: number }
  | {
      kind: 'product';
      accountId: number;
      productId: number;
      /** The account's usual product, which is what a row naming none means. */
      usualProductId: number;
      side: 'in' | 'out';
      categoryId: number | null;
    }
  | { kind: 'betweenProducts'; accountId: number; fromProductId: number; toProductId: number; usualProductId: number };

/** A note needs this many uses to be a habit. */
const AT_LEAST = 2;

function aYearBefore(day: string): string {
  return `${Number(day.slice(0, 4)) - 1}${day.slice(4)}`;
}

/** The query for one context: rows of (note, day), every use one row. */
function usesOf(context: NoteContext): { sql: string; params: unknown[] } {
  const filled = (column: string) => `${column} IS NOT NULL AND TRIM(${column}) <> ''`;
  switch (context.kind) {
    case 'movement':
      return {
        sql: `SELECT TRIM(description) AS note, occurred_on AS day FROM transactions
              WHERE account_id = ? AND transfer_id IS NULL AND amount_minor ${context.side === 'in' ? '>' : '<'} 0
                ${context.categoryId === null ? '' : 'AND category_id = ?'} AND ${filled('description')}`,
        params: [context.accountId, ...(context.categoryId === null ? [] : [context.categoryId])],
      };
    case 'transfer':
      return {
        sql: `SELECT TRIM(COALESCE(NULLIF(TRIM(tr.description), ''), f.description)) AS note, f.occurred_on AS day
              FROM transactions f
              JOIN transactions t ON t.transfer_id = f.transfer_id AND t.id <> f.id
              JOIN transfers tr ON tr.id = f.transfer_id
              WHERE f.transfer_leg = 'from' AND f.account_id = ? AND t.account_id = ?
                AND (${filled('tr.description')} OR ${filled('f.description')})`,
        params: [context.fromAccountId, context.toAccountId],
      };
    case 'product': {
      const sign = context.side === 'in' ? '>' : '<';
      const category = context.categoryId === null ? '' : 'AND category_id = ?';
      return {
        // A product's own entries, and the account's movements on that product
        // that are not the other half of an entry already counted.
        sql: `SELECT TRIM(note) AS note, on_date AS day FROM product_entries
              WHERE account_id = ? AND COALESCE(product_id, ?) = ? AND amount_minor ${sign} 0 ${category}
                AND ${filled('note')}
              UNION ALL
              SELECT TRIM(description), occurred_on FROM transactions
              WHERE account_id = ? AND COALESCE(product_id, ?) = ? AND transfer_id IS NULL
                AND amount_minor ${sign} 0 ${category} AND ${filled('description')}
                AND id NOT IN (SELECT transaction_id FROM product_entries WHERE transaction_id IS NOT NULL)`,
        params: [
          context.accountId, context.usualProductId, context.productId,
          ...(context.categoryId === null ? [] : [context.categoryId]),
          context.accountId, context.usualProductId, context.productId,
          ...(context.categoryId === null ? [] : [context.categoryId]),
        ],
      };
    }
    case 'betweenProducts':
      return {
        sql: `SELECT TRIM(COALESCE(NULLIF(TRIM(tr.description), ''), f.description)) AS note, f.occurred_on AS day
              FROM transactions f
              JOIN transactions t ON t.transfer_id = f.transfer_id AND t.id <> f.id
              JOIN transfers tr ON tr.id = f.transfer_id
              WHERE f.transfer_leg = 'from' AND f.account_id = ? AND t.account_id = f.account_id
                AND COALESCE(f.product_id, ?) = ? AND COALESCE(t.product_id, ?) = ?
                AND (${filled('tr.description')} OR ${filled('f.description')})`,
        params: [context.accountId, context.usualProductId, context.fromProductId,
          context.usualProductId, context.toProductId],
      };
  }
}

/**
 * The note most often written for this context, as it was last written; null
 * when nothing has been written for it at least twice.
 */
export async function usualNote(db: SqlDriver, context: NoteContext, today: string): Promise<string | null> {
  const { sql, params } = usesOf(context);
  for (const since of [aYearBefore(today), null]) {
    const rows = await db.query<{ note: string; times: number }>(
      `WITH uses AS (${sql}),
       ranked AS (
         SELECT LOWER(note) AS key, COUNT(*) AS times, MAX(day) AS last
         FROM uses ${since === null ? '' : 'WHERE day >= ?'}
         GROUP BY LOWER(note)
       )
       SELECT (SELECT note FROM uses WHERE LOWER(note) = ranked.key ORDER BY day DESC LIMIT 1) AS note, times
       FROM ranked ORDER BY times DESC, last DESC LIMIT 1`,
      [...params, ...(since === null ? [] : [since])],
    );
    const best = rows[0];
    if (best && best.times >= AT_LEAST) return best.note;
  }
  return null;
}
