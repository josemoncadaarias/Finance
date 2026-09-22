-- Migration 040 - the opening figure becomes an ordinary income to a product
--
-- Jose asked for this many times before it was understood: "productos, saldos,
-- fechas desde que comienza a rentar, tasas, sus movimientos y punto". The
-- thing in the way was `yield_accounts.opening_cushion_minor` - the figure he
-- typed once per account saying what the bank had already paid him - which was
-- a mechanism of its own with a name nobody could use, and which the screens
-- called a "colchón".
--
-- It is two things wearing one name: an AMOUNT, and a DATE from which the app
-- works yields out. The date is real and stays, under its own name. The amount
-- is an income to a product and nothing more, which is what he said it was.
--
-- Where each one goes, in his words, asked and answered on 2026-09-22:
--
--   Rappi cuenta -> Principal          Bold -> Bolsillo Principal
--   Lulo -> Bolsillo Principal         Nu   -> Mi primera Cajita
--   Ualá -> Cuenta ahorros             ARQ USD -> Ahorro
--   Dale -> split across its two alcancías, any split that keeps the totals
--   Pibank -> nothing: it already has this income, entered by hand on the
--             10th of September with the note "Adjuste rendimientos", so its
--             opening figure is a second copy of the same money.
--
-- Dated the day BEFORE the figure starts counting, which is what it is: part
-- of the balance that was already there, not money arriving afterwards. That
-- date is what keeps every figure still. An entry before a product's stated
-- balance is already inside that figure, so neither the product's balance nor
-- what it earns counts it again - and the total of what the account has earned
-- does, exactly as the opening figure did.
--
-- Verified against the backup of 2026-09-22 11:41, restored and migrated, with
-- every account's yields worked out again from scratch: every product's
-- balance, every account's "rendimiento disponible" as the screen shows it,
-- and every peso the bank has paid come out to the figure they are today.
-- Nothing moves.

INSERT INTO cushion_adjustments
  (account_id, source, on_date, amount_minor, note, kind, pocket_id, created_at, updated_at)
SELECT y.account_id,
       'yield',
       date(y.opening_on, '-1 day'),
       y.opening_cushion_minor,
       'Rendimientos que el banco ya habia pagado',
       'other',
       p.id,
       '2026-09-22T12:00:00Z',
       '2026-09-22T12:00:00Z'
FROM yield_accounts y
JOIN accounts a ON a.id = y.account_id
JOIN yield_pockets p ON p.account_id = y.account_id
WHERE y.opening_cushion_minor <> 0
  AND (
    (a.name = 'Rappi cuenta' AND p.name = 'Principal') OR
    (a.name = 'Bold'         AND p.name = 'Bolsillo Principal') OR
    (a.name = 'Lulo'         AND p.name = 'Bolsillo Principal') OR
    (a.name = 'Nu'           AND p.name = 'Mi primera Cajita') OR
    (a.name = 'Ualá'         AND p.name = 'Cuenta ahorros') OR
    (a.name = 'ARQ USD'      AND p.name = 'Ahorro')
  );

-- Dale's is split across its two alcancías, as he asked. Half each, and the
-- complemento takes the odd peso so the two add up to exactly what was there.
INSERT INTO cushion_adjustments
  (account_id, source, on_date, amount_minor, note, kind, pocket_id, created_at, updated_at)
SELECT y.account_id, 'yield', date(y.opening_on, '-1 day'),
       y.opening_cushion_minor / 2,
       'Rendimientos que el banco ya habia pagado', 'other', p.id,
       '2026-09-22T12:00:00Z', '2026-09-22T12:00:00Z'
FROM yield_accounts y
JOIN accounts a ON a.id = y.account_id
JOIN yield_pockets p ON p.account_id = y.account_id
WHERE y.opening_cushion_minor <> 0
  AND a.name = 'Dale' AND p.name = 'Alcancía Principal';

INSERT INTO cushion_adjustments
  (account_id, source, on_date, amount_minor, note, kind, pocket_id, created_at, updated_at)
SELECT y.account_id, 'yield', date(y.opening_on, '-1 day'),
       y.opening_cushion_minor - (y.opening_cushion_minor / 2),
       'Rendimientos que el banco ya habia pagado', 'other', p.id,
       '2026-09-22T12:00:00Z', '2026-09-22T12:00:00Z'
FROM yield_accounts y
JOIN accounts a ON a.id = y.account_id
JOIN yield_pockets p ON p.account_id = y.account_id
WHERE y.opening_cushion_minor <> 0
  AND a.name = 'Dale' AND p.name = 'Alcancía complemento';

-- And the figure itself is gone. The column goes with the code that read it;
-- emptying it is what this migration is for.
UPDATE yield_accounts SET opening_cushion_minor = 0;

-- Worked out again from scratch, because the engine's own start rule changes
-- with this: it always begins at the date on record rather than letting a rate
-- pull it earlier when the figure was zero. Days corrected by hand stay.
DELETE FROM yield_days WHERE locked = 0;
DELETE FROM settings WHERE key = 'yields.accrual.mark';
