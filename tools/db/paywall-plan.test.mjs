// What is free and what is paid (core/paywall/plan.ts, rule 21).
//
//   node --import ./tools/db/register-ts.mjs --test tools/db/paywall-plan.test.mjs

import test from 'node:test';
import assert from 'node:assert/strict';

import { PLAN, canUse, freeLeft, inTrial, isUnlocked, reportSectionFree } from '../../src/app/core/paywall/plan.ts';

test('unlocked answers yes to everything', () => {
  for (const feature of Object.keys(PLAN)) assert.equal(canUse(feature, 999, true), true, feature);
});

test('the free allowances Jose decided', () => {
  assert.equal(canUse('statements', 0, false), true);
  assert.equal(canUse('statements', 1, false), false);
  assert.equal(canUse('products', 1, false), false);
  assert.equal(canUse('noticeSources', 0, false), true);
  assert.equal(canUse('noticeSources', 1, false), false);
  assert.equal(canUse('noticeMovements', 14, false), true);
  assert.equal(canUse('noticeMovements', 15, false), false);
  assert.equal(PLAN.noticeMovements.per, 'month');
  for (const f of ['currencies', 'tax', 'ownImages', 'reportExport', 'reportFull'])
    assert.equal(canUse(f, 0, false), false, f);
  for (const f of ['loans', 'limits', 'goals']) {
    assert.equal(canUse(f, 0, false), true, f);
    assert.equal(canUse(f, 1, false), false, f);
  }
  // Jose, 2026-10-30: a few categories of one's own are free.
  assert.equal(canUse('newCategories', 4, false), true);
  assert.equal(canUse('newCategories', 5, false), false);
  assert.equal(PLAN.newCategories.per, 'ever');
  assert.equal(freeLeft('noticeMovements', 12), 3);
  assert.equal(freeLeft('noticeMovements', 20), 0);
});

test('the report: four sections free, the rest paid', () => {
  for (const id of ['headline', 'versus', 'categories', 'biggest']) assert.ok(reportSectionFree(id), id);
  for (const id of ['jumps', 'recurring', 'repeated', 'by-month', 'ahead', 'accounts', 'categories-versus']) assert.ok(!reportSectionFree(id), id);
});

test('the trial lasts seven days', () => {
  assert.equal(inTrial('2026-10-01', '2026-10-01'), true);
  assert.equal(inTrial('2026-10-01', '2026-10-07'), true);
  assert.equal(inTrial('2026-10-01', '2026-10-08'), false);
  assert.equal(inTrial(null, '2026-10-08'), false);
});

test('who has everything open: a purchase always; nobody else once the app charges', () => {
  assert.equal(isUnlocked(true, true), true, 'a purchase, the trial or a grant opens everything');
  assert.equal(isUnlocked(false, true), false, 'without them the free version, wherever it charges');
  assert.equal(isUnlocked(false, false), true, 'where nothing can be bought, nothing is locked');
});

test('the assistant: 20 free questions a month (Jose, 2026-10-22)', () => {
  assert.equal(PLAN.assistant.free, 20);
  assert.equal(PLAN.assistant.per, 'month');
  assert.equal(canUse('assistant', 19, false), true);
  assert.equal(canUse('assistant', 20, false), false);
  assert.equal(canUse('assistant', 99, true), true);
});
