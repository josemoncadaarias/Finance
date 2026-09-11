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
 *   1. Add `00N_what_it_does.sql` next to this file. **Never edit an applied
 *      migration**: a database that has already passed it will never read the
 *      file again, so the edit reaches nothing and only breaks whatever comes
 *      next. That happened on 2026-09-09 and left the app unable to open.
 *      `tools/db/migration-checksums.test.mjs` now enforces this.
 *   2. Run `node tools/db/build-migrations.mjs`.
 *   3. Run `node tools/db/record-migration-checksums.mjs`.
 *   4. Add a case to the schema tests.
 */

// Both imports are type-only and vanish at runtime, so this module has no
// runtime dependencies at all. The caller passes the migrations in — which is
// also why the tests can drive it with a made-up broken migration.
import type { SqlDriver } from '../sql-driver';
import type { MigrationSource } from './statements.generated';
import { REPAIRS } from './repairs';

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
      // This message is the only thing anyone will ever see about the failure,
      // and it has to survive being read off a screenshot of a phone. So it
      // names the file, what SQLite actually said, and — when the driver knows
      // it — the statement that was running. Without that last part,
      // diagnosing a migration failure on a device is guesswork.
      const reason = error instanceof Error ? error.message : String(error);
      const sql = (error as { sql?: unknown }).sql;
      const where = typeof sql === 'string' ? ` while running: ${firstLineOf(sql)}` : '';

      throw new MigrationError(
        `Migration ${migration.file} failed: ${reason}${where}`,
        migration,
        error,
      );
    }
    applied.push(migration);
  }

  // Migrations a plugin skipped while reporting success. Checked on every
  // start, and cheap when there is nothing to do: one read per repair.
  const version = await currentVersion(driver);
  for (const repair of REPAIRS) {
    if (repair.version > version || await repair.applied(driver)) continue;
    const migration = sources.find(source => source.version === repair.version);
    if (!migration) continue;

    try {
      await driver.transaction(async () => {
        await driver.execute(repair.sql ?? migration.sql);
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new MigrationError(`Repairing migration ${migration.file} failed: ${reason}`, migration, error);
    }
  }

  return { from, to: await currentVersion(driver), applied };
}

/** The opening of a statement: enough to recognise it, short enough to read. */
function firstLineOf(sql: string): string {
  const line = sql.split('\n').map(part => part.trim()).find(part => part.length > 0) ?? '';
  return line.length > 120 ? `${line.slice(0, 120)}...` : line;
}
