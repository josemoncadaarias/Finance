// "Personaliza tu vista": the order of each screen's blocks
// (core/ui/view-order.ts), as ViewPrefsService keeps it and the report reads it.
//
//   node --import ./tools/db/register-ts.mjs --test tools/db/view-prefs.test.mjs

import test from 'node:test';
import assert from 'node:assert/strict';

import { firstFace, inOrder, movedKeys, orderedBlocks, VIEW_SCREENS } from '../../src/app/core/ui/view-order.ts';

const keys = (s, stored = []) => orderedBlocks(s, stored).map(b => b.key);

test('the app comes in its own order, and Inicio opens on the chart', () => {
  assert.deepEqual(keys('home'), ['home.attention', 'home.figures', 'home.chart', 'home.list']);
  assert.equal(firstFace(keys('home')), 'chart');
});

test('a block dragged moves, and the list above the chart opens Inicio on the list', () => {
  const order = movedKeys('home', [], 3, 0);
  assert.deepEqual(keys('home', order), ['home.list', 'home.attention', 'home.figures', 'home.chart']);
  assert.equal(firstFace(keys('home', order)), 'list');
});

test('a pinned block stays first and is not among the movable ones', () => {
  assert.deepEqual(keys('debts', movedKeys('debts', [], 1, 0)), ['debts.total', 'debts.loans', 'debts.cards']);
  const report = keys('report', movedKeys('report', [], 0, 3));
  assert.equal(report[0], 'report.headline');
  assert.equal(report[4], 'report.versus');
});

test('a block the stored order does not know yet comes after it, in its own place', () => {
  assert.deepEqual(keys('debts', ['debts.loans']), ['debts.total', 'debts.loans', 'debts.cards']);
  assert.equal(keys('report', ['report.biggest']).length, VIEW_SCREENS.report.blocks.length);
});

test('a drop out of range changes nothing', () => {
  assert.deepEqual(movedKeys('home', [], 9, 0), keys('home'));
});

test('the report follows the order, unknown ids after it as they came', () => {
  const blocks = ['headline', 'versus', 'jumps', 'by-month'].map(id => ({ id }));
  assert.deepEqual(inOrder(blocks, ['headline', 'by-month', 'versus']).map(b => b.id), ['headline', 'by-month', 'versus', 'jumps']);
  assert.deepEqual(inOrder(blocks, []).map(b => b.id), ['headline', 'versus', 'jumps', 'by-month']);
});
