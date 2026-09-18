# Project context — Finance

Android mobile app for personal finance. Offline-first, with all data stored
locally on the phone. Replaces and improves on Monefy.

Claude Code reads this file automatically when the project is opened.
Keep it up to date whenever we make new decisions.

## Language rule

- **The repository is English.** Code, comments, identifiers, documentation,
  commit messages, branch names and file names: all in English. The only
  exception is data coming from the real Monefy backup (account and category
  names such as `Tarjeta credito rappi` or `Ahorros`), which stays verbatim so
  the importer keeps working.
- **The conversation with Jose is in Spanish**, with simple, easy-to-follow
  explanations. English technical terms inside that Spanish are fine.
- **The app itself is multilingual** (Spanish by default, English available).
  Its own words live in `src/app/core/i18n/translations.ts` under English keys;
  no user-facing string belongs in a template or a component. What is NOT
  translated: the user's data (account names, category names, notes on a
  movement), the Monefy importer's pattern matching, and the Colombian tax
  module. Decision by Jose, 2026-09-09.

---

## About the user

- Jose, full-stack developer. Strong in .NET, Angular, TypeScript, SQL, Azure.
- New to: Ionic, Capacitor, mobile SQLite, Git/GitHub for personal projects.
- Lives in Colombia. Income in COP. Also holds USD accounts.
- Explanations: simple and clear, even in deep technical analysis.
- Before recommending anything, verify it against the real code or data.
  Explicitly mark what is assumed and what is verified.
- Before applying a change, assess the risk of breaking what already works.

## The real goal of the app

It is not just expense tracking. The underlying goal is **tax predictability**:
knowing, all year long, how much income tax will be owed, and therefore how
much to save each month so it can be paid with money already set aside, with
no surprises.

Everything else (categories, accounts, charts) exists to feed that.

---

## Decisions already made

### Stack

| Piece | Choice |
|---|---|
| UI framework | Angular + Ionic |
| Native packaging | Capacitor |
| Database | Local SQLite (`@capacitor-community/sqlite`) |
| Language | TypeScript |
| IDE | VS Code |
| Android | Android Studio (only for the SDK, emulator and APK signing) |

.NET MAUI Blazor Hybrid was ruled out despite being a better fit for Jose's
experience: as of today it has open Android issues (safe areas that leave the
UI unusable on .NET 10, startup crashes on the emulator). Not worth fighting
the framework on a long-running project.

### Non-negotiable business rules

1. **Offline-first.** The app never breaks without internet. If a network
   value is missing (FX rate, interest rate), the last cached value is used
   and flagged as such.

2. **Money as integers.** JavaScript has no decimal type; everything is
   float64. Amounts are stored as integers in minor units and only formatted
   for display. **Never add floats.** The Monefy backup already carries the
   typical garbage: `9421.2800000000007`.

   **Both COP and USD use 2 minor units (cents).** COP was originally going to
   be stored as whole pesos, but 2,313 of the 12,890 backup rows carry cents
   (including opening balances such as `66,750,767.94`), and rounding them
   would make balances impossible to reconcile against the bank. COP is also
   *displayed* with 2 decimals, the same way Monefy does it. Decision by Jose,
   2026-09-08.

3. **Two different questions, two different rates.** A movement keeps the rate
   that applied the day it happened — that answers *what did this cost me*, and
   it is what the tax module needs. **Net worth is a different question**: what
   is held today is worth today`s rate, not a blend of the rates it was bought
   at. Summing each movement`s historical peso value to answer it was wrong,
   and was corrected on 2026-09-09 at Jose`s insistence. A currency with no rate on
   record is reported, never guessed at: its accounts sit out of the total and
   the screen says so.

4. **Multi-currency with a per-transaction rate.** Every foreign-currency
   transaction stores the rate that bank actually applied to that transaction,
   as an editable value. History is never recalculated when the official rate
   changes. The official TRM (Superfinanciera, public API on datos.gov.co) is
   the anchor; the bank rate is derived or typed in.

   **A foreign movement saved with no rate is valued by the app at the
   official rate of its own day** (`core/rates/`), never left as its own
   amount. The repository used to copy the amount into the peso figure when
   no rate was given - right for a peso account, and 30 dollars stored as 30
   pesos for any other: 60 of Jose's 283 foreign movements, found on
   2026-09-18 as a sliver in the donut. USD takes the TRM; EUR, which has no
   official peso rate, takes the ECB's euro-dollar times the TRM - official on
   both sides, derived in between. Such a movement records `rate_source`
   `trm` or `derived` and `confidence` `low`: the official reference, not
   what the bank charged. Offline, it takes the last rate the app has — rule
   1 — marked `cached`, and the next pass with a network replaces it with the
   day's own; only a currency with no rate on record at all is left out, and
   counted. Today's dollar and euro are fetched once a day, a few seconds
   after the app opens (the TRM used to refresh only from a button on the
   accounts screen). None of it may be felt on the phone: after every save
   the pass is one query over the foreign accounts' rows that finds nothing.

4. **Credit cards as liabilities.** The balance represents the debt (negative
   or zero). The credit limit is a separate attribute. Available credit is
   computed: credit limit − debt. They do not count as an asset for net worth,
   but they do subtract as a liability. Monefy modeled them wrong (a positive
   initial balance of 800,000 = the credit limit, mixing two concepts).

5. **Accounts can be flagged as "excluded from net worth"**, same as Monefy.
   **So can a product inside an account** (`yield_pockets.include_in_net_worth`,
   migration 033): the tax CDTs live inside Pibank, not in an account of their
   own. A product set aside has its movements left off the account's balance on
   the summary and accounts screens and off net worth, and the transfer that
   fed it reads as money leaving. The bank balance the yields screen compares
   products against still counts everything. The usual product always counts,
   since a movement naming no product lands in it. Decision by Jose, 2026-09-12.

6. **Interest and cashback live separately.** They are not mixed into the
   balance of the account that produced them. Their own module, because their
   tax treatment is different.

7. **Everything editable.** Any value the app computes or fetches from the
   internet must be overridable by hand. The app also stores both: the
   computed value and the manually entered one, so they can be compared.

8. **Configurable DIAN forms.** The tax module must not hardcode form 210.
   Each form is a configurable set of rules and line items, so others can be
   added later.

9. **An account can hold several currencies.** Global66 holds COP and USD, ARQ
   holds USD and EUR, and more will follow. Each currency is its own row in
   `accounts`; an `account_groups` row ties them into the one account the user
   actually has. Single-currency accounts leave `group_id` null. Converting
   between two currencies of the same account is an ordinary transfer between
   its rows, which captures the rate the provider applied. Decision by Jose,
   2026-09-08.

10. **Icons are user-supplied, not just a fixed catalog.** Accounts and
   categories can use either a built-in icon or an image the user provides
   (a real bank logo, for instance). Custom images are stored inside the
   database itself, so a backup stays a single file. Decision by Jose,
   2026-09-08.

11. **A credit limit is history, not a movement.** Changing a limit - up or
   down - moves no money and leaves the debt untouched; only the room left
   over changes. So limits live in `credit_limit_changes` (one row per card
   per day, holding the limit as of that day) and never in the ledger. That is
   the mistake Monefy forced: with nowhere to put a limit increase, it was
   logged as a deposit, which understated the debt by exactly the increase.
   `accounts.credit_limit_minor` stays the limit in force today, kept in step
   by the repository. The import seeds the history from the backup but never
   overrules a confirmed or hand-corrected limit. Decision by Jose, 2026-09-09.

12. **A new movement in a foreign-currency account always goes to review.**
   Monefy only ever stored pesos, so the dollar or euro figure of any row in
   ARQ, eToro, XTB, Plenti or Global66 USD is a reading or an estimate. Jose
   has corrected many of those by hand to figures more exact than Monefy could
   hold. Those are protected twice over - the fingerprint skips them and the
   `locked` flag guards them - and every genuinely new row in such an account
   arrives flagged `foreign_new_movement` so it is corrected at once instead of
   sitting there as an approximation nobody was told about. Peso rows import
   silently: there the CSV figure is the real one. Decision by Jose, 2026-09-09.

13. **A deletion is a decision too.** Deleting an imported movement removes its
   fingerprint, and the importer recognises stored rows by fingerprint — so
   without help, the next import meets the row as new and puts it back. The
   fingerprint now outlives the row in `deleted_imports`, and the importer
   skips it. Jose hit this on 2026-09-09: an import reported 7 new movements
   when only 1 was new, the other 6 being rows he had deleted. It can be undone
   (`forgetDeletion`), so nothing is permanent by accident.

14. **Manual edits win over re-imports.** The Monefy CSV is re-exported
   regularly, carrying the whole history again plus new rows, so the importer
   must be repeatable. Any record edited by hand inside Finance is flagged
   `locked` and a later re-import never overwrites it: a manual edit means Jose
   corrected it towards the final, true version. Decision by Jose, 2026-09-08.

15. **Interest and cashback are a cushion, not net worth.** Money earned that
   was never counted on. It accumulates outside the balance of the account that
   produced it and outside net worth, and moving part of it in is a deliberate
   act that writes both a movement and a `cushion_withdrawals` row, so nothing
   is counted twice - modelled on the real 2026-08-13 adjustment on Rappi
   cuenta. Historical yields cannot be reconstructed, so each account gets one
   opening figure typed by hand and accrual runs day by day from there, against
   an effective-annual-rate history the user maintains. The daily rate is
   `(1 + annual) ^ (1/365) - 1`, never the annual one over 365, and the accrual
   base is the ledger balance plus the cushion. Accounts whose return is the
   market's - XTB, eToro, Fiducuenta, Multinversion - are never accrued: they
   already carry their own movements. Decision by Jose, 2026-09-09.

   **A day in `yield_days` is the day the money is HANDED OVER, and it is
   worked out on the balance the day before closed with.** That is how these
   banks do it - interest on the closing balance, paid the next day - and it
   is why the figures match what Jose's banks actually paid, which he
   checked against his statements on 2026-09-16. So money put in today does
   earn for today; that earning is the row dated tomorrow, because tomorrow
   is when it lands. Do not "fix" this by moving the base forward a day: it
   would double-count the edges and stop matching the bank.

   **The opening figure is a RECORD, and is never added to the accrual base.**
   It looks like money the base is missing — the bank shows more than the
   ledger does — but every product carries a balance Jose typed after reading
   it off the bank, and that figure ALREADY has the yields inside it.
   Migration 035 turned each opening figure into an adjustment so that it
   would earn; Uala's product states 4,584,082.13 and it began earning on
   5,699,581.59. Migration 036 undid it the same night. The opening date is
   that record's boundary, so nothing — not even a rate reaching further back
   — pulls the walk earlier while the figure is non-zero. An account whose
   opening figure is zero has no record to overlap with, and there the rates
   decide. Found by Jose, 2026-09-17.

16. **Withholding figures are configuration, each carrying its source.** They
   live in `tax_parameters`, dated, and are unusable until marked confirmed
   with a source; until then the accrual runs without withholding and flags
   every affected day. The rule as looked up on 2026-09-09 and seeded by
   migration 006:

   - **0.055 UVT a day** is the threshold, and at or above it **the whole
     day's yield is the base**, not only the excess — Decreto 1625 de 2016,
     articulo 1.2.4.2.87: *"Cuando los intereses ... correspondan a un interes
     diario de veintisiete pesos ($27.00) (0.055 UVT) o mas, para efectos de
     la retencion en la fuente se considerara el valor total del pago o abono
     en cuenta."*
   - **7%** — Decreto 1625 articulo 1.2.4.2.5, regulating articulo 395 ET.
   - **UVT 2026: $52.374** — Resolucion DIAN 000238 del 15 de diciembre de
     2025. A new resolution every December, so this needs a new row each year.
   - The rule is written against the **daily** interest even though most banks
     deposit monthly. That is why the module accrues by day.

   **A CDT is never accrued day by day and has no threshold.** It is paid
   once per period - every month, or every N months per its rate, even if the
   rate says daily - on the balance it holds on payday, at
   `(1 + E.A.) ^ (days in the period / 365) - 1`, and 7% of each payment is
   withheld. Each
   product carries a kind (`yield_pockets.kind`, migration 029): `high_yield`,
   which follows the threshold rule above and is what every product was
   before, or `cdt`. Stated by Jose 2026-09-11.

   **Whether a product is withheld at all is the product's own switch**
   (`yield_pockets.withholding`, migration 031): inside one account some
   products are withheld and others are not, and a product that is not has
   nothing taken from its yield. Decision by Jose, 2026-09-11.

   Cashback is not withheld. Foreign-currency accounts are not withheld either:
   retencion en la fuente is a Colombian withholding by a Colombian paying
   agent — which does **not** mean the income is untaxed, since a resident
   declares worldwide income. **Still to be confirmed with an accountant before
   a return leans on it.**

   **What a product's own movement IS belongs to the user** (`product_kinds`,
   migration 034). Cashback, a correction against the bank and "other" were
   three words fixed in the schema; they are rows now, renameable, with an
   icon of their own and as many more as Jose wants. Each carries `counts_as`
   They are categories, and nothing more: a name and an icon, kept on the
   categories screen beside the other two lists and editable from the
   product's own form. The `counts_as` column exists and is unused - it was
   a switch asking whether a category was cashback, which Jose had not asked
   for and which put a tax question inside a name-and-picture editor. The old
   `kind` column stays and is still written, so an entry remains readable to
   anything that has not been taught about the table. Decision by Jose,
   2026-09-16.

17. **An account can be several pockets, and the tax is per pocket.** Dale is
   two "alcancias" and the bank pays each separately, so each is its own pago o
   abono en cuenta and the 0.055 UVT threshold is measured on each. Adding them
   up before taxing charged 386.73 pesos a day of withholding that was not
   owed. A pocket either follows the account balance (`ledger`, at most one per
   account, holding whatever the others left) or carries a figure typed in and
   dated, because a movement never says which pocket it landed in - so the app
   compares the two and reports the drift rather than accruing on a stale
   figure. The account's cushion is spread across its pockets in proportion to
   what each holds; putting it all on the first one pushed that one over the
   threshold by itself. Decision by Jose, 2026-09-10.

18. **A missed condition is a different rate, not no rate.** Uala pays 10.5%
   E.A. in a month with at least 400,000 spent on the card and 5% E.A. in a
   month without, so a conditional rate carries a fallback. And not all the
   money in an account is necessarily earning: these accounts hold several
   products inside one balance, and what is sitting in one that pays nothing is
   recorded by hand in `yield_excluded_balances`, dated, and taken off the
   accrual base. Both found by Jose against his real accounts, 2026-09-09.

19. **The income-tax simulator is a form, and every figure in it is typed.**
   One screen laid out like Formulario 210: boxes the person types into, boxes
   that fill themselves in, the balance to pay always in view. Not a wizard -
   changing one figure moves twenty others, and seeing them move is how the
   form explains itself. One simulation per tax year, saved as the typing
   stops. Its engine (`core/tax/cedula-general.ts`) is a line-for-line port
   of Jose's `Simulador_Tributario_2026.xlsx`, and the tests compare it
   against the values Excel stored in that file. Three corrections to the
   sheet, all sourced and none yet confirmed with an accountant:
   - **The contribution base depends on the kind of work.** The sheet's 70%
     is the *salario integral* rule (Ley 344 de 1996 art. 18), not the general
     one. Ordinary salary: the whole of it, 4% + 4%. Independent: 40% of what
     is billed (Ley 1955 de 2019 art. 244), at the full 12.5% + 16%.
   - **Floor, ceiling and solidarity steps need the year's minimum wage**
     (1 to 25 SMMLV; FSP 1% from 4, up to 2% - Ley 797 de 2003). With none on
     record, none is applied rather than invented.
   **Casilla 59 is asked two ways** (Jose, 2026-09-15): worked out from the
   part of casilla 58 that is financial yields times the year percentage, or
   typed as the bank certificate states it - that percentage is published
   months after the year ends. The rows of the way not chosen leave the form
   and the exported spreadsheet, and a typed figure is still capped at
   casilla 58.
   **The cédula general is FOUR columns, not two.** Read off Jose's own filed
   2025 return (form 2118750959688, 2026-08-13) on 2026-09-17: rentas de
   trabajo (32-42), rentas de trabajo que no provengan de una relación laboral
   (43-57), rentas de capital (58-73) and rentas no laborales (74-90), and
   casilla 91 adds the four. The second column is honorarios and services —
   art. 103 E.T. calls that renta de trabajo too — and it exists so costs can
   be subtracted, which an employee has none of. Casilla 44 is "ingresos no
   constitutivos de renta", NOT devoluciones: on the form the devoluciones row
   carries only casilla 75. Casilla 62 is rentas líquidas pasivas de una ECE
   (arts. 882-893 E.T.) and joins the capital column.

   - **Yields and cashback are rentas de capital (casilla 58), not ganancias
     ocasionales.** The componente inflacionario of the financial yields is
     casilla 59, worked out by the form; cashback carries none (an assumption:
     no DIAN ruling on cashback was found). Renta líquida de capital is casilla
     61. Casilla 43 is honorarios reported with costs, a different thing. The
     spreadsheet's 10M "no laborales" and 5M "costos" were really casillas 58
     and 59. Corrected by Jose from his own 2025 return, 2026-09-11.
   Every rate, cap and UVT is an input with a stated default; every parameter
   falls back to the best reference available, labelled official, borrowed from
   an earlier year or estimated, with its source. Figures brought in
   from the app (salary by a category the user picks, yields for the year) are
   labelled approximate: the ledger holds net salary and accrued yields, the
   return needs gross salary and what the bank certifies. The tax module's
   words are Spanish only, in `core/tax/tax-form.ts`. The simulation
   exports to an .xlsx shaped like that spreadsheet (same palette, yellow for
   typed boxes, locked formula cells on a sheet protected without a password),
   written by `core/xlsx/xlsx-writer.ts` with no library; every calculated box
   is a live formula built from the engine's own constants, and the tests
   evaluate each one against `simulate` for several inputs. Decision by Jose,
   2026-09-11.

### Real limits that must not be promised away

- **The rate a given bank applied on a given day is not available online.**
  There is no public or historical source. Only the official daily TRM exists.
- **Per-bank interest rates are not reliably available either.** They live in
  terms and conditions that change without notice. The solution is a per-account
  rate history (effective annual rate with valid-from/valid-to) maintained by
  the user, with the app accruing day by day.
- **Do not use an LLM to fetch exact figures** (TRM, interest rates). It makes
  numbers up. For numeric data, use deterministic APIs with a local cache. An
  LLM does fit for auto-classifying categories or reading a bank statement.

---

## Current status

The SQLite schema, the migration runner, the money helpers, the repository
layer and the yields module are covered by 267 tests that run against a real
SQLite engine with no dependencies:

```
node tools/db/run-tests.mjs
```

Phase 3 has started. The Angular/Ionic project now exists around the database
layer: Angular 22, Ionic 9, Capacitor 8, standalone components.

```
npm start          ionic serve, in the browser
npm run db:test    the database tests
npm run android    build and copy the web app into the Android project
```

**The Monefy importer is gone** (2026-09-12). Jose enters every movement by
hand from now on, after imports kept putting his corrections at risk. The
import screen, the review screen that listed what the importer assumed, the
CSV parser and its tools were removed. What the imports left in the data stays
untouched: `source = 'monefy'`, `locked`, fingerprints, `deleted_imports` and
`review_queue` are still tables and columns, carried by the backup, and never
dropped - migrations are history. Rules 12 to 14 describe that history.

Data moves between the browser and the phone as a backup: "Importar y
exportar" saves one and restores one. The Android project lives in `android/`
(Capacitor 8).

**Not yet verified: SQLite in the browser.** The web build needs `jeep-sqlite`
to mount and `initWebStore()` to succeed, and that only happens at runtime.
Everything up to it — build, types, plugin API — is confirmed.

## Pending from Jose

- Node 26.1.0 installed (shared with the client's Angular projects). It is
  outside the range Angular declares (^20.19 || ^22.12 || ^24), but it works
  with a warning. DO NOT replace it: it would break the work environment. If
  the toolchain fails because of the version, install fnm and isolate per
  project with `.node-version`.

- [x] `Plata` is COP only, ungrouped. New in the 2026-09-08 export.
- [x] eToro, XTB and Plenti hold USD only. Balances on 2026-09-08:
      eToro 17,195.31, XTB 2,607, Plenti 0.
- [ ] Current balance of each currency of the two multi-currency accounts:
      ARQ (USD and EUR) and Global66 (COP and USD). The last ones needed to
      reconcile the import (see `docs/01-monefy-backup-analysis.md`).
- Deferred, not pending: market value of the brokers. eToro and XTB move with
  the market daily, so their balance is not derivable from transactions and is
  not something the ledger should be reconciled against. The app records their
  exact movements only, and the balance it shows for them is what was put in,
  not what they are worth. Valuation and its tax treatment come later; interest
  and a change in market value are taxed differently in Colombia and must not
  share a table just because they look alike. Decision by Jose, 2026-09-08.
- [ ] Confirm whether he currently files form 210 and whether a legal entity
      is involved.

## Documents

- `docs/01-monefy-backup-analysis.md` — what the backup contains and its problems
- `docs/02-technical-decisions.md` — the reasoning behind each decision
- `docs/03-roadmap.md` — order of work by phase
- `docs/04-stack-guide.md` — stack primer for someone coming from .NET/Angular
- `docs/05-data-model.md` — the SQLite schema and the reasoning behind it
- `docs/06-schema.md` — the schema drawn: ER diagram, delete rules, constraints
- `data/monefy-YYYY-MM-DD.csv` — the real backups, one file per export.
  Never overwrite one: comparing consecutive exports is what verifies that
  Monefy orders rows stably, which the import fingerprint relies on.
