// A backup to test against, and the statements that go with it.
//
//   node --import ./tools/db/register-ts.mjs tools/db/sample-data.mjs [carpeta]
//
// Jose asked for this on 2026-09-23, and the reason is a good one: his own
// database already holds every movement his statements describe, so importing
// one of them proves only that the duplicate check works. This is a database
// of invented people's money, with statements that overlap it the way real
// ones do - some lines already known, some new - so every case can be met on
// purpose instead of waited for.
//
// Deliberately absent: Nequi, Bold and Ualá. Those are the three Jose will
// test the notifications with, and their accounts have to be created by him,
// on his phone, the way a person would.
//
// Written into the folder given, or beside the repository. Nothing here
// touches his own data.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { NodeSqlDriver } from './node-sql-driver.mjs';
import { samplePdf } from './sample-statement.mjs';
import { migrate } from '../../src/app/core/database/migrations/migration-runner.ts';
import { MIGRATION_SOURCES } from '../../src/app/core/database/migrations/statements.generated.ts';
import { exportBackup, toJson } from '../../src/app/core/database/export/export-backup.ts';
import { AccountsRepository } from '../../src/app/core/database/repositories/accounts.repository.ts';
import { CategoriesRepository } from '../../src/app/core/database/repositories/categories.repository.ts';
import { TransactionsRepository } from '../../src/app/core/database/repositories/transactions.repository.ts';
import { TransfersRepository } from '../../src/app/core/database/repositories/transfers.repository.ts';

const NOW = () => '2026-09-23T09:00:00Z';

/** The same numbers every time: a test that changes under you proves nothing. */
function rolling(seed) {
  let value = seed;
  return (from, to) => {
    value = (value * 1103515245 + 12345) % 2147483648;
    return from + (value % (to - from + 1));
  };
}

const CATEGORIES = [
  ['Mercados', 'expense', 'cart'],
  ['Restaurante', 'expense', 'restaurant'],
  ['Transporte', 'expense', 'car'],
  ['Servicios', 'expense', 'flash'],
  ['Arriendo', 'expense', 'home'],
  ['Suscripciones', 'expense', 'tv'],
  ['Salud', 'expense', 'medkit'],
  ['Salario', 'income', 'briefcase'],
  ['Otros ingresos', 'income', 'wallet'],
];

/** What a month of somebody's ordinary life looks like. */
const HABITS = [
  { category: 'Arriendo', day: 5, amount: -1_800_000_00, note: 'PAGO ARRIENDO APTO 501' },
  { category: 'Servicios', day: 8, amount: -210_000_00, note: 'EPM SERVICIOS PUBLICOS' },
  { category: 'Suscripciones', day: 25, amount: -44_900_00, note: 'COMPRA NETFLIX COM' },
  { category: 'Suscripciones', day: 17, amount: -16_900_00, note: 'COMPRA SPOTIFY AB' },
  // On the 28th and not the 30th, so that a month cut short still pays it:
  // an account that never receives a salary goes deeply, unrealistically into
  // the red, and the statement built from it prints balances nobody believes.
  { category: 'Salario', day: 28, amount: 6_400_000_00, note: 'PAGO NOMINA ACME SAS' },
];

const SHOPS = [
  ['Mercados', 'COMPRA EXITO POBLADO MEDELLIN', 60_000_00, 260_000_00],
  ['Mercados', 'COMPRA D1 LAURELES', 12_000_00, 90_000_00],
  ['Restaurante', 'COMPRA RAPPI COLOMBIA', 25_000_00, 95_000_00],
  ['Restaurante', 'COMPRA MOKANA BURGERS', 38_000_00, 120_000_00],
  ['Transporte', 'COMPRA UBER BV', 9_000_00, 45_000_00],
  ['Transporte', 'COMPRA TERPEL ESTACION', 80_000_00, 250_000_00],
  ['Salud', 'COMPRA FARMATODO', 15_000_00, 140_000_00],
];

async function build() {
  const db = new NodeSqlDriver();
  await migrate(db, MIGRATION_SOURCES);

  const accounts = new AccountsRepository(db, NOW);
  const categories = new CategoriesRepository(db, NOW);
  const transactions = new TransactionsRepository(db, NOW);
  const transfers = new TransfersRepository(db, NOW);

  const category = new Map();
  for (const [name, kind, icon] of CATEGORIES) {
    category.set(name, await categories.create({ name, kind, builtin_icon: icon }));
  }

  const azul = await accounts.create({
    name: 'Banco Azul', type: 'debit', currency_code: 'COP', builtin_icon: 'card',
    opening_balance_minor: 1_250_000_00, opened_on: '2026-03-01',
  });
  const verde = await accounts.create({
    name: 'Banco Verde', type: 'debit', currency_code: 'COP', builtin_icon: 'wallet',
    opening_balance_minor: 800_000_00, opened_on: '2026-03-01',
  });
  const naranja = await accounts.create({
    name: 'Tarjeta Naranja', type: 'credit', currency_code: 'COP', builtin_icon: 'card',
    opening_balance_minor: -420_000_00, opened_on: '2026-03-01', credit_limit_minor: 8_000_000_00,
  });

  const next = rolling(20260923);
  const day = (month, number) => `2026-${String(month).padStart(2, '0')}-${String(number).padStart(2, '0')}`;

  // Six months of it, and September deliberately left thin: the statement is
  // what fills it in, which is the case worth testing.
  for (let month = 4; month <= 9; month += 1) {
    const upTo = month === 9 ? 8 : 28;

    for (const habit of HABITS) {
      if (habit.day > upTo) continue;
      await transactions.create({
        account_id: habit.amount > 0 ? azul : (habit.category === 'Arriendo' ? azul : verde),
        category_id: category.get(habit.category),
        occurred_on: day(month, habit.day),
        amount_minor: habit.amount,
        description: habit.note,
        source: 'manual',
      });
    }

    for (let each = 0; each < (month === 9 ? 4 : 14); each += 1) {
      const [name, note, low, high] = SHOPS[next(0, SHOPS.length - 1)];
      const on = next(1, upTo);
      await transactions.create({
        account_id: [azul, verde, naranja][next(0, 2)],
        category_id: category.get(name),
        occurred_on: day(month, on),
        amount_minor: -next(low, high),
        description: note,
        source: 'manual',
      });
    }

    if (month < 9) {
      await transfers.create({
        occurred_on: day(month, 12),
        description: 'Traslado entre cuentas',
        from: { account_id: azul, amount_minor: 500_000_00 },
        to: { account_id: verde, amount_minor: 500_000_00 },
      });
    }
  }

  return { db, azul, verde, naranja };
}

/**
 * The money written on a statement, in the way a statement writes it.
 *
 * An amount is printed without its sign, the way the column of a statement
 * does; a BALANCE keeps it, because an account can be overdrawn and a card
 * always is.
 */
const written = minor => (Math.abs(minor) / 100)
  .toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  .replace(/,/g, '~').replace(/\./g, ',').replace(/~/g, '.');

const signedWritten = minor => (minor < 0 ? '-' : '') + written(minor);

const dayOf = iso => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

/**
 * September at Banco Azul, as the bank would send it.
 *
 * Built FROM the database rather than typed beside it, which is the whole
 * point: the lines it shares with the ledger are the same movements, for the
 * same amounts to the cent, and the bank reports them a day or two later and
 * words them its own way. That is the case no exact fingerprint can catch, and
 * writing the statement by hand would only have tested the easy one.
 */
async function azulStatement(db, azul) {
  const before = await db.queryOne(
    `SELECT a.opening_balance_minor + COALESCE((
       SELECT SUM(t.amount_minor) FROM transactions t
       WHERE t.account_id = a.id AND t.occurred_on <= '2026-08-31'), 0) AS total
     FROM accounts a WHERE a.id = ?`, [azul]);

  const known = await db.query(
    `SELECT occurred_on, amount_minor, description FROM transactions
     WHERE account_id = ? AND occurred_on >= '2026-09-01'
     ORDER BY occurred_on, id`, [azul]);

  // The bank's own wording for the same shop, and the day it posted it.
  const reworded = {
    'COMPRA EXITO POBLADO MEDELLIN': 'COMPRA EXITO POB MEDELLIN 4471',
    'COMPRA RAPPI COLOMBIA': 'COMPRA RAPPI COL BOG',
    'COMPRA D1 LAURELES': 'COMPRA D1 LAURELES SUC 12',
    'COMPRA UBER BV': 'COMPRA UBER BV AMSTERDAM',
    'COMPRA TERPEL ESTACION': 'COMPRA EDS TERPEL 7745',
    'COMPRA FARMATODO': 'COMPRA FARMATODO 1120',
    'PAGO ARRIENDO APTO 501': 'TRANSFERENCIA ENVIADA ARRIENDO 501',
    'PAGO NOMINA ACME SAS': 'ABONO NOMINA ACME SAS',
  };
  const later = (iso, days) => new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86400000)
    .toISOString().slice(0, 10);

  const lines = known.map((row, at) => ({
    on: later(row.occurred_on, at % 3 === 0 ? 2 : 1),
    amount: row.amount_minor,
    text: reworded[row.description] ?? row.description,
  }));

  // And what the ledger has never seen, because nobody typed it.
  lines.push(
    { on: '2026-09-16', amount: -300_000_00, text: 'RETIRO CAJERO CC SANTAFE' },
    { on: '2026-09-18', amount: 2_000_000_00, text: 'TRANSFERENCIA RECIBIDA DE ACME' },
    { on: '2026-09-22', amount: -72_900_00, text: 'COMPRA FARMATODO 1120' },
    { on: '2026-09-25', amount: -44_900_00, text: 'COMPRA NETFLIX COM' },
    { on: '2026-09-27', amount: -118_400_00, text: 'COMPRA ALMACENES FLAMINGO' },
    { on: '2026-09-29', amount: -36_500_00, text: 'COMPRA MOKANA BURGERS' },
  );
  lines.sort((one, other) => one.on.localeCompare(other.on));

  let balance = before.total;
  const rows = [
    [[40, 'BANCO AZUL S.A.'], [330, 'Extracto de cuenta - septiembre 2026']],
    [[40, 'Cuenta de ahorros No. 556-120034-71'], [330, 'Periodo: 01/09/2026 al 30/09/2026']],
    [[40, 'Fecha'], [90, 'Descripcion'], [330, 'Valor'], [440, 'Saldo']],
    [[40, 'Saldo anterior'], [440, signedWritten(balance)]],
  ];
  for (const line of lines) {
    balance += line.amount;
    rows.push([[40, dayOf(line.on)], [90, line.text], [330, written(line.amount)], [440, signedWritten(balance)]]);
  }
  rows.push([[40, 'Saldo final'], [440, signedWritten(balance)]]);
  rows.push([[40, 'Linea de atencion 018000 445566 - NIT 900.111.222-3']]);

  return { rows, shared: known.length, added: lines.length - known.length };
}

/** A bank the database has never heard of, for creating the account from it. */
const GRIS_SEPTEMBER = [
  [[40, 'BANCO GRIS'], [330, 'Extracto - septiembre 2026']],
  [[40, 'Cuenta corriente No. 880-99001'], [330, 'Periodo: 01/09/2026 al 30/09/2026']],
  [[40, 'Fecha'], [90, 'Descripcion'], [330, 'Valor'], [440, 'Saldo']],
  [[40, 'Saldo anterior'], [440, '3.000.000,00']],
  [[40, '03/09'], [90, 'COMPRA ALKOSTO CALLE 30'], [330, '1.249.000,00'], [440, '1.751.000,00']],
  [[40, '07/09'], [90, 'ABONO INTERESES'], [330, '12.400,00'], [440, '1.763.400,00']],
  [[40, '12/09'], [90, 'COMPRA CINE COLOMBIA'], [330, '64.000,00'], [440, '1.699.400,00']],
  [[40, '19/09'], [90, 'PAGO SEGURO VEHICULO'], [330, '380.000,00'], [440, '1.319.400,00']],
  [[40, '26/09'], [90, 'COMPRA EXITO POB MEDELLIN'], [330, '112.500,00'], [440, '1.206.900,00']],
  [[40, 'Saldo final'], [440, '1.206.900,00']],
];

const into = process.argv[2] ?? 'pruebas';
mkdirSync(into, { recursive: true });

const { db, azul } = await build();
const statement = await azulStatement(db, azul);
const backup = await exportBackup(db);
writeFileSync(join(into, 'finance-datos-de-prueba.json'), toJson(backup));
await db.close();

writeFileSync(join(into, 'extracto-banco-azul-septiembre.pdf'), samplePdf(statement.rows));
writeFileSync(join(into, 'extracto-banco-gris-septiembre.pdf'), samplePdf(GRIS_SEPTEMBER));

const rows = Object.entries(backup.tables)
  .filter(([, values]) => values.length > 0)
  .map(([table, values]) => `${table} ${values.length}`);
console.log(`escrito en ${into}:`);
console.log('  finance-datos-de-prueba.json      ', rows.join(', '));
console.log(`  extracto-banco-azul-septiembre.pdf  cuenta que YA existe: ${statement.shared} movimientos que la base ya tiene (otra fecha, otro texto) y ${statement.added} nuevos`);
console.log('  extracto-banco-gris-septiembre.pdf  banco que la base no conoce');
