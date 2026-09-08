// Tests for the repository layer, against a real SQLite engine.
//
//   node --import ./tools/db/register-ts.mjs --test tools/db/repositories.test.mjs
//
// The accounts, amounts and transfers used here are real ones from
// data/Monefy.Data.csv.

import test from 'node:test';
import assert from 'node:assert/strict';

import { NodeSqlDriver } from './node-sql-driver.mjs';
import { migrate } from '../../src/app/core/database/migrations/migration-runner.ts';
import { MIGRATION_SOURCES } from '../../src/app/core/database/migrations/statements.generated.ts';
import { AccountsRepository } from '../../src/app/core/database/repositories/accounts.repository.ts';
import { CategoriesRepository } from '../../src/app/core/database/repositories/categories.repository.ts';
import { TransactionsRepository } from '../../src/app/core/database/repositories/transactions.repository.ts';
import { TransfersRepository } from '../../src/app/core/database/repositories/transfers.repository.ts';
import { formatMoney } from '../../src/app/core/database/money.ts';

const NOW = () => '2026-09-08T12:00:00Z';

async function setup() {
  const db = new NodeSqlDriver();
  await migrate(db, MIGRATION_SOURCES);

  const accounts = new AccountsRepository(db, NOW);
  const categories = new CategoriesRepository(db, NOW);
  const transactions = new TransactionsRepository(db, NOW);
  const transfers = new TransfersRepository(db, NOW);

  const bancolombia = await accounts.create({
    name: 'Bancolombia', type: 'debit', currency_code: 'COP', builtin_icon: 'business',
    opening_balance_minor: 470307956, opened_on: '2021-06-30',
  });
  const card = await accounts.create({
    name: 'Tarjeta credito rappi', type: 'credit', currency_code: 'COP', builtin_icon: 'card',
    credit_limit_minor: 110000000, opened_on: '2021-06-25',
  });
  const rappi = await accounts.create({
    name: 'Rappi cuenta', type: 'debit', currency_code: 'COP', builtin_icon: 'wallet',
    opened_on: '2021-07-01',
  });
  const arq = await accounts.create({
    name: 'ARQ', type: 'investment', currency_code: 'USD', builtin_icon: 'trending-up',
    opened_on: '2024-08-13',
  });

  const restaurante = await categories.create({ name: 'Restaurante', kind: 'expense', builtin_icon: 'restaurant' });
  const transporte = await categories.create({ name: 'Transporte', kind: 'expense', builtin_icon: 'bus' });

  return { db, accounts, categories, transactions, transfers,
           ids: { bancolombia, card, rappi, arq, restaurante, transporte } };
}

test('creating an account defaults its base opening balance to its own', async () => {
  const { db, accounts, ids } = await setup();
  const account = await accounts.findById(ids.bancolombia);

  assert.equal(account.opening_balance_minor, 470307956);
  // A COP account: the two are the same figure.
  assert.equal(account.opening_balance_base_minor, 470307956);
  assert.equal(account.include_in_net_worth, 1);
  assert.equal(account.archived, 0);
  await db.close();
});

test('an account needs exactly one icon, on update as well as on insert', async () => {
  const { db, accounts, ids } = await setup();
  await db.run(
    `INSERT INTO custom_icons (id, name, mime_type, data, created_at) VALUES (1, 'Bancolombia', 'image/png', x'89504e47', ?)`,
    [NOW()],
  );

  // Swapping to a custom logo clears the built-in one in the same statement.
  await accounts.update(ids.bancolombia, { custom_icon_id: 1 });
  const withLogo = await accounts.findById(ids.bancolombia);
  assert.equal(withLogo.custom_icon_id, 1);
  assert.equal(withLogo.builtin_icon, null);

  // And back again.
  await accounts.update(ids.bancolombia, { builtin_icon: 'business' });
  const withBuiltin = await accounts.findById(ids.bancolombia);
  assert.equal(withBuiltin.builtin_icon, 'business');
  assert.equal(withBuiltin.custom_icon_id, null);

  await assert.rejects(() => accounts.update(ids.bancolombia, { builtin_icon: 'card', custom_icon_id: 1 }),
    /exactly one/);
  await db.close();
});

test('balances follow the transactions, and a card reports its available credit', async () => {
  const { db, accounts, transactions, ids } = await setup();

  await transactions.create({
    account_id: ids.bancolombia, category_id: ids.restaurante,
    occurred_on: '2021-06-26', amount_minor: -5020000, description: 'Rappi',
  });
  await transactions.create({
    account_id: ids.card, category_id: ids.restaurante,
    occurred_on: '2024-01-19', amount_minor: -4770940, description: 'Actualizacion juego',
  });

  const balances = await accounts.balances();
  const byName = Object.fromEntries(balances.map(b => [b.account.name, b]));

  assert.equal(byName['Bancolombia'].balance_minor, 470307956 - 5020000);
  assert.equal(byName['Bancolombia'].available_credit_minor, null);

  assert.equal(byName['Tarjeta credito rappi'].balance_minor, -4770940);
  assert.equal(byName['Tarjeta credito rappi'].available_credit_minor, 105229060);
  assert.equal(
    formatMoney(byName['Tarjeta credito rappi'].available_credit_minor, 'COP', { withSymbol: false }),
    '1.052.290,60',
  );
  await db.close();
});

test('a balance as of a past date ignores later transactions but keeps the account', async () => {
  const { db, accounts, transactions, ids } = await setup();

  await transactions.create({
    account_id: ids.bancolombia, category_id: ids.restaurante,
    occurred_on: '2021-06-26', amount_minor: -5020000,
  });
  await transactions.create({
    account_id: ids.bancolombia, category_id: ids.restaurante,
    occurred_on: '2026-01-15', amount_minor: -1000000,
  });

  const asOf = await accounts.balances({ asOf: '2021-12-31' });
  const bancolombia = asOf.find(b => b.account.name === 'Bancolombia');
  assert.equal(bancolombia.balance_minor, 470307956 - 5020000);

  // An account with no movement yet must still appear, at its opening balance.
  const rappi = asOf.find(b => b.account.name === 'Rappi cuenta');
  assert.ok(rappi, 'an account with no transactions must not drop out');
  assert.equal(rappi.balance_minor, 0);
  await db.close();
});

test('a cross-currency transfer writes both legs and moves both balances', async () => {
  const { db, accounts, transfers, ids } = await setup();

  // 13/08/2024: 100,000 COP out of Rappi, 23.73 USD into ARQ at 4,214.00.
  const transferId = await transfers.create({
    occurred_on: '2024-08-13',
    description: 'Transferencia a dolarapp',
    from: { account_id: ids.rappi, amount_minor: 10000000 },
    to: { account_id: ids.arq, amount_minor: 2373, rate_scaled: 42140000, rate_source: 'derived' },
    confidence: 'low',
  });

  const { from, to } = await transfers.findById(transferId);
  assert.equal(from.amount_minor, -10000000);
  assert.equal(from.category_id, null);
  assert.equal(to.amount_minor, 2373);
  // The base amount is derived once, from the rate that applied: 99,998.22 COP.
  assert.equal(to.amount_base_minor, 9999822);
  assert.equal(to.confidence, 'low');

  const balances = await accounts.balances();
  const byName = Object.fromEntries(balances.map(b => [b.account.name, b.balance_minor]));
  assert.equal(byName['Rappi cuenta'], -10000000);
  assert.equal(byName['ARQ'], 2373);

  // Amounts are given as positive values; the repository applies the signs.
  await assert.rejects(() => transfers.create({
    occurred_on: '2024-08-13',
    from: { account_id: ids.rappi, amount_minor: -100 },
    to: { account_id: ids.arq, amount_minor: 100 },
  }), /positive/);
  await db.close();
});

test('a failed transfer leaves no half-written header behind', async () => {
  const { db, transfers, ids } = await setup();

  await assert.rejects(() => transfers.create({
    occurred_on: '2024-08-13',
    from: { account_id: ids.rappi, amount_minor: 10000000 },
    to: { account_id: 9999, amount_minor: 2373 }, // no such account
  }));

  const headers = await db.query('SELECT id FROM transfers');
  assert.equal(headers.length, 0, 'the header must have been rolled back with the legs');
  await db.close();
});

test('editing an imported transaction locks it against re-import', async () => {
  const { db, transactions, ids } = await setup();

  const id = await transactions.create({
    account_id: ids.arq, category_id: ids.restaurante, occurred_on: '2024-09-01',
    amount_minor: 10000, rate_scaled: 42000000, rate_source: 'trm', confidence: 'low',
    source: 'monefy', import_fingerprint: 'fp-1', import_seq: 1,
  });

  const before = await transactions.findById(id);
  assert.equal(before.locked, 0);
  assert.equal(before.amount_base_minor, 42000000); // 100.00 USD at 4,200.00

  // Jose corrects the rate to the one the bank actually applied.
  await transactions.update(id, { rate_scaled: 42140000, rate_source: 'manual', confidence: 'high' });

  const after = await transactions.findById(id);
  assert.equal(after.locked, 1, 'a hand edit must lock the row');
  assert.equal(after.rate_scaled, 42140000);
  // The base amount is recomputed from the corrected rate, not left stale.
  assert.equal(after.amount_base_minor, 42140000);
  assert.equal(after.confidence, 'high');
  await db.close();
});

test('the importer can tell which fingerprints it has already stored', async () => {
  const { db, transactions, ids } = await setup();

  await transactions.create({
    account_id: ids.bancolombia, category_id: ids.transporte, occurred_on: '2022-07-23',
    amount_minor: -260000, source: 'monefy', import_fingerprint: 'fp-bus', import_seq: 1,
  });
  await transactions.create({
    account_id: ids.bancolombia, category_id: ids.transporte, occurred_on: '2022-07-23',
    amount_minor: -260000, source: 'monefy', import_fingerprint: 'fp-bus', import_seq: 2,
  });
  await transactions.create({
    account_id: ids.bancolombia, category_id: ids.restaurante, occurred_on: '2021-06-26',
    amount_minor: -5020000, source: 'manual',
  });

  const seen = await transactions.importedFingerprints();
  assert.equal(seen.get('fp-bus'), 2, 'both copies of the duplicated row are accounted for');
  assert.equal(seen.size, 1, 'a manually created row carries no fingerprint');
  await db.close();
});

test('reports exclude transfer legs and total by category', async () => {
  const { db, transactions, transfers, ids } = await setup();

  await transactions.create({
    account_id: ids.bancolombia, category_id: ids.restaurante,
    occurred_on: '2024-03-01', amount_minor: -5020000,
  });
  await transactions.create({
    account_id: ids.bancolombia, category_id: ids.restaurante,
    occurred_on: '2024-03-15', amount_minor: -3000000,
  });
  await transactions.create({
    account_id: ids.bancolombia, category_id: ids.transporte,
    occurred_on: '2024-03-20', amount_minor: -260000,
  });
  // A transfer in the same month must not show up as spending.
  await transfers.create({
    occurred_on: '2024-03-25',
    from: { account_id: ids.bancolombia, amount_minor: 20000000 },
    to: { account_id: ids.rappi, amount_minor: 20000000 },
  });

  const totals = await transactions.totalsByCategory({ from: '2024-03-01', to: '2024-03-31' });
  const byCategory = Object.fromEntries(totals.map(t => [t.category_id, t]));

  assert.equal(totals.length, 2, 'only the two real categories, no transfer legs');
  assert.equal(byCategory[ids.restaurante].total_minor, -8020000);
  assert.equal(byCategory[ids.restaurante].count, 2);
  assert.equal(byCategory[ids.transporte].total_minor, -260000);

  const listed = await transactions.list({ from: '2024-03-01', to: '2024-03-31', excludeTransfers: true });
  assert.equal(listed.length, 3);
  assert.equal(listed[0].occurred_on, '2024-03-20', 'newest first');
  await db.close();
});

test('net worth adds base amounts and honours the exclusion flag', async () => {
  const { db, accounts, transactions, transfers, ids } = await setup();

  await transactions.create({
    account_id: ids.bancolombia, category_id: ids.restaurante,
    occurred_on: '2024-03-01', amount_minor: -5020000,
  });
  // A USD leg contributes its frozen COP equivalent, not its dollar figure.
  await transfers.create({
    occurred_on: '2024-08-13',
    from: { account_id: ids.rappi, amount_minor: 10000000 },
    to: { account_id: ids.arq, amount_minor: 2373, rate_scaled: 42140000 },
  });

  const total = await accounts.netWorthMinor();
  // Bancolombia opening less the meal, Rappi negative, ARQ at its frozen COP.
  assert.equal(total, 470307956 - 5020000 - 10000000 + 9999822);

  // Excluding an account removes it from the total but leaves its ledger alone.
  await db.run('UPDATE accounts SET include_in_net_worth = 0 WHERE id = ?', [ids.arq]);
  assert.equal(await accounts.netWorthMinor(), 470307956 - 5020000 - 10000000);
  await db.close();
});

test('categories are found or created, never duplicated', async () => {
  const { db, categories } = await setup();

  const first = await categories.findOrCreate({ name: 'Mercado', kind: 'expense', builtin_icon: 'cart' });
  const second = await categories.findOrCreate({ name: 'Mercado', kind: 'expense', builtin_icon: 'cart' });
  assert.equal(first, second);

  // The same name as an income category is a different category.
  const income = await categories.findOrCreate({ name: 'Mercado', kind: 'income', builtin_icon: 'cart' });
  assert.notEqual(first, income);

  const expenses = await categories.list({ kind: 'expense' });
  assert.ok(expenses.every(c => c.kind === 'expense'));

  await categories.archive(first);
  assert.equal((await categories.list({ kind: 'expense' })).some(c => c.id === first), false);
  assert.equal((await categories.list({ kind: 'expense', includeArchived: true })).some(c => c.id === first), true);
  await db.close();
});
