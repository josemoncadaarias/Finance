// Tests for the period filter.
//
//   node --import ./tools/db/register-ts.mjs --test tools/db/period.test.mjs
//
// Pure date arithmetic, which is exactly the kind of code that looks obviously
// right and is off by one at month ends and daylight boundaries.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  periodContaining, currentPeriod, shiftPeriod, rangePeriod, includesToday,
  periodLabel, isoDay, fromIsoDay, ALL_TIME,
} from '../../src/app/core/filters/period.ts';

const on = (iso) => fromIsoDay(iso);

test('an ISO day survives a round trip in local time', () => {
  // new Date('2026-09-08') parses as UTC and lands on the 7th in Colombia.
  // fromIsoDay must not do that.
  for (const iso of ['2026-09-08', '2021-01-01', '2024-02-29', '2026-12-31']) {
    assert.equal(isoDay(fromIsoDay(iso)), iso);
  }
});

test('a day is itself, at both ends', () => {
  assert.deepEqual(periodContaining('day', on('2026-09-08')),
    { kind: 'day', from: '2026-09-08', to: '2026-09-08' });
});

test('a week runs Monday to Sunday', () => {
  // 2026-09-08 is a Tuesday.
  assert.deepEqual(periodContaining('week', on('2026-09-08')),
    { kind: 'week', from: '2026-09-07', to: '2026-09-13' });

  // A Sunday belongs to the week that started the Monday before it, not the
  // one about to start.
  assert.deepEqual(periodContaining('week', on('2026-09-13')),
    { kind: 'week', from: '2026-09-07', to: '2026-09-13' });

  // A Monday is the first day of its own week.
  assert.deepEqual(periodContaining('week', on('2026-09-07')),
    { kind: 'week', from: '2026-09-07', to: '2026-09-13' });
});

test('a month ends on its real last day', () => {
  assert.deepEqual(periodContaining('month', on('2026-09-08')),
    { kind: 'month', from: '2026-09-01', to: '2026-09-30' });
  assert.deepEqual(periodContaining('month', on('2026-02-15')),
    { kind: 'month', from: '2026-02-01', to: '2026-02-28' });
  // A leap year, which a naive "28 days" would get wrong.
  assert.deepEqual(periodContaining('month', on('2024-02-15')),
    { kind: 'month', from: '2024-02-01', to: '2024-02-29' });
  assert.deepEqual(periodContaining('month', on('2026-12-31')),
    { kind: 'month', from: '2026-12-01', to: '2026-12-31' });
});

test('a year is the whole year', () => {
  assert.deepEqual(periodContaining('year', on('2026-09-08')),
    { kind: 'year', from: '2026-01-01', to: '2026-12-31' });
});

test('all time has no bounds', () => {
  assert.deepEqual(periodContaining('all', on('2026-09-08')), ALL_TIME);
  assert.equal(ALL_TIME.from, null);
});

test('stepping a month never skips one', () => {
  // The trap: stepping back from the 31st. A naive setMonth(-1) on 31 March
  // lands on 3 March, skipping February entirely.
  let period = periodContaining('month', on('2026-03-31'));
  assert.deepEqual(period, { kind: 'month', from: '2026-03-01', to: '2026-03-31' });

  period = shiftPeriod(period, -1);
  assert.deepEqual(period, { kind: 'month', from: '2026-02-01', to: '2026-02-28' });

  period = shiftPeriod(period, -1);
  assert.deepEqual(period, { kind: 'month', from: '2026-01-01', to: '2026-01-31' });

  // And across a year boundary, in both directions.
  period = shiftPeriod(period, -1);
  assert.deepEqual(period, { kind: 'month', from: '2025-12-01', to: '2025-12-31' });
  period = shiftPeriod(period, 1);
  assert.deepEqual(period, { kind: 'month', from: '2026-01-01', to: '2026-01-31' });
});

test('a year of monthly steps returns to where it started', () => {
  const start = periodContaining('month', on('2026-09-08'));
  let period = start;
  for (let i = 0; i < 12; i++) period = shiftPeriod(period, -1);
  for (let i = 0; i < 12; i++) period = shiftPeriod(period, 1);
  assert.deepEqual(period, start);
});

test('stepping days, weeks and years', () => {
  assert.deepEqual(shiftPeriod(periodContaining('day', on('2026-01-01')), -1),
    { kind: 'day', from: '2025-12-31', to: '2025-12-31' });

  assert.deepEqual(shiftPeriod(periodContaining('week', on('2026-09-08')), -1),
    { kind: 'week', from: '2026-08-31', to: '2026-09-06' });

  assert.deepEqual(shiftPeriod(periodContaining('year', on('2026-09-08')), -5),
    { kind: 'year', from: '2021-01-01', to: '2021-12-31' });
});

test('all time and a custom range do not step', () => {
  assert.deepEqual(shiftPeriod(ALL_TIME, -1), ALL_TIME);
  const range = rangePeriod('2026-01-01', '2026-03-15');
  assert.deepEqual(shiftPeriod(range, 1), range);
});

test('a range put in the wrong order is corrected', () => {
  assert.deepEqual(rangePeriod('2026-03-15', '2026-01-01'),
    { kind: 'range', from: '2026-01-01', to: '2026-03-15' });
});

test('the app can tell when it is already at the newest period', () => {
  const today = on('2026-09-08');
  assert.equal(includesToday(periodContaining('month', today), today), true);
  assert.equal(includesToday(shiftPeriod(periodContaining('month', today), -1), today), false);
  assert.equal(includesToday(ALL_TIME, today), true);
});

test('labels say enough to be unambiguous', () => {
  assert.equal(periodLabel(periodContaining('month', on('2026-09-08'))), 'septiembre 2026');
  assert.equal(periodLabel(periodContaining('year', on('2026-09-08'))), '2026');
  assert.equal(periodLabel(periodContaining('day', on('2026-09-08'))), 'martes 8 de septiembre');
  assert.equal(periodLabel(ALL_TIME), 'Todo');

  // A week inside one month, and a week that straddles two.
  assert.equal(periodLabel(periodContaining('week', on('2026-09-08'))), '7–13 de septiembre');
  assert.equal(periodLabel(periodContaining('week', on('2026-09-02'))), '31 agosto – 6 septiembre');

  // The year is always present on a month label: five years of history make
  // "septiembre" on its own a trap.
  assert.match(periodLabel(periodContaining('month', on('2021-06-08'))), /2021/);
});

test('currentPeriod is the period around today', () => {
  const today = on('2026-09-08');
  assert.deepEqual(currentPeriod('month', today), periodContaining('month', today));
});
