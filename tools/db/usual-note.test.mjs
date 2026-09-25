// The note a new movement starts with: the one most often written for the
// same thing before (core/notes/usual-note.ts).
//
//   node --import ./tools/db/register-ts.mjs --test tools/db/usual-note.test.mjs
//
// Checked against Jose's own backup on 2026-09-25: Rappi cuenta to Rappi Card
// gives "Pago tarjeta de crédito RappiCard", an income on its usual product
// "Cashback RappiCard", Bolsillo Principal into Cuenta de ahorros "Retiro
// bolsillo principal".

import test from 'node:test';
import assert from 'node:assert/strict';

import { NodeSqlDriver } from './node-sql-driver.mjs';
import { migrate } from '../../src/app/core/database/migrations/migration-runner.ts';
import { MIGRATION_SOURCES } from '../../src/app/core/database/migrations/statements.generated.ts';
import { AccountsRepository } from '../../src/app/core/database/repositories/accounts.repository.ts';
import { CategoriesRepository } from '../../src/app/core/database/repositories/categories.repository.ts';
import { TransactionsRepository } from '../../src/app/core/database/repositories/transactions.repository.ts';
import { TransfersRepository } from '../../src/app/core/database/repositories/transfers.repository.ts';
import { usualNote } from '../../src/app/core/notes/usual-note.ts';

const NOW = () => '2026-09-25T12:00:00Z';
const TODAY = '2026-09-25';

async function world() {
  const db = new NodeSqlDriver();
  await migrate(db, MIGRATION_SOURCES);
  const accounts = new AccountsRepository(db, NOW);
  const make = (name, type = 'debit') => accounts.create({
    name, type, currency_code: 'COP', builtin_icon: 'card', opening_balance_minor: 0, opened_on: '2024-01-01',
  });
  const bank = await make('Banco');
  const card = await make('Tarjeta', 'credit');
  const categories = new CategoriesRepository(db, NOW);
  const food = await categories.create({ name: 'Restaurante', kind: 'expense', builtin_icon: 'restaurant' });
  const home = await categories.create({ name: 'Casa', kind: 'expense', builtin_icon: 'home' });
  const moves = new TransactionsRepository(db, NOW);
  const spend = (account_id, category_id, description, occurred_on = '2026-09-01') => moves.create({
    account_id, category_id, amount_minor: -10_000_00, occurred_on, description, source: 'manual',
  });
  const transfers = new TransfersRepository(db, NOW);
  const move = (from, to, description, occurred_on = '2026-09-01') => transfers.create({
    occurred_on, description, from: { account_id: from, amount_minor: 100_000_00 }, to: { account_id: to, amount_minor: 100_000_00 },
  });
  return { db, bank, card, food, home, spend, move };
}

test('the note written most often for the same category of the same account', async () => {
  const w = await world();
  await w.spend(w.bank, w.food, 'Almuerzo');
  await w.spend(w.bank, w.food, 'almuerzo ');
  await w.spend(w.bank, w.food, 'Almuerzo', '2026-09-10');
  await w.spend(w.bank, w.food, 'Cena');
  await w.spend(w.bank, w.food, 'Cena');
  await w.spend(w.bank, w.home, 'Arriendo');
  await w.spend(w.bank, w.home, 'Arriendo');
  await w.spend(w.bank, w.home, 'Arriendo');
  const note = await usualNote(w.db, { kind: 'movement', accountId: w.bank, side: 'out', categoryId: w.food }, TODAY);
  assert.equal(note, 'Almuerzo', 'three uses, told apart from case and spaces, in the latest spelling; not the other category');
  assert.equal(await usualNote(w.db, { kind: 'movement', accountId: w.bank, side: 'in', categoryId: w.food }, TODAY), null,
    'an income is another question');
  assert.equal(await usualNote(w.db, { kind: 'movement', accountId: w.card, side: 'out', categoryId: w.food }, TODAY), null,
    'another account is another question');
});

test('written once is not a habit, and the last year speaks first', async () => {
  const w = await world();
  await w.spend(w.bank, w.food, 'Una sola vez');
  assert.equal(await usualNote(w.db, { kind: 'movement', accountId: w.bank, side: 'out', categoryId: w.food }, TODAY), null);

  await w.spend(w.bank, w.home, 'Viejo', '2024-03-01');
  await w.spend(w.bank, w.home, 'Viejo', '2024-04-01');
  await w.spend(w.bank, w.home, 'Viejo', '2024-05-01');
  const context = { kind: 'movement', accountId: w.bank, side: 'out', categoryId: w.home };
  assert.equal(await usualNote(w.db, context, TODAY), 'Viejo', 'nothing this year: all of it answers');
  await w.spend(w.bank, w.home, 'Nuevo', '2026-08-01');
  await w.spend(w.bank, w.home, 'Nuevo', '2026-09-01');
  assert.equal(await usualNote(w.db, context, TODAY), 'Nuevo', 'twice this year beats three times two years ago');
});

test('a transfer: the same two accounts, in that direction', async () => {
  const w = await world();
  await w.move(w.bank, w.card, 'Pago tarjeta');
  await w.move(w.bank, w.card, 'Pago tarjeta');
  await w.move(w.card, w.bank, 'Devolución');
  await w.move(w.card, w.bank, 'Devolución');
  assert.equal(await usualNote(w.db, { kind: 'transfer', fromAccountId: w.bank, toAccountId: w.card }, TODAY), 'Pago tarjeta');
  assert.equal(await usualNote(w.db, { kind: 'transfer', fromAccountId: w.card, toAccountId: w.bank }, TODAY), 'Devolución');
});

test('a product with no habit of its own takes the account\'s, for that category', async () => {
  // Jose's Plata, 2026-09-25: every "Cosas para la casa mercado or" sits in
  // the Bolsillo, and a spending on Cuenta Ahorros under the same category
  // offered nothing.
  const w = await world();
  const { YieldsRepository } = await import('../../src/app/core/database/repositories/yields.repository.ts');
  const yields = new YieldsRepository(w.db, NOW);
  const pocket = await yields.addProduct({ account_id: w.bank, name: 'Bolsillo', source: 'manual', earns_from: '2026-01-01' });
  const savings = await yields.addProduct({ account_id: w.bank, name: 'Cuenta Ahorros', source: 'manual', earns_from: '2026-01-01' });
  const moves = new TransactionsRepository(w.db, NOW);
  for (const day of ['2026-09-18', '2026-09-19']) {
    await moves.create({
      account_id: w.bank, category_id: w.home, product_id: pocket, amount_minor: -100_000_00,
      occurred_on: day, description: 'Cosas para la casa mercado or', source: 'manual',
    });
  }
  const ask = (productId, categoryId) => usualNote(w.db, {
    kind: 'product', accountId: w.bank, productId, usualProductId: savings, side: 'out', categoryId,
  }, TODAY);

  assert.equal(await ask(pocket, w.home), 'Cosas para la casa mercado or', 'its own product first');
  assert.equal(await ask(savings, w.home), 'Cosas para la casa mercado or', 'another product of the account, same category');
  assert.equal(await ask(savings, w.food), null, 'never another category');
});
