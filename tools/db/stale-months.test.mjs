// A month already worked out is worked out again when something dated in it
// changes (core/yields/month-marks.ts, 2026-10-02).
//
//   node --import ./tools/db/register-ts.mjs --test tools/db/stale-months.test.mjs
//
// The engine resumed from the top of the last month it had worked out, so a
// deposit dated 20 September and typed in October left September's yields on
// the old balance (on Jose's backup: Global66 COP paid 0.20 a day where it
// should have paid 1,054.57). Each pass now keeps a mark of what every month
// holds and goes back to the earliest month that differs.

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
import { EA_SCALE } from '../../src/app/core/yields/yield-math.ts';
import { earliestChange } from '../../src/app/core/yields/month-marks.ts';

const P = pesos => Math.round(pesos * 100);
const UP_TO = '2026-10-05';

async function account(now = () => '2026-10-05T12:00:00Z') {
  const db = new NodeSqlDriver();
  await migrate(db, MIGRATION_SOURCES);
  const yields = new YieldsRepository(db, now);
  const id = await new AccountsRepository(db, now).create({
    name: 'Ahorro', type: 'debit', currency_code: 'COP', builtin_icon: 'wallet',
    opened_on: '2026-08-31', opening_balance_minor: P(10_000_000),
  });
  await yields.enrol({ account_id: id, opening_on: '2026-08-31', withholding: false });
  const [product] = await yields.products(id);
  await yields.setRate({ account_id: id, product_id: product.id, valid_from: '2026-08-31', annual_rate_scaled: Math.round(0.1 * EA_SCALE) });
  const category = await new CategoriesRepository(db, now).create({ name: 'Ingreso', kind: 'income', builtin_icon: 'cash-outline' });
  const tx = new TransactionsRepository(db, now);
  const engine = new AccrualEngine(db, yields, new TaxParametersRepository(db, now));
  const days = async () => (await yields.days(id)).map(d => [d.on_date, d.balance_minor, d.net_minor, d.locked]);
  return { db, yields, id, product: product.id, category, tx, engine, days };
}

/** What a fresh start would make of the same data. */
async function fromScratch(w) {
  await w.yields.clearDays(w.id);
  await w.engine.accrueAll(UP_TO);
  return w.days();
}

test('the earliest month that differs, the opening balance before every month', () => {
  assert.equal(earliestChange({ '2026-09': 'a', '2026-10': 'b' }, { '2026-09': 'a', '2026-10': 'b' }), null);
  assert.equal(earliestChange({ '2026-09': 'a', '2026-10': 'b' }, { '2026-09': 'x', '2026-10': 'y' }), '2026-09-01');
  assert.equal(earliestChange({ '2026-10': 'b' }, { '2026-08': 'n', '2026-10': 'b' }), '2026-08-01', 'a month that appeared');
  assert.equal(earliestChange({ '2026-08': 'n' }, {}), '2026-08-01', 'a month that emptied');
  assert.equal(earliestChange({ '0000-00': '1' }, { '0000-00': '2' }), '0000-01-01');
});

test('a deposit dated in a month already worked out is counted there, as a fresh start would', async () => {
  const w = await account();
  await w.engine.accrueAll(UP_TO);
  const before = await w.days();
  await w.tx.create({ account_id: w.id, category_id: w.category, occurred_on: '2026-09-20', amount_minor: P(5_000_000), description: 'tarde' });
  await w.engine.accrueAll(UP_TO);
  const after = await w.days();
  assert.deepEqual(after, await fromScratch(w));
  const sept21 = d => d.find(x => x[0] === '2026-09-21');
  assert.ok(sept21(after)[1] > sept21(before)[1], 'the 21st earns on the deposit');
  assert.deepEqual(after.filter(d => d[0] < '2026-09-20'), before.filter(d => d[0] < '2026-09-20'), 'nothing before it moves');
});

test('and deleting it puts every day back', async () => {
  const w = await account();
  await w.engine.accrueAll(UP_TO);
  const before = await w.days();
  const id = await w.tx.create({ account_id: w.id, category_id: w.category, occurred_on: '2026-09-20', amount_minor: P(5_000_000), description: 'tarde' });
  await w.engine.accrueAll(UP_TO);
  await w.tx.delete(id);
  await w.engine.accrueAll(UP_TO);
  assert.deepEqual(await w.days(), before);
});

test('a rate dated back is applied from its day', async () => {
  const w = await account();
  await w.engine.accrueAll(UP_TO);
  await w.yields.setRate({ account_id: w.id, product_id: w.product, valid_from: '2026-09-15', annual_rate_scaled: Math.round(0.12 * EA_SCALE) });
  await w.engine.accrueAll(UP_TO);
  assert.deepEqual(await w.days(), await fromScratch(w));
});

test('a day checked against the bank stays as it was', async () => {
  const w = await account();
  await w.engine.accrueAll(UP_TO);
  await w.yields.correctDay(w.product, '2026-09-25', 12_345);
  await w.engine.accrueAll(UP_TO);
  await w.tx.create({ account_id: w.id, category_id: w.category, occurred_on: '2026-09-20', amount_minor: P(5_000_000), description: 'tarde' });
  await w.engine.accrueAll(UP_TO);
  const day = (await w.yields.days(w.id)).find(d => d.on_date === '2026-09-25');
  assert.equal(day.locked, 1);
  assert.equal(day.actual_net_minor, 12_345);
});

test('the first pass after the update goes back nowhere: it only takes its marks', async () => {
  const w = await account();
  await w.engine.accrueAll(UP_TO);
  // As a database from before marks were kept: none on record.
  await w.db.run("DELETE FROM settings WHERE key LIKE 'yields.months.%'");
  await w.tx.create({ account_id: w.id, category_id: w.category, occurred_on: '2026-09-20', amount_minor: P(5_000_000), description: 'tarde' });
  const before = await w.days();
  await w.engine.accrueAll(UP_TO);
  const after = await w.days();
  assert.deepEqual(after.filter(d => d[0] < '2026-10-01'), before.filter(d => d[0] < '2026-10-01'),
    'September stays exactly as the phone had it');
});

test('a change that moves no money does not redo anything', async () => {
  let clock = '2026-10-05T12:00:00Z';
  const w = await account(() => clock);
  const id = await w.tx.create({ account_id: w.id, category_id: w.category, occurred_on: '2026-09-10', amount_minor: P(100), description: 'nota' });
  await w.engine.accrueAll(UP_TO);
  const stamps = async () => (await w.db.query("SELECT on_date, computed_at FROM yield_days WHERE on_date < '2026-10-01' ORDER BY on_date"));
  const before = await stamps();
  clock = '2026-10-06T12:00:00Z';
  await w.tx.update(id, { description: 'otra nota' });
  await w.db.run("UPDATE transactions SET updated_at = '2030-01-01T00:00:00Z'");
  await w.engine.accrueAll(UP_TO);
  assert.deepEqual(await stamps(), before);
});
