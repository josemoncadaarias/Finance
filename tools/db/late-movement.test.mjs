// A product typed with the app's own balance, then a purchase of an earlier
// day recorded after it: the purchase was not inside the figure.
//
//   node --import ./tools/db/register-ts.mjs --test tools/db/late-movement.test.mjs
//
// Found 2026-11-12: a new product took the account's balance of that moment,
// yesterday's purchase was recorded minutes later, and the product kept the
// purchase's amount as "interest not yet in the balance". Invented figures.

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

const P = pesos => Math.round(pesos * 100);
const at = time => () => `2026-11-12T${time}Z`;

async function setUp(typed) {
  const db = new NodeSqlDriver();
  await migrate(db, MIGRATION_SOURCES);
  const early = at('10:00:00');
  const id = await new AccountsRepository(db, early).create({
    name: 'Ahorro Uno', type: 'debit', currency_code: 'COP', builtin_icon: 'wallet',
    opened_on: '2026-11-01', opening_balance_minor: P(500_000),
  });
  const category = await new CategoriesRepository(db, early).create({ name: 'Comida', kind: 'expense' });
  await new TransactionsRepository(db, early).create({
    account_id: id, category_id: category, occurred_on: '2026-11-10', amount_minor: P(-40_000), source: 'manual',
  });
  const yields = new YieldsRepository(db, at('11:00:00'));
  await yields.enrol({ account_id: id, opening_on: '2026-11-12', withholding: false });
  const [only] = await yields.products(id);
  await db.run("UPDATE products SET source = 'manual' WHERE id = ?", [only.id]);
  await yields.setProductBalance({ product_id: only.id, valid_from: '2026-11-12', amount_minor: typed });
  // Yesterday's purchase, recorded after the figure.
  await new TransactionsRepository(db, at('12:00:00')).create({
    account_id: id, category_id: category, occurred_on: '2026-11-11', amount_minor: P(-25_000), source: 'manual',
  });
  const engine = new AccrualEngine(db, yields, new TaxParametersRepository(db, early));
  return (await engine.heldByProduct(id, '2026-11-12')).get(only.id);
}

test('a figure equal to the app balance of its moment does not hold what came later', async () => {
  assert.equal(await setUp(P(460_000)), P(435_000), 'the account balance, nothing as interest');
});

test('a figure read off the bank still holds a purchase of an earlier day', async () => {
  // The bank already had the purchase: 435,000 plus 1,200 of interest.
  assert.equal(await setUp(P(436_200)), P(436_200));
});
