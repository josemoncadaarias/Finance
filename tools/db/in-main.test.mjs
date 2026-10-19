// Showing money in another main currency (37d): a movement in that currency
// keeps its own amount, any other is its pesos at its own day's rate, and net
// worth is what is held today at today's rate.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rateBook, rateOn, pesosToMain, movementInMain, worthInMain } from '../../src/app/core/currencies/in-main.ts';

const book = rateBook([
  { on_date: '2026-10-01', rate_scaled: 40_000_000 },
  { on_date: '2026-10-10', rate_scaled: 39_000_000 },
  { on_date: '2026-10-10', rate_scaled: 1 },
]);

test('the rate of a day is the last on or before it, else the first', () => {
  assert.equal(rateOn(book, '2026-10-05'), 40_000_000);
  assert.equal(rateOn(book, '2026-10-10'), 39_000_000);
  assert.equal(rateOn(book, '2026-10-19'), 39_000_000);
  assert.equal(rateOn(book, '2026-01-01'), 40_000_000);
  assert.equal(rateOn(rateBook([]), '2026-10-19'), null);
});

test('pesos into the main currency at a rate', () => {
  assert.equal(pesosToMain(400_000_00, 40_000_000), 100_00);
  assert.equal(pesosToMain(-123_456_78, 39_000_000), -31_66);
});

test('a movement in the main currency keeps its own amount', () => {
  const usd = { amount_minor: -12_34, amount_base_minor: -48_000_00, currency_code: 'USD', occurred_on: '2026-10-05' };
  assert.equal(movementInMain(usd, 'USD', book), -12_34);
  const cop = { amount_minor: -400_000_00, amount_base_minor: -400_000_00, currency_code: 'COP', occurred_on: '2026-10-05' };
  assert.equal(movementInMain(cop, 'USD', book), -100_00);
  assert.equal(movementInMain(cop, 'COP', book), -400_000_00);
});

test('net worth in the main currency adds up to its lines', () => {
  const lines = [
    { currency_code: 'COP', balance_minor: 390_000_00, baseMinor: 390_000_00 },
    { currency_code: 'USD', balance_minor: 50_00, baseMinor: 195_000_00 },
    { currency_code: 'EUR', balance_minor: 10_00, baseMinor: null },
  ];
  const out = worthInMain(lines, 'USD', 39_000_000);
  assert.deepEqual(out.lines.map(l => l.baseMinor), [100_00, 50_00, null]);
  assert.equal(out.totalMinor, 150_00);
  assert.equal(worthInMain(lines, 'COP', null).totalMinor, 585_000_00);
});
