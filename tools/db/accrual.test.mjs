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
 * The same walk, done independently: base = balance + cushion, compounding.
 * Written out rather than reusing the engine, so the test can disagree with it.
 */
function expectedCushion(balanceMinor, openingCushion, annualRateScaled, days) {
  const rate = dailyRate(annualRateScaled);
  let cushion = openingCushion;
  for (let day = 0; day < days; day += 1) {
    cushion += Math.round((balanceMinor + cushion) * rate);
  }
  return cushion;
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

  // Each day earns on the balance plus the cushion, so the base grows.
  const days = await yields.days(ids.rappi);
  assert.equal(days[0].balance_minor, 1_000_000_000 + 491_743_498);
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
  await yields.setRate({ account_id: ids.rappi, valid_from: '2026-09-09', annual_rate_scaled: pct(9) });
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

test('only the part of the balance that is earning earns', async () => {
  const { engine, yields, ids } = await setup();
  await yields.enrol({
    account_id: ids.rappi, opening_cushion_minor: 0, opening_on: '2026-09-09', withholding: false,
  });
  await yields.setRate({ account_id: ids.rappi, valid_from: '2026-09-09', annual_rate_scaled: pct(9) });

  await engine.accrue(ids.rappi, '2026-09-10');
  const whole = (await yields.days(ids.rappi))[0].gross_minor;

  // Half of it is sitting in an internal product that pays nothing.
  await yields.setExcluded({
    account_id: ids.rappi, valid_from: '2026-09-09', amount_minor: 500_000_000,
    note: 'In a product that pays nothing',
  });
  await yields.clearDays(ids.rappi);
  const result = await engine.accrue(ids.rappi, '2026-09-10');

  const day = (await yields.days(ids.rappi))[0];
  assert.equal(day.balance_minor, 500_000_000, 'the base is what is actually earning');
  assert.equal(result.excludedMinor, 500_000_000);
  assert.ok(day.gross_minor < whole);
});

test('excluding more than the balance earns nothing, and never less than nothing', async () => {
  const { engine, yields, ids } = await setup();
  await yields.enrol({
    account_id: ids.rappi, opening_cushion_minor: 0, opening_on: '2026-09-09', withholding: false,
  });
  await yields.setRate({ account_id: ids.rappi, valid_from: '2026-09-09', annual_rate_scaled: pct(9) });
  await yields.setExcluded({
    account_id: ids.rappi, valid_from: '2026-09-09', amount_minor: 9_000_000_000,
  });

  const result = await engine.accrue(ids.rappi, '2026-09-15');
  assert.equal(result.netMinor, 0);
  assert.equal((await yields.days(ids.rappi))[0].balance_minor, 0);
});

test('what is not earning can change from a date', async () => {
  const { engine, yields, ids } = await setup();
  await yields.enrol({
    account_id: ids.rappi, opening_cushion_minor: 0, opening_on: '2026-09-09', withholding: false,
  });
  await yields.setRate({ account_id: ids.rappi, valid_from: '2026-09-09', annual_rate_scaled: pct(9) });
  await yields.setExcluded({ account_id: ids.rappi, valid_from: '2026-09-09', amount_minor: 500_000_000 });
  await yields.setExcluded({ account_id: ids.rappi, valid_from: '2026-09-15', amount_minor: 0 });

  await engine.accrue(ids.rappi, '2026-09-20');
  const days = await yields.days(ids.rappi);
  const on = date => days.find(d => d.on_date === date);

  // Half the account is out until the 15th, and back in from it. The base
  // jumps by that half, plus the small amount the cushion grew in a day.
  const jump = on('2026-09-15').balance_minor - on('2026-09-14').balance_minor;
  assert.ok(jump > 500_000_000, `the money came back to a product that pays, jump was ${jump}`);
  // Plus one day of yield on the part that was earning, and nothing else.
  assert.ok(jump < 500_500_000, 'and nothing else moved');
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

test('a ledger pocket holds whatever the manual ones did not take', async () => {
  const { yields, engine, ids } = await setup();
  await yields.enrol({
    account_id: ids.rappi, opening_cushion_minor: 0, opening_on: '2026-09-09', withholding: false,
  });
  await yields.setRate({ account_id: ids.rappi, valid_from: '2026-09-09', annual_rate_scaled: pct(9) });

  // 10,000,000.00 in the account; 3,000,000.00 of it put into a named pocket.
  const named = await yields.addPocket({
    account_id: ids.rappi, name: 'Meta viaje', source: 'manual', sort_order: 1,
  });
  await yields.setPocketBalance({
    pocket_id: named, valid_from: '2026-09-09', amount_minor: 300_000_000,
  });

  await engine.accrue(ids.rappi, '2026-09-10');
  const days = await yields.days(ids.rappi, '2026-09-10', '2026-09-10');
  const bases = days.map(day => day.balance_minor).sort((a, b) => a - b);

  assert.deepEqual(bases, [300_000_000, 700_000_000],
    'the rest of the account is what the ledger pocket earns on');
});

test('a pocket that took more than the account holds leaves nothing behind', async () => {
  const { yields, engine, ids } = await setup();
  await yields.enrol({
    account_id: ids.rappi, opening_cushion_minor: 0, opening_on: '2026-09-09', withholding: false,
  });
  await yields.setRate({ account_id: ids.rappi, valid_from: '2026-09-09', annual_rate_scaled: pct(9) });

  const named = await yields.addPocket({
    account_id: ids.rappi, name: 'Demasiado', source: 'manual', sort_order: 1,
  });
  await yields.setPocketBalance({
    pocket_id: named, valid_from: '2026-09-09', amount_minor: 5_000_000_000,
  });

  await engine.accrue(ids.rappi, '2026-09-10');
  const days = await yields.days(ids.rappi, '2026-09-10', '2026-09-10');
  const ledgerDay = days.find(day => day.balance_minor === 0);

  assert.ok(ledgerDay, 'the ledger pocket earns on nothing rather than on a debt');
  assert.equal(ledgerDay.gross_minor, 0);
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

test('with a ledger pocket the cushion still earns, as it always did', async () => {
  const { yields, engine, ids } = await setup();
  await yields.enrol({
    account_id: ids.rappi, opening_cushion_minor: 491_743_498,
    opening_on: '2026-09-09', withholding: false,
  });
  await yields.setRate({ account_id: ids.rappi, valid_from: '2026-09-09', annual_rate_scaled: pct(9) });

  await engine.accrue(ids.rappi, '2026-09-10');
  const day = (await yields.days(ids.rappi))[0];

  // The ledger knows nothing about those yields - that is the whole reason the
  // cushion is a separate figure - so they are real money that is earning.
  assert.equal(day.balance_minor, 1_000_000_000 + 491_743_498);
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

test('pockets that agree with the account report no drift', async () => {
  const { db, accounts, yields, tax, engine } = await setup();
  await withRealisticWithholding(tax);
  const dale = await daleWithPockets({ accounts, yields, db });

  await engine.accrue(dale, '2026-09-10');

  // The pockets add up to the ledger plus the cushion, which is what the bank
  // actually holds. Nothing is wrong, so nothing is reported.
  assert.equal(await yields.pocketDrift(dale), 0);
});

test('drift survives the days compounding', async () => {
  const { db, accounts, yields, tax, engine } = await setup();
  await withRealisticWithholding(tax);
  const dale = await daleWithPockets({ accounts, yields, db });

  // Both sides grow by the same yields, so a week later they still agree.
  await engine.accrue(dale, '2026-09-17');
  assert.equal(await yields.pocketDrift(dale), 0);
});

test('a movement the pockets do not know about is what drift is for', async () => {
  const { db, accounts, transactions, yields, tax, engine, ids } = await setup();
  await withRealisticWithholding(tax);
  const dale = await daleWithPockets({ accounts, yields, db });
  await engine.accrue(dale, '2026-09-10');

  // 2,000,000.00 arrives. It landed in one of the alcancias, but a movement
  // never says which, so the app cannot place it - only report it.
  await transactions.create({
    account_id: dale, category_id: ids.gastos, occurred_on: '2026-09-11',
    amount_minor: 200_000_000, source: 'manual',
  });
  await engine.accrue(dale, '2026-09-11');

  assert.equal(await yields.pocketDrift(dale), 200_000_000);
});

test('an account whose pocket follows the ledger can never drift', async () => {
  const { yields, engine, ids } = await setup();
  await yields.enrol({
    account_id: ids.rappi, opening_cushion_minor: 491_743_498,
    opening_on: '2026-09-09', withholding: false,
  });
  await yields.setRate({ account_id: ids.rappi, valid_from: '2026-09-09', annual_rate_scaled: pct(9) });
  await engine.accrue(ids.rappi, '2026-09-20');

  // There is nothing to compare: the ledger pocket holds whatever is left.
  assert.equal(await yields.pocketDrift(ids.rappi), null);
});

test('nothing worked out yet means nothing to compare', async () => {
  const { db, accounts, yields, tax } = await setup();
  await withRealisticWithholding(tax);
  const dale = await daleWithPockets({ accounts, yields, db });

  assert.equal(await yields.pocketDrift(dale), null, 'no days, no claim');
});
