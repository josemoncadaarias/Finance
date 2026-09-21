-- Migration 038 - a movement says which product it went to
--
-- A movement in an account with one product names no product: there is
-- nothing to choose, and the one product holds everything. That stays true
-- until a second product is added - and from then on those movements follow
-- whichever product is the usual one, because "names no product" is read as
-- "the usual one". Change the usual and the money appears to move.
--
-- Jose hit it on 2026-09-21: he made Cuenta Ahorros the usual product of
-- Plata and 200,000 pesos left Bolsillo. His question was the right one - the
-- movement went to Bolsillo the day it was saved, so it should say Bolsillo
-- and stay there whatever becomes usual later. Nothing had ever written it
-- down. In his data it is one movement in Plata and ten in Pibank, the ten
-- adding up to 9,544,588.
--
-- Each of them is given the product that holds it TODAY - the usual one, or
-- the first where none is usual, which is exactly the rule that reads them
-- now. So this migration moves nothing: every figure after it is the figure
-- before it. What it changes is that the figures stop depending on a flag
-- that can be flipped, and a movement that really belonged elsewhere can now
-- be corrected one at a time, like any other.
--
-- Only accounts with more than one product. With one, naming it would say
-- nothing that is not already true, and a second product added later writes
-- them itself from now on (`addPocket`).
--
-- Movements only. The entries of the cushion have their own rule for which
-- product holds an unnamed one - the product that follows the account
-- balance, not the usual one - so naming them by this rule could move money
-- between products, which is the thing this migration exists to stop.

UPDATE transactions
SET pocket_id = (
  SELECT p.id FROM yield_pockets p
  WHERE p.account_id = transactions.account_id
  ORDER BY CASE WHEN p.is_default = 1 THEN 0 ELSE 1 END, p.sort_order, p.id
  LIMIT 1)
WHERE pocket_id IS NULL
  AND account_id IN (
    SELECT account_id FROM yield_pockets GROUP BY account_id HAVING COUNT(*) > 1);
