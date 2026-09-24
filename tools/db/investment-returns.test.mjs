// Migration 047: a category can say it is what an investment earned or lost.
//
//   node --import ./tools/db/register-ts.mjs --test tools/db/investment-returns.test.mjs
//
// Jose, 2026-09-24. Checked against his own backup the same day: Ganancia,
// Perdida and the new Ajuste de ganancias flagged, three movements moved from
// Dian, 13,260 movements otherwise untouched and no balance moved.

import test from 'node:test';
import assert from 'node:assert/strict';

import { NodeSqlDriver } from './node-sql-driver.mjs';
import { migrate } from '../../src/app/core/database/migrations/migration-runner.ts';
import { MIGRATION_SOURCES } from '../../src/app/core/database/migrations/statements.generated.ts';
import { AccountsRepository } from '../../src/app/core/database/repositories/accounts.repository.ts';
import { CategoriesRepository } from '../../src/app/core/database/repositories/categories.repository.ts';
import { TransactionsRepository } from '../../src/app/core/database/repositories/transactions.repository.ts';

const NOW = () => '2026-09-24T12:00:00Z';
const upTo = version => MIGRATION_SOURCES.filter(one => one.version <= version);

test('a fresh database flags nothing and invents no category', async () => {
  const db = new NodeSqlDriver();
  await migrate(db, MIGRATION_SOURCES);
  assert.equal((await db.queryOne('SELECT COUNT(*) AS n FROM categories WHERE counts_as_return = 1')).n, 0);
  assert.equal((await db.queryOne("SELECT COUNT(*) AS n FROM categories WHERE name = 'Ajuste de ganancias'")).n, 0);
});

test("Jose's Ganancia and Perdida are flagged, and a fund's Dian correction moves - his own tax does not", async () => {
  const db = new NodeSqlDriver();
  await migrate(db, upTo(46));
  const accounts = new AccountsRepository(db, NOW);
  const categories = new CategoriesRepository(db, NOW);
  const transactions = new TransactionsRepository(db, NOW);

  const fund = await accounts.create({ name: 'Fiducuenta', type: 'investment', currency_code: 'COP', builtin_icon: 'trending-up', opening_balance_minor: 0, opened_on: '2026-01-01' });
  const bank = await accounts.create({ name: 'Bancolombia', type: 'debit', currency_code: 'COP', builtin_icon: 'card', opening_balance_minor: 0, opened_on: '2026-01-01' });
  const gain = await categories.create({ name: 'Ganancia', kind: 'income', builtin_icon: 'trending-up' });
  const loss = await categories.create({ name: 'Perdida', kind: 'expense', builtin_icon: 'trending-down' });
  const dian = await categories.create({ name: 'Dian', kind: 'expense', builtin_icon: 'document' });
  const other = await categories.create({ name: 'Casa', kind: 'expense', builtin_icon: 'home' });

  const move = (account_id, category_id, amount_minor, description) => transactions.create({
    account_id, category_id, amount_minor, occurred_on: '2026-08-25', description, source: 'manual',
  });
  await move(fund, gain, 600_000_00, 'subio inversion');
  await move(fund, loss, -90_000_00, 'bajo inversion');
  const correction = await move(fund, dian, -931_395_96, 'Ajuste fiducuenta impuesto renta acumulado');
  const tax = await move(bank, dian, -5_421_556_00, 'Impuesto de renta Dian 2025');
  await move(fund, other, -100_000_00, 'Casa');

  const balances = () => db.query('SELECT account_id, SUM(amount_minor) AS s FROM transactions GROUP BY account_id ORDER BY account_id');
  const before = await balances();

  await migrate(db, MIGRATION_SOURCES);

  const flagged = (await db.query('SELECT name FROM categories WHERE counts_as_return = 1 ORDER BY name')).map(row => row.name);
  assert.deepEqual(flagged, ['Ajuste de ganancias', 'Ganancia', 'Perdida']);
  const categoryOf = async id => (await db.queryOne(
    'SELECT c.name FROM transactions t JOIN categories c ON c.id = t.category_id WHERE t.id = ?', [id])).name;
  assert.equal(await categoryOf(correction), 'Ajuste de ganancias');
  assert.equal(await categoryOf(tax), 'Dian', 'a tax paid from a bank account is not an investment');
  assert.deepEqual(await balances(), before, 'no balance moved');
});

test('the flag is kept by the repository both ways', async () => {
  const db = new NodeSqlDriver();
  await migrate(db, MIGRATION_SOURCES);
  const categories = new CategoriesRepository(db, NOW);
  const id = await categories.create({ name: 'Rendimiento fondo', kind: 'income', builtin_icon: 'trending-up', counts_as_return: true });
  assert.equal((await categories.findById(id)).counts_as_return, 1);
  await categories.update(id, { counts_as_return: false });
  assert.equal((await categories.findById(id)).counts_as_return, 0);
  const plain = await categories.create({ name: 'Mercado', kind: 'expense', builtin_icon: 'basket' });
  assert.equal((await categories.findById(plain)).counts_as_return, 0);
});
