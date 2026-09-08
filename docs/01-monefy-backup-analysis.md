# Monefy backup analysis

File: `data/monefy-2026-09-08.csv` — the latest export (12,898 rows,
25/06/2021 to 08/09/2026, 22 accounts, 87 categories). Earlier exports are
kept alongside it; see docs/05-data-model.md for the naming rule.
Everything here is **verified** by reading the file, not assumed.

> Note: this analysis was originally produced from the `.xlsx` export
> (single sheet `in`). What is in the repository is the CSV export of that
> same data (12,890 data rows). The column layout and the problems below are
> the same; the "Excel serial dates" issue only applies to the `.xlsx`.

## Overall shape

- 12,889 rows, starting June 2021
- 8 columns: `date`, `account`, `category`, `amount`, `currency`,
  `converted amount`, `currency.1`, `description`
- 21 accounts, 86 categories (including pseudo-categories, see below)

### Accounts by volume

| Account | Transactions |
|---|---|
| Tarjeta crédito rappi | 5,426 |
| Bancolombia | 2,066 |
| Rappi cuenta | 1,802 |
| Fiducuenta | 950 |
| Multinversion | 819 |
| Ualá | 747 |
| Efectivo | 332 |
| Nequi | 230 |
| ARQ | 194 |
| Cuenta leidy bancolombia prestamos | 155 |
| eToro | 38 |
| Global66 | 27 |
| Lulo | 23 |
| XTB | 20 |
| Bold | 20 |
| Nu, Dale | 9 each |
| Pibank, Plenti | 7 each |
| Cineco | 5 |
| Pibank para renta | 3 |

USD accounts (confirmed by Jose): **ARQ (DolarApp), eToro, XTB, Plenti,
Global66**. Each one's start date is inferred from its first transaction in
the backup.

**New in the 2026-09-08 export: `Plata`**, with a single 200,000 COP transfer
in from Rappi cuenta on 08/09/2026, plus the matching `To 'Plata'`
pseudo-category. Its currency and account type still need confirming — the
importer would otherwise have to guess, and guessing the currency of an
account is not something it should do.

---

## Problems the importer has to solve

### 0. The file is Windows-1252, not UTF-8

Verified 2026-09-08. Every non-ASCII byte is a single-byte accented Latin
character (8,296 `é`, 4,061 `ó`, 2,684 `á`, 1,429 `í`, 237 `ñ`, and a few
more); strict UTF-8 decoding fails on the first one. Node reads files as UTF-8
by default, so the importer must decode with `windows-1252` explicitly.

This matters beyond cosmetics: the account name is part of the import
fingerprint, so mojibake in `Ualá` or `Tarjeta crédito rappi` would change the
fingerprint and re-import the whole history as new rows.

### 1. Currency was lost entirely

The `currency` and `converted amount` columns carry **COP in 100% of the
rows**, including eToro, Global66 and XTB. Monefy flattened everything to
pesos and exported neither the original currency nor the applied rate.

That information **cannot be recovered from the file**. It has to be
reconstructed.

### 2. Dates — a problem in the `.xlsx`, not in the CSV

The original `.xlsx` analysis found three mixed formats (`dd/mm/yyyy` text,
Excel serials such as `44203`, and dates with day and month swapped) and
concluded that days ≤ 12 were ambiguous, to be resolved by row position.

**That does not apply to the CSV, verified 2026-09-08.** All 12,890 rows use
`dd/mm/yyyy` and nothing else. The reading is unambiguous: the first component
reaches 31 while the second never exceeds 12, so it is day/month for certain.
Range: 25/06/2021 to 07/09/2026.

The importer therefore needs no disambiguation pass. Keep this section only so
the reasoning is not re-derived if an `.xlsx` export shows up again.

### 3. Transfers do not exist as an entity

They are two mirror rows with fake categories: `To 'X'` and `From 'Y'`.
There is no id linking them.

- 2,698 `To '...'` rows
- 2,632 `From '...'` rows
- ≈66 end up unpaired → manual review

In the new model a transfer must be **one entity with two legs**, not two
loose transactions.

### 4. `Initial balance 'X'` is a pseudo-category

It has to become a real opening balance on the account, not a transaction.

### 5. Interest mixed into the account

Today it is recorded as category `Ahorros` with description "Subió inversión"
(1,491 rows). Exactly what the new design wants to separate out.

### 6. Inconsistent cashback

Sometimes as `Ahorros`, sometimes as an adjustment to `Facturas`
("Ajuste rappi card 4x1000 y cashback"). It needs its own category and a link
to the transaction that produced it.

### 7. Credit card modeled wrong

`Tarjeta crédito rappi` starts with a **positive `Initial balance` of
800,000**, which is really the credit limit. On import it has to be rebased:
debt = credit limit − current balance.

**Current limit confirmed by Jose (2026-09-08): 1,100,000 COP.** So 800,000 is
the limit as it stood back in 2021, not today's. The account's `credit_limit`
is set to the current 1,100,000; the 800,000 is only used to rebase the
historical opening balance.

---

## Reconstructing the USD amounts

### What is available

162 rows mention a dollar amount inside the description:

| Account | Total rows | With explicit USD amount |
|---|---|---|
| ARQ | 194 | 72 |
| eToro | 38 | 17 |
| XTB | 20 | 14 |
| Plenti | 7 | 7 |
| Global66 | 27 | 2 |

There is noise: a Bancolombia purchase says "completar 100 usd con descuento"
and is **not** a dollar transaction. The parser must push every case into a
review queue rather than importing blindly.

### Critical warning from Jose

The COP amounts on those transactions **were eyeballed estimates**. Monefy did
not let him handle USD, so he wrote down an approximate figure. In several
cases what actually happened was moving USD directly between two USD accounts,
with no real conversion.

**So the COP on those rows is not a trustworthy source.** Dividing it by the
TRM would produce an equally made-up USD figure.

### Agreed hierarchy

1. If the description carries the USD amount → that wins, COP is recomputed.
2. Otherwise → estimate using that day's TRM and mark as **low confidence**.
3. Reconcile against the current real USD balances Jose provides, spreading the
   difference **only** across the low-confidence transactions. That way the
   final balance is exact even if the intermediate history is approximate.

### Step 3 does not hold for investment accounts (found 2026-09-08)

Real balances Jose reported on 2026-09-08: **eToro 17,195.31 USD, XTB 2,607
USD, Plenti 0 USD**. All three hold USD only.

Comparing those against what the backup records:

| Account | Rows | Net COP in backup | Real USD | Implied rate |
|---|---|---|---|---|
| eToro | 38 | 52,163,869 | 17,195.31 | **3,034** |
| XTB | 20 | 8,764,007 | 2,607 | **3,362** |
| Plenti | 7 | 0 | 0 | — |

The implied rates are far below every rate derivable from Jose's own file
(4,214.00 / 4,300.00 / 4,321.22 / 4,375.35). At any of those, the COP recorded
buys markedly fewer dollars than he actually holds.

The reason is visible in the categories. **Neither eToro nor XTB has a single
gain entry.** Every eToro row is a transfer in (`From 'ARQ'` ×30,
`From 'Bancolombia'` ×7, `From 'Tarjeta crédito rappi'` ×1); XTB is the same
plus one `Depósitos`. So the backup records only deposits, and the gap between
deposits and today's balance is **investment return that was never recorded**.

That breaks step 3 for these accounts. Spreading the difference across
low-confidence transactions would inflate the historical deposits until they
matched today's balance, erasing the gain. For a tax app that is the wrong
direction to be wrong in: the gain is taxable and would vanish from the record.

**Decision by Jose, 2026-09-08: brokers are not reconciled at all.**

eToro and XTB are trading accounts. Their value moves with the market every
day, so today's balance is not a target the ledger should be bent to match —
it is a different quantity altogether, and chasing it would corrupt the
history of what actually moved.

So for accounts of type `investment` the importer records **only the exact
movements**: deposits in, withdrawals out. The balance the app derives for them
is therefore the amount put in, not what the broker is worth today. Those two
numbers are meant to differ, and the difference is the return.

Two consequences worth being explicit about, because they will look like bugs
otherwise:

- Net worth understates eToro and XTB by whatever they have gained. On the
  figures above that is thousands of dollars.
- No reconciliation step runs on them, so their `confidence` flags stay as the
  parser set them and are never adjusted.

Tracking market value — a daily or periodic valuation, and the tax treatment
that goes with it — is deferred. It is genuinely a separate problem: a broker
balance changes continuously and cannot be derived from transactions at all.

Reconciliation still applies as agreed to the accounts that hold cash rather
than positions: ARQ and Global66.

**Plenti reconciles exactly**: 490,000 in, 159,930 in, 649,930 out, balance
zero, and all 7 rows carry an explicit USD amount. One account confirms the
approach works when the data is complete.

### USD-to-USD transfers have no meaningful COP

ARQ is the hub: `To 'eToro'` ×30 and `To 'XTB'` ×14, plus `To 'Plenti'`. Those
45 transfers move dollars between two USD accounts with **no conversion at
all**, exactly the case Jose warned about. Their COP figures on both legs are
inventions and must not be treated as evidence of a rate; the transfer is
1:1 in USD, and the base-currency amount has to come from the COP that
originally entered ARQ, not from re-converting at some day's TRM.

### Real rates derivable from the file

From the pairs where both COP and USD are present, the rate DolarApp actually
applied can be extracted:

| COP | USD | Implied rate |
|---|---|---|
| 2,107,000 | 500 | 4,214.00 |
| 309,875 | 71.71 | 4,321.22 |
| 4,300 | 1 | 4,300.00 |
| 820,378 | 187.5 | 4,375.35 |

With several of these points you compute the provider's typical spread against
that day's official TRM, and apply that spread to the rows with no explicit
figure.
