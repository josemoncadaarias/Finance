// Reading a bank statement, and proving the reading.
//
//   node --import ./tools/db/register-ts.mjs --test tools/db/statement.test.mjs
//
// No PDF here: a PDF is text with coordinates, and this is that text. The part
// that decides what a line means is what has judgement in it, so it is the
// part that gets tested. Rule 22.

import test from 'node:test';
import assert from 'node:assert/strict';

import { dateIn, moneyIn, yearIn } from '../../src/app/core/statements/tokens.ts';
import { accountIn, linesOf, readStatement } from '../../src/app/core/statements/statement.ts';

const COP = 2;

/** A page, written the way a statement is laid out: columns at fixed places. */
function page(rows, { page: number = 1 } = {}) {
  const items = [];
  let y = 800;
  for (const row of rows) {
    for (const [x, text] of row) items.push({ text, x, y, page: number });
    y -= 12;
  }
  return items;
}

// ---------------------------------------------------------------------------
// What a thing is, by its shape
// ---------------------------------------------------------------------------

test('a date is read however the bank writes it', () => {
  assert.equal(dateIn('10/09/2026 COMPRA EXITO', null), '2026-09-10');
  assert.equal(dateIn('2026-09-10 COMPRA', null), '2026-09-10');
  assert.equal(dateIn('10-SEP-2026 COMPRA', null), '2026-09-10');
  assert.equal(dateIn('10 SEP 26 COMPRA', null), '2026-09-10');
  assert.equal(dateIn('10/09 COMPRA', 2026), '2026-09-10', 'the year comes from the statement');
  assert.equal(dateIn('10/09 COMPRA', null), null, 'and without it, nothing is invented');
});

test('a day that does not exist is not a date', () => {
  assert.equal(dateIn('31/02/2026 ALGO', null), null);
  assert.equal(dateIn('45/13/2026 ALGO', null), null);
});

test('a date is only read where a date can be', () => {
  assert.equal(dateIn('REF 10/09/2026', null), null, 'a reference is not a date');
});

test('the year of the statement is the one it repeats', () => {
  assert.equal(yearIn('Extracto 2026 - periodo 01/09/2026 al 30/09/2026. Cliente desde 2019'), 2026);
  assert.equal(yearIn('sin fechas'), null);
});

test('an amount is read in both conventions, and a reference is not an amount', () => {
  assert.equal(moneyIn('45.000,00', COP).minor, 4_500_000);
  assert.equal(moneyIn('45,000.00', COP).minor, 4_500_000);
  assert.equal(moneyIn('$1.234.567,89', COP).minor, 123_456_789);
  assert.equal(moneyIn('300.000', COP).minor, 30_000_000, 'three hundred thousand pesos');
  assert.equal(moneyIn('4321', COP), null, "a card's last four digits");
  assert.equal(moneyIn('REF123', COP), null);
});

test('a statement says a number is negative in four different ways', () => {
  assert.equal(moneyIn('-45.000,00', COP).negative, true);
  assert.equal(moneyIn('45.000,00-', COP).negative, true);
  assert.equal(moneyIn('(45.000,00)', COP).negative, true);
  assert.equal(moneyIn('45.000,00 DB', COP).negative, true);
  assert.equal(moneyIn('45.000,00', COP).negative, false);
});

test('a minus in a typeset PDF is rarely the ASCII one', () => {
  // Jose's Rappi statement, 2026-09-23: every line carried its own sign and
  // all seventy were read as expenses, cashback included.
  for (const dash of ['−', '–', '—', '‐', '－']) {
    const token = moneyIn(`${dash}$26.180,00`, COP);
    assert.equal(token.negative, true, `${dash.codePointAt(0).toString(16)} is a minus`);
    assert.equal(token.minor, 2_618_000, 'and the number is still the number');
  }
});

test('a statement that writes a plus means it', () => {
  assert.equal(moneyIn('+$329,99', COP).positive, true);
  assert.equal(moneyIn('45.000,00 CR', COP).positive, true);
  assert.equal(moneyIn('-45.000,00', COP).positive, false);
  // Said nothing either way: not positive, and not negative either. The sign
  // is then somebody else's problem - the balance column's, or the words'.
  assert.equal(moneyIn('45.000,00', COP).positive, false);
  assert.equal(moneyIn('+$329,99', COP).minor, 32_999);
});

test('everything printed at the same height is one line', () => {
  const lines = linesOf([
    { text: 'COMPRA', x: 100, y: 500, page: 1 },
    { text: '10/09', x: 40, y: 501, page: 1 },
    { text: '45.000', x: 300, y: 500, page: 1 },
    { text: 'OTRA', x: 40, y: 480, page: 1 },
  ]);
  assert.equal(lines.length, 2);
  assert.equal(lines[0].text, '10/09 COMPRA 45.000', 'and in the order it is printed');
});

// ---------------------------------------------------------------------------
// The running balance, which is what makes the reading provable
// ---------------------------------------------------------------------------

const STATEMENT = page([
  [[40, 'BANCO DE PRUEBA'], [300, 'Extracto septiembre 2026']],
  [[40, 'Saldo anterior'], [420, '1.000.000,00']],
  [[40, '01/09'], [80, 'COMPRA EXITO POBLADO'], [300, '45.000,00'], [420, '955.000,00']],
  [[40, '03/09'], [80, 'PAGO NOMINA ACME'], [300, '2.000.000,00'], [420, '2.955.000,00']],
  [[40, '05/09'], [80, 'COMPRA RAPPI'], [300, '30.000,00'], [420, '2.925.000,00']],
  [[40, '07/09'], [80, 'RETIRO CAJERO'], [300, '200.000,00'], [420, '2.725.000,00']],
  [[40, 'Saldo final'], [420, '2.725.000,00']],
]);

test('the balance column decides the sign, and the reading is proved end to end', () => {
  const read = readStatement(STATEMENT, COP);

  assert.equal(read.rows.length, 4);
  assert.deepEqual(read.rows.map(row => row.amount_minor), [
    -4_500_000, 200_000_000, -3_000_000, -20_000_000,
  ]);
  assert.ok(read.rows.every(row => row.confidence === 'high'), 'arithmetic, not a guess');
  assert.equal(read.balances, 'checked');
  assert.equal(read.opening_minor, 100_000_000);
  assert.equal(read.closing_minor, 272_500_000);
});

test('a statement with no balance column is read by its own signs', () => {
  // Rappi cuenta, as Jose's August statement is laid out: three columns and
  // no running balance, with every amount carrying a + or a typeset minus.
  const rappi = page([
    [[40, 'Movimientos agosto 2026']],
    [[40, 'Fecha'], [170, 'Descripción'], [700, 'Valor']],
    [[40, '03 Ago 2026'], [170, 'Redención Cashback'], [700, '+$329,99']],
    [[40, '03 Ago 2026'], [170, 'Envío a otra llave'], [700, '−$26.180,00']],
    [[40, '04 Ago 2026'], [170, 'Pago de RappiCard'], [700, '−$655.771,10']],
    [[40, '06 Ago 2026'], [170, 'Depósito desde llave'], [700, '+$4.638,00']],
  ]);
  const read = readStatement(rappi, COP);

  assert.deepEqual(read.rows.map(row => row.amount_minor), [
    32_999, -2_618_000, -65_577_110, 463_800,
  ]);
  assert.ok(
    read.rows.every(row => row.confidence === 'high'),
    'the bank wrote the sign itself, so nothing here was guessed at');
});

test('what was read carries its own line, for anyone who wants to check it', () => {
  const [first] = readStatement(STATEMENT, COP).rows;
  assert.equal(first.description, 'COMPRA EXITO POBLADO', 'the date and the numbers are not description');
  assert.ok(first.line.includes('45.000,00'), 'and the line it came from is kept whole');
  assert.equal(first.balance_minor, 95_500_000);
});

test('a column that adds up beats the words on the page, and says so quietly', () => {
  const broken = page([
    [[40, 'Extracto septiembre 2026']],
    [[40, 'Saldo anterior'], [420, '1.000.000,00']],
    [[40, '01/09'], [80, 'COMPRA UNO'], [300, '45.000,00'], [420, '955.000,00']],
    [[40, '03/09'], [80, 'COMPRA DOS'], [300, '5.000,00'], [420, '950.000,00']],
    [[40, 'Saldo final'], [420, '900.000,00']],
  ]);
  const read = readStatement(broken, COP);
  // Its column adds up and its own words say otherwise, which is one of the
  // two being misread - nearly always the words, because a page carries
  // several lines with "saldo" on them. Said quietly rather than as a fault:
  // crying wolf over a file that was read correctly is the worse failure, and
  // it is what Jose met on his Uala statement.
  assert.equal(read.balances, 'unclear');
  assert.equal(read.opening_minor, 100_000_000, 'the column decides');
  assert.equal(read.closing_minor, 95_000_000);
});

test('with no balance column at all the words decide, and say they guessed', () => {
  const plain = page([
    [[40, 'Extracto septiembre 2026']],
    [[40, '01/09'], [80, 'COMPRA EXITO'], [300, '45.000,00']],
    [[40, '03/09'], [80, 'ABONO NOMINA'], [300, '2.000.000,00']],
    [[40, '05/09'], [80, 'COMPRA RAPPI'], [300, '30.000,00']],
  ]);
  const read = readStatement(plain, COP);

  assert.deepEqual(read.rows.map(row => row.amount_minor), [-4_500_000, 200_000_000, -3_000_000]);
  assert.ok(read.rows.every(row => row.confidence === 'low'), 'and every one of them admits it');
  assert.equal(read.balances, 'unchecked');
});

test('a movement in two columns of debit and credit is read by the balance too', () => {
  const columns = page([
    [[40, 'Extracto septiembre 2026']],
    [[40, 'Saldo anterior'], [500, '1.000.000,00']],
    [[40, '01/09'], [80, 'COMPRA'], [300, '45.000,00'], [400, ''], [500, '955.000,00']],
    [[40, '03/09'], [80, 'CONSIGNACION'], [300, ''], [400, '500.000,00'], [500, '1.455.000,00']],
    [[40, '05/09'], [80, 'COMPRA'], [300, '55.000,00'], [400, ''], [500, '1.400.000,00']],
    [[40, 'Saldo final'], [500, '1.400.000,00']],
  ]);
  const read = readStatement(columns, COP);
  assert.deepEqual(read.rows.map(row => row.amount_minor), [-4_500_000, 50_000_000, -5_500_000]);
  assert.equal(read.balances, 'checked');
});

test('headings, totals and telephone numbers are not movements', () => {
  const noisy = page([
    [[40, 'BANCO DE PRUEBA S.A. NIT 890.903.938-8']],
    [[40, 'Extracto septiembre 2026']],
    [[40, 'Linea de atencion 018000 912345']],
    [[40, 'Saldo anterior'], [420, '100.000,00']],
    [[40, '01/09'], [80, 'COMPRA'], [300, '10.000,00'], [420, '90.000,00']],
    [[40, 'TOTAL MOVIMIENTOS'], [300, '10.000,00']],
    [[40, 'Saldo final'], [420, '90.000,00']],
  ]);
  const read = readStatement(noisy, COP);
  assert.equal(read.rows.length, 1);
  assert.equal(read.balances, 'checked');
});

test('a statement of several pages is read in order', () => {
  const first = page([
    [[40, 'Extracto septiembre 2026']],
    [[40, 'Saldo anterior'], [420, '100.000,00']],
    [[40, '01/09'], [80, 'UNO'], [300, '10.000,00'], [420, '90.000,00']],
  ]);
  const second = page([
    [[40, '02/09'], [80, 'DOS'], [300, '20.000,00'], [420, '70.000,00']],
    [[40, 'Saldo final'], [420, '70.000,00']],
  ], { page: 2 });

  // Handed over in the wrong order on purpose: the page decides, not the array.
  const read = readStatement([...second, ...first], COP);
  assert.deepEqual(read.rows.map(row => row.description), ['UNO', 'DOS']);
  assert.equal(read.balances, 'checked');
});

test('a month is checked against itself, never against a history', () => {
  // The case Jose raised: a statement is one month of an account that has
  // been alive for years. Its opening balance is where THAT month started,
  // and nothing here ever looks at what the app thinks the account holds.
  const month = page([
    [[40, 'BANCO DE PRUEBA'], [330, 'Extracto septiembre 2026']],
    [[40, 'Saldo anterior'], [440, '12.652.860,42']],
    [[40, '02/09'], [90, 'COMPRA EXITO'], [330, '209.631,16'], [440, '12.443.229,26']],
    [[40, '05/09'], [90, 'PAGO ARRIENDO'], [330, '1.800.000,00'], [440, '10.643.229,26']],
    [[40, '28/09'], [90, 'ABONO NOMINA'], [330, '6.400.000,00'], [440, '17.043.229,26']],
    [[40, 'Saldo final'], [440, '17.043.229,26']],
  ]);

  const read = readStatement(month, COP);
  assert.equal(read.balances, 'checked');
  assert.equal(read.opening_minor, 1_265_286_042, 'where the month began, not where the account did');
  assert.equal(read.read_minor, 439_036_884, 'and what the month itself moved');
  assert.equal(read.opening_minor + read.read_minor, read.closing_minor);
});

test('the other lines with the word saldo on them are not the balance', () => {
  // A real statement carries several: the average of the month, what is
  // available, the minimum to keep. Reading one of those as the closing
  // balance reports a perfectly good statement as broken, which is a worse
  // failure than not checking at all.
  const noisy = page([
    [[40, 'BANCO DE PRUEBA'], [330, 'Extracto septiembre 2026']],
    [[40, 'Saldo anterior'], [440, '1.000.000,00']],
    [[40, '02/09'], [90, 'COMPRA'], [330, '100.000,00'], [440, '900.000,00']],
    [[40, 'Saldo promedio del mes'], [440, '950.000,00']],
    [[40, 'Saldo disponible'], [440, '900.000,00']],
    [[40, 'Cupo disponible'], [440, '8.000.000,00']],
    [[40, 'Saldo final'], [440, '900.000,00']],
  ]);

  const read = readStatement(noisy, COP);
  assert.equal(read.balances, 'checked');
  assert.equal(read.closing_minor, 90_000_000);
  assert.equal(read.rows.length, 1, 'and none of those lines is a movement');
});

test('a statement that never names its balances is checked by its own column', () => {
  const quiet = page([
    [[40, 'BANCO DE PRUEBA'], [330, 'Extracto septiembre 2026']],
    [[40, '02/09'], [90, 'COMPRA'], [330, '100.000,00'], [440, '900.000,00']],
    [[40, '05/09'], [90, 'COMPRA'], [330, '50.000,00'], [440, '850.000,00']],
    [[40, '09/09'], [90, 'ABONO'], [330, '200.000,00'], [440, '1.050.000,00']],
  ]);

  const read = readStatement(quiet, COP);
  assert.equal(read.opening_minor, 100_000_000, 'the first line says what came before it');
  assert.equal(read.closing_minor, 105_000_000);
  assert.equal(read.balances, 'checked');
});

// ---------------------------------------------------------------------------
// What a statement says about the account it belongs to
// ---------------------------------------------------------------------------

test('a statement names its bank, its opening balance and its first day', () => {
  const items = page([
    [[40, 'BANCO AZUL S.A.'], [330, 'Extracto de cuenta - septiembre 2026']],
    [[40, 'Cuenta de ahorros No. 556-120034-71'], [330, 'Periodo: 01/09/2026 al 30/09/2026']],
    [[40, 'Saldo anterior'], [440, '1.250.000,00']],
    [[40, '02/09'], [90, 'COMPRA EXITO'], [330, '145.300,00'], [440, '1.104.700,00']],
    [[40, '05/09'], [90, 'COMPRA RAPPI'], [330, '38.900,00'], [440, '1.065.800,00']],
    [[40, 'Saldo final'], [440, '1.065.800,00']],
  ]);

  const said = accountIn(readStatement(items, COP), items);
  assert.equal(said.name, 'BANCO AZUL', 'without the lawyers');
  assert.equal(said.opening_minor, 125_000_000, 'which is what an account created from this starts at');
  assert.equal(said.opened_on, '2026-09-02');
});

test('the bank is not the word "Extracto", nor a NIT, nor a figure', () => {
  const items = page([
    [[40, 'Estado de cuenta']],
    [[40, 'NIT 890.903.938-8']],
    [[40, 'COOPERATIVA DE PRUEBA LTDA']],
    [[40, 'Saldo anterior'], [440, '100.000,00']],
    [[40, '02/09/2026'], [90, 'COMPRA'], [330, '10.000,00'], [440, '90.000,00']],
  ]);

  assert.equal(accountIn(readStatement(items, COP), items).name, 'COOPERATIVA DE PRUEBA');
});

test('a statement that says nothing about its account invents nothing', () => {
  const items = page([
    [[40, '02/09/2026'], [90, 'COMPRA'], [330, '10.000,00']],
  ]);

  const said = accountIn(readStatement(items, COP), items);
  assert.equal(said.opening_minor, null);
  assert.equal(said.name, null, 'a movement is not a bank');
});

// ---------------------------------------------------------------------------
// A credit card's statement (Rappi Card, laid out as Jose's of September 2026;
// names and figures copied from its screenshots, 2026-10-15)
// ---------------------------------------------------------------------------

function cardStatement() {
  const row = (card, on, what, amount, billed, quotas, pending, mv, ea) => [
    [40, card], [100, on], [170, what], [330, amount], [420, billed],
    [500, quotas], [560, pending], [640, mv], [690, ea],
  ];
  return page([
    [[40, 'RappiCard']],
    [[40, 'Producto emitido por Davivienda S.A.']],
    [[40, 'Extracto de tarjeta de crédito']],
    [[40, 'Cupo utilizado'], [200, 'Pago mínimo'], [330, 'Periodo facturado'], [500, 'Fecha de pago']],
    [[40, '$ 1.487.278,42'], [200, '$ 365.660,79'], [330, 'Desde 21 ago 2026'], [500, '01 oct 2026']],
    [[40, 'Cupo total:'], [100, '$7.950.000,00'], [200, 'Pago total'], [260, '$ 1.487.278,42'], [330, 'Hasta 20 sept 2026']],
    [[40, 'Cashback'], [150, 'Saldo anterior'], [300, '$2.549,90'], [500, 'Saldo disponible'], [600, '$2.549,90']],
    [[40, 'Saldo en mora'], [250, '$0,00'], [330, 'Saldo periodo anterior'], [600, '$0,00']],
    [[40, '+ Capital facturado consumos del mes'], [250, '$354.559,37'], [330, '+ Consumos del mes'], [600, '$9.136.880,00']],
    [[40, 'Pago mínimo'], [250, '$365.660,79'], [330, 'Pago total'], [600, '$1.487.278,42']],
    [[40, 'Tarjeta'], [100, 'Fecha'], [170, 'Descripción'], [330, 'Valor transacción']],
    row('Virtual', '2026-08-26', 'RAPPI', '$4.549,00', '$0,00', 'N/A', '$0,00', '0,0000%', '0,00%'),
    row('Virtual', '2026-08-26', 'RAPPI', '$29.388,00', '$0,00', 'N/A', '$0,00', '0,0000%', '0,00%'),
    row('-', '2026-08-28', 'PAGOS RAPPIPAY APP', '$-43.834,00', 'N/A', 'N/A', 'N/A', '0%', '0,00%'),
    row('Virtual', '2026-08-28', 'AVIANCA SA C3UPZJ', '$6.056.850,00', '$0,00', 'N/A', '$0,00', '0,0000%', '0,00%'),
    row('-', '2026-09-03', 'PAGOS POR PSE', '$-3.000.000,00', 'N/A', 'N/A', 'N/A', '0%', '0,00%'),
    row('Virtual', '2026-09-09', 'AJUSTE COMPRA REDIFERIDO', '$1.284.887,00', '$163.269,37', '1 de 8', '$1.121.617,63', '2,1600%', '29,23%'),
    row('-', '2026-09-09', 'AJUSTE PAGO REDIFERIDO', '$-1.284.887,00', 'N/A', 'N/A', 'N/A', '0%', '0,00%'),
    row('Virtual', '2026-09-13', 'DLOCAL COLOMBIA SAS', '$13.914,00', '$13.914,00', '1 de 1', '$0,00', '0,0000%', '0,00%'),
    row('Virtual', '2026-09-15', 'DLOCAL COLOMBIA SAS', '$16.440,00', '$16.440,00', '1 de 1', '$0,00', '0,0000%', '0,00%'),
    [[40, 'Transacciones: JOSE AUGUSTO MONCADA ARIAS *5813 (Compartida)']],
    row('Virtual', '2026-09-17', 'RAPPI COLOMBIA*DL', '$27.200,00', '$27.200,00', '1 de 1', '$0,00', '0,0000%', '0,00%'),
    [[40, 'Pago total'], [600, '$27.200,00']],
  ]);
}

test("a card statement's rows are read after the card's word, with its signs turned around", () => {
  const items = cardStatement();
  const read = readStatement(items, COP);

  assert.equal(read.card, true, 'it says it is a card in several ways');
  assert.equal(read.rows.length, 10, 'every dated row, behind "Virtual" or a dash');
  assert.deepEqual(read.rows.map(row => row.amount_minor), [
    -454_900, -2_938_800, 4_383_400, -605_685_000, 300_000_000,
 -128_488_700, 128_488_700, -1_391_400, -1_644_000, -2_720_000,
  ], 'a purchase leaves the card, a payment printed "$-..." comes back to it');
  assert.equal(read.rows[0].description, 'RAPPI');
  assert.equal(read.rows[5].description, 'AJUSTE COMPRA REDIFERIDO', 'no rates, quotas or N/A in it');
  assert.ok(read.rows.every(row => row.balance_minor === null), 'no column is taken for a balance');

  assert.equal(read.opening_minor, 0, 'what was owed before the period');
  assert.equal(read.closing_minor, -148_727_842, 'the first "Pago total", owed as a debt');
  assert.equal(read.credit_limit_minor, 795_000_000);

  const said = accountIn(read, items);
  assert.equal(said.card, true);
  assert.equal(said.credit_limit_minor, 795_000_000);
  assert.equal(said.opening_minor, 0, 'nothing was owed when the period began');
});

test('a heading with a date behind one word is still not a movement', () => {
  const read = readStatement(page([
    [[40, 'Corte'], [100, '20/09/2026'], [330, '$1.487.278,42']],
    [[40, '02/09/2026'], [100, 'COMPRA'], [330, '-45.000,00']],
    [[40, '03/09/2026'], [100, 'COMPRA'], [330, '-12.000,00']],
  ]), COP);
  assert.equal(read.rows.length, 2);
});

test('a debit statement that pays a card is not taken for a card', () => {
  const read = readStatement(page([
    [[40, '02/09/2026'], [100, 'PAGO TARJETA DE CREDITO'], [330, '-45.000,00']],
    [[40, '03/09/2026'], [100, 'NOMINA'], [330, '+12.000,00']],
  ]), COP);
  assert.equal(read.card, false);
  assert.deepEqual(read.rows.map(row => row.amount_minor), [-4_500_000, 1_200_000]);
});

// ---------------------------------------------------------------------------
// Other layouts banks use (invented rows in each one's shape, 2026-10-15)
// ---------------------------------------------------------------------------

test('a card statement whose rows start with an authorisation number and carry two dates', () => {
  const read = readStatement(page([
    [[40, 'Extracto Tarjeta de Crédito Mastercard'], [400, 'Pago mínimo'], [480, '$120.000,00']],
    [[40, 'Autorización'], [100, 'Fecha'], [160, 'Registro'], [220, 'Descripción'], [380, 'Valor original'], [470, 'Tasa'], [520, 'Saldo a diferir']],
    [[40, '483920'], [100, '25/09/2026'], [160, '26/09/2026'], [220, 'COMPRA EXITO POBLADO'], [380, '$45.900,00'], [470, '28,40'], [520, '$0,00']],
    [[40, '117355'], [100, '27/09/2026'], [160, '28/09/2026'], [220, 'MERCADO PAGO*HACEB'], [380, '$1.168.308,00'], [470, '28,40'], [520, '$973.590,00']],
    [[40, '000000'], [100, '30/09/2026'], [160, '30/09/2026'], [220, 'PAGO PSE GRACIAS'], [380, '$500.000,00 CR'], [470, '0,00'], [520, '$0,00']],
    [[40, '000001'], [100, '01/10/2026'], [160, '01/10/2026'], [220, 'PAGO SUCURSAL VIRTUAL'], [380, '$200.000,00'], [470, '0,00'], [520, '$0,00']],
  ]), COP);
  assert.equal(read.card, true);
  assert.deepEqual(read.rows.map(row => row.amount_minor), [-4_590_000, -116_830_800, 50_000_000, 20_000_000],
    'the authorisation number is no amount; CR and a row starting "PAGO" came back to the card, "MERCADO PAGO" did not');
  assert.deepEqual(read.rows.map(row => row.description),
    ['COMPRA EXITO POBLADO', 'MERCADO PAGO*HACEB', 'PAGO PSE GRACIAS', 'PAGO SUCURSAL VIRTUAL']);
});

test('a date with the month first is read, and a shop that starts like a month is not a date', () => {
  assert.equal(dateIn('Sep 12, 2026 AMAZON', null), '2026-09-12');
  assert.equal(dateIn('SEP 12 AMAZON', 2026), '2026-09-12');
  assert.equal(dateIn('Septiembre 12 de 2026', 2026), '2026-09-12');
  assert.equal(dateIn('12 MAYORISTA', 2026), null);
  assert.equal(dateIn('MARCA 12 COMPRA', 2026), null);
});

test('debits and credits in columns of their own, with no sign and no balance', () => {
  const read = readStatement(page([
    [[40, 'Fecha'], [100, 'Descripción'], [330, 'Débitos'], [430, 'Créditos']],
    [[40, '02/09/2026'], [100, 'COMPRA EN TIENDA'], [330, '45.000,00']],
    [[40, '03/09/2026'], [100, 'TRANSFERENCIA RECIBIDA'], [430, '120.000,00']],
    [[40, '05/09/2026'], [100, 'RETIRO CAJERO'], [330, '200.000,00']],
  ]), COP);
  assert.deepEqual(read.rows.map(row => row.amount_minor), [-4_500_000, 12_000_000, -20_000_000]);
});

test('a statement from December into January puts each day in its own year', () => {
  const read = readStatement(page([
    [[40, 'Periodo 21/12/2026 al 20/01/2027 - corte 2027 - pago 2027']],
    [[40, '28/12'], [100, 'COMPRA'], [330, '-45.000,00']],
    [[40, '05/01'], [100, 'COMPRA'], [330, '-12.000,00']],
  ]), COP);
  assert.deepEqual(read.rows.map(row => row.occurred_on), ['2026-12-28', '2027-01-05']);
});

test('the date leaves the description however it was written', () => {
  const read = readStatement(page([
    [[40, '03 Ago 2026'], [170, 'Redención Cashback'], [700, '+$329,99']],
    [[40, '04 Ago 2026'], [170, 'Envío a otra llave'], [700, '−$26.180,00']],
  ]), COP);
  assert.deepEqual(read.rows.map(row => row.description), ['Redención Cashback', 'Envío a otra llave']);
});
