-- Migration 012 - Plata earns on the balance the bank shows
--
-- Plata's ledger says 200,000.00 because the yields it has been paid were
-- never recorded as movements. The bank says 200,057.44, and that is what is
-- earning. For every other account the ledger is close enough to the truth
-- that following it is right; for this one it is not.
--
-- So Plata's pocket stops following the ledger and carries the figure Jose
-- read off the app, dated the day he read it. Exactly like Dale's alcancias.
--
-- The opening cushion of 57.44 stays as it is: it is the record of what the
-- account had earned, and from migration 011 onwards a record is all it is.
-- It is not added to the base - which is the whole point of that change.

UPDATE yield_pockets
SET source = 'manual', updated_at = '2026-09-11T00:00:00Z'
WHERE account_id = (SELECT id FROM accounts WHERE name = 'Plata');

INSERT INTO yield_pocket_balances (pocket_id, valid_from, amount_minor, note, created_at, updated_at)
SELECT id, '2026-09-09', 20005744, 'Read off the Plata app on 2026-09-09',
       '2026-09-11T00:00:00Z', '2026-09-11T00:00:00Z'
FROM yield_pockets
WHERE account_id = (SELECT id FROM accounts WHERE name = 'Plata');
