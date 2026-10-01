-- Migration 054 - goals (plans, part 3, step 2; Jose, 2026-10-01)
--
-- A goal is a figure in pesos, an optional month to reach it by, and the
-- places where its money actually sits: one or several accounts or products,
-- or every account. Its progress IS what those places hold - nothing about
-- the money is stored here, so nothing can be counted twice or drift from the
-- ledger. Mockups `15a`-`15m`.
--
-- An emergency fund is a goal whose figure was worked out as so many months
-- of what the person really spends (`months`); the figure is stored, and the
-- goal's page offers to bring it up to date when the spending changes.

CREATE TABLE goals (
  id            INTEGER PRIMARY KEY,
  name          TEXT    NOT NULL,
  builtin_icon  TEXT    NOT NULL DEFAULT 'flag-outline',
  color         TEXT,
  amount_minor  INTEGER NOT NULL CHECK (typeof(amount_minor) = 'integer' AND amount_minor > 0),
  -- 'YYYY-MM', or null for a goal with no date.
  due_month     TEXT    CHECK (due_month IS NULL OR due_month GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]'),
  kind          TEXT    NOT NULL DEFAULT 'custom' CHECK (kind IN ('custom', 'emergency')),
  months        INTEGER CHECK (months IS NULL OR months > 0),
  -- Every account counted in net worth, less what other goals hold.
  all_accounts  INTEGER NOT NULL DEFAULT 0 CHECK (all_accounts IN (0, 1)),
  started_on    TEXT    NOT NULL,
  -- The day it was first reached; a goal reached stays reached.
  reached_on    TEXT,
  archived      INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0, 1)),
  created_at    TEXT    NOT NULL,
  updated_at    TEXT    NOT NULL
);

-- Where a goal's money sits. A whole account (product_id null) or one of its
-- products. `counts` 'from_start' takes only what came in after the place was
-- added: `start_minor` is what it held then, in the account's currency.
CREATE TABLE goal_places (
  id           INTEGER PRIMARY KEY,
  goal_id      INTEGER NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  account_id   INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  product_id   INTEGER REFERENCES products(id) ON DELETE CASCADE,
  counts       TEXT    NOT NULL DEFAULT 'all' CHECK (counts IN ('all', 'from_start')),
  start_minor  INTEGER NOT NULL DEFAULT 0 CHECK (typeof(start_minor) = 'integer')
);

-- A place belongs to one goal at most, so no peso counts in two goals.
CREATE UNIQUE INDEX goal_places_one_goal ON goal_places (account_id, IFNULL(product_id, 0));
CREATE INDEX goal_places_goal ON goal_places (goal_id);
