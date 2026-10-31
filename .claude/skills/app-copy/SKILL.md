---
name: app-copy
description: How to write every word the Finance app says (buttons, titles, hints, toasts, tours, notifications, release notes), in Spanish and English. Use it whenever a user-facing string is added or changed in translations*.ts, MovementAlert.java or a store note.
---

# Writing the app's words

Jose, 2026-10-16 and 2026-10-19: the app's Spanish read badly ("está súper
mal redactado"), and "Usar el automático" left the person guessing what was
automatic. These rules come from those corrections. Read them before writing
a single string, and check every string against the list at the end.

## 1. Name the thing, never an adjective alone

A word like "automático", "oficial", "nuevo", "otro", "todo" needs its noun.
Read the string on its own, as the person meets it on a button: if it does
not say WHAT, it is wrong.

| Wrong | Right |
|---|---|
| Usar el automático | Usar la TRM oficial (dollar) · Usar la tasa oficial (other currencies) |
| El automático | TRM oficial de hoy · Tasa oficial de hoy |
| Escribir otro | Escribir el valor a mano |
| Ver todo | Ver todos los movimientos |

Use the exact term the person knows from outside the app: **TRM** for the
dollar (only the dollar has a TRM), **tasa de cambio / tasa oficial** for
other currencies, **cupo**, **extracto**, **cuota**, **CDT**, the bank's
own words. Never invent a term of the app's own.

## 2. Buttons say the result, with a verb

- Infinitive, then the object: "Guardar el movimiento", "Usar la TRM
  oficial", "Crear la cuenta Nequi". One word only when the screen leaves
  no doubt ("Guardar", "Cancelar").
- The button says what happens after the tap, not the mechanism:
  "Volver a la tasa oficial", not "Restablecer".
- Two buttons side by side never both start with the same vague verb.

## 3. Titles say what the thing is; the line under it says why it matters

- A title is a noun phrase that stands alone: "Valor de 1 euro en pesos
  colombianos", "Lo que debes", "Tasa oficial de hoy".
- A title must make sense before reading the text under it.
- The line under it adds one fact: where it comes from, when, or what to do.

## 4. Toasts and messages: what happened, in full

- Subject + what changed: "Euro: ahora se usa la tasa oficial de hoy",
  "Cuenta creada. Revisa sus 12 movimientos del extracto".
- A problem says what failed and what still holds: "No se pudo consultar la
  tasa oficial; se usa la última guardada".

## 5. Plain Spanish of Colombia, tú

- tú, never usted or vos. "Elige", not "Escoge"; "dinero", not "plata".
- Short sentences. One idea each. No "lo cual", no passive chains.
- A technical term gets a short gloss the first time a screen says it:
  "TRM (la tasa de cambio oficial del dólar)".
- Numbers with their unit: "1 euro", "3 movimientos", never a bare count.
- Sentence case: only the first word and proper names in capitals.
- No word ends in "…" (names slide instead). No "!" in the app's own voice.
- No bank, shop or platform named in the app's own words ("como hace Ualá",
  "eToro o XTB"): the person may not have it. An example is generic ("5% todos
  los días, más 5,5% al mes si gastas cierto valor"); a name appears only when
  it is the person's own data (Jose, 2026-10-22).

## 5b. No shorthand, no half-phrases (Jose, 2026-10-31)

Jose, angry and right: "lo de más", "lo de siempre", "el formulario lleno",
"un toque y...", "Aquí va lo de más" read as slang or as an unfinished
sentence. Each says less than it seems to.

| Wrong | Right |
|---|---|
| Le pagas lo de siempre y los $ X de más | Cada mes le pagas $ T: $ P de su pago normal y $ X adicionales |
| Aquí va lo de más | (say it in the sentence; no loose tag) |
| El formulario se abre lleno | El formulario se abre con los datos ya escritos |
| Un toque abre... | Al tocarlo se abre... |
| La más cara | Tiene el interés más alto |
| Se acaba sola | Con su pago normal la terminas |

- Every sentence has its subject and its object. Read it to someone who
  has not seen the screen: if they ask "¿lo de qué?", "¿lleno de qué?",
  rewrite it.
- Money has a name: "dinero adicional", "su pago normal", "su cuota", never
  "lo de más" or "lo de siempre".

**The whole app was swept for this on 2026-10-31** (about 240 strings).
What it found, so it is not written again:

| Wrong | Right |
|---|---|
| Ojo: ... | Atención: ... (or just say it) |
| Tu cuenta / tu producto de siempre | Tu cuenta / tu producto habitual |
| Se borran solos, se actualiza sola, se cierra solo, se calcula solo | ... automáticamente / la app lo calcula |
| Nada se guarda solo | Nada se guarda sin que lo confirmes |
| Llegan solas | Aparecen en la app |
| Lo que te toca pagar | Lo que debes pagar |
| Que repites seguido | Que repites con frecuencia |
| Va justo o pasado | Está cerca del límite o ya se pasó |
| Para llenar el formulario | Datos para el formulario |
| {count} lugares | {count} cuentas o bolsillos |
| No cuadran (two figures) | No coinciden (keep "Cuadra" only for a statement that adds up) |
| Retefuente, backup | Retención en la fuente, copia de seguridad |
| Escoge | Elige |
| Te entró, Te quedó | Recibiste, Te sobró |
| $ X de más | $ X por encima del tope / más de lo que te propusiste gastar |
| Se renueva solo | Empieza de nuevo el día 1 |
| Mientras no lo hagas, no los cuento | Mientras no los pases, no los sumo al dinero libre |

- "Solo/sola" for something the app does by itself always reads as
  "alone": say "automáticamente" or name who does it.
- A fragment under a figure still names its subject: "compras que van a la
  próxima factura", not "van a la próxima factura".
- A sentence never contradicts a setting: "nada se sube solo" was false
  once the automatic Drive copy existed.

## 5c. A sentence must be TRUE in every case it is shown

A sentence that explains a figure is checked against each case the
arithmetic can produce, not only the usual one. "Le pagas $ X adicionales"
is false when the debt needs less than X to be finished; "la terminas con
su pago normal" is false when money of another debt reached it. Write one
wording per case and choose it from the figures (as `why` in
`plan.page.ts` does), then look at it in a browser with data that makes
each case happen.

## 5d. Layout of a row with words

A row's title and its key figure share one line; the explanation is ONE
paragraph under them, never three loose lines. No icon or tag that repeats
what the words already say.

## 6. Agreement and articles

Check gender and number against the noun you named: "la TRM oficial", "el
valor escrito", "la tasa oficial", "Agregada" for a moneda. A string with a
placeholder ({name}, {count}) is read with a real value before it ships,
also with 1 ("1 movimiento", not "1 movimientos"; use the `.one` key).

## 7. English

Same meaning, natural English, not a word-for-word copy. Same nouns: "the
official TRM", "the official rate", "typed by hand". British spelling is
not required; consistency is.

## Check before committing

1. Read each new string alone, out of context. Does it say what, and what
   happens? If it leans on the screen to make sense, rewrite it.
2. No adjective without its noun (rule 1). Search the diff for
   "automátic", "otro", "todo", "nuevo".
3. The real term (TRM only for the dollar).
4. Gender, number, the `.one` form, placeholders filled with real values.
5. Both languages, same keys (`i18n.test.mjs`).
6. Looked at in a browser at phone width: nothing cut, nothing ending in
   "…".
7. When in doubt between two wordings, put both to Jose in the reply
   instead of choosing the shorter one.
