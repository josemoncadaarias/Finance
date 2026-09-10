/**
 * Reading a backup back.
 *
 * Writing one has existed since Phase 3.6; reading one had not, which meant the
 * file the app told people to keep was a file nothing could open. A backup that
 * has never been restored is not a backup — it is an archive with good
 * intentions, and the day it matters is the day you find that out.
 *
 * What makes this harder than "insert the rows" is that a backup is a snapshot
 * of a SCHEMA as well as of data. A file written by version 12 has twelve
 * migrations' worth of columns, and today's database has seventeen. Inserting
 * those rows into today's tables would fail on the first column that did not
 * exist yet.
 *
 * So the restore rebuilds the database the file came from, and then brings it
 * forward the same way a phone does:
 *
 *   1. Every table is dropped and `user_version` goes back to 0.
 *   2. Migrations run up to the version the backup was written at, which
 *      recreates exactly the tables those rows came out of.
 *   3. The rows go in, parents before children.
 *   4. The remaining migrations run, and the data arrives in the present the
 *      same way it would have if it had been there all along.
 *
 * That last step is what makes an old backup worth keeping: a file from
 * version 12 restored today gets migrations 13 to 17 applied to it, including
 * the ones that carry data.
 */

import type { SqlDriver } from '../sql-driver';
import type { MigrationSource } from '../migrations/statements.generated';
import { migrate, targetVersion } from '../migrations/migration-runner';
import type { Backup } from './export-backup';

export interface RestoreResult {
  /** The schema the file was written at, before it was brought forward. */
  fromVersion: number;
  /** Where the database ended up. */
  toVersion: number;
  /** Rows written, per table, in the order they went in. */
  restored: { table: string; rows: number }[];
}

export class RestoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RestoreError';
  }
}

/**
 * Turns the text of a backup file back into one, refusing anything else.
 *
 * Deliberately strict. Someone restoring is usually having a bad day already,
 * and the failure mode of a loose parser here is a half-written database.
 */
export function parseBackup(text: string): Backup {
  let raw: unknown;
  try {
    raw = JSON.parse(text, (_key, value) => {
      // A BLOB left as `{ __bytes: [...] }` on the way out.
      if (value !== null && typeof value === 'object' && Array.isArray((value as { __bytes?: unknown }).__bytes)) {
        return Uint8Array.from((value as { __bytes: number[] }).__bytes);
      }
      return value;
    });
  } catch {
    throw new RestoreError('That file is not a backup: it is not even JSON.');
  }

  const backup = raw as Partial<Backup>;
  if (backup?.app !== 'finance') {
    throw new RestoreError('That file was not written by this app.');
  }
  if (typeof backup.schemaVersion !== 'number' || backup.schemaVersion < 1) {
    throw new RestoreError('That backup does not say which schema it came from.');
  }
  if (backup.tables === null || typeof backup.tables !== 'object') {
    throw new RestoreError('That backup carries no tables.');
  }

  return backup as Backup;
}

/**
 * Replaces everything in the database with what the backup holds.
 *
 * There is no merge and there never should be: two databases of the same
 * accounts cannot be reconciled row by row, and pretending otherwise would
 * produce a third that matches neither. This is "put it back the way it was",
 * and the caller is responsible for asking whether that is really wanted.
 */
export async function restoreBackup(
  db: SqlDriver,
  backup: Backup,
  sources: readonly MigrationSource[],
): Promise<RestoreResult> {
  const latest = targetVersion(sources);
  if (backup.schemaVersion > latest) {
    throw new RestoreError(
      `That backup was written by a newer version of the app (schema ` +
      `${backup.schemaVersion}, this build knows up to ${latest}). Update the app first.`,
    );
  }

  // Dropping runs outside a transaction and in reverse dependency order, so a
  // child is always gone before its parent. Foreign keys are on and cannot be
  // turned off inside a transaction, so the order is what keeps them happy.
  const existing = await db.query<{ name: string }>(
    `SELECT name FROM sqlite_master
     WHERE type = 'table' AND name NOT LIKE 'sqlite_%'`,
  );
  for (const table of dropOrder(existing.map(row => row.name))) {
    await db.execute(`DROP TABLE IF EXISTS "${table}"`);
  }
  await db.execute('PRAGMA user_version = 0');

  // Back to the schema the rows came out of.
  await migrate(db, sources.filter(source => source.version <= backup.schemaVersion));

  const restored: { table: string; rows: number }[] = [];

  await db.transaction(async () => {
    for (const table of Object.keys(backup.tables)) {
      const rows = backup.tables[table];
      if (!Array.isArray(rows) || rows.length === 0) continue;

      // A migration may have seeded the table already — currencies and the
      // tax parameters both do. The backup is the authority.
      await db.run(`DELETE FROM "${table}"`);

      for (const row of rows) {
        const columns = Object.keys(row as Record<string, unknown>);
        if (columns.length === 0) continue;

        const placeholders = columns.map(() => '?').join(', ');
        const names = columns.map(column => `"${column}"`).join(', ');
        await db.run(
          `INSERT INTO "${table}" (${names}) VALUES (${placeholders})`,
          columns.map(column => (row as Record<string, unknown>)[column]),
        );
      }
      restored.push({ table, rows: rows.length });
    }
  });

  // And forward to today, applying every migration written since — including
  // the ones that carry data.
  const forward = await migrate(db, sources);

  return { fromVersion: backup.schemaVersion, toVersion: forward.to, restored };
}

/**
 * Children before parents.
 *
 * The export writes parents first so a restore can replay them in order; this
 * is that order reversed, with anything unrecognised dropped first — a table
 * this build has never heard of cannot be a parent of one it has.
 */
function dropOrder(tables: string[]): string[] {
  const known = [
    'currencies', 'custom_icons', 'account_groups', 'accounts', 'categories',
    'transfers', 'transactions', 'exchange_rates', 'yield_accounts',
    'yield_pockets', 'yield_pocket_balances', 'yield_rates', 'yield_days',
    'cashback_rules', 'cashback_entries', 'cushion_adjustments',
    'cushion_withdrawals', 'tax_parameters', 'credit_limit_changes',
    'import_batches', 'review_queue', 'deleted_imports', 'settings',
  ];

  const unknown = tables.filter(table => !known.includes(table));
  const inOrder = known.filter(table => tables.includes(table)).reverse();
  return [...unknown, ...inOrder];
}
