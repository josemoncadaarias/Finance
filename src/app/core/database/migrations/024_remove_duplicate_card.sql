-- Migration 024 - remove the duplicate credit card, without guessing a name
--
-- Migration 023 merged the account the importer created under the old name
-- into the one Jose had renamed, and it found the second one by matching
-- `lower(name) = 'rappi card'`. That is a guess about how a name is spelled,
-- and it did not hold: the duplicate is still there.
--
-- This one does not guess. The duplicate is the account the BACKUP names,
-- which is a fact: it is the name in the file. What it merges into is "the
-- other credit-card account with the most movements", which needs no name at
-- all - the account Jose has been using for years has thousands of rows, and
-- the one created by accident has one.
--
-- The movement is moved rather than deleted. Deleting it would take its import
-- fingerprint with it, and the next import would meet that row as new, create
-- the account again, and put it back - the same loop this is here to end.
--
-- Every statement is a no-op when there is no duplicate, so this does nothing
-- at all if 023 already worked, and nothing on anybody else's database.

UPDATE transactions
SET account_id = (
      SELECT other.id FROM accounts other
      WHERE other.type = 'credit'
        AND other.id <> (SELECT id FROM accounts WHERE lower(name) LIKE 'tarjeta cr%dito rappi')
      ORDER BY (SELECT COUNT(*) FROM transactions t WHERE t.account_id = other.id) DESC
      LIMIT 1
    ),
    updated_at = '2026-09-11T00:00:00Z'
WHERE account_id = (SELECT id FROM accounts WHERE lower(name) LIKE 'tarjeta cr%dito rappi')
  AND EXISTS (
    SELECT 1 FROM accounts other
    WHERE other.type = 'credit'
      AND other.id <> (SELECT id FROM accounts WHERE lower(name) LIKE 'tarjeta cr%dito rappi')
  );

UPDATE credit_limit_changes
SET account_id = (
      SELECT other.id FROM accounts other
      WHERE other.type = 'credit'
        AND other.id <> (SELECT id FROM accounts WHERE lower(name) LIKE 'tarjeta cr%dito rappi')
      ORDER BY (SELECT COUNT(*) FROM transactions t WHERE t.account_id = other.id) DESC
      LIMIT 1
    )
WHERE account_id = (SELECT id FROM accounts WHERE lower(name) LIKE 'tarjeta cr%dito rappi')
  AND EXISTS (
    SELECT 1 FROM accounts other
    WHERE other.type = 'credit'
      AND other.id <> (SELECT id FROM accounts WHERE lower(name) LIKE 'tarjeta cr%dito rappi')
  )
  AND NOT EXISTS (
    SELECT 1 FROM credit_limit_changes taken
    WHERE taken.effective_on = credit_limit_changes.effective_on
      AND taken.account_id = (
        SELECT other.id FROM accounts other
        WHERE other.type = 'credit'
          AND other.id <> (SELECT id FROM accounts WHERE lower(name) LIKE 'tarjeta cr%dito rappi')
        ORDER BY (SELECT COUNT(*) FROM transactions t WHERE t.account_id = other.id) DESC
        LIMIT 1
      )
  );

-- The name the backup uses, recorded against the account that survives, so the
-- next import knows where those rows go and never makes this account again.
INSERT INTO account_aliases (source_name, account_id, note, created_at, updated_at)
SELECT 'Tarjeta crédito rappi', other.id, 'Duplicate merged by migration 024',
       '2026-09-11T00:00:00Z', '2026-09-11T00:00:00Z'
FROM accounts other
WHERE other.type = 'credit'
  AND other.id <> (SELECT id FROM accounts WHERE lower(name) LIKE 'tarjeta cr%dito rappi')
  AND EXISTS (SELECT 1 FROM accounts WHERE lower(name) LIKE 'tarjeta cr%dito rappi')
ORDER BY (SELECT COUNT(*) FROM transactions t WHERE t.account_id = other.id) DESC
LIMIT 1
ON CONFLICT(source_name) DO NOTHING;

-- And the empty account goes. Only once it is empty: without another credit
-- account to move its rows to, deleting it would take them with it.
DELETE FROM accounts
WHERE lower(name) LIKE 'tarjeta cr%dito rappi'
  AND NOT EXISTS (SELECT 1 FROM transactions WHERE account_id = accounts.id);
