-- Migration 032 - an entry into a product can say which movement it belongs to
--
-- Cashing in with an expense is two writes: a movement out of the account, and
-- the same amount into what the product gathered, so the product balance does
-- not move. Withdrawals already carried the movement they belong to; entries
-- did not, so the two halves of such an expense could not be corrected or
-- deleted together. This adds that link. Entries already stored have none,
-- which is what they are: entries on the product alone.

ALTER TABLE cushion_adjustments ADD COLUMN transaction_id INTEGER
  REFERENCES transactions(id) ON DELETE SET NULL;

CREATE INDEX idx_cushion_adjustments_transaction ON cushion_adjustments(transaction_id);
