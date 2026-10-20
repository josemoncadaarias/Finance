-- Migration 058 - the interest rate a credit card charges
--
-- Jose, 2026-10-19 (the assistant's "¿Qué deuda pago primero?", mockups
-- 40d-40g). A card's debt can only be weighed against a loan's with its rate,
-- and no card had one. Optional, as the bank quotes it: effective annual
-- (E.A.) or monthly (M.V.); stored as E.A. scaled by 1,000,000, the way loan
-- rates are, with how it was typed kept so the form shows it back the same
-- way. A card without it works exactly as before.

ALTER TABLE accounts ADD COLUMN card_rate_scaled INTEGER
  CHECK (card_rate_scaled IS NULL OR (typeof(card_rate_scaled) = 'integer' AND card_rate_scaled > 0));
ALTER TABLE accounts ADD COLUMN card_rate_quoted TEXT
  CHECK (card_rate_quoted IS NULL OR card_rate_quoted IN ('ea', 'mv'));
