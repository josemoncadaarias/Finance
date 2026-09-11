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
import { TABLES, exportBackup, type Backup } from './export-backup';

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
 *
 * **It never leaves less than it found.** Rebuilding the schema means dropping
 * every table before the rows go in, and a drop cannot be rolled back. The
 * first version of this trusted the rows to fit, and they did not: movements
 * were inserted before the import batches they point at, every imported row
 * broke a foreign key, the inserts rolled back - and the tables were already
 * empty. Jose lost the browser copy of his history to it on 2026-09-11. So
 * what is in the database is copied out first, and if the backup cannot be put
 * in, the copy is put back before the error is reported.
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

  const current = await exportBackup(db);

  try {
    return await replaceWith(db, backup, sources);
  } catch (error) {
    try {
      await replaceWith(db, current, sources);
    } catch (fallback) {
      throw new RestoreError(
        `The backup could not be restored (${messageOf(error)}), and putting back what was ` +
        `there failed too (${messageOf(fallback)}). The backup file itself is untouched.`,
      );
    }
    throw new RestoreError(
      `The backup could not be restored: ${messageOf(error)}. Nothing was changed - ` +
      `the data is exactly as it was before.`,
    );
  }
}

/** Drops everything, rebuilds the schema the rows came from, and puts them in. */
async function replaceWith(
  db: SqlDriver,
  backup: Backup,
  sources: readonly MigrationSource[],
): Promise<RestoreResult> {
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

  // Rows go in with foreign keys off, and every reference is checked before
  // the commit instead. Order alone cannot be trusted: a category can point at
  // a parent with a higher id, and a backup written by an older build lists
  // its tables in whatever order that build had. The pragma only takes effect
  // outside a transaction, which is why it wraps the transaction rather than
  // sitting inside it.
  await db.execute('PRAGMA foreign_keys = OFF');
  try {
    await db.transaction(async () => {
      for (const table of insertOrder(Object.keys(backup.tables))) {
        const stored = backup.tables[table];
        if (!Array.isArray(stored) || stored.length === 0) continue;
        const rows = table === 'categories' ? parentsFirst(stored) : stored;

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

      const broken = await db.query<{ table: string; rowid: number; parent: string }>('PRAGMA foreign_key_check');
      if (broken.length > 0) {
        const first = broken[0];
        throw new RestoreError(
          `${broken.length} rows point at rows the backup does not hold ` +
          `(the first is row ${first.rowid} of ${first.table}, pointing at ${first.parent})`,
        );
      }
    });
  } finally {
    await db.execute('PRAGMA foreign_keys = ON');
  }

  // And forward to today, applying every migration written since — including
  // the ones that carry data.
  const forward = await migrate(db, sources);

  return { fromVersion: backup.schemaVersion, toVersion: forward.to, restored };
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * The order rows go in: parents before children, whatever order the file
 * lists its tables in.
 *
 * Turning foreign keys off for the load is not enough on its own. In the
 * browser the plugin ignores that pragma, so Jose's backup - written by a
 * build that listed transactions before import_batches - still failed with
 * foreign keys fully enforced. The order has to be right by construction:
 * this build's own table list, which is kept in dependency order, and then
 * anything it does not know, which can only be a table an older schema had.
 */
function insertOrder(tables: string[]): string[] {
  const known: readonly string[] = TABLES;
  return [
    ...known.filter(table => tables.includes(table)),
    ...tables.filter(table => !known.includes(table)),
  ];
}

/**
 * Categories nest, and a parent can have a higher id than its child, so
 * parents go in first. A row whose parent never appears is left for the end,
 * where the foreign key check names it.
 */
function parentsFirst(rows: unknown[]): unknown[] {
  const pending = [...rows] as Record<string, unknown>[];
  const placed = new Set<unknown>();
  const ordered: Record<string, unknown>[] = [];

  while (pending.length > 0) {
    const before = pending.length;
    for (let at = 0; at < pending.length;) {
      const row = pending[at];
      if (row['parent_id'] === null || row['parent_id'] === undefined || placed.has(row['parent_id'])) {
        ordered.push(row);
        placed.add(row['id']);
        pending.splice(at, 1);
      } else {
        at += 1;
      }
    }
    if (pending.length === before) {
      ordered.push(...pending);
      break;
    }
  }
  return ordered;
}

/**
 * Children before parents.
 *
 * The export writes parents first so a restore can replay them in order; this
 * is that order reversed, with anything unrecognised dropped first — a table
 * this build has never heard of cannot be a parent of one it has.
 */
function dropOrder(tables: string[]): string[] {
  // The export's own list, not a copy of it: two lists kept by hand drift, and
  // they had.
  const known: readonly string[] = TABLES;

  const unknown = tables.filter(table => !known.includes(table));
  const inOrder = known.filter(table => tables.includes(table)).reverse();
  return [...unknown, ...inOrder];
}
