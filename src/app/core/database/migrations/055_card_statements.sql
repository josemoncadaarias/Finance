-- Migration 055 - what the bank's own statement says a card owes
--
-- Jose, 2026-10-02. The app works a card's statement out of the movements
-- typed into it (049), and it can honestly disagree with the bank's: a
-- purchase made on the cut-off day that the bank only posts the next day goes
-- to the next statement, a fee nobody typed is missing, an installment
-- purchase is billed one installment at a time. His Rappi Card closed on 30
-- September at 34,591.00 for the bank and 98,606.99 for the app - two
-- purchases of the 30th the bank had not posted yet.
--
-- So the person may type the figure the bank states for a statement (rule 7:
-- what the app works out can always be overruled by hand, and both are kept).
-- One row per card and cut-off day: a figure belongs to that statement only,
-- and the next cut-off goes back to what the movements say until another is
-- typed. Nothing in the ledger moves.

CREATE TABLE card_statements (
  id            INTEGER PRIMARY KEY,
  account_id    INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  -- The cut-off day of the statement this figure belongs to.
  cut_on        TEXT    NOT NULL,
  -- What the bank says is owed at that cut-off ("pago total"), positive.
  amount_minor  INTEGER NOT NULL CHECK (typeof(amount_minor) = 'integer' AND amount_minor >= 0),
  created_at    TEXT    NOT NULL,
  updated_at    TEXT    NOT NULL,
  UNIQUE (account_id, cut_on)
);
