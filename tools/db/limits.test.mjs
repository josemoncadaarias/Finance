// Spending limits (core/limits): what a limit has spent, by the summary's own
// rule, its state and pace, the average offered, and the notices' crossings.
//
//   node --import ./tools/db/register-ts.mjs --test tools/db/limits.test.mjs

import test from 'node:test';
import assert from 'node:assert/strict';

import { NodeSqlDriver } from './node-sql-driver.mjs';
import { migrate } from '../../src/app/core/database/migrations/migration-runner.ts';
import { MIGRATION_SOURCES } from '../../src/app/core/database/migrations/statements.generated.ts';
import { AccountsRepository } from '../../src/app/core/database/repositories/accounts.repository.ts';
import { CategoriesRepository } from '../../src/app/core/database/repositories/categories.repository.ts';
import { TransactionsRepository } from '../../src/app/core/database/repositories/transactions.repository.ts';
import { TransfersRepository } from '../../src/app/core/database/repositories/transfers.repository.ts';
import { LimitsRepository } from '../../src/app/core/limits/limits.repository.ts';
import {
  averageBefore, crossings, levelOf, limitStatus, rowsOf, roundedAverage, roundedLimit, spendOf, spentIn, totalStatus,
} from '../../src/app/core/limits/limits.ts';

const P = pesos => Math.round(pesos * 100);
let next = 1;
const row = (day, pesos, extra = {}) => ({
  id: next++, categoryId: 1, accountId: 10, accountType: 'debit', inNetWorth: true,
  occurredOn: day, amountMinor: P(pesos), description: null, ...extra,
});
const MERCADO = { id: 1, amountMinor: P(1_200_000), accountId: null, warnAt80: true, categoryIds: [1] };

test('spent is the summary\'s rule: expenses less refunds on a card, income never', () => {
  const rows = [
    row('2026-10-02', -500_000),
    row('2026-10-03', -100_000, { accountId: 20, accountType: 'credit' }),
    row('2026-10-04', 30_000, { accountId: 20, accountType: 'credit' }), // a refund on the card
    row('2026-10-05', 999_000), // money in on a debit account, under that category: not spending
  ];
  assert.equal(spentIn(rows), P(570_000));
  assert.equal(rows.reduce((sum, r) => sum + spendOf(r), 0), P(570_000));
});

test('every account means those counted in net worth; one account means that one', () => {
  const rows = [row('2026-10-02', -10), row('2026-10-02', -20, { accountId: 30, inNetWorth: false }), row('2026-10-02', -40, { categoryId: 2 })];
  assert.deepEqual(rowsOf(MERCADO, rows).map(r => r.amountMinor), [P(-10)]);
  assert.deepEqual(rowsOf({ ...MERCADO, accountId: 30 }, rows).map(r => r.amountMinor), [P(-20)]);
});

test('a limit passed: by how much, with which movement, and since when', () => {
  const rows = [row('2026-10-01', -600_000), row('2026-10-10', -362_000), row('2026-10-18', -240_000, { description: 'Mercado quincena' }), row('2026-10-19', -160_000)];
  const s = limitStatus(MERCADO, rows, '2026-10', '2026-10-20');
  assert.equal(s.spentMinor, P(1_362_000));
  assert.equal(s.percent, 114);
  assert.equal(s.state, 'passed');
  assert.equal(s.overMinor, P(162_000));
  assert.equal(s.remainingMinor, 0);
  assert.equal(s.passedWith.description, 'Mercado quincena');
  assert.equal(s.passedWith.occurredOn, '2026-10-18');
  assert.equal(s.daysLeft, 12);
  assert.equal(s.rows[0].occurredOn, '2026-10-19');
});

test('green, amber ahead of the month, amber from 80 %', () => {
  const limit = { ...MERCADO, amountMinor: P(400_000) };
  // Day 20 of 31: 64.5 % of the month gone by.
  assert.equal(limitStatus(limit, [row('2026-10-05', -200_000)], '2026-10', '2026-10-20').state, 'good');
  assert.equal(limitStatus(limit, [row('2026-10-05', -280_000)], '2026-10', '2026-10-20').state, 'fast');
  assert.equal(limitStatus(limit, [row('2026-10-05', -320_000)], '2026-10', '2026-10-30').state, 'close');
  // Exactly the limit is reached, not passed.
  assert.equal(limitStatus(limit, [row('2026-10-05', -400_000)], '2026-10', '2026-10-30').state, 'close');
  // A month over: no pace, no days left.
  const past = limitStatus(limit, [row('2026-09-05', -200_000)], '2026-09', '2026-10-20');
  assert.equal(past.state, 'good');
  assert.equal(past.daysLeft, 0);
  assert.equal(past.perDayMinor, 0);
});

test('what is left a day, and the month before up to the same day', () => {
  const limit = { ...MERCADO, amountMinor: P(400_000) };
  const rows = [row('2026-10-03', -312_000), row('2026-09-10', -260_000), row('2026-09-25', -50_000)];
  const s = limitStatus(limit, rows, '2026-10', '2026-10-20');
  assert.equal(s.remainingMinor, P(88_000));
  assert.equal(s.perDayMinor, Math.floor(P(88_000) / 12));
  assert.equal(s.lastMonthSoFarMinor, P(260_000));
});

test('six months of history and the average of the three whole months before', () => {
  const rows = [row('2026-07-04', -1_500_000), row('2026-08-04', -1_170_000), row('2026-09-04', -1_200_000), row('2026-05-04', -900_000)];
  const s = limitStatus(MERCADO, rows, '2026-10', '2026-10-20');
  assert.deepEqual(s.history.map(h => h.month), ['2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10']);
  assert.equal(s.history[2].spentMinor, P(1_500_000));
  assert.equal(s.averageMinor, P(1_290_000));
  assert.equal(roundedLimit(s.averageMinor), P(1_300_000));
  assert.equal(averageBefore([], '2026-10-20'), null);
  assert.equal(roundedAverage(P(371_666.67)), P(372_000));
  assert.equal(roundedLimit(P(372_000)), P(380_000));
  assert.equal(roundedLimit(P(51_200)), P(52_000));
});

test('the total of every limit, and how many passed', () => {
  const a = limitStatus(MERCADO, [row('2026-10-02', -1_362_000)], '2026-10', '2026-10-20');
  const b = limitStatus({ ...MERCADO, id: 2, amountMinor: P(300_000), categoryIds: [2] }, [row('2026-10-02', -264_000, { categoryId: 2 })], '2026-10', '2026-10-20');
  const t = totalStatus([a, b], '2026-10', '2026-10-20');
  assert.equal(t.amountMinor, P(1_500_000));
  assert.equal(t.spentMinor, P(1_626_000));
  assert.equal(t.state, 'passed');
  assert.equal(t.overMinor, P(126_000));
  assert.equal(t.passedCount, 1);
});

test('a notice is a level crossed: 80 % or past, the total only when past, never a new limit', () => {
  assert.equal(levelOf(P(79), P(100)), 0);
  assert.equal(levelOf(P(80), P(100)), 80);
  assert.equal(levelOf(P(100), P(100)), 80);
  assert.equal(levelOf(P(101), P(100)), 100);
  const before = new Map([[1, 0], [2, 80], ['total', 80]]);
  const after = new Map([[1, 80], [2, 100], [3, 100], ['total', 100]]);
  assert.deepEqual(crossings(before, after), [{ key: 1, level: 80 }, { key: 2, level: 100 }, { key: 'total', level: 100 }]);
  assert.deepEqual(crossings(after, after), []);
  assert.deepEqual(crossings(new Map([['total', 0]]), new Map([['total', 80]])), []);
});

async function world() {
  const db = new NodeSqlDriver();
  await migrate(db, MIGRATION_SOURCES);
  const now = () => '2026-10-20T12:00:00Z';
  const accounts = new AccountsRepository(db, now);
  const bank = await accounts.create({ name: 'Banco Azul', type: 'debit', currency_code: 'COP', builtin_icon: 'wallet', opening_balance_minor: P(5_000_000), opened_on: '2026-01-01' });
  const other = await accounts.create({ name: 'Otra', type: 'debit', currency_code: 'COP', builtin_icon: 'wallet', opening_balance_minor: 0, opened_on: '2026-01-01' });
  const categories = new CategoriesRepository(db, now);
  const food = await categories.create({ name: 'Mercado', kind: 'expense', builtin_icon: 'basket-outline' });
  const out = await categories.create({ name: 'Restaurantes', kind: 'expense', builtin_icon: 'restaurant-outline' });
  return { db, bank, other, food, out, limits: new LimitsRepository(db, now), tx: new TransactionsRepository(db, now), transfers: new TransfersRepository(db, now), categories };
}

test('a limit written, read, changed and removed; a category in one limit at most', async () => {
  const w = await world();
  const id = await w.limits.create({ amountMinor: P(1_200_000), accountId: null, warnAt80: true, categoryIds: [w.food, w.out] });
  assert.deepEqual(await w.limits.all(), [{ id, amountMinor: P(1_200_000), accountId: null, warnAt80: true, categoryIds: [w.food, w.out].sort((a, b) => a - b) }]);
  await assert.rejects(w.limits.create({ amountMinor: P(1), accountId: null, warnAt80: false, categoryIds: [w.food] }));
  assert.equal((await w.limits.all()).length, 1);
  await w.limits.update(id, { amountMinor: P(900_000), accountId: w.bank, warnAt80: false, categoryIds: [w.food] });
  await w.limits.setAmount(id, P(950_000));
  assert.deepEqual(await w.limits.all(), [{ id, amountMinor: P(950_000), accountId: w.bank, warnAt80: false, categoryIds: [w.food] }]);
  await w.limits.remove(id);
  assert.deepEqual(await w.limits.all(), []);
  assert.equal((await w.db.query('SELECT * FROM spending_limit_categories')).length, 0);
});

test('the movements read are those of its categories, never a transfer', async () => {
  const w = await world();
  await w.limits.create({ amountMinor: P(1_200_000), accountId: null, warnAt80: true, categoryIds: [w.food] });
  await w.tx.create({ account_id: w.bank, category_id: w.food, occurred_on: '2026-10-02', amount_minor: P(-100_000), description: 'D1' });
  await w.tx.create({ account_id: w.bank, category_id: w.out, occurred_on: '2026-10-02', amount_minor: P(-50_000) });
  await w.tx.create({ account_id: w.bank, category_id: w.food, occurred_on: '2025-01-02', amount_minor: P(-7) });
  await w.transfers.create({ occurred_on: '2026-10-03', from: { account_id: w.bank, amount_minor: P(10_000) }, to: { account_id: w.other, amount_minor: P(10_000) } });
  const rows = await w.limits.rows('2026-05-01');
  assert.deepEqual(rows.map(r => [r.categoryId, r.amountMinor, r.description]), [[w.food, P(-100_000), 'D1']]);
  assert.equal((await w.limits.rows('2026-05-01', [w.out])).length, 1);
});

test('the notices start on, and each is kept apart', async () => {
  const w = await world();
  assert.deepEqual(await w.limits.notices(), { atSave: true, phone: true, at80: true });
  await w.limits.setNotice('atSave', false);
  assert.deepEqual(await w.limits.notices(), { atSave: false, phone: true, at80: true });
  await w.limits.setNotice('atSave', true);
  assert.equal((await w.limits.notices()).atSave, true);
});
