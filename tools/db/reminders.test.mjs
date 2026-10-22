// When a reminder is due and rings (Jose, 2026-10-22). Invented reminders.
//
//   node --import ./tools/db/register-ts.mjs --test tools/db/reminders.test.mjs

import test from 'node:test';
import assert from 'node:assert/strict';

import { NodeSqlDriver } from './node-sql-driver.mjs';
import { migrate } from '../../src/app/core/database/migrations/migration-runner.ts';
import { MIGRATION_SOURCES } from '../../src/app/core/database/migrations/statements.generated.ts';
import { RemindersRepository } from '../../src/app/core/reminders/reminders.repository.ts';
import { dayIn, dueWithin, nextOccurrence, ringKey, ringPlans, settledBy } from '../../src/app/core/reminders/reminders.ts';

const base = { id: 1, title: 'Pagar el arriendo', amountMinor: null, accountId: null, categoryId: null, note: null,
  repeat: 'monthly', dayOfMonth: 5, onDate: null, hour: 8, daysBefore: 0, shop: null, active: true, doneMonth: null, snoozedTo: null };

test('a monthly reminder: this month while not settled, late once its day passed, next month once done', () => {
  assert.deepEqual(pick(nextOccurrence(base, '2026-10-02')), ['2026-10-05', '2026-10-05', false]);
  assert.deepEqual(pick(nextOccurrence(base, '2026-10-22')), ['2026-10-05', '2026-10-05', true]);
  assert.deepEqual(pick(nextOccurrence({ ...base, doneMonth: '2026-10' }, '2026-10-22')), ['2026-11-05', '2026-11-05', false]);
});

test('a day past a short month is its last day; ringing days before', () => {
  assert.equal(dayIn('2027-02', 31), '2027-02-28');
  const r = { ...base, dayOfMonth: 31, daysBefore: 2 };
  assert.deepEqual(pick(nextOccurrence({ ...r, doneMonth: '2027-01' }, '2027-01-31')), ['2027-02-28', '2027-02-26', false]);
});

test('a one-off reminder rings on its day and is gone once done', () => {
  const once = { ...base, repeat: 'once', dayOfMonth: null, onDate: '2026-10-25' };
  assert.deepEqual(pick(nextOccurrence(once, '2026-10-22')), ['2026-10-25', '2026-10-25', false]);
  assert.equal(nextOccurrence({ ...once, doneMonth: '2026-10' }, '2026-10-26'), null);
  assert.equal(nextOccurrence({ ...base, active: false }, '2026-10-22'), null);
});

test('snoozed: this occurrence rings later; it rings now when its time passed with the app closed', () => {
  const o = nextOccurrence({ ...base, snoozedTo: '2026-10-06' }, '2026-10-05');
  assert.equal(o.ringOn, '2026-10-06');
  assert.deepEqual(ringPlans([o], '2026-10-05', 9).map(p => p.when), ['later']);
  assert.deepEqual(ringPlans([o], '2026-10-06', 7).map(p => p.when), ['later']);
  assert.deepEqual(ringPlans([o], '2026-10-06', 8).map(p => p.when), ['now']);
});

test('a fixed payment seen in its month settles that month by itself', () => {
  const o = nextOccurrence({ ...base, shop: 'LUZ' }, '2026-10-03');
  assert.equal(settledBy(o, new Map([['2026-10', ['LUZ']]])), true);
  assert.equal(settledBy(o, new Map([['2026-09', ['LUZ']]])), false);
});

test('Inicio lists the late ones and those due within a week, soonest first', () => {
  const a = nextOccurrence({ ...base, id: 1, dayOfMonth: 25 }, '2026-10-22');
  const b = nextOccurrence({ ...base, id: 2, dayOfMonth: 10 }, '2026-10-22');
  const c = nextOccurrence({ ...base, id: 3, dayOfMonth: 30 }, '2026-10-22');
  assert.deepEqual(dueWithin([a, b, c], '2026-10-22').map(o => o.reminder.id), [2, 1]);
});

function pick(o) { return [o.dueOn, o.ringOn, o.late]; }

test('stored and read back; settled, snoozed, paused, removed; carried by the backup', async () => {
  const db = new NodeSqlDriver();
  await migrate(db, MIGRATION_SOURCES);
  const repo = new RemindersRepository(db, () => '2026-10-22T10:00:00Z');
  const id = await repo.create({ title: '  Pagar la luz ', amountMinor: 12_000_000, accountId: null, categoryId: null, note: 'Luz',
    repeat: 'monthly', dayOfMonth: 31, onDate: '2026-10-01', hour: 9, daysBefore: 1, shop: null });
  let r = await repo.get(id);
  assert.deepEqual([r.title, r.dayOfMonth, r.onDate, r.active], ['Pagar la luz', 31, null, true]);
  await repo.snooze(id, '2026-10-31');
  await repo.markDone(id, '2026-10');
  r = await repo.get(id);
  assert.deepEqual([r.doneMonth, r.snoozedTo], ['2026-10', null]);
  await repo.setActive(id, false);
  assert.equal((await repo.get(id)).active, false);
  // A reminder needs its day: monthly without a day is refused by the table.
  await assert.rejects(repo.create({ title: 'x', amountMinor: null, accountId: null, categoryId: null, note: null,
    repeat: 'monthly', dayOfMonth: null, onDate: null, hour: 8, daysBefore: 0, shop: null }));
  await repo.remove(id);
  assert.equal(await repo.get(id), null);
  const { TABLES } = await import('../../src/app/core/database/export/export-backup.ts');
  assert.ok(TABLES.includes('reminders'));
  await db.close();
});

test('a reminder rings at its minute, and a new time is a new ringing', () => {
  const r = { ...base, repeat: 'once', dayOfMonth: null, onDate: '2026-10-22', hour: 21, minute: 30 };
  const o = nextOccurrence(r, '2026-10-22');
  assert.deepEqual(ringPlans([o], '2026-10-22', 21, 29).map(p => p.when), ['later']);
  assert.deepEqual(ringPlans([o], '2026-10-22', 21, 30).map(p => p.when), ['now']);
  const later = nextOccurrence({ ...r, minute: 45 }, '2026-10-22');
  assert.notEqual(ringKey(o), ringKey(later));
});
