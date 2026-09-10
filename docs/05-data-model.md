# Data model and SQLite schema

Phase 1. The schema lives in
`src/app/core/database/migrations/001_initial_schema.sql`, which is the single
source of truth; this document explains the reasoning behind it.

Everything here is exercised by 114 tests that run against a real SQLite engine:

```
node tools/db/run-tests.mjs
```

No dependencies and no build step — Node 22+ ships both `node:sqlite` and
TypeScript type stripping. That will become an npm script once the Angular
project exists.

---

## Conventions

| Suffix | Meaning | Example |
|---|---|---|
| `*_minor` | Integer amount in cents | `50,200.09` is `5020009` |
| `*_scaled` | Integer rate multiplied by 10,000 | `4,214.00` is `42140000` |
| `*_on` | ISO calendar day, `YYYY-MM-DD` | `2024-08-13` |
| `*_at` | ISO instant | `2026-09-08T12:00:00Z` |

Booleans are `INTEGER` 0/1, because SQLite has no boolean type. Dates are text
in ISO form, because SQLite has no date type either and ISO sorts
chronologically as plain text, which makes `ORDER BY` and `BETWEEN` work
without conversion.

### Why integrity is enforced with CHECK constraints

SQLite does not enforce declared column types — an `INTEGER` column will hold
`'hello'` without complaint. So every invariant that matters is written as an
explicit `CHECK`. `STRICT` tables would do this natively but need SQLite 3.37+,
and the version `@capacitor-community/sqlite` ships on a device is not
confirmed yet; worth revisiting once it is.

Type affinity does help: an `INTEGER` column converts `'-5020000'` to a real
integer before the CHECK runs, and refuses `'-50200.09'`, `'abc'` and any
float. Verified in `tools/db/schema.test.mjs`.

### Foreign keys are off by default

SQLite ignores `FOREIGN KEY` unless `PRAGMA foreign_keys = ON` is issued **per
connection**. Both drivers do it on open. Forget it and deleting an account
silently orphans thousands of transactions.

---

## The fourteen tables

### Catalog

**`currencies`** — `COP`, `USD` and `EUR`, all with `minor_units = 2`.

**`account_groups`** — one real account that holds several currencies:
Global66 (COP and USD), ARQ (USD and EUR). Balances in different currencies
cannot be added, so each currency is its own row in `accounts` and this table
is what ties them back into the account the user actually has.
Single-currency accounts — Bancolombia, Nequi, Plata — leave `group_id` null.

`UNIQUE (group_id, currency_code)` stops a group holding the same currency
twice. Ungrouped accounts are exempt, because SQLite treats NULLs as distinct
in a unique index.

A group carries no balance of its own: 500 USD plus 300 EUR is not a number
without choosing a rate, and choosing it belongs to whoever is asking, not to
the repository. `balancesByGroup()` returns one entry per group with a balance
per currency, and no total.

The payoff shows up in an unexpected place: converting COP to USD *inside*
Global66 is an ordinary transfer between two of its rows, so the rate the
provider applied is captured by machinery that already exists. That rate is
otherwise unobtainable.

**`custom_icons`** — user-supplied images, stored as `BLOB` inside the
database. Keeping them in the database rather than in a folder means a backup
is a single file: copy `finance.db` and the logos come along. Images are
downscaled to 256×256 before insert and capped at 100 KB, so fifty of them cost
about 1.5 MB — less than the transactions.

**`accounts`** — the icon is either `builtin_icon` (a name from Ionic's
catalog) or `custom_icon_id` (a user image), never both and never neither:

```sql
CHECK ((builtin_icon IS NULL) <> (custom_icon_id IS NULL))
```

`credit_limit_minor` is only allowed on `type = 'credit'`. The card's balance
is the debt; available credit is limit − |debt|.

Two opening-balance columns, not one: `opening_balance_minor` is in the
account's own currency, and `opening_balance_base_minor` is the same figure in
COP, frozen at opening day. A USD account's opening balance cannot be added
into a COP total, and this bug was found by writing the net-worth query.

**`categories`** — unique on (`name`, `kind`), which is how the importer
matches them. Same icon rule as accounts. `parent_id` allows grouping later
without a migration.

### Core ledger

**`transactions`** — the 12,890 rows. Negative is money out, positive is money
in, so a balance is one `SUM`.

The three currency columns exist together:

| Column | Holds |
|---|---|
| `amount_minor` | The amount in the account's currency |
| `rate_scaled` | The rate that bank actually applied |
| `amount_base_minor` | The COP equivalent, **frozen** |

`amount_base_minor` is derived once, on write, and never recalculated when the
TRM moves. That is the whole point: a purchase that cost 100,000 COP in 2024
still cost 100,000 COP in 2027. `rate_source` records where the rate came from
(`manual`, `derived`, `trm`, `cached`) and `confidence` marks the rows whose
COP figure was eyeballed, so the reconciliation can adjust only those.

**`transfers`** — a header. The two legs live in `transactions` and point back
at it. That is deliberate: with the amounts on the header, every balance
calculation would have to consult two tables and remember to. This way a
balance stays a single `SUM(amount_minor)` and cross-currency transfers fall
out for free — 100,000 COP leaves Rappi, 23.73 USD arrives at ARQ, one
transfer.

Constraints that keep the two consistent:

```sql
CHECK ((transfer_id IS NULL) = (transfer_leg IS NULL))
CHECK ((transfer_id IS NULL) = (category_id IS NOT NULL))  -- a leg has no category
CHECK (transfer_leg IS NULL
       OR (transfer_leg = 'from' AND amount_minor <= 0)
       OR (transfer_leg = 'to'   AND amount_minor >= 0))
```

Deleting the header cascades to both legs, so a transfer cannot lose half of
itself.

### Rates

**`exchange_rates`** — local cache of the official TRM, keyed by date and
currency pair. This is the *official* rate, which is not what a bank charged:
that one lives on the transaction. The gap between them is the provider's
spread.

### The cushion — yields and cashback

Interest and cashback are money that was earned and never counted on. They are
not part of net worth and not part of the balance of the account that produced
them: they are a *cushion*, and moving any of it into an account is a
deliberate act, which the real history already shows happening (2026-08-13,
part of the accumulated yield of Rappi cuenta, taken to pay the income-tax
return).

**`yield_accounts`** — which accounts the app accrues, and from when. Being in
this table is the switch: XTB, eToro, Fiducuenta and Multinversion are simply
not in it, because their return is the market's and already arrives as ordinary
movements. It also holds the opening cushion — the figure typed in once,
because five years of daily yields cannot be reconstructed.

**`yield_rates`** — the effective annual rate history, maintained by hand
because bank rates are not reliably available online. A rate change adds a row
rather than editing one, and there is no `valid_to`: the next row ends the
previous one, so the history cannot contradict itself. A rate may be banded by
balance, and the band the balance falls into applies to the whole balance.

**`yield_days`** — one row per account per day: the balance it was worked out
on, the rate in force, gross, withholding and net, plus `actual_net_minor` for
what the bank really paid. Daily rather than monthly because the withholding
rule is a per-day threshold, and because a figure that carries its own inputs
can be explained rather than only recomputed.

The daily rate is not the annual one over 365. An effective annual rate already
contains its compounding, so the daily one is `(1 + annual) ^ (1/365) - 1`;
dividing would under-pay by about 5% of the figure, every day. The accrual base
is the account's ledger balance plus the cushion, because the bank did pay
those yields in even though the ledger never recorded them.

**`cashback_rules`** — the conditions as they stood on a date: a percentage,
optionally limited to one category, optionally requiring a minimum balance in
another account. Both real cases fit: the Rappi card's reward that depends on
Rappi cuenta holding at least 500,000, and Plata's that depends on the
category. Conditions change, so they are history, not settings.

**`cashback_entries`** — the reward one purchase produced under one rule,
`computed_minor` beside `actual_minor`. Deleting the purchase deletes the
reward: a figure with nothing behind it cannot be checked against a statement.
A reward typed in from a statement has no purchase and stands on its own.

**`cushion_withdrawals`** — money moved out of the cushion and into an account,
pointing at the movement it became so it is never counted twice. It outlives
that movement being deleted, so the cushion never quietly grows back.

**`tax_parameters`** — the dated figures a withholding rule is made of: the UVT
in pesos, the daily threshold in UVT, the percentage, and whether the
percentage applies to the whole yield or only the excess. Ships **empty**.
Yields on a savings account do withhold and cashback does not, but the exact
figures come from the Estatuto Tributario and the DIAN resolution of the year,
and CLAUDE.md forbids taking them from an LLM. Until one is entered and marked
confirmed, the accrual runs without withholding and flags every day it could
not decide.

### Infrastructure

**`import_batches`** — one row per import run, with the file hash and counts.

**`review_queue`** — anything the importer could not resolve lands here instead
of entering the ledger wrong. A row cannot be marked resolved without a
timestamp.

**`settings`** — key/value. Currently just `base_currency`.

---

## Re-importable imports

The Monefy CSV is re-exported regularly and carries the whole history again
plus whatever is new, so the importer has to recognise what it has already
seen. It does that with a fingerprint: five normalised fields joined by a
separator.

```
2021-06-28 | Bancolombia | Comunicaciones | -5177409 | Claro datos
```

The first design hashed that with SHA-256. Storing the readable string instead
turned out better on every axis: `crypto.subtle` in a browser is async and
would have made every call site async for nothing, a readable fingerprint can
be shown in the review queue and understood at a glance rather than being 64
characters of hex, and equality becomes exact instead of merely very likely.
The cost is about 80 bytes per row — roughly 1 MB across the whole backup,
against a database already several MB in size.

Normalising means decoding the file correctly, trimming, collapsing repeated
spaces, and converting the amount to minor units *before* hashing, so
`-51,774.09` and `-51774.09` agree. Case and accents are left alone: renaming
an account in Monefy should be visible, not papered over.

**Legitimate duplicates.** Six pairs of byte-identical rows exist in the real
backup — two identical transfers on the same day, the same 2,600 bus fare
twice. A fingerprint alone would collapse them, so `import_seq` numbers repeats
in file order and the unique index covers the pair:

```sql
CREATE UNIQUE INDEX idx_transactions_import
  ON transactions(import_fingerprint, import_seq)
  WHERE import_fingerprint IS NOT NULL;
```

The index is partial, so the many hand-created rows with no fingerprint are not
constrained by it.

| Situation | What the importer does |
|---|---|
| In the file, not in the database | Insert |
| In both | Skip |
| In the database, not in the file | **Never deletes.** Flags it for review |

**Known limitation.** Editing a row inside Monefy changes its fingerprint,
which looks exactly like a delete plus an insert. There is no way to tell them
apart, because the CSV carries no stable id. The importer surfaces both and
lets the user decide.

**Slot stability — what actually has to hold.** A row is recognised on
re-import by its fingerprint *and* its `import_seq`, and `import_seq` counts
its position **among rows sharing that fingerprint** — not its position in the
file. So the requirement is narrower than "the file keeps its order".

The first comparison (`monefy-2026-09-07.csv` against `monefy-2026-09-08.csv`)
suggested the stronger property: 8 rows appended, the old file an exact prefix
of the new. **That reading was too strong, and the next export disproved it.**
Comparing `monefy-2026-09-08.csv` against `monefy-2026-09-08-1748.csv`, the
single new row was *inserted* at position 12,893 rather than appended — Monefy
keeps the file in date order, so a row added on a day that already has rows
lands in the middle.

The property that matters held anyway: all 12,898 existing rows kept the same
fingerprint and sequence, and the re-import inserted exactly one row and
rewrote nothing.

**Residual risk, small but real.** A seq number shifts only when a new row
shares a fingerprint with an existing one *and* sorts before it. That needs a
new movement identical to an old one — same day, account, category, amount and
description — added to a day that already holds its twin. `compare-exports.mjs`
checks for exactly this and says `WARNING` when it happens, so run it on each
new export.

**Manual edits win.** Editing a transaction through the repository sets
`locked = 1`, and a re-import skips locked rows. A hand correction is the true
version by definition.

---

## Migrations

SQLite has no migration tooling. It has `PRAGMA user_version`, an integer
stored inside the database file, starting at 0. `migration-runner.ts` reads it,
applies whatever comes after it in order, and updates it. That is the whole
mechanism — EF Core migrations without the framework.

Each migration runs in its own transaction, so a failure leaves the database at
the last version that fully succeeded rather than half-upgraded. A database
whose version is *ahead* of the code is refused rather than written to.

**Adding one:**

1. Create `00N_what_it_does.sql`. Never edit a migration that has shipped —
   someone's phone has already run it.
2. Run `node tools/db/build-migrations.mjs` (Angular cannot import `.sql`, so
   the files are inlined into `statements.generated.ts`).
3. Add a case to the tests.

Note that older SQLite cannot `DROP COLUMN` or change a column type. When that
comes up the pattern is: create the new table, copy, drop the old, rename.

---

## Code layout

```
src/app/core/database/
  migrations/
    001_initial_schema.sql        the schema; source of truth
    statements.generated.ts       generated, do not edit
    migration-runner.ts           user_version logic
  types.ts                        row types, mirroring the columns
  money.ts                        minor units, rates, formatting
  sql-driver.ts                   the engine-agnostic seam
  capacitor-sql-driver.ts         the device implementation (UNVERIFIED)
  database.service.ts             opens and migrates on startup
  repositories/                   the only code that writes SQL
tools/db/                         tests and the generator; not shipped
```

`SqlDriver` is a small interface so the same repositories run against
`@capacitor-community/sqlite` on the phone and `node:sqlite` in tests. The
tests exercise the real code rather than a mock, and the plugin's API is
confined to one file.

`capacitor-sql-driver.ts` is the one part **not verified**: the plugin is not
installed yet. If the app misbehaves on device while the tests stay green, look
there first.

---

## Money never touches a float

`parseAmountToMinor` works on the digit strings, because
`parseFloat('9421.28') * 100` is `942127.9999999999` — and `9421.28` is a real
opening balance from the backup. More decimals than the currency allows is an
error rather than a silent truncation.

Amounts in COP cents get large (`66,750,767.94` is `6675076794`) but stay far
below `Number.MAX_SAFE_INTEGER`; every helper checks anyway and throws rather
than quietly losing precision.

---

## Comparing two exports

Each Monefy export is kept as its own file and none is ever overwritten:

```
data/monefy-YYYY-MM-DD.csv          one export that day
data/monefy-YYYY-MM-DD-HHMM.csv     a second one the same day
```

The 24-hour time is only added when a day holds more than one export. Monefy's
own `Monefy.Data.8-9-2026.csv` gets renamed because `8-9` is ambiguous between
August and September and sorts alphabetically rather than by date.

**Do not sort these names as plain strings.** `-` sorts before `.`, so
`monefy-2026-09-08-1748.csv` lands *before* `monefy-2026-09-08.csv` — the
convention breaks exactly in the case it exists for. The importer got this
wrong on its first run with two same-day exports and silently picked the older
file. `exportOrder()` in `tools/db/import.mjs` parses the date and time
instead, treating a missing time as the earliest that day, and
`export-naming.test.mjs` pins the behaviour.
 Comparing consecutive exports is the only way to
check the order-stability assumption, and it also shows what the importer will
have to deal with on a re-run:

```
node --import ./tools/db/register-ts.mjs tools/db/compare-exports.mjs \
  data/monefy-2026-09-07.csv data/monefy-2026-10-01.csv
```

It reports whether the old export is a prefix of the new one (order stable),
which rows were added, which went missing — edited or deleted inside Monefy —
and any new accounts or categories. Read-only: it touches no database.

---

## Running in the browser

`ionic serve` is a real development environment, not a demo: the same schema,
the same repositories, the same importer. Three things had to be right, and
each one failed at runtime while every build and type check stayed green.

**`sql.js` is pinned to 1.11.0, exactly.** `jeep-sqlite` bundles the sql.js
JavaScript glue at its own build time and declares `^1.11.0`, so npm happily
installs 1.14.2 — and the `.wasm` binary that ships with the app has to match
the glue byte for byte. Mismatched, it fails as:

```
LinkError: WebAssembly.instantiate(): Import #34 "a" "I": function import requires a callable
```

Nothing about that message points at a version. Do not let this float.

**The web store opens asynchronously, and `initWebStore()` does not wait.** It
records what it finds and returns:

```js
if (!this.isWebStoreOpen) {
  this.isWebStoreOpen = await this.jeepSqliteElement.isStoreOpen();
}
```

Ask too early and the answer is `false`, with the failure surfacing much later
as "WebStore is not open yet". `web-sqlite.ts` waits on the component's
`componentOnReady()` and then polls `isStoreOpen()`.

**Saving ends the transaction.** Flushing to IndexedDB exports the database,
and exporting drops the open transaction underneath it. Persisting after every
statement therefore broke the first migration with "cannot commit - no
transaction is active". The Capacitor driver saves only outside a transaction,
and once more on commit.

Transaction control also differs by engine. The plugin manages its own, so the
driver overrides `begin`/`commit`/`rollback` to call `beginTransaction()` and
friends; a `BEGIN` sent as a statement does not survive to its `COMMIT`.

Verified end to end in a real browser: the full 12,899-row export imports in
about 3 seconds, producing the same 36 accounts, 25 categories and 2,712
transfers as the command-line run, and the same balances — including the card
at −956,492.27 with 143,507.73 free.
