// Tests for the two exports.
//
//   node --import ./tools/db/register-ts.mjs --test tools/db/export.test.mjs
//
// One is for reading and one is for surviving a lost phone; the tests care
// about different things for each.

import test from 'node:test';
import assert from 'node:assert/strict';

import { NodeSqlDriver } from './node-sql-driver.mjs';
import { migrate } from '../../src/app/core/database/migrations/migration-runner.ts';
import { MIGRATION_SOURCES } from '../../src/app/core/database/migrations/statements.generated.ts';
import { AccountsRepository } from '../../src/app/core/database/repositories/accounts.repository.ts';
import { CategoriesRepository } from '../../src/app/core/database/repositories/categories.repository.ts';
import { TransactionsRepository } from '../../src/app/core/database/repositories/transactions.repository.ts';
import { TransfersRepository } from '../../src/app/core/database/repositories/transfers.repository.ts';
import { exportMovements, toCsv, exportFileName }
  from '../../src/app/core/database/export/export-csv.ts';
import { exportBackup, backupSummary, toJson }
  from '../../src/app/core/database/export/export-backup.ts';

const NOW = () => '2026-09-09T12:00:00Z';

async function setup() {
  const db = new NodeSqlDriver();
  await migrate(db, MIGRATION_SOURCES);

  const accounts = new AccountsRepository(db, NOW);
  const categories = new CategoriesRepository(db, NOW);
  const transactions = new TransactionsRepository(db, NOW);
  const transfers = new TransfersRepository(db, NOW);

  const rappi = await accounts.create({
    name: 'Rappi cuenta', type: 'debit', currency_code: 'COP',
    builtin_icon: 'wallet', opened_on: '2021-07-01',
  });
  const arq = await accounts.create({
    name: 'ARQ USD', type: 'investment', currency_code: 'USD',
    builtin_icon: 'trending-up', opened_on: '2024-08-13',
  });
  const comida = await categories.create({ name: 'Comida', kind: 'expense', builtin_icon: 'basket' });

  return { db, accounts, categories, transactions, transfers, ids: { rappi, arq, comida } };
}

test('the CSV carries both amounts, and quotes what would break it', async () => {
  const { db, transactions, ids } = await setup();

  await transactions.create({
    account_id: ids.rappi, category_id: ids.comida, occurred_on: '2026-09-08',
    amount_minor: -4500050, description: 'Mercado; pagué 50% en efectivo', source: 'manual',
  });

  const csv = toCsv(await exportMovements(db));
  const [header, row] = csv.trim().split('\r\n');

  assert.equal(header.split(';')[0], 'fecha');
  assert.ok(header.includes('monto;monto_en_pesos'), 'both amounts have their own column');

  // The note holds a semicolon, so the field is quoted rather than split.
  assert.ok(row.includes('"Mercado; pagué 50% en efectivo"'), row);
  assert.equal(row.split(';').length > 5, true);

  // Amounts read the way they do on screen, for the person opening this.
  assert.ok(row.includes('-45.000,50'), row);
  await db.close();
});

test('a transfer says which leg it is and what is on the other side', async () => {
  const { db, transfers, ids } = await setup();

  await transfers.create({
    occurred_on: '2026-09-01',
    description: 'Compra de dólares',
    from: { account_id: ids.rappi, amount_minor: 10000000 },
    to: { account_id: ids.arq, amount_minor: 2373, rate_scaled: 42140000,
          amount_base_minor: 10000000, rate_source: 'derived' },
  });

  const rows = await exportMovements(db);
  const out = rows.find(row => row.transfer_leg === 'from');
  const into = rows.find(row => row.transfer_leg === 'to');

  assert.equal(out.other_account, 'ARQ USD');
  assert.equal(into.other_account, 'Rappi cuenta');

  // The dollar leg keeps its own figure and its peso value side by side.
  assert.equal(into.amount_minor, 2373);
  assert.equal(into.amount_base_minor, 10000000);

  const csv = toCsv(rows);
  assert.ok(csv.includes('transferencia (from)'), csv);
  assert.ok(csv.includes('4214,0000'), 'the rate, with a decimal comma');
  await db.close();
});

test('the backup carries every table, and says what it holds', async () => {
  const { db, transactions, ids } = await setup();

  await transactions.create({
    account_id: ids.rappi, category_id: ids.comida, occurred_on: '2026-09-08',
    amount_minor: -4500000, source: 'manual',
  });

  const backup = await exportBackup(db);

  assert.equal(backup.app, 'finance');
  // Derived, not typed: the version the backup records is whatever the
  // migrations reach, and a test that spells it out fails on every new one for
  // no reason of its own.
  assert.equal(backup.schemaVersion, MIGRATION_SOURCES.length,
    'the schema it came from');
  assert.ok(backup.tables.accounts.length === 2);
  assert.ok(backup.tables.transactions.length === 1);

  // Currencies come before accounts, accounts before transactions: a restore
  // replaying them in order never trips a foreign key.
  const order = Object.keys(backup.tables);
  assert.ok(order.indexOf('currencies') < order.indexOf('accounts'));
  assert.ok(order.indexOf('accounts') < order.indexOf('transactions'));
  assert.ok(order.indexOf('transfers') < order.indexOf('transactions'));

  // The summary is a claim someone can check.
  const summary = backupSummary(backup);
  assert.equal(summary.find(entry => entry.table === 'accounts').rows, 2);
  assert.equal(summary.some(entry => entry.rows === 0), false, 'empty tables are not listed');

  // And it survives being written out and read back.
  const parsed = JSON.parse(toJson(backup));
  assert.equal(parsed.tables.transactions[0].amount_minor, -4500000);
  await db.close();
});

test('an icon image survives the round trip as bytes', async () => {
  const { db } = await setup();

  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);
  await db.run(
    'INSERT INTO custom_icons (name, mime_type, data, created_at) VALUES (?, ?, ?, ?)',
    ['Bancolombia', 'image/png', png, NOW()]);

  const parsed = JSON.parse(toJson(await exportBackup(db)));
  const stored = parsed.tables.custom_icons[0];

  // A BLOB is not JSON, so it is written as its bytes and stays recoverable.
  assert.deepEqual(stored.data.__bytes ?? stored.data, [...png]);
  await db.close();
});

test('the file name sorts by date and does not collide within a day', () => {
  assert.equal(exportFileName(new Date(2026, 8, 9, 17, 48), 'csv'), 'finance-2026-09-09-1748.csv');
  assert.equal(exportFileName(new Date(2026, 8, 9, 9, 5), 'json'), 'finance-2026-09-09-0905.json');

  // Two exports on the same day are different files, the same rule the Monefy
  // backups in data/ follow.
  assert.notEqual(
    exportFileName(new Date(2026, 8, 9, 9, 5), 'csv'),
    exportFileName(new Date(2026, 8, 9, 17, 48), 'csv'));
});
