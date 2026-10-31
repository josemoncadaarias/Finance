// A big purchase weighed against part of the savings (Jose, 2026-10-31,
// mockups 52a-52g). Figures invented, the same as the mockups.
//
//   node --import ./tools/db/register-ts.mjs --test tools/db/big-purchase.test.mjs

import test from 'node:test';
import assert from 'node:assert/strict';

import { bigRoom, weighBig } from '../../src/app/core/assistant/big-purchase.ts';

const P = pesos => Math.round(pesos * 100);
const base = {
  inAccountsMinor: P(300_000_000), inGoalsMinor: P(85_000_000), paymentsMinor: P(2_000_000),
  monthlySpendMinor: P(14_000_000), emergencyKeptMinor: P(85_000_000), goalsLackMinor: P(500_000_000),
};

test('an emergency fund that covers 6 months leaves no cushion; half of the rest goes to the goals (52c)', () => {
  const r = bigRoom(base);
  assert.equal(r.cushionMinor, 0);
  assert.equal(r.forGoalsMinor, P(106_500_000));
  assert.equal(r.roomMinor, P(106_500_000));
});

test('with no emergency fund, 6 months of spending are set aside first (52d)', () => {
  const r = bigRoom({ ...base, inGoalsMinor: 0, emergencyKeptMinor: 0, monthlySpendMinor: P(14_200_000) });
  assert.equal(r.cushionMinor, P(85_200_000));
  assert.equal(r.forGoalsMinor, P(106_400_000));
  assert.equal(r.roomMinor, P(106_400_000));
});

test('a fund that covers only part of the cushion: the rest is set aside here', () => {
  const r = bigRoom({ ...base, inGoalsMinor: P(30_000_000), emergencyKeptMinor: P(30_000_000) });
  assert.equal(r.cushionMinor, P(54_000_000));
});

test('the goals never take more than what they lack', () => {
  const r = bigRoom({ ...base, goalsLackMinor: P(10_000_000) });
  assert.equal(r.forGoalsMinor, P(10_000_000));
  assert.equal(r.roomMinor, P(203_000_000));
});

test('with nothing left after the cushion, nothing can go to a big purchase', () => {
  const r = bigRoom({ ...base, inAccountsMinor: P(20_000_000), inGoalsMinor: 0, emergencyKeptMinor: 0 });
  assert.equal(r.cushionMinor, P(18_000_000));
  assert.equal(r.roomMinor, 0);
});

test('the three answers (52b, 52e, 52f)', () => {
  const room = P(106_500_000);
  const trip = weighBig(room, P(8_000_000));
  assert.equal(trip.verdict, 'yes');
  assert.equal(trip.afterMinor, P(98_500_000));
  const car = weighBig(room, P(90_000_000));
  assert.equal(car.verdict, 'most');
  assert.equal(car.pct, 85);
  assert.equal(car.afterMinor, P(16_500_000));
  const flat = weighBig(room, P(230_000_000));
  assert.equal(flat.verdict, 'no');
  assert.equal(flat.shortMinor, P(123_500_000));
});

test('exactly 70 % is still a plain yes', () => {
  assert.equal(weighBig(P(100), P(70)).verdict, 'yes');
  assert.equal(weighBig(P(100), P(71)).verdict, 'most');
});
