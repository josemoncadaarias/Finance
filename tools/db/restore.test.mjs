// Reading a backup back.
//
//   node --import ./tools/db/register-ts.mjs --test tools/db/restore.test.mjs
//
// Writing a backup has existed for a while; reading one had not, so the file
// the app told people to keep was a file nothing could open. These tests are
// the reason to believe it now can - a restore that has never been run is
// exactly as useful as no restore at all.

import test from 'node:test';
import assert from 'node:assert/strict';

import { NodeSqlDriver } from './node-sql-driver.mjs';
import { migrate, currentVersion } from '../../src/app/core/database/migrations/migration-runner.ts';
import { MIGRATION_SOURCES } from '../../src/app/core/database/migrations/statements.generated.ts';
import { AccountsRepository } from '../../src/app/core/database/repositories/accounts.repository.ts';
import { CategoriesRepository } from '../../src/app/core/database/repositories/categories.repository.ts';
import { TransactionsRepository } from '../../src/app/core/database/repositories/transactions.repository.ts';
import { CustomIconsRepository } from '../../src/app/core/database/repositories/custom-icons.repository.ts';
import { exportBackup, toJson } from '../../src/app/core/database/export/export-backup.ts';
import { parseBackup, restoreBackup, RestoreError }
  from '../../src/app/core/database/export/restore-backup.ts';

const NOW = () => '2026-09-11T12:00:00Z';

/** A database with enough in it that a restore has something to get wrong. */
async function seeded() {
  const db = new NodeSqlDriver();
  await migrate(db, MIGRATION_SOURCES);

  const accounts = new AccountsRepository(db, NOW);
  const categories = new CategoriesRepository(db, NOW);
  const transactions = new TransactionsRepository(db, NOW);
  const icons = new CustomIconsRepository(db, NOW);

  const rappi = await accounts.create({
    name: 'Rappi cuenta', type: 'debit', currency_code: 'COP', builtin_icon: 'wallet',
    opening_balance_minor: 6_795_974_641, opened_on: '2021-07-01',
  });
  const arq = await accounts.create({
    name: 'ARQ USD', type: 'investment', currency_code: 'USD', builtin_icon: 'trending-up',
    opening_balance_minor: 201_333, opened_on: '2024-08-13',
  });
  const comida = await categories.create({ name: 'Restaurante', kind: 'expense', builtin_icon: 'restaurant' });

  for (const [day, amount] of [['2026-09-08', -4_500_000], ['2026-09-09', -1_200_000]]) {
    await transactions.create({
      account_id: rappi, category_id: comida, occurred_on: day,
      amount_minor: amount, source: 'manual', description: 'Almuerzo',
    });
  }

  // A BLOB, because bytes are the thing a JSON round trip is most likely to
  // quietly ruin.
  await icons.create({
    name: 'Logo', mime_type: 'image/png',
    data: Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  });

  return { db, accounts, transactions, icons, ids: { rappi, arq, comida } };
}

test('a backup written today comes back exactly as it went out', async () => {
  const source = await seeded();
  const text = toJson(await exportBackup(source.db));

  // A different database, with different data in it.
  const target = await seeded();
  const targetAccounts = new AccountsRepository(target.db, NOW);
  await targetAccounts.create({
    name: 'Cuenta que no debería sobrevivir', type: 'debit', currency_code: 'COP',
    builtin_icon: 'wallet', opened_on: '2026-01-01',
  });

  const result = await restoreBackup(target.db, parseBackup(text), MIGRATION_SOURCES);

  assert.equal(result.fromVersion, await currentVersion(source.db));
  assert.equal(result.toVersion, result.fromVersion, 'nothing to bring forward');

  const restored = await new AccountsRepository(target.db, NOW).list();
  assert.deepEqual(restored.map(account => account.name).sort(),
    ['ARQ USD', 'Rappi cuenta'], 'what was there before is gone, not merged');

  const balances = await new AccountsRepository(target.db, NOW).balances();
  const rappi = balances.find(balance => balance.account.name === 'Rappi cuenta');
  assert.equal(rappi.balance_minor, 6_795_974_641 - 4_500_000 - 1_200_000);
});

test('the bytes of an icon survive the round trip', async () => {
  const source = await seeded();
  const text = toJson(await exportBackup(source.db));

  const target = new NodeSqlDriver();
  await migrate(target, MIGRATION_SOURCES);
  await restoreBackup(target, parseBackup(text), MIGRATION_SOURCES);

  const icons = await new CustomIconsRepository(target, NOW).list();
  assert.equal(icons.length, 1);

  const stored = await target.queryOne('SELECT data FROM custom_icons WHERE id = 1');
  assert.deepEqual([...stored.data], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
    'a BLOB is the thing a JSON round trip is most likely to ruin');
});

test('an older backup is brought forward, migrations and all', async () => {
  // A database that stopped at schema 3, the way a file kept since then would
  // have been written.
  const old = new NodeSqlDriver();
  const upTo3 = MIGRATION_SOURCES.filter(source => source.version <= 3);
  await migrate(old, upTo3);

  const accounts = new AccountsRepository(old, NOW);
  await accounts.create({
    name: 'Rappi cuenta', type: 'debit', currency_code: 'COP', builtin_icon: 'wallet',
    opening_balance_minor: 100_000_000, opened_on: '2021-07-01',
  });

  const text = toJson(await exportBackup(old));
  const backup = parseBackup(text);
  assert.equal(backup.schemaVersion, 3);

  const target = new NodeSqlDriver();
  await migrate(target, MIGRATION_SOURCES);
  const result = await restoreBackup(target, backup, MIGRATION_SOURCES);

  assert.equal(result.fromVersion, 3);
  assert.equal(result.toVersion, await currentVersion(target));
  assert.ok(result.toVersion > 3, 'and it did not stay in the past');

  // The account is there, and so is everything the later migrations added.
  const restored = await new AccountsRepository(target, NOW).list();
  assert.equal(restored.length, 1);
  assert.equal(restored[0].name, 'Rappi cuenta');

  const tables = await target.query(
    "SELECT name FROM sqlite_master WHERE type='table' AND name = 'yield_pockets'");
  assert.equal(tables.length, 1, 'a table added after the backup was written');
});

test('a restore is all or nothing', async () => {
  const source = await seeded();
  const backup = parseBackup(toJson(await exportBackup(source.db)));

  // A row the schema will refuse: two accounts cannot share a name.
  backup.tables.accounts.push({ ...backup.tables.accounts[0], id: 999 });

  const target = await seeded();
  const before = (await new AccountsRepository(target.db, NOW).list()).length;

  await assert.rejects(() => restoreBackup(target.db, backup, MIGRATION_SOURCES));

  // The rows are rolled back. The schema is not - the tables were dropped and
  // rebuilt before the transaction opened - so what is left is an empty
  // database at the right version, not a half-written one.
  const after = await new AccountsRepository(target.db, NOW).list();
  assert.equal(after.length, 0, `had ${before}, restore failed, left ${after.length}`);
  assert.equal(await currentVersion(target.db), backup.schemaVersion);
});

test('anything that is not one of our backups is refused', async () => {
  assert.throws(() => parseBackup('not json at all'), RestoreError);
  assert.throws(() => parseBackup('{"app":"something else"}'), RestoreError);
  assert.throws(() => parseBackup('{"app":"finance"}'), RestoreError, 'no schema version');
  assert.throws(() => parseBackup('{"app":"finance","schemaVersion":3}'), RestoreError, 'no tables');
});

test('a backup from a newer app is refused rather than half-read', async () => {
  const source = await seeded();
  const backup = parseBackup(toJson(await exportBackup(source.db)));
  backup.schemaVersion = 999;

  await assert.rejects(
    () => restoreBackup(source.db, backup, MIGRATION_SOURCES),
    /newer version/,
    'reading it with an older schema would drop whatever it added');
});

test('restoring twice lands in the same place', async () => {
  const source = await seeded();
  const backup = parseBackup(toJson(await exportBackup(source.db)));

  const target = new NodeSqlDriver();
  await migrate(target, MIGRATION_SOURCES);

  await restoreBackup(target, backup, MIGRATION_SOURCES);
  const once = await new AccountsRepository(target, NOW).balances();

  await restoreBackup(target, backup, MIGRATION_SOURCES);
  const twice = await new AccountsRepository(target, NOW).balances();

  assert.deepEqual(
    twice.map(balance => [balance.account.name, balance.balance_minor]),
    once.map(balance => [balance.account.name, balance.balance_minor]));
});
