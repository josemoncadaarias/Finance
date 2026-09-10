// Finds Spanish text still hardcoded in a screen.
//
//   node --import ./tools/db/register-ts.mjs --test tools/db/untranslated.test.mjs
//
// Written after the first pass at making the app multilingual missed two whole
// templates: the summary screen switched to English and the accounts screen
// stayed in Spanish, which nobody noticed until Jose used it. Looking for
// leftovers by eye does not work — the app has to be read in the other
// language to see them, and by then they have shipped.
//
// The test is deliberately crude: it looks for Spanish-only characters and for
// common Spanish words in the parts of a file a user can see. Anything it
// flags is either a string that needs a key, or something that is genuinely
// data and belongs in ALLOWED below, with a reason.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = join(HERE, '..', '..', 'src', 'app');

/**
 * Files whose Spanish is data or domain, not the app talking.
 *
 * The importer reads a Spanish CSV and matches Spanish text in it; the
 * translations file is where Spanish is supposed to live; the tax module will
 * join this list when it exists.
 */
const ALLOWED = [
  'core/i18n/translations.ts',
  'core/database/category-icons.ts',
  'core/database/import/account-plan.ts',
  'core/database/import/extract-usd.ts',
  'core/database/import/monefy-csv.ts',
  'core/database/import/import-monefy.ts',
  // The CSV's default words; the screen passes translated ones.
  'core/database/export/export-csv.ts',
];

/** Words common enough in Spanish, and rare enough in code, to be a signal. */
const SPANISH_WORDS =
  /\b(cuenta|cuentas|saldo|saldos|movimiento|movimientos|gasto|gastos|ingreso|ingresos|transferencia|transferencias|categoría|categorías|patrimonio|monedas|archivada|archivadas|disponible|guardar|cancelar|escoge|escoger|borrar|buscar|todos|todas|desde|hasta|nada|listo|filas|montos|dólares|pendientes|importar|importando|base de datos)\b/i;

/** Characters that only appear in Spanish text, never in English. */
const SPANISH_CHARS = /[áéíóúñ¿¡]/;

function walk(dir) {
  const found = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) found.push(...walk(path));
    else if (name.endsWith('.ts') || name.endsWith('.html')) found.push(path);
  }
  return found;
}

/**
 * The parts of a file a user could end up reading.
 *
 * Comments are exempt: this repository is written in English, but a comment
 * quoting a Spanish account name or a phrase from the backup is fine and says
 * something useful.
 */
function userFacingLines(source, isHtml) {
  const lines = source.split(/\r?\n/);
  const out = [];
  let inBlockComment = false;

  for (const [index, line] of lines.entries()) {
    let text = line;

    if (isHtml) {
      text = text.replace(/<!--.*?-->/g, '');
      if (text.includes('<!--')) { inBlockComment = true; text = text.slice(0, text.indexOf('<!--')); }
      else if (inBlockComment) {
        if (!text.includes('-->')) continue;
        inBlockComment = false;
        text = text.slice(text.indexOf('-->') + 3);
      }
    } else {
      if (inBlockComment) {
        if (text.includes('*/')) { inBlockComment = false; text = text.slice(text.indexOf('*/') + 2); }
        else continue;
      }
      if (text.includes('/*')) { inBlockComment = true; text = text.slice(0, text.indexOf('/*')); }
      text = text.replace(/\/\/.*$/, '');
    }

    if (text.trim() !== '') out.push({ line: index + 1, text });
  }
  return out;
}

test('no screen has Spanish text left hardcoded in it', () => {
  const offenders = [];

  for (const path of walk(APP)) {
    const rel = relative(APP, path).replace(/\\/g, '/');
    if (ALLOWED.includes(rel)) continue;

    const source = readFileSync(path, 'utf8');
    for (const { line, text } of userFacingLines(source, path.endsWith('.html'))) {
      if (SPANISH_CHARS.test(text) || SPANISH_WORDS.test(text)) {
        offenders.push(`${rel}:${line}  ${text.trim().slice(0, 80)}`);
      }
    }
  }

  assert.deepEqual(offenders, [],
    'Spanish text that should be a translation key:\n  ' + offenders.join('\n  '));
});
