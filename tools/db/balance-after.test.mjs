// The new balance said under each end of the movement form
// (core/yields/balance-after.ts): which figure moves by "¿Qué cambia?".
// Invented figures.
//
//   node --import ./tools/db/register-ts.mjs --test tools/db/balance-after.test.mjs

import test from 'node:test';
import assert from 'node:assert/strict';

import { balanceAfter } from '../../src/app/core/yields/balance-after.ts';

const base = { accountMinor: 500_000_00, productMinor: 120_000_00 };

test('an account without products: its balance', () => {
  assert.deepEqual(balanceAfter({ scope: 'both', split: false, accountMinor: 80_000_00, productMinor: null, changeMinor: -30_000_00 }),
    { of: 'account', minor: 50_000_00 });
});

test('product and net worth on a split account: the product chosen', () => {
  assert.deepEqual(balanceAfter({ ...base, scope: 'both', split: true, changeMinor: -20_000_00 }),
    { of: 'product', minor: 100_000_00 });
});

test('product and net worth on an account with one product: the account', () => {
  assert.deepEqual(balanceAfter({ ...base, scope: 'both', split: false, changeMinor: 10_000_00 }),
    { of: 'account', minor: 510_000_00 });
});

test('only the product: the product moves, even unsplit', () => {
  assert.deepEqual(balanceAfter({ ...base, scope: 'product', split: false, changeMinor: 5_000_00 }),
    { of: 'product', minor: 125_000_00 });
  assert.equal(balanceAfter({ accountMinor: 1, productMinor: null, scope: 'product', split: false, changeMinor: 1 }), null);
});

test('only net worth: the account moves, never the product', () => {
  assert.deepEqual(balanceAfter({ ...base, scope: 'netWorth', split: true, changeMinor: 7_000_00 }),
    { of: 'account', minor: 507_000_00 });
});

test('it may go below zero, and says so', () => {
  assert.deepEqual(balanceAfter({ ...base, scope: 'both', split: true, changeMinor: -150_000_00 }),
    { of: 'product', minor: -30_000_00 });
});
