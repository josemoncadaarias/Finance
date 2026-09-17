-- Migration 037 - a product's categories join the ordinary income categories
--
-- `product_kinds` (migration 034) gave a product's own movement its own little
-- list: Cashback, Corrección del banco, Otro, Rendimientos. Jose's point on
-- 2026-09-17 is that the split was never real: "un ingreso es un ingreso, no
-- importa si es para cuenta o para producto". A cashback the bank paid into a
-- product is income, and it belongs beside Salario and Depósitos rather than
-- in a second list that has to be kept, explained and chosen between.
--
-- So each kind becomes an income category carrying the same name and icon, and
-- every adjustment points at the category instead. A kind whose name is
-- already an income category joins that one rather than making a twin -
-- `idx_categories_name_kind` would refuse the twin anyway.
--
-- `product_kinds` and `cushion_adjustments.product_kind_id` stay exactly where
-- they are and are still written: migrations are history, a backup written
-- yesterday still carries them, and anything not yet taught about categories
-- goes on reading them.

ALTER TABLE cushion_adjustments
  ADD COLUMN category_id INTEGER REFERENCES categories(id) ON DELETE RESTRICT;

CREATE INDEX idx_cushion_adjustments_category ON cushion_adjustments(category_id);

-- One income category per kind that does not already have one by that name.
INSERT INTO categories (name, kind, builtin_icon, custom_icon_id, archived, sort_order,
                        created_at, updated_at)
SELECT
  k.name,
  'income',
  -- The table's CHECK wants exactly one of the two, and a kind that carries
  -- neither would fail it, so a plain icon stands in.
  CASE WHEN k.custom_icon_id IS NULL THEN COALESCE(k.builtin_icon, 'pricetag-outline') END,
  k.custom_icon_id,
  k.archived,
  k.sort_order,
  k.created_at,
  k.updated_at
FROM product_kinds k
WHERE NOT EXISTS (
  SELECT 1 FROM categories c WHERE c.name = k.name AND c.kind = 'income');

-- And every adjustment points at the category of the same name.
UPDATE cushion_adjustments
SET category_id = (
  SELECT c.id FROM categories c
  JOIN product_kinds k ON k.name = c.name
  WHERE k.id = cushion_adjustments.product_kind_id AND c.kind = 'income')
WHERE product_kind_id IS NOT NULL;
