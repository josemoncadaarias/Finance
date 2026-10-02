// Inicio's "Esta semana": a card's statement and a loan's installment that
// are late, or due within seven days, and nothing else.
//
//   node --import ./tools/db/register-ts.mjs --test tools/db/due-soon.test.mjs

import test from 'node:test';
import assert from 'node:assert/strict';

import { daysBetween, dueSoon } from '../../src/app/core/debts/due-soon.ts';

const statement = (state, dueOn, remainingMinor = 50_000_00) => ({ state, dueOn, remainingMinor });
const installment = (state, dueOn, number = 24) => ({ type: 'installment', number, dueOn, totalMinor: 1_500_000_00, state });

test('days between two days, across a month end', () => {
  assert.equal(daysBetween('2026-10-02', '2026-10-09'), 7);
  assert.equal(daysBetween('2026-09-28', '2026-10-02'), 4);
  assert.equal(daysBetween('2026-10-05', '2026-10-02'), -3);
});

test('a card due within seven days, or late, is said; one further away, paid or without days is not', () => {
  const cards = [
    { id: 1, currency: 'COP', statement: statement('due', '2026-10-09') },
    { id: 2, currency: 'COP', statement: statement('due', '2026-10-10') },
    { id: 3, currency: 'COP', statement: statement('overdue', '2026-09-28') },
    { id: 4, currency: 'COP', statement: statement('partial', '2026-10-02', 10_000_00) },
    { id: 5, currency: 'COP', statement: statement('paid', '2026-10-05', 0) },
    { id: 6, currency: 'COP', statement: statement('noDates', null, 0) },
    { id: 7, currency: 'COP', statement: statement('nothingDue', '2026-10-05', 0) },
  ];
  const items = dueSoon(cards, [], '2026-10-02');
  assert.deepEqual(items.map(i => [i.id, i.daysLeft, i.overdue]), [[3, -4, true], [4, 0, false], [1, 7, false]]);
  assert.equal(items[1].amountMinor, 10_000_00);
});

test('a loan says its next installment when due this week or late, never a future or a finished one', () => {
  const loans = [
    { id: 10, installments: 60, done: false, next: installment('next', '2026-10-05') },
    { id: 11, installments: 60, done: false, next: installment('next', '2026-10-15') },
    { id: 12, installments: 36, done: false, next: installment('overdue', '2026-09-20', 7) },
    { id: 13, installments: 12, done: true, next: null },
    { id: 14, installments: 12, done: false, next: installment('future', '2026-10-04') },
  ];
  const items = dueSoon([], loans, '2026-10-02');
  assert.deepEqual(items.map(i => [i.kind, i.id, i.number, i.of, i.overdue]), [['loan', 12, 7, 36, true], ['loan', 10, 24, 60, false]]);
});

test('cards and loans together, by the day they fall due', () => {
  const items = dueSoon(
    [{ id: 1, currency: 'COP', statement: statement('due', '2026-10-06') }],
    [{ id: 9, installments: 60, done: false, next: installment('next', '2026-10-03') }],
    '2026-10-02');
  assert.deepEqual(items.map(i => i.kind), ['loan', 'card']);
});
