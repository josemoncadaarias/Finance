-- Migration 036 - undoes 035: the opening cushion goes back where it was
--
-- Migration 035 turned each account's opening cushion figure into an ordinary
-- adjustment, so that it would count in the base the interest is worked out
-- on. That was wrong, and Jose caught it the same night.
--
-- The reasoning was that the bank shows more than the products add up to, so
-- the difference must be money sitting there earning that the base was
-- missing. The bank does show more than the LEDGER - but every one of these
-- products carries a balance Jose typed after reading it off the bank, and
-- that figure already has the yields inside it. Uala's product says
-- 4,584,082.13, which is what his bank says; adding the 1,115,499.46 opening
-- figure on top made it earn on 5,699,581.59. He saw the daily yield jump
-- from the 10th to the 11th of September and asked where it came from.
--
-- So the opening figure is a RECORD after all, exactly as the engine said,
-- and the reason is narrower than either of us stated: it is not that the
-- money is in the ledger, it is that it is already inside the figure each
-- product states. Each row 035 wrote goes back to the account it came from
-- and is removed.
--
-- Matched by the note 035 gave them, so an adjustment Jose wrote himself is
-- never touched.

UPDATE yield_accounts
SET opening_cushion_minor = (
      SELECT amount_minor FROM cushion_adjustments
      WHERE cushion_adjustments.account_id = yield_accounts.account_id
        AND note = 'Rendimientos que el banco ya había pagado y no estaban en el histórico'
      ORDER BY id LIMIT 1),
    opening_on = (
      SELECT on_date FROM cushion_adjustments
      WHERE cushion_adjustments.account_id = yield_accounts.account_id
        AND note = 'Rendimientos que el banco ya había pagado y no estaban en el histórico'
      ORDER BY id LIMIT 1)
WHERE EXISTS (
  SELECT 1 FROM cushion_adjustments
  WHERE cushion_adjustments.account_id = yield_accounts.account_id
    AND note = 'Rendimientos que el banco ya había pagado y no estaban en el histórico');

DELETE FROM cushion_adjustments
WHERE note = 'Rendimientos que el banco ya había pagado y no estaban en el histórico';

-- Every day worked out under 035 was worked out on a base that was too big.
-- Dropping them makes the next run do them again, on the figure each product
-- really states. Days corrected by hand are left alone: those are readings
-- off a statement, not something this app worked out.
DELETE FROM yield_days WHERE locked = 0;
