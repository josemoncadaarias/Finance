-- Migration 056 - what a transfer between two accounts changes at each end
--
-- Jose, 2026-10-03. An account pays its yields into a product, and those
-- yields sit outside net worth until the person decides to count them
-- (rule 15). Moving part of them to another account used to be an ordinary
-- transfer, which took them out of the leaving account's balance - so net
-- worth went DOWN by money it never held. So each end of a transfer between
-- two different accounts, when that account has products, says what it
-- changes, with the answers an income or a spending already has
-- (`core/yields/entry-scope.ts`):
--
--   both      the product and the account's balance: a leg of the transfer,
--             as every transfer has always been.
--   netWorth  the account's balance only: the leg, plus its other half on the
--             product (an entry going back into it where money leaves, a
--             cash-out of what it gathered where money arrives), so the
--             product's figure does not move.
--   product   the product only: no leg at all - a `product_entries` row on
--             the product, tied to the transfer by `transfer_id` - so the
--             account's balance and net worth do not move at this end.
--
-- Every transfer already on record is `both` at both ends, which is exactly
-- what it was: nothing here changes a figure.

ALTER TABLE transfers ADD COLUMN from_scope TEXT NOT NULL DEFAULT 'both'
  CHECK (from_scope IN ('both', 'product', 'netWorth'));
ALTER TABLE transfers ADD COLUMN to_scope TEXT NOT NULL DEFAULT 'both'
  CHECK (to_scope IN ('both', 'product', 'netWorth'));

-- The end of a transfer that touches a product only. Deleting the transfer
-- takes it along.
ALTER TABLE product_entries ADD COLUMN transfer_id INTEGER REFERENCES transfers(id) ON DELETE CASCADE;
ALTER TABLE product_entries ADD COLUMN transfer_leg TEXT CHECK (transfer_leg IS NULL OR transfer_leg IN ('from', 'to'));

CREATE INDEX idx_product_entries_transfer ON product_entries(transfer_id);
