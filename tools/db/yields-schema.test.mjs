// Schema tests for migration 004 - the yields and cashback module.
//
//   node --test tools/db/yields-schema.test.mjs
//
// Every migration is applied, not only 004: what matters is the schema a phone
// ends up with, and 004 drops three tables 001 created.

import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = join(HERE, '..', '..', 'src', 'app', 'core', 'database', 'migrations');
const NOW = '2026-09-09T12:00:00Z';

function freshDb() {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON;');
  for (const file of readdirSync(MIGRATIONS).filter(f => f.endsWith('.sql')).sort()) {
    db.exec(readFileSync(join(MIGRATIONS, file), 'utf8'));
  }

  // The real accounts this module is for: a savings account that yields, the
  // card that gives cashback, and a broker that must never be accrued.
  db.exec(`INSERT INTO accounts (id, name, type, currency_code, builtin_icon, include_in_net_worth,
             opening_balance_minor, opening_balance_base_minor, opened_on, created_at, updated_at) VALUES
    (1, 'Rappi cuenta', 'debit', 'COP', 'wallet', 1, 0, 0, '2021-07-01', '${NOW}', '${NOW}'),
    (2, 'Tarjeta credito rappi', 'credit', 'COP', 'card', 1, 0, 0, '2021-06-25', '${NOW}', '${NOW}'),
    (3, 'XTB', 'investment', 'USD', 'trending-up', 1, 0, 0, '2024-01-01', '${NOW}', '${NOW}')`);
  // "Ahorros" is the income category the real yield adjustments land in.
  // Migration 037 turns the product kinds into income categories, so the
  // table is no longer empty when the migrations finish. This fixture wants
  // exactly the two below and nothing else.
  db.exec('DELETE FROM cushion_adjustments; DELETE FROM categories;');
  db.exec(`INSERT INTO categories (id, name, kind, builtin_icon, created_at, updated_at) VALUES
    (1, 'Restaurante', 'expense', 'restaurant', '${NOW}', '${NOW}'),
    (2, 'Ahorros', 'income', 'wallet', '${NOW}', '${NOW}')`);
  return db;
}

const enrol = (db, accountId, opening = 0) => db.exec(
  `INSERT INTO yield_accounts (account_id, opening_cushion_minor, opening_on, withholding, enabled, created_at, updated_at)
   VALUES (${accountId}, ${opening}, '2026-09-01', 1, 1, '${NOW}', '${NOW}')`);

/**
 * A pocket for an account, which is what a day actually belongs to.
 *
 * Every account has at least one. An account with none has nothing to accrue
 * on, which is why the repository creates one as part of enrolling.
 */
const addPocket = (db, id, accountId, name, source = 'ledger') => db.exec(
  `INSERT INTO yield_pockets (id, account_id, name, source, sort_order, created_at, updated_at)
   VALUES (${id}, ${accountId}, '${name}', '${source}', 0, '${NOW}', '${NOW}')`);

test('the placeholders from 001 are gone and the module replaced them', () => {
  const db = freshDb();
  const tables = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
  ).all().map(r => r.name);

  for (const gone of ['account_rates', 'interest_accruals', 'cashbacks']) {
    assert.equal(tables.includes(gone), false, `${gone} should have been dropped`);
  }
  for (const added of ['yield_accounts', 'yield_rates', 'yield_days',
                       'yield_pockets', 'yield_pocket_balances',
                       'cashback_rules', 'cashback_entries', 'cushion_withdrawals', 'tax_parameters']) {
    assert.equal(tables.includes(added), true, `${added} is missing`);
  }
});

test('an account earns a yield only by being enrolled, once', () => {
  const db = freshDb();
  enrol(db, 1);

  // The switch is presence in the table, which is what keeps the brokers out
  // without a list of names anywhere in the code.
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM yield_accounts WHERE account_id = 3').get().n, 0);

  assert.throws(() => enrol(db, 1), 'one enrolment per account');
});

test('the opening cushion cannot be negative and needs a real date', () => {
  const db = freshDb();
  assert.throws(() => db.exec(
    `INSERT INTO yield_accounts (account_id, opening_cushion_minor, opening_on, created_at, updated_at)
     VALUES (1, -1, '2026-09-01', '${NOW}', '${NOW}')`), 'a cushion cannot start below zero');
  assert.throws(() => db.exec(
    `INSERT INTO yield_accounts (account_id, opening_cushion_minor, opening_on, created_at, updated_at)
     VALUES (1, 0, '01/09/2026', '${NOW}', '${NOW}')`), 'dates are ISO');
});

test('rate bands: one rate per account, band and start date', () => {
  const db = freshDb();
  enrol(db, 1);

  // Two bands starting the same day is the ordinary case for a tiered account.
  db.exec(`INSERT INTO yield_rates (id, account_id, valid_from, annual_rate_scaled, min_balance_minor, max_balance_minor, created_at)
           VALUES (1, 1, '2026-09-01', 20000, 0, 50000000, '${NOW}'),
                  (2, 1, '2026-09-01', 114500, 50000000, NULL, '${NOW}')`);

  assert.throws(() => db.exec(
    `INSERT INTO yield_rates (id, account_id, valid_from, annual_rate_scaled, min_balance_minor, created_at)
     VALUES (3, 1, '2026-09-01', 90000, 0, '${NOW}')`), 'the same band cannot start twice on one day');

  assert.throws(() => db.exec(
    `INSERT INTO yield_rates (id, account_id, valid_from, annual_rate_scaled, min_balance_minor, max_balance_minor, created_at)
     VALUES (4, 1, '2026-10-01', 90000, 50000000, 10000000, '${NOW}')`), 'a band cannot end below where it starts');
});

test('a day of yield must add up, and there is only one per pocket per day', () => {
  const db = freshDb();
  enrol(db, 1);
  addPocket(db, 10, 1, 'Rappi cuenta');
  addPocket(db, 11, 1, 'Meta', 'manual');

  db.exec(`INSERT INTO yield_days (pocket_id, account_id, on_date, balance_minor, annual_rate_scaled,
             gross_minor, withholding_minor, net_minor, computed_at)
           VALUES (10, 1, '2026-09-02', 1000000000, 114500, 30000, 2100, 27900, '${NOW}')`);

  // The same day for a different pocket is a different row, which is the whole
  // reason the key changed: the bank pays each pocket separately.
  db.exec(`INSERT INTO yield_days (pocket_id, account_id, on_date, balance_minor, annual_rate_scaled,
             gross_minor, withholding_minor, net_minor, computed_at)
           VALUES (11, 1, '2026-09-02', 500000000, 114500, 15000, 0, 15000, '${NOW}')`);

  assert.throws(() => db.exec(
    `INSERT INTO yield_days (pocket_id, account_id, on_date, balance_minor, annual_rate_scaled,
       gross_minor, withholding_minor, net_minor, computed_at)
     VALUES (10, 1, '2026-09-02', 1000000000, 114500, 30000, 0, 30000, '${NOW}')`),
    'one row per pocket per day');

  assert.throws(() => db.exec(
    `INSERT INTO yield_days (pocket_id, account_id, on_date, balance_minor, annual_rate_scaled,
       gross_minor, withholding_minor, net_minor, computed_at)
     VALUES (10, 1, '2026-09-03', 1000000000, 114500, 30000, 2100, 30000, '${NOW}')`),
    'net has to be gross minus the withholding');
});

test('a pocket is named once per account, and knows where its balance comes from', () => {
  const db = freshDb();
  enrol(db, 1);
  addPocket(db, 10, 1, 'Alcancia principal', 'manual');

  assert.throws(() => addPocket(db, 11, 1, 'Alcancia principal', 'manual'),
    'two pockets of one account cannot share a name');

  assert.throws(() => db.exec(
    `INSERT INTO yield_pockets (id, account_id, name, source, created_at, updated_at)
     VALUES (12, 1, 'Otra', 'invented', '${NOW}', '${NOW}')`),
    'a balance comes from the ledger or from a figure typed in, nothing else');

  db.exec(`INSERT INTO yield_pocket_balances (id, pocket_id, valid_from, amount_minor, created_at, updated_at)
           VALUES (1, 10, '2026-09-10', 1009645100, '${NOW}', '${NOW}')`);

  assert.throws(() => db.exec(
    `INSERT INTO yield_pocket_balances (id, pocket_id, valid_from, amount_minor, created_at, updated_at)
     VALUES (2, 10, '2026-09-10', 1, '${NOW}', '${NOW}')`), 'one figure per pocket per day');

  assert.throws(() => db.exec(
    `INSERT INTO yield_pocket_balances (id, pocket_id, valid_from, amount_minor, created_at, updated_at)
     VALUES (3, 10, '2026-10-01', -1, '${NOW}', '${NOW}')`), 'a pocket cannot hold less than nothing');
});

test('a cashback rule needs both halves of its balance condition', () => {
  const db = freshDb();

  // The real Rappi rule: a percentage of any purchase, but only while Rappi
  // cuenta holds at least 500,000.
  db.exec(`INSERT INTO cashback_rules (id, account_id, name, valid_from, percent_scaled,
             requires_account_id, requires_balance_minor, created_at, updated_at)
           VALUES (1, 2, 'Rappi card', '2024-01-01', 10000, 1, 50000000, '${NOW}', '${NOW}')`);

  assert.throws(() => db.exec(
    `INSERT INTO cashback_rules (id, account_id, name, valid_from, percent_scaled, requires_account_id, created_at, updated_at)
     VALUES (2, 2, 'Half a condition', '2024-01-01', 10000, 1, '${NOW}', '${NOW}')`),
    'a condition with no amount says nothing');

  assert.throws(() => db.exec(
    `INSERT INTO cashback_rules (id, account_id, name, valid_from, valid_to, percent_scaled, created_at, updated_at)
     VALUES (3, 2, 'Backwards', '2024-06-01', '2024-01-01', 10000, '${NOW}', '${NOW}')`),
    'a rule cannot end before it starts');
});

test('a reward goes with the purchase that produced it', () => {
  const db = freshDb();
  db.exec(`INSERT INTO cashback_rules (id, account_id, name, valid_from, percent_scaled, category_id, created_at, updated_at)
           VALUES (1, 2, 'Plata restaurantes', '2025-01-01', 20000, 1, '${NOW}', '${NOW}')`);
  db.exec(`INSERT INTO transactions (id, account_id, category_id, occurred_on, amount_minor,
             amount_base_minor, confidence, source, locked, created_at, updated_at)
           VALUES (100, 2, 1, '2026-09-05', -5000000, -5000000, 'high', 'manual', 0, '${NOW}', '${NOW}')`);
  db.exec(`INSERT INTO cashback_entries (id, account_id, rule_id, source_transaction_id, on_date,
             computed_minor, created_at, updated_at)
           VALUES (1, 2, 1, 100, '2026-09-05', 100000, '${NOW}', '${NOW}')`);

  assert.throws(() => db.exec(
    `INSERT INTO cashback_entries (id, account_id, rule_id, source_transaction_id, on_date, computed_minor, created_at, updated_at)
     VALUES (2, 2, 1, 100, '2026-09-05', 100000, '${NOW}', '${NOW}')`),
    'one reward per purchase per rule');

  assert.throws(() => db.exec(
    `INSERT INTO cashback_entries (id, account_id, on_date, created_at, updated_at)
     VALUES (3, 2, '2026-09-05', '${NOW}', '${NOW}')`),
    'a reward with neither a computed nor an actual amount is not a reward');

  // Two rewards typed by hand are not the same row, because SQLite treats the
  // NULL purchase of each as distinct - which is what is wanted here.
  db.exec(`INSERT INTO cashback_entries (id, account_id, on_date, actual_minor, created_at, updated_at)
           VALUES (4, 2, '2026-09-05', 7990, '${NOW}', '${NOW}'),
                  (5, 2, '2026-09-06', 8990, '${NOW}', '${NOW}')`);

  // Losing the purchase loses the reward: a figure with nothing behind it
  // cannot be checked against a statement.
  db.exec('DELETE FROM transactions WHERE id = 100');
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM cashback_entries WHERE id = 1').get().n, 0);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM cashback_entries').get().n, 2, 'the hand-typed ones stay');
});

test('a withdrawal survives losing the movement it became', () => {
  const db = freshDb();
  enrol(db, 1, 500000000);

  // The real one: 2026-08-13, part of the accumulated yield of Rappi cuenta,
  // taken to pay the income-tax return.
  db.exec(`INSERT INTO transactions (id, account_id, category_id, occurred_on, amount_minor,
             amount_base_minor, confidence, source, locked, created_at, updated_at)
           VALUES (200, 1, 2, '2026-08-13', 538900000, 538900000, 'high', 'manual', 0, '${NOW}', '${NOW}')`);
  db.exec(`INSERT INTO cushion_withdrawals (id, account_id, source, on_date, amount_minor, transaction_id, note, created_at)
           VALUES (1, 1, 'yield', '2026-08-13', 538900000, 200,
                   'Ajuste rappi cuenta rendimientos para pago de declaracion de renta 2025', '${NOW}')`);

  assert.throws(() => db.exec(
    `INSERT INTO cushion_withdrawals (id, account_id, source, on_date, amount_minor, created_at)
     VALUES (2, 1, 'nothing', '2026-08-13', 1000, '${NOW}')`), 'only yield or cashback');
  assert.throws(() => db.exec(
    `INSERT INTO cushion_withdrawals (id, account_id, source, on_date, amount_minor, created_at)
     VALUES (3, 1, 'yield', '2026-08-13', 0, '${NOW}')`), 'a withdrawal of nothing is not a withdrawal');

  db.exec('DELETE FROM transactions WHERE id = 200');
  const left = db.prepare('SELECT amount_minor AS amt, transaction_id AS tx FROM cushion_withdrawals WHERE id = 1').get();
  assert.equal(left.amt, 538900000, 'the money still left the cushion');
  assert.equal(left.tx, null);
});

test('every tax parameter carries the norm it came from', () => {
  const db = freshDb();

  // Migration 006 seeds the withholding rule. Every row must name its source:
  // a figure with no provenance is a figure nobody can check.
  const rows = db.prepare('SELECT key, value, source, confirmed FROM tax_parameters').all();
  const byKey = new Map(rows.map(r => [r.key, r]));

  for (const key of ['uvt_value_minor', 'yield_withholding_threshold_uvt',
                     'yield_withholding_percent', 'yield_withholding_base']) {
    const row = byKey.get(key);
    assert.ok(row, `${key} was not seeded`);
    assert.ok(row.source && row.source.length > 0, `${key} has no source`);
  }

  // The reading Jose suspected, and what the norm actually says: past the
  // threshold the whole day's yield is the base.
  assert.equal(byKey.get('yield_withholding_base').value, 'all');

  // Entered but not yet checked: allowed, and unusable until confirmed.
  db.exec(`INSERT INTO tax_parameters (id, key, valid_from, value, confirmed, created_at, updated_at)
           VALUES (100, 'uvt_value_minor', '2027-01-01', '5500000', 0, '${NOW}', '${NOW}')`);

  assert.throws(() => db.exec(
    `INSERT INTO tax_parameters (id, key, valid_from, value, confirmed, created_at, updated_at)
     VALUES (101, 'yield_withholding_percent', '2027-01-01', '70000', 1, '${NOW}', '${NOW}')`),
    'nothing is confirmed without a source');

  assert.throws(() => db.exec(
    `INSERT INTO tax_parameters (id, key, valid_from, value, created_at, updated_at)
     VALUES (102, 'uvt_value_minor', '2027-01-01', '5600000', '${NOW}', '${NOW}')`),
    'one value per key per start date');
});


test('deleting an account takes its whole cushion with it', () => {
  const db = freshDb();
  enrol(db, 1, 500000000);
  addPocket(db, 10, 1, 'Rappi cuenta');
  db.exec(`INSERT INTO yield_rates (id, account_id, valid_from, annual_rate_scaled, created_at)
           VALUES (1, 1, '2026-09-01', 114500, '${NOW}')`);
  db.exec(`INSERT INTO yield_pocket_balances (id, pocket_id, valid_from, amount_minor, created_at, updated_at)
           VALUES (1, 10, '2026-09-01', 1000000000, '${NOW}', '${NOW}')`);
  db.exec(`INSERT INTO yield_days (pocket_id, account_id, on_date, balance_minor, annual_rate_scaled,
             gross_minor, withholding_minor, net_minor, computed_at)
           VALUES (10, 1, '2026-09-02', 1000000000, 114500, 30000, 0, 30000, '${NOW}')`);

  db.exec('DELETE FROM accounts WHERE id = 1');
  for (const table of ['yield_accounts', 'yield_rates', 'yield_days',
                       'yield_pockets', 'yield_pocket_balances']) {
    assert.equal(db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n, 0, `${table} kept an orphan`);
  }
});
