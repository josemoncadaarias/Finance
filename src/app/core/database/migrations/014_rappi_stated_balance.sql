-- Migration 014 - Rappi cuenta earns on 67,959,746.41
--
-- Stated by Jose, repeatedly, and taken here as given. Migration 013 seeded it
-- with 4,917,434.98 because that was the figure in his list of 2026-09-09; it
-- is the wrong one for this account and he has said so plainly.

UPDATE yield_pocket_balances
SET amount_minor = 6795974641,
    note = 'Stated by Jose: this is what Rappi cuenta earns on',
    updated_at = '2026-09-11T00:00:00Z'
WHERE valid_from = '2026-09-09'
  AND pocket_id IN (
    SELECT p.id FROM yield_pockets p
    JOIN accounts a ON a.id = p.account_id
    WHERE a.name = 'Rappi cuenta'
  );
