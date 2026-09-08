# Data model and SQLite schema

Phase 1. The schema lives in
`src/app/core/database/migrations/001_initial_schema.sql`, which is the single
source of truth; this document explains the reasoning behind it.

Everything here is exercised by 44 tests that run against a real SQLite engine:

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

## The thirteen tables

### Catalog

**`currencies`** — `COP` and `USD`, both with `minor_units = 2`.

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

**`account_rates`** — per-account interest rate history with
valid-from/valid-to, maintained by hand because bank rates are not reliably
available online. A rate change adds a row rather than editing one, so history
stays intact.

### Separate modules

**`interest_accruals`** — `computed_minor` and `actual_minor` side by side: what
the app worked out from the rate history, and what the bank actually paid.

**`cashbacks`** — linked to the purchase that produced it. If that purchase is
later deleted the link goes null but the cashback survives, which is the right
trade: the money was real even if the record of its cause is gone.

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

**Order stability — VERIFIED 2026-09-08.** `import_seq` assumes Monefy exports
rows in a stable order, so a row keeps its slot between exports. Comparing
`monefy-2026-09-07.csv` with `monefy-2026-09-08.csv`: all 12,890 rows from the
older export appear at the same positions in the newer one, 8 rows were
appended, and none went missing. The older export is an exact prefix of the
newer.

One pair of exports one day apart is good evidence, not proof — Monefy could
still reorder after some future edit. The comparison is cheap, so run it on
each new export; a divergence would show up immediately rather than as
duplicated history.

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

The 24-hour time is only added when a day holds more than one export. The name
is for humans and for sorting — every tool takes explicit paths, so nothing
breaks if a file is named differently; it just stops sorting chronologically.
That is also why Monefy's own `Monefy.Data.8-9-2026.csv` gets renamed: `8-9` is
ambiguous between August and September, and it sorts alphabetically rather than
by date.
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
