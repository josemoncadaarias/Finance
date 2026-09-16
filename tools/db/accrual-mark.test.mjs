// Working it out again only when something changed.
//
//   node --import ./tools/db/register-ts.mjs --test tools/db/accrual-mark.test.mjs
//
// Opening the yields screen accrued five years again every time. On a phone
// that is hundreds of crossings into the native side for an answer already in
// the database, and Jose felt every one of them. The screen now asks whether
// anything an accrual reads has changed since the last one.

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
import { accrueAllAndSettle } from '../../src/app/core/yields/cdt.ts';
import { EA_SCALE } from '../../src/app/core/yields/yield-math.ts';

let clock = 0;
const NOW = () => `2026-09-15T12:00:${String(clock++).padStart(2, '0')}Z`;
const TODAY = '2026-09-15';
const pesos = amount => Math.round(amount * 100);

async function bank() {
  const db = new NodeSqlDriver();
  await migrate(db, MIGRATION_SOURCES);
  const accounts = new AccountsRepository(db, NOW);
  const yields = new YieldsRepository(db, NOW);
  const tax = new TaxParametersRepository(db, NOW);

  const account = await accounts.create({
    name: 'Pibank', type: 'debit', currency_code: 'COP', builtin_icon: 'wallet',
    opened_on: '2026-01-01', opening_balance_minor: pesos(10_000_000),
  });
  await yields.enrol({ account_id: account, opening_cushion_minor: 0, opening_on: '2026-09-01', withholding: false });
  const [savings] = await yields.pockets(account);
  await yields.setDefaultPocket(account, savings.id);
  await yields.setRate({
    account_id: account, pocket_id: savings.id, component: 'base', payout: 'daily',
    valid_from: '2026-09-01', annual_rate_scaled: Math.round(0.11 * EA_SCALE),
  });

  const categories = new CategoriesRepository(db, NOW);
  const transactions = new TransactionsRepository(db, NOW);
  return { db, yields, tax, accounts, categories, transactions, account };
}

test('nothing to work out again until something it reads changes', async () => {
  const { db, yields, tax, account, categories, transactions } = await bank();

  // Never accrued: there is always something to do the first time.
  assert.equal(await yields.needsAccrual(TODAY), true);

  await accrueAllAndSettle(db, yields, tax, TODAY);
  await yields.markAccrued(TODAY);
  assert.equal(await yields.needsAccrual(TODAY), false, 'reopening the screen changes nothing');

  // A new day is a day more to work out.
  assert.equal(await yields.needsAccrual('2026-09-16'), true);

  // A movement changes the balance it all earns on.
  const food = await categories.create({ name: 'Restaurante', kind: 'expense', builtin_icon: 'restaurant' });
  const spend = await transactions.create({
    account_id: account, category_id: food, occurred_on: '2026-09-14',
    amount_minor: -pesos(50_000), source: 'manual',
  });
  assert.equal(await yields.needsAccrual(TODAY), true);

  await accrueAllAndSettle(db, yields, tax, TODAY);
  await yields.markAccrued(TODAY);
  assert.equal(await yields.needsAccrual(TODAY), false);

  // Deleting one leaves every timestamp where it was, and still counts.
  await transactions.delete(spend);
  assert.equal(await yields.needsAccrual(TODAY), true, 'a deletion is a change too');

  await db.close();
});

test('a rate, a balance or a tax parameter is a change as well', async () => {
  for (const change of [
    async ({ yields, account }) => {
      const [savings] = await yields.pockets(account);
      await yields.setRate({
        account_id: account, pocket_id: savings.id, component: 'base', payout: 'daily',
        valid_from: '2026-09-10', annual_rate_scaled: Math.round(0.13 * EA_SCALE),
      });
    },
    async ({ yields, account }) => {
      const [savings] = await yields.pockets(account);
      await yields.setPocketBalance({ pocket_id: savings.id, valid_from: '2026-09-10', amount_minor: pesos(1_000) });
    },
    async ({ yields, account }) => {
      await yields.adjust({ account_id: account, on_date: '2026-09-10', amount_minor: pesos(500), kind: 'cashback' });
    },
    async ({ tax }) => {
      await tax.set({ key: 'withholding.percent', valid_from: '2026-01-01', value: '700000', source: 'test', confirmed: true });
    },
  ]) {
    const context = await bank();
    await accrueAllAndSettle(context.db, context.yields, context.tax, TODAY);
    await context.yields.markAccrued(TODAY);
    assert.equal(await context.yields.needsAccrual(TODAY), false);

    await change(context);
    assert.equal(await context.yields.needsAccrual(TODAY), true);
    await context.db.close();
  }
});
