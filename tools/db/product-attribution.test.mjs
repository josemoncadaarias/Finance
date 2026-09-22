// Which product a movement belongs to, and why it must not depend on a flag.
//
//   node --import ./tools/db/register-ts.mjs --test tools/db/product-attribution.test.mjs
//
// Jose, 2026-09-21: he made Cuenta Ahorros the usual product of Plata and
// 200,000 pesos left Bolsillo. A movement saved when the account had one
// product named no product - there was nothing to choose - and from the day a
// second product appeared those movements followed whichever was usual. His
// question was the right one: it went to Bolsillo when it was saved, so it
// should say Bolsillo and stay there.

import test from 'node:test';
import assert from 'node:assert/strict';

import { NodeSqlDriver } from './node-sql-driver.mjs';
import { migrate } from '../../src/app/core/database/migrations/migration-runner.ts';
import { MIGRATION_SOURCES } from '../../src/app/core/database/migrations/statements.generated.ts';
import { AccountsRepository } from '../../src/app/core/database/repositories/accounts.repository.ts';
import { CategoriesRepository } from '../../src/app/core/database/repositories/categories.repository.ts';
import { TransactionsRepository } from '../../src/app/core/database/repositories/transactions.repository.ts';
import { YieldsRepository } from '../../src/app/core/database/repositories/yields.repository.ts';
import { TaxParametersRepository } from '../../src/app/core/database/repositories/tax-parameters.repository.ts';
import { AccrualEngine } from '../../src/app/core/yields/accrual.ts';

const NOW = () => '2026-09-21T12:00:00Z';

async function setup() {
  const db = new NodeSqlDriver();
  await migrate(db, MIGRATION_SOURCES);

  const accounts = new AccountsRepository(db, NOW);
  const yields = new YieldsRepository(db, NOW);
  const transactions = new TransactionsRepository(db, NOW);

  const accountId = await accounts.create({
    name: 'Plata', type: 'debit', currency_code: 'COP', builtin_icon: 'wallet',
    opening_balance_minor: 0, opened_on: '2026-01-01',
  });
  const category = await new CategoriesRepository(db, NOW).create({
    name: 'Depósitos', kind: 'income', builtin_icon: 'cash',
  });

  await yields.enrol({
    account_id: accountId, default_product_name: 'Bolsillo',
    opening_on: '2026-01-01', withholding: false,
  });
  const [only] = await yields.products(accountId);

  // The money goes in while there is one product, so it names none.
  await transactions.create({
    account_id: accountId, category_id: category, occurred_on: '2026-09-08',
    amount_minor: 20_000_000, source: 'manual',
  });

  return { db, yields, accountId, only };
}

const heldBy = async (db, yields, accountId) => {
  const engine = new AccrualEngine(db, yields, new TaxParametersRepository(db));
  const products = await yields.products(accountId);
  const map = await engine.heldByProduct(accountId, '2026-09-21', products);
  return Object.fromEntries(products.map(p => [p.name, map.get(p.id) ?? 0]));
};

test('a second product writes down whose the earlier movements were', async () => {
  const { db, yields, accountId, only } = await setup();

  const loose = await db.queryOne(
    'SELECT COUNT(*) AS n FROM transactions WHERE account_id = ? AND product_id IS NULL', [accountId]);
  assert.equal(loose.n, 1, 'one product, so the movement named none');

  await yields.addProduct({ account_id: accountId, name: 'Cuenta Ahorros', sort_order: 1 });

  const after = await db.queryOne(
    'SELECT product_id FROM transactions WHERE account_id = ?', [accountId]);
  assert.equal(after.product_id, only.id, 'it says Bolsillo, where it went');
});

test('changing the usual product moves no money', async () => {
  const { db, yields, accountId } = await setup();
  await yields.addProduct({ account_id: accountId, name: 'Cuenta Ahorros', sort_order: 1 });

  const before = await heldBy(db, yields, accountId);
  assert.equal(before['Bolsillo'], 20_000_000);
  assert.equal(before['Cuenta Ahorros'], 0);

  const other = (await yields.products(accountId)).find(p => p.name === 'Cuenta Ahorros');
  await yields.setDefaultProduct(accountId, other.id);

  assert.deepEqual(await heldBy(db, yields, accountId), before,
    'the usual product changed; the money did not');
});

test('a third product leaves the earlier ones where they are', async () => {
  const { db, yields, accountId } = await setup();
  await yields.addProduct({ account_id: accountId, name: 'Cuenta Ahorros', sort_order: 1 });
  const held = await heldBy(db, yields, accountId);

  // Whatever is unnamed by now was left unnamed on purpose, so a third
  // product claims nothing.
  await yields.addProduct({ account_id: accountId, name: 'CDT', sort_order: 2 });

  const after = await heldBy(db, yields, accountId);
  assert.equal(after['Bolsillo'], held['Bolsillo']);
  assert.equal(after['CDT'], 0);
});
