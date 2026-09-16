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

test('a restore that fails leaves the data it found', async () => {
  const source = await seeded();
  const backup = parseBackup(toJson(await exportBackup(source.db)));

  // A row the schema will refuse: two accounts cannot share a name.
  backup.tables.accounts.push({ ...backup.tables.accounts[0], id: 999 });

  const target = await seeded();
  const accounts = new AccountsRepository(target.db, NOW);
  await accounts.create({
    name: 'Solo en el destino', type: 'debit', currency_code: 'COP', builtin_icon: 'wallet', opened_on: '2026-01-01',
  });
  const before = (await accounts.list()).map(account => account.name).sort();
  const balancesBefore = (await accounts.balances()).map(b => [b.account.name, b.balance_minor]);

  await assert.rejects(() => restoreBackup(target.db, backup, MIGRATION_SOURCES), RestoreError);

  // This test used to expect an empty database here. That was data loss
  // written down as a rule: the tables were dropped before the rows were known
  // to fit. Jose lost the browser copy of five years of history to exactly this
  // on 2026-09-11. What was there before a failed restore is still there after.
  const after = await new AccountsRepository(target.db, NOW);
  assert.deepEqual((await after.list()).map(account => account.name).sort(), before);
  assert.deepEqual((await after.balances()).map(b => [b.account.name, b.balance_minor]), balancesBefore);
  assert.equal(await currentVersion(target.db), MIGRATION_SOURCES.length, 'and at today\'s schema');
});

test('a backup of imported movements, products and nested categories comes back whole', async () => {
  const { YieldsRepository } = await import('../../src/app/core/database/repositories/yields.repository.ts');

  // What a real database holds and the seeded one did not: movements that
  // point at an import batch and at a product, both exported after the
  // movements, and a category whose parent has a higher id than it does.
  const source = await seeded();
  const db = source.db;

  await db.run("INSERT INTO import_batches (file_name, file_hash, imported_at) VALUES ('monefy.csv', 'hash', ?)", [NOW()]);
  const batch = (await db.queryOne('SELECT MAX(id) AS id FROM import_batches')).id;

  const yields = new YieldsRepository(db, NOW);
  await yields.enrol({ account_id: source.ids.rappi, opening_cushion_minor: 0, opening_on: '2025-12-30' });
  const [pocket] = await yields.pockets(source.ids.rappi);

  const categories = new CategoriesRepository(db, NOW);
  const child = await categories.create({ name: 'Almuerzos', kind: 'expense', builtin_icon: 'restaurant' });
  const parent = await categories.create({ name: 'Comida afuera', kind: 'expense', builtin_icon: 'restaurant' });
  await db.run('UPDATE categories SET parent_id = ? WHERE id = ?', [parent, child]);
  assert.ok(parent > child, 'the parent comes after its child in id order');

  await db.run(
    `INSERT INTO transactions (account_id, category_id, occurred_on, amount_minor, amount_base_minor, source,
       import_fingerprint, import_seq, import_batch_id, pocket_id, created_at, updated_at)
     VALUES (?, ?, '2026-09-01', -250000, -250000, 'monefy', 'fingerprint', 1, ?, ?, ?, ?)`,
    [source.ids.rappi, child, batch, pocket.id, NOW(), NOW()]);

  const counts = async target => Object.fromEntries(await Promise.all(
    ['accounts', 'categories', 'transactions', 'import_batches', 'yield_pockets'].map(async table =>
      [table, (await target.queryOne(`SELECT COUNT(*) AS n FROM ${table}`)).n])));
  const expected = await counts(db);

  const text = toJson(await exportBackup(db));
  const target = await seeded();
  await restoreBackup(target.db, parseBackup(text), MIGRATION_SOURCES);

  assert.deepEqual(await counts(target.db), expected);
  assert.deepEqual(await target.db.query('PRAGMA foreign_key_check'), [], 'every reference points somewhere');
  const imported = await target.db.queryOne("SELECT import_batch_id, pocket_id FROM transactions WHERE source = 'monefy'");
  assert.deepEqual({ ...imported }, { import_batch_id: batch, pocket_id: pocket.id });
  assert.equal((await target.db.queryOne('PRAGMA foreign_keys')).foreign_keys, 1, 'foreign keys are back on');
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

test('every table the migrations create is carried by the backup', async () => {
  const { TABLES } = await import('../../src/app/core/database/export/export-backup.ts');
  const db = new NodeSqlDriver();
  await migrate(db, MIGRATION_SOURCES);

  // A table added by a migration and forgotten here is data a restore silently
  // throws away. It happened: the tax simulations and the account aliases.
  const tables = (await db.query(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'"))
    .map(row => row.name);
  const missing = tables.filter(name => !TABLES.includes(name));
  assert.deepEqual(missing, [], `not in the backup: ${missing.join(', ')}`);
  await db.close();
});

test('the tax simulation and the account aliases come back from a backup', async () => {
  const { TaxSimulationsRepository } = await import(
    '../../src/app/core/database/repositories/tax-simulations.repository.ts');
  const { defaultInputs } = await import('../../src/app/core/tax/defaults.ts');

  const source = await seeded();
  const simulations = new TaxSimulationsRepository(source.db, () => NOW());
  await simulations.save(2026, { ...defaultInputs(2026), monthlySalaryMinor: 2_276_176_500, dependents: 2 });
  await simulations.markGapsFilled(2026);
  await source.db.run(
    'INSERT INTO account_aliases (source_name, account_id, created_at, updated_at) VALUES (?, ?, ?, ?)',
    ['Rappi', source.ids.rappi, NOW(), NOW()]);

  const text = toJson(await exportBackup(source.db));
  const target = new NodeSqlDriver();
  await migrate(target, MIGRATION_SOURCES);
  await restoreBackup(target, parseBackup(text), MIGRATION_SOURCES);

  const restored = await new TaxSimulationsRepository(target, () => NOW()).get(2026);
  assert.equal(restored.monthlySalaryMinor, 2_276_176_500);
  assert.equal(restored.dependents, 2);
  assert.equal(await new TaxSimulationsRepository(target, () => NOW()).gapsFilled(2026), true);

  const aliases = await target.query('SELECT source_name FROM account_aliases WHERE account_id = ?', [source.ids.rappi]);
  assert.deepEqual(aliases.map(row => row.source_name), ['Rappi']);
});

test('a backup comes back even where foreign keys cannot be turned off, whatever order its tables are in', async () => {
  const { YieldsRepository } = await import('../../src/app/core/database/repositories/yields.repository.ts');

  // The browser's SQLite ignores PRAGMA foreign_keys, so every row is checked
  // as it goes in. This driver behaves the same way, and the backup lists its
  // tables backwards - the worst order an old file could have.
  class BrowserLikeDriver extends NodeSqlDriver {
    async execute(sql) {
      // Only the statement itself: migration 001 mentions the pragma in a comment.
      if (/^\s*PRAGMA\s+foreign_keys\s*=/i.test(sql)) return;
      return super.execute(sql);
    }
  }

  const source = await seeded();
  const db = source.db;
  await db.run("INSERT INTO import_batches (file_name, file_hash, imported_at) VALUES ('monefy.csv', 'hash', ?)", [NOW()]);
  const batch = (await db.queryOne('SELECT MAX(id) AS id FROM import_batches')).id;
  const yields = new YieldsRepository(db, NOW);
  await yields.enrol({ account_id: source.ids.rappi, opening_cushion_minor: 0, opening_on: '2025-12-30' });
  const [pocket] = await yields.pockets(source.ids.rappi);
  const categories = new CategoriesRepository(db, NOW);
  const child = await categories.create({ name: 'Almuerzos', kind: 'expense', builtin_icon: 'restaurant' });
  const parent = await categories.create({ name: 'Comida afuera', kind: 'expense', builtin_icon: 'restaurant' });
  await db.run('UPDATE categories SET parent_id = ? WHERE id = ?', [parent, child]);
  await db.run(
    `INSERT INTO transactions (account_id, category_id, occurred_on, amount_minor, amount_base_minor, source,
       import_fingerprint, import_seq, import_batch_id, pocket_id, created_at, updated_at)
     VALUES (?, ?, '2026-09-01', -250000, -250000, 'monefy', 'fingerprint', 1, ?, ?, ?, ?)`,
    [source.ids.rappi, child, batch, pocket.id, NOW(), NOW()]);

  const backup = parseBackup(toJson(await exportBackup(db)));
  backup.tables = Object.fromEntries(Object.entries(backup.tables).reverse());

  const target = new BrowserLikeDriver();
  await migrate(target, MIGRATION_SOURCES);
  await restoreBackup(target, backup, MIGRATION_SOURCES);

  for (const table of ['accounts', 'categories', 'transactions', 'import_batches', 'yield_pockets']) {
    assert.equal(
      (await target.queryOne(`SELECT COUNT(*) AS n FROM ${table}`)).n,
      (await db.queryOne(`SELECT COUNT(*) AS n FROM ${table}`)).n,
      `${table} came back whole`);
  }
});


// ---------------------------------------------------------------------------
// Telling the screen how far along it is. Restoring Jose's history on his phone
// ran for minutes behind a screen that said nothing, which reads as a crash.

test('a restore says how far along it is, in rows, ending at the total', async () => {
  const source = await seeded();
  const backup = await exportBackup(source.db);
  const rows = Object.values(backup.tables).reduce((sum, table) => sum + table.length, 0);

  const target = await seeded();
  const seen = [];
  await restoreBackup(target.db, backup, MIGRATION_SOURCES, step => { seen.push(step); });

  assert.ok(seen.length > 0, 'it reports at all');
  assert.ok(seen.every(step => step.total === rows), 'every report counts the same total');
  assert.deepEqual(
    seen.map(step => step.done),
    [...seen.map(step => step.done)].sort((a, b) => a - b),
    'it never goes backwards');
  assert.equal(seen.at(-1).done, rows, 'and it ends at all of them');

  // Reporting is optional: leaving it out restores exactly the same.
  const plain = await seeded();
  const result = await restoreBackup(plain.db, backup, MIGRATION_SOURCES);
  assert.equal(result.restored.reduce((sum, entry) => sum + entry.rows, 0), rows);

  await source.db.close();
  await target.db.close();
  await plain.db.close();
});
