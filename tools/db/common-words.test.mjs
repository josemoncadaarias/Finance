// The words the app ships knowing, for the first import of a new install.
//
//   node --import ./tools/db/register-ts.mjs --test tools/db/common-words.test.mjs
//
// Jose, 2026-09-23: with the starter categories in place, can the app help
// file a statement better? The learned dictionary answers everything on a
// phone that has been used and nothing at all on a new one.

import test from 'node:test';
import assert from 'node:assert/strict';

import { NodeSqlDriver } from './node-sql-driver.mjs';
import { migrate } from '../../src/app/core/database/migrations/migration-runner.ts';
import { MIGRATION_SOURCES } from '../../src/app/core/database/migrations/statements.generated.ts';
import { seedStarterCategories } from '../../src/app/core/database/starter-categories.ts';
import { ProposalsRepository } from '../../src/app/core/database/repositories/proposals.repository.ts';
import { COMMON_WORDS, wordCategoryOf } from '../../src/app/core/proposals/common-words.ts';
import { merchantKeyOf } from '../../src/app/core/proposals/merchant.ts';

const NOW = () => '2026-09-23T12:00:00Z';

async function fresh() {
  const db = new NodeSqlDriver();
  await migrate(db, MIGRATION_SOURCES);
  await seedStarterCategories(db, 'es', NOW);
  return db;
}

const nameOf = (db, id) => db
  .queryOne('SELECT name FROM categories WHERE id = ?', [id])
  .then(row => row?.name ?? null);

test('an ordinary word says what a movement was', () => {
  assert.equal(wordCategoryOf('COMPRA SUPERMERCADO LA 14', -50_000_00).es, 'Mercado');
  assert.equal(wordCategoryOf('PAGO PEAJE AUTOPISTA', -12_000_00).es, 'Automóvil');
  assert.equal(wordCategoryOf('DROGUERIA CRUZ VERDE', -30_000_00).es, 'Salud');
  assert.equal(wordCategoryOf('ABONO NOMINA SEPTIEMBRE', 4_000_000_00).es, 'Salario');
});

test('the sign decides which half of the list may answer', () => {
  // A refund from a supermarket is not a salary, and a payroll line that
  // somehow went out is not an income: neither is guessed at.
  assert.equal(wordCategoryOf('ABONO NOMINA SEPTIEMBRE', -4_000_000_00), null);
  assert.equal(wordCategoryOf('COMPRA SUPERMERCADO LA 14', 50_000_00), null);
  assert.equal(wordCategoryOf('COMPRA SUPERMERCADO', null), null);
});

test('accents and case are folded the way a description is', () => {
  assert.equal(wordCategoryOf('pago Educación universidad', -900_000_00).es, 'Educación');
  assert.equal(wordCategoryOf('FARMACIA', -1_000_00).es, 'Salud');
});

test('a description it knows nothing about stays a question', () => {
  assert.equal(wordCategoryOf('COMPRA ZXQ 4471', -20_000_00), null);
  assert.equal(wordCategoryOf('', -20_000_00), null);
  assert.equal(wordCategoryOf(null, -20_000_00), null);
});

test('every word it knows survives the folding a description gets', () => {
  for (const word of Object.keys(COMMON_WORDS)) {
    assert.equal(merchantKeyOf(word), word, `${word} folds to itself`);
  }
});

test('a guess lands on a real category of a new install', async () => {
  const db = await fresh();
  const proposals = new ProposalsRepository(db, NOW);

  const guessed = await proposals.guessedCategoryOf('COMPRA SUPERMERCADO EXITO', -60_000_00);
  assert.equal(await nameOf(db, guessed), 'Mercado');

  const salary = await proposals.guessedCategoryOf('PAGO DE NOMINA ACME', 6_000_000_00);
  assert.equal(await nameOf(db, salary), 'Salario');
});

test('a list somebody has made their own is never overruled by a word', async () => {
  const db = await fresh();
  const proposals = new ProposalsRepository(db, NOW);
  // Renamed, the way anybody may: the word then finds nothing and the row is
  // asked about, which is the old behaviour and the safe one.
  await db.run("UPDATE categories SET name = 'Compras del mes' WHERE name = 'Mercado'");
  assert.equal(await proposals.guessedCategoryOf('COMPRA SUPERMERCADO EXITO', -60_000_00), null);
});

test('what the person filed before beats what the app guesses', async () => {
  const db = await fresh();
  const proposals = new ProposalsRepository(db, NOW);
  const health = await db.queryOne("SELECT id FROM categories WHERE name = 'Salud'");

  await proposals.learn('COMPRA SUPERMERCADO EXITO', health.id, '2026-09-01');
  const { ids } = await proposals.propose('batch-x', [{
    source: 'statement', account_id: null, occurred_on: '2026-09-10',
    amount_minor: -60_000_00, description: 'COMPRA SUPERMERCADO EXITO', evidence: {},
  }]);

  const row = await db.queryOne(
    'SELECT category_id, category_from FROM movement_proposals WHERE id = ?', [ids[0]]);
  assert.equal(row.category_id, health.id, 'their answer, however odd it looks');
  assert.equal(row.category_from, 'learned');
});

test('a guessed category says it was guessed', async () => {
  const db = await fresh();
  const proposals = new ProposalsRepository(db, NOW);
  const { ids } = await proposals.propose('batch-x', [{
    source: 'statement', account_id: null, occurred_on: '2026-09-10',
    amount_minor: -18_000_00, description: 'COMPRA RESTAURANTE MOKANA', evidence: {},
  }]);

  const row = await db.queryOne(
    'SELECT category_from FROM movement_proposals WHERE id = ?', [ids[0]]);
  assert.equal(row.category_from, 'guessed', 'never "learned": nobody taught it this');
});
