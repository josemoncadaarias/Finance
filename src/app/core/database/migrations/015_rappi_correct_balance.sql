-- Migration 015 - Rappi cuenta starts at 67,030,497.39
--
-- The figure Jose stated on 2026-09-09. Migration 014 used 67,959,746.41,
-- which was the ledger balance, not what he said - the same mistake as 013,
-- which used 4,917,434.98 from a list that turned out to hold a different kind
-- of number for this account.
--
-- The mechanism is right: Plata was seeded with the figure he stated and comes
-- out correct. What has been wrong is the figures seeded for the other
-- thirteen accounts, which came from a list rather than from him saying "this
-- account earns on this".

UPDATE yield_pocket_balances
SET amount_minor = 6703049739,
    note = 'Stated by Jose on 2026-09-09',
    updated_at = '2026-09-11T00:00:00Z'
WHERE valid_from = '2026-09-09'
  AND pocket_id IN (
    SELECT p.id FROM yield_pockets p
    JOIN accounts a ON a.id = p.account_id
    WHERE a.name = 'Rappi cuenta'
  );
