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

**Deliverable:** an app usable day to day.

- Fast transaction entry (Monefy's strength: few taps)
- Account and category CRUD with a broad icon catalog
- Transaction list and editing
- Period navigation: month, year, jumping to earlier periods
- Export

At this point the app already replaces Monefy.

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
