-- Migration 044 - a movement the app proposes, which only a person makes real
--
-- Rule 22. Two sources will fill this table - a statement in PDF, and a bank's
-- own notification - and a person answers every row of it before anything
-- reaches the ledger. Nothing here is a movement: it is a reading, with what
-- it was read from kept beside it so it can always be justified.
--
-- Why a table of its own, rather than `review_queue`: that one belongs to the
-- importer that was removed, it is generic (kind, entity, payload) and rule 12
-- says nothing new is written to it. A proposal has a shape, and a shape is
-- worth writing down.
--
-- What it deliberately does NOT carry: a product. A proposed movement names no
-- product, exactly like one typed by hand that names none, and the account's
-- usual product absorbs it. Jose, 2026-09-23: "todo esto es para movimientos y
-- cuentas, nada para el tema de productos que es otro cuento muy diferente".

CREATE TABLE movement_proposals (
  id            INTEGER PRIMARY KEY,

  -- Where it was read. 'statement' is a PDF; 'notification' is a bank's push.
  source        TEXT    NOT NULL CHECK (source IN ('statement', 'notification')),

  -- The account it belongs to. Null when the source could not be tied to one -
  -- a notification from an app nobody has attached yet - and then the person
  -- picks before it can be accepted.
  account_id    INTEGER REFERENCES accounts(id) ON DELETE CASCADE,

  -- What was read. Any of them may be missing: a bank that only says "you have
  -- a new movement" gives a date and nothing else, and that row still shows up
  -- saying exactly that.
  occurred_on   TEXT    CHECK (occurred_on IS NULL OR occurred_on LIKE '____-__-__'),
  amount_minor  INTEGER CHECK (amount_minor IS NULL OR typeof(amount_minor) = 'integer'),
  description   TEXT,
  category_id   INTEGER REFERENCES categories(id) ON DELETE SET NULL,

  -- Where the category came from: 'learned' from what this description was
  -- filed under before, 'typed' by the person on this screen. Null when there
  -- is no category yet.
  category_from TEXT    CHECK (category_from IS NULL OR category_from IN ('learned', 'typed')),

  -- The evidence. For a notification: the package that posted it, its title
  -- and text, and the instant it arrived. For a statement: the file, the page
  -- and the line as it was read. Never thrown away, because a figure whose
  -- origin cannot be shown is a figure nobody can check.
  evidence      TEXT    NOT NULL,

  -- What has been decided about it.
  --   pending   - waiting for a person
  --   accepted  - a movement was written; `transaction_id` says which
  --   rejected  - thrown away, and it never comes back
  status        TEXT    NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'accepted', 'rejected')),
  transaction_id INTEGER REFERENCES transactions(id) ON DELETE SET NULL,

  -- A movement already on record that this one may be the same as. Set by the
  -- tolerant check - same account, same amount, a few days apart - because the
  -- same purchase reaches the app twice with two dates and two descriptions,
  -- and an exact fingerprint would never catch it. It is a QUESTION on the
  -- screen, never a silent skip.
  maybe_same_as INTEGER REFERENCES transactions(id) ON DELETE SET NULL,

  -- The other half of a transfer between two accounts of this same person.
  -- Both sources report such a move twice, once leaving and once arriving, and
  -- accepting the two apart would invent an expense and an income.
  pairs_with    INTEGER REFERENCES movement_proposals(id) ON DELETE SET NULL,

  -- What ties the rows of one reading together: one PDF, or one drain of the
  -- notifications that arrived while the app was closed.
  batch         TEXT    NOT NULL,

  created_at    TEXT    NOT NULL,
  updated_at    TEXT    NOT NULL
);

CREATE INDEX idx_movement_proposals_pending ON movement_proposals(status, created_at);
CREATE INDEX idx_movement_proposals_account ON movement_proposals(account_id, occurred_on);
CREATE INDEX idx_movement_proposals_batch   ON movement_proposals(batch);

-- What a description was filed under last time.
--
-- The merchants repeat - the same supermarket, the same app, the same payroll
-- line - so the category of a movement is nearly always a question that has
-- been answered before. This remembers the answer. It is deterministic, it
-- costs nothing, it works with no network and it gets better with use, which
-- is everything an LLM is not for this particular job.
--
-- It serves typing a movement by hand just as well as reading one.
CREATE TABLE merchant_categories (
  -- The description, folded: upper case, accents removed, runs of spaces and
  -- the digits that change every time (a receipt number) taken out. Written by
  -- the app, never shown.
  merchant     TEXT    PRIMARY KEY,
  category_id  INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  -- What it was seen as, to show something a person recognises.
  sample       TEXT    NOT NULL,
  times        INTEGER NOT NULL DEFAULT 1 CHECK (times > 0),
  last_seen_on TEXT    NOT NULL,
  created_at   TEXT    NOT NULL,
  updated_at   TEXT    NOT NULL
);

CREATE INDEX idx_merchant_categories_category ON merchant_categories(category_id);
