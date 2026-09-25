# Project context — Finance

Android mobile app for personal finance. Offline-first, with all data stored
locally on the phone.

Claude Code reads this file automatically when the project is opened.
Keep it up to date whenever we make new decisions.

## Language rule

- **The repository is English.** Code, comments, identifiers, documentation,
  commit messages, branch names and file names: all in English. The only
  exception is Jose's own data (account and category names such as
  `Tarjeta credito rappi` or `Ahorros`), which is his and stays verbatim.
- **The conversation with Jose is in Spanish**, with simple, easy-to-follow
  explanations. English technical terms inside that Spanish are fine.
- **The app itself is multilingual** (Spanish by default, English available).
  Its own words live in `src/app/core/i18n/translations.ts` under English keys;
  no user-facing string belongs in a template or a component. What is NOT
  translated: the user's data (account names, category names, notes on a
  movement). Decision by Jose,
  2026-09-09.
- **The tax module is translated too, but the DIAN's terms are not.** Its
  explanations, hints, titles and every word the app says in its own voice
  follow the app's language, on the screen and in the exported spreadsheet.
  The DIAN's official terms stay Spanish with a short gloss in the reader's
  language, so they still match the real form:
  "Ingresos brutos por rentas de capital (gross capital income) · Csl. 58".
  Never translated: casilla, UVT, IBC, E.T., AFC/FVP/AVC, article numbers and
  the names of norms. Spanish is `core/tax/tax-form.ts`, left exactly as it
  was; English is `core/tax/tax-form.en.ts`, laid over it row by row by
  `core/tax/tax-words.ts`; `tools/db/tax-words.test.mjs` fails on a row
  without its English and on a box whose Spanish label was reworded. Only
  words change with the language: the formulas and the engine do not.
  Decision by Jose, 2026-09-18, replacing the 2026-09-09 rule that kept the
  whole module in Spanish.

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

**Giving the user control of their finances: seeing where the money goes,
what changed against last month or last year, and deciding from that.**

This is not what the app was started for, and the change is deliberate. It
began as tax predictability - knowing all year how much income tax would be
owed, so it could be paid with money already set aside - and everything else
was there to feed that. Restated by Jose on 2026-09-21: the tax simulator is
built, it works, it takes typed figures and exports its own spreadsheet, and
that is the whole of what people want from it. **It is finished and it stands
apart.** Do not wire new work into it, do not make another feature depend on
it, and do not "improve" it as a side effect of something else.

So the centre of gravity is now the everyday picture: movements, accounts,
categories, products and what the app can tell the user about them.

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

### iOS: possible, deliberately not done

Looked into on 2026-09-21 and deferred by Jose. Nothing here blocks it — every
plugin in `package.json` is an official Capacitor one with iOS support, and
`npx cap add ios` would be the whole technical step. What stops it is Apple:

- An app cannot be installed from a file the way an APK can. Every install
  needs Apple's own certificate and a profile naming the device.
- A free Apple ID signs an app for **7 days** and needs a physical Mac to
  re-sign it. That is not a way to carry an app.
- The Apple Developer Program (**$99/year**, from memory - confirm before
  paying) is what makes it work, and it is the *same* subscription that
  publishing to the App Store needs. One payment covers both, plus TestFlight,
  which updates the phone by itself the way Jose wanted.
- A GitHub Action can build it on a macOS runner, signing from secrets the way
  `debug-apk.yml` does. macOS minutes bill at 10x, so the free tier is roughly
  20 builds a month.
- The same rule as Android decides an update from a reinstall: same bundle id
  plus same signing identity keeps the data, a different identity forces an
  uninstall.

Jose has no Mac and no iPhone as of this date, and is not paying for now. The
eventual goal, when it happens, is the App Store. **So: write nothing that
assumes Android** - no fixed file paths, no Android-only plugin. Two things
would be left to do on the day: a separate Google OAuth client for iOS (the
one on record is tied to the Android keystore's SHA-1) and testing a real
backup restore against iOS's own SQLite backend.

### Non-negotiable business rules

1. **Offline-first.** The app never breaks without internet. If a network
   value is missing (FX rate, interest rate), the last cached value is used
   and flagged as such.

2. **Money as integers.** JavaScript has no decimal type; everything is
   float64. Amounts are stored as integers in minor units and only formatted
   for display. **Never add floats.** The data seeded into the app already
   carries the typical garbage: `9421.2800000000007`.

   **Both COP and USD use 2 minor units (cents).** COP was originally going to
   be stored as whole pesos, but 2,313 of the 12,890 backup rows carry cents
   (including opening balances such as `66,750,767.94`), and rounding them
   would make balances impossible to reconcile against the bank. COP is also
   *displayed* with 2 decimals. Decision by Jose,
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
   but they do subtract as a liability. The app they came from modelled them
   wrong (a positive initial balance of 800,000 = the credit limit, mixing two
   concepts), which is why the data needed correcting by hand.

5. **Accounts can be flagged as "excluded from net worth".**
   **So can a product inside an account** (`products.include_in_net_worth`,
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
   the mistake the old app forced: with nowhere to put a limit increase, it
   was logged as a deposit, which understated the debt by exactly the increase.
   `accounts.credit_limit_minor` stays the limit in force today, kept in step
   by the repository. The import seeds the history from the backup but never
   overrules a confirmed or hand-corrected limit. Decision by Jose, 2026-09-09.

12. **There is one source of data: what is in the app today.** The app was
   seeded once from another one and that is over - said plainly by Jose on
   2026-09-22: no importer, no CSV, and above all **no reading an old export
   to decide anything about the data as it stands now**. A figure that looks
   wrong is checked against the app's own current backup, the one in
   `G:\My Drive\Finance App` (the newest `.json` there), and nowhere else.
   `source`, `locked`, the fingerprints, `deleted_imports` and `review_queue`
   are columns and tables that survive in the schema because migrations are
   history; nothing new is ever written to them and no new work leans on them.
   A row flagged `locked` still means "Jose corrected this by hand", and that
   is the one part still worth honouring.

15. **Interest and cashback stay outside net worth.** Money earned that was
   never counted on. It accumulates outside the balance of the account that
   produced it and outside net worth, and moving part of it in is a deliberate
   act that writes both a movement and a `product_cashouts` row, so nothing
   is counted twice - modelled on the real 2026-08-13 adjustment on Rappi
   cuenta. The daily rate is `(1 + annual) ^ (1/365) - 1`, never the annual one
   over 365, against an effective-annual-rate history the user maintains.
   Accounts whose return is the market's - XTB, eToro, Fiducuenta,
   Multinversion - are never accrued: they already carry their own movements.
   Decision by Jose, 2026-09-09.

   **There are five things and no sixth: products, their balances, the date
   each starts earning from, their rates and their movements.** Said by Jose
   over and over through 2026-09-22 before it was done. What stood in the way
   was `yield_accounts.opening_cushion_minor` - one figure per account saying
   what the bank had already paid, which the screens called a "colchon". It
   was a mechanism of its own with a name nobody could use, and it was two
   things wearing one name: an amount, which is an income to a product and
   nothing more, and a date, which is real. Migration 040 wrote each amount as
   an ordinary entry on the product Jose named and emptied the column.

   **The date belongs to the product** (`products.earns_from`, migration
   041). One date per account was a floor over everything in it, and in Jose's
   data it sat a day later than the products of five accounts and months later
   than Pibank's CDTs - so deleting it would have handed those products days
   nobody had worked out. 041 gave each product the day its account was
   already starting it from, and the engine walks from the earliest of them
   with each product sitting out the days before its own. A rate reaching
   further back does NOT pull the walk back any more: the product's date is
   the boundary, full stop.

   **And a pocket is a product** (migration 043, Jose: "pocket... muy
   especifico porque no todas las cuentas manejan pockets"). `yield_pockets`
   is `products`, `yield_pocket_balances` is `product_balances` and every
   `pocket_id` is a `product_id`. Dale has alcancias, Lulo has bolsillos,
   Pibank has CDTs: product is the word that covers all of them, and it is
   what the screen has said for weeks.

   **And the word colchon is gone with the concept** (migration 042, Jose:
   "ese termino colchon no deberia existir mas"). `cushion_adjustments` is
   `product_entries` - a product's own movements - and `cushion_withdrawals`
   is `product_cashouts` - money moved from what a product earned into the
   account itself. The screen is `features/products`, its URL is `/products`
   and every word it says is keyed `products.*`. An older backup still
   restores: `restoreBackup` rebuilds the schema the file came out of, puts
   the rows back under the names they were written with, and migrates forward
   afterwards.

   All of it checked the same way, and this is the way to check anything here:
   compare what Jose's phone has ALREADY worked out - the `yield_days` his
   backup carries - against what the code makes of the same file. Nothing of
   the above moved a figure. **Do not bring the concept back under another
   name.**

   **A day in `yield_days` is the day the money is HANDED OVER, and it is
   worked out on the balance the day before closed with.** That is how these
   banks do it - interest on the closing balance, paid the next day - and it
   is why the figures match what Jose's banks actually paid, which he
   checked against his statements on 2026-09-16. So money put in today does
   earn for today; that earning is the row dated tomorrow, because tomorrow
   is when it lands. Do not "fix" this by moving the base forward a day: it
   would double-count the edges and stop matching the bank.

   **What was already earned is a RECORD, and is never added to the accrual
   base.** It looks like money the base is missing — the bank shows more than
   the ledger does — but every product carries a balance Jose typed after
   reading it off the bank, and that figure ALREADY has the yields inside it.
   Migration 035 made each one earn; Uala's product states 4,584,082.13 and it
   began earning on 5,699,581.59. Migration 036 undid it the same night.
   `yield_accounts.opening_on` is that record's boundary, so nothing — not
   even a rate reaching further back — pulls the walk earlier while something
   is on record as earned before it (`YieldsRepository.earnedBefore`). An
   account with no such record has nothing to overlap with, and there the
   rates decide: that is Plata. Found by Jose, 2026-09-17, and restated on
   2026-09-22 when the opening figure itself became one of those records.

   **A product's balance dated D is its balance at the CLOSE of D** - it
   holds everything paid on D, so only what lands after D goes on top of it,
   plus an entry written on D at or after the moment the figure was typed.
   The yields screen always read a figure that way; the engine did not, and
   put everything it had worked out since the walk began on top of the
   newest figure. That is harmless for a figure dated before the walk
   starts, and a double count for any figure dated inside it - which is
   exactly what typing today's balance mid-way does. Fixed on 2026-09-24
   (`anchorOf`, `afterFigure` in `accrual.ts`); a test holds the two to one
   answer: the base of day D+1 is what the screen shows at the close of D.

   **What actually went wrong on Dale, and the proof, corrected the same
   day.** Migration 008 wrote Dale's two balances dated 2026-09-10 ("Read on
   2026-09-10"), but they are the close of the 9th: Dale paid the 10th on
   exactly those figures, 2,762.25 and 2,762.53. Jose had typed them himself
   dated the 9th. Under the rule above the migration's copy said the 10th was
   already inside, so every day after came out 0.76 low. I first claimed the
   fix was proved by the three days Jose had corrected by hand - but those
   matched only because of the corrections he had typed to chase the bank.
   The real proof came with his screenshots of Dale's own app: with the
   mis-dated copy removed, the engine by itself gives all nine days from the
   10th to the 18th to the centavo, on both alcancías. **A balance is dated
   by the day it closes, not the day it was read** - for a bank that pays in
   the small hours, a figure read on the morning of D is the close of D-1
   only if D's payment has not landed yet.

   Squared with Dale on 2026-09-24 from those screenshots
   (`finance-2026-09-24-dale-completo.json`): the copy and Jose's four
   chasing corrections removed, every day from the 10th to the 24th locked at
   what Dale paid, today's balance typed as Dale shows it, and each
   alcancía's record of what was paid before the app adjusted so its total
   is Dale's "Tus rendimientos" - they were one account figure split in two
   halves, and Dale says they are not halves. Nothing outside Dale changed.

   **Still unexplained, and worth watching**: Dale's payments imply a base a
   little larger than the balance it displays - about 575 pesos from the
   10th to the 18th, about 380 from the 19th, about 185 by the 24th, each
   step close to 194, which is 7% of one day's yield. Dale's movement list
   shows nothing for it. From the 25th the app earns on the balance Dale
   displays, so a payment 0.05 above the app's (2,773.50 against 2,773.45
   on the 25th) would mean Dale earns on something it does not show.

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
   product carries a kind (`products.kind`, migration 029): `high_yield`,
   which follows the threshold rule above and is what every product was
   before, or `cdt`. Stated by Jose 2026-09-11.

   **Whether a product is withheld at all is the product's own switch**
   (`products.withholding`, migration 031): inside one account some
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

17. **An account can be several products, and the tax is per product.** Dale is
   two "alcancias" and the bank pays each separately, so each is its own pago o
   abono en cuenta and the 0.055 UVT threshold is measured on each. Adding them
   up before taxing charged 386.73 pesos a day of withholding that was not
   owed. A product either follows the account balance (`ledger`, at most one per
   account, holding whatever the others left) or carries a figure typed in and
   dated, because a movement never says which product it landed in - so the app
   compares the two and reports the drift rather than accruing on a stale
   figure. What the account has earned is spread across its products in
   proportion to what each holds; putting it all on the first one pushed that one over the
   threshold by itself. Decision by Jose, 2026-09-10.

18. **A spending bonus is its own part of the rate, judged on its whole
   period.** Ualá pays 10.5% E.A., and that is two things wearing one number
   (migration 011): 5% E.A. every day, unconditionally, and 5.5% E.A. paid at
   the end of the month only in a month with at least 400,000 spent. So a
   rate is a set of COMPONENTS, each with its own percentage, payday and
   condition, and a component whose condition was missed is paid at its
   fallback rate - none, for Ualá's. Found by Jose, 2026-09-09. (That same
   migration dropped `yield_excluded_balances`: money set aside is money
   somewhere else, recorded when it moves.)

   **What counts as spending, all of it tested** (`accrual.test.mjs`,
   2026-09-24): expenses on that same account in the period - the calendar
   month, or the N months of a bonus paid every N. Not money coming in, not a
   transfer to another account of one's own (that would meet the condition
   for free), and not what was spent from any other account. Exactly the
   threshold meets it. One month's spending never carries into the next.

   **A period already judged is judged again when its spending changes.** The
   engine resumed from the top of the last month worked out, so a September
   purchase typed in October - or imported from September's statement -
   lifting September over the threshold left its bonus at nothing for good,
   and a purchase deleted later left a bonus that was never earned. Found when
   Jose asked on 2026-09-24 whether the bonus was really being judged right.
   `periodJudgedWrongly` now reads the rate each past day was paid at - the
   full one means its period met the condition - and goes back to any period
   that would be judged the other way today. Nothing new is stored, so a
   restored backup needs nothing. On Jose's backup it changed none of the 237
   days worked out.

   **Assumed, and worth knowing**: every expense on the account counts, while
   the bank counts card purchases. A payment to a person entered as an expense
   would count here and not at the bank. Ualá is a single debit account and
   its card draws on it, so for Jose the two agree; in September he spent
   2,250,996 against 400,000, far from the line.

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
   (arts. 882-893 E.T.) and joins the capital column. Of the second column
   the simulator works out casillas 43 to 46 (section 2: income, non-taxable
   income, costs and the net, which joins casilla 91); casillas 47 to 57 are
   not modelled yet, and the form's notes say so (corrected 2026-09-18 - the
   note used to claim the whole section was missing).

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
   words follow the app's language, with the DIAN's terms kept in Spanish
   (see the language rule at the top). The simulation
   exports to an .xlsx shaped like that spreadsheet (same palette, yellow for
   typed boxes, locked formula cells on a sheet protected without a password),
   written by `core/xlsx/xlsx-writer.ts` with no library; every calculated box
   is a live formula built from the engine's own constants, and the tests
   evaluate each one against `simulate` for several inputs. Decision by Jose,
   2026-09-11. It is written in the app's language: `simulador-renta-{year}.xlsx`
   in Spanish, `income-tax-simulator-{year}.xlsx` in English, with the same
   cells and formulas in both, which the tests compare cell by cell
   (2026-09-18).

20. **The financial summary: one screen, and a spreadsheet of what it shows.**
   Agreed with Jose on 2026-09-21 and **built** (`core/report/`,
   `features/report/`, route `/report`). Eleven analyses run today, in this
   order: the headline figures, the same against the period before, the
   categories that jumped, where the money went, the categories before and
   now, what comes back every month, charges repeated inside one period, the
   months of the year, the accounts, and the biggest movements. The summary
   screen already answers "what did I spend"; this answers "and what does that
   mean". One way in, an item in the
   summary screen's menu, opening a report screen that **inherits the dates and
   the account already chosen** and asks nothing again; exporting to .xlsx is a
   button inside that screen, acting on what is on view. No new button loose on
   a screen that already carries the donut, two pickers, the compose bar and
   the scroll controls.

   What it is built out of is already there, and that is the point:
   `totalsOf` and `slicesOf` (`features/movements/group-movements.ts`) are pure
   functions over a list of movements, so another period is the same two
   functions over another list - **never a second query that computes the same
   figures a second way**. Two answers that disagree by one peso would cost the
   trust of both. `shiftPeriod` already gives the period before.
   `core/xlsx/xlsx-writer.ts` already writes a styled sheet, and `saveFile`
   already saves it on the phone and in the browser.

   Settled:
   - **Every figure in pesos at the rate of its own movement's day**, which is
     what the summary screen does and what rule 3 requires.
   - **"Saved" is income minus expenses and nothing more.** Not what was moved
     into a CDT: a transfer is not a decision to save, and the yields live
     outside the balance by rule 15.
   - **Categories are compared by `category_id`, never by name**, or renaming
     one splits its own history in two.
   - **A part-finished period is never compared against a whole one.** On the
     21st, this month against all of last month is a lie told to two decimals.
     Either the same days on both sides, or a projection that says it is one.
   - **No tax section.** Stated by Jose: the simulator covers it and stands
     apart.
   - **No budgets.** There is no such table and inventing one is its own
     project, so "over budget" is not an indicator this report can carry.
   - The order of work: the spreadsheet first (several sheets, which the
     writer does not do yet - it has `sheet1` fixed in four places), then the
     screen, then the analysis worth having, then a real Excel chart if it
     earns its ~200 lines. A chart is the one part of the format where a
     mistake makes Excel call the file corrupt; a table of percentages with
     bars drawn as filled cells says the same thing for almost nothing.

   **Its shape, decided before a line of it exists** (Jose, 2026-09-21, who
   intends to keep adding to it for a long time). The report is not a screen
   that works figures out and draws them - that shape makes the eleventh
   analysis touch the screen, the spreadsheet and the ten already there.

   **An analysis is a pure function, and the report is a list of them.**

   ```ts
   type Section = (data: ReportData) => Block | null;
   ```

   - **The data is loaded once.** `ReportData` carries this period's
     movements, the previous period's, the accounts, the categories, the
     currency. **No analysis queries the database itself** - twenty analyses
     would be twenty round trips to SQLite and seconds of a blank screen on
     the phone. An analysis needing something nobody loaded gets it added to
     `ReportData`, in that one place.
   - **An analysis returns data, never drawing.** A `Block`: a title, a kind,
     its rows. No HTML, no spreadsheet cells.
   - **Two readers, both generic.** The screen knows how to draw a `Block`;
     the xlsx writer knows how to write one. Neither knows which analyses
     exist. So a new analysis is a function plus a line in a list, and
     nothing else changes.
   - **It may return `null`**, and then it is simply not there. "The biggest
     ten" over three movements is noise, and "against last month" with no last
     month is a table of zeroes. This is what keeps a growing report from
     filling with empty sections.
   - Being pure functions, they are tested by `node tools/db/run-tests.mjs`
     with no browser. Each new analysis arrives with its test.
   - The list's order is the order on screen and in the spreadsheet.
   - Letting the user choose which sections to see is then a list of ids in
     `localStorage`, and needs no redesign. Not to be built until asked for.

   **The kinds of block are a small closed set, each designed properly**:
   headline figures, a ranked list with bars, a comparison (before, now, the
   change), a trend over time, and an observation in words. A new analysis
   picks one of those. Inventing a new *kind* is deliberately a bigger change:
   it is what stops the report from looking like five apps glued together,
   which is exactly how a generic renderer usually ends up and the one real
   risk of this design.

   **What is NOT to be built in advance**: hooks, options and settings for
   needs that do not exist yet. The list of analyses and the five kinds are
   enough; anything more waits for a real case.

   **An analysis measures; the reader decides how to say it.** A change past
   ten times over is drawn as "x43" rather than "+4201%", and that choice
   lives in `report.page.ts`, not in the analysis. The analysis used to drop
   such a change altogether, which left the screen blank beside two figures
   its own sentences were quoting a percentage for. Corrected 2026-09-22 after
   Jose asked why some rows had nothing in front of them.

   The xlsx writer does draw native bar charts now (`sheet.charts`, several
   series allowed), and the trend blocks use them.

   **The yields summary is the same report reading different data**
   (2026-09-24, asked for by Jose). `/report?of=yields` swaps the data and
   the list of sections and nothing else: `core/report/yields-data.ts`
   (`YieldsReportData`, loaded once by `yields-report.service.ts` - the
   enrolled accounts, their products, every `yield_days` row from a year
   back, each converted to pesos at the rate of its own day),
   `sections-yields.ts` (the period in figures with the effective annual
   rate and the withholding; against inflation; notes - how much the money
   earning grew and how much of that was yields, projection, still owed, best
   rate, no rate; how much the money grew since the first month; yields so
   far; which account or product earned most; month by month; against the
   period before on the same days), `yieldsWorkbook` in
   `report-workbook.ts` (the summary sheet plus one row per day). Ways in:
   the products screen, for all accounts from its total and for one from an
   account's sheet; both go through `FilterService` like the money report,
   so the dates and the account are the same two pickers. The report screen
   carries a switch, Movimientos / Rendimientos, so the one way in from the
   summary screen reaches both (Jose, 2026-09-24).

   **Not shown: what the app worked out against what the bank paid.** Built,
   and removed the same day at Jose's word: the summary works with what is in
   the app, corrections included, and a sum of centavos against the engine
   tells the person nothing. The days sheet of the spreadsheet still carries
   both columns, as the record.

   **Every section says what it shows, in one line under its title**
   (`Block.about`, optional on every kind; Jose, 2026-09-24, after "Cuánto
   ha crecido" and "Mes a mes" read as the same thing). Not a tooltip: a
   phone has no hover. The screen shows it at the top of an open section and
   the spreadsheet writes it under the section's title. The two titles that
   confused him are now "Tu saldo frente al cierre de {mes}" (the whole
   balance, what was put in included) and "Rendimientos de cada mes"
   (returns only). The money report's sections carry one too (keys
   `report.about.<block id>`), and `report.test.mjs` fails on a block id in
   `sections.ts` or `sections-over-time.ts` without its line - so a new
   section cannot arrive without saying what it shows.

   **The growth chart is measured from its first month, not from zero**, the
   way a stock chart is: 12% over seventy million drawn from zero is nine bars
   of one height. A month that closed below the first is drawn grey. **It
   starts at the first month EVERY account in the summary is on record** -
   a savings account from its first yield day, an investment from its window
   - because before that an account's money is unrecorded, not absent, and
   counting from earlier turns it into a deposit that never happened. On
   Jose's data it read "+59.6% since October" that was only his savings
   accounts' yields beginning in September. So across all his accounts the
   chart appears as months accumulate from September 2026; for Fiducuenta
   alone it reaches back a year, and there the growth equals the gains to
   the centavo (no money in or out in that year).

   **The yearly rate is measured in PESO-DAYS** (Jose, 2026-09-24, after it
   said 5.49% for 2026 on his data): every peso counts only for the days it
   was earning, the return over that capital is a daily rate, and the yearly
   rate is (1 + daily) ^ 365 - 1 - never a sum or an average of percentages.
   The first version counted 98 million of products worked out since
   September as if they had been there all year; corrected, 7.80% on what
   is recorded. An investment's return is **spread over the days it covers**
   (`investmentReturns`): a "subio inversion" written down after two weeks is
   two weeks of gain, from the day after the return before it (the last one
   before the window is loaded for that). A month, a period and a rate all
   read those pieces, never the lump.

   **Days before an account was worked out are ESTIMATED, and always said to
   be** (`core/report/estimate.ts`; Jose, 2026-09-24). What a product says
   it had already earned cannot fill them - that record is years of yields
   in one figure. So, for any user and any account with products: the
   account's balance on each earlier day, exact, from its movements (the
   close of the day before, as the engine uses), times the rate the account
   actually earned on its first seven worked-out days (paid over what was in
   its products, net of withholding, every product and every part). The
   window reaches back as far as the report's (a year for the charts; a year
   before today at most for "all time"). Such a day is a `YieldDayRow` with
   `estimated: true` and product id = the account's, negated. It counts in
   the totals, the rate and the charts, and is shown apart everywhere it
   counts: a "De eso, estimado" figure in amber, "incluye X estimado" under
   the net, the rate and the real gain, a line in the notes naming the
   accounts, when their working-out began and both assumptions (the rate
   never changed; the movements do not carry the yields already inside the
   balance, so it falls short), and "Estimado" in the product column of the
   days sheet. It is never a balance on record: the growth chart and "on
   record since" ignore it. On Jose's data: about 5.7 million of 2026's 18.1
   million, 7.96% E.A. against 5.77% inflation.

   **Generic, for any user, and it says when it knows too little** (Jose,
   2026-09-24: "esto debe funcionarle a cualquiera"). Nothing in the report
   code names an account, a category or a bank; every rule reads a flag, a
   type or a date. Where the app knows less than the period asks about, the
   notes say so in amber, naming the account and the date:
   - an account with products whose days before a date could not even be
     estimated - no balance on record, a CDT that has not paid yet - counted
     only from when the account existed (`opened_on`): one opened in June
     is missing nothing about May;
   - an investment whose last gain or loss is more than a month before the
     end of the period: what happened since is in no figure.
   An investment is never counted before its `opened_on` either. Checked by
   building every section and the spreadsheet for every account alone and all
   together, over six kinds of period, on Jose's backup (216 runs), the sample
   (42) and a fresh database (6): no failure. That sweep found a real crash -
   a fraction of a peso reaching `formatMoney` once returns were spread over
   days - fixed by rounding everything that is shown.

   **How the report's arithmetic is proved: an independent audit**
   (`tools/db/audit-yields-report.mjs <backup.json>`, 2026-09-24, when Jose
   asked for an assurance). It recomputes the net, the estimate, the
   investments' gain, the yearly rate, the inflation and the real return from
   the backup file with no app code, and compares them with the sections for
   every account alone and together over seven periods. On its first run it
   found two bugs no test had: a period already over (August, all of 2025)
   carried no estimate, because the first worked-out days that set the rate
   lay after it - they are now read on their own; and a gain written down
   after the period's end lost the share of it that fell inside - movements
   are now loaded up to today. It also settled a rule: **the very first gain
   ever written down covers the days since the account was opened**, never
   "since the window starts", which spread one gain differently by period.
   After both, 112 checks on Jose's backup and 42 on the sample agree to the
   peso and to 0.01 point. Run it after any change to this arithmetic.

   **The money summary has its audit too** (`tools/db/audit-money-report.mjs
   <backup.json>`, 2026-09-24). Income, spending, refunds, what moved between
   accounts, the balance, the count, the daily average, the biggest expense,
   spending by category, by account and by month, and the period before -
   recomputed from the file with the rules written here and compared with the
   sections, every account alone and together, seven periods. It found one
   bug, older than the report and on the summary screen too: slices and the
   list by category were grouped by NAME alone, so a category used both ways
   - Jose files refunds on Rappi Card under the same "Depósitos" his debit
   accounts receive income under - met in one slice and the refunds came off
   the income. They are grouped by name AND side now (`sideOf` in
   `group-movements.ts`): a refund sits with spending, as negative spending,
   income with income. After it: 2,194 checks on Jose's backup, 310 and 247 on
   the two sample backups, all agree to the peso.

   **Each chart says what it holds** (Jose, 2026-09-24, who could not tell
   where 21.7 million came from). "Rendimientos acumulados en {año}" runs
   from January of the period's year, so its last bar IS the year so far -
   the year's net, 18.1 million on his data - where it used to run over the
   chart's twelve months into the year before. A trend point may carry a
   `part` (`TrendBlock.partLabel`): what of it was estimated, drawn paler
   inside the bar, said when the bar is tapped and written in its own column
   of the spreadsheet; both yield charts use it. A comparison row may carry a
   `note`: against the period before, each account says the average balance
   it had earning on each side ("saldo promedio 1.014.514 → 6.448.090" is
   why ARQ USD reads +548%), beside the row in the spreadsheet so the run of
   figures the chart reads is not broken.

   **Both sides of "Contra el periodo anterior" are read the same way.** The
   data window reaches back to the start of the period before as well as a
   year for the charts (`yields-gather.ts`). It used to stop a year back, so
   2026 against 2025 compared nine months with three weeks and read "+1,312%"
   on Fiducuenta; corrected, +1.4%. When either side holds estimated days the
   comparison says so. Known and not fixed: an estimate is worked on the
   account's ledger balance, so a product whose balance is typed rather than
   moved there - Pibank's CDTs - is estimated on almost nothing, and its year
   against the last reads as a huge jump.

   **What is a return and what is money put in** (Jose, 2026-09-24). On the
   yields summary a return is only ever: the yields the app works out for a
   product, or, on an account of type Inversión without products, a movement
   filed under a category marked "Ganancia o pérdida de inversión"
   (`categories.counts_as_return`, migration 047, a switch on the category
   form). A transfer in, a contribution, a bill paid from the fund: money in
   or out, never a return. Inflation, the effective rate, "Rendimientos de
   cada mes" and
   "Rendimientos acumulados" read returns only; the growth chart reads the
   whole balance, and the note beside it says how much of the growth was
   returns. Interest from products and an investment's gain are shown apart
   as well as added, because the DIAN treats them differently.

   - An investment account comes into the summary only if it has at least
     one such movement: eToro and XTB record none - Jose follows them in
     Google Finance - so they stay out rather than sit in the average earning
     nothing. Their market value is still the deferred decision in "Pending
     from Jose". Tyba is archived and has none either.
   - On an account WITH products, a movement under a return category is not
     counted: its yields come from the engine, and such a movement there is a
     cash-out of what was already earned (rule 15).
   - Migration 047 flagged Jose's Ganancia and Perdida, created "Ajuste de
     ganancias" (flagged) and moved into it the three "Dian" expenses on
     investment accounts - the fund correcting the gain it had shown
     (Fiducuenta 2026-07-27 and 2026-08-25, Multinversion 2023-10-03). Jose:
     it lowers the gain, though it was not a loss as such. His own tax paid
     from Bancolombia stays under Dian. Checked on his backup: only those
     three rows changed, 13,260 movements otherwise identical, no balance
     moved, the 254 yield days untouched.
   - `core/report/yields-gather.ts` is every query the summary needs, with
     no Angular in it, so the same code runs over a restored backup in Node -
     how every figure above was checked against Jose's own file.
   - `core/report/investments.ts` holds the pure helpers (a balance at the
     close of a day, the average balance over a stretch, month-end balances);
     `YieldsReportService.investmentsOf` loads each account's balance where
     the window opens and its movements from there, two queries for all.
   - The sample backup carries "Fiducia Ámbar", a fund written down the same
     way, with a monthly contribution and one correction.

   **Against inflation** (Jose, 2026-09-24: "si esta por encima o por debajo
   de la inflacion"). `inflation_months` (migration 046) is the DANE's IPC,
   one row a month, index times 100, shipped up to August 2026 from the Banco
   de la Republica's statistics service (series 15000) and checked against
   the DANE's releases (5.10% for 2025, 1.18% for January 2026).
   **The inflation a period is set against is the AVERAGE of the annual
   inflation the DANE published for that year, from January to the period's
   last month** (`inflationReference`; Jose, 2026-09-24). A month not yet
   published is simply not in the average; with nothing of the year
   published, last year's December, labelled borrowed; a period across a
   year end takes each year with its own figures, weighted by days. **Never
   figures of another year.** The first version annualised the variation
   since January and said 7.98% for 2026 - Colombian prices rise most in the
   first months, so that pace is no year's inflation; the average to August
   is 5.77%. The section shows the real return ((1 + E.A.) / (1 +
   inflation) - 1), that inflation, what it took from the same peso-days the
   return is measured on and the real gain - pesos only; a dollar account alone shows none
   of it. **Colombia's index only, and that is decided** (Jose, 2026-09-24):
   inflation differs by country, and the app is Colombian in other ways
   already - the tax simulator is form 210. A person keeping accounts in
   another currency simply does not see the section. It does not touch the tax module (rule on the simulator standing
   apart). **Newer months: fetched on the phone only, and NOT verified
   there.** The service answers an empty body without a Referer from its own
   site and sends no CORS header, so a browser cannot read it; the phone asks
   through `CapacitorHttp` at most once a day. Its certificate chain is sent
   without the intermediate, which Android's native HTTP may refuse - if it
   does, the shipped months stay and later ones are estimated, labelled. To
   check on the phone: open the yields summary in October and see whether
   "IPC del DANE hasta septiembre" appears instead of an estimate. A figure counts as
   what the bank paid where a day was checked (`actual_net_minor`), and as
   what the app worked out otherwise (`paidOf`). A product alone in its
   account is named by the account. Test data: `tools/db/sample-yields.mjs`
   writes `Pruebas/finance-rendimientos-de-prueba.json` - invented accounts,
   January to yesterday, worked out by the real engine, some days "checked"
   with a few centavos of drift.

21. **The app is meant for other people too, and some of it is paid.** Said
   by Jose on 2026-09-22, asked for as a plan rather than as work: "esto le
   puede servir a otro usuario que haga lo mismo que yo, ingresar las cuentas
   y los movimientos manualmente". **None of this is built. Nothing below
   starts without his word.**

   **Decided by Jose on 2026-09-24** (replacing his first list of 09-22): a
   subscription, monthly or yearly, sold through Google Play.

   **Free, and never behind a payment** - enough to use the app every day,
   and everything that is the person's own data: accounts in pesos,
   movements, transfers, the summary screen and its donut, renaming and
   hiding categories, backup and restore (local and Drive), and the CSV
   export. Charging someone to take their own figures out of a finance app
   costs the trust the rest depends on.

   **Paid:**
   - **Several currencies**, including the TRM fetched every day.
   - **Importing statements**, and the review screen with it. **The first
     statement is free**: trying it once is what sells it.
   - **Products and yields.** **One product is free**: seeing the daily yield
     of one account worked out to the centavo is the best argument for the
     rest - no other app does it for Colombian high-yield accounts.
   - **Account and category pictures of one's own.** The built-in icons are
     free. Cosmetic, so a lock here never drives anybody away.
   - **Creating new categories.** Renaming and hiding the ones that come with
     the app stay free: a list nobody can adjust on day one is a reason to
     uninstall before seeing what the app is worth.
   - **The income-tax simulator** (`/tax`) and its spreadsheet.
   - **Part of the financial summary** (`/report`) - proposed on 2026-09-24,
     not yet confirmed by Jose. Free, because they are what hooks someone:
     the headline figures, the same against the period before, where the
     money went, and the biggest movements. Paid: the categories that jumped,
     the categories before and now, what comes back every month, charges
     repeated inside one period, the months of the year, the accounts, and
     the spreadsheet. A paid section shows its title and what it would tell
     you, not its figures. The report is a list of sections (rule 20), so this
     is one flag per section and nothing else.
   - **Bank notifications**, when that feature resumes (rule 22).

   **A 7-day free trial with everything unlocked**, then the free limits above.

   **The market, looked up on 2026-09-24** (prices in USD as listed; COP at
   that day's TRM of 3,264.39; regional Play prices can be lower):
   - Subscriptions: Wallet by BudgetBakers ~EUR 4.49/month with a yearly
     discount and occasional lifetime offers; Spendee Premium $5.99/month or
     $35.99/year (~19,600 / ~117,500 COP), Spendee Plus $1.99 / $14.99; 1Money
     $7.99/month; Mobills ~20,000 COP/month in Colombia (R$18/month, R$96/year
     on promotion in Brazil); YNAB $14.99/month or $109/year - the top of the
     market, and too dear for Colombia.
   - One payment: Monefy Pro $2.49 (~8,100 COP); Money Manager by Realbyte
     $5.99 (~19,500); Money Lover lifetime $15-25.
   - Made in Colombia: Kuanto (free, logs through Telegram), Bankity (free,
     reads bank notifications - the closest to rule 22), Gestiona Plus (90-day
     trial). None of them works out yields, withholding or a tax return.
   - What reviews complain about: subscription fatigue - paying monthly for
     a budget app, being asked to pay before seeing it work - and basic
     things locked behind the paywall (Monarch's category limit).
   - Google keeps 15% of a subscription (10% service + 5% billing where the
     2026 split applies).

   **Price, accepted by Jose for now (2026-09-24)**: **11,900 COP a month and
   69,900 COP a year** (5,825 a month, about half off), below Mobills and
   Spendee at ~20,000 because this app is new and nobody knows it yet, and
   well above the one-payment apps because it does what none of them do.
   After Google's 15% that is about 10,100 and 59,400. A lifetime purchase at
   about three years' price is worth trying later for the people who refuse
   subscriptions, not at launch.

   **None of this is fixed.** Jose, accepting it: there is a lot of
   competition and no price guarantees anything, so the app will adapt
   little by little - more to offer, features moved between paid and free,
   the price itself. That is exactly why the design keeps it cheap to
   change: one service answers "is this paid for", and the report's paid
   sections are one flag each. Moving a feature to free must be a one-line
   change and never a migration.

   **The owner never pays for his own app, and three different tools do
   three different jobs** (planned 2026-09-24, nothing built):
   - **APKs built for testing** (GitHub Actions, sideloaded) carry a build
     flag that makes the one service answer "everything unlocked", with a
     switch inside those builds to see the free version and test the paywall.
     The store build never has that flag. A debug APK must never be handed to
     anybody else for that reason.
   - **The app Jose uses every day, once it comes from the store**, gets
     permanent access granted to his own account - a promotional entitlement
     in RevenueCat's dashboard if RevenueCat is what sits behind billing,
     which needs no code and can be taken back, or else his account on an
     owner list inside the one service. Assumed, to confirm on the day: that
     RevenueCat grants such access to one user.
   - **Testing the purchase itself** uses Play Console's license testers: a
     test card, never a real charge, and subscriptions that renew in minutes
     instead of months so a whole cycle can be watched in an afternoon. Only
     for testing - such a subscription expires by itself after a few
     renewals, so it is not how the owner keeps access.

   **Three rules this must obey, all of them consequences of rules already
   here:**

   1. **A lock never hides money.** It stops something NEW, never something
      already on record. Someone whose subscription lapses with dollar
      accounts on file still SEES those accounts, their balances and their
      movements; what they cannot do is add another one. An app that hides a
      person's own figures behind a payment is not a finance app.
   2. **A lock is never felt offline** (rule 1). What the person is entitled
      to is cached with the day it was read, and with no network the last
      answer holds. Nobody is shut out of their own accounts on a bus.
   3. **One place answers the question.** A single service says whether a
      feature is paid for, and every screen asks IT - never a check copied
      into four components, and never a check inside the engines. The tax
      engine, the report analyses and the accrual do not know that money
      exists.

   **What to build first, and it is small**: that one service, a paywall
   screen, and the route guard that sends a locked screen to it. It can
   answer from a local setting while there is no store behind it, which is
   what makes the whole thing testable long before a single peso is charged.
   Plugging Google Play Billing in afterwards touches that one service and
   nothing else. **Do not scatter the question through the app; that is the
   only mistake here that is expensive to undo.**

   **What sits between the app and Google Play** (looked up 2026-09-24,
   recommended, not yet decided by Jose). Google recommends checking
   purchases on a server and telling the app about renewals, cancellations
   and refunds; this app has no server and is not meant to. Three ways:
   - **Nothing in between**: the Play Billing library asks Google on the
     phone which subscriptions the account holds. Free, and truly no server,
     but every edge - acknowledging a purchase in time, renewals, grace
     periods, refunds, a new phone - is ours to get right, with no dashboard
     to see any of it, and no way to grant the owner access.
   - **A subscription service** that is the server for us. RevenueCat: free
     up to US$2,500 of revenue a month, about 1% after that, and an official
     Capacitor SDK (`@revenuecat/purchases-capacitor`). Adapty: free under
     US$5,000 a month, 1% after. Qonversion: free under US$7,000-10,000
     (sources disagree), 0.6-0.8% after. At the accepted price, US$2,500 is
     about 8.2 million COP a month - some 690 monthly or 1,400 yearly
     subscribers - before anything is owed. What they see is an anonymous id
     and the purchases, never a movement or an account; the privacy policy
     has to say so.
   - **A server of our own** (a cloud function checking Google's API): the
     most work, and the one thing this app has always refused. Not now.

   **Recommended: RevenueCat.** It costs nothing until the app earns real
   money, it is the one with the official Capacitor SDK and the most
   written about it, it grants the owner permanent access from its
   dashboard, and it would cover the App Store on the day there is one (see
   "iOS"). Switching later to Adapty or Qonversion touches only the one
   service. Setting it up needs the Play developer account, a payments
   profile, and a Google Cloud service account that lets RevenueCat read
   Play's purchases - steps for Jose's accounts, not code.

   Still to decide, by Jose, and not by guessing: which report sections are
   paid, whether a lifetime option is ever offered, and what sits between
   the app and Google Play.

22. **Movements can be PROPOSED by the app, and only a person makes them
   real.** Designed with Jose on 2026-09-22 and 23, for the people who will
   not type every movement by hand the way he does.

   **The PDF half is BUILT and Jose uses it** (2026-09-23/24):
   `core/statements/` reads the file, `core/proposals/` decides what each row
   probably is, `ProposalsRepository` writes the proposals and
   `features/review/` is where a person answers them. Ways in: the summary
   screen, for an account that exists, and the account form, which fills
   itself in from the statement and then imports it. **The notification half
   has its first step built**, paused on 2026-09-24 and resumed on
   2026-09-25 - see "Step one is built" below - and nothing else about it
   has changed.

   Two sources, and one screen where they both end up:

   - **A statement in PDF**, opened from the account it belongs to.
   - **A bank's own notification**, read as it arrives.

   **The review screen is the point of the whole feature**, not a detail of
   it. Every proposal is listed with what was read, and the person accepts it,
   corrects it first, or throws it away. Jose, 2026-09-23: "eso es lo mas
   importante de todo esto en realidad". Nothing is ever written without that
   answer - not one movement, not one category.

   **Ruled out, and why:**
   - **Suggesting a recurring expense before it happens** (rejected by Jose,
     2026-09-23): "asi sea un gasto recurrente, quiero que sea en el momento
     que se registre como tal, no inventando un gasto que aun no ha ocurrido".
     The app knowing the rent usually falls on the 5th does not make it a
     fact. Same instinct as rule 15's opening figure: a record is not an event.
   - **CSV and Excel.** They look easier and are not: the app would have to
     guess what each column means from a heading every bank words
     differently, which means asking the user. Jose: if it needs that, leave
     it out.

   **Why a PDF can ask LESS than a spreadsheet.** A PDF has no columns, it has
   text with coordinates. Group it into lines, and then what a thing IS shows
   in its shape rather than in a heading: a date looks like a date, an amount
   looks like an amount, and whatever is left is the description. In the good
   case the person is asked nothing at all. What it costs: a PDF reader on the
   phone (pdf.js, 1-2 MB, offline), a password prompt for the statements that
   carry one, and a rule for deciding what is money in and money out - the
   running balance settles it where the columns do not.

   **The proof that makes an import trustworthy: the statement's own
   balances.** Opening balance plus what was read must equal the closing
   balance. If it does not, NOTHING is imported and the screen says by how
   much it is off. Never "47 movements imported, hopefully right" - the same
   rule as everywhere else here: a total nobody can check is a total nobody
   trusts.

   **OCR is not a second feature, it is a door into the same one.** Where a
   PDF is a scan, or the person only has a screenshot, the picture becomes
   text (on the phone, free, offline) and the same reading follows. Last,
   deliberately: OCR misreads digits, and digits are money. The balance check
   above is what would catch it. If the banks hand out PDFs with real text,
   this is never needed.

   **What a notification actually gives**, which is little but exact: the
   package that posted it (`com.bancolombia.app`), its title and text, and
   the moment it arrived. So **which bank it is, is data, not a guess** - and
   the way an account is attached to a bank is the person pointing at one of
   the apps the phone has ACTUALLY been seen posting notifications from.
   **No built-in list of banks**: a list of Colombian banks would be wrong in
   every other country, and this app is not Jose's alone any more.

   The amount comes out of the text by pattern. The category never comes: the
   only clue is the merchant's name. So **a dictionary that learns** - the
   first time "EXITO" is filed under Mercados it is remembered, and next time
   it is what gets proposed. Offline, free, better with use, and it serves
   typing a movement by hand just as well. An LLM is not needed for the common
   case and is not to be reached for first.

   **When the notification does not say enough** - and some banks only say
   "you have a new movement" - the proposal still appears, saying what is
   true: a notification from this app, which is attached to this account, that
   could not be read. Asked for by Jose in those words. The person types the
   amount and the category, or throws it away. Silence is not something the
   app invents around.

   **The app adapts to each bank by itself, from what the person does**
   (Jose, 2026-09-25: save the user every step and every manual process
   possible, without costing performance or the experience). Designed, not
   built: the reading waits for real notifications on Jose's phone, so the
   generic first reading is shaped by real text rather than guessed. Nothing
   in it names a bank, a country or a format.

   - **A first reading by shape**, the same one the statement reader uses: an
     amount looks like money, money in or out is said by ordinary words of
     both languages, what is left is the merchant.
   - **Then the app learns the MOLD of each app's message.** When a person
     accepts or corrects a proposal that came from a notification, the text
     is stored as a mold for that package: the amount, the merchant, the
     date and any card digits become slots, and the fixed words stay. The
     next notification of that app that fits the mold is read with it,
     exactly. A bank never seen before costs one correction, not a release.
   - **Which account, learned too.** An app posting for several accounts
     (a debit account and a card of the same bank) usually names the last
     digits; the digits a person files under an account are remembered for
     that app. With one account tied to the app, nothing is asked.
   - **Category, as today**: the dictionary learned from the person's own
     ledger, then the common words.
   - **The answer is one tap wherever it can be.** A proposal read by a
     learned mold, with a learned account and category, needs nothing but
     "Guardar", and "Guardar los N" takes all of them at once. It is still
     never written without that tap (the rule above).
   - **Performance, by construction**: the Java side only stores the raw
     notification, which costs nothing while the phone is in a pocket. The
     reading happens in the app, in one pass when it opens or returns: one
     read of the molds and the dictionary, answered in memory, and the
     proposals written with `insertMany` - never a query per notification,
     and nothing working in the background.

   **Several rows answered at once** (Jose, 2026-09-25, built). The review
   screen and the notifications screen share one gesture and one bar:
   "Seleccionar", or a long press on a row (the `contextmenu` event, which
   Android's WebView fires on a long press - to confirm on the phone), turns
   on a round tick per row; a floating bar says how many, "Todos"/"Ninguno"
   over what the filter shows, and what to do. On review: one category for
   all (`fileThese`, one UPDATE), save the ready ones (the count on the button
   is what will be written, and the dialog says how many stay behind and
   why), or discard (`rejectThese`, one UPDATE, asked first). On
   notifications: keep what they say, stop keeping it, or hide them (asked
   first when something kept goes with them). The bar, the tick and the
   picked row are `.selection-bar`, `.tick`, `.picked` in global.scss.
   Checked in a browser on the invented Banco Azul statement; the
   notifications screen only exists on Android, so its half is checked on
   the phone.

   **Both screens search, and a long list has the two arrows** (Jose,
   2026-09-25). Review searches a row's description, what was read, the
   account, the category, the amount and the day - and the digits alone, so
   "45900" finds "$ 45.900,00"; it narrows the list like the filters, so
   "Todos" in the selection bar ticks only what was found, and the note that
   a filter hides rows names the search. Notifications searches an app's name
   and package and what it said. `foldText` (`core/text/fold-text.ts`) is the
   one definition of how a search compares text. The review menu's "forget"
   is "No ver más estos movimientos en pantalla", with the crossed eye.

   **The app does not have to be open.** Android itself starts
   `NotificationCatcher` once notification access is given and keeps it
   bound, app open or not; it writes to SharedPreferences, and the app reads
   that when it opens. What can stop it is the phone, not the app: some
   makers (Xiaomi among them) kill background services to save battery, so
   the notifications screen may need to say "Sin restricciones" and
   "Inicio automático" if Jose's phone shows gaps. Not seen yet; to watch.

   **The hardest problem in the feature, written down before it is met**: the
   SAME movement arriving from both sources. A notification today, and the
   statement next month carrying that same purchase - with a different date
   (authorised, then posted) and a different description ("EXITO POBLADO" in
   one, "COMPRA EXITO POB 123" in the other). An exact fingerprint will NOT
   catch that. So the check has to be a tolerant one - same account, same
   amount, a few days apart - and what it produces is a QUESTION on the review
   screen, never a silent skip. Where the two are the same thing, the
   statement is the truth and may correct what the notification left, unless
   the person edited it by hand: `locked` still wins, as in rule 14.

   **A transfer is two legs, and both sources will report it twice** - once
   leaving, once arriving. Accepted separately they become an expense and an
   income, and every spending figure in the report is wrong. The review screen
   has to notice the pair and offer to join them.

   **What survives from the importer that was removed** (rule 12), and it is
   the expensive half: `import_fingerprint` and `import_seq` with the partial
   unique index that still allows two identical bus fares on one day,
   `import_batches`, `review_queue`, `deleted_imports` so a rejected proposal
   never comes back, and `locked`. All of it proven on 12,890 real rows.

   **This reverses rule 12, and that is deliberate** - but the danger that
   caused rule 12 is the same one, so it has to be impossible by construction
   rather than by care: **nothing here ever touches a row that already
   exists.** A proposal is a proposal until a person answers it.

   **The opening balance is what absorbs the history nobody typed in.**
   Jose's idea, 2026-09-23, and it is the thing that makes an imported
   statement worth importing. An account opened in this app at zero, given one
   month of statement worth two million, shows two million - while the bank
   says four. The missing two million is not an error: it is the years before
   that month, which nobody is ever going to type.

   The balance this app shows is `opening_balance_minor` plus every movement,
   whatever its date (`accounts.repository.ts`). So the figure that makes the
   account agree with the bank is arithmetic, not a guess:

       opening = what the bank said on day D  -  the movements up to day D

   A statement hands over both halves of that: its closing date and its
   closing balance. Accept its movements, set the opening figure to the
   remainder, and the account says what the bank says - while everything typed
   or notified AFTER that day goes on adding on top, correctly.

   And it stays true as more history arrives. Import an older statement, accept
   its movements, and the same line is computed again: the sum up to D grew, so
   the opening figure shrinks by exactly as much, and the balance never moves.
   Jose said "ir restando cada vez", which is the same thing said as a
   difference; computing it from the anchor instead is what makes it
   self-correcting rather than a running total that can drift.

   What that needs: the anchor itself on record - the day and the figure the
   bank stated - so it can be recomputed rather than remembered. Not built yet.

   **Three rules for it, when it is built:**
   - **Only ever offered, never done.** It rewrites `opening_balance_minor`,
     which is Jose's own figure, so the screen shows what it is now, what it
     would become, and why - and he presses the button.
   - **Only from a statement that agrees with itself.** A misread closing
     balance would anchor the account to a wrong number, which is worse than
     leaving it alone.
   - **It is not a yield, a product or a correction.** It touches one column of
     one row, and it never invents a movement to explain itself - that was the
     mistake of the opening figure in rule 15, and it is not to be repeated
     under a new name.

   **The first step is not code**: read the notifications Jose's own banks
   post and show them raw for a few days, interpreting nothing. Half of them
   may be useless ("open the app to see"), and that is worth knowing before a
   single parser is written.

   Noted and deferred by Jose: Google reviews the notification permission
   closely, and the screen Android shows asks to read EVERY notification on
   the phone. Everything not from an attached bank is discarded, and the app
   says so plainly.

   **Step one is built** (2026-09-24): `NotificationCatcher`,
   `NotificationStore` and `BankNotificationsPlugin` in `android/`, the
   screen at `/notifications`. It keeps WHICH apps post for everybody and
   WHAT they said only for apps ticked by hand, and interprets nothing.
   Paused on 2026-09-24 because Play Protect blocked every sideloaded APK
   declaring the listener, and **resumed on 2026-09-25** by reverting that
   commit, once Jose's phone ran the app installed from the Play Store's
   internal track. The Java package stays `com.josemoncada.finance` (the
   namespace), so `.NotificationCatcher` in the manifest still resolves
   under the new application id. The consequence to remember: **a debug APK
   from `debug-apk.yml` is blocked again by Play Protect**, and it could not
   update the store install anyway (different signing key). The phone is
   updated only through "Store bundle" and the Play Store from here on.

   That wait was short, and it is NOT the 12-tester closed test. Internal
   testing needs only the Play account and one upload, admits up to 100
   people (Jose alone is enough) and has no 12-tester, 14-day rule; the
   closed test is only the gate to publishing for everybody and has nothing
   to do with which features are in the app. So the order is: Play account,
   an internal-testing build installed from the store (the one uninstall of
   "Getting it into Google Play", step 2), notifications resumed and tried
   on it, and the closed test running alongside. Clarified for Jose on
   2026-09-24 after an answer made it sound as if notifications waited for
   production. From memory, to confirm on the day: that internal releases
   arrive without the long review, and that Play Protect leaves a store
   install alone.

   **And the first APK carrying it was refused by Play Protect** (Jose's
   phone, 2026-09-24): "Se bloqueó la app para proteger tu dispositivo - esta
   app puede solicitar acceso a datos sensibles", with no "install anyway".
   Verified: the block happened, and this was the first APK to declare a
   `NotificationListenerService`; every one before it installed. Assumed, not
   verified: that the listener is the reason - it is the permission banking
   trojans ask for, and Google's newer fraud protection blocks sideloaded apps
   that declare it when they arrive from a browser, a chat or a file manager.
   **Every future sideloaded APK will meet the same wall while the service is
   in the manifest**, so this is a cost on every update, not a one-off.

   **With the service out, a gentler warning remains** (Jose's phone,
   2026-09-24/25): "Se bloqueó la app para proteger tu dispositivo - Play
   Protect no vio una app de este desarrollador antes", this time WITH
   "Instalar de todas formas", which installs over the existing app and keeps
   the data (same package, same debug key). It is Play Protect not knowing the
   debug certificate as any developer's - every sideloaded APK of this app will
   show it. "Entendido" cancels the install. It ends when the app comes from
   the Play Store's internal track, signed through Play App Signing. A
   store install is not blocked, which is one more reason the Play Store's
   internal track (see "Getting it into Google Play") matters for this
   feature in particular.

   **What reading a statement learned, once it met real ones** (2026-09-23/24,
   all of it from Jose's own Rappi, Ualá, Nu and Fiducuenta files):

   - **The running balance column is the witness.** Where the statement
     carries one, it decides the sign of every row and the opening and closing
     figures, and the words "Saldo anterior"/"Saldo final" are ignored - a
     real statement has several lines with "saldo" on them and the ones the
     app does not know about are the ones it would pick. Where the two
     disagree the reading is `'unclear'`, never `'off'`: crying wolf about a
     file that was read correctly costs more than saying nothing.
   - **A minus in a PDF is rarely the ASCII hyphen.** It is U+2212, an en
     dash, a non-breaking hyphen. All of them read as a minus now, and a
     leading `+` reads as a plus - without that, every line of a statement
     that signs its own amounts was called an expense, cashback included.
   - **A sign the bank printed is not a guess**, and carries no warning.
   - **The category comes from what this person files**, learned from their
     own ledger; where that says nothing, about a hundred ordinary words of
     both languages (`core/proposals/common-words.ts` - supermercado,
     farmacia, peaje, nomina) may suggest one. Words and never brands: a list
     of Colombian shops would be wrong in every other country, the same reason
     this refuses a built-in list of banks. A guess can only land on a
     category that came with the app, so a list somebody has renamed is never
     overruled; the sign picks which half of the list may answer; and it is
     marked `guessed` and shown as "sugerida", never as "aprendida", because
     the app has no history to claim.
   - **A phone is not a browser, and the bridge is what costs.** Every call
     to SQLite crosses into the native plugin, and on Android that crossing
     costs far more than the query. Reading a statement took forty seconds
     there and an instant in the browser, entirely because of per-row work:
     `learnFromLedger` wrote one INSERT per merchant - three thousand of them,
     on every import - and each proposed row asked three more questions.
     **Read a table once and answer in memory; write many rows per
     statement.** `insertMany` in `ProposalsRepository` is the shape to copy.
     Three thousand round trips became about forty.
   - **It says what it is doing and can be stopped.** Both ways in show the
     stage, the page, the percentage and a Cancel. Nothing is written until
     the end, so stopping leaves the database as it was.

23. **A new install is not an empty one.** Found by Jose on 2026-09-23: a
   fresh database had three categories - Cashback, Corrección del banco and
   Otro, which migration 037 makes out of the three kinds a product's own
   movement can be - and not one of them was an expense. Since a movement
   that is not a transfer must carry a category, somebody installing this app
   could not record the first thing they spent. Jose's own forty-nine came
   from the app he used before, so he never met the empty case.

   `core/database/starter-categories.ts` holds twenty-two ordinary ones and
   `DatabaseService` seeds them on start. Three things about it:

   - **Deliberately not Jose's list.** His has Didi, Éxito, EPM, D1 and
     4x1000 in it, which are a person in Medellín and not a starting point
     for anybody else (rule 21).
   - **"Empty" means no expense category at all**, which is true of a fresh
     install and of nothing else. Jose's database is looked at on every start
     and left exactly as it is.
   - **They are the app speaking, so they arrive in its language** - and only
     at that moment. From the second they exist they are the person's own
     words and nothing ever translates them again.
   - **Two of them come marked as an investment's return** (2026-09-24,
     Jose): "Ganancia de inversión" and "Pérdida de inversión" (rule 20,
     the yields summary). Without them a new user would have to create a
     category and mark it before any fund could show what it earned - and
     creating categories is meant to be paid (rule 21).

   `tools/db/sample-data.mjs` builds the test backup from these and invents
   no category of its own, so what it restores looks like a phone somebody
   just set up.

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
layer, the yields module, the statement reader and the proposals are covered
by 540 tests that run against a real
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

**Every movement is entered by hand** (2026-09-12), after the old importer
kept putting Jose's corrections at risk. Rule 12 says what is left of it and
what not to do with it. The statement reader of rule 22 does not undo that
and is not a second importer: it writes PROPOSALS, which are not movements
until a person on the review screen says so, and it never touches a row that
already exists.

Data moves between the browser and the phone as a backup: "Importar y
exportar" saves one and restores one. A copy of the current one lives in
`G:\My Drive\Finance App`, and the newest `.json` there is what to verify
a change against. The Android project lives in `android/`
(Capacitor 8).

**SQLite in the browser works** (verified 2026-09-24, in headless Chrome
against `ng serve`): `jeep-sqlite` mounts, a fresh database migrates and
seeds its starter categories, and a currency saved from a dialog is read
back. Jose also runs the app with `npm start` day to day.

**The copy in Drive is one file, and a device only writes over what it has
seen** (2026-09-24). Saving to Drive is automatic, so two phones on one Google
account is the one situation where a whole history can be lost: the second one
sends its older database over the good one, quietly, because it was signed in.

The first guard compared sizes - a copy under a tenth of the other asked
first - and Jose said why that is wrong: his second phone has been restoring
backups to try things out, so it holds far more than a tenth and is still
months behind. Size never said anything about age.

So each device remembers WHICH copy in Drive it continues: the `modifiedTime`
of the one it last uploaded, or last restored from (`rememberSeen`, in
`cloud-backup.service.ts`). Restoring a file from anywhere else forgets it,
because then nobody knows how that file relates to Drive. If what is up there
is something else, nothing is uploaded and the screen says when that copy was
written and how much it holds. Saving on its own asks once and then stays
quiet about that same copy; the button asks again, because pressing it is
deliberate.

And answering yes is not irreversible: Drive copies the old one beside it
first, as `finance-backup-replaced-<date>.json`, on the server, so none of
the 25 MB crosses the phone's connection. That was Jose's own idea - he asked
for one file per phone - kept without its cost, which was two files both
looking current and nobody remembering which was the real one.

**An `app-confirm` is never created already open** (2026-09-24, and it cost
two rounds of "it does not appear"). It is an `ion-modal`, and an ion-modal
presents when `isOpen` goes from false to true; one built inside an `@if`
with `[open]="true"` has nothing to transition from, flashes and dismisses.
Leave the dialog in the page and bind `[open]` to the signal, the way the
review screen always did. `tools/db/confirm-dialogs.test.mjs` fails on the
other shape, because this failure looks exactly like a button that does
nothing.

**A dangerous question is asked where the decision is made.** Restoring a
backup asks the moment the file is chosen - by then it has been read and
described, and the only thing left to say is yes or no - names the file in the
question, and carries the warning inside the dialog rather than in a paragraph
somebody scrolls past. Saying no puts the picker back. Jose, 2026-09-24.

**The app is used every day and shaped from the phone** (2026-09-21). What
Jose reports is almost always a screen that reads wrong on a real phone rather
than a wrong figure, and the answers keep coming back to one rule: **a control
that appears on two screens has one definition, in `global.scss`.** Spending
and income are that pair - `.compose` and `.compose-bar` live there, and both
the summary screen and a product's sheet read them, in that order and that
shape. The category picker's two orders (most-used, A-Z) share one
`localStorage` key, `finance.categoryOrder`, with the categories screen, for
the same reason: it is one preference about one list - and the pills
themselves are `.order-pills` in `global.scss`. Adding a currency is one
dialog (`shared/currency-dialog`) on both screens that offer it, and it
refuses a code that exists rather than renaming it: the two inline copies it
replaced did an upsert, so typing USD with another name renamed the dollar
every one of Jose's dollar accounts is kept in. The product sheet shares the movement form's whole
stylesheet by `styleUrls`, deliberately.

**Any account from the products screen, one account list everywhere, and one
tap between an account's movements and its yields** (Jose, 2026-09-24).

- The product form records against a product, so its account picker offered
  only accounts with products, and an expense from any other account meant
  closing it and starting again elsewhere. Its picker is now **the movement
  form's own list, drawn identically** - "Cancelar", "Desde dónde", the two
  orders, one list, the tick - with every account in it (only accounts with
  products for a move between products). An account with products stays on
  the product form; one without hands the amount, the day and the note to the
  ORDINARY movement form on that account (`EntryRequest.start`). No third
  form. A first version split the list into "with products" and "other
  accounts"; Jose found the plain list better and asked for one list, never
  two - do not bring groups back.
- **The account list is one component now**, `shared/account-picker`
  (Cancelar, a heading, Más usadas / A-Z under `finance.accountOrder`, the
  list, the tick). The product form and the products screen's account sheet
  use it; the movement form keeps its own because it also picks a product in
  the same sheet. Its heading is said for the occasion (Jose, 2026-09-24:
  "Desde dónde" was showing everywhere): "Desde dónde" where money leaves,
  "Hacia dónde" where it arrives - an income, a transfer's far end - and
  "Cuenta" when an account is only being chosen to look at or to move money
  between its products.
- The title of an account's sheet on the products screen is that list: tap
  it to go to another account with products without leaving (never while a
  form is open, which would be lost). Only accounts on that screen are
  offered.
- The search lives inside the "Movimientos" tab, a rounded field between
  the views and the list ("Buscar en {periodo}: nota, categoría o cuenta"),
  and no longer behind a magnifier in the header: it only ever searched the
  movements, so from up there it meant opening the list afterwards to see the
  results (Jose, 2026-09-24). The tab's count and Entró / Salió follow what it
  finds, as they always did.
  While it is typed into, the compose bar and the scroll buttons step aside
  and the field scrolls to the top of what the keyboard leaves, so the
  results sit under it (on his phone the bar had covered them). The keyboard
  closing - Android's back button included, which does not blur the field -
  brings the bar back. Checked in a browser at keyboard-up height; not yet on
  the phone itself.
- **Text cut short with "…" slides to show the rest of itself, on every
  screen** (`core/ui/marquee.service.ts`, started by `AppComponent`; Jose,
  2026-09-24). No directive per place: the service finds, a moment after
  the page stops changing, every element with a text of its own that the
  stylesheet clips with an ellipsis, so a new screen gets it for free. Such a
  text slides ONCE, a second after it comes fully into view, rests, slides
  back and stays still, and again when tapped - ten long names moving
  forever would be a list nobody reads. Only a text marked `marquee-loop`
  slides without stopping, and that is kept to texts that stand alone: the
  account and its hint in the summary's header, the account in a products
  sheet's title, the line under the report's title. Nothing moves that fits,
  and nothing moves at all when the phone asks for reduced motion.
  **It moves by `transform`, never `text-indent`**: the first version
  animated text-indent and walked the whole page after every change, which
  was smooth on a computer and jumped on Jose's phone - a millimetre, then
  the end - because both ran on the thread the app runs on. Now the text is
  put in a `.marquee-track` span for the length of a slide (for good on a
  looping one) and moved with a transform the phone runs on its own, and
  only nodes added to the page are looked at. A once-slide puts the text
  back where it was, so the "…" returns; Angular keeps updating the moved
  text nodes, and a looping text that changes is measured again. Checked in
  a browser: the long account name slides smoothly, switching to a short one
  stops it, a category title slides once and gets its ellipsis back.
  A search field's hint cannot slide (it is an input's placeholder); it ends
  in "…" instead (global.scss).
- **An account's sheet on the products screen searches its movements the
  same way** (Jose, 2026-09-24): the same `.search-row` (now in global.scss,
  one definition for both), matching what each row says - its title and the
  line under it, notes included - without accents or case; the compose bar
  steps aside while typing, as on the summary. A new account starts with an
  empty search. The sheet's bottom bar also carries the same round transfer,
  from that account to where it usually sends money; the "Nueva
  transferencia" button that sat beside "Mover entre productos" did the same
  and was removed, so that row is only there for an account with more than
  one product.
- The transfer button lives in the summary screen's bottom bar, round and
  blue beside the Gasto and Ingreso pills (`.compose .swap` in global.scss),
  and no longer in the header, where it crowded the account and the search.
- **A transfer starts FROM the account on show, TO the account it sends money
  to most often** - from the products screen and, since 2026-09-25, from the
  summary screen too (`EntryRequest.preferredSide: 'from'`; Jose). The
  summary used to make the account on show the destination, on the idea that
  transferring while looking at a card means paying it; Jose asked for one
  rule on both screens. With every account on show, the route still starts
  where money usually leaves.
- **A move between products starts from a product that is not the usual
  one - the one money most often leaves - into the one it most often goes
  to** (`routeBetweenProducts` in the product form; Jose, 2026-09-25). Read
  from the account's own moves between its products, a leg naming no product
  being the usual one's. On Rappi cuenta: Bolsillo Principal into Cuenta de
  ahorros (37 times against 10 the other way). With no history, the first
  product that is not the usual one, into the usual one.
- **A new movement starts with its usual note written** (`core/notes/
  usual-note.ts`; Jose, 2026-09-25): the note most often written for the
  same thing - a spending or an income on the same account and category
  (only once a category is chosen: the account's commonest note alone is too
  vague), a transfer between the same two accounts in that direction, a
  product's own spending or income (same account, product, side and
  category - also only once a category is chosen), a move between the same two products. It takes two
  uses to be a habit; the last year speaks first, then all of it; notes are
  compared without case or surrounding spaces and offered in their latest
  spelling. It follows the form while the person has not touched the note -
  changing the account, the category or the destination offers that one's
  note - and stops for good the moment they type, pick a suggestion or clear
  it with the X. Never over a movement being corrected or a note carried from
  another form. On Jose's data: "Pago tarjeta de crédito RappiCard" (Rappi
  cuenta to Rappi Card), "Cashback RappiCard" (income on its usual product),
  "Retiro bolsillo principal" (Bolsillo Principal into Cuenta de ahorros).
- The title of a products sheet opens the account list from anywhere on its
  row, not only over the name, as the summary's header does (2026-09-25).
- An account's sheet on the products screen has "Ver sus movimientos en
  Inicio": that account selected in `FilterService`, and the summary open.
- The summary screen, beside the balance of one account, has two round blue
  buttons: editing the account - a card with a pencil, drawn in
  `core/icons/account-edit.ts` like the piggy bank, because Ionicons' pencil
  said "edit" and not what - and, only for an account that earns, the piggy
  bank of the drawer, which opens the products screen with that account's
  sheet already open (`/products?account=ID`; the parameter is taken off the
  address once used, so coming back later does not reopen it).

**The drawer marks the screen on show, whoever navigated.** It read
`router.url` in its template, which is only read again when the drawer is
redrawn - after a tap on the drawer, never after a screen sends the app
somewhere - so the button above landed on the summary with "Productos y
rendimientos" still marked (reproduced in a browser before it was fixed). It
reads a signal of `NavigationEnd` now (`app.component.ts`).

A note's matches fall BELOW the note, like any list of matches. They were
ordered above for a while because they had landed behind the keyboard; what
actually fixed that is the rule that hides the rest of the form while the
keyboard is up, leaving the panel ending above it. Asked for and pared back to
exactly that by Jose on 2026-09-21: he had not asked for the query to change
and it was not to change. **The search is `LIKE '%typed%'`, one full read of
every note on record, run on every keystroke.** It is on the list of things to
watch if the app ever feels slow while typing - it is not a licence to change
it unasked.

**The yields screen works out only what changed** (2026-09-18). The accrual
fingerprint is kept per account (`staleAccounts`), so a movement in an account
that earns nothing works nothing out, and one in an earning account works out
that account alone; a new day or a tax parameter still redoes all of them. The
screen reads every account in one batch (`lastDaysOf`, `landedByProducts`,
`heldByProducts`). On Jose's backup: 194 questions to open with nothing changed
became 25. Not done, on purpose: accruing in the background on app start.
`BaseSqlDriver.transaction` keeps one depth counter for the whole app, so a
background write running while the user saves would pull that save into its
transaction, and a rollback would lose it. That has to be fixed first.

**Known and not fixed: a movement dated in a month already worked out does
not change that month's yields** (measured 2026-09-24). The engine resumes
from the top of the last month it worked out, so a 5,000,000 deposit dated 5
September and typed in October left September's yield at 7,864.48 when it
should have risen by about 30,000. Every day from October on is right, since
the balance is read from the ledger; only the days before are stale. It matters
more now that statements import past months. Rule 18's spending bonus is
already re-judged; the ordinary yield is not. Until it is, the "Recalcular"
button on the products screen works everything out again from scratch, locked
days kept. The fix is to resume from the earliest date touched since the last
pass, which has to see deletions too - so it waits for Jose's word, because it
touches every yield he has.

**A claim about the screen is checked in a browser, not reasoned about**
(2026-09-24). Twice in one afternoon a dialog was declared fixed on code that
read correctly and showed nothing. Puppeteer against `ng serve` on a spare
port, driving the real page and taking a screenshot, settled it in two
minutes. Jose's own `npm start` usually holds 8100, so use another.

**How a change to the yields is proved** (2026-09-22, and this is the method
to use again). Restore Jose's current backup into a fresh database, migrate it
forward, work every account out from scratch, and compare that against the
`yield_days` THE FILE ALREADY CARRIES - which is what his phone worked out and
what he is looking at. Anything that differs is either a correction that was
asked for or a bug. Twice today a simulation looked clean because it was
comparing a database against itself; the file is the only "before" that cannot
lie. Two differences are known and expected: Plata, corrected by migration
039, and 0.85 pesos in Global66, five days his phone worked out on a balance
that later changed and never redid.

## Jose's two machines, and a third that is not a machine

Jose works on this repository from two Windows PCs. Claude Code keeps its
conversation history and memory per machine, so what is not written here or
in the commits is not known on the other one.

**A session running in the cloud is a third place, and it is blind in ways
the two PCs are not.** It has the repository and nothing else - a container
that clones this repo, works, and pushes a branch. So, before starting
anything there, know what it CANNOT do:

- **It cannot see `G:\My Drive\Finance App`.** Jose's real backup is not in
  the repository and never will be (it is his whole financial history). Every
  method in this file that says "check it against his current backup" - the
  yields proof, a figure that looks wrong, rule 12 - is a LOCAL job. A cloud
  session must say so rather than approximate it.
- **It cannot write the test backup either**, for the same reason:
  `tools/db/sample-data.mjs` writes into that folder.
- **It has no phone and no browser of Jose's.** It cannot say how a screen
  reads on a real device, which is where almost every problem he reports
  comes from.
- **It cannot build or sign an APK.** No Android SDK, and above all no debug
  keystore - see "Signing the APK". GitHub Actions does that.

What it does perfectly well: `node tools/db/run-tests.mjs` and `npm run
build` (both need nothing but the repo), reading and changing code, writing
migrations and tests, and committing. That is most of the work.

So the division that actually holds: **anything provable from the repository
alone can happen anywhere; anything that needs his data, his phone or his
keystore waits for a session on one of the two PCs.**

| | Corporate laptop | Personal PC |
|---|---|---|
| Used | Everything up to 2026-09-18 | From 2026-09-18 |
| Node | 26.1.0, shared with client projects | 24 LTS |
| JDK | Separate JDK 21 (`JAVA_HOME`) | Temurin 21 (`JAVA_HOME`) |
| Android Studio / SDK | Installed | Not installed, deliberately |
| Debug keystore | Yes: the key the phone's app is signed with | **No** |
| APKs | Can build locally | **Only from GitHub Actions** |

- On the corporate laptop, Node 26.1.0 is outside the range Angular declares
  (^20.19 || ^22.12 || ^24) but works with a warning. DO NOT replace it: it
  would break the client work environment. If the toolchain fails because of
  the version, install fnm and isolate per project with `.node-version`.
- Before working on either machine, `git pull`: the other one may have pushed.

### Signing the APK

The app on Jose's phone is signed with the corporate laptop's **debug**
keystore, `%USERPROFILE%\.android\debug.keystore`, certificate SHA-1
`3E:94:DA:E8:3B:55:AE:94:FD:50:14:1D:94:18:91:1C:36:1E:CD:E5`. Android refuses
an update signed with any other key ("conflicto con un paquete"), and the only
way past it is uninstalling, which deletes every movement on the phone. The
Google sign-in client is registered against the same SHA-1.

- **The debug APK is built only when asked**: Actions tab → "Debug APK" →
  "Run workflow" (Jose, 2026-09-24). It used to build on every push to main,
  about ten minutes each, and a day of forty pushes spent a good part of the
  free 2,000 minutes a month of a private repository on APKs nobody
  installed. Each APK (~22 MB) is kept 3 days, since only the newest is ever
  installed and artifacts count against the free 500 MB of storage. With no
  payment method on the account, running out stops builds or uploads until
  the month turns or old artifacts expire - it never charges (from memory;
  https://github.com/settings/billing shows the usage).
- GitHub Actions (`.github/workflows/debug-apk.yml`) signs with that keystore
  from the `DEBUG_KEYSTORE_BASE64` secret, handed to Gradle by path, and FAILS
  the run if the APK's SHA-1 is not the one above. Before 2026-09-18 it left
  the file for Gradle to find, Gradle made up its own key instead, and no
  GitHub APK could ever have updated the phone.
- Never build an APK on the personal PC unless that same keystore has been
  copied to `C:\Users\Admin\.android\debug.keystore`.
- It is a debug key: fine for Jose's own phone, not for distribution. Handing
  the app to other people means a release key, and changing keys means one
  uninstall per phone (backup first, restore after), so it has to happen
  before the app is shared, not after.

### The upload key, for the store

Made by Jose on 2026-09-24 on his personal PC: `finance-upload.jks`, alias
`upload`, kept in `%USERPROFILE%\finance-keys\` with copies outside the
repository and the password apart from the file. It is in GitHub as four
secrets - `UPLOAD_KEYSTORE_BASE64`, `UPLOAD_KEYSTORE_PASSWORD`,
`UPLOAD_KEY_ALIAS`, `UPLOAD_KEY_PASSWORD` - and nowhere in this repository.

It is an UPLOAD key, not the key the store installs with: Play App Signing
keeps that one at Google and re-signs every bundle, and a lost upload key can
be reset through Play Console. Safer than the debug key for that reason, and
still never to be committed.

`.github/workflows/release-aab.yml` ("Store bundle") builds the signed `.aab`
Play takes, **only when run by hand** from the Actions tab: every upload
needs a higher version code, so a build nobody uploads is a number spent. The
version code is 1000 plus the workflow's run number; `build.gradle` reads it
as `financeVersionCode` and falls back to the 1 every other build has always
had, so `debug-apk.yml` and local builds are untouched (checked: the debug
APK still builds as version 1). The run fails, publishing nothing, if a
secret is missing or the bundle is not signed by the key in the secret -
checked locally on 2026-09-24 with a throwaway key before it was written.

## Getting it into Google Play

Looked into on 2026-09-22 at Jose's request, **as a plan, not as work**. He
decided the app is worth giving to other people who keep their accounts by
hand the way he does. Step 1, the icon, is done (2026-09-22); nothing after
it has been started.

**The one good surprise, and it was checked, not assumed**: a fresh install is
empty. Migrating a new database end to end leaves 0 accounts, 0 movements, 0
products, and only what everyone needs - 3 currencies, the 3 product
categories and the tax parameters - plus, since 2026-09-23, the twenty
starter categories `DatabaseService` seeds on first start (rule 23). The
23 migrations that name "Rappi",
"Pibank" or "Dale" all match by name and do nothing where those names do not
exist. Jose's data does not travel with the app.

In order, with the trap first:

1. **The icon. DONE** (commit "Give the app its own icon", 2026-09-22), from
   `AppIcon.png` in Jose's Drive folder. Cheap, reversible, touches neither the signature nor the
   data. `@capacitor/assets` turns one 1024x1024 image into every size
   Android asks for plus the 512x512 the store wants. Android masks an icon
   into a circle or a squircle, so the artwork has to live inside the middle
   ~66% or it gets cut; a detailed illustration turns to mush at 48dp.

2. **The release key, and this is the dangerous one.** The app on Jose's
   phone is signed with the DEBUG keystore (see "Signing the APK"). Play needs
   a release key, and Android refuses to update an app whose signature
   changed - so the app has to be uninstalled once, which deletes every
   movement on the phone. Backup, uninstall, install the release build,
   restore. It has to happen BEFORE anyone else has the app, never after.
   And the Google sign-in client is registered against the debug SHA-1: the
   new certificate has to be registered too, or the Drive backup stops
   working.

3. **The account.** US$25, one payment (Google's own page, read 2026-09-22).

4. **Internal testing**, up to 100 people, available immediately. This is how
   Jose gets the app from the store onto his own phone without waiting for
   anything below.

5. **The store listing**: icon, screenshots, description, a **privacy policy,
   which is required**, the Data safety form (this app keeps everything on the
   phone and backs up to the person's own Drive - say exactly that), the
   content rating questionnaire and tax details for payouts.

6. **Closed testing before production, for a PERSONAL account**: 12 distinct
   Google accounts, opted in continuously for 14 days, on real devices. An
   organization account registered to a legal entity is exempt. This, not the
   code, is what sets the calendar.

7. **Billing last**, because a purchase cannot even be tested until the app is
   on a track. See rule 21 for what has to exist in the code first, which is
   one service and one screen.

Two more things that will come up:
- Play takes an **Android App Bundle**, not an APK. `debug-apk.yml` builds a
  debug APK; a release workflow is a separate job.
- The Google consent screen is in testing mode, which admits **100 users**.
  More than that means publishing it and passing Google's verification.

**The order Jose chose on 2026-09-24: bank notifications first, the paywall
in the waiting days.** Neither undoes the other: the road to notifications -
account, release key, internal testing - is the road the store needs anyway,
and marking a finished feature as paid is one line in the one service.

What Jose does, checked the same day:
1. 2-Step Verification on his Google account (Play requires it):
   https://myaccount.google.com/signinoptions/twosv
2. Sign up at https://play.google.com/console/signup as a **personal**
   account, choose the developer name shown on the store, pay the US$25 once.
3. Identity verification: a government ID and a card in his legal name,
   phone and email checked. It can take several days.

**Done on 2026-09-24**: the developer account is **Jadex Labs**, a personal
account. It is reached from Jose's own Google account - the Play Console
mobile app recognised Jadex Labs only once he signed in with it - and
**jadex.apps@gmail.com** is the address he made for Jadex Labs, with notices
also going to his own. The Android-device check is done. Waiting on Google:
the identity documents, under review; only after that can the contact phone
be verified, and only after both can an app be created. The Google sign-in
client the app already uses for Drive lives wherever it was created; the
store's signing certificate has to be registered on it when the time comes.

Then, together: the release key generated on the corporate laptop (the
password is his and is kept safe, like the debug one), a workflow building a
signed `.aab` beside `debug-apk.yml` without touching it, the app created
in Play Console, the first upload to **internal testing** (no review, up to
100 testers, but the first link can take a few hours), the one uninstall of
step 2 above with the new certificate registered for Google sign-in, and
then notifications resumed on a store install.

**The package is `com.jadexlabs.finance` from 2026-09-25** (Jose, before the
first upload, when it could still change; it is fixed forever from that
upload). It was `com.josemoncada.finance`. Only the application id changed
- `applicationId` in build.gradle, `appId` in capacitor.config.ts, and the
two package strings in strings.xml; the Java package of the code (the
`namespace`, `com.josemoncada.finance`) stays, being internal. Checked with
a local debug build: aapt reads `package: name='com.jadexlabs.finance'`.
What it means:
- To Android it is a different app. The one on Jose's phone
  (`com.josemoncada.finance`, debug-signed) is not updated by any new
  build: a debug APK built from now on installs BESIDE it, empty, under the
  same name. Moving his data is backup there, restore here - no uninstall
  needed, since the two can live side by side.
- Google sign-in (Drive backup) matches an Android OAuth client by package
  AND SHA-1, so the new package needs its own Android client in Google Cloud:
  with the Play app-signing SHA-1 for the store install (Play Console → Test
  and release → App integrity), and with the debug SHA-1 above if debug APKs
  are to sign in too. The web client id does not change.

**Where it stands on 2026-09-25**: the app exists in Play Console under
Jadex Labs (`com.jadexlabs.finance`), version code 1002 is on the internal
testing track, Jose installed it from the store, and Google sign-in and the
Drive backup work there. What that took, for the next time a key is involved:
- Play App Signing holds the key the store installs with. Its SHA-1s (not
  secret): **classical key `D9:24:22:FC:B5:6E:FB:43:35:39:D7:B5:98:BC:4F:E5:52:88:C9:7D`**
  and a previous key of the same day `AA:5E:33:EA:FE:F7:50:66:70:13:D0:13:32:44:11:83:50:5F:50:E8`.
  They are in Play Console → Protected with Play → Play Store protection →
  Manage Play app signing (Google moved it there from App integrity).
- Google Cloud project **76504816542** (the web client id's prefix) → APIs &
  Services → Credentials holds one Android OAuth client per (package, SHA-1):
  `com.jadexlabs.finance` with the Play SHA-1(s), and with the debug SHA-1
  `3E:94:…:E5` for the APKs from GitHub; the old `com.josemoncada.finance`
  client stays while the old install is still in use.
- Until the store listing is filled, Play shows the app as its package name
  with the default Android icon and "(unreviewed)": normal for internal
  testing.

**Updating the phone from now on is the Store bundle** (2026-09-25). One app
on the phone, the store's; the old debug-signed `com.josemoncada.finance`
is uninstalled once its data is restored in the new one, and a debug APK is
never installed on that phone again (same package as the store's, other
key: Android refuses it). `release-aab.yml` builds the bundle and, when the
secret `PLAY_SERVICE_ACCOUNT_JSON` exists and the run's "Subir a la prueba
interna" box is ticked (the default), uploads it to the INTERNAL track with
`r0adkll/upload-google-play` pinned to a commit - never to closed testing or
production. Without the secret it builds and keeps the bundle as before and
says the upload was skipped. The service account lives in Google Cloud
project 76504816542 with the Google Play Android Developer API enabled, and
is invited in Play Console with "release to testing tracks" on this app
only. Store listing changes wait in "Changes not yet submitted for review"
until the app is sent for review; testers on the internal track see the
package name and "(unreviewed)" meanwhile, and the app is never found by
searching the store until it is published.

**The store listing is prepared in `store/`** (2026-09-25): `play-listing.es.md`
(name "Finance: gastos y rendimientos" - 30 of 30 characters -, short and
full description, all checked against the limits and against what the app
really does), `icon-512.png` (from assets/icon.png), `feature-graphic-1024x500.png`
and eight 1080×1920 screenshots in `store/screenshots/`, taken in dark mode
with reduced motion from the INVENTED sample backup - never from Jose's data,
because they are published. A copy of all of it is in
`G:My DriveFinance AppPlay Store` for uploading from the browser. The
sample backup grew for it: a credit card with everyday spending in ordinary
words (no brands) paid monthly from Banco Azul, and each product named in
Spanish with its rate on the product. Taking them showed seventeen Spanish
report labels without their accents ("Gasto mas grande"); fixed.
- **Still to redo before publishing**: `site/index.html` says the app's goal
  is income tax and that Jose Moncada Arias made it; the privacy policy and
  home page Play asks for must speak for Jadex Labs and the app as it is now.

**Android developer verification** (looked up 2026-09-24): from 30 September
2026 in Brazil, Indonesia, Singapore and Thailand, and worldwide in 2027,
certified Android devices refuse sideloaded apps from unregistered developers
except through a slow "advanced" flow or ADB. Colombia is not in the first
wave. A verified Play developer account is what registers Jose - one more
reason for it, since the APKs from GitHub are sideloaded.

## Pending from Jose

- [ ] Keep a copy of the corporate laptop's `debug.keystore` somewhere safe
      (not in this repository). It exists in one file plus a GitHub secret
      that cannot be read back; losing both means the uninstall above.

- [x] `Plata` is COP only, ungrouped. New in the 2026-09-08 export.
- [x] eToro, XTB and Plenti hold USD only. Balances on 2026-09-08:
      eToro 17,195.31, XTB 2,607, Plenti 0.
- [ ] Current balance of each currency of the two multi-currency accounts:
      ARQ (USD and EUR) and Global66 (COP and USD).
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

- `docs/02-technical-decisions.md` — the reasoning behind each decision
- `docs/03-roadmap.md` — order of work by phase
- `docs/04-stack-guide.md` — stack primer for someone coming from .NET/Angular
- `docs/05-data-model.md` — the SQLite schema and the reasoning behind it
- `docs/06-schema.md` — the schema drawn: ER diagram, delete rules, constraints
