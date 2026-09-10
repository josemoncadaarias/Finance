-- Migration 019 - the 4x1000 rule was wrong, and three rules were missing
--
-- Migration 018 moved 217 movements to 4x1000 that are not the tax at all.
-- Jose asked for the ones written as an "Ajuste"; the rule matched anything
-- whose note mentioned the tax, which is most of a restaurant bill or a repair
-- that happened to be paid by transfer.
--
-- The order below matters, and is the one thing in this file that does. The
-- restore runs first and puts every wrongly moved row back where it was; the
-- rules after it then claim what they should have claimed the first time. A
-- row like "Cosas para la casa mercado or mas impuesto 4x1000" goes back to
-- Casa and is then taken by Mercados OR, which is the right answer and is not
-- reachable in either order alone.
--
-- Everything else follows 018: the same accent fold, the same vendor
-- exclusions, and `locked` on every row moved so a re-import cannot undo it.
-- Each statement is self-contained and does nothing when its category is
-- absent.

-- 1. Undo what migration 018 got wrong.
--
-- 018 read every description carrying "4x1000" as a 4x1000 charge. Most are
-- not: they are an ordinary payment whose note mentions that the tax was
-- charged on top - "Combos pollo almuerzo mas impuesto 4x1000" is lunch.
-- Only the ones that say "Ajuste" are the tax itself.
--
-- The original category is not lost. The import fingerprint is built from
-- the CSV fields joined by char(1), and its third field is the category
-- Monefy exported; nothing writes to it, so it still holds what the row was
-- before 018 touched it. That is what this restores - the real value, not a
-- guess. Rows whose original category no longer exists are left alone.
--
-- `locked` deliberately stays as 018 set it. A row still marked as
-- hand-corrected is only over-protected; one wrongly unlocked could lose a
-- real correction at the next import.
UPDATE transactions
SET category_id = (SELECT id FROM categories WHERE name = substr(import_fingerprint, (instr(import_fingerprint, char(1)) + instr(substr(import_fingerprint, instr(import_fingerprint, char(1)) + 1), char(1))) + 1, ((instr(import_fingerprint, char(1)) + instr(substr(import_fingerprint, instr(import_fingerprint, char(1)) + 1), char(1))) + instr(substr(import_fingerprint, (instr(import_fingerprint, char(1)) + instr(substr(import_fingerprint, instr(import_fingerprint, char(1)) + 1), char(1))) + 1), char(1))) - (instr(import_fingerprint, char(1)) + instr(substr(import_fingerprint, instr(import_fingerprint, char(1)) + 1), char(1))) - 1)),
    updated_at = '2026-09-10T00:00:00Z'
WHERE category_id = (SELECT id FROM categories WHERE name = '4x1000')
  AND lower(replace(replace(replace(replace(replace(replace(COALESCE(description, ''), 'á','a'), 'é','e'), 'í','i'), 'ó','o'), 'ú','u'), 'ñ','n')) LIKE '%4x1000%'
  AND lower(replace(replace(replace(replace(replace(replace(COALESCE(description, ''), 'á','a'), 'é','e'), 'í','i'), 'ó','o'), 'ú','u'), 'ñ','n')) NOT LIKE '%ajuste%'
  AND import_fingerprint IS NOT NULL
  AND EXISTS (SELECT 1 FROM categories WHERE name = substr(import_fingerprint, (instr(import_fingerprint, char(1)) + instr(substr(import_fingerprint, instr(import_fingerprint, char(1)) + 1), char(1))) + 1, ((instr(import_fingerprint, char(1)) + instr(substr(import_fingerprint, instr(import_fingerprint, char(1)) + 1), char(1))) + instr(substr(import_fingerprint, (instr(import_fingerprint, char(1)) + instr(substr(import_fingerprint, instr(import_fingerprint, char(1)) + 1), char(1))) + 1), char(1))) - (instr(import_fingerprint, char(1)) + instr(substr(import_fingerprint, instr(import_fingerprint, char(1)) + 1), char(1))) - 1));

-- 2. The 4x1000 rule as it should have been written: an adjustment, and
-- the tax named in the same description. This is what "Ajuste rappi card
-- 4x1000" is, and it is the only shape that is certainly the tax.
UPDATE transactions
SET category_id = (SELECT id FROM categories WHERE name = '4x1000'),
    locked = 1,
    updated_at = '2026-09-10T00:00:00Z'
WHERE EXISTS (SELECT 1 FROM categories WHERE name = '4x1000')
  AND lower(replace(replace(replace(replace(replace(replace(COALESCE(description, ''), 'á','a'), 'é','e'), 'í','i'), 'ó','o'), 'ú','u'), 'ñ','n')) LIKE '%ajuste%4x1000%'
  AND amount_minor < 0
  AND transfer_id IS NULL
  AND lower(replace(replace(replace(replace(replace(replace(COALESCE(description, ''), 'á','a'), 'é','e'), 'í','i'), 'ó','o'), 'ú','u'), 'ñ','n')) NOT LIKE '%didi%'
  AND lower(replace(replace(replace(replace(replace(replace(COALESCE(description, ''), 'á','a'), 'é','e'), 'í','i'), 'ó','o'), 'ú','u'), 'ñ','n')) NOT LIKE '%uber%'
  AND lower(replace(replace(replace(replace(replace(replace(COALESCE(description, ''), 'á','a'), 'é','e'), 'í','i'), 'ó','o'), 'ú','u'), 'ñ','n')) NOT LIKE '%claro%'
  AND lower(replace(replace(replace(replace(replace(replace(COALESCE(description, ''), 'á','a'), 'é','e'), 'í','i'), 'ó','o'), 'ú','u'), 'ñ','n')) NOT LIKE '%epm%'
  AND lower(replace(replace(replace(replace(replace(replace(COALESCE(description, ''), 'á','a'), 'é','e'), 'í','i'), 'ó','o'), 'ú','u'), 'ñ','n')) NOT LIKE '%exito%'
  AND lower(replace(replace(replace(replace(replace(replace(COALESCE(description, ''), 'á','a'), 'é','e'), 'í','i'), 'ó','o'), 'ú','u'), 'ñ','n')) NOT LIKE '%dollarcity%';

-- 3. Income tax. Expenses only: the December bonus mentions the tax it
-- was reduced by, and it is a salary, not a payment to the DIAN.
--
-- Accountant fees for filing the return are NOT here. Preparing a return
-- and paying the tax are different expenses, and only one of them is what
-- the tax module has to predict.
UPDATE transactions
SET category_id = (SELECT id FROM categories WHERE name = 'Dian'),
    locked = 1,
    updated_at = '2026-09-10T00:00:00Z'
WHERE EXISTS (SELECT 1 FROM categories WHERE name = 'Dian')
  AND (lower(replace(replace(replace(replace(replace(replace(COALESCE(description, ''), 'á','a'), 'é','e'), 'í','i'), 'ó','o'), 'ú','u'), 'ñ','n')) LIKE '%impuesto de renta%' OR lower(replace(replace(replace(replace(replace(replace(COALESCE(description, ''), 'á','a'), 'é','e'), 'í','i'), 'ó','o'), 'ú','u'), 'ñ','n')) LIKE '%impuesto renta%')
  AND amount_minor < 0
  AND transfer_id IS NULL;

-- 4. The market, singular and plural. 018 asked for "mercados or" only,
-- and that missed most of them: the note is written both ways.
--
-- Both patterns need the space before "or", or "mercado libre" and
-- "mercados del norte" would come along.
UPDATE transactions
SET category_id = (SELECT id FROM categories WHERE name = 'Mercados OR'),
    locked = 1,
    updated_at = '2026-09-10T00:00:00Z'
WHERE EXISTS (SELECT 1 FROM categories WHERE name = 'Mercados OR')
  AND (lower(replace(replace(replace(replace(replace(replace(COALESCE(description, ''), 'á','a'), 'é','e'), 'í','i'), 'ó','o'), 'ú','u'), 'ñ','n')) LIKE '%mercado or%' OR lower(replace(replace(replace(replace(replace(replace(COALESCE(description, ''), 'á','a'), 'é','e'), 'í','i'), 'ó','o'), 'ú','u'), 'ñ','n')) LIKE '%mercados or%')
  AND amount_minor < 0
  AND transfer_id IS NULL
  AND lower(replace(replace(replace(replace(replace(replace(COALESCE(description, ''), 'á','a'), 'é','e'), 'í','i'), 'ó','o'), 'ú','u'), 'ñ','n')) NOT LIKE '%didi%'
  AND lower(replace(replace(replace(replace(replace(replace(COALESCE(description, ''), 'á','a'), 'é','e'), 'í','i'), 'ó','o'), 'ú','u'), 'ñ','n')) NOT LIKE '%uber%'
  AND lower(replace(replace(replace(replace(replace(replace(COALESCE(description, ''), 'á','a'), 'é','e'), 'í','i'), 'ó','o'), 'ú','u'), 'ñ','n')) NOT LIKE '%claro%'
  AND lower(replace(replace(replace(replace(replace(replace(COALESCE(description, ''), 'á','a'), 'é','e'), 'í','i'), 'ó','o'), 'ú','u'), 'ñ','n')) NOT LIKE '%epm%'
  AND lower(replace(replace(replace(replace(replace(replace(COALESCE(description, ''), 'á','a'), 'é','e'), 'í','i'), 'ó','o'), 'ú','u'), 'ñ','n')) NOT LIKE '%exito%'
  AND lower(replace(replace(replace(replace(replace(replace(COALESCE(description, ''), 'á','a'), 'é','e'), 'í','i'), 'ó','o'), 'ú','u'), 'ñ','n')) NOT LIKE '%dollarcity%';

-- 5. DidiClub is a subscription to a digital platform, not a ride, so it
-- belongs with the other platforms and never with Didi. 018 already kept
-- it out of Didi; this states where it does belong, so the answer no
-- longer depends on where each row happened to be sitting.
UPDATE transactions
SET category_id = (SELECT id FROM categories WHERE name = 'Tecnología y Plataformas digitales'),
    locked = 1,
    updated_at = '2026-09-10T00:00:00Z'
WHERE EXISTS (SELECT 1 FROM categories WHERE name = 'Tecnología y Plataformas digitales')
  AND (lower(replace(replace(replace(replace(replace(replace(COALESCE(description, ''), 'á','a'), 'é','e'), 'í','i'), 'ó','o'), 'ú','u'), 'ñ','n')) LIKE '%didiclub%' OR lower(replace(replace(replace(replace(replace(replace(COALESCE(description, ''), 'á','a'), 'é','e'), 'í','i'), 'ó','o'), 'ú','u'), 'ñ','n')) LIKE '%didi club%')
  AND amount_minor < 0
  AND transfer_id IS NULL;
