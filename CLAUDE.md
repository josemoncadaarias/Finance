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
- **Jose's data is an example, never the rule** (Jose, 2026-10-22: "mis
  datos son solo ejemplo nada más, todo debe funcionar de manera genérica con
  cualquier info a cualquier usuario"). No code, threshold, word list, test
  expectation or user-facing text may lean on his accounts, categories, shops
  or figures. His backup is only for checking that a generic rule behaves
  well on real data; tests use invented data. Found and removed the same day:
  the tax simulator filled 2026 with his own figures when an account was
  named "Rappi cuenta" (any user could have one) - those figures now live
  only in `tools/db/tax-spreadsheet-2026.mjs`, as test data; and the
  notifications screen's app icon matched two bank names. What stays on
  purpose: international company names among the common words that suggest
  a starter category (Uber, Netflix...), never anyone's own.
- **How the app's words are written: `.claude/skills/app-copy/SKILL.md`.**
  Read it before adding or changing any user-facing string (Jose,
  2026-10-19, after "Usar el automático": name the thing, never an
  adjective alone; buttons say the result).

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

## Start here: where things stand (updated 2026-10-15)

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

**From #57 on (2026-10-05 to 2026-10-15, up to #133)** each change is told
in the dated bullets at the end of "How to work, wherever you are" below and
in the rule it touches, rather than in a table. The last ones of 2026-10-14
and 15: every money box reads pasted figures (#128); a new account from a
statement lands on its statement in Por revisar (#129); the PDF password box
takes typing over the account form (#130); credit card statements and other
banks' layouts are read (#131, #132); a figure missing to add up is brought
from the statement's summary (#133).

**Going back.** Branch `app-before-redesign` holds `main` exactly as it was
before #1 (commit 5e185ad). Running "Store bundle" (Actions tab,
`release-aab.yml`, `workflow_dispatch`) on that branch builds the old app
with a higher version code, so the phone takes it as an update, data kept.
Nothing about the data would need undoing: the redesign wrote no migration.

**How Jose updates his phone**: Actions tab → "Store bundle" → Run workflow
on `main` → it uploads to the internal track → the Play Store updates the
app. A debug APK can no longer be installed on that phone (other key).
If Play Store does not offer the update although Play Console says
"Available to internal testers" (Jose, 2026-10-19: versions 1117 and 1118
did not show for over an hour), Play Store's own cache is stale: Play Store's
app info → Forzar detención → Borrar datos → Borrar caché and Borrar todos
los datos (on Xiaomi the button is "Borrar datos" at the foot). The version
Play's "Detalles" shows is the listing's (the closed test's), not the one
installed; that one is in Ajustes → Apps → Finance.

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
  the paywall service and screen (rule 21); several debts' strategies (avalanche, snowball); the
  ideas from Lukas's atajos (rule 22).
- The open questions of rule 21 (which report sections are paid, lifetime
  option, what sits between the app and Google Play) and the list in
  "Pending from Jose".

**How to work, wherever you are.**
- Tests: `node tools/db/run-tests.mjs` (1108 on 2026-10-28, all must pass). Build:
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
- **Every time work is merged, end with the steps to publish it to the
  testers and its release note** (Jose, 2026-10-09): Store bundle on `main`,
  then the new version into Closed testing (Alpha) with an `<es-419>` note
  of at most 500 characters, then Send changes for review.
- A new user-facing word goes into `core/i18n/translations.ts` or, for the
  redesign's words, `core/i18n/translations-ui.ts` - both languages, same
  keys (`i18n.test.mjs` checks it).
- A new control that appears on two screens is defined once in
  `src/global.scss` (the `ui-*` classes).
- **Every update brings its guide** (Jose, 2026-10-14: "actualizar todas
  las guías con cada actualización"). A change a person can see or use adds
  or rewrites the steps of that screen's tour (`TOURS` in
  `core/tour/tour.service.ts`, words `tour.<id>.<n>.*` in both languages).
  A step added to a tour someone may already have seen carries
  `since: <next version>`: whoever saw the tour before is shown only the
  steps newer than what they saw, once, marked "Nuevo"; a new person sees
  the whole tour (`stepsToShow` in `core/tour/tour-versions.ts`; seen
  versions kept as `id@v` in `finance.tours.seen`, an old bare id counting
  as 1). `tour-versions.test.mjs` fails on a step without its words in both
  languages. Version 2 (2026-10-14): Por revisar - what is chosen is
  remembered, "No es un movimiento"; Notificaciones - each bank's page,
  "Ignorar publicidad"; Deudas - a loan already being paid ("¿Ya lo
  vienes pagando?" on top of the loan form). Version 3 (2026-10-14): Por revisar
  - "Movimientos que se repiten" answered whole, "Editar" for several. Categorías - a category's side can be changed. Inicio - the eye that hides amounts.
  Version 4 (2026-10-15): Por revisar - "Extractos que cuadran" (a figure
  missing to add up, brought from the statement's summary); Cuentas - "Una
  cuenta desde su extracto" (a card's statement and one with a password
  fill the new account, and saving opens Por revisar on it).
  Version 5 (2026-10-15): Cuentas - "Lo que tienes y lo que debes"
  (accounts tour); Inicio - "Tu tarjeta de un vistazo" and "Lo que gastaste,
  en pesos" (home tour, `since: 4`); Deudas - "Cuánto debes en cada cosa"
  (debts tour, `since: 3`); a card - "Te avisamos el día de pago" (card
  tour, `since: 2`).
  Version 6 (2026-10-20): Inicio - the "+" step says everything the sheet
  holds (spending, income, transfer, the assistant, a PDF statement, a new
  account; `since: 6`), and the bar's step and the assistant's button say it
  too; a card - "La tasa de interés de tu tarjeta" (card tour, `since: 3`).
  Version 7 (2026-10-22): the assistant - it learns where a sentence was
  saved (step 3 reworded, `since: 3`), the conversation's days and the 20
  free questions (`since: 3`); Por revisar - a shop's account and the note
  that follows the account (`since: 5`). (A tour's `since` counts that tour's
  own versions.) Version 8 (2026-10-22): the assistant's new questions
  (fixed payments, interest, why it went up, a cap or goal by name; `since: 4`).
  Version 9 (2026-10-22): Inicio's "+" step names "Pagos de este mes" (`since: 7`).
  Version 10 (2026-10-22): a new `reminders` tour; Más - "Recordatorios"
  (`since: 4`). Version 11 (2026-10-22): the periods named in Inicio's
  account-and-period step (`since: 8`) and the report's period step
  (`since: 2`) - quincena and semestre. Version 12 (2026-10-22): Inicio -
  "Atajos desde el ícono" (`since: 9`). Version 13 (2026-10-22): Inicio's
  "+" step names "Lo que más registras" (`since: 10`). Version 14
  (2026-10-22): Inicio - "Lo que puedes gastar hoy" (`since: 11`).
  Version 17 (2026-10-22): Inicio's "+" step names "Pagos fijos y
  frecuentes" (`since: 14`). Version 18 (2026-10-22): the assistant's step
  on the conversation's days says where "Cambiar" is now and names the
  arrows (`since: 5`). Version 19 (2026-10-22): Recordatorios - "A la
  hora que quieras" (any time, when it rings, the notices to allow;
  `since: 2`). Version 20 (2026-10-22): Más - "Reportar un fallo o
  sugerir una mejora" under Ayuda (`since: 5`). Version 21 (2026-10-23):
  the assistant - the bulb with every question, notes searched, a
  movement of an answer opens (`since: 6`).
  **A step whose words change because the screen changed is marked with
  the next version**, so whoever saw the old words is shown it once more.
  **The bubble's count ("1 de 10") has a line of its own over the buttons**
  (`.progress` in tour-overlay, never wrapping): beside ten dots and the
  buttons, at a large letter size it broke onto three lines (Jose,
  2026-10-20). Checked at 302 px.
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

- **Sample data and erasing everything are in the app** (Jose, 2026-10-09,
  mockups `21a`-`21f`, approved). The showcase generator lives in
  `core/demo/showcase.ts` (`buildShowcase(db, today)`, every date moved from
  2026-10-02 to the day it is built; `tools/db/showcase-data.mjs` is now a
  wrapper, `showcase.test.mjs` builds it on five days). An app with no
  account shows Inicio's welcome (`app-demo-home`): "Crear mi primera
  cuenta" (`/accounts?new=account`), "Explorar con datos de ejemplo" (one
  transaction, cancellable, under a second in a browser; NOT timed on the
  phone) and "Restaurar una copia". While it is loaded (`settings`
  `demo.loaded`, `DemoService.active`) Inicio carries a strip with "Empezar
  con los míos", Drive is never written (`CloudBackupService.save`) and bank
  messages are not proposed (`NoticeInboxService`). Más → Tus datos has
  "Datos de ejemplo" and "Borrar todos los datos" (`/erase`: counts, "Guardar
  una copia antes", type BORRAR/ERASE). Erasing (`DatabaseService.eraseAll`
  -> `eraseEverything`) drops every table, migrates again and seeds the
  starter categories; it forgets which Drive copy the device continues
  (`rememberSeen('')`) so an empty database never replaces it unasked, and
  the full erase also forgets the kept bank messages (`forgetCaught`).

- **Inicio's pending items are one folded line, and the app has guided
  tours** (Jose, 2026-10-11, mockups `22a`-`22i` and `23b`/`23c`/`23g`,
  option A of 23). `app-attention-home` wraps `app-due-home` and
  `app-limits-home`: "N pendientes" with a pill per kind (pagos, topes,
  metas; red when late or passed), folded by default, the choice kept on the
  device (`finance.attentionOpen`); the rows inside are unchanged. Tours:
  `core/tour/tour.service.ts` (`TOURS`: `home` with its welcome, `attention`,
  `yields`; seen and on/off in localStorage, `finance.tours.*`) and
  `shared/tour/tour-overlay.component.ts`, mounted once in the shell, which
  dims the screen around the element marked `data-tour="..."` and skips a
  step whose element is not on screen. Inicio offers `home` the first time it
  shows accounts; any other tour waits for it. Más → Preferencias → Guías:
  on/off, replay the first, show them all again. Checked in a browser on the
  sample data; not seen on the phone.
  **Every screen has its own tour since 2026-10-12** (Jose: "toooodas las
  posibles pantallas"): Más (each group), Cuentas, Monedas y TRM, Reporte,
  Categorías, Rendimientos, Deudas, a card, a loan, Presupuestos, a cap, a
  goal, the tax simulator, Por revisar, Notificaciones, Importar y exportar,
  Google, Borrar todo and the movement form (`entry`, offered by the form).
  A route opens its tour (`ROUTE_TOURS` in `tour.service.ts`, 1.1 s after
  arriving and only if still there); a step lights a `data-tour` mark or a
  CSS selector (`sel`), or with neither is a card in the middle saying what
  the screen is for; a step whose element is not drawn within 1.5 s is
  skipped. What is lit is clipped to the screen and the bubble goes where
  there is room - over the lower part of what is lit when it is a long
  list. A new screen gets a tour by adding its steps and its route there,
  with both languages' words (`tour.<id>.<n>.title/text`).

- **The app learns from every save, not only from Por revisar** (Jose,
  2026-10-12). A spending or income saved or corrected in the one movement
  form (Inicio, the "+", a correction) files the shop in its note under its
  category (`teach` in `entry.component.ts` -> `ProposalsRepository.learn`;
  the newest answer wins). Correcting a movement that came from a bank
  message, or a transfer leg that did, rewrites that message's answer and
  relearns its source's mold (`movementCorrected`), so the next message of
  that shape comes with the account and category finally chosen. A message
  saved as Transferir teaches the account the person left at the message's
  end (read by the message's sign), no longer the one first proposed.
  Tests in `notice-molds.test.mjs`; checked in a browser on the sample data.

- **A proposal is reviewed in the one movement form** (Jose, 2026-10-13:
  "todo debe ser manejado bajo lo mismo"). Por revisar's own form
  (`proposal-form.component`) is deleted: tapping a row opens `app-entry`
  as spending or income by its sign (`openInForm` in `review.page.ts`),
  carrying `EntryRequest.proposal` (`EntryProposal`: what was read, its
  account - none when unknown, never guessed -, its category and where it
  came from, the description as it came, and the review screen's notes:
  seen by several messages with "Separar", maybe the same as another, maybe
  already registered, sign read from the words). So an account with
  products shows its usual product and "¿Qué cambia?", the note has the
  form's own suggestions (plus "tal como vino") and Gasto / Ingreso /
  Transferir switch inside the form, keeping the proposal. Saving writes the
  movement as any other (`writeScoped` now returns the movement's id), then
  `answerProposal` corrects the proposal to what was chosen, marks it saved
  against that movement (none for "Solo el producto"), lets go of a pairing
  with another bank's message, and teaches the shop and the mold. A
  suggestion chosen on the press is no longer chosen again by the click
  that follows (`notePressedAt`): the list moved under the finger and the
  click landed on the row "as it came" - however long the finger stayed
  down (a time window of 0.7 s still failed on a 1.5 s press, reproduced
  with a touch held in a browser). "Registrar otro" is not offered on
  a proposal. Checked in a browser on the sample data.

- **An advert is never a movement** (Jose, 2026-10-13: Rappi's "Combo a
  $19.900, antes: 29.900. Pide ya" rang as "Movimiento detectado" - the
  Rappi app is ticked for Rappi cuenta). A message with a call to buy, a
  discount or a price set against an earlier one ("antes: 29.900") is read
  as nothing and does not ring, unless it also says money DID move to the
  person ("compraste", "recibiste", "te transfirieron"...). Generic words,
  no shop or bank named: `ADVERT`, `PRICE_BEFORE`, `HAPPENED` in
  `read-notice.ts` and the same lists in `MovementAlert.java`, kept in step.
  Tests in `read-notice.test.mjs` (invented adverts and movements); the
  Java checked against the same texts outside Android, not on the phone.
  **"No es un movimiento" is BUILT** (Jose, 2026-10-14, mockups `24a`-`24d`).
  It teaches the SOURCE only (an app, or an SMS sender), never the app as a
  whole. `notices.quiet` in `settings` (`Quiet` in `core/notices/molds.ts`)
  holds each such message's shape (`NotMold`: every number a slot, so the
  same advert with another price fits) and the sources that are `strict`.
  The second answer from one source makes it strict (`STRICT_AFTER`): it
  then offers only messages saying money DID move (`saysItHappened`, the
  `HAPPENED` words) or fitting a shape the person SAVED, which always pass
  (`silencedBy`, read by `readNotices`). Three ways in: the phone's notice
  (its third button is "No es movimiento" for one message, still "Descartar
  todos" for several; `ACTION_NOT_MOVEMENT`, handed to the app once by
  `takeNotMovements`); the bin of Revisar movimiento on a message, which asks
  "¿Qué es este mensaje?" (statement rows keep the plain question), with a
  notice and "Deshacer" (`notAMovement`/`undoNotAMovement`, `ToastService`
  now takes an action); and a source's page, with the switch "Ignorar
  publicidad" (renamed at Jose's word, 2026-10-14: the first wording read as
  nothing) and "Sí era un movimiento" beside each message
  held back (`isAMovement`: forgets the shapes it fits and the strictness,
  and the message is offered again). The phone's notice learns it too: each
  inbox pass hands Java the shapes only, no words (`quietForPhone` ->
  `setQuiet`), and `MovementAlert.silenced` logs "taught" or "strict" instead
  of ringing. Tests in `not-a-movement.test.mjs`; the Java patterns were
  checked against the same texts with the JDK, not on the phone; checked in
  a browser on the sample data.

- **Everything chosen in Revisar movimiento is remembered for the shop**
  (Jose, 2026-10-13: "cuenta, producto, qué cambia, nota, categoría... todo
  todo debería ser aprendido"). The account, the category and the kind were
  learned already (the source's answers, the shop's category, the molds);
  the note written instead of the bank's words, the product and "¿Qué
  cambia?" were not. Migration 057 adds `note`, `product_id` and `scope` to
  `merchant_categories`, written by `learn(..., chosen)` from the form's
  save (`answerProposal`); a note left as the bank wrote it is stored as
  none, and a save that does not say them (a batch, a hand-typed movement)
  leaves them as they were. Opening a proposal (`openInForm`) starts on the
  shop's note, product (while it belongs to the account) and answer
  (`EntryProposal.productId/scope`), and "Guardar los listos" writes them
  too (`accept.ts`, through `writeScoped` when the answer is not "both").
  Tests in `proposals.test.mjs`; checked in a browser on the sample data.

- **Every plain amount box reads the keyboard as the movement form does**
  (Jose, 2026-10-14, from his partner's phone: an account's opening balance
  pasted as "3,8000000", and each digit typed went after the comma - the box
  showed "0,00" as its value and took every full stop for the cents).
  `shared/ui/amount-input.directive.ts` (`[appAmountInput]` +
  `(amountChange)`) runs `typedInto` with the cursor: digits land where the
  cursor is, thousands' full stops stay grouping, a comma or one full stop
  typed alone starts the cents, pasted "3.800.000" is 3,800,000. Used by an
  account's opening balance and limit, a loan's amounts, a cap and a goal;
  "0,00" is a placeholder now, never the value. Test in
  `amount-buffer.test.mjs`; checked in a browser (typed, pasted, a digit
  changed in the middle).
  **Every other money box too** (Jose, 2026-10-14: "revisa que no pase de
  nuevo"): a loan payment's interest, insurance and default interest, a
  loan's payment ahead and a card's bank figure use the directive; the
  products screen's boxes keep their own `amountTyped`, which now keeps the
  cursor where the digit was typed (`caretAfterRegroup` in
  `typed-amount.ts`, tested). Rates, UVR values and counts are not money and
  stay plain; Por revisar's "Escribir otro" balance stays plain because it
  may be negative.

- **A new account from a statement is made in one step, and lands on its
  statement** (Jose, 2026-10-14: no loading screen, the password asked
  behind the form, and saving went to Cuentas with the account made and
  nothing of the statement to see). The reading screen and its password
  dialog sit above every sheet (`statement-flow` at z-index 40000). Saving
  writes the account and the statement's proposals in ONE transaction
  (`account-editor` `save`, "Guardando la cuenta y sus N movimientos…"), so a
  failure leaves no account behind, then opens Por revisar with that
  statement open (`/review?batch=<key>`: the review page opens that origin,
  clears its filters and the parameter) and says "Cuenta creada. Revisa sus
  N movimientos del extracto". Importing into an existing account (the "+"
  and the account form) opens its batch the same way. Checked in a browser
  with `pruebas/extracto-banco-azul-septiembre.pdf`.
  **The password box could not be typed into** (Jose, 2026-10-14, from the
  phone): the dialogs live outside the account form's ion-modal, and Ionic
  pulls the focus back into the topmost modal. While the reading screen or a
  dialog is up, `statement-flow` adds `ion-disable-focus-trap` to the open
  modals (and takes it off after), and the password box takes the focus
  itself. Checked in a browser with a copy of that PDF locked with a
  password.
  **A credit card's statement is read too** (Jose, 2026-10-15: Rappi Card's
  statement, from screenshots, read "0 movimientos"). Three causes, all in
  `core/statements/`: each row starts with the card ("Virtual") or a dash
  before its date, and a date was only read at the very start of a line -
  now one short word without digits may lead it, when that same word leads
  at least two dated rows (`datingOf`), so "Corte 20/09/2026" is still no
  movement; a payment is printed "$-43.834,00", minus after the currency,
  which read as positive (`moneyIn`); and a card prints purchases as they
  are and payments with the minus. A statement is a card's when the account
  is a card or, for a new account, when it says two of "pago mínimo",
  "cupo total/utilizado", "pago total", "fecha de pago", "tarjeta de crédito"
  (`looksLikeCard`): then a minus is money back into the card, anything else
  a spending, no column is taken for a running balance, the opening is
  minus "Saldo periodo anterior" and the closing minus the first "Pago
  total" (`cardBalances`, the figure right after the words), and a new
  account becomes a Tarjeta with the printed "Cupo total". Rates, "N/A" and
  "1 de 8" leave the description. The check then says "No cuadra" by the
  interest, which is no movement of the list. A statement with no movement
  read no longer says "Leí 0 movimientos": nothing is saved and the dialog
  says no movement with a date and an amount was found (`ui.import.noRows`).
  Tests in `statement.test.mjs` (the layout copied from the screenshots);
  checked in a browser with a PDF written in that layout - not with the real
  file, which the session never had.
  **And the layouts other banks use** (Jose, 2026-10-15: "que la app sea
  capaz de leer cualquier tipo de extracto"). Read now, each with its test
  in `statement.test.mjs` (rows invented in each shape): whatever a
  statement prints before every row's date - a card's word, a dash, an
  authorisation number - as long as its shape repeats on two dated rows
  (`datingOf`: words as they are, digits as "9"), and a bare run of digits
  is no amount beside amounts written as such (`amountsOf`); a second date
  (the posting day) after the first; the month first ("Sep 12, 2026", "SEP
  12"), and no shop taken for a month ("12 MAYORISTA", `monthOf`);
  "Débitos"/"Créditos" (or "Cargos"/"Abonos") columns with no sign and no
  balance, the sign by the column under which the amount sits
  (`sideColumnsOf`); a statement from December into January whose days carry
  no year (`acrossNewYear`); on a card, "CR" and an unsigned row that STARTS
  with "PAGO", "ABONO", "DEVOLUCIÓN"... as money back into the card, while
  "MERCADO PAGO" stays a purchase (`CARD_CAME_IN`); and the date leaves the
  description however it was written ("03 Ago 2026"). **What it still cannot
  read**: a scanned PDF (no text inside; a photo or screenshot of it can be
  read since 2026-10-22, below). Since 2026-10-28 a description that runs
  onto the lines under it is kept whole, and a bank app's screenshot that
  lists rows under day headings is read (below). A statement that reads no movement says so and saves
  nothing; one that does not add up says "No cuadra" and by how much.
  **What is missing to add up is looked for in the statement's own summary**
  (Jose, 2026-10-15: Rappi Card's statement was off by exactly its 11.101,42
  of "Intereses corrientes", printed in its summary and in no row). When
  opening plus what was read misses the closing figure, every line that is
  not a movement is searched for exactly that amount (`summaryLineFor`): the
  words printed just before it say what it is, and a total or a balance
  ("saldo", "total", "cupo", "mínimo", "pago total", "consumos del mes"...)
  is never taken. Found, it is one more proposal - the missing amount,
  signed so the statement adds up, dated on the list's last day, its words
  as the description, `summary: true` in its evidence - and the statement
  "Cuadra"; Por revisar marks it "Del resumen del extracto" (counted under
  "Con aviso"), and nothing is saved without the person, as always. Found
  nowhere, the statement stays "No cuadra" and nothing is invented. On a
  card, an unsigned purchase is no longer flagged as a guessed sign.
  Review tour step `since: 4`. Tests in `statement.test.mjs`; checked in a
  browser with a card PDF carrying its interest only in the summary.

- **Net worth is said as what you have and what you owe, and a card as
  its credit** (Jose, 2026-10-15, mockups `29a`-`29g`, from a screen his
  partner got from another AI: its "Dinero disponible" was a card's free
  credit, which is the bank's money, not the person's). Cuentas → Saldos:
  under "Patrimonio hoy", "Lo que tienes menos lo que debes" and two tiles,
  "Lo que tienes" (how many accounts) and "Lo que debes" (cards · loans ·
  accounts below zero, opening Deudas). Both come from the total's own lines
  split by sign (`splitWorth` in `core/worth/worth-split.ts`,
  `worth-split.test.mjs`), so they always add up to it; a line with no rate
  stays out as it does of the total. "¿De dónde sale?" is the same two
  sections with their totals, a card saying its "Cupo disponible", and a
  note that free credit does not add up. A card's row in the list says
  "Disponible X". **Inicio on a card**: "Debes hoy" without the minus (the
  label says it), "Cupo usado N %", the bar, "Cupo disponible" and "Cupo
  total", and, with its two days, the statement line (`cardLine`, due or
  late) opening the card's page; without a limit, how to add one. **The big
  figure has a line of its own** under the label and the buttons on Inicio
  and on Cuentas (Jose's screenshot: "-7.780.959..." cut by three round
  buttons), and steps down in size past 9 and 11 digits (`bigSize`,
  `isLong`). Tour steps `since: 5` (accounts) and `since: 4` (home).
  Checked in a browser at 360 px on the sample data. Not seen on the phone.

- **The donut says whole figures, and Deudas each kind's total** (Jose,
  2026-10-15, mockups `30d` and `30i`, from his partner: "1,40 M" was not
  read as 1.4 million by everybody, and someone with several cards and loans
  wants each kind added up). The middle of the donut is the whole figure
  ("$ 1.396.098", `whole` in `spending-chart.component.ts`), also for a
  slice tapped. **It never touches the ring, and nothing in it ends in "…"** (Jose, the
  same day: TRANSPO…, "3 movimien…" did not read well). The ring is thinner
  (`R_IN` 68, was 62) for a wider hole; each line of the hole carries
  `data-fit` (its share of the hole's width) and is MEASURED as drawn and
  shrunk to fit (`fitLine`, `afterRenderEffect` keyed on what the middle says
  and the ring's width via a ResizeObserver - never on scroll), so the
  phone's font, letter size and width all count. A slice tapped keeps only
  its percent and its figure inside; its name, its movements and "Ver
  movimientos ›" are a row under the ring (`.picked-line`), where the words
  have room. Checked by measuring every line's corners against the hole at
  320, 360 and 412 px, totals up to $ 1.234.567.890 and every slice tapped:
  at least 7 px clear, nothing overflowing. **The icons keep their size
  while the ring scales with the phone**, so on a narrow one the lowest
  figure reached past the box onto "Toca una porción…" and the top row slid
  down onto its own lines (Jose, 2026-10-15). The card is a container and the
  box keeps room under it and over it in container units (`.box` margins);
  the top row is anchored by its foot just over where its line comes in
  (`Part.bottom`, `TOP_ROW_Y`). Measured at 320, 360 and 412 px: no line
  crosses a percent, a figure or an icon, and about 18 px clear above the
  top row and before the hint. And
  each icon round the ring says its amount under its percent. The layout box
  grew by that line (`BOX_H` 390, `AMOUNT_LINE` in `donut-layout.ts`): the
  ring and every place but the top row moved down, the top row's lines enter
  under the amount. The list of categories under the donut is unchanged (Jose:
  keep it). Deudas: "Debes hoy" has the eye on its top line, and with cards
  AND loans two tiles, Tarjetas and Préstamos, each with its count, taking
  the page down to its list; each section's heading says "TARJETAS · 2" and
  its total (pesos only, as the big figure). Tour steps: home `since: 4`,
  debts `since: 3`. Checked in a browser on the sample data at 360 px.

- **A card's payment day rings on the phone** (Jose, 2026-10-15: a reminder
  in the style of "Movimiento detectado", only when the card has its two
  days and something is left to pay). `CardDueService` (started by the app
  shell) works out on every data change, from `loadCards`, which reminders
  there should be (`duePlans` in `core/cards/due-reminder.ts`, pure,
  `due-reminder.test.mjs`): a statement `due` or `partial` with something
  left, on its payment day at 8:00 (`DUE_HOUR`), or at once when the app is
  opened on that day after 8 - each card and payday once (`finance.cardDue.told`).
  It cancels what it scheduled before and schedules again, so a payment saved
  takes back a reminder on its way, and removes one already shown for a
  statement now paid. Scheduled with the phone's alarms
  (`@capacitor/local-notifications`, inexact on purpose so Android does not
  send the person to "Alarms & reminders"), so it rings with the app closed.
  "💳 Hoy pagas {tarjeta} · $ X", what is left of the statement of the cut-off
  of {día} (and what was already paid), on its own channel `card_due` at high
  importance, private on the lock screen, the app's icon (`drawable-nodpi/
  ic_notice_logo.png`) and its accent; "Pagar ahora" opens the card's page
  with `?pay=1`, which opens the payment as its "Pagar" does, and "Ver la
  tarjeta" (or a tap) the card's page. Never with the sample data loaded. The
  permission is asked once, only when there is a reminder to set. Card tour
  step `since: 2`. Checked in a browser: `?pay=1` opens the payment; the
  notification itself only on the phone, not seen yet.

- **What the person does not use is not shown** (Jose, 2026-10-15, part 1
  of "Personaliza tu vista", mockups `31a`-`31c`, from his partner). Deudas
  lists Tarjetas and Préstamos only when there is one of that kind; the kind
  missing is one quiet line, "¿Tienes un préstamo? Agrégalo en Nueva deuda"
  (opening the loan form, or the "Nueva deuda" sheet for a card), and with
  neither one card says so with "Agregar una deuda". The Cuentas tab shows
  its Rendimientos face only while an account earns (`EarningService`, read
  on every data change; shown while unknown and while it is the face on
  show); Más → Productos y rendimientos stays the way in to set up the
  first one. Checked in a browser on an empty app and on the sample data.

- **"Personaliza tu vista": each person chooses what Inicio, Deudas and
  the Reporte show** (Jose, 2026-10-15, part 2, mockups `31d`-`31h`). Más →
  Preferencias → "Personaliza tu vista" (`/view`, then `/view/home|debts|
  report`, `features/view/view.page.ts`): each screen's blocks with a switch;
  the first of each (Inicio's balance, Deudas' total, the report's figures)
  says "Siempre". `ViewPrefsService` (`core/ui/view-prefs.service.ts`,
  `VIEW_SCREENS`) keeps what is hidden on the device (`finance.view`), with
  "Volver a como viene la app". Hiding deletes nothing. Inicio: Pendientes
  turned off still shows when a payment is late or a cap gone over
  (`app-attention-home [onlyUrgent]`); the chart and the list cannot both be
  off (turning one off turns the other on), and the Gráfico/Movimientos
  selector shows only while both are on - or while a slice tapped opened the
  list; "Al abrir Inicio, mostrar primero" sets the face it opens on
  (`FilterService.showList`'s first value). Deudas: Tarjetas and Préstamos can
  be turned off (the two tiles show only while both are on). Reporte: any
  section but the first, left out of the screen AND the spreadsheet
  (`reportWorkbook(data, hidden, order)`); the yields summary is not affected.
  **The order is dragged there too** (Jose, the same day): each row has a ☰
  handle (`ion-reorder-group`, `ionReorderEnd` answered with `complete(false)`
  and the order kept by the service, which redraws). Inicio's three places -
  Pendientes, the balance, the chart or list - are drawn in that order
  (`homeSlots`, one `ng-template` each), and of the chart and the list the
  one higher opens Inicio and comes first in its selector (`firstFace`; the
  old "mostrar primero" choice is read as that order). Deudas' Tarjetas and
  Préstamos and the report's sections (screen and sheet, `inOrder`) follow
  it; Deudas' total and the report's figures are pinned first. The order's
  arithmetic is pure, in `core/ui/view-order.ts` (`view-prefs.test.mjs`).
  Tours: Más `since: 2`, a new `view` tour. Checked in a browser on the
  sample data (every switch, dragging on each screen, the reset).

- **The eye hides every amount** (Jose, 2026-10-14, mockups `28`; idea 3/H,
  turned down on 2026-09-28, asked for again). One switch for the whole app
  (`PrivacyService.hidden`, not kept between openings): the same round eye
  (`app-amounts-eye`) sits at the top right of each screen's big card -
  Inicio (first of its quick buttons), Cuentas, Rendimientos and an account's
  page, Deudas, a card, a loan, a cap, a goal - and in the title bar of
  Reporte and Presupuestos, whose big card changes. It works where amounts
  become text: `formatMoney` returns `HIDDEN_AMOUNT` ("••••••") while
  `amountsHidden()`, the money pipe is impure to follow it, and the few
  formatters of their own check it too (products' `money`, a loan's `whole`,
  the report's and the donut's short figures); the report rebuilds its
  sentences when the eye changes. Never hidden: typed boxes (`shown: true`,
  the tax simulator, which stands apart), and files - the CSV and the tax
  sheet pass `shown`, the report's spreadsheet is built inside
  `withAmountsShown`. Más → Preferencias → "Ocultar montos al abrir"
  (`finance.amounts.hideOnOpen`) starts every opening hidden. Names,
  categories, percentages and rates stay. Home tour step `since: 3`. Tests
  in `hidden-amounts.test.mjs`; checked in a browser on the sample data
  (every screen hidden from one tap, shown again from Cuentas, hidden on
  reopening with the switch on). Not seen on the phone.

- **A category's side can be changed even once used** (Jose, 2026-10-14:
  it was locked, so a category set up as income that was spending had no way
  out). The category editor's "Para" opens the same sheet as for a new one;
  saving another side asks first ("¿Pasar {name} a {kind}?", how many
  movements, that balances change, that it can be turned back).
  `changeCategoryKind` (`core/categories/change-kind.ts`) does it in one
  transaction: the category's kind; every movement under it negated, its peso
  value too, and marked `locked`; a product's own movement under it negated;
  a "Solo el patrimonio" movement keeps that answer - its half on the product
  turns from a cash-out into an entry or back, so the product does not move.
  A name already taken on the other side is refused (`KindTaken`). Yields
  are redone by the next pass through the month marks. Tests in
  `category-kind.test.mjs`; checked in a browser on the sample data.

- **Several proposals answered in the one form** (Jose, 2026-10-14,
  mockups `25`, option A: saving saves them all). "Comercios que se
  repiten" is "Movimientos que se repiten"; tapping a group opens its page
  (a sheet: by day or by category, a row opens alone, "Responder los N"),
  and the selection bar's "Categoría" tile became "Editar" (Jose: the
  category is part of editing). Both open `app-entry` with
  `EntryRequest.many` (`EntryManyItem`: each proposal, its signed amount,
  its day and its own note): Gasto / Ingreso / Transferir, account,
  product, "¿Qué cambia?", category and note, with no amount and no day -
  each keeps its own. A category or note left untouched keeps each one's
  own ("Cada uno con la suya"); one they all share starts on screen.
  `saveMany` writes each through the same writers as one proposal
  (`saveMovement`/`saveScoped`/`saveTransfer`, `teach`, `answerProposal`,
  via `proposalNow`), then works out yields once from the earliest day;
  those lacking an amount or a category stay in Por revisar and the toast
  says how many. Between currencies a transfer asks to save them one by
  one. What the ledger already holds is never included. Checked in a
  browser on the sample data (a group of 2, a selection of 3 with
  different categories, switching to Transferir and back).

- **A loan already being paid is asked for on top** (Jose, 2026-10-14,
  mockup `27`). The loan form keeps every field it had; "Cuotas ya pagadas"
  left its section at the foot - shown only once the dates typed fell in the
  past, so nobody found it - for an amber card under the name, "¿Ya lo vienes
  pagando?", always shown. The worked-out and the bank's balance stay at the
  foot, under "Ya habías empezado a pagarlo", once something is paid; a count
  past what the dates make due says so in amber, without blocking the save.
  Debts' tour has a step for it (`since: 2`).

- **The app's text follows the phone's font size up to 130 %** (Jose,
  2026-10-14, screenshots of a phone set to the largest letters: the sample
  strip's words stood one letter per line, "Cuentas" broke into three).
  Android hands the WebView the system font scale as its text zoom, up to
  200 %; `MainActivity.followFontSize` acts only past `MAX_TEXT_ZOOM`
  (130), setting 130, on creation and on every resume - a phone at or under
  it keeps exactly what Android gave it, and display size is never touched
  (#119); a letter size brought back under the cap undoes only what the app
  set. The strip wraps
  its button under the words when they need the room. Checked in a browser
  by multiplying every font size (1.8 reproduced the screenshots; 1.3 and
  1.0 read whole); the Java not yet compiled by a Store bundle.

- **A card's Inicio says what its balance is, and a tour always shows what
  it lights** (Jose, 2026-10-15, two screenshots). A card saved with its
  limit typed as a POSITIVE opening balance read "Debes hoy 7.500.000",
  "Cupo disponible 0,00": `availableCreditMinor` took `|balance|`, so money
  in favour counted as debt. It is now limit + balance (rule 4: a card's
  balance is minus the debt), and Inicio's card says "Debes hoy", "No debes
  nada" or "Saldo a favor" (green) by the balance's sign; past the limit,
  "Cupo usado" says the real percent in red and "Te pasaste del cupo por X"
  replaces "Cupo disponible". The sample data has the four missing cards:
  Arena (nothing owed), Menta (in favour), Roja (over its limit), Nube (no
  limit). **A card is set up as the bank's app shows it** (Jose, 2026-10-15,
  mockups `32a`-`32d`, built the same day): the account form asks a card
  "Cómo está hoy" instead of "Saldo inicial" - "Sé mi cupo disponible"
  (Cupo total + Cupo disponible hoy) or "Sé lo que debo" (what is owed, no
  minus, the limit optional) - and says back under them what that means
  (Debes hoy, Saldo a favor, No debes nada, or Cupo disponible / Te pasaste
  del cupo). The balance is available − limit, or minus what is owed, and the
  opening figure saved is that balance less the movements already on record
  (`core/cards/card-setup.ts`, `card-setup.test.mjs`), so editing a card in
  use ("Con tus N movimientos desde que la abriste") moves only the opening
  figure, never a movement; changing only its limit keeps the debt. A card
  read from a statement keeps the statement's opening field. Accounts tour
  step `since: 6`. Checked in a browser on the sample data: four new cards
  saved with the right figures, and Tarjeta Coral edited (232 movements
  untouched, balance moved by exactly what was typed).
  **Tours**: a step's element was brought in with `scrollIntoView
  ('nearest')`, which left it at the bottom edge - under the floating bar -
  and the lit box was clipped to a sliver there (the Más tour's "Personaliza
  tu vista"). Now `bringIntoView` (tour-overlay) scrolls the page's own
  scroller so the element and the bubble's room fit between the title bar
  and the floating bar (`areaFor`; an element in the bar, a modal or a
  fixed layer keeps the whole screen), a taller one with its top under the
  title, and the lit box is clipped to that area, never to the screen.
  Checked in a browser on the sample data: every tour of every screen at
  393×700.

- **Inicio's blocks keep one gap in any order** (Jose, 2026-10-15, three
  screenshots: after reordering on "Personaliza tu vista" the balance card
  touched the list above it and "N pendientes" below it, and the account's
  name sat on the line under it). Each block carried an outside margin that
  only fit the order the app comes in. Now `.home-slots` (movements page) is
  a column with a 12px gap and the blocks keep no outside margin: Pendientes
  hides itself whole when nothing is pending (`total() === 0` on its host)
  and spaces its own bar and rows inside; the chart or list is one
  `.faces-slot`. The header's name and line under it have 3px between them
  and a 1.3 line height. Checked with a script that measures every card
  against the one above it (`touching`: rounded, filled, under 6px apart):
  it found the two touches of the screenshots on the build before, and none
  after, over five orders of Inicio, chart and list, all accounts and five
  kinds of account, Deudas reordered and every other screen (86 views).

- **"Barra de abajo": the floating bar's three buttons are chosen** (Jose,
  2026-10-15, mockups `33a`-`33f`, approved as drawn). Personaliza tu vista
  → Barra de abajo (`/view/bar`, `features/view/bar.page.ts`): the bar as it
  will look on top, its three buttons (Inicio, Cuentas, Reporte as the app
  comes), each tapped to choose another screen in a sheet - Deudas,
  Presupuestos, Rendimientos, Por revisar, Categorías, Monedas, Renta - and
  dragged by ☰; one already on the bar swaps places. The "+" in the middle
  and Más at the end never move. Kept with the rest of the view on the device
  (`finance.view` → `bar`, `ViewPrefsService.bar`); the arithmetic is pure in
  `core/ui/bar-choice.ts` (`barOf`, `withChoice`, `movedBar`, `buttonFor`,
  `startRoute`, `leftTheBar`; `bar-choice.test.mjs`). **The app opens on the
  first button** (the `''` route redirects through `startRoute`). A screen
  lights the button whose routes match it most closely (Deudas on the bar
  lights for `/debts`, not Cuentas), anything else lights Más. Inicio or
  Reporte off the bar are listed on top of Más under "No están en tu barra"
  (Cuentas is always under Tus finanzas). Tours: view step `since: 2`, a new
  `bar` tour. Checked in a browser on the sample data: choosing, the swap,
  dragging with the real handle, the lit button per screen, Más, opening on
  Deudas, the reset.

- **A bank's message with no account to go to makes one** (Jose,
  2026-10-16, mockups `35a`-`35e`, approved). "¿De qué cuenta es?" on
  Notificaciones (`app-account-picker [newFor]`) and the account list of a
  message opened as a spending or an income (`newBankFor` in the entry
  form) offer "Crear la cuenta {bank}" - the whole sheet when there is no
  account yet (`.ui-empty-new` in global.scss), a row at the foot otherwise.
  It opens the account form with the bank's name and a line saying what it
  is for (`AccountEditorComponent.forBank`; `saved` now hands back the id
  made); saving goes back where the person was with that account chosen,
  and the source is assigned to it (`assignSource`, which now says how many
  waiting messages took it). **And a message saved as Transferir remembers
  its note and the products of both ends** (`Mold.transfer`,
  `TransferMemory`, read as `evidence.transferMemory` by `asTransfer`): the
  next message of that shape opens as it was saved, only its amount new. A
  spending or an income already remembered its note, product and answer
  (migration 057). Notifications tour step `since: 3`. Tests in
  `notice-molds.test.mjs`; checked in a browser on an empty app (both ways,
  the form named, the account chosen on return).

- **Every word the app says is plain Spanish** (Jose's partner, 2026-10-16:
  "está súper mal redactado", "brokers" not understood, titles that only make
  sense after reading the text under them). Every Spanish string outside the
  tax module was rewritten (about 640 in `translations*.ts`, the 188 tour
  texts before that in #158): a title says what the thing is, "dinero" not
  "plata", "Elige" not "Escoge", "intereses" where an explanation said
  "rendimientos", no "brokers", "retefuente" or "backup", and each technical
  term (TRM, CDT, UVR, E.A., retención en la fuente, cashback) carries a
  short gloss the first time a screen says it. Screen names stay. The tax
  module's words are untouched (rule above). Net worth's sheet is "Cómo se
  calcula tu patrimonio" with a "Ten en cuenta:" list; a card is set up as
  "Configura tu tarjeta como aparece en el banco". **New words follow the
  same rule.** Checked in a browser on the sample data.

- **A tapped "Movimiento detectado" says what it is doing** (Jose,
  2026-10-17, mockup `36`, option A: the app sat on Inicio "thinking" before
  Por revisar opened). `NoticeInboxService.lookForAsked` takes the notice's
  ask from the phone as the app opens or comes back, shows
  `app-opening-notice` (the screen dimmed, "Abriendo el movimiento
  detectado…", three steps: your data, the bank's message, Por revisar) and
  reads the messages at once instead of after the usual 2.5 s. Por revisar
  ends it when it opens the movement (`openingDone`); after 20 s it ends by
  itself with "No pudimos abrir el movimiento. Lo encuentras en Movimientos
  por revisar." Checked in a browser by setting the signal; the real tap
  only on the phone.
  **When the message is not in Por revisar, it says so at once** (Jose,
  2026-10-17: the overlay waited 20 s over an empty list and then claimed
  the movement was there). Once the review screen has read the messages and
  refreshed without finding it (`giveUpOnAskedNotice`), `notFound(source)`
  ends the overlay and the notice says "Ese mensaje no quedó en Movimientos
  por revisar" with "Ver qué pasó", which opens Notificaciones on that
  source's page (`?source=`, `openAskedSource`), where each message says
  what became of it. Why that message was not proposed is not known from
  the cloud session (ignored, saved or discarded before, or joined to
  another; assumed).
  **No word of the app ends in "…"** (Jose, the same day): the phone's notice
  actions are one word each ("Revisar", "Más tarde", "Ignorar"), its title
  keeps the sign with the figure (a word joiner), and a `.ui-seg` choice
  wraps onto two lines instead of cutting. Checked at 302 px (a 393 px phone
  at 130 % letters) on every screen with the sample data: only names (an
  account, a category) still end in "…", and those slide (marquee rule).

- **A currency is chosen from a list, never typed, and a typed value can
  go back to the automatic one** (Jose, 2026-10-19, mockups `37a`-`37c`).
  `core/currencies/catalog.ts` (`CATALOG`, `searchCatalog`, `flagOf`,
  `currencyName`; `currency-catalog.test.mjs`): about sixty currencies with
  flag, both names and symbol; `auto` marks the dollar and the ECB's list,
  the rest ("Sin fuente automática: escribes su valor") are typed. "Agregar
  una moneda" (`currency-dialog`, both screens) is that list with a search
  by country, name or code; one already kept says "Ya la tienes". Names
  show in the app's language. Tapping a currency on Monedas y TRM opens its
  value; a typed one shows the official one beside it ("TRM oficial de hoy"
  for the dollar, "Tasa oficial de hoy" for the rest, fetched on opening,
  `rateToPesosOn`) and "Usar la TRM oficial" / "Usar la tasa oficial"
  writes it dated today. The
  dollar's refresh no longer writes over a value typed today either (rule
  7, as every other currency). **The sample data no longer writes today's
  rates**: its invented TRM dated today was taken for the official one and
  the real one was never fetched (yesterday's stands offline). Tour
  `currencies` step `since: 2`. Checked in a browser with the TRM and the
  ECB answered by stubs (the session's network refuses both).
  **The sample's invented rates were shown as official and outlived
  "Actualizar"** (Jose, 2026-10-19, on the phone: the dollar at ~3,400 as
  "TRM oficial" while the real one was ~3,170). The sample wrote an invented
  rate for EVERY calendar day, and the TRM service has rows only on the days
  a rate takes effect - so the invented row of a weekend or holiday sat
  between the last real quote and today and kept answering. Now the sample
  marks its rates `demo` ("Valor de ejemplo", amber), `RatesService.refresh`
  also writes the TRM in force under today's date (never over a value typed
  today), and a currency's sheet looks up the official rate beside any rate
  that is typed, invented or not today's, with "Usar la TRM oficial" /
  "Usar la tasa oficial"; its title says what the rate in use really is,
  never "de hoy" for another day's. Checked in a browser with the TRM
  answered by a stub whose last quote was a Saturday.

- **A main currency for showing, never for storing** (Jose, 2026-10-19,
  mockup `37d`: "solo para efectos de mostrar saldos, reportes"; the app
  stays in pesos inside). Monedas y TRM → "Moneda principal" (a sheet of the
  currencies kept; one with no rate on record cannot be chosen), kept on the
  device (`finance.mainCurrency`, `MainCurrencyService`). Its rate book is
  the rates on record for it plus the rate each movement of an account in it
  was saved with (`rateBook`, `rateOn`: the last on or before a day, else the
  first); choosing the dollar brings ~400 days of TRM in (`backfillTrm`,
  `INSERT OR IGNORE`, never over a typed one). What changes, all in
  `core/currencies/in-main.ts` (pure, `in-main.test.mjs`): with several
  accounts, `MovementsStore.readPeriod` replaces each row's
  `amount_base_minor` IN MEMORY by its value in the main currency - its own
  amount when it is already in it, else its pesos at its own day's rate
  (`movementInMain`) - so Inicio's totals, the donut, the groups, "movido
  entre tus cuentas" and the movements report (screen and spreadsheet, whose
  column says the code, `ReportData.main`) follow; net worth on Inicio,
  Cuentas and the account list is each line at today's rate, the total their
  sum (`worthInMain`). Always pesos: yields and their summary, the tax
  simulator, debts and loans, caps, goals and Monedas y TRM's own card. A
  movement or account row shows its code only when it is not the main one.
  Currencies tour step `since: 3`. Checked in a browser on the sample data
  with stubbed rates (Cuentas and Inicio 78,712,764.24 COP → 20,118.78 USD).

- **A currency no account uses can be removed** (Jose, 2026-10-19, mockups
  `37e`-`37g`). Its sheet on Monedas y TRM says "Ninguna cuenta usa esta
  moneda." and offers "Quitar esta moneda", asked first; yes deletes its
  `exchange_rates` rows and its `currencies` row in one transaction
  (`remove` in `currencies.page.ts`, which counts the accounts again
  inside it). Never pesos, never the main currency in force; an account
  archived still counts as using it ("La usa N cuentas"). Currencies tour
  step `since: 4`. Checked in a browser on the sample data.

- **The "+" makes an account too, and a product is added step by step**
  (Jose, 2026-10-19, mockups `38a`-`38h`). The "+" sheet has "Nueva cuenta"
  under "Importar extracto PDF" (`/accounts?new=account`). An account's
  Productos opens with "Agregar un producto" as a dashed accent card
  (`.ui-add` in global.scss), no longer a row at the foot of the list. The
  product form has no tabs: a new product asks its kind first ("¿Qué tipo
  de producto es?", `kindChosen`), then steps that open and close
  (`productSteps` in `products.page.ts`): Nombre, Saldo de hoy, Tasa,
  Bonificación por gasto, Ajustes; a CDT Nombre, Monto y plazo, Tasa, Al
  vencer, Ajustes (and Pagos once saved). Each says ✓, "Falta" or
  "Opcional" with what it holds. A new product's balance and rate start
  empty and must be typed (0 is an answer, nothing is assumed); "Guardar el
  producto" stays dim with "Te falta: ..." and, pressed early, opens what is
  missing and saves nothing (`trySaveProduct`). **The spending bonus was
  only offered when editing** (the tab was pushed only for an existing
  product), which is why Jose never found it: it is a step of every
  high-yield product now, and a new one can carry it from the start
  (`newBonus*`, saved as a second rate line in the same transaction). An
  existing product opens on the same page, every step closed with its
  summary, Guardar in the title bar. Yields tour step `since: 2`. Checked in
  a browser on the sample data: a bolsillo with bonus and a CDT created,
  reopened, the early save opening what was missing.

- **The usual note on a product that is not the usual one needs no habit**
  (Jose, 2026-10-15: an income "Solo el producto" on Plata's Bolsillo under
  Ganancia offered no note). A product other than the account's usual one,
  with its category, is as specific as a route: when it has no note written
  twice, the last note written there for that category and side is offered
  (`usualNote`, `lastWritten`), before the account's own habit. The usual
  product still needs two uses. Test in `usual-note.test.mjs`; checked in a
  browser on the sample data (one entry on Banco Índigo's "Para el impuesto
  de renta", the note offered whether the category or the product is chosen
  first). Not checked on Jose's data: why his own notes did not come is not
  proved (fewer than two uses on that product and category, or filed under
  another one, assumed).

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

**What each feature would be on an iPhone** (Jose, 2026-10-22: offer on
iOS everything that can be offered, said clearly to the person where it
cannot; nothing built). Not verified on a device - from Apple's public
documentation as known, each line to confirm on the day:

| Feature (Android today) | On iOS | How |
|---|---|---|
| Everything in the WebView: accounts, movements, report, yields, debts, plans, assistant by text, tax simulator, backups to a file | Same | Capacitor; `@capacitor-community/sqlite` has an iOS backend (test a restore) |
| Drive backup | Yes | Google sign-in for iOS needs its own OAuth client; iCloud could be offered beside it |
| Reading other apps' notifications (`NotificationCatcher`) | **No** | iOS lets no app read another app's notifications. Say so on the screen; never a dead end (group 7 rule) |
| Reading the SMS inbox / SMS by sender (`SmsInbox`, `SmsReceiver`) | **No** | No API. The door is a Shortcuts personal automation "When I get a message from {sender}" handing the text to the app through an App Intent - the person installs it once per sender (what Lukas's "Instalar atajo" is, rule 22) |
| Bank mail | Partly | Shortcuts' "Email" trigger (Mail app only), same App Intent |
| Card purchases with Apple Pay | Partly | Shortcuts' "Transaction" trigger (iOS 17+) gives amount and shop for Wallet cards; FinanceKit (Apple Card / Wallet data) needs an entitlement Apple grants case by case and began in the US |
| "Movimiento detectado" notice and Por revisar | Yes, fed by those Shortcuts | The App Intent writes the same raw message the Java side writes; `readNotices`, molds, proposals and review need nothing new |
| "Avisarme siempre al instante" (foreground service) | Not needed / not possible | No listener to keep alive |
| Statement PDF | Yes | pdf.js in WKWebView |
| Photo of a receipt or statement (ML Kit, `OcrPlugin`) | Yes | Apple Vision (`VNRecognizeTextRequest`) on the device, or ML Kit's iOS SDK; same `OcrPage` shape back |
| Voice (`SpeechPlugin`) | Yes | Apple's Speech framework; asks microphone and speech-recognition permission (Android's RecognizerIntent asks none) |
| Reminders, card due day, caps' notices | Yes | Local notifications; iOS keeps at most 64 pending, so schedule the nearest first |
| Shortcuts on the icon (`ShortcutsPlugin`) | Yes | Home-screen quick actions (`UIApplicationShortcutItem`) |
| Font size cap (`MainActivity.followFontSize`) | Different | Dynamic Type; the cap is done in CSS or the WKWebView |
| Finance Pro | Yes | RevenueCat covers the App Store with the same SDK; an App Store subscription and its own trial |

**How the app tells them apart**: `Capacitor.getPlatform()` ('android',
'ios', 'web') in ONE place - a `DeviceService` answering "can this phone
read notifications / SMS / Shortcuts" - and every screen asks it, as every
lock asks `PaywallService` (the same "one place answers" rule). Where a
feature does not exist, the entry is not offered or says, in the app's
words, what the phone allows instead ("En iPhone, los SMS llegan con un
atajo: Instalar el atajo de {remitente}"). Native code per platform
(Java now, Swift then) behind the same plugin names, so the TypeScript
does not change.

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
     (Planes, "Debts and plans"), and since 2026-10-28, at his word, the
     report has "Tus topes de gasto del mes" (below).
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

   **The list, decided by Jose on 2026-10-15** (replacing the lists above where
   they differ; `core/paywall/plan.ts` is the table, `paywall-plan.test.mjs`):
   - Free: accounts in pesos, movements, transfers, Inicio and its chart,
     the starter categories (rename, hide), credit cards with their statement
     and reminder, ONE loan, ONE cap, ONE goal, ONE product, the first
     statement, ONE bank source (app or SMS) with **15 movements a month**
     saved from messages, backups (local, Drive), CSV, every preference
     (language, theme, **every accent colour**, the view, the bar, hiding
     amounts, guides, sample data, erasing), Monedas y TRM to look at, and
     the report's headline, against the period before, where it went and the
     biggest movements.
   - Paid: accounts in other currencies, more statements, products, loans,
     caps and goals, more bank sources and movements past 15 a month (they
     keep arriving and wait in Por revisar, locked: "Tienes N movimientos
     detectados. Desbloquea para guardarlos con un toque"; typing them by hand
     stays free), the rest of the report and its spreadsheet, the tax
     simulator, creating categories, own pictures.
   - **Built (2026-10-15, mockups `34a`-`34h`, approved by Jose)**: the table
     and `PaywallService` (`core/paywall/`), which answers everything unlocked
     while there is no store, so nobody notices anything. On the Finance Pro
     screen (`/pro`, `features/pro/pro.page.ts`) "Ver la app como alguien sin
     Pro" (`finance.paywall.preview`) shows the free version, to try the locks
     on the phone; the buy and restore buttons say purchases arrive with the
     store. **Hide that switch in production when billing is plugged in.**
     The locks, each through `allow(feature)` (counts in the database) or
     `can`/`ask`: `/tax` by a route guard (`proGuard`), creating a category
     (categories page and the movement form), the Imagen propia tab
     (`face-editor`, an image already chosen still opens), a currency other
     than COP and "Agregar una moneda" in the account form, reading a
     statement (the "+" and the account form), a product (enrolling and
     "Agregar producto"), a loan, a cap, a goal, turning on a bank source
     past the first, the report's paid sections (title and its `about`, a
     PRO tag, never figures) and its spreadsheet, and Por revisar past 15
     message movements this month (card with "15 de 15", the waiting count
     and "Ver Finance Pro"; opening, Editar and saving those rows ask).
     `app-pro-sheet` in the shell is the sheet every lock opens. Más carries
     the Finance Pro card (`.ui-pro-card` in global.scss, with room above
     and below - Jose: never stuck to the block above). `.ui-pro` is the
     tag. Tours: Más `since: 3`, a new `pro` tour. Checked in a browser on
     the sample data in both modes; not on the phone.
   - **Google Play through RevenueCat, wired (2026-10-15)**: Jose created the
     payments profile in Play Console (Colombia only offers "Organización";
     business name Jadex Labs, public address left without his home - to
     replace with a virtual office before launch), added himself as a license
     tester (My List), and made the RevenueCat project "Finance" (account
     jadex.apps@gmail.com, entitlement "Finance pro", default offering Monthly
     + Yearly, no lifetime) with the Play Store app `com.jadexlabs.finance`.
     Its public key `goog_...` is in `environment*.ts` (`revenueCatGoogleKey`,
     public by design). `@revenuecat/purchases-capacitor` 13.6.1 (pinned, over
     two weeks old) is imported lazily by `PaywallService` on Android only:
     it connects 4 s after opening, any active entitlement is Pro
     (`entitled`, cached in `finance.pro.entitled` so offline the last answer
     holds), `loadPlans` reads the store's prices, `buy`/`restore` go through
     Google Play. **`CHARGING` in `plan.ts` is false**: everybody keeps
     everything open (`isUnlocked`), and a purchase made while previewing the
     free version unlocks it, so the whole cycle can be tried with a license
     tester. The privacy policy (`site/`) gained "Suscripción Finance Pro";
     **Done in Play Console the same day**: the subscription `finance_pro`,
     base plans `monthly` and `yearly`, each with the offer `prueba-7-dias`
     (new customers, 7 days free), in 175 countries. Play rounded the prices
     typed (11,900 and 69,900) to **12,000 and 70,000 COP**; `PRICES` follows,
     and the screen shows the store's own price once it answers. **Then, also
     that day**: the service account `play-uploader` (the one GitHub uploads
     with) got a JSON key uploaded to RevenueCat ("Valid credentials"), Play
     permissions "View financial data" and "Manage orders and subscriptions",
     and the Pub/Sub Admin role; real-time developer notifications run through
     `projects/finance-508916/topics/Play-Store-Notifications` (test received);
     both products are imported, attached to the entitlement and in the
     default offering beside the Test Store ones. **A purchase was tried on
     Jose's phone with the license tester** (bundle run 102): the store's
     prices showed, Google offered the trial and the test card, and the app
     said "Tienes Finance Pro" with the free-version preview on. **Before
     charging for real**: `CHARGING` to true, the preview switch hidden, Jose's
     own access granted in RevenueCat, the public address replaced.
   - **Once paid, the Finance Pro screen stops selling** (Jose, 2026-10-16,
     mockups `34i`-`34m`, approved: the two plans still showed after paying).
     `subscriptionOf` (`core/paywall/subscription.ts`, `subscription.test.mjs`)
     reads the store's entitlement - plan (the base plan id: monthly / yearly),
     trial, renews, until - kept with the cached answer so it reads offline,
     and read again each time the screen opens. On top what is paid and until
     when (trial days left and the day it starts charging; "Pagas X al mes ·
     se renueva el D"; cancelled: active until D, "Volver a activar"); the plan
     paid for marked "TU PLAN"; "Cambiar a anual" at once crediting the month
     (`WITH_TIME_PRORATION`), "Cambiar a mensual" when the year ends
     (`DEFERRED`), each asked first (`storeProductChangeInfo` on
     `purchasePackage`, old product `finance_pro`); "Administrar en Google
     Play" (`manage`: RevenueCat's management URL, opened by Android); the
     perks at the foot under "Lo que tienes". Más's card says the plan and its
     date. Pro tour step `since: 2`. Checked in a browser with each state
     faked in `finance.pro.entitled`; the change of plan itself not yet tried
     with a license tester. `site/` is deployed by Netlify from `main` by itself.
   - **The buy button says what will really happen** (Jose, 2026-10-16,
     mockups `34n`-`34p`, approved: "Probar 7 días gratis" was offered to
     everybody, also to whom Google would charge at once). Google decides who
     still has the trial: the offer's free phase comes in the package only for
     them (`trialDaysOf(product.defaultOption.freePhase)`), and anybody ever
     seen paying (`entitlements.all`, `allPurchasedProductIdentifiers` -
     `everPaid`, cached) is never promised it. `buyOffer`: "Empezar 7 días
     gratis" with "Hoy no pagas nada. El {fecha} se cobran {precio}..."; or
     "Suscribirme · {precio} al mes/año"; or, once a Finance Pro ran out
     (`lapsedOn`), a card "Tu Finance Pro terminó el {fecha}" and "Volver a
     Finance Pro · {precio}". Before the store answers (and in a browser) the
     trial is assumed only for someone never seen paying. Tested in
     `subscription.test.mjs`; each case checked in a browser by faking the
     cached answer.
     **Más's Finance Pro card says the same** (Jose, 2026-10-16: it still
     offered "Prueba gratis" after his test subscription lapsed): it reads
     the same `buyOffer` - "Prueba Finance Pro gratis" only for the trial,
     "Finance Pro · Terminó el {fecha}" once lapsed, plain "Finance Pro" with
     the month's messages otherwise (`proTitle`, `freeLine` in
     `more.page.ts`).

   - **Finance Pro for good, for Jose and whoever he chooses, with no
     payment** (Jose, 2026-10-28: "algunos usuarios, yo incluido, ... lo
     veamos siempre como pro"). The store's id was RevenueCat's anonymous
     one, new on every install, so a grant to it would be lost on a
     reinstall. Now the store follows the person's Google account
     (`PaywallService.follow`: `Purchases.logIn` with `proIdOf(email)` -
     "fp-" and 24 hex of the address's SHA-256, never the address itself,
     `core/paywall/pro-id.ts`, `pro-id.test.mjs`); a purchase made before
     moves with it (RevenueCat's own rule). **The id is no code to give
     away** (Jose, 2026-10-28: he feared one subscription shared by many):
     a phone gets Pro only from the store's answer for the Google account
     signed in on it, and pasting someone's id does nothing - the app works
     its own out from its own account. Sharing a subscription would mean
     sharing the Google account itself (its Gmail, Drive and this app's
     backup), as with any Play subscription; per-device was weighed and
     refused (a new phone or a reinstall would lose what was paid).
     Assumed, not closed: someone who rebuilds the app could log in as
     another person's id if they know their address; only a server would
     stop it. So the id is hidden: a long press on "Finance Pro" on the
     Finance Pro screen shows "Identificador de tu cuenta" with "Copiar el
     identificador" (and "Entrar con Google" while it is the anonymous one),
     and another hides it; its tour step is gone. **How to grant it** (from
     memory, to confirm in the dashboard): RevenueCat → project Finance →
     Customers → search the code → Entitlements → Grant → "Finance pro" →
     Lifetime. Granted that way, `entitled` is true from the store's next
     answer and cached offline like any purchase. **Keep `CHARGING` false
     until Jose's own id shows "Tienes Finance Pro"**; then turn it on and
     hide the preview switch. Checked in a browser
     with both kinds of code faked; the store's login only on the phone.

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
    and "Apps y SMS ocultos" (eye icon; apps not read and those put away,
    one section since 2026-10-08 - "Otras apps" read as hidden ones anyway),
    with the fold button and the arrows. Removed at
    Jose's word (2026-10-08): "Revisar qué le llega a la app" (the
    diagnosis had served its purpose) and the "···" menu with "Borrar lo
    guardado" and "Olvidar todo" (risky, and switching a source off or on
    is already per source). Their plugin methods stay in Java, unused.
    A bank's sources hang from it on a tree line (`.children`), so they do
    not read as rows at the bank's level, and so do the rows of every
    other section (Jose, 2026-10-08). Each section's line says what it
    holds by kind ("2 apps · 1 remitente de SMS") and what it is for;
    the senders' section is "SMS con dinero sin activar".
    **Turning a source on asks "¿De qué cuenta es?" right away** when it
    has no account yet (Jose, 2026-10-08), so it lands in Tus bancos;
    "Cancelar" leaves it in "Sin cuenta todavía". **"Apps nuevas en tu
    celular"**: an app nobody hid, first seen in the last 7 days
    (`RECENT_DAYS`), is listed there, not with the hidden ones - a bank
    just installed had read as hidden. Older apps not read stay in "Apps y
    SMS ocultos". **A short code shared by several banks**: a message
    signed by a bank's name goes to that account first (`signedBy`), then
    learned card digits, then the source's one account; a shared sender
    whose banks do not sign their messages still lands on that one account,
    and is corrected in Revisar movimiento.
    **Now it can be answered "Varias cuentas"** (Jose, 2026-10-08): the
    SMS sender's account picker offers it first (`SEVERAL_ACCOUNTS`, 0,
    stored where an account id would be); its messages then take only what
    they say themselves - learned card digits, the bank's signature, a mold
    - and are otherwise asked, never sent to what the sender meant before.
    Listed in Tus bancos as "Varias cuentas · {sender}".
    **Two banks telling one transfer are one transfer** (Jose, 2026-10-08:
    Nequi "enviaste 10.000" and Global66 "recibiste 10.000" were proposed as
    a spending and as "already registered" against an earlier move between
    Global66's own products). `markTransfers` pairs a message with any
    message still waiting from another bank (`pairs_with`, within a day,
    across batches and passes, `pairWaitingMessages` on each inbox pass);
    once paired, each half is "already registered" only as a transfer
    between those two accounts (`transferTwin`), never as another movement
    of the same amount. Tapping either half opens the one form as that
    transfer and saving answers both (`EntryRequest.proposal.pairId`);
    "Guardar los listos" writes it as the transfer (`accept` finds the other
    half in another batch). **Why "Movimiento detectado" did or did not
    ring is recorded** (`MovementAlert.note`, `alertLog`, no words kept):
    each message on a source's page says "sonó" or why not (same amount
    already rang for another source, Android has the notices or their
    channel off, no amount, no text...). Not verified on the phone: why
    nothing rang for Nequi and Global66 - the next try will say. Also: the
    same source repeating an amount within 20 minutes now rings (a source
    never reports one movement twice), and an app's notice with its words
    only in the title is read from the title.
    **And from Jose's next look (2026-10-08)**: the two banks' halves are
    ONE row in Por revisar - the money leaving, shown as "Transferencia a
    {cuenta}: los dos bancos avisaron", the arriving half riding with it;
    throwing either away or "No ver más" takes both (`withMessagePartners`),
    and going back to Gasto/Ingreso from it unpairs them (`unpair`). They
    pair only when the two messages arrived within two hours
    (`PAIR_WINDOW`, `transferPairs`' `fits`). **A move between products of
    one account is a message's twin only when the message speaks of it**: a
    word of four letters or more of the move's note in the message
    (`ledgerFor`, `INTERNAL_MOVE`) - "Recibiste 10.000 de JOSE AUGUSTO" is
    not "Retiro bóveda principal"; "Retiraste 10.000 de tu bóveda" is. One
    bank telling one movement by SMS and by its app stays the merge of
    `readNotices` (different sources, 20 minutes, something besides the
    amount agreeing).
    Tapping a source opens its page: its account and its last messages, each
    with what became of it (por revisar, guardado, descartado, el mismo
    movimiento que otro aviso, or ignored and why - `noticeOutcomes`). The
    "Avisos guardados" face (every message raw) is gone, at Jose's word.
  Checked in a browser with invented sources and messages; nothing of the
  Android side can be seen outside the phone.
  **From the phone's first try (Jose, 2026-10-08)**, a 10,000 Bold transfer
  by SMS: no "Movimiento detectado" rang, and Por revisar showed it under
  Rappi cuenta as "already registered". Three causes, all read from the
  code: (1) Android 13+ drops an app's notices unless it was allowed to
  post them, and nothing asked - now "Permitir leer los SMS" and switching
  a source on ask for it, and the screen says so in amber while it is off
  ("Permitir avisos", opening the app's notification settings once Android
  stops asking, `openAlertSettings`); (2) a message took a 10,000 transfer
  typed four days before as its twin, and that one's account - a message
  now matches the ledger within one day only (`MESSAGE_DAYS_APART`,
  statements keep four); (3) 899979 carries several banks, so a message
  signed by a bank ("BoldCF: ...", the first word with letters starting
  with exactly one account's own word of 4+ letters) goes to that account
  ahead of what the short code meant before (`signedBy`). Also: the batch
  card no longer says "0 movimientos por confirmar" with nothing left, and
  a message's unsure sign no longer speaks of a statement. Not yet seen on
  the phone; Xiaomi may still hold back a receiver for an app without
  "Inicio automático".
  **"Sonó" in the log and nothing seen (Jose, 2026-10-08)**: the notice was
  posted on a default-importance channel, which Android - and Xiaomi's
  HyperOS above all - files among the silent ones: no floating banner, no
  lock screen, and opening the app clears it. Now a new channel
  `movements_alert` at IMPORTANCE_HIGH, private on the lock screen,
  `PRIORITY_HIGH`, the old `movements` channel deleted (a channel's
  importance cannot be raised once made). The log says "publicado", not
  "sonó". On Xiaomi the person may still have to turn on "Notificaciones
  flotantes" and "Pantalla de bloqueo" for Finance. Not yet seen on the phone.
  **And still only on opening the app (Jose, 2026-10-08, Global66 to
  Nequi)**: the notice appeared the moment he tapped Finance's icon, never
  before. Read as: Xiaomi freezes the app in the background, and Android
  hands a frozen app's notification listener its notices only when it
  wakes - so `onNotificationPosted` itself runs late (assumed, not proved;
  an SMS wakes the app by its own broadcast). Now each log entry carries
  `heard` (when the app was handed it); a message heard over 30 s after it
  arrived says so on its source's page ("le llegó a Finance X tarde"), and
  while that happened in the last day, or Android limits the app's battery
  (`isIgnoringBatteryOptimizations`), the notifications screen asks for
  "Sin restricciones" with "Abrir ajustes de Finance" - never "Inicio
  automático": Jose's phone has no such setting (2026-10-08, said twice) (`openAppSettings`, the app's page in Android's settings).
  **And then nothing at all for half an hour (Jose, 2026-10-08)**: the
  screen's "Última notificación que recibió la app" stayed at 4:02 while
  Nequi and Global66 posted at 4:27 - Android was handing the listener
  nothing (unbound or frozen; not proved which). The app cannot stop that,
  but it no longer loses what was missed: `NotificationCatcher.catchUp`
  reads the ticked apps' notices still in the status bar when Android binds
  the listener and every time the app reads what was caught (`caught`),
  `keep` dropping what was already kept; one under two hours old still
  rings. Apps' own notices only - SMS have their receiver and the inbox.
  **The real cause, read from his screen (Jose, 2026-10-08)**: "Última
  notificación que recibió la app" stuck at 4:01-4:02, the time of his last
  test before installing the updates; no battery saver, nothing restricted.
  After an app UPDATE Android may leave the notification listener unbound
  until its access is switched off and on (assumed from the timing; #54 saw
  it too). The screen now says so in amber when the app was updated after
  the listener last connected and heard anything (`updatedAt` =
  `PackageInfo.lastUpdateTime` in `isEnabled`, `ui.notifications.sinceUpdate`),
  with "Abrir el permiso". Every Store bundle may need that one toggle.
  **That was not it**: Jose toggled the access many times, no battery
  saver, and the clock stayed at 4:02. Assumed now, not proved: something
  thrown inside the listener (from the updates of that afternoon) killed
  the process right after each notice, so even the clock's `apply()` was
  lost. Now `onNotificationPosted` and the catch-up never let anything
  through, the catch-up runs 1.5 s after connecting rather than inside it,
  an uncaught error is recorded (`noteError`: class and three frames, no
  words, written with `commit`), the clock and the connection are written
  with `commit`, VIBRATE is declared for the notice's `DEFAULT_ALL`, and
  the screen says under the clock when Android connected the listener and
  the last thing that broke in it.
  **Then the real cause, from the screen's own new lines (2026-10-08)**:
  "Android la conectó 6:06 · pero ahora mismo no está activa dentro de la
  app", and later "conectada 6:33" - the minute he opened Finance. The
  Xiaomi closes the app in the background, the listener goes with it, and
  Android does not bind it again until the app opens. Three answers:
  `NotificationCatcher.ensureBound` (disable and enable the component, then
  `requestRebind`, only when access is on and the listener is not running)
  on opening, on the notifications screen and on a ticked SMS;
  `ListenerKeeper` doing the same about every 15 minutes, after boot and
  after each update; and **"Avisarme siempre al instante"** (Jose's idea:
  offered, never imposed), a switch on Notificaciones del teléfono, off by
  default, with "¿Qué cambia?" saying every case - on, `ListenerGuard` is a
  foreground service (`specialUse`) with a silent IMPORTANCE_MIN notice
  ("Finance está atenta a tus bancos") so the phone does not close the app;
  off, a notice may come up to ~15 minutes late, or not ring if the bank's
  notification was opened first, and the movement still waits in Por
  revisar. Lukas does not meet any of this: on iPhone Apple's Shortcuts app
  listens and hands Lukas the text; on Android it reads nobody's
  notifications. Play may ask for a foreground-service declaration
  (special use) before closed testing or production. Not yet seen on the
  phone.
  **Both declarations filled and saved by Jose on 2026-10-09** (not sent
  for review: the app is still a draft, they go with the first closed or
  production release): SMS and Call log permissions ("SMS-based money
  management", instructions for review, the four declarations) and
  Foreground service permissions (Special use → Other), one video for both,
  https://www.youtube.com/watch?v=YXEn2i_Zt7o. "Sign in details" (formerly
  App access) answered "No" - nothing in the app is restricted.
  **A source never reports one movement twice, against the ledger too**: a
  movement saved from a message (`transaction_id` of an accepted
  notification proposal, last 14 days) is never the twin of a later message
  from that same source (`claimedByMessages`, `unclaimed`); another channel
  of the bank still finds it. A pair saved by "Guardar los listos" now points
  each half at its own leg, not at the transfer's id.
  **Seen working on the phone (2026-10-08)** once Finance was neither hidden
  nor locked in Xiaomi's settings: a hidden app gets no SMS broadcast.
  **Mockup `20`, approved by Jose and built the same day:**
  - The notice (`MovementAlert.java`): the app's own icon as its picture,
    the accent on its small icon and name, "💸 Gasto / 💰 Ingreso / 🔔
    Movimiento detectado · −$ 10.000" (zero cents dropped), an SMS's words
    without its short code in front, "¿Lo guardamos? Revísalo antes, no se
    guarda solo." and three actions: Revisar y guardar, **Más tarde** (the
    notice goes, the movement waits in Por revisar, `ACTION_LATER`) and
    Descartar (never proposed). Android draws a notice its own way: no
    coloured text, no button of another colour.
  - "Realizaste/Hiciste una transferencia" and "desde tu cuenta" read as
    money out, in Java and in `read-notice.ts`.
  - **Transferir in Revisar movimiento**: the one movement form opened as a
    transfer (`asTransfer`, `EntryRequest.proposal`): the message's account
    is the end the money left (or reached), with its usual product; the
    other end is the account learned for this shape of message, or else
    the one it most often sends to (receives from); the usual note. Saving
    marks the proposal saved and teaches its mold the other account
    (`Mold.otherAccountId`, `accepted(id, tx, other)`); the next message of
    that shape carries `evidence.transferTo` and opens straight as a
    transfer, and "Guardar los listos" never writes it as a spending.
    **Opened that way it is still "Revisar movimiento"** (Jose, the same
    day): the message's line on top, the eye and the bin in the header,
    each asked on the review screen (`ComposeService.proposalAsk`), and
    Gasto / Ingreso go back to the proposal's own form with what was typed
    (`typed` input).
    **The eye and the bin ask OVER the form** (Jose, 2026-10-08: the eye
    closed the form before asking, so "Cancelar" lost what was typed): the
    question is shown on top of the open form, "Cancelar" leaves it as it
    was, and only "yes" closes it (`closeAnswered`). Checked: no other
    screen closed a form before its question.
  - The eye beside the bin in Revisar movimiento: "¿No ver más este
    movimiento?", asked first (`forgetOne`, the same `forgetThese`).
  - "Movimientos por revisar" on top of Notificaciones del teléfono, with
    how many wait and the tab bar's dot.

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
by 815 tests (2026-10-15) that run against a real
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

**Nothing the backups leave behind grows without end** (Jose, 2026-10-08:
2.04 GB of "caché" on his phone, and the Drive copy taking his own phone for
another one after a change of network).
- **On the phone**: every file handed out (backup, CSV, spreadsheet) was
  written to the cache under a dated name and never removed - verified in
  `save-file.ts`; assumed to be the 2 GB. Now they go into one folder
  (`shared-files`) emptied before each new one, and `clearOldFiles` removes
  what older versions left at the cache's top, also a few seconds after the
  app opens. Only `.json`/`.csv`/`.xlsx` the app wrote; the database lives in
  the app's data, not its cache.
- **"Another phone" was an upload whose answer was lost** (read from the
  code): Drive kept the new copy, the device never learned its
  `modifiedTime`, and the next save took it for another device's. Each
  upload now carries `appProperties.writer`, a random id kept on the device
  (`finance.cloud.writer`); a copy with this device's id is never "another
  phone". Restoring from a file forgets the id, so the old guard still holds
  there.
- **In Drive**: the backup is one file replaced on each save, but Drive keeps
  a version of every upload (up to 100, 30 days), each a whole backup. After
  each upload the versions past the newest three are deleted
  (`pruneRevisions`), and copies set aside on "replace another phone's"
  are kept to the newest three (`pruneSetAside`). Tests:
  `drive-prune.test.mjs`. Not seen against a real Drive yet.

**An `app-confirm` is never created already open** (2026-09-24, and it cost
two rounds of "it does not appear"). It is an `ion-modal`, and an ion-modal
presents when `isOpen` goes from false to true; one built inside an `@if`
with `[open]="true"` has nothing to transition from, flashes and dismisses.
Leave the dialog in the page and bind `[open]` to the signal, the way the
review screen always did. `tools/db/confirm-dialogs.test.mjs` fails on the
other shape, because this failure looks exactly like a button that does
nothing.

**A row pointing at a row of its own table goes in empty and is filled
after** (2026-10-20). Jose's backup of that day would not restore in the
browser: "FOREIGN KEY constraint failed" on `movement_proposals`. Two bank
messages telling one transfer point at each other (`pairs_with`), in
different INSERT statements, and `PRAGMA foreign_keys = OFF` did not take
there - so no order could put both first. `SELF_REFERENCES` in
`restore-backup.ts` (categories' parent, products' maturity, proposals'
pair) now inserts that column as NULL and sets it once every row is in;
`restore.test.mjs` reproduces it with foreign keys left on. Not proved
whether the phone met the same failure. A failed restore now says so in the
app's language, with the technical detail after it (`restore.failed*`,
`RestoreError.kind`).

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
became 25. **An account's page works out that account alone** (Jose, 2026-10-09: every
new day, opening one account from the piggy bank or Cuentas worked out all of
them first). Each account's mark carries the day and the tax parameters
(`accrualMarks`), so `markAccrued(today, { only })` can mark one account up
to date while the rest still wait; the page sets `othersWaiting`, and going
back to the list (`backToList`) works the rest out; switching to another
account from the sheet's title works that one out (`bringUp`). A change saved
on one account (`onlyIfKnown`) marks only accounts already worked out for
today. Tests: `accrual-mark.test.mjs`.
Not done, on purpose: accruing in the background on app start.
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

### The assistant: register and ask by text or voice, with no AI (BUILT 2026-10-19)

Asked for by Jose on 2026-10-19 after Lukas's chat ("¿Puedo gastar $ 210.000
hoy sin afectar mi presupuesto?", answered with a "Viabilidad de tu gasto de
hoy" card: te alcanza pero se come N días, saldo del periodo, pagos
pendientes, reservado para tus límites, libre para gastar). **No real AI**:
costs per use are what he wants to avoid at all costs. Mockups `39a`-`39h`
(our style, nothing copied). **Payments stay last**: Jose wants every value
proposal built first, while Google approves the release and the 14-day test
with testers runs; the paywall is finished after them.

- **How**: a reader of phrases by rules, on the phone, offline: the intent
  (register a spending / income / transfer, or a question: "¿me alcanza
  para X?", "¿cuánto llevo en X?", "¿cuánto puedo gastar al día?", a cap, a
  goal, a card's payment) and its pieces (amount - `moneyIn` reads figures
  already, words like "45 mil", "dos millones", "luca" are new -, account,
  category, day, period). **Every figure in an answer comes from the engines
  already there** (limits, goals, the report's sections, the card's
  statement): never computed a second way (rule 20).
- **It learns, nothing is burned in** (Jose: "no quemar cada frase"): what
  it does not know it asks once with chips, and keeps the answer, as the
  merchant dictionary and the molds do - a word to a category ("guayos" ->
  Deporte, `39e`), a shape of sentence to an intent ("200 mil en mercado" =
  register, `39f`), an account for a word ("la Rappi"). Kept in the
  database, so it travels in the backup. A test file of phrases and what
  each must give, like `read-notice.test.mjs`.
- **Registering is a summary to confirm** (`39c`): Guardar writes it when
  everything is known (still a tap: never saved alone, rule 22), Revisar
  opens the one movement form filled in; a missing piece is asked with chips.
- **"¿Me alcanza?" is a question, not a movement** (`39d`): the verdict (te
  alcanza / te alcanza pero pasas un tope / no te alcanza), the category's
  cap with and without it, and "Libre para gastar" = what the accounts hold
  less payments coming (card statements, loan installments) and what goals
  still need this month - a definition still to settle with Jose (idea 1,
  "Seguro para gastar"); a per-day figure to the month's end.
- **Decided with Jose the same day** (`39i`-`39l`):
  - **"Libre para gastar"** = what the accounts counted in net worth hold
    (ledger balances), **less CDTs** and anything set aside from net worth,
    less payments coming this month (card statements, loan installments),
    less what the goals still need this month. Interest a product earned and
    not yet cashed out (rule 15) is **never counted**, only said: when the
    answer is short, "tienes X en intereses sin pasar a tu saldo" per
    account, with "Pasar intereses a mi saldo" (`39k`); when nothing is
    waiting, nothing is said.
  - **No category is needed** (`39i`): "¿me puedo gastar 2 millones en
    algo?" answers on the whole picture, says no cap was checked, and offers
    chips to name the category.
  - **One account named** (`39j`): what that account holds and what is due
    from it soon (a loan installment, a card it pays), and in one line
    whether all the accounts together could.
  - **Registering on an account with products** (`39l`): the usual product,
    said quietly in the card ("Sale de Ahorros · tu producto habitual · la
    cuenta tiene 3", "Cambiar"), never a question; a product named in the
    sentence ("del bolsillo viajes") is taken - and the account it belongs
    to.
- **What stays free is always said whole** (Jose, 2026-10-19: "$ 650.000 ·
  $ 54.000 al día" did not say what it was): "Para el resto del mes · del 19
  al 31 de octubre (13 días)", then what would stay free and "Eso es, para
  gastar cada día", with "Ya descontados tus pagos que vienen y lo que falta
  para tus metas" under it. Never a bare "X · Y al día". The days count today.
- **A message wraps between its phrases, never abruptly** (Jose, 2026-10-19:
  "Tu producto habitual · la cuenta tiene" with the "3" alone below). Two
  ideas are two lines ("Es tu producto habitual" / "Banco Índigo tiene 3
  productos"), never joined by "·" to wrap anywhere; a figure stays with its
  "$" and its unit ("300 mil"), a name and a date stay whole (non-breaking
  spaces), the bubbles and cards use `text-wrap: pretty` so no word is left
  alone on the last line, and a row whose value is long splits into two rows
  rather than squeezing its label.
- **Goals have no fixed instalment, and that is said** (Jose, 2026-10-19,
  mockups `39m`-`39o`). Verified in `goalStatus` (`core/goals/goals.ts`):
  a goal stores no monthly figure; a goal with a date works out
  `neededPerMonthMinor` (what it lacks over the months left), one without a
  date has only its pace (what came in a month over the last 3 months). So
  "Aporte a tus metas este mes" is an ESTIMATE per goal: with a date, that
  monthly need; without one, the person's own average (none when there is
  no history); less what already went in this month, never below 0; a goal
  reached sets nothing aside. **Proposed, for Jose's word**: what the goals'
  places already hold ("Ya guardado en tus metas") is also not free money.
  "¿Cómo calculo lo de tus metas?" opens each goal's figure and how it came
  out, saying it is a suggestion, not a debt (`39n`); a goal's page without a
  date shows "Aporte sugerido", "Ya aportaste", "Te falta este mes" (`39o`).
- **The assistant's button sits at the top right of every screen** (Jose,
  2026-10-19, `39p`-`39r`): a round sparkles button, last in the title bar,
  besides the row in the "+" sheet.
- **What was built (2026-10-19, at Jose's word "dale comienza con todo")**:
  - `core/assistant/read-phrase.ts` (pure, `read-phrase.test.mjs`): the
    intent (register spending / income / transfer, "¿me alcanza?", "¿cuánto
    llevo en X?", "¿cuánto puedo gastar al día?", "¿cómo calculas lo de mis
    metas?", or `unsure` - an amount and a thing with no verb), amounts in
    every shape ("45 mil", "$45.000", "1,5 millones", "dos millones
    quinientos mil", "50 lucas", "2 palos"; a bare "250" is 250 mil and said
    back), the day (hoy, ayer, antier, a weekday, "el 15"), an account or
    product only when said as a place ("con la", "desde", "a" - so "un viaje"
    is never the pocket Viaje), the category by its name (plurals too), by
    the merchant dictionary, then by `common-words.ts`. What it cannot place
    is handed back.
  - `core/assistant/free-money.ts` (pure, `free-money.test.mjs`): "Libre para
    gastar" = counted accounts (no card, loan, CDT or set-aside product) less
    what the goals hold up to their figure (taken first from money not counted
    anyway), less the payments coming (what is left of each card's statement,
    loan installments due by the month's end and late ones), less what the
    goals would want this month (`goalThisMonth`: dated - what it lacked at the
    month's start over the months left; undated - the 3-month average; less
    what went in this month; reached - nothing). Per day rounds down to whole
    hundreds. `afford` gives yes / yes but a cap / no and by how much.
  - `AssistantService` reads it all from the app (balances, `loadCards`,
    `loanSchedule`, `GoalsService`, `LimitsService`, the products screen's own
    "available" interest) and saves a confirmed spending or income as the
    form does (`writeScoped` 'both' on an account with products, the note
    taught to the dictionary, yields worked out again). Learned words: a
    thing's category goes to the merchant dictionary; an account word and a
    sentence shape to `settings` `assistant.learned` - both travel in the backup.
  - `/assistant` (`features/assistant`): chat, cards and chips as `39b`-`39n`;
    "Guardar" only for a peso account whose habit is an ordinary movement,
    otherwise "Revisar y guardar" (the one form, now taking
    `start.categoryId/productId`); a transfer is always confirmed in the form.
    The floating bar hides there (`TabBarComponent.away`).
  - **The button on every screen**: `shared/ui/ask-button.component.ts`, the
    last thing in every page's title bar (Inicio beside the account, Cuentas,
    Rendimientos and an account's page, Deudas, a card, a loan, Reporte, Más,
    Presupuestos, a cap, a goal, Monedas, Categorías, Por revisar,
    Notificaciones, Importar, Google, Renta, Pro, Personaliza, Barra, Borrar
    todo). To make room, **titles in `.ui-titlebar` wrap between words**
    instead of ending in "…" (never splitting a word), and "Nueva categoría"
    and "Nuevo tope / Nueva meta" moved from the title bar to a `.ui-add` card
    on top of their lists, as a product's (38b) - a change of place Jose has
    not seen yet. Checked at 360 px: no title cut on any screen.
  - **Voice**: `SpeechPlugin.java` (RecognizerIntent, with its `<queries>` in
    the manifest): the phone listens and hands back the words; no microphone
    permission, no audio kept (privacy policy section added). In a browser,
    the Web Speech API where it exists. Java not compiled in the session: the
    Store bundle is its check.
  - Goal page (`39o`): "Este mes" - Aporte sugerido, Ya aportaste, Te falta
    este mes, and why it is no instalment (`GoalsService.atMonthStart`).
  - Tours: home `since: 5` (the button), goal `since: 2`, a new `assistant`
    tour. Checked in a browser on the sample data (every card, chips, saving,
    the cap sheet after saving, Revisar opening the form filled, light and
    dark); not on the phone. Not built yet: paid limits for it (rule 21, CHARGING
    is off anyway) and more questions (phase 3).
- **From Jose's first day with it on the phone (2026-10-19)**:
  - **Names are matched by sound too** (`soundOf`, `findName` in
    `read-phrase.ts`): dictation writes "Rappi cuenta" as "rap y cuenta" or
    "rapi cuenta", "Nequi" as "neki"; letters that sound alike are one (y/i,
    v/b, z/s, soft c/s, qu/k/c, h silent), doubled letters one, spaces none,
    and a long name allows one slip. **A transfer can be between products**:
    "transferencia", "traslado", "mover"... read as one; both ends may be
    products ("entre el bolsillo principal a la cuenta de ahorros de Rappi
    cuenta"), the account a product is in says where it is and is no end of
    its own, a product name shared by two accounts is settled by the account
    said, and with only one product said the other end is the same account
    (its usual product, else another). In a transfer the ends need no "a"/"de"
    in front. Opens the one form with both products (`route.fromProductId/
    toProductId`). Tests in `read-phrase.test.mjs` with his sentences.
  - **Read by structure, never by one person's sentences** (Jose, the same
    day: "no tienen que ser palabras mías exactas"). A transfer is any tense
    or person of the verbs people use for it and their nouns (`TRANSFER_WORD`:
    pasar, trasladar, mandar, enviar, consignar, girar, mover, meter, guardar,
    separar, sacar, retirar, transferencia, giro, retiro, transfer, move,
    sent...), words of an account's or product's name never counting as one.
    **Two of one's own places with money between them is a transfer whatever
    the verb**, and "pagué la tarjeta"/"pago de la Visa" (a card said as what
    is paid, not "con la tarjeta") is money into the card. "me pasaron", "me
    consignaron", "nos devolvieron" is income. Cash taken out with no place
    said lands in the one cash account. "a/al/hacia/para/hasta" mark where it
    lands, "de/desde/entre/con/por" where it leaves; a word inside a name is
    skipped ("bolsillo de viajes"). When the destination is still not
    understood the chat offers the likely accounts, any other, or "Fue un
    gasto" - money given to someone. `read-phrase.test.mjs` holds 35 sentences
    said the way OTHER people would, on invented accounts.
  - **The conversation is kept on the device for 3 days** (`HISTORY_DAYS`,
    `finance.assistant.history`, chips not kept), said on top, with a bin in
    the title bar to clear it. To become a preference later.
  - **A card opened in the form can be opened again**: closing the form
    without saving gives the card its button back; saving there marks it
    "Guardado" (`inForm`, read from `ComposeService.entry`/`saved`).
  - The sparkles sat off-centre (the page's scss set the badge to
    `inline-block`, undoing its grid), and the welcome's icon sat under the
    status bar (Inicio hides its header with no account): fixed.
- **Tours no longer freeze the phone or let the page scroll under them**
  (Jose, 2026-10-19). Causes read from `tour-overlay`: the lit frame animated
  `all` with a 4000px shadow (the whole screen repainted every frame); the
  scroll to a step was smooth and the step waited ~0.8 s for it; the frame
  let touches through to the page, so it scrolled away from the frame; and
  while a step's element was looked for (up to 1.5 s) an invisible layer
  blocked every tap with nothing on screen. Now the frame moves by
  `transform` with no transition, the scroll is instant and measured on the
  next frame, the frame and every layer take the touch (`touch-action:
  none`, touchmove and wheel cancelled), and nothing blocks while nothing is
  drawn. Measured in a browser: each step in ~250 ms, scroll and taps under
  it do nothing. Not yet felt on the phone.
- **It answers about the whole picture** (Jose, 2026-10-19, mockups
  `40a`-`40j`, approved after two rounds: "siempre hay que ser muy claros").
  New intents in `read-phrase.ts`, each said any way a person says it (tested
  on ~35 phrasings): `howAmI` ("¿cómo voy este mes?"), `topSpending` ("¿en qué
  gasté más?"), `debts` ("¿cuánto debo?"), `payFirst` ("¿qué deuda pago
  primero?"), `payMore` ("¿y si abono 500 mil al mes?"), `due` ("¿qué pagos
  tengo?"), `have` ("¿cuánto tengo?", "¿cuánto hay en Nequi?"), `plans` ("¿cómo
  van mis topes y metas?"); a `period` is read from the words ("este mes", "el
  mes pasado", "en agosto", "este año", "esta semana"). Answers live in
  `features/assistant/answers.ts`: a sentence and a `rich` card of plain
  pieces (heading, line, numbered step, row, note, buttons that go somewhere),
  so it is kept in the 3-day history as it is. Figures from
  `AssistantService`: `periodPicture` (every account in pesos through the
  summary's own store, `movementsFor(..., everywhere)`, `totalsOf`/`slicesOf`,
  against the same days before), `debts` (cards' statements, loans' schedules
  and `payoffToday`), `holdings` (net worth split), `leftOverPerMonth` (what
  came in less what went out, average of the 3 whole months before).
  - **Which debt first** (`core/assistant/debts-advice.ts`, pure,
    `debts-advice.test.mjs`): a card's statement still to pay first (paid
    whole, no interest); then, from the highest rate down (same rate: smaller
    first), the debts that can be finished within `REACH_MONTHS` = 24 paying
    them one after another with the money free today plus what is left over
    each month; a debt too big for that (a mortgage) is said apart with why,
    never "pay first". What paying it today saves is the schedule's interest
    left less paying it off today. "Paying more each month" walks month by
    month: each loan pays its installment, the extra goes to the first of the
    order, a finished loan's installment joins it; loans said apart keep their
    installment. Jose approved 12 months once explained with an example, then asked for more since loans run up to 3 years: 24 (2026-10-20).
  - **A card's rate** (migration 058, `accounts.card_rate_scaled` E.A. and
    `card_rate_quoted`): optional, in the card's form under the dates ("Tasa de
    interés · opcional", E.A. or Mensual, said back in the other). Without it a
    card is weighed at the month's legal maximum (`core/debts/usury.ts`, the
    months known: 2026-08 29,66 %, 2026-09 29,24 %; a later month takes the
    latest, and says which), said as a reference; asking which debt to pay
    first asks once a conversation for the rate of the card owing most
    ("2,1 % mensual" is understood, `rateSaid`) and saves it.
  - Assistant tour step `since: 2`. Checked in a browser on the sample data
    (every answer, the rate asked and saved); not on the phone.
  - **"Libre para gastar" counts everything in net worth, and says where it
    comes from** (Jose, 2026-10-20, after "Libre hasta el 31 de octubre
    $ 239.295.631" on his data read as a mistake: 220 M of it were
    Fiducuenta and Multinversión). Decided: every account counted in net
    worth, funds and investments included, "y punto" - no account is told
    apart; CDTs stay out (money not in hand until they end, when it lands in
    a product that counts or not); the emergency fund and every goal's money
    are taken off. So the figure did not change; what changed is that
    "¿Cómo voy?" shows it line by line, as the "¿me alcanza?" card does:
    Tienes hoy en tus cuentas, Ya está guardado para tus metas, Pagos que te
    faltan este mes, Sugerido para tus metas este mes, Libre para gastar,
    "Para gastar cada día, durante N días", and a note saying what is added
    and what is not (`ai.money.left`). The period's lines say "Te entró",
    "Gastaste", "Te sobró" / "Gastaste de más" (no "entró menos salió"), and
    a number keeps its "%" on its line (a non-breaking space).
- **It learns from every save, and the history is the person's to set**
  (Jose, 2026-10-22: "transferencia desde la cuenta de ahorros al bolsillo en
  la rappi cuenta" went to Plata's "Bolsillo", corrected and saved, and said
  again went there again).
  - A product word inside a longer name ("bolsillo" in "Bolsillo
    Principal") with its account said is that account's product, over
    another account's product named exactly that word (`placesIn`).
  - **Every sentence remembers where it was saved**: `Learned.phrases` in
    `assistant.learned` (settings, travels in the backup), keyed by the
    sentence without its figures and its day (`keyOf`, `Reading.phraseKey`),
    holding side, accounts, products and category (`LearnedRoute`). Learned
    on "Guardar" in the chat and on a save in the form opened from a card
    (`ComposeService.lastSaved`, set by the entry form's save). Said the same
    way again, it comes like that (`fromMemory`) and the chat says "Lo dejé
    como lo guardaste la última vez que lo dijiste así". 300 kept, newest
    last; one whose account is gone is not used.
  - **The conversation's days are chosen**: "Cambiar" opens 1, 3, 7, 15,
    30 or 60 days (`finance.assistant.historyDays`, default 3); the bin asks
    first ("¿Borrar toda la conversación?"). **It lives under the title, not
    over the chat** (Jose, 2026-10-22: at the top of the conversation it
    took a long scroll to reach): once there is a conversation the title's
    subtitle becomes an accent pill, a clock with "Se guarda N días ·
    Cambiar", always in view. The chat has the two arrows of every long
    list (`app-jump`). Checked in a browser, dark and light.
  - The register card's two buttons sit on one line (the first took the
    card's top margin).
  - **Paid, decided by recommendation (2026-10-22)**: registering by the
    assistant is always free (typing movements is); questions count, 20 free
    a month (`PLAN.assistant`, `PaywallService.askQuestion`, the count in
    settings `assistant.questions` as `{month, n}`), everything open in the
    7-day trial and with Pro. Past them the chat says so and the Pro sheet
    opens; Finance Pro lists "El asistente, sin límite". Only felt once
    `CHARGING` is true. Why 20: nothing costs per use (no AI behind it), so
    it can be generous - enough to make it a habit (about one question every
    working day), short of daily use; the market's free tiers of chat
    assistants run from about 25 to 100 messages a month (Tiny Talk 25,
    Chatty 100; Cleo's chat is inside its paid plan) - looked up 2026-10-22.
- **The assistant answers more about one's money** (Jose, 2026-10-22: "es
  agregar y agregar más contextos y preguntas", no mockups needed for these).
  New intents in `read-phrase.ts`, each tested with several wordings:
  - **Every-month spending too** (Jose, the same day: the market, the
    supermarket... cost something every month, never the same). Now in pure
    `core/assistant/recurring.ts` (`recurringOf`, `recurring.test.mjs`, all
    invented data): a category spent on in at least 80 % of the last 6 whole
    months (5 of 6, one gap allowed - frequent is not every month) counts at
    the average of the last 3 whole months (a month with nothing as zero, so
    it follows today's prices), shown with its lowest and highest month and
    this month so far; what fixed payments in that category cost is taken out
    first, never counted twice. The answer adds fixed payments and every-month
    spending into "Todo junto, en un mes normal". Superseded below: categories
    are no longer only named.
  - **Nothing is left out** (Jose, the same day: "para no quitar información
    que puede ser valiosa"). A category spent on in 4 of 6 months (often, not
    every month) is `frequent`: in a section that opens, "Otras N categorías
    que se repiten seguido", at what it comes to a month over the 6 months,
    "Cuando aparece, entre X y Y", with its own sum and never in the totals.
    Each list shows 6 and opens the rest ("Ver los otros N pagos fijos").
    Answers can carry such a section now: `RichBlock.fold` (title, blocks,
    open - kept in the history), drawn by the `richBlock` template.
  - `recurring` ("¿qué pago cada mes?", "gastos fijos", "suscripciones"):
    **fixed payments**, the same note or shop (`merchantKeyOf`) in at least
    4 of the last 6 whole months (3 of 3...) at about the same amount each
    time (within 25 %, `STEADY`), with its average, its category and whether
    it is already paid this month; their total and its share of the month's
    spending; categories spent on every month whose amount moves are named
    apart, never added (`AssistantService.recurring`). By category alone it
    read 26 "fixed" costs and 93 % of Jose's spending; by shop it finds his
    EPM, Claro, Netflix, Spotify... (10, $ 901.616, 6 %).
  - `yields` ("¿cuánto me han dado mis cuentas?", "intereses", "rentabilidad",
    one account by name, any period): what each account that earns paid,
    net of withholding, in pesos (`yieldsPicture`, `earnedBetween`), against
    the same days before, the interest still waiting to be moved into the
    balance (rule 15) and the last day worked out when it is behind.
  - `whyMore` ("¿por qué gasté más?"): against the same days of the period
    before, the categories that went up AND the ones that went down, said
    together - "casi lo mismo" under 5 % of difference.
  - One cap or one goal by its name, with or without "tope"/"meta" ("¿cuánto
    me falta para el fondo de emergencia?"): any word of 4 letters or more of
    its name (`oneCap`, `oneGoal`); asking only about goals or only about
    caps shows only those.
  - "¿Qué deuda pago primero?" also shows the snowball (the smallest first,
    `advise(..., 'balance')`) when its order differs, saying it usually costs
    a little more interest.
  - The welcome lists the two new examples. Checked in a browser on Jose's
    backup; a rich card's long row name now ends in "…" and slides instead of
    running under its figure.
- **The "+" keeps its own options in view** (Jose, 2026-10-22: the two
  lists below covered Gasto, Ingreso, Transferir and the rows under them).
  "Pagos de este mes" and "Lo que más registras" now live in a sheet of
  their own, opened from one row, "Pagos fijos y frecuentes", first in the
  "+"'s list and saying how many wait of each (`quick`, `quickLines` in
  `compose-host.component.ts`); shown only when either has something. A
  tap there closes that sheet and opens the form as before. Checked in a
  browser on Jose's backup.
- **"Pagos de este mes" in the "+"** (Jose, 2026-10-22, option 1 of three
  proposed): the fixed payments of `recurringOf` not seen yet this month,
  by the day they are usually paid ("Suele ser el día 9 · {cuenta}"), each
  with its usual amount; a tap opens the one movement form filled in - the
  account, category and day of its last payment, its average (only for a
  peso account; another currency gets its amount typed) and its name as the
  note - and nothing is saved without the person. Five shown, the rest "Ver
  los otros N en el asistente" (`/assistant?ask=`, which asks it at once).
  Read when the sheet opens, once per data change and month
  (`ComposeHostComponent.dueFixed`). Home tour's "+" step says it (`since: 7`).
  Checked in a browser.
- **Reminders** (Jose, 2026-10-22: "arranca con los recordatorios, todo lo
  que se te ocurra"). `reminders` (migration 060, travels in the backup): a
  title, an optional amount, account and category, a note, `repeat` monthly
  (a day of the month, clamped to a short month's last day) or once (a date),
  the hour and 0-7 days before to warn, an optional shop key, `done_month`
  and `snoozed_to`. Pure arithmetic in `core/reminders/reminders.ts`
  (`nextOccurrence`, `ringPlans`, `dueWithin`; `reminders.test.mjs`).
  `RemindersService` (started by the shell) rings them with the phone's
  alarms on channel `reminders`, inexact, with "Registrar", "Ya lo pagué"
  and "Mañana"; a reminder tied to a shop is settled by itself once a
  spending of that shop is on record this month. **It never writes a
  movement** (rule 22): tapping opens the one movement form filled in, and
  saving there settles the month. Screen `/reminders` (Más → Tus finanzas →
  Recordatorios): Próximos, "¿Te aviso de estos pagos fijos?" (the
  assistant's fixed payments with no reminder, "Avisarme" = monthly on its
  usual day, a day before, 8:00), Pausados, Ya cumplidos, and the editor.
  Inicio's Pendientes carries them (`app-reminders-home`, a "recordatorios"
  pill, red once late). **Their icon is an alarm clock** (`alarm-outline`,
  pink `#f2709c` on Más), never the bell of Notificaciones del teléfono
  (Jose, 2026-10-22: the two rows of Más looked the same). The assistant makes them ("recuérdame pagar el
  arriendo el 5", "avísame mañana a las 7 de la noche que llame al banco";
  `read-reminder.ts`, `read-reminder.test.mjs`; only a day said asks "¿cada
  mes o una sola vez?") and lists them ("¿qué recordatorios tengo?"); neither
  counts as a question. The sample data carries three. Checked in a browser
  on Jose's backup; the phone notification itself not seen yet.
  **From Jose's first try (2026-10-22: a one-off for that day at 9:00 never
  rang)**, read from the code - the cause on his phone is assumed, not
  proved: (1) every data change cancelled the reminders' pending alarms and
  scheduled them again, but a ringing was remembered as "told" once handed
  to the alarms, so an alarm Android held back past its minute (inexact by
  design) was cancelled and never sent again; (2) inexact alarms may come
  many minutes late; (3) with Finance's notices off nothing rang and nothing
  said so. Now: a ringing is known by its occurrence AND its time
  (`ringKey`), "told" only once it is on the phone - sent now, or scheduled
  and its time passed out of the phone's queue (`finance.reminders.scheduled`)
  -, so one held back is taken back and rung at once, and a new time rings
  again. It rings at the exact minute when Android allows it ("Alarmas y
  recordatorios", `checkExactNotificationSetting`), inexact otherwise, and
  the screen says both cases on top with a button: "Permitir avisos" (asks,
  or opens Finance's notification settings) and "Sonar a la hora exacta"
  (`changeExactNotificationSetting`); read again on coming back to the app.
  **Any hour and minute** (migration 061, `reminders.minute`): "Otra hora"
  beside the quick hours opens a time wheel, and under them "Sonará el
  {día} a las {hora}" or "Esa hora ya pasó: sonará apenas lo guardes". The
  assistant reads "a las 9:45" too. Tests in `reminders.test.mjs` and
  `read-reminder.test.mjs`; the form checked in a browser.
- **Quincena and semestre are periods** (Jose, 2026-10-22, idea 17;
  trimestre already was). `PeriodKind` gains `fortnight` (the 1st to the
  15th, the 16th to the month's last day - how pay periods run here; it steps
  by halves, never by days, so February skips none) and `half` (January-June,
  July-December), in `period.ts` and its tests. The period sheet (Inicio, the
  report, an account's movements on Rendimientos) offers Día, Semana,
  Quincena, Mes / Trimestre, Semestre, Año, Todo / Entre dos fechas on its
  own row. Everything that reads a period (the report, its comparison on the
  same days, the assistant) takes them as they are. The assistant reads
  "esta quincena", "la quincena pasada", "este trimestre", "el semestre
  pasado" and the word alone. **Fixed with it**: the assistant built the
  date a period is read from at UTC midnight while `periodContaining` reads
  local parts, so on a phone in Colombia "en agosto" was July and "esta
  semana" on a Monday was the week before; it now builds a local date
  (checked with `TZ=America/Bogota`). Checked in a browser on Jose's backup.
- **Shortcuts on the app's icon** (Jose, 2026-10-22, idea 22): a long press
  on Finance offers Nuevo gasto, Nuevo ingreso, Asistente and Por revisar.
  Dynamic shortcuts (`ShortcutsPlugin.java`, `ShortcutManagerCompat`), handed
  over by `ShortcutsService` (`core/shortcuts/`, started by the shell) on
  every opening and change of language, so their words are the app's
  (`shortcut.*`); their icons are round vector tiles in
  `res/drawable/ic_shortcut_*.xml`. A tap opens `MainActivity` with
  `finance.shortcut`, kept until the app takes it (`take`, on opening and on
  coming back) and answered once the database is ready: the movement form as
  the "+" opens it (nothing saved by itself), `/assistant` or `/review`.
  Android only; a browser or iPhone does nothing. Home tour step `since: 9`.
  Checked in a browser by calling the answer directly; the Java not compiled
  in the session (the Store bundle is its check) and not seen on the phone.
- **Every empty place says what to do next** (Jose, 2026-10-22, idea 20).
  `shared/ui/empty-state.component.ts` (`app-empty`: a round icon, a title,
  one sentence, one button, an optional second link; `compact` inside a
  section) is the one definition. Checked first on an empty app and on the
  sample data screen by screen: Cuentas, Rendimientos, Deudas, Presupuestos,
  Recordatorios and Por revisar already had theirs; what was bare now uses
  it - Inicio's chart ("Registrar un gasto") and list (now: "Registrar un
  movimiento"; a past period: "Volver al periodo de hoy"; a search: "Borrar
  la búsqueda"), the report on both faces ("Elegir otro periodo", and
  "Registrar un movimiento" / "Ver mis cuentas con intereses"; its fold
  button no longer floats over nothing), and an earning account's
  Movimientos, Pagos and Días. A new screen or section uses `app-empty`.
  Checked in a browser.
- **"Lo que más registras" in the "+"** (Jose, 2026-10-22, idea F): under
  "Pagos de este mes", up to four habits, each one tap to the one movement
  form filled in - the account and its product, the category, the note, and
  the amount only when it is steady (each of the last five within 15 % of
  their middle value); a transfer opens with both ends and their products.
  Nothing is saved by itself (rule 22). A habit is the same kind, account,
  far account, category and note (folded: case, accents, spaces) at least 3
  times in the last 90 days; most used first, at most 2 of one kind while
  another kind has habits (someone who moves money between pockets every
  day still sees the spending they repeat). Archived accounts, loans and
  their payments, refunds and the fixed payments listed above are left out.
  Pure in `core/compose/frequent.ts`, two queries in `frequent-data.ts`, read
  with "Pagos de este mes" when the sheet opens (once per data change);
  `frequent.test.mjs` (invented data). Checked in a browser on Jose's backup
  (two transfers and two spendings offered; the transfer between products
  opened on both products with its note).
- **"Puedes gastar hoy" on Inicio** (Jose, 2026-10-22, idea 1): a block
  under the balance with what is free to spend each day to the month's end
  (`app-safe-today`, `features/movements/safe-today.component.ts`), and
  under it "De $ X libres hasta el 31 de octubre, repartidos en N días"; at
  zero or below, in red, how much is missing for the month's payments and
  goals. A tap opens "Cómo se calcula lo que puedes gastar": the assistant's
  lines (Tienes hoy en tus cuentas, Ya está guardado para tus metas, Pagos
  que te faltan este mes with each payment, Sugerido para tus metas with
  each goal, Libre para gastar, per day), a note on what is and is not
  added, and "Preguntarle al asistente". The figure IS the assistant's
  (`AssistantService.picture().free`, `perDay`), never worked out a second
  way; read on every data change and new day. The same for every account
  chosen on top: it is about all the money. A block of "Personaliza tu
  vista" (`home.today`, can be hidden and dragged; an order kept from before
  takes it last). Home tour step `since: 11`. Checked in a browser on Jose's
  backup.
- **A statement from photos or screenshots** (Jose, 2026-10-22: "leer
  movimientos de imágenes... escaneadas"; rule 22's OCR door, part 1 - a
  receipt's photo is part 2). On Android, the statement pickers
  (the "+" → "Importar un extracto", now "PDF, foto o captura de pantalla"
  under it, and the account form) accept images, several at once as the
  statement's pages in the order chosen (`statementFiles`, `statementAccept`
  in `core/statements/image-text.ts`). Each image is turned upright (EXIF)
  and shrunk to 2400 px in the WebView, then read on the phone by Google's
  text recognition through Play services (`OcrPlugin.java`,
  `play-services-mlkit-text-recognition` 19.0.1, about 260 KB in the app; the
  manifest's `com.google.mlkit.vision.DEPENDENCIES = ocr` asks Play services
  to fetch the model at install). Nothing leaves the phone, nothing is paid
  per use. Its lines, boxes in pixels, become the PDF reader's pieces
  (`itemsOfPage` in `ocr-items.ts`: pieces whose middles sit within ~half a
  line's height are one row, rows laid out down a ~600-point page, a space
  inside a figure mended - "45. 900,00"; letters taken for digits are not
  guessed), and `readStatement` reads them as any PDF - its balances check
  ("Cuadra" / "No cuadra") is what catches a misread digit. The model still
  downloading says "El lector de fotos se está preparando" (`ReaderNotReady`),
  an image with no movement read says so with how to take a better photo.
  The browser and iPhone keep PDF only. Tests in `ocr-items.test.mjs` (an
  invented photographed statement, crooked, with a broken figure, reads its
  three rows and "Cuadra"); the PDF import checked unchanged in a browser.
  The recognition itself and the Java only on the phone (the Store bundle is
  the Java's first compile). Known limit: a bank app's screenshot that lists
  movements under day headings, with no date on each row, reads no rows -
  the reader needs each movement's date on its line.
- **A receipt's photo opens the spending form filled in** (Jose, 2026-10-22,
  part 2 of the OCR door; free, as typing a movement is). The "+" has "Foto
  de un recibo" on Android, which asks "Tomar la foto" (the phone's own
  camera app through `capture="environment"`, no camera permission; the
  manifest's `<queries>` names IMAGE_CAPTURE so Capacitor finds it) or
  "Elegir de la galería". The photo is read on the phone as a statement's
  is (`textOfImages`), then `readReceipt` (`core/receipts/read-receipt.ts`,
  pure, `read-receipt.test.mjs` on invented receipts): the total is the
  amount on the line that says "TOTAL A PAGAR" / "VALOR TOTAL" (ranked over a
  plain "TOTAL"), or on the line under it, never a subtotal, the VAT, the
  change, the cash given or a count of items; with no such line, the largest
  amount, said to be unsure. The day is the first date anywhere on it, not in
  the future nor over two years old (else today, said). The shop is the first
  line at the top with words that is not its NIT, address, phone or legal
  text, put in words if printed in capitals. `ReceiptService` then looks the
  shop up in the merchant dictionary (its category, account and note), or
  lets the ordinary words of its name suggest a starter category, and opens
  the form; a toast says what to check. Nothing is saved by itself (rule 22).
  Only on the phone; the UI checked in a browser by forcing it on.
  **A tilted photo read the wrong total** (Jose, 2026-10-22, a supermarket
  receipt: "VALOR TOTAL" gave the saving printed above it). A summary is a
  column of words beside a column of figures, and held at an angle the
  figures slide a row against their words. Now its words (subtotal,
  discounts, savings, taxes, tip, totals; never "Total items") are paired
  with its figures BY ORDER, shifted a row when one is missing, and of the
  pairings the one whose figures add up (subtotal less some, plus some, is
  the total) wins (`pairings`, `addsUp` in `read-receipt.ts`); a bare small
  figure at a line's end counts ("IVA 19% 921"). Tests on an invented
  receipt slid down, up and level.
  **Still 16.060 on 1.0.1126** (Jose, the same day, the same receipt): the
  phone's reading was not the one tested. Now every run of figures in the
  column, a row above to a row below the words, is a way to pair them, so a
  pen stroke over the words read as a stray figure no longer blocks the
  slid one; and when a misread digit stops every way adding up, the first
  way that makes sense wins (`sensible`: the total no smaller than a
  discount or a tax, no larger than the subtotal with nothing added).
  Tested on an invented receipt with all three at once; the old code read
  its misread saving. **The real cause, found the same day**: the tax
  breakdown printed under the total ("TARIFA COMPRA BASE IMPUESTO", "IVA
  19%") joined the summary as more words, so no pairing lined up. The
  summary is now one run of lines (no more than one line between two of
  its words). **Still wrong on 1.0.1128**, so the guessing stops: the
  receipt's notice carries "Copiar lo leído", which copies what the phone's
  reader handed back (its lines and boxes, `lastPages` in `image-text.ts`,
  never the image) to replay the misread exactly. **What it showed
  (1.0.1131, 2026-10-22)**: the reading itself gave 16.060 on Jose's phone
  (Chrome 155 WebView) and 132.980 on a computer from the very same boxes,
  because the phone put "DESCUENTO" and "AHORRO" on one row - which pieces
  share a row hung on one height, and the phone's came out larger. Now a
  photo is laid out at every row height from 0.5 to 1.5 times its usual one
  and the layout joining the fewest summary words or figures on a row is read
  (`readReceiptPhoto`); two adjustment words on one row count as two
  (`ADJUSTMENT`); the usual height is counted, not sorted (`middleHeight`).
  `onEveryPhone` in `read-receipt.test.mjs` grows and shrinks every box by
  -8 to +14 px and requires the same total: the old reading failed 9 of the
  23 on the real receipt, the new one none. "Copiar lo leído" also copies
  the reading and the WebView's user agent. **And the shop finds the person's own
  category** (`shop-category.ts`, `shopMatch`, tested): the shop as
  learned; the same chain at another branch (first word, or two words, in
  common with a learned shop); a category named by one of its words
  (plurals folded: "Restaurante" ↔ "Restaurantes"), and before the chain
  a category named after the shop's first word (a person's "Éxito" over
  another branch learned under "Casa"); what the person filed
  notes naming it under, twice or more; then the common words.
- **Reportar un fallo o sugerir una mejora** (Jose, 2026-10-22: "que todo
  me llegue a mi correo de jadex apps"). Más → Ayuda (last group) opens
  `app-feedback-sheet` (`shared/feedback/`, mounted once in the shell, so it
  opens over any form); `FeedbackService.open(kind, withReading)`. Un fallo
  / Una mejora / Una pregunta, the person's words, and two switches for
  what goes under them: "Datos del teléfono" (version, the WebView's user
  agent - model and Android -, language, screen size; on by default) and,
  when a photo was read since the app opened, "Lo que la app leyó de la
  última foto" (`lastPages` plus the receipt's result, no image; its hint
  warns it may carry the person's name or ID). "Ver el mensaje completo"
  shows exactly what goes. **No server**: "Abrir mi correo con el mensaje"
  copies the whole message to the clipboard first, then opens a `mailto:`
  to jadex.apps@gmail.com (`FEEDBACK_TO`) with subject "[Finance] Fallo ·
  v1.0.1133" and the body (`feedbackMail`, pure, `feedback-mail.test.mjs`);
  the person sends it from their own mail app, and the notice says where to
  paste it if no mail app opened. **The receipt's notice** stays 12 s, asks
  to check the total, the date and the category, and its button is
  "Reportar un fallo" (the sheet with the reading switched on), replacing
  "Copiar lo leído". Más tour step `since: 5`. Checked in a browser; the
  mail app opening only on the phone. Not sent automatically on purpose:
  a server would be the one thing this app refuses (rule 21).
- **The assistant searches the notes, opens movements and knows the
  person** (Jose, 2026-10-23, after Lukas's chat; mockups `41a`-`41h`, approved
  with three changes). No AI, as Inicio's search:
  - **Words nearly written are the same word** (`nearWord` in
    `core/assistant/note-search.ts`; Jose: "de odontólogo a odontología ...
    debe reconocer"): equal, a plural, the same root (five letters or more in
    common, all but the last two of the shorter: odontólog-o/-ía), one letter
    off from five letters and two from nine (typos, dictation), or one of a
    few ordinary synonyms (dentista/odontólogo, gasolina/tanqueo,
    arriendo/alquiler - never "renta", which is also the income tax). The
    words a question looks for are what is left without question words, verbs
    of paying and month names (`termsOf`); a movement's note and its category
    are searched (`matchNotes`): every word found, newest first; else those
    with most of them, offered as "¿Te referías a esto?".
  - New intents in `read-phrase.ts`: `lastTime` ("¿cuándo fue el último...?",
    "¿cuándo pagué...?", "última vez que..."), `biggest` ("mi gasto más
    grande"), `saveMore` ("¿qué puedo hacer para ahorrar más?"), `help`
    ("¿qué puedes hacer?", free); "¿cuánto me cuesta X?" is `spentIn`, and
    when X is no category by its own name (a word the dictionary only learned
    counts as none) the notes that say it are added up, by year when it spans
    several (`costOf`). Tests: `note-search.test.mjs` (invented notes).
  - Answers in `answers.ts`: `lastTime` (the last one with its note whole and
    the words that matched marked, the times before, how often - "más o menos
    cada 6 meses" - and, when the note says "próximo ... N meses", whether that
    time has come), `costOf`, `biggest` (the five biggest of the period, every
    account), `saveMore` (only the person's figures: what grew against the same
    days of the period before, small spending that repeats - a category's
    spendings of at most 2 % of the last 30 days' spending, 8 or more -, the
    fixed payments and the dearest; a disclaimer; "Crear un tope"). Data from
    `AssistantService.findInNotes`, `biggest`, `smallRepeated`.
  - **A word naming a category stands for the whole category** (Jose,
    2026-10-23: "¿cuándo pagué factura EPM?" answered 9 September while an
    EPM movement of 8 October was on record - its note had no "factura",
    and every word was required in the note). Now the category's movements
    count, and the question's other words narrow them only when fewer than
    half of that category's notes carry them ("factura" is in nearly all, so
    it says nothing; "mantenimiento" in a category Carro still narrows).
    `byCategory` in `note-search.ts`; it feeds the last time and what
    something cost alike. Test with invented bills in `note-search.test.mjs`.
  - **Every category in an answer opens its movements** (Jose, 2026-10-23:
    "¿en qué gasté más?" listed categories that led nowhere). A block may carry
    `open` (`OpenCategory`: the category and the period the answer spoke of);
    its row shows a chevron and opens Inicio on every account, that period,
    the list filtered by that category and scrolled to it (`openCategory` in
    `assistant.page.ts`, `FilterService.revealList`). On: "En qué gasté más",
    "Por qué gasté más" (up and down), the fixed payments and every-month
    spending (over the months looked at), and "Ver los movimientos" after
    "¿Cuánto llevo en X?" (it opened Inicio unfiltered). A card with such rows
    says "Toca una categoría para ver sus movimientos". Checked in a browser.
  - **An income category named is an income, and the card says what was
    saved** (Jose, 2026-10-23: "ganancia de 19,429.77 en multiversión" was
    read as a spending, and after he made it an income in the form the card
    still said "−$ 19.430"). Three causes, all fixed: a sentence shape learned
    as "register" forced the side to spending - it now takes the category's
    side, and naming an income category with no verb registers it directly
    (nothing to afford); a category sharing a word with others ("Ganancia",
    "Ganancia de inversión", "Ajuste de ganancias") is the one whose every
    word was said, the longest such name first; and a card saved through the
    form is redrawn from what was saved (`SavedChoice` now carries amount,
    day and note; `showAsSaved`), its line saying "Lo guardaste como
    ingreso/gasto/transferencia" when the side changed. A movement under an
    income category is always an income (`register`). The card's figure keeps
    its cents (`exact`). Tests in `read-phrase.test.mjs`; checked in a browser.
  - **Every movement in an answer opens** (`RichBlock.mov`, `.mrow`) in the
    ONE movement form (`compose.edit`) - Jose asked why another form; there is
    none, mockup `41c` only drew the same one.
  - **"También puedes preguntar"** over every answer's chips
    (`Message.chipsTitle`; `Answer.ask` carries questions already in words).
  - **Not understood is never a dead end**: with a word to go on, "¿Te
    referías a una de estas?" (what it cost, the last time, register it, see
    every question); the one chosen is remembered for that sentence
    (`Learned.asked`, `learnAsked`) and answered next time.
  - **Everything it does stays in view** (Jose: the reminders and the rest
    must be known): the welcome keeps every group - Registrar, Tu mes, Busca
    en tus movimientos, Tus deudas, Tus topes, metas y recordatorios - under
    **"Para ti, hoy"**, four questions made of the person's own data (the
    category that grew most, a figure to afford with today's free money, a
    fixed payment to look up, the payments due; `readForYou`). The **bulb** in
    the title bar opens all of it as a sheet at any moment of the
    conversation.
  Checked in a browser on the sample data (every new answer, the form opened
  from a row, the bulb's sheet); not on the phone.
- **What the person registers most, first in the assistant's bulb**
  (Jose, 2026-10-23, mockups `42a`-`42f`, all built). The bulb opens on "Lo
  que más registras" (5, "Ver los N" for all), and the empty chat shows them
  as cards that slide sideways; a tap opens the one movement form ready -
  accounts, products, category, usual note, the cursor in the amount - and
  nothing is saved by itself (rule 22). The same habits as the "+"
  (`frequentOf`), now read by one `HabitsService` (`core/compose/
  habits.service.ts`) and drawn by one `app-habit-row` in both places.
  New in the engine (`frequent.ts`, `frequent.test.mjs`): a spending or an
  income repeated on one account and category with a different note each
  time is a habit too (`loose`, key `loose|kind|account|category`, made only
  of rows that are no exact habit): its note is the one written most (at
  least twice) and the form offers the others as chips, "Otras notas que
  usas aquí" (`start.notes`). When the amount moves, "Los últimos valores
  que usaste" offers the last three different ones (`lastAmounts`,
  `start.amounts`). A long press (`contextmenu`) opens `app-habit-options`
  (mounted once in the shell): "Fijar arriba" (pinned first, with a star,
  even unused lately - its whole shape is kept), "Abrir el formulario",
  "No mostrarlo aquí" with "Deshacer". Pins and hidden habits live in
  `settings` `habits.choice` (`habitsOf`, `pinOf`), so they travel in the
  backup. Assistant tour step `since: 7`. Checked in a browser on the sample
  data (bulb, welcome cards, pin, a transfer between products opening with
  both products, last amounts, other notes); not on the phone.
  **The bulb's sheet, shortened** (Jose, 2026-10-23: "esas opciones están
  demasiado largas"): it is a tall sheet with its own `ion-content` and the
  two arrows (`app-jump`, its middle button opens or folds every group).
  On top, open: "Fijados por ti" (star) apart from "Lo que más registras"
  (five, no "Ver los N"); each habit is two lines - the name (one line,
  sliding when long) and "Gasto · «nota» · 18 veces" (`shortLine`). Under
  them every group of questions (`askGroups`: Para ti, hoy, Registrar, Tu
  mes, Busca en tus movimientos, Tus deudas, Tus topes, metas y
  recordatorios) is a card with its icon and one line saying what it holds
  (`ai.group.*.sub`), folded until tapped (`openGroups`); the empty chat's
  welcome shows the same groups. Checked in a browser on the sample data.
- **The movement form brings the account's yields up to today first**
  (Jose, 2026-10-24: a product's "Saldo actual" said yesterday's figure until
  "Recalcular" on Productos y rendimientos). When the form shows an account
  with products - opened by hand, from Por revisar, the assistant or a habit,
  either end of a transfer and the product sheet alike - it works out THAT
  account alone if it is stale for today (`upToToday` in
  `entry.component.ts`: `staleAccounts`, `accrueAllAndSettle(..., [id])`,
  `markAccrued({ only })`, as an account's page does), saying "Calculando los
  intereses de hoy de esta cuenta" with a spinner meanwhile, then reads the
  product's figure. Once per account while the form is open; saving waits for
  it (one transaction at a time). Checked in a browser on the sample data with
  the accrual mark removed.
- **"Ábreme los productos de {cuenta}"** (Jose, 2026-10-24): intent
  `openProducts` in `read-phrase.ts` (a verb of opening or going - abre,
  muéstrame, llévame, quiero ver, open... - then productos / rendimientos /
  bolsillos / alcancías / CDT, never with "cuánto", which stays the yields'
  question; the account needs no "de" before it, a product named is its
  account). The answer (`openProducts` in `answers.ts`) is a button, "Ir a los
  productos de {name}" (`/products?account=ID`); an account with none says so
  with "Ir a Productos y rendimientos"; no account said asks which, offering
  the accounts with products as chips. Free, like registering. A welcome
  group "Ir a una pantalla"; assistant tour step `since: 8`. Next, when Jose
  says: a category, a goal. Tests in `read-phrase.test.mjs`; checked in a
  browser on the sample data.
- **A transfer said without its amount is still a transfer** (Jose,
  2026-10-24: "Transferencia de bolsillo a cuenta de ahorros en cuenta plata"
  fell to "¿Te referías a...?"). `readPhrase` only read a transfer when an
  amount was said; now a transfer word with two of one's own places, or a
  product, is a transfer with no amount: the card says "Falta el valor", the
  chat "No dijiste cuánto. Escribe el valor en el formulario", and "Revisar y
  guardar" opens the one form with both ends and products, the amount empty.
  A spending or income with no amount still asks for it. Test in
  `read-phrase.test.mjs`; checked in a browser on the sample data.
- **A screenshot of a bank app's movement reads the movement, never the
  balance** (Jose, 2026-10-24: a screenshot of a taxi charged "-$17.060,97",
  with "$349.249,59 → $332.188,62" under it, opened the form on 349.249,59).
  Two causes in `read-receipt.ts`: a minus in front of an amount made
  `amountsIn` drop it as if it were a date's dash (a dash now only counts as a
  date's when a digit stands before it), and with no line saying "total" the
  largest figure won. Now, with no "total": the amount on a line at least 1.4
  times as tall as every other line with an amount (`prominentAmount`, read
  from the reader's boxes), else one written with a minus ("charged"), else
  the largest - and never a line with an arrow or saldo/disponible/cupo
  (`BALANCE`). The notice says which ("la cifra que se ve más grande", "con
  signo menos"; `Receipt.totalFrom`). A day with its month and no year ("24
  de oct") is this year's, or last year's when still ahead. Tests on an
  invented screenshot in `read-receipt.test.mjs`; Jose's own reading checked
  in the session only (17.060,97 and 24 Oct), never committed.
- **An invoice whose items carry a tax column reads its total, not its
  discount** (Jose, 2026-10-25: a fast-food electronic invoice opened the form
  on "Descuento 14999" while it printed "TOTAL COP 23052"). Read from his
  reading, which the session kept and never committed: the summary was taken
  from the FIRST line saying "total" - the items' heading - so every item row
  ("IVA 19 0") and its five-digit product codes (read as amounts) joined it
  and slid the figures; and the tax "INCL 19% IVA = 3681" gave no figure (four
  digits with no separator). Now the summary is read upwards from its total
  (a strong one, "TOTAL COP", else the last plain total), never past a count
  of the items ("Total Linea Detalles: 9", `COUNT` now takes lines and
  detalles) (`summaryStart`), and a summary line's bare figure at its end may
  be up to seven digits. Test on an invented invoice of that shape, every box
  height (`read-receipt.test.mjs`); the old code took 23.706 there.
- **A spending says what it does to its category's cap, as it is typed**
  (Jose, 2026-10-25, after Lukas): under the category of the movement form, a
  card with a warning icon - amber from 80 % of the cap ("Con este gasto
  llegas al 82 % de tu tope de {name}. Te quedan X"), red once it goes past
  ("te pasas ... por X. Tu tope es Y al mes", or "ya estaba pasado ... quedas
  X por encima"). Read by the cap's own arithmetic over the movement's month
  (`capWith` in `core/limits/limits.ts`, `LimitsService.capWith`), the movement
  being corrected left out, every account or the cap's one account as the cap
  says. Only a spending in pesos (a cap is in pesos; another currency's peso
  figure is known only once saved), not in several-at-once or a loan payment.
  The sheet after saving is unchanged. Entry tour step `since: 2`. Test in
  `limits.test.mjs`; checked in a browser on the sample data.
- **The shop of a receipt is named around its tax number** (Jose,
  2026-10-25: a fast-food invoice came as "Dobi", read off the "Doble aquí"
  sticker on top). `shopOf` in `read-receipt.ts`: with a NIT/RUT line, the
  name on the door just under it when the line above is the legal name (ends
  in SAS, S.A., LTDA, Inc...), else the line above with its legal form left
  out; without one, a line ending in a legal form; only then the first line
  with words. Test on an invented invoice with a sticker on top.
- **The assistant opens a category, a goal or a cap** (Jose, 2026-10-28):
  intents `openCategory` ("ábreme la categoría Mercado" - any side's
  category; a button to its movements this month on Inicio, through
  `RichButton.category`), `openGoal` and `openCap` ("llévame a la meta del
  viaje", "muéstrame el tope de restaurantes": the one named by its own
  words, `namedIn`, else the list as chips and "Ir a Presupuestos"). Free,
  like opening products. Never with "cuánto", which stays the question about
  it. Welcome examples and assistant tour step `since: 9`. Tests in
  `read-phrase.test.mjs`; checked in a browser on the sample data.
- **The statement reader keeps two-line descriptions and reads day
  headings** (Jose, 2026-10-28). `continuationsOf` in `statement.ts`: lines
  under a dated row with no date and no amount, starting right of where the
  row starts and left of its amounts, closer than three quarters of the
  usual gap between rows, no heading words - two at most, joined to the
  description; none where there are too few rows to know the gap.
  `rowsUnderDayHeadings`: a line that is only a day ("Hoy", "Ayer" - from
  `options.today` -, "Lunes, 20 de octubre", "20 oct") dates every line with
  an amount and no date of its own under it, skipping balances and totals;
  used only when it reads more rows than the dates on the rows do, so a PDF
  reads as before. "Fecha de corte 20/09/2026" is no day heading. Tests in
  `statement.test.mjs` on invented statements (the old reader failed both).
- **What Jose approved on 2026-10-28** (his answer to "what is pending"):
  - **The report shows the month's caps** ("Tus topes de gasto del mes",
    `capsOfMonth` in `sections.ts`), only for a period inside one month and
    only when there are caps: each cap with what was spent, its percent (the
    real one past 100 %; the bar stops full) and "Te pasaste por X" or "N %
    de X", red past it, yellow from 80 % or ahead of the pace, green under.
    The figures are `LimitsService.monthView` (never worked out a second
    way); with one account on view, only the caps of that one account.
    It is a block of "Personaliza tu vista" (`report.caps`) and goes into the
    spreadsheet like any ranked block. Report tour step `since: 3`. Test in
    `report.test.mjs`; checked in a browser on the sample data.
  - **"Reportar un fallo" can carry the app's last errors**
    (`core/feedback/error-log.ts`): Angular's `ErrorHandler` and the window's
    `error`/`unhandledrejection` keep the last 5 of 14 days on the device
    (`finance.errors`): kind, message and three frames, every figure of 4+
    digits as `#`, never sent by themselves. The sheet has the switch "Los
    últimos N errores de la app" (on for a fault). No crash service: Play's
    Android vitals already see native crashes; Sentry and the like were not
    added (a server of somebody else's, rule 21). Test in
    `error-log.test.mjs`.
  - **The privacy policy lists each provider** (`site/privacy.html`,
    "Servicios de otras empresas que usa la aplicación": Google Play, ML Kit,
    the phone's voice, Google sign-in and Drive, RevenueCat, datos.gov.co,
    frankfurter.dev, the Banco de la República, Netlify). Live once Netlify
    deploys `main`.
  - **Mail is dropped** (rule 22's mail half): not to be proposed again.
  - **Accruing in the background on opening: still not done**, and why: the
    one transaction depth counter of `BaseSqlDriver` (see "The yields screen
    works out only what changed") cannot tell a nested transaction from a
    concurrent one, so a save during a background pass could be rolled back
    with it. It needs a queue of transactions first. Meanwhile the movement
    form brings its own account up to date (2026-10-24) and an account's page
    its own.
  - Waiting for mockups: offering to set the opening balance from a statement
    that adds up (rule 22, "The opening balance is what absorbs the history"),
    and the home that teaches a new user (idea 19).
- **A transfer both banks told is one transfer on the phone's notice too**
  (Jose, 2026-10-28, a screenshot: "2 movimientos detectados · −$ 42.679 ·
  +$ 42.679" opened the list, and Por revisar's one row showed one bank's
  words with a learned category). `MovementAlert.transferHalves` pairs the
  waiting messages as `transferPairs` does (same amount, opposite
  directions, different sources, within two hours): one such pair alone is
  "🔁 Transferencia detectada · $ X", "Salió de {app} y llegó a {app}", and
  its tap carries the leaving message, so Por revisar opens it straight as
  the transfer (`tapped` → `asTransfer`); among others it counts once, as
  "⇄ $ X". The same amount from another source no longer silences the
  arriving half as "the same movement" when it goes the other way (`rang`
  keeps the direction). In Por revisar the pair's row is the transfer:
  "{cuenta} → {cuenta}", the swap icon and figure in blue, no category
  (`pairTitle`); "Separar" gives each half its own category back. Review
  tour step `since: 6`. The Java checked with the JDK on a copy of
  `transferHalves` with invented messages; the row in a browser on the
  sample data with a pair faked; the notice itself only on the phone.
- **Biometric or PIN lock: never** (idea 4, said twice by Jose).
- **A shop remembers its account** (Jose, 2026-10-22, migration 059:
  `merchant_categories.account_id`). Filled from the ledger by
  `learnFromLedger` (the account the shop's movements used most, the latest
  winning a tie, never over one already set) and by every save that says it
  (the form's `teach` and `answerProposal`, "Guardar los listos"), the newest
  answer winning. A message read with no account comes on its shop's account
  (`withShopAccounts` in `propose`), and opening such a proposal starts on
  it (`openInForm`). Tests in `proposals.test.mjs`.
- **A message's shape beats its source's account** (Jose, 2026-10-23: the
  Rappi app is tied to Rappi cuenta on Notificaciones, and its "Compra
  exitosa - Tu compra en {shop} por $ X" messages - card purchases - came
  on Rappi cuenta although he saved every one on the card). Read from the
  code: `accountFor` answered with the source's assigned account before
  anything learned, and the mold's own account (the one saved last time for
  that exact shape) was only used when nothing else answered, so it never
  was. Now the order is: learned card digits, the mold's account, the
  bank's signature, the source's assigned account, then the rest. And a
  title or first word that is an account's whole name run together
  ("RappiCard" for "Rappi Card", `namedWhole`) signs the message even
  where two accounts start with the same word. Only new messages change;
  proposals already waiting keep the account they came with. Tests in
  `notice-proposals.test.mjs` (invented app and accounts).
- **In Revisar movimiento the note follows the account** (Jose, 2026-10-22):
  a note carried in (the bank's words, the shop's note, what was said to the
  assistant) stays while the accounts are the ones the form opened with;
  choosing another brings that account's usual note, when it has one
  (`startEnds`, `fillUsualNote`). Checked in a browser on Jose's backup with
  a proposal copied from an accepted one: "Almuerzo ejecutivo…" became that
  category's usual note on the other account.
- **No bank named in the app's own words** (Jose, 2026-10-22: "como hace
  Ualá" in the bonus hint): the bonus and rate hints and the brokers' caveat
  say it generically; the rule is in the app-copy skill.
- **A title bar's (i) stays on its own button**: the tax simulator's download
  and its (i) are one `.excel` group, so the ask button beside them no
  longer sits on the (i).
- **Más says the installed version at its foot** (Jose, 2026-10-19: "Finance ·
  versión 1.0.1118", from `App.getInfo()`; "versión de navegador" in a browser).
- **Voice**: the phone's own dictation into the same reader (`39h`).
  Assumed, not verified: offline only with the Spanish pack downloaded; on
  many phones the audio goes through Google - to say in the privacy policy.
- **Reached from the "+"** ("Asistente", `39a`). Paid, with some free
  questions a month; registering by chat should not be blocked, since
  typing movements is free (rule 21) - Jose's to decide.
- Suggested phases: (1) registering by text and voice + five or six
  questions; (2) "¿me alcanza?" and "cuánto puedo gastar"; (3) more
  questions and learning from corrections.

### A stock market module (Jose, 2026-10-22: noted to analyse, nothing built, nothing decided)

The next big piece of value after the release, with iOS (above). Written
down as Jose asked, everything he named, so it can be analysed against what
data can really be had. **Nothing starts without his word**, and the open
questions at the end come first.

**What he wants**:
- **Holdings from the broker's statements**: import them, and take each
  buy and sell of each ticker - stock, ETF... - with its original price,
  quantity, date, fees and currency.
- **Market value every day** of what is held, and the gain against what was
  paid.
- **Every financial figure of a company**: P/E, PEG, ROIC, ROE, margins,
  debt, cash flow, growth, dividend yield... "todos todos los valores que
  construyan una info financiera bien completa".
- **Qualitative information**: why a stock is falling, why it is expensive,
  what the company invests in, its products, news.
- **Reports** on what is held: value today, growth, return this month, 6
  months, this year, 1 year, 5 years, since the first buy; by holding and
  all together.
- **Screeners** over the figures and the qualitative information: the most
  interesting stocks and ETFs each day.
- **Notifications** when a holding, or one of the market's most popular
  ones, rises or falls a lot.
- "Un módulo completo de bolsa de valores": anything else that fits.

**What the app has to build on** (verified in the code): investment
accounts already exist (type Inversión), and their return is a movement
under a "Ganancia o pérdida de inversión" category (rule 20). eToro and XTB
record no such movement, and their market value is the decision deferred
in "Pending from Jose" (2026-09-08: valuation and its tax treatment later,
never in the same table as interest).

**What has to be analysed first, and is NOT known yet** (nothing below was
looked up for this note; to verify one by one):
- **Broker statements**: which brokers, in which format. Many hand out CSV
  or XLSX, and rule 22 ruled CSV out because of guessing columns - to
  decide again for brokers, perhaps with one known layout per broker.
  PDFs go through the statement reader; the check that a statement adds up
  becomes: positions held = buys - sells.
- **Prices**: a free, legal source of daily closing prices for US and
  other markets, its limits per day and whether its terms allow showing the
  figures in an app sold to others. Market data is licensed; some free
  APIs forbid redistribution. Real-time is almost always paid; end of day
  may be enough.
- **Fundamentals**: which source gives the ratios for free (US filings at
  the SEC are public; ratios worked out from them would be the app's own
  arithmetic, tested like the yields), and for which markets.
- **Qualitative information**: "why it is falling" is news, and
  summarising it needs a language model - against Jose's rule of no cost
  per use and rule "do not use an LLM for figures". Options to weigh:
  headlines with their links only, a paid tier, or nothing.
- **Offline-first (rule 1)**: every figure cached with its day and said
  to be "al cierre del {día}" when there is no network.
- **Currencies**: holdings in dollars or euros valued at today's TRM for
  net worth (rule 3), each buy keeping its own day's rate (rule 4).
- **Taxes**: dividends, the sale of shares and the withholding abroad are
  taxed in Colombia, but the tax simulator stands apart and is never wired
  into this (rule at the top).
- **Paid or free** (rule 21): almost certainly Finance Pro, beyond one
  holding perhaps.
- **Risk**: an app that ranks stocks can read as advice; screeners and
  notifications must say they inform, never recommend.

**What the data can really be, looked up 2026-10-22** (Jose: "esperaba que
tú me dijeras"; he named Google Finance, Yahoo Finance, Finviz, GuruFocus,
TradingView, Morningstar, Investing Pro, the companies' own sites). Read
from search results, most of them secondhand - each to confirm on the
provider's own terms page before a line is written:
- **The sites people read are not sources an app may take from.** Yahoo
  has had no public market-data API since 2017; libraries like yfinance
  call undocumented endpoints for "personal use only", which Yahoo changes
  and blocks without notice. Morningstar's terms forbid scraping and allow
  personal, non-commercial browsing only. Finviz's, GuruFocus's,
  TradingView's and Investing's terms were not found in the search;
  assumed similar. So scraping them for an app sold to others is against
  their terms and breaks without warning - not a foundation.
- **Free APIs are for personal use.** Finnhub's free key: ~60 calls a
  minute, personal and non-commercial; a monetised app or redistribution
  needs a paid plan. Financial Modeling Prep's free key: 250 calls a day;
  showing its data to others needs a separate display licence. EODHD:
  public plans (fundamentals ~US$60/month) are not app licences;
  commercial use is a custom-priced plan.
- **What is truly free and public**: the SEC's EDGAR (every US-listed
  company's filed statements as XBRL facts, `data.sec.gov`, no key, 10
  requests a second with a contact User-Agent). Ratios (P/E needs a price;
  ROE, ROIC, margins, growth, debt do not) can be worked out from it as
  the app's own arithmetic, tested like the yields. US companies only;
  the filings' text (risk factors, management's discussion) is the
  qualitative part, the company's own words.
- **So, three shapes, Jose's to choose** (the app has no server, rule 21):
  1. **Each person's own free key**, called from their phone: their
     personal use, within the provider's terms, no cost to Jadex Labs;
     the cost is a setup step, and a free key's limits (250 a day) cover
     one person's holdings, never a market-wide screener.
  2. **A paid provider with a display licence**, which almost certainly
     means a small server caching one feed for everybody (a cost per month
     that grows with users, and the end of "no server"). The only shape in
     which daily screeners over the whole market and price alerts for
     popular stocks are honest.
  3. **Public sources only**: EDGAR fundamentals, prices typed or taken
     from the person's statements, no screener.
- **Broker statements in PDF**: possible with the statement reader, one
  layout per broker (each buy and sell: ticker, quantity, price, fees,
  date, currency), checked by "what is held = buys - sells" against the
  statement's positions; every figure editable (rule 7). Needs real
  statements of each broker, anonymised, as tests.
- **"Why it is falling"**: news is licensed too, and summarising it is a
  language model with a cost per use; the free honest version is the
  company's own filings and links to its news, never a sentence the app
  invents.
- **Price alerts**: on Android the app can look a few times an hour in the
  background (WorkManager) for the person's own holdings with their own
  key; alerts for the whole market need shape 2.
- **A fourth shape, with the person's own Google account** (proposed to
  Jose 2026-10-22, from memory, nothing verified, nothing tried - he asked
  to leave it noted and pick it up only when he says): the app creates a
  spreadsheet in the person's Drive with `=GOOGLEFINANCE("AAPL")` formulas
  and reads the values back through the Sheets API, under `drive.file`
  (only files the app made; believed non-sensitive), asked apart from the
  backup's `drive.appdata`. No sign-up, no key, no cost, no server. Limits
  as remembered: prices up to ~20 minutes late; history cannot be read
  through the API (only today's value - the app would keep its own history
  from the first day); only basic figures (price, P/E, EPS, market cap,
  52-week high and low, beta), the rest from EDGAR; no market-wide
  screener. To check before promising anything: Google's terms for this
  use, that the Sheets API works under `drive.file`, how late a value
  arrives. The proposed check is a small prototype on Jose's account (a
  sheet with three tickers, read back).
- **When Jose resumes this**, the job is to list, per feature he named,
  what data each shape really gives, what cannot be had, and which
  features would be complete or partial.

### The ideas, by what they would take

| # | Idea | Size | Touches | Status |
|---|---|---|---|---|
| D | Floating bottom bar, 4 tabs, "+" sheet | Large | Drawer decision | **Built** with the redesign, 2026-09-28 |
| 21 | Settings screen, grouped, value on each row | Medium | Drawer | **Built**: Más, 2026-09-28 |
| 20 | Empty state on every screen and section | Small, many places | - | **Built** 2026-10-22 (`app-empty`) |
| 19 | Home that teaches a new user (cards) | Medium | Rule 21 (store) | Proposed |
| 3 | Privacy mode: eye in the header hides amounts | - | - | **Rejected** by Jose, 2026-09-28 (little use) |
| 4 | Biometric or PIN lock | - | - | **Rejected** by Jose (said twice, last 2026-10-22): the phone already locks an app with its own pattern or fingerprint. Never propose it again |
| 23 | Version shown; "Eliminar mis datos" | Small | Play policy | Proposed |
| 17 | Quincena, trimestre, semestre as periods | Small (`period.ts`) | Report | **Built** 2026-10-22 (trimestre already was) |
| 5/22 | Favourites ("registros comunes"), app-icon shortcuts | Medium | iOS rule | Shortcuts **built** 2026-10-22; favourites proposed |
| 2/16 | Budgets per category: amount, period, renew | Large, new table | Rule 20 said "no budgets" | **Built** as limits, 2026-10-01 |
| 1 | "Seguro para gastar" today, showing its working | Medium, needs 2 | - | **Built** 2026-10-22 ("Puedes gastar hoy" on Inicio) |
| 7 | Month-end projection, as a report section | Small | Rule 20 | **Built** as "Tu saldo a futuro" (90 days), 2026-09-28 |
| 15 | Savings goal as a target on a product or account | Medium | Rule 15 "five things" | Proposed and drawn (`11l`, `11n`), "Debts and plans" |
| 6/12 | Local reminders (no server): rent, statements, review | Medium | Rule 22 (no invented movements) | **Built** 2026-10-22 (Recordatorios) |
| 18 | Visible locks on paid features | Small, after the paywall | Rule 21 | Proposed |
| 13 | Privacy policy listing each provider | Small, text | Store listing | **Built** 2026-10-28 |
| 11 | Crash reports: Play vitals first, Sentry opt-in only | Small | Privacy | **Built** 2026-10-28 as the last errors in "Reportar un fallo"; no Sentry |
| 8/9 | Voice dictation / receipt photo into the review screen | Large | Rule 22 | Proposed, later |
| F | Frequent movements in the "+" sheet, one tap each | Medium | Rule 22 (never saved without the tap) | **Built** 2026-10-22 ("Lo que más registras") |
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
- [ ] Import Rappi Card's real statement again after the update with #133
      (Más → Cuentas → Nueva cuenta → Importar extracto, or the "+"): the
      password box takes typing, the account comes out a Tarjeta with its
      cupo, the interest arrives marked "Del resumen del extracto" and the
      statement says "Cuadra". Say what reads wrong.
- [ ] The ~280,000 the app showed above the statement's "Pago total" after
      the first import (2026-10-15): not explained yet - likely purchases
      after the 20 Sep cut-off. Put the card's cut-off (20) and payment (1)
      days and look at "Desde el corte", or send a backup to check.
- [ ] Send other banks' statements (Ualá, Nu, Bancolombia, Davivienda,
      Nequi...) to turn each layout into a test.
- [ ] One phone shows every screen ~6 % larger than another (2026-10-14):
      say whether its "Tamaño de pantalla" is set large; scaling the app
      down on narrow phones was proposed and not built.

## Documents

- `docs/02-technical-decisions.md` — the reasoning behind each decision
- `docs/03-roadmap.md` — order of work by phase
- `docs/04-stack-guide.md` — stack primer for someone coming from .NET/Angular
- `docs/05-data-model.md` — the SQLite schema and the reasoning behind it
- `docs/06-schema.md` — the schema drawn: ER diagram, delete rules, constraints
- `docs/07-competitor-lukas.md` — Lukas (Jotatech) compared with this app, and ideas from it
- `store/` — the Play Store listing, its icon, feature graphic and screenshots (taken from the invented sample backup)
- `docs/08-redesign-checklist.md` — everything each screen does today, to check before a redesigned screen is called done
- `docs/mockups/` — the redesign drawn, every screen (index in its README), plus proposals: `10*` (reading bank messages) and `11*` (debts and plans), `34*` (paying: Finance Pro, locks, the monthly allowance of messages), `37*` (currencies from a list with flags; the main currency), `38*` (the "+" with a new account, a product step by step), `39*` (the assistant: chat, goals' estimate, the button on every screen), `40*` (the assistant on the period, debts and payments)
