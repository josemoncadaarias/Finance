-- Migration 046 - the consumer price index, to say whether money kept its value
--
-- Jose, 2026-09-24: the yields summary should say whether an account, or all
-- of them, earned more than inflation over the month or the year - "para que
-- sepa un poco mas si esta por encima o por debajo de la inflacion".
--
-- The figure is the IPC the DANE publishes each month (base December 2018 =
-- 100), read from the Banco de la Republica's statistics service, series
-- 15000, on 2026-09-24. Checked against the DANE's own press releases: it
-- gives 5.10% for the year to December 2025 and 1.18% for January 2026,
-- exactly what those releases say.
--
-- Stored as the index times 100, an integer, because that is how the DANE
-- publishes it: two decimals, exact. Variations are worked out from it,
-- never stored, so there is one figure per month and nothing to disagree.
--
-- A month the DANE has not published yet is not a row: the app estimates it
-- and says so on the screen. `source` says where a row came from - the DANE,
-- or typed by the person - so a typed month is never overwritten by a fetch.
--
-- Colombia's index only. It says what pesos lost, and nothing about another
-- country's money.

CREATE TABLE inflation_months (
  month         TEXT    PRIMARY KEY CHECK (month LIKE '____-__'),
  index_scaled  INTEGER NOT NULL CHECK (typeof(index_scaled) = 'integer' AND index_scaled > 0),
  source        TEXT    NOT NULL CHECK (source IN ('dane', 'typed')),
  fetched_at    TEXT    NOT NULL
);

INSERT INTO inflation_months (month, index_scaled, source, fetched_at)
SELECT column1, column2, 'dane', '2026-09-24T00:00:00Z' FROM (VALUES
  ('2019-12', 10380), ('2020-01', 10424), ('2020-02', 10494), ('2020-03', 10553), ('2020-04', 10570), ('2020-05', 10536),
  ('2020-06', 10497), ('2020-07', 10497), ('2020-08', 10496), ('2020-09', 10529), ('2020-10', 10523), ('2020-11', 10508),
  ('2020-12', 10548), ('2021-01', 10591), ('2021-02', 10658), ('2021-03', 10712), ('2021-04', 10776), ('2021-05', 10884),
  ('2021-06', 10878), ('2021-07', 10914), ('2021-08', 10962), ('2021-09', 11004), ('2021-10', 11006), ('2021-11', 11060),
  ('2021-12', 11141), ('2022-01', 11326), ('2022-02', 11511), ('2022-03', 11626), ('2022-04', 11771), ('2022-05', 11870),
  ('2022-06', 11931), ('2022-07', 12027), ('2022-08', 12150), ('2022-09', 12263), ('2022-10', 12351), ('2022-11', 12446),
  ('2022-12', 12603), ('2023-01', 12827), ('2023-02', 13040), ('2023-03', 13177), ('2023-04', 13280), ('2023-05', 13338),
  ('2023-06', 13378), ('2023-07', 13445), ('2023-08', 13539), ('2023-09', 13611), ('2023-10', 13645), ('2023-11', 13709),
  ('2023-12', 13772), ('2024-01', 13898), ('2024-02', 14049), ('2024-03', 14148), ('2024-04', 14232), ('2024-05', 14292),
  ('2024-06', 14338), ('2024-07', 14367), ('2024-08', 14367), ('2024-09', 14402), ('2024-10', 14383), ('2024-11', 14422),
  ('2024-12', 14488), ('2025-01', 14624), ('2025-02', 14790), ('2025-03', 14868), ('2025-04', 14966), ('2025-05', 15014),
  ('2025-06', 15030), ('2025-07', 15071), ('2025-08', 15099), ('2025-09', 15148), ('2025-10', 15176), ('2025-11', 15187),
  ('2025-12', 15227), ('2026-01', 15407), ('2026-02', 15573), ('2026-03', 15694), ('2026-04', 15817), ('2026-05', 15891),
  ('2026-06', 15953), ('2026-07', 15979), ('2026-08', 16042));
