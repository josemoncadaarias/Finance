// A loan's schedule (core/loans/schedule.ts), against the invented loan of
// the mockups, whose figures were worked out on their own before any of this
// code existed: 60,000,000 at 16.5% E.A., 60 monthly installments from
// 10 Nov 2024, 42,000 of insurance each, 23 paid by 1 Oct 2026.
//
//   node --import ./tools/db/register-ts.mjs --test tools/db/loan-schedule.test.mjs

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  loanSchedule, payoffToday, dueDate, dueBy, eaFromMonthly, monthlyFromEa, firstInstallment, theoreticalBalance,
} from '../../src/app/core/loans/schedule.ts';

const CAR = {
  principalMinor: 60_000_000_00, system: 'fixed_installment', installments: 60, periodMonths: 1,
  disbursedOn: '2024-10-10', firstDueOn: '2024-11-10', insuranceKind: 'fixed', insuranceMinor: 42_000_00,
  insuranceRateScaled: 0, bankInstallmentMinor: null, paidBefore: 23, balanceAfterBeforeMinor: null,
  rates: [{ validFrom: '2024-10-10', annualRateScaled: 165_000 }],
};
const TODAY = '2026-10-01';
const pesos = minor => Math.round(minor / 100);
const installment = (number, paidOn, capital, interest) => ({
  kind: 'installment', number, paidOn, capitalMinor: capital, interestMinor: interest,
  insuranceMinor: 42_000_00, lateMinor: 0, extraMode: null,
});

test('the installment and the balance after 23 of them', () => {
  assert.equal(firstInstallment(CAR).paymentMinor, 1_439_065_96);
  assert.equal(theoreticalBalance(CAR, 23), 42_195_732_51);
  assert.equal(dueBy(CAR, TODAY), 23, 'the 23rd fell on 10 Sep 2026');
});

test('what is left, as the mockups say it', () => {
  const s = loanSchedule(CAR, [], TODAY);
  assert.equal(s.balanceMinor, 42_195_732_51);
  assert.equal(s.paidCount, 23);
  assert.equal(s.totalCount, 60);
  assert.equal(s.next.number, 24);
  assert.equal(s.next.dueOn, '2026-10-10');
  assert.equal(s.next.interestMinor, 540_446_62);
  assert.equal(s.next.capitalMinor, 898_619_34);
  assert.equal(s.next.totalMinor, 1_481_065_96);
  assert.equal(pesos(s.interestLeftMinor), 11_049_708);
  assert.equal(s.lastDueOn, '2029-10-10');
  assert.equal(pesos(s.interestPaidMinor), 15_294_250);
  assert.equal(pesos(s.capitalPaidMinor), 17_804_267);
  assert.equal(pesos(s.interestTotalMinor), 26_343_958);
  assert.equal(pesos(s.toPayMinor), 54_799_441);
});

test('5,000,000 ahead with installment 24, shortening the term', () => {
  const s = loanSchedule(CAR, [], TODAY, { amountMinor: 5_000_000_00, mode: 'term', every: 'once' });
  assert.equal(s.totalCount, 55);
  assert.equal(s.lastDueOn, '2029-05-10');
  assert.equal(pesos(s.interestLeftMinor), 8_362_859);
  assert.equal(pesos(s.toPayMinor), 51_902_592);
});

test('the same, lowering the installment instead', () => {
  const s = loanSchedule(CAR, [], TODAY, { amountMinor: 5_000_000_00, mode: 'installment', every: 'once' });
  assert.equal(s.totalCount, 60);
  assert.equal(pesos(s.interestLeftMinor), 9_777_312);
  assert.equal(pesos(s.toPayMinor), 53_527_044);
  const after = s.rows.filter(r => r.type === 'installment' && r.number === 25)[0];
  assert.equal(after.capitalMinor + after.interestMinor, 1_264_832_73);
});

test('in the primas, and every month', () => {
  const primas = loanSchedule(CAR, [], TODAY, { amountMinor: 1_000_000_00, mode: 'term', every: 'primas' });
  assert.equal(primas.lastDueOn, '2029-06-10');
  assert.equal(pesos(primas.interestLeftMinor), 9_546_065);
  const monthly = loanSchedule(CAR, [], TODAY, { amountMinor: 200_000_00, mode: 'term', every: 'monthly' });
  assert.equal(monthly.lastDueOn, '2029-05-10');
  assert.equal(pesos(monthly.interestLeftMinor), 9_331_731);
});

test('paying installment 24 and 5,000,000 ahead, recorded', () => {
  const paid = [
    installment(24, '2026-10-10', 898_619_34, 540_446_62),
    { kind: 'extra', number: null, paidOn: '2026-10-10', capitalMinor: 5_000_000_00, interestMinor: 0, insuranceMinor: 0, lateMinor: 0, extraMode: 'term' },
  ];
  const s = loanSchedule(CAR, paid, '2026-10-11');
  assert.equal(s.paidCount, 24);
  assert.equal(s.balanceMinor, 36_297_113_17);
  assert.equal(s.next.number, 25);
  assert.equal(s.next.interestMinor, 464_896_59);
  assert.equal(s.next.capitalMinor, 974_169_37);
  assert.equal(s.lastDueOn, '2029-05-10');
  const extra = s.rows.find(r => r.type === 'extra');
  assert.equal(extra.balanceAfterMinor, 36_297_113_17);
});

test('the bank charged other figures: the schedule goes on from what was paid', () => {
  const s = loanSchedule(CAR, [installment(24, '2026-10-10', 898_620_00, 544_380_00)], '2026-10-11');
  assert.equal(s.balanceMinor, 42_195_732_51 - 898_620_00);
  assert.equal(s.interestPaidMinor > loanSchedule(CAR, [], TODAY).interestPaidMinor, true);
});

test('an installment not paid by its day is overdue', () => {
  const s = loanSchedule(CAR, [], '2026-10-12');
  assert.equal(s.overdue.length, 1);
  assert.equal(s.overdue[0].number, 24);
  assert.equal(s.next.number, 24, 'the overdue one is the one to pay');
});

test('paying it all today', () => {
  const p = payoffToday(CAR, [], TODAY);
  assert.equal(p.sinceOn, '2026-09-10');
  assert.equal(pesos(p.interestMinor), 377_590);
  assert.equal(pesos(p.totalMinor), 42_573_322);
  const paidOff = loanSchedule(CAR, [{ kind: 'payoff', number: null, paidOn: TODAY, capitalMinor: p.balanceMinor, interestMinor: p.interestMinor, insuranceMinor: 0, lateMinor: 0, extraMode: null }], TODAY);
  assert.equal(paidOff.done, true);
  assert.equal(paidOff.balanceMinor, 0);
  assert.equal(paidOff.next, null);
});

test('the balance the person stated wins over the worked-out one', () => {
  const s = loanSchedule({ ...CAR, balanceAfterBeforeMinor: 42_000_000_00 }, [], TODAY);
  assert.equal(s.balanceMinor, 42_000_000_00);
  assert.equal(s.next.interestMinor, Math.round(42_000_000_00 * (Math.pow(1.165, 1 / 12) - 1)));
});

test('the bank\'s installment, insurance included, drives the schedule', () => {
  const s = loanSchedule({ ...CAR, paidBefore: 0, bankInstallmentMinor: 1_481_066_00 }, [], '2024-10-11');
  assert.equal(s.next.capitalMinor + s.next.interestMinor, 1_439_066_00);
});

test('constant capital: the same capital, the installment falls', () => {
  const t = { ...CAR, system: 'constant_capital', paidBefore: 0, principalMinor: 12_000_000_00, installments: 12, insuranceMinor: 0 };
  const s = loanSchedule(t, [], '2024-10-11');
  const rows = s.rows.filter(r => r.type === 'installment');
  assert.equal(rows.length, 12);
  assert.ok(rows.every(r => r.capitalMinor === 1_000_000_00));
  assert.ok(rows[0].totalMinor > rows[11].totalMinor);
  assert.equal(rows[11].balanceAfterMinor, 0);
});

test('a variable rate: the installment is worked out again from the new rate', () => {
  const t = { ...CAR, paidBefore: 0, rates: [...CAR.rates, { validFrom: '2025-04-10', annualRateScaled: 200_000 }] };
  const s = loanSchedule(t, [], '2024-10-11');
  const rows = s.rows.filter(r => r.type === 'installment');
  assert.equal(rows.length, 60);
  assert.notEqual(rows[5].capitalMinor + rows[5].interestMinor, rows[6].capitalMinor + rows[6].interestMinor);
  assert.equal(rows.at(-1).balanceAfterMinor, 0);
});

test('insurance as a share of the balance falls with it', () => {
  const t = { ...CAR, paidBefore: 0, insuranceKind: 'balance', insuranceMinor: 0, insuranceRateScaled: 500 };
  const rows = loanSchedule(t, [], '2024-10-11').rows.filter(r => r.type === 'installment');
  assert.equal(rows[0].insuranceMinor, 30_000_00);
  assert.ok(rows[30].insuranceMinor < rows[0].insuranceMinor);
});

test('dates and rates', () => {
  assert.equal(dueDate('2025-01-31', 1, 2), '2025-02-28');
  assert.equal(dueDate('2025-01-31', 1, 3), '2025-03-31');
  assert.equal(dueDate('2025-01-15', 3, 2), '2025-04-15');
  assert.equal(monthlyFromEa(165_000), 12_808);
  assert.equal(Math.abs(eaFromMonthly(12_808) - 165_000) < 5, true);
});

// A payment ahead made between two installments (Jose's reference package,
// 2026-10-01, sheet Abono_mitad_mes - simulated, built on the
// Superfinanciera's rule that a partial prepayment is liquidated to its day):
// 100,000,000 owed after the installment of 10 Sep 2026 at 18% E.A., 5,000,000
// paid on 25 Sep, next installment 10 Oct. Interest by stretches 1,330,904.08,
// where treating the payment as made on the 10th would give less.
const MIDMONTH = {
  principalMinor: 120_000_000_00, system: 'fixed_installment', installments: 120, periodMonths: 1,
  disbursedOn: '2025-09-10', firstDueOn: '2025-10-10', insuranceKind: 'fixed', insuranceMinor: 0,
  insuranceRateScaled: 0, bankInstallmentMinor: null, paidBefore: 12, balanceAfterBeforeMinor: 100_000_000_00,
  rates: [{ validFrom: '2025-09-10', annualRateScaled: 180_000 }],
};
const ahead = (paidOn, mode = 'term') => ({
  kind: 'extra', number: null, paidOn, capitalMinor: 5_000_000_00, interestMinor: 0,
  insuranceMinor: 0, lateMinor: 0, extraMode: mode,
});

test('a payment ahead between installments: the next interest counts the days on each balance', () => {
  const s = loanSchedule(MIDMONTH, [ahead('2026-09-25')], '2026-09-26');
  assert.equal(s.next.number, 13);
  assert.equal(s.next.dueOn, '2026-10-10');
  assert.equal(s.next.interestMinor, 1_330_904_08);
  assert.equal(s.balanceMinor, 95_000_000_00);
  // The installment after it is back on the whole month, on what is left.
  const after = s.rows.find(r => r.type === 'installment' && r.number === 14);
  assert.equal(after.interestMinor, Math.round(s.next.balanceAfterMinor * (Math.pow(1.18, 1 / 12) - 1)));
});

test('a payment ahead between installments, lowering the installment: the same interest', () => {
  const s = loanSchedule(MIDMONTH, [ahead('2026-09-25', 'installment')], '2026-09-26');
  assert.equal(s.next.interestMinor, 1_330_904_08);
});

test('a payment ahead on an installment\'s own day counts the next period as a whole month', () => {
  const s = loanSchedule(MIDMONTH, [ahead('2026-09-10')], '2026-09-26');
  assert.equal(s.next.interestMinor, Math.round(95_000_000_00 * (Math.pow(1.18, 1 / 12) - 1)));
});

test('paying it all after a payment ahead counts each stretch at its own balance', () => {
  const plain = payoffToday(MIDMONTH, [], '2026-09-25');
  const withAhead = payoffToday(MIDMONTH, [ahead('2026-09-25')], '2026-09-25');
  assert.equal(withAhead.balanceMinor, 95_000_000_00);
  // Up to the 25th the 100 million earned interest whole: the payment ahead
  // does not take back interest already run.
  assert.equal(withAhead.interestMinor, plain.interestMinor);
});
