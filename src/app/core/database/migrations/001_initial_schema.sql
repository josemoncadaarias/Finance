-- Migration 001 - initial schema
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
-- with `PRAGMA foreign_keys = ON`. DatabaseService does that on open.

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

CREATE TABLE accounts (
  id                    INTEGER PRIMARY KEY,
  name                  TEXT    NOT NULL,
  type                  TEXT    NOT NULL CHECK (type IN ('debit', 'credit', 'cash', 'investment')),
  currency_code         TEXT    NOT NULL REFERENCES currencies(code),

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
-- live in `transactions`, so an account balance is always a single
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
  ('USD', 'US Dollar',       'US$', 2);

INSERT INTO settings (key, value, updated_at) VALUES
  ('base_currency', 'COP', '1970-01-01T00:00:00Z');
