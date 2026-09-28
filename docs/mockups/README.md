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

## The files

| File | Screen |
|---|---|
| `00-azul-opciones` | The accent: Zafiro (recommended), Cobalto, Índigo, and today's |
| `1a`–`1n` | Group 1 (v5): Inicio (transfers apart, the donut with a capped legend), one account with products (its two quick buttons), one account with a long name (ellipsis and sliding), the "+" sheet, the movement form for spending, writing a note, a transfer, a move between products, two currencies, the account, product and category lists, editing and deleting |
| `2a`–`2r` | Group 2 (v4): Cuentas (net worth, sorting, a multi-currency account, a card, one set aside), where net worth comes from, currencies and rates, typing a rate, adding a currency, a new account by hand and from a statement (reading it, and the form it fills), editing a card (top and bottom, the limit and its history), deleting, the icon, colour and own image, the archived, no accounts yet, an account whose face is its own image (`2q`) and its colour behind that image (`2r`) |
| `3a`–`3j` | Group 3 (v4): Categorías closed and open, which list for a new one, editing (Para locked), a new one, the investment-return switch, the face's icon, colour and own image, the archived |
| `4a`–`4zz` | Group 4 (v5): Rendimientos in the Cuentas tab, adding an account; an account's page with its selector (Productos, Movimientos, Pagos, Días), one day corrected or set to zero, stopping it; a product with its selector (Producto, Saldo said as a sum, Tasa, one using the account's rate, a new rate, Bonificación and a new one), deleting it and choosing where its balance goes; a CDT (CDT, Al vencer and choosing where it pays, Pagos); a new product's Saldo; a product's own income and expense with "¿Qué cambia?" as one row opening a sheet, and the note |
| `d01`–`d05` | Report (money, yields), reading a statement, Por revisar (and choosing several) |
| `d06`–`d07` | Avisos del banco, without and with permission |
| `d08`–`d13` | Más, Importar y exportar, restoring, Google signed out and in (change account, sign out), replacing the Drive copy |
| `d14`–`d16` | Income-tax simulator: the verdict and sections, capital income, work income |

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
