// Goals (core/goals): what a goal has is what its places hold; what it still
// needs a month, the pace, the arrival, the emergency fund's figure, and
// "Todas tus cuentas" never counting a peso another goal already holds.
//
//   node --import ./tools/db/register-ts.mjs --test tools/db/goals.test.mjs

import test from 'node:test';
import assert from 'node:assert/strict';

import { NodeSqlDriver } from './node-sql-driver.mjs';
import { migrate } from '../../src/app/core/database/migrations/migration-runner.ts';
import { MIGRATION_SOURCES } from '../../src/app/core/database/migrations/statements.generated.ts';
import { AccountsRepository } from '../../src/app/core/database/repositories/accounts.repository.ts';
import { CategoriesRepository } from '../../src/app/core/database/repositories/categories.repository.ts';
import { TransactionsRepository } from '../../src/app/core/database/repositories/transactions.repository.ts';
import { TransfersRepository } from '../../src/app/core/database/repositories/transfers.repository.ts';
import { GoalsRepository, savedOn } from '../../src/app/core/goals/goals.repository.ts';
import { emergencyAmount, goalStatus, monthlySpend, monthsBetween, placeCount } from '../../src/app/core/goals/goals.ts';

const P = pesos => Math.round(pesos * 100);

test('on time: what is left, what each month needs, and when the pace arrives', () => {
  const s = goalStatus({ amountMinor: P(6_000_000), dueMonth: '2027-06', reachedOn: null }, P(2_350_000), P(850_000), '2026-10-20');
  assert.equal(s.remainingMinor, P(3_650_000));
  assert.equal(s.monthsLeft, 8);
  assert.equal(s.neededPerMonthMinor, P(456_250));
  assert.equal(s.paceMinor, P(500_000));
  assert.equal(s.arrivalMonth, '2027-06');
  assert.equal(s.state, 'onTime');
  assert.equal(s.percent, 39);
});

test('late: the pace arrives after the date, and by how many months', () => {
  const s = goalStatus({ amountMinor: P(4_500_000), dueMonth: '2026-12', reachedOn: null }, P(2_900_000), P(1_850_000), '2026-10-20');
  assert.equal(s.neededPerMonthMinor, P(800_000));
  assert.equal(s.paceMinor, P(350_000));
  assert.equal(s.arrivalMonth, '2027-03');
  assert.equal(s.state, 'late');
  assert.equal(s.lateBy, 3);
  assert.equal(s.tooSlow, false);
  const slow = goalStatus({ amountMinor: P(20_000_000), dueMonth: '2027-06', reachedOn: null }, P(58_134), P(51_260), '2026-10-20');
  assert.equal(slow.tooSlow, true);
  assert.equal(slow.arrivalMonth, null);
});

test('no pace means no arrival; a date gone by is late; no date only says when', () => {
  assert.equal(goalStatus({ amountMinor: P(100), dueMonth: '2027-01', reachedOn: null }, P(10), P(10), '2026-10-01').arrivalMonth, null);
  assert.equal(goalStatus({ amountMinor: P(100), dueMonth: '2027-01', reachedOn: null }, P(10), P(10), '2026-10-01').state, 'late');
  const past = goalStatus({ amountMinor: P(100), dueMonth: '2026-08', reachedOn: null }, P(50), P(20), '2026-10-01');
  assert.equal(past.state, 'late');
  assert.equal(past.monthsLeft, 0);
  assert.equal(past.neededPerMonthMinor, P(50));
  const free = goalStatus({ amountMinor: P(19_800_000), dueMonth: null, reachedOn: null }, P(8_400_000), P(6_600_000), '2026-10-01');
  assert.equal(free.state, 'noDate');
  assert.equal(free.neededPerMonthMinor, null);
  assert.equal(free.arrivalMonth, '2028-05'); // 11.4 M at 600,000 a month: 19 months
});

test('reached stays reached, even after the money is used', () => {
  assert.equal(goalStatus({ amountMinor: P(100), dueMonth: null, reachedOn: null }, P(120), 0, '2026-10-01').state, 'reached');
  const used = goalStatus({ amountMinor: P(100), dueMonth: null, reachedOn: '2026-09-12' }, P(5), P(100), '2026-10-01');
  assert.equal(used.state, 'reached');
  assert.equal(used.savedMinor, P(5));
});

test('a place counts all it holds, or only what came in since it was added', () => {
  assert.equal(placeCount({ counts: 'all', startMinor: P(900) }, P(1_000)), P(1_000));
  assert.equal(placeCount({ counts: 'from_start', startMinor: P(900) }, P(1_000)), P(100));
  assert.equal(monthsBetween('2026-10', '2027-06'), 8);
});

test('what is spent a month: whole months only, from the first one on record', () => {
  const r = (day, pesos, extra = {}) => ({ id: 1, categoryId: 1, accountId: 1, accountType: 'debit', inNetWorth: true, occurredOn: day, amountMinor: P(pesos), description: null, ...extra });
  const rows = [
    r('2026-07-05', -3_000_000), r('2026-08-05', -3_600_000), r('2026-09-05', -3_300_000),
    r('2026-09-06', 5_000_000), // income is not spending
    r('2026-10-02', -9_999_999), // this month is not whole yet
    r('2026-09-07', -1, { inNetWorth: false }),
  ];
  assert.equal(monthlySpend(rows, '2026-10-20'), P(3_300_000));
  assert.equal(emergencyAmount(P(3_300_000), 6), P(19_800_000));
  assert.equal(emergencyAmount(P(3_301_234.56), 3), P(9_904_000));
});

async function world() {
  const db = new NodeSqlDriver();
  await migrate(db, MIGRATION_SOURCES);
  const now = () => '2026-10-20T12:00:00Z';
  const accounts = new AccountsRepository(db, now);
  const make = (name, pesos, extra = {}) => accounts.create({ name, type: 'debit', currency_code: 'COP', builtin_icon: 'wallet', opening_balance_minor: P(pesos), opened_on: '2026-01-01', ...extra });
  const bank = await make('Banco Azul', 4_000_000);
  const savings = await make('Ahorro Verde', 6_000_000);
  const card = await make('Tarjeta', 0, { type: 'credit' });
  const outside = await make('Fuera', 1_000_000, { include_in_net_worth: false });
  const categories = new CategoriesRepository(db, now);
  const food = await categories.create({ name: 'Mercado', kind: 'expense', builtin_icon: 'basket-outline' });
  return { db, bank, savings, card, outside, food, goals: new GoalsRepository(db, now), tx: new TransactionsRepository(db, now), transfers: new TransfersRepository(db, now) };
}

const base = { icon: 'flag-outline', color: null, dueMonth: null, kind: 'custom', months: null, allAccounts: false };

test('a goal written, read and changed; a place belongs to one goal only', async () => {
  const w = await world();
  const id = await w.goals.create({ ...base, name: 'Viaje', amountMinor: P(6_000_000), dueMonth: '2027-06',
    places: [{ accountId: w.bank, productId: null, counts: 'from_start' }, { accountId: w.savings, productId: null, counts: 'all' }] }, '2026-10-20');
  const [goal] = await w.goals.all();
  assert.equal(goal.id, id);
  assert.equal(goal.dueMonth, '2027-06');
  assert.deepEqual(goal.places.map(p => [p.accountId, p.counts, p.startMinor]), [[w.bank, 'from_start', P(4_000_000)], [w.savings, 'all', 0]]);
  await assert.rejects(w.goals.create({ ...base, name: 'Otra', amountMinor: P(1), places: [{ accountId: w.savings, productId: null, counts: 'all' }] }, '2026-10-20'));

  // Changing it keeps where a kept place started from.
  await w.tx.create({ account_id: w.bank, category_id: w.food, occurred_on: '2026-10-21', amount_minor: P(500_000), description: 'x' });
  await w.goals.update(id, { ...base, name: 'Viaje a Cartagena', amountMinor: P(7_000_000), dueMonth: null,
    places: [{ accountId: w.bank, productId: null, counts: 'from_start' }] }, '2026-10-22');
  const [changed] = await w.goals.all();
  assert.equal(changed.name, 'Viaje a Cartagena');
  assert.deepEqual(changed.places.map(p => p.startMinor), [P(4_000_000)]);

  await w.goals.remove(id);
  assert.equal((await w.db.query('SELECT * FROM goal_places')).length, 0);
});

test('what a goal has is what its places hold; every account less what the others hold', async () => {
  const w = await world();
  await w.goals.create({ ...base, name: 'Viaje', amountMinor: P(6_000_000), places: [{ accountId: w.bank, productId: null, counts: 'from_start' }] }, '2026-10-20');
  const fondo = await w.goals.create({ ...base, name: 'Fondo', amountMinor: P(19_800_000), allAccounts: true, places: [] }, '2026-10-20');
  const viaje = (await w.goals.all())[0].id;
  // 300,000 more into the bank after the goal began: the trip's.
  await w.transfers.create({ occurred_on: '2026-10-21', from: { account_id: w.savings, amount_minor: P(300_000) }, to: { account_id: w.bank, amount_minor: P(300_000) } });
  // Money spent on the card is a debt, not savings: the fund does not lose it.
  await w.tx.create({ account_id: w.card, category_id: w.food, occurred_on: '2026-10-21', amount_minor: P(-200_000) });

  const goals = await w.goals.all();
  const { saved } = await savedOn(w.goals, goals, '2026-10-22', new Map());
  assert.equal(saved.get(viaje), P(300_000));
  // Bank 4.3 M + savings 5.7 M, less the trip's 300,000; the card and the account outside net worth never.
  assert.equal(saved.get(fondo), P(9_700_000));
});

test('the backup carries the goals', async () => {
  const { TABLES } = await import('../../src/app/core/database/export/export-backup.ts');
  assert.ok(TABLES.includes('goals') && TABLES.includes('goal_places'));
});
