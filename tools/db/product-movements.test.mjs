// The history of an account's products, as the acts a person did.
//
//   node --import ./tools/db/register-ts.mjs --test tools/db/product-movements.test.mjs

import test from 'node:test';
import assert from 'node:assert/strict';

import { productMovements, movementTouches } from '../../src/app/core/yields/product-movements.ts';

const pockets = [
  { id: 1, name: 'Ahorros', source: 'manual', is_default: 1 },
  { id: 2, name: 'CDT', source: 'manual', is_default: null },
];

const row = over => ({
  id: 0, account_id: 10, pocket_id: null, occurred_on: '2026-09-10', amount_minor: -1000,
  transfer_id: null, transfer_leg: null, description: null, category_id: 5, category_name: 'Comida',
  other_account_id: null, other_account_name: null, ...over,
});

test('movements count from the day each product balance was stated, one line per act', () => {
  const movements = productMovements({
    accountId: 10,
    pockets,
    startDays: new Map([[1, '2026-09-05'], [2, '2026-09-08']]),
    transactions: [
      row({ id: 1, occurred_on: '2026-09-04' }),
      row({ id: 2, occurred_on: '2026-09-05' }),
      row({ id: 3, pocket_id: 2, occurred_on: '2026-09-07' }),
      row({ id: 4, transfer_id: 9, transfer_leg: 'from', pocket_id: 1, amount_minor: -500, other_account_id: 10, category_id: null }),
      row({ id: 5, transfer_id: 9, transfer_leg: 'to', pocket_id: 2, amount_minor: 500, other_account_id: 10, category_id: null }),
      row({ id: 6, amount_minor: 3000, category_name: 'Rendimientos' }),
      row({ id: 7, transfer_id: 11, transfer_leg: 'to', amount_minor: 800, other_account_id: 99, other_account_name: 'Nu', category_id: null }),
    ],
    entries: [
      { id: 1, on_date: '2026-09-09', amount_minor: 100, kind: 'cashback', pocket_id: 2, note: null, transaction_id: null },
      { id: 2, on_date: '2026-09-09', amount_minor: 200, kind: 'other', pocket_id: 1, note: null, transaction_id: 99 },
    ],
    withdrawals: [
      { id: 1, on_date: '2026-09-10', amount_minor: 3000, pocket_id: 1, note: null, transaction_id: 6 },
    ],
  });

  const byKey = new Map(movements.map(movement => [movement.key, movement]));
  assert.deepEqual([...byKey.keys()].sort(), ['a:1', 't:2', 't:6', 't:7', 'x:9'],
    'older than a product balance is inside it; a transfer between products is one line; halves of a cash-in are its movement');

  assert.equal(byKey.get('t:2').pocketId, 1, 'a movement naming no product is the usual product');
  assert.equal(byKey.get('t:6').cashIn, true);
  assert.equal(byKey.get('t:2').cashIn, false);
  assert.deepEqual([byKey.get('x:9').fromPocketId, byKey.get('x:9').toPocketId, byKey.get('x:9').amountMinor], [1, 2, 500]);

  assert.equal(movementTouches(byKey.get('x:9'), 2), true, 'a transfer touches both of its products');
  assert.equal(movementTouches(byKey.get('t:2'), 2), false);
  assert.equal(movements[0].on, '2026-09-10', 'newest first');
});

test('a withdrawal whose movement is gone is still in the history', () => {
  const movements = productMovements({
    accountId: 10, pockets, startDays: new Map(), transactions: [], entries: [],
    withdrawals: [{ id: 4, on_date: '2026-09-01', amount_minor: 700, pocket_id: null, note: null, transaction_id: null }],
  });
  assert.equal(movements.length, 1);
  assert.equal(movements[0].amountMinor, -700);
  assert.equal(movements[0].pocketId, 1);
});
