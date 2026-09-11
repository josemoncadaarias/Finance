/**
 * Migrations a SQLite plugin let through without running, put right.
 *
 * In the browser, jeep-sqlite removes every newline from a string that
 * contains "DELETE FROM" before running it. A migration opens with `--`
 * comments, so the first comment swallowed the whole migration: SQLite was
 * handed nothing but a comment, succeeded at doing nothing, and the runner
 * moved `user_version` past it. Every migration whose text mentions DELETE
 * FROM was hit - 023, 024, 025, 026 and 030. `plugin-sql.ts` stops it happening
 * again; this puts back what a database that already went through it is
 * missing.
 *
 * A repair runs only when what its migration creates is not there, so on a
 * database where the migration did run - every phone the plugin split
 * correctly, every test - nothing happens.
 *
 * 024, 025 and 026 are deliberately not repaired. They moved and deleted an
 * account by its name to remove a duplicate card, Jose removed that duplicate
 * in the app afterwards, and re-running a delete by name now could only find
 * the wrong account.
 */

import type { SqlDriver } from '../sql-driver';

export interface Repair {
  /** The migration that may have been skipped. */
  version: number;
  /** Whether what it creates is there. */
  applied: (driver: SqlDriver) => Promise<boolean>;
  /** What to run when it is not. Null runs the migration's own SQL. */
  sql: string | null;
}

async function hasTable(driver: SqlDriver, table: string): Promise<boolean> {
  const row = await driver.queryOne<{ found: number }>(
    "SELECT 1 AS found FROM sqlite_master WHERE type = 'table' AND name = ?", [table]);
  return !!row;
}

async function hasColumn(driver: SqlDriver, table: string, column: string): Promise<boolean> {
  const columns = await driver.query<{ name: string }>(`PRAGMA table_info(${table})`);
  return columns.some(candidate => candidate.name === column);
}

export const REPAIRS: readonly Repair[] = [
  {
    // Only the table 023 created and the alias it recorded - not the movements
    // it moved or the account it deleted, for the reason above. The table is
    // written exactly as 023 wrote it.
    version: 23,
    applied: driver => hasTable(driver, 'account_aliases'),
    sql: `CREATE TABLE IF NOT EXISTS account_aliases (
  source_name TEXT    PRIMARY KEY,
  account_id  INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  note        TEXT,
  created_at  TEXT    NOT NULL,
  updated_at  TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_account_aliases_account ON account_aliases(account_id);
INSERT OR IGNORE INTO account_aliases (source_name, account_id, note, created_at, updated_at)
SELECT 'Tarjeta crédito rappi', id, 'Renamed to Rappi Card', '2026-09-11T00:00:00Z', '2026-09-11T00:00:00Z'
FROM accounts WHERE lower(name) = 'rappi card';
`,
  },
  {
    // The whole of 030: its columns, the rates copied onto products and how
    // each product is paid. Nothing in it can land twice - it only runs when
    // its first column is missing.
    version: 30,
    applied: driver => hasColumn(driver, 'yield_pockets', 'payout'),
    sql: null,
  },
];
