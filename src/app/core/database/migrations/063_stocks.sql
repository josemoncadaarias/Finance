-- Migration 063 - the stock market: what was bought and sold at a broker
--
-- Jose, 2026-11-12: importing a broker's statement to keep the history of
-- each purchase - the ticker, the day, the price, how many - and to see what
-- it is worth today.
--
-- This book stands apart from the ledger. A trade is NOT a movement: the
-- account at the broker keeps its own movements (what was sent to it), and
-- nothing here changes a balance or net worth. `account_id` only says which
-- of the person's accounts the broker is, so a statement read twice adds
-- nothing and the positions can be seen per broker.
--
-- `amount_minor` is what the row did to the cash held at the broker, signed,
-- in cents of `currency`: a purchase is negative, a sale or a dividend
-- positive. `quantity_e8` is units times 100,000,000 and `price_e6` the price
-- times 1,000,000, both integers (rule 2: no floats stored). A split carries
-- its ratio: every unit became `split_num` over `split_den`.
--
-- `dedupe` is what makes a row itself (kind, ticker, moment, quantity, amount,
-- the broker's own number): a statement that covers months already imported
-- adds only what is new.

CREATE TABLE stock_trades (
  id           INTEGER PRIMARY KEY,
  account_id   INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
  kind         TEXT    NOT NULL CHECK (kind IN ('buy', 'sell', 'dividend', 'tax', 'fee', 'interest', 'split', 'deposit', 'withdrawal')),
  symbol       TEXT,
  asset        TEXT    CHECK (asset IS NULL OR asset IN ('stock', 'etf', 'crypto', 'other')),
  traded_on    TEXT    NOT NULL CHECK (traded_on GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  traded_at    TEXT,
  quantity_e8  INTEGER CHECK (quantity_e8 IS NULL OR (typeof(quantity_e8) = 'integer' AND quantity_e8 > 0)),
  price_e6     INTEGER CHECK (price_e6 IS NULL OR (typeof(price_e6) = 'integer' AND price_e6 >= 0)),
  amount_minor INTEGER NOT NULL DEFAULT 0 CHECK (typeof(amount_minor) = 'integer'),
  currency     TEXT    NOT NULL CHECK (length(currency) = 3),
  split_num    INTEGER CHECK (split_num IS NULL OR split_num > 0),
  split_den    INTEGER CHECK (split_den IS NULL OR split_den > 0),
  ref          TEXT,
  dedupe       TEXT    NOT NULL,
  source       TEXT    NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'statement')),
  batch        TEXT,
  note         TEXT,
  created_at   TEXT    NOT NULL,
  updated_at   TEXT    NOT NULL,
  CHECK (kind IN ('deposit', 'withdrawal', 'fee', 'interest', 'dividend', 'tax') OR symbol IS NOT NULL),
  CHECK (kind NOT IN ('buy', 'sell') OR quantity_e8 IS NOT NULL),
  CHECK (kind <> 'split' OR (split_num IS NOT NULL AND split_den IS NOT NULL))
);

CREATE INDEX idx_stock_trades_symbol ON stock_trades(symbol, traded_on);
CREATE INDEX idx_stock_trades_dedupe ON stock_trades(dedupe);

-- What the app knows about a ticker: its name, what it is, and how Google
-- Finance writes it (`quote`), which the person can correct (rule 7).
-- `facts` is a small JSON of the day's other figures (P/E, 52-week high...).
CREATE TABLE stock_instruments (
  symbol     TEXT PRIMARY KEY,
  name       TEXT,
  quote      TEXT,
  facts      TEXT,
  updated_at TEXT NOT NULL
);

-- One price per ticker per day, in the currency the ticker is held in. The
-- app keeps its own history from the first day it looked: 'sheet' came from
-- the person's own Google Sheets, 'manual' was typed, 'demo' is the sample
-- data's. A typed price is never written over by a fetched one of that day.
CREATE TABLE stock_prices (
  symbol      TEXT    NOT NULL,
  day         TEXT    NOT NULL CHECK (day GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  price_e6    INTEGER NOT NULL CHECK (typeof(price_e6) = 'integer' AND price_e6 > 0),
  previous_e6 INTEGER CHECK (previous_e6 IS NULL OR previous_e6 > 0),
  source      TEXT    NOT NULL CHECK (source IN ('sheet', 'manual', 'demo')),
  fetched_at  TEXT    NOT NULL,
  PRIMARY KEY (symbol, day)
);
