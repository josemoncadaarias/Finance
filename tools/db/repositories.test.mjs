// Tests for the repository layer, against a real SQLite engine.
//
//   node --import ./tools/db/register-ts.mjs --test tools/db/repositories.test.mjs
//
// The accounts, amounts and transfers used here are real ones from
// data/monefy-2026-09-07.csv.

import test from 'node:test';
import assert from 'node:assert/strict';

import { NodeSqlDriver } from './node-sql-driver.mjs';
import { migrate } from '../../src/app/core/database/migrations/migration-runner.ts';
import { MIGRATION_SOURCES } from '../../src/app/core/database/migrations/statements.generated.ts';
import { AccountsRepository } from '../../src/app/core/database/repositories/accounts.repository.ts';
import { CategoriesRepository } from '../../src/app/core/database/repositories/categories.repository.ts';
import { TransactionsRepository } from '../../src/app/core/database/repositories/transactions.repository.ts';
import { TransfersRepository } from '../../src/app/core/database/repositories/transfers.repository.ts';
import { CreditLimitsRepository } from '../../src/app/core/database/repositories/credit-limits.repository.ts';
import { CustomIconsRepository } from '../../src/app/core/database/repositories/custom-icons.repository.ts';
import { RatesRepository } from '../../src/app/core/database/repositories/rates.repository.ts';
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

test('net worth values today, and honours the exclusion flag', async () => {
  const { db, accounts, transactions, transfers, ids } = await setup();
  const rates = new RatesRepository(db, NOW);

  await transactions.create({
    account_id: ids.bancolombia, category_id: ids.restaurante,
    occurred_on: '2024-03-01', amount_minor: -5020000,
  });

  // Dollars bought in 2024 at 4,214 a dollar.
  await transfers.create({
    occurred_on: '2024-08-13',
    from: { account_id: ids.rappi, amount_minor: 10000000 },
    to: { account_id: ids.arq, amount_minor: 2373, rate_scaled: 42140000 },
  });

  // Today they are worth today's rate, not the one they were bought at.
  await rates.set({ on_date: '2026-09-09', base_code: 'USD', quote_code: 'COP', rate_scaled: 40000000 });

  const pesos = 470307956 - 5020000 - 10000000;
  assert.equal(await accounts.netWorthMinor("2026-09-09"), pesos + 9492000,
    '23.73 dollars at 4,000, not the 9,999.82 they cost');

  // Excluding an account removes it from the total but leaves its ledger alone.
  await db.run('UPDATE accounts SET include_in_net_worth = 0 WHERE id = ?', [ids.arq]);
  assert.equal(await accounts.netWorthMinor('2026-09-09'), pesos);
  assert.equal((await accounts.balance(ids.arq)).balance_minor, 2373);
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

test('a note that was written before comes back as a suggestion', async () => {
  const { db, transactions, ids } = await setup();

  const spend = (description, occurred_on) => transactions.create({
    account_id: ids.bancolombia, category_id: ids.restaurante,
    occurred_on, amount_minor: -1500000, description, source: 'manual',
  });

  await spend('Almuerzo con Ana', '2026-01-10');
  await spend('Almuerzo con Ana', '2026-03-04');
  await spend('Almuerzo solo', '2026-08-20');
  await spend('Mercado', '2026-08-21');
  await spend(null, '2026-08-22');

  // Three letters, and both matches are offered — the one used twice first.
  assert.deepEqual(await transactions.suggestNotes('alm'),
    ['Almuerzo con Ana', 'Almuerzo solo']);

  // It matches anywhere in the note, not only at the start.
  assert.deepEqual(await transactions.suggestNotes('con Ana'), ['Almuerzo con Ana']);

  // Nothing written, nothing to suggest.
  assert.deepEqual(await transactions.suggestNotes('  '), []);
  assert.deepEqual(await transactions.suggestNotes('zzz'), []);

  // A wildcard means the character itself, not "everything".
  assert.deepEqual(await transactions.suggestNotes('%'), []);
  await db.close();
});

test('a credit limit keeps its history and the card follows the current one', async () => {
  const { db, accounts, ids } = await setup();
  const limits = new CreditLimitsRepository(db, NOW);

  // The card opened at 800,000 and grew twice, exactly as the backup tells it.
  await limits.set({ account_id: ids.card, limit_minor: 80000000,
                     effective_on: '2021-06-25', note: 'Cupo inicial' });
  await limits.set({ account_id: ids.card, limit_minor: 100000000,
                     effective_on: '2024-03-11', note: 'Aumento cupo' });
  await limits.set({ account_id: ids.card, limit_minor: 110000000,
                     effective_on: '2025-07-02', note: 'Aumento cupo' });

  const history = await limits.history(ids.card);
  assert.deepEqual(history.map(h => [h.effective_on, h.limit_minor]), [
    ['2021-06-25', 80000000],
    ['2024-03-11', 100000000],
    ['2025-07-02', 110000000],
  ]);

  // Available credit comes from the limit in force, which the card now carries.
  assert.equal((await accounts.findById(ids.card)).credit_limit_minor, 110000000);
  assert.equal(await limits.limitOn(ids.card, '2024-06-01'), 100000000);
  assert.equal(await limits.limitOn(ids.card, '2021-01-01'), null);

  // A limit can go down as easily as up: same act, same call.
  await limits.set({ account_id: ids.card, limit_minor: 90000000,
                     effective_on: '2026-09-09', note: 'Reducción de cupo' });
  assert.equal((await accounts.findById(ids.card)).credit_limit_minor, 90000000);

  // A change dated ahead is recorded but is not in force yet.
  await limits.set({ account_id: ids.card, limit_minor: 150000000, effective_on: '2099-01-01' });
  assert.equal((await accounts.findById(ids.card)).credit_limit_minor, 90000000);
  assert.equal((await limits.history(ids.card)).length, 5);

  // One answer per day: correcting a typo replaces it, never doubles it.
  await limits.set({ account_id: ids.card, limit_minor: 95000000, effective_on: '2026-09-09' });
  assert.equal((await limits.history(ids.card)).length, 5);
  assert.equal((await accounts.findById(ids.card)).credit_limit_minor, 95000000);

  // Undoing a change puts the previous limit back in force.
  const latest = (await limits.history(ids.card)).find(h => h.effective_on === '2026-09-09');
  await limits.remove(latest.id);
  assert.equal((await accounts.findById(ids.card)).credit_limit_minor, 110000000);
  await db.close();
});

test('the import seeds limit history without overruling a corrected limit', async () => {
  const { db, accounts, ids } = await setup();
  const limits = new CreditLimitsRepository(db, NOW);

  assert.equal(await limits.addIfMissing({
    account_id: ids.card, limit_minor: 80000000, effective_on: '2021-06-25' }), true);
  // The card was configured at 1,100,000; a backup that only reaches 800,000
  // must not drag it back.
  assert.equal((await accounts.findById(ids.card)).credit_limit_minor, 110000000);

  // Re-importing states the same change again and changes nothing.
  assert.equal(await limits.addIfMissing({
    account_id: ids.card, limit_minor: 80000000, effective_on: '2021-06-25' }), false);
  assert.equal((await limits.history(ids.card)).length, 1);

  // And it never overwrites a figure the user fixed by hand.
  await limits.set({ account_id: ids.card, limit_minor: 85000000,
                     effective_on: '2021-06-25', note: 'Corregido' });
  await limits.addIfMissing({
    account_id: ids.card, limit_minor: 80000000, effective_on: '2021-06-25' });
  assert.equal((await limits.history(ids.card))[0].limit_minor, 85000000);
  await db.close();
});

test('editing a transfer rewrites both legs together', async () => {
  const { db, accounts, transfers, transactions, ids } = await setup();

  const id = await transfers.create({
    occurred_on: '2026-09-01',
    description: 'Pago tarjeta',
    from: { account_id: ids.rappi, amount_minor: 20000000 },
    to: { account_id: ids.card, amount_minor: 20000000 },
  });

  // Wrong account, wrong amount, wrong day: all three fixed at once.
  await transfers.update(id, {
    occurred_on: '2026-09-03',
    description: 'Pago tarjeta corregido',
    from: { account_id: ids.bancolombia, amount_minor: 25000000 },
    to: { account_id: ids.card, amount_minor: 25000000 },
  });

  const after = await transfers.findById(id);
  assert.equal(after.transfer.occurred_on, '2026-09-03');
  assert.equal(after.transfer.description, 'Pago tarjeta corregido');

  assert.equal(after.from.account_id, ids.bancolombia);
  assert.equal(after.from.amount_minor, -25000000, 'the leg that pays is negative');
  assert.equal(after.from.occurred_on, '2026-09-03');
  assert.equal(after.to.amount_minor, 25000000);
  assert.equal(after.to.account_id, ids.card);

  // Base amounts follow, or a same-currency transfer would stop balancing.
  assert.equal(after.from.amount_base_minor + after.to.amount_base_minor, 0);

  // Both legs are locked, so a re-import leaves the correction alone.
  assert.equal(after.from.locked, 1);
  assert.equal(after.to.locked, 1);

  // The account it was moved off no longer carries it.
  assert.equal((await accounts.balance(ids.rappi)).balance_minor, 0);
  assert.equal((await accounts.balance(ids.card)).balance_minor, 25000000);

  // Still exactly two legs: an edit never adds a third.
  const legs = await transactions.list({});
  assert.equal(legs.filter(t => t.transfer_id === id).length, 2);
  await db.close();
});

test('editing a cross-currency transfer keeps each side its own figure', async () => {
  const { db, transfers, ids } = await setup();

  // 100,000 COP left Rappi and 23.73 USD arrived at ARQ.
  const id = await transfers.create({
    occurred_on: '2026-09-01',
    from: { account_id: ids.rappi, amount_minor: 10000000 },
    to: { account_id: ids.arq, amount_minor: 2373, rate_scaled: 42140000,
          amount_base_minor: 10000000, rate_source: 'derived' },
  });

  await transfers.update(id, {
    occurred_on: '2026-09-01',
    from: { account_id: ids.rappi, amount_minor: 20000000 },
    to: { account_id: ids.arq, amount_minor: 4746, rate_scaled: 42140000,
          amount_base_minor: 20000000, rate_source: 'derived' },
  });

  const after = await transfers.findById(id);
  assert.equal(after.from.amount_minor, -20000000, 'pesos left');
  assert.equal(after.to.amount_minor, 4746, 'dollars arrived');
  // The dollar leg is worth what left, not what a dollar figure would convert to.
  assert.equal(after.to.amount_base_minor, 20000000);
  assert.equal(after.from.amount_base_minor, -20000000);
  await db.close();
});

test('deleting a transfer takes both legs, never one', async () => {
  const { db, accounts, transfers, transactions, ids } = await setup();

  const id = await transfers.create({
    occurred_on: '2026-09-01',
    from: { account_id: ids.rappi, amount_minor: 20000000 },
    to: { account_id: ids.card, amount_minor: 20000000 },
  });

  await transfers.delete(id);

  assert.equal(await transfers.findById(id), null);
  assert.equal((await transactions.list({})).filter(t => t.transfer_id === id).length, 0);
  assert.equal((await accounts.balance(ids.rappi)).balance_minor, 0);
  assert.equal((await accounts.balance(ids.card)).balance_minor, 0);
  await db.close();
});

test('a transfer edit is refused rather than half applied', async () => {
  const { db, transfers, ids } = await setup();

  const id = await transfers.create({
    occurred_on: '2026-09-01',
    from: { account_id: ids.rappi, amount_minor: 20000000 },
    to: { account_id: ids.card, amount_minor: 20000000 },
  });

  // A negative amount says the caller is applying signs itself, which is the
  // one way to end up with both legs pointing the same direction.
  await assert.rejects(() => transfers.update(id, {
    occurred_on: '2026-09-02',
    from: { account_id: ids.rappi, amount_minor: -5000000 },
    to: { account_id: ids.card, amount_minor: 5000000 },
  }));

  // Nothing moved.
  const after = await transfers.findById(id);
  assert.equal(after.transfer.occurred_on, '2026-09-01');
  assert.equal(after.from.amount_minor, -20000000);
  await db.close();
});

test('a user-supplied icon is stored whole and guarded by its size', async () => {
  const { db, accounts, ids } = await setup();
  const icons = new CustomIconsRepository(db, NOW);

  // A tiny PNG, byte for byte what a real one starts with.
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
  const id = await icons.create({ name: 'Bancolombia', mime_type: 'image/png', data: png });

  const stored = await icons.findById(id);
  assert.equal(stored.name, 'Bancolombia');
  assert.deepEqual(new Uint8Array(stored.data), png, 'the bytes come back untouched');
  assert.equal((await icons.list()).length, 1);
  assert.equal((await icons.list())[0].data, undefined, 'listing does not carry the bytes');

  // Not an image this app can store.
  await assert.rejects(() => icons.create({
    name: 'x', mime_type: 'application/pdf', data: png }), /not an image/);

  // Too big to be an icon.
  await assert.rejects(() => icons.create({
    name: 'x', mime_type: 'image/png', data: new Uint8Array(100_001) }), /the limit is/);

  await assert.rejects(() => icons.create({
    name: 'x', mime_type: 'image/png', data: new Uint8Array(0) }), /empty/);

  // An account wearing it cannot have it pulled out from under it.
  await accounts.update(ids.bancolombia, { builtin_icon: null, custom_icon_id: id });
  await assert.rejects(() => icons.delete(id), /still used by Bancolombia/);

  // Once nothing wears it, it goes.
  await accounts.update(ids.bancolombia, { custom_icon_id: null, builtin_icon: 'business' });
  await icons.delete(id);
  assert.equal(await icons.findById(id), null);
  await db.close();
});

test('categories come back ordered by how often they are used', async () => {
  const { db, categories, transactions, ids } = await setup();
  const taxi = await categories.create({ name: 'Taxi', kind: 'expense', builtin_icon: 'car' });
  const rare = await categories.create({ name: 'Regalos', kind: 'expense', builtin_icon: 'gift' });
  await categories.create({ name: 'Sueldo', kind: 'income', builtin_icon: 'cash' });

  const spend = (category, occurred_on) => transactions.create({
    account_id: ids.bancolombia, category_id: category, occurred_on,
    amount_minor: -1000, source: 'manual',
  });

  for (let i = 0; i < 5; i++) await spend(taxi, '2026-09-0' + (i + 1));
  await spend(ids.restaurante, '2026-09-06');
  await spend(rare, '2020-01-01');           // long ago, and only once

  const used = await categories.listByUse({ kind: 'expense', since: '2025-09-09' });

  assert.deepEqual(used.map(c => [c.name, c.times]), [
    ['Taxi', 5],
    ['Restaurante', 1],
    // Used once, years ago: still offered, but last.
    ['Regalos', 0],
    ['Transporte', 0],
  ]);

  // Income categories are a different list, not mixed in.
  const income = await categories.listByUse({ kind: 'income' });
  // The three the product kinds became in migration 037 come along: a
  // cashback the bank paid into a product is income like any other, and they
  // sit in this list rather than in a second one of their own.
  assert.deepEqual(income.map(c => c.name),
    ['Cashback', 'Corrección del banco', 'Otro', 'Sueldo']);

  // Without a date, the whole history counts and the old one is not zero.
  const ever = await categories.listByUse({ kind: 'expense' });
  assert.equal(ever.find(c => c.name === 'Regalos').times, 1);
  await db.close();
});

test('an archived account leaves net worth entirely', async () => {
  const { db, accounts, transactions, ids } = await setup();

  const before = await accounts.netWorthMinor();

  // A real case from the backup: an account closed years ago, still holding a
  // figure in the ledger.
  const old = await accounts.create({
    name: 'Renta Fija Plazo', type: 'investment', currency_code: 'COP',
    builtin_icon: 'trending-up', opened_on: '2021-07-15',
    opening_balance_minor: 100000000, opening_balance_base_minor: 100000000,
  });
  await transactions.create({
    account_id: old, category_id: ids.restaurante, occurred_on: '2022-06-13',
    amount_minor: -20000000, source: 'manual',
  });

  // While it is live it counts, opening balance and movements together.
  assert.equal(await accounts.netWorthMinor(), before + 100000000 - 20000000);

  // Archived, it is gone from net worth completely - not reduced, not
  // partially counted. The money is history; only the record remains.
  await accounts.archive(old);
  assert.equal(await accounts.netWorthMinor(), before,
    'archiving takes the whole account out of the total');

  // Its balance is still readable, because the history is the point of keeping
  // it at all.
  const balance = await accounts.balance(old);
  assert.equal(balance.balance_minor, 80000000);
  assert.equal(balance.account.archived, 1);

  // And it does not come back through the grouped listing used by the screen.
  const live = await accounts.balancesByGroup();
  assert.equal(live.flatMap(g => g.balances).some(b => b.account.id === old), false);
  await db.close();
});

test('net worth values what you hold at today\'s rate, not at each purchase\'s', async () => {
  const { db, accounts, transactions, ids } = await setup();
  const rates = new RatesRepository(db, NOW);

  // Dollars bought across the years at very different rates: the peso value
  // recorded on each movement is what they cost, not what they are worth.
  await transactions.create({
    account_id: ids.arq, category_id: ids.restaurante, occurred_on: '2024-01-10',
    amount_minor: 100000, rate_scaled: 39000000, rate_source: 'manual', source: 'manual',
  });
  await transactions.create({
    account_id: ids.arq, category_id: ids.restaurante, occurred_on: '2026-08-24',
    amount_minor: 100000, rate_scaled: 33000000, rate_source: 'manual', source: 'manual',
  });

  // 2,000 dollars in the account. What they cost, added up, was 7,200,000.
  assert.equal((await accounts.balance(ids.arq)).balance_minor, 200000);

  // Today a dollar is 4,000 pesos, so they are worth 8,000,000 — not what
  // they cost, and not a blend of the two rates they were bought at.
  await rates.set({ on_date: '2026-09-09', base_code: 'USD', quote_code: 'COP', rate_scaled: 40000000 });

  const worth = await accounts.netWorth({ asOf: '2026-09-09' });
  const arq = worth.lines.find(line => line.account_id === ids.arq);

  assert.equal(arq.balance_minor, 200000, '2,000 dollars');
  assert.equal(arq.baseMinor, 800000000, 'valued at 4,000 a dollar');
  assert.equal(arq.rate.rate_scaled, 40000000);

  // Tomorrow's rate does not reach into yesterday.
  await rates.set({ on_date: '2026-09-10', base_code: 'USD', quote_code: 'COP', rate_scaled: 45000000 });
  assert.equal(
    (await accounts.netWorth({ asOf: '2026-09-09' })).lines
      .find(l => l.account_id === ids.arq).baseMinor,
    800000000, 'as of the 9th, the 9th rate');
  assert.equal(
    (await accounts.netWorth({ asOf: '2026-09-10' })).lines
      .find(l => l.account_id === ids.arq).baseMinor,
    900000000, 'as of the 10th, the 10th rate');

  await db.close();
});

test('a currency with no rate is reported, never guessed at', async () => {
  const { db, accounts, transactions, ids } = await setup();

  await transactions.create({
    account_id: ids.arq, category_id: ids.restaurante, occurred_on: '2026-01-10',
    amount_minor: 50000, rate_scaled: 40000000, rate_source: 'manual', source: 'manual',
  });

  const worth = await accounts.netWorth({ asOf: '2026-09-09' });
  const arq = worth.lines.find(line => line.account_id === ids.arq);

  // The balance is real; its peso value is unknown, and saying so beats
  // inventing a rate.
  assert.equal(arq.balance_minor, 50000);
  assert.equal(arq.baseMinor, null);
  assert.deepEqual(worth.missingRatesFor, ['USD']);

  // The dollars are not silently added as if they were pesos: the total is
  // Bancolombia's opening balance and nothing else.
  assert.equal(worth.totalMinor, 470307956);
  await db.close();
});

test('the rate in force is the most recent one on or before the day', async () => {
  const { db } = await setup();
  const rates = new RatesRepository(db, NOW);

  await rates.set({ on_date: '2026-09-04', base_code: 'USD', quote_code: 'COP', rate_scaled: 39000000 });
  await rates.set({ on_date: '2026-09-08', base_code: 'USD', quote_code: 'COP', rate_scaled: 40000000 });

  // A Sunday has no quote of its own; the Friday before is what a bank uses.
  assert.equal((await rates.inForce('USD', 'COP', '2026-09-06')).rate_scaled, 39000000);
  assert.equal((await rates.inForce('USD', 'COP', '2026-09-09')).rate_scaled, 40000000);
  assert.equal(await rates.inForce('USD', 'COP', '2026-09-01'), null, 'nothing before the first quote');

  // Correcting a typo replaces the day rather than sitting beside it.
  await rates.set({ on_date: '2026-09-08', base_code: 'USD', quote_code: 'COP', rate_scaled: 41000000 });
  assert.equal((await rates.history('USD', 'COP')).length, 2);
  assert.equal((await rates.inForce('USD', 'COP', '2026-09-09')).rate_scaled, 41000000);

  await assert.rejects(() => rates.set({
    on_date: '2026-09-09', base_code: 'USD', quote_code: 'COP', rate_scaled: 0 }), /greater than zero/);
  await db.close();
});

test('a category wearing an image carries it into the movement list', async () => {
  // This has been forgotten five times. A category has either a built-in icon
  // or a picture — the schema enforces exactly one — so a query that reads
  // only `builtin_icon` returns null for every category the user gave a real
  // image to, and the screen draws nothing at all beside it.
  const { db, categories, transactions, ids } = await setup();
  const icons = new CustomIconsRepository(db, NOW);

  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
  const iconId = await icons.create({ name: 'D1', mime_type: 'image/png', data: png });

  const d1 = await categories.create({ name: 'Tiendas D1', kind: 'expense', builtin_icon: 'cart' });
  await categories.update(d1, { builtin_icon: null, custom_icon_id: iconId });

  await transactions.create({
    account_id: ids.bancolombia, category_id: d1, occurred_on: '2026-09-10',
    amount_minor: -3500000, source: 'manual',
  });
  await transactions.create({
    account_id: ids.bancolombia, category_id: ids.restaurante, occurred_on: '2026-09-10',
    amount_minor: -5000000, source: 'manual',
  });

  const rows = await transactions.listDetailed({});
  const shop = rows.find(row => row.category_name === 'Tiendas D1');
  const lunch = rows.find(row => row.category_name === 'Restaurante');

  assert.equal(shop.category_icon, null, 'it has no built-in icon to fall back on');
  assert.equal(shop.category_custom_icon_id, iconId, 'so the image is what the screen needs');

  // The other way round still works: a built-in icon and no image.
  assert.equal(lunch.category_icon, 'restaurant');
  assert.equal(lunch.category_custom_icon_id, null);

  await db.close();
});

test('a note written on a product\'s own income is suggested back', async () => {
  const { db, accounts, categories, ids } = await setup();
  const transactions = new TransactionsRepository(db, NOW);
  const yields = new YieldsRepository(db, NOW);

  // Migration 037 turned the product kinds into income categories, so this
  // one is already there.
  const cashback = (await categories.list({ kind: 'income' }))
    .find(category => category.name === 'Cashback').id;

  // An ordinary movement: its note has always been suggested.
  await transactions.create({
    account_id: ids.rappi, category_id: cashback, occurred_on: '2026-09-20',
    amount_minor: 1_000, description: 'Cashback de la tienda', source: 'manual',
  });

  // A product's own income is not a movement at all - it is an entry on the
  // cushion - so its note used to be offered to nobody. Jose, 2026-09-21.
  await yields.enrol({
    account_id: ids.rappi, default_pocket_name: 'Cuenta de ahorros',
    opening_cushion_minor: 0, opening_on: '2026-09-01', withholding: false,
  });
  await yields.adjust({
    account_id: ids.rappi, on_date: '2026-09-21', amount_minor: 5_000,
    category_id: cashback, note: 'Cashback RappiCard',
  });

  const suggested = await transactions.suggestNotes('cashback');
  assert.ok(suggested.includes('Cashback RappiCard'), 'the one written on the product');
  assert.ok(suggested.includes('Cashback de la tienda'), 'and the ones on movements');
});

test('icon images are read only for the ids asked for', async () => {
  const { db } = await setup();
  const icons = new CustomIconsRepository(db, NOW);
  const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);

  const a = await icons.create({ name: 'A', mime_type: 'image/png', data: png });
  const b = await icons.create({ name: 'B', mime_type: 'image/png', data: png });
  const c = await icons.create({ name: 'C', mime_type: 'image/png', data: png });

  // The list says which icons exist and carries no image.
  const listed = await icons.list();
  assert.deepEqual(listed.map(icon => icon.id).sort(), [a, b, c].sort());
  assert.ok(listed.every(icon => icon.data === undefined), 'no bytes in the list');

  // Asking for two brings exactly those two, bytes and all.
  const some = await icons.byIds([c, a]);
  assert.deepEqual(some.map(icon => icon.id), [a, c]);
  assert.deepEqual([...some[0].data], [...png]);

  assert.deepEqual(await icons.byIds([]), [], 'nothing asked, nothing read');
});

test('a transfer carries the far account, icon included', async () => {
  // A transfer row used to draw a generic swap arrow, which says the one thing
  // the reader already knows: the amount is painted as moved and the label
  // reads "a ARQ". Which account that is, is the part worth showing, so the
  // query has to hand over the far account's icon as well as its name.
  const { db, transfers, transactions, ids } = await setup();

  await transfers.create({
    occurred_on: '2026-09-10',
    from: { account_id: ids.bancolombia, amount_minor: 20000000 },
    to: { account_id: ids.arq, amount_minor: 500000, rate_scaled: 40000000, rate_source: 'derived' },
  });

  const rows = await transactions.listDetailed({});
  const leaving = rows.find(row => row.transfer_leg === 'from');

  assert.equal(leaving.other_account_name, 'ARQ');
  assert.equal(leaving.other_account_builtin_icon, 'trending-up', 'the far account, to draw');
  assert.equal(leaving.other_account_custom_icon_id, null);

  // And its own account, for a list grouped by category where every row shares
  // the heading's icon and the account is what tells them apart.
  assert.equal(leaving.account_builtin_icon, 'business');

  await db.close();
});

test('an account can be deleted, and the import does not bring it back', async () => {
  // `transactions.account_id` is ON DELETE RESTRICT, so an account with
  // movements cannot be deleted at all — which is right, deleting an account
  // must never quietly delete money, and it makes this a deliberate act with
  // its own method and its own confirmation rather than a side effect.
  const { db, accounts, transactions, transfers, ids } = await setup();

  await transactions.create({
    account_id: ids.rappi, category_id: ids.restaurante, occurred_on: '2026-09-09',
    amount_minor: -25_000, source: 'monefy',
    import_fingerprint: 'f-gone', import_seq: 1,
  });

  // A transfer is two legs in two accounts. Deleting one end would leave the
  // other describing money that came from nowhere, so the whole thing goes.
  await transfers.create({
    occurred_on: '2026-09-09',
    from: { account_id: ids.bancolombia, amount_minor: 10_000 },
    to: { account_id: ids.rappi, amount_minor: 10_000 },
  });

  assert.equal(await accounts.movementCount(ids.rappi), 2);

  await accounts.deleteWithHistory(ids.rappi);

  assert.equal(await accounts.findById(ids.rappi), null);
  assert.equal((await db.query('SELECT id FROM transfers')).length, 0, 'no half transfer');
  assert.equal(
    (await db.query('SELECT id FROM transactions WHERE account_id = ?', [ids.bancolombia])).length,
    0, 'and no leg left behind in the other account');

  // The fingerprint is remembered, so the next import of the same backup does
  // not meet the row as new and build the account all over again.
  const skipped = await db.queryOne(
    "SELECT import_seq FROM deleted_imports WHERE import_fingerprint = 'f-gone'");
  assert.equal(skipped.import_seq, 1);

  await db.close();
});

// ---------------------------------------------------------------------------
// A transfer between two products of one account. The yields screen writes one
// whenever a CDT is funded out of the savings beside it, and Jose could not
// edit it (2026-09-15): the entry screen moved the far account away as soon as
// the near one was chosen, and refused to save two legs on one account.

import { YieldsRepository } from '../../src/app/core/database/repositories/yields.repository.ts';

test('a transfer between two products of one account can be edited without leaving it', async () => {
  const { db, accounts, transfers, transactions, ids } = await setup();
  const yields = new YieldsRepository(db, NOW);
  await yields.enrol({ account_id: ids.rappi, opening_cushion_minor: 0, opening_on: '2026-01-01', withholding: true });
  const [savings] = await yields.pockets(ids.rappi);
  await yields.setDefaultPocket(ids.rappi, savings.id);
  const cdt = await yields.addPocket({ account_id: ids.rappi, name: 'CDT renta', kind: 'cdt', sort_order: 1 });

  const before = (await accounts.balance(ids.rappi)).balance_minor;
  const id = await transfers.create({
    occurred_on: '2026-09-01',
    from: { account_id: ids.rappi, pocket_id: savings.id, amount_minor: 100000000 },
    to: { account_id: ids.rappi, pocket_id: cdt, amount_minor: 100000000 },
  });

  // Corrected the day after: the other way round, and for less.
  await transfers.update(id, {
    occurred_on: '2026-09-02',
    from: { account_id: ids.rappi, pocket_id: cdt, amount_minor: 40000000 },
    to: { account_id: ids.rappi, pocket_id: savings.id, amount_minor: 40000000 },
  });

  const after = await transfers.findById(id);
  assert.equal(after.from.account_id, ids.rappi);
  assert.equal(after.to.account_id, ids.rappi);
  assert.equal(after.from.pocket_id, cdt);
  assert.equal(after.to.pocket_id, savings.id);
  assert.equal(after.from.amount_minor, -40000000);
  assert.equal(after.to.amount_minor, 40000000);
  assert.equal(after.transfer.occurred_on, '2026-09-02');

  // Money never left the account, so its balance is what it always was.
  assert.equal((await accounts.balance(ids.rappi)).balance_minor, before);
  assert.equal((await transactions.list({})).filter(t => t.transfer_id === id).length, 2);
  await db.close();
});
