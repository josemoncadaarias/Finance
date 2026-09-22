-- Migration 039 - Plata's savings account never held anything overnight
--
-- Jose, 2026-09-22, having said it several times before I listened: the
-- savings account of Plata has always been a pass-through. Money arrives
-- there and goes straight to the Bolsillo, which is the product that earns.
-- He set its balance to 0 from a date before the account existed, and 0 is
-- what it has always been.
--
-- What the app had instead: 200,000 sitting in that savings account from the
-- 8th to the 18th of September, earning 6.5% a year. It got there like this.
--
--   * Before a movement could name a product, "names no product" was read as
--     "the usual one". Plata's products were only created on the 10th, so
--     everything before that named none.
--   * On the 19th he made Cuenta Ahorros the usual product, and every one of
--     those movements silently moved into it.
--   * Migration 038 then wrote that reading down. It was right that it moved
--     no figures - but the figures it froze were already wrong.
--
-- The transfer of 200,000 into Plata on the 8th therefore landed in the
-- savings account and, as far as the app could see, stayed there for ten
-- days. It had gone to the Bolsillo the same day; there was simply no
-- record of products yet to say so.
--
-- So every movement of Plata goes to the Bolsillo. The internal transfers
-- between the two products end up with both legs in one product and cancel,
-- which is correct: they never left it. Afterwards
--
--   Cuenta Ahorros = 0.00   (its stated 0, and nothing moved through it)
--   Bolsillo       = 300,001.03
--
-- and 300,001.03 is the balance of the account, so nothing was invented and
-- nothing was lost. Only where the money earns changes: 11% in the Bolsillo
-- instead of 6.5% in a savings account that was empty.
--
-- By name, and a no-op if the names have changed since. A repair is a
-- migration and not a button: a button to fix one day's mistake is a button
-- left on the screen for ever, for whoever finds it next to wonder about.

UPDATE transactions
SET pocket_id = (
  SELECT p.id FROM yield_pockets p
  JOIN accounts a ON a.id = p.account_id
  WHERE a.name = 'Plata' AND p.name = 'Bolsillo')
WHERE pocket_id IN (
  SELECT p.id FROM yield_pockets p
  JOIN accounts a ON a.id = p.account_id
  WHERE a.name = 'Plata' AND p.name = 'Cuenta Ahorros')
AND EXISTS (
  SELECT 1 FROM yield_pockets p
  JOIN accounts a ON a.id = p.account_id
  WHERE a.name = 'Plata' AND p.name = 'Bolsillo');

-- Every day of Plata was worked out on balances that have just changed, so
-- they go and the engine writes them again on the next pass. None of them had
-- been corrected by hand, so nothing typed is being thrown away.
DELETE FROM yield_days
WHERE account_id IN (SELECT id FROM accounts WHERE name = 'Plata')
  AND locked = 0;

-- And the fingerprint that says the accrual is already done for today, or
-- opening the app would find nothing to redo and leave Plata empty of days.
DELETE FROM settings WHERE key = 'yields.accrual.mark';
