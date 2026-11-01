/**
 * "Deshacer" and "Recuperar" on the saved banner (mockups `53a`-`53f`): a
 * movement just saved is deleted the way the form deletes it, and can be put
 * back exactly as it was for a few seconds after.
 *
 * Before deleting, every row the deletion takes is copied as it stands: the
 * movement (or the transfer and its legs), its halves on a product, the move
 * that covered it from a pocket and that move's legs, the rows of other tables
 * that a foreign key deletes with them, and the rows a foreign key would only
 * empty (a bank message saved as this movement keeps pointing at it once it is
 * back). Putting it back inserts those rows with their own ids and fills the
 * emptied references again, in one transaction.
 *
 * Not for a loan's payment: its parts are a payment record of their own, and
 * the banner never offers it.
 */

import type { SqlDriver } from '../sql-driver';
import { TransactionsRepository } from './transactions.repository';
import { TransfersRepository } from './transfers.repository';

type Row = Record<string, unknown>;

/** A movement, a transfer, or a product's own movement ("Solo el producto"). */
export interface MovementTarget { transactionId?: number; transferId?: number; entryId?: number }

export interface MovementSnapshot {
  /** Rows to insert again, parents first. */
  rows: { table: string; row: Row }[];
  /** References a foreign key emptied: set back to `value`. */
  links: { table: string; column: string; rowid: number; value: number }[];
  /** What was deleted, to delete it the same way. */
  target: MovementTarget;
  /** Bank messages saved as this movement: back in Por revisar while it is gone. */
  proposals: number[];
}

const OWN = new Set(['transactions', 'transfers', 'product_entries', 'product_cashouts']);

const marks = (ids: readonly number[]) => ids.map(() => '?').join(', ');

async function idsOf(db: SqlDriver, sql: string, params: unknown[]): Promise<number[]> {
  return (await db.query<{ id: number }>(sql, params)).map(r => r.id);
}

/** Copies everything deleting this movement or transfer would take. */
export async function snapshotMovement(db: SqlDriver, target: MovementTarget): Promise<MovementSnapshot> {
  if (target.entryId !== undefined) {
    // A product's own movement is one row: nothing points at it.
    const rows = (await db.query<Row>('SELECT * FROM product_entries WHERE id = ?', [target.entryId]))
      .map(row => ({ table: 'product_entries', row }));
    return { rows, links: [], target, proposals: [] };
  }
  const transferIds = target.transferId !== undefined ? [target.transferId] : [];
  let txIds = target.transactionId !== undefined ? [target.transactionId] : [];
  if (transferIds.length) txIds = [...txIds, ...await idsOf(db, `SELECT id FROM transactions WHERE transfer_id IN (${marks(transferIds)})`, transferIds)];
  // The moves that covered any of them from a pocket, and their legs.
  if (txIds.length) {
    const covers = await idsOf(db, `SELECT id FROM transfers WHERE covers_transaction_id IN (${marks(txIds)})`, txIds);
    if (covers.length) {
      transferIds.push(...covers);
      txIds = [...txIds, ...await idsOf(db, `SELECT id FROM transactions WHERE transfer_id IN (${marks(covers)})`, covers)];
    }
  }

  const rows: MovementSnapshot['rows'] = [];
  const add = async (table: string, where: string, params: unknown[]) => {
    for (const row of await db.query<Row>(`SELECT * FROM ${table} WHERE ${where}`, params)) rows.push({ table, row });
  };
  if (transferIds.length) await add('transfers', `id IN (${marks(transferIds)})`, transferIds);
  if (txIds.length) await add('transactions', `id IN (${marks(txIds)})`, txIds);
  const entryWhere: string[] = [];
  const entryParams: unknown[] = [];
  if (txIds.length) { entryWhere.push(`transaction_id IN (${marks(txIds)})`); entryParams.push(...txIds); }
  if (transferIds.length) { entryWhere.push(`transfer_id IN (${marks(transferIds)})`); entryParams.push(...transferIds); }
  if (entryWhere.length) await add('product_entries', entryWhere.join(' OR '), entryParams);
  if (txIds.length) await add('product_cashouts', `transaction_id IN (${marks(txIds)})`, txIds);

  // Every other table pointing at them: rows it deletes with them, and
  // references it only empties.
  const links: MovementSnapshot['links'] = [];
  const tables = await db.query<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'");
  for (const { name } of tables) {
    if (OWN.has(name)) continue;
    const keys = await db.query<{ table: string; from: string; on_delete: string }>(`PRAGMA foreign_key_list(${name})`);
    for (const key of keys) {
      const ids = key.table === 'transactions' ? txIds : key.table === 'transfers' ? transferIds : [];
      if (!ids.length) continue;
      const action = String(key.on_delete).toUpperCase();
      if (action === 'CASCADE') {
        await add(name, `${key.from} IN (${marks(ids)})`, ids);
      } else if (action === 'SET NULL') {
        const found = await db.query<{ rid: number; value: number }>(
          `SELECT rowid AS rid, ${key.from} AS value FROM ${name} WHERE ${key.from} IN (${marks(ids)})`, ids);
        for (const one of found) links.push({ table: name, column: key.from, rowid: one.rid, value: one.value });
      }
    }
  }
  const proposals = links.filter(l => l.table === 'movement_proposals' && l.column === 'transaction_id').map(l => l.rowid);
  return { rows, links, target, proposals };
}

/** Deletes the movement or transfer as the form does, after copying it. */
export async function deleteWithSnapshot(db: SqlDriver, target: MovementTarget): Promise<MovementSnapshot> {
  const snapshot = await snapshotMovement(db, target);
  if (target.entryId !== undefined) {
    await db.run('DELETE FROM product_entries WHERE id = ?', [target.entryId]);
    return snapshot;
  }
  if (target.transferId !== undefined) await new TransfersRepository(db).delete(target.transferId);
  else if (target.transactionId !== undefined) await new TransactionsRepository(db).delete(target.transactionId);
  // A message saved by mistake waits in Por revisar again.
  if (snapshot.proposals.length) {
    await db.run(`UPDATE movement_proposals SET status = 'pending' WHERE rowid IN (${marks(snapshot.proposals)}) AND status = 'accepted'`, snapshot.proposals);
  }
  return snapshot;
}

/** Puts back what was deleted, with its own ids. */
export async function restoreSnapshot(db: SqlDriver, snapshot: MovementSnapshot): Promise<void> {
  await db.transaction(async () => {
    const seen = new Set<string>();
    for (const { table, row } of snapshot.rows) {
      const key = `${table}:${String(row['id'] ?? JSON.stringify(row))}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const columns = Object.keys(row);
      await db.run(
        `INSERT OR IGNORE INTO ${table} (${columns.join(', ')}) VALUES (${marks(columns as unknown as number[])})`,
        columns.map(c => row[c]));
    }
    for (const link of snapshot.links) {
      await db.run(`UPDATE ${link.table} SET ${link.column} = ? WHERE rowid = ? AND ${link.column} IS NULL`, [link.value, link.rowid]);
    }
    if (snapshot.proposals.length) {
      await db.run(`UPDATE movement_proposals SET status = 'accepted' WHERE rowid IN (${marks(snapshot.proposals)}) AND status = 'pending'`, snapshot.proposals);
    }
  });
}
