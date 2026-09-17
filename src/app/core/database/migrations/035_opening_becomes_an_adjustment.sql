-- Migration 035 - the opening cushion becomes an ordinary adjustment
--
-- `yield_accounts.opening_cushion_minor` held what an account had already
-- earned before this app existed: the gap between what the bank shows and what
-- the ledger adds up to. It was counted in the cushion total and deliberately
-- left OUT of the base the interest is worked out on, on the reasoning that
-- the money was already inside the account balance.
--
-- It is not. Jose checked his banks on 2026-09-17: the app shows a HIGHER
-- figure than the products add up to, and the difference is exactly this - the
-- yields he had never recorded. That money is sitting in the bank earning, so
-- leaving it out of the base was undercounting every account. The note he left
-- on Plata says it outright: "200,057.44 was the balance the bank shows, not
-- the yield inside it" - the app was accruing on 200,000.
--
-- An adjustment is the same figure with none of that ambiguity: it counts in
-- the total AND in the base, which is what this always meant. So each opening
-- figure becomes one, dated the day it was measured, and the column is left at
-- zero rather than dropped - migrations are history, and a backup written
-- before today still carries it.
--
-- The cushion total does not move: it was opening + adjustments before and it
-- is adjustments alone now. What changes is that these figures start earning,
-- which is the correction.

INSERT INTO cushion_adjustments
  (account_id, source, kind, pocket_id, on_date, amount_minor, note, created_at, updated_at)
SELECT
  account_id,
  'yield',
  'correction',
  NULL,
  opening_on,
  opening_cushion_minor,
  'Rendimientos que el banco ya había pagado y no estaban en el histórico',
  created_at,
  updated_at
FROM yield_accounts
WHERE opening_cushion_minor <> 0;

UPDATE yield_accounts SET opening_cushion_minor = 0 WHERE opening_cushion_minor <> 0;
