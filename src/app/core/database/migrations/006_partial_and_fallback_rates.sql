-- Migration 006 - what happens when a condition is missed, and when only part
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
-- return leans on it - that is what the `source` and `note` columns are for,
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
