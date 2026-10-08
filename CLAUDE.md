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

## Start here: where things stand (updated 2026-10-02)

Read this section first on any machine or in any session; everything below
it is the detail and the reasoning.

**The app today.** Angular 22 + Ionic 9 + Capacitor 8, SQLite on the phone,
installed on Jose's phone from the Play Store's internal track as
`com.jadexlabs.finance` (see "Getting it into Google Play"). The whole UI was
redesigned on 2026-09-28 from the mockups in `docs/mockups/` (groups 1-9, all
approved by Jose): a floating bar (Inicio, Cuentas, "+", Reporte, Más)
instead of the drawer, a navy look with an accent the person chooses
(Zafiro by default), every screen redrawn. **No data, migration or engine
changed with it** - a backup from before restores unchanged - and every
function the app had is kept (`docs/08-redesign-checklist.md`).

**What was merged to `main` on 2026-09-28**, in order (all through PRs,
each merged by the session after checks passed):

| PR | What |
|---|---|
| #1 | The redesign of every screen (groups 1-9), plus two new report sections: "Mes a mes" with income beside spending, and "Tu saldo a futuro" |
| #2 | First fixes from Jose's phone: the Drive copy's progress bar and failures, the note that closed itself, every sheet slides down and says Cancelar and closes when the screen changes, first section open on an account's movements/payments/days, the piggy bank landing on its account, transfers in their own blue, no card squeezed with large text |
| #3 | Review screen: smooth scroll after importing a statement (change detection 6.6 → 1.8 ms on 150 rows), long press on shops and days |
| #4 | One keypad component for every movement form: folds away, erase key everywhere, no "=" key, "Registrar otro" |
| #5 | This "Start here" section and the rest of CLAUDE.md brought up to date |
| #6 | Nothing ends under the floating bar (one rule for every screen); a small arrow brings the folded keypad back |

The details of each are in "Built, all nine groups" and "First round from
the phone" under "Ideas waiting for Jose's word" (they live there because
that is where the redesign was planned).

**What was merged from 2026-09-28 to 2026-10-02** (#7-#36, same way; the
detail of each is in the section named):

| PR | What | Where it is told |
|---|---|---|
| #7, #9 | Proposals only: reading bank SMS/mail and Lukas's atajos; debts and plans analysed and drawn | Rule 22; "Debts and plans" |
| #8, #25 | The Drive copy that hung at 2 %: recorded, then fixed | "First round from the phone" |
| #10, #11 | A move between products can change account; the note's box grows | "First round from the phone" |
| #12, #21, #23, #24 | Yields: monthly payment on the 1st and correctable; same-day movements against a typed figure; withholding on the whole account's day | Rules 16, 17, 15 |
| #13-#20, #26 | Debts: card dates and statement, loans (pesos and UVR, paying ahead), Cuotas rows that do what they look like | "Debts and plans" |
| #22, #27, #28 | Presupuestos: caps (topes) and goals (metas) | "Debts and plans" |
| #29, #30 | Demo backup generator; a category's own picture no longer stops the app; ledger + typed products no longer double-count | "How to work" below |
| #31 | A card's statement can take the bank's own figure, with why they differ | "Part 1, the card" |
| #32 | Inicio says whether each card is a cap or a goal | "Part 3, plans - limits" |
| #33 | A movement dated in a month already worked out redoes that month's yields | "Current status" |
| #34-#36 | Días/Pagos: product on every line, gross in green, rate or bonus beside the date; "Llevas acumulado en {mes}" on the yields screen | "Also fixed the same day" |
| #38 | An expense into a cap already past says so at saving; the card's "pago total" hint reworded | "Part 3, plans - limits"; "Part 1, the card" |
| #39 | Inicio's "Esta semana" (card and loan payments due or late); the lock on hand-edited movements no longer shown | "Debts and plans" (Inicio); rule 12 |
| #40 | Bank messages read by their shape, for anybody (not yet wired in) | Rule 22 |
| #41 | Bank messages become proposals in Por revisar, learning the account and category from the person's answers | Rule 22 |
| #42 | "Monedas y TRM" (renamed) in Más → Herramientas too, every currency in pesos with one Actualizar; "Notificaciones del teléfono" (renamed) with an eye per app; no text selection on rows | Rule 4; "Current status" |
| #43, #44 | A dialog's lone button centred; "¿En cuál lista?" as plain rows | Rules from Jose's review of v3 |
| #45 | The app's keypad removed: the amount takes the phone's own keyboard, with erase-a-digit and X beside it | "First round from the phone" |
| #46 | The amount's cursor can sit on any digit, to correct one in the middle | "First round from the phone" |
| #47 | SMS chosen by sender inside the messaging app, never the whole app | Rule 22 |
| #51 | "¿Qué cambia?" on a transfer between two accounts, at each end with products (option B, 17b); the net worth line | Rule 15 ("¿Qué cambia?") |
| #50 | "Mensajes de texto" says why no SMS sender is listed (no words readable, no money yet, nothing yet) | Rule 22 (SMS) |
| #49 | A hidden messaging app no longer hides its SMS senders; the notices' days say the month | Rule 22 (SMS) |
| #52 | Hidden chat apps (WhatsApp) ignored whole; only the SMS app keeps its senders while hidden | Rule 22 (SMS) |
| #53 | A payday corrected by hand earns from the next day, like a deposit | Rule 16 |
| #54 | The notification listener rebinds itself and the screen says when it last heard anything | Rule 22 (SMS) |
| #55 | A hidden SMS app is recognised by its package too, and its counts are said | Rule 22 (SMS) |
| #56 | "Revisar qué le llega a la app": what the notification listener is handed, with no content | Rule 22 (SMS) |
| #48 | The spending donut redrawn: its own eight colours, every icon round the ring with a right-angled line, "N categorías más" | "Group 1 v4" (the donut) |

**Going back.** Branch `app-before-redesign` holds `main` exactly as it was
before #1 (commit 5e185ad). Running "Store bundle" (Actions tab,
`release-aab.yml`, `workflow_dispatch`) on that branch builds the old app
with a higher version code, so the phone takes it as an update, data kept.
Nothing about the data would need undoing: the redesign wrote no migration.

**How Jose updates his phone**: Actions tab → "Store bundle" → Run workflow
on `main` → it uploads to the internal track → the Play Store updates the
app. A debug APK can no longer be installed on that phone (other key).

**Waiting for Jose, or to check on the phone** (a browser cannot show
these):
- The Drive copy's new progress bar and its messages (the browser cannot
  sign in to Google, so it was never seen running).
- The long press that starts choosing (Android's `contextmenu`), now also on
  shops and days in Por revisar.
- The amount with the phone's own keyboard (#45), "Registrar otro", swiping sheets down,
  the note raised with the keyboard, the marquee, the floating bar over
  Android's buttons.
- Whether the accent colour visibly changes things for him in the light
  theme (it does in a browser; transfers keep their own blue since #2).
- **Debts and plans are all built** (cards, loans in pesos and UVR, caps,
  goals) and seen only in a browser: the phone notification of a cap, and
  how each screen reads on the phone, are still to be seen.
- **After installing the update with #33, press "Recalcular" once**
  (Cuentas → Rendimientos, the round arrow): months already worked out with
  a late movement in them are only redone from then on.
- **Not started, waiting for Jose's word** (proposed to him 2026-10-02):
  the paywall service and screen (rule 21); the privacy policy and
  site for Jadex Labs; several debts' strategies (avalanche, snowball); the
  ideas from Lukas's atajos (rule 22).
- The open questions of rule 21 (which report sections are paid, lifetime
  option, what sits between the app and Google Play) and the list in
  "Pending from Jose".

**How to work, wherever you are.**
- Tests: `node tools/db/run-tests.mjs` (731 on 2026-10-03, all must pass). Build:
  `npx ng build`. The report's two audits, `tools/db/audit-money-report.mjs`
  and `tools/db/audit-yields-report.mjs`, take a backup file and must say
  "all agree" after any change to the report's arithmetic.
- A claim about a screen is checked in a browser, never reasoned about (see
  "Current status"). On a PC: `npm start`. In a cloud session, `ng serve`
  may fail to open the database (a Stencil "Couldn't find host element for
  jeep-sqlite" error); then build with `npx ng build --configuration
  development` and serve `www/` with a small static server that falls back
  to `index.html` - `window.ng.getComponent(...)` still works for driving the
  page from Playwright (Chromium is at `/opt/pw-browsers`). Restore Jose's
  backup through "Importar y exportar" in that browser profile.
- Jose's backup is never committed or published. In a cloud session he may
  upload one; use it only inside the session, and delete whatever test rows
  are written into the browser copy afterwards.
- Git in a cloud session: the session's branch is the only one it can push
  (`claude/...`); pull requests are opened and merged with the GitHub tools,
  and once a PR is merged the next piece of work starts from the new `main`
  on the same branch name. Commit messages in English, ending with the
  attribution lines the session asks for.
- A new user-facing word goes into `core/i18n/translations.ts` or, for the
  redesign's words, `core/i18n/translations-ui.ts` - both languages, same
  keys (`i18n.test.mjs` checks it).
- A new control that appears on two screens is defined once in
  `src/global.scss` (the `ui-*` classes).
- **A demo backup with every feature in use** (Jose, 2026-10-02):
  `node --import ./tools/db/register-ts.mjs tools/db/showcase-data.mjs
  <folder>` writes `finance-demostracion-completa.json` - invented people
  and money, dated 2026-10-02, built through the app's own repositories and
  engines: every kind of account, a group, euros and dollars, pictures of
  one's own, cards in every state, products with cashback, CDTs (one
  matured), a spending bonus, an investment fund, three loans (one in UVR),
  caps, goals, proposals waiting for review and a tax simulation. Bank
  notifications are not in it: Android keeps them outside the database.
  Building it found a bug (a category with a picture of its own stopped the
  app from opening, fixed in `category-icons.ts`) and a second one: in an
  account mixing a product that follows the account with products carrying
  a typed figure, the first held the WHOLE balance, so money moved into a
  typed product was counted - and earned on - twice. It now holds what the
  typed products leave (`heldIn` and the engine's base in `accrual.ts`,
  `ledger-and-typed.test.mjs`). Every product in Jose's data is typed
  (checked on his copy, 2026-10-02), so none of his figures moved; Banco
  Índigo in the demo is the mixed case.

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

   **Every currency kept, not only the euro** (Jose, 2026-10-02):
   `rateToPesosOn` values any currency the ECB publishes (pound, Swiss
   franc, real, Mexican peso, yen...) as its dollar value times the TRM, like
   the euro (`inUsdOn`, `rates-any-currency.test.mjs`); one it does not
   publish has no value from there and is typed by hand. `RatesService.
   refreshAll` is the one "Actualizar": the TRM, then every other currency in
   `currencies` (`refreshOthers`), once a day on opening and always on the
   button; a value typed by hand today is never written over. The screen is
   **"Monedas y TRM"** (renamed from "Monedas y tasas" so it is not taken for
   the yields' rates), reached from Cuentas AND from Más → Herramientas
   (Jose asked for the second way in; it reverses "one way in" of group 8),
   whose row lists the codes kept ("COP · USD · EUR"). Its top card shows
   every currency in pesos with its source (TRM oficial, BCE × TRM, escrita a
   mano) and day, amber when not today's, and "Todas al día" or "N sin el
   valor de hoy" beside the button. Fixed with it: the list called a euro
   from the ECB "escrita" - only `manual` is typed.

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
   **It is no longer shown** (Jose, 2026-10-02: the lock beside an edited
   movement on Inicio was confusing and served nothing). Verified that day:
   nothing but that icon, the words "corregido a mano" on the row and the
   CSV export's column read `transactions.locked`; no matching, import or
   engine leans on it. Editing still sets it and the CSV still carries it.

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

   **"¿Qué cambia?" is asked wherever an income or a spending is made on an
   account with products, and it starts on the person's habit** (Jose,
   2026-09-28; `core/yields/entry-scope.ts`). Three answers: the product and
   net worth (an ordinary movement), the product alone (a `product_entries`
   row, no movement - a cashback not to be counted yet) and net worth alone
   (a movement plus its other half on the product, which is how money a
   product already holds is cashed in). It used to be asked only by the
   products screen's form, which started an income on "the product alone",
   while Inicio, Cuentas and the list of accounts on the products screen
   opened the ordinary form and counted everything in net worth.
   - **Both forms ask now.** The ordinary movement form shows the row under
     the category when the account has products, new or corrected: **a
     movement being corrected shows its answer too** (Jose, 2026-10-06: it
     could not be changed afterwards), read off its rows (`scopeOfMovement`),
     and another answer rewrites it from scratch (`rewriteScoped`: the
     movement and its half go, the new shape is written, both accounts'
     days worked out again), as the products screen's form always did; a
     loan's payment keeps its own shape. One sheet
     for both (`shared/scope-sheet`), and one writer (`writeScoped`), which
     the products screen's form now uses too.
   - **The answer starts on the habit, and only the habit**, as Jose chose
     over a switch on the category: the commonest answer among the latest
     five for the same account, category and side, the newest winning a
     tie (`usualScope`). One answer is already a habit. With no category
     chosen yet, or no history, it is "the product and net worth", so a
     salary costs no tap. Choosing by hand stops the habit following the
     form; "Registrar otro" asks it again for the next one.
   - Each past row says its own answer by its shape: an entry with no
     movement is "the product alone", a movement whose other half is on a
     product (a cash-out for an income, an entry for a spending) is "net
     worth alone", any other movement "both". Nothing new is stored.
   - Checked on Jose's backup of 2026-09-28: of 109 account, category and
     side combinations on accounts with products, 99 start on "both",
     Rappi cuenta's Cashback (15 uses) and every "Corrección del banco"
     start on "the product alone", and one "Ajuste bancario" of Global66
     COP on "net worth alone". Tests: `entry-scope.test.mjs`.
   - **One form for everything since 2026-10-08** (Jose: "no debería ser
     dos formularios distintos, debería ser uno solo para todos"). The
     products screen's own form (`product-entry.component`) is deleted; its
     "+", a move between products, a product's own movement opened from the
     list and every correction go through the ordinary form
     (`app-entry`), opened as the screen asks: on an account's page, Gasto
     and Ingreso start on that account and its usual product, Transferir is
     a move between its products on the route its money usually takes
     (`route: {from: acc, to: acc}` with no products - the form reads the
     route pairs), and switching to Transferir there stays between products
     (`switchMovement`). From Cuentas or Inicio a transfer still leaves the
     account on show towards where it usually sends money - **except a
     card, which is paid**: a transfer from a card's screen goes INTO it,
     from the account that usually pays it (Jose, 2026-10-08,
     `defaultRoute`). What the old form
     alone did is in the one form now: **correcting or deleting a product's
     own movement** ("Solo el producto", `EntryRequest.editingEntry`: patched
     in place while its answer stays, rewritten in the new shape otherwise;
     an entry that is half of an account's movement opens that movement),
     and **working the yields out again right after saving** for every
     account with products the save touched, from the earliest day touched
     (`workOutAgain`).
     **The usual note reads the product** wherever the form is opened: on an
     account with products a spending or an income asks the `product`
     context (that product's entries and movements for the category, the
     account's own habit when the product has none). It used to ask only the
     account's movements, so a habit written on "Solo el producto" entries
     was never offered from Inicio (Jose, 2026-10-08).
     **A new income says the balance now, a new spending offers "Gastar
     todo"** (Jose, 2026-10-08): "Saldo actual · X" under the amount of an
     income (the product chosen when the account has several, signed - a
     card shows its debt), and a "Gastar todo · X" chip under a spending's
     amount, as "Pasar todo" does on a transfer, only when there is
     something to spend (`holdsNow`, `fromHolds`, `whatItHolds`). Neither
     on a movement being corrected - its own amount is inside the figure.
     **On a credit card it says the credit instead** (Jose, 2026-10-08:
     its balance is a debt): a spending shows "Cupo disponible · X" (limit
     less what is owed), turning amber as "Supera tu cupo disponible" once
     the amount typed passes it, and no "Gastar todo"; an income (a payment
     or a refund) shows "Debes X · Cupo disponible Y". A card with no limit
     on record says only what is owed (`cardLine`).
     **Filling the amount in one tap is one row of tiles** (Jose,
     2026-10-08, mockup `18`, option A chosen over sliding chips and a
     "Llenar con..." sheet): each tile says what it is in small grey and its
     figure under it, side by side, the one whose figure is the amount on
     show marked in the accent (`fillTiles`, `fillWith`, `.fill-tiles`). On
     a transfer: "Pasar todo" (what the origin holds) and, into a card,
     "Factura" (what is left of its last statement, only with its two days
     and when it differs from the debt) and "Toda la deuda". On a new
     spending: "Gastar todo". The card's tiles are left out across
     currencies and on a loan's payment; "Invertir" clears a filled amount.

   **A transfer between two accounts asks it too, at each end with
   products** (Jose, 2026-10-03; mockups `17a`-`17f`, option B chosen: the
   answer is a chip inside its own end, `17b`). His case: Bold pays its
   yields into a product; moving part of them to another account was an
   ordinary transfer, so net worth went DOWN by money it never counted. The
   leaving end takes a spending's answers, the arriving end an income's;
   a move between products of one account asks nothing, and neither does an
   end without products. Every transfer starts on "Producto y patrimonio",
   and every transfer already on record is that at both ends (migration 056,
   `transfers.from_scope`/`to_scope` default `both`) - no figure moved.
   - **How each answer is written** (`TransfersRepository`): `both` is the
     leg, as always; `netWorth` is the leg plus its other half on the
     product (an entry back into it where money leaves, a cash-out where it
     arrives - the shapes `writeScoped` uses); `product` is NO leg, only a
     `product_entries` row tied to the transfer (`transfer_id`,
     `transfer_leg`). So a transfer may have two legs, one or none;
     `findById` returns both ends either way (`fromEnd`, `toEnd`), `update`
     reshapes it keeping each leg's id while its end still touches the
     balance, `delete` takes the halves and the entries with it. All nine
     combinations are proved by balance and product figure
     (`transfer-scopes.test.mjs`).
   - **One line says what it does to net worth** (`transferEffect`): it
     goes up by what arrives when the leaving end was "Solo el producto",
     down by what leaves when the arriving end is, and does not change
     otherwise; under it one line per end with products saying what happens
     there. Shown whenever an end is asked.
   - **Where it shows**: a leg whose far end changed its product only is
     labelled by the far account (read off its entry), and it is never
     hidden as money merely changing account in "Todas las cuentas" - net
     worth did move. In Todas las cuentas it is a "received"/"moved" row,
     not income: Entró/Salió do not count it, the balance does. On the
     products page the entry reads "Hacia/Desde {cuenta}" and opens the
     whole transfer. Checked in a browser on the demo backup (saved, listed,
     reopened with its answers, deleted leaving nothing).

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
   **And a movement of the ledger through the product dated D follows the
   entry's rule**: inside the figure when it was recorded before the figure
   was typed, on top when after - in the engine and on the screen alike
   (2026-10-01, see "Also fixed the same day" under Debts and plans).
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

   **A monthly payment is made on the 1st of the next month, with every day of
   the month in it, the last one included** (Jose, 2026-09-30; `paidOnFor`
   returns the day after the period, `periodEndFor` the period's last day,
   migration 048 moved the days already written). It lands at the START of
   its payday, so the new month earns on it from its first day exactly as
   before: on his backup all 305 days came out identical. **A payment can be
   corrected from Pagos** - the day the bank really paid it (`yield_payments`,
   by the payday the app works out; the 5th or the 6th happens, for the same
   days) and, once the period is over, the figure it paid (spread over its
   days in proportion and locked, `correctPayment`). Both are undone with
   "Volver a lo calculado". A daily payment still opens its day.
   **A payday corrected by hand is a deposit that day** (Jose, 2026-10-05:
   Ualá's September bonus landed on 3 October and the 3rd's own yield moved,
   though it is worked out on the 2nd's close): it joins the base the day
   AFTER it (`handedOver` in `accrual.ts`), and his figures then matched the
   bank's. The payday the app works out by itself (the 1st) still lands at
   the start of its day, as above - left as it was until Jose says otherwise.

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

17. **An account can be several products, and the threshold is the account's.**
   Dale is two "alcancias" and the bank pays each separately - but it measures
   the 0.055 UVT threshold on what the whole account pays in the day, and
   withholds 7 % of each one's own yield. Read off Dale's September 2026
   statement on 2026-10-01 (Jose: "no se hace sobre un producto en particular,
   si no la suma de las ganancias de todos los productos"): each alcancía pays
   about 2,773 a day, under the 2,880.57 threshold, and one withholding a day
   of 7 % of the two together is charged (388.30 on the 25th = 7 % of 2,773.45
   + 2,773.73). The rule of 2026-09-10 - each product measured alone - was
   wrong, and left every day from the 26th 0.06 above the bank. Now the
   threshold is tested on the day's sum per component (each component is its
   own payment) of the account's savings products that withhold, and the
   withholding is shared out so the parts add up exactly to the bank's
   (`sharedWithholding` in `yield-math.ts`); a CDT keeps its own rule. On
   Jose's backup it changed Dale's days from the 25th and nothing else, and
   every day from the 25th to the 30th equals the statement to the centavo.
   Days the bank withheld in batches before that (eleven charges on the 18th,
   none on the 19th-22nd) sit in days Jose locked by hand and are not redone. A product either follows the account balance (`ledger`, at most one per
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

   - **An employee's pay can hold non-salary payments** (Jose, 2026-09-25):
     an optional box under the salary, shown only for ordinary and integral
     salaries, "De ese salario, pagos que no son salario" - bonuses and
     allowances agreed as non-salary (CST art. 128). They stay taxable income
     (casilla 32 is the whole pay); they leave the contribution base except
     what passes 40% of the pay, which comes back on top (Ley 1393 de 2010
     art. 30), before the floor and ceiling. His example: 20 million, 10 of
     them bonuses, base 12 million (9 for an integral salary: 70% of 10 plus
     2). The 40% rule is sourced but, like the rest, not confirmed with an
     accountant.
   - **Dependents, two deductions** (Jose, 2026-09-25): the 10% of art. 387
     (inside the 40% cap) and 72 UVT each up to four of art. 336 (outside
     it). **The 10% needs at least one dependent** - the engine took it with
     none, a port of the sheet whose case had two. An employee takes both;
     someone independent takes ONE, and the app takes whichever lowers the
     tax more: the 10% only where it lowers the capped total at least as
     much as the UVT would. That rule is Jose's, to confirm with an
     accountant. The exported sheet carries the same choice as a formula;
     since the kind of work is not a box in the file, the live-formula tests
     export for the kind of work of each case. His saved 2025 and 2026
     simulations (integral, two dependents) do not move.
   - **What "bring in the yields" brings, and what it never brings** (Jose,
     2026-09-25; the one change to the simulator he asked for directly). The
     yields summary's own days for the whole tax year (`yields-for-tax.ts`,
     `YieldsReportService.forTaxYear`): what the engine worked out plus the
     ESTIMATE for the days before it began, every figure in pesos at its
     day's rate - it used to bring only the worked-out days (from September
     2026, for Jose: 426,445 against about 6.1 million with the estimate)
     and to add dollars as pesos. **Nothing from an account of type
     Inversión, even with products**: its return stays inside until taken
     out, and only what the fund certifies as realized is taxed (48 of
     Fiducuenta's ~55 million, one year). The person types that into
     casilla 58 by hand - Jose chose that over a line of its own - and the
     notice always says investment accounts are not included, without naming
     any: only those with a product ever reached this sum, so a list named
     Plenti and not Fiducuenta (Jose, 2026-09-25). Pressing
     the button again rewrites casilla 58, so the typed part must be added
     again; the hint says so. "Deshacer" beside the button puts every box it
     wrote (58, the financial yields, the withholding line) back to what it
     held before the FIRST press, until the year changes. An estimated day carries what was paid, net of
     withholding, as its gross, so the estimate is a little short of what
     the bank certifies.
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
   `features/report/`, route `/report`). The analyses, in this order: the
   headline figures, the same against the period before, the categories that
   jumped, where the money went, the categories before and now, what comes
   back every month, charges repeated inside one period, the months of the
   year ("Mes a mes", with income beside spending since 2026-09-28), the
   balance ahead ("Tu saldo a futuro", 2026-09-28), the accounts, and the
   biggest movements. **Since the redesign the report is the Reporte tab of
   the floating bar**, not an item of the summary's menu; the paragraph below
   is the original reasoning. The summary
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
   - **No budgets** - lifted by Jose on 2026-10-01: spending limits exist now
     (Planes, "Debts and plans"), but the report has no section for them
     until he asks for one.
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

   **The first reading by shape is BUILT (2026-10-02)**: `readNotice` in
   `core/notices/read-notice.ts`, pure, tested on 37 INVENTED messages of
   every style (`read-notice.test.mjs`: Colombian, Mexican and English
   wordings, signs and codes before or after, both decimal marks). Jose,
   that day, in capitals: the reading must not be burned in for his banks -
   another user's messages read differently - and a message that moved money
   names an amount, often a balance. So it names no bank, sender or format:
   money is a number with a sign or code beside it or its thousands grouped
   (never a code, a card's digits, an hour or a date); the amount right after
   "saldo/disponible/balance" with nothing in between is the balance; the
   direction is the first movement word of either language; where is the
   words after "en/a" (out) or "de/desde" (in); the card's digits after `*`,
   "terminada en", "ending in". It answers `movement`, `unclear` (money, no
   direction: the person decides), `balance`, `declined` or `none` (codes,
   offers, reminders "vence/te recordamos que", plain chat). A bank footer
   ("Recuerda: nunca te pediremos tu clave") does not hide a movement.

   **And wired in (2026-10-02)**: every message the phone kept (the apps
   ticked in Avisos del banco) is read when the app opens, when it comes back
   to the front and when Movimientos por revisar opens - never in the
   background (`NoticeInboxService`). `proposalsFrom` (`notice-proposals.ts`,
   pure, `notice-proposals.test.mjs`) turns a `movement` or `unclear` reading
   into a proposal, one batch per app (`notice:<package>`, one card per app on
   the review screen, with a bell), the amount signed by the direction, the
   date written in the message or the day it arrived, the merchant as the
   description; an `unclear` one carries `confidence: 'low'`, which the
   review screen already shows as "read from the words". A message is never
   proposed twice (its key - package, moment, length - is in the evidence;
   `ProposalsRepository.noticeKeys`), Android's re-post of the same text
   within three minutes is read once, and "No ver más" on a notice batch
   marks its rows thrown away instead of deleting them, so they do not come
   back. **The app learns, and only from the person** (Jose, the same day:
   "toda la ayuda posible para que la app pueda aprender"): the category is
   the dictionary's, taught by every save (as for statements); the account is
   what the person answered for earlier messages of the same app - the same
   card digits first, then the app when it only ever meant one account -
   read from the accepted proposals (`noticeAnswers`), nothing new stored.
   Before any answer, an account whose own name carries the card's digits or
   the app's name ("Nequi"), when exactly one does; otherwise it is asked.
   Checked in a browser with invented messages on the demo backup (rows
   removed after). Not seen on the phone yet.

   **SMS, step 2: chosen by SENDER inside the messaging app (BUILT
   2026-10-02, #47; Jose: "continua con los sms").** No new permission: an
   SMS reaches `NotificationCatcher` as the messaging app's notification.
   - A notification is a CONVERSATION when Android's category says message,
     it carries `EXTRA_MESSAGES`, or it comes from the phone's default SMS
     app. Only its newest message is read, with that message's own time, so
     a conversation re-posted is the same message (and `keep` drops a
     repeat of the same app, sender, words and time).
   - Its sender (the conversation's title, the message's sender, or the
     notification's title) is NOTED - name, count, first and last, never a
     word - only when the message looks like money (`looksLikeMoney` in
     `NotificationStore`: a sign or currency code beside a number, or
     thousands grouped; checked against codes, hours, dates, phone numbers).
     So personal chats never list their people.
   - What a sender said is kept only when that sender is ticked
     (`watchSender`, keys `package\u001Fsender`), and a sender can be hidden
     (`hideSender`, which drops what was kept from it). A messaging app
     ticked WHOLE still keeps everything, as before - on purpose, never by
     default: the screen shows "Por remitente" instead of its switch.
   - The screen: "Mensajes de texto" under the apps, each sender with "N
     mensajes con dinero · {app}", the eye and its switch; hidden ones go to
     "Ocultos" with the apps. Checked in a browser with invented senders.
   - **Hiding the messaging app hides its row, never its senders** (#49,
     2026-10-02). Jose's first Ualá SMS after #47 never listed its sender;
     the likeliest reason, not verified on the phone: the messaging app was
     among his 48 hidden apps, and a hidden app was not even looked at. A
     conversation from a hidden app is now still read for senders - noted
     only when it looks like money, kept only when ticked. The first SMS of
     a new sender is never kept: it lists the sender, to be ticked.
     **Only the phone's own SMS app, though** (#52, 2026-10-05): every chat
     app counts as a conversation, so hidden WhatsApp chats were listed as
     senders (Jose's screenshot). A hidden app other than the default SMS
     app (`NotificationStore.isSmsApp`) is ignored whole again, and senders
     already noted from one are not listed (they return if it is shown).
   - **"Mensajes de texto" always says why it lists no sender** (#50,
     2026-10-02). Jose's next Ualá SMS reached the app - a messaging app
     "Teléfono" (`com.google.an…`) appeared with "2 avisos" - and still no
     sender was listed, while the "Por remitente" hint pointed at a section
     that did not show. Not verified, the likeliest reason: his phone hides
     notification content, so the message arrives with no words. The catcher
     now counts each messaging app's messages by kind - no words (`blank`),
     words without money (`plain`), money - never what they said (a group
     summary is not counted), and while no sender is listed the section
     shows one line per messaging app: in amber when its messages arrived
     with no words ("haz que las notificaciones de {app} muestren el
     contenido"), or that none carried money yet, or that nothing came yet.
   - **Allowed is not listening** (#54, 2026-10-05). Jose's next two Bold
     SMS - one with the content on screen - moved no count at all ("Teléfono"
     stayed at 8 avisos), with the permission on. Assumed, not verified:
     Android dropped the listener (it can after an update) and never bound it
     again. Now the listener notes when it connects, disconnects and last
     heard anything (`noteHeard`, at most once a minute, no content), asks to
     be rebound when dropped (`onListenerDisconnected` → `requestRebind`),
     and the app asks again every time the screen reads `isEnabled`. The
     screen says on top when the last notification arrived, in amber with
     "Abrir el permiso" when Android dropped it or six hours passed silent.
   - **And a hidden SMS app was invisible twice over** (#55, 2026-10-05).
     With the listener proved alive (the last notification was the Bold
     SMS's minute), still no sender and no count moved. Assumed, not
     verified: Jose's "Mensajes" is among his hidden apps, and either the
     phone did not name it as its SMS app or its counts had nowhere to land
     (`noteShape` dropped them for an app never noted). Now an app is the SMS
     app when the phone says so OR its package ends in `.messaging`, `.mms`
     or `.sms` (Google's, Samsung's, AOSP's, Xiaomi's; no chat app does),
     `noteShape` creates the row it counts on, and "Mensajes de texto" says
     its line for hidden messaging apps too, marked "(oculta)".
   - **#55 changed nothing on the phone, and the guessing stopped there**
     (#56, 2026-10-05). Jose's hidden list had no messaging app at all (he
     had shown it before; asking again was wrong), "Mensajes" was in neither
     list, and two more Bold SMS - locked and unlocked - moved nothing. So
     the screen now has "Revisar qué le llega a la app": whether Android has
     the listener bound, the SMS app the phone names, every notification in
     the status bar as the LISTENER sees it (`seenNow`, from
     `getActiveNotifications`: app, package, time, conversation or not, with
     words / no words / money, SMS app, hidden, group summary, pinned) and
     the last thirty apps it was handed something from (`noteRecent`) -
     never a word of what any of them said. The next step is decided by
     what it shows with a bank SMS in the bar, not by another guess.
   - The notices' days say the month ("Viernes 25 de septiembre", the year
     when not this one, "Hoy"/"Ayer" in front); "Viernes 25" alone could be
     any month.
   - A message carries `sender`; its source is `package|sender`
     (`noticeSource`): one batch per sender on the review screen ("Banco Rojo
     · Mensajes"), accounts learned per sender, and before any answer the
     SENDER's name matched against accounts' names. An app's own
     notifications keep the key they always had.
   - **Reading the inbox itself (`READ_SMS`), BUILT 2026-10-05** after the
     diagnosis (#56) proved Jose's phone (Xiaomi, Google Messages) never
     hands Mensajes' notifications to the listener, with every switch on.
     `SmsInbox.java`: the list of senders reads the ADDRESS column alone and
     shows only short codes (3-8 digits) or names, never a person's number;
     words are read only for ticked senders, from a week before the tick;
     nothing is copied out of the inbox. It speaks the shape of a sender
     and a kept message under the package `sms` (`SMS_INBOX`), so the
     screen, the proposals and the learning need nothing new. "Mensajes de
     texto" asks for the permission ("Permitir leer los SMS"). Only
     `READ_SMS`; no `RECEIVE_SMS`, the inbox is read when the app opens.
     Known limit: the section sits inside the notification-access flow.
     Verified 2026-10-05: Play's API accepted the first bundle carrying
     `READ_SMS` onto the internal track (Store bundle #46, re-run after a
     GitHub runner failure) with no declaration filed yet; the form is
     still needed before closed testing or production.
     **From the phone's first run (2026-10-05)**: a week of SMS from newly
     ticked senders brought back purchases Jose had typed. A reading with
     no account yet is now checked against every account
     (`sameMovementAnywhere`, `markKnownAnywhere`: same amount, a few days,
     the same merchant first) and takes the twin's account; on Por revisar
     each origin is its card followed by its own days, and what the ledger
     already holds sits apart, folded, "Ya los tienes registrados" with
     "Descartar estos N" - "Guardar los listos" never writes them. A message
     batch is named by its sender ("899979 · SMS"), its accounts under it.
     **Each origin is one block that folds** (Jose, 2026-10-05, after two
     statements read as one list): its head - icon, name, file, how many,
     the statement's check - is pinned at the top while its rows scroll
     (`.origin-head`, `position: sticky`), and only the first origin opens
     by itself; a search opens them all (`isBatchOpen`).
     "Comercios que se repiten" lives inside each origin too (Jose, the
     same day): a shop is counted and answered within its own statement or
     sender (`repeated` per batch, `fileAllAs(merchant, category, batch)`),
     and what the ledger already holds is never counted with its shop.
     Discarding or putting away now tells the rest of the app
     (`dataChanged`), so Más's count and the bar's dot no longer stay stale.
     **Por revisar and Notificaciones open with EVERYTHING folded** (Jose,
     2026-10-05; they no longer follow "first section open"), and the
     button between the two jump arrows folds or opens absolutely
     everything - origins, days, shops, what is already registered.
     **That fold button sits between the arrows on every screen that has
     them** (`app-jump`'s `folded` input and `fold` output; Inicio's own
     arrows too; the arrows keep their places when hidden). The selection
     bar is rebuilt: the count with "de N a la vista", a "Todos/Ninguno"
     pill with its tick, the actions as tiles (Categoría, No ver más -
     `forgetThese`, asked first -, Descartar) and the save as a full-width
     button, so a long label never spills.
     While choosing, both lists end 320px lower (`.selection-room`), so the
     last rows scroll above the bar.
     **Saving a selection waits while any ticked row still needs
     something** (Jose, 2026-10-05): the button is disabled and the bar
     says "N de los elegidos aún necesitan algo" with "Ver cuáles". Under
     a filter or a search an origin shows only what matches ("4 de 14
     movimientos"), never its "Guardar los N" card or its repeated shops,
     and an origin with nothing matching is not shown - the account
     chosen on top included: choosing Ualá shows Ualá's statement whole,
     card and shops with it, and no other (`partial`, `shownBatches`). The statement's own
     check is a labelled pill, "Cuadra" / "No cuadra" (its opening balance
     plus what was read equals its closing one - nothing to do with rows
     being ready), kept per batch on the device (`finance.statementChecks`)
     so every statement read on it keeps its mark, not only the last.
     "Con aviso" is blue, like the notices on its rows; "Les falta algo"
     stays amber. The shops' heading has no tick of its own (it showed
     half-ticked whenever a day was ticked), and "Descartar estos N" of
     "Ya los tienes registrados" folds with its section.
     "Mensajes de texto" lists the ticked senders on top and folds the rest
     under "Otros remitentes", newest message first, "N mensajes · último
     {día}". A band the page's colour holds the status bar's strip on every
     screen (`ion-app::before`), so nothing scrolls under the clock.
     Play's declaration: `store/sms-permission-declaration.md`; privacy
     policy at https://jadexlabs-finance.netlify.app/privacy.html (published
     by Jose on Netlify from `site/`, 2026-10-05).
   - Before it (kept for the record): reading the SMS inbox itself (`READ_SMS`). Play
     refuses a bundle declaring it until its Permissions Declaration Form is
     approved, which would stop every update to Jose's phone meanwhile - so
     it waits for Jose to file the form. Next after that: "Encontrados en tu
     celular" (apps not yet ticked whose notifications looked like money).

   **SMS and email: many banks send no push notification of their own**
   (Jose, 2026-09-28). Analysed and proposed, **nothing built, nothing
   decided**; waiting on Jose.

   - **Seeing them costs no new permission.** An SMS arrives through the
     phone's messaging app (Google Messages and the makers' own), and a
     mail through Gmail, and both POST A NOTIFICATION - which
     `NotificationCatcher` already receives. Verified in the code: it keeps
     every package's title (the sender: the bank's short code or name) and
     text; what it does not do yet is tell one sender from another inside
     one package.
   - **So the unit to tick is a SENDER, not an app.** Ticking the messaging
     app whole would keep every personal SMS on the phone, which is not
     acceptable. What the person points at is "this sender, inside this
     app", chosen from the senders the phone has actually seen - no list of
     bank numbers or addresses, same rule as no list of banks. The Java
     side would keep the text only for ticked senders, as it does for
     ticked apps now.
   - **What is still unknown and has to be looked at on Jose's phone
     first**, the same "show it raw for a few days" step as before: whether
     his banks' SMS carry the amount and merchant in the notification text
     (a MessagingStyle notification may hold earlier messages in
     `EXTRA_MESSAGES` and be re-posted when a new one arrives); and whether
     Gmail notifies bank mail at all - it only notifies the inboxes set to
     notify, and mail filed under Promotions or Updates usually is not, and
     the notification carries the subject and a snippet, not the whole mail.
   - **Notifications are not enough, and that is the point** (Jose,
     2026-09-28): many people, him included, keep their bank apps and their
     mail hidden or silenced, so no notification ever arrives - and mail
     almost never arrives as one. Every channel has to be readable WITHOUT
     a notification.
   - **SMS: reading the inbox is allowed for this app, with a form.**
     Verified on Play's policy page (answer 10208820) on 2026-09-28: a
     non-default SMS app may hold `READ_SMS` and `RECEIVE_SMS` under the
     exception "SMS-based money management - for example, apps that track
     and manage budget", after a Permissions Declaration Form and Play's
     review, and it must never take non-financial SMS off the phone. So:
     read only the senders the person ticks, on the phone, nothing sent
     anywhere. Free; the cost is the review and a clear privacy policy.
   - **Mail through the Gmail API: possible, and costly for the public.**
     Verified the same day on Google's pages: every scope that reads a
     mail's body (`gmail.readonly`, `gmail.modify`, even `gmail.metadata`)
     is RESTRICTED; the app then needs restricted-scope verification and a
     CASA security assessment by a Google-approved lab, renewed EVERY
     YEAR. The cheapest lab listed (TAC Security's basic plan) is about
     US$675 a year per app - a third-party figure (switchlabs, deepstrike),
     to confirm on the day. And Gmail's approved uses name email clients,
     backup, productivity and "reporting or monitoring ... such as ... track
     flights or package delivery"; money tracking is not named, so approval
     is not certain. Exempt: an app in "Testing" (up to 100 test users) or
     used only by its developer and people they know - so Jose alone could
     use it free, the public could not.
   - **Mail without a restricted scope, proposed and not yet tried**: the
     person's OWN Google Apps Script. A script the person copies into their
     own account (from a template link, "Hacer una copia") runs as them, is
     their own project with one user - the personal-use exemption - and
     reads their bank mail on a timer, even with the phone off, appending
     each alert to a file in their Drive that the app created. The app
     would add `drive.file` (non-sensitive: only files the app itself made)
     beside the `drive.appdata` it holds today, and read that file when it
     opens. Free for everybody. The costs: a setup of a few steps with an
     "unverified app" warning from Google on the person's own script, and a
     template to maintain. Assumed, to prove with a prototype on Jose's
     account before anything is promised.
   - **IMAP with an app password** would also avoid the Gmail API (Gmail
     still accepts app passwords for accounts with 2-Step Verification -
     from memory), but it hands the app a password to the whole mailbox and
     asks the person to create one. Worse than the script on both counts.
   - **If none of it is acceptable, mail is dropped** and SMS plus
     notifications are what the app reads (Jose's words: if it is
     definitely costly, discard it).

   **One movement, several messages: BUILT for push and SMS (2026-10-08)**,
  after Jose asked whether an Ualá purchase seen by SMS and by Ualá's own
  notification stays one. `readNotices` (`notice-proposals.ts`, pure,
  `notice-proposals.test.mjs`) merges two messages when they come from
  DIFFERENT sources within 20 minutes, same amount to the cent, nothing both
  state disagreeing (direction, currency, card digits, account) and
  something besides the amount agreeing (a shared shop word, the same card
  digits or the same account). The later one is a `sighting` inside the
  first's evidence (`evidence.sightings`, each kept whole), and a message
  read on a later pass joins a proposal already written
  (`ProposalsRepository.recentNotices`, `join`) - even one thrown away, so a
  purchase never comes back by the other channel. A sighting's key is spent
  (`noticeKeys`) and its source learns the account when accepted
  (`noticeAnswers`). Only the amount and the minute agreeing, or shops
  worded differently: proposed apart, the later carrying `twin`, shown
  amber ("Puede ser el mismo que llegó por ... · Si es el mismo, descarta
  uno") and left out of "Guardar los listos". "Separar" in the review form
  (`separate`) undoes a merge. `propose` no longer drops a message because
  another MESSAGE proposal matches it (the same sender texting the same
  purchase twice is two purchases); statements still do. Mail is not read,
  so its window is not built. Checked in a browser with invented messages;
  not seen on the phone. The design as first written follows.

  **"Movimiento detectado", the molds and the screen by bank: BUILT
  (2026-10-08, mockup `19`, approved by Jose).**
  - **The phone's own notice** (`MovementAlert.java`): when a ticked source
    says something that looks like money moving (the listener's `keep`
    returns true for a new message, or `SmsReceiver` hears a ticked sender's
    SMS - `RECEIVE_SMS`, asked with `READ_SMS`), it posts "Gasto / Ingreso /
    Movimiento detectado · $ X" with Revisar and Descartar; several waiting
    are one "N movimientos detectados". The same amount within 20 minutes
    from any source rings once. NOTHING is saved: tapping opens the app,
    `NoticeInboxService` reads the messages and then opens Por revisar on
    that message's proposal (`takeOpen`, `/review?notice=`,
    `openAskedNotice`); Descartar keeps the message in a list the inbox
    pass treats as already proposed (`dismissed`, `thrownAway`). Opening the
    app clears the notice (`clearAlerts`). Java written without an Android
    SDK in the session: the first Store bundle is its compile check.
  - **The molds** (`core/notices/molds.ts`, `notice-molds.test.mjs`): a
    saved proposal from a message turns its text into a pattern for its
    source - the amount, the shop and every other number are slots, the
    fixed words stay - with the sign, account and category saved
    (`ProposalsRepository.accepted` -> `learnMoldsFrom`, settings
    `notices.molds`, eight per source). The next message of that shape is
    read by it first (`readNotices`, evidence `molded`): exact amount, shop
    and direction, the account learned and, when no shop is named, the
    category. **"¿De qué cuenta es?"** on the screen stores the person's
    answer per source (`notices.sourceAccounts`, `assignSource`), which
    wins over anything learned and fills the source's waiting proposals.
  - **The screen** ("Notificaciones del teléfono"): folding sections, all
    closed - Tus bancos (each bank = the account(s) its sources turned out to
    be, with its App and SMS sources), Sin cuenta todavía, Encontrados en tu
    celular (SMS senders with money, not read; a magnifier, not a "+"),
    Otras apps and Ocultas - with the fold button and the arrows. Removed at
    Jose's word (2026-10-08): "Revisar qué le llega a la app" (the
    diagnosis had served its purpose) and the "···" menu with "Borrar lo
    guardado" and "Olvidar todo" (risky, and switching a source off or on
    is already per source). Their plugin methods stay in Java, unused.
    A bank's sources hang from it on a tree line (`.children`), so they do
    not read as rows at the bank's level (Jose, 2026-10-08).
    Tapping a source opens its page: its account and its last messages, each
    with what became of it (por revisar, guardado, descartado, el mismo
    movimiento que otro aviso, or ignored and why - `noticeOutcomes`). The
    "Avisos guardados" face (every message raw) is gone, at Jose's word.
  Checked in a browser with invented sources and messages; nothing of the
  Android side can be seen outside the phone.

  **One movement, several messages: how to count it once** (proposed).
   The same purchase may arrive as a push, an SMS and a mail, minutes to
   hours apart, and a second identical purchase (same amount, same shop,
   same day) is real and must not be swallowed.
   - **Every message is a SIGHTING**, stored raw with its channel (push,
     SMS, mail), its sender and when it arrived; a proposal is built from
     one or more sightings and says which ("visto por notificación · SMS ·
     correo").
   - **Two sightings are one movement when**: same account, same amount to
     the cent, same direction, arrived within a window (minutes for push
     and SMS, hours for mail), and no disagreement on what both state - the
     merchant (`merchantKeyOf`, as `matching.ts` does), the card's last
     digits, the time written inside the text, an authorisation or
     reference number. A reference number that matches settles it; one
     that differs settles it the other way.
   - **The rule that tells a second identical purchase apart: a sender
     never reports one movement twice.** One movement takes at most one
     sighting from each sender. Two SMS of the same amount from the same
     bank are two movements, always; the mails are paired with them in
     order of arrival. So a real double purchase ends as two proposals, and
     a triple notification of one purchase ends as one.
   - **Except the phone repeating itself**: Android re-posts a notification
     when it is updated, and a messaging app re-posts the conversation. The
     same sender with the same text within a couple of minutes is one
     sighting (or, better, the notification's own key, which the catcher
     would have to start keeping).
   - **Where it is not sure, it asks**, never merges or drops silently -
     the review screen's question "¿Es el mismo movimiento?", the same
     answer rule 22 already gives for a notification against a statement.
     A merge is undoable from the proposal.
   - **Against what was already typed by hand**: the same tolerant check
     `sameMovementAs` runs for statements, so a purchase Jose typed before
     the SMS arrived is offered as "ya registrado", not proposed again.

   **Ideas from Lukas's "atajos"** (Jose, 2026-09-28, from a screenshot of
   Lukas's list of banks, each with "Instalar atajo"). **Proposed, nothing
   built, nothing decided.** Mockups `docs/mockups/10a`-`10f`.

   - **What an "atajo" is, verified**: an automation in Apple's Shortcuts
     app, which an iPhone app hands the person to install. iPhone lets no
     app read another app's notifications, so this is Apple's only door.
     Its triggers (Apple's Shortcuts guide, looked up 2026-09-28) include
     a MESSAGE arriving from a sender or containing a phrase, an EMAIL, and
     an Apple Wallet TRANSACTION; there is NO "notification received"
     trigger in any iOS version. Since iOS 17 these run without asking each
     time. So Lukas's SMS banks (Bancolombia SMS) work by "when a message
     from this sender arrives, pass its text to Lukas". How it reads an
     app's notification (its ARQ card: "requiere el teléfono desbloqueado,
     usa IA") was not verified - assumed a different trigger plus reading
     the screen, since no notification trigger exists.
   - **It is iPhone-only, and Android does not need it**: on Android the
     app itself reads notifications (`NotificationCatcher`, built), and
     SMS arrive as notifications too - plus the SMS inbox under Play's
     money-management exception (above). The Android equivalent of a
     "shortcut per bank" is a switch per bank, which this app already has.
   - **What to take from Lukas: the presentation, not the mechanism.** One
     card per bank, clearly on or off, each saying what it does. Proposed:
     1. **"Tus bancos"** (`10a`): Avisos del banco reorganised around banks
        instead of raw apps - each bank the person turned on, with its
        channels (App, SMS, Correo), its last reading and how many it
        proposed; below, "Encontrados en tu celular": senders and apps the
        phone HAS received money-looking messages from, with "Activar".
        Still no built-in list of banks: every name comes from the phone.
     2. **Choosing SMS senders** (`10b`), never the whole messaging app.
     3. **Teaching the app a bank's message** (`10c`): the mold of this
        rule, shown - the amount, merchant and card highlighted in the text,
        "Guardar y recordar", and the next one is read alone.
     4. **Saving from a notification of this app's own** (`10d`): "Gasto de
        45.900 en EXITO · Guardar / Revisar / Descartar" over the bank's.
        The biggest one: it means reading in the background on the Java
        side, against "nothing working in the background" above, and it
        needs Jose's word on that trade-off. Never saved without the tap.
     5. **Por revisar says where each was seen** (`10e`): "visto por aviso
        y SMS", one purchase seen twice being one proposal (the sightings
        design above), "Guardar 3 movimientos listos".
     6. **On the day there is an iPhone version** (`10f`): "Instalar atajo"
        for SMS senders, handing the text to the app through an App Intent.
   - **Suggested order, if Jose agrees**: first the step this rule already
     asks for - look at the raw notifications and SMS his banks send for a
     few days; then 1, 2, 3 and 5 (they are the reading this rule designed,
     given a face); 4 only after that works and if he accepts the
     background cost; 6 with the iPhone version.

   **Several rows answered at once** (Jose, 2026-09-25, built). The review
   screen and the notifications screen share one gesture and one bar:
   "Seleccionar", or a long press on a row (the `contextmenu` event, which
   Android's WebView fires on a long press - to confirm on the phone), turns
   on a round tick per row - the WHOLE row takes the tap, and what is inside
   it (category, date, the toggle) waits until choosing ends; a floating bar
   says how many (its X a round 2.5rem button, and "Seleccionar" turns into
   "Salir de la selección" where it stood), "Todos"/"Ninguno"
   over what the filter shows, and what to do. On review: one category for
   all (`fileThese`, one UPDATE), save the ready ones (the count on the button
   is what will be written, and the dialog says how many stay behind and
   why), or discard (`rejectThese`, one UPDATE, asked first). On
   notifications: keep what they say, stop keeping it, or hide them (asked
   first when something kept goes with them). The bar, the tick and the
   picked row are `.selection-bar`, `.tick`, `.picked` in global.scss.
   **The tick is a `<span>`, never a button**: an ion-item holding a single
   button forwards a tap anywhere on the row to it, so on the notifications
   screen - whose rows hold nothing else while choosing - a tap ticked the
   row and unticked it through the button, and only the circle worked. Found
   by Jose on his phone after I had declared it done from the review screen
   alone; `selection-rows.test.mjs` fails on a button tick.

   **The screen is "Notificaciones del teléfono"** (renamed by Jose on
   2026-10-02 from "Avisos del banco": it reads any app's, not only banks'),
   a proposal from one says "Notificación · {cuenta}", and every app carries
   an eye beside its switch to put it away (`hide`, asking first when
   something kept goes with it). **No row's text can be selected**
   (global.scss, `.ui-row`/`.ui-list`): on the phone, a long press to start
   choosing painted Android's blue text selection over every row below, which
   read as all of them chosen; inputs keep their selection.

   **The notifications screen CAN be checked in a browser**, and must be:
   with `ng serve`, `window.ng.getComponent(document.querySelector(
   'app-notifications'))` hands over the component, and setting `supported`,
   `enabled`, `apps` and `caught` on it draws the screen with invented apps
   and notifications. No app code is changed for it (the script used lives
   only in a session's scratchpad; the recipe is this paragraph).

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
by 558 tests that run against a real
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

> **Read with the redesign in mind.** The paragraphs from here to "A claim
> about the screen is checked in a browser" were written before 2026-09-28.
> Their rules still hold (one definition per control, the usual note, "Pasar
> todo", routing a transfer, the marquee, one account list), but the places
> they name moved: the compose bar, the round transfer button and the drawer
> are gone - the "+" in the floating bar opens the one movement form - the
> products "sheet" is the account page inside the Cuentas tab, and the
> screen on show is marked by `app-tab-bar` from `NavigationEnd`.

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
  category - also only once a category is chosen), a move between the same two products. A product's
  spending or income with no habit of its own falls back to the account's
  for the same side and category (2026-09-25: Plata's Mercados notes all sit
  in the Bolsillo since migration 039, and Cuenta Ahorros offered nothing). A
  move between products has no such fallback: 039 put both legs of Plata's
  old moves in the Bolsillo, so their direction is gone, and a guess could
  offer "Recarga" for a "Retiro"; two new moves teach it. It takes two
  uses to be a habit; the last year speaks first, then all of it; notes are
  compared without case or surrounding spaces and offered in their latest
  spelling. It follows the form while the person has not touched the note -
  changing the account, the category or the destination offers that one's
  note - and stops for good the moment they type, pick a suggestion or clear
  it with the X. Never over a movement being corrected or a note carried from
  another form. On Jose's data: "Pago tarjeta de crédito RappiCard" (Rappi
  cuenta to Rappi Card), "Cashback RappiCard" (income on its usual product),
  "Retiro bolsillo principal" (Bolsillo Principal into Cuenta de ahorros).
- **"Pasar todo" with the figure on it, left of the arrow** (Jose,
  2026-09-25), in a move between products and in a transfer to another
  account: it fills the amount with what the origin holds today - the
  product chosen when the account has several, the account otherwise
  (`core/yields/holdings.ts`, the same figure the products sheet shows per
  product). Nothing when the origin is empty or a card in debt. Withdrawing
  or topping up a whole bolsillo no longer means closing the form to read
  the figure. Turning the move around ("Invertir") while the amount is still
  the figure "Pasar todo" wrote puts it back to nothing - the other side may
  hold less, and saved like that it could go below zero; an amount typed by
  hand stays.
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

**A movement dated in a month already worked out changes that month's
yields - fixed 2026-10-02** (it was known since 2026-09-24: a 5,000,000
deposit dated 5 September and typed in October left September at 7,864.48;
the only cure was "Recalcular"). Each pass keeps, per account, a mark of
what every month holds (`YieldsRepository.monthMarks`, in `settings` under
`yields.months.<id>`, so it travels in the backup): the movements, the
products' entries and cash-outs, their typed balances and their rates, by
the month they are dated in, plus the opening balance. Content only - counts,
sums, dates - never `updated_at`, so a migration rewriting timestamps redoes
nothing; a deletion changes its month's count and sum. The engine resumes
from the earliest month that differs (`earliestChange`, `core/yields/
month-marks.ts`); locked days stay, as with "Recalcular".
- **The first pass after the update goes back nowhere**: with no marks on
  record it only writes them, so nothing Jose's phone already worked out is
  touched by the update itself (asked by Jose: "ten mucho cuidado con dañar
  los datos"). Anything stale from before still needs "Recalcular" once.
- **Removing a product** moves its history to another product, which rewrites
  earlier months without changing what happened in them; it takes the marks
  as they are afterwards, so only the current month is redone, as before.
- Proved on Jose's backup of 2026-10-01: with nothing changed, the 393 days
  come out identical to the code before; a 5,000,000 deposit dated 20 Sep on
  Global66 COP (whose days are not locked) makes its September days equal to
  a full recompute (0.20 a day became 1,054.57) and moves nothing in any other
  account; his Rappi cuenta days, locked against the bank, do not move. Both
  audits agree (2,237 and 112 checks). Tests: `stale-months.test.mjs`.

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

- **It cannot see `G:\My Drive\Finance App`** - unless Jose uploads the
  file into the session, which he did on 2026-09-28; then it can be restored
  into the session's browser and used for checks, and it is still never
  committed. Jose's real backup is not in
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
- **The site speaks for Jadex Labs now** (2026-10-05): `site/index.html`
  and `site/privacy.html` name Jadex Labs and jadex.apps@gmail.com, and the
  policy covers PDF statements, phone notifications, SMS from chosen senders
  only (written ahead of the READ_SMS work, for Play's Permissions
  Declaration Form), the public data fetched (TRM, ECB via frankfurter.dev,
  BanRep's IPC) and Drive. Payments are not in it yet: add them with the
  paywall. Published by Jose on Netlify (drag-and-drop of `site/`):
  https://jadexlabs-finance.netlify.app/privacy.html - a change to `site/`
  is only live once he uploads the folder again.

**Android developer verification** (looked up 2026-09-24): from 30 September
2026 in Brazil, Indonesia, Singapore and Thailand, and worldwide in 2027,
certified Android devices refuse sideloaded apps from unregistered developers
except through a slow "advanced" flow or ADB. Colombia is not in the first
wave. A verified Play developer account is what registers Jose - one more
reason for it, since the APKs from GitHub are sideloaded.

## Ideas waiting for Jose's word

**The redesign described here is BUILT and merged (2026-09-28)** - the
design direction, the group-by-group mockups, "Built, all nine groups" and
"First round from the phone" below are the record of it. **The table at the
end ("The ideas, by what they would take") is still only proposals**, except
the rows marked otherwise. For those: nothing is decided or built. It is a list of
proposals, so a session on either PC can pick one up without mistaking
it for a decision. Before starting any of them: ask Jose, and move the
line into the rules above once he has answered. The full reasoning is in
`docs/07-competitor-lukas.md`, a study of Lukas (Jotatech, Medellín), made
on 2026-09-27 from its store listing, its privacy policy and fourteen
screenshots Jose took of it.

**What Lukas is, in one paragraph**: a one-person Colombian expense
tracker with AI entry (voice, receipt photo, pasted text via Gemini and
OpenAI), budgets and goals, ONE currency and NO accounts, ads on the
free tier, Pro by subscription through RevenueCat, and ten third-party
services including Supabase in the US holding users' data. We win on
yields, multi-currency, accounts, cards, statements that check
themselves, the tax simulator and privacy (no server, no ads, no
trackers). It wins on how the app FEELS, and that is the main lesson.

### The design direction Jose asked for (2026-09-27)

Jose: Lukas's access to its options and menus "es muy fluida y mejor... a
eso me refiero con diseño profesional, agradable y bonito para el
usuario". Not decided in detail; the principles, drawn from its screens:

- Everything reachable in two taps, always visible. **This reverses the
  drawer decision** recorded on `ion-menu` in `app.component.html`
  (Android's own buttons own the bottom edge). Lukas's answer is a bar
  that FLOATS above them, four big targets. Proposed tabs: Inicio,
  Cuentas (with products and yields inside), Reporte, Más. To decide.
- One row shape everywhere: round tinted icon, title, grey second line
  with the current value, chevron or switch. Colour carries meaning (red
  spending, green income).
- One accent colour for everything pressable.
- Every empty screen or section: an icon, one sentence, one action.
- Choices open from the bottom, as a sheet with a grab handle.
- A settings screen grouped under small uppercase headings.
- The rule "a control on two screens has one definition in global.scss"
  is what makes all this possible: build the row, the card, the sheet
  and the empty state once, there.

**Jose liked the mockups (2026-09-27), on one condition: every function
the app has today stays.** "Solo estamos cambiando apariencias y accesos":
the A–Z / most-used orders, the current account ticked in the list, the
usual note offered for a new movement, and everything else. So:

- **The redesign touches looks and access only**: no repository, query,
  engine, migration or figure changes, and no data changes. The colours
  already exist (`accounts.color`, `categories.color`).
- **`docs/08-redesign-checklist.md` is the inventory of what every screen
  does today.** A screen is not done until each of its lines is checked in
  a browser and on the phone. Anything missing is a bug, not a
  simplification.
- **Screen by screen**, each shipped before the next.
- **The mockups are in the repository**: `docs/mockups/` (56 screens, v3,
  2026-09-27), with an index in its README and the source that draws them
  in `docs/mockups/src/`. EVERY screen is there - Jose's word: "todas y
  cada una de las pantallas deben ser rediseñadas" - including creating
  and editing accounts, currencies, an account's products with their days,
  movements and rates, a product, a CDT, Por revisar, Avisos del banco,
  the report, Importar y exportar, signing in and changing the Google
  account, and the income-tax simulator.
- **The income-tax simulator is redesigned too** (Jose, 2026-09-27). Looks
  and access only: rule 19, its engine, its rows and its spreadsheet stay
  exactly as they are.
- **An account with products keeps its product on show in the movement
  form, and the product changes on its own** without choosing the account
  again (`a08`, `a09`). Said twice by Jose; it is in the checklist.
- **The look**: a navy background (page `#070d1a`, cards `#111b2f`, the
  main card of a screen in a gradient of the accent); every category and
  account in its own colour on a tinted background, **categories in
  rounded squares and accounts in circles**; sixteen colours at one
  lightness (`PALETTE` in `docs/mockups/src/lib.mjs`).
- **The colour picker was redone** after Jose found the first one
  "rudimentario": every swatch is the category (or account) itself, drawn
  in that colour, grouped in families (warm; greens and blues; violets
  and neutrals), with "Así se verá" on top showing the real row. Colour,
  icon and own image are three tabs of one editor (`b06b`, `b10`-`b12`).
- **The accent is to be chosen by Jose** (`00-azul-opciones`). Recommended:
  **Zafiro `#6378ff`**, the wallet of the app's own icon lifted for a dark
  background - its own colour, not Ionic's default `#4d8dff` and not a
  competitor's teal. Jose asked for a blue "un tris diferente" so the app
  is not taken for someone else's.

**How the redesign is agreed: group by group** (Jose, 2026-09-28). One
group of screens at a time is drawn, sent, corrected and approved; only
then does the next start. The groups and where each stands:

| Group | Screens | Mockups | Status |
|---|---|---|---|
| 1 | Inicio, the "+" sheet, the movement form (every kind), its pickers, edit and delete | `docs/mockups/1*` (v5) | **Approved** by Jose, 2026-09-28 |
| 2 | Cuentas, creating and editing an account, its icon and colour, currencies, net worth | `docs/mockups/2*` (v4) | **Approved** by Jose, 2026-09-28, with its three changes of access |
| 3 | Categories and their editor | `docs/mockups/3*` (v4) | **Approved** by Jose, 2026-09-28 |
| 4 | Products and yields: how they are reached, an account's products, days, movements, a product with its rates, a CDT | `docs/mockups/4*` (v5) | **Approved** by Jose, 2026-09-28 |
| 5 | Report (money and yields) | `docs/mockups/5*` (v5) | **Approved** by Jose, 2026-09-28, with both ideas from Lukas drawn |
| 6 | Por revisar, reading a statement | `docs/mockups/6*` (v5) | **Approved** by Jose, 2026-09-28 |
| 7 | Avisos del banco | `docs/mockups/7*` (v4) | **Approved** by Jose, 2026-09-28 |
| 8 | Más, Importar y exportar, Google (sign in, change account, sign out) | `docs/mockups/8*` (v5) | **Approved** by Jose, 2026-09-28 (the colour of the app drawn, not yet confirmed on its own) |
| 9 | Income-tax simulator | `docs/mockups/9*` (v4) | **Approved** by Jose, 2026-09-28 |

All nine: **built and merged to `main` on 2026-09-28 (PR #1)**, then
corrected from the phone in #2, #3 and #4.

**Built, all nine groups, on 2026-09-28** (worked on locally as
`claude/redesign-all-screens`, pushed as `claude/repo-access-pushes-tme1dv`
and merged to `main` as PR #1). The app as it was before is kept on the
branch **`app-before-redesign`**: to go back, run "Store bundle" from that
branch in the Actions tab (it is `workflow_dispatch`, so any branch can be
built; the version code still rises, so Play takes it as an update). What
changed in the shape of the app, for the next session:

- **The drawer is gone.** `app-tab-bar` (`shared/ui/tab-bar.component.ts`)
  floats over Android's buttons: Inicio, Cuentas, the "+", Reporte, Más.
  `/more` is Más (replaces the drawer; the Google card, Tus datos,
  Herramientas, Preferencias with Idioma and Apariencia, where the accent is
  chosen - Zafiro by default, `core/theme/accent.service.ts`).
  `/currencies` is Monedas y tasas. Screens reached from Más have a back
  arrow in a `ui-titlebar` and no menu button.
- **The "+" is the one way to a new movement** (`core/ui/compose.service.ts`, and
  `compose-host` draws the sheet and the form). A screen that must route it
  elsewhere sets `compose.handler` (the products account page does, to the
  product form) and `compose.context` (the account on show).
- **Every new control is in `global.scss`** under `ui-*` (card, hero, row,
  seg, chip, tag, btn, round, info bubble, switch, tick, banner, period,
  group, jump, titlebar, pill, frame, field, input, toast, selection bar).
  The redesign's words are in `core/i18n/translations-ui.ts` (`ui.*`,
  `face.*`, `more.*`, `accent.*`), spread into both dictionaries.
- **`app-badge`** draws every icon (category in a rounded square, account in
  a circle, in its own colour; `displayColor` gives the default grey a
  palette colour by id, for display only). `app-jump` is the two arrows of
  every long list but Inicio. `shared/ui/face-editor` is Ícono / Color /
  Imagen propia for accounts and categories.
- **Two report sections are new** (rule 20): "Mes a mes" carries income
  beside spending (`TrendBlock.series`, a switch on screen, two columns in
  the spreadsheet), and "Tu saldo a futuro" (`balanceAhead`,
  `ReportData.future`, `TrendBlock.shape: 'line'`) walks the balance back
  from today's and projects 90 days at the average of the last six whole
  months, dashed and called a projection. Both audits still agree on Jose's
  backup (2,210 and 112 checks).
- **The tax simulator opens with every section closed**, each showing the
  casilla that sums it up; its engine, rows and spreadsheet are untouched.
- Not built, deliberately: a product's own face (no column holds one - the
  icon is derived, `core/icons/product-face.ts`); anything in "Ideas waiting
  for Jose's word".
- Checked in a browser against Jose's backup, screen by screen, against the
  mockups; **not yet on the phone**. What a phone may show differently: the
  long press that starts choosing, the keyboard with the note raised, the
  marquee, the floating bar over Android's own buttons.

**First round from the phone (Jose, 2026-09-28), and the rules it left:**

- **A textarea is never drawn a second time while it is being typed in.**
  The note moved to another place in the template when writing began, lost
  its focus, the phone closed its keyboard and the note closed itself. The
  note now stays where it is and the rest of the form steps aside by CSS
  (`.writing-note` in `entry.component.scss`, shared by the product form and
  the review form).
- **Nothing that holds words may shrink to fit** (`flex-shrink: 0` on
  `.ui-list`, `.ui-card` and the rest, end of global.scss). A scrolling flex
  column squeezed each card to the screen on a phone with larger text, and
  the new account form lost its last rows. To check any screen: the audit
  in a session's scratchpad renders it at 120% zoom on a short viewport and
  lists every element whose content overflows a box that clips it.
- **Every bottom sheet slides down and says "Cancelar"** (breakpoints 0 and
  1, `[handle]="false"` because the sheets draw their own grab, the body
  marked `ion-content-scroll-host` so a list still scrolls; `.sheet-cancel`
  in global.scss). Full-screen forms do not slide: a slip would lose what
  was typed. Going to another screen closes any open sheet
  (`closeOnLeaving` in `app.component.ts`); a change of query string alone
  does not.
- **A list of sections opens on its first one** everywhere, through
  `core/ui/first-open.ts` (`FirstOpen`), which keeps only what the person
  changed. Inicio has its own in `movements.store.ts`.
- **The amount is typed with the phone's own keyboard** (Jose, 2026-10-02:
  "el teclado numérico que ofrece Android es suficiente"), replacing the
  app's keypad of 2026-09-28. `shared/ui/amount-field.component.ts` is the
  amount of the movement form (both sides of a transfer between
  currencies), a product's own movement and a proposal being checked: an
  input with `inputmode="decimal"`, the figure grouped in thousands as
  before, and beside it two round keys while it holds something - erase
  the last digit, and X to clear it all - which keep the focus, so the
  keyboard stays where it was. The digits stay the app's own
  (`AmountBuffer`); what the keyboard did is read back by `typedInto`
  (`amount-buffer.ts`, tested), wherever the cursor is - **it can sit on
  any digit, to correct one in the middle** (Jose, 2026-10-02, #46): the
  part that changed is what lies between what stayed the same at both
  ends, the edit is made on the digits alone (`editAmount`) and the figure
  grouped again, the cursor kept after what was typed. A comma OR a full
  stop typed starts the cents (the phone offers one or the other by its
  language) when there are none yet; erasing a grouping dot erases the
  digit before it; in pasted text a full stop is the cents only with one
  or two digits after it and no comma. The erase key takes the digit
  before the cursor, or the last one when the field is not in use. The cursor starts in the amount
  on a new movement (not a correction, not a loan's payment, and on a
  proposal only when it carries no amount); "Registrar otro" puts it back
  there. **The + − × ÷ sums went with the keypad** (`calculator.ts`
  deleted). On a computer, Enter in the amount saves when nothing is
  missing, and a digit typed with the cursor nowhere goes into the amount.
  `shared/ui/form-foot.component.ts` is what is left of the keypad's foot:
  what is missing, "Registrar otro" and Guardar.
  "Registrar otro", on a new movement, saves and leaves the form ready for
  the next one on the same account, kind and
  day. **It starts unticked every time a movement is opened** (Jose,
  2026-09-28): it used to be remembered on the device
  (`finance.enterAnother`, no longer read), and a form that stayed open
  after saving one movement looked like a save that failed. It is kept only
  while the same form switches between Gasto, Ingreso and Transferir
  (`EntryRequest.start.again`). **A product's own movement offers it too**
  (Jose, 2026-09-28), with the same rules (`ProductEntryRequest.again`):
  saving keeps the form open on the same account, products, kind and day,
  and the page only reads that account's figures again (`savedOne`).
- **The X while the note is being written only leaves the note** (Jose,
  2026-09-28), in the movement form, a product's own movement and a
  proposal being checked: the form comes back as it was, with its foot,
  and the next X closes it. Escape does the same. Tapping the X blurs the
  note first, so a blur still waiting to land (`noteBlurTimer`) counts as
  writing (`close()` in each form).
- **A template never recomputes a list** (PR #3, Jose: the review list
  stuck while scrolling after an import). On the phone scrolling runs change
  detection every frame, so a method called from the template that filters,
  groups or formats rows costs that much per frame per call. Groupings,
  filtered lists and lookups by id are `computed` maps, read by the
  template; the review screen went from 6.6 to 1.8 ms per pass on 150 rows.
  A long list may also use `content-visibility: auto` on its sections.
- **Nothing ends under the floating bar** (PR #6, Jose: the "Continuar con
  Google" button sat under it). Every screen routed under the bar gets its
  room at the foot from one rule in global.scss (`ion-router-outlet >
  .ion-page > ion-content { --padding-bottom }`), so a new screen or a new
  empty state cannot forget it; `.ui-page-end` is only still needed inside
  the account page, a modal with its own bar. How it was checked, and how to
  check again: on a 700px-high viewport at 120% zoom (a phone with larger
  text), scroll each screen to its end and list any text or button whose
  box overlaps the bar's; every screen, the Google sign-in, the
  notifications permission, the tax disclaimer and an account page's four
  tabs came out clear.
- **A move between products can change account on either end** (Jose,
  2026-09-29: the old app allowed it from the products sheet's round
  transfer, and the redesign's "+" there only let the product change). The
  account of each end of the product form's move opens the one account
  list with every account; choosing another hands the move to the ordinary
  movement form as a transfer between accounts (`transferElsewhere`,
  `EntryRequest.route`), the untouched end keeping its product and the
  amount, day and a note the person typed going along (the usual note of
  the move does not: the new route offers its own). `EntryRequest.start` is
  now read for a transfer too - switching Gasto to Transferir used to drop
  what was typed.
- **A note's box is as tall as what it holds** (Jose, 2026-09-29, from the
  phone: a long usual note showed one line, and while writing it scrolled
  inside that line, so reaching its end with the cursor was a fight).
  `shared/ui/auto-grow.directive.ts` (`[appAutoGrow]="note()"`) measures the
  textarea whenever its text changes - typed, written by the app, cleared -
  and when its width does, in the movement form, a product's own movement
  and a proposal being checked. While writing it stops at 40% of the screen
  and scrolls inside. **The note's X stays while it is being written**, and
  clears it without taking the focus (answered on `pointerdown`), in all
  three forms.
- **A long press works on a group as on a row**: on the review screen a
  shop, the shops' heading and a day's heading start choosing with all their
  rows ticked (`pressedMany`).
- **A transfer has its own blue, never the accent** (`--app-move`, `.ui-t`,
  `MOVE_COLOR`): with Coral chosen, Recibido and every transfer read as
  spending.
- **The Drive copy reports real progress** (`CloudBackupService.progress`:
  reading the data is the first 40%, the upload the rest, over
  XMLHttpRequest because fetch cannot report an upload). Asking Drive gives
  up after 30 s and the upload after 45 s without a byte moving; a dropped
  connection is retried once; "Failed to fetch" reaches the screen in words.
  Not verified on the phone yet: the browser cannot sign in to Google.
- **The Drive copy that hung for ever at "Revisando la copia que hay en
  Drive · 2 %" is fixed (2026-10-01), not yet seen on the phone.** The cause,
  read from the code: when the token had gone, the save asked Google for one
  with a silent sign-in that had no time limit, and Android's sign-in may never
  answer an app that is not in front - the automatic copy runs as the app goes
  to the background. While it waited the state stayed 'working', which
  refused every later save until the app was closed. Now:
  - the silent sign-in gives up after 20 s (`SilentTimeout` in
    `google-account.service.ts`) and leaves the account signed in; two
    callers share one sign-in;
  - an automatic save with no token at hand is never started from the
    background: the database stays marked as behind and coming back makes it;
  - every step of a save races the save's own abort signal (`until`), and a
    watchdog gives up a save that has not moved for 90 s, also on returning to
    the app, saying so in words (`cloud.error.stuck`);
  - "Cancelar" under the bar on the Google screen (`CloudBackupService.cancel`).
  To check on the phone: leave the app for more than an hour with the
  automatic copy on, come back, and the bar must finish or fail in words.
- **In a cloud session `ng serve` may fail to open the database** (a Stencil
  "Couldn't find host element for jeep-sqlite" error after the dependency
  cache is rebuilt). Serving `ng build --configuration development` from
  `www/` with a small static server that falls back to index.html works,
  and keeps `window.ng` for driving the page.

**Rules from Jose's review of v3 (2026-09-28), for every group:**

- **Long text never breaks the layout.** Names, notes, labels and
  descriptions stay on one line where they are a title or a row, end in
  "…" and slide to show themselves with the marquee the app already has
  (`marquee.service.ts`); a header gives the name all the width it can.
  v3 broke "Todas las cuentas" into three lines; that is the failure to
  avoid everywhere.
- **Minimal.** Nothing on screen that does not serve the person: no
  labels like "idea nueva", no decoration, no second way to do the same
  thing.
- **Save space the way the app does today.** The category is ONE button
  (the chosen one, and a pencil beside it), never a spread of chips. The
  note keeps its suggestions under it, and while it is being written it
  rises to the top and hides the rest of the form so the note, the
  suggestions and the phone's keyboard are all in view ("Listo" returns).
- **One movement form, one style, for everything**: spending, income, a
  transfer between accounts and a move between products look and work
  the same, each with its note, its date and "Pasar todo" / "Invertir"
  where they apply. A move between products is a transfer whose two ends
  are products of one account. The "+" is the one way in, and the form
  switches between Gasto, Ingreso and Transferir; no screen keeps its own
  Gasto / Ingreso / Transferir buttons (the products sheet did, in v3).
- **Categories are only expense and income.** Product categories became
  income categories in migration 037; there is no third list.
- **The category editor opens on Ícono**, then Color, then Imagen propia.
- **A rate lives inside its product** on screen: it is added and edited
  from the product, never as a loose list with a "which products" picker.
  **Every rate belongs to exactly one product, and has since migration 030
  (2026-09-11)**: it copied each whole-account rate onto every product that
  used it - the rule the engine already followed, so no day moved - and
  deleted the whole-account rows; every screen that saves a rate passes the
  product (`products.page.ts`, three places, checked 2026-09-28). The
  remark written here that a rate "can also belong to the whole account"
  was wrong, read off migration 016's comment without reading 030; Jose,
  2026-09-28: "una tasa solo aplica a un producto específico". `4m`, which
  drew such a rate, is gone. What only a local session can confirm: that
  his backup holds no `yield_rates` row with `product_id` NULL.
- **Icons in dialogs and sheets are centred with their title**, never
  left against a centred text. **And a dialog's lone button too** (Jose,
  2026-10-02: "Entendido" sat in the left half of a two-column grid): one
  rule in global.scss, `.confirm-dialog .buttons > :only-child`, makes it
  take the whole row. **A sheet's styles never reach "Cancelar"**: the
  categories screen's "¿En cuál lista?" styled every button in the sheet
  as a big card, Cancelar included, so it sat boxed against Gastos; the
  two choices are plain list rows now (Jose, the same day: they did not
  need to be that big).
- **The orphan withdrawal** ("Retiro sin su movimiento") exists in the app
  today and stays, but said plainly and quietly inside the row, not as an
  alarming card.

**And from his review of group 1 v4 (2026-09-28):**

- **Transfers are always on show beside income and spending, never inside
  them**, as the app does today (`totalsOf`: Movido / Recibido). One
  account: Entró, Salió, and in blue Recibido and Enviado (from and to the
  person's own accounts). All accounts: a transfer nets to nothing, and one
  line says how much moved between them. A transfer in a list carries the
  swap icon, in blue, with where it came from or went to.
- **One account's quick buttons stay beside its balance**: edit the
  account (the drawn card with a pencil) and, for an account that earns,
  its products and yields (the piggy bank).
- **The "+" lives in the middle of the floating bar**, never floating over
  the page, where it covered balances.
- **No eye to hide amounts** (idea 3/H rejected): the name in the header
  has the row to itself.
- **"Invertir" is a round icon on the line between the two ends**, no
  label and no row of its own; "Pasar todo" with its figure sits under the
  amount it fills.
- **Every end of a movement names its account and, under it, its
  product** when the account has products - spending, income, a transfer
  and a move between products alike - changeable right there. Lists say
  the product too ("Cuenta de ahorros → Tarjeta Coral").
- **The donut keeps one size whatever the month holds.** Beside it, the
  five largest categories and "Otras N", names ending in "…", percentages
  in a column of their own; the total spent sits inside the ring. Every
  category with its figure is the list under it.
  **Redrawn on 2026-10-02 (#48, mockups `16i`-`16m`, chosen by Jose)**:
  categories' own colours repeated and pictures said no colour, so the
  chart has a palette of its own (`donut-layout.ts`: eight colours checked
  on the dark and light card; each category takes the one nearest its own,
  the largest first, never two alike). Up to eight slices; beyond that the
  top seven and one grey "N categorías más", which opens at the foot of the
  list. Every slice's icon sits round the ring in the slice's colour (a
  picture wears it as a ring), with its percent under it, joined by a line
  bent only at right angles. The icons spread evenly over twelve places
  round the ring; where that makes two lines cross or one cut the ring,
  each takes the nearest place that keeps the order instead
  (`crossingsOf`, tested). Tapping a slice or its icon names it in the
  middle ("Ver sus movimientos" opens it); under the ring, each category
  with a bar of its slice's colour. Income and money moved keep their rows.

**Group 2 (v4, approved 2026-09-28)** and the three changes of ACCESS in
it, all accepted by Jose (everything else is today's screen redrawn):

- **Currencies and today's rates in one screen, "Monedas y tasas"**,
  reached from a row under the accounts. Today the currencies list sits
  at the foot of the accounts screen and the TRM, its refresh and the
  typed rates live inside "¿De dónde sale?"; that sheet now shows the
  rate each line used and links to the new screen.
- **An account's colour can be chosen** (Ícono, Color, Imagen propia, the
  order of the category editor). `accounts.color` exists; the editor does
  not offer it today.
- **"Nueva cuenta" is a button in the screen's title bar**; the "+" in the
  bottom bar stays the way to a new movement.
- **An account's own image is edited like any icon** (Jose, 2026-09-28):
  the same pencil opens the same editor, where the image is changed for
  another or for an icon, and the Color tab still works - the colour fills
  behind the image (a logo with a transparent background takes it) and
  stays the account's colour elsewhere (`2q`, `2r`). "Tus imágenes" shows
  the pictures uploaded, never plain colours (`2n` looked like colours).

**Group 3 (v4, approved 2026-09-28)**: today's categories screen redrawn -
two folding lists with their counts (closed on opening), "Abrir todas /
Cerrar todas", Más usadas / A-Z, "Nueva categoría" asking which list, the
archived with the list each belonged to, the two arrows on a long list -
and the editor in the account form's shape: the face with its pencil, the
name, "Para" (locked with the reason once used), "Usada en", "Ganancia o
pérdida de inversión", archive. The face opens the same Ícono / Color /
Imagen propia editor as an account, in rounded squares. Choosing a
category's colour is new on screen (`categories.color` exists), as it was
for accounts. No search on this screen, as today (the picker has one).
The product categories' own editor (reached from a product's form) belongs
to group 4.

**Group 4 as sent (v4, 2026-09-28)**: everything the products screen
does today, with these changes of ACCESS for Jose to accept or refuse:

- **Products and yields are the second face of the Cuentas tab**
  ("Cuentas | Rendimientos", added to `2a` as well), plus the piggy bank
  beside one account in Inicio. The drawer item goes with the drawer.
- **An account's page lives inside that tab, not over it**, so the bar and
  its "+" stay. Its own compose bar (Gasto, Ingreso, the round transfer)
  and "Mover entre productos" go: the "+" opens the one movement form on
  that account, and a move between products is a Transferir whose ends
  are products. A product's own income or expense keeps "¿Qué cambia?"
  (Solo el producto / Producto y patrimonio / Hacer efectivo / Solo el
  patrimonio) as a section of that one form (`4q`).
- **The page is one scroll, as today**: the figure (Rendimiento
  disponible, Rendido, Pasado al patrimonio, Rinde sobre and the "cerró
  ayer" note, the two ways out), the products, the movements (three views,
  period, search, the orphan withdrawal said in its row), what the bank
  pays by month (with "Qué productos ver"), how each day was worked out,
  and stopping the account. No tabs.
- **Rates stay where they already are, inside the product form**, with
  payout frequency, Vigente / Ya no aplica, "Cambiar la tasa desde una
  fecha" and the spending bonus. (A rate "of the account" was drawn here
  and removed: there is no such thing - see the rule above.)
- "Recalcular" is the round arrow in the title bar of the Rendimientos
  face.

**And from his review of group 4 v4 (2026-09-28), for every group:**

- **Separate information with a selector, never one long scroll.** The
  way Inicio switches Gráfico / Movimientos: an account's page is
  Productos | Movimientos | Pagos | Días; a product's form is Producto |
  Saldo | Tasa | Bonificación (a new one: Producto | Saldo | Tasa); a CDT
  is CDT | Al vencer | Pagos. The face and the name stay above it.
- **The way back to Inicio is the house**: a round button beside the
  figure, like Inicio's own pair (edit and piggy bank), next to the one
  for the summary.
- **A product's balance is said as a sum**: "Tiene hoy" first, then the
  balance read at the bank (at the close of its day), plus what came in
  and went out since, plus what it earned since. Then the one figure the
  person types and its day, and apart, the day it starts earning. Words
  only - the fields and the data stay as they are.
- **Every account, product and category shows its icon**, wherever it is
  named or chosen: "Pasa a", "Sale de", "Pasar el saldo a", the list to
  pick from, the payments and the days.
- **A product's own movement keeps its note**, with everything the note
  does today: the usual one written for that product and category, and
  the matches under it while typing (`4x`, `4y`).
- **A choice with explanations takes one row, and its options open in a
  sheet** (Jose, 2026-09-28: save space, minimal): "¿Qué cambia?" and
  "¿De dónde sale este saldo?" show only what is chosen; the options and
  what each does are one tap away (`4y`).
- **The note is not the category.** Every note row is labelled "Nota" and
  holds the person's own words about that movement; the usual note and
  the matches while typing are notes written before, never category
  names (`4x`, `4z`).
- **Transfers with products** (`4t01`-`4t11`, asked for by Jose): the one
  transfer form, which today already carries a product on each end
  (`productId`, `toProductId` in `entry.component.ts`) and refuses the
  same product on both ("Elige dos productos distintos"). Every case is
  drawn; a product set aside from net worth says quietly that the money
  then counts as leaving (rule 5). Every note row is labelled "Nota",
  group 1's included.
- **One end of a movement, compact** (Jose, 2026-09-28, v6 - applies to
  every movement form, group 1's included): the side ("Desde", "Hacia",
  "Pasa a") in a narrow column at the left; the account on one line and,
  under it, its product on another, each with its own icon at the same
  size - the account in a circle, the product in a rounded square - and no
  box around the product. The two icons read as two things because they
  are two lines and two shapes. "Invertir" sits on the dividing line
  between the two ends. **The product hangs from its account** (v7, Jose:
  it read as two accounts): a line comes down from the account's circle
  and turns into the product, which is indented, smaller and lighter -
  one account, and inside it one product.
- **An explanation is an (i), not a paragraph**: a small (i) beside what it
  explains opens a bubble on tap (`4t01b`); a one-off outcome, such as the
  amount cleared after "Invertir", is a short notice that goes away by
  itself.
- **Nothing is said when "Invertir" is pressed, and the same product never
  reaches both ends** (Jose, 2026-09-28). The form starts where it does
  today - "Desde" is the account on show (or the most used) with the
  product money most often leaves from (not the usual one), "Hacia" the
  same account with the usual product - and choosing, on one side, the
  product the other side holds keeps that choice and moves the OTHER side
  to the product the route most often uses. No red text, no disabled
  Guardar (`4t10a`, `4t10b`). Verified today: `chooseProduct` in
  `entry.component.ts` already moves the other side, but to the first
  other product in the list. **Decided by Jose, 2026-09-28: it moves to
  the product most used for that route in that scenario** (the same
  reading `routeBetweenProducts` makes), and everything that depends on
  the ends follows it - the usual note for the new route, and "Pasar todo"
  with the figure of the new origin. To build with the movement form.
- **Every note row, every end and every list uses the same icons as the
  account and product lists**, and the product hangs from its account.
- **Long account and product names slide** in every end and every list
  (`marquee.service.ts`, shown in `4t12` and `4t13`).
- (The black areas in the contact sheets sent before were empty slots,
  not screens: nothing was missed. The sheets are now as wide as what
  they hold.)

**Group 5 as sent (v4, 2026-09-28)**: every section the report has today,
in its order, on both faces (Movimientos | Rendimientos), with these
changes of ACCESS for Jose to accept or refuse:

- **The report is the Reporte tab of the floating bar**, not an item in
  the summary's menu. It still inherits the account and the dates from
  `FilterService`, shown as two chips under the switch: the account, and
  the period with its arrows; tapping the period opens a sheet (Día,
  Semana, Mes, Trimestre, Año, Todo, Entre dos fechas, and "Incluir lo
  apartado del patrimonio").
- **Each closed section shows its key figure** ("Ahorrado 38 %", "Gastos
  -6 %", "Vivienda 27 %"), so the whole report reads in one screen
  closed. (v4 proposed one open at a time; v5 keeps today's several
  open and "Abrir todas / Cerrar todas".)
- **What a section shows (`Block.about`) is an (i) beside its title**,
  opening a bubble, not a visible line (the rule of group 4); the
  caveats that change a figure's meaning ("los mismos 27 días", "parte
  es estimada") stay visible.
- **Export is the download icon in the title bar**, with the progress
  card while the .xlsx is built.
- "Van 27 de 30 días del periodo" stays on top when the period is not
  over. The drawing of each kind of block (figures, ranked with bars,
  comparison, trend with a tapped bar and its average, note) is today's.

**And from his review of group 5 v4 (2026-09-28), v5 sent:**

- **An explanation that belongs to a figure is shown whole**, wrapping
  onto a second line, never cut with "…": the line under each figure
  ("al año, por encima de la inflación"), the average balances of
  "Contra el periodo anterior" (a line of their own under the change).
  The marquee is for names; an explanation is read, not watched.
- **A section's title is never cut**: closed, it is the title (wrapping
  if it must) and, under it, its key figure in grey or its colour - the
  one row shape of the Lukas study.
- **"Qué cuenta rindió más" is ordered by what each earned, in pesos**
  (a dollar account by its peso value), and says so.
- **The period has its own row, with round 44px arrows at its edges**
  and the month in the middle, which opens the period sheet; the account
  is the row above. Taken from Lukas: the arrows were small and next to
  the month, easy to miss.
- **Two ideas from Lukas, drawn inside the report's own kinds of block
  (proposed, not decided):** "Mes a mes" carries a selector, Gastos |
  Ingresos y gastos, the second being income and spending side by side
  per month (a trend with two series, as the spreadsheet already
  draws); and a new section, **"Tu saldo a futuro"**, the balance of the
  last months and, dashed, 90 days ahead at the average income and
  spending of the last six months, saying it is a projection and never
  writing a movement (rules 20 and 22; idea 7 of the table below).
  Lukas's line chart of spending was left out: it is "Mes a mes" drawn
  another way, and the rule is no second way to see the same thing.

**And from his second look at group 5 (2026-09-28), for every group:**

- **The account picker under the switch is centred**, as wide as its
  name (on the report; Inicio's header already carries it).
- **A long name slides wherever it is listed**, not only in the
  movement form: a category in "En qué se fue", an account in a ranking
  or a comparison - one line, "…", and the marquee (`5s`).
- **Every screen with a long list has the two arrows, and folding lists
  have "Abrir todas / Cerrar todas"**, as the app does today on the
  summary, the report, categories and review (up only once the list has
  left the top, down only while there is more below; `showJumpUp`,
  `showJumpDown` in `movements.page.ts`). Drawn now on Inicio (`1a`-`1d`),
  Cuentas and Monedas y tasas (`2a`, `2c`), Rendimientos and an account's
  Movimientos, Pagos and Días (`4a`, `4d`-`4f`) - the accounts and
  products screens are new to it - and every report screen. They are
  38px, see-through and pressed against the right edge so they cover
  little. So the report keeps today's behaviour after all: several
  sections can be open at once, with "Cerrar todas" beside "Van 27 de 30
  días"; the closed ones still show their key figure.

**Every list of movements, on any screen, is in folding sections**
(Jose, 2026-09-28). By day or by category (by month for payments and
days), each heading with its icon when it is a category, the title, how
many, the total and its chevron - what `movements.page.html` already
draws (`toggleGroup`, `toggleAll`). "Más grandes" stays one flat list.
**One change of behaviour, asked for by Jose: a list opens with only its
first section open** - the most recent day, or the largest category -
and the rest closed; today every section opens open. The one round
button at the end of the grouping row (two chevrons apart: open all;
together: close all, as today) does them all at once. Drawn in `1b`,
`1c`, `1o` (by category), `1p` (all open), `4d` and `4d2` (a day further
down opened); the same shape goes to Por revisar and every later group.

**And two more from Jose (2026-09-28):**

- **A transfer figure alone sits centred.** Under Entró and Salió, Recibido
  and Enviado show only when they exist; when only one does, it sits in the
  middle at half the width (`1q`), and the all-accounts line "movido entre
  tus cuentas" is centred too.
- **The period is one full row wherever a list goes by period** - Inicio
  and an account's Movimientos in Rendimientos alike (`periodBar` in
  `lib.mjs`, one definition): round 40px arrows at the edges, the period
  in the middle opening the period sheet, and the search on its own full
  row under it (`4d`, `4d2`). The report's is the same shape.

**The Cuentas tab's two faces are "Saldos | Rendimientos"** (Jose,
2026-09-28: the tab and one of its faces were both called "Cuentas" and
it was not clear what each showed). Saldos is every account with today's
balance and net worth - what the tab opens on - and a row opens that
account in Inicio; Rendimientos is only the accounts that earn, with what
they have been paid, and a row opens the account's page (Productos,
Movimientos, Pagos, Días). Each face carries its icon (wallet, rising
line). `2s-recorrido-cuentas.jpg` draws the four steps.

**Group 6 as sent (v4, 2026-09-28)**: everything Por revisar and reading a
statement do today, with these changes of ACCESS for Jose to accept or
refuse:

- **Por revisar lives in the Más tab** (the bar stays), reached from Más
  and by itself after a statement is read.
- **Importing starts from the "+"**: "Importar extracto" asks "¿De qué
  cuenta es?" - the one account list, with "Es de una cuenta nueva" at its
  foot, which is the account form filled from the statement (`2g`, `2h`).
  Today the ways in are the summary screen, for the account on show, and
  the account form.
- **A batch is one card**: where it came from, how many, how many still
  need something, the statement's own check (green, or amber when it does
  not square), "Guardar los N" and a "···" holding "Descartar estos
  movimientos" and "No ver más estos movimientos en pantalla".
- **Its rows are in folding sections by day, the first open** (the rule
  for every list of movements); "Comercios que se repiten" is a folding
  section of its own at the top. Search on its own row; Todos / Les falta
  algo / Con aviso with their counts; Por fecha / Por monto; open-all;
  Seleccionar. A row: category icon ("?" in amber while it has none), the
  description on one line (sliding), the category with "aprendida" or
  "sugerida", and "puede ser el mismo" / "otra mitad de un traslado" as a
  short line under it.
- **A row is answered in a sheet, not inline**: tapping it opens what the
  statement said (as read, in its own box), Gasto / Ingreso, the amount,
  Fecha, Cuenta, Categoría and Nota, with Descartar and "Guardar este
  movimiento". Today the category, date and sign are changed inside the
  row itself. A missing piece is the row marked in amber, and Guardar
  waits; "maybe the same" shows the movement it may be, with its icon.
- **Squaring with the bank** is a card inside the batch (the app, the
  statement, the gap; "Igualar al extracto", "Escribir otro", "Dejar
  así"), its explanation behind an (i), and the question before it
  changes anything.
- Reading keeps its four stages, the page, the percentage and Cancelar,
  and says nothing is saved until the end; the password and the unreadable
  file are dialogs.

**And from his review of group 6 v4 (2026-09-28), v5 sent:**

- **A count is never a bare number, anywhere**: it says what it counts -
  "3 movimientos" under a day's title (`mgroup` in `lib.mjs`, so every
  list of every group), "16 categorías" on the categories screen, "6
  cobros" in the report, "2 comercios · 7 movimientos".
- **Choosing several works on rows, days and shops.** While choosing, a
  day's heading and a shop in "Comercios que se repiten" carry their own
  tick: it takes every movement of that day or that shop, open or closed;
  half-ticked when only some are ("1 de 2 elegidos"). "Todos" takes
  everything the account, the filter and the search leave on view, and
  the bar says "8 movimientos elegidos · de 18 a la vista". Today only
  rows are ticked; the heading and shop ticks are new.
- **A movement is checked in the one movement form**, not a small sheet:
  its keypad to change the amount, the account, the category, the day and
  the note - the same note as every other screen, rising while it is
  written with the notes used before under it, plus what the statement
  said, to keep it as it came. What the statement said sits on top in one
  line (its (i) opens it whole); Descartar is the bin in the title bar.
  Editing the note there is new.
- **What to show and the order are one chip with its icon** ("Todos · por
  fecha"), opening one sheet: Mostrar (Todos, Les falta algo, Con aviso,
  each with its icon and what it holds) and Ordenar (Por fecha, Por
  monto). A filter on lights its chip and one quiet line says "Ves 3 de 18
  movimientos · Ver todos".
- **The account is on top, centred, with "Todas las cuentas" first** in
  its list, then each account with what it has waiting. Importing a
  statement asks "¿De qué cuenta es?" without "Todas", since a statement
  belongs to one account.
- **Minimal: no green notices.** That the statement squares is a small
  green check beside the file (its bubble explains); when it does not, the
  mark turns amber with one line, "No cuadra por 45.900,00". "Leí 18
  movimientos" is a short notice that goes by itself.

**And his second look at group 6 (2026-09-28):**

- **Every figure on a button or a line names what it counts**: "Guardar
  15 movimientos listos", "3 movimientos necesitan algo", "Guardar 7
  movimientos", and the screen's title is "Movimientos por revisar". On
  Inicio the donut's last line is "7 categorías más", not "Otras 7".
- **Every list that chooses which account to LOOK AT starts with "Todas
  las cuentas"**, the general view, ticked when on: Inicio's header (`1r`,
  with net worth), the report's chip (`5t`) and Por revisar (`6n`). A list
  that chooses where a movement comes from or goes to, or whose statement
  it is, has no "Todas" - a movement and a statement belong to one account
  (`1k`, `6t`).
- `6-recorrido-importar.jpg` draws importing step by step: the "+",
  "¿De qué cuenta es?", the reading, the review.

**Group 7 as sent (v4, 2026-09-28)**: everything Avisos del banco does
today (rule 22, step one), with these changes of ACCESS for Jose to accept
or refuse:

- **It lives in the Más tab** (the bar stays); its "···" holds "Borrar lo
  guardado" and "Olvidar todo", each asked first.
- **The two lists are two faces of one selector**, each saying what it
  holds: "5 apps" and "24 avisos guardados". Today they are one scroll.
- **Apps**: each with its icon, name, "18 avisos · package", "se guarda"
  when ticked, and its switch; "Apps ocultas" folds at the foot with
  "Mostrar" on each. "Marca las de tus bancos" carries its (i).
- **Avisos guardados**: by day in folding sections, the most recent open,
  each notice whole with its app and hour; "Tal cual llegó" with its (i);
  an app chip with "Todas las apps" first (new: today the search is the
  only way to narrow them).
- **Choosing several apps** takes the whole row; the bar says "2 apps
  elegidas · de 5 apps a la vista" with Guardar, No guardar and Ocultar
  (Ocultar asked first).
- **Without permission**: the three promises as rows, "Abrir los ajustes
  de Android", Android's own wording behind an (i) under it, and "Ya lo
  di, volver a revisar". Nothing yet is an icon and one sentence.
- **No "Esto solo existe en Android" screen** (Jose, 2026-09-28): where
  the phone cannot read notifications - an iPhone, the browser - Más
  simply does not offer the entry, rather than a dead end saying no. The
  feature keeps its general name, because on an iPhone the same place is
  where purchases would come in another way: from memory, not verified -
  iOS 17.4's FinanceKit lets an approved app read Apple Wallet
  transactions (Apple grants that entitlement case by case, and it began
  in the United States), and the Shortcuts app can run an automation when
  a Wallet card is used, which some budget apps rely on. Whichever it is,
  those purchases would land as proposals in Movimientos por revisar,
  like a statement or a notice (rule 22). To look up properly the day
  there is an iOS build.

**Group 8 as sent (v4, 2026-09-28)**: everything the drawer, Importar y
exportar and the Google screen do today, with these changes of ACCESS for
Jose to accept or refuse:

- **Más replaces the drawer.** On top, the Google card (name, "Copia en
  Drive · hoy 8:12"), then rows under small headings, each with its value:
  Tus datos (Movimientos por revisar with how many wait, Categorías, Avisos
  del banco, Importar y exportar), Herramientas (Simulador de renta) and
  Preferencias (Idioma, Apariencia). Monedas y tasas stays under Cuentas
  only - one way in, not two.
- **A red dot on the Más tab and on Por revisar** says something is
  waiting, where the drawer's count used to.
- **Language and appearance are sheets** from their rows, each option with
  a tick. **Each language carries its flag** (Jose, 2026-09-28), in a
  circle like any icon and small beside the value on Más: Colombia for
  Español, the United States for English. **Appearance adds the colour of the app** (v5, after Jose asked
  whether it had one - verified: today it is only Automático / Claro /
  Oscuro, `theme.*` in translations.ts): six accents drawn as the button
  itself (Zafiro, the default, Océano, Turquesa, Esmeralda, Violeta,
  Coral); a preference like the theme, no data. **Accepted by Jose,
  2026-09-28: Zafiro by default, and each person changes it if they want.**
- **Importar y exportar**: the backup and the CSV each a card with one
  button; what each holds and warns is behind an (i). Restoring still asks
  the moment the file is chosen, naming the file, the warning inside the
  dialog, "Escoger otro" putting the picker back; then its progress.
- **Google**: signed out, one card and one button; signed in, the account
  card, the copy in Drive (when, how much, from which device), "Guardar
  ahora" and "Traer la copia", "Guardar la copia sola" with its (i),
  "Cambiar de cuenta" (Android's own chooser) and "Cerrar sesión".
  Replacing a copy another device wrote asks first and says when that copy
  was written and what it holds; the old one kept aside is a short notice.
- **No browser screen** (Jose, 2026-09-28: "no se en que momento saldrá o
  si tan siquiera es útil"). Where Google sign-in cannot work - the
  browser (`GoogleAccountService.available`) - Más shows no Google card
  and Importar y exportar no Drive row: nothing to open, as in group 7.
- **Every word the app says is shown whole**, wrapping onto a second line
  (Jose, again, 2026-09-28): a row's title and the line under it, a hint,
  a notice. Only a name - the person's, an address, an account - ends in
  "…" and slides.

**Group 9 as sent (v4, 2026-09-28)**: everything the simulator does today
(the checklist's "Renta"), and nothing of rule 19 touched - the engine,
the rows, the casillas, the formulas and the spreadsheet are as they are.
The changes of ACCESS, for Jose to accept or refuse:

- **Reached from Más → Herramientas** (the bar stays, Más lit). Its title
  bar is back, "Simulador de renta / Formulario 210" and the download icon
  for the .xlsx (its explanation an (i) bubble, then the busy dialog and a
  short notice naming the file). The Drive and language buttons leave the
  header: both live in Más.
- **The year is a full row with round arrows**, "Guardado" / "Guardando…"
  under it. **The verdict is a big card on top and, once scrolled, one
  line pinned under the year** (A pagar / A favor / En paz and the figure),
  so it is never out of view; "Aparta X cada mes" and the tax and
  withholding line sit in the big card.
- **One screen of folding sections, not a selector and not a wizard**
  (rule 19: seeing twenty boxes move is how the form explains itself).
  Closed, each section shows its icon, title and the casilla that sums it
  up ("Csl. 34 · 230.280.000", "Csl. 134 · a pagar 4.812.000"), so the
  whole return reads closed; "15 secciones" with "Abrir todas / Cerrar
  todas". Today every section opens open except Parámetros and Notas;
  proposed: all closed on opening.
- **A row**: the label whole (wrapping), its casilla as a small chip, the
  hint behind an (i); a typed box framed in gold with its unit ($, %, UVT,
  meses, personas), a worked-out one on grey, a total in bold. The key of
  the two looks stays, as samples, never shaped like a button.
- **Tipo de trabajo is one row** showing the choice and what it means; the
  three kinds, each explained, open in a sheet.
- **Bringing figures in**: "Traer el salario de 2026" opens the income
  categories of the year with their totals and counts; "Traer los
  rendimientos de 2026" with "Deshacer" beside it; what was brought is one
  line under the button (the notice), the long hint an (i).
- **Casilla 59** keeps its two answers as a switch; the year's percentage
  carries its standing ("Referencia 2025") with the source behind an (i).
  **Parámetros del año** lists each parameter with its standing and source,
  and a figure from a later year is a red banner, as today.
- **A year without UVT** says so under the verdict with "Ir a Parámetros
  del año" (new: today it is only the sentence).
- The rate table lights the band the return falls in; the twelve months of
  withholding are a grid of typed boxes; notes are listed whole with the
  sources as links; the disclaimer closes the form.
- **The two arrows sit side by side above the bar**, in a deeper fade:
  stacked on the right they covered the value column.

### Debts and plans (proposed 2026-09-29, nothing built, nothing decided)

Asked for by Jose on 2026-09-29, from screenshots of Lukas's "Planes", as
analysis and proposals only: "cuando yo diga comenzamos con el desarrollo".
**Nothing below starts without his word.** His order of importance: **debts
first** ("mas importante aun para la app antes que nada"), then plans.
Mockups: `docs/mockups/11a`-`11o`, every name and figure invented; the loan's
figures are worked out (60,000,000 at 16.5% E.A., 60 monthly payments, 23
paid), the order of `11g` is illustrative and its totals are not.

**What he asked for, in his words**: credits and loans with their rates;
optional cut-off and payment dates on credit cards; for a loan, its payments
and how often; "todo lo que haga falta ... para tener un sistema de
presupuestos completo"; and in the end showing the person what they owe,
what they will pay in interest, recommendations for paying capital ahead
(to save time or money), and a summary. From Lukas: spending limits per
category over a period and savings goals, seen and analysed on a screen of
their own.

**What the app has today, verified in the code and his backup of
2026-09-28**: nothing about loans. `accounts.type` is one of `debit`,
`credit`, `cash`, `investment` (001); a card is a liability with a limit
history (rules 4 and 11) and no dates, rate or installments. His backup has
one active card (Rappi Card, limit 1,100,000.00), one archived, and an
account "Cuenta leidy bancolombia prestamos" of type debit - assumed, not
asked: money lent to someone, which is what "Te deben" below would hold.

**Facts looked up on 2026-09-29, to build on** (each to be confirmed again
on the day, the figures change monthly):
- **Paying ahead is a right**: Ley 1555 de 2012 - any credit in pesos can be
  paid ahead, in part or in full, with no penalty, and **the debtor chooses**
  whether a partial payment lowers the term or the installment. It does not
  apply above 880 SMMLV of balance (there the contract decides). Sources:
  funcionpublica.gov.co (norma 48301), superfinanciera.gov.co.
- **Usury ceiling**: the Superfinanciera certifies the interés bancario
  corriente each month; usury is 1.5 times it. September 2026, consumo y
  ordinario: IBC 19.49% E.A., usury 29.24% E.A. (Resolución 1260 de 2026,
  as reported by actualicese.com and portafolio.co). The app ships the
  months it knows and a newer one is typed or fetched - rule 1, like the
  TRM and the IPC.
- **Cards**: the cut-off day closes the cycle; the payment day is usually
  about 20 days later; paying the full statement means no current interest,
  paying the minimum leaves the rest earning interest; a purchase at one
  installment carries no interest, at two or more it does from the first;
  international purchases are often deferred by default (24 or 36). Sources:
  bbva.com.co, blog.nu.com.co, arqfinance.com (fecha de corte y de pago).
- **Rates**: banks quote E.A. or M.V.; monthly = (1 + E.A.) ^ (1/12) - 1,
  the same shape as rule 15's daily rate. A mortgage may be in UVR (the
  balance moves with inflation) - later, and only if Jose has one.
- From memory, to verify before it is written anywhere: seguro de vida
  deudor charged per installment; the cuota de manejo of a card; the 4x1000
  on each payment. The tax deduction for mortgage interest exists but the
  simulator stands apart - **never wired into it**.

**The model proposed** (to be decided; nothing of it exists):
- **A loan is an account** of a new type, `loan` - a liability like a card,
  so it is in Saldos and net worth for free and never a second place money
  lives. Money LENT is the same type with the sign reversed (an asset), "Te
  deben". A new table holds its terms: principal, disbursed on, number of
  installments and their frequency, the day they fall, the system (fixed
  installment - French - first; fixed capital later if asked), insurance and
  fees per installment, the account it is paid from. Its **rate is a
  history** (from a date, E.A. or M.V. as the bank says it, stored as E.A.),
  as with yields, so a variable rate or a renegotiation is one more row.
- **The installment is both computed and typed** (rule 7): the app works it
  out and the person types what the bank says; the difference is shown
  ("the difference is the insurance: it matches").
- **Paying an installment is ONE form and several ledger lines**: the
  capital is a transfer into the loan account (it lowers the debt, rule 3's
  "not spent"), the interest and the insurance are expenses under their own
  categories (Intereses, Seguros - two new starter categories, rule 23). All
  three editable before saving; what was saved is what the bank charged, and
  the schedule is worked out again from there. So spending in the report
  counts the interest and never the capital - which is the truth, and what
  Lukas cannot tell apart.
- **The schedule is worked out, never stored** - a pure function of the
  terms, the rate history and the payments made (the same rule as the
  report: one engine, `core/loans/`, tested by `run-tests.mjs`). What is
  stored is what happened.
- **A loan started before the app**: "23 installments already paid" is a
  record, not 23 movements (rule 15's lesson: a record is not an event); the
  person states today's balance and the schedule continues from it.
- **Cards gain optional fields**: cut-off day, payment day, the rate of
  installment purchases (a history, like a loan's), the monthly fee, the
  account it is paid from. With the two days the app can say the statement
  (what closed at the last cut-off), what goes to the next one, and "pay X
  before D and pay no interest" - from the movements, since the app has
  them all. A purchase on a card may carry its number of installments; the
  statement then shows each one's capital and interest. Real statements
  differ from the app's arithmetic; the typed figure wins (rule 7) and a
  statement import (rule 22) is the natural check.
- **Nothing is ever written by the app on its own**: a due installment is a
  reminder and a pre-filled form, never a movement (rule 22, Jose: "no
  inventando un gasto que aun no ha ocurrido").

**The screens proposed** (`11a`-`11j`, `11o`):
- **Cuentas gets a third face, "Deudas"** (`11a`): what is owed today, what
  is paid this month and how much of it is interest, when everything ends
  and the interest still to pay, one recommendation, the debts and, apart,
  what is owed TO the person. "Nueva deuda" in the title bar asks what kind
  (`11b`).
- **A loan's page**: Resumen | Cuotas | Abonar (`11d`-`11f`) - the balance,
  capital and interest paid, the next installment and its interest, the
  interest left, the total cost, the rate beside usury and the IBC; the
  schedule by year with paid ones ticked; and **paying capital ahead**:
  an amount, once or every month, and the two answers side by side - reduce
  the term (saves more) or the installment - with what each saves and the
  line of Ley 1555 reminding the person to tell the bank which.
- **Several debts** (`11g`): "Salir de las deudas" with an extra amount per
  month and two orders - **avalanche** (highest rate first: least interest)
  and **snowball** (smallest balance first: one closed soonest) - what each
  saves and when each debt ends. A recommendation with the person's own
  figures, never advice beyond them.
- **Cards** (`11h`, `11i`): the dates in the card's form, optional; its page
  Factura | Movimientos | A cuotas - the statement to pay and the days left,
  what the minimum would cost in interest, what went in after the cut-off,
  the installments this statement charges.
- **Paying an installment** (`11j`): the transfer form with its split shown.
- **Inicio says only what needs attention** (`11o`): "Esta semana" - a card
  to pay, an installment due, a limit passed; nothing when there is nothing.
- **"Esta semana" is BUILT (2026-10-02)**: `app-due-home` on Inicio, above
  the caps and goals, one row per card statement or loan installment that is
  late or due within seven days (`dueSoon` in `core/debts/due-soon.ts`, pure,
  `due-soon.test.mjs`), each with its labelled kind line - "Pago de tarjeta",
  "Cuota de préstamo", red with "vencido/a" when late - the amount and when
  ("vence mañana", "venció el 28 de sept, hace 4 días"). It reads what the
  card's statement and the loan's schedule already work out; a card without
  its two days says nothing. A row opens the card's or the loan's page.
  Checked on the demo backup (an overdue installment and card).
- **Reminders** ("3 days before paying") are local notifications, no server
  (idea 6/12 of the table below).

**Plans: limits and goals** (`11k`-`11n`), Lukas's "Planes":
- **Where**: proposed as a second face of the Reporte tab, "Análisis |
  Planes", since a limit is read beside the month's analysis; Inicio shows
  only a limit close or past (`11o`). To decide - the alternative is a row
  in Más.
- **A limit**: an amount per category (or several), per period (month
  first; the periods of `period.ts`), renewing by itself, optionally one
  account, a local notice at 80%. It measures with the report's own
  `totalsOf` over the same movements (rule 20: never a second computation of
  the same figure). It says the pace ("23,300 a day left") and the same day
  of the month before; the form offers the average of the last three months.
- **A goal**: an amount and a date, tied to **an account or a product where
  the money actually sits** - its progress IS that balance, so there are no
  separate "contributions" to register twice (Lukas records aportes by hand;
  here that would be money counted in two places). It says how much a month
  is needed and whether the pace arrives in time. An emergency fund may be
  set as "N months of your spending", read from the report.
- **This touches two rules, for Jose to lift or keep**: rule 20 says "No
  budgets" (there was no table and inventing one was its own project - this
  is that project, now asked for; the report would then carry a "Límites"
  section only if he says so), and rule 15's "five things and no sixth"
  concerns products and yields - a goal points at a product without being
  part of it, so the five stay five.

**Suggested order, if Jose agrees**: (1) card dates and the statement
(small: optional columns, one pure function, the card's page); (2) loans:
the account type, the terms, the schedule engine with its tests against a
bank's own table, the installment form; (3) paying ahead and the two
answers; (4) the Deudas face and Inicio's "Esta semana"; (5) several debts;
(6) limits; (7) goals; (8) reminders. Paid or free (rule 21) is his to say:
proposed free for one loan and card dates, paid for several debts, the
strategies and plans.

**Questions for Jose before the first line**:
1. Does he have loans today, and which (consumo, vehicle, mortgage, UVR)?
   Their real terms are the best test data - a bank's own amortization table
   to reproduce to the peso, as the yields were.
2. Is "Cuenta leidy bancolombia prestamos" money he lent? Should it become
   a "Te deben" loan?
3. Deudas as a third face of Cuentas, or its own place?
4. Planes in Reporte, or in Más?
5. Lifting rule 20's "No budgets" for limits, and whether the report gets a
   section for them.

**Jose's answers (2026-10-01), and where it all lives** - decided:
- His only debt is Rappi Card; no loans, and "Cuenta leidy bancolombia
  prestamos" is an ordinary bank account. So loans are built and proved on
  INVENTED test data (a sample backup), and cards on his card.
- **Rule 20's "No budgets" is lifted**: limits are wanted.
- **Debts**: a third face of Cuentas, "Saldos | Rendimientos | Deudas", and
  a row in Más. **Más gets a group "Tus finanzas"**: Deudas y tarjetas,
  Productos y rendimientos (a second way in, asked for), Planes.
- **Planes**: in Más (and Inicio warns of a limit passed). Proposed to be
  also a face of Reporte only if it ends up being charts; to see then.
- **Work goes part by part, each shown as screens first**. Part 1 is the
  card: its two optional days and the statement worked out from its
  movements, in every state (`docs/mockups/12a`-`12i`: Más, Deudas with one
  card and no loans, the form, the statement due, part paid, paid, overdue,
  without days, with nothing owed). Then loans, then plans.

**Part 1, the card: BUILT (2026-10-01).** Approved by Jose with two
conditions: Más keeps the Google account card on top, and "Pagar" opens the
transfer FROM the account that pays this card most, TO the card, with what is
left of the statement and the usual note.
- `accounts.statement_day` and `accounts.due_day` (migration 049), both
  optional, typed in the card's form under "Fechas de la tarjeta". A day past
  a short month's end is its last day.
- `core/cards/statement.ts` (pure, `card-statement.test.mjs`): the last
  cut-off is the latest cut-off day BEFORE today (the cut-off day is open
  until it ends); the statement is the debt at its close; what is left is the
  statement less everything that came into the card after it; it is due on
  the first payment day after the cut-off. States: noDates, clear,
  nothingDue, due, partial, paid, overdue. Nothing is stored.
- `core/cards/card-data.ts`: the card's movements, `usualPayer` (most
  transfers into the card, newest winning a tie) and `loadCards`.
- Screens: `/debts` (Cuentas' third face, "Saldos | Rendimientos | Deudas")
  and `/debts/:id` (the card: Factura, and Movimientos opens Inicio on it);
  Más has "Tus finanzas" (Deudas y tarjetas, Productos y rendimientos) above
  Tus datos. Planes is not shown until it is built. Loans say "muy pronto".
- Checked in a browser on Jose's backup with invented days (25 and 10: a
  statement of 491,125.00 due 10 Oct; Pagar opened Rappi cuenta → Rappi Card,
  491,125, "Pago tarjeta de crédito RappiCard"); the days were cleared after.
  The bank's statement can differ (interest, installments, fees): the page
  says so.
- **The bank's own figure can be typed** (Jose, 2026-10-02: his Rappi Card's
  statement of 30 Sep said 34,591.00, the app 98,606.99 - two purchases he
  recorded on the cut-off day, Claro 40,799.99 and Didi 23,216, which the
  bank posted on the next statement; every other peso matched).
  `card_statements` (migration 055) keeps one figure per card and cut-off
  day; it then IS the statement (`bankFigures` in `cardStatement`), what is
  left and "Desde el corte" are worked out from it, and the app's own figure
  stays beside it with the difference - and, when the difference is exactly
  the purchases recorded on the cut-off day, it says so. The next cut-off
  goes back to the movements. Before anything is typed, purchases on the
  cut-off day are pointed out. "¿Por qué el banco puede decir otra cifra?"
  opens a sheet with every reason (cut-off-day purchases, holds charged
  later, payments posted the next working day, fees only the bank knows,
  installments, other currencies, refunds, something typed differently, the
  minimum against the total, what to do). The figure to type is the total due:
  the minimum only avoids mora, the rest earns interest; without
  installment purchases the two are the same figure (Jose's Rappi Card)
  and the hint says so plainly (2026-10-02). Tests in `card-statement.test.mjs`
  hold Jose's real case. Checked in a browser on his backup of 2026-10-01;
  the typed figure was removed afterwards.

**Part 2, loans: DRAWN for Jose's word (2026-10-01)**, `docs/mockups/13a`-`13k`,
on an invented loan whose every figure is worked out. What it proposes:
a loan is an account of type `loan` (a liability, so it is in Saldos and
subtracts from net worth); its terms (amount, rate typed as E.A. or M.V.,
number of installments and how often, disbursement and first installment,
insurance per installment, the account it is paid from, the installment the
bank states); one begun before the app counts its past installments as paid
without writing movements, and its balance today is worked out and can be
corrected; its page is Resumen | Cuotas; "Pagar la cuota" is the one
transfer form with the split - capital as the transfer, interest and
insurance as expenses under Intereses and Seguros - each figure editable,
the schedule worked out again from what was paid; overdue and paid-off
states. Paying capital ahead is part 3.

**v2, after Jose's review (2026-10-01)**: in Cuotas each installment shows
capital, interest, insurance and what is left owed on lines of their own;
and paying ahead is drawn now too (`13l`-`13r`), as he asked to research
how loans work in Colombia and include it with exact figures. Looked up the
same day (web; the norms to re-read before building):
- **Ley 1555 de 2012**: any credit in pesos can be paid ahead, all or in
  part, with no penalty; on a partial payment **the debtor chooses** a
  shorter term or a lower installment. Not above 880 SMMLV of balance.
  **Ley 546 de 1999** gives housing credits the same right.
- **Superfinanciera**: the bank must apply an extra payment as the debtor
  asks, even on another day than the installment's, and must not apply it
  to future installments when the debtor says where it goes.
- **Systems** approved for housing: fixed installment in pesos, constant
  capital in pesos, and three in UVR (constant installment, constant
  capital, cyclic decreasing). Consumer and vehicle loans are usually the
  fixed installment. Proposed: fixed installment and constant capital in
  pesos first; UVR later, it needs the UVR series.
- **Rates**: fixed or variable (IBR or DTF plus points); a variable one is
  a rate history the person updates. Usury is 1.5 times the IBC certified
  each month; it caps both the ordinary and the default interest
  (September 2026: 29.24% E.A.; August 29.66%).
- **Seguro de vida deudor** is charged on the balance still owed, so it
  falls as the loan is paid: the form offers a fixed figure or a % of the
  balance.
- What the app draws, all from one schedule engine: an extra payment once,
  every month, or in the primas (June and December); for each, when the
  loan ends, the installments left, the interest and the total still to
  pay, and the saving - with reduce-the-term against reduce-the-installment
  side by side; how much several amounts save; paying it all today (the
  balance plus the interest since the last installment, approximate - the
  bank's figure counts); default interest typed only when charged. The
  test loan's figures were worked out by a script (5,000,000 ahead with
  installment 24: ends May 2029, 5 installments sooner, interest 8,362,859
  instead of 11,049,708, saving 2,896,849 with the insurance; lowering the
  installment instead: 1,306,833, saving 1,272,397).

**And from his next look (2026-10-01), built or drawn:**
- **Inicio's quick buttons go where-it-leads first, edit last** (built): a
  card shows the receipt (its debt and statement, `/debts/:id`), an earning
  account the piggy bank, then the account's edit button.
- **Más → Tus finanzas starts with Cuentas** (built), then Deudas y
  tarjetas, then Productos y rendimientos; the Google card stays on top.
- In Cuotas the payment ahead says "Queda debiendo" on its own line (`13p`).
- **How the loan screens lead to one another**: `13s-recorrido-prestamo.jpg`
  (drawn by `docs/mockups/src/flow-13.mjs`). Everything lives on the loan's
  page, Resumen | Cuotas | Abonar; Abonar is ONE scrolling tab - the amount
  and how often on top, the two answers, how much each amount saves, and at
  its foot "Registrar el abono" (the transfer form) and "Pagar todo el
  préstamo"; an overdue installment turns the Resumen red and "Pagar la
  cuota" opens the transfer with the default interest.

**Part 2, loans: BUILT (2026-10-01)**, approved by Jose on `13a`-`13s`.
- **A loan is an account** (type `debit`: the CHECK on `accounts.type`
  cannot be widened without rebuilding the table) whose balance is minus
  the debt, so Saldos and net worth carry it for free; what makes it a
  loan is its row in `loans` (migration 050): principal, system (fixed
  installment or constant capital), the rate as typed (E.A. or M.V.),
  installments and how many months apart, disbursement and first
  installment, insurance (fixed or a monthly share of the balance), the
  installment the bank states, the account it is paid from, and how many
  installments were paid before the app with the balance the bank gave
  then. `loan_rates` is the E.A. history (a variable rate is one more
  row); `loan_payments` is what was paid, pointing at the movements it
  wrote. All three travel in the backup. COP only.
- **The schedule is worked out, never stored** (`core/loans/schedule.ts`,
  pure, `loan-schedule.test.mjs` reproduces every figure of the mockups to
  the centavo): the bank's installment (less fixed insurance) drives it;
  installments paid before the app are a record, not movements; an extra
  payment lowers the term or the installment, as the person chose (Ley
  1555); a planned extra once, monthly or in the primas; paying it all
  today is the balance plus the interest since the last due date.
- **Paying is the one transfer form** (`EntryRequest.loan`): the capital
  is the transfer from the payer into the loan, interest, insurance and
  late interest are expenses under "Intereses" and "Seguros" (created the
  first time), every figure editable, all written in one transaction by
  `LoansRepository.recordPayment`. Tapping a paid installment undoes it,
  movements included.
- Screens: `/debts/loan/:id` (Resumen | Cuotas | Abonar), the loan editor
  from "Nueva deuda" in Deudas, Inicio's receipt button and Cuentas'
  pencil lead to the loan's page.
- Checked in a browser on Jose's backup with the invented car loan of the
  mockups (form, Resumen, primas, payoff, paying installment 24 from Rappi
  cuenta, a 5M abono shortening the term, undoing both); the loan and the
  two categories were deleted afterwards.
- Known limits when it was built, all four closed the same day (below).

**What loans did not do yet, done (2026-10-01)**, from Jose's reference
package (`Paquete_pruebas_prestamos_Colombia.xlsx` and its PDF: the
Banco de la República's UVR of 16 Sep - 15 Oct 2026, official; the rest
simulated on the Superfinanciera's rules). The files are his and are not
in the repository; their figures are written into the tests.
- **A piece of a payment removed from anywhere undoes the whole payment**
  (`core/loans/payment-links.ts`, called by the transfers and the
  transactions repositories): the capital, the interest, the insurance, the
  default interest and the UVR adjustment go together, and the movement
  form's delete dialog says "Es el pago de la cuota N de X".
- **Where the money arrived** (migration 051, optional, only for a loan the
  app follows from its start): the loan opens at zero and a transfer from
  the loan into that account on the disbursement day makes the debt.
- **The account lists of the loan form are the app's one account list**
  (`shared/account-picker`: icons, Más usadas / A-Z), and **every account
  list now searches** (that one and the movement form's own; Jose: "la que
  permite buscar, ordenar...").
- **A payment ahead between installments is liquidated to its day**
  (Superfinanciera): the next installment's interest is the balance before
  it for the days up to the payment plus the balance after it for the rest,
  at the daily rate (1 + E.A.) ^ (1/365) - 1 (`splitInterest`). The
  package's case to the centavo: 1,330,904.08. Paying it all counts each
  stretch the same way. A payment on an installment's own day changes
  nothing.
- **Loans in UVR** (migration 052; `core/loans/uvr.ts`, the UVR half of
  `schedule.ts`). `loans.unit` 'UVR': the schedule walks in millionths of a
  UVR at the real rate and turns each figure into pesos at its own day's
  UVR. All three systems of the Superfinanciera: constant installment,
  constant capital, and the cyclic decreasing one (inside each year the
  installment falls by 1 - ((1 + d) ^ (1/12) - 1), d the contract's yearly
  decrease, `loans.decrease_scaled`; each year starts at the level that
  ends it where the constant installment would). `loan-uvr.test.mjs`
  reproduces the package's twelve months of each, in UVR and in pesos to
  the centavo.
  - **The UVR itself**: `uvr_values` ships the bulletin's thirty values;
    any other day is worked out by the Banco de la República's own rule,
    UVR(t) = UVR(15) x (1 + i) ^ (t/d), i the IPC variation the app already
    keeps (`inflation_months`), and says 'derived' - or 'projected' where
    that month's IPC is not published, which is every future installment.
    Checked: from the 15th of September (418.0383) and August's 0.39 %, the
    rule gives all thirty published values exactly. A value typed from a
    contract wins (`setUvr`, 'typed'); the loan form shows the
    disbursement's UVR and where it came from.
  - **The ledger**: the loan's account opens at the pesos disbursed, and
    every payment also writes the debt's growth by the UVR since the last
    movement as an "Ajuste UVR" movement of the loan's own account
    (`uvrAdjustmentOf`), shown in the payment form. Between payments,
    Saldos shows the debt as of the last movement; the loan's page shows
    it at today's UVR.
  - Not done: the IPC of a month newer than the app has is not fetched for
    the UVR beyond what `inflation_months` already fetches; a payment ahead
    planned "every month" is converted to UVR at today's value for the
    simulation.
- **From Jose's look on the phone (2026-10-01)**: the disbursement's UVR is
  one figure with a tag (Oficial, La de tu contrato, Calculada, Proyectada),
  "Tus X son Y UVR" under it, and "Escribir la de mi contrato" opening the
  box only when wanted. On a loan in UVR, "Sin abonar" breaks its total into
  what is owed today, the interest and **what the UVR adds** (the capital
  paid later in pesos worth more, projected), with a note saying why - his
  question was why 100 million plus 42 of interest made 192.
- **No bare phone control anywhere**: `shared/ui/date-field` is every date
  that is not the movement form's own (the loan's dates, a new rate's day,
  a product's dates, a rate's from and until - clearable -, the day a
  payment was really made): the day in words, and the same calendar sheet
  the movement form uses. The loan's "Cada" is a sheet of options with
  ticks. Checked: no `<select>` and no `type="date"` input is left in
  `src/app`.
- **What a row of Cuotas does** (Jose, 2026-10-01: a circle looked
  tappable and did nothing). A paid installment, or a payment ahead, opens
  a sheet with what was paid - the day, the account it left from
  (`LoansRepository.paidFrom`), capital, interest, insurance, default
  interest, the UVR adjustment and the total - and "Deshacer este pago". The
  installment due next (the first late one, or else the next) opens its
  payment. A future one carries no circle and does nothing: in a real loan
  the schedule is the bank's arithmetic, and what changes it is a payment
  (each figure editable when it is recorded), a payment ahead or a new
  rate. A figure the bank charged differently is corrected by undoing the
  payment and recording it again. The row's icon was class `state`, which
  also took the page's empty-state padding (80px of blank under it); it is
  `mark` now.
- Checked in a browser on Jose's backup with invented loans (a free
  investment with its disbursement into Rappi cuenta, an installment paid
  and deleted from Inicio; a cyclic UVR mortgage of 100,000,000, its first
  installment 2,930.6621 UVR = 1,229,906.86 as in the package, paid with
  its UVR adjustment); everything written was deleted afterwards and the
  balances checked back.

**Named "Presupuestos" and "Topes" on screen** (Jose, 2026-10-01: more
generic than Lukas's "Planes", and "tope de gasto" is how it is said in
Colombia; English "Budgets" and "Caps"). Only the words changed: the code,
keys, routes and tables still say plans and limits.

**Part 3, plans - limits: BUILT (2026-10-01)**, from mockups `14a`-`14p`,
approved by Jose. What he asked for along the way, all of it in:
- A passed limit stands out: a red card on top (Planes, Inicio, the
  limit's page), its own card marked "Pasado" with the bar running past
  the mark, how much over and since when.
- The total of all limits passed: the same tinted red, never solid red
  (v1 was "demasiado invasivo"), and each passed limit still shows its
  own red card under it.
- The notice at saving a movement that crosses a limit or the total has
  "No volver a mostrar esto"; the bell in Planes opens Avisos to turn
  each notice (at saving, the phone notification, the 80 %) off and on.
  The red cards are not notices and stay while over.
- **A limit for next month from the average of the last three months**,
  with "Usar", on the limit's page; the new-limit form offers the same
  average ("Usar tu promedio").

How it is made:
- `spending_limits` + `spending_limit_categories` (migration 053): a figure
  in pesos a month, one or several categories (each in one limit at most,
  so the total never counts a peso twice), every account counted in net
  worth or one account, a switch for the 80 % notice. Both tables travel
  in the backup. Rule 20's "No budgets" is lifted by this.
- `core/limits/limits.ts` is pure and tested (`limits.test.mjs`): what was
  spent is the summary's own rule (`totalsOf`: expenses less refunds on a
  card, never income or transfers), in pesos at each movement's rate.
  States: green, amber ahead of the month's pace or from 80 %, red past
  it. The movement that took it over, six months of history, the average
  of the three whole months before, `crossings` for the notices.
- `LimitsService` reads it all once per data change and is what Planes,
  a limit's page, Inicio (`limits-home`), Más (its "Planes" row) and the
  red dot on the bar read. It also compares each reading with the last
  of the same month: a level crossed (80 %, past it, the total past it)
  raises the sheet at saving (`limit-alert`, mounted in the app shell)
  and the phone's notification (`@capacitor/local-notifications`, native
  only), each once a month per limit and level (kept in `localStorage`)
  and each only when switched on (`settings`, `limits.notice.*`). A limit
  changed by the person, or a new one, is never a crossing.
  **And an expense saved into a cap already past raises the sheet again**
  (Jose, 2026-10-02: a Restaurante expense over a cap passed earlier that
  month said nothing, by the crossing rule alone). It reads "Sigues por
  encima de tu tope de {name}", every time, while "Al guardar" is on; the
  phone notification stays once a month, on the crossing (`stillOver` in
  `limits.ts`).
- **On Inicio every card says what it is** (Jose, 2026-10-02: a late goal
  and a cap at 96 % read as the same thing): a small coloured line on top -
  "Tope de gasto pasado" / "Todos tus topes del mes" in red, "Tope de gasto
  del mes" in amber, "Meta de ahorro" in the accent - and caps and goals in
  separate lists. A cap's title is its name alone; its percent goes on the
  line under it, so a long name never hides it (`limits-home.component.ts`).
- Screens: `/plans` (Límites | Metas - goals say "llegan pronto"), the
  month with its arrows (twelve back), the form as a full sheet, Avisos
  as a bottom sheet, `/plans/:id` (pace, next month, the months before
  against the limit, what counts, delete). Más → Tus finanzas → Planes.
- Checked in a browser on Jose's backup with invented limits and three
  invented expenses (a limit passed, the total passed, the sheet, "No
  volver a mostrar", Inicio, Más, Avisos); everything written was deleted
  afterwards. **Not seen on the phone**: the phone notification itself
  (permission prompt, its icon) and how the sheet reads there.

**Part 3, plans - goals: BUILT (2026-10-01)**, from mockups `15a`-`15m`,
approved by Jose, with the two things he added on the way: a goal can keep
its money in **several accounts or products**, and in **all of them**.
- `goals` + `goal_places` (migration 054): a figure in pesos, an optional
  month, `kind` ('custom' or 'emergency', with the `months` it was worked
  out from), `all_accounts`, `reached_on`, `archived`; each place an account
  or one of its products, counting all it holds or only what came in since it
  was added (`start_minor`, in the account's currency). A place belongs to
  one goal at most (unique index), and a whole account and one of its
  products are never both taken. Both tables travel in the backup.
- **What a goal has is what its places hold** - never contributions typed
  apart - in pesos at today's rate (`savedOn` in `goals.repository.ts`): an
  account by its ledger balance, a product by the figure the products screen
  shows. "Todas tus cuentas" is what the accounts counted in net worth hold
  (cards, loans and products set outside net worth left out; debts NOT
  subtracted - Jose was told and did not object), less what the other goals'
  places inside them hold. Only one goal can be "all accounts".
- `core/goals/goals.ts` is pure and tested (`goals.test.mjs`): what is left,
  what each month needs to the date, the pace (what came in a month over the
  last three months), the month the pace arrives (none past ten years:
  "tardarías más de 10 años"), states on time / late / no date / reached. A
  goal reached is marked once and stays reached after the money is used. An
  emergency fund is N months of the average spent over the whole months
  before this one (up to six, from the first with spending), the summary's
  own rule; its page offers to catch up when that moves over 5 %.
- Screens: Presupuestos → Metas (empty state with "Fondo de emergencia" and
  "Otra meta", the total, in course, reached, archived), the editor
  (`goal-editor`: name and face, figure or months, month, places sheet with
  "Todas tus cuentas" and the breakdown of what other goals take off, "Qué
  cuenta" per place), `/plans/goal/:id` (hero, pace, "Para llegar" when late:
  pay in or move the date, places with their share, six months against the
  line, Cambiar / Aportar, archive once reached, delete). Aportar opens the
  one transfer form into the place holding most, from the account that
  usually feeds it, with what this month needs. Más's Presupuestos line
  counts goals and the late ones; Inicio shows a late goal as one row.
- Checked in a browser on Jose's backup with an invented emergency fund over
  all accounts (14.2 M spent a month, 85.4 M for six months, reached since
  the accounts hold 333 M) and an invented trip over ARQ EUR and Bancolombia
  (late, "más de 10 años", Aportar opening Rappi cuenta → Bancolombia with
  the usual note); both deleted afterwards. Not seen on the phone.

**Also fixed the same day (PRs #21, #23 and #24)**: a product with a typed
balance given money the day it was created earned nothing (Jose's new
Pibank product "Impuesto de renta": 0 typed on 29 Sep at 20:02, 200,000
moved in at 20:08, 0.00 paid on 1 Oct). The engine took every movement dated
on the figure's day as already inside the figure. #21 counted on top only
those recorded after the figure was typed, which fixed it (57.19 paid on
1 Oct). #23 went further and counted the whole day on top, as the screen
did - and that double-counted Global66 USD (a 2.00 figure of the 9th and its
2.00 deposit of the same day, recorded before the figure: 4.00) and Plenti.
#24 goes back to #21's rule and makes the screen ("Tiene hoy", the product
form's breakdown) follow it too (`movedInProductSince`/`movedInProductsOf`
take the figure's `created_at`). Checked on his backup of 2026-10-01: no
yield moves but Dale's (rule 17), and Global66 USD and Plenti earn on 2.00
and 0 again. Global66 USD's 0 on 1 Oct is right: 2 dollars at 3.1 % E.A.
earn about a third of a cent in September. Days (Días) now name the product
on each line when the account has several, as Pagos already did.
**Since 2026-10-02 Días and Pagos name the product on every line, even in an
account with one product, and show the GROSS yield in green** (Jose: he
wanted what was earned before withholding): what was paid plus what was
withheld (`grossOf`), the withholding under it as before, and each month's
header the gross with "Neto X" under it when anything was withheld.
**Beside each day's and payment's date, what it was worked out at**
(`kindOf`; Jose, 2026-10-02): the rate ("· 5,00 % E.A."), or for a spending
bonus "Bonificación 5,50 %" when earned, "Bonificación pendiente" in a month
still running (it is judged on what was spent so far and may still be
earned) and "Bonificación no ganada" in a month over, or "Pago del CDT"
with its rate. The line under it keeps the product, the balance it earned
on and the component's own name.
**The yields screen's total says what was earned so far this month** (Jose,
2026-10-02), "Llevas acumulado en octubre: +X" - every day of the peso
accounts dated in the month up to today, net of withholding
(`YieldsRepository.earnedBetween`) - where it said what the last day
alone had paid. A day's title cut short on Días or Pagos already slides
(checked in a browser: the marquee wraps it, text and its "· Bonificación"
part together).

### The ideas, by what they would take

| # | Idea | Size | Touches | Status |
|---|---|---|---|---|
| D | Floating bottom bar, 4 tabs, "+" sheet | Large | Drawer decision | **Built** with the redesign, 2026-09-28 |
| 21 | Settings screen, grouped, value on each row | Medium | Drawer | **Built**: Más, 2026-09-28 |
| 20 | Empty state on every screen and section | Small, many places | - | Proposed |
| 19 | Home that teaches a new user (cards) | Medium | Rule 21 (store) | Proposed |
| 3 | Privacy mode: eye in the header hides amounts | - | - | **Rejected** by Jose, 2026-09-28 (little use) |
| 4 | Biometric or PIN lock (free) | Small, plugin | iOS rule | Proposed |
| 23 | Version shown; "Eliminar mis datos" | Small | Play policy | Proposed |
| 17 | Quincena, trimestre, semestre as periods | Small (`period.ts`) | Report | Proposed |
| 5/22 | Favourites ("registros comunes"), app-icon shortcuts | Medium | iOS rule | Proposed |
| 2/16 | Budgets per category: amount, period, renew | Large, new table | Rule 20 said "no budgets" | **Built** as limits, 2026-10-01 |
| 1 | "Seguro para gastar" today, showing its working | Medium, needs 2 | - | Proposed |
| 7 | Month-end projection, as a report section | Small | Rule 20 | **Built** as "Tu saldo a futuro" (90 days), 2026-09-28 |
| 15 | Savings goal as a target on a product or account | Medium | Rule 15 "five things" | Proposed and drawn (`11l`, `11n`), "Debts and plans" |
| 6/12 | Local reminders (no server): rent, statements, review | Medium | Rule 22 (no invented movements) | Proposed |
| 18 | Visible locks on paid features | Small, after the paywall | Rule 21 | Proposed |
| 13 | Privacy policy listing each provider | Small, text | Store listing | Proposed |
| 11 | Crash reports: Play vitals first, Sentry opt-in only | Small | Privacy | Proposed |
| 8/9 | Voice dictation / receipt photo into the review screen | Large | Rule 22 | Proposed, later |
| F | Frequent movements in the "+" sheet, one tap each | Medium | Rule 22 (never saved without the tap) | Proposed, liked by Jose |
| H | Hide amounts with the eye (same as 3) | - | - | **Rejected** by Jose, 2026-09-28 |
| P | Choose the accent | Small | Design | **Decided** by Jose, 2026-09-28: Zafiro by default, changeable in Apariencia |
| L | Loans, card dates, paying ahead, debt strategies | Large, new type and tables | Rules 4, 7, 11, 22 | Proposed and drawn (`11a`-`11j`), first in Jose's order |
| - | Tags | - | - | **Rejected** by Jose, 2026-09-27 |
| - | Ads, accounts, a cloud database, attribution | - | Rule 21 | **Not to copy** |

A suggested order, if Jose agrees: the small ones that make the app feel
finished (20, 3, 23, 17), then the design shell (D with 21), then the
budget family (2/16, 1, 7), then the rest.

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
- [ ] Try the redesign on the phone and report what reads wrong: the list
      in "Start here" (Drive progress, long press, keypad, Registrar otro,
      sheets, the accent in the light theme).
- [ ] Check on the phone that the Drive copy no longer hangs at 2 % (fixed
      2026-10-01: leave the app over an hour, come back, it finishes or says why).
- [ ] Decide on the ideas from Lukas's atajos (rule 22, mockups `10a`-`10f`):
      which to build and in what order, and whether a notification of the
      app's own (`10d`) is worth reading in the background.
- [ ] Debts part 2 (loans) is built, UVR included: try a loan on the phone
      (Más → Deudas y tarjetas → Nueva deuda) and say what reads wrong. If a
      real statement with a payment ahead between installments, or a real
      UVR statement, turns up, check the figures against it. Then part 3, plans.
- [ ] Limits (plans, step 1) are built: try them on the phone - the phone
      notification asks for permission the first time, check it arrives and
      how its icon looks.
- [ ] Goals (plans, step 2) are built: try them on the phone (Más →
      Presupuestos → Metas) and say what reads wrong.
- [ ] Pibank's new product: press "Recalcular" (Productos y rendimientos,
      the round arrow) once the update is installed, so the 1 Oct payment
      is worked out again with the 200,000.
- [ ] Debts part 1 is built: put the Rappi Card's real cut-off and payment
      days (pencil on its page) and say whether the statement matches the bank's.
- [ ] Press "Recalcular" once after installing the update with PR #33.
- [ ] When the Rappi Card's statement arrives, type its "pago total" on the
      card's page if it differs, and say whether the explanation reads well.
- [ ] Say whether "Llevas acumulado en {mes}" should be net (as built) or
      gross, like the green figure on Días and Pagos.
- [ ] Look on the phone at Inicio's labelled cards (topes, metas) and at
      Días/Pagos with the rate or bonus beside each date.
- [ ] SMS by sender (#47): after the update, open Más → Notificaciones del
      teléfono, wait for a bank's SMS, and tick its sender under "Mensajes de
      texto"; say whether the bank appears there and whether its message
      reaches Movimientos por revisar.
- [ ] Try the amount with the phone's own keyboard (#45): whether the
      keyboard comes up by itself on a new movement, and the erase and X
      keys beside the figure.

## Documents

- `docs/02-technical-decisions.md` — the reasoning behind each decision
- `docs/03-roadmap.md` — order of work by phase
- `docs/04-stack-guide.md` — stack primer for someone coming from .NET/Angular
- `docs/05-data-model.md` — the SQLite schema and the reasoning behind it
- `docs/06-schema.md` — the schema drawn: ER diagram, delete rules, constraints
- `docs/07-competitor-lukas.md` — Lukas (Jotatech) compared with this app, and ideas from it
- `store/` — the Play Store listing, its icon, feature graphic and screenshots (taken from the invented sample backup)
- `docs/08-redesign-checklist.md` — everything each screen does today, to check before a redesigned screen is called done
- `docs/mockups/` — the redesign drawn, every screen (index in its README), plus proposals: `10*` (reading bank messages) and `11*` (debts and plans)
