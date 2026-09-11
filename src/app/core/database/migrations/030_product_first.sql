-- Migration 030 - the product is the parent: it has the rate and the payout
--
-- Until now a rate could belong to a whole account, and every product of that
-- account without a rate of its own used it. How often a rate paid lived on the
-- rate. Jose set out the model the screens should follow on 2026-09-11: a
-- product is what a person opens, and a product has a rate, a way of being
-- paid, and - for a CDT - a term.
--
-- Three changes, none of which changes a figure already worked out:
--
-- 1. How a product is paid moves onto the product. `payout` and
--    `payout_months` are copied from the product's own rates, which already
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
