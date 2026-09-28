# Competitor study — Lukas (Jotatech)

Written 2026-09-27 at Jose's request: compare Lukas with this app, list what
we already do better, and keep its good ideas in writing. **Ideas only.
Nothing here is decided or built**, and each one needs Jose's word first.

## How this was researched, and what that limits

This was written from a cloud session. Its network policy blocked
`lukas.jotatech.org` (so the privacy policy could not be read directly),
`play.google.com` and `apps.apple.com`. Everything about Lukas below comes
from web-search excerpts of those same pages. The app was not installed or
opened, so no screen was seen.

The same day, Jose sent three screenshots from his phone of section 4 of
that privacy policy, "Proveedores con los que compartimos datos". That
section is transcribed below and marked **[policy]**.

Each fact below is marked:

- **[policy]**: Lukas's own privacy policy, section 4, read from Jose's
  screenshots.
- **[listing]**: Lukas's own Play Store or App Store text, quoted by search
  results. It is what the developer claims, not what was seen working.
- **[inferred]**: reasoned from the above, not stated there.
- **[unknown]**: looked for and not found.

To complete this study, do it locally: install Lukas, read the rest of the
privacy policy, and fill in the [unknown] rows below.

## Who makes it

- **Developer:** Jhossept Kevin Garay Rodriguez, trading as Jotatech. He is
  based in Medellín, Antioquia, Colombia. Support: `support@jotatech.org`.
  **[listing]**
- **Package:** `com.jhotech.smartspend`. The internal name was "SmartSpend",
  and "Lukas" came later. **[listing / inferred]**
- **App Store id:** 6758321769. That is a recent id, so the app is probably
  from late 2025 or 2026. **[inferred]**
- **Platforms:** Android and iOS. **Languages:** Spanish, English, French and
  Portuguese. **[listing]**
- **Store names:** "Lukas: AI Expense Tracker" and "Lukas - Control de
  gastos". **[listing]**

It is a one-person Colombian developer, the same situation as Jadex Labs, and
it is aimed at the same Latin American market. That makes it the most direct
competitor looked at so far. It was not in the 2026-09-24 market survey
(CLAUDE.md rule 21).

## What it does

### Entry: the headline feature is AI

- **Voice:** "Spent 25 on lunch and 12 on Uber" becomes two categorized
  movements. **[listing]**
- **Photo of a receipt**, read by the AI. **[listing]**
- **Pasted text:** "paste your bank statement and watch it sort itself".
  **[listing]**
- **One-tap favourites:** save a movement that repeats and log it again
  without typing the amount or picking the category. **[listing]**
- **iPhone Back Tap:** double-tap the back of the phone to open the list
  from anywhere. **[listing]**

### Everyday

- Income and expenses, **monthly budgets tracked in real time**, and
  recurring transactions "on autopilot". **[listing]**
- **Detects a rhythm and offers to schedule it.** For example, it notices
  rent and suggests making it a recurring movement. **[listing]**
- 50+ currencies. **[listing]** On its screens that is ONE currency for
  the whole app, picked in settings: no rates, no conversion, and no
  accounts at all. **[seen]**

### Insights

- **"Safe to Spend":** what is left to spend today, with a "How does it
  work?" that shows where each number comes from, using the person's own
  data. **[listing]**
- Monthly comparisons, category breakdowns and **spending projections**.
  **[listing]**
- PDF export. **[listing]**

### Privacy and security

- **Local-first**, works offline, and cloud sync is optional and
  **encrypted**. "Your data never leaves your device unless you decide
  otherwise." **[listing]**
- **Privacy mode** hides amounts "when you hand the phone over".
  **[listing]**
- **Biometric lock.** **[listing]**
- "We don't sell your information … we don't profile your behavior."
  **[listing]**

### Business model

- Free to download, **with ads on the free plan** (Google AdMob). **Pro
  removes the ads** and raises the AI quota. **[policy / listing]**
- Pro is a **subscription**, sold through the App Store and Google Play and
  managed by **RevenueCat**. **[policy]**
- Price: **[unknown]**.

## How it stores data, and who it pays

### What its privacy policy lists (section 4, verbatim in substance)

"Para operar Lukas usamos los proveedores de abajo. Cada uno recibe
únicamente lo mínimo necesario para su función, y ninguno tiene permiso
para usar tus datos con fines propios." **[policy]**

| Provider | What it is for | What it receives, per the policy |
|---|---|---|
| **Supabase** | Database and authentication | The account, the synced data and the cloud backups. **Servers in the United States.** |
| **Google and Apple** | Sign-in | Only if the person signs in with them: identity confirmed, email and name. Never the password. |
| **Google Gemini and OpenAI** | AI features | The text, audio or receipt photo sent, and the date. "Nunca tu identidad ni tu historial financiero completo." |
| **Firebase Cloud Messaging** | Push notifications | The device token, not the content of the finances. |
| **RevenueCat** | Subscriptions | Checks with Apple and Google whether Pro is active. Receives the purchase identifier. |
| **Google AdMob** | Ads, free plan only | May receive the device's advertising id if tracking was allowed. Not loaded with Pro. |
| **AppsFlyer** | Campaign attribution | Which of their ads led to an install. Technical device and install data. |
| **Sentry** | Crash reports | Technical reports when the app fails, **including the user id and email if signed in**. |
| **Resend** | Transactional email | Emails such as a purchase confirmation. Receives the email address. |
| **App Store and Google Play** | Payments | Handle the whole charge; Lukas never sees the payment method. |

### What that means

- **It has a server, and so it has accounts.** Supabase keeps each
  person's synced data and backups in the United States. So Lukas holds
  its users' financial history, even if encrypted. The listing's
  "encrypted" does not say end-to-end, and a Supabase database with
  accounts is normally readable by whoever runs it. **[inferred]**
- **Its costs grow with its users.** Supabase (free up to a size, then
  paid), Gemini and OpenAI per call (hence the AI quota), Resend, Sentry
  and AppsFlyer past their free tiers. Ads and Pro pay for that.
  **[inferred]**
- **Two AI providers.** Most likely one is the main one and the other a
  fallback, or each is used for what it does better (Gemini for audio and
  images, OpenAI for text). **[inferred]**
- **Its "the data never leaves your device unless you decide otherwise"
  holds for the ledger**, but not for crash reports, attribution or ads,
  which run anyway. **[policy / inferred]**

### Against this app

This app sends nothing to anyone of ours: there is no server. What leaves
the phone goes to the person's own Google Drive (the backup) and to the
public rate and inflation services (datos.gov.co, the ECB, the Banco de
la República), which only see a request. Nobody at Jadex Labs could read
a user's figures even if asked to. That is the strongest privacy argument
this app has, and Lukas cannot make it.

**Lukas uses RevenueCat**, which is what rule 21 recommended on
2026-09-24. A Colombian developer in the same market reached the same
choice.

## Where this app is ahead

Checked against the code and CLAUDE.md on 2026-09-27.

1. **Yields worked out to the centavo.** Products, daily accrual at
   `(1 + E.A.)^(1/365) - 1`, CDTs, spending bonuses, 7% withholding with
   the 0.055 UVT threshold per product, and results checked against what
   the banks actually paid (rules 15–18). Lukas mentions nothing like it,
   and neither does any app in the rule 21 survey.
2. **Real multi-currency, and accounts at all.** Lukas has neither: one
   currency and no accounts (seen on its screens). Each movement keeps the rate its bank applied.
   The official TRM is fetched daily, EUR is derived, net worth uses
   today's rate, and several currencies can sit in one account (rules 3, 4
   and 9).
3. **Credit cards modelled properly.** Debt as a liability, and limit
   history kept apart from the ledger (rules 4 and 11).
4. **The income-tax simulator** (form 210, exported to .xlsx with live
   formulas).
5. **Bank statement import that checks itself.** Opening balance plus the
   movements read must equal the closing balance, or nothing is imported
   (rule 22). Lukas's "paste your statement" relies on an AI, and the
   listing claims no check. A misread digit would go in silently.
6. **No per-user cost.** Everything, including categorizing statements,
   runs on the phone for free. The pdf.js reader, a dictionary learned
   from the person's own movements, and common words cover what Lukas uses
   a paid AI for. That leaves our price room to be lower, and it means
   there is no "quota" to explain.
7. **Money as integers**, and every figure in the financial report is
   checked by independent audits (`audit-money-report.mjs`,
   `audit-yields-report.mjs`).
8. **Bank notifications as a source** (step one built). Lukas does not list
   this.
9. **No account, no server, no ads, no trackers.** Checked in
   `package.json` on 2026-09-27: no analytics, crash reporting, ads,
   attribution or push SDK. Lukas lists ten providers. Our Play Data
   safety form and privacy policy can be almost empty, and a person can
   use the app without handing an email to anybody.

## Where Lukas is ahead: ideas worth considering

Ordered by value for the effort, in my opinion. Each one says how it would
fit this app's rules.

### 1. "Safe to Spend": how much is left for today

The idea: one figure on the summary screen, meaning "you can spend X today
and stay on plan", with a "¿Cómo se calcula?" that shows the arithmetic.
This is the most copyable idea, and it fits what the app is for ("control
of your finances … and deciding from that").

**What it needs first:** a plan to spend against. We have no budgets
(rule 20: "there is no such table"). A version with no budget is possible:
(income expected this month − spent so far − recurring still to come) ÷
days left. The report already finds "what comes back every month".
**Rule to keep:** it must show its working, the way every figure here
does. Lukas's "how does it work?" is the same instinct as ours.

### 2. Monthly budgets per category

This is the most common feature in the category, and people expect it.
Rule 20 says to treat it as a project of its own. It is also what would
make idea 1 accurate. The design questions are a new table
(`budgets`: category, month, amount in minor units), what happens to money
left over (roll over or not), and how it shows in the donut. It is a
candidate for the paid tier (rule 21).

### 3. Privacy mode (hide the amounts)

One switch, perhaps a tap on the eye beside the balance, that replaces
every amount with `••••`. It is cheap: `formatMoney` is one place. It is
useful for handing someone the phone, and it makes it safer to take the
app's screenshots.

### 4. Biometric or PIN lock

A finance app with a person's whole history in it should be able to lock
itself. There are Capacitor plugins that support both Android and iOS,
which matters because the app must not assume Android (the iOS section of
CLAUDE.md). It would be free, not paid: it protects the person's own data
(rule 21).

### 5. Favourites: one tap for a repeated movement

We already write the usual note automatically (`core/notes/usual-note.ts`)
and order categories by use. The step further is a row of "the movements
you enter most" (same account, category, amount and note) above the Gasto
and Ingreso buttons. One tap opens the form already filled, and nothing is
saved without the tap on Guardar. It uses data we already read.

### 6. Offer a recurring movement as a proposal, never on its own

Lukas notices the rent and offers to schedule it. **Careful**: Jose
rejected inventing movements before they happen (rule 22, 2026-09-23).
The version that fits: when the rent's usual day arrives, a reminder
("¿Ya pagaste el arriendo?") that opens the form filled in. It is a
reminder, not a movement. It only becomes real once the person saves it.

### 7. Projection to the end of the month

"At this pace you will spend X this month." The report already refuses to
compare a part-finished month against a whole one, and allows "a
projection that says it is one" (rule 20). This fits that rule exactly,
as one more section.

### 8. Entering by voice or text, as an alternative

"Almuerzo 25 mil y Uber 12 mil" becomes two proposals on the review
screen. Most of the reading can be done **without an AI and without
cost**: Android's own speech-to-text on the phone, then the same
amount-and-merchant reading the statements and notifications use, then
the learned dictionary for the category. It goes to the review screen we
already have, so nothing is written without a person's answer. An AI only
if that proves not enough. Per CLAUDE.md, an LLM "fits for
auto-classifying categories or reading a bank statement". It would bring
a per-use cost, and with it a quota and a server.

### 9. Receipt photo

This is the OCR of rule 22 ("a door into the same feature"), already
planned last. A receipt is not a statement, though: it has no balance to
check against. An amount misread from a photo would go unnoticed unless
the person checks it on the review screen, which is required anyway.

### 10. Smaller ones

- **Four languages.** We have Spanish and English. Portuguese is the next
  market (Brazil is where Mobills comes from), and the i18n is already
  keys, not text.
- **PDF export** of the report, beside the .xlsx.
- **Quick access**: an Android home-screen widget or a quick-settings tile
  to add a movement. That is Android-specific, so it goes beside, never
  instead of, the in-app flow.

## Ideas from its list of providers

The list above is also a list of things a finished app ends up needing.
Some of them fit this app without breaking its rules; others show what
not to do.

### 11. Crash reports, and the only one worth considering

This app learns about a failure only when Jose meets it on his phone.
Once other people use it, a crash on their phone reaches nobody. Sentry
has an official Capacitor SDK and a free tier.

**How it would fit our rules:**
- **Off by default, and asked once:** "¿Enviar informes de error
  anónimos?" A finance app that sends things without asking loses what
  item 9 above gains.
- **Never a figure, a name or a note.** Sentry sends the error message
  and a trail of the screens visited, and an error message can carry an
  amount or an account name. Its `beforeSend` hook has to strip anything
  that is not the error type and the line of code. No user id and no
  email: Lukas sends the email of a signed-in user, and we should not.
- It is a server of someone else's that receives data. The privacy
  policy and the Data safety form must name it.

**Cheaper alternative, and probably the first step:** Play Console
already shows Android crashes and ANRs ("Android vitals") for installs
from the store, with no SDK and nothing to declare. It only sees native
crashes, not an error inside the web app. Try it first; add Sentry only
if it does not show what is failing.

### 12. Reminders without a server

Lukas uses Firebase Cloud Messaging, a server sending pushes. Everything
this app might remind someone of is already on the phone: "you have 12
proposals to review", "your Nu statement usually arrives about now", the
rent reminder of idea 6. `@capacitor/local-notifications` schedules
those on the phone itself, with no server, no token and nothing to
declare. It supports iOS as well.

### 13. The privacy policy, laid out the way Lukas's is

Its section 4 is good: one entry per provider, what it is for, exactly
what it receives, and a link to that provider's own policy. Ours is still
to be written (see "Still to redo before publishing" in CLAUDE.md), and
it would be short in the same shape:

- **Google:** sign-in and Drive, only if the person turns on the backup.
  The backup goes into their own Drive, and Jadex Labs cannot read it.
- **Google Play:** payments, once they exist.
- **RevenueCat:** if chosen (rule 21), an anonymous id and the purchase.
- **datos.gov.co, the ECB and the Banco de la República:** the app asks
  them for the day's rates and the IPC. They receive the request, nothing
  of the person's.

Saying "nobody else" in a list that short is itself the argument.

### 14. "Hecho en Medellín"

Lukas's site carries a small badge with the flag. It is cheap, it is
true for us too (Colombia), and in a market of foreign apps it says
"made for how things work here": TRM, UVT, form 210, CDTs.

### What NOT to copy

- **Ads (AdMob).** Ads in a finance app mean an advertising id and a
  tracking permission, the opposite of item 9, and it would mean
  declaring them on Play. Rule 21 chose a subscription with a generous
  free tier instead. Keep it that way.
- **Accounts and a cloud database (Supabase).** It is what makes Lukas's
  sync work across devices, and what makes it hold everybody's finances
  on a server in the US. Our Drive backup does the same job for one
  person without us holding anything. If sync between two phones ever
  becomes a real need, the way to do it without a server is through the
  person's own Drive, the way the backup already works.
- **Attribution (AppsFlyer)** only matters when paying for ad campaigns.
  Play Console already shows where installs come from.
- **Transactional email (Resend)** needs accounts. Google Play already
  emails the purchase receipt.

## What its screens show (Jose's screenshots, 2026-09-27)

Fourteen screenshots of Lukas v0.17.9, from a fresh install as a guest,
dark theme. Everything in this section is **seen**, not claimed.

### The shell: four tabs and a floating bar

- **A floating bottom bar with four icons and no labels**: Inicio,
  Planes (a wallet), Estadísticas, Configuración. It floats above the
  system's own buttons with a margin all round, and the active tab sits
  in a darker pill with the icon in the accent colour.
- **One round "+" button** (teal, bottom right), above the bar.
- **The same header on every tab**: the app icon, the name, and under it
  the month with ‹ › to step through months. On the right, an **eye**
  (privacy mode) and the **profile** (with a green dot while a guest).
  The statistics tab adds a document icon (export) and a grid icon.
- **Settings is a tab**, not something hidden in a drawer.

### Home, empty

- "¡Hola!" and one line about what the app does.
- A big card, **"EMPIEZA AQUÍ – Escribe o pega varios a la vez"**, that
  *shows* the feature instead of explaining it: a chat bubble "TÚ:
  Almuerzo 25 mil + Uber 12k" and, under it, the two movements it becomes
  with their category icons and amounts.
- Then one card per way in: "Dicta tus movimientos", "Toma foto del
  recibo", "Agrega tu saldo inicial". Each card: a round tinted icon,
  a title, one grey line, and a chevron.
- At the very bottom, small: **"Prefiero registrarlo manualmente"**.

### The "+" sheet

A bottom sheet with a grab handle: a highlighted wide card **"Asistente
Inteligente – Dicta, toma una foto o escribe"**, then two square cards
side by side, **Gasto / Manual** (red arrow down) and **Ingreso /
Manual** (green arrow up), and a row "Agregar saldo inicial".

### Planes

- Empty state: a big "+" in a circle, **"No tienes ningún plan"**, one
  line ("Crea límites de gasto o metas de ahorro para organizar tu
  dinero"), and one text button, "CREAR MI PRIMER PLAN".
- It opens a sheet: **"Controlar un gasto – Tope máximo para una
  categoría"** or **"Ahorrar para una meta – Registra aportes a un
  objetivo"**.
- **Nuevo límite**: a huge amount at the top ("$ 0"), then three rows:
  Categoría, Período (Mes, with its dates spelled out) and a
  **Recurrente** switch, "Renovar automáticamente al finalizar". A wide
  Guardar at the bottom, dimmed until the form is complete.
- **Metas de ahorro** is an explainer page, not a form: "¿Cómo
  funcionan las metas?", an example in a tinted box, a "💡 Recomendación"
  box, and two buttons, "Crear categoría de ahorro" / "Continuar sin
  crear categoría". **Their goal is a category**: putting money aside is
  recorded as an EXPENSE in a category named after the goal ("Así sale
  de tu balance pero se acumula en tu meta").

### Estadísticas

- A row of period pills: Semanal, **Quincenal 🔒**, Mensual,
  **Trimestral 🔒**, Semestral… The locked ones are Pro, and they are
  shown with the lock rather than hidden.
- A card with ‹ Septiembre de 2026 ›.
- Sections: "Gastos por categoría", "Ingresos vs Gastos", "Tendencia de
  gastos", and projections ("Agrega más transacciones para ver
  proyecciones – Necesitamos al menos 1 mes de datos").
- **Every empty chart has an empty state**: a grey outline icon of that
  chart and one sentence. Nothing is blank.
- The period card sticks under the header while scrolling.

### Configuración

- A card on top: **"SESIÓN DE INVITADO – Crea tu cuenta – Tus datos
  están seguros, pero no vinculados"**. So the app works with no account
  and asks for one later.
- An upsell card: "Lleva tus finanzas al siguiente nivel – Elimina los
  anuncios y desbloquea registros con IA ilimitados", with **"USO DE IA
  ESTE MES 33%"** as a progress bar, and "Descubre Pro".
- Grouped lists under small uppercase headings. Every row has a round
  grey icon, a title, the current value or a hint in grey, and a chevron
  (or a switch):
  - **APARIENCIA**: Idioma, Tema (Automático), Moneda (with the flag).
  - **GESTIÓN DE GASTOS**: Período de presupuesto (Mensual), Categorías
    (22), **Registros comunes** ("Movimientos repetidos de un toque"),
    Etiquetas, **Programadas** ("Transacciones automáticas"), **Acceso
    rápido** ("Registros comunes desde el icono o los ajustes"), **Seguro
    para gastar** ("Visible en inicio").
  - **DATOS Y SEGURIDAD**: Respaldo y restauración, **Autenticación
    biométrica** (a switch), Exportar datos ("CSV o reporte PDF"),
    Notificaciones ("Recordatorios y alertas").
  - **LEGAL**: Términos de servicio, Política de privacidad.
  - "Conéctate con el dev" (his Instagram), the **version** (v0.17.9),
    and **"Eliminar mis datos"** in red at the very end.
- It has 22 categories, the same number as our starter set (rule 23).
- **One currency for the whole app** (Moneda: COP), and no accounts
  anywhere on these screens. Its "50+ currencies" is a choice of ONE
  currency, not several at once. **[inferred from the screens]**

## Its design, and why it feels better

What Jose means by "professional, pleasant and fluid", broken into
things that can actually be built.

1. **Everything is two taps away, and visible.** Four tabs are always on
   screen; settings are one of them. We have ten entries in a drawer,
   and a drawer is a place you must remember to open. Lukas can do this
   partly because it has less: no accounts, no products, no tax, no
   review.
2. **One shape for every row.** A round tinted icon, a title, a grey
   second line, a chevron. Every list and every card, on every screen.
   Colour means something: red for spending and limits, green for income,
   purple for "recurring", blue for dates.
3. **One accent colour** (teal) for everything you can press, and
   nothing else is that colour.
4. **An empty screen teaches.** Every empty state has an icon, one
   sentence and one action. The home screen, empty, is a guide to the
   app.
5. **Show, don't explain.** The "EMPIEZA AQUÍ" card is a fake
   conversation showing the result. Nobody reads the paragraph; everybody
   sees the two rows.
6. **Choices come up from the bottom.** The "+" and "Crear plan" open a
   sheet with a grab handle and big cards, reachable with the thumb.
7. **The amount is the hero.** In "Nuevo límite" the figure is huge and
   everything else is small rows under it.
8. **Grouped settings under small uppercase headings**, each row saying
   its current value ("Mensual", "Automático", "Desactivada"). You know
   the state without opening anything.
9. **Locks are visible.** "Quincenal 🔒" says what Pro adds at the exact
   moment you would want it.

### How this fits what is already decided here

- **The drawer was a deliberate decision** (`app.component.html`, the
  comment on `ion-menu`): the bottom edge belongs to Android's own
  buttons, and a tab bar there means cramped targets or mis-taps. Lukas
  answers that exact objection: its bar *floats* above the system bar,
  with a margin, and it has four big targets, not ten. Moving to it
  reverses a recorded decision, so it is Jose's call.
- **Four tabs cannot hold ten screens.** A possible split, to decide:
  - **Inicio**: the summary (donut, movements) as today.
  - **Cuentas**: accounts, and from each one its products and yields.
  - **Reporte**: the money and yields report (already one screen with a
    switch).
  - **Más** (or Ajustes): categories, review, notifications, tax
    simulator, import/export, the Google account, language, theme -
    grouped the way Lukas groups its settings.
  With the "+" as the one way to create anything, opening the sheet
  Gasto / Ingreso / Transferencia / Importar extracto.
- **Our compose bar already does the "+" job** on two screens (rule on
  `.compose` in global.scss). A floating "+" would replace it or sit
  beside it; that is one decision, not two.
- **The home screen needs accounts in it**, which Lukas does not have to
  fit. Its header "month with ‹ ›" is what our summary header already
  does, plus the account picker.

### Ideas from these screens, added to the list

15. **Savings goals, done our way.** Lukas files money set aside as an
    EXPENSE in a goal category. That breaks our rule 20 ("saved is income
    minus expenses; a transfer is not a decision to save"): the money is
    still Jose's, just elsewhere. Here the natural home is a **product**
    (a bolsillo, an alcancía) or an account, with a target amount and
    maybe a date, and progress = its balance ÷ target. Careful: rule 15
    says products are "five things and no sixth"; a target is a new
    attribute of a product, not a new mechanism, but it needs Jose's
    word.
16. **Budgets exactly like its "Nuevo límite"**: category, amount,
    period, "renew every period". That is idea 2 with its form already
    designed.
17. **Quincenal as a period.** In Colombia salaries are paid on the 15th
    and the 30th. `core/filters/period.ts` has day, week, month, year,
    all and range; "quincena" (1-15, 16-end) is a small addition there,
    and would show in the summary and the report for free. Trimestral
    and semestral likewise.
18. **Visible locks** for the paid tier (rule 21): a period pill or a
    report section with a small lock, which opens the paywall. That is
    how the "one service answers" of rule 21 should look on screen.
19. **Home that teaches when empty.** For a new user, the summary shows
    cards: "Crea tu primera cuenta", "Importa un extracto en PDF",
    "Registra tu primer gasto", "Activa la copia en Drive". Jose, with
    data, never sees them. It matters for the store (rule 21).
20. **Empty states everywhere**: an icon, one sentence, one action. Worth
    a pass over every screen and report section.
21. **A settings screen** in Lukas's shape, with the current value on
    every row. Today language and theme live at the bottom of the drawer.
22. **"Registros comunes" and "Acceso rápido"**: our idea 5 (favourites),
    plus Android **app shortcuts**: long press on the app icon offers
    "Nuevo gasto", "Nuevo ingreso" or a favourite. Capacitor supports
    them with a plugin, and iOS has the same thing (Quick Actions), so it
    does not break the "no Android-only" rule if both are done.
23. **Version on the settings screen**, and **"Eliminar mis datos"**.
    Google Play asks apps to let people delete their data. With no
    account and no server, ours means: wipe the database on the phone,
    and optionally the backup in their Drive, with a strong confirmation.
24. **A contact link** ("Conéctate con el dev"): for Jadex Labs, an email
    or a store link to leave a review.

**Not taken: tags** ("Etiquetas"). Jose, 2026-09-27: not needed. The
note on a movement and the search already give context, and tags would
add a table and one more picker to every form.

**Not taken: the guest session / create account.** We have no accounts;
the Google sign-in is only for Drive, and that is enough.

## What this says about pricing (rule 21)

Lukas sells "no ads and more AI", because those are what cost it money,
or what it earns from. We cannot
sell the same thing, and we don't need to: what we sell (yields,
multi-currency, statements, the tax simulator) costs nothing per user.
The cost of that is that we cannot say "AI" in the store listing, which
sells well right now. If voice entry arrives as in idea 8, without an
LLM, it can be called "dictation" honestly.

## Open items, to fill in from a local session

- [x] Backend, subprocessors, AI provider (section 4 of the policy, from
      Jose's screenshots, 2026-09-27).
- [ ] The rest of the policy: whether sync is end-to-end encrypted,
      whether audio and photos are kept or used to train models, how long
      data is kept after an account is deleted.
- [ ] Price of Pro, monthly and yearly.
- [x] Screens of the shell, home, plans, statistics and settings
      (2026-09-27).
- [ ] Screens with data in them: Safe to Spend, a budget half spent, a
      goal, a chart. Rating and number of downloads.
- [x] Multi-currency: one currency for the whole app, chosen in settings.
