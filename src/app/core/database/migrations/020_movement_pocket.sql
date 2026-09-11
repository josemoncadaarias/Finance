-- Migration 020 - a movement can say which product it went to
--
-- Until now a movement recorded that money entered or left an ACCOUNT, and the
-- yields module had to guess which product inside it was involved. The guess
-- was written down honestly - "the movements go to the first pocket" - and it
-- is right for every account with one product, which was every account but
-- Dale. It stopped being right the moment Jose split more accounts up.
--
-- Two things went wrong with the guess. Money arriving in an account landed in
-- the first product whether or not that is where the bank put it. And moving
-- money from one product to another, or taking yield out to spend it, changed
-- no product balance at all - so a product went on earning on money it no
-- longer held until Jose noticed and typed a correction.
--
-- So the movement says it. Nullable, because it is only ever a question worth
-- asking when an account has more than one product: with one product there is
-- nothing to choose and the column stays empty, which is also every row that
-- already exists.
--
-- ON DELETE SET NULL, not CASCADE: removing a product must never remove the
-- money that passed through it. The movement is the fact; the product is
-- bookkeeping on top of it.

ALTER TABLE transactions ADD COLUMN pocket_id INTEGER REFERENCES yield_pockets(id) ON DELETE SET NULL;

CREATE INDEX idx_transactions_pocket ON transactions(pocket_id) WHERE pocket_id IS NOT NULL;

-- A withdrawal from the cushion comes out of one product too. Same reasoning,
-- same rule: null while an account has nothing to choose between.
ALTER TABLE cushion_withdrawals ADD COLUMN pocket_id INTEGER REFERENCES yield_pockets(id) ON DELETE SET NULL;
