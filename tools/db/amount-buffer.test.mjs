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
  assert.equal(type('50200').text, '50200');
  assert.equal(type('1').minor, 100);
});

test('the separator starts the cents, and only two fit', () => {
  assert.equal(type('50200,5').minor, 5020050);
  assert.equal(type('50200,50').minor, 5020050);
  assert.equal(type('50200,509').minor, 5020050, 'a third decimal is ignored');
  assert.equal(type('50200,09').minor, 5020009);
  assert.equal(type('50200,09').text, '50200,09');
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
  assert.equal(AmountBuffer.from(5020000).text, '50200');
  assert.equal(AmountBuffer.from(-5020000).minor, 5020000);
  assert.equal(AmountBuffer.from(5020009).text, '50200,09');
});

test('a very long number stops growing instead of overflowing', () => {
  const buffer = type('1'.repeat(20));
  assert.ok(Number.isSafeInteger(buffer.minor));
});
