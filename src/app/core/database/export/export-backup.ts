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
import type { OnProgress } from './progress';

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
export const TABLES = [
  'currencies',
  'custom_icons',
  'account_groups',
  'accounts',
  // The names an account was imported under before it was renamed. Without
  // them the next import would bring the old name back as a new account.
  'account_aliases',
  'categories',
  // Before the movements: a movement points at the import batch it came from
  // and at the product it went to. With these after it, restoring any
  // imported history failed on its first row - see restore-backup.ts.
  'import_batches',
  'yield_accounts',
  'products',
  'product_balances',
  'yield_rates',
  'transfers',
  'transactions',
  'exchange_rates',
  // The DANE's index, as fetched or typed (migration 046).
  'inflation_months',
  'yield_days',
  'cashback_rules',
  'cashback_entries',
  // Before the entries, which point at them.
  'product_kinds',
  'product_entries',
  'product_cashouts',
  'tax_parameters',
  'credit_limit_changes',
  // What the app has read and nobody has answered yet, and what it has learned
  // about where a merchant is filed. After the movements and the categories,
  // which a proposal points at.
  'movement_proposals',
  'merchant_categories',
  'review_queue',
  // Without these, restoring would bring back every movement deleted by hand.
  'deleted_imports',
  // The income-tax simulation of every year. It was missing for a day, and a
  // restore would have brought every account back and every return typed in
  // gone - while the settings table, which was carried, said its empty boxes
  // had already been filled.
  'tax_simulations',
  'settings',
] as const;

/** The format of the file itself, so a future reader knows what it is holding. */
const BACKUP_VERSION = 1;

export async function exportBackup(db: SqlDriver, onProgress?: OnProgress): Promise<Backup> {
  const version = await db.queryOne<{ user_version: number }>('PRAGMA user_version');

  // Only what is actually there. The list above is today's schema, and a build
  // running an older one has fewer of those tables — asking for one that does
  // not exist yet would fail the whole export rather than write a smaller file.
  const present = new Set((await db.query<{ name: string }>(
    `SELECT name FROM sqlite_master WHERE type = 'table'`)).map(row => row.name));

  // One step per table, so a screen can say how far along it is. The row
  // counts are wildly uneven - transactions is most of the file - but the
  // steps are what is known before the work starts.
  const wanted = TABLES.filter(table => present.has(table));
  const tables: Record<string, unknown[]> = {};
  let done = 0;
  for (const table of wanted) {
    tables[table] = await db.query(`SELECT * FROM ${table}`);
    await onProgress?.({ done: ++done, total: wanted.length });
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
