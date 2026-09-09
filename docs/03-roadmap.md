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
  totals, the chart and the list together.
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
- **Search**, over description and category.

### 3.3 The chart

The pie Monefy opens on: each category as a slice with its share of the
period's spending, obeying the same account and period filter. Tapping a slice
filters to that category.

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
