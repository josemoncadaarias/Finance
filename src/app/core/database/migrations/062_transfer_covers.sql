-- Migration 062 - a move between products that covered a movement
--
-- Jose, 2026-10-29 (mockups 50a-50h): a spending leaves the account's usual
-- product, often at 0, and he then moves the same money in from a pocket by
-- hand. The movement form now does both in one save: the movement, and an
-- ordinary move between the account's products for what was missing. This
-- column ties that move to the movement it covered, so the list can say
-- "Cubierto con {bolsillo}" and deleting the movement takes the move with it.
--
-- No foreign key on purpose: a backup restores transfers before the
-- movements they point at. A pointer to a movement that is gone means
-- nothing and is ignored.

ALTER TABLE transfers ADD COLUMN covers_transaction_id INTEGER;
CREATE INDEX idx_transfers_covers ON transfers (covers_transaction_id) WHERE covers_transaction_id IS NOT NULL;
