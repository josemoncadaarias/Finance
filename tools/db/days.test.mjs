// Walking calendar days as ISO text.
//
//   node --import ./tools/db/register-ts.mjs --test tools/db/days.test.mjs
//
// Small, and worth having: an off-by-one here pays a day of interest twice or
// never, quietly, for years.

import test from 'node:test';
import assert from 'node:assert/strict';

import { addDays, nextDay, daysBetween, startOfMonth, endOfMonth, monthOf, eachDay }
  from '../../src/app/core/yields/days.ts';

test('the next day, over the ends of months and years', () => {
  assert.equal(nextDay('2026-09-09'), '2026-09-10');
  assert.equal(nextDay('2026-09-30'), '2026-10-01');
  assert.equal(nextDay('2026-12-31'), '2027-01-01');
  // 2028 is a leap year, so February has a 29th.
  assert.equal(nextDay('2028-02-28'), '2028-02-29');
  assert.equal(nextDay('2027-02-28'), '2027-03-01');
});

test('adding days works backwards too', () => {
  assert.equal(addDays('2026-09-09', 30), '2026-10-09');
  assert.equal(addDays('2026-09-01', -1), '2026-08-31');
  assert.equal(addDays('2026-01-01', -1), '2025-12-31');
  assert.equal(addDays('2026-09-09', 0), '2026-09-09');
});

test('a day does not shift when the clock changes', () => {
  // Colombia has no daylight saving, but the phone running this may be set to
  // somewhere that does. Working in UTC is what keeps a day 24 hours long
  // rather than 23 or 25 twice a year.
  for (const day of ['2026-03-08', '2026-11-01', '2026-10-25', '2026-03-29']) {
    assert.equal(daysBetween(day, nextDay(day)), 1, day);
  }
});

test('the distance between two days', () => {
  assert.equal(daysBetween('2026-09-09', '2026-09-09'), 0);
  assert.equal(daysBetween('2026-09-09', '2026-10-09'), 30);
  assert.equal(daysBetween('2026-10-09', '2026-09-09'), -30);
  // A full non-leap year.
  assert.equal(daysBetween('2026-01-01', '2027-01-01'), 365);
  assert.equal(daysBetween('2028-01-01', '2029-01-01'), 366);
});

test('the month a day belongs to', () => {
  assert.equal(startOfMonth('2026-09-09'), '2026-09-01');
  assert.equal(startOfMonth('2026-09-01'), '2026-09-01');
  assert.equal(monthOf('2026-09-09'), '2026-09');

  assert.equal(endOfMonth('2026-09-09'), '2026-09-30');
  assert.equal(endOfMonth('2026-02-01'), '2026-02-28');
  assert.equal(endOfMonth('2028-02-01'), '2028-02-29');
  assert.equal(endOfMonth('2026-12-31'), '2026-12-31');
});

test('every day in a range, inclusive at both ends', () => {
  assert.deepEqual(eachDay('2026-09-09', '2026-09-12'),
    ['2026-09-09', '2026-09-10', '2026-09-11', '2026-09-12']);
  assert.deepEqual(eachDay('2026-09-09', '2026-09-09'), ['2026-09-09']);
  assert.deepEqual(eachDay('2026-09-10', '2026-09-09'), [], 'a range that ends before it starts is empty');
  assert.equal(eachDay('2026-01-01', '2026-12-31').length, 365);
});
