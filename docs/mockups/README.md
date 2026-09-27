# Mockups of the redesign (v3, 2026-09-27)

Pictures of how every screen would look, drawn to agree the direction with
Jose before any code changes. **They are not the app** and every figure in
them is invented. What each screen must still do is
`docs/08-redesign-checklist.md`; where a mockup leaves something out, the
checklist wins.

## The files

| File | Screen |
|---|---|
| `00-azul-opciones` | The accent: Zafiro (recommended), Cobalto, Índigo, and today's |
| `a01`–`a07` | Inicio (all accounts, amounts hidden, one card with its movements list, a new user), "Estás viendo", the period, the "+" sheet |
| `a08`–`a14` | Movement form: an account with products (the product on show and changed on its own), the product sheet, the account list, the category list, a transfer in two currencies, a move between products, editing with delete |
| `b01`–`b04` | Cuentas, how net worth is built, currencies and today's rate, adding a currency |
| `b05`–`b07` | New account (from a PDF or by hand), editing a card, its icon and colour (`b06b`), the limit history |
| `b08`–`b13` | Categories (expense, product), and the editor: colour by family, icon, own image, a product category |
| `c01`–`c11` | Products and yields: the list, an account's sheet with tabs (Productos, Días, Movimientos, Tasas), one day, a product, a CDT, a new rate, a product's own movement, adding an account |
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
