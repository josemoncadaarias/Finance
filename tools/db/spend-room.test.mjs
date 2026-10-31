// "Puedes gastar hoy" from what comes in each month (Jose, 2026-10-31,
// mockups 51a-51g). Figures invented, the same as the mockups.
//
//   node --import ./tools/db/register-ts.mjs --test tools/db/spend-room.test.mjs

import test from 'node:test';
import assert from 'node:assert/strict';

import { perDayOf, savePctOf, spendRoom, SAVE_PCT_DEFAULT } from '../../src/app/core/assistant/spend-room.ts';

const P = pesos => Math.round(pesos * 100);
const TODAY = '2026-10-19';
const incomes = [
  { month: '2026-09', inMinor: P(9_500_000) },
  { month: '2026-07', inMinor: P(8_500_000) },
  { month: '2026-08', inMinor: P(9_000_000) },
];
const pays = [
  { kind: 'fixed', name: 'Arriendo', amountMinor: P(400_000), dueOn: null },
  { kind: 'loan', name: 'Crédito del carro', amountMinor: P(240_000), dueOn: '2026-10-25' },
];

test('what comes in, less 20 %, less what was spent and the payments to come (51b)', () => {
  const r = spendRoom({ incomes, savePct: 20, goalsAskMinor: 0, spentMinor: P(4_900_000), payments: pays, today: TODAY });
  assert.equal(r.incomeMinor, P(9_000_000));
  assert.deepEqual(r.months, ['2026-07', '2026-08', '2026-09']);
  assert.equal(r.saveMinor, P(1_800_000));
  assert.equal(r.saveFrom, 'percent');
  assert.equal(r.paymentsMinor, P(640_000));
  assert.equal(r.leftMinor, P(1_660_000));
  assert.equal(r.daysLeft, 13);
  assert.equal(r.monthEnd, '2026-10-31');
  assert.equal(r.perDayMinor, P(127_600));
  assert.equal(r.noIncome, false);
});

test('a goal with a date asking more than the share takes what it asks (51c)', () => {
  const r = spendRoom({ incomes, savePct: 20, goalsAskMinor: P(2_500_000), spentMinor: P(4_900_000), payments: pays, today: TODAY });
  assert.equal(r.saveFrom, 'goals');
  assert.equal(r.saveMinor, P(2_500_000));
  assert.equal(r.leftMinor, P(960_000));
});

test('already over: the figure is negative and nothing a day (51d)', () => {
  const r = spendRoom({ incomes, savePct: 20, goalsAskMinor: 0, spentMinor: P(6_980_000), payments: pays, today: TODAY });
  assert.equal(r.leftMinor, -P(420_000));
  assert.equal(r.perDayMinor, 0);
});

test('nothing came in: it cannot be worked out (51e)', () => {
  const r = spendRoom({ incomes: incomes.map(m => ({ ...m, inMinor: 0 })), savePct: 20, goalsAskMinor: 0, spentMinor: 0, payments: [], today: TODAY });
  assert.equal(r.noIncome, true);
});

test('the money already saved never enters it: only what comes in does', () => {
  // Two people with the same month and very different savings get the same figure.
  const a = spendRoom({ incomes, savePct: 20, goalsAskMinor: 0, spentMinor: 0, payments: [], today: TODAY });
  assert.equal(a.leftMinor, P(7_200_000));
});

test('the share kept in settings, and the day rounded down to hundreds', () => {
  assert.equal(savePctOf(undefined), SAVE_PCT_DEFAULT);
  assert.equal(savePctOf('30'), 30);
  assert.equal(savePctOf('abc'), SAVE_PCT_DEFAULT);
  assert.equal(savePctOf('95'), SAVE_PCT_DEFAULT);
  assert.equal(perDayOf(P(1_000), 3), P(300));
  assert.equal(perDayOf(-5, 3), 0);
});
