// Which debt to pay first, and what paying more each month does (Jose,
// 2026-10-19, mockups 40d-40g). Debts invented, the same as the mockups.
//
//   node --import ./tools/db/register-ts.mjs --test tools/db/debts-advice.test.mjs

import test from 'node:test';
import assert from 'node:assert/strict';

import { advise, interestThisMonth, monthAfter, monthsToFinish, payMore, REACH_MONTHS } from '../../src/app/core/assistant/debts-advice.ts';
import { usuryOn } from '../../src/app/core/debts/usury.ts';

const P = pesos => Math.round(pesos * 100);
const EA = percent => Math.round(percent * 10_000);
const base = { installmentMinor: 0, installmentsLeft: 0, interestLeftMinor: 0, payoffInterestMinor: 0, statementLeftMinor: 0, dueOn: null, rateFrom: 'typed' };
const visa = { ...base, kind: 'card', id: 1, name: 'Tarjeta Visa', balanceMinor: P(2_400_000), rateScaled: EA(28.5), statementLeftMinor: P(1_150_000), dueOn: '2026-10-25' };
const phone = { ...base, kind: 'loan', id: 2, name: 'Celular', balanceMinor: P(1_800_000), rateScaled: EA(33.9), installmentMinor: P(210_000), installmentsLeft: 9, interestLeftMinor: P(262_000), payoffInterestMinor: P(20_000) };
const car = { ...base, kind: 'loan', id: 3, name: 'Carro', balanceMinor: P(38_500_000), rateScaled: EA(16.5), installmentMinor: P(1_480_000), installmentsLeft: 31, interestLeftMinor: P(8_900_000) };
const house = { ...base, kind: 'loan', id: 4, name: 'Hipoteca', balanceMinor: P(182_000_000), rateScaled: EA(12.3), installmentMinor: P(1_950_000), installmentsLeft: 211 };

test('the statement first, then what can be finished soon by rate, a mortgage apart', () => {
  const a = advise([house, car, phone, visa], P(950_000));
  assert.deepEqual(a.statements.map(d => d.name), ['Tarjeta Visa']);
  // Paid one after another: the statement (1,15 M), the phone (1,8 M), the
  // rest of the Visa (1,25 M) - 4,2 M in 5 months at 950 mil; the car would take 46.
  assert.deepEqual(a.order.map(o => o.debt.name), ['Celular', 'Tarjeta Visa']);
  assert.deepEqual(a.order.map(o => o.months), [4, 5]);
  assert.equal(a.order[0].savingTodayMinor, P(242_000));
  // The car (41 months) and the house are too big to finish soon.
  assert.deepEqual(a.apart.map(o => o.debt.name), ['Carro', 'Hipoteca']);
});

test('a loan of a year and a half is in the order; one of three years is not', () => {
  const moto = { ...base, kind: 'loan', id: 5, name: 'Moto', balanceMinor: P(9_000_000), rateScaled: EA(24), installmentMinor: P(450_000), installmentsLeft: 24 };
  const a = advise([moto, car], P(500_000));
  assert.deepEqual(a.order.map(o => [o.debt.name, o.months]), [['Moto', 18]]);
  assert.deepEqual(a.apart.map(o => o.debt.name), ['Carro']);
});

test('nothing free: nothing is "pay first", everything is apart', () => {
  const a = advise([phone, car], 0);
  assert.equal(a.order.length, 0);
  assert.equal(a.apart.length, 2);
});

test('the same rate: the smaller first', () => {
  const small = { ...phone, id: 9, name: 'Pequeña', balanceMinor: P(500_000) };
  const a = advise([phone, small], P(2_000_000));
  assert.deepEqual(a.order.map(o => o.debt.name), ['Pequeña', 'Celular']);
});

test('a debt with no rate cannot be weighed, and says so', () => {
  const a = advise([{ ...visa, rateScaled: null, rateFrom: null }, phone], P(950_000));
  assert.deepEqual(a.unknown.map(d => d.name), ['Tarjeta Visa']);
  assert.deepEqual(a.order.map(o => o.debt.name), ['Celular']);
});

test('reach is at most 24 months, counting the money free today', () => {
  assert.equal(REACH_MONTHS, 24);
  assert.equal(monthsToFinish(P(12_000_000), P(1_000_000)), 12);
  assert.equal(monthsToFinish(P(12_000_001), P(1_000_000)), 13);
  assert.equal(monthsToFinish(P(1), 0), Infinity);
  assert.equal(monthsToFinish(P(2_000_000), 0, P(2_000_000)), 0);
  assert.equal(monthsToFinish(P(5_000_000), P(1_000_000), P(2_000_000)), 3);
});

test('money free today pays a debt now, even with nothing left over each month', () => {
  const a = advise([phone, car], 0, P(2_000_000));
  assert.deepEqual(a.order.map(o => [o.debt.name, o.months]), [['Celular', 0]]);
  assert.deepEqual(a.apart.map(o => o.debt.name), ['Carro']);
});

test('interest this month at the rate', () => {
  // 28.5 % E.A. is about 2.11 % a month: 2.4 M -> about 50.600.
  const i = interestThisMonth(visa);
  assert.ok(i > P(50_000) && i < P(51_000), String(i));
});

test('paying more: the extra goes to the first, a finished installment joins it, the total saved adds up', () => {
  const plan = payMore([phone, car], P(500_000));
  const [p, c] = plan.results;
  assert.ok(p.monthsAfter < p.monthsBefore, 'the phone ends sooner');
  assert.ok(c.monthsAfter < c.monthsBefore, 'the car ends sooner');
  assert.ok(p.monthsAfter <= 3, `phone ends in ${p.monthsAfter}`);
  const saved = plan.results.reduce((s, r) => s + r.interestBeforeMinor - r.interestAfterMinor, 0);
  assert.equal(plan.savedMinor, saved);
  assert.ok(plan.savedMinor > 0);
});

test('nothing extra: the first is unchanged, and only its freed installment helps the next', () => {
  const plan = payMore([phone, car], 0);
  assert.equal(plan.results[0].monthsAfter, plan.results[0].monthsBefore);
  assert.equal(plan.results[0].interestAfterMinor, plan.results[0].interestBeforeMinor);
  assert.ok(plan.results[1].monthsAfter <= plan.results[1].monthsBefore);
  const alone = payMore([phone], 0);
  assert.equal(alone.savedMinor, 0);
});

test('an installment that does not cover the interest never ends, and says so', () => {
  const plan = payMore([{ ...car, installmentMinor: P(100_000) }], 0);
  assert.equal(plan.results[0].endless, true);
});

test('months after today', () => {
  assert.equal(monthAfter('2026-10-19', 3), '2027-01');
  assert.equal(monthAfter('2026-12-01', 1), '2027-01');
});

test('the legal maximum of the latest month known', () => {
  assert.deepEqual(usuryOn('2026-09-10'), { rateScaled: EA(29.24), month: '2026-09' });
  assert.equal(usuryOn('2026-10-19').month, '2026-09');
  assert.equal(usuryOn('2026-08-01').month, '2026-08');
});
