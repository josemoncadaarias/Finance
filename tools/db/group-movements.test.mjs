// Tests for grouping, totals and the donut slices.
//
//   node --import ./tools/db/register-ts.mjs --test tools/db/group-movements.test.mjs

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  flowOf, groupMovements, totalsOf, slicesOf, matchesSearch,
} from '../../src/app/features/movements/group-movements.ts';

/** A movement, with only the fields the grouping actually reads. */
function movement({ date, label, amount, base = amount, transfer = null, account = 'Bancolombia', accountType = 'debit', icon = null, description = '' }) {
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
    accountType,
    flow: flowOf(transaction, accountType),
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

test('income comes first, then everything that left', () => {
  // Jose's call, and Monefy's order: what came in is the context you read the
  // spending against. An earlier version put spending on top; this follows the
  // person who uses it every day.
  const groups = groupMovements([
    movement({ date: '2026-09-08', label: 'Casa', amount: -130000 }),
    movement({ date: '2026-09-08', label: "A 'ARQ'", amount: -900000, transfer: 1 }),
    movement({ date: '2026-09-08', label: 'Salario', amount: 3000000 }),
    movement({ date: '2026-09-08', label: 'Ahorros', amount: 500000 }),
  ], 'category');

  assert.deepEqual(groups.map(g => g.title), ['Salario', 'Ahorros', "A 'ARQ'", 'Casa']);
  // Transfers are not a tier of their own: they sort among what left, by size.
  assert.deepEqual(groups.map(g => g.flow), ['in', 'in', 'moved', 'out']);
});

test('within a group, either the newest or the biggest leads', () => {
  const rows = [
    movement({ date: '2026-09-02', label: 'Casa', amount: -900000, description: 'grande y vieja' }),
    movement({ date: '2026-09-08', label: 'Casa', amount: -130000, description: 'reciente' }),
    movement({ date: '2026-09-05', label: 'Casa', amount: -400000, description: 'media' }),
  ];

  const byDate = groupMovements(rows, 'category', 'date')[0].movements;
  assert.deepEqual(byDate.map(m => m.transaction.description), ['reciente', 'media', 'grande y vieja']);

  const byAmount = groupMovements(rows, 'category', 'amount')[0].movements;
  assert.deepEqual(byAmount.map(m => m.transaction.description), ['grande y vieja', 'media', 'reciente']);

  // It applies to date groups too, not only category ones.
  const inADay = groupMovements([
    movement({ date: '2026-09-08', label: 'Casa', amount: -130000, description: 'pequeño' }),
    movement({ date: '2026-09-08', label: 'Vuelos', amount: -5200000, description: 'enorme' }),
  ], 'date', 'amount')[0].movements;
  assert.deepEqual(inADay.map(m => m.transaction.description), ['enorme', 'pequeño']);
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

test('the legend lists income first and percents are shares of spending', () => {
  const slices = slicesOf([
    movement({ date: '2026-09-08', label: 'Casa', amount: -360000 }),
    movement({ date: '2026-09-08', label: 'Restaurante', amount: -270000 }),
    movement({ date: '2026-09-08', label: 'Mercado', amount: -180000 }),
    movement({ date: '2026-09-08', label: 'Salud', amount: -70000 }),
    movement({ date: '2026-09-08', label: 'Tecnología', amount: -80000 }),
    movement({ date: '2026-09-08', label: 'Transporte', amount: -40000 }),
    movement({ date: '2026-09-08', label: 'Salario', amount: 5000000 }),
  ]);

  // Income is listed, first, but takes no share of spending: the ring draws
  // only what went out, and a percentage of the ring is what a percent means.
  assert.equal(slices[0].label, 'Salario');
  assert.equal(slices[0].percent, 0);

  const spending = slices.slice(1);
  assert.deepEqual(spending.map(s => s.label),
    ['Casa', 'Restaurante', 'Mercado', 'Tecnología', 'Salud', 'Transporte']);
  // The real shares from Jose's own screenshot.
  assert.deepEqual(spending.map(s => s.percent), [36, 27, 18, 8, 7, 4]);
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
  assert.deepEqual(totalsOf([]), { inMinor: 0, outMinor: 0, refundedMinor: 0, movedMinor: 0 });
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


test('money arriving on a credit card is a refund, not income', () => {
  // The card holds the bank's money. A reversed charge or a returned purchase
  // undoes spending; it does not add to what Jose earned, and he was explicit
  // that it must never be counted as income.
  const card = { account: 'Tarjeta crédito rappi', accountType: 'credit' };

  assert.equal(movement({ ...card, date: '2026-09-08', label: 'Casa', amount: 60000 }).flow, 'refund');
  assert.equal(movement({ ...card, date: '2026-09-08', label: 'Casa', amount: -60000 }).flow, 'out');
  // The same positive amount on a debit account really is income.
  assert.equal(movement({ date: '2026-09-08', label: 'Salario', amount: 60000 }).flow, 'in');
});

test('a refund comes off what was spent, not onto what came in', () => {
  const totals = totalsOf([
    movement({ date: '2026-09-08', label: 'Casa', amount: -500000,
               account: 'Tarjeta crédito rappi', accountType: 'credit' }),
    movement({ date: '2026-09-08', label: 'Casa', amount: 120000,
               account: 'Tarjeta crédito rappi', accountType: 'credit' }),
    movement({ date: '2026-09-08', label: 'Salario', amount: 3000000 }),
  ]);

  assert.equal(totals.inMinor, 3000000, 'the refund is not income');
  assert.equal(totals.outMinor, 380000, 'spending is net of the refund');
  assert.equal(totals.refundedMinor, 120000);
});

test('a refund shrinks the category it undid', () => {
  const slices = slicesOf([
    movement({ date: '2026-09-08', label: 'Casa', amount: -300000 }),
    movement({ date: '2026-09-08', label: 'Casa', amount: 100000,
               account: 'Tarjeta crédito rappi', accountType: 'credit' }),
    movement({ date: '2026-09-08', label: 'Comida', amount: -200000 }),
  ]);

  const casa = slices.find(s => s.label === 'Casa');
  assert.equal(casa.amountMinor, 200000, '300,000 spent less 100,000 returned');
  assert.equal(casa.flow, 'out', 'still a spending slice');
  assert.deepEqual(slices.map(s => s.percent), [50, 50]);
});

test('the legend lists income too, and puts it first', () => {
  const slices = slicesOf([
    movement({ date: '2026-09-08', label: 'Casa', amount: -300000 }),
    movement({ date: '2026-09-08', label: 'Salario', amount: 3000000 }),
    movement({ date: '2026-09-08', label: 'Comida', amount: -100000 }),
  ]);

  assert.deepEqual(slices.map(s => s.label), ['Salario', 'Casa', 'Comida']);
  // Income has no share of spending, so it shows none.
  assert.equal(slices[0].percent, 0);
  assert.deepEqual(slices.slice(1).map(s => s.percent), [75, 25]);
});

test('the largest view is one flat list, biggest first', () => {
  const movements = [
    movement({ amount: -2500000, date: '2026-09-01', label: 'Restaurante' }),
    movement({ amount: -13000000, date: '2026-09-08', label: 'Casa' }),
    movement({ amount: -12210100, date: '2026-09-07', label: 'Casa' }),
    movement({ amount: 30264043, date: '2026-09-05', label: 'Ahorros' }),
  ];

  const groups = groupMovements(movements, 'largest');

  // One group, so the ordering is never broken into pieces by a heading.
  assert.equal(groups.length, 1);
  assert.deepEqual(groups[0].movements.map(m => m.transaction.amount_base_minor),
    [30264043, -13000000, -12210100, -2500000], 'by size, whichever way the money went');
  assert.equal(groups[0].count, 4);

  // Grouping by date over the same movements answers a different question.
  const byDate = groupMovements(movements, 'date');
  assert.equal(byDate.length, 4);
});

test('an empty period has nothing to show in any view', () => {
  assert.deepEqual(groupMovements([], 'date'), []);
  assert.deepEqual(groupMovements([], 'category'), []);
  // The flat view still returns its one group, holding nothing.
  assert.equal(groupMovements([], 'largest')[0].movements.length, 0);
});

test('one account is totalled in its own currency, many in pesos', () => {
  // 100 dollars that were worth 420,000 pesos on the day.
  const movements = [
    movement({ amount: -10000, base: -42000000, date: '2026-09-01', label: 'Vuelos' }),
    movement({ amount: -2000, base: -8400000, date: '2026-09-02', label: 'Comida' }),
  ];

  // Looking at the dollar account: what left is 120 dollars, not 504,000.
  const own = totalsOf(movements, 'own');
  assert.equal(own.outMinor, 12000);

  // Looking at everything at once: pesos, the only thing several currencies
  // have in common.
  const base = totalsOf(movements, 'base');
  assert.equal(base.outMinor, 50400000);

  // Group totals follow the same rule, or a heading would contradict the
  // figures under it.
  const [group] = groupMovements(movements, 'category', 'amount', 'es-CO', 'Todos', 'own');
  assert.equal(group.totalBaseMinor, -10000, 'the biggest category, in dollars');

  const [inPesos] = groupMovements(movements, 'category', 'amount', 'es-CO', 'Todos', 'base');
  assert.equal(inPesos.totalBaseMinor, -42000000);

  // And so does the donut.
  assert.equal(slicesOf(movements, 'own')[0].amountMinor, 10000);
  assert.equal(slicesOf(movements, 'base')[0].amountMinor, 42000000);
});

test('a day heading carries its year unless it is this year', () => {
  const movements = [
    movement({ amount: -1000, date: '2026-09-08', label: 'Casa' }),
    movement({ amount: -2000, date: '2023-09-08', label: 'Casa' }),
    movement({ amount: -3000, date: '2021-12-31', label: 'Casa' }),
  ];

  // Pretending today is in 2026, which is what the screen passes.
  const groups = groupMovements(movements, 'date', 'date', 'es-CO', 'Todos', 'base', 2026);

  assert.deepEqual(groups.map(g => g.title), [
    '8 de septiembre',        // this year: the year would be noise
    '8 de septiembre 2023',   // four years of history in one list
    '31 de diciembre 2021',
  ]);

  // English drops the "de" and keeps the same rule.
  const english = groupMovements(movements, 'date', 'date', 'en-GB', 'All', 'base', 2026);
  assert.deepEqual(english.map(g => g.title),
    ['8 September', '8 September 2023', '31 December 2021']);

  // And from another year, today's date is the one that carries it.
  const later = groupMovements(movements, 'date', 'date', 'es-CO', 'Todos', 'base', 2027);
  assert.equal(later[0].title, '8 de septiembre 2026');
});
