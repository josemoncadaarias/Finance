// "Libre para gastar" and what each goal would want this month (Jose,
// 2026-10-19, mockups 39m-39o). Figures invented, the same as the mockups.
//
//   node --import ./tools/db/register-ts.mjs --test tools/db/free-money.test.mjs

import test from 'node:test';
import assert from 'node:assert/strict';

import { afford, freeInAccount, freeMoney, goalKeptIn, goalThisMonth, perDay } from '../../src/app/core/assistant/free-money.ts';

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

test('one account alone: what it holds, less its goal places and the payments that leave from it', () => {
  const payments = [
    { kind: 'card', id: 9, name: 'Tarjeta', amountMinor: P(400_000), dueOn: '2026-10-25', fromAccountId: 3 },
    { kind: 'loan', id: 8, name: 'Préstamo', amountMinor: P(900_000), dueOn: '2026-10-28', fromAccountId: 4 },
  ];
  const one = freeInAccount({ accountId: 3, holdsMinor: P(2_000_000), payments, keptMinor: P(500_000), today: TODAY });
  assert.deepEqual(one.payments.map(p => p.name), ['Tarjeta'], 'only what is paid from this account');
  assert.equal(one.inGoalsMinor, P(500_000));
  assert.equal(one.goalsMonthMinor, 0, 'a goal\'s month is not split between accounts');
  assert.equal(one.freeMinor, P(1_100_000));
  assert.equal(one.daysLeft, 13);
  // A goal never keeps more than the account holds.
  assert.equal(freeInAccount({ accountId: 3, holdsMinor: P(100_000), payments: [], keptMinor: P(500_000), today: TODAY }).freeMinor, 0);
});

test('a goal keeps its figure once, shared among its places by what each holds', () => {
  // An emergency fund of 6 million over three accounts holding 10 million in all.
  const places = [
    { accountId: 1, pesos: P(5_000_000), free: true },
    { accountId: 2, pesos: P(3_000_000), free: true },
    { accountId: 3, pesos: P(2_000_000), free: true },
  ];
  assert.equal(goalKeptIn(places, P(6_000_000), 1), P(3_000_000), 'never the whole figure in one account');
  assert.equal(goalKeptIn(places, P(6_000_000), 2), P(1_800_000));
  assert.equal(goalKeptIn(places, P(6_000_000), 3), P(1_200_000));
  // Not reached yet: everything its places hold is kept.
  assert.equal(goalKeptIn(places, P(20_000_000), 1), P(5_000_000));
  // A CDT among its places keeps its part first; the free places share the rest.
  const withCdt = [...places, { accountId: 4, pesos: P(4_000_000), free: false }];
  assert.equal(goalKeptIn(withCdt, P(6_000_000), 1), P(1_000_000));
  assert.equal(goalKeptIn(withCdt, P(3_000_000), 1), 0, 'the CDT alone covers it');
  assert.equal(goalKeptIn(places, P(6_000_000), 9), 0, 'an account that is no place keeps nothing');
});
