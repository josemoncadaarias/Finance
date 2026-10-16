// What the person pays for, read from the store (core/paywall/subscription.ts).
//
//   node --import ./tools/db/register-ts.mjs --test tools/db/subscription.test.mjs

import test from 'node:test';
import assert from 'node:assert/strict';

import { changeModeFor, daysLeft, planOf, subscriptionOf } from '../../src/app/core/paywall/subscription.ts';

test('the plan, however Google Play names it', () => {
  assert.equal(planOf({ productIdentifier: 'finance_pro', productPlanIdentifier: 'monthly' }), 'monthly');
  assert.equal(planOf({ productIdentifier: 'finance_pro', productPlanIdentifier: 'yearly' }), 'yearly');
  assert.equal(planOf({ productIdentifier: 'finance_pro:yearly' }), 'yearly');
  assert.equal(planOf({ productIdentifier: 'finance_pro:monthly', productPlanIdentifier: null }), 'monthly');
  assert.equal(planOf({ productIdentifier: 'pro_annual' }), 'yearly');
  assert.equal(planOf({ productIdentifier: 'finance_pro' }), null);
});

test('a monthly plan in its trial', () => {
  const s = subscriptionOf({ finance_pro: {
    productIdentifier: 'finance_pro', productPlanIdentifier: 'monthly', periodType: 'TRIAL',
    willRenew: true, expirationDate: '2026-10-22T12:00:00Z',
  } }, 'https://play.google.com/store/account/subscriptions');
  assert.deepEqual(s, {
    plan: 'monthly', trial: true, renews: true, until: '2026-10-22T12:00:00Z',
    productId: 'finance_pro', manageUrl: 'https://play.google.com/store/account/subscriptions',
  });
});

test('cancelled is active until its date and does not renew', () => {
  const s = subscriptionOf({ x: {
    productIdentifier: 'finance_pro:yearly', periodType: 'NORMAL', willRenew: false, expirationDate: '2027-10-16T00:00:00Z',
  } }, null);
  assert.equal(s.plan, 'yearly');
  assert.equal(s.trial, false);
  assert.equal(s.renews, false);
  assert.equal(s.productId, 'finance_pro');
});

test('nothing active is no subscription', () => {
  assert.equal(subscriptionOf({}, null), null);
});

test('to the year at once, to the month when the year is over', () => {
  assert.equal(changeModeFor('yearly'), 'WITH_TIME_PRORATION');
  assert.equal(changeModeFor('monthly'), 'DEFERRED');
});

test('days left are whole and never negative', () => {
  const now = new Date('2026-10-16T10:00:00Z');
  assert.equal(daysLeft('2026-10-22T09:00:00Z', now), 6);
  assert.equal(daysLeft('2026-10-16T10:03:00Z', now), 1);
  assert.equal(daysLeft('2026-10-15T00:00:00Z', now), 0);
  assert.equal(daysLeft(null, now), 0);
});
