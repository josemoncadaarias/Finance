// Tests for the migration runner.
//
//   node --test tools/db/migration-runner.test.mjs

import test from 'node:test';
import assert from 'node:assert/strict';

import { NodeSqlDriver } from './node-sql-driver.mjs';
import { migrate, currentVersion, targetVersion, MigrationError }
  from '../../src/app/core/database/migrations/migration-runner.ts';
import { MIGRATION_SOURCES }
  from '../../src/app/core/database/migrations/statements.generated.ts';

test('a fresh database gets every migration and lands on the target version', async () => {
  const driver = new NodeSqlDriver();
  assert.equal(await currentVersion(driver), 0);

  const result = await migrate(driver, MIGRATION_SOURCES);

  assert.equal(result.from, 0);
  assert.equal(result.to, targetVersion(MIGRATION_SOURCES));
  assert.equal(result.applied.length, MIGRATION_SOURCES.length);
  assert.equal(await currentVersion(driver), targetVersion(MIGRATION_SOURCES));

  const tables = await driver.query(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
  );
  assert.equal(tables.length, 14);
  await driver.close();
});

test('migrating twice is a no-op, so it is safe on every start', async () => {
  const driver = new NodeSqlDriver();
  await migrate(driver, MIGRATION_SOURCES);

  const second = await migrate(driver, MIGRATION_SOURCES);
  assert.equal(second.applied.length, 0);
  assert.equal(second.from, targetVersion(MIGRATION_SOURCES));
  assert.equal(second.to, targetVersion(MIGRATION_SOURCES));
  await driver.close();
});

test('only migrations newer than the stored version run', async () => {
  const driver = new NodeSqlDriver();
  await migrate(driver, MIGRATION_SOURCES);

  const extra = [
    ...MIGRATION_SOURCES,
    { version: 99, name: 'later', file: '099_later.sql', sql: 'CREATE TABLE later (id INTEGER PRIMARY KEY);' },
  ];
  const result = await migrate(driver, extra);

  assert.deepEqual(result.applied.map(m => m.version), [99]);
  assert.equal(await currentVersion(driver), 99);
  await driver.close();
});

test('a failed migration rolls back and leaves the version untouched', async () => {
  const driver = new NodeSqlDriver();
  await migrate(driver, MIGRATION_SOURCES);
  const before = await currentVersion(driver);

  const broken = [
    ...MIGRATION_SOURCES,
    {
      version: 99,
      name: 'broken',
      file: '099_broken.sql',
      // The first statement is valid, the second is not: both must be undone.
      sql: 'CREATE TABLE half_done (id INTEGER PRIMARY KEY); CREATE TABLE oops (bad SYNTAX HERE (;',
    },
  ];

  await assert.rejects(() => migrate(driver, broken), MigrationError);
  assert.equal(await currentVersion(driver), before, 'version must not advance');

  const leftovers = await driver.query("SELECT name FROM sqlite_master WHERE name = 'half_done'");
  assert.equal(leftovers.length, 0, 'the partial table must have been rolled back');
  await driver.close();
});

test('a database from a newer build is refused rather than corrupted', async () => {
  const driver = new NodeSqlDriver();
  await migrate(driver, MIGRATION_SOURCES);
  await driver.execute('PRAGMA user_version = 999');

  await assert.rejects(() => migrate(driver, MIGRATION_SOURCES), /only knows up to/);
  await driver.close();
});

test('a transaction rolls back every write when the work throws', async () => {
  const driver = new NodeSqlDriver();
  await migrate(driver, MIGRATION_SOURCES);

  await assert.rejects(() =>
    driver.transaction(async () => {
      await driver.run(
        `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)`,
        ['half_written', 'x', '2026-09-08T00:00:00Z'],
      );
      throw new Error('boom');
    }),
  );

  const row = await driver.queryOne("SELECT value FROM settings WHERE key = 'half_written'");
  assert.equal(row, null);
  await driver.close();
});

test('the generated statements match the .sql files on disk', async () => {
  // Guards the one thing the generator can get wrong: going stale.
  const { buildSource } = await import('./build-migrations.mjs');
  assert.ok(buildSource().includes("name: 'initial_schema'"));
});
