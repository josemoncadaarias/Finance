// "¿Qué cambia?" asked wherever an income or a spending is made on an account
// with products (core/yields/entry-scope.ts): the answer starts on the
// person's habit, or on "the product and net worth", and each answer is
// written the one way both forms share.
//
//   node --import ./tools/db/register-ts.mjs --test tools/db/entry-scope.test.mjs

import test from 'node:test';
import assert from 'node:assert/strict';

import { NodeSqlDriver } from './node-sql-driver.mjs';
import { migrate } from '../../src/app/core/database/migrations/migration-runner.ts';
import { MIGRATION_SOURCES } from '../../src/app/core/database/migrations/statements.generated.ts';
import { AccountsRepository } from '../../src/app/core/database/repositories/accounts.repository.ts';
import { CategoriesRepository } from '../../src/app/core/database/repositories/categories.repository.ts';
import { YieldsRepository } from '../../src/app/core/database/repositories/yields.repository.ts';
import { DEFAULT_SCOPE, usualScope, writeScoped } from '../../src/app/core/yields/entry-scope.ts';

let clock = 0;
const NOW = () => `2026-09-28T12:00:${String(clock++ % 60).padStart(2, '0')}Z`;

async function world() {
  const db = new NodeSqlDriver();
  await migrate(db, MIGRATION_SOURCES);
  const accounts = new AccountsRepository(db, NOW);
  const bank = await accounts.create({
    name: 'Banco', type: 'debit', currency_code: 'COP', builtin_icon: 'card', opening_balance_minor: 0, opened_on: '2026-01-01',
  });
  const yields = new YieldsRepository(db, NOW);
  await yields.enrol({ account_id: bank, opening_on: '2026-01-01', withholding: false });
  const [usual] = await yields.products(bank);
  const categories = new CategoriesRepository(db, NOW);
  const salary = await categories.create({ name: 'Salario', kind: 'income', builtin_icon: 'cash' });
  const cashback = await categories.create({ name: 'Devoluciones de la tarjeta', kind: 'income', builtin_icon: 'gift' });
  const food = await categories.create({ name: 'Comida', kind: 'expense', builtin_icon: 'restaurant' });
  const write = (scope, categoryId, onDate, kind = 'income') => writeScoped(db, yields, {
    scope, kind, accountId: bank, categoryId, productId: usual.id, movementProductId: null,
    onDate, amountMinor: 10_000_00, note: null,
  });
  const count = async (table) => (await db.queryOne(`SELECT COUNT(*) AS n FROM ${table}`)).n;
  return { db, bank, usual, salary, cashback, food, write, count };
}

test('with no habit, and with no category yet, it is the product and net worth', async () => {
  const w = await world();
  assert.equal(DEFAULT_SCOPE, 'both');
  assert.equal(await usualScope(w.db, { accountId: w.bank, side: 'in', categoryId: w.salary }), 'both');
  await w.write('product', w.cashback, '2026-09-01');
  assert.equal(await usualScope(w.db, { accountId: w.bank, side: 'in', categoryId: null }), 'both',
    'no category chosen: nothing to follow');
});

test('one answer is already a habit, for that account, category and side only', async () => {
  const w = await world();
  await w.write('product', w.cashback, '2026-09-01');
  assert.equal(await usualScope(w.db, { accountId: w.bank, side: 'in', categoryId: w.cashback }), 'product');
  assert.equal(await usualScope(w.db, { accountId: w.bank, side: 'in', categoryId: w.salary }), 'both',
    'another category is another question');
  assert.equal(await usualScope(w.db, { accountId: w.bank, side: 'out', categoryId: w.cashback }), 'both',
    'a spending is another question');
});

test('each shape is read back as the answer that wrote it', async () => {
  const w = await world();
  await w.write('netWorth', w.cashback, '2026-09-01');
  assert.equal(await usualScope(w.db, { accountId: w.bank, side: 'in', categoryId: w.cashback }), 'netWorth');
  await w.write('netWorth', w.food, '2026-09-01', 'expense');
  assert.equal(await usualScope(w.db, { accountId: w.bank, side: 'out', categoryId: w.food }), 'netWorth');
  await w.write('both', w.salary, '2026-09-01');
  assert.equal(await usualScope(w.db, { accountId: w.bank, side: 'in', categoryId: w.salary }), 'both');
});

test('the commonest of the latest five, the newest winning a tie', async () => {
  const w = await world();
  const ask = () => usualScope(w.db, { accountId: w.bank, side: 'in', categoryId: w.cashback });
  await w.write('product', w.cashback, '2026-01-01');
  await w.write('product', w.cashback, '2026-02-01');
  await w.write('product', w.cashback, '2026-03-01');
  await w.write('both', w.cashback, '2026-04-01');
  assert.equal(await ask(), 'product', 'three against one');
  await w.write('both', w.cashback, '2026-05-01');
  await w.write('both', w.cashback, '2026-06-01');
  assert.equal(await ask(), 'both', 'the latest five: three both, two product');
  await w.write('product', w.cashback, '2026-07-01');
  await w.write('product', w.cashback, '2026-08-01');
  assert.equal(await ask(), 'both', 'the latest five: still three both, two product');
  await w.write('product', w.cashback, '2026-09-01');
  assert.equal(await ask(), 'product', 'three product among the latest five');
});

test('what each answer writes', async () => {
  const w = await world();
  await w.write('both', w.salary, '2026-09-01');
  assert.deepEqual([await w.count('transactions'), await w.count('product_entries'), await w.count('product_cashouts')], [1, 0, 0],
    'both: an ordinary movement');

  const v = await world();
  await v.write('product', v.cashback, '2026-09-01');
  assert.deepEqual([await v.count('transactions'), await v.count('product_entries'), await v.count('product_cashouts')], [0, 1, 0],
    'the product alone: an entry, no movement');
  const entry = await v.db.queryOne('SELECT amount_minor, category_id, product_id, transaction_id FROM product_entries');
  assert.deepEqual({ ...entry }, { amount_minor: 10_000_00, category_id: v.cashback, product_id: v.usual.id, transaction_id: null });

  const u = await world();
  await u.write('netWorth', u.cashback, '2026-09-01');
  assert.deepEqual([await u.count('transactions'), await u.count('product_entries'), await u.count('product_cashouts')], [1, 0, 1],
    'net worth alone, an income: a movement and a cash-out of the same amount');
  await u.write('netWorth', u.food, '2026-09-01', 'expense');
  const spent = await u.db.queryOne(
    'SELECT t.amount_minor AS moved, e.amount_minor AS back FROM product_entries e JOIN transactions t ON t.id = e.transaction_id');
  assert.deepEqual({ ...spent }, { moved: -10_000_00, back: 10_000_00 }, 'a spending: the movement, and the same amount back into the product');
});

test('a movement corrected into another shape: every way round, by balance and product figure', async () => {
  const { scopeOfMovement, rewriteScoped } = await import('../../src/app/core/yields/entry-scope.ts');
  const shapes = ['both', 'netWorth', 'product'];
  for (const kind of ['income', 'expense']) {
    for (const from of ['both', 'netWorth']) {
      for (const to of shapes) {
        const w = await world();
        const yields = new YieldsRepository(w.db, NOW);
        const category = kind === 'income' ? w.salary : w.food;
        await w.write(from, category, '2026-09-01', kind);
        const tx = await w.db.queryOne('SELECT id FROM transactions');
        assert.equal(await scopeOfMovement(w.db, tx.id), from, `${kind}: ${from} is read back`);

        await w.db.transaction(() => rewriteScoped(w.db, yields, tx.id, {
          scope: to, kind, accountId: w.bank, categoryId: category, productId: w.usual.id, movementProductId: null,
          onDate: '2026-09-02', amountMinor: 10_000_00, note: null,
        }));

        // Against the same shape written fresh: the same rows, nothing left behind.
        const fresh = await world();
        await fresh.write(to, kind === 'income' ? fresh.salary : fresh.food, '2026-09-02', kind);
        for (const table of ['transactions', 'product_entries', 'product_cashouts']) {
          assert.equal(await w.count(table), await fresh.count(table), `${kind} ${from} → ${to}: ${table}`);
        }
        const balance = async (db) => (await db.queryOne('SELECT COALESCE(SUM(amount_minor), 0) AS s FROM transactions')).s;
        assert.equal(await balance(w.db), await balance(fresh.db), `${kind} ${from} → ${to}: balance`);
        if (to !== 'product') {
          const left = await w.db.queryOne('SELECT id FROM transactions');
          assert.equal(await scopeOfMovement(w.db, left.id), to, `${kind} ${from} → ${to}: read back`);
        }
      }
    }
  }
});
