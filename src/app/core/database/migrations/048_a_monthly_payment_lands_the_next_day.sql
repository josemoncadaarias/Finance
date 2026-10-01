-- Migration 048 - a monthly payment is paid the day after its period, and its
-- date can be corrected
--
-- Jose, 2026-09-30: a product paid every month is paid on the FIRST day of
-- the next month. The last day of the month still earns - the month is not
-- over until it ends - so every day of the month is in the payment, and the
-- money arrives the day after. The app said the payment was made on the last
-- day itself.
--
-- Nothing in the money moves with it. The payment used to land at the close
-- of the last day; now it lands at the start of the first day of the next
-- one, which is the same moment, so the next month still earns on it from its
-- first day. Only the date the screens say changes.
--
-- And the bank does not always pay on the 1st: some pay on the 5th or the
-- 6th, for exactly the same days. That date is the person's to correct,
-- kept here by the payment's own day (`due_on`, the day the app works out)
-- so the engine writes it on every day of that payment it works out again.
-- A CDT is paid on the day it matures and is left as it was.

CREATE TABLE yield_payments (
  product_id  INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  account_id  INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  component   TEXT    NOT NULL,
  -- The day the app works the payment out to be made.
  due_on      TEXT    NOT NULL CHECK (due_on GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  -- The day the bank actually made it.
  paid_on     TEXT    NOT NULL CHECK (paid_on GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  created_at  TEXT    NOT NULL,
  updated_at  TEXT    NOT NULL,
  PRIMARY KEY (product_id, component, due_on)
);

CREATE INDEX idx_yield_payments_account ON yield_payments(account_id);

-- The days already worked out move to the new payday: every monthly payment
-- that said "the last day of the month" says the day after.
UPDATE yield_days
SET paid_on = date(paid_on, '+1 day')
WHERE payout = 'monthly'
  AND paid_on IS NOT NULL
  AND paid_on = date(paid_on, 'start of month', '+1 month', '-1 day')
  AND product_id NOT IN (SELECT id FROM products WHERE kind = 'cdt');
