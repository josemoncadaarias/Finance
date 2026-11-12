// The stock market module (Jose, 2026-11-12): reading a broker's statement,
// working out what is held, and asking Google Finance through a spreadsheet.
// Every statement, ticker and figure here is invented.
//
//   node --import ./tools/db/register-ts.mjs --test tools/db/stocks.test.mjs

import test from 'node:test';
import assert from 'node:assert/strict';

import { readBroker, rowKey, scaledOf, QUANTITY_SCALE, PRICE_SCALE } from '../../src/app/core/stocks/read-broker.ts';
import { bookOf, monthsOf, spreadOf, totalsOf, valueOf, worthByDay, worthOf, formatQuantity } from '../../src/app/core/stocks/positions.ts';
import { candidatesFor, inCurrency, quotesFrom, sheetRows, stillLoading, toE6 } from '../../src/app/core/stocks/quotes.ts';
import { askSheet, createSheet, SheetsError } from '../../src/app/core/stocks/sheets-client.ts';
import { StocksRepository } from '../../src/app/core/stocks/stocks.repository.ts';
import { NodeSqlDriver } from './node-sql-driver.mjs';
import { migrate } from '../../src/app/core/database/migrations/migration-runner.ts';
import { MIGRATION_SOURCES } from '../../src/app/core/database/migrations/statements.generated.ts';

async function openMigratedDatabase() {
  const db = new NodeSqlDriver(':memory:');
  await migrate(db, MIGRATION_SOURCES);
  return db;
}

/** A page as the PDF reader hands it: rows of cells, each cell with where it was printed. */
function page(rows, { top = 800, gap = 15, number = 1 } = {}) {
  const items = [];
  rows.forEach((row, at) => {
    const y = row.y ?? top - at * gap;
    for (const [x, text] of row.cells ?? row) items.push({ text, x, y, page: number });
  });
  return items;
}

// ---- A statement that lists cash operations, each trade as "quantity @ price" ----

const CASH_STYLE = page([
  [[41, 'ID'], [113, 'Type'], [269, 'Time'], [412, 'Comment'], [682, 'Symbol'], [862, 'Amount']],
  [[41, '500100200'], [113, 'deposit'], [269, '03/02/2026 10:00:00'], [412, 'Card deposit, provider id=1770001_-889'], [862, '300.00']],
  [[41, '500100201'], [113, 'Stock purchase'], [269, '03/02/2026 10:05:10'], [412, 'OPEN BUY 2 @ 41.50'], [682, 'SOLR.US'], [863, '-83.00']],
  [[41, '500100202'], [113, 'Stock purchase'], [269, '03/02/2026 10:06:00'], [412, 'OPEN BUY 0.5/1.25 @ 148.200'], [682, 'TECX.UK'], [863, '-74.10']],
  [[41, '500100203'], [113, 'Stock purchase'], [269, '03/02/2026 10:06:02'], [412, 'OPEN BUY 0.75/1.25 @ 148.400'], [682, 'TECX.UK'], [863, '-111.30']],
  [[41, '500100300'], [113, 'DIVIDENT'], [269, '15/03/2026 07:50:00'], [412, 'SOLR.US USD 0.6000/ SHR'], [682, 'SOLR.US'], [872, '1.20']],
  [[41, '500100301'], [113, 'Withholding Tax'], [269, '15/03/2026 07:50:00'], [412, 'SOLR.US USD WHT 30%'], [682, 'SOLR.US'], [868, '-0.36']],
  [[41, '500100302'], [113, 'DIVIDENT'], [269, '16/03/2026 13:00:00'], [412, 'corr SOLR.US USD 0.6000/ SHR from 2026-'], [682, 'SOLR.US'], [868, '-1.20']],
  { y: 800 - 7 * 15 - 9, cells: [[412, '03-15']] },
  [[41, '500100303'], [113, 'Withholding Tax'], [269, '16/03/2026 13:00:00'], [412, 'corr SOLR.US USD WHT 30%'], [682, 'SOLR.US'], [872, '0.36']],
  [[41, '500100400'], [113, 'Stock sale'], [269, '02/04/2026 15:30:00'], [412, 'CLOSE BUY 1 @ 45.00'], [682, 'SOLR.US'], [868, '45.00']],
  [[41, 'Total'], [862, '76.60 USD']],
  [[300, 'Currency'], [500, 'USD']],
]);

test('a statement of cash operations: every row, its sign as printed, and it adds up to its own total', () => {
  const read = readBroker(CASH_STYLE);
  const kinds = read.rows.map(row => row.kind);
  assert.deepEqual(kinds, ['deposit', 'buy', 'buy', 'buy', 'dividend', 'tax', 'dividend', 'tax', 'sell']);
  assert.equal(read.currency, 'USD');
  assert.equal(read.from, '2026-02-03');
  assert.equal(read.unread.length, 0);

  const [, solr, first, second] = read.rows;
  assert.equal(solr.symbol, 'SOLR', 'a ticker of the United States is written bare');
  assert.equal(solr.quantityE8, 2 * QUANTITY_SCALE);
  assert.equal(solr.priceE6, 41.5 * PRICE_SCALE);
  assert.equal(solr.amountMinor, -8300);
  assert.equal(solr.check, 'adds');
  assert.equal(solr.time, '10:05:10');
  assert.equal(solr.ref, '500100201');

  // "0.5/1.25": half a unit of an order of one and a quarter.
  assert.equal(first.symbol, 'TECX.UK', 'any other market stays in the name');
  assert.equal(first.quantityE8, 0.5 * QUANTITY_SCALE);
  assert.equal(second.quantityE8, 0.75 * QUANTITY_SCALE);
  assert.ok(read.rows.filter(row => row.kind === 'buy').every(row => row.check === 'adds'));

  // A dividend taken back is negative, the tax returned positive.
  assert.deepEqual(read.rows.filter(row => row.kind === 'dividend').map(row => row.amountMinor), [120, -120]);
  assert.deepEqual(read.rows.filter(row => row.kind === 'tax').map(row => row.amountMinor), [-36, 36]);

  // The statement's own total: what all of it did to the cash.
  assert.equal(read.rows.reduce((sum, row) => sum + row.amountMinor, 0), 7660);
});

// ---- A statement that lists the account's activity under column headings ----

const ACTIVITY_STYLE = page([
  [[53, 'Fecha'], [154, 'Tipo'], [221, 'Detalles'], [296, 'Importe'], [367, 'Unidades'], [503, 'Capital realizado'], [597, 'Saldo'], [656, 'ID de posición'], [741, 'Tipo de activo']],
  [[53, '10-04-2025 15:23:16'], [149, 'Depósito'], [203, '500.00 USD CreditCard'], [300, '500.00'], [383, '-'], [449, '500.00'], [523, '500.00'], [597, '500.00'], [680, '-'], [787, '-']],
  [[53, '10-04-2025 15:42:17'], [139, 'Posición abierta'], [222, 'MUNDO/USD'], [300, '184.00'], [371, '2.000000'], [452, '0.00'], [523, '500.00'], [599, '316.00'], [663, '9000000001'], [779, 'ETF']],
  [[53, '10-04-2025 15:44:47'], [139, 'Posición abierta'], [224, 'NUBE/USD'], [300, '212.00'], [371, '1.000000'], [452, '0.00'], [523, '500.00'], [599, '104.00'], [663, '9000000002'], [764, 'Acciones']],
  [[53, '11-04-2025 09:00:00'], [139, 'Posición abierta'], [224, 'NUBE/USD'], [300, '100.00'], [371, '0.500000'], [452, '0.00'], [523, '500.00'], [599, '4.00'], [663, '9000000003'], [764, 'Acciones']],
  [[53, '02-06-2025 01:23:47'], [147, 'Dividendo'], [222, 'MUNDO/USD'], [304, '0.84'], [383, '-'], [452, '0.84'], [523, '500.84'], [599, '4.84'], [663, '9000000001'], [779, 'ETF']],
  [[53, '09-06-2025 06:17:00'], [138, 'corp action: Split'], [213, 'NUBE/USD 2:1'], [304, '0.00'], [383, '-'], [452, '0.00'], [521, '500.84'], [599, '4.84'], [663, '9000000002'], [764, 'Acciones']],
  [[53, '09-06-2025 06:17:00'], [138, 'corp action: Split'], [213, 'NUBE/USD 2:1'], [304, '0.00'], [383, '-'], [452, '0.00'], [521, '500.84'], [599, '4.84'], [663, '9000000003'], [764, 'Acciones']],
  // A sale: its words wrap onto the lines just above and below its figures.
  { y: 800 - 8 * 15 + 5, cells: [[128, 'Ganancias/pérdidas de']] },
  { y: 800 - 8 * 15, cells: [[53, '01-07-2025 15:08:31'], [224, 'NUBE/USD'], [302, '230.00'], [371, '2.000000'], [450, '18.00'], [523, '518.84'], [597, '234.84'], [663, '9000000002'], [764, 'Acciones']] },
  { y: 800 - 8 * 15 - 6, cells: [[144, 'la operación']] },
  { y: 800 - 10 * 15, cells: [[53, '06-12-2025 16:19:19'], [148, 'Comisión'], [225, 'Al abrir'], [302, '(1.00)'], [383, '-'], [452, '0.00'], [521, '517.84'], [600, '233.84'], [663, '9000000004'], [764, 'Acciones']] },
  // A table of dividends with names and no ticker: it retells what the activity said.
  { y: 800 - 12 * 15, cells: [[53, 'Fecha de pago'], [167, 'Nombre del instrumento'], [300, 'Dividendo neto recibido (USD)'], [656, 'ID de posición'], [741, 'Tipo']] },
  { y: 800 - 13 * 15, cells: [[53, '02/06/2025'], [167, 'Fondo Mundo Entero'], [330, '0.8400'], [450, '30 %'], [560, '0.3600'], [656, '9000000001'], [741, 'Etf']] },
]);

test('a statement of account activity: columns by their headings, the price worked out, a split once', () => {
  const read = readBroker(ACTIVITY_STYLE);
  assert.deepEqual(read.rows.map(row => row.kind), ['deposit', 'buy', 'buy', 'buy', 'dividend', 'split', 'sell', 'fee']);
  assert.equal(read.currency, 'USD');

  const mundo = read.rows[1];
  assert.equal(mundo.symbol, 'MUNDO');
  assert.equal(mundo.asset, 'etf');
  assert.equal(mundo.amountMinor, -18400, 'a purchase leaves the cash even where the page prints no minus');
  assert.equal(mundo.priceE6, 92 * PRICE_SCALE, 'the price is what was paid over the units');
  assert.equal(mundo.check, 'derived');
  assert.equal(mundo.ref, '9000000001');

  const split = read.rows.find(row => row.kind === 'split');
  assert.deepEqual(split.ratio, [2, 1]);
  assert.equal(split.symbol, 'NUBE');

  const sale = read.rows.find(row => row.kind === 'sell');
  assert.equal(sale.amountMinor, 23000, 'what the sale gave, not the gain beside it');
  assert.equal(sale.quantityE8, 2 * QUANTITY_SCALE);

  assert.equal(read.rows.find(row => row.kind === 'fee').amountMinor, -100);
  // What is left in cash is the last balance the statement itself printed.
  assert.equal(read.rows.reduce((sum, row) => sum + row.amountMinor, 0), 23384);
});

test('a statement with no headings and its own wording still reads by the sum of each row', () => {
  const read = readBroker(page([
    [[40, '2026-01-15'], [120, 'Compra'], [200, 'CAFE.US'], [300, '10'], [380, '67,25'], [470, '672,50']],
    [[40, '2026-02-20'], [120, 'Venta'], [200, 'CAFE.US'], [300, '4'], [380, '70,00'], [470, '280,00']],
    [[40, '2026-03-01'], [120, 'Dividendo'], [200, 'CAFE.US'], [470, '3,30']],
    [[40, '2026-03-05'], [120, 'Compra'], [200, 'CAFE.US'], [300, '1.000'], [380, '1,50'], [470, '1.500,00']],
  ]));
  assert.deepEqual(read.rows.map(row => [row.kind, row.quantityE8 / QUANTITY_SCALE, row.amountMinor, row.check]), [
    ['buy', 10, -67250, 'adds'], ['sell', 4, 28000, 'adds'], ['dividend', 0, 330, 'none'], ['buy', 1000, -150000, 'adds'],
  ].map(([kind, quantity, minor, check]) => [kind, kind === 'dividend' ? 0 : quantity, minor, check]));
});

test('what is not a history is left out: today\'s positions, and a row with its opening and closing day', () => {
  const read = readBroker(page([
    [[40, 'Position'], [120, 'Symbol'], [200, 'Type'], [270, 'Volume'], [340, 'Open time'], [470, 'Open price'], [560, 'Market price'], [650, 'Purchase value']],
    [[40, '700000001'], [120, 'SOLR.US'], [200, 'BUY'], [270, '2'], [340, '03/02/2026 10:05:10'], [470, '41.50'], [560, '44.10'], [650, '83.00']],
    [[40, 'Position'], [120, 'Symbol'], [200, 'Type'], [270, 'Volume'], [340, 'Open time'], [470, 'Open price'], [560, 'Close time'], [650, 'Close price']],
    [[40, '700000002'], [120, 'CAFE.US'], [200, 'BUY'], [270, '1'], [340, '03/02/2026 10:05:10'], [470, '67.00'], [560, '04/03/2026 11:00:00'], [650, '66.00']],
  ]));
  assert.equal(read.rows.length, 0);
});

test('a number is read by the statement\'s own decimal mark, and never through a float', () => {
  assert.equal(scaledOf('0.237384', QUANTITY_SCALE), 23_738_400);
  assert.equal(scaledOf('471.809389', PRICE_SCALE), 471_809_389);
  assert.equal(scaledOf('0.1', 100), 10);
  assert.equal(scaledOf('19.999', 100), 2000);
});

// ---- What is held -----------------------------------------------------------------

const trades = (rows, currency = 'USD') => rows.map((row, at) => ({
  id: at + 1, accountId: 1, currency, source: 'statement', note: null, asset: null, ratio: null, ref: null, time: null,
  quantityE8: null, priceE6: null, ...row,
}));

test('lots: a sale closes the position the broker names, else the oldest; cost leaves with what was sold', () => {
  const book = bookOf(trades([
    { kind: 'deposit', symbol: null, day: '2026-01-01', amountMinor: 100_000 },
    { kind: 'buy', symbol: 'NUBE', day: '2026-01-02', quantityE8: 2 * QUANTITY_SCALE, amountMinor: -40_000, ref: 'A' },
    { kind: 'buy', symbol: 'NUBE', day: '2026-01-10', quantityE8: 1 * QUANTITY_SCALE, amountMinor: -25_000, ref: 'B' },
    { kind: 'sell', symbol: 'NUBE', day: '2026-02-01', quantityE8: 1 * QUANTITY_SCALE, amountMinor: 30_000, ref: 'B' },
    { kind: 'sell', symbol: 'NUBE', day: '2026-02-02', quantityE8: 1 * QUANTITY_SCALE, amountMinor: 22_000 },
    { kind: 'dividend', symbol: 'NUBE', day: '2026-03-01', amountMinor: 500 },
    { kind: 'tax', symbol: 'NUBE', day: '2026-03-01', amountMinor: -150 },
  ]));
  const [nube] = book.positions;
  assert.equal(nube.quantityE8, 1 * QUANTITY_SCALE);
  assert.equal(nube.costMinor, 20_000, 'half of the first purchase is what is left');
  assert.equal(nube.realizedMinor, (30_000 - 25_000) + (22_000 - 20_000));
  assert.equal(nube.averageE6, 200 * PRICE_SCALE);
  assert.equal(nube.dividendsMinor, 500);
  assert.equal(nube.taxMinor, -150);
  assert.equal(book.cash.get('USD'), 100_000 - 40_000 - 25_000 + 30_000 + 22_000 + 500 - 150);
});

test('a split multiplies the units held and leaves what they cost; a later sale in the new units closes the position', () => {
  const book = bookOf(trades([
    { kind: 'buy', symbol: 'NUBE', day: '2026-01-02', quantityE8: 18_469_00, priceE6: 866 * PRICE_SCALE, amountMinor: -1600, ref: 'A' },
    { kind: 'split', symbol: 'NUBE', day: '2026-06-09', amountMinor: 0, ratio: [10, 1] },
    { kind: 'sell', symbol: 'NUBE', day: '2026-07-01', quantityE8: 18_469_000 + 3, amountMinor: 2100, ref: 'A' },
  ]));
  const [nube] = book.positions;
  assert.equal(nube.quantityE8, 0, 'a sliver left by rounding is nothing held');
  assert.equal(nube.realizedMinor, 500);
  assert.equal(nube.incomplete, false);
  assert.equal(book.cash.size, 0, 'with no deposit on record, the cash at the broker is not known');
});

test('selling more than the history shows bought says the history is not whole', () => {
  const book = bookOf(trades([
    { kind: 'buy', symbol: 'SOLR', day: '2026-01-02', quantityE8: QUANTITY_SCALE, amountMinor: -4000 },
    { kind: 'sell', symbol: 'SOLR', day: '2026-01-05', quantityE8: 3 * QUANTITY_SCALE, amountMinor: 13_000 },
  ]));
  assert.equal(book.positions[0].incomplete, true);
});

test('value, gain and today\'s change come from the price; with none, a position counts at what it cost', () => {
  const book = bookOf(trades([
    { kind: 'buy', symbol: 'MUNDO', day: '2026-01-02', quantityE8: 2 * QUANTITY_SCALE, amountMinor: -18_400 },
    { kind: 'buy', symbol: 'SOLR', day: '2026-01-02', quantityE8: 1 * QUANTITY_SCALE, amountMinor: -4_100 },
  ]));
  const quote = { priceE6: 100 * PRICE_SCALE, previousE6: 98 * PRICE_SCALE, day: '2026-03-01', source: 'sheet' };
  const valued = book.positions.map(position => valueOf(position, position.symbol === 'MUNDO' ? quote : null));
  assert.equal(valued[0].valueMinor, 20_000);
  assert.equal(valued[0].gainMinor, 1_600);
  assert.equal(valued[0].dayMinor, 400);
  assert.equal(valued[1].valueMinor, 4_100);
  assert.equal(valued[1].gainMinor, null);

  const [total] = totalsOf(book, valued);
  assert.equal(total.valueMinor, 24_100);
  assert.equal(total.gainMinor, 1_600);
  assert.equal(total.unquoted, 1);
  assert.ok(Math.abs(total.gainPct - 1_600 / 18_400 * 100) < 1e-9, 'the percentage is over the positions that have a price');

  const spread = spreadOf(valued, 'USD');
  assert.equal(spread[0].symbol, 'MUNDO');
  assert.ok(Math.abs(spread[0].share + spread[1].share - 100) < 1e-9);
  assert.equal(worthOf(23_738_400, 471_809_389), 11_200);
});

test('months: what was bought, the dividends, and what everything held had cost at each close', () => {
  const months = monthsOf(trades([
    { kind: 'buy', symbol: 'MUNDO', day: '2026-01-15', quantityE8: QUANTITY_SCALE, amountMinor: -9_000 },
    { kind: 'buy', symbol: 'MUNDO', day: '2026-03-02', quantityE8: QUANTITY_SCALE, amountMinor: -9_500 },
    { kind: 'dividend', symbol: 'MUNDO', day: '2026-03-20', amountMinor: 100 },
    { kind: 'tax', symbol: 'MUNDO', day: '2026-03-20', amountMinor: -30 },
  ]), 'USD', '2026-04-10');
  assert.deepEqual(months.map(month => month.month), ['2026-01', '2026-02', '2026-03', '2026-04']);
  assert.deepEqual(months.map(month => month.boughtMinor), [9_000, 0, 9_500, 0]);
  assert.deepEqual(months.map(month => month.investedMinor), [9_000, 9_000, 18_500, 18_500]);
  assert.equal(months[2].dividendsMinor, 70);
});

test('value day by day begins the first day a price was kept', () => {
  const days = worthByDay(trades([
    { kind: 'buy', symbol: 'MUNDO', day: '2026-01-15', quantityE8: 2 * QUANTITY_SCALE, amountMinor: -18_000 },
  ]), [
    { symbol: 'MUNDO', day: '2026-02-01', price_e6: 95 * PRICE_SCALE },
    { symbol: 'MUNDO', day: '2026-02-02', price_e6: 97 * PRICE_SCALE },
  ], 'USD');
  assert.deepEqual(days, [
    { day: '2026-02-01', valueMinor: 19_000, costMinor: 18_000 },
    { day: '2026-02-02', valueMinor: 19_400, costMinor: 18_000 },
  ]);
  assert.equal(formatQuantity(23_738_400, 'es-CO'), '0,237384');
});

// ---- Prices through a spreadsheet -----------------------------------------------------

test('the ways Google Finance may write a ticker', () => {
  assert.deepEqual(candidatesFor('NUBE', 'stock', 'USD'), ['NUBE']);
  assert.deepEqual(candidatesFor('TECX.UK', 'etf', 'USD'), ['LON:TECX', 'TECX']);
  assert.deepEqual(candidatesFor('RIOB', 'stock', 'USD'), ['RIOB', 'RIO.B'], 'a class of shares written run together');
  assert.deepEqual(candidatesFor('RIO.B', 'stock', 'USD'), ['RIO.B', 'RIO-B']);
  assert.deepEqual(candidatesFor('MON', 'crypto', 'USD'), ['MONUSD', 'MON']);
});

test('the sheet\'s rows, and what its cells answer', () => {
  const rows = sheetRows(['NUBE', 'LON:TECX']);
  assert.equal(rows[1][0], 'LON:TECX');
  assert.equal(rows[1][1], '=IFERROR(GOOGLEFINANCE(A2,"price"),"")');
  assert.equal(rows[0].length, 10);

  const quotes = quotesFrom([
    ['NUBE', 110.5, 108.2, 'Nube Datos', 'USD', 31.2, 3.54, 2.1e11, 140, 80],
    ['LON:TECX', 15040, 15000, 'Fondo Tecnología', 'GBX', '', '', '', '', ''],
    ['NADA', '', '', '', '', '', '', '', '', ''],
  ]);
  assert.equal(quotes.size, 2, 'a ticker Google does not know is simply not answered');
  assert.equal(quotes.get('NUBE').price, 110.5);
  assert.deepEqual(quotes.get('NUBE').facts, { pe: 31.2, eps: 3.54, marketCap: 2.1e11, high52: 140, low52: 80, currency: 'USD' });
  assert.equal(stillLoading([['NUBE', 'Loading...']]), true);
  assert.equal(stillLoading([['NUBE', 110.5]]), false);
});

test('a price in another currency goes through the app\'s own rates, and pence are pounds over a hundred', () => {
  const pesos = new Map([['COP', 1], ['USD', 4000], ['GBP', 5000]]);
  assert.equal(inCurrency(110.5, 'USD', 'USD', pesos), 110.5);
  assert.equal(inCurrency(15040, 'GBX', 'USD', pesos), 188);
  assert.equal(inCurrency(10, 'EUR', 'USD', pesos), null, 'no rate on record: no price, never a guess');
  assert.equal(toE6(188), 188_000_000);
});

test('asking the sheet: made once with fixed commas, written, and read again while it is still loading', async () => {
  const calls = [];
  let reads = 0;
  const fetcher = async (url, init = {}) => {
    calls.push([init.method ?? 'GET', String(url).replace('https://sheets.googleapis.com/v4/spreadsheets', ''), init.body]);
    const answer = body => new Response(JSON.stringify(body), { status: 200 });
    if (init.method === 'POST' && String(url).endsWith('/spreadsheets')) return answer({ spreadsheetId: 'sheet-1' });
    if (init.method === 'GET' || init.method === undefined) {
      reads += 1;
      return answer({ values: reads === 1 ? [['NUBE', 'Loading...']] : [['NUBE', 110.5, 108.2, 'Nube Datos', 'USD']] });
    }
    return answer({});
  };
  const id = await createSheet('token', 'Precios', fetcher);
  assert.equal(id, 'sheet-1');
  assert.equal(JSON.parse(calls[0][2]).properties.locale, 'en_US');

  const values = await askSheet('token', id, ['NUBE'], { fetcher, pause: async () => {} });
  assert.equal(values[0][1], 110.5);
  assert.equal(reads, 2);
  assert.deepEqual(calls.slice(1).map(call => call[0]), ['POST', 'PUT', 'GET', 'GET']);
  assert.ok(calls[2][1].includes('valueInputOption=USER_ENTERED'));
});

test('what Google refuses is told apart: a token gone, a sheet deleted, the API switched off', async () => {
  const refusing = (status, body) => async () => new Response(body, { status });
  const kind = async fetcher => { try { await createSheet('t', 'x', fetcher); } catch (failure) { return failure instanceof SheetsError ? failure.kind : 'other'; } };
  assert.equal(await kind(refusing(401, '')), 'auth');
  assert.equal(await kind(refusing(404, '')), 'gone');
  assert.equal(await kind(refusing(403, 'Google Sheets API has not been used in project 1 before or it is disabled')), 'disabled');
  assert.equal(await kind(refusing(500, 'oops')), 'server');
  assert.equal(await kind(async () => { throw new TypeError('Failed to fetch'); }), 'network');
});

// ---- As stored ----------------------------------------------------------------------

test('a statement read twice adds nothing; one that reaches further adds only what is new', async () => {
  const db = await openMigratedDatabase();
  const repository = new StocksRepository(db, () => '2026-04-10T10:00:00Z');
  const read = readBroker(CASH_STYLE);

  assert.equal(await repository.importRows(null, 'USD', 'abril.pdf', read.rows), 9);
  assert.equal(await repository.importRows(null, 'USD', 'abril.pdf', read.rows), 0);

  const longer = readBroker([...CASH_STYLE, ...page([
    [[41, '500100500'], [113, 'Stock purchase'], [269, '05/05/2026 10:05:10'], [412, 'OPEN BUY 1 @ 44.00'], [682, 'SOLR.US'], [863, '-44.00']],
  ], { top: 400 })]);
  assert.equal(await repository.importRows(null, 'USD', 'mayo.pdf', longer.rows), 1);

  const book = bookOf(await repository.trades());
  const solr = book.positions.find(position => position.symbol === 'SOLR');
  assert.equal(solr.quantityE8, 2 * QUANTITY_SCALE);
  assert.equal(solr.dividendsMinor, 0, 'the dividend and its correction cancel');
  assert.equal(book.cash.get('USD'), 7660 - 4400);

  // The same rows for another account are that account's own.
  assert.equal((await repository.newOnes(7, read.rows)).length, 9);
  await db.close();
});

test('prices: one per ticker and day; a fetched one never writes over a typed one', async () => {
  const db = await openMigratedDatabase();
  const repository = new StocksRepository(db, () => '2026-04-10T10:00:00Z');
  await repository.setPrice('NUBE', '2026-04-09', 100_000_000, null, 'sheet');
  await repository.setPrice('NUBE', '2026-04-10', 111_000_000, null, 'manual');
  await repository.setPrice('NUBE', '2026-04-10', 105_000_000, 100_000_000, 'sheet');
  assert.equal((await repository.latestPrices('2026-04-10')).get('NUBE').priceE6, 111_000_000);
  assert.equal((await repository.latestPrices('2026-04-09')).get('NUBE').source, 'sheet');

  await repository.forgetPrice('NUBE', '2026-04-10');
  assert.equal((await repository.latestPrices('2026-04-10')).get('NUBE').day, '2026-04-09', 'the last one kept answers again');

  await repository.saveInstrument('NUBE', { name: 'Nube Datos' });
  await repository.saveInstrument('NUBE', { quote: 'NASDAQ:NUBE', facts: { pe: 30 } });
  const nube = (await repository.instruments()).get('NUBE');
  assert.deepEqual([nube.name, nube.quote, nube.facts.pe], ['Nube Datos', 'NASDAQ:NUBE', 30]);
  await db.close();
});

test('a trade typed by hand is stored, changed and deleted, and its key is its own', async () => {
  const db = await openMigratedDatabase();
  const repository = new StocksRepository(db, () => '2026-04-10T10:00:00Z');
  const input = {
    accountId: null, kind: 'buy', symbol: 'CAFE', asset: 'stock', day: '2026-04-01', time: null,
    quantityE8: 3 * QUANTITY_SCALE, priceE6: 67 * PRICE_SCALE, amountMinor: -20_100, currency: 'USD', ratio: null, ref: null, note: 'Primera',
  };
  const id = await repository.create(input);
  await repository.update(id, { ...input, quantityE8: 4 * QUANTITY_SCALE, amountMinor: -26_800 });
  const [trade] = await repository.trades();
  assert.equal(trade.quantityE8, 4 * QUANTITY_SCALE);
  assert.equal(trade.source, 'manual');
  assert.notEqual(rowKey(input), rowKey({ ...input, quantityE8: 4 * QUANTITY_SCALE }));
  await repository.remove(id);
  assert.equal(await repository.count(), 0);
  await db.close();
});

// ---- Returns over time ------------------------------------------------------------

import { returnsOf, rangeStart } from '../../src/app/core/stocks/returns.ts';

const quoteOf = (price, previous, day) => ({ priceE6: price * PRICE_SCALE, previousE6: previous === null ? null : previous * PRICE_SCALE, day, source: 'sheet' });

test('returns: buying more never shows as a gain - only prices move the line', () => {
  const history = trades([
    { kind: 'buy', symbol: 'MUNDO', day: '2026-01-10', quantityE8: QUANTITY_SCALE, priceE6: 100 * PRICE_SCALE, amountMinor: -10_000 },
    { kind: 'buy', symbol: 'MUNDO', day: '2026-02-10', quantityE8: QUANTITY_SCALE, priceE6: 110 * PRICE_SCALE, amountMinor: -11_000 },
    { kind: 'buy', symbol: 'MUNDO', day: '2026-03-10', quantityE8: QUANTITY_SCALE, priceE6: 90 * PRICE_SCALE, amountMinor: -9_000 },
  ]);
  const all = returnsOf(history, [], new Map([['MUNDO', quoteOf(120, null, '2026-04-10')]]), { currency: 'USD', range: 'MAX', today: '2026-04-10' });
  const on = day => all.points.find(point => point.day === day).gainMinor;
  assert.equal(all.from, '2026-01-10');
  assert.equal(on('2026-01-10'), 0, 'the day it was bought it has gained nothing');
  assert.equal(on('2026-02-10'), 1_000, 'one unit bought at 100 is worth 110; the second was just bought');
  assert.equal(on('2026-03-10'), -3_000, 'it fell to 90: the line goes under zero');
  assert.equal(all.changeMinor, 3 * 12_000 - 30_000);
  assert.ok(Math.abs(all.pct - 6_000 / 30_000 * 100) < 1e-9);
  assert.equal(all.estimated, true, 'between purchases the price is drawn, not known');
  assert.equal(all.flat, false);
  assert.equal(returnsOf(history, [], new Map(), { currency: 'USD', range: 'MAX', today: '2026-04-10' }).flat, true,
    'with no price since the last purchase, the line is flat to today and says so');
  // Half way between two known prices, the price is half way.
  assert.equal(on('2026-01-25'), Math.round((100 + 10 * 15 / 31) * 100) - 10_000);
});

test('returns: a period starts at zero, counts what was held at its start, and keeps dividends apart', () => {
  const history = trades([
    { kind: 'buy', symbol: 'MUNDO', day: '2025-01-10', quantityE8: 2 * QUANTITY_SCALE, priceE6: 100 * PRICE_SCALE, amountMinor: -20_000 },
    { kind: 'dividend', symbol: 'MUNDO', day: '2026-04-01', amountMinor: 300 },
    { kind: 'tax', symbol: 'MUNDO', day: '2026-04-01', amountMinor: -90 },
    { kind: 'buy', symbol: 'SOLR', day: '2026-04-05', quantityE8: QUANTITY_SCALE, priceE6: 40 * PRICE_SCALE, amountMinor: -4_000 },
  ]);
  const prices = [{ symbol: 'MUNDO', day: '2026-03-10', price_e6: 150 * PRICE_SCALE }];
  const quotes = new Map([['MUNDO', quoteOf(160, 158, '2026-04-10')], ['SOLR', quoteOf(42, 41, '2026-04-10')]]);
  const month = returnsOf(history, prices, quotes, { currency: 'USD', range: '1M', today: '2026-04-10' });
  assert.equal(month.from, '2026-03-10');
  assert.equal(month.points[0].gainMinor, 0);
  // MUNDO went from 150 to 160 on two units; SOLR from 40 to 42 on one.
  assert.equal(month.changeMinor, 2 * (16_000 - 15_000) + 200);
  assert.ok(Math.abs(month.pct - 2_200 / (30_000 + 4_000) * 100) < 1e-9);
  assert.equal(month.dividendsMinor, 210);

  const day = returnsOf(history, prices, quotes, { currency: 'USD', range: '1D', today: '2026-04-10' });
  assert.equal(day.changeMinor, 2 * 200 + 100, 'a day is today against yesterday\'s close');

  const one = returnsOf(history, prices, quotes, { currency: 'USD', symbol: 'SOLR', range: 'MAX', today: '2026-04-10' });
  assert.equal(one.from, '2026-04-05');
  assert.equal(one.changeMinor, 200);
  assert.equal(returnsOf(history, prices, quotes, { currency: 'EUR', range: 'MAX', today: '2026-04-10' }), null);
});

test('returns: a split changes nothing, and what was sold keeps its gain', () => {
  const history = trades([
    { kind: 'buy', symbol: 'NUBE', day: '2026-01-10', quantityE8: QUANTITY_SCALE, priceE6: 200 * PRICE_SCALE, amountMinor: -20_000, ref: 'A' },
    { kind: 'split', symbol: 'NUBE', day: '2026-02-01', amountMinor: 0, ratio: [2, 1] },
    { kind: 'sell', symbol: 'NUBE', day: '2026-03-01', quantityE8: 2 * QUANTITY_SCALE, priceE6: 120 * PRICE_SCALE, amountMinor: 24_000, ref: 'A' },
  ]);
  const all = returnsOf(history, [], new Map(), { currency: 'USD', range: 'MAX', today: '2026-04-10' });
  const on = day => all.points.find(point => point.day === day).gainMinor;
  assert.equal(on('2026-01-10'), 0);
  assert.ok(Math.abs(on('2026-02-01') - 1_760) < 5, 'the split day is one more day of the same line: 100 to 120 a new unit');
  assert.equal(on('2026-03-01'), 4_000);
  assert.equal(all.changeMinor, 4_000, 'after selling, the gain stays what selling left');
  assert.equal(all.flat, false, 'nothing is held, so no price is missing');
});

test('the ranges, as the tools people know write them', () => {
  assert.equal(rangeStart('1D', '2026-03-31'), '2026-03-30');
  assert.equal(rangeStart('1M', '2026-03-31'), '2026-02-28');
  assert.equal(rangeStart('6M', '2026-03-31'), '2025-09-30');
  assert.equal(rangeStart('YTD', '2026-03-31'), '2026-01-01');
  assert.equal(rangeStart('5Y', '2026-03-31'), '2021-03-31');
  assert.equal(rangeStart('MAX', '2026-03-31'), null);
});
