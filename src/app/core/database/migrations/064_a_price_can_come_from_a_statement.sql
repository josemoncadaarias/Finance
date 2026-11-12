-- Migration 064 - a price can come from a broker's own statement
--
-- A broker's list of what is held today prints each ticker's price on the
-- day the list was made (Jose, 2026-11-12: his broker's "open positions"
-- file). That is a real price of a real day, neither fetched nor typed, so
-- `stock_prices.source` gains 'statement'. SQLite cannot widen a CHECK in
-- place: the table is made again with its rows. A typed price still wins
-- over any other of the same day.

CREATE TABLE stock_prices_new (
  symbol      TEXT    NOT NULL,
  day         TEXT    NOT NULL CHECK (day GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  price_e6    INTEGER NOT NULL CHECK (typeof(price_e6) = 'integer' AND price_e6 > 0),
  previous_e6 INTEGER CHECK (previous_e6 IS NULL OR previous_e6 > 0),
  source      TEXT    NOT NULL CHECK (source IN ('sheet', 'manual', 'demo', 'statement')),
  fetched_at  TEXT    NOT NULL,
  PRIMARY KEY (symbol, day)
);

INSERT INTO stock_prices_new (symbol, day, price_e6, previous_e6, source, fetched_at)
SELECT symbol, day, price_e6, previous_e6, source, fetched_at FROM stock_prices;

DROP TABLE stock_prices;

ALTER TABLE stock_prices_new RENAME TO stock_prices;
