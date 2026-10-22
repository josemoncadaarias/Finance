-- Migration 059 - the account a shop is paid from (or pays into)
--
-- Jose, 2026-10-22: "cuando llega por ejemplo un SMS con una nota específica
-- hay que tratar de interpretar cuál es la cuenta más usada para esos casos".
-- A shop already remembered its category, note, product and answer (057);
-- not the account, so a message from a sender shared by several banks, or a
-- bank's app that names no card, kept asking which account it was. Optional
-- and NULL for every row already here; it is filled from the ledger (the
-- account the shop's movements used most) and by every save that says it.

ALTER TABLE merchant_categories ADD COLUMN account_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL;
