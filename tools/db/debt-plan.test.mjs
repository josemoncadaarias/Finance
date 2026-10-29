// "Salir de tus deudas" (48a-48l): the plan for several debts, on invented debts.
//
//   node --import ./tools/db/register-ts.mjs --test tools/db/debt-plan.test.mjs

import test from 'node:test';
import assert from 'node:assert/strict';

import { planDebts, estimatedCardPayment, suggestedExtra, extrasToOffer, APART_MONTHS } from '../../src/app/core/debts/debt-plan.ts';

const M = pesos => pesos * 100;
const debt = (kind, id, name, balance, ea, payment, installmentsLeft = 0) => ({
  kind, id, name, balanceMinor: M(balance), rateScaled: Math.round(ea * 1_000_000), rateFrom: 'typed',
  paymentMinor: M(payment), paymentFrom: kind === 'loan' ? 'installment' : 'usual', installmentsLeft,
});
const coral = debt('card', 1, 'Tarjeta Coral', 4_200_000, 0.285, 220_000);
const libre = debt('loan', 2, 'Libre inversión', 18_000_000, 0.22, 690_000, 36);
const carro = debt('loan', 3, 'Carro', 42_000_000, 0.165, 1_180_000, 48);
const estudio = debt('loan', 4, 'Estudio', 2_500_000, 0.12, 150_000, 18);
const four = [carro, estudio, coral, libre];

test('the highest rate first: each debt ends when the one before frees its payment', () => {
  const plan = planDebts(four, M(300_000), 'rate');
  assert.deepEqual(plan.steps.map(s => s.debt.name), ['Tarjeta Coral', 'Libre inversión', 'Carro', 'Estudio']);
  assert.deepEqual(plan.steps.map(s => s.months), [9, 22, 33, 19]);
  assert.equal(plan.months, 33);
  assert.ok(plan.savedMinor > 0 && plan.soonerMonths > 0);
  assert.equal(plan.endless, false);
});

test('the smallest first closes one sooner, and costs more interest', () => {
  const rate = planDebts(four, M(300_000), 'rate');
  const balance = planDebts(four, M(300_000), 'balance');
  assert.equal(balance.steps[0].debt.name, 'Estudio');
  assert.equal(balance.steps[0].months, 6);
  assert.ok(balance.steps[0].months < rate.steps[0].months);
  assert.ok(balance.interestMinor > rate.interestMinor);
});

test('the extra is compared with the same plan putting nothing in', () => {
  const none = planDebts(four, 0, 'rate');
  const some = planDebts(four, M(300_000), 'rate');
  assert.equal(none.savedMinor, 0);
  assert.equal(some.baseMonths, none.months);
  assert.equal(some.baseInterestMinor, none.interestMinor);
  assert.equal(some.savedMinor, none.interestMinor - some.interestMinor);
  assert.equal(some.soonerMonths, none.months - some.months);
});

test('more each month, out sooner', () => {
  const months = [0, 100_000, 300_000, 500_000, 1_000_000].map(x => planDebts(four, M(x), 'rate').months);
  for (let i = 1; i < months.length; i++) assert.ok(months[i] <= months[i - 1]);
});

test('a mortgage with many years left is kept apart and takes nothing', () => {
  const casa = debt('loan', 5, 'Vivienda', 180_000_000, 0.129, 2_100_000, APART_MONTHS + 60);
  const plan = planDebts([...four, casa], M(300_000), 'rate');
  assert.deepEqual(plan.apart.map(d => d.name), ['Vivienda']);
  assert.equal(plan.steps.length, 4);
  assert.equal(plan.months, 33);
});

test('a card whose payment does not cover its interest never ends alone; the plan says so', () => {
  const tiny = { ...coral, paymentMinor: M(50_000) };
  const plan = planDebts([tiny], 0, 'rate');
  assert.equal(plan.baseEndless, true);
  assert.equal(plan.endless, true);
  assert.equal(plan.savedMinor, 0);
  const helped = planDebts([tiny], M(300_000), 'rate');
  assert.equal(helped.endless, false);
});

test('estimates and suggestions are round and sensible', () => {
  const est = estimatedCardPayment(M(2_400_000), 285_000);
  assert.ok(est > M(100_000) && est < M(160_000));
  assert.equal(suggestedExtra(M(640_000)), M(300_000));
  assert.equal(suggestedExtra(0), 0);
  assert.deepEqual(extrasToOffer(M(640_000)), [M(100_000), M(300_000), M(500_000), M(1_000_000)]);
});
