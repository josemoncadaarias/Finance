// A showcase backup: every screen and every feature of the app with something
// in it, for demonstrations and for explaining what the app can do.
//
//   node --import ./tools/db/register-ts.mjs tools/db/showcase-data.mjs [folder]
//
// Asked for by Jose on 2026-10-02. Invented people and money, never his: it
// may be shown to anybody. Everything is written through the app's own
// repositories and worked out by its own engines, so each figure is one the
// app would really produce. Dated as of 2026-10-02: screens that read "this
// month" (caps, a card's statement, a loan's next installment) say most on
// the days right after it.
//
// What it holds, by screen:
//   - Inicio / Cuentas: debit, cash, credit, investment and loan accounts; a
//     group holding pesos and dollars; a euro account; one account outside
//     net worth; an archived card; an account and a category with their own
//     pictures; colours on accounts and categories.
//   - Every movement kind: spending, income, refunds on a card, transfers,
//     across currencies (with the rate the provider applied), a foreign
//     movement valued at the official rate, recurring charges and one charge
//     repeated twice in a month, notes that repeat (the usual note).
//   - Cards: a limit raised and later lowered; one card with a statement part
//     paid, another overdue; one archived.
//   - Products and yields: a withheld savings account with a typed product
//     and cashback (a product-only income, and a cash-in to net worth); a
//     rate cut; a spending bonus met some months and missed others; a dollar
//     account; a CDT; a product set aside from net worth; days checked
//     against the bank; a payment moved to the day the bank really paid and
//     one corrected; a product category of the person's own.
//   - Investments: a fund with gains, losses and a correction of the gain.
//   - Debts: a car loan disbursed into an account with installments paid and
//     a payment ahead; a loan started before the app with an overdue
//     installment and default interest; a UVR mortgage.
//   - Presupuestos: caps passed, close, fine and on one account; goals on
//     time, late, with no date, an emergency fund over every account, and one
//     reached and archived.
//   - Movimientos por revisar: a statement batch (learned and suggested
//     categories, a row that may be one already typed, a missing category)
//     and two bank notifications, one that could not be read.
//   - Simulador de renta: 2026 filled in.
//   - Bank notifications themselves are NOT here: Android keeps them outside
//     the database, so no backup carries them.
//
// Written into the folder given, or G:\My Drive\Finance App\Pruebas.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';

import { NodeSqlDriver } from './node-sql-driver.mjs';
import { migrate } from '../../src/app/core/database/migrations/migration-runner.ts';
import { MIGRATION_SOURCES } from '../../src/app/core/database/migrations/statements.generated.ts';
import { exportBackup, toJson } from '../../src/app/core/database/export/export-backup.ts';
import { seedStarterCategories } from '../../src/app/core/database/starter-categories.ts';
import { AccountsRepository } from '../../src/app/core/database/repositories/accounts.repository.ts';
import { AccountGroupsRepository } from '../../src/app/core/database/repositories/account-groups.repository.ts';
import { CategoriesRepository } from '../../src/app/core/database/repositories/categories.repository.ts';
import { CreditLimitsRepository } from '../../src/app/core/database/repositories/credit-limits.repository.ts';
import { CustomIconsRepository } from '../../src/app/core/database/repositories/custom-icons.repository.ts';
import { ProductKindsRepository } from '../../src/app/core/database/repositories/product-kinds.repository.ts';
import { ProposalsRepository } from '../../src/app/core/database/repositories/proposals.repository.ts';
import { RatesRepository } from '../../src/app/core/database/repositories/rates.repository.ts';
import { TaxParametersRepository, TAX_KEYS } from '../../src/app/core/database/repositories/tax-parameters.repository.ts';
import { TaxSimulationsRepository } from '../../src/app/core/database/repositories/tax-simulations.repository.ts';
import { TransactionsRepository } from '../../src/app/core/database/repositories/transactions.repository.ts';
import { TransfersRepository } from '../../src/app/core/database/repositories/transfers.repository.ts';
import { YieldsRepository } from '../../src/app/core/database/repositories/yields.repository.ts';
import { AccrualEngine } from '../../src/app/core/yields/accrual.ts';
import { accrueAndSettle } from '../../src/app/core/yields/cdt.ts';
import { EA_SCALE } from '../../src/app/core/yields/yield-math.ts';
import { writeScoped } from '../../src/app/core/yields/entry-scope.ts';
import { LoansRepository } from '../../src/app/core/loans/loans.repository.ts';
import { loanSchedule, eaFromMonthly, EA_SCALE as LOAN_EA } from '../../src/app/core/loans/schedule.ts';
import { LimitsRepository } from '../../src/app/core/limits/limits.repository.ts';
import { GoalsRepository } from '../../src/app/core/goals/goals.repository.ts';
import { defaultInputs } from '../../src/app/core/tax/defaults.ts';

const TODAY = '2026-10-02';
const NOW = () => `${TODAY}T09:00:00Z`;
const UP_TO = '2026-10-01';
const FROM = '2025-10-01';
const P = pesos => Math.round(pesos * 100);
const pct = p => Math.round((p / 100) * EA_SCALE);
const rate = r => Math.round(r * 10_000);

/** The same numbers every time: a showcase that changes under you proves nothing. */
function rolling(seed) {
  let value = seed;
  return (from, to) => {
    value = (value * 1103515245 + 12345) % 2147483648;
    return from + (value % (to - from + 1));
  };
}
const next = rolling(20261002);
const pick = list => list[next(0, list.length - 1)];

// ---- A small PNG, drawn here, so a picture of one's own is in the backup ----

const CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(bytes) {
  let c = 0xffffffff;
  for (const b of bytes) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}
/** `paint(x, y)` gives [r, g, b, a] for each pixel of a size x size picture. */
function png(size, paint) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) raw.set(paint(x, y), y * (size * 4 + 1) + 1 + x * 4);
  }
  const head = Buffer.alloc(13);
  head.writeUInt32BE(size, 0);
  head.writeUInt32BE(size, 4);
  head[8] = 8; head[9] = 6;
  return new Uint8Array(Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', head), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ]));
}
const S = 96;
const inCircle = (x, y, cx, cy, r) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
// A bank logo: three white stripes on a blue disc, transparent around it.
const bankLogo = png(S, (x, y) => {
  if (!inCircle(x, y, 48, 48, 46)) return [0, 0, 0, 0];
  const stripe = x > 22 && x < 74 && [30, 46, 62].some(t => y >= t && y < t + 8);
  return stripe ? [255, 255, 255, 255] : [36, 99, 235, 255];
});
// A paw for the pet's category: four toes and a pad, on transparent.
const paw = png(S, (x, y) => {
  const parts = [[48, 62, 20], [24, 36, 9], [40, 24, 9], [56, 24, 9], [72, 36, 9]];
  return parts.some(([cx, cy, r]) => inCircle(x, y, cx, cy, r)) ? [255, 145, 82, 255] : [0, 0, 0, 0];
});
// A suitcase for the travel group.
const suitcase = png(S, (x, y) => {
  const body = x >= 14 && x <= 82 && y >= 30 && y <= 80;
  const handle = x >= 34 && x <= 62 && y >= 16 && y <= 30 && !(x > 40 && x < 56 && y > 22);
  const band = body && (x === 30 || x === 31 || x === 65 || x === 66);
  if (band) return [255, 255, 255, 255];
  return body || handle ? [46, 196, 182, 255] : [0, 0, 0, 0];
});
// A star for a welcome bonus.
const star = png(S, (x, y) => {
  const dx = x - 48, dy = y - 50;
  const angle = Math.atan2(dy, dx);
  const reach = 22 + 20 * Math.abs(Math.cos(2.5 * angle));
  return Math.hypot(dx, dy) <= reach ? [246, 185, 59, 255] : [0, 0, 0, 0];
});

// ---- The database ----

const db = new NodeSqlDriver();
await migrate(db, MIGRATION_SOURCES);
await seedStarterCategories(db, 'es', NOW);

const accounts = new AccountsRepository(db, NOW);
const groups = new AccountGroupsRepository(db, NOW);
const categories = new CategoriesRepository(db, NOW);
const icons = new CustomIconsRepository(db, NOW);
const tx = new TransactionsRepository(db, NOW);
const transfers = new TransfersRepository(db, NOW);
const yields = new YieldsRepository(db, NOW);
const tax = new TaxParametersRepository(db, NOW);
const rates = new RatesRepository(db, NOW);
const loans = new LoansRepository(db, NOW);

for (const [key, value] of [
  [TAX_KEYS.uvtValue, '5237400'],
  [TAX_KEYS.threshold, '0.055'],
  [TAX_KEYS.percent, String(pct(7))],
  [TAX_KEYS.base, 'all'],
]) {
  await tax.set({ key, valid_from: '2025-01-01', value, source: 'Datos de ejemplo', confirmed: true });
}

// ---- Days and rates ----

const days = (from, to) => {
  const out = [];
  for (let t = Date.parse(`${from}T00:00:00Z`); t <= Date.parse(`${to}T00:00:00Z`); t += 86_400_000) {
    out.push(new Date(t).toISOString().slice(0, 10));
  }
  return out;
};
const months = []; // 'YYYY-MM' from FROM to this month
for (let y = 2025, m = 10; y < 2026 || m <= 10; m === 12 ? (y++, m = 1) : m++) months.push(`${y}-${String(m).padStart(2, '0')}`);
const on = (month, d) => {
  const [y, m] = month.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const day = `${month}-${String(Math.min(d, last)).padStart(2, '0')}`;
  return day > TODAY ? TODAY : day;
};
const thisMonth = TODAY.slice(0, 7);

// A TRM for every day, drifting the way it does; the euro once a week.
const trmOf = new Map();
let trm = 4_050_0000;
for (const d of days(FROM, TODAY)) {
  trm += next(-140_000, 110_000);
  trmOf.set(d, trm);
  await db.run(
    `INSERT INTO exchange_rates (on_date, base_code, quote_code, rate_scaled, source, fetched_at)
     VALUES (?, 'USD', 'COP', ?, 'trm', ?)`, [d, trm, NOW()]);
}
for (const [i, d] of days(FROM, TODAY).entries()) {
  if (i % 7 === 0 || d === TODAY) await rates.set({ on_date: d, base_code: 'EUR', quote_code: 'COP', rate_scaled: Math.round(trmOf.get(d) * 1.09), source: 'derived' });
}

// ---- Categories: the starter ones, coloured, plus some of the person's own ----

const cat = async (name, kind) => (await db.queryOne('SELECT id FROM categories WHERE name = ? AND kind = ?', [name, kind])).id;
const COLORS = {
  Mercado: '#34c98b', Restaurante: '#ff9152', Transporte: '#4cb8f5', 'Automóvil': '#6378ff', Casa: '#d77bff',
  Facturas: '#f6b93b', Salud: '#ef5b66', Entretenimiento: '#9b7bff', Ropa: '#ff6b9a', 'Cuidado personal': '#2ec4b6',
  'Tecnología': '#5c7cfa', 'Educación': '#a3d955', Viajes: '#4cb8f5', Regalos: '#ff6b9a',
};
for (const [name, color] of Object.entries(COLORS)) await categories.update(await cat(name, 'expense'), { color });
await categories.update(await cat('Salario', 'income'), { color: '#34c98b' });

const petIcon = await icons.create({ name: 'Huella', mime_type: 'image/png', data: paw });
const mascotas = await cat('Mascotas', 'expense');
await categories.update(mascotas, { builtin_icon: null, custom_icon_id: petIcon, color: '#ff9152' });

const suscripciones = await categories.create({ name: 'Suscripciones', kind: 'expense', builtin_icon: 'play-circle-outline', color: '#9b7bff' });
const gimnasio = await categories.create({ name: 'Gimnasio', kind: 'expense', builtin_icon: 'barbell-outline', color: '#34c98b' });
const freelance = await categories.create({ name: 'Trabajos independientes', kind: 'income', builtin_icon: 'briefcase-outline', color: '#4cb8f5' });
const ajusteGanancias = await categories.create({ name: 'Ajuste de ganancias', kind: 'expense', builtin_icon: 'trending-down-outline', counts_as_return: true });
const interesesCdt = await categories.create({ name: 'Intereses CDT', kind: 'income', builtin_icon: 'ribbon-outline', color: '#f6b93b' });

const C = {
  salario: await cat('Salario', 'income'), depositos: await cat('Depósitos', 'income'), ventas: await cat('Ventas', 'income'),
  ganancia: await cat('Ganancia de inversión', 'income'), perdida: await cat('Pérdida de inversión', 'expense'),
  cashback: await cat('Cashback', 'income'),
  mercado: await cat('Mercado', 'expense'), restaurante: await cat('Restaurante', 'expense'), transporte: await cat('Transporte', 'expense'),
  auto: await cat('Automóvil', 'expense'), casa: await cat('Casa', 'expense'), facturas: await cat('Facturas', 'expense'),
  salud: await cat('Salud', 'expense'), entretenimiento: await cat('Entretenimiento', 'expense'), ropa: await cat('Ropa', 'expense'),
  cuidado: await cat('Cuidado personal', 'expense'), tecnologia: await cat('Tecnología', 'expense'), educacion: await cat('Educación', 'expense'),
  viajes: await cat('Viajes', 'expense'), regalos: await cat('Regalos', 'expense'), otros: await cat('Otros gastos', 'expense'),
};

// A product category of the person's own, with its own picture.
const starIcon = await icons.create({ name: 'Estrella', mime_type: 'image/png', data: star });
const bonoKind = await new ProductKindsRepository(db, NOW).create({ name: 'Bono de bienvenida', custom_icon_id: starIcon, counts_as: 'cashback' });

// ---- Accounts ----

const logo = await icons.create({ name: 'Logo Banco Azul', mime_type: 'image/png', data: bankLogo });
const make = (name, extra) => accounts.create({ type: 'debit', currency_code: 'COP', opened_on: '2025-09-30', opening_balance_minor: 0, ...extra, name });

const azul = await make('Banco Azul', { custom_icon_id: logo, color: '#2463eb', opening_balance_minor: P(4_200_000) });
const efectivo = await make('Efectivo', { type: 'cash', builtin_icon: 'cash-outline', color: '#34c98b', opening_balance_minor: P(350_000) });
const coral = await make('Tarjeta Coral', {
  type: 'credit', builtin_icon: 'card-outline', color: '#ff6b9a', credit_limit_minor: P(6_000_000), statement_day: 25, due_day: 10,
});
const indigo = await make('Tarjeta Índigo', {
  type: 'credit', builtin_icon: 'card-outline', color: '#6378ff', credit_limit_minor: P(2_500_000), statement_day: 5, due_day: 28,
});
const vieja = await make('Tarjeta Antigua', { type: 'credit', builtin_icon: 'card-outline', color: '#8a94a6', credit_limit_minor: P(1_000_000) });
const verde = await make('Ahorro Verde', { builtin_icon: 'leaf-outline', color: '#34c98b', opening_balance_minor: P(38_000_000) });
const naranja = await make('Cajita Naranja', { builtin_icon: 'cube-outline', color: '#ff9152', opening_balance_minor: P(7_500_000) });
const lila = await make('Bolsillo Lila', { builtin_icon: 'wallet-outline', color: '#9b7bff', opening_balance_minor: P(4_000_000) });
const indigoBank = await make('Banco Índigo', { builtin_icon: 'business-outline', color: '#5c7cfa', opening_balance_minor: P(26_000_000) });
const fondo = await make('Fiducia Ámbar', { type: 'investment', builtin_icon: 'trending-up-outline', color: '#f6b93b', opening_balance_minor: P(52_000_000) });
const travelIcon = await icons.create({ name: 'Maleta', mime_type: 'image/png', data: suitcase });
const viajes = await groups.create({ name: 'Global Viajes', custom_icon_id: travelIcon, color: '#2ec4b6' });
const viajesCop = await make('Global Viajes COP', { group_id: viajes, builtin_icon: 'globe-outline', color: '#2ec4b6', opening_balance_minor: P(600_000) });
const viajesUsd = await make('Global Viajes USD', { group_id: viajes, currency_code: 'USD', builtin_icon: 'globe-outline', color: '#2ec4b6', opening_balance_minor: P(1_250) });
const euros = await make('Cuenta Euro', { currency_code: 'EUR', builtin_icon: 'logo-euro', color: '#4cb8f5', opening_balance_minor: P(400) });
const alcancia = await make('Alcancía Casa', { type: 'cash', builtin_icon: 'home-outline', color: '#d77bff', opening_balance_minor: P(500_000) });
const mama = await make('Cuenta de mamá', { builtin_icon: 'heart-outline', color: '#ef5b66', include_in_net_worth: false, opening_balance_minor: P(2_300_000) });

// The card's limit: raised in March, trimmed in August (rule 11).
const limits = new CreditLimitsRepository(db, NOW);
await limits.set({ account_id: coral, limit_minor: P(6_000_000), effective_on: '2025-09-30', note: 'Cupo inicial' });
await limits.set({ account_id: coral, limit_minor: P(8_000_000), effective_on: '2026-03-15', note: 'Aumento de cupo' });
await limits.set({ account_id: coral, limit_minor: P(7_500_000), effective_on: '2026-08-20', note: 'El banco bajó el cupo' });

// ---- Everyday life ----

const spend = (account, category, day, pesos, note, extra = {}) =>
  tx.create({ account_id: account, category_id: category, occurred_on: day, amount_minor: -P(pesos), description: note, source: 'manual', ...extra });
const earn = (account, category, day, pesos, note, extra = {}) =>
  tx.create({ account_id: account, category_id: category, occurred_on: day, amount_minor: P(pesos), description: note, source: 'manual', ...extra });
const move = (day, from, to, pesos, note, extra = {}) => transfers.create({
  occurred_on: day, description: note,
  from: { account_id: from, amount_minor: P(pesos), ...(extra.from ?? {}) },
  to: { account_id: to, amount_minor: P(extra.toAmount ?? pesos), ...(extra.to ?? {}) },
});

const LIFE = [
  // category, notes, [min, max] pesos, times a month, account
  [C.mercado, ['Mercado semanal', 'Frutas y verduras', 'Mercado del mes'], [60_000, 320_000], 4, coral],
  [C.restaurante, ['Almuerzo', 'Cena con amigos', 'Almuerzo ejecutivo', 'Café y postre'], [18_000, 140_000], 6, coral],
  [C.transporte, ['Taxi', 'Viaje en app de transporte', 'Recarga transporte público'], [8_000, 45_000], 5, efectivo],
  [C.auto, ['Gasolina', 'Parqueadero', 'Lavado del carro'], [15_000, 180_000], 3, coral],
  [C.salud, ['Farmacia', 'Cita médica'], [25_000, 160_000], 1, coral],
  [C.ropa, ['Camisa', 'Zapatos', 'Ropa deportiva'], [70_000, 260_000], 1, indigo],
  [C.cuidado, ['Peluquería', 'Productos de aseo'], [25_000, 90_000], 1, efectivo],
  [C.entretenimiento, ['Cine', 'Concierto', 'Juego de mesa'], [25_000, 120_000], 1, indigo],
  [mascotas, ['Concentrado para Luna', 'Veterinario', 'Arena para gato'], [40_000, 150_000], 1, coral],
];
const cardSpent = new Map(); // month -> card -> pesos
const addCard = (month, card, pesos) => {
  const m = cardSpent.get(month) ?? new Map();
  m.set(card, (m.get(card) ?? 0) + pesos);
  cardSpent.set(month, m);
};

for (const month of months) {
  const isNow = month === thisMonth;
  const lastDay = isNow ? 2 : 28;
  if (!isNow) {
    // Income: the salary on the 25th, sometimes a job on the side.
    await earn(azul, C.salario, on(month, 25), 10_200_000, 'Pago nómina');
    if (next(0, 2) === 0) await earn(azul, freelance, on(month, next(8, 20)), next(6, 18) * 100_000, 'Diseño de logo para cliente');
    // What comes back every month: rent, bills, subscriptions.
    await spend(azul, C.casa, on(month, 1), 1_650_000, 'Arriendo');
    await spend(azul, C.facturas, on(month, 8), next(95, 140) * 1_000, 'Energía');
    await spend(azul, C.facturas, on(month, 12), 89_900, 'Internet y TV');
    await spend(coral, suscripciones, on(month, 3), 44_900, 'Suscripción de streaming');
    await spend(coral, suscripciones, on(month, 17), 16_900, 'Suscripción de música');
    addCard(month, coral, 44_900 + 16_900);
    if (month <= '2026-03') await spend(azul, gimnasio, on(month, 5), 120_000, 'Mensualidad gimnasio');
    // Saving: part of the salary to Ahorro Verde, cash withdrawn, the home's piggy bank.
    await move(on(month, 26), azul, verde, 1_500_000, 'Ahorro del mes');
    await move(on(month, 10), azul, efectivo, 200_000, 'Retiro cajero');
    if (month >= '2026-07') await move(on(month, 27), azul, alcancia, 150_000, 'Ahorro para la casa');
    // Money for mum, kept in an account outside net worth.
    await move(on(month, 15), azul, mama, 300_000, 'Plata para mamá');
    await spend(mama, C.salud, on(month, 20), next(150, 280) * 1_000, 'Medicamentos de mamá');
  }
  for (const [category, notes, [low, high], times, account] of LIFE) {
    const count = isNow ? (category === C.mercado || category === C.restaurante ? 2 : 0) : times;
    for (let n = 0; n < count; n++) {
      const pesos = Math.round(next(low, high) / 100) * 100;
      await spend(account, category, on(month, next(1, lastDay)), pesos, pick(notes));
      if (account === coral || account === indigo) addCard(month, account, pesos);
    }
  }
}

// A charge repeated twice in one month, and its refund on the card.
await spend(coral, suscripciones, '2026-08-03', 44_900, 'Suscripción de streaming');
await earn(coral, suscripciones, '2026-08-09', 44_900, 'Reverso cobro doble streaming');
// A refund of a purchase on the card (income on a card is a refund).
await spend(coral, C.tecnologia, '2026-06-14', 389_000, 'Audífonos');
await earn(coral, C.tecnologia, '2026-06-21', 389_000, 'Devolución audífonos');
addCard('2026-08', coral, 0);
// Bigger moments of the year.
await spend(coral, C.regalos, '2025-12-18', 640_000, 'Regalos de Navidad');
addCard('2025-12', coral, 640_000);
await spend(azul, C.educacion, '2026-02-02', 1_200_000, 'Curso de inglés');
await earn(efectivo, C.ventas, '2026-05-10', 450_000, 'Venta de bicicleta usada');
await earn(azul, C.depositos, '2026-04-04', 300_000, 'Devolución de un préstamo a un amigo');
// This month: enough on eating out to pass its cap, groceries close to theirs.
await spend(coral, C.restaurante, '2026-10-01', 245_000, 'Cena de aniversario');
await spend(coral, C.mercado, '2026-10-02', 210_000, 'Mercado del mes');
await spend(efectivo, C.transporte, '2026-10-01', 32_000, 'Taxi');
await spend(coral, C.entretenimiento, '2026-10-02', 135_000, 'Boletas de teatro');

// The cards paid. Coral: in full each month on the 8th, but this statement
// only in part (the "partial" state). Índigo: paid until July, September's
// statement not yet - overdue.
const debtOn = async (account, day) => -(await accounts.balanceOn(account, day));
for (const month of months.slice(1)) {
  if (month === thisMonth) continue;
  const prev = months[months.indexOf(month) - 1];
  const owed = await debtOn(coral, `${prev}-25`);
  if (owed > 0) await move(on(month, 8), azul, coral, owed / 100, 'Pago tarjeta Coral');
  if (month <= '2026-08') {
    const owedIndigo = await debtOn(indigo, `${month}-05`);
    if (owedIndigo > 0) await move(on(month, 20), azul, indigo, owedIndigo / 100, 'Pago tarjeta Índigo');
  }
}
const coralStatement = await debtOn(coral, '2026-09-25');
await move('2026-10-01', azul, coral, Math.round(coralStatement / 100 * 0.4), 'Abono tarjeta Coral');

// The archived card: used last year, paid, closed.
await spend(vieja, C.ropa, '2025-10-11', 210_000, 'Chaqueta');
await move('2025-11-05', azul, vieja, 210_000, 'Pago tarjeta antigua');
await accounts.archive(vieja);
// The gym category: used until March, then archived.
await categories.archive(gimnasio);

// ---- Currencies ----

// Pesos to dollars inside the group, at the rate the provider applied.
const usdRate = d => Math.round(trmOf.get(d) * 1.012);
for (const [d, usd] of [['2026-01-12', 500], ['2026-05-20', 800]]) {
  const r = usdRate(d);
  await transfers.create({
    occurred_on: d, description: 'Compra de dólares',
    from: { account_id: viajesCop, amount_minor: P(Math.round(usd * r / 10_000)) },
    to: { account_id: viajesUsd, amount_minor: P(usd), rate_scaled: r, rate_source: 'manual' },
  });
}
// Spending in dollars on a trip, each with the rate charged.
for (const [d, usd, note, category] of [
  ['2026-06-03', 84.5, 'Hotel noche 1', C.viajes], ['2026-06-04', 32.75, 'Cena en el puerto', C.restaurante],
  ['2026-06-05', 18.2, 'Metro y bus', C.transporte], ['2026-06-06', 129.99, 'Tiquete de tren', C.viajes],
]) {
  await tx.create({ account_id: viajesUsd, category_id: category, occurred_on: d, amount_minor: -P(usd), rate_scaled: usdRate(d), rate_source: 'manual', description: note, source: 'manual' });
}
// One saved with no rate: valued at the official rate of its day (rule 4).
await tx.create({
  account_id: viajesUsd, category_id: C.viajes, occurred_on: '2026-06-07', amount_minor: -P(45),
  rate_scaled: trmOf.get('2026-06-07'), rate_source: 'trm', confidence: 'low', description: 'Museo', source: 'manual',
});
await earn(viajesCop, C.depositos, '2025-12-02', 2_000_000, 'Prima para viajes');
await move('2026-05-15', azul, viajesCop, 3_500_000, 'Plata para el viaje');
// Euros: a trip in April, topped up from the dollars.
const eurRate = d => Math.round(trmOf.get(d) * 1.09);
for (const [d, eur, note] of [['2026-04-08', 62.4, 'Almuerzo en Lisboa'], ['2026-04-09', 145, 'Hostal'], ['2026-04-10', 27.8, 'Tranvía y museo']]) {
  await tx.create({ account_id: euros, category_id: C.viajes, occurred_on: d, amount_minor: -P(eur), rate_scaled: eurRate(d), rate_source: 'derived', description: note, source: 'manual' });
}
await transfers.create({
  occurred_on: '2026-04-02', description: 'Dólares a euros',
  from: { account_id: viajesUsd, amount_minor: P(300), rate_scaled: trmOf.get('2026-04-02') },
  to: { account_id: euros, amount_minor: P(273.5), rate_scaled: eurRate('2026-04-02') },
});

// ---- Products and yields ----

const START = '2025-10-01';
const productOf = async (account, name) => {
  const [product] = await yields.products(account);
  await yields.renameProduct(product.id, name);
  return product.id;
};

// Ahorro Verde: big enough to be withheld; a ledger product and a typed one.
await yields.enrol({ account_id: verde, opening_on: START, withholding: true });
const verdeP = await productOf(verde, 'Cuenta de ahorros');
// Both products carry the figure the bank shows, as an account with pockets does.
await yields.setProductSource(verdeP, 'manual');
await yields.setDefaultProduct(verde, verdeP);
await yields.setProductBalance({ product_id: verdeP, valid_from: '2025-09-30', amount_minor: P(35_000_000), note: 'Leído en la app del banco' });
await yields.setRate({ account_id: verde, product_id: verdeP, valid_from: START, annual_rate_scaled: pct(10.5) });
await yields.setRate({ account_id: verde, product_id: verdeP, valid_from: '2026-05-01', annual_rate_scaled: pct(9.75) });
const verdeMeta = await yields.addProduct({ account_id: verde, name: 'Bolsillo Viaje', source: 'manual', sort_order: 1 });
await yields.setProductBalance({ product_id: verdeMeta, valid_from: '2025-09-30', amount_minor: P(3_000_000), note: 'Leído en la app del banco' });
await yields.setRate({ account_id: verde, product_id: verdeMeta, valid_from: START, annual_rate_scaled: pct(8) });
await transfers.create({
  occurred_on: '2026-02-14', description: 'Al bolsillo de viaje',
  from: { account_id: verde, product_id: verdeP, amount_minor: P(1_000_000) },
  to: { account_id: verde, product_id: verdeMeta, amount_minor: P(1_000_000) },
});
// Cashback: some counted only on the product, one cashed into net worth, a welcome bonus.
for (const month of months.slice(0, -1)) {
  await writeScoped(db, yields, {
    scope: 'product', kind: 'income', accountId: verde, categoryId: C.cashback, productId: verdeP, movementProductId: verdeP,
    onDate: on(month, 28), amountMinor: P(next(8, 40) * 1_000), note: 'Cashback de la tarjeta',
  });
}
await writeScoped(db, yields, {
  scope: 'netWorth', kind: 'income', accountId: verde, categoryId: C.cashback, productId: verdeP, movementProductId: verdeP,
  onDate: '2026-07-31', amountMinor: P(150_000), note: 'Pasar cashback al saldo',
});
await yields.adjust({ account_id: verde, on_date: '2025-10-15', amount_minor: P(50_000), kind: 'cashback', source: 'cashback', product_kind_id: bonoKind, product_id: verdeP, note: 'Bono por abrir la cuenta' });

// Cajita Naranja: a rate cut in June.
await yields.enrol({ account_id: naranja, opening_on: START, withholding: true });
const naranjaP = await productOf(naranja, 'Cajita');
await yields.setRate({ account_id: naranja, product_id: naranjaP, valid_from: START, annual_rate_scaled: pct(9) });
await yields.setRate({ account_id: naranja, product_id: naranjaP, valid_from: '2026-06-01', annual_rate_scaled: pct(8.25) });
for (const month of months.slice(0, -1)) await move(on(month, 27), azul, naranja, 300_000, 'Para el viaje');

// Bolsillo Lila: 6% every day plus 5% in a month with 400,000 spent from it.
await yields.enrol({ account_id: lila, opening_on: START, withholding: false });
const lilaP = await productOf(lila, 'Bolsillo');
await yields.setRate({ account_id: lila, product_id: lilaP, component: 'Diario', payout: 'daily', valid_from: START, annual_rate_scaled: pct(6) });
await yields.setRate({
  account_id: lila, product_id: lilaP, component: 'Mensual por gasto', payout: 'monthly', valid_from: START,
  annual_rate_scaled: pct(5), requires_monthly_spend_minor: P(400_000),
});
for (const month of months.slice(0, -1)) {
  let left = next(0, 1) ? next(410, 650) * 1_000 : next(120, 380) * 1_000;
  while (left > 0) {
    const piece = Math.min(left, next(40, 160) * 1_000);
    await spend(lila, pick([C.mercado, C.restaurante]), on(month, next(1, 28)), piece, 'Compra con tarjeta Lila');
    left -= piece;
  }
  await move(on(month, 26), azul, lila, 450_000, 'Recarga bolsillo');
}

// Global Viajes in dollars earns too.
await yields.enrol({ account_id: viajesUsd, opening_on: START, withholding: false });
const usdP = await productOf(viajesUsd, 'Cuenta en dólares');
await yields.setRate({ account_id: viajesUsd, product_id: usdP, valid_from: START, annual_rate_scaled: pct(4) });

// Banco Índigo: savings, a CDT funded from it, and taxes put aside outside net worth.
await yields.enrol({ account_id: indigoBank, opening_on: START, withholding: true });
const indigoP = await productOf(indigoBank, 'Ahorros');
await yields.setDefaultProduct(indigoBank, indigoP);
await yields.setProductSource(indigoP, 'manual');
await yields.setProductBalance({ product_id: indigoP, valid_from: '2025-09-30', amount_minor: P(26_000_000), note: 'Leído en la app del banco' });
await yields.setRate({ account_id: indigoBank, product_id: indigoP, valid_from: START, annual_rate_scaled: pct(8.5) });
const cdt = await yields.addProduct({
  account_id: indigoBank, name: 'CDT 12 meses', kind: 'cdt', sort_order: 1, payout: 'monthly', payout_months: 1,
  opened_on: '2026-03-02', term_months: 12, matures_into_product_id: indigoP, income_category_id: interesesCdt,
});
await yields.setProductBalance({ product_id: cdt, valid_from: '2026-03-01', amount_minor: 0 });
await transfers.create({
  occurred_on: '2026-03-02', description: 'Abrir CDT',
  from: { account_id: indigoBank, product_id: indigoP, amount_minor: P(15_000_000) },
  to: { account_id: indigoBank, product_id: cdt, amount_minor: P(15_000_000) },
});
await yields.setCdtCapital(cdt, { opened_on: '2026-03-02', matures_on: '2027-03-02', capital_minor: P(15_000_000) });
await yields.setRate({ account_id: indigoBank, product_id: cdt, payout: 'monthly', valid_from: '2026-03-02', annual_rate_scaled: pct(11.2) });
// A short CDT that already matured: paid its term, handed everything to Ahorros and closed.
const cdtCorto = await yields.addProduct({
  account_id: indigoBank, name: 'CDT 90 días', kind: 'cdt', sort_order: 3,
  opened_on: '2026-04-01', term_months: 3, matures_into_product_id: indigoP, income_category_id: interesesCdt,
});
await yields.setProductBalance({ product_id: cdtCorto, valid_from: '2026-03-31', amount_minor: 0 });
await transfers.create({
  occurred_on: '2026-04-01', description: 'Abrir CDT corto',
  from: { account_id: indigoBank, product_id: indigoP, amount_minor: P(5_000_000) },
  to: { account_id: indigoBank, product_id: cdtCorto, amount_minor: P(5_000_000) },
});
await yields.setCdtCapital(cdtCorto, { opened_on: '2026-04-01', matures_on: '2026-07-01', capital_minor: P(5_000_000) });
await yields.setRate({ account_id: indigoBank, product_id: cdtCorto, valid_from: '2026-04-01', annual_rate_scaled: pct(10.4) });
const impuestos = await yields.addProduct({ account_id: indigoBank, name: 'Para el impuesto de renta', sort_order: 2 });
await yields.setProductBalance({ product_id: impuestos, valid_from: '2026-06-30', amount_minor: 0 });
await yields.setProductNetWorth(impuestos, false);
await yields.setRate({ account_id: indigoBank, product_id: impuestos, valid_from: '2026-07-01', annual_rate_scaled: pct(9) });
for (const month of ['2026-07', '2026-08', '2026-09']) {
  await transfers.create({
    occurred_on: on(month, 28), description: 'Apartar para la renta',
    from: { account_id: indigoBank, product_id: indigoP, amount_minor: P(800_000) },
    to: { account_id: indigoBank, product_id: impuestos, amount_minor: P(800_000) },
  });
}
await move('2026-02-27', azul, indigoBank, 2_000_000, 'Ahorro a Índigo', { to: { product_id: indigoP } });

// Fiducia Ámbar: gains and losses written down, contributions, one correction.
let fondoBalance = P(52_000_000);
for (const month of months.slice(0, -1)) {
  for (const d of [5, 20]) {
    const change = Math.round(fondoBalance * next(-40, 90) / 10_000);
    await tx.create({
      account_id: fondo, category_id: change >= 0 ? C.ganancia : C.perdida, occurred_on: on(month, d),
      amount_minor: change, description: change >= 0 ? 'Subió la inversión' : 'Bajó la inversión', source: 'manual',
    });
    fondoBalance += change;
  }
  await move(on(month, 27), azul, fondo, 700_000, 'Aporte al fondo');
  fondoBalance += P(700_000);
}
await tx.create({ account_id: fondo, category_id: ajusteGanancias, occurred_on: '2026-07-27', amount_minor: -P(310_000), description: 'Ajuste de rendimientos del fondo', source: 'manual' });

const engine = new AccrualEngine(db, yields, tax);
await engine.accrueAll(UP_TO);
await accrueAndSettle(db, yields, tax, indigoBank, UP_TO);

// Days checked against the bank, mostly exact, a few off by centavos.
const checked = await db.query(
  `SELECT product_id, on_date, net_minor FROM yield_days
   WHERE account_id IN (?, ?) AND on_date BETWEEN '2026-09-10' AND ? ORDER BY on_date`, [verde, naranja, UP_TO]);
for (const row of checked) {
  await yields.correctDay(row.product_id, row.on_date, row.net_minor + (next(0, 7) === 0 ? next(-60, 60) : 0));
}
// Lila's bonus for August: paid by the bank on the 3rd, not the 1st; July's corrected to what it paid.
await yields.movePayment(lila, lilaP, 'Mensual por gasto', '2026-09-01', '2026-09-01', '2026-09-03').catch(() => {});
const july = await db.queryOne(
  `SELECT SUM(net_minor) AS total FROM yield_days WHERE product_id = ? AND component = 'Mensual por gasto' AND paid_on = '2026-08-01'`, [lilaP]).catch(() => null);
if (july?.total) await yields.correctPayment(lilaP, 'Mensual por gasto', '2026-08-01', july.total + 1_250).catch(() => {});
await engine.accrueAll(UP_TO);

// ---- Debts ----

const pay = async (loanId, from, number, paidOn, extra = {}) => {
  const loan = (await loans.all()).find(l => l.account.id === loanId);
  const schedule = loanSchedule(loan.terms, loan.payments, paidOn);
  const row = schedule.rows.find(r => r.type === 'installment' && r.number === number);
  await loans.recordPayment({
    loanAccountId: loanId, fromAccountId: from, kind: 'installment', number, paidOn,
    capitalMinor: row.capitalMinor, interestMinor: row.interestMinor, insuranceMinor: row.insuranceMinor,
    lateMinor: extra.lateMinor ?? 0, extraMode: null, note: extra.note ?? `Cuota ${number}`,
    interestCategory: 'Intereses', insuranceCategory: 'Seguros', uvrCategory: 'Ajuste UVR',
  });
};

// A car loan disbursed into Banco Azul; ten installments and a payment ahead.
const carro = await loans.create({
  name: 'Crédito vehículo', builtinIcon: 'car-outline', color: '#6378ff',
  principalMinor: P(48_000_000), annualRateScaled: Math.round(0.165 * LOAN_EA), rateQuoted: 'ea', rateKind: 'fixed',
  system: 'fixed_installment', installments: 60, periodMonths: 1, disbursedOn: '2025-11-10', firstDueOn: '2025-12-10',
  insuranceKind: 'fixed', insuranceMinor: P(38_000), insuranceRateScaled: 0, bankInstallmentMinor: null,
  paidFromAccountId: azul, paidBefore: 0, balanceAfterBeforeMinor: null, disbursedIntoAccountId: azul,
});
await spend(azul, C.auto, '2025-11-12', 47_500_000, 'Compra del carro');
const carDue = ['2025-12', '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09'];
for (const [i, month] of carDue.entries()) {
  await pay(carro, azul, i + 1, `${month}-10`);
  if (month === '2026-06') {
    await loans.recordPayment({
      loanAccountId: carro, fromAccountId: azul, kind: 'extra', number: null, paidOn: '2026-06-20',
      capitalMinor: P(3_000_000), interestMinor: 0, insuranceMinor: 0, lateMinor: 0, extraMode: 'term',
      note: 'Abono con la prima', interestCategory: 'Intereses', insuranceCategory: 'Seguros', uvrCategory: 'Ajuste UVR',
    });
  }
}

// A loan from before the app: 18 of 36 paid then; September's still unpaid.
const libre = await loans.create({
  name: 'Libre inversión', builtinIcon: 'cash-outline', color: '#ef5b66',
  principalMinor: P(20_000_000), annualRateScaled: eaFromMonthly(Math.round(0.0145 * LOAN_EA)), rateQuoted: 'mv', rateKind: 'fixed',
  system: 'fixed_installment', installments: 36, periodMonths: 1, disbursedOn: '2024-09-05', firstDueOn: '2024-10-05',
  insuranceKind: 'balance', insuranceMinor: 0, insuranceRateScaled: 1_200, bankInstallmentMinor: null,
  paidFromAccountId: azul, paidBefore: 18, balanceAfterBeforeMinor: null, disbursedIntoAccountId: null,
});
for (const [n, d, late] of [[19, '2026-04-05', 0], [20, '2026-05-05', 0], [21, '2026-06-05', 0], [22, '2026-07-09', P(14_300)], [23, '2026-08-05', 0]]) {
  await pay(libre, azul, n, d, { lateMinor: late, note: late ? 'Cuota con mora' : undefined });
}

// A UVR mortgage, cyclic decreasing, disbursed in September.
await loans.create({
  name: 'Hipoteca', builtinIcon: 'home-outline', color: '#d77bff',
  principalMinor: P(60_000_000), annualRateScaled: Math.round(0.075 * LOAN_EA), rateQuoted: 'ea', rateKind: 'fixed',
  system: 'fixed_installment', installments: 180, periodMonths: 1, disbursedOn: '2026-09-16', firstDueOn: '2026-10-15',
  insuranceKind: 'balance', insuranceMinor: 0, insuranceRateScaled: 400, bankInstallmentMinor: null,
  paidFromAccountId: azul, paidBefore: 0, balanceAfterBeforeMinor: null, disbursedIntoAccountId: null,
  unit: 'UVR', decreaseScaled: Math.round(0.04 * LOAN_EA),
});

// ---- Presupuestos: caps and goals ----

const caps = new LimitsRepository(db, NOW);
await caps.create({ amountMinor: P(300_000), accountId: null, warnAt80: true, categoryIds: [C.restaurante] });
await caps.create({ amountMinor: P(900_000), accountId: null, warnAt80: true, categoryIds: [C.mercado] });
await caps.create({ amountMinor: P(350_000), accountId: null, warnAt80: true, categoryIds: [C.transporte, C.auto] });
await caps.create({ amountMinor: P(150_000), accountId: coral, warnAt80: false, categoryIds: [C.entretenimiento, suscripciones] });
await caps.create({ amountMinor: P(200_000), accountId: null, warnAt80: true, categoryIds: [mascotas] });

const goals = new GoalsRepository(db, NOW);
await goals.create({
  name: 'Viaje a Japón', icon: 'airplane-outline', color: '#4cb8f5', amountMinor: P(22_000_000), dueMonth: '2028-06',
  kind: 'custom', months: null, allAccounts: false,
  places: [{ accountId: naranja, productId: null, counts: 'all' }, { accountId: viajesUsd, productId: null, counts: 'all' }],
}, TODAY);
await goals.create({
  name: 'Remodelar la cocina', icon: 'home-outline', color: '#ff9152', amountMinor: P(4_000_000), dueMonth: '2026-12',
  kind: 'custom', months: null, allAccounts: false,
  places: [{ accountId: alcancia, productId: null, counts: 'from_start' }],
}, '2026-06-30');
await goals.create({
  name: 'Cuota inicial apartamento', icon: 'business-outline', color: '#6378ff', amountMinor: P(80_000_000), dueMonth: null,
  kind: 'custom', months: null, allAccounts: false,
  places: [{ accountId: fondo, productId: null, counts: 'from_start' }, { accountId: verde, productId: verdeMeta, counts: 'all' }],
}, '2026-01-01');
await goals.create({
  name: 'Fondo de emergencia', icon: 'shield-checkmark-outline', color: '#34c98b', amountMinor: P(60_000_000), dueMonth: null,
  kind: 'emergency', months: 6, allAccounts: true, places: [],
}, TODAY);
const bici = await goals.create({
  name: 'Bicicleta', icon: 'bicycle-outline', color: '#a3d955', amountMinor: P(400_000), dueMonth: '2026-05',
  kind: 'custom', months: null, allAccounts: false, places: [{ accountId: efectivo, productId: null, counts: 'all' }],
}, '2026-01-01');
await goals.setReached(bici, '2026-04-30');
await goals.setArchived(bici, true);

// ---- Movimientos por revisar ----

const proposals = new ProposalsRepository(db, NOW);
await proposals.learnFromLedger();
const file = 'extracto-tarjeta-coral-sep-2026.pdf';
const rows = [
  ['2026-09-26', -84_300, 'MERCADO SEMANAL SUPERMERCADO CENTRAL'],
  ['2026-09-27', -45_900, 'RESTAURANTE LA ESQUINA'],
  ['2026-09-28', -23_500, 'FARMACIA DEL BARRIO'],
  ['2026-09-29', -16_900, 'SUSCRIPCION DE MUSICA'],
  ['2026-09-29', -16_900, 'SUSCRIPCION DE MUSICA'],
  ['2026-09-30', -320_000, 'TIENDA DE DEPORTES XYZ'],
  ['2026-10-01', -245_000, 'CENA DE ANIVERSARIO'],
  ['2026-10-01', 9_800, 'DEVOLUCION PARQUEADERO'],
];
await proposals.propose(`${file} ${NOW()}`, rows.map(([d, pesos, description], line) => ({
  source: 'statement', account_id: coral, occurred_on: d, amount_minor: P(pesos), description,
  evidence: { file, line: line + 12, page: 1, confidence: 'certain', balance_minor: null },
})));
await proposals.propose(`aviso ${NOW()}`, [
  { source: 'notification', account_id: azul, occurred_on: '2026-10-02', amount_minor: -P(62_000), description: 'Compra aprobada en DROGUERIA SALUD por $62.000',
    evidence: { package: 'com.ejemplo.bancoazul', title: 'Banco Azul', text: 'Compra aprobada en DROGUERIA SALUD por $62.000', posted_at: `${TODAY}T08:14:00Z` } },
  { source: 'notification', account_id: azul, occurred_on: '2026-10-02', amount_minor: null, description: null,
    evidence: { package: 'com.ejemplo.bancoazul', title: 'Banco Azul', text: 'Tienes un nuevo movimiento. Ingresa a la app para verlo.', posted_at: `${TODAY}T08:40:00Z` } },
  // Both halves of one transfer, seen from each bank: the review offers to join them.
  { source: 'notification', account_id: azul, occurred_on: '2026-10-02', amount_minor: -P(500_000), description: 'Transferencia enviada a Ahorro Verde por $500.000',
    evidence: { package: 'com.ejemplo.bancoazul', title: 'Banco Azul', text: 'Transferencia enviada a Ahorro Verde por $500.000', posted_at: `${TODAY}T09:02:00Z` } },
  { source: 'notification', account_id: verde, occurred_on: '2026-10-02', amount_minor: P(500_000), description: 'Recibiste $500.000 desde Banco Azul',
    evidence: { package: 'com.ejemplo.ahorroverde', title: 'Ahorro Verde', text: 'Recibiste $500.000 desde Banco Azul', posted_at: `${TODAY}T09:03:00Z` } },
]);

// ---- Simulador de renta ----

const inputs = defaultInputs(2026, new Date(`${TODAY}T12:00:00Z`));
const yearYields = await db.queryOne(`SELECT SUM(net_minor) AS net FROM yield_days WHERE on_date LIKE '2026-%' AND account_id IN (?, ?, ?, ?)`, [verde, naranja, lila, indigoBank]);
await new TaxSimulationsRepository(db, NOW).save(2026, {
  ...inputs,
  employment: 'ordinary', dependents: 1, monthlySalaryMinor: P(9_500_000), monthsWorked: 12,
  feeIncomeMinor: P(4_800_000), feeCostsMinor: P(600_000),
  capitalIncomeMinor: yearYields?.net ?? P(4_000_000), financialYieldMinor: yearYields?.net ?? P(4_000_000),
  voluntaryOwnMinor: P(3_000_000), healthPolicyMinor: P(2_400_000), eInvoicePurchasesMinor: P(18_000_000),
  monthlyWithholdingMinor: Array.from({ length: 12 }, () => P(410_000)),
});

// ---- Out ----

const folder = process.argv[2] ?? 'G:/My Drive/Finance App/Pruebas';
mkdirSync(folder, { recursive: true });
const name = 'finance-demostracion-completa.json';
const backup = await exportBackup(db);
writeFileSync(join(folder, name), toJson(backup));
const counts = Object.entries(backup.tables).filter(([, list]) => list.length > 0)
  .map(([table, list]) => `${table} ${list.length}`).join(', ');
console.log(`escrito en ${folder}:\n  ${name}\n  ${counts}`);
