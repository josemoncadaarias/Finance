// The sample data a new user can load (mockups 21), built on several days.
//
//   node --import ./tools/db/register-ts.mjs --test tools/db/showcase.test.mjs
//
// Its dates move with the day it is built on, so it is built here on the day
// it was written for, at the start, middle and end of a month, and months
// later - where the UVR of the mortgage is only projected - and every day it
// must leave every screen with something in it and nothing in the future.

import test from 'node:test';
import assert from 'node:assert/strict';

import { NodeSqlDriver } from './node-sql-driver.mjs';
import { migrate } from '../../src/app/core/database/migrations/migration-runner.ts';
import { MIGRATION_SOURCES } from '../../src/app/core/database/migrations/statements.generated.ts';
import { seedStarterCategories } from '../../src/app/core/database/starter-categories.ts';
import { buildShowcase } from '../../src/app/core/demo/showcase.ts';

async function built(today, language = 'es') {
  const db = new NodeSqlDriver();
  await migrate(db, MIGRATION_SOURCES);
  await seedStarterCategories(db, language, () => `${today}T08:00:00Z`);
  const seen = [];
  await buildShowcase(db, today, fraction => { seen.push(fraction); });
  return { db, seen };
}

const count = async (db, sql, params = []) => (await db.queryOne(`SELECT COUNT(*) AS n FROM (${sql})`, params)).n;

for (const today of ['2026-10-02', '2026-10-31', '2027-01-01', '2027-03-18', '2028-07-15']) {
  test(`built on ${today}: every screen has something, nothing is in the future`, async () => {
    const { db, seen } = await built(today);
    assert.equal(seen.at(-1), 1, 'the progress ends at 100 %');

    assert.equal(await count(db, 'SELECT 1 FROM transactions WHERE occurred_on > ?', [today]), 0, 'no movement after today');
    assert.equal(await count(db, 'SELECT 1 FROM transfers WHERE occurred_on > ?', [today]), 0, 'no transfer after today');
    assert.ok(await count(db, 'SELECT 1 FROM transactions WHERE substr(occurred_on, 1, 7) = ?', [today.slice(0, 7)]) > 0, 'this month has movements');
    assert.ok(await count(db, 'SELECT 1 FROM accounts') >= 15);
    assert.ok(await count(db, 'SELECT 1 FROM transactions') > 500);
    assert.ok(await count(db, 'SELECT 1 FROM yield_days') > 1000, 'yields worked out');
    assert.equal(await count(db, 'SELECT 1 FROM yield_days WHERE on_date > ?', [today]), 0);
    assert.equal(await count(db, 'SELECT 1 FROM loans'), 3);
    assert.ok(await count(db, 'SELECT 1 FROM loan_payments') > 10);
    assert.equal(await count(db, 'SELECT 1 FROM spending_limits'), 5);
    assert.equal(await count(db, 'SELECT 1 FROM goals'), 5);
    assert.ok(await count(db, "SELECT 1 FROM movement_proposals WHERE status = 'pending'") > 0, 'something waits for review');
    assert.equal(await count(db, 'SELECT 1 FROM tax_simulations WHERE year = ?', [Number(today.slice(0, 4))]), 1);
    await db.close();
  });
}

test('the categories are found in English too', async () => {
  const { db } = await built('2026-10-02', 'en');
  // The starter ones are used, not duplicated in Spanish.
  assert.equal(await count(db, "SELECT 1 FROM categories WHERE name = 'Mercado'"), 0);
  assert.ok(await count(db, "SELECT t.id FROM transactions t JOIN categories c ON c.id = t.category_id WHERE c.name = 'Groceries'") > 0);
  await db.close();
});
