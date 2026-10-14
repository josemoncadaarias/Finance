// A category moved to the other side, with what is filed under it.
//
//   node --import ./tools/db/register-ts.mjs --test tools/db/category-kind.test.mjs
//
// Jose, 2026-10-14: a category set up as income that should have been
// spending was locked once it had movements. Now it can be turned over, and
// every movement under it turns with it - asked first, saying how many.

import test from 'node:test';
import assert from 'node:assert/strict';

import { NodeSqlDriver } from './node-sql-driver.mjs';
import { migrate } from '../../src/app/core/database/migrations/migration-runner.ts';
import { MIGRATION_SOURCES } from '../../src/app/core/database/migrations/statements.generated.ts';
import { AccountsRepository } from '../../src/app/core/database/repositories/accounts.repository.ts';
import { CategoriesRepository } from '../../src/app/core/database/repositories/categories.repository.ts';
import { YieldsRepository } from '../../src/app/core/database/repositories/yields.repository.ts';
import { writeScoped, scopeOfMovement } from '../../src/app/core/yields/entry-scope.ts';
import { changeCategoryKind, kindChangeReach, KindTaken } from '../../src/app/core/categories/change-kind.ts';

const NOW = () => '2026-10-14T12:00:00Z';

async function world() {
  const db = new NodeSqlDriver();
  await migrate(db, MIGRATION_SOURCES);
  const accounts = new AccountsRepository(db, NOW);
  const bank = await accounts.create({
    name: 'Banco', type: 'debit', currency_code: 'COP', builtin_icon: 'card', opening_balance_minor: 100_000_00, opened_on: '2026-01-01',
  });
  const yields = new YieldsRepository(db, NOW);
  await yields.enrol({ account_id: bank, opening_on: '2026-01-01', withholding: false });
  const [usual] = await yields.products(bank);
  const categories = new CategoriesRepository(db, NOW);
  const wrong = await categories.create({ name: 'Arriendo', kind: 'income', builtin_icon: 'home' });
  const write = (scope, kind, amount) => writeScoped(db, yields, {
    scope, kind, accountId: bank, categoryId: wrong, productId: usual.id, movementProductId: null,
    onDate: '2026-10-01', amountMinor: amount, note: null,
  });
  const balance = async () => (await db.queryOne(
    'SELECT SUM(amount_minor) AS s FROM transactions WHERE account_id = ?', [bank])).s ?? 0;
  const productSum = async () => (await db.queryOne(
    `SELECT COALESCE((SELECT SUM(amount_minor) FROM product_entries), 0)
          - COALESCE((SELECT SUM(amount_minor) FROM product_cashouts), 0) AS s`)).s;
  return { db, bank, usual, categories, wrong, write, balance, productSum };
}

test('every movement under it changes sign, and the category changes side', async () => {
  const w = await world();
  await w.write('both', 'income', 1_000_00);
  await w.write('both', 'income', 2_500_00);
  assert.equal(await w.balance(), 3_500_00);
  assert.deepEqual(await kindChangeReach(w.db, w.wrong), { movements: 2, entries: 0 });

  await changeCategoryKind(w.db, w.wrong, 'expense', NOW);

  assert.equal((await w.categories.list()).find(c => c.id === w.wrong).kind, 'expense');
  assert.equal(await w.balance(), -3_500_00);
  const rows = await w.db.query('SELECT amount_minor, amount_base_minor, locked FROM transactions WHERE category_id = ?', [w.wrong]);
  for (const row of rows) {
    assert.equal(row.amount_minor, row.amount_base_minor, 'the peso value turns with it');
    assert.equal(row.locked, 1, 'marked as corrected by hand');
  }
});

test('a product\'s own movement turns over too', async () => {
  const w = await world();
  await w.write('product', 'income', 700_00);
  assert.deepEqual(await kindChangeReach(w.db, w.wrong), { movements: 0, entries: 1 });
  await changeCategoryKind(w.db, w.wrong, 'expense', NOW);
  assert.equal(await w.productSum(), -700_00);
});

test('"Solo el patrimonio" keeps its answer: the product does not move, either way', async () => {
  const w = await world();
  const income = await w.write('netWorth', 'income', 400_00);
  assert.equal(await w.productSum(), -400_00, 'an income cashed out of the product');
  await changeCategoryKind(w.db, w.wrong, 'expense', NOW);
  assert.equal(await scopeOfMovement(w.db, income), 'netWorth');
  assert.equal(await w.balance(), -400_00);
  assert.equal(await w.productSum(), 400_00, 'now a spending put back into the product');

  await changeCategoryKind(w.db, w.wrong, 'income', NOW);
  assert.equal(await scopeOfMovement(w.db, income), 'netWorth');
  assert.equal(await w.balance(), 400_00, 'and back again, as it was');
  assert.equal(await w.productSum(), -400_00);
});

test('a name already used on the other side is refused, and nothing moves', async () => {
  const w = await world();
  await w.write('both', 'income', 1_000_00);
  await w.categories.create({ name: 'Arriendo', kind: 'expense', builtin_icon: 'home' });
  await assert.rejects(changeCategoryKind(w.db, w.wrong, 'expense', NOW), KindTaken);
  assert.equal(await w.balance(), 1_000_00);
});

test('movements of other categories are not touched', async () => {
  const w = await world();
  const other = await w.categories.create({ name: 'Salario', kind: 'income', builtin_icon: 'cash' });
  await writeScoped(w.db, new YieldsRepository(w.db, NOW), {
    scope: 'both', kind: 'income', accountId: w.bank, categoryId: other, productId: w.usual.id, movementProductId: null,
    onDate: '2026-10-01', amountMinor: 9_000_00, note: null,
  });
  await w.write('both', 'income', 1_000_00);
  await changeCategoryKind(w.db, w.wrong, 'expense', NOW);
  assert.equal(await w.balance(), 8_000_00);
});
