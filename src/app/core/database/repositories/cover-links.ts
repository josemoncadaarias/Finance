/**
 * The move between products that covered a movement (migration 062; mockups
 * `50a`-`50h`): written in the same save as the movement, for what its
 * product lacked to stay at zero. It is an ordinary transfer between two
 * products of one account; this is only the thread tying it to the movement.
 */

import type { SqlDriver } from '../sql-driver';

export interface CoverLink {
  transferId: number;
  amountMinor: number;
  /** The product the money came from. */
  productName: string | null;
  /** The account it moved inside, and the product it went to: the movement's own while the cover still fits it. */
  accountId: number;
  toProductId: number | null;
}

export async function linkCover(db: SqlDriver, transferId: number, transactionId: number): Promise<void> {
  await db.run('UPDATE transfers SET covers_transaction_id = ? WHERE id = ?', [transactionId, transferId]);
}

/** The cover of a movement, if one was written with it. */
export async function coverOf(db: SqlDriver, transactionId: number): Promise<CoverLink | null> {
  const row = await db.queryOne<{ transfer_id: number; amount_minor: number; product_name: string | null;
    account_id: number; to_product_id: number | null }>(
    `SELECT c.id AS transfer_id, leg.amount_minor AS amount_minor, p.name AS product_name,
            leg.account_id AS account_id, arrive.product_id AS to_product_id
     FROM transfers c
     JOIN transactions leg ON leg.transfer_id = c.id AND leg.transfer_leg = 'from'
     LEFT JOIN transactions arrive ON arrive.transfer_id = c.id AND arrive.transfer_leg = 'to'
     LEFT JOIN products p ON p.id = leg.product_id
     WHERE c.covers_transaction_id = ?
     ORDER BY c.id LIMIT 1`, [transactionId]);
  return row ? {
    transferId: row.transfer_id, amountMinor: Math.abs(row.amount_minor), productName: row.product_name,
    accountId: row.account_id, toProductId: row.to_product_id,
  } : null;
}

/**
 * A corrected movement that no longer leaves the product it was covered for
 * (another account, another product, no longer a spending) lets its cover
 * go: the money was moved only to pay it from there (Jose, 2026-11-15).
 */
export async function dropCover(db: SqlDriver, transferId: number): Promise<void> {
  await db.run('DELETE FROM transactions WHERE transfer_id = ?', [transferId]);
  await db.run('DELETE FROM transfers WHERE id = ?', [transferId]);
}

/**
 * Deleting a movement takes its cover with it: the money was moved only to
 * pay it, and left behind it would read as a move nobody made.
 */
export async function dropCovers(db: SqlDriver, transactionIds: readonly number[]): Promise<void> {
  if (transactionIds.length === 0) return;
  const marks = transactionIds.map(() => '?').join(', ');
  const covers = `SELECT id FROM transfers WHERE covers_transaction_id IN (${marks})`;
  await db.run(`DELETE FROM transactions WHERE transfer_id IN (${covers})`, [...transactionIds]);
  await db.run(`DELETE FROM transfers WHERE covers_transaction_id IN (${marks})`, [...transactionIds]);
}
