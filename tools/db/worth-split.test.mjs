// Net worth as what you have and what you owe (core/worth/worth-split.ts).
//
//   node --import ./tools/db/register-ts.mjs --test tools/db/worth-split.test.mjs

import test from 'node:test';
import assert from 'node:assert/strict';

import { splitWorth } from '../../src/app/core/worth/worth-split.ts';

const kinds = { 1: 'other', 2: 'other', 3: 'card', 4: 'loan', 5: 'other', 6: 'other', 7: 'card' };
const kindOf = id => kinds[id];

test('the two sides add up to net worth, and say what each holds', () => {
  const lines = [
    { account_id: 1, baseMinor: 5_524_054_690 },
    { account_id: 2, baseMinor: 443_030_000 },
    { account_id: 3, baseMinor: -412_710_000 },
    { account_id: 4, baseMinor: -1_001_000_000 },
    { account_id: 5, baseMinor: -5_000 },     // an account overdrawn
    { account_id: 6, baseMinor: null },       // no rate: out, as of the total
    { account_id: 7, baseMinor: 0 },          // a card owing nothing
  ];
  const s = splitWorth(lines, kindOf);
  const total = lines.reduce((sum, l) => sum + (l.baseMinor ?? 0), 0);
  assert.equal(s.haveMinor - s.oweMinor, total);
  assert.equal(s.haveMinor, 5_967_084_690);
  assert.equal(s.oweMinor, 1_413_715_000);
  assert.deepEqual([s.haveCount, s.cards, s.loans, s.others], [2, 1, 1, 1]);
  assert.deepEqual(s.owe.map(l => l.account_id), [3, 4, 5]);
});

test('owing more than there is: net worth below zero', () => {
  const s = splitWorth([{ account_id: 1, baseMinor: 148_087_413 }, { account_id: 3, baseMinor: -380_000_000 }], kindOf);
  assert.equal(s.haveMinor - s.oweMinor, -231_912_587);
});

test('nothing owed', () => {
  const s = splitWorth([{ account_id: 1, baseMinor: 100 }], kindOf);
  assert.deepEqual([s.oweMinor, s.cards, s.loans, s.others, s.owe.length], [0, 0, 0, 0, 0]);
});
