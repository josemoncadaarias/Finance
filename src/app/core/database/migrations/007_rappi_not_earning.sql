-- Migration 007 - the part of Rappi cuenta that is not earning
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
