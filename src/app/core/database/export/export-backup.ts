/**
 * The backup: everything, in a form that can be read back.
 *
 * This database is the only copy of five years of history. A CSV is for
 * reading; this is for surviving a lost phone. It carries every table as it
 * stands — including the things a CSV cannot express: which leg belongs to
 * which transfer, which rows were corrected by hand and are protected from
 * re-import, what a credit limit was in 2023, the images used as icons.
 *
 * JSON rather than a copy of the SQLite file. The file lives inside the app's
 * private storage on Android and inside IndexedDB in a browser, and neither
 * hands it over as bytes; JSON is something both can produce and both can read
 * back. It also survives a schema change, which a raw file does not.
 */

import type { SqlDriver } from '../sql-driver';

export interface Backup {
  /** What produced it, so an old file is recognisable. */
  app: 'finance';
  version: number;
  /** The schema version the data came from. */
  schemaVersion: number;
  exportedAt: string;
  tables: Record<string, unknown[]>;
}

/**
 * The tables worth carrying, in an order that could be replayed.
 *
 * Parents before children: currencies before accounts, accounts before
 * transactions, transfers before the legs that point at them. A restore that
 * inserted them the other way round would trip every foreign key.
 */
const TABLES = [
  'currencies',
  'custom_icons',
  'account_groups',
  'accounts',
  'categories',
  'transfers',
  'transactions',
  'exchange_rates',
  'account_rates',
  'credit_limit_changes',
  'interest_accruals',
  'cashbacks',
  'import_batches',
  'review_queue',
  'settings',
] as const;

/** The format of the file itself, so a future reader knows what it is holding. */
const BACKUP_VERSION = 1;

export async function exportBackup(db: SqlDriver): Promise<Backup> {
  const version = await db.queryOne<{ user_version: number }>('PRAGMA user_version');

  const tables: Record<string, unknown[]> = {};
  for (const table of TABLES) {
    tables[table] = await db.query(`SELECT * FROM ${table}`);
  }

  return {
    app: 'finance',
    version: BACKUP_VERSION,
    schemaVersion: version?.user_version ?? 0,
    exportedAt: new Date().toISOString(),
    tables,
  };
}

/**
 * How many rows a backup holds, for telling someone what they just saved.
 *
 * "12,899 movements, 36 accounts" is a claim they can check; "backup complete"
 * is not.
 */
export function backupSummary(backup: Backup): { table: string; rows: number }[] {
  return Object.entries(backup.tables)
    .map(([table, rows]) => ({ table, rows: rows.length }))
    .filter(entry => entry.rows > 0)
    .sort((a, b) => b.rows - a.rows);
}

/**
 * Turns a backup into text.
 *
 * Indented on purpose: it makes the file bigger, and it also makes it
 * inspectable in any text editor, which is worth more for something whose job
 * is to be trusted years from now. A BLOB (an icon image) arrives as an array
 * of byte values and survives the round trip that way.
 */
export function toJson(backup: Backup): string {
  return JSON.stringify(backup, (_key, value) => {
    if (value instanceof Uint8Array) return { __bytes: [...value] };
    return value;
  }, 2);
}
