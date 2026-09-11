-- Migration 027 - one income-tax simulation per tax year
--
-- The simulation is a form a person fills in over the year: a salary, what was
-- withheld each month, what they paid for a health policy. Nothing in it is
-- derived from the ledger yet, on purpose - the figures a tax return needs are
-- gross where the ledger holds net, and yearly where the yields module holds a
-- running total - so every one of them is typed, and a figure brought in from
-- the app is a starting point the person then corrects.
--
-- Stored as one document per year rather than one column per box. The form
-- follows the law, the law changes every year, and a column per box would mean
-- a migration every time a line is added to Formulario 210 - which is the
-- opposite of "configurable forms" in the project's own rules. Money inside it
-- is still integer cents, as everywhere else.
--
-- No `json_valid` check: the SQLite the phone runs is not guaranteed to carry
-- the JSON functions, and a migration that fails on the device is the one
-- mistake this project has already paid for once.

CREATE TABLE tax_simulations (
  year        INTEGER PRIMARY KEY CHECK (year BETWEEN 2000 AND 2100),
  inputs      TEXT    NOT NULL,
  created_at  TEXT    NOT NULL,
  updated_at  TEXT    NOT NULL
);
