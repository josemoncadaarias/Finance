/**
 * The movements the "+" reads its habits from: two queries over the last
 * `WINDOW_DAYS`, answered in memory by `frequentOf` (never a query per row).
 *
 * Left out: archived accounts, loans and their payments (a loan's payment has
 * its own form), a refund (a spending category with money in, or the other
 * way round) and a transfer whose ends are not both in the ledger.
 */

import type { SqlDriver } from '../database/sql-driver';
import { WINDOW_DAYS, type PastMovement } from './frequent';

export async function pastMovements(db: SqlDriver, today: string): Promise<PastMovement[]> {
  const [y, m, d] = today.split('-').map(Number);
  const from = new Date(Date.UTC(y, m - 1, d - WINDOW_DAYS)).toISOString().slice(0, 10);

  const plain = await db.query<{
    account_id: number; product_id: number | null; category_id: number; kind: string;
    description: string | null; amount_minor: number; occurred_on: string;
  }>(
    `SELECT t.account_id, t.product_id, t.category_id, c.kind, t.description, t.amount_minor, t.occurred_on
       FROM transactions t
       JOIN categories c ON c.id = t.category_id
       JOIN accounts a ON a.id = t.account_id
      WHERE t.transfer_id IS NULL AND t.occurred_on >= ? AND a.archived = 0
        AND t.account_id NOT IN (SELECT account_id FROM loans)
        AND t.id NOT IN (SELECT interest_tx_id FROM loan_payments WHERE interest_tx_id IS NOT NULL
                         UNION SELECT insurance_tx_id FROM loan_payments WHERE insurance_tx_id IS NOT NULL)`,
    [from],
  );

  const moves = await db.query<{
    from_account: number; to_account: number; from_product: number | null; to_product: number | null;
    note: string | null; amount_minor: number; occurred_on: string;
  }>(
    `SELECT f.account_id AS from_account, t.account_id AS to_account,
            f.product_id AS from_product, t.product_id AS to_product,
            COALESCE(NULLIF(TRIM(f.description), ''), tr.description) AS note,
            f.amount_minor, tr.occurred_on
       FROM transfers tr
       JOIN transactions f ON f.transfer_id = tr.id AND f.transfer_leg = 'from'
       JOIN transactions t ON t.transfer_id = tr.id AND t.transfer_leg = 'to'
       JOIN accounts fa ON fa.id = f.account_id
       JOIN accounts ta ON ta.id = t.account_id
      WHERE tr.occurred_on >= ? AND fa.archived = 0 AND ta.archived = 0
        AND tr.id NOT IN (SELECT transfer_id FROM loan_payments WHERE transfer_id IS NOT NULL)
        AND f.account_id NOT IN (SELECT account_id FROM loans)
        AND t.account_id NOT IN (SELECT account_id FROM loans)`,
    [from],
  );

  const out: PastMovement[] = [];
  for (const r of plain) {
    const kind = r.amount_minor < 0 ? 'expense' : 'income';
    if (kind !== r.kind) continue;
    out.push({ kind, accountId: r.account_id, productId: r.product_id, categoryId: r.category_id,
      note: r.description ?? '', amountMinor: Math.abs(r.amount_minor), onDate: r.occurred_on });
  }
  for (const r of moves) {
    out.push({ kind: 'transfer', accountId: r.from_account, toAccountId: r.to_account,
      productId: r.from_product, toProductId: r.to_product, categoryId: null,
      note: r.note ?? '', amountMinor: Math.abs(r.amount_minor), onDate: r.occurred_on });
  }
  return out;
}
