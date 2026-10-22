// A photo of a receipt, read as the phone's text recognition hands it over
// (Jose, 2026-10-22). Every shop, figure and line here is INVENTED.
//
//   node --import ./tools/db/register-ts.mjs --test tools/db/read-receipt.test.mjs

import test from 'node:test';
import assert from 'node:assert/strict';

import { amountsIn, readReceipt } from '../../src/app/core/receipts/read-receipt.ts';
import { itemsOfPage } from '../../src/app/core/statements/ocr-items.ts';

const TODAY = '2026-10-22';
/** A receipt as rows of [left text, right text], laid out as a photo would be. */
function photo(rows) {
  const lines = [];
  rows.forEach(([left, right], i) => {
    const top = 40 + i * 42 + (i % 3) * 3;
    if (left) lines.push({ text: left, left: 20, top, right: 400, bottom: top + 28 });
    if (right) lines.push({ text: right, left: 520, top: top + 2, right: 700, bottom: top + 30 });
  });
  return itemsOfPage({ width: 720, height: 40 + rows.length * 42, lines }, 1);
}

test('amounts in a line, not dates nor hours', () => {
  assert.deepEqual(amountsIn('TOTAL A PAGAR $ 45.900'), [4590000]);
  assert.deepEqual(amountsIn('Fecha 12/10/2026 10:45'), []);
  assert.deepEqual(amountsIn('2 x 3.500 7.000,00'), [350000, 700000]);
});

test('a shop receipt: the total to pay, its day and its name', () => {
  const r = readReceipt(photo([
    ['SUPERMERCADO LA ESQUINA', ''],
    ['NIT 900.123.456-7', ''],
    ['Calle 10 # 20-30 Tel 6041234567', ''],
    ['Factura POS No. 12345', ''],
    ['Fecha: 18/10/2026 Hora: 17:32', ''],
    ['ARROZ 1KG', '4.500'],
    ['LECHE ENTERA', '3.900'],
    ['SUBTOTAL', '7.479'],
    ['IVA 19%', '921'],
    ['TOTAL A PAGAR', '$ 8.400'],
    ['EFECTIVO', '10.000'],
    ['CAMBIO', '1.600'],
  ]), TODAY);
  assert.equal(r.totalMinor, 840000);
  assert.equal(r.totalSure, true);
  assert.equal(r.onDate, '2026-10-18');
  assert.equal(r.shop, 'Supermercado La Esquina');
});

test('the amount on the line under TOTAL, and a date written with the month', () => {
  const r = readReceipt(photo([
    ['Café del Parque', ''],
    ['15 OCT 2026', ''],
    ['Capuchino', '9.000'],
    ['Croissant', '7.500'],
    ['TOTAL', ''],
    ['', '16.500'],
  ]), TODAY);
  assert.equal(r.totalMinor, 1650000);
  assert.equal(r.onDate, '2026-10-15');
  assert.equal(r.shop, 'Café del Parque');
});

test('a total stated twice: the one that says what is paid wins', () => {
  const r = readReceipt(photo([
    ['RESTAURANTE EL FOGÓN', ''],
    ['TOTAL', '52.000'],
    ['Propina voluntaria', '5.200'],
    ['TOTAL A PAGAR', '57.200'],
    ['Total ítems', '3'],
  ]), TODAY);
  assert.equal(r.totalMinor, 5720000);
});

test('no line says total: the largest amount, said to be unsure', () => {
  const r = readReceipt(photo([
    ['Ferretería Norte', ''],
    ['Tornillos', '2.000'],
    ['Pintura', '35.000'],
    ['Cambio', '63.000'],
  ]), TODAY);
  assert.equal(r.totalMinor, 3500000);
  assert.equal(r.totalSure, false);
});

test('a date in the future or two years old is not the receipt\'s', () => {
  const r = readReceipt(photo([
    ['Tienda Azul', ''],
    ['Válido hasta 31/12/2027', ''],
    ['Resolución desde 01/01/2020', ''],
    ['TOTAL', '10.000'],
  ]), TODAY);
  assert.equal(r.onDate, null);
});

test('nothing readable gives nothing', () => {
  const r = readReceipt([], TODAY);
  assert.deepEqual(r, { totalMinor: null, totalSure: false, onDate: null, shop: null });
});
