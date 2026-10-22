-- Migration 060 - reminders
--
-- Jose, 2026-10-22: "recuérdame pagar el arriendo el 5", said to the
-- assistant, typed on its own screen, or asked for a fixed payment ("Avisarme
-- cada mes"). A reminder never writes a movement (rule 22: nothing invented
-- before it happens): on its day the phone rings, and a tap opens the movement
-- form filled in with what is here.
--
-- `repeat` 'monthly' rings every month on `day_of_month` (a day past a short
-- month's end is its last day); 'once' rings on `on_date` and is then done.
-- `done_month` ('YYYY-MM') is the month already settled - registered from it,
-- marked paid, or a fixed payment already seen that month - so the month
-- does not ring again. `snoozed_to` moves this month's ring to a later day.
-- `shop` is the merchant key of a fixed payment the reminder follows: seeing
-- that payment in the month settles it by itself.

CREATE TABLE reminders (
  id            INTEGER PRIMARY KEY,
  title         TEXT    NOT NULL CHECK (length(trim(title)) > 0),
  amount_minor  INTEGER CHECK (amount_minor IS NULL OR (typeof(amount_minor) = 'integer' AND amount_minor > 0)),
  account_id    INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
  category_id   INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  note          TEXT,
  repeat        TEXT    NOT NULL DEFAULT 'monthly' CHECK (repeat IN ('once', 'monthly')),
  day_of_month  INTEGER CHECK (day_of_month IS NULL OR day_of_month BETWEEN 1 AND 31),
  on_date       TEXT    CHECK (on_date IS NULL OR on_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  hour          INTEGER NOT NULL DEFAULT 8 CHECK (hour BETWEEN 0 AND 23),
  days_before   INTEGER NOT NULL DEFAULT 0 CHECK (days_before BETWEEN 0 AND 7),
  shop          TEXT,
  active        INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  done_month    TEXT,
  snoozed_to    TEXT,
  created_at    TEXT    NOT NULL,
  updated_at    TEXT    NOT NULL,
  CHECK ((repeat = 'monthly' AND day_of_month IS NOT NULL) OR (repeat = 'once' AND on_date IS NOT NULL))
);

CREATE INDEX idx_reminders_active ON reminders(active);
