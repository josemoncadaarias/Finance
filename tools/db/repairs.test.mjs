// Migrations a plugin skipped while reporting success, and how they are put right.
//
//   node --import ./tools/db/register-ts.mjs --test tools/db/repairs.test.mjs
//
// In the browser the SQLite plugin turned every migration mentioning DELETE
// FROM into one long comment, so 023 to 026 and 030 moved the version on and
// changed nothing. These tests leave a database in exactly that state - the
// version past a migration that never ran - and check what the runner does.

import test from 'node:test';
import assert from 'node:assert/strict';

import { NodeSqlDriver } from './node-sql-driver.mjs';
import { migrate, currentVersion } from '../../src/app/core/database/migrations/migration-runner.ts';
import { MIGRATION_SOURCES } from '../../src/app/core/database/migrations/statements.generated.ts';
import { AccountsRepository } from '../../src/app/core/database/repositories/accounts.repository.ts';
import { CategoriesRepository } from '../../src/app/core/database/repositories/categories.repository.ts';

const NOW = () => '2026-09-11T12:00:00Z';
const upTo = version => MIGRATION_SOURCES.filter(source => source.version <= version);

test('a skipped 030 is run again, once', async () => {
  const db = new NodeSqlDriver();
  await migrate(db, upTo(29));
  const account = await new AccountsRepository(db, NOW).create({
    name: 'Cuenta', type: 'debit', currency_code: 'COP', builtin_icon: 'wallet', opened_on: '2025-01-01',
  });
  const product = (await db.run(
    // Under the names version 29 had. Migration 043 renames them.
    `INSERT INTO yield_pockets (account_id, name, source, sort_order, created_at, updated_at)
     VALUES (?, 'Ahorros', 'manual', 0, ?, ?)`, [account, NOW(), NOW()])).lastId;
  await db.run(
    `INSERT INTO yield_rates (account_id, pocket_id, component, payout, valid_from, annual_rate_scaled, created_at)
     VALUES (?, NULL, 'base', 'monthly', '2026-09-01', 90000, ?)`, [account, NOW()]);

  // What the browser plugin left behind: the version moved on, the migration did not run.
  await db.execute('PRAGMA user_version = 30');

  await migrate(db, MIGRATION_SOURCES);

  const columns = (await db.query('PRAGMA table_info(products)')).map(column => column.name);
  assert.ok(columns.includes('payout') && columns.includes('term_months'), 'the columns are there now');
  assert.deepEqual((await db.query('SELECT product_id, payout FROM yield_rates')).map(row => ({ ...row })),
    [{ product_id: product, payout: 'monthly' }], 'the account rate was copied onto its product');
  assert.equal((await db.queryOne('SELECT payout FROM products WHERE id = ?', [product])).payout, 'monthly');

  await migrate(db, MIGRATION_SOURCES);
  assert.equal((await db.query('SELECT id FROM yield_rates')).length, 1, 'and a second start repairs nothing');
  assert.equal(await currentVersion(db), MIGRATION_SOURCES.length);
});

test('a skipped 023 gets its table and alias back, and never its delete', async () => {
  const db = new NodeSqlDriver();
  await migrate(db, upTo(22));
  const accounts = new AccountsRepository(db, NOW);
  const card = await accounts.create({ name: 'Rappi Card', type: 'credit', currency_code: 'COP', builtin_icon: 'card', opened_on: '2024-01-01' });
  const duplicate = await accounts.create({ name: 'Tarjeta crédito rappi', type: 'credit', currency_code: 'COP', builtin_icon: 'card', opened_on: '2024-01-01' });
  const category = await new CategoriesRepository(db, NOW).create({ name: 'Comida', kind: 'expense', builtin_icon: 'basket' });
  await db.run(
    `INSERT INTO transactions (account_id, category_id, occurred_on, amount_minor, amount_base_minor, created_at, updated_at)
     VALUES (?, ?, '2026-09-01', -1000, -1000, ?, ?)`, [duplicate, category, NOW(), NOW()]);

  // 023 to 026 skipped, the way the browser plugin skipped them.
  await db.execute('PRAGMA user_version = 26');
  await migrate(db, MIGRATION_SOURCES);

  assert.deepEqual((await db.query('SELECT source_name, account_id FROM account_aliases')).map(row => ({ ...row })),
    [{ source_name: 'Tarjeta crédito rappi', account_id: card }], 'the table and the alias are back');
  assert.equal((await db.query('SELECT id FROM accounts WHERE id IN (?, ?)', [card, duplicate])).length, 2,
    'no account was deleted by name');
  assert.equal((await db.queryOne('SELECT account_id FROM transactions')).account_id, duplicate,
    'and no movement was moved');
});
