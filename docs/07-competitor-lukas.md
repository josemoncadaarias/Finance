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

Each fact below is marked:

- **[listing]**: Lukas's own Play Store or App Store text, quoted by search
  results. It is what the developer claims, not what was seen working.
- **[inferred]**: reasoned from the listing, not stated there.
- **[unknown]**: looked for and not found.

To complete this study, do it locally: install Lukas, read
`https://lukas.jotatech.org/es/privacy-policy` in full, and fill in the
[unknown] rows below.

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
- 50+ currencies. **[listing]** Whether it handles exchange rates, or
  per-transaction rates as we do, is **[unknown]**. The listing mentions
  "travelers", which suggests the currency is a label rather than a
  conversion.

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

- Free to download. **Pro raises the AI quota** and unlocks extras. No
  subscription is needed to start. **[listing]**
- Prices, and whether Pro is a subscription or a one-time payment:
  **[unknown]**.

## How it stores data, and what it probably pays for

What the listing says: the data lives on the phone, and cloud sync is an
option the person turns on. Which service is behind that sync is
**[unknown]**. It is probably in the privacy policy that could not be read.

**[inferred]** Two costs are close to certain:

1. **An AI provider, paid per call.** Understanding speech, reading a
   receipt photo and sorting pasted text all need a multimodal model
   (OpenAI, Gemini, Claude or similar). A "quota" on the free tier is the
   sign that each use costs the developer money. That is exactly why the
   paid tier is sold as "more AI". To keep the API key off the phone, the
   calls usually go through a backend the developer owns, such as a
   Supabase Edge Function, a Firebase Cloud Function or a small server.
   Without that, anyone could pull the key out of the APK.
2. **A server for sync.** Sync across devices needs somewhere to keep the
   data: Firebase, Supabase, their own server, or the person's own
   iCloud/Drive. "Encrypted" could mean end-to-end encryption, where the
   developer cannot read the data, or only encryption in transit and at
   rest, where the developer can. The listing does not say which, and it
   matters.

So Lukas is **not serverless**, at least not once the AI or sync is used.
Its monthly cost grows with the number of users. That is the model this
app has refused (rule 21: no server of our own). Our Drive backup costs
nothing per user, because it goes into the user's own Drive.

**To check in the privacy policy, locally:** the list of subprocessors,
whether sync is end-to-end encrypted, whether audio and receipt photos are
kept or used to train models, whether analytics or crash reporting is
included (Firebase Analytics, Crashlytics, Sentry), and who handles
billing (RevenueCat or plain Play Billing).

## Where this app is ahead

Checked against the code and CLAUDE.md on 2026-09-27.

1. **Yields worked out to the centavo.** Products, daily accrual at
   `(1 + E.A.)^(1/365) - 1`, CDTs, spending bonuses, 7% withholding with
   the 0.055 UVT threshold per product, and results checked against what
   the banks actually paid (rules 15–18). Lukas mentions nothing like it,
   and neither does any app in the rule 21 survey.
2. **Real multi-currency.** Each movement keeps the rate its bank applied.
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

## What this says about pricing (rule 21)

Lukas sells "more AI", because that is what costs it money. We cannot
sell the same thing, and we don't need to: what we sell (yields,
multi-currency, statements, the tax simulator) costs nothing per user.
The cost of that is that we cannot say "AI" in the store listing, which
sells well right now. If voice entry arrives as in idea 8, without an
LLM, it can be called "dictation" honestly.

## Open items, to fill in from a local session

- [ ] Read the privacy policy: backend, subprocessors, AI provider,
      whether sync is end-to-end encrypted, what is kept from voice and
      photos, analytics.
- [ ] Price of Pro, and whether it is monthly, yearly or lifetime.
- [ ] Install it: screenshots of the home screen, the entry flow,
      Safe to Spend and the budgets. Rating and number of downloads.
- [ ] Whether its multi-currency converts at all, or only labels.
