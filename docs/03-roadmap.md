# Roadmap

Ordered to minimize rework: foundations first (data), then what is visible,
and the tax module last, once there is clean data to feed it.

---

## Phase 1 — Data model and SQLite schema

**Deliverable:** schema created and migratable, with minimal seeds.

Base entities:

- `currencies` — code, decimal places, symbol
- `accounts` — name, icon, currency, type (debit / credit / cash / investment),
  `credit_limit`, `include_in_net_worth`, opening balance, opening date
- `categories` — name, icon, color, type (income / expense), optional parent
- `transactions` — account, category, date, `amount`, `rate`, `amount_base`,
  `rate_source`, `confidence`, description
- `transfers` — its own entity with a source leg and a destination leg, each
  with its own amount and rate (allows cross-currency transfers)
- `exchange_rates` — date, pair, rate, source (TRM cache)
- `account_rates` — account, effective annual rate, valid from/to
- `interest_accruals` — computed and actual interest, per account and period
- `cashbacks` — amount, source transaction, account

No UI yet. Only the schema, TypeScript types and a repository layer.

## Phase 2 — Monefy backup importer

**Deliverable:** a script that reads the backup and populates the database,
plus a review queue.

- Disambiguate dates assuming chronological order
- Pair `To '...'` / `From '...'` into real transfers
- Turn `Initial balance` into an account opening balance
- Rebase credit cards onto the liability model
- Extract USD amounts from descriptions (162 candidates)
- Flag estimated values as low confidence
- Reconcile against the real USD balances Jose provides

See `01-monefy-backup-analysis.md` for the detail of each problem.

## Phase 3 — Base UI

**Deliverable:** an app usable day to day. At this point it replaces Monefy,
which means matching what Monefy is actually good at, not merely showing the
same data.

Specified by Jose on 2026-09-09, from using Monefy daily. The order below is
the order to build in: the filter state comes first because everything else
reads from it.

### 3.1 One filter, shared by the whole screen

Two controls that every view obeys at once, the way Monefy does it:

- **Account.** All accounts, or one. Picking one narrows the balance, the
  totals, the chart and the list together. "All accounts" leaves out both the
  archived ones and the ones Jose keeps out of his net worth — eToro, XTB and
  Pibank para renta — since those are the accounts whose figures he does not
  want summed. They stay selectable one at a time.
- **Period.** Day, week, month, year, all time, or a custom range.

Moving between periods has to be **swipeable** — a flick left or right steps to
the previous or next day / week / month / year, whatever the period is set to.
That gesture is most of why Monefy feels quick.

### 3.2 The list

- Group by **date** or by **category**, switchable.
- Sorting follows the grouping: by date, newest first; by category, biggest
  spender first.
- **Collapse and expand all**, for either grouping. Landing on a wall of 400
  rows is not useful; landing on twelve categories is.
- The list and the donut are two views of one screen, not two screens: the
  control beside the balance opens the list over the donut and closes it again.
- **Search**, over description and category.

### 3.3 The chart

The donut Monefy opens on: each category as a slice with its share of the
period's spending, obeying the same account and period filter. Tapping a slice
opens the movements for that category, account and period.

Monefy puts three figures in the middle of it. Two are useful — money spent and
money paid in — and the third is a concept Jose has never been able to work out
("Trasladar", apparently the balance the account carried into the period). It
is dropped rather than reproduced: an app whose whole point is knowing what you
will owe cannot afford a number its owner cannot explain.

**How transfers are treated, which is the decision worth getting right.**
Moving money from Rappi cuenta to the credit card is not spending — nothing
left Jose's hands. But from the credit card's own point of view money did
arrive, and from Rappi cuenta's point of view money did leave. Both readings
are true at different scopes, so the scope decides:

- **One account selected** — transfers count, because for that account the
  money really moved. They appear in the donut as their own slice and in the
  list as their own group.
- **All accounts** — transfers vanish from the totals and from the donut
  entirely. Counting them would invent spending that never happened and
  double-count what did.

And they are never painted the same as spending. Three colours, one meaning
each: **green in, red out, neutral moved**. Monefy paints a transfer red like
any expense, which is exactly the confusion worth not inheriting.

### 3.4 Entry and editing

- Fast entry, few taps. This is Monefy's real strength and the thing most worth
  copying carefully.
- Editing a movement, which sets `locked` so a re-import leaves it alone.
- Transfers between accounts, including across currencies.

### 3.5 Editing what the importer created — done

Accounts, account groups, categories and currencies, with the icon picker
(built-in catalog plus the user's own images) and the net-worth switch that
until then lived in the importer's table and needed a code change.

Also here: a credit card's limit with its dated history, and adding a currency
the app did not ship with.

### 3.6 Export — done

Two files, because they do two different jobs and confusing them is expensive:

- **Backup (JSON).** Every table, in dependency order, including what a CSV
  cannot express: which leg belongs to which transfer, which rows are locked
  against re-import, the credit-limit history, the icon images. This database
  is the only copy of five years, so this is the file that matters.
- **CSV.** The movements as a table Excel opens, each amount written twice —
  in its own currency and in pesos. For reading and for handing to someone;
  explicitly not a restore path, and the screen says so.

Restoring from a backup is not built yet: writing one is what protects against
losing the phone, and reading it back can follow.

### 3.7 Settings

Monefy keeps its settings in a drawer. Going through them one by one, against
what this app is for:

| Monefy setting | Here |
|---|---|
| **Traslado** (carry the previous period's balance forward) | **Not needed, and already answered better.** It exists because Monefy's headline figure is the period's arithmetic, so without it a month starts at zero and the balance means nothing. This app shows the account's real balance today, above the period, so there is nothing to carry. |
| **Modo de presupuesto** | **Worth having, later.** A monthly limit per category, with what is left. It feeds the same habit the tax goal needs: knowing before the month ends. Phase 5 or 6, not before the tax module. |
| **Registros recurrentes futuros** | **Yes, and it matters more here than in Monefy.** Rent, subscriptions and salary are known in advance, and a year's projection of tax owed is far better with them than without. Phase 6, as an input to the projection. |
| **Tema oscuro** | Follows the phone. A manual override is a one-line setting; worth adding whenever settings exist. |
| **Idioma** | **Done (3.7).** Spanish and English, switched from a flag in the toolbar of every screen and from the drawer, remembered across restarts. Jose asked for it after this table was first written, and the reasoning here was wrong: doing it now cost a day, and every screen built after this one would have had to be redone. The app translates its own words only — account names, category names and the notes on a movement stay in whatever language they were typed in, and the Colombian tax module stays Spanish because its terms name nothing outside Colombia. |
| **Moneda** | The base currency is COP and everything is stored against it. Making it configurable would mean re-deriving every `amount_base_minor` ever written. No. |
| **Primer día de la semana / del mes** | **Yes.** The month view already exists and a payday-to-payday month (the 15th, say) is a real way to read one's own money. Small change to the period model. |
| **Contraseña** | **Yes, eventually.** The whole financial history sits on the phone. Android's own biometric prompt, not a password of our own. |
| **Exportar a archivo** | Already planned as 3.6. |
| **Copia de seguridad / restaurar / borrar datos** | **Yes, and more important than in Monefy**, because this database is the only copy. A single file that can be copied off the phone and read back. Belongs beside export. |
| **Dropbox / Google Drive sync** | Later, and always optional — the app must keep working entirely offline. |
| **Premium, reseña, soporte, política de privacidad, Purchase ID** | Not applicable. |

Two settings this app needs that Monefy has no reason to:

- **Which accounts count towards net worth.** Today it lives in the importer's
  table and can only be changed by editing code. It belongs in the account
  editor (3.5).
- **The tax year and its parameters** (UVT, the inflationary component). Phase 6.

## Phase 4 — Multi-currency and TRM

- **Official TRM lookup — done.** From datos.gov.co, stored under the day it
  takes effect. A quote covers a validity range (Friday's covers the weekend),
  and "the rate in force" is the most recent one on or before the day being
  asked about — which reproduces the range without storing it.
- **Offline behaviour — done.** A failed fetch leaves the stored rates exactly
  as they were and says so; the screen keeps showing the last one, with its
  date. A currency with no rate at all is reported, never guessed at.
- **Manual rates — done.** Any currency can be typed by hand. Only the dollar
  has a public source, so EUR and anything else stays manual.
- **Net worth in COP — done in Phase 3**, and corrected there: it values what
  is held today at today's rate, rather than summing what each movement cost.

Left for later: refreshing on a schedule rather than on demand and at startup,
and a screen showing the rate history.

## Phase 5 — Yields: interest and cashback, kept out of net worth

Money earned but never counted on. It accumulates outside the balance of the
account that produced it and outside net worth, and becomes real money only
when it is moved in on purpose.

**The model, as it settled.** It took several passes and every one of them was
corrected by Jose against his own accounts, so the rules are written here in
the form that survived:

- **What an account earns on is a figure he states**, on a date, per product.
  Not a sum the app derives. Six versions of that sum existed — ledger plus
  cushion, minus a part "not earning", plus a share of something — and each was
  an inference about what one of his numbers meant. What the ledger adds is
  only what has MOVED since the figure was stated.
- **Money that arrives today earns from tomorrow.** A day's yield is worked out
  on what was there when the day started. The stated figure, a deposit and a
  cushion entry all follow that one rule.
- **The cushion is a record, never a base.** What the app itself works out does
  compound, because the balance does not know about it yet.
- **An account can be several products** — alcancías, bolsillos, metas — that
  the bank pays separately. The withholding threshold is measured per payment,
  so adding them up first charges withholding that is not owed: 386.73 pesos a
  day, on Dale alone.
- **A rate is a set of components**, each with its own percentage, payout
  frequency, spending condition and fallback. Uala is 5% E.A. daily plus 5.5%
  E.A. monthly in a month with 400,000 spent. A component belongs to the
  account or to one product; a product with rates of its own uses only those.
- **A rate ends by being replaced, or by being given an end date.** Past an end
  date the component earns zero — not the previous rate, which had already been
  superseded.

Built: the schema (004, 008, 009, 011, 016, 017), the arithmetic
(`yield-math.ts`, `days.ts`), the engine (`accrual.ts`), and the screen —
which lists what the bank actually pays, keeps the day-by-day working out
underneath it, and lets rates, products, opening figures and cushion entries be
maintained without a migration.

**Cashback** is recorded by hand as a dated cushion entry with a reason, which
is Jose's own reading of it and the better one: the conditions change without
notice, so deriving it from rules would invent precision that does not exist.
`cashback_rules` and `cashback_entries` are still in the schema, unused,
for the day an automatic pass is worth it.

### Still open

1. **Correcting a whole payment.** A day can be corrected against a statement;
   a monthly payment cannot yet. That is the figure the bank actually shows, so
   it is the one worth being able to fix.
2. **The withholding rule**, seeded by 006 from Decreto 1625 de 2016 (articulos
   1.2.4.2.87 and 1.2.4.2.5) and Resolucion DIAN 000238 de 2025. Every figure
   carries its source and is one edit away. **To confirm with an accountant
   before a return leans on it.**
3. **Which accounts withhold.** Every peso account does and no foreign-currency
   one does — the second half because there is no Colombian paying agent, which
   does not make the income untaxed.
4. **Seeding a fresh install.** The migrations match accounts by name, so on an
   empty database they insert nothing and the figures are entered from the
   screen.

## Phase 6 — Income tax module

- Configurable forms (starting with 210)
- Editable inflationary component with an estimate
- Yearly projection from what has been recorded
- How much to save per month to cover the estimated tax

Requires mapping the Estatuto Tributario first. Validate with an accountant.

## Later

Cloud sync (optional, never mandatory — the app must keep working 100%
locally).
