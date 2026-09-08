/**
 * Schema migrations.
 *
 * SQLite has no migration tooling of its own. What it does have is
 * `PRAGMA user_version`, an integer stored inside the database file, which
 * starts at 0. The runner reads it, applies whatever migrations come after it
 * in order, and leaves it pointing at the last one applied. That is the whole
 * mechanism — the same idea as EF Core migrations, minus the framework.
 *
 * Rules for adding one:
 *
 *   1. Add `00N_what_it_does.sql` next to this file. Never edit an applied
 *      migration: someone's phone has already run it.
 *   2. Run `node tools/db/build-migrations.mjs`.
 *   3. Add a case to the schema tests.
 */

// Both imports are type-only and vanish at runtime, so this module has no
// runtime dependencies at all. The caller passes the migrations in — which is
// also why the tests can drive it with a made-up broken migration.
import type { SqlDriver } from '../sql-driver';
import type { MigrationSource } from './statements.generated';

export interface MigrationResult {
  from: number;
  to: number;
  applied: MigrationSource[];
}

export class MigrationError extends Error {
  readonly migration: MigrationSource;
  override readonly cause?: unknown;

  constructor(message: string, migration: MigrationSource, cause?: unknown) {
    super(message);
    this.name = 'MigrationError';
    this.migration = migration;
    this.cause = cause;
  }
}

/** The version the code expects a fully migrated database to be at. */
export function targetVersion(sources: readonly MigrationSource[]): number {
  return sources.reduce((max, m) => Math.max(max, m.version), 0);
}

export async function currentVersion(driver: SqlDriver): Promise<number> {
  const row = await driver.queryOne<{ user_version: number }>('PRAGMA user_version');
  return row?.user_version ?? 0;
}

/**
 * Brings the database up to the latest schema version. Safe to call on every
 * start: with nothing to do it costs one PRAGMA read.
 */
export async function migrate(
  driver: SqlDriver,
  sources: readonly MigrationSource[],
): Promise<MigrationResult> {
  const from = await currentVersion(driver);
  const target = targetVersion(sources);

  if (from > target) {
    // An older build opening a database a newer build has already upgraded.
    // Carrying on would corrupt data against a schema this code cannot see.
    throw new Error(
      `Database is at version ${from} but this build only knows up to ${target}. ` +
        'Update the app rather than downgrading the database.',
    );
  }

  const pending = sources.filter(m => m.version > from).sort((a, b) => a.version - b.version);
  const applied: MigrationSource[] = [];

  for (const migration of pending) {
    // Each migration is its own transaction, so a failure leaves the database
    // at the last version that fully succeeded rather than half-upgraded.
    try {
      await driver.transaction(async () => {
        await driver.execute(migration.sql);
        // user_version does not accept a bound parameter. The value comes from
        // the migration file name, which the generator has already validated
        // as three digits, so there is nothing here to inject.
        await driver.execute(`PRAGMA user_version = ${migration.version}`);
      });
    } catch (error) {
      throw new MigrationError(
        `Migration ${migration.file} failed: ${error instanceof Error ? error.message : String(error)}`,
        migration,
        error,
      );
    }
    applied.push(migration);
  }

  return { from, to: await currentVersion(driver), applied };
}
