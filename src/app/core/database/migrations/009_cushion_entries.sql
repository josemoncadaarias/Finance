-- Migration 009 - money can land in the cushion for more than one reason
--
-- `cushion_adjustments` was built for one job: recording that the bank paid
-- more or less than this app worked out. Jose pointed out that the same shape
-- is what cashback needs, and that cashback is not an adjustment at all.
--
-- Cashback is money that arrives, on a date, for a reason worth writing down.
-- It piles up in different accounts at different moments under conditions that
-- change without notice, which is exactly why trying to derive it from rules
-- was the wrong place to start. Recorded by hand it is simple and true.
--
-- Two columns, then:
--
--   `kind`      what this entry IS, so a screen can say so and a tax module
--               can tell them apart later. Cashback is not withheld and
--               interest is; an entry that does not say which is a figure
--               nobody can classify.
--   `pocket_id` which pocket it landed in. An account can be several pots the
--               bank pays separately, so money arriving has to arrive
--               somewhere. Null means the app decides - the pocket that
--               follows the account balance, or the first one.
--
-- The far more important half of this change is in the engine, not here: an
-- entry dated inside the range being worked out now compounds into every day
-- after it. It did not before, which meant adding 10,000 on a Wednesday left
-- Thursday onwards still earning on the old balance. The total was right and
-- every day after it was quietly too small.

ALTER TABLE cushion_adjustments ADD COLUMN kind TEXT NOT NULL DEFAULT 'correction'
  CHECK (kind IN ('correction', 'cashback', 'other'));

ALTER TABLE cushion_adjustments ADD COLUMN pocket_id INTEGER REFERENCES yield_pockets(id) ON DELETE SET NULL;

-- Everything recorded before today was a correction against the bank, which is
-- the only thing the screen could produce. The default above already says so;
-- this is here to be explicit about what the old rows mean.
UPDATE cushion_adjustments SET kind = 'correction' WHERE kind IS NULL;

CREATE INDEX idx_cushion_adjustments_pocket ON cushion_adjustments(pocket_id, on_date);
