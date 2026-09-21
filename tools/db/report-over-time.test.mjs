// The summary's analyses that need more than one stretch of time.
//
//   node --import ./tools/db/register-ts.mjs --test tools/db/report-over-time.test.mjs
//
// Its own file because these are the ones with judgement in them - what counts
// as a jump worth interrupting for, what counts as a subscription rather than
// a habit of writing the same note - and that judgement is what is being
// tested, not arithmetic.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  versusBefore, categoriesVersusBefore, recurringSpending, repeatedCharges,
  spendingByMonth, unusualJumps,
} from '../../src/app/core/report/sections-over-time.ts';
import { equivalentBefore, monthsIn } from '../../src/app/core/report/report-data.ts';
import { TEST_WORDS } from '../../src/app/core/report/report-words.ts';

let nextId = 1;

function movement({
  amount, on = '2026-09-10', label = 'Mercado', flow = 'out',
  account = 'Rappi cuenta', accountId = 1, note = null,
}) {
  return {
    transaction: {
      id: nextId++,
      account_id: accountId,
      category_id: 1,
      occurred_on: on,
      amount_minor: amount,
      amount_base_minor: amount,
      description: note,
      transfer_id: null,
    },
    accountName: account,
    accountType: 'debit',
    currency: 'COP',
    label,
    icon: null,
    customIconId: null,
    accountIcon: null,
    accountCustomIconId: null,
    flow,
  };
}

function data(movements, extra = {}) {
  return {
    period: { kind: 'month', from: '2026-09-01', to: '2026-09-30' },
    periodLabel: 'Septiembre 2026',
    account: null,
    accounts: [],
    movements,
    basis: 'own',
    currency: 'COP',
    before: null,
    today: '2026-09-30',
    locale: 'es-CO',
    words: TEST_WORDS,
    ...extra,
  };
}

/** The same data, with an earlier stretch to compare against. */
function withBefore(movements, earlier, extra = {}) {
  return data(movements, {
    before: {
      period: { kind: 'month', from: '2026-08-01', to: '2026-08-21' },
      label: 'Agosto 2026',
      movements: earlier,
      clipped: true,
    },
    ...extra,
  });
}

/** Nine months of movements, for the analyses that need a run of them. */
function overMonths(build) {
  const movements = [];
  for (const month of ['01', '02', '03', '04', '05', '06', '07', '08', '09']) {
    movements.push(...build(`2026-${month}`));
  }
  return data(movements, {
    period: { kind: 'year', from: '2026-01-01', to: '2026-12-31' },
    today: '2026-09-30',
  });
}

// ---------------------------------------------------------------------------
// Which stretch is compared against which
// ---------------------------------------------------------------------------

test('the comparison is the same number of days on both sides', () => {
  // On the 21st, September against ALL of August compares 21 days with 31 and
  // calls the difference a trend. The cut is what makes it honest.
  const period = { kind: 'month', from: '2026-09-01', to: '2026-09-30' };

  assert.equal(equivalentBefore(period, 21).from, '2026-08-01');
  assert.equal(equivalentBefore(period, 21).to, '2026-08-21');

  // A period already over is compared whole to whole, and never runs past the
  // end of the earlier month.
  assert.equal(equivalentBefore(period, 30).to, '2026-08-30');
  assert.equal(equivalentBefore(period, 60).to, '2026-08-31');
});

test('there is nothing to compare "all time" or a typed range against', () => {
  assert.equal(equivalentBefore({ kind: 'all', from: null, to: null }, 100), null);
  assert.equal(equivalentBefore({ kind: 'range', from: '2026-01-01', to: '2026-03-01' }, 60), null);
});

test('the months of a period are every month it touches, up to today', () => {
  assert.deepEqual(
    monthsIn({ kind: 'year', from: '2026-01-01', to: '2026-12-31' }, '2026-03-15'),
    ['2026-01', '2026-02', '2026-03'],
  );
  assert.deepEqual(
    monthsIn({ kind: 'month', from: '2025-12-01', to: '2026-01-31' }, '2026-06-01'),
    ['2025-12', '2026-01'],
  );
});

// ---------------------------------------------------------------------------
// This period against before
// ---------------------------------------------------------------------------

test('a balance falling further below zero is not growth', () => {
  // Jose's real August to September: -6,379,788 to -12,105,570. Dividing by
  // the earlier figure rather than by its size called that "+90%" and painted
  // it green. It is a fall, and it has to read as one.
  const block = versusBefore(withBefore(
    [movement({ amount: -300_000_00 }), movement({ amount: 100_000_00, flow: 'in' })],
    [movement({ amount: -150_000_00 }), movement({ amount: 100_000_00, flow: 'in' })],
  ));

  const balance = block.rows.find(row => row.label === TEST_WORDS['report.headline.balance']);
  assert.equal(balance.before.minor, -50_000_00);
  assert.equal(balance.now.minor, -200_000_00);
  assert.ok(balance.changePercent < 0, 'a worse balance reads as a fall');
});

test('a percentage off a tiny base steps aside for the two figures', () => {
  const block = versusBefore(withBefore(
    [movement({ amount: 500_000_00, flow: 'in' })],
    [movement({ amount: 1_00, flow: 'in' })],
  ));

  const income = block.rows.find(row => row.label === TEST_WORDS['report.headline.income']);
  assert.equal(income.changePercent, null, '+49,999,900% informs nobody');
  assert.equal(income.now.minor, 500_000_00, 'the amounts are still there to be read');
});

test('a comparison cut short says so', () => {
  const block = versusBefore(withBefore([movement({ amount: -1_00 })], [movement({ amount: -1_00 })]));
  assert.ok(block.caveat, 'a clipped comparison carries its caveat');
});

test('with no earlier period the comparisons remove themselves', () => {
  const alone = data([movement({ amount: -10_000_00 })]);
  assert.equal(versusBefore(alone), null);
  assert.equal(categoriesVersusBefore(alone), null);
  assert.equal(unusualJumps(alone), null);
});

test('the categories are compared in the order they cost TODAY', () => {
  const block = categoriesVersusBefore(withBefore(
    [movement({ amount: -10_000_00, label: 'Casa' }), movement({ amount: -90_000_00, label: 'Mercado' })],
    [movement({ amount: -900_000_00, label: 'Casa' })],
  ));
  assert.deepEqual(block.rows.map(row => row.label), ['Mercado', 'Casa']);
  // A habit that stopped is news too, so it is listed at nought rather than
  // dropped.
  assert.equal(block.rows[1].now.minor, 10_000_00);
});

// ---------------------------------------------------------------------------
// What changed, and why
// ---------------------------------------------------------------------------

test('a category that grew a lot and by enough is named, with why', () => {
  const block = unusualJumps(withBefore(
    [
      movement({ amount: -500_000_00, label: 'Casa', note: 'Lavadora nueva' }),
      movement({ amount: -500_000_00, label: 'Mercado' }),
    ],
    [
      movement({ amount: -100_000_00, label: 'Casa' }),
      movement({ amount: -500_000_00, label: 'Mercado' }),
    ],
  ));

  assert.equal(block.lines.length, 1, 'Mercado did not move and is not mentioned');
  assert.ok(block.lines[0].text.includes('Casa'));
  assert.ok(block.lines[0].text.includes('400'), 'the percentage it grew by');
  assert.ok(block.lines[0].text.includes('Lavadora nueva'), 'and the movement behind it');
});

test('a big proportion of a small amount is not a jump worth reading', () => {
  // 1,000 to 3,000 is +200% and explains nothing about a million-peso month.
  const block = unusualJumps(withBefore(
    [movement({ amount: -3_000_00, label: 'Chicles' }), movement({ amount: -1_000_000_00, label: 'Mercado' })],
    [movement({ amount: -1_000_00, label: 'Chicles' }), movement({ amount: -1_000_000_00, label: 'Mercado' })],
  ));
  assert.equal(block, null);
});

test('a lot of money that moved a little is not a jump either', () => {
  const block = unusualJumps(withBefore(
    [movement({ amount: -1_100_000_00, label: 'Mercado' })],
    [movement({ amount: -1_000_000_00, label: 'Mercado' })],
  ));
  assert.equal(block, null, '+10% is not news however large the sum');
});

// ---------------------------------------------------------------------------
// Several months at once
// ---------------------------------------------------------------------------

test('the months above the average are named', () => {
  const over = overMonths(month => [
    movement({ amount: month === '2026-04' ? -900_000_00 : -100_000_00, on: `${month}-10` }),
  ]);

  const block = spendingByMonth(over);
  assert.equal(block.points.length, 9);
  assert.equal(block.aboveAverage.length, 1);
  assert.ok(block.aboveAverage[0].includes('2026'));
});

test('every month of the period is a point, even one with nothing in it', () => {
  const over = overMonths(month =>
    month === '2026-05' ? [] : [movement({ amount: -100_000_00, on: `${month}-10` })]);

  const block = spendingByMonth(over);
  assert.equal(block.points.length, 9, 'a month that cost nothing is a zero, not a gap');
  assert.equal(block.points[4].value.minor, 0);
});

test('one month is not a trend', () => {
  assert.equal(spendingByMonth(data([movement({ amount: -10_000_00 })])), null);
});

test('a category in most months is recurring; one in two is not', () => {
  const over = overMonths(month => [
    movement({ amount: -50_000_00, on: `${month}-05`, label: 'Mercado' }),
    ...(month === '2026-01' || month === '2026-02'
      ? [movement({ amount: -900_000_00, on: `${month}-06`, label: 'Vuelos' })]
      : []),
  ]);

  const block = recurringSpending(over);
  assert.deepEqual(block.rows.map(row => row.label), ['Mercado']);
  assert.equal(block.rows[0].behind, 9, 'the months it appeared in, not the movements');
});

test('a short period is not asked which of its habits are habits', () => {
  assert.equal(recurringSpending(data([movement({ amount: -10_000_00 })])), null);
  assert.equal(repeatedCharges(data([movement({ amount: -10_000_00 })])), null);
});

test('the same charge every month is found by its note and its size', () => {
  const over = overMonths(month => [
    movement({ amount: -44_900_00, on: `${month}-03`, note: 'Netflix', label: 'Tecnologia' }),
    // The same words over amounts all over the place: a habit of writing, not
    // a subscription.
    movement({
      amount: month === '2026-01' ? -10_000_00 : -300_000_00,
      on: `${month}-07`, note: 'Mercado', label: 'Mercado',
    }),
  ]);

  const block = repeatedCharges(over);
  assert.deepEqual(block.rows.map(row => row.label), ['Netflix']);
  assert.equal(block.rows[0].behind, 9);
  // The total is what it costs in ONE month, not over the whole period: that
  // is the figure anyone budgets against.
  assert.equal(block.total.minor, 44_900_00);
});

test('a charge is the same charge whatever case or accent it was typed in', () => {
  const over = overMonths(month => [
    movement({
      amount: -44_900_00, on: `${month}-03`,
      note: month === '2026-01' ? 'NETFLIX' : month === '2026-02' ? 'Nétflix' : 'netflix',
    }),
  ]);

  const block = repeatedCharges(over);
  assert.equal(block.rows.length, 1);
  assert.equal(block.rows[0].behind, 9);
});

test('two months of a charge is not yet a subscription', () => {
  const over = overMonths(month =>
    (month === '2026-01' || month === '2026-02')
      ? [movement({ amount: -44_900_00, on: `${month}-03`, note: 'Netflix' })]
      : []);
  assert.equal(repeatedCharges(over), null);
});
