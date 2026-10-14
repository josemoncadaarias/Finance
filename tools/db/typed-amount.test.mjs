// Money fields regroup what is typed, and what they show reads back exactly.
//
//   node --import ./tools/db/register-ts.mjs --test tools/db/typed-amount.test.mjs

import test from 'node:test';
import assert from 'node:assert/strict';

import { groupTypedAmount, typedAmountOf } from '../../src/app/core/database/typed-amount.ts';
import { parseTypedAmountToMinor } from '../../src/app/core/database/money.ts';

test('digits are grouped by thousands as they are typed', () => {
  assert.equal(groupTypedAmount('6'), '6');
  assert.equal(groupTypedAmount('6000'), '6.000');
  assert.equal(groupTypedAmount('6.0000'), '60.000', 'the next digit regroups what was there');
  assert.equal(groupTypedAmount('6000000'), '6.000.000');
  assert.equal(groupTypedAmount('00012'), '12');
  assert.equal(groupTypedAmount(''), '');
});

test('a comma starts the cents, and only two fit', () => {
  assert.equal(groupTypedAmount('6.000,'), '6.000,');
  assert.equal(groupTypedAmount('6.000,5'), '6.000,5');
  assert.equal(groupTypedAmount('6.000,507'), '6.000,50');
  assert.equal(groupTypedAmount(',5'), '0,5');
});

test('a dot just typed at the end starts the cents too', () => {
  assert.equal(groupTypedAmount('1.500.'), '1.500,');
  assert.equal(groupTypedAmount('12.'), '12,');
});

test('letters and signs are dropped; a minus is kept only where allowed', () => {
  assert.equal(groupTypedAmount('$ 1a2b3'), '123');
  assert.equal(groupTypedAmount('-1500'), '1.500');
  assert.equal(groupTypedAmount('-1500', { allowNegative: true }), '-1.500');
});

test('what a field shows reads back as the same amount', () => {
  for (const minor of [0, 5, 100, 150_000, 600_000_000, 600_000_050, 1_234_567_89]) {
    assert.equal(parseTypedAmountToMinor(typedAmountOf(minor)), minor, `round trip of ${minor}`);
    assert.equal(parseTypedAmountToMinor(groupTypedAmount(typedAmountOf(minor))), minor);
  }
  assert.equal(typedAmountOf(600_000_000), '6.000.000');
  assert.equal(typedAmountOf(600_000_050), '6.000.000,50');
});

test('the cursor stays where the digit was typed after regrouping', async () => {
  const { caretAfterRegroup, groupTypedAmount } = await import('../../src/app/core/database/typed-amount.ts');
  // "3.800.000", a 5 typed after the 3: "35.800.000" -> "35.800.000", cursor after the 5.
  const typed = '35.800.000';
  const grouped = groupTypedAmount(typed);
  assert.equal(grouped, '35.800.000');
  assert.equal(caretAfterRegroup(typed, 2, grouped), 2);
  // "380.000" with a 0 typed after the 8: "3800.000" regroups to "3.800.000", cursor after that 0.
  assert.equal(groupTypedAmount('3800.000'), '3.800.000');
  assert.equal(caretAfterRegroup('3800.000', 3, '3.800.000'), 4);
  // A full stop at the end becomes the comma, and the cursor follows it.
  assert.equal(groupTypedAmount('3.800.'), '3.800,');
  assert.equal(caretAfterRegroup('3.800.', 6, '3.800,'), 6);
  // Pasted thousands stay pesos.
  assert.equal(groupTypedAmount('3.800.000'), '3.800.000');
});
