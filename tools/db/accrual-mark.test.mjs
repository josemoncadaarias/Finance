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

// Per account. The mark was one string for the whole database, so a coffee on
// the credit card - an account that earns nothing - made every account be
// worked out again the next time the yields screen opened.

/** Two enrolled accounts and a credit card that earns nothing. */
async function twoBanks() {
  const context = await bank();
  const { accounts, yields } = context;
  const dale = await accounts.create({
    name: 'Dale', type: 'debit', currency_code: 'COP', builtin_icon: 'wallet',
    opened_on: '2026-01-01', opening_balance_minor: pesos(4_000_000),
  });
  await yields.enrol({ account_id: dale, opening_cushion_minor: 0, opening_on: '2026-09-01', withholding: false });
  const [alcancia] = await yields.pockets(dale);
  await yields.setDefaultPocket(dale, alcancia.id);
  await yields.setRate({
    account_id: dale, pocket_id: alcancia.id, component: 'base', payout: 'daily',
    valid_from: '2026-09-01', annual_rate_scaled: Math.round(0.09 * EA_SCALE),
  });
  const card = await accounts.create({
    name: 'Tarjeta', type: 'credit', currency_code: 'COP', builtin_icon: 'card',
    opened_on: '2026-01-01', opening_balance_minor: 0, credit_limit_minor: pesos(5_000_000),
  });
  const food = await context.categories.create({ name: 'Cafe', kind: 'expense', builtin_icon: 'cafe' });

  await accrueAllAndSettle(context.db, yields, context.tax, TODAY);
  await yields.markAccrued(TODAY);
  return { ...context, pibank: context.account, dale, card, food };
}

test('a movement in an account that earns nothing works nothing out again', async () => {
  const { db, yields, transactions, card, food } = await twoBanks();
  assert.deepEqual(await yields.staleAccounts(TODAY), []);

  await transactions.create({
    account_id: card, category_id: food, occurred_on: TODAY, amount_minor: -pesos(12_000), source: 'manual',
  });
  assert.deepEqual(await yields.staleAccounts(TODAY), []);
  assert.equal(await yields.needsAccrual(TODAY), false);
  await db.close();
});

test('a change in one account marks that account and no other', async () => {
  const changes = [
    ['a movement', async ({ transactions, food, pibank }) => transactions.create({
      account_id: pibank, category_id: food, occurred_on: '2026-09-14', amount_minor: -pesos(50_000), source: 'manual',
    })],
    ['a rate corrected in place', async ({ yields, pibank }) => {
      const [rate] = await yields.rateHistory(pibank);
      await yields.correctRate(rate.id, { annual_rate_scaled: Math.round(0.12 * EA_SCALE) });
    }],
    ['a new rate', async ({ yields, pibank }) => {
      const [savings] = await yields.pockets(pibank);
      await yields.setRate({
        account_id: pibank, pocket_id: savings.id, component: 'base', payout: 'daily',
        valid_from: '2026-09-10', annual_rate_scaled: Math.round(0.13 * EA_SCALE),
      });
    }],
    ['the opening balance', async ({ accounts, pibank }) => accounts.update(pibank, { opening_balance_minor: pesos(9_000_000) })],
    ['a product balance', async ({ yields, pibank }) => {
      const [savings] = await yields.pockets(pibank);
      await yields.setPocketBalance({ pocket_id: savings.id, valid_from: '2026-09-10', amount_minor: pesos(1_000) });
    }],
    ['a new product', async ({ yields, pibank }) => yields.addPocket({ account_id: pibank, name: 'Meta', source: 'manual' })],
    ['a cushion entry', async ({ yields, pibank }) =>
      yields.adjust({ account_id: pibank, on_date: '2026-09-10', amount_minor: pesos(500), kind: 'cashback' })],
    ['a day corrected by hand', async ({ yields, pibank }) => {
      const [day] = await yields.days(pibank, '2026-09-10', '2026-09-10');
      await yields.correctDay(day.pocket_id, day.on_date, 1234);
    }],
  ];
  for (const [what, change] of changes) {
    const context = await twoBanks();
    await change(context);
    assert.deepEqual(await context.yields.staleAccounts(TODAY), [context.pibank], what);
    await context.db.close();
  }
});

test('a new day or a tax parameter marks every account', async () => {
  const context = await twoBanks();
  const { yields, tax, pibank, dale } = context;
  assert.deepEqual(await yields.staleAccounts('2026-09-16'), [pibank, dale]);

  await tax.set({ key: 'withholding.percent', valid_from: '2026-01-01', value: '700000', source: 'test', confirmed: true });
  assert.deepEqual(await yields.staleAccounts(TODAY), [pibank, dale]);
  await context.db.close();
});

test('a mark kept the old way works every account out once', async () => {
  const context = await twoBanks();
  await context.db.run("UPDATE settings SET value = ? WHERE key = 'yields.accrual.mark'", ['2026-09-15|1:1:x']);
  assert.deepEqual(await context.yields.staleAccounts(TODAY), [context.pibank, context.dale]);
  await context.db.close();
});

test('working out only the stale accounts leaves what working out all of them would', async () => {
  const dump = db => db.query(
    `SELECT pocket_id, account_id, component, on_date, paid_on, balance_minor, annual_rate_scaled,
            gross_minor, withholding_minor, net_minor
     FROM yield_days ORDER BY account_id, pocket_id, component, on_date`);
  const change = async ({ transactions, food, pibank }) => transactions.create({
    account_id: pibank, category_id: food, occurred_on: '2026-09-03', amount_minor: -pesos(3_000_000), source: 'manual',
  });

  const some = await twoBanks();
  await change(some);
  const stale = await some.yields.staleAccounts(TODAY);
  assert.deepEqual(stale, [some.pibank]);
  await accrueAllAndSettle(some.db, some.yields, some.tax, TODAY, undefined, stale);
  await some.yields.markAccrued(TODAY);
  assert.deepEqual(await some.yields.staleAccounts(TODAY), []);

  const all = await twoBanks();
  await change(all);
  await accrueAllAndSettle(all.db, all.yields, all.tax, TODAY);

  assert.deepEqual(await dump(some.db), await dump(all.db));
  await some.db.close();
  await all.db.close();
});
