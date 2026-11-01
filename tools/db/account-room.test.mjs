// "Puedes gastar hoy" for one account (mockups 54a-54h; Jose, 2026-11-01).
// Figures invented, the same as the mockups.
//
//   node --import ./tools/db/register-ts.mjs --test tools/db/account-room.test.mjs

import test from 'node:test';
import assert from 'node:assert/strict';

import { accountRoom } from '../../src/app/core/assistant/account-room.ts';

const P = pesos => Math.round(pesos * 100);
const months = (inP, recP, outP) => ['2026-08', '2026-09', '2026-10'].map(month => ({ month, inMinor: P(inP), receivedMinor: P(recP), outMinor: P(outP) }));
const today = '2026-11-01';

test('a salary account: what comes in, less savings, what left and what is to pay (54b)', () => {
  const r = accountRoom({
    kind: 'money', months: months(9_000_000, 0, 0), savePct: 20,
    thisMonth: { outMinor: P(1_950_000), sentMinor: P(1_000_000) },
    payments: [{ kind: 'fixed', name: 'Arriendo', amountMinor: P(710_000), dueOn: null }],
    holdsMinor: P(6_140_000), keptMinor: 0, today,
  });
  assert.equal(r.mode, 'income');
  assert.equal(r.saveMinor, P(1_800_000));
  assert.equal(r.leftMinor, P(3_540_000));
  assert.equal(r.perDayMinor, P(118_000));
  assert.equal(r.capped, false);
});

test('the savings share is taken from income only, never from transfers received', () => {
  const r = accountRoom({ kind: 'money', months: months(1_000_000, 4_000_000, 0), savePct: 20,
    thisMonth: { outMinor: 0, sentMinor: 0 }, payments: [], holdsMinor: P(50_000_000), keptMinor: 0, today });
  assert.equal(r.saveMinor, P(200_000));
  assert.equal(r.leftMinor, P(4_800_000));
});

test('never more than it holds free today', () => {
  const r = accountRoom({ kind: 'money', months: months(2_000_000, 0, 0), savePct: 0,
    thisMonth: { outMinor: 0, sentMinor: 0 }, payments: [], holdsMinor: P(380_000), keptMinor: 0, today });
  assert.equal(r.capped, true);
  assert.equal(r.leftMinor, P(380_000));
  assert.equal(r.perDayMinor, P(12_600));
});

test('an account fed only by transfers is spent from what it holds, less its goals and payments', () => {
  const r = accountRoom({ kind: 'money', months: months(0, 1_500_000, 0), savePct: 20,
    thisMonth: { outMinor: P(120_000), sentMinor: 0 },
    payments: [{ kind: 'fixed', name: 'Música', amountMinor: P(64_000), dueOn: null }],
    holdsMinor: P(1_380_000), keptMinor: P(300_000), today });
  assert.equal(r.mode, 'balance');
  assert.equal(r.leftMinor, P(1_016_000));
  assert.equal(r.saveMinor, 0);
});

test('a goal never keeps more than the account holds', () => {
  const r = accountRoom({ kind: 'money', months: [], savePct: 20, thisMonth: { outMinor: 0, sentMinor: 0 },
    payments: [], holdsMinor: P(100_000), keptMinor: P(900_000), today });
  assert.equal(r.keptMinor, P(100_000));
  assert.equal(r.leftMinor, 0);
});

test('a card: what is usually spent with it, never past its available credit (54g)', () => {
  const r = accountRoom({ kind: 'card', months: months(0, 0, 1_180_000), savePct: 20,
    thisMonth: { outMinor: P(301_000), sentMinor: 0 }, payments: [], holdsMinor: 0, keptMinor: 0,
    availableMinor: P(5_687_880), today });
  assert.equal(r.leftMinor, P(879_000));
  assert.equal(r.perDayMinor, P(29_300));
  const tight = accountRoom({ kind: 'card', months: months(0, 0, 1_180_000), savePct: 20,
    thisMonth: { outMinor: 0, sentMinor: 0 }, payments: [], holdsMinor: 0, keptMinor: 0, availableMinor: P(200_000), today });
  assert.equal(tight.capped, true);
  assert.equal(tight.leftMinor, P(200_000));
});
