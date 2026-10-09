// @ts-nocheck - ported from a Node script that ran untyped; its types are
// checked where it meets the app (the signature below) and its behaviour by
// tools/db/showcase.test.mjs, which builds it on several days.
/**
 * Sample data with every feature of the app in use, built on the phone for a
 * person who has just installed it and wants to see what it does before
 * typing anything (Jose, 2026-10-09; mockups `21a`-`21f`).
 *
 * Invented people and money, written through the app's own repositories and
 * worked out by its own engines, so each figure is one the app would really
 * produce. It was first a script with fixed dates (`tools/db/showcase-data.mjs`,
 * 2026-10-02); here every date is moved to today, so "this month" - the caps,
 * a card's statement, a loan's next installment - always has something in it.
 * The script now calls this with its old day.
 *
 * What it holds, by screen:
 *   - Inicio / Cuentas: debit, cash, credit, investment and loan accounts; a
 *     group holding pesos and dollars; a euro account; one account outside
 *     net worth; an archived card; pictures of one's own; colours.
 *   - Every movement kind, across currencies, recurring charges, one charge
 *     repeated twice in a month, notes that repeat.
 *   - Cards in every state; products and yields (withholding, cashback, a
 *     rate cut, a spending bonus, dollars, CDTs, a product set aside); a fund
 *     with gains and losses; three loans (one in UVR); caps and goals;
 *     proposals waiting for review; the income-tax simulator filled in.
 *   - Not the phone's bank notifications: Android keeps them outside the
 *     database.
 *
 * The names are Spanish whatever the app's language; the categories are the
 * starter ones the database already holds, found in either language.
 */

import type { SqlDriver } from '../database/sql-driver';
import type { IsoDate } from '../database/types';
import { STARTER_CATEGORIES } from '../database/starter-categories';
import { AccountsRepository } from '../database/repositories/accounts.repository';
import { AccountGroupsRepository } from '../database/repositories/account-groups.repository';
import { CategoriesRepository } from '../database/repositories/categories.repository';
import { CreditLimitsRepository } from '../database/repositories/credit-limits.repository';
import { CustomIconsRepository } from '../database/repositories/custom-icons.repository';
import { ProductKindsRepository } from '../database/repositories/product-kinds.repository';
import { ProposalsRepository } from '../database/repositories/proposals.repository';
import { RatesRepository } from '../database/repositories/rates.repository';
import { TaxParametersRepository, TAX_KEYS } from '../database/repositories/tax-parameters.repository';
import { TaxSimulationsRepository } from '../database/repositories/tax-simulations.repository';
import { TransactionsRepository } from '../database/repositories/transactions.repository';
import { TransfersRepository } from '../database/repositories/transfers.repository';
import { YieldsRepository } from '../database/repositories/yields.repository';
import { AccrualEngine } from '../yields/accrual';
import { accrueAndSettle } from '../yields/cdt';
import { EA_SCALE } from '../yields/yield-math';
import { writeScoped } from '../yields/entry-scope';
import { LoansRepository } from '../loans/loans.repository';
import { loanSchedule, eaFromMonthly, EA_SCALE as LOAN_EA } from '../loans/schedule';
import { LimitsRepository } from '../limits/limits.repository';
import { GoalsRepository } from '../goals/goals.repository';
import { defaultInputs } from '../tax/defaults';

/** The day the showcase was first written for; every date in it is moved from there to today. */
const WRITTEN_ON = '2026-10-02';

/** How far along it is, 0 to 1, for a progress bar. */
export type ShowcaseProgress = (fraction: number) => void | Promise<void>;

const DAY = 86_400_000;
const dayOf = (t: number): IsoDate => new Date(t).toISOString().slice(0, 10);
const timeOf = (d: IsoDate): number => Date.parse(`${d}T00:00:00Z`);

/** Moves a date `months` months later, keeping its day (the last of a shorter month). */
function shiftDate(date: IsoDate, months: number): IsoDate {
  const [y, m, d] = date.split('-').map(Number);
  const total = y * 12 + (m - 1) + months;
  const year = Math.floor(total / 12);
  const month = total % 12;
  const last = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`;
}

// ---- A small PNG, drawn here, so a picture of one's own is in the data ----

const CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of bytes) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
const u32 = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
function chunk(type: string, data: Uint8Array): Uint8Array {
  const typed = new Uint8Array([...type].map(c => c.charCodeAt(0)));
  const body = new Uint8Array(4 + data.length);
  body.set(typed, 0);
  body.set(data, 4);
  return new Uint8Array([...u32(data.length), ...body, ...u32(crc32(body))]);
}
/** zlib's deflate, which both the phone's WebView and Node carry built in. */
async function deflate(raw: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([raw as BlobPart]).stream().pipeThrough(new CompressionStream('deflate'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
/** `paint(x, y)` gives [r, g, b, a] for each pixel of a size x size picture. */
async function png(size: number, paint: (x: number, y: number) => number[]): Promise<Uint8Array> {
  const raw = new Uint8Array(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) raw.set(paint(x, y), y * (size * 4 + 1) + 1 + x * 4);
  }
  const head = new Uint8Array([...u32(size), ...u32(size), 8, 6, 0, 0, 0]);
  const parts = [
    new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', head), chunk('IDAT', await deflate(raw)), chunk('IEND', new Uint8Array(0)),
  ];
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const part of parts) { out.set(part, at); at += part.length; }
  return out;
}
const SIZE = 96;
const inCircle = (x: number, y: number, cx: number, cy: number, r: number) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r;

/**
 * Writes the showcase into `db`, which should be a fresh database with its
 * starter categories. `today` is the day it is built for; `now` stamps every
 * row (fixed, so the script's output is the same every time).
 */
export async function buildShowcase(
  db: SqlDriver,
  today: IsoDate,
  onProgress: ShowcaseProgress = () => undefined,
  now: () => string = () => `${today}T09:00:00Z`,
): Promise<void> {
const TODAY = today;
const NOW = now;
const [ty, tm] = TODAY.split('-').map(Number);
const SHIFT = (ty * 12 + tm) - (2026 * 12 + 10);
/** A date of the original, moved to today's calendar. */
const D = (date: IsoDate): IsoDate => shiftDate(date, SHIFT);
/** The same, never after today. */
const Dc = (date: IsoDate): IsoDate => (date > TODAY ? TODAY : date);
/** A month of the original, moved. */
const Mo = (month: string): string => shiftDate(`${month}-01`, SHIFT).slice(0, 7);
const UP_TO = dayOf(timeOf(TODAY) - DAY);
const FROM = D('2025-10-01');
const todayDay = Number(TODAY.slice(8, 10));

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

// ---- The database ----

// Pictures of one's own: a bank logo, a paw, a suitcase and a star.
const bankLogo = await png(SIZE, (x, y) => {
  if (!inCircle(x, y, 48, 48, 46)) return [0, 0, 0, 0];
  const stripe = x > 22 && x < 74 && [30, 46, 62].some(t => y >= t && y < t + 8);
  return stripe ? [255, 255, 255, 255] : [36, 99, 235, 255];
});
const paw = await png(SIZE, (x, y) => {
  const parts = [[48, 62, 20], [24, 36, 9], [40, 24, 9], [56, 24, 9], [72, 36, 9]];
  return parts.some(([cx, cy, r]) => inCircle(x, y, cx, cy, r)) ? [255, 145, 82, 255] : [0, 0, 0, 0];
});
const suitcase = await png(SIZE, (x, y) => {
  const body = x >= 14 && x <= 82 && y >= 30 && y <= 80;
  const handle = x >= 34 && x <= 62 && y >= 16 && y <= 30 && !(x > 40 && x < 56 && y > 22);
  const band = body && (x === 30 || x === 31 || x === 65 || x === 66);
  if (band) return [255, 255, 255, 255];
  return body || handle ? [46, 196, 182, 255] : [0, 0, 0, 0];
});
const star = await png(SIZE, (x, y) => {
  const dx = x - 48, dy = y - 50;
  const angle = Math.atan2(dy, dx);
  const reach = 22 + 20 * Math.abs(Math.cos(2.5 * angle));
  return Math.hypot(dx, dy) <= reach ? [246, 185, 59, 255] : [0, 0, 0, 0];
});

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
  await tax.set({ key, valid_from: D('2025-01-01'), value, source: 'Datos de ejemplo', confirmed: true });
}

// ---- Days and rates ----

const days = (from, to) => {
  const out = [];
  for (let t = Date.parse(`${from}T00:00:00Z`); t <= Date.parse(`${to}T00:00:00Z`); t += 86_400_000) {
    out.push(new Date(t).toISOString().slice(0, 10));
  }
  return out;
};
const months: string[] = []; // 'YYYY-MM' from FROM to this month
for (let i = 0; i <= 12; i++) months.push(shiftDate(`${FROM.slice(0, 7)}-01`, i).slice(0, 7));
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

await onProgress(0.1);

// ---- Categories: the starter ones, coloured, plus some of the person's own ----

const cat = async (name: string, kind: 'income' | 'expense'): Promise<number> => {
  const starter = STARTER_CATEGORIES.find(one => one.es === name && one.kind === kind);
  const row = await db.queryOne<{ id: number }>(
    'SELECT id FROM categories WHERE kind = ? AND name IN (?, ?) ORDER BY id LIMIT 1', [kind, name, starter?.en ?? name]);
  if (row) return row.id;
  return new CategoriesRepository(db, NOW).create({ name, kind, builtin_icon: starter?.icon ?? 'pricetag-outline' });
};
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
const make = (name, extra) => accounts.create({ type: 'debit', currency_code: 'COP', opened_on: D('2025-09-30'), opening_balance_minor: 0, ...extra, name });

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
await limits.set({ account_id: coral, limit_minor: P(6_000_000), effective_on: D('2025-09-30'), note: 'Cupo inicial' });
await limits.set({ account_id: coral, limit_minor: P(8_000_000), effective_on: D('2026-03-15'), note: 'Aumento de cupo' });
await limits.set({ account_id: coral, limit_minor: P(7_500_000), effective_on: D('2026-08-20'), note: 'El banco bajó el cupo' });

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

for (const month of months) {
  const isNow = month === thisMonth;
  const lastDay = isNow ? Math.min(todayDay, 28) : 28;
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
    if (month <= Mo('2026-03')) await spend(azul, gimnasio, on(month, 5), 120_000, 'Mensualidad gimnasio');
    // Saving: part of the salary to Ahorro Verde, cash withdrawn, the home's piggy bank.
    await move(on(month, 26), azul, verde, 1_500_000, 'Ahorro del mes');
    await move(on(month, 10), azul, efectivo, 200_000, 'Retiro cajero');
    if (month >= Mo('2026-07')) await move(on(month, 27), azul, alcancia, 150_000, 'Ahorro para la casa');
    // Money for mum, kept in an account outside net worth.
    await move(on(month, 15), azul, mama, 300_000, 'Plata para mamá');
    await spend(mama, C.salud, on(month, 20), next(150, 280) * 1_000, 'Medicamentos de mamá');
  }
  for (const [category, notes, [low, high], times, account] of LIFE) {
    const count = isNow ? Math.floor(times * Math.min(todayDay, 28) / 30) + (category === C.mercado || category === C.restaurante ? 1 : 0) : times;
    for (let n = 0; n < count; n++) {
      const pesos = Math.round(next(low, high) / 100) * 100;
      await spend(account, category, on(month, next(1, lastDay)), pesos, pick(notes));
    }
  }
}

// A charge repeated twice in one month, and its refund on the card.
await spend(coral, suscripciones, D('2026-08-03'), 44_900, 'Suscripción de streaming');
await earn(coral, suscripciones, D('2026-08-09'), 44_900, 'Reverso cobro doble streaming');
// A refund of a purchase on the card (income on a card is a refund).
await spend(coral, C.tecnologia, D('2026-06-14'), 389_000, 'Audífonos');
await earn(coral, C.tecnologia, D('2026-06-21'), 389_000, 'Devolución audífonos');
// Bigger moments of the year.
await spend(coral, C.regalos, D('2025-12-18'), 640_000, 'Regalos de Navidad');
await spend(azul, C.educacion, D('2026-02-02'), 1_200_000, 'Curso de inglés');
await earn(efectivo, C.ventas, D('2026-05-10'), 450_000, 'Venta de bicicleta usada');
await earn(azul, C.depositos, D('2026-04-04'), 300_000, 'Devolución de un préstamo a un amigo');
// This month: enough on eating out to pass its cap, groceries close to theirs.
await spend(coral, C.restaurante, Dc(D('2026-10-01')), 245_000, 'Cena de aniversario');
await spend(coral, C.mercado, Dc(D('2026-10-02')), 210_000, 'Mercado del mes');
await spend(efectivo, C.transporte, Dc(D('2026-10-01')), 32_000, 'Taxi');
await spend(coral, C.entretenimiento, Dc(D('2026-10-02')), 135_000, 'Boletas de teatro');

// The cards paid. Coral: in full on the 8th, every statement but the last,
// which is paid only in part today (the "partial" state). Índigo: paid until
// two months ago; last month's statement not yet - overdue.
const debtOn = async (account: number, day: IsoDate) => -(await accounts.balanceOn(account, day));
const lastCut = todayDay > 25 ? `${thisMonth}-25` : `${months[months.length - 2]}-25`;
for (const month of months.slice(1)) {
  const prev = months[months.indexOf(month) - 1];
  if (`${prev}-25` < lastCut) {
    const owed = await debtOn(coral, `${prev}-25`);
    if (owed > 0) await move(on(month, 8), azul, coral, owed / 100, 'Pago tarjeta Coral');
  }
  if (month !== thisMonth && month <= Mo('2026-08')) {
    const owedIndigo = await debtOn(indigo, `${month}-05`);
    if (owedIndigo > 0) await move(on(month, 20), azul, indigo, owedIndigo / 100, 'Pago tarjeta Índigo');
  }
}
const coralStatement = await debtOn(coral, lastCut);
await move(TODAY, azul, coral, Math.round(coralStatement / 100 * 0.4), 'Abono tarjeta Coral');

// The archived card: used last year, paid, closed.
await spend(vieja, C.ropa, D('2025-10-11'), 210_000, 'Chaqueta');
await move(D('2025-11-05'), azul, vieja, 210_000, 'Pago tarjeta antigua');
await accounts.archive(vieja);
// The gym category: used until March, then archived.
await categories.archive(gimnasio);

await onProgress(0.35);

// ---- Currencies ----

// Pesos to dollars inside the group, at the rate the provider applied.
const usdRate = d => Math.round(trmOf.get(d) * 1.012);
for (const [d, usd] of [[D('2026-01-12'), 500], [D('2026-05-20'), 800]]) {
  const r = usdRate(d);
  await transfers.create({
    occurred_on: d, description: 'Compra de dólares',
    from: { account_id: viajesCop, amount_minor: P(Math.round(usd * r / 10_000)) },
    to: { account_id: viajesUsd, amount_minor: P(usd), rate_scaled: r, rate_source: 'manual' },
  });
}
// Spending in dollars on a trip, each with the rate charged.
for (const [d, usd, note, category] of [
  [D('2026-06-03'), 84.5, 'Hotel noche 1', C.viajes], [D('2026-06-04'), 32.75, 'Cena en el puerto', C.restaurante],
  [D('2026-06-05'), 18.2, 'Metro y bus', C.transporte], [D('2026-06-06'), 129.99, 'Tiquete de tren', C.viajes],
]) {
  await tx.create({ account_id: viajesUsd, category_id: category, occurred_on: d, amount_minor: -P(usd), rate_scaled: usdRate(d), rate_source: 'manual', description: note, source: 'manual' });
}
// One saved with no rate: valued at the official rate of its day (rule 4).
await tx.create({
  account_id: viajesUsd, category_id: C.viajes, occurred_on: D('2026-06-07'), amount_minor: -P(45),
  rate_scaled: trmOf.get(D('2026-06-07')), rate_source: 'trm', confidence: 'low', description: 'Museo', source: 'manual',
});
await earn(viajesCop, C.depositos, D('2025-12-02'), 2_000_000, 'Prima para viajes');
await move(D('2026-05-15'), azul, viajesCop, 3_500_000, 'Plata para el viaje');
// Euros: a trip in April, topped up from the dollars.
const eurRate = d => Math.round(trmOf.get(d) * 1.09);
for (const [d, eur, note] of [[D('2026-04-08'), 62.4, 'Almuerzo en Lisboa'], [D('2026-04-09'), 145, 'Hostal'], [D('2026-04-10'), 27.8, 'Tranvía y museo']]) {
  await tx.create({ account_id: euros, category_id: C.viajes, occurred_on: d, amount_minor: -P(eur), rate_scaled: eurRate(d), rate_source: 'derived', description: note, source: 'manual' });
}
await transfers.create({
  occurred_on: D('2026-04-02'), description: 'Dólares a euros',
  from: { account_id: viajesUsd, amount_minor: P(300), rate_scaled: trmOf.get(D('2026-04-02')) },
  to: { account_id: euros, amount_minor: P(273.5), rate_scaled: eurRate(D('2026-04-02')) },
});

// ---- Products and yields ----

const START = D('2025-10-01');
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
await yields.setProductBalance({ product_id: verdeP, valid_from: D('2025-09-30'), amount_minor: P(35_000_000), note: 'Leído en la app del banco' });
await yields.setRate({ account_id: verde, product_id: verdeP, valid_from: START, annual_rate_scaled: pct(10.5) });
await yields.setRate({ account_id: verde, product_id: verdeP, valid_from: D('2026-05-01'), annual_rate_scaled: pct(9.75) });
const verdeMeta = await yields.addProduct({ account_id: verde, name: 'Bolsillo Viaje', source: 'manual', sort_order: 1 });
await yields.setProductBalance({ product_id: verdeMeta, valid_from: D('2025-09-30'), amount_minor: P(3_000_000), note: 'Leído en la app del banco' });
await yields.setRate({ account_id: verde, product_id: verdeMeta, valid_from: START, annual_rate_scaled: pct(8) });
await transfers.create({
  occurred_on: D('2026-02-14'), description: 'Al bolsillo de viaje',
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
  onDate: D('2026-07-31'), amountMinor: P(150_000), note: 'Pasar cashback al saldo',
});
await yields.adjust({ account_id: verde, on_date: D('2025-10-15'), amount_minor: P(50_000), kind: 'cashback', source: 'cashback', product_kind_id: bonoKind, product_id: verdeP, note: 'Bono por abrir la cuenta' });

// Cajita Naranja: a rate cut in June.
await yields.enrol({ account_id: naranja, opening_on: START, withholding: true });
const naranjaP = await productOf(naranja, 'Cajita');
await yields.setRate({ account_id: naranja, product_id: naranjaP, valid_from: START, annual_rate_scaled: pct(9) });
await yields.setRate({ account_id: naranja, product_id: naranjaP, valid_from: D('2026-06-01'), annual_rate_scaled: pct(8.25) });
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
// Ahorros follows the account: it holds whatever the CDTs and the tax pocket leave.
await yields.setRate({ account_id: indigoBank, product_id: indigoP, valid_from: START, annual_rate_scaled: pct(8.5) });
const cdt = await yields.addProduct({
  account_id: indigoBank, name: 'CDT 12 meses', kind: 'cdt', sort_order: 1, payout: 'monthly', payout_months: 1,
  opened_on: D('2026-03-02'), term_months: 12, matures_into_product_id: indigoP, income_category_id: interesesCdt,
});
await yields.setProductBalance({ product_id: cdt, valid_from: D('2026-03-01'), amount_minor: 0 });
await transfers.create({
  occurred_on: D('2026-03-02'), description: 'Abrir CDT',
  from: { account_id: indigoBank, product_id: indigoP, amount_minor: P(15_000_000) },
  to: { account_id: indigoBank, product_id: cdt, amount_minor: P(15_000_000) },
});
await yields.setCdtCapital(cdt, { opened_on: D('2026-03-02'), matures_on: D('2027-03-02'), capital_minor: P(15_000_000) });
await yields.setRate({ account_id: indigoBank, product_id: cdt, payout: 'monthly', valid_from: D('2026-03-02'), annual_rate_scaled: pct(11.2) });
// A short CDT that already matured: paid its term, handed everything to Ahorros and closed.
const cdtCorto = await yields.addProduct({
  account_id: indigoBank, name: 'CDT 90 días', kind: 'cdt', sort_order: 3,
  opened_on: D('2026-04-01'), term_months: 3, matures_into_product_id: indigoP, income_category_id: interesesCdt,
});
await yields.setProductBalance({ product_id: cdtCorto, valid_from: D('2026-03-31'), amount_minor: 0 });
await transfers.create({
  occurred_on: D('2026-04-01'), description: 'Abrir CDT corto',
  from: { account_id: indigoBank, product_id: indigoP, amount_minor: P(5_000_000) },
  to: { account_id: indigoBank, product_id: cdtCorto, amount_minor: P(5_000_000) },
});
await yields.setCdtCapital(cdtCorto, { opened_on: D('2026-04-01'), matures_on: D('2026-07-01'), capital_minor: P(5_000_000) });
await yields.setRate({ account_id: indigoBank, product_id: cdtCorto, valid_from: D('2026-04-01'), annual_rate_scaled: pct(10.4) });
const impuestos = await yields.addProduct({ account_id: indigoBank, name: 'Para el impuesto de renta', sort_order: 2 });
await yields.setProductBalance({ product_id: impuestos, valid_from: D('2026-06-30'), amount_minor: 0 });
await yields.setProductNetWorth(impuestos, false);
await yields.setRate({ account_id: indigoBank, product_id: impuestos, valid_from: D('2026-07-01'), annual_rate_scaled: pct(9) });
for (const month of [Mo('2026-07'), Mo('2026-08'), Mo('2026-09')]) {
  await transfers.create({
    occurred_on: on(month, 28), description: 'Apartar para la renta',
    from: { account_id: indigoBank, product_id: indigoP, amount_minor: P(800_000) },
    to: { account_id: indigoBank, product_id: impuestos, amount_minor: P(800_000) },
  });
}
await move(D('2026-02-27'), azul, indigoBank, 2_000_000, 'Ahorro a Índigo', { to: { product_id: indigoP } });

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
await tx.create({ account_id: fondo, category_id: ajusteGanancias, occurred_on: D('2026-07-27'), amount_minor: -P(310_000), description: 'Ajuste de rendimientos del fondo', source: 'manual' });

await onProgress(0.5);
const engine = new AccrualEngine(db, yields, tax);
await engine.accrueAll(UP_TO);
await accrueAndSettle(db, yields, tax, indigoBank, UP_TO);

// Days checked against the bank, mostly exact, a few off by centavos.
const checked = await db.query(
  `SELECT product_id, on_date, net_minor FROM yield_days
   WHERE account_id IN (?, ?) AND on_date BETWEEN ? AND ? ORDER BY on_date`, [verde, naranja, D('2026-09-10'), UP_TO]);
for (const row of checked) {
  await yields.correctDay(row.product_id, row.on_date, row.net_minor + (next(0, 7) === 0 ? next(-60, 60) : 0));
}
// Lila's bonus for August: paid by the bank on the 3rd, not the 1st; July's corrected to what it paid.
await yields.movePayment(lila, lilaP, 'Mensual por gasto', D('2026-09-01'), D('2026-09-01'), D('2026-09-03')).catch(() => {});
const july = await db.queryOne(
  `SELECT SUM(net_minor) AS total FROM yield_days WHERE product_id = ? AND component = 'Mensual por gasto' AND paid_on = ?`, [lilaP, D('2026-08-01')]).catch(() => null);
if (july?.total) await yields.correctPayment(lilaP, 'Mensual por gasto', D('2026-08-01'), july.total + 1_250).catch(() => {});
await engine.accrueAll(UP_TO);

await onProgress(0.75);

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
  system: 'fixed_installment', installments: 60, periodMonths: 1, disbursedOn: D('2025-11-10'), firstDueOn: D('2025-12-10'),
  insuranceKind: 'fixed', insuranceMinor: P(38_000), insuranceRateScaled: 0, bankInstallmentMinor: null,
  paidFromAccountId: azul, paidBefore: 0, balanceAfterBeforeMinor: null, disbursedIntoAccountId: azul,
});
await spend(azul, C.auto, D('2025-11-12'), 47_500_000, 'Compra del carro');
const carDue = [Mo('2025-12'), Mo('2026-01'), Mo('2026-02'), Mo('2026-03'), Mo('2026-04'), Mo('2026-05'), Mo('2026-06'), Mo('2026-07'), Mo('2026-08'), Mo('2026-09')];
for (const [i, month] of carDue.entries()) {
  await pay(carro, azul, i + 1, `${month}-10`);
  if (month === Mo('2026-06')) {
    await loans.recordPayment({
      loanAccountId: carro, fromAccountId: azul, kind: 'extra', number: null, paidOn: D('2026-06-20'),
      capitalMinor: P(3_000_000), interestMinor: 0, insuranceMinor: 0, lateMinor: 0, extraMode: 'term',
      note: 'Abono con la prima', interestCategory: 'Intereses', insuranceCategory: 'Seguros', uvrCategory: 'Ajuste UVR',
    });
  }
}

// A loan from before the app: 18 of 36 paid then; September's still unpaid.
const libre = await loans.create({
  name: 'Libre inversión', builtinIcon: 'cash-outline', color: '#ef5b66',
  principalMinor: P(20_000_000), annualRateScaled: eaFromMonthly(Math.round(0.0145 * LOAN_EA)), rateQuoted: 'mv', rateKind: 'fixed',
  system: 'fixed_installment', installments: 36, periodMonths: 1, disbursedOn: D('2024-09-05'), firstDueOn: D('2024-10-05'),
  insuranceKind: 'balance', insuranceMinor: 0, insuranceRateScaled: 1_200, bankInstallmentMinor: null,
  paidFromAccountId: azul, paidBefore: 18, balanceAfterBeforeMinor: null, disbursedIntoAccountId: null,
});
for (const [n, d, late] of [[19, D('2026-04-05'), 0], [20, D('2026-05-05'), 0], [21, D('2026-06-05'), 0], [22, D('2026-07-09'), P(14_300)], [23, D('2026-08-05'), 0]]) {
  await pay(libre, azul, n, d, { lateMinor: late, note: late ? 'Cuota con mora' : undefined });
}

// A UVR mortgage, cyclic decreasing, disbursed in September.
await loans.create({
  name: 'Hipoteca', builtinIcon: 'home-outline', color: '#d77bff',
  principalMinor: P(60_000_000), annualRateScaled: Math.round(0.075 * LOAN_EA), rateQuoted: 'ea', rateKind: 'fixed',
  system: 'fixed_installment', installments: 180, periodMonths: 1, disbursedOn: D('2026-09-16'), firstDueOn: D('2026-10-15'),
  insuranceKind: 'balance', insuranceMinor: 0, insuranceRateScaled: 400, bankInstallmentMinor: null,
  paidFromAccountId: azul, paidBefore: 0, balanceAfterBeforeMinor: null, disbursedIntoAccountId: null,
  unit: 'UVR', decreaseScaled: Math.round(0.04 * LOAN_EA),
});

await onProgress(0.85);

// ---- Presupuestos: caps and goals ----

const caps = new LimitsRepository(db, NOW);
await caps.create({ amountMinor: P(300_000), accountId: null, warnAt80: true, categoryIds: [C.restaurante] });
await caps.create({ amountMinor: P(900_000), accountId: null, warnAt80: true, categoryIds: [C.mercado] });
await caps.create({ amountMinor: P(350_000), accountId: null, warnAt80: true, categoryIds: [C.transporte, C.auto] });
await caps.create({ amountMinor: P(150_000), accountId: coral, warnAt80: false, categoryIds: [C.entretenimiento, suscripciones] });
await caps.create({ amountMinor: P(200_000), accountId: null, warnAt80: true, categoryIds: [mascotas] });

const goals = new GoalsRepository(db, NOW);
await goals.create({
  name: 'Viaje a Japón', icon: 'airplane-outline', color: '#4cb8f5', amountMinor: P(22_000_000), dueMonth: Mo('2028-06'),
  kind: 'custom', months: null, allAccounts: false,
  places: [{ accountId: naranja, productId: null, counts: 'all' }, { accountId: viajesUsd, productId: null, counts: 'all' }],
}, TODAY);
await goals.create({
  name: 'Remodelar la cocina', icon: 'home-outline', color: '#ff9152', amountMinor: P(4_000_000), dueMonth: Mo('2026-12'),
  kind: 'custom', months: null, allAccounts: false,
  places: [{ accountId: alcancia, productId: null, counts: 'from_start' }],
}, D('2026-06-30'));
await goals.create({
  name: 'Cuota inicial apartamento', icon: 'business-outline', color: '#6378ff', amountMinor: P(80_000_000), dueMonth: null,
  kind: 'custom', months: null, allAccounts: false,
  places: [{ accountId: fondo, productId: null, counts: 'from_start' }, { accountId: verde, productId: verdeMeta, counts: 'all' }],
}, D('2026-01-01'));
await goals.create({
  name: 'Fondo de emergencia', icon: 'shield-checkmark-outline', color: '#34c98b', amountMinor: P(60_000_000), dueMonth: null,
  kind: 'emergency', months: 6, allAccounts: true, places: [],
}, TODAY);
const bici = await goals.create({
  name: 'Bicicleta', icon: 'bicycle-outline', color: '#a3d955', amountMinor: P(400_000), dueMonth: Mo('2026-05'),
  kind: 'custom', months: null, allAccounts: false, places: [{ accountId: efectivo, productId: null, counts: 'all' }],
}, D('2026-01-01'));
await goals.setReached(bici, D('2026-04-30'));
await goals.setArchived(bici, true);

// ---- Movimientos por revisar ----

const proposals = new ProposalsRepository(db, NOW);
await proposals.learnFromLedger();
const file = 'extracto-tarjeta-coral-sep-2026.pdf';
const rows = [
  [D('2026-09-26'), -84_300, 'MERCADO SEMANAL SUPERMERCADO CENTRAL'],
  [D('2026-09-27'), -45_900, 'RESTAURANTE LA ESQUINA'],
  [D('2026-09-28'), -23_500, 'FARMACIA DEL BARRIO'],
  [D('2026-09-29'), -16_900, 'SUSCRIPCION DE MUSICA'],
  [D('2026-09-29'), -16_900, 'SUSCRIPCION DE MUSICA'],
  [D('2026-09-30'), -320_000, 'TIENDA DE DEPORTES XYZ'],
  [Dc(D('2026-10-01')), -245_000, 'CENA DE ANIVERSARIO'],
  [Dc(D('2026-10-01')), 9_800, 'DEVOLUCION PARQUEADERO'],
];
await proposals.propose(`${file} ${NOW()}`, rows.map(([d, pesos, description], line) => ({
  source: 'statement', account_id: coral, occurred_on: d, amount_minor: P(pesos), description,
  evidence: { file, line: line + 12, page: 1, confidence: 'certain', balance_minor: null },
})));
await proposals.propose(`aviso ${NOW()}`, [
  { source: 'notification', account_id: azul, occurred_on: Dc(D('2026-10-02')), amount_minor: -P(62_000), description: 'Compra aprobada en DROGUERIA SALUD por $62.000',
    evidence: { package: 'com.ejemplo.bancoazul', title: 'Banco Azul', text: 'Compra aprobada en DROGUERIA SALUD por $62.000', posted_at: `${TODAY}T08:14:00Z` } },
  { source: 'notification', account_id: azul, occurred_on: Dc(D('2026-10-02')), amount_minor: null, description: null,
    evidence: { package: 'com.ejemplo.bancoazul', title: 'Banco Azul', text: 'Tienes un nuevo movimiento. Ingresa a la app para verlo.', posted_at: `${TODAY}T08:40:00Z` } },
  // Both halves of one transfer, seen from each bank: the review offers to join them.
  { source: 'notification', account_id: azul, occurred_on: Dc(D('2026-10-02')), amount_minor: -P(500_000), description: 'Transferencia enviada a Ahorro Verde por $500.000',
    evidence: { package: 'com.ejemplo.bancoazul', title: 'Banco Azul', text: 'Transferencia enviada a Ahorro Verde por $500.000', posted_at: `${TODAY}T09:02:00Z` } },
  { source: 'notification', account_id: verde, occurred_on: Dc(D('2026-10-02')), amount_minor: P(500_000), description: 'Recibiste $500.000 desde Banco Azul',
    evidence: { package: 'com.ejemplo.ahorroverde', title: 'Ahorro Verde', text: 'Recibiste $500.000 desde Banco Azul', posted_at: `${TODAY}T09:03:00Z` } },
]);

// ---- Simulador de renta ----

const year = ty;
const inputs = defaultInputs(year, new Date(`${TODAY}T12:00:00Z`));
const yearYields = await db.queryOne(`SELECT SUM(net_minor) AS net FROM yield_days WHERE on_date LIKE ? AND account_id IN (?, ?, ?, ?)`, [`${year}-%`, verde, naranja, lila, indigoBank]);
await new TaxSimulationsRepository(db, NOW).save(year, {
  ...inputs,
  employment: 'ordinary', dependents: 1, monthlySalaryMinor: P(9_500_000), monthsWorked: 12,
  feeIncomeMinor: P(4_800_000), feeCostsMinor: P(600_000),
  capitalIncomeMinor: yearYields?.net ?? P(4_000_000), financialYieldMinor: yearYields?.net ?? P(4_000_000),
  voluntaryOwnMinor: P(3_000_000), healthPolicyMinor: P(2_400_000), eInvoicePurchasesMinor: P(18_000_000),
  monthlyWithholdingMinor: Array.from({ length: 12 }, () => P(410_000)),
});
await onProgress(1);
}
