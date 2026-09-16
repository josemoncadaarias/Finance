-- Migration 034 - what a product's own movement is, as a list the user keeps
--
-- A movement that touches only what a product gathered carried one of three
-- words fixed in the schema: cashback, correction, other. Jose, 2026-09-16:
-- they are categories like any other and should be his - renamed, given an
-- icon of their own, added to.
--
-- So they become rows. The three that existed are seeded, every entry already
-- written is pointed at the one it had, and `kind` stays exactly as it is:
-- migrations are history, and a column already written is not rewritten. It
-- keeps the old rows readable by anything that has not been taught about this
-- table yet.
--
-- `counts_as` is the half that is not cosmetic. What a figure IS decides how
-- it is taxed: interest is withheld, cashback is not, so a kind someone adds
-- has to say which of the two it behaves like.

CREATE TABLE product_kinds (
  id             INTEGER PRIMARY KEY,
  name           TEXT    NOT NULL,
  builtin_icon   TEXT,
  custom_icon_id INTEGER REFERENCES custom_icons(id) ON DELETE RESTRICT,
  counts_as      TEXT    NOT NULL DEFAULT 'yield' CHECK (counts_as IN ('yield', 'cashback')),
  archived       INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0, 1)),
  sort_order     INTEGER NOT NULL DEFAULT 0,
  created_at     TEXT    NOT NULL,
  updated_at     TEXT    NOT NULL,

  CHECK ((builtin_icon IS NULL) <> (custom_icon_id IS NULL))
);

CREATE UNIQUE INDEX idx_product_kinds_name ON product_kinds(name);

INSERT INTO product_kinds (name, builtin_icon, counts_as, sort_order, created_at, updated_at) VALUES
  ('Cashback', 'pricetag-outline', 'cashback', 0, '2026-09-16T00:00:00Z', '2026-09-16T00:00:00Z'),
  ('Corrección del banco', 'build-outline', 'yield', 1, '2026-09-16T00:00:00Z', '2026-09-16T00:00:00Z'),
  ('Otro', 'ellipsis-horizontal-circle-outline', 'yield', 2, '2026-09-16T00:00:00Z', '2026-09-16T00:00:00Z');

ALTER TABLE cushion_adjustments ADD COLUMN product_kind_id INTEGER REFERENCES product_kinds(id) ON DELETE SET NULL;

UPDATE cushion_adjustments
   SET product_kind_id = (SELECT id FROM product_kinds WHERE name = 'Cashback')
 WHERE kind = 'cashback';

UPDATE cushion_adjustments
   SET product_kind_id = (SELECT id FROM product_kinds WHERE name = 'Corrección del banco')
 WHERE kind = 'correction';

UPDATE cushion_adjustments
   SET product_kind_id = (SELECT id FROM product_kinds WHERE name = 'Otro')
 WHERE kind = 'other';

CREATE INDEX idx_cushion_adjustments_kind ON cushion_adjustments(product_kind_id);
