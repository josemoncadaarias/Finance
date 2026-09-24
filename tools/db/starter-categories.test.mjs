// The categories a brand-new database starts with.
//
//   node --import ./tools/db/register-ts.mjs --test tools/db/starter-categories.test.mjs
//
// Found by Jose on 2026-09-23: a fresh install had three categories and not
// one of them was an expense, so the first thing anybody spent could not be
// recorded. His own list came from the app he used before, so he never met it.

import test from 'node:test';
import assert from 'node:assert/strict';

import { NodeSqlDriver } from './node-sql-driver.mjs';
import { migrate } from '../../src/app/core/database/migrations/migration-runner.ts';
import { MIGRATION_SOURCES } from '../../src/app/core/database/migrations/statements.generated.ts';
import {
  STARTER_CATEGORIES, seedStarterCategories,
} from '../../src/app/core/database/starter-categories.ts';

const NOW = () => '2026-09-23T12:00:00Z';

async function fresh() {
  const db = new NodeSqlDriver();
  await migrate(db, MIGRATION_SOURCES);
  return db;
}

const namesIn = (db, kind) => db
  .query('SELECT name FROM categories WHERE kind = ? ORDER BY sort_order', [kind])
  .then(rows => rows.map(row => row.name));

test('a fresh database cannot record an expense without these', async () => {
  const db = await fresh();
  assert.deepEqual(await namesIn(db, 'expense'), [], 'which is the hole itself');

  const added = await seedStarterCategories(db, 'es', NOW);
  assert.ok(added >= 16, 'the ordinary ones, in Spanish');
  assert.ok((await namesIn(db, 'expense')).includes('Mercado'));
  assert.ok((await namesIn(db, 'income')).includes('Salario'));
});

test('they are the app speaking, so they follow its language', async () => {
  const db = await fresh();
  await seedStarterCategories(db, 'en', NOW);
  const expenses = await namesIn(db, 'expense');
  assert.ok(expenses.includes('Groceries'));
  assert.ok(!expenses.includes('Mercado'), 'one language, not both');
});

test('a database that has been used is left exactly as it was', async () => {
  const db = await fresh();
  await db.run(
    `INSERT INTO categories (name, kind, builtin_icon, archived, sort_order,
                             created_at, updated_at)
     VALUES ('Didi', 'expense', 'car-outline', 0, 0, ?, ?)`,
    [NOW(), NOW()],
  );

  assert.equal(await seedStarterCategories(db, 'es', NOW), 0, 'nothing added');
  assert.deepEqual(await namesIn(db, 'expense'), ['Didi']);
});

test('running twice adds nothing the second time', async () => {
  const db = await fresh();
  const first = await seedStarterCategories(db, 'es', NOW);
  const again = await seedStarterCategories(db, 'es', NOW);
  assert.ok(first > 0);
  assert.equal(again, 0, 'the app starts every day and this runs every time');
});

test('an income name the schema already carries is not repeated', async () => {
  const db = await fresh();
  // Cashback, Corrección del banco and Otro arrive with migration 037.
  const before = await namesIn(db, 'income');
  await seedStarterCategories(db, 'es', NOW);
  const after = await namesIn(db, 'income');
  for (const name of before) {
    assert.equal(after.filter(one => one === name).length, 1, `${name} exists once`);
  }
});

test('every starter category is written in both languages and has an icon', () => {
  for (const category of STARTER_CATEGORIES) {
    assert.ok(category.es.length > 0 && category.en.length > 0, 'both languages');
    assert.match(category.icon, /-outline$|^[a-z-]+$/, 'a real icon name');
  }
});

test('a new install can record what an investment earned or lost, already marked as such', async () => {
  const db = await fresh();
  await seedStarterCategories(db, 'es', NOW);
  const marked = await db.query('SELECT name, kind FROM categories WHERE counts_as_return = 1 ORDER BY kind');
  assert.deepEqual(marked.map(row => `${row.kind}:${row.name}`),
    ['expense:Pérdida de inversión', 'income:Ganancia de inversión']);
  const english = await fresh();
  await seedStarterCategories(english, 'en', NOW);
  assert.equal((await english.query('SELECT name FROM categories WHERE counts_as_return = 1')).length, 2);
});
