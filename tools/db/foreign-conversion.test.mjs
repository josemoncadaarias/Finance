// Foreign movements saved without a peso figure get one, at their own day's
// official rate.
//
//   node --import ./tools/db/register-ts.mjs --test tools/db/foreign-conversion.test.mjs
//
// Found by Jose on 2026-09-18: his dollar spending was a sliver of the donut on
// "all accounts", because 60 of his 283 foreign movements stored their own
// amount as their peso figure - 30 dollars counted as 30 pesos.

import test from 'node:test';
import assert from 'node:assert/strict';

import { NodeSqlDriver } from './node-sql-driver.mjs';
import { migrate } from '../../src/app/core/database/migrations/migration-runner.ts';
import { MIGRATION_SOURCES } from '../../src/app/core/database/migrations/statements.generated.ts';
import { AccountsRepository } from '../../src/app/core/database/repositories/accounts.repository.ts';
import { TransactionsRepository } from '../../src/app/core/database/repositories/transactions.repository.ts';
import { RatesRepository } from '../../src/app/core/database/repositories/rates.repository.ts';
import { CategoriesRepository } from '../../src/app/core/database/repositories/categories.repository.ts';
import { convertPendingForeign } from '../../src/app/core/rates/convert-pending.ts';

const NOW = () => '2026-09-18T12:00:00Z';

async function setup() {
  const db = new NodeSqlDriver();
  await migrate(db, MIGRATION_SOURCES);
  const accounts = new AccountsRepository(db, NOW);
  const transactions = new TransactionsRepository(db, NOW);

  const account = currency => accounts.create({
    name: `Cuenta ${currency}`, type: 'debit', currency_code: currency, builtin_icon: 'wallet',
    opening_balance_minor: 0, opened_on: '2025-01-01',
  });
  const ids = {
    cop: await account('COP'),
    usd: await account('USD'),
    eur: await account('EUR'),
  };

  const category = await new CategoriesRepository(db, NOW).create({
    name: 'Compras', kind: 'expense', builtin_icon: 'cart',
  });

  // The shape the bug left behind: a foreign amount with no rate, whose peso
  // figure is the amount itself.
  const spend = (accountId, on, minor) => transactions.create({
    account_id: accountId, category_id: category, occurred_on: on, amount_minor: minor, source: 'manual',
  });

  return { db, ids, spend, category, rates: new RatesRepository(db, NOW) };
}

const row = (db, id) => db.queryOne(
  'SELECT amount_minor, amount_base_minor, rate_scaled, rate_source, confidence FROM transactions WHERE id = ?',
  [id]);

test('a dollar movement is valued at the TRM of its own day', async () => {
  const { db, ids, spend } = await setup();
  const id = await spend(ids.usd, '2025-08-08', -3_000);    // 30.00 USD

  assert.equal((await row(db, id)).amount_base_minor, -3_000, 'the bug: 30 dollars as 30 pesos');

  const asked = [];
  const result = await convertPendingForeign(db, {
    now: NOW,
    fetchRate: async (currency, date) => {
      asked.push(`${currency} ${date}`);
      return { rate_scaled: 40_493_500, source: 'trm' };     // 4,049.35 COP per USD
    },
  });

  assert.deepEqual(result, { converted: 1, pending: 0 });
  assert.deepEqual(asked, ['USD 2025-08-08'], 'its own day, not today');

  const fixed = await row(db, id);
  assert.equal(fixed.amount_minor, -3_000, 'what moved is never touched');
  assert.equal(fixed.amount_base_minor, -12_148_050, '30 x 4,049.35 = 121,480.50 pesos');
  assert.equal(fixed.rate_scaled, 40_493_500);
  assert.equal(fixed.rate_source, 'trm');
  assert.equal(fixed.confidence, 'low', 'the official rate, not what the bank charged');
});

test('a euro movement is valued through the dollar, and says it was derived', async () => {
  const { db, ids, spend } = await setup();
  const id = await spend(ids.eur, '2025-08-08', -2_610);     // 26.10 EUR

  await convertPendingForeign(db, {
    now: NOW,
    fetchRate: async () => ({ rate_scaled: 47_166_849, source: 'ecb-trm' }),
  });

  const fixed = await row(db, id);
  assert.equal(fixed.amount_base_minor, -12_310_548, '26.10 x 4,716.6849');
  assert.equal(fixed.rate_source, 'derived');
});

test('the rate is kept, so the next movement that day needs no network', async () => {
  const { db, ids, spend, rates } = await setup();
  await spend(ids.usd, '2025-08-08', -1_000);
  await convertPendingForeign(db, {
    now: NOW,
    fetchRate: async () => ({ rate_scaled: 40_493_500, source: 'trm' }),
  });
  assert.equal((await rates.inForce('USD', 'COP', '2025-08-08')).rate_scaled, 40_493_500);

  const second = await spend(ids.usd, '2025-08-08', -2_000);
  const result = await convertPendingForeign(db, {
    now: NOW,
    fetchRate: async () => { throw new Error('the network must not be asked'); },
  });
  assert.deepEqual(result, { converted: 1, pending: 0 });
  assert.equal((await row(db, second)).amount_base_minor, -8_098_700);
});

test('with no rate to be had the movement is left alone and counted, never guessed', async () => {
  const { db, ids, spend, rates } = await setup();
  // A rate from months before is on record - a different rate, not this day's.
  await rates.set({ on_date: '2025-01-02', base_code: 'USD', quote_code: 'COP', rate_scaled: 43_000_000, source: 'trm' });
  const id = await spend(ids.usd, '2025-08-08', -3_000);

  const result = await convertPendingForeign(db, { now: NOW, fetchRate: async () => null });

  assert.deepEqual(result, { converted: 0, pending: 1 });
  assert.equal((await row(db, id)).amount_base_minor, -3_000, 'untouched, still pending');
});

test('over a weekend the rate in force from the Friday is used when nothing else is', async () => {
  const { db, ids, spend, rates } = await setup();
  await rates.set({ on_date: '2025-08-08', base_code: 'USD', quote_code: 'COP', rate_scaled: 40_493_500, source: 'trm' });
  const sunday = await spend(ids.usd, '2025-08-10', -1_000);

  const result = await convertPendingForeign(db, { now: NOW });   // offline

  assert.deepEqual(result, { converted: 1, pending: 0 });
  assert.equal((await row(db, sunday)).amount_base_minor, -4_049_350);
});

test('peso movements and foreign ones already valued are never touched', async () => {
  const { db, ids, spend, category } = await setup();
  const pesos = await spend(ids.cop, '2025-08-08', -5_000_000);
  const transactions = new TransactionsRepository(db, NOW);
  const valued = await transactions.create({
    account_id: ids.usd, category_id: category, occurred_on: '2025-08-08', amount_minor: -3_000,
    rate_scaled: 41_000_000, source: 'manual',
  });

  const result = await convertPendingForeign(db, {
    now: NOW,
    fetchRate: async () => { throw new Error('nothing here needs a rate'); },
  });

  assert.deepEqual(result, { converted: 0, pending: 0 });
  assert.equal((await row(db, pesos)).amount_base_minor, -5_000_000);
  assert.equal((await row(db, valued)).amount_base_minor, -12_300_000, 'its own rate, kept');
});
