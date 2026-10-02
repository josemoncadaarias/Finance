// Tests for the amount keypad's buffer.
//
//   node --import ./tools/db/register-ts.mjs --test tools/db/amount-buffer.test.mjs

import test from 'node:test';
import assert from 'node:assert/strict';

import { AmountBuffer } from '../../src/app/features/entry/amount-buffer.ts';

const type = (keys) => {
  const buffer = new AmountBuffer();
  for (const key of keys) {
    if (key === ',') buffer.separator();
    else if (key === '<') buffer.backspace();
    else buffer.push(key);
  }
  return buffer;
};

test('digits are pesos until a separator is pressed', () => {
  // 50200 is fifty thousand two hundred pesos, not five hundred and two.
  assert.equal(type('50200').minor, 5020000);
  assert.equal(type('50200').text, '50.200', 'grouped for reading');
  assert.equal(type('50200').raw, '50200');
  assert.equal(type('1').minor, 100);
});

test('the separator starts the cents, and only two fit', () => {
  assert.equal(type('50200,5').minor, 5020050);
  assert.equal(type('50200,50').minor, 5020050);
  assert.equal(type('50200,509').minor, 5020050, 'a third decimal is ignored');
  assert.equal(type('50200,09').minor, 5020009);
  assert.equal(type('50200,09').text, '50.200,09');
});

test('pressing the separator twice changes nothing', () => {
  assert.equal(type('12,,34').minor, 1234);
});

test('a leading separator means less than a peso', () => {
  assert.equal(type(',50').minor, 50);
  assert.equal(type(',50').text, '0,50');
});

test('leading zeros are dropped', () => {
  assert.equal(type('0005').minor, 500);
  assert.equal(type('0').text, '0');
});

test('backspace walks back out of the cents', () => {
  const buffer = type('123,45');
  assert.equal(buffer.minor, 12345);

  buffer.backspace();
  assert.equal(buffer.text, '123,4');
  buffer.backspace();
  assert.equal(buffer.text, '123,');
  buffer.backspace();
  assert.equal(buffer.text, '123', 'back on the pesos side');
  buffer.backspace();
  assert.equal(buffer.minor, 1200);
});

test('an empty buffer is zero, not an error', () => {
  const buffer = new AmountBuffer();
  assert.equal(buffer.isEmpty, true);
  assert.equal(buffer.minor, 0);
  assert.equal(buffer.text, '');

  buffer.backspace();
  assert.equal(buffer.minor, 0, 'backspacing past the start is harmless');
});

test('clear empties it', () => {
  const buffer = type('123,45');
  buffer.clear();
  assert.equal(buffer.isEmpty, true);
  assert.equal(buffer.minor, 0);
});

test('an existing amount loads back for editing', () => {
  // Round-trips the real figures from Jose's data.
  for (const minor of [5020000, 942128, 130000, 12345, 100, 6675076794]) {
    assert.equal(AmountBuffer.from(minor).minor, minor);
  }
  // A whole amount shows no cents; the sign never survives, since which way it
  // goes is the button pressed, not the number typed.
  assert.equal(AmountBuffer.from(5020000).text, '50.200');
  assert.equal(AmountBuffer.from(-5020000).minor, 5020000);
  assert.equal(AmountBuffer.from(5020009).text, '50.200,09');
});

test('a very long number stops growing instead of overflowing', () => {
  const buffer = type('1'.repeat(20));
  assert.ok(Number.isSafeInteger(buffer.minor));
});

test('long amounts are grouped, and grouping never reaches the value', () => {
  // The figure that made this worth doing: a card payment, read at a glance.
  const buffer = type('975894,47');
  assert.equal(buffer.text, '975.894,47');
  assert.equal(buffer.minor, 97589447);

  assert.equal(type('1234567').text, '1.234.567');
  assert.equal(type('1234567').minor, 123456700);

  // Below a thousand nothing is grouped.
  assert.equal(type('999').text, '999');
  assert.equal(type('1000').text, '1.000');
});

// The phone's own keyboard types into a field showing the buffer's text
// (Jose, 2026-10-02: the app's keypad is gone).
import { typedInto } from '../../src/app/features/entry/amount-buffer.ts';

const keyboard = (steps) => {
  let buffer = new AmountBuffer();
  for (const step of steps) buffer = typedInto(buffer, typeof step === 'function' ? step(buffer.text) : step);
  return buffer;
};
const add = (chars) => (shown) => shown + chars;
const drop = (n) => (shown) => shown.slice(0, shown.length - n);

test('the keyboard: digits typed one by one are grouped as they come', () => {
  const b = keyboard([add('4'), add('5'), add('9'), add('0'), add('0')]);
  assert.equal(b.text, '45.900');
  assert.equal(b.minor, 4590000);
});

test('the keyboard: a comma or a full stop starts the cents, whichever the phone offers', () => {
  assert.equal(keyboard([add('45'), add(','), add('5')]).minor, 4550);
  assert.equal(keyboard([add('45'), add('.'), add('50')]).minor, 4550);
  assert.equal(keyboard([add('45'), add('.'), add('.'), add('5')]).minor, 4550, 'a second one does nothing');
  assert.equal(keyboard([add('1'), add(','), add('999')]).minor, 199, 'only two cents fit');
});

test('the keyboard: erasing from the end erases digits, grouping dots and all', () => {
  assert.equal(keyboard([add('45900'), drop(1)]).text, '4.590');
  assert.equal(keyboard([add('1234'), drop(1)]).text, '123', '1.234 less its last digit');
  assert.equal(keyboard([add('45'), add(','), add('5'), drop(1), drop(1)]).text, '45');
  assert.equal(keyboard([add('45900'), () => '']).isEmpty, true);
});

test('the keyboard: anything else is read afresh', () => {
  assert.equal(keyboard([add('45900'), '7']).minor, 700, 'all selected and typed over');
  assert.equal(keyboard(['1.234.567,89']).minor, 123456789, 'pasted, Colombian');
  assert.equal(keyboard(['$ 1234.5']).minor, 123450, 'pasted with a point for the cents');
  assert.equal(keyboard(['abc']).isEmpty, true);
});
