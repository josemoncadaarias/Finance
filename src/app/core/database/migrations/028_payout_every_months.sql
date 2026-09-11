-- Migration 028 - a monthly payout can cover several months
--
-- Some products hand their yield over every two, six, twelve or twenty-four
-- months rather than every month: a CDT that pays at the end of each semester,
-- a savings product that pays once a year. Until now a monthly component could
-- only be paid at the end of every calendar month.
--
-- `payout_months` is how many months each payment covers. It only means
-- anything for a monthly component, and it defaults to 1, so every rate that
-- exists today keeps paying exactly as it did. The months are counted from the
-- month the rate starts in: a rate from 2026-07-01 paid every 3 months pays at
-- the end of September, then December, then March.
--
-- `paid_on` is written on each day worked out: the day that day's yield is
-- handed over. With several months to a payment a day can no longer say that
-- on its own, because it depends on when the rate started. Days written before
-- this migration leave it empty and keep the rule they were computed under - a
-- daily day is paid that day, a monthly one at the end of its month.
--
-- Only columns are added. No existing row is changed.

ALTER TABLE yield_rates ADD COLUMN payout_months INTEGER NOT NULL DEFAULT 1
  CHECK (typeof(payout_months) = 'integer' AND payout_months >= 1);

ALTER TABLE yield_days ADD COLUMN paid_on TEXT
  CHECK (paid_on IS NULL OR paid_on GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]');
