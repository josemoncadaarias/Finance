// The accrual engine: walking days and writing what each one earned.
//
//   node --import ./tools/db/register-ts.mjs --test tools/db/accrual.test.mjs
//
// The figures used are Jose's real ones from 2026-09-09, because a rounding
// mistake shows up against a real balance and not against 1,000.00.

import test from 'node:test';
import assert from 'node:assert/strict';

import { NodeSqlDriver } from './node-sql-driver.mjs';
import { migrate } from '../../src/app/core/database/migrations/migration-runner.ts';
import { MIGRATION_SOURCES } from '../../src/app/core/database/migrations/statements.generated.ts';
import { AccountsRepository } from '../../src/app/core/database/repositories/accounts.repository.ts';
import { CategoriesRepository } from '../../src/app/core/database/repositories/categories.repository.ts';
import { TransactionsRepository } from '../../src/app/core/database/repositories/transactions.repository.ts';
import { TransfersRepository } from '../../src/app/core/database/repositories/transfers.repository.ts';
import { YieldsRepository } from '../../src/app/core/database/repositories/yields.repository.ts';
import { TaxParametersRepository, TAX_KEYS } from '../../src/app/core/database/repositories/tax-parameters.repository.ts';
import { AccrualEngine } from '../../src/app/core/yields/accrual.ts';
import { dailyRate, EA_SCALE } from '../../src/app/core/yields/yield-math.ts';

const NOW = () => '2026-09-09T12:00:00Z';
const pct = p => Math.round((p / 100) * EA_SCALE);

async function setup() {
  const db = new NodeSqlDriver();
  await migrate(db, MIGRATION_SOURCES);

  const accounts = new AccountsRepository(db, NOW);
  const categories = new CategoriesRepository(db, NOW);
  const transactions = new TransactionsRepository(db, NOW);
  const yields = new YieldsRepository(db, NOW);
  const tax = new TaxParametersRepository(db, NOW);
  const transfers = new TransfersRepository(db, NOW);
  const engine = new AccrualEngine(db, yields, tax);

  // Rappi cuenta with its real balance, and Uala, whose rate has a condition.
  const rappi = await accounts.create({
    name: 'Rappi cuenta', type: 'debit', currency_code: 'COP', builtin_icon: 'wallet',
    opening_balance_minor: 1_000_000_000, opened_on: '2021-07-01',
  });
  const uala = await accounts.create({
    name: 'Ualá', type: 'debit', currency_code: 'COP', builtin_icon: 'wallet',
    opening_balance_minor: 1_000_000_000, opened_on: '2024-01-01',
  });
  const xtb = await accounts.create({
    name: 'XTB', type: 'investment', currency_code: 'USD', builtin_icon: 'trending-up',
    opening_balance_minor: 260_700, opened_on: '2024-01-01',
  });
  const gastos = await categories.create({ name: 'Facturas', kind: 'expense', builtin_icon: 'receipt' });

  return { db, accounts, categories, transactions, transfers, yields, tax, engine,
           ids: { rappi, uala, xtb, gastos } };
}

/**
 * The same walk, done independently, so the test can disagree with the engine.
 *
 * The base is the balance and what THIS app has worked out since - never the
 * opening figure. That figure is the interest the account had already been
 * paid, and it is already inside the balance; adding it would count the same
 * money twice. It is part of the cushion total all the same.
 */
function expectedCushion(balanceMinor, openingCushion, annualRateScaled, days) {
  const rate = dailyRate(annualRateScaled);
  let earned = 0;
  for (let day = 0; day < days; day += 1) {
    earned += Math.round((balanceMinor + earned) * rate);
  }
  return openingCushion + earned;
}

test('an account not enrolled is never accrued', async () => {
  const { engine, yields, ids } = await setup();

  const result = await engine.accrue(ids.xtb, '2026-12-31');
  assert.equal(result.daysWritten, 0);
  assert.equal(result.from, null);
  assert.equal((await yields.days(ids.xtb)).length, 0);

  // And accruing everything still leaves it out.
  const all = await engine.accrueAll('2026-12-31');
  assert.equal(all.some(r => r.account_id === ids.xtb), false);
});

test('accrual starts the day after the opening figure, never on it', async () => {
  const { engine, yields, ids } = await setup();
  await yields.enrol({
    account_id: ids.rappi, opening_cushion_minor: 491_743_498,
    opening_on: '2026-09-09', withholding: false,
  });
  await yields.setRate({ account_id: ids.rappi, valid_from: '2026-09-09', annual_rate_scaled: pct(9) });

  const result = await engine.accrue(ids.rappi, '2026-09-12');

  // 10, 11 and 12 September. The 9th is already inside the opening figure, and
  // accruing it too would count that day twice.
  assert.equal(result.from, '2026-09-10');
  assert.equal(result.daysWritten, 3);
  const days = await yields.days(ids.rappi);
  assert.deepEqual(days.map(d => d.on_date), ['2026-09-10', '2026-09-11', '2026-09-12']);
});

test('the cushion compounds on itself, and the parts add up', async () => {
  const { engine, yields, ids } = await setup();
  await yields.enrol({
    account_id: ids.rappi, opening_cushion_minor: 491_743_498,
    opening_on: '2026-09-09', withholding: false,
  });
  await yields.setRate({ account_id: ids.rappi, valid_from: '2026-09-09', annual_rate_scaled: pct(9) });

  await engine.accrue(ids.rappi, '2026-10-09');

  const expected = expectedCushion(1_000_000_000, 491_743_498, pct(9), 30);
  const cushion = await yields.cushion(ids.rappi);

  assert.equal(cushion.totalMinor, expected);
  assert.equal(cushion.opening_minor, 491_743_498);
  assert.equal(cushion.accrued_minor, expected - 491_743_498);
  assert.equal(cushion.adjusted_minor, 0);
  assert.equal(cushion.withdrawn_minor, 0);

  // The first day earns on the balance and nothing else: the opening figure
  // is money the account was already holding, not money to add to it.
  const days = await yields.days(ids.rappi);
  assert.equal(days[0].balance_minor, 1_000_000_000);

  // From there the base grows by what the app itself worked out, which the
  // balance genuinely does not know about yet.
  assert.equal(days[1].balance_minor, 1_000_000_000 + days[0].net_minor);
  assert.ok(days[29].balance_minor > days[0].balance_minor);
});

test('a movement changes the balance the next day earns on', async () => {
  const { engine, yields, transactions, ids } = await setup();
  await yields.enrol({
    account_id: ids.rappi, opening_cushion_minor: 0, opening_on: '2026-09-09', withholding: false,
  });
  await yields.setRate({ account_id: ids.rappi, valid_from: '2026-09-09', annual_rate_scaled: pct(9) });

  await transactions.create({
    account_id: ids.rappi, category_id: ids.gastos, occurred_on: '2026-09-11',
    amount_minor: -500_000_000, source: 'manual',
  });

  await engine.accrue(ids.rappi, '2026-09-12');
  const days = await yields.days(ids.rappi);

  assert.equal(days[0].balance_minor, 1_000_000_000, 'the 10th, before the movement');
  assert.equal(days[1].balance_minor, 500_000_000 + days[0].net_minor, 'the 11th, after it');
  assert.ok(days[2].gross_minor < days[0].gross_minor, 'a smaller balance earns less');
});

test('with no tax parameters the yield still accrues, flagged', async () => {
  const { db, engine, yields, ids } = await setup();
  // Migration 006 seeds the withholding rule. This is the state before it, and
  // the state again the day the 2027 UVT is not yet in: the yield accrues, and
  // the app says out loud that it could not work the withholding out.
  await db.run('DELETE FROM tax_parameters');
  await yields.enrol({
    account_id: ids.rappi, opening_cushion_minor: 0, opening_on: '2026-09-09',
    withholding: true,
  });
  await yields.setRate({ account_id: ids.rappi, valid_from: '2026-09-09', annual_rate_scaled: pct(9) });

  const result = await engine.accrue(ids.rappi, '2026-09-12');

  assert.equal(result.daysWithUnknownWithholding, 3);
  assert.equal(result.withheldMinor, 0);
  const days = await yields.days(ids.rappi);
  assert.equal(days[0].withholding_unknown, 1);
  assert.equal(days[0].net_minor, days[0].gross_minor, 'nothing is withheld, and nobody is told it was');

  const cushion = await yields.cushion(ids.rappi);
  assert.equal(cushion.daysWithUnknownWithholding, 3);
});

test('once the parameters are confirmed, the withholding is applied', async () => {
  const { engine, yields, tax, ids } = await setup();
  await yields.enrol({
    account_id: ids.rappi, opening_cushion_minor: 0, opening_on: '2026-09-09',
    withholding: true,
  });
  await yields.setRate({ account_id: ids.rappi, valid_from: '2026-09-09', annual_rate_scaled: pct(9) });

  // Invented figures, entered the way Jose will enter the real ones. They are
  // NOT the real UVT or the real rate; what is tested is that a confirmed set
  // of parameters is picked up and an unconfirmed one is not.
  const params = [
    [TAX_KEYS.uvtValue, '5000000'],
    [TAX_KEYS.threshold, '0.001'],
    [TAX_KEYS.percent, String(pct(7))],
    [TAX_KEYS.base, 'all'],
  ];
  for (const [key, value] of params) {
    await tax.set({ key, valid_from: '2026-01-01', value, confirmed: false });
  }

  await engine.accrue(ids.rappi, '2026-09-12');
  assert.equal((await yields.days(ids.rappi))[0].withholding_unknown, 1,
    'entered but unconfirmed is still unusable');

  for (const [key, value] of params) {
    await tax.set({ key, valid_from: '2026-01-01', value, source: 'test', confirmed: true });
  }
  await yields.clearDays(ids.rappi);
  const result = await engine.accrue(ids.rappi, '2026-09-12');

  assert.equal(result.daysWithUnknownWithholding, 0);
  assert.ok(result.withheldMinor > 0);
  const day = (await yields.days(ids.rappi))[0];
  assert.equal(day.withholding_minor, Math.round(day.gross_minor * 0.07));
  assert.equal(day.net_minor, day.gross_minor - day.withholding_minor);
});

test('a rate that needs a monthly spend pays nothing in a month that missed it', async () => {
  const { engine, yields, transactions, ids } = await setup();
  await yields.enrol({
    account_id: ids.uala, opening_cushion_minor: 111_549_946,
    opening_on: '2026-08-31', withholding: false,
  });
  await yields.setRate({
    account_id: ids.uala, valid_from: '2026-08-31', annual_rate_scaled: pct(10.5),
    requires_monthly_spend_minor: 40_000_000,
  });

  // 300,000 spent in September: short of the 400,000 the rate asks for.
  await transactions.create({
    account_id: ids.uala, category_id: ids.gastos, occurred_on: '2026-09-05',
    amount_minor: -30_000_000, source: 'manual',
  });

  let result = await engine.accrue(ids.uala, '2026-09-20');
  assert.equal(result.daysConditionNotMet, 20);
  assert.equal(result.netMinor, 0);
  assert.equal((await yields.cushion(ids.uala)).totalMinor, 111_549_946, 'the cushion did not move');

  // Another 150,000 later in the month crosses the threshold, and the whole
  // month is filled in on the next pass - including the days before the spend.
  await transactions.create({
    account_id: ids.uala, category_id: ids.gastos, occurred_on: '2026-09-21',
    amount_minor: -15_000_000, source: 'manual',
  });

  result = await engine.accrue(ids.uala, '2026-09-30');
  assert.equal(result.from, '2026-09-01', 'a recompute restarts at the top of the month');
  assert.equal(result.daysConditionNotMet, 0);
  assert.ok(result.netMinor > 0);
  assert.ok((await yields.cushion(ids.uala)).totalMinor > 111_549_946);
});

test('a bonus judged every two months counts the spending of both', async () => {
  const { engine, yields, transactions, ids } = await setup();
  await yields.enrol({ account_id: ids.uala, opening_cushion_minor: 0, opening_on: '2026-06-30', withholding: false });
  await yields.setRate({
    account_id: ids.uala, component: 'bonus', payout: 'monthly', payout_months: 2,
    valid_from: '2026-07-01', annual_rate_scaled: pct(5.5), requires_monthly_spend_minor: 40_000_000,
  });

  // 250,000 in July: short of 400,000, and August has not happened yet.
  await transactions.create({
    account_id: ids.uala, category_id: ids.gastos, occurred_on: '2026-07-10', amount_minor: -25_000_000, source: 'manual',
  });
  let result = await engine.accrue(ids.uala, '2026-07-31');
  assert.equal(result.daysConditionNotMet, 31);
  assert.equal(result.netMinor, 0, 'a bonus not earned pays nothing');

  // 200,000 in August. Neither month reaches it alone; the two months do.
  await transactions.create({
    account_id: ids.uala, category_id: ids.gastos, occurred_on: '2026-08-12', amount_minor: -20_000_000, source: 'manual',
  });
  result = await engine.accrue(ids.uala, '2026-08-31');
  assert.equal(result.from, '2026-07-01', 'a recompute restarts where the two months start');
  assert.equal(result.daysConditionNotMet, 0);
  assert.ok(result.netMinor > 0);
  const days = await yields.days(ids.uala);
  assert.ok(days.every(day => day.paid_on === '2026-08-31'), 'all of it paid at the end of the two months');
});

test('what was paid on a day leaves out what is only paid at the end of the month', async () => {
  const { engine, yields, ids } = await setup();
  await yields.enrol({ account_id: ids.uala, opening_cushion_minor: 100_000_000, opening_on: '2026-08-31', withholding: false });
  await yields.setRate({ account_id: ids.uala, component: 'daily', payout: 'daily', valid_from: '2026-08-31', annual_rate_scaled: pct(5) });
  await yields.setRate({ account_id: ids.uala, component: 'monthly', payout: 'monthly', valid_from: '2026-08-31', annual_rate_scaled: pct(9) });

  await engine.accrue(ids.uala, '2026-09-15');
  let paid = await yields.paidOn(ids.uala, '2026-09-15');
  assert.deepEqual(paid.map(day => day.component), ['daily'], 'mid-month only the daily part arrives');

  await engine.accrue(ids.uala, '2026-09-30');
  paid = await yields.paidOn(ids.uala, '2026-09-30');
  assert.equal(paid.filter(day => day.component === 'monthly').length, 30, 'on payday the whole month arrives');
  assert.equal(paid.filter(day => day.component === 'daily').length, 1);
});

test('the cushion split by product adds up to the account, and follows each entry', async () => {
  const { engine, yields, ids } = await setup();
  await yields.enrol({ account_id: ids.uala, opening_cushion_minor: 70_000, opening_on: '2026-08-31', withholding: false });
  await yields.setRate({ account_id: ids.uala, component: 'daily', payout: 'daily', valid_from: '2026-08-31', annual_rate_scaled: pct(5) });
  const [first] = await yields.pockets(ids.uala);
  const second = await yields.addPocket({ account_id: ids.uala, name: 'Prueba', source: 'manual', sort_order: 1 });

  await yields.adjust({ account_id: ids.uala, on_date: '2026-09-05', amount_minor: 500_000, kind: 'other', pocket_id: second });
  await yields.adjust({ account_id: ids.uala, on_date: '2026-09-06', amount_minor: -120_000, kind: 'correction', pocket_id: second });
  await yields.adjust({ account_id: ids.uala, on_date: '2026-09-06', amount_minor: 30_000, kind: 'cashback' });
  await engine.accrue(ids.uala, '2026-09-10');

  const split = await yields.cushionByPocket(ids.uala);
  const total = (await yields.cushion(ids.uala)).totalMinor;
  assert.equal([...split.values()].reduce((sum, part) => sum + part, 0), total, 'the parts are the whole');

  const earnedBy = async id => (await yields.days(ids.uala))
    .filter(day => day.pocket_id === id).reduce((sum, day) => sum + day.net_minor, 0);
  assert.equal(split.get(second), 380_000 + await earnedBy(second), 'income minus the expense, plus what it earned');
  assert.equal(split.get(first.id), 70_000 + 30_000 + await earnedBy(first.id),
    'the opening figure and the entry naming no product stay on the first');
});

test('a product balance counts the yields that landed in it after it was stated, and no earlier', async () => {
  const { engine, yields, ids } = await setup();
  await yields.enrol({ account_id: ids.uala, opening_cushion_minor: 0, opening_on: '2026-08-31', withholding: false });
  const second = await yields.addPocket({ account_id: ids.uala, name: 'Prueba', source: 'manual', sort_order: 1 });
  await yields.setPocketBalance({ pocket_id: second, valid_from: '2026-09-05', amount_minor: 100_000_000 });
  await yields.setRate({
    account_id: ids.uala, pocket_id: second, component: 'base', payout: 'daily', valid_from: '2026-08-31', annual_rate_scaled: pct(10),
  });

  await yields.adjust({ account_id: ids.uala, on_date: '2026-09-03', amount_minor: 500_000, kind: 'other', pocket_id: second });
  await yields.adjust({ account_id: ids.uala, on_date: '2026-09-05', amount_minor: 400_000, kind: 'other', pocket_id: second });
  await yields.adjust({ account_id: ids.uala, on_date: '2026-09-07', amount_minor: 200_000, kind: 'cashback', pocket_id: second });
  await yields.adjust({ account_id: ids.uala, on_date: '2026-09-08', amount_minor: -50_000, kind: 'correction', pocket_id: second });
  await engine.accrue(ids.uala, '2026-09-10');

  const paidAfter = (await yields.days(ids.uala))
    .filter(day => day.pocket_id === second && day.on_date > '2026-09-05')
    .reduce((sum, day) => sum + day.net_minor, 0);
  assert.ok(paidAfter > 0);

  const landed = await yields.landedByPocket(ids.uala, '2026-09-10');
  assert.equal(landed.yields.get(second), paidAfter, 'of it, yield is only what the bank paid');
  assert.equal(landed.total.get(second), 400_000 + 150_000 + paidAfter,
    'what was entered after the balance - its own day included - and the days paid after it; the stated figure holds the rest');

  // Jose's test: a product created today, its balance 0 as of today, and an
  // income of 1 entered today. It is in the product, not only in the yields.
  const fresh = await yields.addPocket({ account_id: ids.uala, name: 'test', source: 'manual', sort_order: 2 });
  await yields.setPocketBalance({ pocket_id: fresh, valid_from: '2026-09-10', amount_minor: 0 });
  await yields.adjust({ account_id: ids.uala, on_date: '2026-09-10', amount_minor: 100, kind: 'other', pocket_id: fresh });
  const freshLanded = await yields.landedByPocket(ids.uala, '2026-09-10');
  assert.equal(freshLanded.total.get(fresh), 100, 'the income is in the balance');
  assert.equal(freshLanded.yields.get(fresh), 0, 'and it is not a yield');
});

test('a product that is not withheld has nothing taken, beside one in the same account that is', async () => {
  const { engine, yields, tax, ids } = await setup();
  for (const [key, value] of [
    [TAX_KEYS.uvtValue, '5000000'], [TAX_KEYS.threshold, '0.001'], [TAX_KEYS.percent, String(pct(7))], [TAX_KEYS.base, 'all'],
  ]) {
    await tax.set({ key, valid_from: '2026-01-01', value, source: 'test', confirmed: true });
  }
  await yields.enrol({ account_id: ids.uala, opening_cushion_minor: 0, opening_on: '2026-08-31', withholding: true });
  const withheld = await yields.addPocket({ account_id: ids.uala, name: 'Con retención', source: 'manual', sort_order: 1 });
  const free = await yields.addPocket({ account_id: ids.uala, name: 'Sin retención', source: 'manual', sort_order: 2 });
  assert.equal((await yields.pockets(ids.uala)).find(pocket => pocket.id === free).withholding, 1,
    'a new product starts with its account\'s answer');
  await yields.setPocketWithholding(free, false);

  for (const id of [withheld, free]) {
    await yields.setPocketBalance({ pocket_id: id, valid_from: '2026-08-31', amount_minor: 1_000_000_000 });
  }
  await yields.setRate({ account_id: ids.uala, component: 'base', payout: 'daily', valid_from: '2026-08-31', annual_rate_scaled: pct(10) });
  await engine.accrue(ids.uala, '2026-09-05');

  const days = await yields.days(ids.uala);
  const of = id => days.filter(day => day.pocket_id === id);
  assert.ok(of(withheld).length > 0 && of(withheld).every(day => day.withholding_minor > 0));
  assert.ok(of(free).length > 0 && of(free).every(day => day.withholding_minor === 0 && day.net_minor === day.gross_minor),
    'nothing at all is taken from the product that is not withheld');
});

test('cashing in, or the reverse, moves the account and leaves the product balance where it was', async () => {
  const { engine, yields, transactions, categories, ids } = await setup();
  await yields.enrol({ account_id: ids.uala, opening_cushion_minor: 600_000_000, opening_on: '2026-08-31', withholding: false });
  const [product] = await yields.pockets(ids.uala);
  const income = await categories.create({ name: 'Rendimientos', kind: 'income', builtin_icon: 'cash' });
  const balance = async () => (await engine.heldByPocket(ids.uala, '2026-09-10')).get(product.id)
    + (await yields.landedByPocket(ids.uala, '2026-09-10')).total.get(product.id);
  const before = await balance();
  const cushion = async () => (await yields.cushion(ids.uala)).totalMinor;
  const gathered = await cushion();

  // Cashing in 3 million, written the way the income screen writes it.
  const cashed = await transactions.create({
    account_id: ids.uala, category_id: income, occurred_on: '2026-09-05', amount_minor: 300_000_000, source: 'manual',
  });
  await yields.withdraw({
    account_id: ids.uala, on_date: '2026-09-05', amount_minor: 300_000_000, transaction_id: cashed, pocket_id: product.id,
  });
  assert.equal(await balance(), before, 'the product holds what it held');
  assert.equal(await cushion(), gathered - 300_000_000, 'what it had gathered is 3 million less');

  // And the reverse, as an expense of 1 million.
  await transactions.create({
    account_id: ids.uala, category_id: ids.gastos, occurred_on: '2026-09-06', amount_minor: -100_000_000, source: 'manual',
  });
  await yields.adjust({ account_id: ids.uala, on_date: '2026-09-06', amount_minor: 100_000_000, kind: 'other', pocket_id: product.id });
  assert.equal(await balance(), before);
  assert.equal(await cushion(), gathered - 200_000_000);
});

test('correcting or deleting a cashed-in movement carries its other half with it', async () => {
  const { engine, yields, transactions, categories, ids } = await setup();
  await yields.enrol({ account_id: ids.uala, opening_cushion_minor: 600_000_000, opening_on: '2026-08-31', withholding: false });
  const [product] = await yields.pockets(ids.uala);
  const income = await categories.create({ name: 'Rendimientos', kind: 'income', builtin_icon: 'cash' });
  const balance = async () => (await engine.heldByPocket(ids.uala, '2026-09-10')).get(product.id)
    + (await yields.landedByPocket(ids.uala, '2026-09-10')).total.get(product.id);
  const before = await balance();

  const cashed = await transactions.create({
    account_id: ids.uala, category_id: income, occurred_on: '2026-09-05', amount_minor: 300_000_000, source: 'manual',
  });
  await yields.withdraw({
    account_id: ids.uala, on_date: '2026-09-05', amount_minor: 300_000_000, transaction_id: cashed, pocket_id: product.id,
  });
  const spent = await transactions.create({
    account_id: ids.uala, category_id: ids.gastos, occurred_on: '2026-09-06', amount_minor: -100_000_000, source: 'manual',
  });
  await yields.adjust({
    account_id: ids.uala, on_date: '2026-09-06', amount_minor: 100_000_000, kind: 'other', pocket_id: product.id, transaction_id: spent,
  });

  await transactions.update(cashed, { amount_minor: 200_000_000, occurred_on: '2026-09-07' });
  await transactions.update(spent, { amount_minor: -50_000_000 });
  assert.equal(await balance(), before, 'the product still holds what it held');
  const [taken] = await yields.withdrawals(ids.uala);
  assert.deepEqual([taken.amount_minor, taken.on_date], [200_000_000, '2026-09-07']);
  assert.equal((await yields.adjustments(ids.uala))[0].amount_minor, 50_000_000);

  await transactions.delete(cashed);
  await transactions.delete(spent);
  assert.equal(await balance(), before, 'and deleting takes both halves');
});

test('a month worked out on its own comes to the same as one walk from the start', async () => {
  const { engine, yields, ids } = await setup();
  await yields.enrol({ account_id: ids.uala, opening_cushion_minor: 0, opening_on: '2026-08-31', withholding: false });
  const [main] = await yields.pockets(ids.uala);
  await yields.setPocketSource(main.id, 'manual');
  await yields.setPocketBalance({ pocket_id: main.id, valid_from: '2026-08-31', amount_minor: 1_000_000_000 });
  const monthly = await yields.addPocket({
    account_id: ids.uala, name: 'Mensual', source: 'manual', sort_order: 1, payout: 'monthly', payout_months: 1,
  });
  await yields.setPocketBalance({ pocket_id: monthly, valid_from: '2026-08-31', amount_minor: 500_000_000 });
  await yields.setRate({ account_id: ids.uala, pocket_id: main.id, component: 'base', payout: 'daily', valid_from: '2026-08-31', annual_rate_scaled: pct(10) });
  await yields.setRate({ account_id: ids.uala, pocket_id: monthly, component: 'base', payout: 'monthly', payout_months: 1, valid_from: '2026-08-31', annual_rate_scaled: pct(12) });
  // One entry on the day the account started, one in September.
  await yields.adjust({ account_id: ids.uala, pocket_id: main.id, on_date: '2026-08-31', amount_minor: 20_000_000, kind: 'other' });
  await yields.adjust({ account_id: ids.uala, pocket_id: main.id, on_date: '2026-09-15', amount_minor: 30_000_000, kind: 'cashback' });

  const snapshot = async () => (await yields.days(ids.uala))
    .map(day => [day.pocket_id, day.component, day.on_date, day.balance_minor, day.net_minor]);

  // Month by month: the second pass starts again on the 1st of October, with
  // September's paid yield and both entries already behind it.
  await engine.accrue(ids.uala, '2026-10-05');
  await engine.accrue(ids.uala, '2026-10-20');
  const monthByMonth = await snapshot();

  await yields.clearDays(ids.uala);
  await engine.accrue(ids.uala, '2026-10-20');
  assert.deepEqual(monthByMonth, await snapshot(), 'the same days, the same balances, the same yield');

  const october = monthByMonth.find(day => day[0] === main.id && day[2] === '2026-10-02');
  assert.ok(october[3] > 1_050_000_000, 'October earns on the balance, both entries and September\'s yield');
});

test('a new product opened with money from another one holds it, and earns on it, from that day', async () => {
  const { engine, yields, transfers, ids } = await setup();
  await yields.enrol({ account_id: ids.uala, opening_cushion_minor: 0, opening_on: '2026-08-31', withholding: false });
  const [main] = await yields.pockets(ids.uala);
  await yields.setPocketSource(main.id, 'manual');
  await yields.setPocketBalance({ pocket_id: main.id, valid_from: '2026-08-31', amount_minor: 1_000_000_000 });

  // What the product form writes: the new product empty the day before, and a
  // transfer carrying the money in.
  const created = await yields.addPocket({ account_id: ids.uala, name: 'CDT', source: 'manual', sort_order: 1 });
  await yields.setPocketBalance({ pocket_id: created, valid_from: '2026-09-04', amount_minor: 0 });
  await transfers.create({
    occurred_on: '2026-09-05', description: 'Saldo inicial de CDT',
    from: { account_id: ids.uala, pocket_id: main.id, amount_minor: 300_000_000 },
    to: { account_id: ids.uala, pocket_id: created, amount_minor: 300_000_000 },
  });

  const held = await engine.heldByPocket(ids.uala, '2026-09-10');
  assert.equal(held.get(created), 300_000_000, 'the new product holds what came in');
  assert.equal(held.get(main.id), 700_000_000, 'and the one it came from holds that much less');

  await yields.setRate({ account_id: ids.uala, pocket_id: created, component: 'base', payout: 'daily', valid_from: '2026-08-31', annual_rate_scaled: pct(10) });
  await engine.accrue(ids.uala, '2026-09-10');
  const earning = (await yields.days(ids.uala)).find(day => day.pocket_id === created && day.on_date === '2026-09-06');
  assert.equal(earning.balance_minor, 300_000_000, 'it earns on the money from the day after it arrived');
  assert.equal((await yields.withdrawals(ids.uala)).length, 0);
  assert.equal((await yields.adjustments(ids.uala)).length, 0);
});

test('a future rate takes over on its day, without being remembered', async () => {
  const { engine, yields, ids } = await setup();
  await yields.enrol({
    account_id: ids.rappi, opening_cushion_minor: 0, opening_on: '2026-09-09', withholding: false,
  });

  // Plata's real case: fixed at 11% until 2026-11-08, 9% from the 9th.
  await yields.setRate({ account_id: ids.rappi, valid_from: '2026-09-09', annual_rate_scaled: pct(11) });
  await yields.setRate({ account_id: ids.rappi, valid_from: '2026-11-09', annual_rate_scaled: pct(9) });

  await engine.accrue(ids.rappi, '2026-11-10');
  const days = await yields.days(ids.rappi);
  const on = date => days.find(d => d.on_date === date);

  assert.equal(on('2026-11-08').annual_rate_scaled, pct(11));
  assert.equal(on('2026-11-09').annual_rate_scaled, pct(9));
  assert.equal(on('2026-11-10').annual_rate_scaled, pct(9));
});

test('a day corrected by hand is never rewritten, and still counts', async () => {
  const { engine, yields, ids } = await setup();
  await yields.enrol({
    account_id: ids.rappi, opening_cushion_minor: 0, opening_on: '2026-09-09', withholding: false,
  });
  await yields.setRate({ account_id: ids.rappi, valid_from: '2026-09-09', annual_rate_scaled: pct(9) });

  await engine.accrue(ids.rappi, '2026-09-12');
  const computed = (await yields.days(ids.rappi)).find(d => d.on_date === '2026-09-11');

  // The statement said something else. Corrected on the pocket, not on the
  // account: an account can hold several, and only one of them was wrong.
  await yields.correctDay(computed.pocket_id, '2026-09-11', 99_999);

  const result = await engine.accrue(ids.rappi, '2026-09-15');
  assert.equal(result.daysLocked, 1);

  const day = (await yields.days(ids.rappi)).find(d => d.on_date === '2026-09-11');
  assert.equal(day.actual_net_minor, 99_999);
  assert.equal(day.net_minor, computed.net_minor, 'what the app worked out is still there to compare');
  assert.equal(day.locked, 1);

  // The cushion counts the corrected figure, not the computed one.
  const cushion = await yields.cushion(ids.rappi, '2026-09-11');
  assert.equal(cushion.accrued_minor,
    (await yields.days(ids.rappi, '2026-09-10', '2026-09-10'))[0].net_minor + 99_999);
});

test('adjustments and withdrawals move the cushion, and the account does not', async () => {
  const { engine, yields, accounts, ids } = await setup();
  await yields.enrol({
    account_id: ids.rappi, opening_cushion_minor: 491_743_498,
    opening_on: '2026-09-09', withholding: false,
  });
  await yields.setRate({ account_id: ids.rappi, valid_from: '2026-09-09', annual_rate_scaled: pct(9), payout: 'monthly' });
  await engine.accrue(ids.rappi, '2026-09-30');

  const before = await yields.cushion(ids.rappi);

  // The bank paid 1,000.00 less than the app worked out.
  await yields.adjust({
    account_id: ids.rappi, on_date: '2026-09-30', amount_minor: -100_000,
    note: 'Deposit on the 30th came in short',
  });
  // And 2,000,000.00 was moved into the account.
  await yields.withdraw({
    account_id: ids.rappi, on_date: '2026-09-30', amount_minor: 200_000_000,
    note: 'Ajuste rendimientos',
  });

  const after = await yields.cushion(ids.rappi);
  assert.equal(after.adjusted_minor, -100_000);
  assert.equal(after.withdrawn_minor, 200_000_000);
  assert.equal(after.totalMinor, before.totalMinor - 100_000 - 200_000_000);

  // None of it touched the account itself, which is the whole point.
  const balance = await accounts.balance(ids.rappi);
  assert.equal(balance.balance_minor, 1_000_000_000);
});

test('re-running the same day twice does not pay twice', async () => {
  const { engine, yields, ids } = await setup();
  await yields.enrol({
    account_id: ids.rappi, opening_cushion_minor: 0, opening_on: '2026-09-09', withholding: false,
  });
  await yields.setRate({ account_id: ids.rappi, valid_from: '2026-09-09', annual_rate_scaled: pct(9) });

  await engine.accrue(ids.rappi, '2026-09-20');
  const once = await yields.cushion(ids.rappi);

  await engine.accrue(ids.rappi, '2026-09-20');
  await engine.accrue(ids.rappi, '2026-09-20');

  assert.equal((await yields.cushion(ids.rappi)).totalMinor, once.totalMinor);
  assert.equal((await yields.days(ids.rappi)).length, 11);
});

test('missing a monthly condition drops to the fallback rate, not to nothing', async () => {
  const { engine, yields, transactions, ids } = await setup();
  await yields.enrol({
    account_id: ids.uala, opening_cushion_minor: 0, opening_on: '2026-08-31', withholding: false,
  });
  // Uala's real terms: 10.5% E.A. with 400,000 spent in the month, 5% without.
  await yields.setRate({
    account_id: ids.uala, valid_from: '2026-08-31', annual_rate_scaled: pct(10.5),
    requires_monthly_spend_minor: 40_000_000,
    fallback_annual_rate_scaled: pct(5),
  });

  // September: only 300,000 spent, so the month pays the fallback.
  await transactions.create({
    account_id: ids.uala, category_id: ids.gastos, occurred_on: '2026-09-05',
    amount_minor: -30_000_000, source: 'manual',
  });

  let result = await engine.accrue(ids.uala, '2026-09-30');
  assert.equal(result.daysConditionNotMet, 30);
  assert.ok(result.netMinor > 0, 'a missed condition still earns something');

  const atFive = (await yields.days(ids.uala))[0];
  assert.equal(atFive.annual_rate_scaled, pct(5));

  // Another 150,000 crosses the threshold, and the whole month is redone at
  // the full rate - including the days before the spending happened.
  await transactions.create({
    account_id: ids.uala, category_id: ids.gastos, occurred_on: '2026-09-21',
    amount_minor: -15_000_000, source: 'manual',
  });
  result = await engine.accrue(ids.uala, '2026-09-30');

  assert.equal(result.from, '2026-09-01', 'a recompute restarts at the top of the month');
  assert.equal(result.daysConditionNotMet, 0);
  const atFull = (await yields.days(ids.uala))[0];
  assert.equal(atFull.annual_rate_scaled, pct(10.5));
  assert.ok(atFull.gross_minor > atFive.gross_minor);
});

test('a band with no fallback still earns nothing when its condition is missed', async () => {
  const { engine, yields, ids } = await setup();
  await yields.enrol({
    account_id: ids.uala, opening_cushion_minor: 0, opening_on: '2026-08-31', withholding: false,
  });
  await yields.setRate({
    account_id: ids.uala, valid_from: '2026-08-31', annual_rate_scaled: pct(10.5),
    requires_monthly_spend_minor: 40_000_000,
  });

  const result = await engine.accrue(ids.uala, '2026-09-30');
  assert.equal(result.netMinor, 0);
  assert.equal((await yields.days(ids.uala))[0].annual_rate_scaled, 0);
});




test('a foreign-currency cushion stays in its own currency', async () => {
  const { engine, yields, accounts, ids } = await setup();
  const arq = await accounts.create({
    name: 'ARQ USD', type: 'investment', currency_code: 'USD', builtin_icon: 'trending-up',
    opening_balance_minor: 1_000_000, opened_on: '2024-08-13',
  });

  // 15.90 dollars of cushion at 2% E.A., exactly as Jose recorded it.
  await yields.enrol({
    account_id: arq, opening_cushion_minor: 1590, opening_on: '2026-09-09', withholding: false,
  });
  await yields.setRate({ account_id: arq, valid_from: '2026-09-09', annual_rate_scaled: pct(2) });

  await engine.accrue(arq, '2026-12-31');
  const cushion = await yields.cushion(arq);

  // 10,000 dollars at 2% for 113 days is around 61 dollars, so the cushion
  // lands near 77 - not a peso figure, and not converted anywhere.
  assert.ok(cushion.totalMinor > 1590);
  assert.ok(cushion.totalMinor < 10_000, `${cushion.totalMinor} is not a dollar figure`);
  assert.equal(cushion.totalMinor, expectedCushion(1_000_000, 1590, pct(2), 113));
});

// ---------------------------------------------------------------------------
// Pockets
//
// The reason this exists: Dale is two "alcancias" and the bank pays each of
// them separately. The withholding threshold in articulo 1.2.4.2.87 applies to
// a payment, so adding them up before taxing charges withholding that is not
// owed. These are the real balances, read on 2026-09-10.
// ---------------------------------------------------------------------------

/** Invented tax figures, entered the way the real ones are. */
async function withRealisticWithholding(tax) {
  const params = [
    [TAX_KEYS.uvtValue, '5237400'],
    [TAX_KEYS.threshold, '0.055'],
    [TAX_KEYS.percent, String(pct(7))],
    [TAX_KEYS.base, 'all'],
  ];
  for (const [key, value] of params) {
    await tax.set({ key, valid_from: '2026-01-01', value, source: 'test', confirmed: true });
  }
}

test('two pockets are taxed apart, and it changes the answer', async () => {
  const { db, accounts, yields, tax, engine } = await setup();
  await withRealisticWithholding(tax);

  const dale = await accounts.create({
    name: 'Dale', type: 'debit', currency_code: 'COP', builtin_icon: 'wallet',
    opening_balance_minor: 2_019_391_825, opened_on: '2024-01-01',
  });
  await yields.enrol({
    account_id: dale, opening_cushion_minor: 0, opening_on: '2026-09-10', withholding: true,
  });
  await yields.setRate({ account_id: dale, valid_from: '2026-09-10', annual_rate_scaled: pct(10.5) });

  // First, as one pot: 5,524.78 a day, over the 2,880.57 threshold.
  await engine.accrue(dale, '2026-09-11');
  const asOne = (await yields.days(dale))[0];
  assert.equal(asOne.gross_minor, 552478);
  assert.equal(asOne.withholding_minor, Math.round(552478 * 0.07), 'one pot crosses the threshold');

  // Now split into the two real alcancias, which add up to exactly the balance
  // the ledger already knew about.
  const [existing] = await yields.pockets(dale);
  await yields.renamePocket(existing.id, 'Alcancia principal');
  await db.run("UPDATE yield_pockets SET source = 'manual' WHERE id = ?", [existing.id]);
  await yields.setPocketBalance({
    pocket_id: existing.id, valid_from: '2026-09-10', amount_minor: 1_009_645_100,
  });
  const second = await yields.addPocket({
    account_id: dale, name: 'Alcancia complemento', source: 'manual', sort_order: 1,
  });
  await yields.setPocketBalance({
    pocket_id: second, valid_from: '2026-09-10', amount_minor: 1_009_746_725,
  });

  await yields.clearDays(dale);
  const result = await engine.accrue(dale, '2026-09-11');
  assert.equal(result.pockets, 2);

  const days = await yields.days(dale, '2026-09-11', '2026-09-11');
  assert.equal(days.length, 2, 'one row per pocket per day');

  // 2,762.25 and 2,762.53: both under the threshold, so nothing is withheld.
  assert.deepEqual(days.map(day => day.gross_minor).sort(), [276225, 276253]);
  for (const day of days) {
    assert.equal(day.withholding_minor, 0, 'neither pocket reaches 0.055 UVT');
    assert.equal(day.net_minor, day.gross_minor);
  }

  // Same gross to the cent, and the whole withholding gone. That difference is
  // the point of the exercise.
  const grossTogether = days.reduce((sum, day) => sum + day.gross_minor, 0);
  assert.equal(grossTogether, 552478);
  assert.equal((await yields.cushion(dale)).totalMinor, 552478);
  assert.ok(grossTogether > asOne.net_minor,
    'splitting keeps money the account was being charged');
});

test('an account keeps one pocket unless someone splits it', async () => {
  const { yields, ids } = await setup();
  await yields.enrol({
    account_id: ids.rappi, opening_cushion_minor: 0, opening_on: '2026-09-09',
  });

  const pockets = await yields.pockets(ids.rappi);
  assert.equal(pockets.length, 1);
  assert.equal(pockets[0].source, 'ledger', 'it follows the account balance');
  // Named for what it is. An account starts as one savings product, and the
  // caller supplies the word so it arrives in the language the user reads.
  assert.equal(pockets[0].name, 'Savings account');

  // Enrolling again must not pile up pockets.
  await yields.enrol({
    account_id: ids.rappi, opening_cushion_minor: 500, opening_on: '2026-09-09',
  });
  assert.equal((await yields.pockets(ids.rappi)).length, 1);
});



test('removing a pocket takes its days with it', async () => {
  const { yields, engine, ids } = await setup();
  await yields.enrol({
    account_id: ids.rappi, opening_cushion_minor: 0, opening_on: '2026-09-09', withholding: false,
  });
  await yields.setRate({ account_id: ids.rappi, valid_from: '2026-09-09', annual_rate_scaled: pct(9) });

  const named = await yields.addPocket({
    account_id: ids.rappi, name: 'Meta', source: 'manual', sort_order: 1,
  });
  await yields.setPocketBalance({
    pocket_id: named, valid_from: '2026-09-09', amount_minor: 100_000_000,
  });
  await engine.accrue(ids.rappi, '2026-09-15');
  assert.equal((await yields.pocketDays(named)).length, 6);

  await yields.removePocket(named);
  assert.equal((await yields.pocketDays(named)).length, 0);
  assert.equal((await yields.pocketBalances(named)).length, 0);
  assert.equal((await yields.pockets(ids.rappi)).length, 1);
});

test('a figure typed for a pocket is the bank figure, cushion included', async () => {
  const { db, accounts, yields, tax, engine } = await setup();
  await withRealisticWithholding(tax);

  // Dale exactly as it stands on 2026-09-10, with the cushion of 526,619.25
  // that accumulated before this app existed.
  const dale = await accounts.create({
    name: 'Dale', type: 'debit', currency_code: 'COP', builtin_icon: 'wallet',
    opening_balance_minor: 2_019_391_825, opened_on: '2024-01-01',
  });
  await yields.enrol({
    account_id: dale, opening_cushion_minor: 52_661_925,
    opening_on: '2026-09-09', withholding: true,
  });
  await yields.setRate({ account_id: dale, valid_from: '2026-09-09', annual_rate_scaled: pct(10.5) });

  const [first] = await yields.pockets(dale);
  await db.run("UPDATE yield_pockets SET source = 'manual' WHERE id = ?", [first.id]);
  await yields.setPocketBalance({
    pocket_id: first.id, valid_from: '2026-09-10', amount_minor: 1_009_645_100,
  });
  const second = await yields.addPocket({
    account_id: dale, name: 'Alcancia complemento', source: 'manual', sort_order: 1,
  });
  await yields.setPocketBalance({
    pocket_id: second, valid_from: '2026-09-10', amount_minor: 1_009_746_725,
  });

  await engine.accrue(dale, '2026-09-10');
  const days = await yields.days(dale, '2026-09-10', '2026-09-10');

  // The base is the figure typed in, and nothing else. A bank balance already
  // holds every yield that bank ever paid; adding the cushion on top of it
  // counts the same money twice.
  assert.deepEqual(days.map(day => day.balance_minor).sort((a, b) => a - b),
    [1_009_645_100, 1_009_746_725]);

  // Which is what Jose reads off Dale: 2,762.25 and 2,762.53, both under the
  // 2,880.57 the threshold works out to, so neither is withheld.
  assert.deepEqual(days.map(day => day.gross_minor).sort((a, b) => a - b), [276225, 276253]);
  for (const day of days) {
    assert.equal(day.withholding_minor, 0);
  }

  // And tomorrow each pocket earns on what the bank will show today: the
  // figure typed in plus what it just earned.
  await engine.accrue(dale, '2026-09-11');
  const tomorrow = await yields.days(dale, '2026-09-11', '2026-09-11');
  assert.deepEqual(tomorrow.map(day => day.balance_minor).sort((a, b) => a - b),
    [1_009_645_100 + 276225, 1_009_746_725 + 276253]);
});

test('the opening figure is a record, and never joins the base', async () => {
  const { yields, engine, ids } = await setup();
  await yields.enrol({
    account_id: ids.rappi, opening_cushion_minor: 491_743_498,
    opening_on: '2026-09-09', withholding: false,
  });
  await yields.setRate({ account_id: ids.rappi, valid_from: '2026-09-09', annual_rate_scaled: pct(9) });

  await engine.accrue(ids.rappi, '2026-09-10');
  const day = (await yields.days(ids.rappi))[0];

  // Rappi cuenta holds 67.9 million and the app had it earning on 72.8, which
  // is the balance plus a figure that was already inside the balance. The
  // account earns on what the account holds.
  assert.equal(day.balance_minor, 1_000_000_000);

  // And the figure is still there, because it is still money that was earned
  // and can be moved into net worth.
  assert.equal((await yields.cushion(ids.rappi)).opening_minor, 491_743_498);
});

test('a pocket earning nothing is not a pocket losing the cushion', async () => {
  const { db, yields, engine, ids } = await setup();
  await yields.enrol({
    account_id: ids.rappi, opening_cushion_minor: 100_000_000,
    opening_on: '2026-09-09', withholding: false,
  });
  await yields.setRate({ account_id: ids.rappi, valid_from: '2026-09-09', annual_rate_scaled: pct(9) });

  // Every pocket typed in by hand, so nothing carries the cushion.
  const [only] = await yields.pockets(ids.rappi);
  await db.run("UPDATE yield_pockets SET source = 'manual' WHERE id = ?", [only.id]);
  await yields.setPocketBalance({
    pocket_id: only.id, valid_from: '2026-09-09', amount_minor: 1_000_000_000,
  });

  await engine.accrue(ids.rappi, '2026-09-10');
  const cushion = await yields.cushion(ids.rappi);

  // It does not earn, because it is already inside the figure typed in. It is
  // still there, and still money that can be moved into net worth.
  assert.equal((await yields.days(ids.rappi))[0].balance_minor, 1_000_000_000);
  assert.equal(cushion.opening_minor, 100_000_000);
  assert.ok(cushion.totalMinor > 100_000_000);
});

// ---------------------------------------------------------------------------
// Drift
//
// A pocket figure is what the bank says and contains every yield it ever paid.
// A ledger balance is what Monefy recorded and contains none of them. Comparing
// the two directly reports a difference of exactly the cushion, forever, and
// tells the user to correct data that was never wrong - which is what Dale did
// on 2026-09-11: "no cuadran por -526.619,25", the cushion to the cent.
// ---------------------------------------------------------------------------

/** Dale as it stands: two typed pockets, a cushion the ledger never saw. */
async function daleWithPockets({ accounts, yields, db }) {
  const dale = await accounts.create({
    name: 'Dale', type: 'debit', currency_code: 'COP', builtin_icon: 'wallet',
    // The ledger is the pocket total MINUS the cushion, because Monefy never
    // recorded a single one of those yields.
    opening_balance_minor: 1_966_729_900, opened_on: '2024-01-01',
  });
  await yields.enrol({
    account_id: dale, opening_cushion_minor: 52_661_925,
    opening_on: '2026-09-09', withholding: true,
  });
  await yields.setRate({ account_id: dale, valid_from: '2026-09-09', annual_rate_scaled: pct(10.5) });

  const [first] = await yields.pockets(dale);
  await db.run("UPDATE yield_pockets SET source = 'manual' WHERE id = ?", [first.id]);
  await yields.setPocketBalance({
    pocket_id: first.id, valid_from: '2026-09-10', amount_minor: 1_009_645_100,
  });
  const second = await yields.addPocket({
    account_id: dale, name: 'Alcancia complemento', source: 'manual', sort_order: 1,
  });
  await yields.setPocketBalance({
    pocket_id: second, valid_from: '2026-09-10', amount_minor: 1_009_746_725,
  });
  return dale;
}





// ---------------------------------------------------------------------------
// Money landing in the cushion mid-week
//
// Jose's scenario, and the bug it uncovered: the app accrues day after day,
// and on the Wednesday 10,000 arrives as cashback. Every day from Thursday on
// has to earn on the larger balance, because a daily yield is always worked
// out on what was there the day before. The total was right and every day
// after the entry was quietly too small.
// ---------------------------------------------------------------------------

test('cashback arriving mid-week compounds into the days after it', async () => {
  const { yields, engine, ids } = await setup();
  await yields.enrol({
    account_id: ids.rappi, opening_cushion_minor: 0, opening_on: '2026-09-09', withholding: false,
  });
  await yields.setRate({ account_id: ids.rappi, valid_from: '2026-09-09', annual_rate_scaled: pct(9) });

  // A week with nothing added, kept for comparison.
  await engine.accrue(ids.rappi, '2026-09-16');
  const plain = (await yields.days(ids.rappi)).map(day => day.gross_minor);

  // Now 100,000.00 of cashback lands on the Wednesday.
  await yields.adjust({
    account_id: ids.rappi, on_date: '2026-09-12', amount_minor: 10_000_000,
    kind: 'cashback', note: 'Cashback Rappi card',
  });
  await yields.clearDays(ids.rappi);
  await engine.accrue(ids.rappi, '2026-09-16');
  const after = await yields.days(ids.rappi);

  const on = date => after.find(day => day.on_date === date);

  // Up to and including the day it arrived, nothing changes: a figure recorded
  // on a day already covers that day.
  assert.equal(on('2026-09-11').gross_minor, plain[1]);
  assert.equal(on('2026-09-12').gross_minor, plain[2], 'the day it landed is unchanged');

  // From the next day on, every one of them earns more.
  assert.ok(on('2026-09-13').gross_minor > plain[3], 'the day after has to earn more');
  assert.ok(on('2026-09-16').gross_minor > plain[6]);

  // And by what 100,000.00 earns at that rate, within the cent that rounding
  // owns: each day is rounded on its own whole base, and the difference of two
  // rounded figures is not the rounded difference. A cent either way here is
  // the arithmetic being right, not being sloppy.
  const expected = Math.round(10_000_000 * dailyRate(pct(9)));
  assert.ok(Math.abs((on('2026-09-13').gross_minor - plain[3]) - expected) <= 1,
    `grew by ${on('2026-09-13').gross_minor - plain[3]}, expected about ${expected}`);

  // The base itself says so, which is what makes the figure explainable.
  assert.equal(on('2026-09-13').balance_minor - on('2026-09-12').balance_minor,
    10_000_000 + on('2026-09-12').net_minor);
});

test('an entry keeps what it is, so it can be told apart later', async () => {
  const { yields, ids } = await setup();
  await yields.enrol({
    account_id: ids.rappi, opening_cushion_minor: 0, opening_on: '2026-09-09',
  });

  await yields.adjust({
    account_id: ids.rappi, on_date: '2026-09-12', amount_minor: 10_000_000,
    kind: 'cashback', note: 'Cashback Rappi card',
  });
  await yields.adjust({
    account_id: ids.rappi, on_date: '2026-09-30', amount_minor: -100_000,
    kind: 'correction', note: 'El depósito llegó corto',
  });

  const entries = await yields.adjustments(ids.rappi);
  assert.deepEqual(entries.map(entry => entry.kind), ['cashback', 'correction']);
  assert.equal(entries[0].note, 'Cashback Rappi card');

  // Cashback is not withheld and interest is, so the tax module will need this
  // apart. An entry with no kind would be a figure nobody can classify.
  assert.equal(entries[1].amount_minor, -100_000, 'a correction can go either way');
});

test('taking money out mid-week takes it out of the compounding too', async () => {
  const { yields, engine, ids } = await setup();
  await yields.enrol({
    account_id: ids.rappi, opening_cushion_minor: 50_000_000,
    opening_on: '2026-09-09', withholding: false,
  });
  await yields.setRate({ account_id: ids.rappi, valid_from: '2026-09-09', annual_rate_scaled: pct(9) });

  await engine.accrue(ids.rappi, '2026-09-16');
  const plain = (await yields.days(ids.rappi)).map(day => day.gross_minor);

  await yields.withdraw({
    account_id: ids.rappi, on_date: '2026-09-12', amount_minor: 50_000_000,
    note: 'Ajuste rendimientos',
  });
  await yields.clearDays(ids.rappi);
  await engine.accrue(ids.rappi, '2026-09-16');
  const after = await yields.days(ids.rappi);
  const on = date => after.find(day => day.on_date === date);

  assert.equal(on('2026-09-12').gross_minor, plain[2], 'the day it left is unchanged');
  assert.ok(on('2026-09-13').gross_minor < plain[3], 'money that left stops earning');

  const expected = Math.round(50_000_000 * dailyRate(pct(9)));
  assert.ok(Math.abs((plain[3] - on('2026-09-13').gross_minor) - expected) <= 1,
    `fell by ${plain[3] - on('2026-09-13').gross_minor}, expected about ${expected}`);
});


// ---------------------------------------------------------------------------
// When the bank actually pays
//
// Only four of Jose's accounts hand the yield over every day: Uala, Dale,
// Plata and ARQ in dollars. The rest work it out daily and pay once a month.
// A yield that has not been paid is not in the account and is not earning.
// ---------------------------------------------------------------------------

test('a monthly account does not compound until it is paid', async () => {
  const { yields, engine, ids } = await setup();
  await yields.enrol({
    account_id: ids.rappi, opening_cushion_minor: 0, opening_on: '2026-08-31',
    withholding: false,
  });
  await yields.setRate({
    account_id: ids.rappi, valid_from: '2026-08-31', annual_rate_scaled: pct(9), payout: 'monthly',
  });

  await engine.accrue(ids.rappi, '2026-09-30');
  const days = await yields.days(ids.rappi);

  // Every day of September earns on exactly the same base, because nothing
  // was handed over in between.
  const bases = new Set(days.map(day => day.balance_minor));
  assert.equal(bases.size, 1, 'the base moved during a month that pays nothing');
  assert.equal([...bases][0], 1_000_000_000);

  // The money is still earned - it is in the cushion, just not in the account.
  const cushion = await yields.cushion(ids.rappi);
  assert.equal(cushion.totalMinor, days.reduce((sum, day) => sum + day.net_minor, 0));
  assert.ok(cushion.totalMinor > 0);
});

test('and starts compounding the day after payday', async () => {
  const { yields, engine, ids } = await setup();
  await yields.enrol({
    account_id: ids.rappi, opening_cushion_minor: 0, opening_on: '2026-08-31',
    withholding: false,
  });
  await yields.setRate({ account_id: ids.rappi, valid_from: '2026-08-31', annual_rate_scaled: pct(9), payout: 'monthly' });

  await engine.accrue(ids.rappi, '2026-10-02');
  const days = await yields.days(ids.rappi);
  const on = date => days.find(day => day.on_date === date);

  const september = days
    .filter(day => day.on_date.startsWith('2026-09'))
    .reduce((sum, day) => sum + day.net_minor, 0);

  assert.equal(on('2026-09-30').balance_minor, 1_000_000_000, 'payday itself earns on the old base');
  assert.equal(on('2026-10-01').balance_minor, 1_000_000_000 + september,
    'the whole month lands at once');
  assert.ok(on('2026-10-01').gross_minor > on('2026-09-30').gross_minor);
});

test('a daily account compounds every day, as before', async () => {
  const { yields, engine, ids } = await setup();
  await yields.enrol({
    account_id: ids.uala, opening_cushion_minor: 0, opening_on: '2026-08-31',
    withholding: false,
  });
  await yields.setRate({ account_id: ids.uala, valid_from: '2026-08-31', annual_rate_scaled: pct(10.5), payout: 'daily' });

  await engine.accrue(ids.uala, '2026-09-05');
  const days = await yields.days(ids.uala);

  for (let i = 1; i < days.length; i += 1) {
    assert.equal(days[i].balance_minor, days[i - 1].balance_minor + days[i - 1].net_minor,
      `${days[i].on_date} did not build on the day before it`);
  }
});

test('over a year, paying monthly earns less than paying daily', async () => {
  const { yields, engine, ids } = await setup();

  await yields.enrol({
    account_id: ids.rappi, opening_cushion_minor: 0, opening_on: '2025-12-31',
    withholding: false,
  });
  await yields.setRate({ account_id: ids.rappi, valid_from: '2025-12-31', annual_rate_scaled: pct(12), payout: 'monthly' });
  await engine.accrue(ids.rappi, '2026-12-31');
  const monthly = (await yields.cushion(ids.rappi)).totalMinor;

  await yields.enrol({
    account_id: ids.uala, opening_cushion_minor: 0, opening_on: '2025-12-31',
    withholding: false,
  });
  await yields.setRate({ account_id: ids.uala, valid_from: '2025-12-31', annual_rate_scaled: pct(12), payout: 'daily' });
  await engine.accrue(ids.uala, '2026-12-31');
  const daily = (await yields.cushion(ids.uala)).totalMinor;

  // Same balance, same rate, same year. Holding the money back costs
  // something real, and calling a monthly account daily would have quietly
  // credited that difference.
  assert.ok(daily > monthly, `daily ${daily} should beat monthly ${monthly}`);
  assert.ok(daily - monthly > 0 && daily - monthly < daily * 0.01,
    'and the gap is small but not nothing');

  // A daily account at 12% E.A. returns 12% over the year, by construction.
  assert.ok(Math.abs(daily - 120_000_000) < 100, `${daily} is not 12% of 10,000,000.00`);
});

// ---------------------------------------------------------------------------
// The base is stated, not derived
//
// Six migrations worked the base out as a sum - ledger plus cushion, minus a
// part that was "not earning" - and each version was wrong in its own way,
// because each was an inference about what a figure Jose gave actually meant.
// The figure he states IS the base. What the ledger contributes is only the
// change since he stated it.
// ---------------------------------------------------------------------------

test('an account earns on the figure stated for it, and nothing else', async () => {
  const { db, yields, engine, ids } = await setup();

  // The account holds 10,000,000.00 as far as the ledger knows, and a cushion
  // of 4,917,434.98 was recorded. Neither belongs in the base.
  await yields.enrol({
    account_id: ids.rappi, opening_cushion_minor: 491_743_498,
    opening_on: '2026-09-09', withholding: false,
  });
  await yields.setRate({ account_id: ids.rappi, valid_from: '2026-09-09', annual_rate_scaled: pct(9) });

  const [pocket] = await yields.pockets(ids.rappi);
  await db.run("UPDATE yield_pockets SET source = 'manual' WHERE id = ?", [pocket.id]);
  await yields.setPocketBalance({
    pocket_id: pocket.id, valid_from: '2026-09-09', amount_minor: 6_795_974_641,
  });

  await engine.accrue(ids.rappi, '2026-09-10');
  const day = (await yields.days(ids.rappi))[0];

  assert.equal(day.balance_minor, 6_795_974_641, 'the stated figure, to the peso');
});

test('a movement after the figure was stated is added on top', async () => {
  const { db, yields, engine, transactions, ids } = await setup();
  await yields.enrol({
    account_id: ids.rappi, opening_cushion_minor: 0, opening_on: '2026-09-09', withholding: false,
  });
  await yields.setRate({ account_id: ids.rappi, valid_from: '2026-09-09', annual_rate_scaled: pct(9) });

  const [pocket] = await yields.pockets(ids.rappi);
  await db.run("UPDATE yield_pockets SET source = 'manual' WHERE id = ?", [pocket.id]);
  await yields.setPocketBalance({
    pocket_id: pocket.id, valid_from: '2026-09-09', amount_minor: 100_000_000,
  });

  // 500,000.00 arrives on the 11th, recorded like any other movement.
  await transactions.create({
    account_id: ids.rappi, category_id: ids.gastos, occurred_on: '2026-09-11',
    amount_minor: 50_000_000, source: 'manual',
  });
  await engine.accrue(ids.rappi, '2026-09-12');
  const days = await yields.days(ids.rappi);
  const on = date => days.find(day => day.on_date === date);

  assert.equal(on('2026-09-10').balance_minor, 100_000_000, 'before it arrived');
  assert.equal(on('2026-09-12').balance_minor,
    150_000_000 + on('2026-09-10').net_minor + on('2026-09-11').net_minor,
    'the stated figure, plus what moved, plus what it earned');
});

test('a movement BEFORE the figure was stated is already inside it', async () => {
  const { db, yields, engine, transactions, ids } = await setup();
  await yields.enrol({
    account_id: ids.rappi, opening_cushion_minor: 0, opening_on: '2026-09-09', withholding: false,
  });
  await yields.setRate({ account_id: ids.rappi, valid_from: '2026-09-09', annual_rate_scaled: pct(9) });

  // Money that moved a week earlier is part of what the bank showed him.
  await transactions.create({
    account_id: ids.rappi, category_id: ids.gastos, occurred_on: '2026-09-02',
    amount_minor: 50_000_000, source: 'manual',
  });

  const [pocket] = await yields.pockets(ids.rappi);
  await db.run("UPDATE yield_pockets SET source = 'manual' WHERE id = ?", [pocket.id]);
  await yields.setPocketBalance({
    pocket_id: pocket.id, valid_from: '2026-09-09', amount_minor: 100_000_000,
  });

  await engine.accrue(ids.rappi, '2026-09-10');
  assert.equal((await yields.days(ids.rappi))[0].balance_minor, 100_000_000,
    'counting it again would be counting it twice');
});

test('a second pocket does not take the movements as well', async () => {
  const { db, yields, engine, transactions, ids } = await setup();
  await yields.enrol({
    account_id: ids.rappi, opening_cushion_minor: 0, opening_on: '2026-09-09', withholding: false,
  });
  await yields.setRate({ account_id: ids.rappi, valid_from: '2026-09-09', annual_rate_scaled: pct(9) });

  const [first] = await yields.pockets(ids.rappi);
  await db.run("UPDATE yield_pockets SET source = 'manual' WHERE id = ?", [first.id]);
  await yields.setPocketBalance({
    pocket_id: first.id, valid_from: '2026-09-09', amount_minor: 100_000_000,
  });
  const second = await yields.addPocket({
    account_id: ids.rappi, name: 'Segunda', source: 'manual', sort_order: 1,
  });
  await yields.setPocketBalance({
    pocket_id: second, valid_from: '2026-09-09', amount_minor: 200_000_000,
  });

  await transactions.create({
    account_id: ids.rappi, category_id: ids.gastos, occurred_on: '2026-09-10',
    amount_minor: 50_000_000, source: 'manual',
  });
  await engine.accrue(ids.rappi, '2026-09-11');

  // A movement never says which pocket it landed in. It goes to the first, once
  // - putting it in both would count the same deposit twice.
  const firstDay = (await yields.pocketDays(first.id, '2026-09-11', '2026-09-11'))[0];
  const secondDay = (await yields.pocketDays(second, '2026-09-11', '2026-09-11'))[0];

  assert.ok(firstDay.balance_minor > 150_000_000);
  assert.ok(secondDay.balance_minor < 201_000_000, 'the second pocket did not see it');
});

// ---------------------------------------------------------------------------
// A deposit made today earns from tomorrow
//
// The question to have settled before checking the figures against the banks:
// money put into an account on a Thursday has to show up in Friday's yield,
// and not in Thursday's. A day's yield is worked out on what was there when
// the day started - the same rule the stated figure and a cushion entry both
// follow.
// ---------------------------------------------------------------------------

async function statedAccount({ db, yields }, accountId, statedMinor) {
  await yields.enrol({
    account_id: accountId, opening_cushion_minor: 0,
    opening_on: '2026-09-09', withholding: false,
  });
  const [pocket] = await yields.pockets(accountId);
  await db.run("UPDATE yield_pockets SET source = 'manual' WHERE id = ?", [pocket.id]);
  await yields.setPocketBalance({
    pocket_id: pocket.id, valid_from: '2026-09-09', amount_minor: statedMinor,
  });
  return pocket.id;
}

test('money put in today is in tomorrow\'s yield, not today\'s', async () => {
  const { db, yields, engine, transactions, ids } = await setup();
  await statedAccount({ db, yields }, ids.rappi, 100_000_000);
  await yields.setRate({ account_id: ids.rappi, valid_from: '2026-09-09', annual_rate_scaled: pct(9) });

  // 5,000,000.00 goes in on Thursday the 10th.
  await transactions.create({
    account_id: ids.rappi, category_id: ids.gastos, occurred_on: '2026-09-10',
    amount_minor: 500_000_000, source: 'manual',
  });

  await engine.accrue(ids.rappi, '2026-09-12');
  const days = await yields.days(ids.rappi);
  const on = date => days.find(day => day.on_date === date);

  assert.equal(on('2026-09-10').balance_minor, 100_000_000,
    'Thursday earns on what was there when Thursday started');

  assert.equal(on('2026-09-11').balance_minor,
    600_000_000 + on('2026-09-10').net_minor,
    'Friday earns on the deposit, plus what Thursday earned');

  assert.ok(on('2026-09-11').gross_minor > on('2026-09-10').gross_minor * 5);
});

test('money taken out today stops earning tomorrow', async () => {
  const { db, yields, engine, transactions, ids } = await setup();
  await statedAccount({ db, yields }, ids.rappi, 600_000_000);
  await yields.setRate({ account_id: ids.rappi, valid_from: '2026-09-09', annual_rate_scaled: pct(9) });

  await transactions.create({
    account_id: ids.rappi, category_id: ids.gastos, occurred_on: '2026-09-10',
    amount_minor: -500_000_000, source: 'manual',
  });

  await engine.accrue(ids.rappi, '2026-09-12');
  const days = await yields.days(ids.rappi);
  const on = date => days.find(day => day.on_date === date);

  assert.equal(on('2026-09-10').balance_minor, 600_000_000);
  assert.equal(on('2026-09-11').balance_minor, 100_000_000 + on('2026-09-10').net_minor);
});

test('a rate that has not started yet earns nothing, and does not replace one that has', async () => {
  const { db, yields, engine, ids } = await setup();
  await statedAccount({ db, yields }, ids.rappi, 100_000_000);

  // Plata's real shape: 6.5% now, 5% announced for November.
  await yields.setRate({ account_id: ids.rappi, valid_from: '2026-09-08', annual_rate_scaled: pct(6.5) });
  await yields.setRate({ account_id: ids.rappi, valid_from: '2026-11-09', annual_rate_scaled: pct(5) });

  await engine.accrue(ids.rappi, '2026-11-10');
  const days = await yields.days(ids.rappi);
  const on = date => days.find(day => day.on_date === date);

  assert.equal(on('2026-09-15').annual_rate_scaled, pct(6.5), 'the one that started is the one that applies');
  assert.equal(on('2026-11-08').annual_rate_scaled, pct(6.5), 'right up to the day before');
  assert.equal(on('2026-11-09').annual_rate_scaled, pct(5), 'and then the other one takes over');
});

test('a rate given an end stops, and nothing takes its place', async () => {
  const { db, yields, engine, ids } = await setup();
  await statedAccount({ db, yields }, ids.rappi, 100_000_000);

  await yields.setRate({
    account_id: ids.rappi, valid_from: '2026-09-09',
    valid_to: '2026-09-15', annual_rate_scaled: pct(9),
  });

  await engine.accrue(ids.rappi, '2026-09-20');
  const days = await yields.days(ids.rappi);
  const on = date => days.find(day => day.on_date === date);

  assert.equal(on('2026-09-15').annual_rate_scaled, pct(9), 'the last day it applied');
  assert.equal(on('2026-09-16'), undefined, 'and after that there is nothing to work out');
});

// ---------------------------------------------------------------------------
// A rate of the account does not end a rate of a product
//
// Plata's shape on 2026-09-11: an account-wide rate from the 9th, and 6.5% set
// on the "cuenta ahorros" product from the 8th to 8 November. The screen read
// that as "from 8 Sept to 8 Sept" - the account rate appearing to end it - and
// the question underneath is whether the product was still earning 6.5% at
// all, or had silently been taken over.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Jose, 2026-09-17: he put Plata's two products on rates starting the 7th and
// the 8th of September and the yields screen began on the 10th. The account
// had been enrolled on the 9th, and that one date overruled the dates the
// products themselves carry - which is backwards. Rates have been per product
// since migration 016; a rate reaching further back than the enrolment is the
// better answer about when there was something to work out.
// ---------------------------------------------------------------------------

test('a rate older than the enrolment pulls the first day back to it', async () => {
  const { db, yields, engine, ids } = await setup();
  await yields.enrol({
    account_id: ids.rappi, opening_cushion_minor: 0, opening_on: '2026-09-09', withholding: false,
  });

  const [savings] = await yields.pockets(ids.rappi);
  await db.run("UPDATE yield_pockets SET source = 'manual' WHERE id = ?", [savings.id]);
  await yields.setPocketBalance({
    pocket_id: savings.id, valid_from: '2026-09-01', amount_minor: 20_000_000,
  });

  // The rate says the 7th; the enrolment says the 9th. The rate wins.
  await yields.setRate({
    account_id: ids.rappi, pocket_id: savings.id,
    valid_from: '2026-09-07', annual_rate_scaled: pct(11),
  });

  await engine.accrue(ids.rappi, '2026-09-12');
  const days = (await yields.pocketDays(savings.id)).map(day => day.on_date).sort();

  assert.equal(days[0], '2026-09-08', 'the day after the rate begins, not after the enrolment');
  assert.ok(days.includes('2026-09-09'), 'and it goes on from there');

  // The enrolment still holds the floor when it is the earlier of the two:
  // nothing can be worked out before there was anything to work it out on.
  const later = await setup();
  await later.yields.enrol({
    account_id: later.ids.rappi, opening_cushion_minor: 0, opening_on: '2026-09-01', withholding: false,
  });
  const [other] = await later.yields.pockets(later.ids.rappi);
  await later.db.run("UPDATE yield_pockets SET source = 'manual' WHERE id = ?", [other.id]);
  await later.yields.setPocketBalance({
    pocket_id: other.id, valid_from: '2026-09-01', amount_minor: 20_000_000,
  });
  await later.yields.setRate({
    account_id: later.ids.rappi, pocket_id: other.id,
    valid_from: '2026-09-05', annual_rate_scaled: pct(11),
  });
  await later.engine.accrue(later.ids.rappi, '2026-09-08');

  const theirs = (await later.yields.pocketDays(other.id)).map(day => day.on_date).sort();
  assert.equal(theirs[0], '2026-09-05', 'a rate that starts later starts on its own first day');
});

test('a product keeps its own rate however many the account has', async () => {
  const { db, yields, engine, ids } = await setup();
  await yields.enrol({
    account_id: ids.rappi, opening_cushion_minor: 0, opening_on: '2026-09-07', withholding: false,
  });

  const [savings] = await yields.pockets(ids.rappi);
  await db.run("UPDATE yield_pockets SET source = 'manual' WHERE id = ?", [savings.id]);
  await yields.setPocketBalance({
    pocket_id: savings.id, valid_from: '2026-09-07', amount_minor: 100_000_000,
  });

  // The account's own rate, and the product's, both named 'base'.
  await yields.setRate({ account_id: ids.rappi, valid_from: '2026-09-09', annual_rate_scaled: pct(11) });
  await yields.setRate({
    account_id: ids.rappi, pocket_id: savings.id,
    valid_from: '2026-09-08', valid_to: '2026-11-08', annual_rate_scaled: pct(6.5),
  });

  await engine.accrue(ids.rappi, '2026-11-10');
  const days = await yields.pocketDays(savings.id);
  const on = date => days.find(day => day.on_date === date);

  // The product uses its own rate, and goes on using it well past the day the
  // account rate started.
  assert.equal(on('2026-09-08').annual_rate_scaled, pct(6.5));
  assert.equal(on('2026-09-30').annual_rate_scaled, pct(6.5), 'three weeks after the account rate began');
  assert.equal(on('2026-11-08').annual_rate_scaled, pct(6.5), 'right up to the day it ends');

  // And once it ends, nothing takes over - not the account rate, which was
  // never this product's, and not the previous one, which there is none of.
  assert.equal(on('2026-11-09'), undefined);
});

test('a product with no rate of its own uses the account rate', async () => {
  const { db, yields, engine, ids } = await setup();
  await yields.enrol({
    account_id: ids.rappi, opening_cushion_minor: 0, opening_on: '2026-09-08', withholding: false,
  });
  await yields.setRate({ account_id: ids.rappi, valid_from: '2026-09-09', annual_rate_scaled: pct(11) });

  const [first] = await yields.pockets(ids.rappi);
  await db.run("UPDATE yield_pockets SET source = 'manual' WHERE id = ?", [first.id]);
  await yields.setPocketBalance({
    pocket_id: first.id, valid_from: '2026-09-08', amount_minor: 100_000_000,
  });

  const other = await yields.addPocket({
    account_id: ids.rappi, name: 'Cuenta de ahorros', source: 'manual', sort_order: 1,
  });
  await yields.setPocketBalance({
    pocket_id: other, valid_from: '2026-09-08', amount_minor: 100_000_000,
  });
  await yields.setRate({
    account_id: ids.rappi, pocket_id: other,
    valid_from: '2026-09-08', annual_rate_scaled: pct(6.5),
  });

  await engine.accrue(ids.rappi, '2026-09-20');

  assert.equal((await yields.pocketDays(first.id, '2026-09-15', '2026-09-15'))[0].annual_rate_scaled,
    pct(11), 'no rate of its own, so the account rate applies');
  assert.equal((await yields.pocketDays(other, '2026-09-15', '2026-09-15'))[0].annual_rate_scaled,
    pct(6.5), 'and the one with its own keeps it');
});




test('a day in the future is removed, even when there is nothing to accrue', async () => {
  // How one got there: "today" was read as the UTC day, which in Colombia is
  // tomorrow every evening after seven. The engine wrote a day that had not
  // happened, and then had no reason to revisit it — it resumes from the last
  // day it wrote, and that day was already past the day it was being asked to
  // reach, so it returned early without clearing anything. Fixing the clock
  // stopped new ones appearing; this is what removes the ones already there.
  const { db, yields, engine, ids } = await setup();

  await yields.enrol({
    account_id: ids.rappi, opening_cushion_minor: 0, opening_on: '2026-09-09',
  });
  await yields.setRate({
    account_id: ids.rappi, component: 'base', payout: 'daily',
    valid_from: '2026-09-09', annual_rate_scaled: 9 * 10_000,
  });

  // Accrued one day too far, the way the UTC reading did.
  await engine.accrue(ids.rappi, '2026-09-11');
  assert.equal(await yields.lastAccruedDay(ids.rappi), '2026-09-11');

  // Asked again for the real today, which is behind what was already written.
  await engine.accrue(ids.rappi, '2026-09-10');
  assert.equal(await yields.lastAccruedDay(ids.rappi), '2026-09-10',
    'the day that never happened is gone');

  // And a locked day is no exception: locking means a statement disagreed with
  // the arithmetic, which cannot be true of a day the bank has not reached.
  await engine.accrue(ids.rappi, '2026-09-12');
  await db.run('UPDATE yield_days SET locked = 1 WHERE on_date = ?', ['2026-09-12']);
  await engine.accrue(ids.rappi, '2026-09-10');
  assert.equal(await yields.lastAccruedDay(ids.rappi), '2026-09-10');

  await db.close();
});

test('each product holds its own figure plus what moved through it', async () => {
  // The question Jose actually needs answered, and the one an account's own
  // balance cannot: that figure is a summary of everything inside it and says
  // nothing about how the parts are doing.
  const { db, yields, transactions, engine, ids } = await setup();

  await yields.enrol({
    account_id: ids.rappi, opening_cushion_minor: 0, opening_on: '2026-09-01',
  });

  const [savings] = await yields.pockets(ids.rappi);
  await yields.setPocketSource(savings.id, 'manual');
  const alcancia = await yields.addPocket({
    account_id: ids.rappi, name: 'Alcancía', source: 'manual', sort_order: 1 });

  await yields.setPocketBalance({
    pocket_id: savings.id, valid_from: '2026-09-01', amount_minor: 600_000_000 });
  await yields.setPocketBalance({
    pocket_id: alcancia, valid_from: '2026-09-01', amount_minor: 400_000_000 });

  let held = await engine.heldByPocket(ids.rappi, '2026-09-10');
  assert.equal(held.get(savings.id), 600_000_000);
  assert.equal(held.get(alcancia), 400_000_000);

  // Money arriving, filed against the alcancía.
  await transactions.create({
    account_id: ids.rappi, category_id: ids.gastos, occurred_on: '2026-09-05',
    amount_minor: 20_000_000, pocket_id: alcancia, source: 'manual',
  });

  held = await engine.heldByPocket(ids.rappi, '2026-09-10');
  assert.equal(held.get(savings.id), 600_000_000, 'untouched');
  assert.equal(held.get(alcancia), 420_000_000, 'and it went where it said');

  await db.close();
});

test('a product goes negative when the money was never moved across', async () => {
  // Jose's own example. The savings account is at zero, a transfer leaves
  // from it, and the move from the alcancía beside it is forgotten. The
  // product goes below zero and stays there until the move is recorded —
  // which is the point: the negative is the reminder, so it is shown rather
  // than clamped away.
  const { db, yields, transactions, transfers, engine, ids } = await setup();

  await yields.enrol({
    account_id: ids.rappi, opening_cushion_minor: 0, opening_on: '2026-09-01',
  });

  const [savings] = await yields.pockets(ids.rappi);
  await yields.setPocketSource(savings.id, 'manual');
  const alcancia = await yields.addPocket({
    account_id: ids.rappi, name: 'Alcancía', source: 'manual', sort_order: 1 });

  await yields.setPocketBalance({
    pocket_id: savings.id, valid_from: '2026-09-01', amount_minor: 0 });
  await yields.setPocketBalance({
    pocket_id: alcancia, valid_from: '2026-09-01', amount_minor: 500_000_000 });

  // 1,000,000.00 leaves the savings account, which has nothing in it.
  await transactions.create({
    account_id: ids.rappi, category_id: ids.gastos, occurred_on: '2026-09-05',
    amount_minor: -100_000_000, pocket_id: savings.id, source: 'manual',
  });

  let held = await engine.heldByPocket(ids.rappi, '2026-09-10');
  assert.equal(held.get(savings.id), -100_000_000, 'visible, not hidden');

  // Recording the move that was forgotten puts it right, and the account's
  // own total never changed through any of it.
  await transfers.create({
    occurred_on: '2026-09-05',
    from: { account_id: ids.rappi, pocket_id: alcancia, amount_minor: 100_000_000 },
    to: { account_id: ids.rappi, pocket_id: savings.id, amount_minor: 100_000_000 },
  });

  held = await engine.heldByPocket(ids.rappi, '2026-09-10');
  assert.equal(held.get(savings.id), 0);
  assert.equal(held.get(alcancia), 400_000_000);

  await db.close();
});

test('moving between two products of one account leaves the account alone', async () => {
  // From the account's point of view nothing happens: the same money is
  // still there. Both legs sit in the same account and sum to zero.
  const { db, yields, transfers, ids } = await setup();

  await yields.enrol({
    account_id: ids.rappi, opening_cushion_minor: 0, opening_on: '2026-09-01',
  });
  const [savings] = await yields.pockets(ids.rappi);
  await yields.setPocketSource(savings.id, 'manual');
  const cdt = await yields.addPocket({
    account_id: ids.rappi, name: 'CDT', source: 'manual', sort_order: 1 });

  const before = await db.queryOne(
    'SELECT COALESCE(SUM(amount_minor), 0) AS total FROM transactions WHERE account_id = ?',
    [ids.rappi]);

  await transfers.create({
    occurred_on: '2026-09-05',
    from: { account_id: ids.rappi, pocket_id: savings.id, amount_minor: 100_000_000 },
    to: { account_id: ids.rappi, pocket_id: cdt, amount_minor: 100_000_000 },
  });

  const after = await db.queryOne(
    'SELECT COALESCE(SUM(amount_minor), 0) AS total FROM transactions WHERE account_id = ?',
    [ids.rappi]);
  assert.equal(after.total, before.total, 'the account holds exactly what it held');

  const legs = await db.query(
    `SELECT pocket_id, amount_minor FROM transactions
     WHERE transfer_id IS NOT NULL AND account_id = ? ORDER BY amount_minor`, [ids.rappi]);
  assert.deepEqual(
    legs.map(leg => [leg.pocket_id, leg.amount_minor]),
    [[savings.id, -100_000_000], [cdt, 100_000_000]]);

  await db.close();
});


test('a product balance is the figure typed, never one derived from history', async () => {
  // The mistake worth remembering: every movement ever made had been filed
  // against the savings product, and the balance was being worked out as
  // "nothing, plus everything that ever moved" — so a product Jose knows to be
  // empty reported sixty-six million of history as its balance.
  //
  // The figure typed IS the balance. Only what has moved since changes it, and
  // a product with no figure of its own starts from the day the account was
  // enrolled, because everything before that is already inside the figures
  // that were typed.
  const { db, yields, transactions, engine, ids } = await setup();

  // Years of history, the way a real account has.
  for (const [on, amount] of [['2024-03-01', -500_000_00], ['2025-07-15', -120_000_00]]) {
    await transactions.create({
      account_id: ids.rappi, category_id: ids.gastos, occurred_on: on,
      amount_minor: amount, source: 'manual',
    });
  }

  await yields.enrol({
    account_id: ids.rappi, opening_cushion_minor: 0, opening_on: '2026-09-09',
  });
  const [savings] = await yields.pockets(ids.rappi);
  await yields.setPocketSource(savings.id, 'manual');

  // Migration 021 files the whole history against the savings product.
  await db.run('UPDATE transactions SET pocket_id = ? WHERE account_id = ?',
    [savings.id, ids.rappi]);

  let held = await engine.heldByPocket(ids.rappi, '2026-09-11');
  assert.equal(held.get(savings.id), 0,
    'empty is empty: none of that history is its balance');

  // A figure typed on a date, and only what moves after it.
  await yields.setPocketBalance({
    pocket_id: savings.id, valid_from: '2026-09-10', amount_minor: 50_000_00 });

  held = await engine.heldByPocket(ids.rappi, '2026-09-11');
  assert.equal(held.get(savings.id), 50_000_00, 'exactly what was typed');

  await transactions.create({
    account_id: ids.rappi, category_id: ids.gastos, occurred_on: '2026-09-11',
    amount_minor: -1_000_00, pocket_id: savings.id, source: 'manual',
  });

  held = await engine.heldByPocket(ids.rappi, '2026-09-11');
  assert.equal(held.get(savings.id), 49_000_00, 'and what has moved since');

  await db.close();
});

test('a product counts every movement from the day its balance was set', async () => {
  // The rule Jose asked for, in the words he used: movements before that date
  // do not touch the balance, and everything from it on does. Nothing about
  // clock times, and no upper bound — a movement dated next week has been
  // recorded, and the account's own balance counts it, so a product that did
  // not would disagree with the account it lives in.
  const { db, yields, transactions, engine, ids } = await setup();

  await yields.enrol({
    account_id: ids.rappi, opening_cushion_minor: 0, opening_on: '2026-09-09',
  });
  const [savings] = await yields.pockets(ids.rappi);
  await yields.setPocketSource(savings.id, 'manual');
  await yields.setPocketBalance({
    pocket_id: savings.id, valid_from: '2026-09-10', amount_minor: 0 });

  // Before the date: inside the figure already, so it changes nothing.
  await transactions.create({
    account_id: ids.rappi, category_id: ids.gastos, occurred_on: '2026-09-08',
    amount_minor: -900_00, pocket_id: savings.id, source: 'manual',
  });
  assert.equal((await engine.heldByPocket(ids.rappi, '2026-09-11')).get(savings.id), 0);

  // On the date, and after it.
  await transactions.create({
    account_id: ids.rappi, category_id: ids.gastos, occurred_on: '2026-09-10',
    amount_minor: -100, pocket_id: savings.id, source: 'manual',
  });
  await transactions.create({
    account_id: ids.rappi, category_id: ids.gastos, occurred_on: '2026-09-11',
    amount_minor: -100, pocket_id: savings.id, source: 'manual',
  });

  assert.equal((await engine.heldByPocket(ids.rappi, '2026-09-11')).get(savings.id), -200);

  // Dated ahead of today, which is how Jose tests it. Recorded is recorded.
  await transactions.create({
    account_id: ids.rappi, category_id: ids.gastos, occurred_on: '2026-09-15',
    amount_minor: -100, pocket_id: savings.id, source: 'manual',
  });

  assert.equal((await engine.heldByPocket(ids.rappi, '2026-09-11')).get(savings.id), -300,
    'a movement dated ahead still counts, as it does for the account');

  await db.close();
});

test('changing the date a balance counts from moves it, rather than adding another', async () => {
  // How it looked from outside: edit the date, save, reopen, and the old date
  // is back. `setPocketBalance` is keyed on the date, so changing the date
  // through it wrote a SECOND balance and left the first standing — and the
  // first, being the later of the two, went on winning.
  const { db, yields, transactions, engine, ids } = await setup();

  await yields.enrol({
    account_id: ids.rappi, opening_cushion_minor: 0, opening_on: '2026-09-01',
  });
  const [savings] = await yields.pockets(ids.rappi);
  await yields.setPocketSource(savings.id, 'manual');
  await yields.setPocketBalance({
    pocket_id: savings.id, valid_from: '2026-09-10', amount_minor: 100_000_00 });

  await transactions.create({
    account_id: ids.rappi, category_id: ids.gastos, occurred_on: '2026-09-08',
    amount_minor: -5_000_00, pocket_id: savings.id, source: 'manual',
  });

  // Counting from the 10th, the 8th is inside the figure.
  assert.equal((await engine.heldByPocket(ids.rappi, '2026-09-11')).get(savings.id), 100_000_00);

  const [row] = await yields.pocketBalances(savings.id);
  await yields.movePocketBalance(row.id, {
    valid_from: '2026-09-05', amount_minor: 100_000_00 });

  const history = await yields.pocketBalances(savings.id);
  assert.equal(history.length, 1, 'moved, not duplicated');
  assert.equal(history[0].valid_from, '2026-09-05');

  // And counting from the 5th, the 8th is now on top of it.
  assert.equal((await engine.heldByPocket(ids.rappi, '2026-09-11')).get(savings.id), 95_000_00);

  // A balance already sitting on the target date gives way: one date, one
  // balance, rather than a constraint failure in front of someone who only
  // changed a date.
  await yields.setPocketBalance({
    pocket_id: savings.id, valid_from: '2026-09-09', amount_minor: 7_000_00 });
  await yields.movePocketBalance(history[0].id, {
    valid_from: '2026-09-09', amount_minor: 100_000_00 });

  const after = await yields.pocketBalances(savings.id);
  assert.equal(after.length, 1);
  assert.equal(after[0].amount_minor, 100_000_00);

  // Jose's case: a balance on the 9th and another on the 10th. The form edits
  // the latest, and moving it back to the 1st must leave it in charge - not
  // the 9th's, which would make the save look undone.
  await yields.setPocketBalance({ pocket_id: savings.id, valid_from: '2026-09-10', amount_minor: 90_000_00 });
  const latest = (await yields.pocketBalances(savings.id)).at(-1);
  await yields.movePocketBalance(latest.id, { valid_from: '2026-09-01', amount_minor: 80_000_00 });
  const moved = await yields.pocketBalances(savings.id);
  assert.deepEqual(moved.map(entry => [entry.valid_from, entry.amount_minor]), [['2026-09-01', 80_000_00]]);
  assert.equal((await engine.heldByPocket(ids.rappi, '2026-09-11')).get(savings.id), 75_000_00,
    'the moved balance, with the expense of the 8th on top of it');

  await db.close();
});

test('a balance dated ahead is stored, and is the one an editor should show', async () => {
  // The editor was choosing "the last balance in force today", which hides a
  // balance dated in the future — so setting a date ahead saved correctly,
  // showed the previous balance on reopening, and read like a form ignoring
  // what was typed into it. Filtering to today is right for the engine, which
  // must not apply a balance that does not describe the day it is working out,
  // and wrong for an editor, which has to show what is stored.
  const { db, yields, engine, ids } = await setup();

  await yields.enrol({
    account_id: ids.rappi, opening_cushion_minor: 0, opening_on: '2026-09-01',
  });
  const [savings] = await yields.pockets(ids.rappi);
  await yields.setPocketSource(savings.id, 'manual');

  await yields.setPocketBalance({
    pocket_id: savings.id, valid_from: '2026-09-05', amount_minor: 100_000_00 });
  await yields.setPocketBalance({
    pocket_id: savings.id, valid_from: '2026-09-20', amount_minor: 0 });

  const history = await yields.pocketBalances(savings.id);
  assert.equal(history.at(-1).valid_from, '2026-09-20', 'the last one recorded');
  assert.equal(history.at(-1).amount_minor, 0);

  // And the balance shown follows it: what a product holds is a figure and a
  // date it counts from, and today has nothing to do with either. The question
  // that does depend on the day is what a product EARNS on, and that one is
  // asked separately, day by day, inside `accrue`.
  assert.equal((await engine.heldByPocket(ids.rappi, '2026-09-11')).get(savings.id), 0,
    'the last balance recorded is the one that governs');

  await db.close();
});

test('a balance dated tomorrow keeps today out of it', async () => {
  // Jose's case exactly. He paid a credit card today from the savings product,
  // that payment is already inside the figure he had defined, and so he dated
  // the next balance to tomorrow to keep today out of it. The engine fell back
  // to the enrolment date instead and counted the payment anyway — the
  // opposite of what the date was for.
  const { db, yields, transactions, engine, ids } = await setup();

  await yields.enrol({
    account_id: ids.rappi, opening_cushion_minor: 0, opening_on: '2026-09-09',
  });
  const [savings] = await yields.pockets(ids.rappi);
  await yields.setPocketSource(savings.id, 'manual');

  await transactions.create({
    account_id: ids.rappi, category_id: ids.gastos, occurred_on: '2026-09-10',
    amount_minor: -95_649_327, pocket_id: savings.id, source: 'manual',
  });

  // Counting starts tomorrow, at zero.
  await yields.setPocketBalance({
    pocket_id: savings.id, valid_from: '2026-09-11', amount_minor: 0 });

  assert.equal((await engine.heldByPocket(ids.rappi, '2026-09-10')).get(savings.id), 0,
    'today is before the date counting starts, so nothing is counted');
  assert.equal((await engine.heldByPocket(ids.rappi, '2026-09-11')).get(savings.id), 0,
    'and the day itself starts from the figure, not from history');

  // From then on it moves, and only with what happens from then on.
  await transactions.create({
    account_id: ids.rappi, category_id: ids.gastos, occurred_on: '2026-09-12',
    amount_minor: -1_000_00, pocket_id: savings.id, source: 'manual',
  });
  assert.equal((await engine.heldByPocket(ids.rappi, '2026-09-12')).get(savings.id), -1_000_00);

  // A product with no balance at all is a different case: nobody has chosen a
  // start date for it, so counting starts where this module started.
  const alcancia = await yields.addPocket({
    account_id: ids.rappi, name: 'Alcancía', source: 'manual', sort_order: 1 });
  await transactions.create({
    account_id: ids.rappi, category_id: ids.gastos, occurred_on: '2026-09-10',
    amount_minor: -2_000_00, pocket_id: alcancia, source: 'manual',
  });
  assert.equal((await engine.heldByPocket(ids.rappi, '2026-09-12')).get(alcancia), -2_000_00);

  await db.close();
});

test('a movement dated ahead of the start date counts, whatever today is', async () => {
  // Jose's report, exactly: a balance of zero counting from the 11th, an
  // expense of one peso on the 15th, and the product still reading zero. The
  // answer was being bounded at today, so a start date in the future and a
  // movement past it both fell outside — and neither of them has anything to
  // do with today.
  const { db, yields, transactions, engine, ids } = await setup();

  await yields.enrol({
    account_id: ids.rappi, opening_cushion_minor: 0, opening_on: '2026-09-09',
  });
  const [savings] = await yields.pockets(ids.rappi);
  await yields.setPocketSource(savings.id, 'manual');
  await yields.setPocketBalance({
    pocket_id: savings.id, valid_from: '2026-09-11', amount_minor: 0 });

  await transactions.create({
    account_id: ids.rappi, category_id: ids.gastos, occurred_on: '2026-09-15',
    amount_minor: -100, pocket_id: savings.id, source: 'manual',
  });

  // Asked on any day at all, the answer is the same, because the question is
  // not about a day.
  for (const day of ['2026-09-10', '2026-09-11', '2026-09-20']) {
    assert.equal((await engine.heldByPocket(ids.rappi, day)).get(savings.id), -100,
      `asked on ${day}`);
  }

  // What still falls outside is anything before the start date.
  await transactions.create({
    account_id: ids.rappi, category_id: ids.gastos, occurred_on: '2026-09-10',
    amount_minor: -95_649_327, pocket_id: savings.id, source: 'manual',
  });
  assert.equal((await engine.heldByPocket(ids.rappi, '2026-09-20')).get(savings.id), -100,
    'the card payment is before the date counting starts');

  await db.close();
});

// ---------------------------------------------------------------------------
// Paid every several months
//
// Some products hand the yield over every two, six, twelve or twenty-four
// months. The months are counted from the month the rate starts in, and a
// payment lands on the last day of its final month.
// ---------------------------------------------------------------------------

async function quarterly(upTo) {
  const context = await setup();
  const { yields, engine, ids } = context;
  await yields.enrol({ account_id: ids.rappi, opening_cushion_minor: 0, opening_on: '2026-06-30', withholding: false });
  await yields.setRate({
    account_id: ids.rappi, valid_from: '2026-07-01', annual_rate_scaled: pct(9), payout: 'monthly', payout_months: 3,
  });
  for (const day of upTo) await engine.accrue(ids.rappi, day);
  return context;
}

test('a rate paid every three months holds the yield until the end of the third month', async () => {
  const { yields, ids } = await quarterly(['2026-10-02']);
  const days = await yields.days(ids.rappi);
  const on = date => days.find(day => day.on_date === date);
  const inQuarter = days.filter(day => day.on_date <= '2026-09-30');
  const quarter = inQuarter.reduce((sum, day) => sum + day.net_minor, 0);

  assert.equal(on('2026-07-01').paid_on, '2026-09-30');
  assert.equal(on('2026-08-15').paid_on, '2026-09-30');
  assert.equal(on('2026-10-01').paid_on, '2026-12-31', 'the next payment covers October to December');

  assert.equal(new Set(inQuarter.map(day => day.balance_minor)).size, 1,
    'nothing compounds at the end of July or August');
  assert.equal(on('2026-10-01').balance_minor, 1_000_000_000 + quarter, 'the whole quarter lands at once');
});

test('what is owed in the middle of a period says when it will be paid', async () => {
  const { yields, ids } = await quarterly(['2026-08-15']);
  const owed = (await yields.days(ids.rappi)).reduce((sum, day) => sum + day.net_minor, 0);
  const cushion = await yields.cushion(ids.rappi, '2026-08-15');

  assert.equal(cushion.pendingMinor, owed, 'July and half of August are owed, not paid');
  assert.equal(cushion.paidOn, '2026-09-30');
  assert.equal(cushion.availableMinor, cushion.totalMinor - owed);
});

test('working it out again from the middle of a period still pays the months before', async () => {
  const once = await quarterly(['2026-10-02']);
  const twice = await quarterly(['2026-08-15', '2026-10-02']);

  const october = async ({ yields, ids }) =>
    (await yields.days(ids.rappi)).find(day => day.on_date === '2026-10-01').balance_minor;

  assert.equal(await october(twice), await october(once),
    'the second pass started on August 1st and still carried July into the payment');
});

test('one month per payment is exactly the monthly rate it always was', async () => {
  const { yields, engine, ids } = await setup();
  for (const account_id of [ids.rappi, ids.uala]) {
    await yields.enrol({ account_id, opening_cushion_minor: 0, opening_on: '2026-06-30', withholding: false });
  }
  await yields.setRate({ account_id: ids.rappi, valid_from: '2026-07-01', annual_rate_scaled: pct(9), payout: 'monthly' });
  await yields.setRate({
    account_id: ids.uala, valid_from: '2026-07-01', annual_rate_scaled: pct(9), payout: 'monthly', payout_months: 1,
  });
  await engine.accrue(ids.rappi, '2026-11-02');
  await engine.accrue(ids.uala, '2026-11-02');

  const shape = async account => (await yields.days(account)).map(day => [day.on_date, day.balance_minor, day.net_minor, day.paid_on]);
  assert.deepEqual(await shape(ids.uala), await shape(ids.rappi));
  const rate = (await yields.rateHistory(ids.rappi))[0];
  assert.equal(rate.payout_months, 1, 'a rate saved without months pays every month');
});

// ---------------------------------------------------------------------------
// Removing a product
//
// It used to delete the row on one tap: every day the product earned went with
// it, and its movements fell into whichever product takes unassigned money.
// Now everything it carried goes to a product the person chose.
// ---------------------------------------------------------------------------

async function withCdt() {
  const context = await setup();
  const { db, yields, ids } = context;
  await yields.enrol({ account_id: ids.rappi, opening_cushion_minor: 0, opening_on: '2026-07-31', withholding: false });
  await yields.setRate({ account_id: ids.rappi, valid_from: '2026-07-31', annual_rate_scaled: pct(9) });

  const [savings] = await yields.pockets(ids.rappi);
  await db.run("UPDATE yield_pockets SET source = 'manual' WHERE id = ?", [savings.id]);
  await yields.setPocketBalance({ pocket_id: savings.id, valid_from: '2026-07-31', amount_minor: 600_000_000 });
  const cdt = await yields.addPocket({ account_id: ids.rappi, name: 'CDT', source: 'manual', sort_order: 1 });
  await yields.setPocketBalance({ pocket_id: cdt, valid_from: '2026-07-31', amount_minor: 400_000_000 });
  await yields.setDefaultPocket(ids.rappi, savings.id);

  // A movement filed against the CDT.
  await db.run(
    `INSERT INTO transactions (account_id, category_id, occurred_on, amount_minor, amount_base_minor, source,
       pocket_id, created_at, updated_at)
     VALUES (?, ?, '2026-08-20', -5000000, -5000000, 'manual', ?, ?, ?)`,
    [ids.rappi, ids.gastos, cdt, NOW(), NOW()]);

  return { ...context, savings: savings.id, cdt };
}

test('removing a product hands its balance, movements and earnings to the one chosen', async () => {
  const { removePocketInto } = await import('../../src/app/core/yields/remove-pocket.ts');
  const { db, yields, tax, engine, accounts, ids, savings, cdt } = await withCdt();
  const TODAY = '2026-09-10';

  await engine.accrue(ids.rappi, TODAY);
  // What each product holds. The yield it earned travels with its own days and
  // is worked out again afterwards, so it is not part of what is carried.
  const shown = async () => {
    const held = await engine.heldByPocket(ids.rappi, TODAY);
    return id => held.get(id) ?? 0;
  };
  const before = await shown();
  const statedBefore = (await yields.pocketBalances(savings)).map(entry => ({ ...entry }));
  const grossTo = async to => (await yields.days(ids.rappi, undefined, to)).reduce((sum, day) => sum + day.gross_minor, 0);
  const august = await grossTo('2026-08-31');
  const balance = async () => (await accounts.balances()).find(b => b.account.id === ids.rappi).balance_minor;
  const accountBefore = await balance();

  await removePocketInto(db, yields, tax, ids.rappi, cdt, savings, TODAY);

  assert.deepEqual((await yields.pockets(ids.rappi)).map(pocket => pocket.id), [savings], 'the CDT is gone');
  const carried = (await yields.adjustments(ids.rappi))
    .filter(entry => entry.pocket_id === savings && entry.on_date === TODAY)
    .reduce((sum, entry) => sum + entry.amount_minor, 0);
  assert.equal((await shown())(savings) + carried, before(savings) + before(cdt), 'its balance moved across, exactly');
  assert.deepEqual((await yields.pocketBalances(savings)).map(entry => ({ ...entry })), statedBefore,
    'the destination\'s own stated balance was not rewritten');
  assert.ok((await yields.adjustments(ids.rappi)).some(entry => entry.pocket_id === savings && entry.on_date === TODAY),
    'the balance arrived as a movement on the destination');
  assert.equal(await grossTo('2026-08-31'), august, 'nothing it earned in August was lost');
  assert.equal((await db.queryOne('SELECT pocket_id FROM transactions WHERE amount_minor = -5000000')).pocket_id, savings,
    'its movement names the product it went to');
  assert.equal(await balance(), accountBefore, 'the account itself did not move');
});

test('removing the usual product makes the destination the usual one', async () => {
  const { removePocketInto } = await import('../../src/app/core/yields/remove-pocket.ts');
  const { db, yields, tax, ids, savings, cdt } = await withCdt();

  await removePocketInto(db, yields, tax, ids.rappi, savings, cdt, '2026-09-10');

  const [left] = await yields.pockets(ids.rappi);
  assert.equal(left.id, cdt);
  assert.equal(left.is_default, 1, 'unassigned money still has somewhere to land');
});

// ---------------------------------------------------------------------------
// What kind of product it is
// ---------------------------------------------------------------------------

// How a CDT is paid - once, on the day it matures - is tested in cdt.test.mjs.
