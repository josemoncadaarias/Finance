// A photo of a statement, read as a PDF would be (rule 22's OCR door).
// The lines below are INVENTED, laid out as the phone's text recognition
// hands them back: boxes in pixels, the top of the image at 0.
//
//   node --import ./tools/db/register-ts.mjs --test tools/db/ocr-items.test.mjs

import test from 'node:test';
import assert from 'node:assert/strict';

import { itemsOfPage, itemsOfPages, mendNumbers } from '../../src/app/core/statements/ocr-items.ts';
import { linesOf, readStatement } from '../../src/app/core/statements/statement.ts';

const at = (text, left, top, h = 30, w = 300) => ({ text, left, top, right: left + w, bottom: top + h });

test('a space read inside a figure is mended; words are left alone', () => {
  assert.equal(mendNumbers('$ 45. 900,00'), '$ 45.900,00');
  assert.equal(mendNumbers('1 .234.567, 89'), '1.234.567,89');
  assert.equal(mendNumbers('Compra  en   TIENDA, 2 unidades'), 'Compra en TIENDA, 2 unidades');
});

test('columns of one row, a little crooked, are one line in reading order', () => {
  const page = { width: 1200, height: 1600, lines: [
    at('-45.900,00', 900, 212), at('12/10/2026', 40, 200), at('COMPRA TIENDA AZUL', 300, 205),
    at('15/10/2026', 40, 260), at('PAGO NOMINA', 300, 262), at('+2.500.000,00', 900, 258),
  ] };
  const lines = linesOf(itemsOfPage(page, 1));
  assert.deepEqual(lines.map(l => l.text), [
    '12/10/2026 COMPRA TIENDA AZUL -45.900,00',
    '15/10/2026 PAGO NOMINA +2.500.000,00',
  ]);
});

test('x is scaled to a page of about 600 points; pages keep their order', () => {
  const one = { width: 1200, height: 800, lines: [at('a', 600, 10)] };
  const two = { width: 2400, height: 800, lines: [at('b', 1200, 10)] };
  const items = itemsOfPages([one, two]);
  assert.deepEqual(items.map(i => [i.text, i.x, i.page]), [['a', 300, 1], ['b', 300, 2]]);
});

test('a statement photographed reads its rows, its sign and its balances', () => {
  const rows = [
    ['Saldo anterior', '', '1.000.000,00'],
    ['05/10/2026 COMPRA MERCADO VERDE', '-120.000,00', '880.000,00'],
    ['09/10/2026 PAGO NOMINA', '+3.000.000,00', '3.880.000,00'],
    ['18/10/2026 RETIRO CAJERO', '-200. 000,00', '3.680.000,00'],
    ['Saldo final', '', '3.680.000,00'],
  ];
  const lines = [];
  rows.forEach(([text, amount, balance], i) => {
    const top = 100 + i * 60 + (i % 2) * 6;
    lines.push(at(text, 30, top, 32, 560));
    if (amount) lines.push(at(amount, 640, top + 4, 32, 180));
    lines.push(at(balance, 880, top - 3, 32, 200));
  });
  const reading = readStatement(itemsOfPage({ width: 1100, height: 600, lines }, 1), 2);
  assert.deepEqual(reading.rows.map(r => [r.occurred_on, r.amount_minor]), [
    ['2026-10-05', -12000000], ['2026-10-09', 300000000], ['2026-10-18', -20000000],
  ]);
  assert.equal(reading.opening_minor, 100000000);
  assert.equal(reading.closing_minor, 368000000);
  assert.equal(reading.balances, 'checked');
});

test('an image with no text gives nothing', () => {
  assert.deepEqual(itemsOfPage({ width: 100, height: 100, lines: [] }, 1), []);
});
