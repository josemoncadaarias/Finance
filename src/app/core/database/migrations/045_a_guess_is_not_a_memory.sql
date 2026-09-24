-- Migration 045 - a category the app guessed is not a category it remembered
--
-- Jose, 2026-09-23: "con todas estas categorias por defecto que ya hay,
-- podrias ayudarle a clasificarla mejor?". On a phone that has been used the
-- dictionary answers, because it has seen the same supermarket forty times.
-- On the first import of a brand-new install it knows nothing, and every one
-- of fifty lines is asked about one by one - which is exactly the tiredness
-- that makes a person accept the lot without reading it.
--
-- So a small list of ordinary words - supermercado, farmacia, peaje, nomina -
-- fills in what it safely can. That is a GUESS from a word, not a memory of
-- what this person does, and the screen has to be able to say which it was:
-- "aprendida" on a guess would be the app claiming a history it does not have.
--
-- `category_from` is a CHECK, and SQLite cannot widen one in place, so the
-- table is rebuilt. Every row is carried over.

ALTER TABLE movement_proposals RENAME TO movement_proposals_old;

DROP INDEX IF EXISTS idx_movement_proposals_pending;
DROP INDEX IF EXISTS idx_movement_proposals_account;
DROP INDEX IF EXISTS idx_movement_proposals_batch;

CREATE TABLE movement_proposals (
  id            INTEGER PRIMARY KEY,
  source        TEXT    NOT NULL CHECK (source IN ('statement', 'notification')),
  account_id    INTEGER REFERENCES accounts(id) ON DELETE CASCADE,
  occurred_on   TEXT    CHECK (occurred_on IS NULL OR occurred_on LIKE '____-__-__'),
  amount_minor  INTEGER CHECK (amount_minor IS NULL OR typeof(amount_minor) = 'integer'),
  description   TEXT,
  category_id   INTEGER REFERENCES categories(id) ON DELETE SET NULL,

  -- Where the category came from:
  --   'learned' - what THIS person filed this description under before
  --   'guessed' - a word in the description that the app ships knowing
  --   'typed'   - the person, on the review screen
  -- Null when there is no category yet.
  category_from TEXT    CHECK (category_from IS NULL
                               OR category_from IN ('learned', 'guessed', 'typed')),

  evidence      TEXT    NOT NULL,
  status        TEXT    NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'accepted', 'rejected')),
  transaction_id INTEGER REFERENCES transactions(id) ON DELETE SET NULL,
  maybe_same_as INTEGER REFERENCES transactions(id) ON DELETE SET NULL,
  pairs_with    INTEGER REFERENCES movement_proposals(id) ON DELETE SET NULL,
  batch         TEXT    NOT NULL,
  created_at    TEXT    NOT NULL,
  updated_at    TEXT    NOT NULL
);

INSERT INTO movement_proposals
  (id, source, account_id, occurred_on, amount_minor, description, category_id,
   category_from, evidence, status, transaction_id, maybe_same_as, pairs_with,
   batch, created_at, updated_at)
SELECT
   id, source, account_id, occurred_on, amount_minor, description, category_id,
   category_from, evidence, status, transaction_id, maybe_same_as, pairs_with,
   batch, created_at, updated_at
FROM movement_proposals_old;

DROP TABLE movement_proposals_old;

CREATE INDEX idx_movement_proposals_pending ON movement_proposals(status, created_at);
CREATE INDEX idx_movement_proposals_account ON movement_proposals(account_id, occurred_on);
CREATE INDEX idx_movement_proposals_batch   ON movement_proposals(batch);
