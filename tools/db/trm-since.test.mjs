// The day the TRM in force started to rule, so Monedas y TRM says "rige desde
// el 31 oct" after a holiday rather than "hoy" (Jose, 2026-11-03). Rows shaped
// as the app keeps them: each certified TRM on its day, plus today's copy.
//
//   node --import ./tools/db/register-ts.mjs --test tools/db/trm-since.test.mjs

import test from 'node:test';
import assert from 'node:assert/strict';

import { trmSince } from '../../src/app/core/rates/trm-since.ts';

const r = (on_date, value, source = 'trm') => ({ on_date, base_code: 'USD', quote_code: 'COP', rate_scaled: value * 100, source });

test('after a weekend and a holiday, the Friday-certified day', () => {
  const rows = [r('2026-11-03', 318299), r('2026-11-01', 318299), r('2026-10-31', 318299), r('2026-10-30', 316691)];
  assert.equal(trmSince(rows, '2026-11-03'), '2026-10-31');
});

test('a TRM certified for today rules since today', () => {
  assert.equal(trmSince([r('2026-11-04', 323000), r('2026-11-03', 318299)], '2026-11-04'), '2026-11-04');
});

test("tomorrow's published row does not count for today", () => {
  assert.equal(trmSince([r('2026-11-04', 323000), r('2026-11-03', 318299), r('2026-10-31', 318299)], '2026-11-03'), '2026-10-31');
});

test('a value typed by hand has no official since', () => {
  assert.equal(trmSince([r('2026-11-03', 325000, 'manual'), r('2026-10-31', 318299)], '2026-11-03'), null);
  assert.equal(trmSince([], '2026-11-03'), null);
});

test('a typed row breaks the run', () => {
  const rows = [r('2026-11-03', 318299), r('2026-11-01', 318299, 'manual'), r('2026-10-31', 318299)];
  assert.equal(trmSince(rows, '2026-11-03'), '2026-11-03');
});
