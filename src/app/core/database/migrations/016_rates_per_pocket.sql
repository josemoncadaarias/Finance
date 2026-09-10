-- Migration 016 - a rate can belong to one pocket
--
-- A bank can pay differently inside one account: a pocket called "cuenta
-- ahorros" at one rate and one called "Principal" at another. Until now a rate
-- belonged to the account and every pocket earned at all of them, which is
-- right for the common case and wrong for that one.
--
-- So `pocket_id` becomes optional on a rate:
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
