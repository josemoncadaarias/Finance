-- Migration 065 - a company's own figures, from its filings
--
-- Bolsa de valores shows what a company reported in its last annual filing
-- with the SEC (revenue, profit, debt, cash...), read from the SEC's public
-- data (2026-11-19). It is kept per ticker, apart from `facts`, which the
-- prices from Google write over on every refresh. JSON, NULL until read.

ALTER TABLE stock_instruments ADD COLUMN company TEXT;
