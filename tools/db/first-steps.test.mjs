// "Primeros pasos" on Inicio (mockups 44a-44e).
//
//   node --import ./tools/db/register-ts.mjs --test tools/db/first-steps.test.mjs

import test from 'node:test';
import assert from 'node:assert/strict';

import { firstStepsShown, nextStep, stepsOf } from '../../src/app/core/ui/first-steps.ts';

const facts = extra => ({ accounts: 1, expenses: 0, caps: 0, drive: false, notices: false,
  firstAccountOn: '2026-10-29', today: '2026-10-29', ...extra });

test('five steps on a phone, the first one done once there is an account (44a)', () => {
  const steps = stepsOf(facts());
  assert.deepEqual(steps.map(s => s.id), ['account', 'expense', 'cap', 'drive', 'notices']);
  assert.deepEqual(steps.map(s => s.done), [true, false, false, false, false]);
  assert.equal(nextStep(steps), 'expense');
});

test('each step ticks by itself when it happens (44c)', () => {
  const steps = stepsOf(facts({ expenses: 3, caps: 1 }));
  assert.deepEqual(steps.map(s => s.done), [true, true, true, false, false]);
  assert.equal(nextStep(steps), 'drive');
  assert.equal(nextStep(stepsOf(facts({ expenses: 1, caps: 1, drive: true, notices: true }))), null);
});

test('what the phone cannot do is no step: a browser has three', () => {
  assert.deepEqual(stepsOf(facts({ drive: null, notices: null })).map(s => s.id), ['account', 'expense', 'cap']);
});

test('only for a new app, with an account, not hidden', () => {
  assert.equal(firstStepsShown(facts(), false), true);
  assert.equal(firstStepsShown(facts(), true), false);
  assert.equal(firstStepsShown(facts({ accounts: 0 }), false), false);
  assert.equal(firstStepsShown(facts({ firstAccountOn: '2026-10-01' }), false), true);
  // A backup restored keeps its accounts' dates: somebody coming back is not taught.
  assert.equal(firstStepsShown(facts({ firstAccountOn: '2026-09-29' }), false), false);
  assert.equal(firstStepsShown(facts({ firstAccountOn: '2024-01-05' }), false), false);
});
