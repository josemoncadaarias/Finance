// Tests for multi-currency accounts.
//
//   node --import ./tools/db/register-ts.mjs --test tools/db/account-groups.test.mjs
//
// The cases here are the real ones: Global66 holds COP and USD, ARQ holds USD
// and EUR, and Plata holds only COP.

import test from 'node:test';
import assert from 'node:assert/strict';

import { NodeSqlDriver } from './node-sql-driver.mjs';
import { migrate } from '../../src/app/core/database/migrations/migration-runner.ts';
import { MIGRATION_SOURCES } from '../../src/app/core/database/migrations/statements.generated.ts';
import { AccountsRepository } from '../../src/app/core/database/repositories/accounts.repository.ts';
import { AccountGroupsRepository } from '../../src/app/core/database/repositories/account-groups.repository.ts';
import { CategoriesRepository } from '../../src/app/core/database/repositories/categories.repository.ts';
import { TransactionsRepository } from '../../src/app/core/database/repositories/transactions.repository.ts';
import { TransfersRepository } from '../../src/app/core/database/repositories/transfers.repository.ts';

const NOW = () => '2026-09-08T12:00:00Z';

async function setup() {
  const db = new NodeSqlDriver();
  await migrate(db, MIGRATION_SOURCES);
  return {
    db,
    accounts: new AccountsRepository(db, NOW),
    groups: new AccountGroupsRepository(db, NOW),
    categories: new CategoriesRepository(db, NOW),
    transactions: new TransactionsRepository(db, NOW),
    transfers: new TransfersRepository(db, NOW),
  };
}

test('the three currencies the app starts with are seeded', async () => {
  const { db } = await setup();
  const codes = (await db.query('SELECT code FROM currencies ORDER BY code')).map(r => r.code);
  assert.deepEqual(codes, ['COP', 'EUR', 'USD']);
  await db.close();
});

test('Global66 holds COP and USD as two rows under one group', async () => {
  const { db, accounts, groups } = await setup();

  const global66 = await groups.create({ name: 'Global66', builtin_icon: 'globe' });
  const cop = await accounts.create({
    name: 'Global66 COP', type: 'debit', currency_code: 'COP', group_id: global66,
    builtin_icon: 'globe', opened_on: '2023-01-01',
  });
  const usd = await accounts.create({
    name: 'Global66 USD', type: 'debit', currency_code: 'USD', group_id: global66,
    builtin_icon: 'globe', opened_on: '2023-01-01',
  });

  const members = await groups.currenciesOf(global66);
  assert.deepEqual(members.map(m => m.currency_code), ['COP', 'USD']);
  assert.deepEqual(members.map(m => m.id).sort(), [cop, usd].sort());
  await db.close();
});

test('a group cannot hold the same currency twice', async () => {
  const { db, accounts, groups } = await setup();
  const arq = await groups.create({ name: 'ARQ', builtin_icon: 'trending-up' });

  await accounts.create({
    name: 'ARQ USD', type: 'investment', currency_code: 'USD', group_id: arq,
    builtin_icon: 'trending-up', opened_on: '2024-08-13',
  });
  await accounts.create({
    name: 'ARQ EUR', type: 'investment', currency_code: 'EUR', group_id: arq,
    builtin_icon: 'trending-up', opened_on: '2025-01-01',
  });

  // There is no such thing as two separate USD balances inside one ARQ.
  await assert.rejects(() => accounts.create({
    name: 'ARQ USD again', type: 'investment', currency_code: 'USD', group_id: arq,
    builtin_icon: 'trending-up', opened_on: '2025-01-01',
  }));
  await db.close();
});

test('ungrouped accounts may freely share a currency', async () => {
  const { db, accounts } = await setup();

  // Plata, Bancolombia and Nequi are all COP and all ungrouped. SQLite treats
  // NULLs as distinct in a unique index, which is what makes this work.
  await accounts.create({ name: 'Plata', type: 'debit', currency_code: 'COP', builtin_icon: 'wallet', opened_on: '2026-09-08' });
  await accounts.create({ name: 'Bancolombia', type: 'debit', currency_code: 'COP', builtin_icon: 'business', opened_on: '2021-06-30' });
  await accounts.create({ name: 'Nequi', type: 'debit', currency_code: 'COP', builtin_icon: 'phone', opened_on: '2021-06-25' });

  const all = await accounts.list();
  assert.equal(all.length, 3);
  assert.ok(all.every(a => a.group_id === null));
  await db.close();
});

test('balances by group keep each currency separate', async () => {
  const { db, accounts, groups, categories, transactions } = await setup();

  const global66 = await groups.create({ name: 'Global66', builtin_icon: 'globe' });
  const cop = await accounts.create({
    name: 'Global66 COP', type: 'debit', currency_code: 'COP', group_id: global66,
    builtin_icon: 'globe', opened_on: '2023-01-01',
  });
  const usd = await accounts.create({
    name: 'Global66 USD', type: 'debit', currency_code: 'USD', group_id: global66,
    builtin_icon: 'globe', opened_on: '2023-01-01',
  });
  const plata = await accounts.create({
    name: 'Plata', type: 'debit', currency_code: 'COP', builtin_icon: 'wallet', opened_on: '2026-09-08',
  });

  const category = await categories.create({ name: 'Comida', kind: 'expense', builtin_icon: 'restaurant' });
  await transactions.create({ account_id: cop, category_id: category, occurred_on: '2026-01-10', amount_minor: -5000000 });
  await transactions.create({
    account_id: usd, category_id: category, occurred_on: '2026-01-11',
    amount_minor: -12500, rate_scaled: 42000000, rate_source: 'manual',
  });
  await transactions.create({ account_id: plata, category_id: category, occurred_on: '2026-09-08', amount_minor: 20000000 });

  const grouped = await accounts.balancesByGroup();
  const global = grouped.find(entry => entry.group?.name === 'Global66');

  assert.ok(global, 'Global66 must come back as one entry');
  assert.equal(global.balances.length, 2, 'with one balance per currency');

  const byCurrency = Object.fromEntries(global.balances.map(b => [b.account.currency_code, b.balance_minor]));
  assert.equal(byCurrency['COP'], -5000000);
  assert.equal(byCurrency['USD'], -12500);

  // Plata stands on its own rather than being lumped with other ungrouped ones.
  const plataEntry = grouped.find(entry => entry.group === null && entry.balances[0].account.name === 'Plata');
  assert.ok(plataEntry);
  assert.equal(plataEntry.balances.length, 1);
  assert.equal(plataEntry.balances[0].balance_minor, 20000000);
  await db.close();
});

test('converting inside one account is a transfer between its currencies', async () => {
  const { db, accounts, groups, transfers } = await setup();

  const global66 = await groups.create({ name: 'Global66', builtin_icon: 'globe' });
  const cop = await accounts.create({
    name: 'Global66 COP', type: 'debit', currency_code: 'COP', group_id: global66,
    builtin_icon: 'globe', opened_on: '2023-01-01',
  });
  const usd = await accounts.create({
    name: 'Global66 USD', type: 'debit', currency_code: 'USD', group_id: global66,
    builtin_icon: 'globe', opened_on: '2023-01-01',
  });

  // 400,000 COP converted to 95.00 USD inside Global66, at 4,210.53.
  const transferId = await transfers.create({
    occurred_on: '2026-02-01',
    description: 'Conversion COP a USD dentro de Global66',
    from: { account_id: cop, amount_minor: 40000000 },
    to: { account_id: usd, amount_minor: 9500, rate_scaled: 42105300, rate_source: 'derived' },
  });

  const { from, to } = await transfers.findById(transferId);
  assert.equal(from.amount_minor, -40000000);
  assert.equal(to.amount_minor, 9500);
  // The rate the provider applied is captured, which is the whole point of
  // modelling the conversion as a transfer rather than as two loose entries.
  assert.equal(to.rate_scaled, 42105300);
  assert.equal(to.amount_base_minor, 40000035);

  const grouped = await accounts.balancesByGroup();
  const global = grouped.find(entry => entry.group?.name === 'Global66');
  const byCurrency = Object.fromEntries(global.balances.map(b => [b.account.currency_code, b.balance_minor]));
  assert.equal(byCurrency['COP'], -40000000);
  assert.equal(byCurrency['USD'], 9500);
  await db.close();
});

test('deleting a group leaves its accounts and their history alone', async () => {
  const { db, accounts, groups, categories, transactions } = await setup();

  const global66 = await groups.create({ name: 'Global66', builtin_icon: 'globe' });
  const usd = await accounts.create({
    name: 'Global66 USD', type: 'debit', currency_code: 'USD', group_id: global66,
    builtin_icon: 'globe', opened_on: '2023-01-01',
  });
  const category = await categories.create({ name: 'Comida', kind: 'expense', builtin_icon: 'restaurant' });
  await transactions.create({ account_id: usd, category_id: category, occurred_on: '2026-01-11', amount_minor: -12500 });

  await groups.delete(global66);

  const account = await accounts.findById(usd);
  assert.ok(account, 'the account survives');
  assert.equal(account.group_id, null, 'it simply becomes ungrouped');
  assert.equal((await accounts.balance(usd)).balance_minor, -12500, 'its history is untouched');
  await db.close();
});

test('group names are unique and groups need exactly one icon', async () => {
  const { db, groups } = await setup();

  await groups.create({ name: 'Global66', builtin_icon: 'globe' });
  await assert.rejects(() => groups.create({ name: 'Global66', builtin_icon: 'globe' }));
  await assert.rejects(() => groups.create({ name: 'ARQ' }), /icon|NOT NULL|CHECK/i);
  await db.close();
});
