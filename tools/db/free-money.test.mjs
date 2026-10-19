// "Libre para gastar" and what each goal would want this month (Jose,
// 2026-10-19, mockups 39m-39o). Figures invented, the same as the mockups.
//
//   node --import ./tools/db/register-ts.mjs --test tools/db/free-money.test.mjs

import test from 'node:test';
import assert from 'node:assert/strict';

import { afford, freeMoney, goalThisMonth, perDay } from '../../src/app/core/assistant/free-money.ts';

const P = pesos => Math.round(pesos * 100);
const TODAY = '2026-10-19';
const goal = extra => ({ id: 1, name: 'Meta', icon: 'flag', color: null, amountMinor: P(6_000_000), savedMinor: 0,
  savedAtMonthStartMinor: 0, dueMonth: null, paceMinor: 0, reached: false, ...extra });

test('a goal with a date: what it lacks over the months left, less what went in this month (39n)', () => {
  const trip = goalThisMonth(goal({ savedMinor: P(2_450_000), savedAtMonthStartMinor: P(2_350_000), dueMonth: '2027-06' }), TODAY);
  assert.equal(trip.how, 'dated');
  assert.equal(trip.monthsLeft, 8);
  assert.equal(trip.lacksMinor, P(3_650_000));
  assert.equal(trip.aimMinor, P(456_250));
  assert.equal(trip.alreadyMinor, P(100_000));
  assert.equal(trip.leftMinor, P(356_250));
  assert.equal(trip.keptMinor, P(2_450_000));
});

test('a goal with no date: the person\'s own average, never a fixed instalment', () => {
  const car = goalThisMonth(goal({ amountMinor: P(30_000_000), savedMinor: P(1_900_000), savedAtMonthStartMinor: P(1_900_000), paceMinor: P(150_000) }), TODAY);
  assert.equal(car.how, 'average');
  assert.equal(car.leftMinor, P(150_000));
  const paid = goalThisMonth(goal({ amountMinor: P(30_000_000), savedMinor: P(2_100_000), savedAtMonthStartMinor: P(1_900_000), paceMinor: P(150_000) }), TODAY);
  assert.equal(paid.leftMinor, 0, 'more than the average already went in: nothing more is set aside');
  const none = goalThisMonth(goal({ amountMinor: P(30_000_000) }), TODAY);
  assert.equal(none.how, 'noHistory');
  assert.equal(none.leftMinor, 0);
});

test('a goal reached sets nothing aside this month, and keeps only up to its figure', () => {
  const done = goalThisMonth(goal({ amountMinor: P(1_000_000), savedMinor: P(1_300_000), reached: true }), TODAY);
  assert.equal(done.how, 'reached');
  assert.equal(done.leftMinor, 0);
  assert.equal(done.keptMinor, P(1_000_000));
});

test('what a goal keeps in a CDT is not counted twice', () => {
  // 6 M goal holding 7 M: 2 M in a CDT (never counted as free), 5 M in an account.
  const g = goalThisMonth(goal({ savedMinor: P(7_000_000), countedMinor: P(5_000_000), reached: true }), TODAY);
  assert.equal(g.keptMinor, P(4_000_000));
});

test('a dated goal due this month or already past wants all it lacks now', () => {
  const now = goalThisMonth(goal({ dueMonth: '2026-10', savedAtMonthStartMinor: P(1_000_000), savedMinor: P(1_000_000) }), TODAY);
  assert.equal(now.monthsLeft, 1);
  assert.equal(now.leftMinor, P(5_000_000));
});

test('the free money adds up as the card says (39m)', () => {
  const free = freeMoney({
    inAccountsMinor: P(9_120_000),
    payments: [{ kind: 'card', id: 3, name: 'Tarjeta', amountMinor: P(890_000), dueOn: '2026-11-01', fromAccountId: 1 }],
    goals: [
      goal({ id: 1, savedMinor: P(2_450_000), savedAtMonthStartMinor: P(2_350_000), dueMonth: '2027-06' }),
      goal({ id: 2, amountMinor: P(30_000_000), savedMinor: P(1_800_000), savedAtMonthStartMinor: P(1_800_000), paceMinor: P(150_000) }),
    ],
    today: TODAY,
  });
  assert.equal(free.inGoalsMinor, P(4_250_000));
  assert.equal(free.goalsMonthMinor, P(506_250));
  assert.equal(free.freeMinor, P(9_120_000 - 4_250_000 - 890_000 - 506_250));
  assert.equal(free.monthEnd, '2026-10-31');
  assert.equal(free.daysLeft, 13);
});

test('per day: rounded down to whole hundreds, nothing when nothing is free', () => {
  assert.equal(perDay(P(950_000), 13), P(73_000));
  assert.equal(perDay(P(650_000), 13), P(50_000));
  assert.equal(perDay(-P(100), 13), 0);
});

test('can it be afforded: free, its cap, or how much it lacks', () => {
  assert.deepEqual(afford(P(1_250_000), P(300_000), { remainingMinor: P(220_000) }),
    { verdict: 'yesButCap', afterMinor: P(950_000), shortMinor: 0, capOverMinor: P(80_000) });
  assert.equal(afford(P(1_250_000), P(300_000), null).verdict, 'yes');
  assert.deepEqual(afford(P(2_650_000), P(3_000_000), null),
    { verdict: 'no', afterMinor: -P(350_000), shortMinor: P(350_000), capOverMinor: 0 });
});
