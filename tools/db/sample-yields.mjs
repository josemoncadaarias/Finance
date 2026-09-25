// A test backup with months of yields in it, for the yields summary.
//
//   node --import ./tools/db/register-ts.mjs tools/db/sample-yields.mjs [folder]
//
// Asked for by Jose on 2026-09-24: his own backup has two weeks of yields, and
// a summary of two weeks says little. This is invented money - no account of
// his - worked out by the real engine from January to yesterday, so every
// figure in it is one the app would really produce:
//
//   - Ahorro Verde: 45 million at 10.5%, enough for a day's yield to pass
//     0.055 UVT, so withholding applies. Fed by a transfer every month.
//   - Cajita Naranja: 8 million at 9%, under the threshold.
//   - Bolsillo Lila: 6% every day, plus 5% at the end of a month with 400,000
//     spent from it - met in some months and missed in others.
//   - Cuenta Dólar: 3,000 dollars at 4%, with a TRM for every day, so the
//     summary of all of them has to convert.
//   - Banco Azul: where the salary lands. Earns nothing.
//   - Fiducia Ámbar: an investment fund with no products, like Jose's
//     Fiducuenta. What it earns is written down: "subio inversion" under
//     Ganancia de inversión, "bajo inversion" under Pérdida de inversión, twice a month, mostly up and
//     sometimes down; a contribution from Banco Azul every month; and one
//     correction of the gain by the fund, under Ajuste de ganancias.
//
// And days checked "against the bank": most of them to the centavo, a few a
// little off, the way a real statement comes out against the engine.
//
// Written into the folder given, or G:\My Drive\Finance App\Pruebas.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { NodeSqlDriver } from './node-sql-driver.mjs';
import { migrate } from '../../src/app/core/database/migrations/migration-runner.ts';
import { MIGRATION_SOURCES } from '../../src/app/core/database/migrations/statements.generated.ts';
import { exportBackup, toJson } from '../../src/app/core/database/export/export-backup.ts';
import { CategoriesRepository } from '../../src/app/core/database/repositories/categories.repository.ts';
import { AccountsRepository } from '../../src/app/core/database/repositories/accounts.repository.ts';
import { TransactionsRepository } from '../../src/app/core/database/repositories/transactions.repository.ts';
import { TransfersRepository } from '../../src/app/core/database/repositories/transfers.repository.ts';
import { YieldsRepository } from '../../src/app/core/database/repositories/yields.repository.ts';
import { TaxParametersRepository, TAX_KEYS } from '../../src/app/core/database/repositories/tax-parameters.repository.ts';
import { AccrualEngine } from '../../src/app/core/yields/accrual.ts';
import { EA_SCALE } from '../../src/app/core/yields/yield-math.ts';
import { seedStarterCategories } from '../../src/app/core/database/starter-categories.ts';

const NOW = () => '2026-09-24T09:00:00Z';
const UP_TO = '2026-09-23';
const pct = p => Math.round((p / 100) * EA_SCALE);

/** The same numbers every time: a test that changes under you proves nothing. */
function rolling(seed) {
  let value = seed;
  return (from, to) => {
    value = (value * 1103515245 + 12345) % 2147483648;
    return from + (value % (to - from + 1));
  };
}
const next = rolling(20260924);

const db = new NodeSqlDriver();
await migrate(db, MIGRATION_SOURCES);
await seedStarterCategories(db, 'es', NOW);

const accounts = new AccountsRepository(db, NOW);
const transactions = new TransactionsRepository(db, NOW);
const transfers = new TransfersRepository(db, NOW);
const yields = new YieldsRepository(db, NOW);
const tax = new TaxParametersRepository(db, NOW);

// The withholding rule, confirmed, so the big account is withheld (rule 16).
for (const [key, value] of [
  [TAX_KEYS.uvtValue, '5237400'],
  [TAX_KEYS.threshold, '0.055'],
  [TAX_KEYS.percent, String(pct(7))],
  [TAX_KEYS.base, 'all'],
]) {
  await tax.set({ key, valid_from: '2026-01-01', value, source: 'Datos de prueba', confirmed: true });
}

const category = async (name, kind) => (await db.queryOne(
  'SELECT id FROM categories WHERE name = ? AND kind = ?', [name, kind])).id;
const salary = await category('Salario', 'income');
const groceries = await category('Mercado', 'expense');
const eatingOut = await category('Restaurante', 'expense');

const make = (name, currency, opening, icon) => accounts.create({
  name, type: 'debit', currency_code: currency, builtin_icon: icon,
  opening_balance_minor: opening, opened_on: '2025-12-01',
});
const azul = await make('Banco Azul', 'COP', 3_000_000_00, 'card');
const verde = await make('Ahorro Verde', 'COP', 40_000_000_00, 'leaf');
const naranja = await make('Cajita Naranja', 'COP', 8_000_000_00, 'cube');
const lila = await make('Bolsillo Lila', 'COP', 5_000_000_00, 'wallet');
const dolar = await make('Cuenta Dólar', 'USD', 3_000_00, 'cash');

// An investment fund: its own type, no products, its gains written down
// under categories marked as returns (migration 047).
const fondo = await accounts.create({
  name: 'Fiducia Ámbar', type: 'investment', currency_code: 'COP', builtin_icon: 'trending-up',
  opening_balance_minor: 60_000_000_00, opened_on: '2025-12-01',
});
// Gains and losses go under the two the app ships with, already marked; the
// fund's correction under one of the person's own, marked by hand.
const ganancia = await category('Ganancia de inversión', 'income');
const perdida = await category('Pérdida de inversión', 'expense');
const ajuste = await new CategoriesRepository(db, NOW).create({
  name: 'Ajuste de ganancias', kind: 'expense', builtin_icon: 'trending-down-outline', counts_as_return: true,
});

const START = '2026-01-01';
// Each account's one product named in Spanish, the rate on the product: how a
// person sets it up, and how the store's screenshots should read.
const productOf = async (accountId, name) => {
  const product = (await yields.products(accountId))[0];
  await yields.renameProduct(product.id, name);
  return product.id;
};

await yields.enrol({ account_id: verde, opening_on: START, withholding: true });
const verdeP = await productOf(verde, 'Cuenta de ahorros');
await yields.setRate({ account_id: verde, product_id: verdeP, valid_from: START, annual_rate_scaled: pct(10.5) });

await yields.enrol({ account_id: naranja, opening_on: START, withholding: true });
const naranjaP = await productOf(naranja, 'Cajita');
await yields.setRate({ account_id: naranja, product_id: naranjaP, valid_from: START, annual_rate_scaled: pct(9) });
// A rate cut in June, the way banks do: the summary should show the dip.
await yields.setRate({ account_id: naranja, product_id: naranjaP, valid_from: '2026-06-01', annual_rate_scaled: pct(8.25) });

await yields.enrol({ account_id: lila, opening_on: START, withholding: false });
const lilaP = await productOf(lila, 'Bolsillo');
await yields.setRate({
  account_id: lila, product_id: lilaP, component: 'Diario', payout: 'daily', valid_from: START, annual_rate_scaled: pct(6),
});
await yields.setRate({
  account_id: lila, product_id: lilaP, component: 'Mensual por gasto', payout: 'monthly', valid_from: START,
  annual_rate_scaled: pct(5), requires_monthly_spend_minor: 400_000_00,
});

await yields.enrol({ account_id: dolar, opening_on: START, withholding: false });
const dolarP = await productOf(dolar, 'Cuenta en dólares');
await yields.setRate({ account_id: dolar, product_id: dolarP, valid_from: START, annual_rate_scaled: pct(4) });

// A TRM for every day, drifting the way it does.
let trm = 4_120_0000;
for (let t = Date.parse(`${START}T00:00:00Z`); t <= Date.parse(`${UP_TO}T00:00:00Z`); t += 86_400_000) {
  const day = new Date(t).toISOString().slice(0, 10);
  trm += next(-120_000, 100_000);
  await db.run(
    `INSERT INTO exchange_rates (on_date, base_code, quote_code, rate_scaled, source, fetched_at)
     VALUES (?, 'USD', 'COP', ?, 'trm', ?)`, [day, trm, NOW()]);
}

const day = (month, d) => `2026-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

// Spending from Bolsillo Lila: enough for the bonus in some months, not others.
const LILA_SPEND = { 1: 520_000_00, 2: 180_000_00, 3: 610_000_00, 4: 395_000_00, 5: 450_000_00,
  6: 120_000_00, 7: 700_000_00, 8: 405_000_00, 9: 260_000_00 };

for (let month = 1; month <= 9; month += 1) {
  const last = month === 9 ? 23 : 28;
  await transactions.create({
    account_id: azul, category_id: salary, occurred_on: day(month, Math.min(last, 25)),
    amount_minor: 7_500_000_00, description: 'PAGO NOMINA', source: 'manual',
  });
  // Part of the salary saved every month.
  if (month < 9 || last >= 26) {
    await transfers.create({
      occurred_on: day(month, Math.min(last, 26)), description: 'Ahorro del mes',
      from: { account_id: azul, amount_minor: 1_500_000_00 },
      to: { account_id: verde, amount_minor: 1_500_000_00 },
    });
  }
  // Spent from the pocket in pieces through the month.
  let left = LILA_SPEND[month];
  while (left > 0) {
    const piece = Math.min(left, next(40_000_00, 160_000_00));
    await transactions.create({
      account_id: lila, category_id: next(0, 1) ? groceries : eatingOut,
      occurred_on: day(month, next(1, last)), amount_minor: -piece,
      description: 'COMPRA TARJETA LILA', source: 'manual',
    });
    left -= piece;
  }
}

// The fund: a contribution on the 27th, and what it did written down on the
// 5th and the 20th - between -0.4% and +0.9% of its balance each time, so
// most months gain and a few lose.
let fondoBalance = 60_000_000_00;
for (let month = 1; month <= 9; month += 1) {
  for (const d of [5, 20]) {
    const change = Math.round(fondoBalance * next(-40, 90) / 10_000);
    await transactions.create({
      account_id: fondo, category_id: change >= 0 ? ganancia : perdida, occurred_on: day(month, d),
      amount_minor: change, description: change >= 0 ? 'subio inversion' : 'bajo inversion', source: 'manual',
    });
    fondoBalance += change;
  }
  if (month < 9) {
    await transfers.create({
      occurred_on: day(month, 27), description: 'Aporte al fondo',
      from: { account_id: azul, amount_minor: 1_000_000_00 },
      to: { account_id: fondo, amount_minor: 1_000_000_00 },
    });
    fondoBalance += 1_000_000_00;
  }
}
// The fund corrected the gain it had been showing, once.
await transactions.create({
  account_id: fondo, category_id: ajuste, occurred_on: day(7, 27), amount_minor: -350_000_00,
  description: 'Ajuste fondo impuesto renta acumulado', source: 'manual',
});

// Everyday life on a credit card, paid from Banco Azul every month - what the
// summary screen, its donut and the money report show, and what the store's
// screenshots are taken of. Ordinary words, never brands: this backup is
// published as pictures.
const tarjeta = await accounts.create({
  name: 'Tarjeta Coral', type: 'credit', currency_code: 'COP', builtin_icon: 'card',
  credit_limit_minor: 8_000_000_00, opening_balance_minor: 0, opened_on: '2025-12-01',
});
const LIFE = [
  // category, notes to choose from, [min, max] pesos, times a month
  ['Mercado', ['Mercado semanal', 'Frutas y verduras', 'Mercado del mes'], [60_000, 320_000], 5],
  ['Restaurante', ['Almuerzo', 'Cena con amigos', 'Almuerzo ejecutivo', 'Café y postre'], [18_000, 140_000], 7],
  ['Transporte', ['Taxi', 'Viaje en app de transporte', 'Recarga transporte público'], [8_000, 45_000], 6],
  ['Automóvil', ['Gasolina', 'Parqueadero', 'Lavado del carro'], [15_000, 180_000], 3],
  ['Facturas', ['Energía', 'Internet y TV', 'Plan de celular', 'Agua'], [60_000, 190_000], 3],
  ['Casa', ['Arriendo'], [1_600_000, 1_600_000], 1],
  ['Salud', ['Farmacia', 'Cita médica'], [25_000, 160_000], 1],
  ['Entretenimiento', ['Suscripción de streaming', 'Cine', 'Suscripción de música'], [17_000, 60_000], 3],
  ['Ropa', ['Camisa', 'Zapatos', 'Ropa deportiva'], [70_000, 260_000], 1],
  ['Cuidado personal', ['Peluquería', 'Productos de aseo'], [25_000, 90_000], 1],
  ['Tecnología', ['Audífonos', 'Accesorios del celular'], [40_000, 350_000], 0.5],
];
for (let month = 1; month <= 9; month += 1) {
  const last = month === 9 ? 23 : 28;
  let spent = 0;
  for (const [name, notes, [low, high], times] of LIFE) {
    const categoryId = await category(name, 'expense');
    const count = times >= 1 ? times : (next(0, 1) === 1 ? 1 : 0);
    for (let n = 0; n < count; n += 1) {
      const pesos = low === high ? low : Math.round(next(low, high) / 100) * 100;
      spent += pesos;
      await transactions.create({
        account_id: tarjeta, category_id: categoryId, occurred_on: day(month, next(1, last)),
        amount_minor: -pesos * 100, description: notes[next(0, notes.length - 1)], source: 'manual',
      });
    }
  }
  // The card paid in full from Banco Azul, the next month's 5th.
  if (month < 9) {
    await transfers.create({
      occurred_on: day(month + 1, 5), description: 'Pago tarjeta de crédito',
      from: { account_id: azul, amount_minor: spent * 100 },
      to: { account_id: tarjeta, amount_minor: spent * 100 },
    });
  }
}

const engine = new AccrualEngine(db, yields, tax);
await engine.accrueAll(UP_TO);

// Days "checked against the bank". Mostly exact; a few off by centavos.
const checked = await db.query(
  `SELECT product_id, on_date, net_minor FROM yield_days
   WHERE account_id IN (?, ?) AND on_date BETWEEN '2026-08-20' AND ?
   ORDER BY on_date`, [verde, naranja, UP_TO]);
let off = 0;
for (const row of checked) {
  const drift = next(0, 9) === 0 ? next(-80, 80) : 0;
  if (drift !== 0) off += 1;
  await yields.correctDay(row.product_id, row.on_date, row.net_minor + drift);
}
await engine.accrueAll(UP_TO);

const folder = process.argv[2] ?? 'G:/My Drive/Finance App/Pruebas';
mkdirSync(folder, { recursive: true });
const name = 'finance-rendimientos-de-prueba.json';
const backup = await exportBackup(db);
writeFileSync(join(folder, name), toJson(backup));

const counts = Object.entries(backup.tables).filter(([, rows]) => rows.length > 0)
  .map(([table, rows]) => `${table} ${rows.length}`).join(', ');
console.log(`escrito en ${folder}:\n  ${name}  ${counts}\n  días comparados con el "banco": ${checked.length}, con diferencia: ${off}`);
