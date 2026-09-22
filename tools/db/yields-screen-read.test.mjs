// Reading every account at once gives what reading them one by one gave.
//
//   node --import ./tools/db/register-ts.mjs --test tools/db/yields-screen-read.test.mjs
//
// The yields screen asked fourteen questions per account, one account at a
// time: 192 on Jose's thirteen accounts, each a crossing into the native side
// on the phone. It asks them for every account together now. The answers must
// be the ones the one-account questions give, product for product.

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
import { accrueAllAndSettle } from '../../src/app/core/yields/cdt.ts';
import { EA_SCALE } from '../../src/app/core/yields/yield-math.ts';

let clock = 0;
const NOW = () => `2026-09-15T12:${String(Math.floor(clock / 60)).padStart(2, '0')}:${String(clock++ % 60).padStart(2, '0')}Z`;
const TODAY = '2026-09-15';
const pesos = amount => Math.round(amount * 100);
const plain = value => JSON.parse(JSON.stringify(value instanceof Map ? Object.fromEntries(value) : value));

/**
 * Three accounts that differ in every way the read cares about: one product
 * following the ledger, a product with a stated balance and its own
 * movements, a rate paid monthly, a cushion entry, a withdrawal, and an
 * account with nothing worked out at all.
 */
async function bank() {
  const db = new NodeSqlDriver();
  await migrate(db, MIGRATION_SOURCES);
  const accounts = new AccountsRepository(db, NOW);
  const yields = new YieldsRepository(db, NOW);
  const tax = new TaxParametersRepository(db, NOW);
  const transactions = new TransactionsRepository(db, NOW);
  const food = await new CategoriesRepository(db, NOW).create({ name: 'Mercado', kind: 'expense', builtin_icon: 'cart' });

  const ids = [];
  for (const [name, payout, opening] of [['Pibank', 'daily', 10_000_000], ['Dale', 'monthly', 4_000_000], ['Nu', 'daily', 0]]) {
    const account = await accounts.create({
      name, type: 'debit', currency_code: 'COP', builtin_icon: 'wallet',
      opened_on: '2026-01-01', opening_balance_minor: pesos(opening),
    });
    await yields.enrol({ account_id: account, opening_on: '2026-09-01', withholding: false });
    const [usual] = await yields.pockets(account);
    await yields.setDefaultPocket(account, usual.id);
    if (name !== 'Nu') {
      await yields.setRate({
        account_id: account, pocket_id: null, component: 'base', payout,
        valid_from: '2026-09-01', annual_rate_scaled: Math.round(0.1 * EA_SCALE),
      });
    }
    ids.push(account);
  }
  const [pibank, dale] = ids;

  const goal = await yields.addPocket({ account_id: pibank, name: 'Meta', source: 'manual' });
  await yields.setPocketBalance({ pocket_id: goal, valid_from: '2026-09-05', amount_minor: pesos(2_000_000) });
  await transactions.create({
    account_id: pibank, category_id: food, pocket_id: goal, occurred_on: '2026-09-08',
    amount_minor: -pesos(300_000), source: 'manual',
  });
  await transactions.create({
    account_id: dale, category_id: food, occurred_on: '2026-09-10', amount_minor: -pesos(150_000), source: 'manual',
  });
  await yields.adjust({ account_id: pibank, on_date: '2026-09-09', amount_minor: pesos(1_500), kind: 'cashback' });
  await yields.withdraw({ account_id: pibank, on_date: '2026-09-12', amount_minor: pesos(700) });

  await accrueAllAndSettle(db, yields, tax, TODAY);
  return { db, yields, tax, ids };
}

test('the last day of every account at once is what each account gives alone', async () => {
  const { db, yields, ids } = await bank();
  const together = await yields.lastDaysOf(ids, TODAY);
  for (const id of ids) {
    const last = await yields.lastAccruedDay(id);
    assert.deepEqual(plain(together.get(id)), plain({
      last,
      bands: await yields.bandsInForce(id, TODAY),
      daysOfLast: last ? await yields.days(id, last, last) : [],
      paidThatDay: last ? await yields.paidOn(id, last) : [],
    }));
  }
  assert.equal(together.get(ids[2]).last, null, 'an account with nothing worked out');
  await db.close();
});

test('what landed in, and what is held in, every product at once', async () => {
  const { db, yields, tax, ids } = await bank();
  const pocketsOf = new Map();
  for (const id of ids) pocketsOf.set(id, await yields.pockets(id));

  const engine = new AccrualEngine(db, yields, tax);
  const landed = await yields.landedByPockets(TODAY, pocketsOf);
  const held = await engine.heldByPockets(TODAY, pocketsOf);

  // Worked out by hand for Pibank's goal: 2,000,000 stated on the 5th, less
  // the 300,000 spent from it on the 8th.
  const goal = pocketsOf.get(ids[0]).find(pocket => pocket.name === 'Meta');
  assert.equal(held.get(ids[0]).get(goal.id), pesos(1_700_000));

  for (const id of ids) {
    const alone = await yields.landedByPocket(id, TODAY);
    assert.deepEqual(plain(landed.get(id).total), plain(alone.total));
    assert.deepEqual(plain(landed.get(id).yields), plain(alone.yields));
    assert.deepEqual(plain(held.get(id)), plain(await engine.heldByPocket(id, TODAY)));
  }
  await db.close();
});

test('no accounts is no questions and no answers', async () => {
  const { db, yields, tax } = await bank();
  assert.equal((await yields.lastDaysOf([], TODAY)).size, 0);
  assert.equal((await yields.landedByPockets(TODAY, new Map())).size, 0);
  assert.equal((await new AccrualEngine(db, yields, tax).heldByPockets(TODAY, new Map())).size, 0);
  await db.close();
});
