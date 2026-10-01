-- Migration 049 - a credit card's cut-off day and the day it is paid by
--
-- Jose, 2026-10-01 (debts, part 1). A card closes its statement on one day of
-- the month and wants it paid by another; with those two days the app can say
-- what the last statement holds, what is left of it and until when, out of
-- the card's own movements. Both are optional: a card without them works
-- exactly as before.
--
-- A day past the end of a short month means that month's last day (a cut-off
-- on the 31st closes on 30 September), worked out by the app, not stored.

ALTER TABLE accounts ADD COLUMN statement_day INTEGER
  CHECK (statement_day IS NULL OR statement_day BETWEEN 1 AND 31);
ALTER TABLE accounts ADD COLUMN due_day INTEGER
  CHECK (due_day IS NULL OR due_day BETWEEN 1 AND 31);
