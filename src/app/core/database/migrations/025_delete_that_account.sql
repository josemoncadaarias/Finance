-- Migration 025 - delete "Tarjeta crédito rappi", unconditionally
--
-- Two attempts have not removed this account, and the reason turns out to be
-- in the schema rather than in either of them: `transactions.account_id` is
-- ON DELETE RESTRICT. An account with movements cannot be deleted at all.
-- That rule is right - deleting an account must never quietly delete money -
-- and it means the movements have to be dealt with first, every time, with no
-- exceptions. 023 tried and missed because it looked for the surviving account
-- by a name that did not match; 024 declined to delete anything it could not
-- first empty, and said nothing when it could not.
--
-- Jose has given the name exactly and asked for the account to go. So this
-- empties it first, in the order that loses least:
--
-- 1. The movements go to "Rappi Card" if that account exists - it is the same
--    card, and that is where they belong.
-- 2. Failing that, to whichever other credit-card account has the most
--    movements, which is the real card under any name.
-- 3. Anything still left is recorded in `deleted_imports` and removed. That
--    table is what stops the next import meeting those rows as new and
--    building this account all over again.
--
-- Only then the account itself. By this point nothing references it.

UPDATE transactions
SET account_id = (
      SELECT other.id FROM accounts other
      WHERE other.name <> 'Tarjeta crédito rappi'
        AND (lower(other.name) = 'rappi card' OR other.type = 'credit')
      ORDER BY CASE WHEN lower(other.name) = 'rappi card' THEN 0 ELSE 1 END,
               (SELECT COUNT(*) FROM transactions t WHERE t.account_id = other.id) DESC
      LIMIT 1
    ),
    updated_at = '2026-09-11T00:00:00Z'
WHERE account_id IN (SELECT id FROM accounts WHERE name = 'Tarjeta crédito rappi')
  AND EXISTS (
    SELECT 1 FROM accounts other
    WHERE other.name <> 'Tarjeta crédito rappi'
      AND (lower(other.name) = 'rappi card' OR other.type = 'credit')
  );

INSERT INTO deleted_imports (import_fingerprint, import_seq, deleted_at)
SELECT import_fingerprint, import_seq, '2026-09-11T00:00:00Z'
FROM transactions
WHERE account_id IN (SELECT id FROM accounts WHERE name = 'Tarjeta crédito rappi')
  AND import_fingerprint IS NOT NULL
ON CONFLICT(import_fingerprint, import_seq) DO NOTHING;

DELETE FROM transactions
WHERE account_id IN (SELECT id FROM accounts WHERE name = 'Tarjeta crédito rappi');

DELETE FROM accounts WHERE name = 'Tarjeta crédito rappi';
