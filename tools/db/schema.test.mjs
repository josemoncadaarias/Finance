// Schema tests for migration 001.
//
// Runs against a real SQLite engine with no dependencies and no build step:
//   node --test tools/db/
//
// Node 22+ ships `node:sqlite`, so this needs nothing installed. The engine
// here is not the exact build @capacitor-community/sqlite uses on the device,
// so this proves the SQL is valid and the constraints bite; it does not prove
// device behaviour. Nothing in this file is app code.

import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const SCHEMA = join(HERE, '..', '..', 'src', 'app', 'core', 'database', 'migrations', '001_initial_schema.sql');
const NOW = '2026-09-08T12:00:00Z';

/** Fresh in-memory database with the schema applied and foreign keys on. */
function freshDb() {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec(readFileSync(SCHEMA, 'utf8'));
  return db;
}

const ACCOUNT_COLS = `(id, name, type, currency_code, builtin_icon, custom_icon_id,
  credit_limit_minor, include_in_net_worth, opening_balance_minor, opened_on, created_at, updated_at)`;
const TX_COLS = `(id, account_id, category_id, occurred_on, amount_minor, rate_scaled,
  amount_base_minor, rate_source, confidence, description, transfer_id, transfer_leg,
  source, import_fingerprint, import_seq, locked, created_at, updated_at)`;

const insertAccount = (db, ...v) =>
  db.prepare(`INSERT INTO accounts ${ACCOUNT_COLS} VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(...v);
const insertTx = (db, ...v) =>
  db.prepare(`INSERT INTO transactions ${TX_COLS} VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(...v);
const insertCategory = (db, ...v) =>
  db.prepare(`INSERT INTO categories (id, name, kind, builtin_icon, custom_icon_id, parent_id, created_at, updated_at)
              VALUES (?,?,?,?,?,?,?,?)`).run(...v);

/** Seeds the handful of real accounts and categories the tests below reuse. */
function seed(db) {
  // Opening balances are the real ones from the Monefy backup.
  insertAccount(db, 1, 'Bancolombia', 'debit', 'COP', 'business', null, null, 1, 470307956, '2021-06-30', NOW, NOW);
  insertAccount(db, 2, 'Tarjeta credito rappi', 'credit', 'COP', 'card', null, 110000000, 1, 0, '2021-06-25', NOW, NOW);
  insertAccount(db, 3, 'ARQ', 'investment', 'USD', 'trending-up', null, null, 1, 0, '2024-08-13', NOW, NOW);
  insertAccount(db, 4, 'Rappi cuenta', 'debit', 'COP', 'wallet', null, null, 1, 0, '2021-07-01', NOW, NOW);
  insertCategory(db, 1, 'Restaurante', 'expense', 'restaurant', null, null, NOW, NOW);
  insertCategory(db, 2, 'Transporte', 'expense', 'bus', null, null, NOW, NOW);
  return db;
}

test('the schema applies cleanly and creates every table', () => {
  const db = freshDb();
  const tables = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
  ).all().map(r => r.name);

  assert.deepEqual(tables, [
    'account_groups', 'account_rates', 'accounts', 'cashbacks', 'categories', 'currencies',
    'custom_icons', 'exchange_rates', 'import_batches', 'interest_accruals',
    'review_queue', 'settings', 'transactions', 'transfers',
  ]);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM currencies').get().n, 3);
  // COP keeps cents: 2,313 of the 12,890 backup rows carry them.
  assert.equal(db.prepare("SELECT minor_units AS u FROM currencies WHERE code='COP'").get().u, 2);
});

test('accounts: exactly one icon, and only credit cards carry a limit', () => {
  const db = seed(freshDb());
  db.exec(`INSERT INTO custom_icons (id, name, mime_type, data, created_at)
           VALUES (1, 'Bancolombia', 'image/png', x'89504e470d0a1a0a', '${NOW}')`);

  // A user-supplied logo is a first-class alternative to a built-in icon.
  insertAccount(db, 10, 'Bancolombia con logo', 'debit', 'COP', null, 1, null, 1, 0, '2024-01-01', NOW, NOW);

  assert.throws(() => insertAccount(db, 11, 'Both', 'debit', 'COP', 'card', 1, null, 1, 0, '2024-01-01', NOW, NOW),
    'both icon columns set must be rejected');
  assert.throws(() => insertAccount(db, 12, 'Neither', 'debit', 'COP', null, null, null, 1, 0, '2024-01-01', NOW, NOW),
    'no icon at all must be rejected');
  assert.throws(() => insertAccount(db, 13, 'Limit', 'debit', 'COP', 'card', null, 500000, 1, 0, '2024-01-01', NOW, NOW),
    'a non-credit account must not carry a credit limit');
  assert.throws(() => insertAccount(db, 14, 'Pounds', 'debit', 'GBP', 'card', null, null, 1, 0, '2024-01-01', NOW, NOW),
    'an unknown currency must be rejected by the foreign key');
  assert.throws(() => insertAccount(db, 15, 'Bad date', 'debit', 'COP', 'card', null, null, 1, 0, '01/01/2024', NOW, NOW),
    'dates must be ISO, not dd/mm/yyyy');
  assert.throws(() => db.exec('DELETE FROM custom_icons WHERE id = 1'),
    'an icon still in use must not be deletable');
});

test('categories cannot be their own parent', () => {
  const db = seed(freshDb());
  assert.throws(() => insertCategory(db, 90, 'Cycle', 'expense', 'card', null, 90, NOW, NOW));
});

test('money is only ever stored as an integer number of cents', () => {
  const db = seed(freshDb());

  // 26/06/2021,Bancolombia,Restaurante,"-50,200",COP,"-50,200",COP,Rappi
  insertTx(db, 1001, 1, 1, '2021-06-26', -5020000, null, -5020000, null, 'high', 'Rappi',
           null, null, 'monefy', 'fp-restaurante', 1, 0, NOW, NOW);
  assert.equal(db.prepare('SELECT amount_minor AS a FROM transactions WHERE id=1001').get().a, -5020000);

  assert.throws(() => insertTx(db, 1002, 1, 1, '2021-06-26', -50200.09, null, -5020009, null, 'high', null,
    null, null, 'manual', null, null, 0, NOW, NOW), 'a float amount must be rejected');
  assert.throws(() => insertTx(db, 1003, 1, 1, '2021-06-26', 'abc', null, -1, null, 'high', null,
    null, null, 'manual', null, null, 0, NOW, NOW), 'a non-numeric amount must be rejected');
  assert.throws(() => insertTx(db, 1004, 1, 1, '2021-06-26', '-50200.09', null, -5020009, null, 'high', null,
    null, null, 'manual', null, null, 0, NOW, NOW), 'a decimal string must be rejected');

  // INTEGER affinity converts a lossless integer string before the CHECK runs,
  // so this is accepted and lands as a true integer. That is the wanted
  // behaviour: what gets stored is never a float.
  insertTx(db, 1005, 1, 1, '2021-06-26', '-5020000', null, -5020000, null, 'high', null,
           null, null, 'manual', null, null, 0, NOW, NOW);
  const stored = db.prepare("SELECT amount_minor AS a, typeof(amount_minor) AS t FROM transactions WHERE id=1005").get();
  assert.equal(stored.t, 'integer');
  assert.equal(stored.a, -5020000);
});

test('a cross-currency transfer is one transfer with two legs', () => {
  const db = seed(freshDb());
  // 13/08/2024: 100,000 COP left Rappi cuenta and 23.73 USD arrived at ARQ,
  // at the 4,214.00 rate DolarApp actually applied.
  db.exec(`INSERT INTO transfers (id, occurred_on, description, created_at, updated_at)
           VALUES (88, '2024-08-13', 'Transferencia a dolarapp', '${NOW}', '${NOW}')`);
  insertTx(db, 5001, 4, null, '2024-08-13', -10000000, null, -10000000, null, 'high', 'Transferencia a dolarapp',
           88, 'from', 'monefy', 'fp-from', 1, 0, NOW, NOW);
  insertTx(db, 5002, 3, null, '2024-08-13', 2373, 42140000, 10000000, 'derived', 'low', 'Transferencia a dolarapp',
           88, 'to', 'monefy', 'fp-to', 1, 0, NOW, NOW);

  const legs = db.prepare('SELECT COUNT(*) AS n FROM transactions WHERE transfer_id = 88').get().n;
  assert.equal(legs, 2);

  assert.throws(() => insertTx(db, 5003, 4, 1, '2024-08-13', -100, null, -100, null, 'high', null,
    88, 'from', 'manual', null, null, 0, NOW, NOW), 'a transfer leg must not carry a category');
  assert.throws(() => insertTx(db, 5004, 4, null, '2024-08-13', -100, null, -100, null, 'high', null,
    null, null, 'manual', null, null, 0, NOW, NOW), 'a normal transaction must carry a category');
  assert.throws(() => insertTx(db, 5005, 4, null, '2024-08-13', 100, null, 100, null, 'high', null,
    88, 'from', 'manual', null, null, 0, NOW, NOW), "a 'from' leg must not be positive");
  assert.throws(() => insertTx(db, 5006, 4, null, '2024-08-13', -100, null, -100, null, 'high', null,
    88, null, 'manual', null, null, 0, NOW, NOW), 'transfer_id and transfer_leg travel together');

  // Deleting the header takes both legs with it.
  db.exec('DELETE FROM transfers WHERE id = 88');
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM transactions WHERE transfer_id = 88').get().n, 0);
});

test('the import fingerprint keeps legitimate duplicates and blocks re-imports', () => {
  const db = seed(freshDb());
  // 23/07/2022,Efectivo,Transporte,"-2,600",...,Bus de vereda appears twice in
  // the real backup. Both must survive; a third copy is a re-import.
  insertTx(db, 7001, 1, 2, '2022-07-23', -260000, null, -260000, null, 'high', 'Bus de vereda',
           null, null, 'monefy', 'fp-bus', 1, 0, NOW, NOW);
  insertTx(db, 7002, 1, 2, '2022-07-23', -260000, null, -260000, null, 'high', 'Bus de vereda',
           null, null, 'monefy', 'fp-bus', 2, 0, NOW, NOW);

  assert.throws(() => insertTx(db, 7003, 1, 2, '2022-07-23', -260000, null, -260000, null, 'high', 'Bus de vereda',
    null, null, 'monefy', 'fp-bus', 1, 0, NOW, NOW), 're-importing the same row must be blocked');
  assert.throws(() => insertTx(db, 7004, 1, 2, '2022-07-23', -260000, null, -260000, null, 'high', null,
    null, null, 'monefy', 'fp-bus', null, 0, NOW, NOW), 'fingerprint without seq must be rejected');

  // Manually created rows carry no fingerprint, and many of them coexist:
  // the unique index is partial, so NULL fingerprints are not constrained.
  insertTx(db, 7005, 1, 2, '2022-07-23', -260000, null, -260000, null, 'high', 'a mano',
           null, null, 'manual', null, null, 0, NOW, NOW);
  insertTx(db, 7006, 1, 2, '2022-07-23', -260000, null, -260000, null, 'high', 'a mano',
           null, null, 'manual', null, null, 0, NOW, NOW);
});

test('balances and credit-card availability come out of a single sum', () => {
  const db = seed(freshDb());
  insertTx(db, 1001, 1, 1, '2021-06-26', -5020000, null, -5020000, null, 'high', 'Rappi',
           null, null, 'monefy', 'fp-1', 1, 0, NOW, NOW);
  // A card purchase increases the debt, so it is negative like any outflow.
  insertTx(db, 1002, 2, 1, '2024-01-19', -4770940, null, -4770940, null, 'high', 'Actualizacion juego',
           null, null, 'monefy', 'fp-2', 1, 0, NOW, NOW);

  const balances = db.prepare(`
    SELECT a.id, a.opening_balance_minor + COALESCE(SUM(t.amount_minor), 0) AS balance_minor
    FROM accounts a LEFT JOIN transactions t ON t.account_id = a.id
    GROUP BY a.id`).all();
  const byId = Object.fromEntries(balances.map(r => [r.id, r.balance_minor]));

  assert.equal(byId[1], 470307956 - 5020000); // 4,652,879.56
  assert.equal(byId[2], -4770940);            // the card owes 47,709.40

  const card = db.prepare(`
    SELECT a.credit_limit_minor - ABS(a.opening_balance_minor + COALESCE(SUM(t.amount_minor), 0)) AS available_minor
    FROM accounts a LEFT JOIN transactions t ON t.account_id = a.id
    WHERE a.id = 2 GROUP BY a.id`).get();
  assert.equal(card.available_minor, 110000000 - 4770940); // 1,052,290.60 left
});

test('rates, interest and cashback hold their invariants', () => {
  const db = seed(freshDb());

  db.exec(`INSERT INTO exchange_rates (on_date, base_code, quote_code, rate_scaled, source, fetched_at)
           VALUES ('2024-08-13', 'USD', 'COP', 41520000, 'datos.gov.co', '${NOW}')`);
  assert.throws(() => db.exec(`INSERT INTO exchange_rates (on_date, base_code, quote_code, rate_scaled, source, fetched_at)
           VALUES ('2024-08-13', 'COP', 'COP', 10000, 'x', '${NOW}')`), 'a rate of a currency against itself is meaningless');

  db.exec(`INSERT INTO account_rates (id, account_id, annual_rate_scaled, valid_from, valid_to, created_at)
           VALUES (1, 1, 95000, '2024-01-01', '2024-06-30', '${NOW}')`);
  assert.throws(() => db.exec(`INSERT INTO account_rates (id, account_id, annual_rate_scaled, valid_from, valid_to, created_at)
           VALUES (2, 1, 95000, '2024-06-30', '2024-01-01', '${NOW}')`), 'a rate period cannot end before it starts');

  db.exec(`INSERT INTO interest_accruals (id, account_id, period_start, period_end, computed_minor, actual_minor, created_at, updated_at)
           VALUES (1, 1, '2024-05-01', '2024-05-31', 4820000, 4795000, '${NOW}', '${NOW}')`);
  assert.throws(() => db.exec(`INSERT INTO interest_accruals (id, account_id, period_start, period_end, computed_minor, created_at, updated_at)
           VALUES (2, 1, '2024-05-01', '2024-05-31', 1, '${NOW}', '${NOW}')`), 'one accrual per account and period');

  insertTx(db, 1001, 2, 1, '2024-03-15', -5000000, null, -5000000, null, 'high', 'compra',
           null, null, 'manual', null, null, 0, NOW, NOW);
  db.exec(`INSERT INTO cashbacks (id, account_id, source_transaction_id, occurred_on, amount_minor, created_at, updated_at)
           VALUES (1, 2, 1001, '2024-03-15', 250000, '${NOW}', '${NOW}')`);

  // Losing the originating purchase must not lose the cashback itself.
  db.exec('DELETE FROM transactions WHERE id = 1001');
  const cb = db.prepare('SELECT source_transaction_id AS src, amount_minor AS amt FROM cashbacks WHERE id = 1').get();
  assert.equal(cb.src, null);
  assert.equal(cb.amt, 250000);
});

test('an account with transactions cannot be deleted out from under them', () => {
  const db = seed(freshDb());
  insertTx(db, 1001, 1, 1, '2021-06-26', -5020000, null, -5020000, null, 'high', null,
           null, null, 'manual', null, null, 0, NOW, NOW);
  assert.throws(() => db.exec('DELETE FROM accounts WHERE id = 1'));
  assert.throws(() => db.exec('DELETE FROM categories WHERE id = 1'));
});

test('the review queue only closes with a timestamp', () => {
  const db = freshDb();
  db.exec(`INSERT INTO review_queue (id, kind, reason, resolved, created_at)
           VALUES (1, 'unpaired_transfer', 'No matching leg found', 0, '${NOW}')`);
  assert.throws(() => db.exec(`INSERT INTO review_queue (id, kind, reason, resolved, created_at)
           VALUES (2, 'unpaired_transfer', 'x', 1, '${NOW}')`), 'a resolved item must say when it was resolved');
});
