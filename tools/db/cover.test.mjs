// Covering a product a movement would leave below zero (core/yields/cover.ts,
// mockups 50a-50h): what is missing, which products can give it, the one to
// offer first, and the move written beside the movement - tied to it so the
// list says it and deleting the movement takes it along. Invented data.
//
//   node --import ./tools/db/register-ts.mjs --test tools/db/cover.test.mjs

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
import { coverOf, linkCover } from '../../src/app/core/database/repositories/cover-links.ts';
import { coverFor } from '../../src/app/core/yields/cover.ts';

const P = (id, kind = 'high_yield', inNet = 1) => ({ id, kind, include_in_net_worth: inNet });

test('nothing to cover while the product holds enough', () => {
  const holds = new Map([[1, 30_000_00], [2, 400_000_00]]);
  assert.equal(coverFor({ amountMinor: 20_000_00, sourceId: 1, products: [P(1), P(2)], holds, routes: [] }), null);
  assert.equal(coverFor({ amountMinor: 30_000_00, sourceId: 1, products: [P(1), P(2)], holds, routes: [] }), null);
});

test('only what is missing, from a product that holds at least that', () => {
  const holds = new Map([[1, 6_500_00], [2, 412_300_00], [3, 12_000_00]]);
  const cover = coverFor({ amountMinor: 20_000_00, sourceId: 1, products: [P(1), P(2), P(3)], holds, routes: [] });
  assert.equal(cover.missingMinor, 13_500_00);
  assert.deepEqual(cover.options.map(o => o.productId), [2]);
});

test('a product already below zero is covered back to zero, no further', () => {
  const holds = new Map([[1, -5_000_00], [2, 100_000_00]]);
  const cover = coverFor({ amountMinor: 20_000_00, sourceId: 1, products: [P(1), P(2)], holds, routes: [] });
  assert.equal(cover.missingMinor, 20_000_00);
});

test('where money usually comes from is offered first, then what holds most', () => {
  const holds = new Map([[1, 0], [2, 85_000_00], [3, 412_300_00], [4, 900_000_00]]);
  const routes = [{ from: 3, to: 1, times: 12 }, { from: 1, to: 4, times: 30 }];
  const cover = coverFor({ amountMinor: 20_000_00, sourceId: 1, products: [P(1), P(2), P(3), P(4)], holds, routes });
  assert.deepEqual(cover.options.map(o => [o.productId, o.usual]), [[3, true], [4, false], [2, false]]);
});

test('the product chosen to always cover from comes first', () => {
  const holds = new Map([[1, 0], [2, 85_000_00], [3, 412_300_00]]);
  const routes = [{ from: 3, to: 1, times: 12 }];
  const cover = coverFor({ amountMinor: 20_000_00, sourceId: 1, products: [P(1), P(2), P(3)], holds, routes, preferred: 2 });
  assert.equal(cover.options[0].productId, 2);
});

test('a CDT and a product set aside are never offered; none holding enough says so', () => {
  const holds = new Map([[1, 0], [2, 5_000_000_00], [3, 5_000_000_00], [4, 10_000_00]]);
  const cover = coverFor({ amountMinor: 900_000_00, sourceId: 1, products: [P(1), P(2, 'cdt'), P(3, 'high_yield', 0), P(4)], holds, routes: [] });
  assert.equal(cover.missingMinor, 900_000_00);
  assert.deepEqual(cover.options, []);
});

test('the cover is tied to its movement: listed with it, and gone with it', async () => {
  let clock = 0;
  const NOW = () => `2026-10-29T12:00:${String(clock++ % 60).padStart(2, '0')}Z`;
  const db = new NodeSqlDriver();
  await migrate(db, MIGRATION_SOURCES);
  const accounts = new AccountsRepository(db, NOW);
  const account = await accounts.create({
    name: 'Cajita Naranja', type: 'debit', currency_code: 'COP', builtin_icon: 'card', opening_balance_minor: 0, opened_on: '2026-01-01',
  });
  const card = await accounts.create({
    name: 'Tarjeta Coral', type: 'credit', currency_code: 'COP', builtin_icon: 'card', opening_balance_minor: -300_000_00, opened_on: '2026-01-01',
  });
  const yields = new YieldsRepository(db, NOW);
  await yields.enrol({ account_id: account, opening_on: '2026-01-01', withholding: false });
  const [usual] = await yields.products(account);
  const main = usual.id;
  const pocket = await yields.addProduct({ account_id: account, name: 'Bolsillo Viajes', source: 'manual' });
  const food = await new CategoriesRepository(db, NOW).create({ name: 'Mercado', kind: 'expense', builtin_icon: 'basket' });
  const transactions = new TransactionsRepository(db, NOW);
  const transfers = new TransfersRepository(db, NOW);
  const cover = (coveredId) => transfers.create({
    occurred_on: '2026-10-29', description: 'Para cubrir Mercado semana',
    from: { account_id: account, product_id: pocket, amount_minor: 20_000_00 },
    to: { account_id: account, product_id: main, amount_minor: 20_000_00 },
  }).then(async id => { await linkCover(db, id, coveredId); return id; });

  const spent = await transactions.create({
    account_id: account, category_id: food, product_id: main, occurred_on: '2026-10-29', amount_minor: -20_000_00,
    description: 'Mercado semana', source: 'manual',
  });
  await cover(spent);
  assert.deepEqual(await coverOf(db, spent), { transferId: (await db.queryOne('SELECT MAX(id) AS id FROM transfers')).id, amountMinor: 20_000_00, productName: 'Bolsillo Viajes' });
  const listed = await transactions.listDetailed({ accountIds: [account] });
  assert.equal(listed.find(row => row.id === spent).covered_from, 'Bolsillo Viajes');
  assert.equal(listed.filter(row => row.covered_from).length, 1, 'only the movement it covered says it');
  assert.equal((await accounts.balance(account)).balance_minor, -20_000_00, 'a move between products moves no balance');

  await transactions.delete(spent);
  assert.equal((await db.queryOne('SELECT COUNT(*) AS n FROM transfers')).n, 0);
  assert.equal((await db.queryOne('SELECT COUNT(*) AS n FROM transactions')).n, 0);

  // A transfer out (paying a card) takes its cover with it too.
  const paid = await transfers.create({
    occurred_on: '2026-10-29', description: 'Pago tarjeta',
    from: { account_id: account, product_id: main, amount_minor: 20_000_00 },
    to: { account_id: card, amount_minor: 20_000_00 },
  });
  const leaving = (await db.queryOne("SELECT id FROM transactions WHERE transfer_id = ? AND transfer_leg = 'from'", [paid])).id;
  const other = await cover(leaving);
  await transfers.delete(paid);
  assert.ok(!(await db.queryOne('SELECT id FROM transfers WHERE id = ?', [other])));
  assert.equal((await db.queryOne('SELECT COUNT(*) AS n FROM transactions')).n, 0);
});
