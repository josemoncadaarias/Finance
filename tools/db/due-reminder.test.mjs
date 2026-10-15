// A card's payment-day reminder (core/cards/due-reminder.ts).
//
//   node --import ./tools/db/register-ts.mjs --test tools/db/due-reminder.test.mjs

import test from 'node:test';
import assert from 'node:assert/strict';

import { duePlans, dueNoticeId, DUE_HOUR } from '../../src/app/core/cards/due-reminder.ts';

const statement = over => ({
  state: 'due', debtMinor: 60_000_000, cutOn: '2026-09-25', dueOn: '2026-10-10', nextCutOn: '2026-10-25',
  statementMinor: 49_112_500, computedMinor: 49_112_500, bankMinor: null, differenceMinor: 0,
  cutDayMinor: 0, cutDayCount: 0, paidMinor: 0, remainingMinor: 49_112_500, afterCutMinor: 0,
  lastPaidOn: null, daysLeft: 3, ...over,
});

test('a statement still owed rings on its payment day', () => {
  const [plan] = duePlans([{ accountId: 4, statement: statement() }], '2026-10-07', 15);
  assert.deepEqual(plan, { accountId: 4, dueOn: '2026-10-10', cutOn: '2026-09-25', remainingMinor: 49_112_500, paidMinor: 0, when: 'later' });
});

test('on the day: before the hour it waits, after it rings now', () => {
  const s = statement({ daysLeft: 0 });
  assert.equal(duePlans([{ accountId: 1, statement: s }], '2026-10-10', DUE_HOUR - 1)[0].when, 'later');
  assert.equal(duePlans([{ accountId: 1, statement: s }], '2026-10-10', DUE_HOUR)[0].when, 'now');
});

test('part paid says what is left; paid in full, late, without days or with nothing due says nothing', () => {
  const part = duePlans([{ accountId: 1, statement: statement({ state: 'partial', paidMinor: 10_000_000, remainingMinor: 39_112_500 }) }], '2026-10-07', 9);
  assert.equal(part[0].remainingMinor, 39_112_500);
  assert.equal(part[0].paidMinor, 10_000_000);
  for (const over of [
    { state: 'paid', remainingMinor: 0 },
    { state: 'overdue' },
    { state: 'noDates', dueOn: null, cutOn: null },
    { state: 'nothingDue', remainingMinor: 0 },
    { state: 'clear', remainingMinor: 0 },
  ]) assert.deepEqual(duePlans([{ accountId: 1, statement: statement(over) }], '2026-10-07', 9), [], over.state);
  // A payment day already behind is no longer a reminder.
  assert.deepEqual(duePlans([{ accountId: 1, statement: statement() }], '2026-10-11', 9), []);
});

test('one notification per card', () => {
  assert.notEqual(dueNoticeId(1), dueNoticeId(2));
  assert.equal(dueNoticeId(3), dueNoticeId(3));
});
