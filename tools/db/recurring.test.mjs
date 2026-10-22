// What comes back every month (Jose, 2026-10-22): fixed payments by shop and
// every-month spending by category, averaged. Every shop, category and figure
// here is INVENTED.
//
//   node --import ./tools/db/register-ts.mjs --test tools/db/recurring.test.mjs

import test from 'node:test';
import assert from 'node:assert/strict';

import { recurringOf } from '../../src/app/core/assistant/recurring.ts';

const P = pesos => Math.round(pesos * 100);
/** A month: [shop key, name, category, pesos] rows; categories are the sums. */
const month = rows => {
  const shops = new Map();
  const categories = new Map();
  for (const [key, name, category, pesos] of rows) {
    if (key) shops.set(key, { minor: P(pesos), name, category });
    categories.set(category, (categories.get(category) ?? 0) + P(pesos));
  }
  return { shops, categories };
};

// Six whole months, newest first: a steady streaming plan, a steady bill, a
// market whose amount moves, a café three times, and a one-off trip.
const months = [
  month([['STREAM', 'Plan de películas', 'Entretenimiento', 30_000], ['LUZ', 'Luz', 'Servicios', 120_000], ['', '', 'Mercado', 900_000], ['', '', 'Servicios', 40_000]]),
  month([['STREAM', 'Plan de películas', 'Entretenimiento', 30_000], ['LUZ', 'Luz', 'Servicios', 110_000], ['', '', 'Mercado', 700_000], ['', '', 'Café', 20_000]]),
  month([['STREAM', 'Plan de películas', 'Entretenimiento', 30_000], ['LUZ', 'Luz', 'Servicios', 125_000], ['', '', 'Mercado', 800_000], ['', '', 'Viajes', 2_000_000]]),
  month([['STREAM', 'Plan de películas', 'Entretenimiento', 30_000], ['LUZ', 'Luz', 'Servicios', 115_000], ['', '', 'Mercado', 1_200_000], ['', '', 'Café', 25_000]]),
  month([['STREAM', 'Plan de películas', 'Entretenimiento', 30_000], ['', '', 'Mercado', 600_000], ['', '', 'Café', 15_000]]),
  month([['STREAM', 'Plan de películas', 'Entretenimiento', 30_000], ['LUZ', 'Luz', 'Servicios', 120_000], ['', '', 'Mercado', 650_000]]),
];
const now = month([['STREAM', 'Plan de películas', 'Entretenimiento', 30_000], ['', '', 'Mercado', 300_000]]);

test('steady payments are fixed; a category whose amount moves is every-month spending, averaged over 3 months', () => {
  const r = recurringOf(months, now);
  assert.equal(r.looked, 6);
  assert.equal(r.needed, 4);
  assert.equal(r.neededEvery, 5);
  assert.deepEqual(r.fixed.map(f => [f.name, f.averageMinor, f.monthsSeen, f.thisMonthMinor]),
    [['Luz', P(118_000), 5, 0], ['Plan de películas', P(30_000), 6, P(30_000)]]);
  // Mercado: the last 3 months 900, 700 and 800 mil -> 800 mil; lowest 600, highest 1,2 M.
  const market = r.everyMonth.find(e => e.category === 'Mercado');
  assert.deepEqual([market.averageMinor, market.lowMinor, market.highMinor, market.thisMonthMinor],
    [P(800_000), P(600_000), P(1_200_000), P(300_000)]);
  // The bill is fixed, so Servicios keeps only what is not the bill: 40 mil once - not every month.
  assert.equal(r.everyMonth.some(e => e.category === 'Servicios'), false);
  // The café (3 of 6) and the trip (once) are not every month.
  assert.equal(r.everyMonth.some(e => e.category === 'Café' || e.category === 'Viajes'), false);
  // The streaming plan's category is all fixed: never counted twice.
  assert.equal(r.everyMonth.some(e => e.category === 'Entretenimiento'), false);
  assert.equal(r.fixedMinor, P(148_000));
  assert.equal(r.everyMonthMinor, P(800_000));
});

test('a month with nothing in a category counts as zero in the average', () => {
  const gap = [month([['', '', 'Gasolina', 0]]), ...[1, 2, 3, 4, 5].map(() => month([['', '', 'Gasolina', 300_000]]))];
  gap[0] = month([['', '', 'Otra', 10_000]]);
  const r = recurringOf(gap, month([]));
  const fuel = r.everyMonth.find(e => e.category === 'Gasolina');
  assert.equal(fuel.monthsSeen, 5);
  assert.equal(fuel.averageMinor, P(200_000)); // (0 + 300 + 300) / 3
});

test('fewer than 3 months on record: nothing can be called recurring yet', () => {
  const r = recurringOf([months[0], months[1], month([]), month([])], now);
  assert.equal(r.looked, 2);
  assert.deepEqual([r.fixed.length, r.everyMonth.length], [0, 0]);
});

test('a category in 4 of 6 months is frequent, not every month; in 5 of 6 it is', () => {
  const four = [1, 1, 0, 1, 0, 1].map(on => month(on ? [['', '', 'Ropa', 200_000], ['', '', 'Pan', 50_000]] : [['', '', 'Pan', 50_000]]));
  const five = [1, 1, 1, 0, 1, 1].map(on => month(on ? [['', '', 'Ropa', 200_000], ['', '', 'Pan', 50_000]] : [['', '', 'Pan', 50_000]]));
  assert.equal(recurringOf(four, month([])).everyMonth.some(e => e.category === 'Ropa'), false);
  assert.equal(recurringOf(five, month([])).everyMonth.some(e => e.category === 'Ropa'), true);
});
