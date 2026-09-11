-- Migration 022 - the user says which product is the default, not the name
--
-- Money arriving in an account has to land somewhere, and until now the app
-- decided where by matching the product's name against "Cuenta de ahorros" or
-- "Savings account". That works exactly until someone renames one, and it
-- writes into the code a decision that belongs to the person using it: which
-- of their own products is the usual one.
--
-- So it is a flag on the product instead. A new account gets one product and
-- that product is the default; splitting an account up does not change which
-- one is usual unless the user says so.
--
-- The partial unique index is what keeps it honest: at most one default per
-- account. SQLite treats NULLs as distinct, so `is_default` is 1 or NULL
-- rather than 1 or 0 - a column of zeroes would collide with itself.

ALTER TABLE yield_pockets ADD COLUMN is_default INTEGER CHECK (is_default IS NULL OR is_default = 1);

CREATE UNIQUE INDEX idx_yield_pockets_default
  ON yield_pockets(account_id) WHERE is_default = 1;

-- What is true today: every account's savings product is its usual one. The
-- name is used here and only here - as a one-off reading of what Jose has
-- already set up, not as a rule the app goes on applying.
UPDATE yield_pockets
SET is_default = 1, updated_at = '2026-09-11T00:00:00Z'
WHERE lower(name) IN ('cuenta de ahorros', 'savings account');

-- And an account with no product by that name keeps its first as the usual
-- one, so every account has an answer.
UPDATE yield_pockets
SET is_default = 1, updated_at = '2026-09-11T00:00:00Z'
WHERE id IN (
  SELECT MIN(p.id) FROM yield_pockets p
  WHERE NOT EXISTS (
    SELECT 1 FROM yield_pockets d WHERE d.account_id = p.account_id AND d.is_default = 1
  )
  GROUP BY p.account_id
);
