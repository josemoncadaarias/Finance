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

test('what was read carries its own line, for anyone who wants to check it', () => {
  const [first] = readStatement(STATEMENT, COP).rows;
  assert.equal(first.description, 'COMPRA EXITO POBLADO', 'the date and the numbers are not description');
  assert.ok(first.line.includes('45.000,00'), 'and the line it came from is kept whole');
  assert.equal(first.balance_minor, 95_500_000);
});

test('a statement whose arithmetic does not add up says so, by how much', () => {
  const broken = page([
    [[40, 'Extracto septiembre 2026']],
    [[40, 'Saldo anterior'], [420, '1.000.000,00']],
    [[40, '01/09'], [80, 'COMPRA UNO'], [300, '45.000,00'], [420, '955.000,00']],
    [[40, '03/09'], [80, 'COMPRA DOS'], [300, '5.000,00'], [420, '950.000,00']],
    [[40, 'Saldo final'], [420, '900.000,00']],
  ]);
  const read = readStatement(broken, COP);
  assert.equal(read.balances, 'off');
  assert.equal(read.offBy_minor, -5_000_000, 'fifty thousand pesos the statement does not explain');
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
