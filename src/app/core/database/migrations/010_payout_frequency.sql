-- Migration 010 - how often the bank actually pays, and one figure corrected
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
