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
}

export async function linkCover(db: SqlDriver, transferId: number, transactionId: number): Promise<void> {
  await db.run('UPDATE transfers SET covers_transaction_id = ? WHERE id = ?', [transactionId, transferId]);
}

/** The cover of a movement, if one was written with it. */
export async function coverOf(db: SqlDriver, transactionId: number): Promise<CoverLink | null> {
  const row = await db.queryOne<{ transfer_id: number; amount_minor: number; product_name: string | null }>(
    `SELECT c.id AS transfer_id, leg.amount_minor AS amount_minor, p.name AS product_name
     FROM transfers c
     JOIN transactions leg ON leg.transfer_id = c.id AND leg.transfer_leg = 'from'
     LEFT JOIN products p ON p.id = leg.product_id
     WHERE c.covers_transaction_id = ?
     ORDER BY c.id LIMIT 1`, [transactionId]);
  return row ? { transferId: row.transfer_id, amountMinor: Math.abs(row.amount_minor), productName: row.product_name } : null;
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
