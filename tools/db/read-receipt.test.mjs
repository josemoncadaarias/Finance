// A photo of a receipt, read as the phone's text recognition hands it over
// (Jose, 2026-10-22). Every shop, figure and line here is INVENTED.
//
//   node --import ./tools/db/register-ts.mjs --test tools/db/read-receipt.test.mjs

import test from 'node:test';
import assert from 'node:assert/strict';

import { amountsIn, readReceipt } from '../../src/app/core/receipts/read-receipt.ts';
import { itemsOfPage, itemsOfPages } from '../../src/app/core/statements/ocr-items.ts';

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

/**
 * A long supermarket receipt photographed at an angle: the figures of the
 * summary sit lower than their words, each beside the next word down (Jose,
 * 2026-10-22: "VALOR TOTAL" read the saving printed above it). Invented.
 */
function tilted(itemsRows, summary, after, slide) {
  const lines = [];
  let top = 40;
  for (const [left, right] of itemsRows) {
    if (left) lines.push({ text: left, left: 20, top, right: 400, bottom: top + 28 });
    if (right) lines.push({ text: right, left: 520, top, right: 700, bottom: top + 28 });
    top += 42;
  }
  for (const [left, right] of summary) {
    lines.push({ text: left, left: 20, top, right: 300, bottom: top + 28 });
    if (right) lines.push({ text: right, left: 520, top: top + slide, right: 700, bottom: top + slide + 28 });
    top += 42;
  }
  for (const left of after) {
    lines.push({ text: left, left: 20, top, right: 400, bottom: top + 28 });
    top += 42;
  }
  return itemsOfPage({ width: 720, height: top + 40, lines }, 1);
}

const ITEMS = [
  ['MERCADO LAS PALMAS SEDE NORTE', ''],
  ['FACTURA ELECTRONICA DE VENTA', ''],
  ['2026-10-19 18:06:53', ''],
  ['1 1/u x 40.500 V.Ahorro 4.050', ''],
  ['1605752 Crema Manos', '36.450'],
  ['2 1/u x 30.000 V.Ahorro 8.000', ''],
  ['3534007 Jabon Barra', '22.000A'],
  ['3401545 Galletas', '9.950A'],
  ['6261 IMPUESTO BOLSA P', '66'],
  ['Total Item :4', ''],
];
const SUMMARY_ROWS = [
  ['SUBTOTAL', '80.516'],
  ['DESCUENTO', '10.513'],
  ['AHORRO', '12.050'],
  ['VALOR TOTAL', '68.466'],
];

test('a tilted photo: the figures slid a row down still go with their words', () => {
  const r = readReceipt(tilted(ITEMS, SUMMARY_ROWS, ['FORMA PAGO CONTADO', 'TARJETA DEBITO'], 30), TODAY);
  assert.equal(r.totalMinor, 6846600);
  assert.equal(r.totalSure, true);
  assert.equal(r.onDate, '2026-10-19');
  assert.equal(r.shop, 'Mercado Las Palmas Sede Norte');
});

test('a tilted photo the other way: the figures slid a row up', () => {
  const r = readReceipt(tilted(ITEMS, SUMMARY_ROWS, ['FORMA PAGO CONTADO', 'TARJETA DEBITO'], -30), TODAY);
  assert.equal(r.totalMinor, 6846600);
});

test('the same receipt held level reads the same total', () => {
  const r = readReceipt(tilted(ITEMS, SUMMARY_ROWS, ['FORMA PAGO CONTADO', 'TARJETA DEBITO'], 0), TODAY);
  assert.equal(r.totalMinor, 6846600);
});

test('a pen stroke read as a figure, the column slid and a saving misread', () => {
  // The signature over the summary reads as a "4" beside SUBTOTAL, every
  // figure sits a row low, and 12.050 came out 13.060, so nothing adds up.
  const r = readReceipt(tilted(ITEMS, [
    ['SUBTOTAL 4', ''],
    ['DESCUENTO', '80.516'],
    ['AHORRO', '10.513'],
    ['VALOR TOTAL', '13.060'],
  ], ['FORMA PAGO CONTADO 68.466', 'TARJETA DEBITO', 'DISCRIMINACION TARIFAS IMPUESTOS',
    'TARIFA COMPRA BASE IMPUESTO', 'A-IVA=19% 57.475 48.298 9.177', 'RES. DIAN 18764094333946'], 0), TODAY);
  assert.equal(r.totalMinor, 6846600);
  assert.equal(r.totalSure, true);
});

test('cash handed over and change never pass for the total', () => {
  const r = readReceipt(tilted([['PANADERIA SOL', '']], [['SUBTOTAL', '12.605'], ['IVA', '2.395'], ['TOTAL', '15.000'], ['EFECTIVO', '20.000'], ['CAMBIO', '5.000']], [], 30), TODAY);
  assert.equal(r.totalMinor, 1500000);
});

// A photographed supermarket receipt as the phone's reader handed it back,
// lines and boxes as they came (shop, person and ID numbers removed): every
// figure of the summary slid a row down, the saving misread (15.050 as
// 16.060), the discount too, and a tax table printed under the total.
const PHOTO_READ = [{"width": 555, "height": 1504, "lines": [{"text": "TIENDA SOL SEDE NORTE", "left": 40, "top": 44, "right": 372, "bottom": 70}, {"text": "2026-09-26 20:06:53", "left": 32, "top": 350, "right": 518, "bottom": 390}, {"text": "PLU", "left": 34, "top": 459, "right": 69, "bottom": 478}, {"text": "DETALLE", "left": 197, "top": 452, "right": 283, "bottom": 474}, {"text": "6261", "left": 40, "top": 1012, "right": 82, "bottom": 1033}, {"text": "1 1/u x 50.500 V.Ahorro 5.050", "left": 42, "top": 473, "right": 403, "bottom": 500}, {"text": "1605752 Crema N4 Pratect", "left": 36, "top": 500, "right": 336, "bottom": 520}, {"text": "2 1/u x 40.000 V.Ahorro 10.000", "left": 35, "top": 522, "right": 418, "bottom": 543}, {"text": "3534007 Bandas Cera Depi", "left": 35, "top": 546, "right": 334, "bottom": 566}, {"text": "3 1/u x 9.950 V.Ahorro 0", "left": 35, "top": 569, "right": 334, "bottom": 587}, {"text": "3401545 Galleta Taco X 3", "left": 36, "top": 591, "right": 336, "bottom": 609}, {"text": "4 1/u x 9.900 V.Ahorro 0", "left": 36, "top": 613, "right": 336, "bottom": 632}, {"text": "3583516 Galleta Con Dulc", "left": 35, "top": 631, "right": 334, "bottom": 655}, {"text": "5 1/u x 8.090 V.Ahorro 0", "left": 35, "top": 654, "right": 333, "bottom": 677}, {"text": "1664589 COMPOTA ORG-NICA", "left": 37, "top": 676, "right": 334, "bottom": 699}, {"text": "6 1/u x 7.730 V.Ahorro 0", "left": 36, "top": 697, "right": 333, "bottom": 722}, {"text": "842060 COMPOTA ORGNICA", "left": 36, "top": 719, "right": 334, "bottom": 743}, {"text": "7 1/u x 4.980 V.Ahorro 0", "left": 36, "top": 739, "right": 332, "bottom": 765}, {"text": "3521527 Compota S/J Mang", "left": 37, "top": 760, "right": 334, "bottom": 787}, {"text": "8 1/u x 4.270 V.Ahorro 0", "left": 37, "top": 783, "right": 332, "bottom": 807}, {"text": "3554088 Compota Pera 100", "left": 37, "top": 803, "right": 331, "bottom": 830}, {"text": "9 1/u x 4.120 V.Ahorro 0", "left": 37, "top": 823, "right": 333, "bottom": 852}, {"text": "1740499 YOGURT SIN DULCE", "left": 38, "top": 845, "right": 333, "bottom": 872}, {"text": "10 1/u x 4.120 V.Ahorro 0", "left": 38, "top": 865, "right": 346, "bottom": 895}, {"text": "1740499 YOGURT SIN DULCE", "left": 39, "top": 886, "right": 333, "bottom": 915}, {"text": "11 1/u x 4.120 V.Ahorro 0", "left": 38, "top": 907, "right": 346, "bottom": 937}, {"text": "1740499 YOGURT SIN DULCE", "left": 39, "top": 929, "right": 333, "bottom": 956}, {"text": "12 1/u x 195 V.Ahorro 0", "left": 39, "top": 948, "right": 320, "bottom": 979}, {"text": "3883911 BOLSA PL4STICA P", "left": 44, "top": 969, "right": 332, "bottom": 1000}, {"text": "13 1/u x 55", "left": 39, "top": 991, "right": 170, "bottom": 1013}, {"text": "IMPUEOhorro O", "left": 136, "top": 992, "right": 306, "bottom": 1035}, {"text": "Total Item i13", "left": 40, "top": 1031, "right": 206, "bottom": 1057}, {"text": "BOLSA P", "left": 248, "top": 1019, "right": 331, "bottom": 1039}, {"text": "SUBTOTAL", "left": 39, "top": 1090, "right": 133, "bottom": 1114}, {"text": "DESCUENTO", "left": 40, "top": 1112, "right": 146, "bottom": 1135}, {"text": "AHORRO", "left": 40, "top": 1133, "right": 108, "bottom": 1153}, {"text": "VALOR TOTAL", "left": 40, "top": 1150, "right": 167, "bottom": 1178}, {"text": "FORMA PAGO /CONTADO", "left": 39, "top": 1170, "right": 269, "bottom": 1204}, {"text": "TARJETA DEBITO", "left": 41, "top": 1193, "right": 206, "bottom": 1220}, {"text": "DISCRIMINACION", "left": 42, "top": 1271, "right": 207, "bottom": 1297}, {"text": "PRECIO", "left": 410, "top": 450, "right": 490, "bottom": 471}, {"text": "45.450", "left": 423, "top": 495, "right": 498, "bottom": 516}, {"text": "30.000A", "left": 422, "top": 544, "right": 515, "bottom": 563}, {"text": "9.950A", "left": 435, "top": 591, "right": 513, "bottom": 609}, {"text": "9.900A", "left": 433, "top": 638, "right": 510, "bottom": 656}, {"text": "8.090A", "left": 432, "top": 683, "right": 510, "bottom": 702}, {"text": "7.730A", "left": 432, "top": 728, "right": 508, "bottom": 747}, {"text": "4.980A", "left": 430, "top": 770, "right": 505, "bottom": 791}, {"text": "4.270A", "left": 430, "top": 816, "right": 506, "bottom": 835}, {"text": "4.120A", "left": 429, "top": 860, "right": 505, "bottom": 878}, {"text": "4.120A", "left": 428, "top": 902, "right": 504, "bottom": 921}, {"text": "4.120A", "left": 428, "top": 945, "right": 502, "bottom": 962}, {"text": "THRIFA COMPRA BASE.NPUESTOS", "left": 43, "top": 1287, "right": 432, "bottom": 1319}, {"text": "A-IVA19% 87.476 73.608 13.967", "left": 41, "top": 1308, "right": 401, "bottom": 1348}, {"text": "196A", "left": 454, "top": 986, "right": 501, "bottom": 1004}, {"text": "56", "left": 464, "top": 1027, "right": 486, "bottom": 1044}, {"text": "148.030", "left": 399, "top": 1102, "right": 483, "bottom": 1127}, {"text": "13.463", "left": 412, "top": 1126, "right": 483, "bottom": 1144}, {"text": "16.060", "left": 412, "top": 1146, "right": 483, "bottom": 1168}, {"text": "132.980", "left": 399, "top": 1165, "right": 482, "bottom": 1187}, {"text": "RES. DIAN# 18764094333946 VIQ 24 MEStS", "left": 41, "top": 1349, "right": 488, "bottom": 1388}]}];

test('a real reading: the total is the one under the slid column, not the saving', () => {
  const r = readReceipt(itemsOfPages(PHOTO_READ), TODAY);
  assert.equal(r.totalMinor, 13298000);
  assert.equal(r.onDate, '2026-09-26');
});
