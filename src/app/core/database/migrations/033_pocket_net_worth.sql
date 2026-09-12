-- Migration 033 - a product can sit outside net worth
--
-- Jose, 2026-09-12: the CDTs that hold the money for the income tax live inside
-- Pibank, next to the savings he spends from. That money is already spoken
-- for, so it must not count as his: not in net worth, and not in Pibank's
-- balance on the summary or the accounts screen. Until now the only way to say
-- so was a whole account ("Pibank para renta"), which is not how the bank has it.
--
-- The switch belongs to the product. Leaving one out takes its own movements
-- off the account's balance and off net worth; the transfer that fed it then
-- reads as money leaving. The usual product always counts, because a movement
-- that names no product lands in it.
--
-- Every product starts counted, so no balance and no net worth changes here.

ALTER TABLE yield_pockets ADD COLUMN include_in_net_worth INTEGER NOT NULL DEFAULT 1
  CHECK (include_in_net_worth IN (0, 1));
