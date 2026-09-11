-- Migration 031 - whether a product is withheld is the product's own answer
--
-- Withholding was one switch per account. Jose, 2026-09-11: inside one account
-- some products are withheld and others are not, so the switch belongs to the
-- product. A product that is not withheld has nothing at all taken from its
-- yield.
--
-- Every product starts with the answer its account has today, so no figure
-- already worked out changes. Only the column is added and filled.

ALTER TABLE yield_pockets ADD COLUMN withholding INTEGER NOT NULL DEFAULT 1
  CHECK (withholding IN (0, 1));

UPDATE yield_pockets
   SET withholding = (SELECT ya.withholding FROM yield_accounts ya WHERE ya.account_id = yield_pockets.account_id)
 WHERE EXISTS (SELECT 1 FROM yield_accounts ya WHERE ya.account_id = yield_pockets.account_id);
