-- Migration 021 - every movement so far came out of the savings account
--
-- Migration 020 gave a movement somewhere to say which product it touched, and
-- left every existing row empty. Empty means "the first product", which was
-- the rule before the column existed - and it is now wrong twice over.
--
-- It is wrong because "first" is sort order, which only records when each
-- product was created. Jose created the savings products last, so the first
-- product of a split account is whichever alcancia happened to predate them,
-- and every movement of that account's history was being credited to a pot it
-- never passed through.
--
-- And it is wrong because it is unsaid. A row with no product is a row the app
-- has to guess about, and the guess changes the moment a product is added or
-- removed. Saying it outright makes the history stable.
--
-- So: everything that has happened so far came out of, or went into, the
-- savings account. That is what Jose says is true of his own history - money
-- arrives in the savings account and leaves from it, and anything sitting in
-- an alcancia got there by a deliberate move, which is a movement of its own
-- and did not exist before this.
--
-- Both names are matched because the product is named in the language the user
-- read when the account was enrolled, and an account may have been enrolled
-- under either.

UPDATE transactions
SET pocket_id = (
      SELECT p.id FROM yield_pockets p
      WHERE p.account_id = transactions.account_id
        AND lower(p.name) IN ('cuenta de ahorros', 'savings account')
      ORDER BY p.sort_order
      LIMIT 1
    ),
    updated_at = '2026-09-11T00:00:00Z'
WHERE pocket_id IS NULL
  AND EXISTS (
    SELECT 1 FROM yield_pockets p
    WHERE p.account_id = transactions.account_id
      AND lower(p.name) IN ('cuenta de ahorros', 'savings account')
  );

-- The same for money taken out of the cushion: it lands in the account, and
-- the account means the savings product unless something else was said.
UPDATE cushion_withdrawals
SET pocket_id = (
      SELECT p.id FROM yield_pockets p
      WHERE p.account_id = cushion_withdrawals.account_id
        AND lower(p.name) IN ('cuenta de ahorros', 'savings account')
      ORDER BY p.sort_order
      LIMIT 1
    )
WHERE pocket_id IS NULL
  AND EXISTS (
    SELECT 1 FROM yield_pockets p
    WHERE p.account_id = cushion_withdrawals.account_id
      AND lower(p.name) IN ('cuenta de ahorros', 'savings account')
  );
