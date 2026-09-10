-- Migration 008 - pockets
--
-- One account, several pots of money that earn on their own.
--
-- Dale is two "alcancias": Principal and Complemento. The bank pays each of
-- them separately, which means each one is its own pago o abono en cuenta —
-- and the withholding threshold in articulo 1.2.4.2.87 is measured per
-- payment, not per account. On 2026-09-10 that is the difference between:
--
--   together   20,193,918.25 at 10.5% -> 5,524.78 a day -> above 0.055 UVT,
--                                        386.73 withheld
--   separately 10,096,451.00 -> 2,762.25   and   10,097,467.25 -> 2,762.53
--                                        both below the threshold,
--                                        nothing withheld
--
-- Adding them up first and taxing the total charges withholding that is not
-- owed. Other banks do the same thing under other names — bolsillos, metas,
-- espacios — so this is not a special case for Dale.
--
-- What a pocket holds comes from one of two places:
--
--   * `ledger`  — the account's own balance, as the movements leave it, minus
--     whatever is recorded as not earning. This is what every account had
--     before this migration, and every account keeps exactly one of these
--     unless someone splits it.
--   * `manual`  — a figure typed in, dated, because the ledger does not know
--     how a balance is split between pockets. Movements do not say which
--     pocket they landed in.
--
-- An account with manual pockets and no ledger pocket can drift away from its
-- own balance as movements arrive. The app compares the two and says so rather
-- than silently accruing on a stale figure.
--
-- The cushion stays a figure per account, not per pocket: the opening figure
-- Jose measured is one number and splitting it would be inventing data. It
-- earns on the first pocket, which is where a single-pocket account had it all
-- along.

CREATE TABLE yield_pockets (
  id           INTEGER PRIMARY KEY,
  account_id   INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name         TEXT    NOT NULL,

  -- Where this pocket's balance comes from. At most one `ledger` pocket per
  -- account: two of them would each claim the whole balance.
  source       TEXT    NOT NULL DEFAULT 'ledger' CHECK (source IN ('ledger', 'manual')),

  sort_order   INTEGER NOT NULL DEFAULT 0,
  note         TEXT,
  created_at   TEXT    NOT NULL,
  updated_at   TEXT    NOT NULL,

  UNIQUE (account_id, name)
);

CREATE INDEX idx_yield_pockets_account ON yield_pockets(account_id, sort_order);

-- What a manual pocket held, from a date. Dated for the same reason every
-- other history here is: money moves between pockets, and a day has to be
-- worked out against what was true on it.
CREATE TABLE yield_pocket_balances (
  id           INTEGER PRIMARY KEY,
  pocket_id    INTEGER NOT NULL REFERENCES yield_pockets(id) ON DELETE CASCADE,
  valid_from   TEXT    NOT NULL CHECK (valid_from GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  amount_minor INTEGER NOT NULL CHECK (typeof(amount_minor) = 'integer' AND amount_minor >= 0),
  note         TEXT,
  created_at   TEXT    NOT NULL,
  updated_at   TEXT    NOT NULL,

  UNIQUE (pocket_id, valid_from)
);

CREATE INDEX idx_yield_pocket_balances ON yield_pocket_balances(pocket_id, valid_from);

-- Every account already earning gets one pocket that behaves exactly as it did
-- before: it holds the account's balance. Named after the account, and the
-- screen hides the name while there is only one.
INSERT INTO yield_pockets (account_id, name, source, sort_order, created_at, updated_at)
SELECT y.account_id, a.name, 'ledger', 0, '2026-09-10T00:00:00Z', '2026-09-10T00:00:00Z'
FROM yield_accounts y
JOIN accounts a ON a.id = y.account_id;

-- ---------------------------------------------------------------------------
-- A day now belongs to a pocket
-- ---------------------------------------------------------------------------
--
-- Rebuilt rather than altered: the primary key changes, and SQLite cannot
-- alter one. Nothing references yield_days, so a rename-copy-drop is safe with
-- foreign keys left on.
--
-- `account_id` is kept alongside `pocket_id` even though the pocket knows it.
-- It is what makes the cushion of an account one query instead of a join, and
-- the cushion is read on every row of the list.

ALTER TABLE yield_days RENAME TO yield_days_old;

CREATE TABLE yield_days (
  pocket_id          INTEGER NOT NULL REFERENCES yield_pockets(id) ON DELETE CASCADE,
  account_id         INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  on_date            TEXT    NOT NULL CHECK (on_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),

  balance_minor      INTEGER NOT NULL CHECK (typeof(balance_minor) = 'integer'),
  annual_rate_scaled INTEGER NOT NULL CHECK (typeof(annual_rate_scaled) = 'integer' AND annual_rate_scaled >= 0),

  gross_minor        INTEGER NOT NULL CHECK (typeof(gross_minor) = 'integer' AND gross_minor >= 0),
  withholding_minor  INTEGER NOT NULL DEFAULT 0 CHECK (typeof(withholding_minor) = 'integer' AND withholding_minor >= 0),
  net_minor          INTEGER NOT NULL CHECK (typeof(net_minor) = 'integer' AND net_minor >= 0),
  actual_net_minor   INTEGER CHECK (actual_net_minor IS NULL OR typeof(actual_net_minor) = 'integer'),

  withholding_unknown INTEGER NOT NULL DEFAULT 0 CHECK (withholding_unknown IN (0, 1)),

  locked             INTEGER NOT NULL DEFAULT 0 CHECK (locked IN (0, 1)),
  computed_at        TEXT    NOT NULL,

  PRIMARY KEY (pocket_id, on_date),
  CHECK (net_minor = gross_minor - withholding_minor)
);

CREATE INDEX idx_yield_days_account ON yield_days(account_id, on_date);

INSERT INTO yield_days (pocket_id, account_id, on_date, balance_minor, annual_rate_scaled,
                        gross_minor, withholding_minor, net_minor, actual_net_minor,
                        withholding_unknown, locked, computed_at)
SELECT p.id, o.account_id, o.on_date, o.balance_minor, o.annual_rate_scaled,
       o.gross_minor, o.withholding_minor, o.net_minor, o.actual_net_minor,
       o.withholding_unknown, o.locked, o.computed_at
FROM yield_days_old o
JOIN yield_pockets p ON p.account_id = o.account_id;

DROP TABLE yield_days_old;

-- ---------------------------------------------------------------------------
-- Dale, the reason this exists
-- ---------------------------------------------------------------------------
--
-- Two alcancias, both at the account's 10.5% E.A., with the balances Jose read
-- on 2026-09-10. They add up to 20,193,918.25, which is exactly what the
-- ledger says Dale holds — so nothing is being invented, only split.
--
-- The ledger pocket created above becomes Principal, which keeps the day
-- already worked out attached to something real; it changes source because a
-- ledger pocket and a manual one cannot both claim the same balance.

UPDATE yield_pockets
SET name = 'Alcancía principal', source = 'manual', sort_order = 0,
    updated_at = '2026-09-10T00:00:00Z'
WHERE account_id = (SELECT id FROM accounts WHERE name = 'Dale');

INSERT INTO yield_pocket_balances (pocket_id, valid_from, amount_minor, note, created_at, updated_at)
SELECT id, '2026-09-10', 1009645100, 'Read on 2026-09-10', '2026-09-10T00:00:00Z', '2026-09-10T00:00:00Z'
FROM yield_pockets
WHERE account_id = (SELECT id FROM accounts WHERE name = 'Dale');

INSERT INTO yield_pockets (account_id, name, source, sort_order, created_at, updated_at)
SELECT id, 'Alcancía complemento', 'manual', 1, '2026-09-10T00:00:00Z', '2026-09-10T00:00:00Z'
FROM accounts WHERE name = 'Dale';

INSERT INTO yield_pocket_balances (pocket_id, valid_from, amount_minor, note, created_at, updated_at)
SELECT id, '2026-09-10', 1009746725, 'Read on 2026-09-10', '2026-09-10T00:00:00Z', '2026-09-10T00:00:00Z'
FROM yield_pockets
WHERE name = 'Alcancía complemento'
  AND account_id = (SELECT id FROM accounts WHERE name = 'Dale');
