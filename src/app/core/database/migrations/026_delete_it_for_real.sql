-- Migration 026 - delete it, matching on as little as possible
--
-- Three migrations have not removed this account. 025 found the reason the
-- first two failed - an account with movements cannot be deleted, because
-- `transactions.account_id` is ON DELETE RESTRICT - and still did not work,
-- which leaves only one candidate: the name.
--
-- Every attempt so far compared the name to a string. The name on screen is
-- "Tarjeta crédito rappi", and a string comparison against that can fail for
-- reasons nothing on screen shows: a trailing space, an accent stored as a
-- combining mark rather than as one character, a different case. SQLite's
-- `lower()` does not touch accented letters either, so folding does not help.
--
-- So this matches on the parts that cannot vary. "arjeta" skips the capital,
-- "rappi" is plain, and the wildcards absorb the accent, any spacing and
-- anything on either end. The account it must not touch is called "Rappi
-- Card", which contains no "arjeta" at all.
--
-- The order is the one 025 established, and it is not optional: empty the
-- account first, then delete it.

UPDATE transactions
SET account_id = (
      SELECT other.id FROM accounts other
      WHERE other.name NOT LIKE '%arjeta%rappi%' AND other.type = 'credit'
      ORDER BY (SELECT COUNT(*) FROM transactions t WHERE t.account_id = other.id) DESC
      LIMIT 1
    ),
    updated_at = '2026-09-11T00:00:00Z'
WHERE account_id IN (SELECT id FROM accounts WHERE name LIKE '%arjeta%rappi%')
  AND EXISTS (
    SELECT 1 FROM accounts other
    WHERE other.name NOT LIKE '%arjeta%rappi%' AND other.type = 'credit'
  );

INSERT INTO deleted_imports (import_fingerprint, import_seq, deleted_at)
SELECT import_fingerprint, import_seq, '2026-09-11T00:00:00Z'
FROM transactions
WHERE account_id IN (SELECT id FROM accounts WHERE name LIKE '%arjeta%rappi%')
  AND import_fingerprint IS NOT NULL
ON CONFLICT(import_fingerprint, import_seq) DO NOTHING;

DELETE FROM transactions
WHERE account_id IN (SELECT id FROM accounts WHERE name LIKE '%arjeta%rappi%');

DELETE FROM accounts WHERE name LIKE '%arjeta%rappi%';
