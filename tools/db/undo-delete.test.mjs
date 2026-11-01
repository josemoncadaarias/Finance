// "Deshacer" and "Recuperar" on the saved banner (mockups 53a-53f): a movement
// just saved is deleted as the form deletes it, and put back exactly as it
// was - its cover from a pocket, its halves on a product and the bank message
// it was saved from included. Invented data.
//
//   node --import ./tools/db/register-ts.mjs --test tools/db/undo-delete.test.mjs

import test from 'node:test';
import assert from 'node:assert/strict';

import { NodeSqlDriver } from './node-sql-driver.mjs';
import { migrate } from '../../src/app/core/database/migrations/migration-runner.ts';
import { MIGRATION_SOURCES } from '../../src/app/core/database/migrations/statements.generated.ts';
import { AccountsRepository } from '../../src/app/core/database/repositories/accounts.repository.ts';
import { YieldsRepository } from '../../src/app/core/database/repositories/yields.repository.ts';
import { CategoriesRepository } from '../../src/app/core/database/repositories/categories.repository.ts';
import { TransactionsRepository } from '../../src/app/core/database/repositories/transactions.repository.ts';
import { TransfersRepository } from '../../src/app/core/database/repositories/transfers.repository.ts';
import { linkCover } from '../../src/app/core/database/repositories/cover-links.ts';
import { deleteWithSnapshot, restoreSnapshot } from '../../src/app/core/database/repositories/undo-delete.ts';

const TABLES = ['transactions', 'transfers', 'product_entries', 'product_cashouts', 'movement_proposals'];
const dump = async db => {
  const out = {};
  for (const t of TABLES) out[t] = await db.query(`SELECT * FROM ${t} ORDER BY rowid`);
  return out;
};

async function setUp() {
  let clock = 0;
  const NOW = () => `2026-11-01T12:00:${String(clock++ % 60).padStart(2, '0')}Z`;
  const db = new NodeSqlDriver();
  await migrate(db, MIGRATION_SOURCES);
  const accounts = new AccountsRepository(db, NOW);
  const account = await accounts.create({ name: 'Cajita Naranja', type: 'debit', currency_code: 'COP', builtin_icon: 'card', opening_balance_minor: 0, opened_on: '2026-01-01' });
  const card = await accounts.create({ name: 'Tarjeta Coral', type: 'credit', currency_code: 'COP', builtin_icon: 'card', opening_balance_minor: -300_000_00, opened_on: '2026-01-01' });
  const yields = new YieldsRepository(db, NOW);
  await yields.enrol({ account_id: account, opening_on: '2026-01-01', withholding: false });
  const main = (await yields.products(account))[0].id;
  const pocket = await yields.addProduct({ account_id: account, name: 'Bolsillo Viajes', source: 'manual' });
  const food = await new CategoriesRepository(db, NOW).create({ name: 'Mercado', kind: 'expense', builtin_icon: 'basket' });
  return { db, NOW, account, card, main, pocket, food, accounts };
}

test('a spending with its cover and its bank message comes back exactly', async () => {
  const { db, NOW, account, main, pocket, food, accounts } = await setUp();
  const transactions = new TransactionsRepository(db, NOW);
  const transfers = new TransfersRepository(db, NOW);
  const spent = await transactions.create({ account_id: account, category_id: food, product_id: main, occurred_on: '2026-11-01', amount_minor: -20_000_00, description: 'Mercado semana', source: 'manual' });
  const cover = await transfers.create({ occurred_on: '2026-11-01', description: 'Para cubrir Mercado semana',
    from: { account_id: account, product_id: pocket, amount_minor: 20_000_00 }, to: { account_id: account, product_id: main, amount_minor: 20_000_00 } });
  await linkCover(db, cover, spent);
  await db.run(`INSERT INTO movement_proposals (source, account_id, occurred_on, amount_minor, description, evidence, status, transaction_id, maybe_same_as, batch, created_at, updated_at)
    VALUES ('notification', ?, '2026-11-01', -2000000, 'Compra', '{}', 'accepted', ?, ?, 'notice:x', ?, ?)`, [account, spent, spent, NOW(), NOW()]);
  const before = await dump(db);
  const balance = (await accounts.balance(account)).balance_minor;

  const snap = await deleteWithSnapshot(db, { transactionId: spent });
  assert.equal((await db.queryOne('SELECT COUNT(*) AS n FROM transactions')).n, 0);
  const waiting = await db.queryOne('SELECT transaction_id, status FROM movement_proposals');
  assert.equal(waiting.transaction_id, null);
  assert.equal(waiting.status, 'pending', 'the bank message waits in Por revisar again');

  await restoreSnapshot(db, snap);
  assert.deepEqual(await dump(db), before);
  assert.equal((await accounts.balance(account)).balance_minor, balance);
});

test('a transfer and its product-only end come back exactly', async () => {
  const { db, NOW, account, card, main } = await setUp();
  const transfers = new TransfersRepository(db, NOW);
  const paid = await transfers.create({ occurred_on: '2026-11-01', description: 'Pago tarjeta',
    from: { account_id: account, product_id: main, amount_minor: 50_000_00, scope: 'netWorth' }, to: { account_id: card, amount_minor: 50_000_00 } });
  const before = await dump(db);
  const snap = await deleteWithSnapshot(db, { transferId: paid });
  assert.equal((await db.queryOne('SELECT COUNT(*) AS n FROM transfers')).n, 0);
  await restoreSnapshot(db, snap);
  assert.deepEqual(await dump(db), before);
});
