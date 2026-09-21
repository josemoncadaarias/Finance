// The financial summary: the analyses, and the spreadsheet they become.
//
//   node --import ./tools/db/register-ts.mjs --test tools/db/report.test.mjs
//
// The analyses are pure functions, so they are tested directly on movements
// built by hand - no database, no browser. What is being checked is the
// arithmetic and the judgement: that a section with nothing to say removes
// itself, that a part-finished period is not averaged as a whole one, and
// that income is never given a share of what was spent.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  headlineFigures, categoryBreakdown, biggestMovements, spendingByAccount, buildReport, fill,
} from '../../src/app/core/report/sections.ts';
import { daysBetween, daysElapsed } from '../../src/app/core/report/report-data.ts';
import { TEST_WORDS } from '../../src/app/core/report/report-words.ts';
import { reportWorkbook, reportFileName } from '../../src/app/core/report/report-workbook.ts';
import { totalsOf } from '../../src/app/features/movements/group-movements.ts';

// ---------------------------------------------------------------------------
// Building movements to analyse
// ---------------------------------------------------------------------------

let nextId = 1;

/** One movement, the shape the summary screen hands over. */
function movement({
  amount, on = '2026-09-10', label = 'Mercado', flow = 'out',
  account = 'Rappi cuenta', accountId = 1, note = null, currency = 'COP', base = null,
}) {
  return {
    transaction: {
      id: nextId++,
      account_id: accountId,
      category_id: 1,
      occurred_on: on,
      amount_minor: amount,
      amount_base_minor: base ?? amount,
      description: note,
      transfer_id: null,
    },
    accountName: account,
    accountType: 'debit',
    currency,
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
    account: { id: 1, name: 'Rappi cuenta', currency_code: 'COP', builtin_icon: null, custom_icon_id: null },
    accounts: [],
    movements,
    basis: 'own',
    currency: 'COP',
    today: '2026-09-30',
    words: TEST_WORDS,
    ...extra,
  };
}

/** The figure beside a label, whatever kind it is. */
function figure(block, label) {
  const found = block.figures.find(one => one.label === TEST_WORDS[label]);
  assert.ok(found, `no figure for ${label}`);
  return found;
}

// ---------------------------------------------------------------------------

test('the headline figures are the period added up', () => {
  const block = headlineFigures(data([
    movement({ amount: -100_000_00, flow: 'out' }),
    movement({ amount: -50_000_00, flow: 'out' }),
    movement({ amount: 300_000_00, flow: 'in', label: 'Salario' }),
  ]));

  assert.equal(figure(block, 'report.headline.income').value.minor, 300_000_00);
  assert.equal(figure(block, 'report.headline.expenses').value.minor, 150_000_00);
  assert.equal(figure(block, 'report.headline.balance').value.minor, 150_000_00);
  assert.equal(figure(block, 'report.headline.movements').value.value, 3);

  // Half of what came in was left.
  assert.equal(figure(block, 'report.headline.saved').value.value, 50);
});

test('the figures are the summary screen\'s own arithmetic', () => {
  // The report must never be able to disagree with the screen the user came
  // from, which is only guaranteed while it runs the screen's own function.
  const movements = [
    movement({ amount: -80_000_00, flow: 'out' }),
    movement({ amount: 10_000_00, flow: 'refund' }),
    movement({ amount: 200_000_00, flow: 'in' }),
  ];
  const totals = totalsOf(movements, 'own');
  const block = headlineFigures(data(movements));

  assert.equal(figure(block, 'report.headline.expenses').value.minor, totals.outMinor);
  assert.equal(figure(block, 'report.headline.income').value.minor, totals.inMinor);
  // A refund came off the spending rather than adding to the income.
  assert.equal(totals.outMinor, 70_000_00);
});

test('what the categories add up to can be reconciled with the headline', () => {
  // Found on Jose's real August: the headline said 16.6M of spending and the
  // categories under it totalled 18.07M, with nothing on the page accounting
  // for the 1.47M between them. It was the money moved between his own
  // accounts - in the categories, as the donut has it, and missing from the
  // headline. Two totals that cannot be reconciled cost the trust of both.
  const movements = [
    movement({ amount: -100_000_00, flow: 'out', label: 'Mercado' }),
    movement({ amount: -30_000_00, flow: 'moved', label: 'a Pibank' }),
    movement({ amount: 500_000_00, flow: 'in', label: 'Salario' }),
  ];
  const block = headlineFigures(data(movements));
  const categories = categoryBreakdown(data(movements));

  const spent = figure(block, 'report.headline.expenses').value.minor;
  const moved = figure(block, 'summary.moved').value.minor;
  assert.equal(spent + moved, categories.total.minor);
});

test('nothing moved, nothing said about moving', () => {
  const block = headlineFigures(data([movement({ amount: -10_000_00 })]));
  assert.equal(block.figures.some(one => one.label === TEST_WORDS['summary.moved']), false);
});

test('spending more than came in is said, not only shown', () => {
  const block = headlineFigures(data([
    movement({ amount: -300_000_00, flow: 'out' }),
    movement({ amount: 100_000_00, flow: 'in' }),
  ]));

  const balance = figure(block, 'report.headline.balance');
  assert.equal(balance.value.minor, -200_000_00);
  assert.equal(balance.tone, 'bad');
  assert.equal(balance.note, TEST_WORDS['report.headline.overspent']);
});

test('with nothing coming in there is no share of it', () => {
  // 400% of nothing would divide by zero; "you kept -Infinity%" helps nobody.
  const block = headlineFigures(data([movement({ amount: -50_000_00, flow: 'out' })]));
  const found = block.figures.find(one => one.label === TEST_WORDS['report.headline.saved']);
  assert.equal(found, undefined);
});

test('a period with no movements has nothing to say', () => {
  assert.equal(headlineFigures(data([])), null);
  assert.equal(categoryBreakdown(data([])), null);
});

// ---------------------------------------------------------------------------

test('the daily average is over the days that have happened', () => {
  // The 10th of a 30-day month: 9 days of spending averaged over 30 would
  // read two thirds low, and low is the direction the user wants to believe.
  const partial = data(
    [movement({ amount: -90_000_00, on: '2026-09-05' })],
    { today: '2026-09-10' },
  );

  const { days, whole } = daysElapsed(partial);
  assert.equal(days, 10);
  assert.equal(whole, false);

  const perDay = figure(headlineFigures(partial), 'report.headline.perDay');
  assert.equal(perDay.value.minor, 9_000_00);
  // And it says what it was divided by, rather than leaving it to be assumed.
  assert.ok(perDay.note?.includes('10'));
});

test('a period already over is averaged over all of it, and says nothing', () => {
  const over = data([movement({ amount: -300_000_00 })], { today: '2026-10-15' });
  const { days, whole } = daysElapsed(over);

  assert.equal(days, 30);
  assert.equal(whole, true);
  assert.equal(figure(headlineFigures(over), 'report.headline.perDay').note, undefined);
});

test('days are counted with both ends in', () => {
  assert.equal(daysBetween('2026-09-01', '2026-09-30'), 30);
  assert.equal(daysBetween('2026-09-01', '2026-09-01'), 1);
});

// ---------------------------------------------------------------------------

test('the categories carry the donut\'s own percentages', () => {
  const block = categoryBreakdown(data([
    movement({ amount: -75_000_00, label: 'Mercado' }),
    movement({ amount: -25_000_00, label: 'Transporte' }),
    movement({ amount: 500_000_00, label: 'Salario', flow: 'in' }),
  ]));

  const mercado = block.rows.find(row => row.label === 'Mercado');
  const transporte = block.rows.find(row => row.label === 'Transporte');
  assert.equal(mercado.share, 75);
  assert.equal(transporte.share, 25);

  // Income has no share of what was spent: an empty cell, not a nought.
  const salario = block.rows.find(row => row.label === 'Salario');
  assert.equal(salario.share, undefined);

  // The total is what left, not everything that moved.
  assert.equal(block.total.minor, 100_000_00);
});

test('the categories say how many movements are behind each', () => {
  const block = categoryBreakdown(data([
    movement({ amount: -10_000_00, label: 'Mercado' }),
    movement({ amount: -20_000_00, label: 'Mercado' }),
    movement({ amount: -30_000_00, label: 'Transporte' }),
  ]));

  assert.equal(block.rows.find(row => row.label === 'Mercado').behind, 2);
  assert.equal(block.rows.find(row => row.label === 'Transporte').behind, 1);
});

// ---------------------------------------------------------------------------

test('the biggest movements are the biggest, and only when there are enough', () => {
  const few = [1, 2, 3].map(n => movement({ amount: -n * 1_000_00 }));
  assert.equal(biggestMovements(data(few)), null, 'three movements is just the list again');

  const many = [5, 90, 20, 7, 60, 1].map(n => movement({ amount: -n * 1_000_00 }));
  const block = biggestMovements(data(many));
  assert.deepEqual(block.rows.map(row => row.value.minor), [90, 60, 20, 7, 5, 1].map(n => n * 1_000_00));
});

test('income is never one of the biggest expenses', () => {
  const movements = [
    movement({ amount: 900_000_00, flow: 'in', label: 'Salario' }),
    ...[5, 4, 3, 2, 1].map(n => movement({ amount: -n * 1_000_00 })),
  ];
  const block = biggestMovements(data(movements));
  assert.equal(block.rows.length, 5);
  assert.ok(block.rows.every(row => row.value.minor <= 5_000_00));
});

// ---------------------------------------------------------------------------

test('the account breakdown is only asked when several accounts are in scope', () => {
  const movements = [
    movement({ amount: -60_000_00, account: 'Rappi', accountId: 1 }),
    movement({ amount: -40_000_00, account: 'Nu', accountId: 2 }),
  ];

  // One account chosen: the answer is the whole report already.
  assert.equal(spendingByAccount(data(movements)), null);

  const block = spendingByAccount(data(movements, { account: null }));
  assert.deepEqual(block.rows.map(row => row.label), ['Rappi', 'Nu']);
  assert.equal(block.rows[0].share, 60);
  assert.equal(block.total.minor, 100_000_00);
});

test('one account\'s worth of movements is not a breakdown', () => {
  const block = spendingByAccount(data(
    [movement({ amount: -60_000_00 }), movement({ amount: -40_000_00 })],
    { account: null },
  ));
  assert.equal(block, null);
});

// ---------------------------------------------------------------------------

test('the report is the sections that had something to say, in order', () => {
  const blocks = buildReport(data([
    movement({ amount: -10_000_00 }),
    movement({ amount: 50_000_00, flow: 'in', label: 'Salario' }),
  ]));

  // Two movements: headline and categories speak, the biggest and the
  // accounts do not.
  assert.deepEqual(blocks.map(block => block.id), ['headline', 'categories']);
});

test('placeholders are filled, and an unknown one is left alone', () => {
  assert.equal(fill('van {days} de {total}', { days: 10, total: 30 }), 'van 10 de 30');
  assert.equal(fill('{unknown}', {}), '{unknown}');
});

// ---------------------------------------------------------------------------
// The file itself
// ---------------------------------------------------------------------------

/** The names of the parts inside the zip, read from its local headers. */
function partsOf(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const names = [];
  let at = 0;
  while (at + 4 <= bytes.length && view.getUint32(at, true) === 0x04034b50) {
    const nameLength = view.getUint16(at + 26, true);
    const extraLength = view.getUint16(at + 28, true);
    const size = view.getUint32(at + 18, true);
    names.push(new TextDecoder().decode(bytes.subarray(at + 30, at + 30 + nameLength)));
    at += 30 + nameLength + extraLength + size;
  }
  return names;
}

test('the workbook is a real zip with a sheet for each half of the answer', () => {
  const bytes = reportWorkbook(data([
    movement({ amount: -10_000_00, note: 'Mercado del sabado' }),
    movement({ amount: 50_000_00, flow: 'in', label: 'Salario' }),
  ]));

  const parts = partsOf(bytes);
  assert.ok(parts.includes('xl/worksheets/sheet1.xml'), 'the summary');
  assert.ok(parts.includes('xl/worksheets/sheet2.xml'), 'the movements');
  assert.ok(parts.includes('xl/workbook.xml'));
  assert.ok(parts.includes('xl/styles.xml'));
  // Every sheet has to be declared, or Excel calls the file corrupt.
  assert.ok(parts.includes('[Content_Types].xml'));
});

test('the file is named for the period it covers', () => {
  const name = reportFileName(data([]));
  assert.ok(name.includes('2026-09-01'));
  assert.ok(name.includes('2026-09-30'));
});

test('money reaches the sheet as a number, not as text', () => {
  // A column of text cannot be added up, and being able to add it up is the
  // whole reason for handing over a spreadsheet instead of a picture.
  const bytes = reportWorkbook(data([movement({ amount: -12_345_67 })]));
  const xml = new TextDecoder().decode(bytes);
  assert.ok(xml.includes('<v>-12345.67</v>'), 'the amount as a number');
});
