-- Migration 043 - a pocket is a product
--
-- Jose, 2026-09-22: "pocket es un nombre aunque no malo, muy especifico
-- porque no todas las cuentas manejan pockets, por eso quise llamarlos mejor
-- productos que es mas generico". Dale has alcancias, Lulo has bolsillos,
-- Global66 has a boveda and Pibank has CDTs. The app has called all of them
-- products on the screen for weeks; only the database still said pockets.
--
--   yield_pockets          -> products
--   yield_pocket_balances  -> product_balances
--   pocket_id              -> product_id            (in six tables)
--   matures_into_pocket_id -> matures_into_product_id
--
-- SQLite carries the rest across by itself: RENAME COLUMN rewrites the
-- foreign keys that point at it, the CHECK constraints that mention it and
-- the indexes built on it. The rows, the ids and every figure are untouched -
-- this migration moves no money and works nothing out again.

ALTER TABLE yield_pockets RENAME TO products;
ALTER TABLE yield_pocket_balances RENAME TO product_balances;

ALTER TABLE products RENAME COLUMN matures_into_pocket_id TO matures_into_product_id;

ALTER TABLE product_balances  RENAME COLUMN pocket_id TO product_id;
ALTER TABLE yield_rates       RENAME COLUMN pocket_id TO product_id;
ALTER TABLE yield_days        RENAME COLUMN pocket_id TO product_id;
ALTER TABLE transactions      RENAME COLUMN pocket_id TO product_id;
ALTER TABLE product_entries   RENAME COLUMN pocket_id TO product_id;
ALTER TABLE product_cashouts  RENAME COLUMN pocket_id TO product_id;

-- The indexes followed their tables and columns, under names that still say
-- pocket. Recreated by hand, which is the point of the exercise.
DROP INDEX IF EXISTS idx_yield_pockets_account;
DROP INDEX IF EXISTS idx_yield_pockets_default;
DROP INDEX IF EXISTS idx_yield_pocket_balances;
DROP INDEX IF EXISTS idx_yield_rates_pocket;
DROP INDEX IF EXISTS idx_transactions_pocket;
DROP INDEX IF EXISTS idx_product_entries_pocket;

CREATE INDEX idx_products_account ON products(account_id, sort_order);
CREATE UNIQUE INDEX idx_products_default ON products(account_id) WHERE is_default = 1;
CREATE INDEX idx_product_balances ON product_balances(product_id, valid_from);
CREATE INDEX idx_yield_rates_product ON yield_rates(product_id, valid_from);
CREATE INDEX idx_transactions_product ON transactions(product_id) WHERE product_id IS NOT NULL;
CREATE INDEX idx_product_entries_product ON product_entries(product_id, on_date);
