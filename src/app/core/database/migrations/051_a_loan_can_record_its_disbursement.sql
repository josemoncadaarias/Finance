-- Migration 051 - a loan can record where its money arrived (Jose, 2026-10-01)
--
-- Optional: a loan the app follows from its disbursement may say which
-- account received the money. The debt then starts at zero and that transfer,
-- from the loan into the account, is what makes it; without it the loan
-- opens at the amount owed, as before. A loan begun before the app never has
-- one: that money is already inside the account's balance.
--
-- Deleting the transfer from Inicio only forgets it here; the loan stays.

ALTER TABLE loans ADD COLUMN disbursement_transfer_id INTEGER REFERENCES transfers(id) ON DELETE SET NULL;

CREATE INDEX idx_loans_disbursement ON loans(disbursement_transfer_id);
