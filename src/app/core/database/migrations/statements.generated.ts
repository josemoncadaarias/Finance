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
];
