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

  return { db, accounts, categories, transactions, yields, tax, engine,
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
  assert.equal(pockets[0].name, 'Rappi cuenta');

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

test('moving money from one product to another is reported until both are updated', async () => {
  // Jose's scenario: close part of one product and open another with it. A
  // movement records that money left the ACCOUNT; nothing records which
  // product inside it the money came out of, so the only thing that can
  // update a product's balance is Jose typing the new one. Until he does, the
  // first product goes on earning on money it no longer holds — and the whole
  // point of the check is that this is said out loud rather than compounded
  // quietly.
  const { db, yields, engine, ids } = await setup();

  await yields.enrol({
    account_id: ids.rappi, opening_cushion_minor: 0, opening_on: '2026-09-01',
  });

  // Enrolling gives an account one pocket that follows the ledger. Splitting
  // it into named products is a deliberate act, and it turns that first one
  // into a product with a balance of its own.
  const [general] = await yields.pockets(ids.rappi);
  await yields.setPocketSource(general.id, 'manual');
  await yields.renamePocket(general.id, 'Ahorro');
  const savings = general.id;

  const cdt = await yields.addPocket({
    account_id: ids.rappi, name: 'CDT', source: 'manual', sort_order: 1 });

  await yields.setPocketBalance({
    pocket_id: savings, valid_from: '2026-09-01', amount_minor: 600_000_000 });
  await yields.setPocketBalance({
    pocket_id: cdt, valid_from: '2026-09-01', amount_minor: 400_000_000 });

  assert.equal(await engine.drift(ids.rappi, '2026-09-01'), 0,
    'they add up to the account, so nothing to report');

  // 1,500,000.00 moves out of Ahorro and into the CDT. Inside one account,
  // that writes no movement at all — the account still holds the same money.
  await yields.setPocketBalance({
    pocket_id: cdt, valid_from: '2026-09-10', amount_minor: 550_000_000 });

  assert.equal(await engine.drift(ids.rappi, '2026-09-10'), 150_000_000,
    'the products now claim more than the account holds');

  // Jose updates the other half, which is what the warning asks for.
  await yields.setPocketBalance({
    pocket_id: savings, valid_from: '2026-09-10', amount_minor: 450_000_000 });

  assert.equal(await engine.drift(ids.rappi, '2026-09-10'), 0);

  await db.close();
});

test('an account with one product that follows the ledger never drifts', async () => {
  // The common case, and it must never cry wolf: a single ledger-backed
  // product is the account by definition, so no amount of movement can put
  // the two out of step.
  const { db, yields, transactions, engine, ids } = await setup();

  await yields.enrol({
    account_id: ids.uala, opening_cushion_minor: 0, opening_on: '2026-09-01',
  });
  // Enrolling already gave it exactly that pocket.
  await transactions.create({
    account_id: ids.uala, category_id: ids.gastos, occurred_on: '2026-09-05',
    amount_minor: -25_000_000, source: 'manual',
  });

  assert.equal(await engine.drift(ids.uala, '2026-09-10'), 0);
  await db.close();
});
