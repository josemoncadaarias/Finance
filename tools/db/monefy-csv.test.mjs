// Tests for the Monefy CSV reader, including a pass over the real export.
//
//   node --import ./tools/db/register-ts.mjs --test tools/db/monefy-csv.test.mjs

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  parseMonefyCsv, splitCsvLine, parseMonefyDate, parseMonefyAmount,
  classifyCategory, MonefyCsvError,
} from '../../src/app/core/database/import/monefy-csv.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const REAL_EXPORT = join(HERE, '..', '..', 'data', 'monefy-2026-09-08.csv');

const HEADER = 'date,account,category,amount,currency,converted amount,currency,description';

/** Builds a small export in Windows-1252, the way Monefy writes it. */
function csv(...lines) {
  const text = [HEADER, ...lines].join('\r\n');
  // Latin-1 and Windows-1252 agree on every character used in these tests.
  return Uint8Array.from([...text].map(char => char.charCodeAt(0)));
}

test('splits fields, honouring the quotes around amounts', () => {
  assert.deepEqual(splitCsvLine('a,b,c'), ['a', 'b', 'c']);
  assert.deepEqual(splitCsvLine('a,"1,234",c'), ['a', '1,234', 'c']);
  assert.deepEqual(splitCsvLine('a,"",c'), ['a', '', 'c']);
  assert.deepEqual(splitCsvLine('a,"say ""hi""",c'), ['a', 'say "hi"', 'c']);
  assert.deepEqual(splitCsvLine(''), ['']);
});

test('reads dates as day/month and refuses anything else', () => {
  assert.equal(parseMonefyDate('25/06/2021', 1), '2021-06-25');
  assert.equal(parseMonefyDate('7/9/2026', 1), '2026-09-07');
  assert.throws(() => parseMonefyDate('2021-06-25', 1), MonefyCsvError);
  assert.throws(() => parseMonefyDate('25/13/2021', 1), MonefyCsvError);
  assert.throws(() => parseMonefyDate('', 1), MonefyCsvError);
});

test('reads amounts with thousands separators into minor units', () => {
  assert.equal(parseMonefyAmount('-1,119,699', 1), -111969900);
  assert.equal(parseMonefyAmount('9,421.28', 1), 942128);
  assert.equal(parseMonefyAmount('-51,774.09', 1), -5177409);
  assert.equal(parseMonefyAmount('600', 1), 60000);
  assert.throws(() => parseMonefyAmount('n/a', 1), MonefyCsvError);
});

test('recognises the pseudo-categories Monefy uses for transfers and balances', () => {
  assert.deepEqual(classifyCategory('Restaurante'),
    { kind: 'transaction', category: 'Restaurante', counterparty: null });
  assert.deepEqual(classifyCategory("To 'Ualá'"),
    { kind: 'transfer_out', category: null, counterparty: 'Ualá' });
  assert.deepEqual(classifyCategory("From 'Rappi cuenta'"),
    { kind: 'transfer_in', category: null, counterparty: 'Rappi cuenta' });
  assert.deepEqual(classifyCategory("Initial balance 'Nequi'"),
    { kind: 'initial_balance', category: null, counterparty: 'Nequi' });

  // An account name containing an apostrophe still resolves, because the
  // pattern is anchored at both ends and takes the longest middle.
  assert.equal(classifyCategory("To 'Jose's cash'").counterparty, "Jose's cash");
  // A real category that merely starts with the word To is not a transfer.
  assert.equal(classifyCategory('Toallas').kind, 'transaction');
});

test('parses a small export end to end', () => {
  const result = parseMonefyCsv(csv(
    `25/06/2021,Nequi,Initial balance 'Nequi',"9,421.28",COP,"9,421.28",COP,`,
    '26/06/2021,Bancolombia,Restaurante,"-50,200",COP,"-50,200",COP,Rappi',
    `13/08/2024,Rappi cuenta,To 'ARQ',"-100,000",COP,"-100,000",COP,Transferencia a dolarapp`,
    `13/08/2024,ARQ,From 'Rappi cuenta',"100,000",COP,"100,000",COP,Transferencia a dolarapp`,
  ));

  assert.equal(result.rows.length, 4);
  assert.deepEqual(result.accounts, ['Nequi', 'Bancolombia', 'Rappi cuenta', 'ARQ']);
  // Pseudo-categories are not real categories.
  assert.deepEqual(result.categories, ['Restaurante']);

  const [initial, meal, out, into] = result.rows;
  assert.equal(initial.kind, 'initial_balance');
  assert.equal(initial.counterparty, 'Nequi');
  assert.equal(initial.amountMinor, 942128);

  assert.equal(meal.kind, 'transaction');
  assert.equal(meal.category, 'Restaurante');
  assert.equal(meal.amountMinor, -5020000);
  assert.equal(meal.description, 'Rappi');
  assert.equal(meal.lineNumber, 3, 'line numbers point at the real line in the file');

  assert.equal(out.kind, 'transfer_out');
  assert.equal(out.counterparty, 'ARQ');
  assert.equal(into.kind, 'transfer_in');
  assert.equal(into.counterparty, 'Rappi cuenta');
});

test('a description containing a comma is kept whole', () => {
  const result = parseMonefyCsv(csv(
    '26/06/2021,Bancolombia,Restaurante,"-50,200",COP,"-50,200",COP,Almuerzo, postre y cafe',
  ));
  assert.equal(result.rows[0].description, 'Almuerzo, postre y cafe');
});

test('identical rows get their own sequence numbers', () => {
  const line = '23/07/2022,Efectivo,Transporte,"-2,600",COP,"-2,600",COP,Bus';
  const result = parseMonefyCsv(csv(line, line, line));

  assert.deepEqual(result.rows.map(r => r.importSeq), [1, 2, 3]);
  assert.equal(new Set(result.rows.map(r => r.fingerprint)).size, 1);
});

test('a malformed file fails loudly rather than importing nonsense', () => {
  assert.throws(() => parseMonefyCsv(csv('26/06/2021,Bancolombia,Restaurante')), MonefyCsvError);
  assert.throws(() => parseMonefyCsv(Uint8Array.from([])), MonefyCsvError);
  assert.throws(
    () => parseMonefyCsv(csv('not-a-date,Bancolombia,Restaurante,-1,COP,-1,COP,x')),
    /Line 2/,
  );
});

// The real file is the only test that proves the encoding handling works: the
// synthetic cases above are pure ASCII.
test('reads the real export', { skip: !existsSync(REAL_EXPORT) && 'export not present' }, () => {
  const result = parseMonefyCsv(readFileSync(REAL_EXPORT));

  assert.equal(result.rows.length, 12898);
  assert.equal(result.accounts.length, 22);
  assert.ok(result.accounts.includes('Plata'), 'the newest account is there');

  // Accents survived, which means Windows-1252 was decoded correctly. Read as
  // UTF-8 these names come back mangled and the fingerprints would all change.
  assert.ok(result.accounts.includes('Ualá'));
  assert.ok(result.accounts.includes('Tarjeta crédito rappi'));
  assert.ok(result.categories.includes('Tecnología y Plataformas digitales'));

  const kinds = result.rows.reduce((counts, row) => {
    counts[row.kind] = (counts[row.kind] ?? 0) + 1;
    return counts;
  }, {});

  // Every row is classified; nothing falls through.
  const total = Object.values(kinds).reduce((sum, n) => sum + n, 0);
  assert.equal(total, 12898);

  // Each account may declare an opening balance at most once.
  const initialByAccount = new Map();
  for (const row of result.rows.filter(r => r.kind === 'initial_balance')) {
    assert.equal(initialByAccount.has(row.account), false, `two opening balances for ${row.account}`);
    initialByAccount.set(row.account, row.amountMinor);
  }

  // Amounts are integers throughout, which is what the schema will demand.
  assert.ok(result.rows.every(row => Number.isSafeInteger(row.amountMinor)));

  // Dates come out sorted, confirming the file is in chronological order.
  const dates = result.rows.map(row => row.occurredOn);
  assert.deepEqual(dates, [...dates].sort(), 'rows are already in date order');

  console.log('    real export:', JSON.stringify(kinds), `${initialByAccount.size} opening balances`);
});
