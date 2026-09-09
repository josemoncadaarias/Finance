// Tests for the keypad's arithmetic.
//
//   node --import ./tools/db/register-ts.mjs --test tools/db/calculator.test.mjs
//
// Money, so the rounding is the point rather than an afterthought.

import test from 'node:test';
import assert from 'node:assert/strict';

import { apply, isOperator, operatorFromKey } from '../../src/app/features/entry/calculator.ts';

test('adding and subtracting are exact', () => {
  // 45.000 + 12.500 = 57.500, in cents throughout.
  assert.equal(apply(4500000, '+', 1250000), 5750000);
  assert.equal(apply(5750000, '-', 1250000), 4500000);

  // The cents that float arithmetic would lose.
  assert.equal(apply(1, '+', 2), 3);
  assert.equal(apply(942128, '+', 1), 942129);
});

test('times takes a count, not an amount', () => {
  // 50.000 × 3 is three times fifty thousand, not fifty thousand times
  // three thousand pesos.
  assert.equal(apply(5000000, '×', 300), 15000000);

  // And a fractional count works: half of it again.
  assert.equal(apply(5000000, '×', 250), 12500000);
});

test('dividing splits a bill, rounding to the cent', () => {
  // A 100.000 bill three ways: 33.333,33 each, and two cents unaccounted for.
  assert.equal(apply(10000000, '÷', 300), 3333333);

  // Halves are exact.
  assert.equal(apply(10000000, '÷', 200), 5000000);

  // Dividing by nothing is a slip, not an intention: keep what was there
  // rather than producing Infinity and wiping the amount.
  assert.equal(apply(10000000, '÷', 0), 10000000);
});

test('rounding goes to the nearest cent, never truncating away money', () => {
  // 10 divided by 3 is 3,33; 20 divided by 3 is 6,67, not 6,66.
  assert.equal(apply(1000, '÷', 300), 333);
  assert.equal(apply(2000, '÷', 300), 667);
});

test('a subtraction can go negative, and the screen decides what that means', () => {
  // The calculator does the arithmetic; refusing a negative is the screen's
  // job, since the sign of a movement comes from the button pressed.
  assert.equal(apply(1000, '-', 3000), -2000);
});

test('the physical keyboard speaks the same four operators', () => {
  assert.equal(operatorFromKey('+'), '+');
  assert.equal(operatorFromKey('-'), '-');
  assert.equal(operatorFromKey('*'), '×');
  assert.equal(operatorFromKey('x'), '×');
  assert.equal(operatorFromKey('/'), '÷');
  assert.equal(operatorFromKey('a'), null);
  assert.equal(operatorFromKey('Enter'), null);

  assert.equal(isOperator('×'), true);
  assert.equal(isOperator('='), false);
});
