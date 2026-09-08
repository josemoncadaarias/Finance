# Technical decisions and why

## Stack: Angular + Ionic + Capacitor

**Why.** Jose already knows Angular, TypeScript, HTML and CSS. Ionic gives him
the mobile components and Capacitor packages that as a real Android app with
access to SQLite and the file system.

The deciding point: you can develop and debug **in the browser** with
`ionic serve` and only build for Android when you want to test on the phone.
For a project built little by little in spare time, that matters more than any
other theoretical advantage.

**Rejected alternative: .NET MAUI Blazor Hybrid.** It fit Jose's experience
better (C#, Visual Studio, EF Core, a native `decimal` type). It was ruled out
because as of today it has open, confirmed Android issues: on .NET 10 the
generated apps end up unusable because safe areas are not respected (the top
bar is covered by the status bar, the menu cannot be opened, on both emulator
and real hardware), and there are reports of startup crashes after upgrading
to .NET 10.

**Re-evaluate if:** those issues get closed, or if Ionic turns out to be
insufficient for something concrete.

---

## Money as integers

JavaScript has no decimal type. Every number is a float64, and adding floats
accumulates error. The Monefy backup already shows it: `9421.2800000000007`.

**Rule:** all amounts are stored as **integers in minor units**.

- USD → cents (`$12.34` is stored as `1234`)
- COP → cents too (`$51,774.09` is stored as `5177409`)

COP was originally going to be stored as whole pesos, on the assumption that
Colombia does not use cents in practice. The real data says otherwise:
**2,313 of the 12,890 backup rows carry cents**, opening balances included
(`66,750,767.94` on Fiducuenta). Rounding them would introduce drift that makes
balances impossible to reconcile against the bank, so COP keeps 2 minor units
like every other currency, and is displayed with 2 decimals the same way
Monefy displays it.

Every account knows its currency and therefore its decimal places. Formatting
happens only in the presentation layer. Arithmetic is never done on a
formatted value.

Exchange rates are the exception: they are stored with high precision (for
example a scaled integer ×10,000) because 4,321.22 needs real decimals.

---

## Credit cards as liabilities

A card's balance represents **what is owed**, not the available credit.

- `balance` ≤ 0, it is debt
- `credit_limit` is a separate attribute
- available credit = `credit_limit − |balance|`

**Why.** In Monefy the balance mixed credit limit and debt into a single
number. And for income tax, debts subtract from net taxable worth, so the
liability has to be explicit.

**How it looks to the user:** "I owe $X, I have $Y available", which is how
people actually think about a card.

**Migration:** debt = credit limit − the balance Monefy carried.

---

## Multi-currency

Every transaction on a foreign-currency account stores:

- `amount` in the account's currency (integer, minor units)
- `rate` the rate that bank applied to that transaction
- `amount_base` the COP equivalent at that rate, frozen
- `rate_source` where it came from: manual, derived, official TRM, cached
- `confidence` high / low, for the review queue

**History is never recalculated** when the TRM changes. That is what Monefy
gets wrong, and it is exactly what income tax reporting needs.

Official TRM source: the public datos.gov.co API (Superfinanciera). Cached
locally by date. With no internet, the last known value is used and flagged.

---

## Interest and cashback kept separate

Neither is mixed into the balance of the account that produced it, because for
tax purposes they are a different thing (financial interest has a non-taxable
inflationary component; cashback is a different kind of income).

**Interest:** every account has a rate history (effective annual rate with
valid-from/valid-to) maintained by the user. The app accrues day by day against
that history and stores the **computed** value. When the bank posts the real
amount, that is recorded too and the two can be compared.

**Cashback:** income linked to the transaction that produced it, accumulating
in its own module.

---

## Everything editable, and double bookkeeping

Any value the app computes or fetches from the internet must be overridable by
hand, and the app stores **both**: the computed one and the manual one. The
difference between them is useful information, especially for taxes.

This applies to the inflationary component too: it is estimated (from
cumulative inflation, or from the previous year's figure if it is too early in
the year) and can always be edited.

---

## Configurable tax module

Do not hardcode form 210. Each DIAN form is modeled as a configurable set of
rules and line items, so others can be added later.

Known forms, **pending verification against an official source**: 210
(resident natural person), 110 (legal entities and those keeping accounting
books), 350 (withholding at source), 300 (VAT), 490 (payment receipt).

Before coding this module, the Estatuto Tributario has to be mapped properly:
income baskets (cédulas), the 40% cap, UVT, exempt income, the treatment of
the inflationary component in financial interest, and how foreign-currency net
worth is declared.

**Note:** whatever tax rules get implemented must be validated with an
accountant before trusting the final number.

---

## Accounts that hold more than one currency

Some real accounts hold several currencies at once: Global66 holds COP and USD,
ARQ holds USD and EUR, and more will follow.

Balances in different currencies cannot be added, so **each currency is its own
row in `accounts`**, and an `account_groups` row ties them back into the single
account the user actually has. Single-currency accounts — Bancolombia, Nequi,
Plata — need no group and leave `group_id` null.

**Why not put the currency on the transaction instead**, letting one account
hold anything? Because then "the balance of this account" stops being a number
and every caller has to remember to group by currency. Splitting by currency
makes the invariant structural: a row in `accounts` has exactly one currency,
so `SUM(amount_minor)` is always meaningful.

The arrangement pays off in an unexpected place. Converting COP to USD *inside*
Global66 becomes an ordinary transfer between two of its rows — which means the
rate the provider applied is captured by the machinery that already exists,
instead of needing a special case. That rate is otherwise unobtainable, so
capturing it wherever it appears matters.

A group carries no balance of its own. There is deliberately no total across
its currencies: 500 USD plus 300 EUR is not a number without choosing a rate,
and which rate to use is a decision for the screen asking, not for the
repository.

`UNIQUE (group_id, currency_code)` stops one group from holding the same
currency twice. Ungrouped accounts are exempt because SQLite treats NULLs as
distinct in a unique index — which is exactly the wanted behaviour, since
Bancolombia, Nequi and Plata are all COP and all ungrouped.
