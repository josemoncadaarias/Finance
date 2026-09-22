-- Migration 042 - the two tables named after the cushion take their real names
--
-- Jose, 2026-09-22: "ese termino colchon no deberia existir mas... me parece
-- que el codigo debe estar siempre actualizado". The concept went on
-- 2026-09-22; the word stayed in two table names, and what those tables hold
-- has nothing to do with it any more:
--
--   cushion_adjustments  -> product_entries
--       A product's own movements: an income that belongs to the product and
--       not to the account, a correction against what the bank says, cashback.
--
--   cushion_withdrawals  -> product_cashouts
--       Money moved out of what a product has earned and into the account
--       itself, which is the moment it becomes part of net worth.
--
-- Nothing about the rows changes: same columns, same ids, same figures.
-- SQLite's RENAME keeps the indexes, the foreign keys pointing out of these
-- tables and the data exactly as they are.
--
-- A backup written before today names the old tables, and it still restores:
-- `restoreBackup` rebuilds the schema the file came out of, puts the rows back
-- under the names they were written with, and only then migrates forward -
-- where this file renames them. Nothing had to be taught the old names.

ALTER TABLE cushion_adjustments RENAME TO product_entries;
ALTER TABLE cushion_withdrawals RENAME TO product_cashouts;

-- The indexes came along with their tables, under names that still say
-- cushion. They are recreated by hand because that is the whole point.
DROP INDEX IF EXISTS idx_cushion_adjustments_account;
DROP INDEX IF EXISTS idx_cushion_adjustments_pocket;
DROP INDEX IF EXISTS idx_cushion_adjustments_transaction;
DROP INDEX IF EXISTS idx_cushion_adjustments_kind;
DROP INDEX IF EXISTS idx_cushion_adjustments_category;
DROP INDEX IF EXISTS idx_cushion_withdrawals_account;

CREATE INDEX idx_product_entries_account     ON product_entries(account_id, on_date);
CREATE INDEX idx_product_entries_pocket      ON product_entries(pocket_id, on_date);
CREATE INDEX idx_product_entries_transaction ON product_entries(transaction_id);
CREATE INDEX idx_product_entries_kind        ON product_entries(product_kind_id);
CREATE INDEX idx_product_entries_category    ON product_entries(category_id);
CREATE INDEX idx_product_cashouts_account    ON product_cashouts(account_id, on_date);
