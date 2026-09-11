// Tests for the money helpers.
//
//   node --test tools/db/money.test.mjs
//
// Node strips the TypeScript types on import, so this runs with nothing
// installed and no build step. The values used here are real ones from
// data/monefy-2026-09-07.csv.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  parseAmountToMinor, parseTypedAmountToMinor,
  minorToDecimalString,
  formatMoney,
  parseRateToScaled,
  convertToBaseMinor,
  deriveRateScaled,
  availableCreditMinor,
  MoneyError,
} from '../../src/app/core/database/money.ts';

test('parses real backup amounts without floating-point drift', () => {
  // The row that started the whole integers rule: naive parseFloat('9421.28')
  // times 100 gives 942127.9999999999.
  assert.equal(parseAmountToMinor('9421.28'), 942128);
  assert.equal(parseAmountToMinor('-50200'), -5020000);
  assert.equal(parseAmountToMinor('-51774.09'), -5177409);
  assert.equal(parseAmountToMinor('66750767.94'), 6675076794);
  assert.equal(parseAmountToMinor('-3748.5'), -374850);
  assert.equal(parseAmountToMinor('0'), 0);
  assert.equal(parseAmountToMinor('-0.01'), -1);
});

test('rejects anything that is not a plain decimal', () => {
  // Stripping thousands separators belongs to the importer, which knows the
  // file's conventions. This function must not guess.
  assert.throws(() => parseAmountToMinor('-50,200'), MoneyError);
  assert.throws(() => parseAmountToMinor('$1000'), MoneyError);
  assert.throws(() => parseAmountToMinor(''), MoneyError);
  assert.throws(() => parseAmountToMinor('abc'), MoneyError);
  assert.throws(() => parseAmountToMinor('1e5'), MoneyError);
  // A third decimal would have to be dropped, and money must not lose digits.
  assert.throws(() => parseAmountToMinor('10.005'), MoneyError);
});

test('round-trips every amount back to the same string', () => {
  for (const value of ['9421.28', '-50200.00', '0.00', '-0.01', '66750767.94', '4703079.56']) {
    assert.equal(minorToDecimalString(parseAmountToMinor(value)), value.replace(/^(-?)(\d)/, '$1$2'));
  }
  assert.equal(minorToDecimalString(-5020000), '-50200.00');
  assert.equal(minorToDecimalString(1), '0.01');
  assert.equal(minorToDecimalString(0), '0.00');
});

test('formats COP with two decimals, the way Monefy shows it', () => {
  const formatted = formatMoney(-5020000, 'COP');
  assert.match(formatted, /50\.200,00/);
  assert.match(formatted, /-/);
  assert.equal(formatMoney(942128, 'COP', { withSymbol: false }), '9.421,28');
  assert.match(formatMoney(2373, 'USD', { locale: 'en-US' }), /23\.73/);
});

test('parses and derives the rates DolarApp actually applied', () => {
  assert.equal(parseRateToScaled('4214.00'), 42140000);
  assert.equal(parseRateToScaled('4321.7'), 43217000);

  // Every one of these pairs is a real COP/USD pair from the backup.
  assert.equal(deriveRateScaled(parseAmountToMinor('2107000'), parseAmountToMinor('500')), 42140000);
  assert.equal(deriveRateScaled(parseAmountToMinor('4300'), parseAmountToMinor('1')), 43000000);
  assert.equal(deriveRateScaled(parseAmountToMinor('309875'), parseAmountToMinor('71.71')), 43212244);
  assert.equal(deriveRateScaled(parseAmountToMinor('820378'), parseAmountToMinor('187.5')), 43753493);

  assert.throws(() => deriveRateScaled(1000, 0), MoneyError);
});

test('converts a foreign amount to its frozen base equivalent', () => {
  // 23.73 USD at 4,214.00 is 99,998.22 COP.
  assert.equal(convertToBaseMinor(2373, 42140000), 9999822);
  // The sign survives, so a debit and its mirror stay symmetrical.
  assert.equal(convertToBaseMinor(-2373, 42140000), -9999822);
  assert.equal(convertToBaseMinor(0, 42140000), 0);
  assert.throws(() => convertToBaseMinor(100, 0), MoneyError);
  assert.throws(() => convertToBaseMinor(100, -1), MoneyError);
});

test('a credit card reports what is left of its limit', () => {
  // The real Rappi card: a 1,100,000 limit against a 47,709.40 purchase.
  assert.equal(availableCreditMinor(110000000, -4770940), 105229060);
  assert.equal(formatMoney(availableCreditMinor(110000000, -4770940), 'COP', { withSymbol: false }), '1.052.290,60');
  // The balance sign must not matter to the arithmetic.
  assert.equal(availableCreditMinor(110000000, 4770940), 105229060);
});

test('refuses amounts too large to stay exact', () => {
  assert.throws(() => parseAmountToMinor('99999999999999999'), MoneyError);
  assert.throws(() => convertToBaseMinor(Number.MAX_SAFE_INTEGER, 42140000), MoneyError);
});

test('an amount typed the way this app displays it is accepted', () => {
  // The strict parser takes a plain decimal and nothing else, which is right
  // for a file being imported: there, what a dot means depends on the file.
  // It is wrong for a field a person types into — the figure being copied is
  // the one this app just displayed, and typing it back was rejected, which
  // is how a product balance ended up saved as zero.
  assert.equal(parseTypedAmountToMinor('4.917.434,98'), 491743498, 'as Colombia writes it');
  assert.equal(parseTypedAmountToMinor('4,917,434.98'), 491743498, 'and the other way round');
  assert.equal(parseTypedAmountToMinor('4917434.98'), 491743498, 'no grouping at all');
  assert.equal(parseTypedAmountToMinor('4917434,98'), 491743498);
  assert.equal(parseTypedAmountToMinor(' 52.661.925,25 '), 5266192525, 'spaces trimmed');

  // The one genuinely ambiguous case. Three digits after a lone separator is
  // grouping: in a country whose smallest note is a thousand pesos, reading
  // "300.000" as thirty thousand would be wrong far more often than right.
  assert.equal(parseTypedAmountToMinor('300.000'), 30000000, 'three hundred thousand');
  assert.equal(parseTypedAmountToMinor('300000'), 30000000, 'and the same without it');

  // Fewer than three digits is a fraction, which is what it looks like.
  assert.equal(parseTypedAmountToMinor('1.5'), 150);
  assert.equal(parseTypedAmountToMinor('0'), 0);

  // Empty is not zero. It used to be, and a field left blank quietly set a
  // product's balance to nothing.
  assert.throws(() => parseTypedAmountToMinor(''));
  assert.throws(() => parseTypedAmountToMinor('   '));
});
