// The "+" offers what the person registers most (idea F, Jose, 2026-10-22).
// Every account, category and note here is INVENTED.
//
//   node --import ./tools/db/register-ts.mjs --test tools/db/frequent.test.mjs

import test from 'node:test';
import assert from 'node:assert/strict';

import { frequentOf, habitsOf, pinOf, looseKey, MIN_USES } from '../../src/app/core/compose/frequent.ts';
import { merchantKeyOf } from '../../src/app/core/proposals/merchant.ts';

const TODAY = '2026-10-22';
const coffee = (onDate, amountMinor = 850000, note = 'Café de la esquina') =>
  ({ kind: 'expense', accountId: 1, categoryId: 7, note, amountMinor, onDate });

test('a note written the same way three times is a habit, with its steady amount', () => {
  const found = frequentOf([coffee('2026-10-20'), coffee('2026-10-13', 900000), coffee('2026-10-06')], TODAY);
  assert.equal(found.length, 1);
  assert.equal(found[0].uses, 3);
  assert.equal(found[0].lastOn, '2026-10-20');
  assert.equal(found[0].amountMinor, 850000);
  assert.equal(found[0].note, 'Café de la esquina');
});

test(`fewer than ${MIN_USES} uses, or uses older than the window, are no habit`, () => {
  assert.equal(frequentOf([coffee('2026-10-20'), coffee('2026-10-13')], TODAY).length, 0);
  assert.equal(frequentOf([coffee('2026-10-20'), coffee('2026-10-13'), coffee('2026-05-01')], TODAY).length, 0);
});

test('case, accents and spaces do not split a habit; the latest spelling is shown', () => {
  const found = frequentOf([
    coffee('2026-10-01', 850000, 'cafe de la esquina'),
    coffee('2026-10-08', 850000, ' CAFÉ  de la esquina'),
    coffee('2026-10-15', 850000, 'Café de la Esquina'),
  ], TODAY);
  assert.equal(found.length, 1);
  assert.equal(found[0].note, 'Café de la Esquina');
});

test('an amount that moves is not filled in', () => {
  const market = (d, a) => ({ kind: 'expense', accountId: 2, categoryId: 3, note: 'Mercado', amountMinor: a, onDate: d });
  const found = frequentOf([market('2026-10-02', 21000000), market('2026-10-09', 34000000), market('2026-10-16', 18000000)], TODAY);
  assert.equal(found[0].amountMinor, null);
});

test('another account, category or kind is another habit', () => {
  const rows = [
    coffee('2026-10-01'), coffee('2026-10-02'),
    { ...coffee('2026-10-03'), accountId: 9 },
    { ...coffee('2026-10-04'), categoryId: 8 },
    { ...coffee('2026-10-05'), kind: 'income' },
  ];
  assert.equal(frequentOf(rows, TODAY).length, 0);
});

test('transfers between the same two accounts are a habit, even with no note', () => {
  const pay = d => ({ kind: 'transfer', accountId: 1, toAccountId: 5, categoryId: null, note: '', amountMinor: 120000000, onDate: d });
  const found = frequentOf([pay('2026-08-30'), pay('2026-09-29'), pay('2026-10-20')], TODAY);
  assert.equal(found.length, 1);
  assert.equal(found[0].toAccountId, 5);
  assert.equal(found[0].amountMinor, 120000000);
});

test('a movement with no note and no category says nothing to repeat', () => {
  const bare = d => ({ kind: 'expense', accountId: 1, categoryId: null, note: ' ', amountMinor: 100, onDate: d });
  assert.equal(frequentOf([bare('2026-10-01'), bare('2026-10-02'), bare('2026-10-03')], TODAY).length, 0);
});

test('the fixed payments already listed are skipped, and the most used come first', () => {
  const rent = d => ({ kind: 'expense', accountId: 1, categoryId: 4, note: 'Arriendo apartamento', amountMinor: 1, onDate: d });
  const lunch = d => ({ kind: 'expense', accountId: 1, categoryId: 6, note: 'Almuerzo', amountMinor: 1800000, onDate: d });
  const rows = [rent('2026-08-01'), rent('2026-09-01'), rent('2026-10-01'),
    coffee('2026-10-01'), coffee('2026-10-02'), coffee('2026-10-03'),
    lunch('2026-10-01'), lunch('2026-10-02'), lunch('2026-10-03'), lunch('2026-10-04')];
  const found = frequentOf(rows, TODAY, new Set([merchantKeyOf('Arriendo apartamento')]));
  assert.deepEqual(found.map(f => f.note), ['Almuerzo', 'Café de la esquina']);
});

test('one kind does not take every place while another has habits', () => {
  const rows = [];
  const move = (n, d) => ({ kind: 'transfer', accountId: 1, toAccountId: 2 + n, categoryId: null, note: '', amountMinor: 1, onDate: d });
  for (let n = 0; n < 4; n++) for (let d = 1; d <= 9; d++) rows.push(move(n, `2026-10-0${d}`));
  for (let d = 1; d <= 3; d++) rows.push(coffee(`2026-10-0${d}`));
  const found = frequentOf(rows, TODAY);
  assert.equal(found.length, 4);
  assert.equal(found.filter(f => f.kind === 'transfer').length, 3);
  assert.equal(found.filter(f => f.kind === 'expense').length, 1);
  // With only transfers, transfers fill every place.
  assert.equal(frequentOf(rows.filter(r => r.kind === 'transfer'), TODAY).length, 4);
});

test('at most the number asked for', () => {
  const rows = [];
  for (let n = 0; n < 6; n++) for (let d = 1; d <= 3; d++) rows.push(coffee(`2026-10-0${d}`, 100, `Cosa ${n}`));
  assert.equal(frequentOf(rows, TODAY).length, 4);
  assert.equal(frequentOf(rows, TODAY, new Set(), 6).length, 6);
});

test('the movements are read from the database: spending, income and transfers, no refund', async () => {
  const { NodeSqlDriver } = await import('./node-sql-driver.mjs');
  const { migrate } = await import('../../src/app/core/database/migrations/migration-runner.ts');
  const { MIGRATION_SOURCES } = await import('../../src/app/core/database/migrations/statements.generated.ts');
  const { AccountsRepository } = await import('../../src/app/core/database/repositories/accounts.repository.ts');
  const { CategoriesRepository } = await import('../../src/app/core/database/repositories/categories.repository.ts');
  const { TransactionsRepository } = await import('../../src/app/core/database/repositories/transactions.repository.ts');
  const { TransfersRepository } = await import('../../src/app/core/database/repositories/transfers.repository.ts');
  const { pastMovements } = await import('../../src/app/core/compose/frequent-data.ts');

  const db = new NodeSqlDriver();
  await migrate(db, MIGRATION_SOURCES);
  const accounts = new AccountsRepository(db);
  const blue = await accounts.create({ name: 'Banco Azul', type: 'debit', currency_code: 'COP', builtin_icon: 'card', opening_balance_minor: 0, opened_on: '2026-01-01' });
  const card = await accounts.create({ name: 'Tarjeta Coral', type: 'credit', currency_code: 'COP', builtin_icon: 'card', opening_balance_minor: 0, opened_on: '2026-01-01' });
  const categories = new CategoriesRepository(db);
  const food = await categories.create({ name: 'Comida', kind: 'expense', builtin_icon: 'restaurant' });
  const pay = await categories.create({ name: 'Salario', kind: 'income', builtin_icon: 'cash' });
  const tx = new TransactionsRepository(db);
  await tx.create({ account_id: blue, category_id: food, occurred_on: '2026-10-10', amount_minor: -1500000, description: 'Almuerzo' });
  await tx.create({ account_id: blue, category_id: pay, occurred_on: '2026-10-01', amount_minor: 500000000, description: 'Nómina' });
  await tx.create({ account_id: card, category_id: food, occurred_on: '2026-10-12', amount_minor: 1500000, description: 'Devolución' });
  await tx.create({ account_id: blue, category_id: food, occurred_on: '2026-01-10', amount_minor: -100, description: 'Viejo' });
  await new TransfersRepository(db).create({
    occurred_on: '2026-10-15', description: 'Pago tarjeta',
    from: { account_id: blue, amount_minor: 30000000 }, to: { account_id: card, amount_minor: 30000000 },
  });

  const rows = await pastMovements(db, TODAY);
  const by = kind => rows.filter(r => r.kind === kind);
  assert.deepEqual(by('expense').map(r => r.note), ['Almuerzo']);
  assert.deepEqual(by('income').map(r => r.note), ['Nómina']);
  assert.equal(by('transfer').length, 1);
  assert.equal(by('transfer')[0].toAccountId, card);
  assert.equal(by('transfer')[0].note, 'Pago tarjeta');
  assert.equal(by('transfer')[0].amountMinor, 30000000);
});

// Mockups 42a-42f (Jose, 2026-10-23): the same spending with another note each
// time, the last amounts used, and habits fixed on top or hidden.
const market = (onDate, note, amountMinor) => ({ kind: 'expense', accountId: 3, categoryId: 11, note, amountMinor, onDate });

test('one account and category with a different note each time is still a habit', () => {
  const found = frequentOf([
    market('2026-10-20', 'Mercado semana', 8640000), market('2026-10-13', 'Fruver', 2390000),
    market('2026-10-06', 'Mercado semana', 14200000), market('2026-09-29', 'Carnicería', 5100000),
  ], TODAY);
  assert.equal(found.length, 1);
  assert.equal(found[0].loose, true);
  assert.equal(found[0].key, looseKey({ kind: 'expense', accountId: 3, categoryId: 11 }));
  assert.equal(found[0].uses, 4);
  assert.equal(found[0].note, 'Mercado semana');
  assert.deepEqual(found[0].otherNotes, ['Fruver', 'Carnicería']);
  assert.equal(found[0].amountMinor, null);
  assert.deepEqual(found[0].lastAmounts, [8640000, 2390000, 14200000]);
});

test('a loose habit offers no note when none was written twice', () => {
  const found = frequentOf([market('2026-10-20', 'Uno', 100), market('2026-10-13', 'Dos', 200), market('2026-10-06', 'Tres', 300)], TODAY);
  assert.equal(found[0].note, '');
  assert.deepEqual(found[0].otherNotes, ['Uno', 'Dos', 'Tres']);
});

test('an exact habit keeps its rows; only what is left joins by category', () => {
  const found = frequentOf([
    coffee('2026-10-20'), coffee('2026-10-13'), coffee('2026-10-06'),
    { ...coffee('2026-10-05'), note: 'Pan' }, { ...coffee('2026-10-04'), note: 'Jugo' },
  ], TODAY);
  assert.deepEqual(found.map(f => [f.loose, f.uses]), [[false, 3]]);
});

test('the last amounts are the latest different ones', () => {
  const found = frequentOf([coffee('2026-10-20', 900000), coffee('2026-10-13', 900000), coffee('2026-10-06', 850000), coffee('2026-10-01', 800000), coffee('2026-09-25', 700000)], TODAY);
  assert.deepEqual(found[0].lastAmounts, [900000, 850000, 800000]);
});

test('a pinned habit comes first, even unused lately; a hidden one does not come', () => {
  const lunch = d => ({ kind: 'expense', accountId: 1, categoryId: 6, note: 'Almuerzo', amountMinor: 1800000, onDate: d });
  const rows = [coffee('2026-10-01'), coffee('2026-10-02'), coffee('2026-10-03'),
    lunch('2026-10-01'), lunch('2026-10-02'), lunch('2026-10-03'), lunch('2026-10-04')];
  const all = frequentOf(rows, TODAY);
  const coffeeHabit = all.find(f => f.note === 'Café de la esquina');
  const old = { key: 'transfer|1|5||pago tarjeta', kind: 'transfer', accountId: 1, toAccountId: 5, productId: null, toProductId: null, categoryId: null, note: 'Pago tarjeta', loose: false };
  const habits = habitsOf(rows, TODAY, { pins: [old, pinOf(coffeeHabit)], hidden: new Set([all.find(f => f.note === 'Almuerzo').key]) });
  assert.deepEqual(habits.pinned.map(f => [f.note, f.uses, f.pinned]), [['Pago tarjeta', 0, true], ['Café de la esquina', 3, true]]);
  assert.deepEqual(habits.frequent, []);
});
