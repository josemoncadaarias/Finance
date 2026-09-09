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
import { ReviewRepository } from '../../src/app/core/database/repositories/review.repository.ts';
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

test('review items can be read, corrected and closed', async () => {
  const { db, transactions, ids } = await setup();
  const reviews = new ReviewRepository(db, NOW);

  const spend = await transactions.create({
    account_id: ids.arq, category_id: ids.restaurante, occurred_on: '2026-08-25',
    amount_minor: -1070, description: 'Videojuego digital', source: 'monefy',
  });

  const add = (kind, entity_id, reason) => db.run(
    `INSERT INTO review_queue (kind, entity_type, entity_id, reason, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [kind, entity_id === null ? null : 'transaction', entity_id, reason, NOW()]);

  await add('estimated_amount', spend, 'Estimated from the nearest confirmed rate');
  await add('estimated_amount', spend, 'Another estimate');
  await add('multi_currency_split', null, 'ARQ split into USD and EUR');

  assert.equal(await reviews.openCount(), 3);
  // Mapped rather than compared whole: node:sqlite hands back null-prototype
  // objects, which deepEqual will not call equal to a plain one.
  assert.deepEqual((await reviews.openGroups()).map(g => [g.kind, g.count]), [
    ['estimated_amount', 2],
    ['multi_currency_split', 1],
  ]);

  // An item carries enough of its subject to be recognised without a second query.
  const [first] = await reviews.open('estimated_amount');
  assert.equal(first.subject, 'Videojuego digital');
  assert.equal(first.occurred_on, '2026-08-25');
  assert.equal(first.amount_minor, -1070);
  assert.equal(first.currency_code, 'USD', 'shown in the account it belongs to');

  // Confirming one leaves the rest alone.
  await reviews.resolve(first.id);
  assert.equal(await reviews.openCount(), 2);

  // A whole kind can be closed at once, for the ones that are statements.
  assert.equal(await reviews.resolveKind('estimated_amount', 'batch'), 1);
  assert.equal(await reviews.openCount(), 1);

  // Closed too eagerly? It can come back.
  await reviews.reopen(first.id);
  assert.equal(await reviews.openCount(), 2);
  await db.close();
});

test('a review item outlives the row it points at', async () => {
  const { db, transactions, ids } = await setup();
  const reviews = new ReviewRepository(db, NOW);

  const spend = await transactions.create({
    account_id: ids.bancolombia, category_id: ids.restaurante,
    occurred_on: '2026-08-25', amount_minor: -5000, source: 'monefy',
  });
  await db.run(
    `INSERT INTO review_queue (kind, entity_type, entity_id, reason, created_at)
     VALUES ('estimated_amount', 'transaction', ?, 'x', ?)`, [spend, NOW()]);

  // Deleting the movement must not hide the item or crash the listing: it has
  // to stay closable, or it haunts the count forever.
  await transactions.delete(spend);

  const [item] = await reviews.open('estimated_amount');
  assert.equal(item.subject, null);
  assert.equal(await reviews.openCount(), 1);
  await reviews.resolve(item.id);
  assert.equal(await reviews.openCount(), 0);
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
  assert.deepEqual(income.map(c => c.name), ['Sueldo']);

  // Without a date, the whole history counts and the old one is not zero.
  const ever = await categories.listByUse({ kind: 'expense' });
  assert.equal(ever.find(c => c.name === 'Regalos').times, 1);
  await db.close();
});
