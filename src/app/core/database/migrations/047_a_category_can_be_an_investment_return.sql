-- Migration 047 - a category can say it is what an investment earned or lost
--
-- Jose, 2026-09-24: the yields summary has to count accounts that are
-- investments without products - Fiducuenta and Multinversion - and in those
-- the return is not worked out by the app, it is written down: "subio
-- inversion" filed under Ganancia, "bajo inversion" under Perdida, some 1,600
-- of them since 2021. The summary cannot tell those from a deposit unless the
-- category says so, and it cannot go by the name: somebody else calls them
-- something else. So a category carries a flag, set by the person.
--
-- For Jose's own data, as he asked: Ganancia (income) and Perdida (expense)
-- are flagged. Nothing else is, and where those names do not exist nothing
-- happens.
--
-- And three movements move category. Fiducuenta and Multinversion each wrote
-- a "Dian" expense when the fund corrected the gain it had been showing -
-- "Ajuste fiducuenta impuesto renta acumulado" twice in 2026, "Ajuste
-- impuesto renta" once in 2023. Jose: it lowers the gain, though it was not a
-- loss of the investment as such, only a correction by the bank. So they go
-- to a category of their own, "Ajuste de ganancias", flagged as a return, and
-- his own tax payments from Bancolombia stay under Dian where they are.
-- Only the category changes: every amount, date and balance is untouched.

ALTER TABLE categories ADD COLUMN counts_as_return INTEGER NOT NULL DEFAULT 0
  CHECK (counts_as_return IN (0, 1));

UPDATE categories SET counts_as_return = 1
WHERE (name = 'Ganancia' AND kind = 'income')
   OR (name = 'Perdida' AND kind = 'expense');

INSERT INTO categories (name, kind, builtin_icon, color, counts_as_return, created_at, updated_at)
SELECT 'Ajuste de ganancias', 'expense', 'trending-down-outline', '#607D8B', 1,
       '2026-09-24T00:00:00Z', '2026-09-24T00:00:00Z'
WHERE EXISTS (
  SELECT 1 FROM transactions t
  JOIN accounts a ON a.id = t.account_id
  JOIN categories c ON c.id = t.category_id
  WHERE a.type = 'investment' AND c.name = 'Dian' AND c.kind = 'expense'
)
AND NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Ajuste de ganancias' AND kind = 'expense');

UPDATE transactions
SET category_id = (SELECT id FROM categories WHERE name = 'Ajuste de ganancias' AND kind = 'expense'),
    updated_at = '2026-09-24T00:00:00Z'
WHERE transfer_id IS NULL
  AND account_id IN (SELECT id FROM accounts WHERE type = 'investment')
  AND category_id IN (SELECT id FROM categories WHERE name = 'Dian' AND kind = 'expense');
