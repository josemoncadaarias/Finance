// The eye that hides every amount (Jose, 2026-10-14, mockups 28).
//
//   node --import ./tools/db/register-ts.mjs --test tools/db/hidden-amounts.test.mjs
//
// It works where an amount becomes text, so every screen follows it; a file
// written while it is on still carries the real figures.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  formatMoney, hideAmountsWhen, amountsHidden, withAmountsShown, HIDDEN_AMOUNT,
} from '../../src/app/core/database/money.ts';

test('an amount reads as dots while hidden, and as itself otherwise', async () => {
  let hidden = false;
  hideAmountsWhen(() => hidden);
  assert.equal(formatMoney(1_234_567, 'COP', { withSymbol: false }), '12.345,67');
  hidden = true;
  assert.ok(amountsHidden());
  assert.equal(formatMoney(1_234_567, 'COP', { withSymbol: false }), HIDDEN_AMOUNT);
  assert.equal(formatMoney(1_234_567, 'COP', { withSymbol: false, shown: true }), '12.345,67', 'a typed box is never hidden');
  hideAmountsWhen(() => false);
});

test('a file written while hidden carries the real figures', async () => {
  hideAmountsWhen(() => true);
  const inside = await withAmountsShown(() => formatMoney(500_00, 'COP', { withSymbol: false }));
  assert.equal(inside, '500,00');
  assert.equal(formatMoney(500_00, 'COP', { withSymbol: false }), HIDDEN_AMOUNT, 'and hidden again after');
  hideAmountsWhen(() => false);
});
