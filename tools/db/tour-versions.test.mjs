// Every update brings its guide (Jose, 2026-10-14): a person who already saw a
// tour sees only its new steps, once; a new person sees the whole of it.
//
//   node --import ./tools/db/register-ts.mjs --test tools/db/tour-versions.test.mjs

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { parseSeenVersions, stepsToShow, versionOf } from '../../src/app/core/tour/tour-versions.ts';

const tour = { steps: [{ t: 'a' }, { t: 'b' }, { t: 'c', since: 2 }, { t: 'd', since: 3 }] };

test('a tour is as new as its newest step', () => {
  assert.equal(versionOf({ steps: [{}, {}] }), 1);
  assert.equal(versionOf(tour), 3);
});

test('never seen: everything; seen before: only what is newer; seen now: nothing', () => {
  assert.deepEqual(stepsToShow(tour, 0), { steps: tour.steps, news: false });
  assert.deepEqual(stepsToShow(tour, 1).steps.map(s => s.t), ['c', 'd']);
  assert.equal(stepsToShow(tour, 1).news, true);
  assert.deepEqual(stepsToShow(tour, 2).steps.map(s => s.t), ['d']);
  assert.equal(stepsToShow(tour, 3), null);
});

test('what a device saw before versions existed counts as version 1', () => {
  const seen = parseSeenVersions('home,review@2,gone@4,', { home: 1, review: 1 });
  assert.deepEqual([...seen], [['home', 1], ['review', 2]]);
});

test('every step a tour names has its words in both languages', () => {
  const service = readFileSync(new URL('../../src/app/core/tour/tour.service.ts', import.meta.url), 'utf8');
  const words = readFileSync(new URL('../../src/app/core/i18n/translations-ui.ts', import.meta.url), 'utf8');
  for (const [, key] of service.matchAll(/'(tour\.[a-z0-9.]+)'/gi)) {
    assert.equal(words.split(`'${key}':`).length - 1, 2, `${key} in Spanish and English`);
  }
});
