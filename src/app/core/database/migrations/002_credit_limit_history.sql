-- Credit limits change, and the old ones are worth keeping.
--
-- `accounts.credit_limit_minor` answers "what is the limit today", which is
-- what available credit is computed from. It cannot answer "what was it in
-- March", and the answer stops existing the moment it is overwritten. The
-- backup already carries three of these for the Rappi card (800,000 at
-- opening, then +200,000 and +100,000), logged as deposits because Monefy had
-- nowhere else to put them, which is exactly how a limit increase ended up
-- being read as money arriving.
--
-- A limit change is not a transaction: no money moves, the debt does not
-- change, only how much room is left. So it lives in its own table and never
-- touches the ledger.

CREATE TABLE credit_limit_changes (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id     INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,

  -- The limit as of `effective_on`, not the size of the change. Storing the
  -- resulting limit means reading history back never depends on replaying
  -- every earlier row in order, and a wrong row cannot corrupt the ones after
  -- it.
  limit_minor    INTEGER NOT NULL CHECK (typeof(limit_minor) = 'integer' AND limit_minor >= 0),

  effective_on   TEXT    NOT NULL CHECK (effective_on GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  note           TEXT,

  -- 'import' came from the backup, 'manual' was entered by hand. A re-import
  -- must not duplicate what it already created, and must not touch what the
  -- user typed.
  source         TEXT    NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'import')),
  created_at     TEXT    NOT NULL
);

-- One limit per account per day: a second change on the same date replaces the
-- first rather than leaving two answers to the same question.
CREATE UNIQUE INDEX idx_credit_limit_changes_day
  ON credit_limit_changes(account_id, effective_on);
