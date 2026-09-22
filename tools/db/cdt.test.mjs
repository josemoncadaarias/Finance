// CDTs, and the move of rates onto products.
//
//   node --import ./tools/db/register-ts.mjs --test tools/db/cdt.test.mjs
//
// A CDT opens on a day, runs a whole number of months, and pays its whole term
// once, on the day it matures, with 7% withheld. Then its capital and net yield
// go to the product the person chose and it closes itself. These tests follow
// one from the day it opens to well after it is gone.

import test from 'node:test';
import assert from 'node:assert/strict';

import { NodeSqlDriver } from './node-sql-driver.mjs';
import { migrate } from '../../src/app/core/database/migrations/migration-runner.ts';
import { MIGRATION_SOURCES } from '../../src/app/core/database/migrations/statements.generated.ts';
import { AccountsRepository } from '../../src/app/core/database/repositories/accounts.repository.ts';
import { CategoriesRepository } from '../../src/app/core/database/repositories/categories.repository.ts';
import { YieldsRepository } from '../../src/app/core/database/repositories/yields.repository.ts';
import { TaxParametersRepository, TAX_KEYS } from '../../src/app/core/database/repositories/tax-parameters.repository.ts';
import { AccrualEngine } from '../../src/app/core/yields/accrual.ts';
import { addMonthsClamped } from '../../src/app/core/yields/days.ts';
import { EA_SCALE } from '../../src/app/core/yields/yield-math.ts';
import { accrueAndSettle, cdtPreview } from '../../src/app/core/yields/cdt.ts';

const NOW = () => '2026-09-11T12:00:00Z';
const pct = p => Math.round((p / 100) * EA_SCALE);
const pesos = p => Math.round(p * 100);

async function withCdt({ withholding = true } = {}) {
  const db = new NodeSqlDriver();
  await migrate(db, MIGRATION_SOURCES);
  const accounts = new AccountsRepository(db, NOW);
  const yields = new YieldsRepository(db, NOW);
  const tax = new TaxParametersRepository(db, NOW);

  const account = await accounts.create({
    name: 'Banco demo', type: 'debit', currency_code: 'COP', builtin_icon: 'wallet',
    opened_on: '2025-01-01', opening_balance_minor: pesos(15_000_000),
  });
  const income = await new CategoriesRepository(db, NOW).create({ name: 'Rendimientos', kind: 'income', builtin_icon: 'trending-up' });

  if (withholding) {
    for (const [key, value] of [
      [TAX_KEYS.uvtValue, '5237400'], [TAX_KEYS.threshold, '0.055'],
      [TAX_KEYS.percent, String(pct(7))], [TAX_KEYS.base, 'all'],
    ]) {
      await tax.set({ key, valid_from: '2026-01-01', value, source: 'test', confirmed: true });
    }
  }

  await yields.enrol({ account_id: account, opening_on: '2026-08-31', withholding });
  const [savings] = await yields.pockets(account);
  await db.run("UPDATE yield_pockets SET source = 'manual' WHERE id = ?", [savings.id]);
  await yields.setPocketBalance({ pocket_id: savings.id, valid_from: '2026-08-31', amount_minor: pesos(5_000_000) });
  await yields.setDefaultPocket(account, savings.id);

  const cdt = await yields.addPocket({
    account_id: account, name: 'Demo 1M', source: 'manual', kind: 'cdt', sort_order: 1,
    opened_on: '2026-09-10', term_months: 1, matures_into_pocket_id: savings.id, income_category_id: income,
  });
  await yields.setPocketBalance({ pocket_id: cdt, valid_from: '2026-09-10', amount_minor: pesos(10_000_000) });
  await yields.setRate({ account_id: account, pocket_id: cdt, valid_from: '2026-09-10', annual_rate_scaled: pct(9) });

  return { db, accounts, yields, tax, account, savings: savings.id, cdt };
}

test('a term of months ends on the same day of the month, or the last day of a shorter one', () => {
  assert.equal(addMonthsClamped('2026-09-10', 1), '2026-10-10');
  assert.equal(addMonthsClamped('2026-01-31', 1), '2026-02-28');
  assert.equal(addMonthsClamped('2028-01-31', 1), '2028-02-29', 'a leap year');
  assert.equal(addMonthsClamped('2026-11-30', 3), '2027-02-28');
  assert.equal(addMonthsClamped('2026-12-15', 12), '2027-12-15');
});

test('a CDT earns nothing on any day before it matures', async () => {
  const { db, yields, tax, account, cdt } = await withCdt();
  await accrueAndSettle(db, yields, tax, account, '2026-10-09');

  assert.equal((await yields.days(account)).filter(day => day.pocket_id === cdt).length, 0);
  assert.ok((await yields.pockets(account)).some(pocket => pocket.id === cdt), 'still open the day before');
});

test('the day it matures, it pays its term with 7% withheld, hands everything over and closes', async () => {
  const { db, accounts, yields, tax, account, savings, cdt } = await withCdt();
  const engine = new AccrualEngine(db, yields, tax);

  const preview = cdtPreview({
    capitalMinor: pesos(10_000_000), annualRateScaled: pct(9), openedOn: '2026-09-10', termMonths: 1,
    rule: await tax.withholdingRule('2026-10-10'), withholds: true,
  });
  assert.equal(preview.maturesOn, '2026-10-10');
  assert.equal(preview.days, 30);
  assert.equal(preview.withheldMinor, Math.round(preview.grossMinor * 0.07), '7% of all of it, no threshold');
  assert.equal(preview.receiveMinor, pesos(10_000_000) + preview.netMinor);

  const balance = async () => (await accounts.balances()).find(b => b.account.id === account).balance_minor;
  const accountBefore = await balance();
  const savingsBefore = (await engine.heldByPocket(account, '2026-10-10')).get(savings);

  await accrueAndSettle(db, yields, tax, account, '2026-10-10');

  assert.deepEqual((await yields.pockets(account)).map(pocket => pocket.id), [savings], 'the CDT closed itself');
  // The capital arrives as a movement on the chosen product rather than by
  // rewriting its stated balance; the net yield as a movement of the account.
  const carried = (await yields.adjustments(account))
    .filter(entry => entry.pocket_id === savings && entry.transaction_id === null)
    .reduce((sum, entry) => sum + entry.amount_minor, 0);
  assert.equal(carried, pesos(10_000_000), 'the capital, carried across as a movement');
  assert.equal((await engine.heldByPocket(account, '2026-10-10')).get(savings) + carried,
    savingsBefore + pesos(10_000_000) + preview.netMinor, 'capital and net yield, into the chosen product');
  assert.equal(await balance(), accountBefore + preview.netMinor, 'the net yield is new money in the account');

  const payment = (await yields.days(account)).find(day => day.component === 'CDT Demo 1M');
  assert.ok(payment, 'the payment is kept, named after the CDT');
  assert.equal(payment.pocket_id, savings);
  assert.equal(payment.gross_minor, preview.grossMinor);
  assert.equal(payment.withholding_minor, preview.withheldMinor);
  assert.equal(payment.locked, 1);

  const gathered = await yields.earned(account, '2026-10-10');
  assert.equal(gathered.accrued_minor - gathered.withdrawn_minor, 0,
    'the yield was paid into the balance, not left on top of it');
  const year = await yields.yearTotals(2026);
  assert.equal(year.withheldMinor, preview.withheldMinor, 'and the tax simulator reads what was withheld');
});

test('a closed CDT\'s payment survives every recompute after it', async () => {
  const { db, yields, tax, account } = await withCdt();
  await accrueAndSettle(db, yields, tax, account, '2026-10-10');
  const kept = (await yields.days(account)).find(day => day.component === 'CDT Demo 1M');

  await yields.clearDays(account);
  await accrueAndSettle(db, yields, tax, account, '2026-10-25');

  const again = (await yields.days(account)).find(day => day.component === 'CDT Demo 1M');
  assert.deepEqual({ gross: again.gross_minor, withheld: again.withholding_minor, net: again.net_minor },
    { gross: kept.gross_minor, withheld: kept.withholding_minor, net: kept.net_minor });
  const gathered = await yields.earned(account, '2026-10-25');
  assert.equal(gathered.accrued_minor - gathered.withdrawn_minor, 0);
});

test('a rate that belonged to a whole account is copied onto each product that used it', async () => {
  // A database as it stood before migration 030: a rate for the whole account,
  // two products without rates of their own, one product with its own, and a
  // bonus with a spending condition beside the account's rate.
  const db = new NodeSqlDriver();
  await migrate(db, MIGRATION_SOURCES.filter(source => source.version <= 29));
  const account = await new AccountsRepository(db, NOW).create({
    name: 'Cuenta vieja', type: 'debit', currency_code: 'COP', builtin_icon: 'wallet', opened_on: '2025-01-01',
  });
  const insertPocket = (name, sort) => db.run(
    `INSERT INTO yield_pockets (account_id, name, source, sort_order, created_at, updated_at)
     VALUES (?, ?, 'manual', ?, ?, ?)`, [account, name, sort, NOW(), NOW()]).then(r => r.lastId);
  const first = await insertPocket('Principal', 0);
  const second = await insertPocket('Ahorro', 1);
  const own = await insertPocket('Propia', 2);
  const rate = (pocket, component, payout, value, spend = null) => db.run(
    `INSERT INTO yield_rates (account_id, pocket_id, component, payout, valid_from, annual_rate_scaled,
       requires_monthly_spend_minor, fallback_annual_rate_scaled, created_at)
     VALUES (?, ?, ?, ?, '2026-09-09', ?, ?, ?, ?)`,
    [account, pocket, component, payout, value, spend, spend === null ? null : 0, NOW()]);
  await rate(null, 'Diario', 'daily', pct(5));
  await rate(null, 'Mensual por gasto', 'monthly', pct(5.5), pesos(400_000));
  await rate(own, 'base', 'monthly', pct(9));

  await migrate(db, MIGRATION_SOURCES);

  const rows = await db.query('SELECT pocket_id, component, payout, annual_rate_scaled FROM yield_rates ORDER BY pocket_id, component');
  assert.equal(rows.filter(row => row.pocket_id === null).length, 0, 'no rate is left for a whole account');
  for (const pocket of [first, second]) {
    assert.deepEqual(rows.filter(row => row.pocket_id === pocket).map(row => [row.component, row.payout, row.annual_rate_scaled]),
      [['Diario', 'daily', pct(5)], ['Mensual por gasto', 'monthly', pct(5.5)]], 'both parts, onto a product that used them');
  }
  assert.deepEqual(rows.filter(row => row.pocket_id === own).map(row => row.component), ['base'],
    'a product with a rate of its own did not use the account\'s, and gets no copy');

  const pockets = await db.query('SELECT id, payout FROM yield_pockets ORDER BY id');
  assert.deepEqual(pockets.map(pocket => pocket.payout), ['daily', 'daily', 'monthly'],
    'each product is paid the way its rate without a condition was');
});
