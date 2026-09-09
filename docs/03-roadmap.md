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

### 3.5 CRUD

Accounts, account groups, categories and currencies — with the icon picker
(built-in catalog plus the user's own images) and the "counts towards net
worth" switch, which today can only be changed by editing the importer's table.

### 3.6 Export

Out of the app, in a format that can be read back in.

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

- Official TRM lookup with local cache
- Offline behavior using the last known value
- Manual per-transaction rate editing
- Consolidated net worth view in COP

## Phase 5 — Interest, cashback and net worth

- Per-account rate history
- Computed daily accrual vs. actual interest posted
- Cashback accumulation
- Net worth: assets, liabilities, exclusions

## Phase 6 — Income tax module

- Configurable forms (starting with 210)
- Editable inflationary component with an estimate
- Yearly projection from what has been recorded
- How much to save per month to cover the estimated tax

Requires mapping the Estatuto Tributario first. Validate with an accountant.

## Later

Cloud sync (optional, never mandatory — the app must keep working 100%
locally).
