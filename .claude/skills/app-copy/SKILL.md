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
