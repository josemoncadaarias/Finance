-- Migration 011 - a rate can be several parts, paid at different times
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
--   * `payout` moves from the account to the component. Uala is not a daily
--     account or a monthly one; it is both at once.
--   * a day belongs to a pocket AND a component, so `yield_days` is keyed by
--     all three. The withholding threshold is measured per payment, and two
--     components are two payments.
--
-- Also here: `yield_excluded_balances` is dropped. It described part of a
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
-- `yield_accounts.payout` after this migration.

UPDATE yield_accounts SET payout = 'daily';
