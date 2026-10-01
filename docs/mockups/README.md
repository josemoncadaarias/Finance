# Mockups of the redesign

Pictures of how every screen would look, drawn to agree the direction with
Jose before any code changes. **They are not the app** and every figure in
them is invented. What each screen must still do is
`docs/08-redesign-checklist.md`; where a mockup leaves something out, the
checklist wins.

## Status

Agreed group by group (see the table in CLAUDE.md, "How the redesign is
agreed"). Files starting with a digit are the current version of their
group (v4 and later). The "+" sits in the middle of the floating bar from v5, in every file that draws the bar; `b*`, `c*`, `d*` are v3 drafts, kept until their group
is redone, and superseded by Jose's review of 2026-09-28.

`6-recorrido-importar.jpg` shows importing a statement step by step. `2s-recorrido-cuentas.jpg` shows the Cuentas tab step by step: Saldos, an account in Inicio, Rendimientos, an account's products.

Every list of movements is in folding sections (by day or category), only the first open, with the round open-all / close-all button (`1o`, `1p`, `4d2`). Every screen with a long list carries the two arrows (up, down) on the right above the bar, as the app shows them today.

## The files

| File | Screen |
|---|---|
| `00-azul-opciones` | The accent: Zafiro (recommended), Cobalto, Índigo, and today's |
| `1a`–`1n` | Group 1 (v5): Inicio (transfers apart, the donut with a capped legend), one account with products (its two quick buttons), one account with a long name (ellipsis and sliding), the "+" sheet, the movement form for spending, writing a note, a transfer, a move between products, two currencies, the account, product and category lists, editing and deleting |
| `2a`–`2r` | Group 2 (v4): Cuentas (net worth, sorting, a multi-currency account, a card, one set aside), where net worth comes from, currencies and rates, typing a rate, adding a currency, a new account by hand and from a statement (reading it, and the form it fills), editing a card (top and bottom, the limit and its history), deleting, the icon, colour and own image, the archived, no accounts yet, an account whose face is its own image (`2q`) and its colour behind that image (`2r`) |
| `3a`–`3j` | Group 3 (v4): Categorías closed and open, which list for a new one, editing (Para locked), a new one, the investment-return switch, the face's icon, colour and own image, the archived |
| `4t01`–`4t13` | Group 4: every transfer with products, each end compact (account and product on two lines, two shapes) - the (i) help opened (`4t01b`), choosing on one side the product the other holds and the other side moving (`4t10a`, `4t10b`), long names and their slide (`4t12`, `4t13`), between two products of one account, choosing the product it leaves from, product to an account, account to a product, choosing the product it lands in, between two accounts with products, into a product set aside from net worth, into another currency, after "Invertir", the same product on both ends, editing one |
| `4a`–`4zz` | Group 4 (v5): Rendimientos in the Cuentas tab, adding an account; an account's page with its selector (Productos, Movimientos, Pagos, Días), one day corrected or set to zero, stopping it; a product with its selector (Producto, Saldo said as a sum, Tasa, a new rate, Bonificación and a new one), deleting it and choosing where its balance goes; a CDT (CDT, Al vencer and choosing where it pays, Pagos); a new product's Saldo; a product's own income and expense with "¿Qué cambia?" as one row opening a sheet, and the note |
| `5a`–`5s` | Group 5 (v5): the report. Movimientos: as it opens, each section open in turn (compared with before, what changed, where the money went, charges repeated each month, spending month by month), the (i) of a section, choosing the period, exporting. Rendimientos: the period in figures, against inflation, worth knowing, the balance against last month's close, yields so far with the estimated part, which account earned most, against the period before. From Lukas: income and spending month by month (`5q`) and the balance ahead (`5r`); a long category name sliding (`5s`) |
| `10a`–`10f` | **Proposals, not approved** (2026-09-28): reading bank movements, compared with Lukas's iPhone "atajos" - Tus bancos (one card per bank the phone has been seen to receive from, with App / SMS / Correo), choosing which SMS senders to read, teaching the app one bank's message, saving from a notification of this app's own, Por revisar with where each movement was seen, and what "Instalar atajo" would be on an iPhone |
| `11a`–`11o` | **Proposals, not approved** (2026-09-29): debts and plans - Cuentas with a third face, Deudas (what is owed, what it costs this month, the next payments, what is owed TO the person), adding a debt (a loan, a mortgage, a card, money lent), a loan's terms (rate E.A. or M.V. with the usury ceiling, the installment worked out beside the bank's), a loan's summary, its schedule and paying capital ahead (reduce the term or the installment, side by side), the order to pay several debts, a card's cut-off and payment days and the statement they allow, paying an installment split into capital, interest and insurance, Planes (spending limits per category and savings goals, in the Reporte tab), a new limit, a new goal, and what Inicio says this week |
| `12a`–`12i` | **Part 1 of debts, for approval** (2026-10-01): Más with "Tus finanzas", Cuentas → Deudas with one card and no loans, the card's two optional days, and its statement due, part paid, paid, overdue, without days and with nothing owed |
| `13a`–`13k` | **Part 2 of debts, loans, for approval** (2026-10-01; invented loan: 60,000,000 at 16.5% E.A., 60 monthly installments, 23 paid, every figure worked out): Deudas with a card and a loan, "Nueva deuda", the loan's form, one begun before the app, its Resumen and Cuotas, paying an installment and paying other figures than the worked-out ones, an installment overdue, a loan paid off, Saldos with the loan |
| `13l`–`13r` | **Paying a loan ahead, v2 for approval** (2026-10-01): capital and interest on lines of their own in Cuotas (`13f`), abonar once with the three answers side by side (`13l`), how much each amount saves (`13m`), in the primas or every month (`13n`), registering it (`13o`), the schedule after it (`13p`), paying it all today (`13q`), an installment paid with default interest (`13r`) |
| `13s` | **How the loan screens lead to one another** (`src/flow-13.mjs`): Resumen → Abonar → Registrar el abono → Cuotas, and the other exits |
| `14a`–`14f` | **Part 3, plans, step 1: spending limits, for approval** (2026-10-01; invented figures): Planes in Más → Tus finanzas, Planes with no limit yet (the categories where the money goes most, one tap from a limit), Planes with limits in their colours, a new limit (the average of 3 months offered), one limit (the pace, the months before against the line, what counts this month), Inicio saying only when a limit is close or passed. Goals are step 2 |
| `14g`–`14k` | **A limit passed, made to stand out** (Jose: a red bar is not enough): Planes with a red card on top like an overdue card and the limit marked "Pasado" with its bar running past the mark; the sheet that says so the moment the movement that crosses it is saved; Inicio with the same red card on top; the phone's own notification (100 % in red, 80 % before it); the limit's page when passed, with a more realistic figure for next month |
| `14l`–`14p` | **The total of all limits passed** (v2, Jose: the solid red of v1 was too invasive): the same tinted red as one limit, saying it is the total, with each passed limit below as its own red card (as in `14g`), on Planes and on top of Inicio; the sheet at saving, the same as one limit's; the phone notification with its title in red; a red dot on Más. **Every notice at saving carries "No volver a mostrar esto"** (`14h`, `14n`), and the bell in Planes opens **Avisos** (`14p`): at saving, the phone notification and the 80 % one, each turned off and back on |
| `15a`–`15m` | **Part 3, plans, step 2: goals, for approval** (2026-10-01; invented figures). Planes is called Presupuestos, with Topes and Metas. A goal is a figure, an optional date and the account or product where the money sits; its progress is that balance. Más, no goals yet, the goals (on time, late, reached), a new goal, choosing where the money is (v2, Jose: several accounts or products per goal, summed, each in one goal only, a dollar one at today's rate; `15m` "Todas tus cuentas": what the net-worth accounts hold, less what other goals already hold, cards and loans out), what counts (all of it or only what comes in from today), an emergency fund as months of real spending, a goal on time, late (pay in or move the date), reached, paying in through the one transfer form, and Inicio saying only when a goal falls behind |
| `6a`–`6z` | Group 6 (v5): Por revisar - the account on top, the batch and its list by day, the notices on rows, shops that repeat, the check's bubble; a movement checked in the one movement form (its note with suggestions, missing its category, maybe the same); choosing several by day and by shop, and saving them; the filter-and-order sheet, a filter on; the account list with Todas first; the "···" and discarding; squaring with the bank (its (i), its question); reading a statement - whose it is, the password, the stages, what was read (a toast), one that does not square, one that cannot be read; nothing to review |
| `7a`–`7m` | Group 7 (v4): Avisos del banco - the apps and their switches, the (i), what they said by day, choosing several apps, hiding, hidden apps, the "···" and forgetting everything, without permission and its (i), nothing yet, a search with nothing |
| `8a`–`8q` | Group 8 (v5): Más (replacing the drawer), language and appearance, Importar y exportar with its (i)'s, restoring and its question, Google signed out and in, saving alone, bringing the copy back, replacing another device's copy, changing account; appearance with the colour of the app |
| `9a`–`9y` | Group 9 (v4): the income-tax simulator - the sections closed with their casillas, the pinned verdict, Tu situación and the kind of work, rentas de trabajo and bringing the salary, rentas de capital, bringing the yields and Deshacer, casilla 59 both ways, the year's parameters and a later-year one, no UVT, deductions, the tax and its rates, withholding, the settlement and planning, the voluntary contribution, notes and sources, the spreadsheet, a refund |

## Regenerating them

The source is `src/` (plain HTML strings, one file per group of screens,
shared look in `lib.mjs`). It needs Playwright and the Roboto font, which
are not dependencies of the app, so install them in a folder of their own:

```
mkdir %TEMP%\mock-deps && cd %TEMP%\mock-deps
npm i playwright-core @fontsource/roboto
npx playwright install chromium
cd <repo>
set MOCK_DEPS=%TEMP%\mock-deps
node docs/mockups/src/render.mjs            (all)
node docs/mockups/src/render.mjs c0         (only the ones whose name has c0)
```

`MOCK_ACCENT` / `MOCK_ACCENT2` try another accent without touching the code;
`MOCK_CHROME` points at a Chromium binary if Playwright's own is not there.
