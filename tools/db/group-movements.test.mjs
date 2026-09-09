// Tests for grouping, totals and the donut slices.
//
//   node --import ./tools/db/register-ts.mjs --test tools/db/group-movements.test.mjs

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  flowOf, groupMovements, totalsOf, slicesOf, matchesSearch,
} from '../../src/app/features/movements/group-movements.ts';

/** A movement, with only the fields the grouping actually reads. */
function movement({ date, label, amount, base = amount, transfer = null, account = 'Bancolombia', icon = null, description = '' }) {
  const transaction = {
    id: Math.random(),
    occurred_on: date,
    amount_minor: amount,
    amount_base_minor: base,
    transfer_id: transfer,
    description,
  };
  return {
    transaction,
    accountName: account,
    currency: 'COP',
    label,
    icon,
    flow: flowOf(transaction),
  };
}

test('a transfer is moved, not spent', () => {
  assert.equal(flowOf({ amount_minor: -100, transfer_id: 7 }), 'moved');
  assert.equal(flowOf({ amount_minor: 100, transfer_id: 7 }), 'moved');
  assert.equal(flowOf({ amount_minor: -100, transfer_id: null }), 'out');
  assert.equal(flowOf({ amount_minor: 100, transfer_id: null }), 'in');
});

test('totals keep the three kinds apart', () => {
  const totals = totalsOf([
    movement({ date: '2026-09-08', label: 'Salario', amount: 3000000 }),
    movement({ date: '2026-09-08', label: 'Casa', amount: -130000 }),
    movement({ date: '2026-09-07', label: 'Restaurante', amount: -25850 }),
    movement({ date: '2026-09-07', label: "A 'Ualá'", amount: -500000, transfer: 3 }),
  ]);

  assert.equal(totals.inMinor, 3000000);
  assert.equal(totals.outMinor, 155850, 'the transfer is not spending');
  assert.equal(totals.movedMinor, 500000);
});

test('grouping by date puts the newest day first', () => {
  const groups = groupMovements([
    movement({ date: '2026-09-06', label: 'Restaurante', amount: -22100 }),
    movement({ date: '2026-09-08', label: 'Casa', amount: -130000 }),
    movement({ date: '2026-09-07', label: 'Casa', amount: -122101 }),
    movement({ date: '2026-09-07', label: 'Restaurante', amount: -25850 }),
  ], 'date');

  assert.deepEqual(groups.map(g => g.key), ['2026-09-08', '2026-09-07', '2026-09-06']);
  assert.equal(groups[0].title, '8 de septiembre');
  assert.equal(groups[1].count, 2);
  assert.equal(groups[1].totalBaseMinor, -147951);
});

test('grouping by category puts the biggest spender first', () => {
  const groups = groupMovements([
    movement({ date: '2026-09-08', label: 'Restaurante', amount: -25850 }),
    movement({ date: '2026-09-08', label: 'Casa', amount: -130000 }),
    movement({ date: '2026-09-07', label: 'Casa', amount: -122101 }),
    movement({ date: '2026-09-06', label: 'Transporte', amount: -2600 }),
  ], 'category');

  assert.deepEqual(groups.map(g => g.title), ['Casa', 'Restaurante', 'Transporte']);
  assert.equal(groups[0].count, 2);
  assert.equal(groups[0].totalBaseMinor, -252101);
});

test('spending outranks transfers, and transfers outrank income', () => {
  // Otherwise a big salary sits above every category and the ordering stops
  // answering "where did the money go".
  const groups = groupMovements([
    movement({ date: '2026-09-08', label: 'Salario', amount: 3000000 }),
    movement({ date: '2026-09-08', label: "A 'ARQ'", amount: -900000, transfer: 1 }),
    movement({ date: '2026-09-08', label: 'Casa', amount: -130000 }),
  ], 'category');

  assert.deepEqual(groups.map(g => g.title), ['Casa', "A 'ARQ'", 'Salario']);
  assert.deepEqual(groups.map(g => g.flow), ['out', 'moved', 'in']);
});

test('a day that mixes income and spending takes the sign of its total', () => {
  const groups = groupMovements([
    movement({ date: '2026-09-08', label: 'Salario', amount: 3000000 }),
    movement({ date: '2026-09-08', label: 'Casa', amount: -130000 }),
  ], 'date');

  assert.equal(groups.length, 1);
  assert.equal(groups[0].flow, 'in', 'more came in than went out');
  assert.equal(groups[0].totalBaseMinor, 2870000);
});

test('totals use the base amount, so mixed currencies still add up', () => {
  const totals = totalsOf([
    // 23.73 USD, frozen at 99,998.22 COP.
    movement({ date: '2026-09-08', label: 'Viajes', amount: -2373, base: -9999822, account: 'ARQ USD' }),
    movement({ date: '2026-09-08', label: 'Casa', amount: -130000, base: -130000 }),
  ]);
  assert.equal(totals.outMinor, 9999822 + 130000);
});

test('the donut leaves income out and rounds to whole percents', () => {
  const slices = slicesOf([
    movement({ date: '2026-09-08', label: 'Casa', amount: -360000 }),
    movement({ date: '2026-09-08', label: 'Restaurante', amount: -270000 }),
    movement({ date: '2026-09-08', label: 'Mercado', amount: -180000 }),
    movement({ date: '2026-09-08', label: 'Salud', amount: -70000 }),
    movement({ date: '2026-09-08', label: 'Tecnología', amount: -80000 }),
    movement({ date: '2026-09-08', label: 'Transporte', amount: -40000 }),
    movement({ date: '2026-09-08', label: 'Salario', amount: 5000000 }),
  ]);

  assert.equal(slices.length, 6, 'income gets no slice');
  assert.deepEqual(slices.map(s => s.label),
    ['Casa', 'Restaurante', 'Mercado', 'Tecnología', 'Salud', 'Transporte']);
  // The real shares from Jose's own screenshot.
  assert.deepEqual(slices.map(s => s.percent), [36, 27, 18, 8, 7, 4]);
});

test('a transfer gets a slice but stays marked as moved', () => {
  // For a single account, money that left is money that left - but the chart
  // has to be able to paint it as something other than spending.
  const slices = slicesOf([
    movement({ date: '2026-09-08', label: 'Casa', amount: -500000 }),
    movement({ date: '2026-09-08', label: "A 'Ualá'", amount: -500000, transfer: 2 }),
  ]);

  assert.equal(slices.length, 2);
  assert.deepEqual(slices.map(s => s.percent), [50, 50]);
  assert.equal(slices.find(s => s.label === "A 'Ualá'").flow, 'moved');
});

test('an empty period produces no slices and no division by zero', () => {
  assert.deepEqual(slicesOf([]), []);
  assert.deepEqual(totalsOf([]), { inMinor: 0, outMinor: 0, movedMinor: 0 });
  assert.deepEqual(groupMovements([], 'date'), []);
});

test('search looks at the description, the category and the account', () => {
  const row = movement({
    date: '2026-09-08', label: 'Casa', account: 'Tarjeta crédito rappi',
    amount: -130000, description: 'Fotos Matías once meses',
  });

  assert.equal(matchesSearch(row, ''), true);
  assert.equal(matchesSearch(row, 'matías'), true, 'case and accents as written');
  assert.equal(matchesSearch(row, 'FOTOS'), true);
  assert.equal(matchesSearch(row, 'casa'), true, 'the category counts');
  assert.equal(matchesSearch(row, 'rappi'), true, 'so does the account');
  assert.equal(matchesSearch(row, 'mercado'), false);
});
