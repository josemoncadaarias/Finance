// Movements that MIGHT belong to one of the new categories.
//
//   node tools/db/suggest-categories.mjs [database] [output.csv]
//
// Migration 018 moves what Jose said was certain: a description carrying the
// keyword IS that category. This is the other half — rows whose wording only
// suggests it, which is exactly the half a rule must not decide on its own.
//
// So nothing here is applied. It writes a file to read, sorted so the strongest
// hints come first, with the reason spelled out beside each row. What survives
// review can become a rule; what does not, cannot.

import { DatabaseSync } from 'node:sqlite';
import { writeFileSync } from 'node:fs';

const DATABASE = process.argv[2] ?? 'build/finance.db';
const OUTPUT = process.argv[3] ?? 'sugerencias-categorias.csv';

/** Lowercase, accents stripped: the descriptions were typed both ways. */
const FOLD = "lower(replace(replace(replace(replace(replace(replace(" +
  "COALESCE(t.description,''),'á','a'),'é','e'),'í','i'),'ó','o'),'ú','u'),'ñ','n'))";

/**
 * A hint, not a rule.
 *
 * `certain` is what migration 018 already claimed — excluded here, or the file
 * would be mostly rows that have already moved. `from` narrows to the
 * categories a row plausibly sits in today, because a suggestion is only worth
 * reading when the row is somewhere questionable.
 */
const HINTS = [
  {
    to: 'Familia',
    why: 'Menciona a alguien de la familia',
    words: ['leidy', 'mama', 'papa', 'hermano', 'hermana', 'tia', 'tio', 'abuela',
            'abuelo', 'sobrino', 'sobrina', 'suegra', 'suegro'],
    from: ['Casa', 'Regalos', 'Comida', 'Ropa', 'Salud'],
    certain: ['matias'],
  },
  {
    to: 'Uber',
    why: 'Parece un viaje, en una categoría de transporte',
    words: ['a la casa', 'al aeropuerto', 'desde el aeropuerto', 'a la oficina',
            'al centro', 'a niquia', 'a envigado', 'a sabaneta'],
    from: ['Taxi', 'Transporte'],
    certain: ['uber', 'didi'],
  },
  {
    to: 'Tiendas D1',
    why: 'Compra de mercado en tienda de descuento',
    words: ['ara', 'euro', 'justo y bueno', 'isimo', 'dollar'],
    from: ['Comida', 'Casa', 'Mercado'],
    certain: ['d1', 'dollarcity', 'didi', 'uber'],
  },
  {
    to: 'Éxito',
    why: 'Podría ser una compra en el Éxito',
    words: ['carulla', 'surtimax', 'supermercado'],
    from: ['Comida', 'Casa', 'Ropa'],
    certain: ['exito', 'didi', 'uber'],
  },
  {
    to: 'Claro',
    why: 'Parece una factura de telefonía o internet',
    words: ['internet', 'plan movil', 'plan celular', 'minutos', 'recarga movil',
            'datos moviles', 'wom', 'tigo', 'movistar', 'virgin'],
    from: ['Casa', 'Facturas', 'Comunicaciones', 'Celulares'],
    certain: ['claro'],
  },
  {
    to: 'EPM',
    why: 'Parece un servicio del hogar',
    words: ['energia', 'gas natural', 'servicios publicos', 'acueducto',
            'alcantarillado', 'factura gas', 'factura agua', 'factura luz'],
    from: ['Casa', 'Facturas'],
    certain: ['epm', 'claro'],
  },
  {
    to: 'Ganancia',
    why: 'Ingreso que suena a rendimiento de una inversión',
    words: ['rendimiento', 'interes', 'dividendo', 'ganancia', 'valorizacion'],
    from: ['Ahorros', 'Otros'],
    certain: ['subio inversion'],
    income: true,
  },
  {
    to: 'Perdida',
    why: 'Gasto que suena a pérdida de una inversión',
    words: ['perdida', 'desvalorizacion', 'cayo'],
    from: ['Ahorros', 'Casa', 'Facturas'],
    certain: ['bajo inversion'],
  },
];

const db = new DatabaseSync(DATABASE, { readOnly: true });

/**
 * How a hint word has to appear.
 *
 * A word has to start where a word starts, and may run on: "rendimiento" should
 * find "rendimientos", but "ara" — the shop — must not find "para" or
 * "cucarachas". As a plain substring it found 477 rows for Tiendas D1 and
 * almost none of them were shops.
 *
 * A phrase with a space in it is specific enough to be matched anywhere.
 */
function looksFor(word) {
  if (word.includes(' ')) return `${FOLD} LIKE '%${word}%'`;
  return `(${FOLD} LIKE '${word}%' OR ${FOLD} LIKE '% ${word}%')`;
}

/** Rows a hint points at, each with the word that pointed. */
function candidates(hint) {
  const wants = hint.words.map(looksFor).join(' OR ');
  const nots = hint.certain
    .map(word => `${FOLD} NOT LIKE '%${word}%'`)
    .join(' AND ');
  const froms = hint.from.map(name => `'${name}'`).join(', ');

  return db.prepare(`
    SELECT t.id, t.occurred_on, a.name AS account, c.name AS category,
           COALESCE(t.description, '') AS description, t.amount_minor
    FROM transactions t
    JOIN accounts a ON a.id = t.account_id
    LEFT JOIN categories c ON c.id = t.category_id
    WHERE (${wants})
      AND ${nots}
      AND t.amount_minor ${hint.income ? '>' : '<'} 0
      AND t.transfer_id IS NULL
      AND COALESCE(c.name, '') IN (${froms})
    ORDER BY t.occurred_on DESC
  `).all();
}

/** The word that triggered it, so a row can be judged without guessing. */
function trigger(hint, description) {
  const folded = description
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
  // The same shape as the query, so the reason beside a row is the reason it
  // is there.
  return hint.words.find(word => (word.includes(' ')
    ? folded.includes(word)
    : new RegExp(`(^|\\s)${word}`).test(folded))) ?? '';
}

const money = minor => (minor / 100)
  .toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Semicolons and a BOM: Excel in a Spanish locale reads a comma as a decimal
// point, and without the BOM it renders every accent as mojibake.
const rows = [[
  'Fecha', 'Cuenta', 'Categoría actual', 'Categoría sugerida',
  'Descripción', 'Monto', 'Por qué', 'Palabra', 'id',
]];

let total = 0;
const perHint = [];

for (const hint of HINTS) {
  const found = candidates(hint);
  perHint.push({ to: hint.to, count: found.length });
  total += found.length;

  for (const row of found) {
    rows.push([
      row.occurred_on, row.account, row.category ?? '', hint.to,
      row.description, money(row.amount_minor), hint.why,
      trigger(hint, row.description), String(row.id),
    ]);
  }
}

const csv = rows
  .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(';'))
  .join('\r\n');

writeFileSync(OUTPUT, '﻿' + csv, 'utf8');

console.log(`${OUTPUT}\n`);
for (const entry of perHint.sort((a, b) => b.count - a.count)) {
  console.log('  ' + entry.to.padEnd(14) + String(entry.count).padStart(5));
}
console.log('  ' + '-'.repeat(19));
console.log('  ' + 'total'.padEnd(14) + String(total).padStart(5) + '  para revisar');
