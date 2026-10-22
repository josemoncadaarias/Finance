-- Migration 061 - a reminder's minute
--
-- Jose, 2026-10-22: the hours offered (7, 8, 9...) were the only ones, so a
-- reminder could not be tried at once nor set at 7:30. The hour stays as it
-- was; `minute` joins it, 0 for every reminder already made.

ALTER TABLE reminders ADD COLUMN minute INTEGER NOT NULL DEFAULT 0 CHECK (minute BETWEEN 0 AND 59);
