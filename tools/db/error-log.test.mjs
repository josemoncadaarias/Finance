// The errors kept for a report (core/feedback/error-log.ts): what broke and
// where, never a figure. Invented errors only.
//
//   node --import ./tools/db/register-ts.mjs --test tools/db/error-log.test.mjs

import test from 'node:test';
import assert from 'node:assert/strict';

const store = new Map();
globalThis.localStorage = { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, v), removeItem: k => store.delete(k) };

const { describe, errorsText, keptErrors, noteError } = await import('../../src/app/core/feedback/error-log.ts');

test('an error is kept with its name, a message with no figures, and where it happened', () => {
  const e = new TypeError('Cannot read 45.900,00 of undefined for account 123456');
  e.stack = 'TypeError: x\n    at save (https://localhost/main-ABC123.js:10:5)\n    at run (https://localhost/chunk-XYZ.js:88:12)';
  const d = describe(e, new Date('2026-10-28T10:00:00Z'));
  assert.equal(d.name, 'TypeError');
  assert.equal(d.message, 'Cannot read # of undefined for account #');
  assert.deepEqual(d.where, ['main-ABC123.js:10', 'chunk-XYZ.js:88']);
});

test('the last five are kept, a repeat only once, the old ones dropped', () => {
  store.clear();
  const day = new Date('2026-10-28T10:00:00Z');
  for (let i = 0; i < 7; i++) noteError(new Error(`fallo ${String.fromCharCode(97 + i)}`), day);
  noteError(new Error('fallo g'), day);
  const kept = keptErrors(day);
  assert.equal(kept.length, 5);
  assert.equal(kept.filter(e => e.message === 'fallo g').length, 1);
  assert.equal(keptErrors(new Date('2026-12-01T10:00:00Z')).length, 0, 'two weeks later, nothing');
  assert.match(errorsText(kept), /Error: fallo g/);
});

test('a promise refused with no Error inside is still kept', () => {
  const d = describe({ rejection: { name: 'SqlError', message: 'constraint failed' } });
  assert.equal(d.name, 'SqlError');
  assert.equal(d.message, 'constraint failed');
});
