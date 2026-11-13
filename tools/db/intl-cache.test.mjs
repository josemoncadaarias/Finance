// Formatters made once and kept (2026-11-13: ion-datetime built ~400 per tap
// on a day, which is what made the calendar slow on the phone). Every answer
// must be exactly the engine's own.
//
//   node --import ./tools/db/register-ts.mjs --test tools/db/intl-cache.test.mjs

import test from 'node:test';
import assert from 'node:assert/strict';

const native = {
  dtf: Intl.DateTimeFormat,
  nf: Intl.NumberFormat,
  date: Date.prototype.toLocaleDateString,
  time: Date.prototype.toLocaleTimeString,
  both: Date.prototype.toLocaleString,
  num: Number.prototype.toLocaleString,
  cmp: String.prototype.localeCompare,
};

const { installIntlCache } = await import('../../src/app/core/perf/intl-cache.ts');
installIntlCache();

const day = new Date(Date.UTC(2026, 10, 13, 15, 4, 5));
const dateOptions = [
  undefined,
  {},
  { day: 'numeric' },
  { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' },
  { month: 'short', year: 'numeric' },
  { hour: 'numeric', minute: '2-digit' },
  { dateStyle: 'medium' },
  { hour: '2-digit' },
];

test('the same locale and options give the same formatter, with or without new', () => {
  const a = new Intl.DateTimeFormat('es-CO', { day: 'numeric', timeZone: 'UTC' });
  const b = new Intl.DateTimeFormat('es-CO', { day: 'numeric', timeZone: 'UTC' });
  const c = Intl.DateTimeFormat('es-CO', { day: 'numeric', timeZone: 'UTC' });
  assert.equal(a, b);
  assert.equal(a, c);
  assert.ok(a instanceof Intl.DateTimeFormat);
  assert.ok(a instanceof native.dtf);
  assert.notEqual(a, new Intl.DateTimeFormat('en-US', { day: 'numeric', timeZone: 'UTC' }));
  assert.deepEqual(Intl.DateTimeFormat.supportedLocalesOf(['es-CO']), native.dtf.supportedLocalesOf(['es-CO']));
});

test('formatters answer as the native ones', () => {
  for (const locale of [undefined, 'es-CO', 'en-US']) {
    for (const options of dateOptions) {
      assert.equal(new Intl.DateTimeFormat(locale, options).format(day), new native.dtf(locale, options).format(day));
    }
    const n = { minimumFractionDigits: 2, maximumFractionDigits: 2 };
    assert.equal(new Intl.NumberFormat(locale, n).format(1234567.891), new native.nf(locale, n).format(1234567.891));
  }
});

/** The text, or the error's name: a refusal must stay a refusal. */
const outcome = run => { try { return run(); } catch (error) { return `throws ${error.name}`; } };

test('toLocale* and localeCompare answer as the native ones', () => {
  for (const locale of [undefined, 'es-CO', 'en-US']) {
    for (const options of dateOptions) {
      assert.equal(outcome(() => day.toLocaleDateString(locale, options)), outcome(() => native.date.call(day, locale, options)));
      assert.equal(outcome(() => day.toLocaleTimeString(locale, options)), outcome(() => native.time.call(day, locale, options)));
      assert.equal(outcome(() => day.toLocaleString(locale, options)), outcome(() => native.both.call(day, locale, options)));
    }
    assert.equal((1234.5).toLocaleString(locale, { style: 'percent' }), native.num.call(1234.5, locale, { style: 'percent' }));
    assert.equal((1234.5).toLocaleString(locale), native.num.call(1234.5, locale));
    assert.equal('ábaco'.localeCompare('Zeta', locale, { sensitivity: 'base' }), native.cmp.call('ábaco', 'Zeta', locale, { sensitivity: 'base' }));
    assert.equal('ábaco'.localeCompare('abaco', locale), native.cmp.call('ábaco', 'abaco', locale));
  }
  assert.equal(new Date(NaN).toLocaleDateString('es-CO', { day: 'numeric' }), 'Invalid Date');
});
