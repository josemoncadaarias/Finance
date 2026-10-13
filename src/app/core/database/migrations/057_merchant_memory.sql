-- Migration 057 - what a shop is remembered as, beyond its category
--
-- Jose, 2026-10-13: "todo lo que selecciono en un movimiento por revisar,
-- cuenta, producto, qué cambia, nota, categoría... debería ser aprendido".
-- The category was already remembered per shop (merchant_categories); the
-- note the person wrote instead of the bank's words, the product the money
-- landed in or left from, and what it changed (rule 15's "¿Qué cambia?")
-- were not, so every proposal of the same shop opened with the bank's text
-- and the account's usual product again.
--
-- All three are optional and NULL for every row already here: nothing on
-- record changes, and a shop answers with them only once a person saves one.

ALTER TABLE merchant_categories ADD COLUMN note TEXT;
ALTER TABLE merchant_categories ADD COLUMN product_id INTEGER REFERENCES products(id) ON DELETE SET NULL;
ALTER TABLE merchant_categories ADD COLUMN scope TEXT CHECK (scope IS NULL OR scope IN ('both', 'product', 'netWorth'));
