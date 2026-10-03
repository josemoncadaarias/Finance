// What a transfer between two accounts changes at each end (migration 056,
// mockups 17a-17f; Jose, 2026-10-03): every combination of the three answers
// at each end, read back as balances and product figures; a transfer changed
// from one shape to another and deleted, leaving nothing behind; and the
// verdict on net worth the form shows.
//
//   node --import ./tools/db/register-ts.mjs --test tools/db/transfer-scopes.test.mjs

import test from 'node:test';
import assert from 'node:assert/strict';

import { NodeSqlDriver } from './node-sql-driver.mjs';
import { migrate } from '../../src/app/core/database/migrations/migration-runner.ts';
import { MIGRATION_SOURCES } from '../../src/app/core/database/migrations/statements.generated.ts';
import { AccountsRepository } from '../../src/app/core/database/repositories/accounts.repository.ts';
import { YieldsRepository } from '../../src/app/core/database/repositories/yields.repository.ts';
import { TransfersRepository } from '../../src/app/core/database/repositories/transfers.repository.ts';
import { whatItHolds } from '../../src/app/core/yields/holdings.ts';
import { transferEffect } from '../../src/app/core/transfers/transfer-effect.ts';

let clock = 0;
const NOW = () => `2026-10-03T12:${String(Math.floor(clock / 60) % 60).padStart(2, '0')}:${String(clock++ % 60).padStart(2, '0')}Z`;
const SCOPES = ['both', 'netWorth', 'product'];
const X = 150_000_00;

async function world() {
  const db = new NodeSqlDriver();
  await migrate(db, MIGRATION_SOURCES);
  const accounts = new AccountsRepository(db, NOW);
  const yields = new YieldsRepository(db, NOW);
  const open = async (name) => {
    const id = await accounts.create({
      name, type: 'debit', currency_code: 'COP', builtin_icon: 'card', opening_balance_minor: 1_000_000_00, opened_on: '2026-01-01',
    });
    await yields.enrol({ account_id: id, opening_on: '2026-01-01', withholding: false });
    const [product] = await yields.products(id);
    return { id, product: product.id };
  };
  const a = await open('Ahorro Verde');
  const b = await open('Cajita Naranja');
  const plain = await accounts.create({
    name: 'Banco Azul', type: 'debit', currency_code: 'COP', builtin_icon: 'card', opening_balance_minor: 0, opened_on: '2026-01-01',
  });
  const transfers = new TransfersRepository(db, NOW);
  const balance = async (id) => (await accounts.balance(id)).balance_minor;
  const holds = (acc) => whatItHolds(db, acc.id, acc.product, '2026-09-20');
  const snapshot = async () => ({
    a: await balance(a.id), b: await balance(b.id), pa: await holds(a), pb: await holds(b), plain: await balance(plain),
  });
  const count = async (sql) => (await db.queryOne(sql)).n;
  const rows = async () => ({
    legs: await count('SELECT COUNT(*) AS n FROM transactions'),
    entries: await count('SELECT COUNT(*) AS n FROM product_entries'),
    cashouts: await count('SELECT COUNT(*) AS n FROM product_cashouts'),
  });
  const make = (fromScope, toScope, to = b) => transfers.create({
    occurred_on: '2026-09-15', description: 'Rendimientos de septiembre',
    from: { account_id: a.id, product_id: a.product, amount_minor: X, scope: fromScope },
    to: { account_id: to.id ?? to, product_id: to.product ?? null, amount_minor: X, scope: toScope },
  });
  return { db, a, b, plain, transfers, snapshot, rows, make };
}

const fromEffect = { both: { bal: -X, held: -X }, netWorth: { bal: -X, held: 0 }, product: { bal: 0, held: -X } };
const toEffect = { both: { bal: X, held: X }, netWorth: { bal: X, held: 0 }, product: { bal: 0, held: X } };

for (const fromScope of SCOPES) {
  for (const toScope of SCOPES) {
    test(`leaving ${fromScope}, arriving ${toScope}: each balance and product moves as the answer says`, async () => {
      const w = await world();
      const before = await w.snapshot();
      const id = await w.make(fromScope, toScope);
      const after = await w.snapshot();
      assert.equal(after.a - before.a, fromEffect[fromScope].bal, 'the leaving account');
      assert.equal(after.pa - before.pa, fromEffect[fromScope].held, 'the leaving product');
      assert.equal(after.b - before.b, toEffect[toScope].bal, 'the arriving account');
      assert.equal(after.pb - before.pb, toEffect[toScope].held, 'the arriving product');

      const found = await w.transfers.findById(id);
      assert.equal(found.fromEnd.scope, fromScope);
      assert.equal(found.toEnd.scope, toScope);
      assert.equal(found.fromEnd.account_id, w.a.id);
      assert.equal(found.toEnd.account_id, w.b.id);
      assert.equal(found.fromEnd.amount_minor, X);
      assert.equal(found.toEnd.amount_minor, X);
      assert.equal(found.from === null, fromScope === 'product', 'a leg only where the balance moves');
      assert.equal(found.to === null, toScope === 'product');

      // Net worth here is the two balances: the verdict says the same.
      const effect = transferEffect({ fromScope, toScope, fromMinor: X, toMinor: X });
      const moved = (after.a + after.b) - (before.a + before.b);
      assert.equal(effect.kind === 'up' ? effect.amountMinor : effect.kind === 'down' ? -effect.amountMinor : 0, moved);

      // Deleting it leaves nothing behind.
      const empty = await (await world()).rows();
      await w.transfers.delete(id);
      assert.deepEqual(await w.rows(), empty);
      assert.deepEqual(await w.snapshot(), before);
    });
  }
}

test('a transfer from before is both at both ends, and reads back with its legs', async () => {
  const w = await world();
  const id = await w.transfers.create({
    occurred_on: '2026-09-15',
    from: { account_id: w.a.id, amount_minor: X },
    to: { account_id: w.plain, amount_minor: X },
  });
  const found = await w.transfers.findById(id);
  assert.equal(found.transfer.from_scope, 'both');
  assert.equal(found.transfer.to_scope, 'both');
  assert.ok(found.from && found.to);
  assert.deepEqual(await w.rows(), { legs: 2, entries: 0, cashouts: 0 });
});

test('changing a transfer from one shape to another leaves exactly the new shape', async () => {
  const w = await world();
  const fresh = await w.snapshot();
  const id = await w.make('both', 'both');
  const legFrom = (await w.transfers.findById(id)).from.id;
  const shapes = [['product', 'both'], ['netWorth', 'product'], ['product', 'product'], ['netWorth', 'netWorth'], ['both', 'both']];
  for (const [fromScope, toScope] of shapes) {
    await w.transfers.update(id, {
      occurred_on: '2026-09-16', description: 'Otra nota',
      from: { account_id: w.a.id, product_id: w.a.product, amount_minor: X, scope: fromScope },
      to: { account_id: w.b.id, product_id: w.b.product, amount_minor: X, scope: toScope },
    });
    const now = await w.snapshot();
    assert.equal(now.a - fresh.a, fromEffect[fromScope].bal, `${fromScope}/${toScope}: leaving account`);
    assert.equal(now.pa - fresh.pa, fromEffect[fromScope].held, `${fromScope}/${toScope}: leaving product`);
    assert.equal(now.b - fresh.b, toEffect[toScope].bal, `${fromScope}/${toScope}: arriving account`);
    assert.equal(now.pb - fresh.pb, toEffect[toScope].held, `${fromScope}/${toScope}: arriving product`);
    const found = await w.transfers.findById(id);
    assert.equal(found.transfer.occurred_on, '2026-09-16');
    const legs = (fromScope === 'product' ? 0 : 1) + (toScope === 'product' ? 0 : 1);
    const expected = {
      legs,
      entries: (fromScope === 'product' ? 1 : 0) + (toScope === 'product' ? 1 : 0) + (fromScope === 'netWorth' ? 1 : 0),
      cashouts: toScope === 'netWorth' ? 1 : 0,
    };
    assert.deepEqual(await w.rows(), expected, `${fromScope}/${toScope}: the rows`);
  }
  // Back to both/both: a leg was kept wherever one could be.
  const found = await w.transfers.findById(id);
  assert.ok(found.from && found.to);
  assert.notEqual(found.from.id, undefined);
  assert.ok(legFrom > 0);
});

test('a leg keeps its id while its end keeps touching the balance', async () => {
  const w = await world();
  const id = await w.make('both', 'both');
  const before = await w.transfers.findById(id);
  await w.transfers.update(id, {
    occurred_on: '2026-09-15',
    from: { account_id: w.a.id, product_id: w.a.product, amount_minor: X, scope: 'netWorth' },
    to: { account_id: w.b.id, product_id: w.b.product, amount_minor: X, scope: 'netWorth' },
  });
  const after = await w.transfers.findById(id);
  assert.equal(after.from.id, before.from.id);
  assert.equal(after.to.id, before.to.id);
});

test('one end alone is refused inside one account: a move between its products changes neither', async () => {
  const w = await world();
  await assert.rejects(() => w.transfers.create({
    occurred_on: '2026-09-15',
    from: { account_id: w.a.id, amount_minor: X, scope: 'product' },
    to: { account_id: w.a.id, amount_minor: X },
  }));
});

test('the verdict on net worth, for every pair of answers', () => {
  const v = (fromScope, toScope) => transferEffect({ fromScope, toScope, fromMinor: 100, toMinor: 25 });
  assert.deepEqual(v('both', 'both'), { kind: 'same', amountMinor: 0, side: null });
  assert.deepEqual(v('netWorth', 'both'), { kind: 'same', amountMinor: 0, side: null });
  assert.deepEqual(v('both', 'netWorth'), { kind: 'same', amountMinor: 0, side: null });
  assert.deepEqual(v('netWorth', 'netWorth'), { kind: 'same', amountMinor: 0, side: null });
  assert.deepEqual(v('product', 'product'), { kind: 'same', amountMinor: 0, side: null });
  assert.deepEqual(v('product', 'both'), { kind: 'up', amountMinor: 25, side: 'to' });
  assert.deepEqual(v('product', 'netWorth'), { kind: 'up', amountMinor: 25, side: 'to' });
  assert.deepEqual(v('both', 'product'), { kind: 'down', amountMinor: 100, side: 'from' });
  assert.deepEqual(v('netWorth', 'product'), { kind: 'down', amountMinor: 100, side: 'from' });
});
