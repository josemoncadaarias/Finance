-- Migration 050 - loans (debts, part 2; Jose, 2026-10-01)
--
-- A loan is an account: its balance is the debt (negative), so it is in Saldos
-- and subtracts from net worth like a card. The account keeps type 'debit':
-- widening accounts.type's CHECK would mean rebuilding the table every other
-- table points at, and a row in `loans` already says what it is.
--
-- What is stored is what was agreed and what happened. The schedule - each
-- installment's interest, capital and the balance after it - is worked out
-- by core/loans/schedule.ts every time, never stored.

CREATE TABLE loans (
  account_id            INTEGER PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  principal_minor       INTEGER NOT NULL CHECK (typeof(principal_minor) = 'integer' AND principal_minor > 0),
  -- 'fixed_installment' (French: the same installment) or 'constant_capital'.
  system                TEXT    NOT NULL DEFAULT 'fixed_installment'
                                CHECK (system IN ('fixed_installment', 'constant_capital')),
  -- How the bank quoted the rate; it is always stored as E.A. in loan_rates.
  rate_quoted           TEXT    NOT NULL DEFAULT 'ea' CHECK (rate_quoted IN ('ea', 'mv')),
  rate_kind             TEXT    NOT NULL DEFAULT 'fixed' CHECK (rate_kind IN ('fixed', 'variable')),
  installments          INTEGER NOT NULL CHECK (installments BETWEEN 1 AND 600),
  -- Months between installments: 1 monthly, 3 quarterly...
  period_months         INTEGER NOT NULL DEFAULT 1 CHECK (period_months BETWEEN 1 AND 12),
  disbursed_on          TEXT    NOT NULL CHECK (disbursed_on GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  first_due_on          TEXT    NOT NULL CHECK (first_due_on GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  -- Insurance and fees per installment: a fixed figure, or a monthly share of
  -- the balance still owed (seguro de vida deudor), scaled by 1,000,000.
  insurance_kind        TEXT    NOT NULL DEFAULT 'fixed' CHECK (insurance_kind IN ('fixed', 'balance')),
  insurance_minor       INTEGER NOT NULL DEFAULT 0 CHECK (insurance_minor >= 0),
  insurance_rate_scaled INTEGER NOT NULL DEFAULT 0 CHECK (insurance_rate_scaled >= 0),
  -- The installment as the bank states it, insurance included; null when not typed.
  bank_installment_minor INTEGER CHECK (bank_installment_minor IS NULL OR bank_installment_minor > 0),
  paid_from_account_id  INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
  -- A loan begun before the app: how many installments were already paid,
  -- and what was owed after them. A record, never movements.
  paid_before           INTEGER NOT NULL DEFAULT 0 CHECK (paid_before >= 0),
  balance_after_before_minor INTEGER CHECK (balance_after_before_minor IS NULL OR balance_after_before_minor >= 0),
  created_at            TEXT    NOT NULL,
  updated_at            TEXT    NOT NULL
);

CREATE INDEX idx_loans_paid_from ON loans(paid_from_account_id);

-- The rate, as a history: a variable rate or a renegotiation is one more row.
CREATE TABLE loan_rates (
  id                 INTEGER PRIMARY KEY,
  account_id         INTEGER NOT NULL REFERENCES loans(account_id) ON DELETE CASCADE,
  valid_from         TEXT    NOT NULL CHECK (valid_from GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  annual_rate_scaled INTEGER NOT NULL CHECK (annual_rate_scaled >= 0),
  created_at         TEXT    NOT NULL,
  UNIQUE (account_id, valid_from)
);

-- What was paid: an installment (capital, interest, insurance, default
-- interest), a payment ahead (capital only, and whether it shortens the term
-- or lowers the installment), or the whole loan. The capital is the transfer
-- into the loan's account; the rest are expenses of the account it came from.
CREATE TABLE loan_payments (
  id                  INTEGER PRIMARY KEY,
  account_id          INTEGER NOT NULL REFERENCES loans(account_id) ON DELETE CASCADE,
  kind                TEXT    NOT NULL CHECK (kind IN ('installment', 'extra', 'payoff')),
  number              INTEGER CHECK (number IS NULL OR number >= 1),
  paid_on             TEXT    NOT NULL CHECK (paid_on GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  capital_minor       INTEGER NOT NULL DEFAULT 0 CHECK (capital_minor >= 0),
  interest_minor      INTEGER NOT NULL DEFAULT 0 CHECK (interest_minor >= 0),
  insurance_minor     INTEGER NOT NULL DEFAULT 0 CHECK (insurance_minor >= 0),
  late_minor          INTEGER NOT NULL DEFAULT 0 CHECK (late_minor >= 0),
  extra_mode          TEXT    CHECK (extra_mode IS NULL OR extra_mode IN ('term', 'installment')),
  -- Deleting the transfer deletes the payment: the capital did not move.
  transfer_id         INTEGER REFERENCES transfers(id) ON DELETE CASCADE,
  interest_tx_id      INTEGER REFERENCES transactions(id) ON DELETE SET NULL,
  insurance_tx_id     INTEGER REFERENCES transactions(id) ON DELETE SET NULL,
  late_tx_id          INTEGER REFERENCES transactions(id) ON DELETE SET NULL,
  created_at          TEXT    NOT NULL
);

CREATE INDEX idx_loan_payments_account ON loan_payments(account_id, paid_on);
CREATE INDEX idx_loan_payments_transfer ON loan_payments(transfer_id);
