// What a product's own movement is, as a list the user keeps.
//
//   node --import ./tools/db/register-ts.mjs --test tools/db/product-kinds.test.mjs
//
// Cashback, correction and other were three words fixed in the schema. Jose,
// 2026-09-16: they are categories like any other and should be his - renamed,
// given an icon, added to. Migration 034 turns them into rows and points every
// entry already written at the one it had.

import test from 'node:test';
import assert from 'node:assert/strict';

import { NodeSqlDriver } from './node-sql-driver.mjs';
import { migrate } from '../../src/app/core/database/migrations/migration-runner.ts';
import { MIGRATION_SOURCES } from '../../src/app/core/database/migrations/statements.generated.ts';
import { AccountsRepository } from '../../src/app/core/database/repositories/accounts.repository.ts';
import { YieldsRepository } from '../../src/app/core/database/repositories/yields.repository.ts';
import { ProductKindsRepository } from '../../src/app/core/database/repositories/product-kinds.repository.ts';

const NOW = () => '2026-09-16T12:00:00Z';

async function bank() {
  const db = new NodeSqlDriver();
  await migrate(db, MIGRATION_SOURCES);
  const accounts = new AccountsRepository(db, NOW);
  const account = await accounts.create({
    name: 'Rappi cuenta', type: 'debit', currency_code: 'COP', builtin_icon: 'wallet',
    opened_on: '2026-01-01', opening_balance_minor: 100_000_00,
  });
  await new YieldsRepository(db, NOW).enrol({
    account_id: account, opening_cushion_minor: 0, opening_on: '2026-01-01', withholding: true,
  });
  return { db, account, kinds: new ProductKindsRepository(db, NOW), yields: new YieldsRepository(db, NOW) };
}

test('the three that existed are there, and say how they are taxed', async () => {
  const { db, kinds } = await bank();

  const listed = await kinds.list();
  assert.deepEqual(listed.map(kind => kind.name), ['Cashback', 'Corrección del banco', 'Otro']);
  assert.equal(listed[0].counts_as, 'cashback', 'cashback is not withheld');
  assert.equal(listed[1].counts_as, 'yield');
  assert.ok(listed.every(kind => kind.builtin_icon), 'each wears a picture');
  await db.close();
});

test('a kind can be added, renamed, re-pictured and taken away', async () => {
  const { db, kinds } = await bank();

  const id = await kinds.create({ name: 'Bono de bienvenida', builtin_icon: 'gift-outline', counts_as: 'cashback' });
  assert.equal((await kinds.findById(id)).name, 'Bono de bienvenida');

  await kinds.update(id, { name: 'Bono', builtin_icon: 'star-outline', counts_as: 'yield' });
  const after = await kinds.findById(id);
  assert.equal(after.name, 'Bono');
  assert.equal(after.builtin_icon, 'star-outline');
  assert.equal(after.counts_as, 'yield');

  await kinds.delete(id);
  assert.equal(await kinds.findById(id), null);

  // A name is a name: an empty one is refused rather than stored.
  await assert.rejects(() => kinds.create({ name: '   ' }));
  await db.close();
});

test('a kind in use is not removed out from under its entries', async () => {
  const { db, kinds, yields, account } = await bank();
  const [cashback] = await kinds.list();

  await yields.adjust({
    account_id: account, on_date: '2026-09-16', amount_minor: 1_500_00,
    kind: 'cashback', product_kind_id: cashback.id, note: 'Rappi',
  });

  await assert.rejects(() => kinds.delete(cashback.id), /archive it instead/);

  // Archiving retires it: it stops being offered and the entry keeps its name.
  await kinds.update(cashback.id, { archived: true });
  assert.equal((await kinds.list()).some(kind => kind.id === cashback.id), false);
  assert.equal((await kinds.list({ includeArchived: true })).some(kind => kind.id === cashback.id), true);

  const [entry] = await yields.adjustments(account);
  assert.equal(entry.product_kind_id, cashback.id);
  await db.close();
});

test('entries written before the kinds were rows are pointed at theirs', async () => {
  const db = new NodeSqlDriver();

  // The schema as it stood before this migration, with an entry of each word.
  const before = MIGRATION_SOURCES.filter(source => source.version <= 33);
  await migrate(db, before);

  const account = await new AccountsRepository(db, NOW).create({
    name: 'Pibank', type: 'debit', currency_code: 'COP', builtin_icon: 'wallet', opened_on: '2026-01-01',
  });
  for (const [kind, amount] of [['cashback', 1000], ['correction', 2000], ['other', 3000]]) {
    await db.run(
      `INSERT INTO cushion_adjustments (account_id, source, kind, on_date, amount_minor, created_at, updated_at)
       VALUES (?, 'yield', ?, '2026-09-01', ?, ?, ?)`,
      [account, kind, amount, NOW(), NOW()]);
  }

  await migrate(db, MIGRATION_SOURCES);

  const rows = await db.query(
    `SELECT a.kind, k.name, k.counts_as
     FROM cushion_adjustments a JOIN product_kinds k ON k.id = a.product_kind_id
     ORDER BY a.amount_minor`);
  assert.deepEqual(rows.map(row => [row.kind, row.name]), [
    ['cashback', 'Cashback'],
    ['correction', 'Corrección del banco'],
    ['other', 'Otro'],
  ]);
  assert.equal(rows[0].counts_as, 'cashback');
  await db.close();
});
