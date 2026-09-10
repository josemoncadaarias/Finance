-- Migration 004 - yields and cashback, as a module of their own
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
--      history with a start date, the same shape as `exchange_rates`: the rate
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
-- a hardcoded list: an account simply has no row in `yield_accounts`.

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
  -- is no way to recover them. Accrual starts the day after `opening_on`.
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
-- history cannot contradict itself. `min_balance_minor` / `max_balance_minor`
-- describe the band the rate applies to; a single band of 0..NULL means one
-- rate whatever the balance, which is the ordinary case.
--
-- `annual_rate_scaled` is the E.A. as a FRACTION scaled by 1,000,000:
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
-- `actual_net_minor` is what the bank really paid, when it is known. Both
-- figures are kept side by side, as rule 7 in CLAUDE.md requires, and `locked`
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
-- does carry `valid_to`.
--
-- The two real cases this has to express:
--   * Rappi card: a percentage of any purchase, but only while Rappi cuenta
--     holds at least 500,000 - `requires_account_id` + `requires_balance_minor`.
--   * Plata: a percentage on specific categories only - `category_id`.
CREATE TABLE cashback_rules (
  id                     INTEGER PRIMARY KEY,

  -- The account that earns the cashback (usually the card itself).
  account_id             INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name                   TEXT    NOT NULL,

  valid_from             TEXT    NOT NULL CHECK (valid_from GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  valid_to               TEXT    CHECK (valid_to IS NULL OR valid_to GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),

  -- A fraction scaled by 1,000,000, exactly like `yield_rates`: 1% is 10000.
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
-- `source_transaction_id` is the link Monefy never had. Deleting the purchase
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
-- to pay the income-tax return. `transaction_id` points at the income movement
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
-- flagged `withholding_unknown`, which the screen shows plainly. Being visibly
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
