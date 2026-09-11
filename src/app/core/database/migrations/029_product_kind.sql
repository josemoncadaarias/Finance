-- Migration 029 - a product has a kind, and the kind decides the withholding
--
-- Until now every product was treated as a high-yield savings product: the 7%
-- is withheld only on a day whose interest reaches 0.055 UVT, and then on the
-- whole of that day (Decreto 1625 de 2016, art. 1.2.4.2.87, written for
-- savings deposits).
--
-- A CDT is not withheld that way. Jose stated the rule on 2026-09-11: a CDT
-- always has the 7% withheld on its yield, with no threshold. Same rate, same
-- UVT - only the threshold does not apply. Still to be confirmed with an
-- accountant, like the rest of the withholding rules.
--
-- `kind` says which rule a product follows. Every product that exists today
-- is a high-yield one, which is the default, so no figure already worked out
-- changes. Only the column is added.

ALTER TABLE yield_pockets ADD COLUMN kind TEXT NOT NULL DEFAULT 'high_yield'
  CHECK (kind IN ('high_yield', 'cdt'));
