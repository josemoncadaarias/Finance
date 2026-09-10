-- Migration 017 - a rate can be given an end
--
-- Until now a rate ran until the next one for the same component replaced it,
-- and that is still the ordinary case: the bank moves a rate, you record the
-- new one, the old one ends by itself. The history cannot contradict itself
-- because there is only one date on each row.
--
-- What that cannot say is "this ended and nothing replaced it". A promotional
-- rate finishes and the product pays nothing until the bank announces
-- something; a term deposit matures. Without an end date the app would go on
-- paying the old rate forever, which is worse than paying zero: it is
-- confidently wrong.
--
-- So `valid_to` is optional and means exactly what it says. Past it the
-- component earns nothing - not the previous rate, which had already been
-- superseded, and not the next one, which has not started. Zero, until a new
-- rate says otherwise.

ALTER TABLE yield_rates ADD COLUMN valid_to TEXT
  CHECK (valid_to IS NULL OR valid_to GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]');
