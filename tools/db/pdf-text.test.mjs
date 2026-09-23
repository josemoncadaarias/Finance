// Opening a real PDF and reading a statement out of it, end to end.
//
//   node --import ./tools/db/register-ts.mjs --test tools/db/pdf-text.test.mjs
//
// Everything else about statements is tested on text with coordinates, which
// is the honest way to test judgement. This is the other half: that a file on
// disk becomes that text at all, with the pieces where the page put them.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { samplePdf } from './sample-statement.mjs';
import { textOfPdf, StatementUnreadable } from '../../src/app/core/statements/pdf-text.ts';
import { readStatement } from '../../src/app/core/statements/statement.ts';

const COP = 2;

// In the app the worker is served from assets; here the library's own module
// is handed over, so pdf.js reads the file in this process.
const WORKER = new URL('../../node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs', import.meta.url).href;

// Its own bytes, copied out of Node's shared pool: `buffer` on a Buffer is the
// pool it was allocated in, which is several statements at once.
const bytes = () => new Uint8Array(samplePdf()).buffer;

test('a PDF becomes text that still knows where it was printed', async () => {
  const items = await textOfPdf(bytes(), undefined, WORKER);

  assert.ok(items.length > 30, 'every piece of the page is there');
  assert.ok(items.every(item => item.page === 1));

  const dates = items.filter(item => item.text.trim() === '02/09');
  assert.equal(dates.length, 1);
  // The columns of the sample are at 40, 90, 330 and 440, and they survive.
  assert.equal(dates[0].x, 40);
  const amount = items.find(item => item.text.includes('145.300,00'));
  assert.equal(amount.x, 330);
  assert.ok(amount.y < dates[0].y + 3 && amount.y > dates[0].y - 3, 'and on the same line');
});

test('the sample statement reads as the movements it describes, and it adds up', async () => {
  const read = readStatement(await textOfPdf(bytes(), undefined, WORKER), COP);

  assert.equal(read.year, 2026);
  assert.equal(read.opening_minor, 125_000_000);
  assert.equal(read.closing_minor, 227_127_000);
  assert.equal(read.balances, 'checked', 'the statement proves its own reading');
  assert.equal(read.rows.length, 10);
  assert.ok(read.rows.every(row => row.confidence === 'high'));

  const [first] = read.rows;
  assert.equal(first.occurred_on, '2026-09-02');
  assert.equal(first.amount_minor, -14_530_000);
  assert.equal(first.description, 'COMPRA EXITO POBLADO MEDELLIN');

  const income = read.rows.filter(row => row.amount_minor > 0);
  assert.deepEqual(income.map(row => row.amount_minor), [320_000_000, 412_000],
    'the salary and the interest, and nothing else, came in');
});

test('a file that is not a PDF says so rather than reading nothing', async () => {
  await assert.rejects(
    () => textOfPdf(new TextEncoder().encode('esto no es un pdf').buffer, undefined, WORKER),
    error => error instanceof StatementUnreadable);
});

test('the reader asks for the legacy build, which is what CI and old phones need', () => {
  // The modern build leans on `Uint8Array.prototype.toHex`, which Node 24 does
  // not have - and Node 24 is what the APK workflow runs, so three pushes in a
  // row failed on it. An older Android WebView would have failed the same way,
  // on a phone, where nobody would have seen a log. The legacy build carries
  // the polyfills for exactly that, and this is here so the import cannot
  // quietly go back.
  const source = readFileSync(
    new URL('../../src/app/core/statements/pdf-text.ts', import.meta.url), 'utf8');
  assert.match(source, /import\('pdfjs-dist\/legacy\/build\/pdf\.mjs'\)/);

  const angular = readFileSync(new URL('../../angular.json', import.meta.url), 'utf8');
  assert.match(angular, /node_modules\/pdfjs-dist\/legacy\/build/,
    'and the worker copied beside the app is the legacy one too');
});
