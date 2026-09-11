-- Migration 023 - a renamed account is still the same account
--
-- The importer finds an account by the exact name the backup carries. Rename
-- one inside this app and the next import stops recognising it: Jose renamed
-- "Tarjeta credito rappi" to "Rappi Card", and the following import created a
-- second account under the old name and put one movement in it.
--
-- Renaming is a normal thing to do, so this is a hole rather than a mistake.
-- The fix is to let an account remember what a backup calls it, which is
-- exactly the relationship the importer needs and the only one it was missing.
--
-- ON DELETE CASCADE: an alias with no account is a name pointing at nothing,
-- and would send the next import to a row that is gone.

CREATE TABLE account_aliases (
  source_name TEXT    PRIMARY KEY,
  account_id  INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  note        TEXT,
  created_at  TEXT    NOT NULL,
  updated_at  TEXT    NOT NULL
);

CREATE INDEX idx_account_aliases_account ON account_aliases(account_id);

-- Now the duplicate itself. Everything in it moves to the account it should
-- have gone to, and the empty shell goes.
--
-- Every statement checks both accounts exist, so on a database where the names
-- are different - anyone's but Jose's - the whole of this does nothing.

UPDATE transactions
SET account_id = (SELECT id FROM accounts WHERE lower(name) = 'rappi card'),
    updated_at = '2026-09-11T00:00:00Z'
WHERE account_id = (SELECT id FROM accounts WHERE lower(name) LIKE 'tarjeta cr%dito rappi')
  AND EXISTS (SELECT 1 FROM accounts WHERE lower(name) = 'rappi card');

UPDATE credit_limit_changes
SET account_id = (SELECT id FROM accounts WHERE lower(name) = 'rappi card')
WHERE account_id = (SELECT id FROM accounts WHERE lower(name) LIKE 'tarjeta cr%dito rappi')
  AND EXISTS (SELECT 1 FROM accounts WHERE lower(name) = 'rappi card')
  AND NOT EXISTS (
    SELECT 1 FROM credit_limit_changes other
    WHERE other.account_id = (SELECT id FROM accounts WHERE lower(name) = 'rappi card')
      AND other.effective_on = credit_limit_changes.effective_on
  );

DELETE FROM accounts
WHERE lower(name) LIKE 'tarjeta cr%dito rappi'
  AND EXISTS (SELECT 1 FROM accounts WHERE lower(name) = 'rappi card');

-- And the name the backup uses, so the next import knows where it goes.
INSERT INTO account_aliases (source_name, account_id, note, created_at, updated_at)
SELECT 'Tarjeta crédito rappi', id, 'Renamed to Rappi Card', '2026-09-11T00:00:00Z', '2026-09-11T00:00:00Z'
FROM accounts WHERE lower(name) = 'rappi card';
