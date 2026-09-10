-- Migration 013 - every account earns on the figure Jose stated, and nothing else
--
-- The base has been derived from a sum for six migrations and it has been wrong
-- in a different way each time: the ledger plus the cushion, minus a part that
-- was "not earning", plus a proportion of something. Every one of those was an
-- inference about what a number Jose gave actually meant, and every one was
-- corrected by him afterwards.
--
-- So the sum goes away. Each pocket now carries the figure he stated, on the
-- date he read it, and the engine adds only what the ledger says has MOVED
-- since - which is what "new movements are added here too" means. Nothing else
-- touches the base. The cushion is a record of what has been earned and stays
-- out of it, as of migration 011.
--
-- The figures below are the ones from the list of 2026-09-09, dated that day,
-- with two exceptions Jose corrected afterwards and which are already right:
--
--   * Dale keeps its two alcancias, 10,096,451.00 and 10,097,467.25, which he
--     read off the bank on 2026-09-10 and which produce the 2,762.25 / 2,762.53
--     the app shows him.
--   * Plata keeps 200,057.44 from migration 012.
--
-- Rappi cuenta is the one still open: the list said 4,917,434.98 and he later
-- wrote "el saldo inicial que te pasé de los 67 millones". This migration takes
-- the list, because that is what he pointed at last - and the screen now shows
-- what each account earns on, so a wrong one is one tap to fix.

-- Nothing follows the ledger blindly any more.
UPDATE yield_pockets SET source = 'manual', updated_at = '2026-09-11T00:00:00Z';

INSERT INTO yield_pocket_balances (pocket_id, valid_from, amount_minor, note, created_at, updated_at)
SELECT p.id, '2026-09-09', v.stated, 'Stated by Jose on 2026-09-09',
       '2026-09-11T00:00:00Z', '2026-09-11T00:00:00Z'
FROM yield_pockets p
JOIN accounts a ON a.id = p.account_id
JOIN (SELECT 'Rappi cuenta' AS acct, 491743498 AS stated) v ON v.acct = a.name
WHERE NOT EXISTS (SELECT 1 FROM yield_pocket_balances b WHERE b.pocket_id = p.id);

INSERT INTO yield_pocket_balances (pocket_id, valid_from, amount_minor, note, created_at, updated_at)
SELECT p.id, '2026-09-09', 111549946, 'Stated by Jose on 2026-09-09', '2026-09-11T00:00:00Z', '2026-09-11T00:00:00Z'
FROM yield_pockets p JOIN accounts a ON a.id = p.account_id
WHERE a.name = 'Ualá' AND NOT EXISTS (SELECT 1 FROM yield_pocket_balances b WHERE b.pocket_id = p.id);

INSERT INTO yield_pocket_balances (pocket_id, valid_from, amount_minor, note, created_at, updated_at)
SELECT p.id, '2026-09-09', 108017339, 'Stated by Jose on 2026-09-09', '2026-09-11T00:00:00Z', '2026-09-11T00:00:00Z'
FROM yield_pockets p JOIN accounts a ON a.id = p.account_id
WHERE a.name = 'Pibank' AND NOT EXISTS (SELECT 1 FROM yield_pocket_balances b WHERE b.pocket_id = p.id);

INSERT INTO yield_pocket_balances (pocket_id, valid_from, amount_minor, note, created_at, updated_at)
SELECT p.id, '2026-09-09', 5123061, 'Stated by Jose on 2026-09-09', '2026-09-11T00:00:00Z', '2026-09-11T00:00:00Z'
FROM yield_pockets p JOIN accounts a ON a.id = p.account_id
WHERE a.name = 'Bold' AND NOT EXISTS (SELECT 1 FROM yield_pocket_balances b WHERE b.pocket_id = p.id);

INSERT INTO yield_pocket_balances (pocket_id, valid_from, amount_minor, note, created_at, updated_at)
SELECT p.id, '2026-09-09', 1670116, 'Stated by Jose on 2026-09-09', '2026-09-11T00:00:00Z', '2026-09-11T00:00:00Z'
FROM yield_pockets p JOIN accounts a ON a.id = p.account_id
WHERE a.name = 'Lulo' AND NOT EXISTS (SELECT 1 FROM yield_pocket_balances b WHERE b.pocket_id = p.id);

INSERT INTO yield_pocket_balances (pocket_id, valid_from, amount_minor, note, created_at, updated_at)
SELECT p.id, '2026-09-09', 1690262, 'Stated by Jose on 2026-09-09', '2026-09-11T00:00:00Z', '2026-09-11T00:00:00Z'
FROM yield_pockets p JOIN accounts a ON a.id = p.account_id
WHERE a.name = 'Nu' AND NOT EXISTS (SELECT 1 FROM yield_pocket_balances b WHERE b.pocket_id = p.id);

INSERT INTO yield_pocket_balances (pocket_id, valid_from, amount_minor, note, created_at, updated_at)
SELECT p.id, '2026-09-09', 1590, 'Stated by Jose on 2026-09-09', '2026-09-11T00:00:00Z', '2026-09-11T00:00:00Z'
FROM yield_pockets p JOIN accounts a ON a.id = p.account_id
WHERE a.name = 'ARQ USD' AND NOT EXISTS (SELECT 1 FROM yield_pocket_balances b WHERE b.pocket_id = p.id);

-- The four he stated as zero. Recorded rather than left absent: "this earns on
-- nothing" is an answer, and an absent figure would silently fall back to the
-- ledger the day someone changed the pocket back.
INSERT INTO yield_pocket_balances (pocket_id, valid_from, amount_minor, note, created_at, updated_at)
SELECT p.id, '2026-09-09', 0, 'Stated by Jose on 2026-09-09', '2026-09-11T00:00:00Z', '2026-09-11T00:00:00Z'
FROM yield_pockets p JOIN accounts a ON a.id = p.account_id
WHERE a.name IN ('Pibank para renta', 'Global66 COP', 'Global66 USD', 'ARQ EUR', 'Plenti')
  AND NOT EXISTS (SELECT 1 FROM yield_pocket_balances b WHERE b.pocket_id = p.id);
