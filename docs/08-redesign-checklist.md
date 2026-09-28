# Redesign checklist — nothing the app does today may be lost

Written 2026-09-27, when Jose approved the direction of the mockups (navy
background, coloured icons, a floating bottom bar instead of the drawer).
His condition, in his words: "poder seguir ofreciendo todas las
funcionalidades que ya tenemos, solo estamos cambiando apariencias y
accesos". His examples were the A–Z / most-used orders, the account already
selected in the list, and the usual note offered for a new movement.

## The rule

1. **The redesign changes how things look and where they are reached from.
   Nothing else.** It does not change a repository, a query, an engine, a
   migration or a figure. If a step seems to need one of those, stop and
   ask Jose; it is not part of the redesign.
2. **No data changes.** Colours already live in `accounts.color` and
   `categories.color` (`001_initial_schema.sql`). Coloured icons read those
   columns and need no migration. A backup made before the redesign must
   restore after it unchanged.
3. **Every item below is checked before a screen is called done**, in a
   browser against `ng serve` (the rule "a claim about the screen is checked
   in a browser"), and then on the phone. An item that moved says where it
   went; an item that disappeared is a bug.
4. **One definition per control, in `global.scss`.** The new row, card,
   sheet, tick, chip, segmented control and empty state are written once
   there and used everywhere, the same way `.compose` and `.selection-bar`
   already are.
5. **Screen by screen, never all at once.** Each screen is moved over,
   checked against this list and shipped before the next is started, so a
   regression has one place to be.

The mockups are v3 of 2026-09-27, in `docs/mockups/` (56 screens). They show the
direction; where they leave something out, this list wins.

## Inventory, screen by screen

Written from the code and translations as they are on 2026-09-27
(`src/app/features/*`, `core/i18n/translations.ts`). Tick each line when
the new screen is checked.

### Shell (today: the drawer in `app.component.html`)

- [ ] Every destination of the drawer is reachable: Inicio, Resumen
      financiero, Cuentas, Categorías, Productos y rendimientos, Renta, Por
      revisar, Avisos del banco, Importar y exportar, Cuenta (Google).
- [ ] The Google account shows whose it is (photo and name) when signed in.
- [ ] The count of what waits in "Por revisar" is visible from outside it.
- [ ] Language and theme can be changed from the settings place.
- [ ] The current screen is marked, whoever navigated there (the
      `NavigationEnd` signal).
- [ ] Android's back button behaves as today.

### Inicio (`features/movements`)

- [ ] Account picker in the header: all accounts or one, with its icon,
      currency and type ("tarjeta de crédito", "aparte del patrimonio",
      "archivada"); "N cuentas, todas incluidas" / "N apartadas".
- [ ] "Incluir lo apartado del patrimonio" (accounts and products set aside).
- [ ] Period: ‹ › to step, tap to open the period sheet (day, week, month,
      year, all, range with Desde/Hasta, Aplicar); › disabled at the newest.
- [ ] Balance line per kind: Saldo hoy, Debes hoy + Disponible X de Y for a
      card, Patrimonio hoy for all.
- [ ] Entró / Salió / Movido / Recibido.
- [ ] Beside one account: edit the account; for an account that earns, the
      piggy bank to `/products?account=ID`.
- [ ] Gráfico / Movimientos with its count.
- [ ] The donut with category icons, the income figure, the list by
      category with % and amounts, grouped by name AND side (`sideOf`).
- [ ] Movements: Por día / Por categoría / Los más grandes, with the hint
      of the order inside each group; collapse/expand all; "Ver N más"
      (the row budget); to top / to bottom buttons.
- [ ] Search inside Movimientos: note, category or account, without
      accents or case; count and Entró/Salió follow the search; the compose
      bar steps aside while typing and the field scrolls above the keyboard.
- [ ] "Corregido a mano" on locked rows.
- [ ] Resumen (report) and Importar extracto reachable from here.
- [ ] Gasto, Ingreso and Transferir. A transfer starts FROM the account on
      show TO where it usually sends money (`preferredSide: 'from'`).
- [ ] Empty states: no movements in the period, none matching the search.
- [ ] Long names slide to show themselves (`marquee.service.ts`),
      `marquee-loop` on the header texts.

### Movement form (`features/entry`)

- [ ] Gasto / Ingreso / Transferencia / Mover entre productos; editing
      titles for each.
- [ ] Amount with sign; the keypad with + − × ÷ and =; "Termina la
      operación con ="; the pending sum shown; erase one digit; clear all.
- [ ] Keyboard use on a computer (Enter saves, Esc closes) and its hint.
- [ ] Cross-currency: Sale / Llega, each editable, the rate kept per
      movement.
- [ ] Account ("Desde dónde" / "Hacia dónde" / "Cuenta"). **For an
      account with products, the product chosen is always on show** under
      the account ("El habitual" or its name) **and can be changed on its
      own** without choosing the account again (the product sheet:
      "Productos de X", "Escoger otra cuenta"). Jose, 2026-09-27: this must
      survive exactly.
- [ ] Product's own movement: "¿A qué producto entra? / ¿De qué producto
      sale?", "¿Qué cambia?" with its four answers and their hints, product
      categories (`product_kinds`) with "Nueva categoría".
- [ ] Transfer route top to bottom, "Invertir", "Pasar todo" with the
      figure, and "Invertir" clearing an amount "Pasar todo" wrote.
- [ ] Moves between products: routed from the usual origin into the usual
      destination (`routeBetweenProducts`).
- [ ] Date with day chips and the calendar.
- [ ] Category: quick choices, "Ver todas (N)", "Nueva categoría", "Editar
      esta categoría".
- [ ] The usual note written in (`usual-note.ts`), following the form until
      the person touches it; the note suggestions below it (`LIKE`); clear
      the note; the rest of the form hidden while the keyboard is up.
- [ ] Every "need" message (amount, account, destination, different
      accounts or products, arrived amount, category).
- [ ] Delete, with the transfer hint (both accounts / both products) and
      the confirm dialog built the `[open]` way.

### Scope sheets (`shared/scope`), used by Inicio, Productos and Reporte

- [ ] "Estás viendo": all accounts ("sin las archivadas ni las apartadas")
      or one, each with icon, balance and tags (apartada, archivada),
      the current one ticked, the two orders, edit an account from here.
- [ ] "Incluir lo apartado del patrimonio" with its counts (accounts and
      products).
- [ ] Period: the kinds, Desde / Hasta, Aplicar, Cerrar.

### Pickers (category and account)

- [ ] Search; "Más usadas / A–Z" sharing `finance.categoryOrder` /
      `finance.accountOrder` with the other screens.
- [ ] Times used ("12 veces", "sin usar").
- [ ] **The current choice is marked** with the tick, and the list opens on
      it.
- [ ] "Ninguna categoría dice …".
- [ ] One account list, never grouped in two (`shared/account-picker`); the
      heading said for the occasion.

### Categories (`features/categories`)

- [ ] Gastos / Ingresos, each folding with its count (closed on opening);
      "Abrir todas / Cerrar todas"; the up/down arrows on a long list.
- [ ] Order shared with the picker; "En N movimientos".
- [ ] Archived: show/hide, with their hint.
- [ ] New category: "¿En cuál lista?".
- [ ] Editor: name, Para (gastos/ingresos, locked when in use, with why),
      icon from the catalogue by group, **image of one's own** (upload, 100
      kB limit, "Tus imágenes"), "Ganancia o pérdida de inversión" with its
      hint, archive with its hint, "Usada en".
- [ ] Product kinds (income categories since migration 037): their own
      editor is opened from a product's form (group 4).

### Accounts (`features/accounts`)

- [ ] Net worth, "¿De dónde sale?" breakdown with rates and exclusions, the
      brokers caveat.
- [ ] TRM: date, official or typed, refresh, offline and failure messages;
      "Tasa de hoy"; missing-rate warning and accounts that cannot be
      valued.
- [ ] Sort by amount / by name.
- [ ] Multi-currency accounts shown as one, with their currencies.
- [ ] Cards: available of limit.
- [ ] Archived: show/hide, with their hint. Empty state.
- [ ] Editor: name, icon or own image, colour, type (bancaria, tarjeta,
      efectivo, inversión), currency and "Agregar una moneda" (the shared
      `currency-dialog`, refusing an existing code), opening balance, opened
      on, credit limit with "Vigente desde" and the limit history, counts to
      net worth, archive, delete (with the count of movements it takes).
- [ ] Creating an account from a statement PDF, with the reading's
      stage, page, percentage and "Detener" (nothing written until the end).
- [ ] "Del backup" on a limit that came from the old app's backup.

### Currencies (`shared/currency-dialog`, the accounts screen)

- [ ] The list of currencies with "En N cuentas" and the hint.
- [ ] Add a currency: code (three letters, "CAD, MXN, BRL…"), name,
      symbol; refuses a code that exists; the same dialog wherever it is
      offered (accounts screen and account editor).
- [ ] A currency in use cannot change its code ("todos los montos guardados
      están en esta moneda").
- [ ] Today's rate per currency ("Tasa de hoy"), typed by hand or official.

### Products and yields (`features/products`)

- [ ] Total accrued, what was earned on the last day, "Resumen de
      rendimientos", recalculate, add an account.
- [ ] Accounts in pesos and in other currencies; rate and withholding per
      product.
- [ ] Account sheet: title that switches account (whole row), close;
      "Rendimiento disponible", "Rinde sobre" and the "cerró ayer" note;
      "Ver sus movimientos en Inicio"; "Resumen de rendimientos".
- [ ] Products list: total, count, "incluye rendimiento", products set
      aside from net worth, the usual one, "which product" hint; add a
      product with its hint.
- [ ] Product form: name, kind (alto rendimiento / CDT with its hint),
      withholding switch, counts to net worth, the balance stated and its
      date ("Saldo leído del banco"), what moved since, yield since, earns
      from (with hint), funding (typed by hand or from another product,
      each with hint), make it the usual one, its own rate or the
      account's, change rate, add a spending bonus; delete (balance only,
      history, or move it to another product), delete confirm; "nuevo
      habitual".
- [ ] CDT: amount, term, opened on, matures on, gross, withheld (or
      unknown), net, which account and category it pays into, payments
      made and pending, "de N días".
- [ ] Payout settings: daily or every N months; stop accruing (with
      confirm) and resume; "pausado".
- [ ] Rates: add (replace / add another), components, bonus by spending
      with months, until, fix, "Vigente / Todavía no empieza / Ya no
      aplica", per product.
- [ ] Days (what each day paid): count, hint, base, rate, gross, tax,
      net, "lo que pagó el banco" typed per day (actual), locked days,
      undo a correction, set a day to zero (with its question), "no rinde
      aún", "calculando…"; conditional (bonus) parts and "corregido".
- [ ] "Rendido el {día}" / "Rinde sobre" / "hoy paga sobre … el cierre de
      ayer"; the total and its hint; foreign-currency products apart.
- [ ] Withholding unknown notice; "sin retefuente" per product.
- [ ] Mover entre productos with "Pasar todo".
- [ ] Product's own income/expense with "¿Qué cambia?" (solo el producto,
      producto y patrimonio, hacer efectivo, solo el patrimonio).
- [ ] Movements of the products: by date, by category, largest; per
      product; the orphan withdrawal with "Borrar retiro"; its own search.
- [ ] The compose bar with Gasto, Ingreso and the round transfer.

### Report (`features/report`)

- [ ] Movimientos / Rendimientos switch; account and period pickers shared
      with Inicio through `FilterService`.
- [ ] Every section in its order, each with its "about" line; collapse
      all; sections that return `null` stay away.
- [ ] Trend bars tappable, with the estimated part paler; comparison rows
      with their notes; "x43" drawing of huge changes.
- [ ] Export to .xlsx ("Resumen en Excel", "Armando el resumen...").

### Por revisar (`features/review`)

- [ ] Batches from a statement or a notification, with counts and what
      still needs something.
- [ ] Per row: account, amount, expense/income, date, category (learned /
      suggested / guessed from text), "maybe the same as…", "other half of a
      transfer", save, discard.
- [ ] Repeated merchants: one category for all.
- [ ] Save all / discard all (they do not come back).
- [ ] Search, sort, filters and the note when a filter hides rows.
- [ ] Selection: "Seleccionar" or long press, whole row takes the tap, the
      `<span>` tick, Todos/Ninguno, one category for all, save the ready
      ones with the count, discard with a question.
- [ ] "No ver más estos movimientos en pantalla".

### Avisos del banco (`features/notifications`)

- [ ] Android only notice; permission state; the three promises; open
      Android settings; "Ya lo di, volver a revisar".
- [ ] Apps that post, with counts; watched or not; hide and hidden apps
      with "Mostrar".
- [ ] What they said, as it came; forget what was kept; forget all.
- [ ] Search; selection with keep / stop keeping / hide.

### Import, export and Google (`features/export`, `features/account`)

- [ ] Backup: save, restore (asked the moment the file is chosen, naming
      it, warning inside the dialog, "no" returns to the picker).
- [ ] CSV export.
- [ ] Google: sign in, **sign out**, unavailable in the browser, save now,
      **bring the Drive copy back**, save by itself on leaving, what is up
      there (date, rows), replace only what this device has seen, the old
      copy kept aside.

### Renta (`features/tax`)

Jose asked on 2026-09-27 for this screen to be redesigned too. The same
condition holds: looks and access only. The engine, the form's rows, the
formulas and the spreadsheet do not change (rule 19).

- [ ] Year with ‹ › and "Guardando… / Guardado".
- [ ] The verdict always in view: A pagar / A favor / En paz, the figure,
      "ahorra X al mes" when there is tax to pay, the tax and withholding
      line.
- [ ] Missing UVT for the year.
- [ ] Legend: typed box vs worked-out box (a key, never shaped like a
      button).
- [ ] Excel button and its hint or notice.
- [ ] "Tu situación": kind of work (ordinario, integral, independiente).
- [ ] Every section, collapsible, with title, Spanish gloss and subtitle
      (casillas); every row with label, gloss, casilla number, hint;
      typed rows with $, %, UVT units; worked-out rows and totals.
- [ ] Parameters of the year with their origin (oficial, prestado de otro
      año, estimado) and source.
- [ ] Casilla 59 asked two ways (worked out / typed from the certificate).
- [ ] "Traer el salario" by category (the category sheet) and its hint.
- [ ] "Traer los rendimientos", its hint, "Deshacer".
- [ ] Rate table, references, sources, disclaimer.
- [ ] The floating controls (top / bottom) of a long form.
- [ ] Language button, Drive button in the header.
- [ ] Busy overlay while the spreadsheet is written.

## Added by the redesign, each needing Jose's word separately

Not part of "only looks" (the eye that hid amounts was rejected, 2026-09-28): frequent movements in
the "+" sheet, the biometric lock, the welcome steps for a new user,
"Eliminar mis datos", the version on screen, fortnight periods. They are in
the table in CLAUDE.md, "Ideas waiting for Jose's word".
