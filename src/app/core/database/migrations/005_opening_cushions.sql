-- Migration 005 - the opening cushions and rates, measured on 2026-09-09
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
