// Tests for picking the newest export file.
//
//   node --import ./tools/db/register-ts.mjs --test tools/db/export-naming.test.mjs

import test from 'node:test';
import assert from 'node:assert/strict';

import { exportOrder } from './import.mjs';

test('a name without a time sorts as the earliest that day', () => {
  // The bug this exists to prevent: plain string order puts
  // monefy-2026-09-08-1748.csv BEFORE monefy-2026-09-08.csv, because '-'
  // sorts before '.'. The importer then silently picked the older file.
  const withTime = 'monefy-2026-09-08-1748.csv';
  const withoutTime = 'monefy-2026-09-08.csv';

  assert.ok(withTime < withoutTime, 'string order really is wrong; that is the trap');
  assert.ok(exportOrder(withoutTime) < exportOrder(withTime), 'parsed order fixes it');
});

test('exports sort chronologically across days and times', () => {
  const names = [
    'monefy-2026-09-08-1748.csv',
    'monefy-2026-09-07.csv',
    'monefy-2026-10-01.csv',
    'monefy-2026-09-08.csv',
    'monefy-2026-09-08-0930.csv',
  ];

  const sorted = [...names].sort((a, b) => exportOrder(a).localeCompare(exportOrder(b)));

  assert.deepEqual(sorted, [
    'monefy-2026-09-07.csv',
    'monefy-2026-09-08.csv',
    'monefy-2026-09-08-0930.csv',
    'monefy-2026-09-08-1748.csv',
    'monefy-2026-10-01.csv',
  ]);
});

test('anything not matching the convention is ignored, not guessed at', () => {
  assert.equal(exportOrder('Monefy.Data.8-9-2026.csv'), null);
  assert.equal(exportOrder('notes.md'), null);
  assert.equal(exportOrder('monefy-2026-9-8.csv'), null, 'months and days need two digits');
  assert.equal(exportOrder('monefy-2026-09-08-174.csv'), null, 'a time needs four digits');
});
