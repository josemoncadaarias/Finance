-- Migration 052 - loans in UVR (Jose, 2026-10-01)
--
-- A housing loan may be denominated in UVR: the debt is kept in UVR and its
-- peso value grows with the UVR every day. The Superfinanciera describes
-- three systems for it - constant installment, constant capital, and a
-- cyclic decreasing installment - and core/loans/schedule.ts works out all
-- three (checked against Jose's reference package, 2026-10-01).
--
-- loans.unit says which: 'COP' (every loan until now) or 'UVR'. For a loan
-- in UVR, balance_after_before_minor and bank_installment_minor are in
-- millionths of a UVR, as the bank's statement states them; the principal
-- (what was disbursed) and the insurance stay in pesos.
--
-- loans.decrease_scaled: the cyclic system's yearly decrease (the projected
-- inflation the contract sets), scaled by 1,000,000. A fixed-installment loan
-- with one is cyclic; null for every other. Kept as a column of its own so
-- the CHECK on `system` did not have to be rebuilt.

ALTER TABLE loans ADD COLUMN unit TEXT NOT NULL DEFAULT 'COP' CHECK (unit IN ('COP', 'UVR'));
ALTER TABLE loans ADD COLUMN decrease_scaled INTEGER CHECK (decrease_scaled IS NULL OR decrease_scaled > 0);

-- A payment on a loan in UVR: the capital it paid in UVR (millionths), and
-- the growth of the debt in pesos since the payment before - the UVR's
-- variation - written as a movement of the loan's own account, so its balance
-- is the debt in pesos on the day of each payment.
ALTER TABLE loan_payments ADD COLUMN capital_uvr_micro INTEGER CHECK (capital_uvr_micro IS NULL OR capital_uvr_micro >= 0);
ALTER TABLE loan_payments ADD COLUMN uvr_adjust_minor INTEGER NOT NULL DEFAULT 0;
ALTER TABLE loan_payments ADD COLUMN uvr_adjust_tx_id INTEGER REFERENCES transactions(id) ON DELETE SET NULL;

-- The UVR, as published by the Banco de la Republica or typed from a
-- contract or a statement, scaled by 10,000 (four decimals). Every other day
-- is worked out from these and the IPC (core/loans/uvr.ts), and says so.
CREATE TABLE uvr_values (
  day          TEXT    PRIMARY KEY CHECK (day GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  value_scaled INTEGER NOT NULL CHECK (typeof(value_scaled) = 'integer' AND value_scaled > 0),
  source       TEXT    NOT NULL CHECK (source IN ('official', 'typed')),
  created_at   TEXT    NOT NULL
);

-- Banco de la Republica, Boletin 24 de 2026: the UVR from 16 September to
-- 15 October 2026.
INSERT INTO uvr_values (day, value_scaled, source, created_at) VALUES
  ('2026-09-16', 4180925, 'official', '2026-10-01T00:00:00Z'),
  ('2026-09-17', 4181468, 'official', '2026-10-01T00:00:00Z'),
  ('2026-09-18', 4182010, 'official', '2026-10-01T00:00:00Z'),
  ('2026-09-19', 4182553, 'official', '2026-10-01T00:00:00Z'),
  ('2026-09-20', 4183096, 'official', '2026-10-01T00:00:00Z'),
  ('2026-09-21', 4183639, 'official', '2026-10-01T00:00:00Z'),
  ('2026-09-22', 4184181, 'official', '2026-10-01T00:00:00Z'),
  ('2026-09-23', 4184724, 'official', '2026-10-01T00:00:00Z'),
  ('2026-09-24', 4185267, 'official', '2026-10-01T00:00:00Z'),
  ('2026-09-25', 4185810, 'official', '2026-10-01T00:00:00Z'),
  ('2026-09-26', 4186354, 'official', '2026-10-01T00:00:00Z'),
  ('2026-09-27', 4186897, 'official', '2026-10-01T00:00:00Z'),
  ('2026-09-28', 4187440, 'official', '2026-10-01T00:00:00Z'),
  ('2026-09-29', 4187983, 'official', '2026-10-01T00:00:00Z'),
  ('2026-09-30', 4188527, 'official', '2026-10-01T00:00:00Z'),
  ('2026-10-01', 4189070, 'official', '2026-10-01T00:00:00Z'),
  ('2026-10-02', 4189614, 'official', '2026-10-01T00:00:00Z'),
  ('2026-10-03', 4190157, 'official', '2026-10-01T00:00:00Z'),
  ('2026-10-04', 4190701, 'official', '2026-10-01T00:00:00Z'),
  ('2026-10-05', 4191245, 'official', '2026-10-01T00:00:00Z'),
  ('2026-10-06', 4191789, 'official', '2026-10-01T00:00:00Z'),
  ('2026-10-07', 4192333, 'official', '2026-10-01T00:00:00Z'),
  ('2026-10-08', 4192877, 'official', '2026-10-01T00:00:00Z'),
  ('2026-10-09', 4193421, 'official', '2026-10-01T00:00:00Z'),
  ('2026-10-10', 4193965, 'official', '2026-10-01T00:00:00Z'),
  ('2026-10-11', 4194509, 'official', '2026-10-01T00:00:00Z'),
  ('2026-10-12', 4195053, 'official', '2026-10-01T00:00:00Z'),
  ('2026-10-13', 4195598, 'official', '2026-10-01T00:00:00Z'),
  ('2026-10-14', 4196142, 'official', '2026-10-01T00:00:00Z'),
  ('2026-10-15', 4196686, 'official', '2026-10-01T00:00:00Z');
