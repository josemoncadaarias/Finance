-- Migration 041 - the day it starts earning belongs to the product
--
-- Jose, 2026-09-22: "si esto es para decir desde cuando empieza a rentar cada
-- producto, para que tenemos entonces una fecha dentro del producto? creo que
-- debe primar es la fecha que dice el producto". He is right. What earns is
-- the product, and the account was only ever a container.
--
-- `yield_accounts.opening_on` was a floor for the whole account: nothing
-- before it was worked out, whatever each product said. In his data it sits a
-- day LATER than the products of five accounts, and months later than
-- Pibank's CDTs - so it is not a duplicate of the product's dates, it
-- overrules them.
--
-- Which is why this does not simply delete it. Each product is given the day
-- the app is ALREADY starting that product from, so every figure on the
-- screen stays exactly as it is - not because it was checked afterwards, but
-- because nothing about any product's start has changed. From here on the date
-- belongs to the product, one each, and moving one moves only that product.

ALTER TABLE yield_pockets ADD COLUMN earns_from TEXT NOT NULL DEFAULT '';

-- The account's floor, product by product. An account that was never enrolled
-- has no floor and no yields either; its products keep the empty string and
-- take the day they are enrolled on.
UPDATE yield_pockets
SET earns_from = (
  SELECT opening_on FROM yield_accounts WHERE account_id = yield_pockets.account_id)
WHERE account_id IN (SELECT account_id FROM yield_accounts);

-- Nothing is recomputed on purpose. Every product starts where it started
-- yesterday, so every day already written is still the day the engine would
-- write, and the days corrected by hand are untouched.
