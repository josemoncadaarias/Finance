-- Migration 053 - spending limits (plans, part 3, step 1; Jose, 2026-10-01)
--
-- A limit is a figure in pesos for what may be spent on one or several
-- categories each month, on every account or on one. It renews by itself:
-- nothing is stored per month. What was spent is worked out every time from
-- the movements, with the same rule as the summary (totalsOf: expenses less
-- refunds, transfers never), so a limit and the donut cannot disagree.
--
-- `period` is 'month' only; the column is there so a week or a year is one
-- value more and never a new table.

CREATE TABLE spending_limits (
  id            INTEGER PRIMARY KEY,
  amount_minor  INTEGER NOT NULL CHECK (typeof(amount_minor) = 'integer' AND amount_minor > 0),
  period        TEXT    NOT NULL DEFAULT 'month' CHECK (period IN ('month')),
  -- Null: every account (those counted in net worth). Otherwise that one.
  account_id    INTEGER REFERENCES accounts(id) ON DELETE CASCADE,
  -- A phone notice when 80 % of it is spent.
  warn_at_80    INTEGER NOT NULL DEFAULT 1 CHECK (warn_at_80 IN (0, 1)),
  created_at    TEXT    NOT NULL,
  updated_at    TEXT    NOT NULL
);

-- The categories a limit covers. A category belongs to one limit at most, so
-- the total of every limit never counts a peso twice.
CREATE TABLE spending_limit_categories (
  limit_id     INTEGER NOT NULL REFERENCES spending_limits(id) ON DELETE CASCADE,
  category_id  INTEGER NOT NULL UNIQUE REFERENCES categories(id) ON DELETE CASCADE,
  PRIMARY KEY (limit_id, category_id)
);
