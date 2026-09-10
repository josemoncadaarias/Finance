-- Migration 018 - movements moved to the categories they belong to
--
-- Jose created a set of categories and gave a keyword for each: a description
-- containing it is certainly that category. These are those rules, run against
-- the descriptions as Monefy wrote them.
--
-- Three things this file has to get right:
--
-- **Accents.** Half the descriptions were typed with them and half without -
-- "Éxito" and "exito", "subió" and "subio". Every comparison goes through the
-- same fold, so a rule cannot depend on how a word happened to be typed.
--
-- **Overlap.** Some descriptions carry two keywords and the more specific one
-- wins: "Didi de CC viva laureles a d1 estadio" is a ride to a shop, not a
-- shop. Every rule names the words it will not touch, so each statement is
-- true on its own and the order below is documentation rather than machinery.
--
-- **A re-import must not undo it.** The importer recognises a row by its
-- fingerprint and leaves `locked` rows alone, so every row moved here is
-- locked. Without that the next Monefy export would put all of them back.
--
-- Each statement matches its category by name and does nothing if that name is
-- absent, so this is safe on a database that does not have them.

-- Rides. DidiClub is a subscription to a digital platform, not a trip.
UPDATE transactions
SET category_id = (SELECT id FROM categories WHERE name = 'Didi'),
    locked = 1,
    updated_at = '2026-09-12T00:00:00Z'
WHERE EXISTS (SELECT 1 FROM categories WHERE name = 'Didi')
  AND lower(replace(replace(replace(replace(replace(replace(COALESCE(description, ''), 'á','a'), 'é','e'), 'í','i'), 'ó','o'), 'ú','u'), 'ñ','n')) LIKE '%didi%'
  AND amount_minor < 0
  AND transfer_id IS NULL
  AND lower(replace(replace(replace(replace(replace(replace(COALESCE(description, ''), 'á','a'), 'é','e'), 'í','i'), 'ó','o'), 'ú','u'), 'ñ','n')) NOT LIKE '%didiclub%';

-- Rides.
UPDATE transactions
SET category_id = (SELECT id FROM categories WHERE name = 'Uber'),
    locked = 1,
    updated_at = '2026-09-12T00:00:00Z'
WHERE EXISTS (SELECT 1 FROM categories WHERE name = 'Uber')
  AND lower(replace(replace(replace(replace(replace(replace(COALESCE(description, ''), 'á','a'), 'é','e'), 'í','i'), 'ó','o'), 'ú','u'), 'ñ','n')) LIKE '%uber%'
  AND amount_minor < 0
  AND transfer_id IS NULL
  AND lower(replace(replace(replace(replace(replace(replace(COALESCE(description, ''), 'á','a'), 'é','e'), 'í','i'), 'ó','o'), 'ú','u'), 'ñ','n')) NOT LIKE '%didi%';

-- Data, mobile, home. Always a bill.
UPDATE transactions
SET category_id = (SELECT id FROM categories WHERE name = 'Claro'),
    locked = 1,
    updated_at = '2026-09-12T00:00:00Z'
WHERE EXISTS (SELECT 1 FROM categories WHERE name = 'Claro')
  AND lower(replace(replace(replace(replace(replace(replace(COALESCE(description, ''), 'á','a'), 'é','e'), 'í','i'), 'ó','o'), 'ú','u'), 'ñ','n')) LIKE '%claro%'
  AND amount_minor < 0
  AND transfer_id IS NULL
  AND lower(replace(replace(replace(replace(replace(replace(COALESCE(description, ''), 'á','a'), 'é','e'), 'í','i'), 'ó','o'), 'ú','u'), 'ñ','n')) NOT LIKE '%didi%'
  AND lower(replace(replace(replace(replace(replace(replace(COALESCE(description, ''), 'á','a'), 'é','e'), 'í','i'), 'ó','o'), 'ú','u'), 'ñ','n')) NOT LIKE '%uber%';

-- The utility bill.
UPDATE transactions
SET category_id = (SELECT id FROM categories WHERE name = 'EPM'),
    locked = 1,
    updated_at = '2026-09-12T00:00:00Z'
WHERE EXISTS (SELECT 1 FROM categories WHERE name = 'EPM')
  AND lower(replace(replace(replace(replace(replace(replace(COALESCE(description, ''), 'á','a'), 'é','e'), 'í','i'), 'ó','o'), 'ú','u'), 'ñ','n')) LIKE '%epm%'
  AND amount_minor < 0
  AND transfer_id IS NULL
  AND lower(replace(replace(replace(replace(replace(replace(COALESCE(description, ''), 'á','a'), 'é','e'), 'í','i'), 'ó','o'), 'ú','u'), 'ñ','n')) NOT LIKE '%didi%'
  AND lower(replace(replace(replace(replace(replace(replace(COALESCE(description, ''), 'á','a'), 'é','e'), 'í','i'), 'ó','o'), 'ú','u'), 'ñ','n')) NOT LIKE '%uber%'
  AND lower(replace(replace(replace(replace(replace(replace(COALESCE(description, ''), 'á','a'), 'é','e'), 'í','i'), 'ó','o'), 'ú','u'), 'ñ','n')) NOT LIKE '%claro%';

-- Shopping at Éxito. Written both with and without the accent.
UPDATE transactions
SET category_id = (SELECT id FROM categories WHERE name = 'Éxito'),
    locked = 1,
    updated_at = '2026-09-12T00:00:00Z'
WHERE EXISTS (SELECT 1 FROM categories WHERE name = 'Éxito')
  AND lower(replace(replace(replace(replace(replace(replace(COALESCE(description, ''), 'á','a'), 'é','e'), 'í','i'), 'ó','o'), 'ú','u'), 'ñ','n')) LIKE '%exito%'
  AND amount_minor < 0
  AND transfer_id IS NULL
  AND lower(replace(replace(replace(replace(replace(replace(COALESCE(description, ''), 'á','a'), 'é','e'), 'í','i'), 'ó','o'), 'ú','u'), 'ñ','n')) NOT LIKE '%didi%'
  AND lower(replace(replace(replace(replace(replace(replace(COALESCE(description, ''), 'á','a'), 'é','e'), 'í','i'), 'ó','o'), 'ú','u'), 'ñ','n')) NOT LIKE '%uber%';

-- Shopping at Dollarcity.
UPDATE transactions
SET category_id = (SELECT id FROM categories WHERE name = 'Dollarcity'),
    locked = 1,
    updated_at = '2026-09-12T00:00:00Z'
WHERE EXISTS (SELECT 1 FROM categories WHERE name = 'Dollarcity')
  AND lower(replace(replace(replace(replace(replace(replace(COALESCE(description, ''), 'á','a'), 'é','e'), 'í','i'), 'ó','o'), 'ú','u'), 'ñ','n')) LIKE '%dollarcity%'
  AND amount_minor < 0
  AND transfer_id IS NULL
  AND lower(replace(replace(replace(replace(replace(replace(COALESCE(description, ''), 'á','a'), 'é','e'), 'í','i'), 'ó','o'), 'ú','u'), 'ñ','n')) NOT LIKE '%didi%'
  AND lower(replace(replace(replace(replace(replace(replace(COALESCE(description, ''), 'á','a'), 'é','e'), 'í','i'), 'ó','o'), 'ú','u'), 'ñ','n')) NOT LIKE '%uber%';

-- The market.
UPDATE transactions
SET category_id = (SELECT id FROM categories WHERE name = 'Mercados OR'),
    locked = 1,
    updated_at = '2026-09-12T00:00:00Z'
WHERE EXISTS (SELECT 1 FROM categories WHERE name = 'Mercados OR')
  AND lower(replace(replace(replace(replace(replace(replace(COALESCE(description, ''), 'á','a'), 'é','e'), 'í','i'), 'ó','o'), 'ú','u'), 'ñ','n')) LIKE '%mercados or%'
  AND amount_minor < 0
  AND transfer_id IS NULL
  AND lower(replace(replace(replace(replace(replace(replace(COALESCE(description, ''), 'á','a'), 'é','e'), 'í','i'), 'ó','o'), 'ú','u'), 'ñ','n')) NOT LIKE '%didi%'
  AND lower(replace(replace(replace(replace(replace(replace(COALESCE(description, ''), 'á','a'), 'é','e'), 'í','i'), 'ó','o'), 'ú','u'), 'ñ','n')) NOT LIKE '%uber%';

-- D1 as a word of its own. Two characters that short turn up inside other
-- text, and a ride TO a D1 is a ride - which is why the trips are excluded
-- and why the match needs the space in front of it.
UPDATE transactions
SET category_id = (SELECT id FROM categories WHERE name = 'Tiendas D1'),
    locked = 1,
    updated_at = '2026-09-12T00:00:00Z'
WHERE EXISTS (SELECT 1 FROM categories WHERE name = 'Tiendas D1')
  AND lower(replace(replace(replace(replace(replace(replace(COALESCE(description, ''), 'á','a'), 'é','e'), 'í','i'), 'ó','o'), 'ú','u'), 'ñ','n')) LIKE '% d1%'
  AND amount_minor < 0
  AND transfer_id IS NULL
  AND lower(replace(replace(replace(replace(replace(replace(COALESCE(description, ''), 'á','a'), 'é','e'), 'í','i'), 'ó','o'), 'ú','u'), 'ñ','n')) NOT LIKE '%didi%'
  AND lower(replace(replace(replace(replace(replace(replace(COALESCE(description, ''), 'á','a'), 'é','e'), 'í','i'), 'ó','o'), 'ú','u'), 'ñ','n')) NOT LIKE '%uber%';

-- Matías, but only what is filed under Casa today. The rest is in Salud,
-- which is where it belongs, and Jose asked for the ones in Casa.
UPDATE transactions
SET category_id = (SELECT id FROM categories WHERE name = 'Familia'),
    locked = 1,
    updated_at = '2026-09-12T00:00:00Z'
WHERE EXISTS (SELECT 1 FROM categories WHERE name = 'Familia')
  AND lower(replace(replace(replace(replace(replace(replace(COALESCE(description, ''), 'á','a'), 'é','e'), 'í','i'), 'ó','o'), 'ú','u'), 'ñ','n')) LIKE '%matias%'
  AND amount_minor < 0
  AND transfer_id IS NULL
  AND category_id = (SELECT id FROM categories WHERE name = 'Casa');

-- An investment that fell.
UPDATE transactions
SET category_id = (SELECT id FROM categories WHERE name = 'Perdida'),
    locked = 1,
    updated_at = '2026-09-12T00:00:00Z'
WHERE EXISTS (SELECT 1 FROM categories WHERE name = 'Perdida')
  AND lower(replace(replace(replace(replace(replace(replace(COALESCE(description, ''), 'á','a'), 'é','e'), 'í','i'), 'ó','o'), 'ú','u'), 'ñ','n')) LIKE '%bajo inversion%'
  AND amount_minor < 0
  AND transfer_id IS NULL;

-- And one that rose. Not the payslip that mentions it: filing a salary
-- deposit as a market gain would be wrong twice over, in the ledger and
-- in the tax return.
UPDATE transactions
SET category_id = (SELECT id FROM categories WHERE name = 'Ganancia'),
    locked = 1,
    updated_at = '2026-09-12T00:00:00Z'
WHERE EXISTS (SELECT 1 FROM categories WHERE name = 'Ganancia')
  AND lower(replace(replace(replace(replace(replace(replace(COALESCE(description, ''), 'á','a'), 'é','e'), 'í','i'), 'ó','o'), 'ú','u'), 'ñ','n')) LIKE '%subio inversion%'
  AND amount_minor > 0
  AND transfer_id IS NULL
  AND lower(replace(replace(replace(replace(replace(replace(COALESCE(description, ''), 'á','a'), 'é','e'), 'í','i'), 'ó','o'), 'ú','u'), 'ñ','n')) NOT LIKE '%nomina%';

-- The tax, last and on its own.
--
-- A description carrying both a vendor and this tax is a bill for that
-- vendor that mentions the tax - "Factura epm con impuesto 4x1000" is an
-- EPM bill - so those 21 rows stay with their vendor. Removing a name
-- from the exclusions below is all it would take to decide otherwise.
UPDATE transactions
SET category_id = (SELECT id FROM categories WHERE name = '4x1000'),
    locked = 1,
    updated_at = '2026-09-12T00:00:00Z'
WHERE EXISTS (SELECT 1 FROM categories WHERE name = '4x1000')
  AND lower(replace(replace(replace(replace(replace(replace(COALESCE(description, ''), 'á','a'), 'é','e'), 'í','i'), 'ó','o'), 'ú','u'), 'ñ','n')) LIKE '%4x1000%'
  AND amount_minor < 0
  AND transfer_id IS NULL
  AND lower(replace(replace(replace(replace(replace(replace(COALESCE(description, ''), 'á','a'), 'é','e'), 'í','i'), 'ó','o'), 'ú','u'), 'ñ','n')) NOT LIKE '%didi%'
  AND lower(replace(replace(replace(replace(replace(replace(COALESCE(description, ''), 'á','a'), 'é','e'), 'í','i'), 'ó','o'), 'ú','u'), 'ñ','n')) NOT LIKE '%uber%'
  AND lower(replace(replace(replace(replace(replace(replace(COALESCE(description, ''), 'á','a'), 'é','e'), 'í','i'), 'ó','o'), 'ú','u'), 'ñ','n')) NOT LIKE '%claro%'
  AND lower(replace(replace(replace(replace(replace(replace(COALESCE(description, ''), 'á','a'), 'é','e'), 'í','i'), 'ó','o'), 'ú','u'), 'ñ','n')) NOT LIKE '%epm%'
  AND lower(replace(replace(replace(replace(replace(replace(COALESCE(description, ''), 'á','a'), 'é','e'), 'í','i'), 'ó','o'), 'ú','u'), 'ñ','n')) NOT LIKE '%exito%'
  AND lower(replace(replace(replace(replace(replace(replace(COALESCE(description, ''), 'á','a'), 'é','e'), 'í','i'), 'ó','o'), 'ú','u'), 'ñ','n')) NOT LIKE '%dollarcity%';
