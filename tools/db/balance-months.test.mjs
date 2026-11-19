// An account's close of each month, worked back from today's balance, for
// the account's detail beside the list when the phone is held sideways (58e).
// Invented movements.
//
//   node --import ./tools/db/register-ts.mjs --test tools/db/balance-months.test.mjs

import test from 'node:test';
import assert from 'node:assert/strict';

import { monthBefore, monthlyCloses, thisMonthFlows } from '../../src/app/core/accounts/balance-months.ts';

test('months before cross the year', () => {
  assert.equal(monthBefore('2026-02-10', 1), '2026-01');
  assert.equal(monthBefore('2026-02-10', 2), '2025-12');
  assert.equal(monthBefore('2026-02-10', 14), '2024-12');
  assert.equal(monthBefore('2026-11-18', 0), '2026-11');
});

test('each close is today less what was dated after its month', () => {
  const moved = [
    { occurred_on: '2026-09-05', amount_minor: 100_00 },
    { occurred_on: '2026-10-31', amount_minor: -30_00 },
    { occurred_on: '2026-11-02', amount_minor: 50_00 },
    { occurred_on: '2026-11-15', amount_minor: -20_00 },
  ];
  const closes = monthlyCloses(1000_00, moved, '2026-11-18', 3);
  assert.deepEqual(closes, [
    { month: '2026-08', closeMinor: 900_00 },
    { month: '2026-09', closeMinor: 1000_00 },
    { month: '2026-10', closeMinor: 970_00 },
    { month: '2026-11', closeMinor: 1000_00 },
  ]);
});

test('no movement: a flat line at today\'s balance', () => {
  assert.deepEqual(monthlyCloses(5_00, [], '2026-01-03', 2).map(c => c.closeMinor), [5_00, 5_00, 5_00]);
});

test('this month: what came in and what left, never another month or the future', () => {
  const moved = [
    { occurred_on: '2026-10-30', amount_minor: 999_00 },
    { occurred_on: '2026-11-01', amount_minor: 40_00 },
    { occurred_on: '2026-11-10', amount_minor: -15_00 },
    { occurred_on: '2026-11-10', amount_minor: -5_00 },
    { occurred_on: '2026-11-25', amount_minor: 70_00 },
  ];
  assert.deepEqual(thisMonthFlows(moved, '2026-11-18'), { inMinor: 40_00, outMinor: 20_00 });
});
