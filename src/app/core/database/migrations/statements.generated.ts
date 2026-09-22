// GENERATED FILE - DO NOT EDIT.
// Produced by tools/db/build-migrations.mjs from the .sql files in this folder.
// Edit the .sql, then re-run: node tools/db/build-migrations.mjs

export interface MigrationSource {
  /** Matches PRAGMA user_version once applied. */
  version: number;
  name: string;
  file: string;
  sql: string;
}

export const MIGRATION_SOURCES: readonly MigrationSource[] = [
  {
    version: 1,
    name: 'initial_schema',
    file: '001_initial_schema.sql',
    sql: `-- Migration 001 - initial schema
--
-- Conventions used throughout this file:
--
--   *_minor    integer amount in minor units (cents). Both COP and USD use 2
--              decimal places, so 50,200.09 is stored as 5020009. Never a float.
--   *_scaled   integer rate scaled by 10,000. A rate of 4,214.00 is 42140000.
--   dates      ISO text: 'YYYY-MM-DD' for days, 'YYYY-MM-DDTHH:MM:SSZ' for
--              instants. ISO sorts chronologically as plain text.
--   booleans   INTEGER 0 / 1. SQLite has no boolean type.
--
-- SQLite does not enforce declared column types (type affinity), so integrity
-- is enforced with CHECK constraints instead. STRICT tables would do this
-- natively but require SQLite >= 3.37; revisit once the runtime version that
-- @capacitor-community/sqlite ships is confirmed on a real device.
--
-- Foreign keys are OFF by default in SQLite and must be enabled per connection
-- with \`PRAGMA foreign_keys = ON\`. DatabaseService does that on open.

-- ---------------------------------------------------------------------------
-- Catalog
-- ---------------------------------------------------------------------------

CREATE TABLE currencies (
  code        TEXT    PRIMARY KEY,
  name        TEXT    NOT NULL,
  symbol      TEXT    NOT NULL,
  minor_units INTEGER NOT NULL CHECK (minor_units BETWEEN 0 AND 4)
);

-- User-supplied icon images (a real bank logo, for instance). Stored inside the
-- database on purpose: a backup stays a single file. Images are downscaled to
-- 256x256 before insert, so the size cap below is generous.
CREATE TABLE custom_icons (
  id         INTEGER PRIMARY KEY,
  name       TEXT    NOT NULL,
  mime_type  TEXT    NOT NULL CHECK (mime_type IN ('image/png', 'image/jpeg', 'image/svg+xml', 'image/webp')),
  data       BLOB    NOT NULL CHECK (length(data) <= 100000),
  created_at TEXT    NOT NULL
);

-- One real-world account that holds more than one currency, such as Global66
-- (COP and USD) or ARQ (USD and EUR).
--
-- Balances in different currencies cannot be added together, so each currency
-- is its own row in \`accounts\` and this table is what ties them back into the
-- single account the user actually has. Converting inside such an account is
-- then an ordinary transfer between two of its rows, which means the rate the
-- provider applied gets captured like any other.
--
-- Single-currency accounts do not need a group and leave \`group_id\` null.
CREATE TABLE account_groups (
  id           INTEGER PRIMARY KEY,
  name         TEXT    NOT NULL UNIQUE,
  builtin_icon TEXT,
  custom_icon_id INTEGER REFERENCES custom_icons(id) ON DELETE RESTRICT,
  color        TEXT    NOT NULL DEFAULT '#607D8B',
  sort_order   INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT    NOT NULL,
  updated_at   TEXT    NOT NULL,

  CHECK ((builtin_icon IS NULL) <> (custom_icon_id IS NULL))
);

CREATE TABLE accounts (
  id                    INTEGER PRIMARY KEY,
  name                  TEXT    NOT NULL,
  type                  TEXT    NOT NULL CHECK (type IN ('debit', 'credit', 'cash', 'investment')),

  -- Exactly one currency per row. An account holding several currencies is
  -- several rows sharing a group.
  currency_code         TEXT    NOT NULL REFERENCES currencies(code),
  group_id              INTEGER REFERENCES account_groups(id) ON DELETE SET NULL,

  -- Exactly one of the two icon columns is set. See the CHECK at the bottom.
  builtin_icon          TEXT,
  custom_icon_id        INTEGER REFERENCES custom_icons(id) ON DELETE RESTRICT,
  color                 TEXT    NOT NULL DEFAULT '#607D8B',

  -- Credit cards only. The balance of a card is the debt; the limit is a
  -- separate attribute and available credit is limit - |debt|.
  credit_limit_minor    INTEGER CHECK (credit_limit_minor IS NULL OR (typeof(credit_limit_minor) = 'integer' AND credit_limit_minor >= 0)),

  include_in_net_worth  INTEGER NOT NULL DEFAULT 1 CHECK (include_in_net_worth IN (0, 1)),

  -- The opening balance is in the account's own currency, so a USD account's
  -- cannot be added straight into a COP total. The base equivalent, frozen at
  -- whatever rate applied on opening day, is stored alongside it. For a COP
  -- account the two are equal.
  opening_balance_minor      INTEGER NOT NULL DEFAULT 0 CHECK (typeof(opening_balance_minor) = 'integer'),
  opening_balance_base_minor INTEGER NOT NULL DEFAULT 0 CHECK (typeof(opening_balance_base_minor) = 'integer'),

  opened_on             TEXT    NOT NULL CHECK (opened_on GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  archived              INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0, 1)),
  sort_order            INTEGER NOT NULL DEFAULT 0,
  created_at            TEXT    NOT NULL,
  updated_at            TEXT    NOT NULL,

  CHECK ((builtin_icon IS NULL) <> (custom_icon_id IS NULL)),
  -- Only credit cards carry a limit.
  CHECK ((type = 'credit') OR (credit_limit_minor IS NULL))
);

CREATE UNIQUE INDEX idx_accounts_name ON accounts(name);

-- A group holds each currency at most once: there is no such thing as two
-- separate USD balances inside one Global66. Ungrouped accounts are exempt,
-- because SQLite treats NULLs as distinct in a unique index, which is exactly
-- the behaviour wanted here.
CREATE UNIQUE INDEX idx_accounts_group_currency ON accounts(group_id, currency_code);

CREATE INDEX idx_accounts_group ON accounts(group_id);

CREATE TABLE categories (
  id             INTEGER PRIMARY KEY,
  name           TEXT    NOT NULL,
  kind           TEXT    NOT NULL CHECK (kind IN ('income', 'expense')),
  builtin_icon   TEXT,
  custom_icon_id INTEGER REFERENCES custom_icons(id) ON DELETE RESTRICT,
  color          TEXT    NOT NULL DEFAULT '#607D8B',
  parent_id      INTEGER REFERENCES categories(id) ON DELETE RESTRICT,
  archived       INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0, 1)),
  sort_order     INTEGER NOT NULL DEFAULT 0,
  created_at     TEXT    NOT NULL,
  updated_at     TEXT    NOT NULL,

  CHECK ((builtin_icon IS NULL) <> (custom_icon_id IS NULL)),
  CHECK (parent_id IS NULL OR parent_id <> id)
);

CREATE UNIQUE INDEX idx_categories_name_kind ON categories(name, kind);

-- ---------------------------------------------------------------------------
-- Core ledger
-- ---------------------------------------------------------------------------

-- A transfer is a header that ties together its two legs. The legs themselves
-- live in \`transactions\`, so an account balance is always a single
-- SUM(amount_minor) over one table, with no special case for transfers.
CREATE TABLE transfers (
  id          INTEGER PRIMARY KEY,
  occurred_on TEXT    NOT NULL CHECK (occurred_on GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  description TEXT,
  created_at  TEXT    NOT NULL,
  updated_at  TEXT    NOT NULL
);

CREATE TABLE import_batches (
  id            INTEGER PRIMARY KEY,
  file_name     TEXT    NOT NULL,
  file_hash     TEXT    NOT NULL,
  imported_at   TEXT    NOT NULL,
  rows_read     INTEGER NOT NULL DEFAULT 0,
  rows_inserted INTEGER NOT NULL DEFAULT 0,
  rows_skipped  INTEGER NOT NULL DEFAULT 0,
  rows_flagged  INTEGER NOT NULL DEFAULT 0,
  notes         TEXT
);

CREATE TABLE transactions (
  id                 INTEGER PRIMARY KEY,
  account_id         INTEGER NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,

  -- A transfer leg carries no category: what it is, is the transfer.
  category_id        INTEGER REFERENCES categories(id) ON DELETE RESTRICT,

  occurred_on        TEXT    NOT NULL CHECK (occurred_on GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),

  -- In the account's own currency. Negative = money out, positive = money in.
  amount_minor       INTEGER NOT NULL CHECK (typeof(amount_minor) = 'integer'),

  -- Foreign-currency detail. rate_scaled is NULL on a plain COP transaction.
  -- amount_base_minor is the COP equivalent frozen at the rate that actually
  -- applied. It is never recalculated when the TRM moves later.
  rate_scaled        INTEGER CHECK (rate_scaled IS NULL OR (typeof(rate_scaled) = 'integer' AND rate_scaled > 0)),
  amount_base_minor  INTEGER NOT NULL CHECK (typeof(amount_base_minor) = 'integer'),
  rate_source        TEXT    CHECK (rate_source IS NULL OR rate_source IN ('manual', 'derived', 'trm', 'cached')),
  confidence         TEXT    NOT NULL DEFAULT 'high' CHECK (confidence IN ('high', 'low')),

  description        TEXT,

  -- Transfer wiring: both columns are set together, or neither is.
  transfer_id        INTEGER REFERENCES transfers(id) ON DELETE CASCADE,
  transfer_leg       TEXT    CHECK (transfer_leg IS NULL OR transfer_leg IN ('from', 'to')),

  -- Import bookkeeping.
  source             TEXT    NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'monefy')),
  import_fingerprint TEXT,
  import_seq         INTEGER,
  import_batch_id    INTEGER REFERENCES import_batches(id) ON DELETE SET NULL,

  -- Set to 1 the moment the user edits an imported record by hand. A later
  -- re-import must never overwrite a locked row.
  locked             INTEGER NOT NULL DEFAULT 0 CHECK (locked IN (0, 1)),

  created_at         TEXT    NOT NULL,
  updated_at         TEXT    NOT NULL,

  CHECK ((transfer_id IS NULL) = (transfer_leg IS NULL)),
  -- A transfer leg has no category; a normal transaction must have one.
  CHECK ((transfer_id IS NULL) = (category_id IS NOT NULL)),
  -- Fingerprint and sequence travel together.
  CHECK ((import_fingerprint IS NULL) = (import_seq IS NULL)),
  -- A 'from' leg moves money out, a 'to' leg moves money in.
  CHECK (transfer_leg IS NULL
         OR (transfer_leg = 'from' AND amount_minor <= 0)
         OR (transfer_leg = 'to'   AND amount_minor >= 0))
);

-- Identical rows do occur legitimately in the backup (6 pairs, verified), so
-- the fingerprint alone cannot be unique. import_seq numbers the repeats in
-- file order, so a re-import lands on the same slots.
CREATE UNIQUE INDEX idx_transactions_import ON transactions(import_fingerprint, import_seq)
  WHERE import_fingerprint IS NOT NULL;

CREATE INDEX idx_transactions_account_date ON transactions(account_id, occurred_on);
CREATE INDEX idx_transactions_date         ON transactions(occurred_on);
CREATE INDEX idx_transactions_category     ON transactions(category_id);
CREATE INDEX idx_transactions_transfer     ON transactions(transfer_id);

-- ---------------------------------------------------------------------------
-- Rates
-- ---------------------------------------------------------------------------

-- Local cache of the official TRM. This is the official rate, which is NOT the
-- rate a bank actually applied: that one lives in transactions.rate_scaled.
CREATE TABLE exchange_rates (
  on_date     TEXT    NOT NULL CHECK (on_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  base_code   TEXT    NOT NULL REFERENCES currencies(code),
  quote_code  TEXT    NOT NULL REFERENCES currencies(code),
  rate_scaled INTEGER NOT NULL CHECK (typeof(rate_scaled) = 'integer' AND rate_scaled > 0),
  source      TEXT    NOT NULL,
  fetched_at  TEXT    NOT NULL,

  PRIMARY KEY (on_date, base_code, quote_code),
  CHECK (base_code <> quote_code)
);

-- Per-account interest rate history, maintained by hand: bank rates are not
-- reliably available online. valid_to NULL means "still in effect".
CREATE TABLE account_rates (
  id                 INTEGER PRIMARY KEY,
  account_id         INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  annual_rate_scaled INTEGER NOT NULL CHECK (typeof(annual_rate_scaled) = 'integer' AND annual_rate_scaled >= 0),
  valid_from         TEXT    NOT NULL CHECK (valid_from GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  valid_to           TEXT    CHECK (valid_to IS NULL OR valid_to GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  note               TEXT,
  created_at         TEXT    NOT NULL,

  CHECK (valid_to IS NULL OR valid_to >= valid_from)
);

CREATE INDEX idx_account_rates_account ON account_rates(account_id, valid_from);

-- ---------------------------------------------------------------------------
-- Separate modules: interest and cashback
-- ---------------------------------------------------------------------------

-- Both the computed and the actual figure are kept. The difference between
-- them is useful information, especially for tax.
CREATE TABLE interest_accruals (
  id             INTEGER PRIMARY KEY,
  account_id     INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  period_start   TEXT    NOT NULL CHECK (period_start GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  period_end     TEXT    NOT NULL CHECK (period_end GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  computed_minor INTEGER CHECK (computed_minor IS NULL OR typeof(computed_minor) = 'integer'),
  actual_minor   INTEGER CHECK (actual_minor IS NULL OR typeof(actual_minor) = 'integer'),
  note           TEXT,
  created_at     TEXT    NOT NULL,
  updated_at     TEXT    NOT NULL,

  CHECK (period_end >= period_start),
  UNIQUE (account_id, period_start, period_end)
);

CREATE TABLE cashbacks (
  id                    INTEGER PRIMARY KEY,
  account_id            INTEGER NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  source_transaction_id INTEGER REFERENCES transactions(id) ON DELETE SET NULL,
  occurred_on           TEXT    NOT NULL CHECK (occurred_on GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  amount_minor          INTEGER NOT NULL CHECK (typeof(amount_minor) = 'integer'),
  description           TEXT,
  created_at            TEXT    NOT NULL,
  updated_at            TEXT    NOT NULL
);

CREATE INDEX idx_cashbacks_account ON cashbacks(account_id, occurred_on);
CREATE INDEX idx_cashbacks_source  ON cashbacks(source_transaction_id);

-- ---------------------------------------------------------------------------
-- Infrastructure
-- ---------------------------------------------------------------------------

-- Anything the importer could not resolve on its own lands here instead of
-- entering the ledger wrong.
CREATE TABLE review_queue (
  id          INTEGER PRIMARY KEY,
  kind        TEXT    NOT NULL,
  entity_type TEXT    CHECK (entity_type IS NULL OR entity_type IN ('transaction', 'transfer', 'account', 'category', 'cashback')),
  entity_id   INTEGER,
  batch_id    INTEGER REFERENCES import_batches(id) ON DELETE CASCADE,
  reason      TEXT    NOT NULL,
  payload     TEXT,
  resolved    INTEGER NOT NULL DEFAULT 0 CHECK (resolved IN (0, 1)),
  resolved_at TEXT,
  note        TEXT,
  created_at  TEXT    NOT NULL,

  CHECK (resolved = 0 OR resolved_at IS NOT NULL)
);

CREATE INDEX idx_review_queue_open ON review_queue(resolved, kind);

CREATE TABLE settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- ---------------------------------------------------------------------------
-- Seed data
-- ---------------------------------------------------------------------------

-- COP keeps 2 minor units even though pesos are usually written without cents:
-- 2,313 of the 12,890 backup rows carry cents, opening balances included.
INSERT INTO currencies (code, name, symbol, minor_units) VALUES
  ('COP', 'Peso colombiano', '$',   2),
  ('USD', 'US Dollar',       'US$', 2),
  ('EUR', 'Euro',            '€',   2);

INSERT INTO settings (key, value, updated_at) VALUES
  ('base_currency', 'COP', '1970-01-01T00:00:00Z');
`,
  },
  {
    version: 2,
    name: 'credit_limit_history',
    file: '002_credit_limit_history.sql',
    sql: `-- Credit limits change, and the old ones are worth keeping.
--
-- \`accounts.credit_limit_minor\` answers "what is the limit today", which is
-- what available credit is computed from. It cannot answer "what was it in
-- March", and the answer stops existing the moment it is overwritten. The
-- backup already carries three of these for the Rappi card (800,000 at
-- opening, then +200,000 and +100,000), logged as deposits because Monefy had
-- nowhere else to put them, which is exactly how a limit increase ended up
-- being read as money arriving.
--
-- A limit change is not a transaction: no money moves, the debt does not
-- change, only how much room is left. So it lives in its own table and never
-- touches the ledger.

CREATE TABLE credit_limit_changes (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id     INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,

  -- The limit as of \`effective_on\`, not the size of the change. Storing the
  -- resulting limit means reading history back never depends on replaying
  -- every earlier row in order, and a wrong row cannot corrupt the ones after
  -- it.
  limit_minor    INTEGER NOT NULL CHECK (typeof(limit_minor) = 'integer' AND limit_minor >= 0),

  effective_on   TEXT    NOT NULL CHECK (effective_on GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  note           TEXT,

  -- 'import' came from the backup, 'manual' was entered by hand. A re-import
  -- must not duplicate what it already created, and must not touch what the
  -- user typed.
  source         TEXT    NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'import')),
  created_at     TEXT    NOT NULL
);

-- One limit per account per day: a second change on the same date replaces the
-- first rather than leaving two answers to the same question.
CREATE UNIQUE INDEX idx_credit_limit_changes_day
  ON credit_limit_changes(account_id, effective_on);
`,
  },
  {
    version: 3,
    name: 'deleted_imports',
    file: '003_deleted_imports.sql',
    sql: `-- Rows deleted by hand stay deleted.
--
-- The importer recognises a row it has already stored by its fingerprint and
-- skips it. Deleting that row removes the fingerprint with it — so the next
-- import sees a row it has never met and puts it back. Someone who deletes a
-- movement and re-imports gets it again, and has no reason to suspect why.
--
-- A deletion is a decision, exactly as an edit is: \`locked\` protects an edited
-- row, and this protects a deleted one. The fingerprint outlives the row.
--
-- Only rows that came from an import need this. A movement typed into the app
-- has no fingerprint and cannot be re-created by one.
CREATE TABLE deleted_imports (
  import_fingerprint TEXT    NOT NULL,
  import_seq         INTEGER NOT NULL,
  deleted_at         TEXT    NOT NULL,

  PRIMARY KEY (import_fingerprint, import_seq)
);
`,
  },
  {
    version: 4,
    name: 'yields_and_cashback',
    file: '004_yields_and_cashback.sql',
    sql: `-- Migration 004 - yields and cashback, as a module of their own
--
-- Money that was earned but never counted on.
--
-- Interest on a savings account and cashback on a card are not part of net
-- worth. They are a cushion: a figure that grows on its own and that the user
-- may choose to move into an account, in part or in whole, when he wants to.
-- The real backup already shows exactly that happening - on 2026-08-13 part of
-- the accumulated yield of Rappi cuenta was moved in to pay the income-tax
-- return. So the cushion has to be a balance in its own right, with its own
-- history, and moving money out of it has to be an explicit act.
--
-- Three things the schema below is built around:
--
--   1. The past cannot be reconstructed. Nobody has the daily yield of five
--      years of accounts. So each account gets one opening figure typed by
--      hand, and day-by-day accrual starts from a date the user picks.
--
--   2. Rates are effective annual (E.A.) and change. They are kept as a
--      history with a start date, the same shape as \`exchange_rates\`: the rate
--      in force on a day is the most recent one on or before it. A rate can
--      also depend on how much is in the account, so a rate row carries a
--      balance band.
--
--   3. Withholding is a tax rule, and tax rules are not the app's to invent.
--      Yields on a savings account are subject to retencion en la fuente above
--      a threshold expressed in UVT; cashback is not. The threshold, the UVT
--      value and the percentage live in a dated parameter table and start out
--      EMPTY. Nothing is computed from a figure nobody confirmed - see the
--      rule in CLAUDE.md about never taking exact figures from an LLM.
--
-- Accounts whose return is variable - XTB, eToro, Fiducuenta, Multinversion -
-- are never accrued. Their return is whatever the market did, it already
-- arrives as ordinary movements, and a formula would be fiction. That is not
-- a hardcoded list: an account simply has no row in \`yield_accounts\`.

-- The three placeholders from migration 001 are replaced. They were never
-- written to (the module did not exist yet), and their shape does not fit what
-- was actually needed: a period-based accrual cannot answer "what did the
-- withholding on the 14th cost me", and a rate with its own valid_to can
-- contradict the row after it.
DROP INDEX IF EXISTS idx_cashbacks_source;
DROP INDEX IF EXISTS idx_cashbacks_account;
DROP TABLE IF EXISTS cashbacks;
DROP TABLE IF EXISTS interest_accruals;
DROP INDEX IF EXISTS idx_account_rates_account;
DROP TABLE IF EXISTS account_rates;

-- ---------------------------------------------------------------------------
-- Yields
-- ---------------------------------------------------------------------------

-- Which accounts earn a yield this app computes, and from when.
--
-- Presence in this table is the switch. An account that is not here is never
-- accrued, which is how the brokers stay out without a list of names in code.
CREATE TABLE yield_accounts (
  account_id             INTEGER PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,

  -- Yields earned before this app existed. Typed once, by hand, because there
  -- is no way to recover them. Accrual starts the day after \`opening_on\`.
  opening_cushion_minor  INTEGER NOT NULL DEFAULT 0 CHECK (typeof(opening_cushion_minor) = 'integer' AND opening_cushion_minor >= 0),
  opening_on             TEXT    NOT NULL CHECK (opening_on GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),

  -- A savings account withholds; a cashback pot does not. Kept per account
  -- because the answer is a property of the product, not of the app.
  withholding            INTEGER NOT NULL DEFAULT 1 CHECK (withholding IN (0, 1)),

  -- Suspends accrual without losing the history or the opening figure.
  enabled                INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),

  note                   TEXT,
  created_at             TEXT    NOT NULL,
  updated_at             TEXT    NOT NULL
);

-- The effective annual rate history of an account.
--
-- No valid_to: the next row for the same band ends the previous one, so the
-- history cannot contradict itself. \`min_balance_minor\` / \`max_balance_minor\`
-- describe the band the rate applies to; a single band of 0..NULL means one
-- rate whatever the balance, which is the ordinary case.
--
-- \`annual_rate_scaled\` is the E.A. as a FRACTION scaled by 1,000,000:
-- 11.45% E.A. is 0.1145, stored as 114500. Six decimals on the fraction, so a
-- quoted rate keeps four decimals of a percent and nothing is lost rounding.
CREATE TABLE yield_rates (
  id                 INTEGER PRIMARY KEY,
  account_id         INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  valid_from         TEXT    NOT NULL CHECK (valid_from GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  annual_rate_scaled INTEGER NOT NULL CHECK (typeof(annual_rate_scaled) = 'integer' AND annual_rate_scaled >= 0),
  min_balance_minor  INTEGER NOT NULL DEFAULT 0 CHECK (typeof(min_balance_minor) = 'integer' AND min_balance_minor >= 0),
  max_balance_minor  INTEGER CHECK (max_balance_minor IS NULL OR typeof(max_balance_minor) = 'integer'),
  note               TEXT,
  created_at         TEXT    NOT NULL,

  CHECK (max_balance_minor IS NULL OR max_balance_minor > min_balance_minor),
  -- One rate per account, per band, per start date.
  UNIQUE (account_id, valid_from, min_balance_minor)
);

CREATE INDEX idx_yield_rates_account ON yield_rates(account_id, valid_from);

-- One row per account per day: what was accrued, and on what.
--
-- Storing the day rather than the month is what makes the withholding rule
-- checkable at all - it is a per-day threshold - and it is also what lets
-- anyone see why a figure is what it is: the balance it was computed on and
-- the rate that was in force are both here, not re-derived later.
--
-- \`actual_net_minor\` is what the bank really paid, when it is known. Both
-- figures are kept side by side, as rule 7 in CLAUDE.md requires, and \`locked\`
-- stops a recompute from overwriting a day corrected by hand.
CREATE TABLE yield_days (
  account_id         INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  on_date            TEXT    NOT NULL CHECK (on_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),

  -- The balance the yield was computed on, in the account's own currency.
  balance_minor      INTEGER NOT NULL CHECK (typeof(balance_minor) = 'integer'),
  annual_rate_scaled INTEGER NOT NULL CHECK (typeof(annual_rate_scaled) = 'integer' AND annual_rate_scaled >= 0),

  gross_minor        INTEGER NOT NULL CHECK (typeof(gross_minor) = 'integer' AND gross_minor >= 0),
  withholding_minor  INTEGER NOT NULL DEFAULT 0 CHECK (typeof(withholding_minor) = 'integer' AND withholding_minor >= 0),
  net_minor          INTEGER NOT NULL CHECK (typeof(net_minor) = 'integer' AND net_minor >= 0),
  actual_net_minor   INTEGER CHECK (actual_net_minor IS NULL OR typeof(actual_net_minor) = 'integer'),

  -- Set when the withholding could not be computed because the tax parameters
  -- for that day are missing or unconfirmed. The yield still accrues; the app
  -- says out loud that the withholding is not in it.
  withholding_unknown INTEGER NOT NULL DEFAULT 0 CHECK (withholding_unknown IN (0, 1)),

  locked             INTEGER NOT NULL DEFAULT 0 CHECK (locked IN (0, 1)),
  computed_at        TEXT    NOT NULL,

  PRIMARY KEY (account_id, on_date),
  CHECK (net_minor = gross_minor - withholding_minor)
);

-- ---------------------------------------------------------------------------
-- Cashback
-- ---------------------------------------------------------------------------

-- The conditions under which a card gives cashback, as they stood on a date.
--
-- These change, and they are not published anywhere an app can read, so they
-- are typed in and kept as history: what the app computed for a purchase in
-- 2024 must stay explainable by the rule that was in force in 2024.
--
-- Unlike a rate, a rule can simply stop without a replacement, so this one
-- does carry \`valid_to\`.
--
-- The two real cases this has to express:
--   * Rappi card: a percentage of any purchase, but only while Rappi cuenta
--     holds at least 500,000 - \`requires_account_id\` + \`requires_balance_minor\`.
--   * Plata: a percentage on specific categories only - \`category_id\`.
CREATE TABLE cashback_rules (
  id                     INTEGER PRIMARY KEY,

  -- The account that earns the cashback (usually the card itself).
  account_id             INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name                   TEXT    NOT NULL,

  valid_from             TEXT    NOT NULL CHECK (valid_from GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  valid_to               TEXT    CHECK (valid_to IS NULL OR valid_to GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),

  -- A fraction scaled by 1,000,000, exactly like \`yield_rates\`: 1% is 10000.
  percent_scaled         INTEGER NOT NULL CHECK (typeof(percent_scaled) = 'integer' AND percent_scaled >= 0),

  -- NULL means any category.
  category_id            INTEGER REFERENCES categories(id) ON DELETE CASCADE,

  -- Floor on the purchase and cap on the reward, both optional.
  min_purchase_minor     INTEGER CHECK (min_purchase_minor IS NULL OR (typeof(min_purchase_minor) = 'integer' AND min_purchase_minor >= 0)),
  max_cashback_minor     INTEGER CHECK (max_cashback_minor IS NULL OR (typeof(max_cashback_minor) = 'integer' AND max_cashback_minor >= 0)),

  -- "only while that other account holds at least this much".
  requires_account_id    INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
  requires_balance_minor INTEGER CHECK (requires_balance_minor IS NULL OR (typeof(requires_balance_minor) = 'integer' AND requires_balance_minor >= 0)),

  note                   TEXT,
  created_at             TEXT    NOT NULL,
  updated_at             TEXT    NOT NULL,

  CHECK (valid_to IS NULL OR valid_to >= valid_from),
  -- A balance condition needs both halves or neither.
  CHECK ((requires_account_id IS NULL) = (requires_balance_minor IS NULL))
);

CREATE INDEX idx_cashback_rules_account ON cashback_rules(account_id, valid_from);

-- The cashback earned by one purchase, under one rule.
--
-- \`source_transaction_id\` is the link Monefy never had. Deleting the purchase
-- deletes the reward with it: cashback that no longer has a purchase behind it
-- is a figure nobody can check. A reward typed in by hand has no purchase and
-- is kept on its own.
CREATE TABLE cashback_entries (
  id                    INTEGER PRIMARY KEY,
  account_id            INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  rule_id               INTEGER REFERENCES cashback_rules(id) ON DELETE SET NULL,
  source_transaction_id INTEGER REFERENCES transactions(id) ON DELETE CASCADE,

  on_date               TEXT    NOT NULL CHECK (on_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),

  -- What the rule works out to, and what actually arrived. Either may be null:
  -- a reward seen on a statement with no rule behind it has only the second.
  computed_minor        INTEGER CHECK (computed_minor IS NULL OR (typeof(computed_minor) = 'integer' AND computed_minor >= 0)),
  actual_minor          INTEGER CHECK (actual_minor IS NULL OR (typeof(actual_minor) = 'integer' AND actual_minor >= 0)),

  locked                INTEGER NOT NULL DEFAULT 0 CHECK (locked IN (0, 1)),
  note                  TEXT,
  created_at            TEXT    NOT NULL,
  updated_at            TEXT    NOT NULL,

  CHECK (computed_minor IS NOT NULL OR actual_minor IS NOT NULL),
  -- One reward per purchase per rule. SQLite treats NULLs as distinct, so
  -- hand-entered rewards are exempt, which is what is wanted.
  UNIQUE (source_transaction_id, rule_id)
);

CREATE INDEX idx_cashback_entries_account ON cashback_entries(account_id, on_date);
CREATE INDEX idx_cashback_entries_source  ON cashback_entries(source_transaction_id);

-- ---------------------------------------------------------------------------
-- Taking money out of the cushion
-- ---------------------------------------------------------------------------

-- Moving accumulated yield or cashback into an account, so it becomes real
-- money and part of net worth.
--
-- This is the 2026-08-13 movement: part of the yield of Rappi cuenta was taken
-- to pay the income-tax return. \`transaction_id\` points at the income movement
-- that money became, which is what stops it being counted twice - once in the
-- cushion and once in the balance.
CREATE TABLE cushion_withdrawals (
  id             INTEGER PRIMARY KEY,
  account_id     INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,

  -- Which pot it came out of. They accumulate separately because their tax
  -- treatment differs: a yield withholds, cashback does not.
  source         TEXT    NOT NULL CHECK (source IN ('yield', 'cashback')),

  on_date        TEXT    NOT NULL CHECK (on_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  amount_minor   INTEGER NOT NULL CHECK (typeof(amount_minor) = 'integer' AND amount_minor > 0),

  -- The movement this became. Kept even if that movement is deleted, so the
  -- cushion never quietly grows back.
  transaction_id INTEGER REFERENCES transactions(id) ON DELETE SET NULL,

  note           TEXT,
  created_at     TEXT    NOT NULL
);

CREATE INDEX idx_cushion_withdrawals_account ON cushion_withdrawals(account_id, on_date);

-- ---------------------------------------------------------------------------
-- Tax parameters
-- ---------------------------------------------------------------------------

-- The figures a tax rule is made of, dated, and empty until confirmed.
--
-- Retencion en la fuente on savings yields depends on a threshold in UVT, the
-- peso value of the UVT that year, and a percentage. All three change, all
-- three come from the Estatuto Tributario and the DIAN resolution of the year,
-- and none of them may be guessed at: CLAUDE.md forbids taking exact figures
-- from an LLM, and being wrong here means a wrong tax return.
--
-- So this table ships with NO rows. Until a parameter is entered and marked
-- confirmed, the accrual runs without withholding and every affected day is
-- flagged \`withholding_unknown\`, which the screen shows plainly. Being visibly
-- incomplete is correct; being confidently wrong is not.
--
-- Known keys (values are text so a percentage, a count of UVT and a peso
-- amount can share one table):
--   uvt_value_minor                  the UVT in pesos, minor units
--   yield_withholding_threshold_uvt  daily yield above which it withholds
--   yield_withholding_percent        a fraction scaled by 1,000,000
CREATE TABLE tax_parameters (
  id         INTEGER PRIMARY KEY,
  key        TEXT    NOT NULL,
  valid_from TEXT    NOT NULL CHECK (valid_from GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  value      TEXT    NOT NULL,

  -- Where the figure came from: an article of the Estatuto, a DIAN resolution,
  -- an accountant. Unconfirmed parameters are never used in a calculation.
  source     TEXT,
  confirmed  INTEGER NOT NULL DEFAULT 0 CHECK (confirmed IN (0, 1)),

  note       TEXT,
  created_at TEXT    NOT NULL,
  updated_at TEXT    NOT NULL,

  UNIQUE (key, valid_from),
  CHECK (confirmed = 0 OR source IS NOT NULL)
);

CREATE INDEX idx_tax_parameters_key ON tax_parameters(key, valid_from);
`,
  },
  {
    version: 5,
    name: 'opening_cushions',
    file: '005_opening_cushions.sql',
    sql: `-- Migration 005 - the opening cushions and rates, measured on 2026-09-09
--
-- Data, not schema. These are the figures Jose read off each account on
-- 2026-09-09, and the rate each one was paying that day. They are here rather
-- than in a screen because the screen does not exist yet and the figures are
-- perishable: the whole day-by-day accrual hangs off a correct starting point
-- on a known date.
--
-- opening_on is 2026-09-09 and accrual starts the day AFTER. What is recorded
-- here already covers everything up to and including that day, so accruing it
-- again would count it twice.
--
-- Some of these banks pay monthly rather than daily, so the figure for those
-- is what has been earned and not yet deposited. When the deposit lands and
-- disagrees, the gap goes to cushion_adjustments rather than rewriting the
-- daily history.
--
-- Every statement matches an account by name and does nothing if that name is
-- absent, so this is safe on a database that does not hold these accounts.
--
-- Deliberately absent: Fiducuenta, Multinversion, XTB, eToro, whose return is
-- the market and already arrives as ordinary movements; and Nequi,
-- Bancolombia, Cineco and Efectivo, for which no rate was given.
--
-- Written as one plain statement per account rather than one INSERT with a
-- UNION ALL list. The list was rejected on the device: the SQLite plugin
-- splits a migration into statements itself and did not survive it. Plain
-- statements are duller and they run everywhere.

INSERT INTO yield_accounts (account_id, opening_cushion_minor, opening_on, withholding, enabled, note, created_at, updated_at)
SELECT id, 491743498, '2026-09-09', 1, 1, 'Opening figure read on 2026-09-09', '2026-09-09T00:00:00Z', '2026-09-09T00:00:00Z' FROM accounts WHERE name = 'Rappi cuenta';

INSERT INTO yield_accounts (account_id, opening_cushion_minor, opening_on, withholding, enabled, note, created_at, updated_at)
SELECT id, 52661925, '2026-09-09', 1, 1, 'Opening figure read on 2026-09-09', '2026-09-09T00:00:00Z', '2026-09-09T00:00:00Z' FROM accounts WHERE name = 'Dale';

INSERT INTO yield_accounts (account_id, opening_cushion_minor, opening_on, withholding, enabled, note, created_at, updated_at)
SELECT id, 5123061, '2026-09-09', 1, 1, 'Opening figure read on 2026-09-09', '2026-09-09T00:00:00Z', '2026-09-09T00:00:00Z' FROM accounts WHERE name = 'Bold';

INSERT INTO yield_accounts (account_id, opening_cushion_minor, opening_on, withholding, enabled, note, created_at, updated_at)
SELECT id, 108017339, '2026-09-09', 1, 1, 'Opening figure read on 2026-09-09', '2026-09-09T00:00:00Z', '2026-09-09T00:00:00Z' FROM accounts WHERE name = 'Pibank';

INSERT INTO yield_accounts (account_id, opening_cushion_minor, opening_on, withholding, enabled, note, created_at, updated_at)
SELECT id, 111549946, '2026-09-09', 1, 1, 'Opening figure read on 2026-09-09', '2026-09-09T00:00:00Z', '2026-09-09T00:00:00Z' FROM accounts WHERE name = 'Ualá';

INSERT INTO yield_accounts (account_id, opening_cushion_minor, opening_on, withholding, enabled, note, created_at, updated_at)
SELECT id, 0, '2026-09-09', 1, 1, 'Opening figure read on 2026-09-09', '2026-09-09T00:00:00Z', '2026-09-09T00:00:00Z' FROM accounts WHERE name = 'Pibank para renta';

INSERT INTO yield_accounts (account_id, opening_cushion_minor, opening_on, withholding, enabled, note, created_at, updated_at)
SELECT id, 20005744, '2026-09-09', 1, 1, 'Opening figure read on 2026-09-09', '2026-09-09T00:00:00Z', '2026-09-09T00:00:00Z' FROM accounts WHERE name = 'Plata';

INSERT INTO yield_accounts (account_id, opening_cushion_minor, opening_on, withholding, enabled, note, created_at, updated_at)
SELECT id, 1670116, '2026-09-09', 1, 1, 'Opening figure read on 2026-09-09', '2026-09-09T00:00:00Z', '2026-09-09T00:00:00Z' FROM accounts WHERE name = 'Lulo';

INSERT INTO yield_accounts (account_id, opening_cushion_minor, opening_on, withholding, enabled, note, created_at, updated_at)
SELECT id, 1690262, '2026-09-09', 1, 1, 'Opening figure read on 2026-09-09', '2026-09-09T00:00:00Z', '2026-09-09T00:00:00Z' FROM accounts WHERE name = 'Nu';

INSERT INTO yield_accounts (account_id, opening_cushion_minor, opening_on, withholding, enabled, note, created_at, updated_at)
SELECT id, 0, '2026-09-09', 1, 1, 'Opening figure read on 2026-09-09', '2026-09-09T00:00:00Z', '2026-09-09T00:00:00Z' FROM accounts WHERE name = 'Global66 COP';

-- Foreign currency: the cushion is in the currency of the account, so ARQ USD
-- holds 15.90 dollars. No retencion en la fuente on these: that is a Colombian
-- withholding by a Colombian paying agent. It does NOT mean the income is not
-- taxable - a resident declares worldwide income - only that nobody withholds
-- it at source.
INSERT INTO yield_accounts (account_id, opening_cushion_minor, opening_on, withholding, enabled, note, created_at, updated_at)
SELECT id, 0, '2026-09-09', 0, 1, 'Opening figure read on 2026-09-09', '2026-09-09T00:00:00Z', '2026-09-09T00:00:00Z' FROM accounts WHERE name = 'Global66 USD';

INSERT INTO yield_accounts (account_id, opening_cushion_minor, opening_on, withholding, enabled, note, created_at, updated_at)
SELECT id, 1590, '2026-09-09', 0, 1, 'Opening figure read on 2026-09-09', '2026-09-09T00:00:00Z', '2026-09-09T00:00:00Z' FROM accounts WHERE name = 'ARQ USD';

INSERT INTO yield_accounts (account_id, opening_cushion_minor, opening_on, withholding, enabled, note, created_at, updated_at)
SELECT id, 0, '2026-09-09', 0, 1, 'Opening figure read on 2026-09-09', '2026-09-09T00:00:00Z', '2026-09-09T00:00:00Z' FROM accounts WHERE name = 'ARQ EUR';

INSERT INTO yield_accounts (account_id, opening_cushion_minor, opening_on, withholding, enabled, note, created_at, updated_at)
SELECT id, 0, '2026-09-09', 0, 1, 'Opening figure read on 2026-09-09', '2026-09-09T00:00:00Z', '2026-09-09T00:00:00Z' FROM accounts WHERE name = 'Plenti';

-- The rate each account was paying on 2026-09-09, as a fraction scaled by a
-- million: 9% E.A. is 90000, 9.25% is 92500, 3.1% is 31000.
--
-- One band covering every balance, because none of these accounts pays by
-- tier today. A tiered account gets one row per band sharing a valid_from.

INSERT INTO yield_rates (account_id, valid_from, annual_rate_scaled, min_balance_minor, created_at)
SELECT id, '2026-09-09', 90000, 0, '2026-09-09T00:00:00Z' FROM accounts WHERE name = 'Rappi cuenta';

INSERT INTO yield_rates (account_id, valid_from, annual_rate_scaled, min_balance_minor, created_at)
SELECT id, '2026-09-09', 105000, 0, '2026-09-09T00:00:00Z' FROM accounts WHERE name = 'Dale';

INSERT INTO yield_rates (account_id, valid_from, annual_rate_scaled, min_balance_minor, created_at)
SELECT id, '2026-09-09', 100000, 0, '2026-09-09T00:00:00Z' FROM accounts WHERE name = 'Bold';

INSERT INTO yield_rates (account_id, valid_from, annual_rate_scaled, min_balance_minor, created_at)
SELECT id, '2026-09-09', 110000, 0, '2026-09-09T00:00:00Z' FROM accounts WHERE name = 'Pibank';

INSERT INTO yield_rates (account_id, valid_from, annual_rate_scaled, min_balance_minor, created_at)
SELECT id, '2026-09-09', 110000, 0, '2026-09-09T00:00:00Z' FROM accounts WHERE name = 'Pibank para renta';

INSERT INTO yield_rates (account_id, valid_from, annual_rate_scaled, min_balance_minor, note, created_at)
SELECT id, '2026-09-09', 110000, 0, 'Fixed until 2026-11-08', '2026-09-09T00:00:00Z' FROM accounts WHERE name = 'Plata';

INSERT INTO yield_rates (account_id, valid_from, annual_rate_scaled, min_balance_minor, created_at)
SELECT id, '2026-09-09', 75000, 0, '2026-09-09T00:00:00Z' FROM accounts WHERE name = 'Lulo';

INSERT INTO yield_rates (account_id, valid_from, annual_rate_scaled, min_balance_minor, created_at)
SELECT id, '2026-09-09', 92500, 0, '2026-09-09T00:00:00Z' FROM accounts WHERE name = 'Nu';

INSERT INTO yield_rates (account_id, valid_from, annual_rate_scaled, min_balance_minor, created_at)
SELECT id, '2026-09-09', 80000, 0, '2026-09-09T00:00:00Z' FROM accounts WHERE name = 'Global66 COP';

INSERT INTO yield_rates (account_id, valid_from, annual_rate_scaled, min_balance_minor, created_at)
SELECT id, '2026-09-09', 31000, 0, '2026-09-09T00:00:00Z' FROM accounts WHERE name = 'Global66 USD';

INSERT INTO yield_rates (account_id, valid_from, annual_rate_scaled, min_balance_minor, created_at)
SELECT id, '2026-09-09', 20000, 0, '2026-09-09T00:00:00Z' FROM accounts WHERE name = 'ARQ USD';

-- Recorded as zero on purpose. "This account pays nothing" is an answer; an
-- account with no rate at all would look like an oversight.
INSERT INTO yield_rates (account_id, valid_from, annual_rate_scaled, min_balance_minor, created_at)
SELECT id, '2026-09-09', 0, 0, '2026-09-09T00:00:00Z' FROM accounts WHERE name = 'ARQ EUR';

INSERT INTO yield_rates (account_id, valid_from, annual_rate_scaled, min_balance_minor, created_at)
SELECT id, '2026-09-09', 40000, 0, '2026-09-09T00:00:00Z' FROM accounts WHERE name = 'Plenti';

-- Uala pays 10.5%, but only in a month with at least 400,000 spent on the
-- card. That condition and what it pays otherwise are attached in migration
-- 006, which is where the columns for them are added.
INSERT INTO yield_rates (account_id, valid_from, annual_rate_scaled, min_balance_minor, created_at)
SELECT id, '2026-09-09', 105000, 0, '2026-09-09T00:00:00Z' FROM accounts WHERE name = 'Ualá';

-- Already announced: Plata drops to 9% E.A. on 2026-11-09. Recorded now rather
-- than remembered later. The rate in force on a day is the most recent row on
-- or before it, so a future row simply waits its turn.
INSERT INTO yield_rates (account_id, valid_from, annual_rate_scaled, min_balance_minor, note, created_at)
SELECT id, '2026-11-09', 90000, 0, 'The fixed 11% ends on 2026-11-08', '2026-09-09T00:00:00Z' FROM accounts WHERE name = 'Plata';
`,
  },
  {
    version: 6,
    name: 'partial_and_fallback_rates',
    file: '006_partial_and_fallback_rates.sql',
    sql: `-- Migration 006 - what happens when a condition is missed, and when only part
-- of an account is earning
--
-- Two things the first cut of the module got wrong, both found by Jose against
-- his real accounts on 2026-09-09.
--
--   1. Missing a condition does not mean earning nothing. Uala pays 10.5% E.A.
--      in a month with at least 400,000 spent on the card and 5% E.A. in a
--      month without. The engine was turning the rate off entirely, which is a
--      different and wrong answer.
--
--   2. Not all the money in an account is necessarily earning. These accounts
--      hold several products inside one balance, and the money may be sitting
--      in one that pays nothing. Part of Rappi cuenta is in that position.
--
-- Also seeds the withholding rule, which until now had no figures at all.

-- Some accounts pay their rate only in a month where the card was used enough:
-- Uala asks for 400,000 spent in the month. NULL means no such condition,
-- which is the ordinary case. The engine adds up the expenses of the whole
-- calendar month the day belongs to, so a month still running turns the rate
-- on as soon as the threshold is passed, and the days already accrued that
-- month are filled in on the next recompute.
--
-- This column and the table below belong here rather than in 004 for a reason
-- worth remembering: 004 had already run on the phone when they were written,
-- and changing an applied migration does nothing to a database that has passed
-- it. It only breaks the next one - which is exactly what happened, with 005
-- failing on "table yield_rates has no column named
-- requires_monthly_spend_minor". A shipped migration is history.
ALTER TABLE yield_rates ADD COLUMN requires_monthly_spend_minor INTEGER;

-- What the rate falls back to when that condition is not met. NULL means the
-- rate simply does not apply that month, which is still the right answer for a
-- condition with no consolation rate behind it.
ALTER TABLE yield_rates ADD COLUMN fallback_annual_rate_scaled INTEGER;

-- Correcting the cushion against what the bank actually shows.
--
-- The app accrues every day; most banks pay once a month, and some of them
-- round, hold a few days back, or apply a condition nobody wrote down. So the
-- computed cushion and the real one will drift, and there has to be an easy
-- way to say "on this date the difference was this much" without rewriting the
-- daily history, which is evidence of what was worked out and why.
--
-- Signed on purpose: the bank can have paid more than the app expected or
-- less. The cushion is then:
--
--   opening + sum(net accrued) + sum(adjustments) - sum(withdrawals)
CREATE TABLE cushion_adjustments (
  id           INTEGER PRIMARY KEY,
  account_id   INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  source       TEXT    NOT NULL CHECK (source IN ('yield', 'cashback')),
  on_date      TEXT    NOT NULL CHECK (on_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  amount_minor INTEGER NOT NULL CHECK (typeof(amount_minor) = 'integer' AND amount_minor <> 0),
  note         TEXT,
  created_at   TEXT    NOT NULL,
  updated_at   TEXT    NOT NULL
);

CREATE INDEX idx_cushion_adjustments_account ON cushion_adjustments(account_id, on_date);

-- The part of an account's balance that is not earning.
--
-- Dated, because it moves: money is shifted between the products inside an
-- account like any other decision. The amount in force on a day is the most
-- recent row on or before it, the same rule as every other history here.
--
-- Held as "how much is NOT earning" rather than "how much is", because the
-- non-earning pocket is usually a fixed sum sitting still while the rest of
-- the balance moves every day.
CREATE TABLE yield_excluded_balances (
  id           INTEGER PRIMARY KEY,
  account_id   INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  valid_from   TEXT    NOT NULL CHECK (valid_from GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  amount_minor INTEGER NOT NULL CHECK (typeof(amount_minor) = 'integer' AND amount_minor >= 0),
  note         TEXT,
  created_at   TEXT    NOT NULL,
  updated_at   TEXT    NOT NULL,

  UNIQUE (account_id, valid_from)
);

CREATE INDEX idx_yield_excluded_account ON yield_excluded_balances(account_id, valid_from);

-- Uala: 10.5% E.A. in a month with at least 400,000 spent on the card, and
-- 5% E.A. in a month without. Missing the condition is a lower rate, not the
-- absence of one.
UPDATE yield_rates
SET requires_monthly_spend_minor = 40000000,
    fallback_annual_rate_scaled  = 50000,
    note = 'Needs 400,000 spent in the month, otherwise 5% E.A.'
WHERE valid_from = '2026-09-09'
  AND account_id IN (SELECT id FROM accounts WHERE name = 'Ualá');

-- ---------------------------------------------------------------------------
-- The withholding rule
-- ---------------------------------------------------------------------------
--
-- Looked up against the norm rather than guessed at, and each row carries the
-- source it came from. Still to be confirmed with an accountant before a tax
-- return leans on it - that is what the \`source\` and \`note\` columns are for,
-- and one edit changes any of them.
--
--   * The daily threshold and the base: ARTICULO 1.2.4.2.87 of Decreto 1625 de
--     2016 - "Cuando los intereses ... correspondan a un interes diario de
--     veintisiete pesos ($27.00) (0.055 UVT) o mas, para efectos de la
--     retencion en la fuente se considerara el valor total del pago o abono en
--     cuenta." So: 0.055 UVT a day, and past it the whole day's yield is the
--     base, not only the part above the threshold. That is the reading Jose
--     already suspected.
--
--   * The rate: 7%, from ARTICULO 1.2.4.2.5 of the same decree, which is where
--     articulo 395 of the Estatuto Tributario is regulated.
--
--   * The UVT for 2026: $52.374, Resolucion DIAN 000238 del 15 de diciembre de
--     2025. A new one is issued every December, so this needs a new row each
--     year - which is exactly why it is a dated table.
--
-- Note that the rule is written against the DAILY interest even though most of
-- these banks deposit once a month. That is why this module accrues by day.

INSERT INTO tax_parameters (key, valid_from, value, source, confirmed, note, created_at, updated_at)
VALUES ('uvt_value_minor', '2026-01-01', '5237400',
        'Resolucion DIAN 000238 de 2025', 1,
        'UVT 2026: 52,374.00 pesos. A new resolution sets this every December.',
        '2026-09-09T00:00:00Z', '2026-09-09T00:00:00Z');

INSERT INTO tax_parameters (key, valid_from, value, source, confirmed, note, created_at, updated_at)
VALUES ('yield_withholding_threshold_uvt', '2026-01-01', '0.055',
        'Decreto 1625 de 2016, articulo 1.2.4.2.87', 1,
        'Daily interest at or above 0.055 UVT is withheld. Below it, nothing.',
        '2026-09-09T00:00:00Z', '2026-09-09T00:00:00Z');

INSERT INTO tax_parameters (key, valid_from, value, source, confirmed, note, created_at, updated_at)
VALUES ('yield_withholding_percent', '2026-01-01', '70000',
        'Decreto 1625 de 2016, articulo 1.2.4.2.5; Estatuto Tributario articulo 395', 1,
        '7% of the base. Stored as a fraction scaled by a million.',
        '2026-09-09T00:00:00Z', '2026-09-09T00:00:00Z');

INSERT INTO tax_parameters (key, valid_from, value, source, confirmed, note, created_at, updated_at)
VALUES ('yield_withholding_base', '2026-01-01', 'all',
        'Decreto 1625 de 2016, articulo 1.2.4.2.87', 1,
        'Past the threshold the whole daily yield is the base, not the excess.',
        '2026-09-09T00:00:00Z', '2026-09-09T00:00:00Z');
`,
  },
  {
    version: 7,
    name: 'rappi_not_earning',
    file: '007_rappi_not_earning.sql',
    sql: `-- Migration 007 - the part of Rappi cuenta that is not earning
--
-- Rappi cuenta holds several products inside one balance, and 5,400,000.00 of
-- it is sitting in one that pays nothing. The ledger only knows the total, so
-- the split is recorded by hand.
--
-- Dated 2026-09-09, the day Jose measured it, because it moves: shifting money
-- between the products inside an account is a decision like any other, and the
-- accrual has to use whatever was true on the day it is working out. A later
-- change adds a row rather than editing this one.

INSERT INTO yield_excluded_balances (account_id, valid_from, amount_minor, note, created_at, updated_at)
SELECT id, '2026-09-09', 540000000,
       'In an internal product that pays nothing. Measured 2026-09-09.',
       '2026-09-09T00:00:00Z', '2026-09-09T00:00:00Z'
FROM accounts WHERE name = 'Rappi cuenta';
`,
  },
  {
    version: 8,
    name: 'pockets',
    file: '008_pockets.sql',
    sql: `-- Migration 008 - pockets
--
-- One account, several pots of money that earn on their own.
--
-- Dale is two "alcancias": Principal and Complemento. The bank pays each of
-- them separately, which means each one is its own pago o abono en cuenta —
-- and the withholding threshold in articulo 1.2.4.2.87 is measured per
-- payment, not per account. On 2026-09-10 that is the difference between:
--
--   together   20,193,918.25 at 10.5% -> 5,524.78 a day -> above 0.055 UVT,
--                                        386.73 withheld
--   separately 10,096,451.00 -> 2,762.25   and   10,097,467.25 -> 2,762.53
--                                        both below the threshold,
--                                        nothing withheld
--
-- Adding them up first and taxing the total charges withholding that is not
-- owed. Other banks do the same thing under other names — bolsillos, metas,
-- espacios — so this is not a special case for Dale.
--
-- What a pocket holds comes from one of two places:
--
--   * \`ledger\`  — the account's own balance, as the movements leave it, minus
--     whatever is recorded as not earning. This is what every account had
--     before this migration, and every account keeps exactly one of these
--     unless someone splits it.
--   * \`manual\`  — a figure typed in, dated, because the ledger does not know
--     how a balance is split between pockets. Movements do not say which
--     pocket they landed in.
--
-- An account with manual pockets and no ledger pocket can drift away from its
-- own balance as movements arrive. The app compares the two and says so rather
-- than silently accruing on a stale figure.
--
-- The cushion stays a figure per account, not per pocket: the opening figure
-- Jose measured is one number and splitting it would be inventing data. It
-- earns on the first pocket, which is where a single-pocket account had it all
-- along.

CREATE TABLE yield_pockets (
  id           INTEGER PRIMARY KEY,
  account_id   INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name         TEXT    NOT NULL,

  -- Where this pocket's balance comes from. At most one \`ledger\` pocket per
  -- account: two of them would each claim the whole balance.
  source       TEXT    NOT NULL DEFAULT 'ledger' CHECK (source IN ('ledger', 'manual')),

  sort_order   INTEGER NOT NULL DEFAULT 0,
  note         TEXT,
  created_at   TEXT    NOT NULL,
  updated_at   TEXT    NOT NULL,

  UNIQUE (account_id, name)
);

CREATE INDEX idx_yield_pockets_account ON yield_pockets(account_id, sort_order);

-- What a manual pocket held, from a date. Dated for the same reason every
-- other history here is: money moves between pockets, and a day has to be
-- worked out against what was true on it.
CREATE TABLE yield_pocket_balances (
  id           INTEGER PRIMARY KEY,
  pocket_id    INTEGER NOT NULL REFERENCES yield_pockets(id) ON DELETE CASCADE,
  valid_from   TEXT    NOT NULL CHECK (valid_from GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  amount_minor INTEGER NOT NULL CHECK (typeof(amount_minor) = 'integer' AND amount_minor >= 0),
  note         TEXT,
  created_at   TEXT    NOT NULL,
  updated_at   TEXT    NOT NULL,

  UNIQUE (pocket_id, valid_from)
);

CREATE INDEX idx_yield_pocket_balances ON yield_pocket_balances(pocket_id, valid_from);

-- Every account already earning gets one pocket that behaves exactly as it did
-- before: it holds the account's balance. Named after the account, and the
-- screen hides the name while there is only one.
INSERT INTO yield_pockets (account_id, name, source, sort_order, created_at, updated_at)
SELECT y.account_id, a.name, 'ledger', 0, '2026-09-10T00:00:00Z', '2026-09-10T00:00:00Z'
FROM yield_accounts y
JOIN accounts a ON a.id = y.account_id;

-- ---------------------------------------------------------------------------
-- A day now belongs to a pocket
-- ---------------------------------------------------------------------------
--
-- Rebuilt rather than altered: the primary key changes, and SQLite cannot
-- alter one. Nothing references yield_days, so a rename-copy-drop is safe with
-- foreign keys left on.
--
-- \`account_id\` is kept alongside \`pocket_id\` even though the pocket knows it.
-- It is what makes the cushion of an account one query instead of a join, and
-- the cushion is read on every row of the list.

ALTER TABLE yield_days RENAME TO yield_days_old;

CREATE TABLE yield_days (
  pocket_id          INTEGER NOT NULL REFERENCES yield_pockets(id) ON DELETE CASCADE,
  account_id         INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  on_date            TEXT    NOT NULL CHECK (on_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),

  balance_minor      INTEGER NOT NULL CHECK (typeof(balance_minor) = 'integer'),
  annual_rate_scaled INTEGER NOT NULL CHECK (typeof(annual_rate_scaled) = 'integer' AND annual_rate_scaled >= 0),

  gross_minor        INTEGER NOT NULL CHECK (typeof(gross_minor) = 'integer' AND gross_minor >= 0),
  withholding_minor  INTEGER NOT NULL DEFAULT 0 CHECK (typeof(withholding_minor) = 'integer' AND withholding_minor >= 0),
  net_minor          INTEGER NOT NULL CHECK (typeof(net_minor) = 'integer' AND net_minor >= 0),
  actual_net_minor   INTEGER CHECK (actual_net_minor IS NULL OR typeof(actual_net_minor) = 'integer'),

  withholding_unknown INTEGER NOT NULL DEFAULT 0 CHECK (withholding_unknown IN (0, 1)),

  locked             INTEGER NOT NULL DEFAULT 0 CHECK (locked IN (0, 1)),
  computed_at        TEXT    NOT NULL,

  PRIMARY KEY (pocket_id, on_date),
  CHECK (net_minor = gross_minor - withholding_minor)
);

CREATE INDEX idx_yield_days_account ON yield_days(account_id, on_date);

INSERT INTO yield_days (pocket_id, account_id, on_date, balance_minor, annual_rate_scaled,
                        gross_minor, withholding_minor, net_minor, actual_net_minor,
                        withholding_unknown, locked, computed_at)
SELECT p.id, o.account_id, o.on_date, o.balance_minor, o.annual_rate_scaled,
       o.gross_minor, o.withholding_minor, o.net_minor, o.actual_net_minor,
       o.withholding_unknown, o.locked, o.computed_at
FROM yield_days_old o
JOIN yield_pockets p ON p.account_id = o.account_id;

DROP TABLE yield_days_old;

-- ---------------------------------------------------------------------------
-- Dale, the reason this exists
-- ---------------------------------------------------------------------------
--
-- Two alcancias, both at the account's 10.5% E.A., with the balances Jose read
-- on 2026-09-10. They add up to 20,193,918.25, which is exactly what the
-- ledger says Dale holds — so nothing is being invented, only split.
--
-- The ledger pocket created above becomes Principal, which keeps the day
-- already worked out attached to something real; it changes source because a
-- ledger pocket and a manual one cannot both claim the same balance.

UPDATE yield_pockets
SET name = 'Alcancía principal', source = 'manual', sort_order = 0,
    updated_at = '2026-09-10T00:00:00Z'
WHERE account_id = (SELECT id FROM accounts WHERE name = 'Dale');

INSERT INTO yield_pocket_balances (pocket_id, valid_from, amount_minor, note, created_at, updated_at)
SELECT id, '2026-09-10', 1009645100, 'Read on 2026-09-10', '2026-09-10T00:00:00Z', '2026-09-10T00:00:00Z'
FROM yield_pockets
WHERE account_id = (SELECT id FROM accounts WHERE name = 'Dale');

INSERT INTO yield_pockets (account_id, name, source, sort_order, created_at, updated_at)
SELECT id, 'Alcancía complemento', 'manual', 1, '2026-09-10T00:00:00Z', '2026-09-10T00:00:00Z'
FROM accounts WHERE name = 'Dale';

INSERT INTO yield_pocket_balances (pocket_id, valid_from, amount_minor, note, created_at, updated_at)
SELECT id, '2026-09-10', 1009746725, 'Read on 2026-09-10', '2026-09-10T00:00:00Z', '2026-09-10T00:00:00Z'
FROM yield_pockets
WHERE name = 'Alcancía complemento'
  AND account_id = (SELECT id FROM accounts WHERE name = 'Dale');
`,
  },
  {
    version: 9,
    name: 'cushion_entries',
    file: '009_cushion_entries.sql',
    sql: `-- Migration 009 - money can land in the cushion for more than one reason
--
-- \`cushion_adjustments\` was built for one job: recording that the bank paid
-- more or less than this app worked out. Jose pointed out that the same shape
-- is what cashback needs, and that cashback is not an adjustment at all.
--
-- Cashback is money that arrives, on a date, for a reason worth writing down.
-- It piles up in different accounts at different moments under conditions that
-- change without notice, which is exactly why trying to derive it from rules
-- was the wrong place to start. Recorded by hand it is simple and true.
--
-- Two columns, then:
--
--   \`kind\`      what this entry IS, so a screen can say so and a tax module
--               can tell them apart later. Cashback is not withheld and
--               interest is; an entry that does not say which is a figure
--               nobody can classify.
--   \`pocket_id\` which pocket it landed in. An account can be several pots the
--               bank pays separately, so money arriving has to arrive
--               somewhere. Null means the app decides - the pocket that
--               follows the account balance, or the first one.
--
-- The far more important half of this change is in the engine, not here: an
-- entry dated inside the range being worked out now compounds into every day
-- after it. It did not before, which meant adding 10,000 on a Wednesday left
-- Thursday onwards still earning on the old balance. The total was right and
-- every day after it was quietly too small.

ALTER TABLE cushion_adjustments ADD COLUMN kind TEXT NOT NULL DEFAULT 'correction'
  CHECK (kind IN ('correction', 'cashback', 'other'));

ALTER TABLE cushion_adjustments ADD COLUMN pocket_id INTEGER REFERENCES yield_pockets(id) ON DELETE SET NULL;

-- Everything recorded before today was a correction against the bank, which is
-- the only thing the screen could produce. The default above already says so;
-- this is here to be explicit about what the old rows mean.
UPDATE cushion_adjustments SET kind = 'correction' WHERE kind IS NULL;

CREATE INDEX idx_cushion_adjustments_pocket ON cushion_adjustments(pocket_id, on_date);
`,
  },
  {
    version: 10,
    name: 'payout_frequency',
    file: '010_payout_frequency.sql',
    sql: `-- Migration 010 - how often the bank actually pays, and one figure corrected
--
-- Two things Jose caught on 2026-09-11.
--
-- ---------------------------------------------------------------------------
-- 1. Plata was given a balance where a yield was asked for
-- ---------------------------------------------------------------------------
--
-- The opening figure of the cushion is the interest accumulated and never
-- recorded, not what the account holds. For Plata the figure entered was
-- 200,057.44 against a ledger balance of 200,000.00 - which is the balance the
-- bank app shows, yields included, read off the screen. The app then added the
-- two and accrued on 400,057.44.
--
-- The yield part is the difference: 57.44. With it the base comes out at
-- 200,057.44, which is what Plata actually holds.
--
-- Every other account was checked the same way. None of the rest comes close
-- to its own balance - the next highest is Uala at 32% of it - so this is the
-- only figure of the fourteen that was read as the wrong kind of number.

UPDATE yield_accounts
SET opening_cushion_minor = 5744,
    note = 'Corrected 2026-09-11: 200,057.44 was the balance the bank shows, not the yield inside it',
    updated_at = '2026-09-11T00:00:00Z'
WHERE account_id = (SELECT id FROM accounts WHERE name = 'Plata');

-- ---------------------------------------------------------------------------
-- 2. Most banks pay monthly, not daily
-- ---------------------------------------------------------------------------
--
-- The module was built assuming the yield lands in the account every day. Only
-- four of these accounts do that - Uala, Dale, Plata and ARQ in dollars. The
-- rest work it out daily and pay once a month.
--
-- The difference is not cosmetic. A yield that has not been paid yet is not in
-- the account, so it is not earning: it compounds only from the day it lands.
-- Treating a monthly payer as a daily one pays interest on money the bank has
-- not handed over.
--
-- What does NOT change is the daily arithmetic, and that is deliberate:
-- articulo 1.2.4.2.87 measures the withholding threshold against the interes
-- diario whoever pays it and whenever. So the days are still worked out one by
-- one; what a monthly account does is hold them back until the month ends.

ALTER TABLE yield_accounts ADD COLUMN payout TEXT NOT NULL DEFAULT 'daily'
  CHECK (payout IN ('daily', 'monthly'));

-- Everything is monthly unless it is one of the four.
UPDATE yield_accounts SET payout = 'monthly', updated_at = '2026-09-11T00:00:00Z';

UPDATE yield_accounts SET payout = 'daily', updated_at = '2026-09-11T00:00:00Z'
WHERE account_id IN (
  SELECT id FROM accounts WHERE name IN ('Ualá', 'Dale', 'Plata', 'ARQ USD')
);
`,
  },
  {
    version: 11,
    name: 'rate_components',
    file: '011_rate_components.sql',
    sql: `-- Migration 011 - a rate can be several parts, paid at different times
--
-- Uala pays 10.5% E.A., and that is two things wearing one number: 5% E.A.
-- handed over every day, and 5.5% E.A. paid once a month and only in a month
-- where at least 400,000 was spent on the card. One rate with one frequency
-- cannot say that, and saying it wrong pays daily interest on money that
-- arrives at the end of the month.
--
-- So a rate becomes a COMPONENT. An account earns the sum of whatever
-- components are in force, and each one carries its own percentage, its own
-- payout frequency and its own condition. A plain account has one component
-- and behaves exactly as before.
--
-- Two consequences:
--
--   * \`payout\` moves from the account to the component. Uala is not a daily
--     account or a monthly one; it is both at once.
--   * a day belongs to a pocket AND a component, so \`yield_days\` is keyed by
--     all three. The withholding threshold is measured per payment, and two
--     components are two payments.
--
-- Also here: \`yield_excluded_balances\` is dropped. It described part of a
-- balance as "not earning", and Jose's reading is the better one - money set
-- aside is not a portion of the account that behaves differently, it is money
-- that is somewhere else. What earns is what the account holds; what he moves
-- in or out he records when he moves it.

DROP INDEX IF EXISTS idx_yield_excluded_account;
DROP TABLE IF EXISTS yield_excluded_balances;

-- ---------------------------------------------------------------------------
-- Rates become components
-- ---------------------------------------------------------------------------
--
-- Rebuilt rather than altered: the uniqueness has to change, and SQLite cannot
-- alter a table constraint. Nothing references yield_rates, so a
-- rename-copy-drop is safe with foreign keys left on.

-- The index follows the table through a rename, so it has to go first or the
-- new one collides with it.
DROP INDEX IF EXISTS idx_yield_rates_account;

ALTER TABLE yield_rates RENAME TO yield_rates_old;

CREATE TABLE yield_rates (
  id                 INTEGER PRIMARY KEY,
  account_id         INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,

  -- What this part of the rate is called. Free text, because the bank's own
  -- words are the ones that will be recognised on a statement.
  component          TEXT    NOT NULL DEFAULT 'base',

  valid_from         TEXT    NOT NULL CHECK (valid_from GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  annual_rate_scaled INTEGER NOT NULL CHECK (typeof(annual_rate_scaled) = 'integer' AND annual_rate_scaled >= 0),

  -- When this component is handed over. A component that is not paid yet is
  -- not in the account and is not earning.
  payout             TEXT    NOT NULL DEFAULT 'daily' CHECK (payout IN ('daily', 'monthly')),

  min_balance_minor  INTEGER NOT NULL DEFAULT 0 CHECK (typeof(min_balance_minor) = 'integer' AND min_balance_minor >= 0),
  max_balance_minor  INTEGER CHECK (max_balance_minor IS NULL OR typeof(max_balance_minor) = 'integer'),

  requires_monthly_spend_minor INTEGER,
  fallback_annual_rate_scaled  INTEGER,

  note               TEXT,
  created_at         TEXT    NOT NULL,

  CHECK (max_balance_minor IS NULL OR max_balance_minor > min_balance_minor),
  UNIQUE (account_id, component, valid_from, min_balance_minor)
);

CREATE INDEX idx_yield_rates_account ON yield_rates(account_id, valid_from);

-- Every rate so far was the whole rate, and paid however the account paid.
INSERT INTO yield_rates (id, account_id, component, valid_from, annual_rate_scaled, payout,
                         min_balance_minor, max_balance_minor,
                         requires_monthly_spend_minor, fallback_annual_rate_scaled,
                         note, created_at)
SELECT r.id, r.account_id, 'base', r.valid_from, r.annual_rate_scaled,
       COALESCE(y.payout, 'daily'),
       r.min_balance_minor, r.max_balance_minor,
       r.requires_monthly_spend_minor, r.fallback_annual_rate_scaled,
       r.note, r.created_at
FROM yield_rates_old r
LEFT JOIN yield_accounts y ON y.account_id = r.account_id;

DROP TABLE yield_rates_old;

-- ---------------------------------------------------------------------------
-- A day belongs to a component too
-- ---------------------------------------------------------------------------

DROP INDEX IF EXISTS idx_yield_days_account;

ALTER TABLE yield_days RENAME TO yield_days_old;

CREATE TABLE yield_days (
  pocket_id          INTEGER NOT NULL REFERENCES yield_pockets(id) ON DELETE CASCADE,
  account_id         INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  component          TEXT    NOT NULL DEFAULT 'base',
  on_date            TEXT    NOT NULL CHECK (on_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),

  balance_minor      INTEGER NOT NULL CHECK (typeof(balance_minor) = 'integer'),
  annual_rate_scaled INTEGER NOT NULL CHECK (typeof(annual_rate_scaled) = 'integer' AND annual_rate_scaled >= 0),

  -- Copied onto the day so a row explains itself without joining back to a
  -- rate that may have been superseded since.
  payout             TEXT    NOT NULL DEFAULT 'daily' CHECK (payout IN ('daily', 'monthly')),

  gross_minor        INTEGER NOT NULL CHECK (typeof(gross_minor) = 'integer' AND gross_minor >= 0),
  withholding_minor  INTEGER NOT NULL DEFAULT 0 CHECK (typeof(withholding_minor) = 'integer' AND withholding_minor >= 0),
  net_minor          INTEGER NOT NULL CHECK (typeof(net_minor) = 'integer' AND net_minor >= 0),
  actual_net_minor   INTEGER CHECK (actual_net_minor IS NULL OR typeof(actual_net_minor) = 'integer'),

  withholding_unknown INTEGER NOT NULL DEFAULT 0 CHECK (withholding_unknown IN (0, 1)),

  locked             INTEGER NOT NULL DEFAULT 0 CHECK (locked IN (0, 1)),
  computed_at        TEXT    NOT NULL,

  PRIMARY KEY (pocket_id, component, on_date),
  CHECK (net_minor = gross_minor - withholding_minor)
);

CREATE INDEX idx_yield_days_account ON yield_days(account_id, on_date);

INSERT INTO yield_days (pocket_id, account_id, component, on_date, balance_minor,
                        annual_rate_scaled, payout, gross_minor, withholding_minor,
                        net_minor, actual_net_minor, withholding_unknown, locked, computed_at)
SELECT d.pocket_id, d.account_id, 'base', d.on_date, d.balance_minor,
       d.annual_rate_scaled, COALESCE(y.payout, 'daily'), d.gross_minor, d.withholding_minor,
       d.net_minor, d.actual_net_minor, d.withholding_unknown, d.locked, d.computed_at
FROM yield_days_old d
LEFT JOIN yield_accounts y ON y.account_id = d.account_id;

DROP TABLE yield_days_old;

-- ---------------------------------------------------------------------------
-- Uala, the reason this exists
-- ---------------------------------------------------------------------------
--
-- The single 10.5% row becomes the daily 5%, and the conditional 5.5% is added
-- beside it. Together they are the 10.5% the card advertises, but only in a
-- month that meets the spending, and only the first half arrives daily.

UPDATE yield_rates
SET component = 'Diario', annual_rate_scaled = 50000, payout = 'daily',
    requires_monthly_spend_minor = NULL, fallback_annual_rate_scaled = NULL,
    note = 'Paid every day, no condition'
WHERE account_id = (SELECT id FROM accounts WHERE name = 'Ualá')
  AND valid_from = '2026-09-09';

INSERT INTO yield_rates (account_id, component, valid_from, annual_rate_scaled, payout,
                         min_balance_minor, requires_monthly_spend_minor,
                         fallback_annual_rate_scaled, note, created_at)
SELECT id, 'Mensual por gasto', '2026-09-09', 55000, 'monthly', 0, 40000000, 0,
       'The other half of the 10.5%, only in a month with at least 400,000 spent',
       '2026-09-11T00:00:00Z'
FROM accounts WHERE name = 'Ualá';

-- ---------------------------------------------------------------------------
-- The account no longer decides the frequency
-- ---------------------------------------------------------------------------
--
-- It lives on each component now. The column stays for one more moment so the
-- copies above could read it, and is emptied of meaning here: nothing reads
-- \`yield_accounts.payout\` after this migration.

UPDATE yield_accounts SET payout = 'daily';
`,
  },
  {
    version: 12,
    name: 'plata_balance',
    file: '012_plata_balance.sql',
    sql: `-- Migration 012 - Plata earns on the balance the bank shows
--
-- Plata's ledger says 200,000.00 because the yields it has been paid were
-- never recorded as movements. The bank says 200,057.44, and that is what is
-- earning. For every other account the ledger is close enough to the truth
-- that following it is right; for this one it is not.
--
-- So Plata's pocket stops following the ledger and carries the figure Jose
-- read off the app, dated the day he read it. Exactly like Dale's alcancias.
--
-- The opening cushion of 57.44 stays as it is: it is the record of what the
-- account had earned, and from migration 011 onwards a record is all it is.
-- It is not added to the base - which is the whole point of that change.

UPDATE yield_pockets
SET source = 'manual', updated_at = '2026-09-11T00:00:00Z'
WHERE account_id = (SELECT id FROM accounts WHERE name = 'Plata');

INSERT INTO yield_pocket_balances (pocket_id, valid_from, amount_minor, note, created_at, updated_at)
SELECT id, '2026-09-09', 20005744, 'Read off the Plata app on 2026-09-09',
       '2026-09-11T00:00:00Z', '2026-09-11T00:00:00Z'
FROM yield_pockets
WHERE account_id = (SELECT id FROM accounts WHERE name = 'Plata');
`,
  },
  {
    version: 13,
    name: 'stated_balances',
    file: '013_stated_balances.sql',
    sql: `-- Migration 013 - every account earns on the figure Jose stated, and nothing else
--
-- The base has been derived from a sum for six migrations and it has been wrong
-- in a different way each time: the ledger plus the cushion, minus a part that
-- was "not earning", plus a proportion of something. Every one of those was an
-- inference about what a number Jose gave actually meant, and every one was
-- corrected by him afterwards.
--
-- So the sum goes away. Each pocket now carries the figure he stated, on the
-- date he read it, and the engine adds only what the ledger says has MOVED
-- since - which is what "new movements are added here too" means. Nothing else
-- touches the base. The cushion is a record of what has been earned and stays
-- out of it, as of migration 011.
--
-- The figures below are the ones from the list of 2026-09-09, dated that day,
-- with two exceptions Jose corrected afterwards and which are already right:
--
--   * Dale keeps its two alcancias, 10,096,451.00 and 10,097,467.25, which he
--     read off the bank on 2026-09-10 and which produce the 2,762.25 / 2,762.53
--     the app shows him.
--   * Plata keeps 200,057.44 from migration 012.
--
-- Rappi cuenta is the one still open: the list said 4,917,434.98 and he later
-- wrote "el saldo inicial que te pasé de los 67 millones". This migration takes
-- the list, because that is what he pointed at last - and the screen now shows
-- what each account earns on, so a wrong one is one tap to fix.

-- Nothing follows the ledger blindly any more.
UPDATE yield_pockets SET source = 'manual', updated_at = '2026-09-11T00:00:00Z';

INSERT INTO yield_pocket_balances (pocket_id, valid_from, amount_minor, note, created_at, updated_at)
SELECT p.id, '2026-09-09', v.stated, 'Stated by Jose on 2026-09-09',
       '2026-09-11T00:00:00Z', '2026-09-11T00:00:00Z'
FROM yield_pockets p
JOIN accounts a ON a.id = p.account_id
JOIN (SELECT 'Rappi cuenta' AS acct, 491743498 AS stated) v ON v.acct = a.name
WHERE NOT EXISTS (SELECT 1 FROM yield_pocket_balances b WHERE b.pocket_id = p.id);

INSERT INTO yield_pocket_balances (pocket_id, valid_from, amount_minor, note, created_at, updated_at)
SELECT p.id, '2026-09-09', 111549946, 'Stated by Jose on 2026-09-09', '2026-09-11T00:00:00Z', '2026-09-11T00:00:00Z'
FROM yield_pockets p JOIN accounts a ON a.id = p.account_id
WHERE a.name = 'Ualá' AND NOT EXISTS (SELECT 1 FROM yield_pocket_balances b WHERE b.pocket_id = p.id);

INSERT INTO yield_pocket_balances (pocket_id, valid_from, amount_minor, note, created_at, updated_at)
SELECT p.id, '2026-09-09', 108017339, 'Stated by Jose on 2026-09-09', '2026-09-11T00:00:00Z', '2026-09-11T00:00:00Z'
FROM yield_pockets p JOIN accounts a ON a.id = p.account_id
WHERE a.name = 'Pibank' AND NOT EXISTS (SELECT 1 FROM yield_pocket_balances b WHERE b.pocket_id = p.id);

INSERT INTO yield_pocket_balances (pocket_id, valid_from, amount_minor, note, created_at, updated_at)
SELECT p.id, '2026-09-09', 5123061, 'Stated by Jose on 2026-09-09', '2026-09-11T00:00:00Z', '2026-09-11T00:00:00Z'
FROM yield_pockets p JOIN accounts a ON a.id = p.account_id
WHERE a.name = 'Bold' AND NOT EXISTS (SELECT 1 FROM yield_pocket_balances b WHERE b.pocket_id = p.id);

INSERT INTO yield_pocket_balances (pocket_id, valid_from, amount_minor, note, created_at, updated_at)
SELECT p.id, '2026-09-09', 1670116, 'Stated by Jose on 2026-09-09', '2026-09-11T00:00:00Z', '2026-09-11T00:00:00Z'
FROM yield_pockets p JOIN accounts a ON a.id = p.account_id
WHERE a.name = 'Lulo' AND NOT EXISTS (SELECT 1 FROM yield_pocket_balances b WHERE b.pocket_id = p.id);

INSERT INTO yield_pocket_balances (pocket_id, valid_from, amount_minor, note, created_at, updated_at)
SELECT p.id, '2026-09-09', 1690262, 'Stated by Jose on 2026-09-09', '2026-09-11T00:00:00Z', '2026-09-11T00:00:00Z'
FROM yield_pockets p JOIN accounts a ON a.id = p.account_id
WHERE a.name = 'Nu' AND NOT EXISTS (SELECT 1 FROM yield_pocket_balances b WHERE b.pocket_id = p.id);

INSERT INTO yield_pocket_balances (pocket_id, valid_from, amount_minor, note, created_at, updated_at)
SELECT p.id, '2026-09-09', 1590, 'Stated by Jose on 2026-09-09', '2026-09-11T00:00:00Z', '2026-09-11T00:00:00Z'
FROM yield_pockets p JOIN accounts a ON a.id = p.account_id
WHERE a.name = 'ARQ USD' AND NOT EXISTS (SELECT 1 FROM yield_pocket_balances b WHERE b.pocket_id = p.id);

-- The four he stated as zero. Recorded rather than left absent: "this earns on
-- nothing" is an answer, and an absent figure would silently fall back to the
-- ledger the day someone changed the pocket back.
INSERT INTO yield_pocket_balances (pocket_id, valid_from, amount_minor, note, created_at, updated_at)
SELECT p.id, '2026-09-09', 0, 'Stated by Jose on 2026-09-09', '2026-09-11T00:00:00Z', '2026-09-11T00:00:00Z'
FROM yield_pockets p JOIN accounts a ON a.id = p.account_id
WHERE a.name IN ('Pibank para renta', 'Global66 COP', 'Global66 USD', 'ARQ EUR', 'Plenti')
  AND NOT EXISTS (SELECT 1 FROM yield_pocket_balances b WHERE b.pocket_id = p.id);
`,
  },
  {
    version: 14,
    name: 'rappi_stated_balance',
    file: '014_rappi_stated_balance.sql',
    sql: `-- Migration 014 - Rappi cuenta earns on 67,959,746.41
--
-- Stated by Jose, repeatedly, and taken here as given. Migration 013 seeded it
-- with 4,917,434.98 because that was the figure in his list of 2026-09-09; it
-- is the wrong one for this account and he has said so plainly.

UPDATE yield_pocket_balances
SET amount_minor = 6795974641,
    note = 'Stated by Jose: this is what Rappi cuenta earns on',
    updated_at = '2026-09-11T00:00:00Z'
WHERE valid_from = '2026-09-09'
  AND pocket_id IN (
    SELECT p.id FROM yield_pockets p
    JOIN accounts a ON a.id = p.account_id
    WHERE a.name = 'Rappi cuenta'
  );
`,
  },
  {
    version: 15,
    name: 'rappi_correct_balance',
    file: '015_rappi_correct_balance.sql',
    sql: `-- Migration 015 - Rappi cuenta starts at 67,030,497.39
--
-- The figure Jose stated on 2026-09-09. Migration 014 used 67,959,746.41,
-- which was the ledger balance, not what he said - the same mistake as 013,
-- which used 4,917,434.98 from a list that turned out to hold a different kind
-- of number for this account.
--
-- The mechanism is right: Plata was seeded with the figure he stated and comes
-- out correct. What has been wrong is the figures seeded for the other
-- thirteen accounts, which came from a list rather than from him saying "this
-- account earns on this".

UPDATE yield_pocket_balances
SET amount_minor = 6703049739,
    note = 'Stated by Jose on 2026-09-09',
    updated_at = '2026-09-11T00:00:00Z'
WHERE valid_from = '2026-09-09'
  AND pocket_id IN (
    SELECT p.id FROM yield_pockets p
    JOIN accounts a ON a.id = p.account_id
    WHERE a.name = 'Rappi cuenta'
  );
`,
  },
  {
    version: 16,
    name: 'rates_per_pocket',
    file: '016_rates_per_pocket.sql',
    sql: `-- Migration 016 - a rate can belong to one pocket
--
-- A bank can pay differently inside one account: a pocket called "cuenta
-- ahorros" at one rate and one called "Principal" at another. Until now a rate
-- belonged to the account and every pocket earned at all of them, which is
-- right for the common case and wrong for that one.
--
-- So \`pocket_id\` becomes optional on a rate:
--
--   NULL   the rate applies to every pocket of the account. This is what every
--          rate is today, and what a plain account will always want.
--   set    the rate belongs to that pocket alone.
--
-- The rule between them is the simplest one that can be explained in a
-- sentence: **a pocket with rates of its own uses only those; a pocket with
-- none uses the account's.** No merging, no precedence table, nothing to work
-- out on a screen at midnight.
--
-- Uniqueness needs care. It cannot be one constraint over a nullable column:
-- SQLite treats NULLs as distinct, so two account-wide rates with the same
-- component and date would both be allowed and nothing would ever supersede
-- anything. Two partial indexes instead, one for each kind of row.

DROP INDEX IF EXISTS idx_yield_rates_account;

ALTER TABLE yield_rates RENAME TO yield_rates_old;

CREATE TABLE yield_rates (
  id                 INTEGER PRIMARY KEY,
  account_id         INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,

  -- Whose rate this is. NULL is the account's own, which every pocket uses
  -- unless it has one of its own.
  pocket_id          INTEGER REFERENCES yield_pockets(id) ON DELETE CASCADE,

  component          TEXT    NOT NULL DEFAULT 'base',

  valid_from         TEXT    NOT NULL CHECK (valid_from GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  annual_rate_scaled INTEGER NOT NULL CHECK (typeof(annual_rate_scaled) = 'integer' AND annual_rate_scaled >= 0),
  payout             TEXT    NOT NULL DEFAULT 'daily' CHECK (payout IN ('daily', 'monthly')),

  min_balance_minor  INTEGER NOT NULL DEFAULT 0 CHECK (typeof(min_balance_minor) = 'integer' AND min_balance_minor >= 0),
  max_balance_minor  INTEGER CHECK (max_balance_minor IS NULL OR typeof(max_balance_minor) = 'integer'),

  requires_monthly_spend_minor INTEGER,
  fallback_annual_rate_scaled  INTEGER,

  note               TEXT,
  created_at         TEXT    NOT NULL,

  CHECK (max_balance_minor IS NULL OR max_balance_minor > min_balance_minor)
);

CREATE INDEX idx_yield_rates_account ON yield_rates(account_id, valid_from);
CREATE INDEX idx_yield_rates_pocket ON yield_rates(pocket_id, valid_from);

-- One rate per component, per band, per start date - counted separately for
-- the account's own rates and for each pocket's.
CREATE UNIQUE INDEX idx_yield_rates_shared
  ON yield_rates(account_id, component, valid_from, min_balance_minor)
  WHERE pocket_id IS NULL;

CREATE UNIQUE INDEX idx_yield_rates_own
  ON yield_rates(pocket_id, component, valid_from, min_balance_minor)
  WHERE pocket_id IS NOT NULL;

INSERT INTO yield_rates (id, account_id, pocket_id, component, valid_from, annual_rate_scaled,
                         payout, min_balance_minor, max_balance_minor,
                         requires_monthly_spend_minor, fallback_annual_rate_scaled,
                         note, created_at)
SELECT id, account_id, NULL, component, valid_from, annual_rate_scaled,
       payout, min_balance_minor, max_balance_minor,
       requires_monthly_spend_minor, fallback_annual_rate_scaled,
       note, created_at
FROM yield_rates_old;

DROP TABLE yield_rates_old;
`,
  },
  {
    version: 17,
    name: 'rate_end_date',
    file: '017_rate_end_date.sql',
    sql: `-- Migration 017 - a rate can be given an end
--
-- Until now a rate ran until the next one for the same component replaced it,
-- and that is still the ordinary case: the bank moves a rate, you record the
-- new one, the old one ends by itself. The history cannot contradict itself
-- because there is only one date on each row.
--
-- What that cannot say is "this ended and nothing replaced it". A promotional
-- rate finishes and the product pays nothing until the bank announces
-- something; a term deposit matures. Without an end date the app would go on
-- paying the old rate forever, which is worse than paying zero: it is
-- confidently wrong.
--
-- So \`valid_to\` is optional and means exactly what it says. Past it the
-- component earns nothing - not the previous rate, which had already been
-- superseded, and not the next one, which has not started. Zero, until a new
-- rate says otherwise.

ALTER TABLE yield_rates ADD COLUMN valid_to TEXT
  CHECK (valid_to IS NULL OR valid_to GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]');
`,
  },
  {
    version: 18,
    name: 'recategorise',
    file: '018_recategorise.sql',
    sql: `-- Migration 018 - movements moved to the categories they belong to
--
-- Jose created a set of categories and gave a keyword for each: a description
-- containing it is certainly that category. These are those rules, run against
-- the descriptions as Monefy wrote them.
--
-- Three things this file has to get right:
--
-- **Accents.** Half the descriptions were typed with them and half without -
-- "Éxito" and "exito", "subió" and "subio". Every comparison goes through the
-- same fold, so a rule cannot depend on how a word happened to be typed.
--
-- **Overlap.** Some descriptions carry two keywords and the more specific one
-- wins: "Didi de CC viva laureles a d1 estadio" is a ride to a shop, not a
-- shop. Every rule names the words it will not touch, so each statement is
-- true on its own and the order below is documentation rather than machinery.
--
-- **A re-import must not undo it.** The importer recognises a row by its
-- fingerprint and leaves \`locked\` rows alone, so every row moved here is
-- locked. Without that the next Monefy export would put all of them back.
--
-- Each statement matches its category by name and does nothing if that name is
-- absent, so this is safe on a database that does not have them.

-- Rides. DidiClub is a subscription to a digital platform, not a trip.
UPDATE transactions
SET category_id = (SELECT id FROM categories WHERE name = 'Didi'),
    locked = 1,
    updated_at = '2026-09-12T00:00:00Z'
WHERE EXISTS (SELECT 1 FROM categories WHERE name = 'Didi')
  AND lower(replace(replace(replace(replace(replace(replace(COALESCE(description, ''), 'á','a'), 'é','e'), 'í','i'), 'ó','o'), 'ú','u'), 'ñ','n')) LIKE '%didi%'
  AND amount_minor < 0
  AND transfer_id IS NULL
  AND lower(replace(replace(replace(replace(replace(replace(COALESCE(description, ''), 'á','a'), 'é','e'), 'í','i'), 'ó','o'), 'ú','u'), 'ñ','n')) NOT LIKE '%didiclub%';

-- Rides.
UPDATE transactions
SET category_id = (SELECT id FROM categories WHERE name = 'Uber'),
    locked = 1,
    updated_at = '2026-09-12T00:00:00Z'
WHERE EXISTS (SELECT 1 FROM categories WHERE name = 'Uber')
  AND lower(replace(replace(replace(replace(replace(replace(COALESCE(description, ''), 'á','a'), 'é','e'), 'í','i'), 'ó','o'), 'ú','u'), 'ñ','n')) LIKE '%uber%'
  AND amount_minor < 0
  AND transfer_id IS NULL
  AND lower(replace(replace(replace(replace(replace(replace(COALESCE(description, ''), 'á','a'), 'é','e'), 'í','i'), 'ó','o'), 'ú','u'), 'ñ','n')) NOT LIKE '%didi%';

-- Data, mobile, home. Always a bill.
UPDATE transactions
SET category_id = (SELECT id FROM categories WHERE name = 'Claro'),
    locked = 1,
    updated_at = '2026-09-12T00:00:00Z'
WHERE EXISTS (SELECT 1 FROM categories WHERE name = 'Claro')
  AND lower(replace(replace(replace(replace(replace(replace(COALESCE(description, ''), 'á','a'), 'é','e'), 'í','i'), 'ó','o'), 'ú','u'), 'ñ','n')) LIKE '%claro%'
  AND amount_minor < 0
  AND transfer_id IS NULL
  AND lower(replace(replace(replace(replace(replace(replace(COALESCE(description, ''), 'á','a'), 'é','e'), 'í','i'), 'ó','o'), 'ú','u'), 'ñ','n')) NOT LIKE '%didi%'
  AND lower(replace(replace(replace(replace(replace(replace(COALESCE(description, ''), 'á','a'), 'é','e'), 'í','i'), 'ó','o'), 'ú','u'), 'ñ','n')) NOT LIKE '%uber%';

-- The utility bill.
UPDATE transactions
SET category_id = (SELECT id FROM categories WHERE name = 'EPM'),
    locked = 1,
    updated_at = '2026-09-12T00:00:00Z'
WHERE EXISTS (SELECT 1 FROM categories WHERE name = 'EPM')
  AND lower(replace(replace(replace(replace(replace(replace(COALESCE(description, ''), 'á','a'), 'é','e'), 'í','i'), 'ó','o'), 'ú','u'), 'ñ','n')) LIKE '%epm%'
  AND amount_minor < 0
  AND transfer_id IS NULL
  AND lower(replace(replace(replace(replace(replace(replace(COALESCE(description, ''), 'á','a'), 'é','e'), 'í','i'), 'ó','o'), 'ú','u'), 'ñ','n')) NOT LIKE '%didi%'
  AND lower(replace(replace(replace(replace(replace(replace(COALESCE(description, ''), 'á','a'), 'é','e'), 'í','i'), 'ó','o'), 'ú','u'), 'ñ','n')) NOT LIKE '%uber%'
  AND lower(replace(replace(replace(replace(replace(replace(COALESCE(description, ''), 'á','a'), 'é','e'), 'í','i'), 'ó','o'), 'ú','u'), 'ñ','n')) NOT LIKE '%claro%';

-- Shopping at Éxito. Written both with and without the accent.
UPDATE transactions
SET category_id = (SELECT id FROM categories WHERE name = 'Éxito'),
    locked = 1,
    updated_at = '2026-09-12T00:00:00Z'
WHERE EXISTS (SELECT 1 FROM categories WHERE name = 'Éxito')
  AND lower(replace(replace(replace(replace(replace(replace(COALESCE(description, ''), 'á','a'), 'é','e'), 'í','i'), 'ó','o'), 'ú','u'), 'ñ','n')) LIKE '%exito%'
  AND amount_minor < 0
  AND transfer_id IS NULL
  AND lower(replace(replace(replace(replace(replace(replace(COALESCE(description, ''), 'á','a'), 'é','e'), 'í','i'), 'ó','o'), 'ú','u'), 'ñ','n')) NOT LIKE '%didi%'
  AND lower(replace(replace(replace(replace(replace(replace(COALESCE(description, ''), 'á','a'), 'é','e'), 'í','i'), 'ó','o'), 'ú','u'), 'ñ','n')) NOT LIKE '%uber%';

-- Shopping at Dollarcity.
UPDATE transactions
SET category_id = (SELECT id FROM categories WHERE name = 'Dollarcity'),
    locked = 1,
    updated_at = '2026-09-12T00:00:00Z'
WHERE EXISTS (SELECT 1 FROM categories WHERE name = 'Dollarcity')
  AND lower(replace(replace(replace(replace(replace(replace(COALESCE(description, ''), 'á','a'), 'é','e'), 'í','i'), 'ó','o'), 'ú','u'), 'ñ','n')) LIKE '%dollarcity%'
  AND amount_minor < 0
  AND transfer_id IS NULL
  AND lower(replace(replace(replace(replace(replace(replace(COALESCE(description, ''), 'á','a'), 'é','e'), 'í','i'), 'ó','o'), 'ú','u'), 'ñ','n')) NOT LIKE '%didi%'
  AND lower(replace(replace(replace(replace(replace(replace(COALESCE(description, ''), 'á','a'), 'é','e'), 'í','i'), 'ó','o'), 'ú','u'), 'ñ','n')) NOT LIKE '%uber%';

-- The market.
UPDATE transactions
SET category_id = (SELECT id FROM categories WHERE name = 'Mercados OR'),
    locked = 1,
    updated_at = '2026-09-12T00:00:00Z'
WHERE EXISTS (SELECT 1 FROM categories WHERE name = 'Mercados OR')
  AND lower(replace(replace(replace(replace(replace(replace(COALESCE(description, ''), 'á','a'), 'é','e'), 'í','i'), 'ó','o'), 'ú','u'), 'ñ','n')) LIKE '%mercados or%'
  AND amount_minor < 0
  AND transfer_id IS NULL
  AND lower(replace(replace(replace(replace(replace(replace(COALESCE(description, ''), 'á','a'), 'é','e'), 'í','i'), 'ó','o'), 'ú','u'), 'ñ','n')) NOT LIKE '%didi%'
  AND lower(replace(replace(replace(replace(replace(replace(COALESCE(description, ''), 'á','a'), 'é','e'), 'í','i'), 'ó','o'), 'ú','u'), 'ñ','n')) NOT LIKE '%uber%';

-- D1 as a word of its own. Two characters that short turn up inside other
-- text, and a ride TO a D1 is a ride - which is why the trips are excluded
-- and why the match needs the space in front of it.
UPDATE transactions
SET category_id = (SELECT id FROM categories WHERE name = 'Tiendas D1'),
    locked = 1,
    updated_at = '2026-09-12T00:00:00Z'
WHERE EXISTS (SELECT 1 FROM categories WHERE name = 'Tiendas D1')
  AND lower(replace(replace(replace(replace(replace(replace(COALESCE(description, ''), 'á','a'), 'é','e'), 'í','i'), 'ó','o'), 'ú','u'), 'ñ','n')) LIKE '% d1%'
  AND amount_minor < 0
  AND transfer_id IS NULL
  AND lower(replace(replace(replace(replace(replace(replace(COALESCE(description, ''), 'á','a'), 'é','e'), 'í','i'), 'ó','o'), 'ú','u'), 'ñ','n')) NOT LIKE '%didi%'
  AND lower(replace(replace(replace(replace(replace(replace(COALESCE(description, ''), 'á','a'), 'é','e'), 'í','i'), 'ó','o'), 'ú','u'), 'ñ','n')) NOT LIKE '%uber%';

-- Matías, but only what is filed under Casa today. The rest is in Salud,
-- which is where it belongs, and Jose asked for the ones in Casa.
UPDATE transactions
SET category_id = (SELECT id FROM categories WHERE name = 'Familia'),
    locked = 1,
    updated_at = '2026-09-12T00:00:00Z'
WHERE EXISTS (SELECT 1 FROM categories WHERE name = 'Familia')
  AND lower(replace(replace(replace(replace(replace(replace(COALESCE(description, ''), 'á','a'), 'é','e'), 'í','i'), 'ó','o'), 'ú','u'), 'ñ','n')) LIKE '%matias%'
  AND amount_minor < 0
  AND transfer_id IS NULL
  AND category_id = (SELECT id FROM categories WHERE name = 'Casa');

-- An investment that fell.
UPDATE transactions
SET category_id = (SELECT id FROM categories WHERE name = 'Perdida'),
    locked = 1,
    updated_at = '2026-09-12T00:00:00Z'
WHERE EXISTS (SELECT 1 FROM categories WHERE name = 'Perdida')
  AND lower(replace(replace(replace(replace(replace(replace(COALESCE(description, ''), 'á','a'), 'é','e'), 'í','i'), 'ó','o'), 'ú','u'), 'ñ','n')) LIKE '%bajo inversion%'
  AND amount_minor < 0
  AND transfer_id IS NULL;

-- And one that rose. Not the payslip that mentions it: filing a salary
-- deposit as a market gain would be wrong twice over, in the ledger and
-- in the tax return.
UPDATE transactions
SET category_id = (SELECT id FROM categories WHERE name = 'Ganancia'),
    locked = 1,
    updated_at = '2026-09-12T00:00:00Z'
WHERE EXISTS (SELECT 1 FROM categories WHERE name = 'Ganancia')
  AND lower(replace(replace(replace(replace(replace(replace(COALESCE(description, ''), 'á','a'), 'é','e'), 'í','i'), 'ó','o'), 'ú','u'), 'ñ','n')) LIKE '%subio inversion%'
  AND amount_minor > 0
  AND transfer_id IS NULL
  AND lower(replace(replace(replace(replace(replace(replace(COALESCE(description, ''), 'á','a'), 'é','e'), 'í','i'), 'ó','o'), 'ú','u'), 'ñ','n')) NOT LIKE '%nomina%';

-- The tax, last and on its own.
--
-- A description carrying both a vendor and this tax is a bill for that
-- vendor that mentions the tax - "Factura epm con impuesto 4x1000" is an
-- EPM bill - so those 21 rows stay with their vendor. Removing a name
-- from the exclusions below is all it would take to decide otherwise.
UPDATE transactions
SET category_id = (SELECT id FROM categories WHERE name = '4x1000'),
    locked = 1,
    updated_at = '2026-09-12T00:00:00Z'
WHERE EXISTS (SELECT 1 FROM categories WHERE name = '4x1000')
  AND lower(replace(replace(replace(replace(replace(replace(COALESCE(description, ''), 'á','a'), 'é','e'), 'í','i'), 'ó','o'), 'ú','u'), 'ñ','n')) LIKE '%4x1000%'
  AND amount_minor < 0
  AND transfer_id IS NULL
  AND lower(replace(replace(replace(replace(replace(replace(COALESCE(description, ''), 'á','a'), 'é','e'), 'í','i'), 'ó','o'), 'ú','u'), 'ñ','n')) NOT LIKE '%didi%'
  AND lower(replace(replace(replace(replace(replace(replace(COALESCE(description, ''), 'á','a'), 'é','e'), 'í','i'), 'ó','o'), 'ú','u'), 'ñ','n')) NOT LIKE '%uber%'
  AND lower(replace(replace(replace(replace(replace(replace(COALESCE(description, ''), 'á','a'), 'é','e'), 'í','i'), 'ó','o'), 'ú','u'), 'ñ','n')) NOT LIKE '%claro%'
  AND lower(replace(replace(replace(replace(replace(replace(COALESCE(description, ''), 'á','a'), 'é','e'), 'í','i'), 'ó','o'), 'ú','u'), 'ñ','n')) NOT LIKE '%epm%'
  AND lower(replace(replace(replace(replace(replace(replace(COALESCE(description, ''), 'á','a'), 'é','e'), 'í','i'), 'ó','o'), 'ú','u'), 'ñ','n')) NOT LIKE '%exito%'
  AND lower(replace(replace(replace(replace(replace(replace(COALESCE(description, ''), 'á','a'), 'é','e'), 'í','i'), 'ó','o'), 'ú','u'), 'ñ','n')) NOT LIKE '%dollarcity%';
`,
  },
  {
    version: 19,
    name: 'fix_recategorise',
    file: '019_fix_recategorise.sql',
    sql: `-- Migration 019 - the 4x1000 rule was wrong, and three rules were missing
--
-- Migration 018 moved 217 movements to 4x1000 that are not the tax at all.
-- Jose asked for the ones written as an "Ajuste"; the rule matched anything
-- whose note mentioned the tax, which is most of a restaurant bill or a repair
-- that happened to be paid by transfer.
--
-- The order below matters, and is the one thing in this file that does. The
-- restore runs first and puts every wrongly moved row back where it was; the
-- rules after it then claim what they should have claimed the first time. A
-- row like "Cosas para la casa mercado or mas impuesto 4x1000" goes back to
-- Casa and is then taken by Mercados OR, which is the right answer and is not
-- reachable in either order alone.
--
-- Everything else follows 018: the same accent fold, the same vendor
-- exclusions, and \`locked\` on every row moved so a re-import cannot undo it.
-- Each statement is self-contained and does nothing when its category is
-- absent.

-- 1. Undo what migration 018 got wrong.
--
-- 018 read every description carrying "4x1000" as a 4x1000 charge. Most are
-- not: they are an ordinary payment whose note mentions that the tax was
-- charged on top - "Combos pollo almuerzo mas impuesto 4x1000" is lunch.
-- Only the ones that say "Ajuste" are the tax itself.
--
-- The original category is not lost. The import fingerprint is built from
-- the CSV fields joined by char(1), and its third field is the category
-- Monefy exported; nothing writes to it, so it still holds what the row was
-- before 018 touched it. That is what this restores - the real value, not a
-- guess. Rows whose original category no longer exists are left alone.
--
-- \`locked\` deliberately stays as 018 set it. A row still marked as
-- hand-corrected is only over-protected; one wrongly unlocked could lose a
-- real correction at the next import.
UPDATE transactions
SET category_id = (SELECT id FROM categories WHERE name = substr(import_fingerprint, (instr(import_fingerprint, char(1)) + instr(substr(import_fingerprint, instr(import_fingerprint, char(1)) + 1), char(1))) + 1, ((instr(import_fingerprint, char(1)) + instr(substr(import_fingerprint, instr(import_fingerprint, char(1)) + 1), char(1))) + instr(substr(import_fingerprint, (instr(import_fingerprint, char(1)) + instr(substr(import_fingerprint, instr(import_fingerprint, char(1)) + 1), char(1))) + 1), char(1))) - (instr(import_fingerprint, char(1)) + instr(substr(import_fingerprint, instr(import_fingerprint, char(1)) + 1), char(1))) - 1)),
    updated_at = '2026-09-10T00:00:00Z'
WHERE category_id = (SELECT id FROM categories WHERE name = '4x1000')
  AND lower(replace(replace(replace(replace(replace(replace(COALESCE(description, ''), 'á','a'), 'é','e'), 'í','i'), 'ó','o'), 'ú','u'), 'ñ','n')) LIKE '%4x1000%'
  AND lower(replace(replace(replace(replace(replace(replace(COALESCE(description, ''), 'á','a'), 'é','e'), 'í','i'), 'ó','o'), 'ú','u'), 'ñ','n')) NOT LIKE '%ajuste%'
  AND import_fingerprint IS NOT NULL
  AND EXISTS (SELECT 1 FROM categories WHERE name = substr(import_fingerprint, (instr(import_fingerprint, char(1)) + instr(substr(import_fingerprint, instr(import_fingerprint, char(1)) + 1), char(1))) + 1, ((instr(import_fingerprint, char(1)) + instr(substr(import_fingerprint, instr(import_fingerprint, char(1)) + 1), char(1))) + instr(substr(import_fingerprint, (instr(import_fingerprint, char(1)) + instr(substr(import_fingerprint, instr(import_fingerprint, char(1)) + 1), char(1))) + 1), char(1))) - (instr(import_fingerprint, char(1)) + instr(substr(import_fingerprint, instr(import_fingerprint, char(1)) + 1), char(1))) - 1));

-- 2. The 4x1000 rule as it should have been written: an adjustment, and
-- the tax named in the same description. This is what "Ajuste rappi card
-- 4x1000" is, and it is the only shape that is certainly the tax.
UPDATE transactions
SET category_id = (SELECT id FROM categories WHERE name = '4x1000'),
    locked = 1,
    updated_at = '2026-09-10T00:00:00Z'
WHERE EXISTS (SELECT 1 FROM categories WHERE name = '4x1000')
  AND lower(replace(replace(replace(replace(replace(replace(COALESCE(description, ''), 'á','a'), 'é','e'), 'í','i'), 'ó','o'), 'ú','u'), 'ñ','n')) LIKE '%ajuste%4x1000%'
  AND amount_minor < 0
  AND transfer_id IS NULL
  AND lower(replace(replace(replace(replace(replace(replace(COALESCE(description, ''), 'á','a'), 'é','e'), 'í','i'), 'ó','o'), 'ú','u'), 'ñ','n')) NOT LIKE '%didi%'
  AND lower(replace(replace(replace(replace(replace(replace(COALESCE(description, ''), 'á','a'), 'é','e'), 'í','i'), 'ó','o'), 'ú','u'), 'ñ','n')) NOT LIKE '%uber%'
  AND lower(replace(replace(replace(replace(replace(replace(COALESCE(description, ''), 'á','a'), 'é','e'), 'í','i'), 'ó','o'), 'ú','u'), 'ñ','n')) NOT LIKE '%claro%'
  AND lower(replace(replace(replace(replace(replace(replace(COALESCE(description, ''), 'á','a'), 'é','e'), 'í','i'), 'ó','o'), 'ú','u'), 'ñ','n')) NOT LIKE '%epm%'
  AND lower(replace(replace(replace(replace(replace(replace(COALESCE(description, ''), 'á','a'), 'é','e'), 'í','i'), 'ó','o'), 'ú','u'), 'ñ','n')) NOT LIKE '%exito%'
  AND lower(replace(replace(replace(replace(replace(replace(COALESCE(description, ''), 'á','a'), 'é','e'), 'í','i'), 'ó','o'), 'ú','u'), 'ñ','n')) NOT LIKE '%dollarcity%';

-- 3. Income tax. Expenses only: the December bonus mentions the tax it
-- was reduced by, and it is a salary, not a payment to the DIAN.
--
-- Accountant fees for filing the return are NOT here. Preparing a return
-- and paying the tax are different expenses, and only one of them is what
-- the tax module has to predict.
UPDATE transactions
SET category_id = (SELECT id FROM categories WHERE name = 'Dian'),
    locked = 1,
    updated_at = '2026-09-10T00:00:00Z'
WHERE EXISTS (SELECT 1 FROM categories WHERE name = 'Dian')
  AND (lower(replace(replace(replace(replace(replace(replace(COALESCE(description, ''), 'á','a'), 'é','e'), 'í','i'), 'ó','o'), 'ú','u'), 'ñ','n')) LIKE '%impuesto de renta%' OR lower(replace(replace(replace(replace(replace(replace(COALESCE(description, ''), 'á','a'), 'é','e'), 'í','i'), 'ó','o'), 'ú','u'), 'ñ','n')) LIKE '%impuesto renta%')
  AND amount_minor < 0
  AND transfer_id IS NULL;

-- 4. The market, singular and plural. 018 asked for "mercados or" only,
-- and that missed most of them: the note is written both ways.
--
-- Both patterns need the space before "or", or "mercado libre" and
-- "mercados del norte" would come along.
UPDATE transactions
SET category_id = (SELECT id FROM categories WHERE name = 'Mercados OR'),
    locked = 1,
    updated_at = '2026-09-10T00:00:00Z'
WHERE EXISTS (SELECT 1 FROM categories WHERE name = 'Mercados OR')
  AND (lower(replace(replace(replace(replace(replace(replace(COALESCE(description, ''), 'á','a'), 'é','e'), 'í','i'), 'ó','o'), 'ú','u'), 'ñ','n')) LIKE '%mercado or%' OR lower(replace(replace(replace(replace(replace(replace(COALESCE(description, ''), 'á','a'), 'é','e'), 'í','i'), 'ó','o'), 'ú','u'), 'ñ','n')) LIKE '%mercados or%')
  AND amount_minor < 0
  AND transfer_id IS NULL
  AND lower(replace(replace(replace(replace(replace(replace(COALESCE(description, ''), 'á','a'), 'é','e'), 'í','i'), 'ó','o'), 'ú','u'), 'ñ','n')) NOT LIKE '%didi%'
  AND lower(replace(replace(replace(replace(replace(replace(COALESCE(description, ''), 'á','a'), 'é','e'), 'í','i'), 'ó','o'), 'ú','u'), 'ñ','n')) NOT LIKE '%uber%'
  AND lower(replace(replace(replace(replace(replace(replace(COALESCE(description, ''), 'á','a'), 'é','e'), 'í','i'), 'ó','o'), 'ú','u'), 'ñ','n')) NOT LIKE '%claro%'
  AND lower(replace(replace(replace(replace(replace(replace(COALESCE(description, ''), 'á','a'), 'é','e'), 'í','i'), 'ó','o'), 'ú','u'), 'ñ','n')) NOT LIKE '%epm%'
  AND lower(replace(replace(replace(replace(replace(replace(COALESCE(description, ''), 'á','a'), 'é','e'), 'í','i'), 'ó','o'), 'ú','u'), 'ñ','n')) NOT LIKE '%exito%'
  AND lower(replace(replace(replace(replace(replace(replace(COALESCE(description, ''), 'á','a'), 'é','e'), 'í','i'), 'ó','o'), 'ú','u'), 'ñ','n')) NOT LIKE '%dollarcity%';

-- 5. DidiClub is a subscription to a digital platform, not a ride, so it
-- belongs with the other platforms and never with Didi. 018 already kept
-- it out of Didi; this states where it does belong, so the answer no
-- longer depends on where each row happened to be sitting.
UPDATE transactions
SET category_id = (SELECT id FROM categories WHERE name = 'Tecnología y Plataformas digitales'),
    locked = 1,
    updated_at = '2026-09-10T00:00:00Z'
WHERE EXISTS (SELECT 1 FROM categories WHERE name = 'Tecnología y Plataformas digitales')
  AND (lower(replace(replace(replace(replace(replace(replace(COALESCE(description, ''), 'á','a'), 'é','e'), 'í','i'), 'ó','o'), 'ú','u'), 'ñ','n')) LIKE '%didiclub%' OR lower(replace(replace(replace(replace(replace(replace(COALESCE(description, ''), 'á','a'), 'é','e'), 'í','i'), 'ó','o'), 'ú','u'), 'ñ','n')) LIKE '%didi club%')
  AND amount_minor < 0
  AND transfer_id IS NULL;
`,
  },
  {
    version: 20,
    name: 'movement_pocket',
    file: '020_movement_pocket.sql',
    sql: `-- Migration 020 - a movement can say which product it went to
--
-- Until now a movement recorded that money entered or left an ACCOUNT, and the
-- yields module had to guess which product inside it was involved. The guess
-- was written down honestly - "the movements go to the first pocket" - and it
-- is right for every account with one product, which was every account but
-- Dale. It stopped being right the moment Jose split more accounts up.
--
-- Two things went wrong with the guess. Money arriving in an account landed in
-- the first product whether or not that is where the bank put it. And moving
-- money from one product to another, or taking yield out to spend it, changed
-- no product balance at all - so a product went on earning on money it no
-- longer held until Jose noticed and typed a correction.
--
-- So the movement says it. Nullable, because it is only ever a question worth
-- asking when an account has more than one product: with one product there is
-- nothing to choose and the column stays empty, which is also every row that
-- already exists.
--
-- ON DELETE SET NULL, not CASCADE: removing a product must never remove the
-- money that passed through it. The movement is the fact; the product is
-- bookkeeping on top of it.

ALTER TABLE transactions ADD COLUMN pocket_id INTEGER REFERENCES yield_pockets(id) ON DELETE SET NULL;

CREATE INDEX idx_transactions_pocket ON transactions(pocket_id) WHERE pocket_id IS NOT NULL;

-- A withdrawal from the cushion comes out of one product too. Same reasoning,
-- same rule: null while an account has nothing to choose between.
ALTER TABLE cushion_withdrawals ADD COLUMN pocket_id INTEGER REFERENCES yield_pockets(id) ON DELETE SET NULL;
`,
  },
  {
    version: 21,
    name: 'existing_movements_to_savings',
    file: '021_existing_movements_to_savings.sql',
    sql: `-- Migration 021 - every movement so far came out of the savings account
--
-- Migration 020 gave a movement somewhere to say which product it touched, and
-- left every existing row empty. Empty means "the first product", which was
-- the rule before the column existed - and it is now wrong twice over.
--
-- It is wrong because "first" is sort order, which only records when each
-- product was created. Jose created the savings products last, so the first
-- product of a split account is whichever alcancia happened to predate them,
-- and every movement of that account's history was being credited to a pot it
-- never passed through.
--
-- And it is wrong because it is unsaid. A row with no product is a row the app
-- has to guess about, and the guess changes the moment a product is added or
-- removed. Saying it outright makes the history stable.
--
-- So: everything that has happened so far came out of, or went into, the
-- savings account. That is what Jose says is true of his own history - money
-- arrives in the savings account and leaves from it, and anything sitting in
-- an alcancia got there by a deliberate move, which is a movement of its own
-- and did not exist before this.
--
-- Both names are matched because the product is named in the language the user
-- read when the account was enrolled, and an account may have been enrolled
-- under either.

UPDATE transactions
SET pocket_id = (
      SELECT p.id FROM yield_pockets p
      WHERE p.account_id = transactions.account_id
        AND lower(p.name) IN ('cuenta de ahorros', 'savings account')
      ORDER BY p.sort_order
      LIMIT 1
    ),
    updated_at = '2026-09-11T00:00:00Z'
WHERE pocket_id IS NULL
  AND EXISTS (
    SELECT 1 FROM yield_pockets p
    WHERE p.account_id = transactions.account_id
      AND lower(p.name) IN ('cuenta de ahorros', 'savings account')
  );

-- The same for money taken out of the cushion: it lands in the account, and
-- the account means the savings product unless something else was said.
UPDATE cushion_withdrawals
SET pocket_id = (
      SELECT p.id FROM yield_pockets p
      WHERE p.account_id = cushion_withdrawals.account_id
        AND lower(p.name) IN ('cuenta de ahorros', 'savings account')
      ORDER BY p.sort_order
      LIMIT 1
    )
WHERE pocket_id IS NULL
  AND EXISTS (
    SELECT 1 FROM yield_pockets p
    WHERE p.account_id = cushion_withdrawals.account_id
      AND lower(p.name) IN ('cuenta de ahorros', 'savings account')
  );
`,
  },
  {
    version: 22,
    name: 'default_pocket',
    file: '022_default_pocket.sql',
    sql: `-- Migration 022 - the user says which product is the default, not the name
--
-- Money arriving in an account has to land somewhere, and until now the app
-- decided where by matching the product's name against "Cuenta de ahorros" or
-- "Savings account". That works exactly until someone renames one, and it
-- writes into the code a decision that belongs to the person using it: which
-- of their own products is the usual one.
--
-- So it is a flag on the product instead. A new account gets one product and
-- that product is the default; splitting an account up does not change which
-- one is usual unless the user says so.
--
-- The partial unique index is what keeps it honest: at most one default per
-- account. SQLite treats NULLs as distinct, so \`is_default\` is 1 or NULL
-- rather than 1 or 0 - a column of zeroes would collide with itself.

ALTER TABLE yield_pockets ADD COLUMN is_default INTEGER CHECK (is_default IS NULL OR is_default = 1);

CREATE UNIQUE INDEX idx_yield_pockets_default
  ON yield_pockets(account_id) WHERE is_default = 1;

-- What is true today: every account's savings product is its usual one. The
-- name is used here and only here - as a one-off reading of what Jose has
-- already set up, not as a rule the app goes on applying.
UPDATE yield_pockets
SET is_default = 1, updated_at = '2026-09-11T00:00:00Z'
WHERE lower(name) IN ('cuenta de ahorros', 'savings account');

-- And an account with no product by that name keeps its first as the usual
-- one, so every account has an answer.
UPDATE yield_pockets
SET is_default = 1, updated_at = '2026-09-11T00:00:00Z'
WHERE id IN (
  SELECT MIN(p.id) FROM yield_pockets p
  WHERE NOT EXISTS (
    SELECT 1 FROM yield_pockets d WHERE d.account_id = p.account_id AND d.is_default = 1
  )
  GROUP BY p.account_id
);
`,
  },
  {
    version: 23,
    name: 'account_aliases',
    file: '023_account_aliases.sql',
    sql: `-- Migration 023 - a renamed account is still the same account
--
-- The importer finds an account by the exact name the backup carries. Rename
-- one inside this app and the next import stops recognising it: Jose renamed
-- "Tarjeta credito rappi" to "Rappi Card", and the following import created a
-- second account under the old name and put one movement in it.
--
-- Renaming is a normal thing to do, so this is a hole rather than a mistake.
-- The fix is to let an account remember what a backup calls it, which is
-- exactly the relationship the importer needs and the only one it was missing.
--
-- ON DELETE CASCADE: an alias with no account is a name pointing at nothing,
-- and would send the next import to a row that is gone.

CREATE TABLE account_aliases (
  source_name TEXT    PRIMARY KEY,
  account_id  INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  note        TEXT,
  created_at  TEXT    NOT NULL,
  updated_at  TEXT    NOT NULL
);

CREATE INDEX idx_account_aliases_account ON account_aliases(account_id);

-- Now the duplicate itself. Everything in it moves to the account it should
-- have gone to, and the empty shell goes.
--
-- Every statement checks both accounts exist, so on a database where the names
-- are different - anyone's but Jose's - the whole of this does nothing.

UPDATE transactions
SET account_id = (SELECT id FROM accounts WHERE lower(name) = 'rappi card'),
    updated_at = '2026-09-11T00:00:00Z'
WHERE account_id = (SELECT id FROM accounts WHERE lower(name) LIKE 'tarjeta cr%dito rappi')
  AND EXISTS (SELECT 1 FROM accounts WHERE lower(name) = 'rappi card');

UPDATE credit_limit_changes
SET account_id = (SELECT id FROM accounts WHERE lower(name) = 'rappi card')
WHERE account_id = (SELECT id FROM accounts WHERE lower(name) LIKE 'tarjeta cr%dito rappi')
  AND EXISTS (SELECT 1 FROM accounts WHERE lower(name) = 'rappi card')
  AND NOT EXISTS (
    SELECT 1 FROM credit_limit_changes other
    WHERE other.account_id = (SELECT id FROM accounts WHERE lower(name) = 'rappi card')
      AND other.effective_on = credit_limit_changes.effective_on
  );

DELETE FROM accounts
WHERE lower(name) LIKE 'tarjeta cr%dito rappi'
  AND EXISTS (SELECT 1 FROM accounts WHERE lower(name) = 'rappi card');

-- And the name the backup uses, so the next import knows where it goes.
INSERT INTO account_aliases (source_name, account_id, note, created_at, updated_at)
SELECT 'Tarjeta crédito rappi', id, 'Renamed to Rappi Card', '2026-09-11T00:00:00Z', '2026-09-11T00:00:00Z'
FROM accounts WHERE lower(name) = 'rappi card';
`,
  },
  {
    version: 24,
    name: 'remove_duplicate_card',
    file: '024_remove_duplicate_card.sql',
    sql: `-- Migration 024 - remove the duplicate credit card, without guessing a name
--
-- Migration 023 merged the account the importer created under the old name
-- into the one Jose had renamed, and it found the second one by matching
-- \`lower(name) = 'rappi card'\`. That is a guess about how a name is spelled,
-- and it did not hold: the duplicate is still there.
--
-- This one does not guess. The duplicate is the account the BACKUP names,
-- which is a fact: it is the name in the file. What it merges into is "the
-- other credit-card account with the most movements", which needs no name at
-- all - the account Jose has been using for years has thousands of rows, and
-- the one created by accident has one.
--
-- The movement is moved rather than deleted. Deleting it would take its import
-- fingerprint with it, and the next import would meet that row as new, create
-- the account again, and put it back - the same loop this is here to end.
--
-- Every statement is a no-op when there is no duplicate, so this does nothing
-- at all if 023 already worked, and nothing on anybody else's database.

UPDATE transactions
SET account_id = (
      SELECT other.id FROM accounts other
      WHERE other.type = 'credit'
        AND other.id <> (SELECT id FROM accounts WHERE lower(name) LIKE 'tarjeta cr%dito rappi')
      ORDER BY (SELECT COUNT(*) FROM transactions t WHERE t.account_id = other.id) DESC
      LIMIT 1
    ),
    updated_at = '2026-09-11T00:00:00Z'
WHERE account_id = (SELECT id FROM accounts WHERE lower(name) LIKE 'tarjeta cr%dito rappi')
  AND EXISTS (
    SELECT 1 FROM accounts other
    WHERE other.type = 'credit'
      AND other.id <> (SELECT id FROM accounts WHERE lower(name) LIKE 'tarjeta cr%dito rappi')
  );

UPDATE credit_limit_changes
SET account_id = (
      SELECT other.id FROM accounts other
      WHERE other.type = 'credit'
        AND other.id <> (SELECT id FROM accounts WHERE lower(name) LIKE 'tarjeta cr%dito rappi')
      ORDER BY (SELECT COUNT(*) FROM transactions t WHERE t.account_id = other.id) DESC
      LIMIT 1
    )
WHERE account_id = (SELECT id FROM accounts WHERE lower(name) LIKE 'tarjeta cr%dito rappi')
  AND EXISTS (
    SELECT 1 FROM accounts other
    WHERE other.type = 'credit'
      AND other.id <> (SELECT id FROM accounts WHERE lower(name) LIKE 'tarjeta cr%dito rappi')
  )
  AND NOT EXISTS (
    SELECT 1 FROM credit_limit_changes taken
    WHERE taken.effective_on = credit_limit_changes.effective_on
      AND taken.account_id = (
        SELECT other.id FROM accounts other
        WHERE other.type = 'credit'
          AND other.id <> (SELECT id FROM accounts WHERE lower(name) LIKE 'tarjeta cr%dito rappi')
        ORDER BY (SELECT COUNT(*) FROM transactions t WHERE t.account_id = other.id) DESC
        LIMIT 1
      )
  );

-- The name the backup uses, recorded against the account that survives, so the
-- next import knows where those rows go and never makes this account again.
INSERT INTO account_aliases (source_name, account_id, note, created_at, updated_at)
SELECT 'Tarjeta crédito rappi', other.id, 'Duplicate merged by migration 024',
       '2026-09-11T00:00:00Z', '2026-09-11T00:00:00Z'
FROM accounts other
WHERE other.type = 'credit'
  AND other.id <> (SELECT id FROM accounts WHERE lower(name) LIKE 'tarjeta cr%dito rappi')
  AND EXISTS (SELECT 1 FROM accounts WHERE lower(name) LIKE 'tarjeta cr%dito rappi')
ORDER BY (SELECT COUNT(*) FROM transactions t WHERE t.account_id = other.id) DESC
LIMIT 1
ON CONFLICT(source_name) DO NOTHING;

-- And the empty account goes. Only once it is empty: without another credit
-- account to move its rows to, deleting it would take them with it.
DELETE FROM accounts
WHERE lower(name) LIKE 'tarjeta cr%dito rappi'
  AND NOT EXISTS (SELECT 1 FROM transactions WHERE account_id = accounts.id);
`,
  },
  {
    version: 25,
    name: 'delete_that_account',
    file: '025_delete_that_account.sql',
    sql: `-- Migration 025 - delete "Tarjeta crédito rappi", unconditionally
--
-- Two attempts have not removed this account, and the reason turns out to be
-- in the schema rather than in either of them: \`transactions.account_id\` is
-- ON DELETE RESTRICT. An account with movements cannot be deleted at all.
-- That rule is right - deleting an account must never quietly delete money -
-- and it means the movements have to be dealt with first, every time, with no
-- exceptions. 023 tried and missed because it looked for the surviving account
-- by a name that did not match; 024 declined to delete anything it could not
-- first empty, and said nothing when it could not.
--
-- Jose has given the name exactly and asked for the account to go. So this
-- empties it first, in the order that loses least:
--
-- 1. The movements go to "Rappi Card" if that account exists - it is the same
--    card, and that is where they belong.
-- 2. Failing that, to whichever other credit-card account has the most
--    movements, which is the real card under any name.
-- 3. Anything still left is recorded in \`deleted_imports\` and removed. That
--    table is what stops the next import meeting those rows as new and
--    building this account all over again.
--
-- Only then the account itself. By this point nothing references it.

UPDATE transactions
SET account_id = (
      SELECT other.id FROM accounts other
      WHERE other.name <> 'Tarjeta crédito rappi'
        AND (lower(other.name) = 'rappi card' OR other.type = 'credit')
      ORDER BY CASE WHEN lower(other.name) = 'rappi card' THEN 0 ELSE 1 END,
               (SELECT COUNT(*) FROM transactions t WHERE t.account_id = other.id) DESC
      LIMIT 1
    ),
    updated_at = '2026-09-11T00:00:00Z'
WHERE account_id IN (SELECT id FROM accounts WHERE name = 'Tarjeta crédito rappi')
  AND EXISTS (
    SELECT 1 FROM accounts other
    WHERE other.name <> 'Tarjeta crédito rappi'
      AND (lower(other.name) = 'rappi card' OR other.type = 'credit')
  );

INSERT INTO deleted_imports (import_fingerprint, import_seq, deleted_at)
SELECT import_fingerprint, import_seq, '2026-09-11T00:00:00Z'
FROM transactions
WHERE account_id IN (SELECT id FROM accounts WHERE name = 'Tarjeta crédito rappi')
  AND import_fingerprint IS NOT NULL
ON CONFLICT(import_fingerprint, import_seq) DO NOTHING;

DELETE FROM transactions
WHERE account_id IN (SELECT id FROM accounts WHERE name = 'Tarjeta crédito rappi');

DELETE FROM accounts WHERE name = 'Tarjeta crédito rappi';
`,
  },
  {
    version: 26,
    name: 'delete_it_for_real',
    file: '026_delete_it_for_real.sql',
    sql: `-- Migration 026 - delete it, matching on as little as possible
--
-- Three migrations have not removed this account. 025 found the reason the
-- first two failed - an account with movements cannot be deleted, because
-- \`transactions.account_id\` is ON DELETE RESTRICT - and still did not work,
-- which leaves only one candidate: the name.
--
-- Every attempt so far compared the name to a string. The name on screen is
-- "Tarjeta crédito rappi", and a string comparison against that can fail for
-- reasons nothing on screen shows: a trailing space, an accent stored as a
-- combining mark rather than as one character, a different case. SQLite's
-- \`lower()\` does not touch accented letters either, so folding does not help.
--
-- So this matches on the parts that cannot vary. "arjeta" skips the capital,
-- "rappi" is plain, and the wildcards absorb the accent, any spacing and
-- anything on either end. The account it must not touch is called "Rappi
-- Card", which contains no "arjeta" at all.
--
-- The order is the one 025 established, and it is not optional: empty the
-- account first, then delete it.

UPDATE transactions
SET account_id = (
      SELECT other.id FROM accounts other
      WHERE other.name NOT LIKE '%arjeta%rappi%' AND other.type = 'credit'
      ORDER BY (SELECT COUNT(*) FROM transactions t WHERE t.account_id = other.id) DESC
      LIMIT 1
    ),
    updated_at = '2026-09-11T00:00:00Z'
WHERE account_id IN (SELECT id FROM accounts WHERE name LIKE '%arjeta%rappi%')
  AND EXISTS (
    SELECT 1 FROM accounts other
    WHERE other.name NOT LIKE '%arjeta%rappi%' AND other.type = 'credit'
  );

INSERT INTO deleted_imports (import_fingerprint, import_seq, deleted_at)
SELECT import_fingerprint, import_seq, '2026-09-11T00:00:00Z'
FROM transactions
WHERE account_id IN (SELECT id FROM accounts WHERE name LIKE '%arjeta%rappi%')
  AND import_fingerprint IS NOT NULL
ON CONFLICT(import_fingerprint, import_seq) DO NOTHING;

DELETE FROM transactions
WHERE account_id IN (SELECT id FROM accounts WHERE name LIKE '%arjeta%rappi%');

DELETE FROM accounts WHERE name LIKE '%arjeta%rappi%';
`,
  },
  {
    version: 27,
    name: 'tax_simulations',
    file: '027_tax_simulations.sql',
    sql: `-- Migration 027 - one income-tax simulation per tax year
--
-- The simulation is a form a person fills in over the year: a salary, what was
-- withheld each month, what they paid for a health policy. Nothing in it is
-- derived from the ledger yet, on purpose - the figures a tax return needs are
-- gross where the ledger holds net, and yearly where the yields module holds a
-- running total - so every one of them is typed, and a figure brought in from
-- the app is a starting point the person then corrects.
--
-- Stored as one document per year rather than one column per box. The form
-- follows the law, the law changes every year, and a column per box would mean
-- a migration every time a line is added to Formulario 210 - which is the
-- opposite of "configurable forms" in the project's own rules. Money inside it
-- is still integer cents, as everywhere else.
--
-- No \`json_valid\` check: the SQLite the phone runs is not guaranteed to carry
-- the JSON functions, and a migration that fails on the device is the one
-- mistake this project has already paid for once.

CREATE TABLE tax_simulations (
  year        INTEGER PRIMARY KEY CHECK (year BETWEEN 2000 AND 2100),
  inputs      TEXT    NOT NULL,
  created_at  TEXT    NOT NULL,
  updated_at  TEXT    NOT NULL
);
`,
  },
  {
    version: 28,
    name: 'payout_every_months',
    file: '028_payout_every_months.sql',
    sql: `-- Migration 028 - a monthly payout can cover several months
--
-- Some products hand their yield over every two, six, twelve or twenty-four
-- months rather than every month: a CDT that pays at the end of each semester,
-- a savings product that pays once a year. Until now a monthly component could
-- only be paid at the end of every calendar month.
--
-- \`payout_months\` is how many months each payment covers. It only means
-- anything for a monthly component, and it defaults to 1, so every rate that
-- exists today keeps paying exactly as it did. The months are counted from the
-- month the rate starts in: a rate from 2026-07-01 paid every 3 months pays at
-- the end of September, then December, then March.
--
-- \`paid_on\` is written on each day worked out: the day that day's yield is
-- handed over. With several months to a payment a day can no longer say that
-- on its own, because it depends on when the rate started. Days written before
-- this migration leave it empty and keep the rule they were computed under - a
-- daily day is paid that day, a monthly one at the end of its month.
--
-- Only columns are added. No existing row is changed.

ALTER TABLE yield_rates ADD COLUMN payout_months INTEGER NOT NULL DEFAULT 1
  CHECK (typeof(payout_months) = 'integer' AND payout_months >= 1);

ALTER TABLE yield_days ADD COLUMN paid_on TEXT
  CHECK (paid_on IS NULL OR paid_on GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]');
`,
  },
  {
    version: 29,
    name: 'product_kind',
    file: '029_product_kind.sql',
    sql: `-- Migration 029 - a product has a kind, and the kind decides the withholding
--
-- Until now every product was treated as a high-yield savings product: the 7%
-- is withheld only on a day whose interest reaches 0.055 UVT, and then on the
-- whole of that day (Decreto 1625 de 2016, art. 1.2.4.2.87, written for
-- savings deposits).
--
-- A CDT is not withheld that way. Jose stated the rule on 2026-09-11: a CDT
-- always has the 7% withheld on its yield, with no threshold. Same rate, same
-- UVT - only the threshold does not apply. Still to be confirmed with an
-- accountant, like the rest of the withholding rules.
--
-- \`kind\` says which rule a product follows. Every product that exists today
-- is a high-yield one, which is the default, so no figure already worked out
-- changes. Only the column is added.

ALTER TABLE yield_pockets ADD COLUMN kind TEXT NOT NULL DEFAULT 'high_yield'
  CHECK (kind IN ('high_yield', 'cdt'));
`,
  },
  {
    version: 30,
    name: 'product_first',
    file: '030_product_first.sql',
    sql: `-- Migration 030 - the product is the parent: it has the rate and the payout
--
-- Until now a rate could belong to a whole account, and every product of that
-- account without a rate of its own used it. How often a rate paid lived on the
-- rate. Jose set out the model the screens should follow on 2026-09-11: a
-- product is what a person opens, and a product has a rate, a way of being
-- paid, and - for a CDT - a term.
--
-- Three changes, none of which changes a figure already worked out:
--
-- 1. How a product is paid moves onto the product. \`payout\` and
--    \`payout_months\` are copied from the product's own rates, which already
--    agree with each other in every account on record. The rates keep their
--    own copy, and a rate with a spending condition keeps being paid at the
--    end of the month: Uala's bonus.
--
-- 2. A rate that belonged to a whole account is copied onto every product of
--    that account which used it - the products with no rate of their own - and
--    the whole-account row is removed. That is exactly the rule the engine
--    followed, written out row by row, so every day works out the same.
--
-- 3. A CDT gets its terms: the day it opened, how many months it runs, which
--    product it matures into, and the income category its yield is recorded
--    under when it pays. All empty for every product that exists today.

ALTER TABLE yield_pockets ADD COLUMN payout TEXT NOT NULL DEFAULT 'daily'
  CHECK (payout IN ('daily', 'monthly'));

ALTER TABLE yield_pockets ADD COLUMN payout_months INTEGER NOT NULL DEFAULT 1
  CHECK (typeof(payout_months) = 'integer' AND payout_months >= 1);

ALTER TABLE yield_pockets ADD COLUMN opened_on TEXT
  CHECK (opened_on IS NULL OR opened_on GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]');

ALTER TABLE yield_pockets ADD COLUMN term_months INTEGER
  CHECK (term_months IS NULL OR (typeof(term_months) = 'integer' AND term_months >= 1));

ALTER TABLE yield_pockets ADD COLUMN matures_into_pocket_id INTEGER
  REFERENCES yield_pockets(id) ON DELETE SET NULL;

ALTER TABLE yield_pockets ADD COLUMN income_category_id INTEGER
  REFERENCES categories(id) ON DELETE SET NULL;

-- The products that earned on their account's rates: the ones with none of
-- their own. Taken before anything is copied, so a product that receives its
-- first copy is not mistaken for one that already had rates.
CREATE TEMP TABLE products_on_account_rates AS
  SELECT p.id, p.account_id FROM yield_pockets p
  WHERE NOT EXISTS (SELECT 1 FROM yield_rates o WHERE o.pocket_id = p.id);

INSERT INTO yield_rates (account_id, pocket_id, component, payout, payout_months, valid_from, valid_to,
                         annual_rate_scaled, min_balance_minor, max_balance_minor,
                         requires_monthly_spend_minor, fallback_annual_rate_scaled, note, created_at)
SELECT r.account_id, p.id, r.component, r.payout, r.payout_months, r.valid_from, r.valid_to,
       r.annual_rate_scaled, r.min_balance_minor, r.max_balance_minor,
       r.requires_monthly_spend_minor, r.fallback_annual_rate_scaled, r.note, r.created_at
FROM yield_rates r
JOIN products_on_account_rates p ON p.account_id = r.account_id
WHERE r.pocket_id IS NULL;

DELETE FROM yield_rates WHERE pocket_id IS NULL;

DROP TABLE products_on_account_rates;

-- How each product is paid, from its newest rate without a spending condition.
UPDATE yield_pockets SET
  payout = COALESCE((
    SELECT r.payout FROM yield_rates r
    WHERE r.pocket_id = yield_pockets.id AND r.requires_monthly_spend_minor IS NULL
    ORDER BY r.valid_from DESC, r.id DESC LIMIT 1), 'daily'),
  payout_months = COALESCE((
    SELECT r.payout_months FROM yield_rates r
    WHERE r.pocket_id = yield_pockets.id AND r.requires_monthly_spend_minor IS NULL
    ORDER BY r.valid_from DESC, r.id DESC LIMIT 1), 1);
`,
  },
  {
    version: 31,
    name: 'pocket_withholding',
    file: '031_pocket_withholding.sql',
    sql: `-- Migration 031 - whether a product is withheld is the product's own answer
--
-- Withholding was one switch per account. Jose, 2026-09-11: inside one account
-- some products are withheld and others are not, so the switch belongs to the
-- product. A product that is not withheld has nothing at all taken from its
-- yield.
--
-- Every product starts with the answer its account has today, so no figure
-- already worked out changes. Only the column is added and filled.

ALTER TABLE yield_pockets ADD COLUMN withholding INTEGER NOT NULL DEFAULT 1
  CHECK (withholding IN (0, 1));

UPDATE yield_pockets
   SET withholding = (SELECT ya.withholding FROM yield_accounts ya WHERE ya.account_id = yield_pockets.account_id)
 WHERE EXISTS (SELECT 1 FROM yield_accounts ya WHERE ya.account_id = yield_pockets.account_id);
`,
  },
  {
    version: 32,
    name: 'adjustment_transaction',
    file: '032_adjustment_transaction.sql',
    sql: `-- Migration 032 - an entry into a product can say which movement it belongs to
--
-- Cashing in with an expense is two writes: a movement out of the account, and
-- the same amount into what the product gathered, so the product balance does
-- not move. Withdrawals already carried the movement they belong to; entries
-- did not, so the two halves of such an expense could not be corrected or
-- deleted together. This adds that link. Entries already stored have none,
-- which is what they are: entries on the product alone.

ALTER TABLE cushion_adjustments ADD COLUMN transaction_id INTEGER
  REFERENCES transactions(id) ON DELETE SET NULL;

CREATE INDEX idx_cushion_adjustments_transaction ON cushion_adjustments(transaction_id);
`,
  },
  {
    version: 33,
    name: 'pocket_net_worth',
    file: '033_pocket_net_worth.sql',
    sql: `-- Migration 033 - a product can sit outside net worth
--
-- Jose, 2026-09-12: the CDTs that hold the money for the income tax live inside
-- Pibank, next to the savings he spends from. That money is already spoken
-- for, so it must not count as his: not in net worth, and not in Pibank's
-- balance on the summary or the accounts screen. Until now the only way to say
-- so was a whole account ("Pibank para renta"), which is not how the bank has it.
--
-- The switch belongs to the product. Leaving one out takes its own movements
-- off the account's balance and off net worth; the transfer that fed it then
-- reads as money leaving. The usual product always counts, because a movement
-- that names no product lands in it.
--
-- Every product starts counted, so no balance and no net worth changes here.

ALTER TABLE yield_pockets ADD COLUMN include_in_net_worth INTEGER NOT NULL DEFAULT 1
  CHECK (include_in_net_worth IN (0, 1));
`,
  },
  {
    version: 34,
    name: 'product_kinds',
    file: '034_product_kinds.sql',
    sql: `-- Migration 034 - what a product's own movement is, as a list the user keeps
--
-- A movement that touches only what a product gathered carried one of three
-- words fixed in the schema: cashback, correction, other. Jose, 2026-09-16:
-- they are categories like any other and should be his - renamed, given an
-- icon of their own, added to.
--
-- So they become rows. The three that existed are seeded, every entry already
-- written is pointed at the one it had, and \`kind\` stays exactly as it is:
-- migrations are history, and a column already written is not rewritten. It
-- keeps the old rows readable by anything that has not been taught about this
-- table yet.
--
-- \`counts_as\` is the half that is not cosmetic. What a figure IS decides how
-- it is taxed: interest is withheld, cashback is not, so a kind someone adds
-- has to say which of the two it behaves like.

CREATE TABLE product_kinds (
  id             INTEGER PRIMARY KEY,
  name           TEXT    NOT NULL,
  builtin_icon   TEXT,
  custom_icon_id INTEGER REFERENCES custom_icons(id) ON DELETE RESTRICT,
  counts_as      TEXT    NOT NULL DEFAULT 'yield' CHECK (counts_as IN ('yield', 'cashback')),
  archived       INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0, 1)),
  sort_order     INTEGER NOT NULL DEFAULT 0,
  created_at     TEXT    NOT NULL,
  updated_at     TEXT    NOT NULL,

  CHECK ((builtin_icon IS NULL) <> (custom_icon_id IS NULL))
);

CREATE UNIQUE INDEX idx_product_kinds_name ON product_kinds(name);

INSERT INTO product_kinds (name, builtin_icon, counts_as, sort_order, created_at, updated_at) VALUES
  ('Cashback', 'pricetag-outline', 'cashback', 0, '2026-09-16T00:00:00Z', '2026-09-16T00:00:00Z'),
  ('Corrección del banco', 'build-outline', 'yield', 1, '2026-09-16T00:00:00Z', '2026-09-16T00:00:00Z'),
  ('Otro', 'ellipsis-horizontal-circle-outline', 'yield', 2, '2026-09-16T00:00:00Z', '2026-09-16T00:00:00Z');

ALTER TABLE cushion_adjustments ADD COLUMN product_kind_id INTEGER REFERENCES product_kinds(id) ON DELETE SET NULL;

UPDATE cushion_adjustments
   SET product_kind_id = (SELECT id FROM product_kinds WHERE name = 'Cashback')
 WHERE kind = 'cashback';

UPDATE cushion_adjustments
   SET product_kind_id = (SELECT id FROM product_kinds WHERE name = 'Corrección del banco')
 WHERE kind = 'correction';

UPDATE cushion_adjustments
   SET product_kind_id = (SELECT id FROM product_kinds WHERE name = 'Otro')
 WHERE kind = 'other';

CREATE INDEX idx_cushion_adjustments_kind ON cushion_adjustments(product_kind_id);
`,
  },
  {
    version: 35,
    name: 'opening_becomes_an_adjustment',
    file: '035_opening_becomes_an_adjustment.sql',
    sql: `-- Migration 035 - the opening cushion becomes an ordinary adjustment
--
-- \`yield_accounts.opening_cushion_minor\` held what an account had already
-- earned before this app existed: the gap between what the bank shows and what
-- the ledger adds up to. It was counted in the cushion total and deliberately
-- left OUT of the base the interest is worked out on, on the reasoning that
-- the money was already inside the account balance.
--
-- It is not. Jose checked his banks on 2026-09-17: the app shows a HIGHER
-- figure than the products add up to, and the difference is exactly this - the
-- yields he had never recorded. That money is sitting in the bank earning, so
-- leaving it out of the base was undercounting every account. The note he left
-- on Plata says it outright: "200,057.44 was the balance the bank shows, not
-- the yield inside it" - the app was accruing on 200,000.
--
-- An adjustment is the same figure with none of that ambiguity: it counts in
-- the total AND in the base, which is what this always meant. So each opening
-- figure becomes one, dated the day it was measured, and the column is left at
-- zero rather than dropped - migrations are history, and a backup written
-- before today still carries it.
--
-- The cushion total does not move: it was opening + adjustments before and it
-- is adjustments alone now. What changes is that these figures start earning,
-- which is the correction.

INSERT INTO cushion_adjustments
  (account_id, source, kind, pocket_id, on_date, amount_minor, note, created_at, updated_at)
SELECT
  account_id,
  'yield',
  'correction',
  NULL,
  opening_on,
  opening_cushion_minor,
  'Rendimientos que el banco ya había pagado y no estaban en el histórico',
  created_at,
  updated_at
FROM yield_accounts
WHERE opening_cushion_minor <> 0;

UPDATE yield_accounts SET opening_cushion_minor = 0 WHERE opening_cushion_minor <> 0;
`,
  },
  {
    version: 36,
    name: 'opening_was_not_an_adjustment',
    file: '036_opening_was_not_an_adjustment.sql',
    sql: `-- Migration 036 - undoes 035: the opening cushion goes back where it was
--
-- Migration 035 turned each account's opening cushion figure into an ordinary
-- adjustment, so that it would count in the base the interest is worked out
-- on. That was wrong, and Jose caught it the same night.
--
-- The reasoning was that the bank shows more than the products add up to, so
-- the difference must be money sitting there earning that the base was
-- missing. The bank does show more than the LEDGER - but every one of these
-- products carries a balance Jose typed after reading it off the bank, and
-- that figure already has the yields inside it. Uala's product says
-- 4,584,082.13, which is what his bank says; adding the 1,115,499.46 opening
-- figure on top made it earn on 5,699,581.59. He saw the daily yield jump
-- from the 10th to the 11th of September and asked where it came from.
--
-- So the opening figure is a RECORD after all, exactly as the engine said,
-- and the reason is narrower than either of us stated: it is not that the
-- money is in the ledger, it is that it is already inside the figure each
-- product states. Each row 035 wrote goes back to the account it came from
-- and is removed.
--
-- Matched by the note 035 gave them, so an adjustment Jose wrote himself is
-- never touched.

UPDATE yield_accounts
SET opening_cushion_minor = (
      SELECT amount_minor FROM cushion_adjustments
      WHERE cushion_adjustments.account_id = yield_accounts.account_id
        AND note = 'Rendimientos que el banco ya había pagado y no estaban en el histórico'
      ORDER BY id LIMIT 1),
    opening_on = (
      SELECT on_date FROM cushion_adjustments
      WHERE cushion_adjustments.account_id = yield_accounts.account_id
        AND note = 'Rendimientos que el banco ya había pagado y no estaban en el histórico'
      ORDER BY id LIMIT 1)
WHERE EXISTS (
  SELECT 1 FROM cushion_adjustments
  WHERE cushion_adjustments.account_id = yield_accounts.account_id
    AND note = 'Rendimientos que el banco ya había pagado y no estaban en el histórico');

DELETE FROM cushion_adjustments
WHERE note = 'Rendimientos que el banco ya había pagado y no estaban en el histórico';

-- Every day worked out under 035 was worked out on a base that was too big.
-- Dropping them makes the next run do them again, on the figure each product
-- really states. Days corrected by hand are left alone: those are readings
-- off a statement, not something this app worked out.
DELETE FROM yield_days WHERE locked = 0;
`,
  },
  {
    version: 37,
    name: 'product_kinds_become_categories',
    file: '037_product_kinds_become_categories.sql',
    sql: `-- Migration 037 - a product's categories join the ordinary income categories
--
-- \`product_kinds\` (migration 034) gave a product's own movement its own little
-- list: Cashback, Corrección del banco, Otro, Rendimientos. Jose's point on
-- 2026-09-17 is that the split was never real: "un ingreso es un ingreso, no
-- importa si es para cuenta o para producto". A cashback the bank paid into a
-- product is income, and it belongs beside Salario and Depósitos rather than
-- in a second list that has to be kept, explained and chosen between.
--
-- So each kind becomes an income category carrying the same name and icon, and
-- every adjustment points at the category instead. A kind whose name is
-- already an income category joins that one rather than making a twin -
-- \`idx_categories_name_kind\` would refuse the twin anyway.
--
-- \`product_kinds\` and \`cushion_adjustments.product_kind_id\` stay exactly where
-- they are and are still written: migrations are history, a backup written
-- yesterday still carries them, and anything not yet taught about categories
-- goes on reading them.

ALTER TABLE cushion_adjustments
  ADD COLUMN category_id INTEGER REFERENCES categories(id) ON DELETE RESTRICT;

CREATE INDEX idx_cushion_adjustments_category ON cushion_adjustments(category_id);

-- One income category per kind that does not already have one by that name.
INSERT INTO categories (name, kind, builtin_icon, custom_icon_id, archived, sort_order,
                        created_at, updated_at)
SELECT
  k.name,
  'income',
  -- The table's CHECK wants exactly one of the two, and a kind that carries
  -- neither would fail it, so a plain icon stands in.
  CASE WHEN k.custom_icon_id IS NULL THEN COALESCE(k.builtin_icon, 'pricetag-outline') END,
  k.custom_icon_id,
  k.archived,
  k.sort_order,
  k.created_at,
  k.updated_at
FROM product_kinds k
WHERE NOT EXISTS (
  SELECT 1 FROM categories c WHERE c.name = k.name AND c.kind = 'income');

-- And every adjustment points at the category of the same name.
UPDATE cushion_adjustments
SET category_id = (
  SELECT c.id FROM categories c
  JOIN product_kinds k ON k.name = c.name
  WHERE k.id = cushion_adjustments.product_kind_id AND c.kind = 'income')
WHERE product_kind_id IS NOT NULL;
`,
  },
  {
    version: 38,
    name: 'name_the_product_of_loose_movements',
    file: '038_name_the_product_of_loose_movements.sql',
    sql: `-- Migration 038 - a movement says which product it went to
--
-- A movement in an account with one product names no product: there is
-- nothing to choose, and the one product holds everything. That stays true
-- until a second product is added - and from then on those movements follow
-- whichever product is the usual one, because "names no product" is read as
-- "the usual one". Change the usual and the money appears to move.
--
-- Jose hit it on 2026-09-21: he made Cuenta Ahorros the usual product of
-- Plata and 200,000 pesos left Bolsillo. His question was the right one - the
-- movement went to Bolsillo the day it was saved, so it should say Bolsillo
-- and stay there whatever becomes usual later. Nothing had ever written it
-- down. In his data it is one movement in Plata and ten in Pibank, the ten
-- adding up to 9,544,588.
--
-- Each of them is given the product that holds it TODAY - the usual one, or
-- the first where none is usual, which is exactly the rule that reads them
-- now. So this migration moves nothing: every figure after it is the figure
-- before it. What it changes is that the figures stop depending on a flag
-- that can be flipped, and a movement that really belonged elsewhere can now
-- be corrected one at a time, like any other.
--
-- Only accounts with more than one product. With one, naming it would say
-- nothing that is not already true, and a second product added later writes
-- them itself from now on (\`addPocket\`).
--
-- Movements only. The entries of the cushion have their own rule for which
-- product holds an unnamed one - the product that follows the account
-- balance, not the usual one - so naming them by this rule could move money
-- between products, which is the thing this migration exists to stop.

UPDATE transactions
SET pocket_id = (
  SELECT p.id FROM yield_pockets p
  WHERE p.account_id = transactions.account_id
  ORDER BY CASE WHEN p.is_default = 1 THEN 0 ELSE 1 END, p.sort_order, p.id
  LIMIT 1)
WHERE pocket_id IS NULL
  AND account_id IN (
    SELECT account_id FROM yield_pockets GROUP BY account_id HAVING COUNT(*) > 1);
`,
  },
  {
    version: 39,
    name: 'plata_money_was_always_in_the_bolsillo',
    file: '039_plata_money_was_always_in_the_bolsillo.sql',
    sql: `-- Migration 039 - Plata's savings account never held anything overnight
--
-- Jose, 2026-09-22, having said it several times before I listened: the
-- savings account of Plata has always been a pass-through. Money arrives
-- there and goes straight to the Bolsillo, which is the product that earns.
-- He set its balance to 0 from a date before the account existed, and 0 is
-- what it has always been.
--
-- What the app had instead: 200,000 sitting in that savings account from the
-- 8th to the 18th of September, earning 6.5% a year. It got there like this.
--
--   * Before a movement could name a product, "names no product" was read as
--     "the usual one". Plata's products were only created on the 10th, so
--     everything before that named none.
--   * On the 19th he made Cuenta Ahorros the usual product, and every one of
--     those movements silently moved into it.
--   * Migration 038 then wrote that reading down. It was right that it moved
--     no figures - but the figures it froze were already wrong.
--
-- The transfer of 200,000 into Plata on the 8th therefore landed in the
-- savings account and, as far as the app could see, stayed there for ten
-- days. It had gone to the Bolsillo the same day; there was simply no
-- record of products yet to say so.
--
-- So every movement of Plata goes to the Bolsillo. The internal transfers
-- between the two products end up with both legs in one product and cancel,
-- which is correct: they never left it. Afterwards
--
--   Cuenta Ahorros = 0.00   (its stated 0, and nothing moved through it)
--   Bolsillo       = 300,001.03
--
-- and 300,001.03 is the balance of the account, so nothing was invented and
-- nothing was lost. Only where the money earns changes: 11% in the Bolsillo
-- instead of 6.5% in a savings account that was empty.
--
-- By name, and a no-op if the names have changed since. A repair is a
-- migration and not a button: a button to fix one day's mistake is a button
-- left on the screen for ever, for whoever finds it next to wonder about.

UPDATE transactions
SET pocket_id = (
  SELECT p.id FROM yield_pockets p
  JOIN accounts a ON a.id = p.account_id
  WHERE a.name = 'Plata' AND p.name = 'Bolsillo')
WHERE pocket_id IN (
  SELECT p.id FROM yield_pockets p
  JOIN accounts a ON a.id = p.account_id
  WHERE a.name = 'Plata' AND p.name = 'Cuenta Ahorros')
AND EXISTS (
  SELECT 1 FROM yield_pockets p
  JOIN accounts a ON a.id = p.account_id
  WHERE a.name = 'Plata' AND p.name = 'Bolsillo');

-- Every day of Plata was worked out on balances that have just changed, so
-- they go and the engine writes them again on the next pass. None of them had
-- been corrected by hand, so nothing typed is being thrown away.
DELETE FROM yield_days
WHERE account_id IN (SELECT id FROM accounts WHERE name = 'Plata')
  AND locked = 0;

-- And the fingerprint that says the accrual is already done for today, or
-- opening the app would find nothing to redo and leave Plata empty of days.
DELETE FROM settings WHERE key = 'yields.accrual.mark';
`,
  },
  {
    version: 40,
    name: 'the_opening_figure_becomes_an_income',
    file: '040_the_opening_figure_becomes_an_income.sql',
    sql: `-- Migration 040 - the opening figure becomes an ordinary income to a product
--
-- Jose asked for this many times before it was understood: "productos, saldos,
-- fechas desde que comienza a rentar, tasas, sus movimientos y punto". The
-- thing in the way was \`yield_accounts.opening_cushion_minor\` - the figure he
-- typed once per account saying what the bank had already paid him - which was
-- a mechanism of its own with a name nobody could use, and which the screens
-- called a "colchón".
--
-- It is two things wearing one name: an AMOUNT, and a DATE from which the app
-- works yields out. The date is real and stays, under its own name. The amount
-- is an income to a product and nothing more, which is what he said it was.
--
-- Where each one goes, in his words, asked and answered on 2026-09-22:
--
--   Rappi cuenta -> Principal          Bold -> Bolsillo Principal
--   Lulo -> Bolsillo Principal         Nu   -> Mi primera Cajita
--   Ualá -> Cuenta ahorros             ARQ USD -> Ahorro
--   Dale -> split across its two alcancías, any split that keeps the totals
--   Pibank -> nothing: it already has this income, entered by hand on the
--             10th of September with the note "Adjuste rendimientos", so its
--             opening figure is a second copy of the same money.
--
-- Dated the day BEFORE the figure starts counting, which is what it is: part
-- of the balance that was already there, not money arriving afterwards. That
-- date is what keeps every figure still. An entry before a product's stated
-- balance is already inside that figure, so neither the product's balance nor
-- what it earns counts it again - and the total of what the account has earned
-- does, exactly as the opening figure did.
--
-- Verified against the backup of 2026-09-22 11:41, restored and migrated, with
-- every account's yields worked out again from scratch: every product's
-- balance, every account's "rendimiento disponible" as the screen shows it,
-- and every peso the bank has paid come out to the figure they are today.
-- Nothing moves.

INSERT INTO cushion_adjustments
  (account_id, source, on_date, amount_minor, note, kind, pocket_id, created_at, updated_at)
SELECT y.account_id,
       'yield',
       date(y.opening_on, '-1 day'),
       y.opening_cushion_minor,
       'Rendimientos que el banco ya habia pagado',
       'other',
       p.id,
       '2026-09-22T12:00:00Z',
       '2026-09-22T12:00:00Z'
FROM yield_accounts y
JOIN accounts a ON a.id = y.account_id
JOIN yield_pockets p ON p.account_id = y.account_id
WHERE y.opening_cushion_minor <> 0
  AND (
    (a.name = 'Rappi cuenta' AND p.name = 'Principal') OR
    (a.name = 'Bold'         AND p.name = 'Bolsillo Principal') OR
    (a.name = 'Lulo'         AND p.name = 'Bolsillo Principal') OR
    (a.name = 'Nu'           AND p.name = 'Mi primera Cajita') OR
    (a.name = 'Ualá'         AND p.name = 'Cuenta ahorros') OR
    (a.name = 'ARQ USD'      AND p.name = 'Ahorro')
  );

-- Dale's is split across its two alcancías, as he asked. Half each, and the
-- complemento takes the odd peso so the two add up to exactly what was there.
INSERT INTO cushion_adjustments
  (account_id, source, on_date, amount_minor, note, kind, pocket_id, created_at, updated_at)
SELECT y.account_id, 'yield', date(y.opening_on, '-1 day'),
       y.opening_cushion_minor / 2,
       'Rendimientos que el banco ya habia pagado', 'other', p.id,
       '2026-09-22T12:00:00Z', '2026-09-22T12:00:00Z'
FROM yield_accounts y
JOIN accounts a ON a.id = y.account_id
JOIN yield_pockets p ON p.account_id = y.account_id
WHERE y.opening_cushion_minor <> 0
  AND a.name = 'Dale' AND p.name = 'Alcancía Principal';

INSERT INTO cushion_adjustments
  (account_id, source, on_date, amount_minor, note, kind, pocket_id, created_at, updated_at)
SELECT y.account_id, 'yield', date(y.opening_on, '-1 day'),
       y.opening_cushion_minor - (y.opening_cushion_minor / 2),
       'Rendimientos que el banco ya habia pagado', 'other', p.id,
       '2026-09-22T12:00:00Z', '2026-09-22T12:00:00Z'
FROM yield_accounts y
JOIN accounts a ON a.id = y.account_id
JOIN yield_pockets p ON p.account_id = y.account_id
WHERE y.opening_cushion_minor <> 0
  AND a.name = 'Dale' AND p.name = 'Alcancía complemento';

-- And the figure itself is gone. The column goes with the code that read it;
-- emptying it is what this migration is for.
UPDATE yield_accounts SET opening_cushion_minor = 0;

-- Worked out again from scratch, because the engine's own start rule changes
-- with this: it always begins at the date on record rather than letting a rate
-- pull it earlier when the figure was zero. Days corrected by hand stay.
DELETE FROM yield_days WHERE locked = 0;
DELETE FROM settings WHERE key = 'yields.accrual.mark';
`,
  },
];
