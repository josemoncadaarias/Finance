/**
 * What a person holds, worked out from what they bought and sold.
 *
 * Pure, and the one place this arithmetic lives: the screen, the charts and
 * the tests all read `bookOf`. Money is whole cents throughout (rule 2); a
 * quantity is whole hundred-millionths of a unit, so 0.237384 of a share is
 * an integer too.
 *
 * A purchase opens a lot. A sale closes the lot the broker says it closes
 * (the same position number), or else the oldest ones first. What a lot cost
 * leaves with it, so what is left is always what the remaining units cost.
 */

import type { IsoDate } from '../database/types';
import { PRICE_SCALE, QUANTITY_SCALE, type AssetKind, type TradeKind } from './read-broker';

export interface Trade {
  id: number;
  accountId: number | null;
  kind: TradeKind;
  symbol: string | null;
  day: IsoDate;
  time: string | null;
  quantityE8: number | null;
  priceE6: number | null;
  /** Signed: what it did to the cash at the broker. */
  amountMinor: number;
  currency: string;
  ratio: [number, number] | null;
  ref: string | null;
  asset: AssetKind | null;
  source: 'manual' | 'statement';
  note: string | null;
}

export interface Lot {
  ref: string | null;
  day: IsoDate;
  quantityE8: number;
  costMinor: number;
}

export interface Position {
  symbol: string;
  currency: string;
  asset: AssetKind | null;
  /** Units held today. Zero once everything was sold. */
  quantityE8: number;
  /** What the units still held cost. */
  costMinor: number;
  /** Cost over units: the average price paid for what is held. */
  averageE6: number | null;
  lots: Lot[];
  /** What selling left, against what the units sold had cost. */
  realizedMinor: number;
  /** Dividends as they arrived, and what was withheld from them (negative). */
  dividendsMinor: number;
  taxMinor: number;
  boughtMinor: number;
  soldMinor: number;
  firstDay: IsoDate;
  lastDay: IsoDate;
  /** The price of its latest purchase or sale: a reference when no quote is known. */
  lastTradeE6: number | null;
  lastTradeDay: IsoDate | null;
  /** More was sold than the history shows bought: the history is not whole. */
  incomplete: boolean;
  trades: number;
}

export interface Book {
  positions: Position[];
  /** Money at the broker not invested, per currency - only where deposits are on record. */
  cash: Map<string, number>;
  depositedMinor: Map<string, number>;
  feesMinor: Map<string, number>;
}

/** A sliver of a unit left by a broker's rounding is nothing held. */
const DUST_E8 = 200;

function order(a: Trade, b: Trade): number {
  return a.day.localeCompare(b.day) || (a.time ?? '').localeCompare(b.time ?? '') || (a.id - b.id);
}

function sum(map: Map<string, number>, key: string, minor: number): void {
  map.set(key, (map.get(key) ?? 0) + minor);
}

export function bookOf(trades: readonly Trade[]): Book {
  const sorted = [...trades].sort(order);
  const positions = new Map<string, Position>();
  const cash = new Map<string, number>();
  const deposited = new Map<string, number>();
  const fees = new Map<string, number>();
  const withDeposits = new Set<string>();

  const positionOf = (trade: Trade): Position => {
    const symbol = trade.symbol as string;
    let position = positions.get(symbol);
    if (!position) {
      position = {
        symbol, currency: trade.currency, asset: trade.asset, quantityE8: 0, costMinor: 0, averageE6: null, lots: [],
        realizedMinor: 0, dividendsMinor: 0, taxMinor: 0, boughtMinor: 0, soldMinor: 0, firstDay: trade.day,
        lastDay: trade.day, lastTradeE6: null, lastTradeDay: null, incomplete: false, trades: 0,
      };
      positions.set(symbol, position);
    }
    position.asset ??= trade.asset;
    position.lastDay = trade.day;
    position.trades += 1;
    return position;
  };

  for (const trade of sorted) {
    if (trade.kind !== 'split') sum(cash, trade.currency, trade.amountMinor);
    if (trade.kind === 'deposit' || trade.kind === 'withdrawal') {
      withDeposits.add(trade.currency);
      sum(deposited, trade.currency, trade.amountMinor);
      continue;
    }
    if (trade.kind === 'fee') sum(fees, trade.currency, trade.amountMinor);
    if (trade.symbol === null) continue;
    const position = positionOf(trade);

    if (trade.kind === 'buy' && trade.quantityE8 !== null) {
      const cost = Math.abs(trade.amountMinor);
      position.lots.push({ ref: trade.ref, day: trade.day, quantityE8: trade.quantityE8, costMinor: cost });
      position.boughtMinor += cost;
      position.lastTradeE6 = trade.priceE6;
      position.lastTradeDay = trade.day;
    } else if (trade.kind === 'sell' && trade.quantityE8 !== null) {
      let left = trade.quantityE8;
      let cost = 0;
      const named = trade.ref === null ? -1 : position.lots.findIndex(lot => lot.ref === trade.ref);
      const queue = named >= 0
        ? [position.lots[named], ...position.lots.filter((_, at) => at !== named)]
        : [...position.lots];
      for (const lot of queue) {
        if (left <= DUST_E8) break;
        const taken = Math.min(left, lot.quantityE8);
        const whole = lot.quantityE8 - taken <= DUST_E8;
        const part = whole ? lot.costMinor : Math.round(lot.costMinor * (taken / lot.quantityE8));
        cost += part;
        lot.costMinor -= part;
        lot.quantityE8 = whole ? 0 : lot.quantityE8 - taken;
        left -= taken;
      }
      position.lots = position.lots.filter(lot => lot.quantityE8 > 0);
      if (left > DUST_E8 && left > trade.quantityE8 * 0.0001) position.incomplete = true;
      position.soldMinor += Math.abs(trade.amountMinor);
      position.realizedMinor += Math.abs(trade.amountMinor) - cost;
      position.lastTradeE6 = trade.priceE6;
      position.lastTradeDay = trade.day;
    } else if (trade.kind === 'split' && trade.ratio) {
      const [num, den] = trade.ratio;
      for (const lot of position.lots) lot.quantityE8 = Math.round(lot.quantityE8 * num / den);
      if (position.lastTradeE6 !== null) position.lastTradeE6 = Math.round(position.lastTradeE6 * den / num);
    } else if (trade.kind === 'dividend') {
      position.dividendsMinor += trade.amountMinor;
    } else if (trade.kind === 'tax') {
      position.taxMinor += trade.amountMinor;
    }
  }

  for (const position of positions.values()) {
    position.quantityE8 = position.lots.reduce((total, lot) => total + lot.quantityE8, 0);
    position.costMinor = position.lots.reduce((total, lot) => total + lot.costMinor, 0);
    position.averageE6 = position.quantityE8 > 0
      ? Math.round((position.costMinor / 100) / (position.quantityE8 / QUANTITY_SCALE) * PRICE_SCALE)
      : null;
  }

  // Cash is only known where what was put in is on record: without the
  // deposits, the purchases alone would read as a debt to the broker.
  for (const currency of [...cash.keys()]) if (!withDeposits.has(currency)) cash.delete(currency);

  return {
    positions: [...positions.values()],
    cash,
    depositedMinor: deposited,
    feesMinor: fees,
  };
}

// ---- What it is worth ---------------------------------------------------------

export interface Quote {
  /** In the position's own currency. */
  priceE6: number;
  /** Yesterday's close, when the source gives it. */
  previousE6: number | null;
  day: IsoDate;
  source: 'sheet' | 'manual' | 'demo' | 'statement';
}

export interface Valued {
  position: Position;
  quote: Quote | null;
  /** At the quote; at what it cost when there is none. */
  valueMinor: number;
  /** Against what it cost. Null with no quote: nothing to compare. */
  gainMinor: number | null;
  gainPct: number | null;
  /** Since yesterday's close. */
  dayMinor: number | null;
  dayPct: number | null;
}

export function worthOf(quantityE8: number, priceE6: number): number {
  return Math.round((quantityE8 / QUANTITY_SCALE) * (priceE6 / PRICE_SCALE) * 100);
}

export function valueOf(position: Position, quote: Quote | null): Valued {
  if (quote === null || position.quantityE8 === 0) {
    return { position, quote: position.quantityE8 === 0 ? null : quote, valueMinor: position.costMinor, gainMinor: null, gainPct: null, dayMinor: null, dayPct: null };
  }
  const valueMinor = worthOf(position.quantityE8, quote.priceE6);
  const gainMinor = valueMinor - position.costMinor;
  const before = quote.previousE6 === null ? null : worthOf(position.quantityE8, quote.previousE6);
  return {
    position,
    quote,
    valueMinor,
    gainMinor,
    gainPct: position.costMinor > 0 ? gainMinor / position.costMinor * 100 : null,
    dayMinor: before === null ? null : valueMinor - before,
    dayPct: before === null || before === 0 ? null : (valueMinor - before) / before * 100,
  };
}

export interface Totals {
  currency: string;
  /** What is held, at its quotes (at cost where there is none). */
  valueMinor: number;
  costMinor: number;
  /** Value less cost, over the positions that have a quote. */
  gainMinor: number | null;
  gainPct: number | null;
  dayMinor: number | null;
  /** Positions held that have no quote, and so are counted at what they cost. */
  unquoted: number;
  held: number;
  realizedMinor: number;
  /** Dividends less what was withheld from them. */
  dividendsMinor: number;
  feesMinor: number;
  cashMinor: number | null;
  depositedMinor: number | null;
}

/** One total per currency: a dollar and a euro are never added as they are. */
export function totalsOf(book: Book, valued: readonly Valued[]): Totals[] {
  const byCurrency = new Map<string, Totals>();
  const totalOf = (currency: string): Totals => {
    let total = byCurrency.get(currency);
    if (!total) {
      total = {
        currency, valueMinor: 0, costMinor: 0, gainMinor: null, gainPct: null, dayMinor: null, unquoted: 0, held: 0,
        realizedMinor: 0, dividendsMinor: 0, feesMinor: book.feesMinor.get(currency) ?? 0,
        cashMinor: book.cash.get(currency) ?? null, depositedMinor: book.depositedMinor.get(currency) ?? null,
      };
      byCurrency.set(currency, total);
    }
    return total;
  };
  let quotedCost = new Map<string, number>();
  for (const one of valued) {
    const total = totalOf(one.position.currency);
    total.realizedMinor += one.position.realizedMinor;
    total.dividendsMinor += one.position.dividendsMinor + one.position.taxMinor;
    if (one.position.quantityE8 === 0) continue;
    total.held += 1;
    total.valueMinor += one.valueMinor;
    total.costMinor += one.position.costMinor;
    if (one.gainMinor === null) { total.unquoted += 1; continue; }
    total.gainMinor = (total.gainMinor ?? 0) + one.gainMinor;
    quotedCost = quotedCost.set(total.currency, (quotedCost.get(total.currency) ?? 0) + one.position.costMinor);
    if (one.dayMinor !== null) total.dayMinor = (total.dayMinor ?? 0) + one.dayMinor;
  }
  for (const currency of book.cash.keys()) totalOf(currency);
  for (const total of byCurrency.values()) {
    const cost = quotedCost.get(total.currency) ?? 0;
    total.gainPct = total.gainMinor !== null && cost > 0 ? total.gainMinor / cost * 100 : null;
  }
  return [...byCurrency.values()].sort((a, b) => b.valueMinor - a.valueMinor);
}

// ---- Over time ------------------------------------------------------------------

export interface MonthPoint {
  /** "2026-04". */
  month: string;
  /** What was put into purchases that month, and what sales gave back. */
  boughtMinor: number;
  soldMinor: number;
  /** Dividends less withholding that month. */
  dividendsMinor: number;
  /** What everything held had cost, at the month's close. */
  investedMinor: number;
}

/** Every month from the first trade to `until`, in one currency. */
export function monthsOf(trades: readonly Trade[], currency: string, until: IsoDate): MonthPoint[] {
  const mine = trades.filter(trade => trade.currency === currency).sort(order);
  if (mine.length === 0) return [];
  const points: MonthPoint[] = [];
  let month = mine[0].day.slice(0, 7);
  const last = until.slice(0, 7) > mine[mine.length - 1].day.slice(0, 7) ? until.slice(0, 7) : mine[mine.length - 1].day.slice(0, 7);
  let at = 0;
  for (;;) {
    const point: MonthPoint = { month, boughtMinor: 0, soldMinor: 0, dividendsMinor: 0, investedMinor: 0 };
    while (at < mine.length && mine[at].day.slice(0, 7) === month) {
      const trade = mine[at];
      if (trade.kind === 'buy') point.boughtMinor += Math.abs(trade.amountMinor);
      else if (trade.kind === 'sell') point.soldMinor += Math.abs(trade.amountMinor);
      else if (trade.kind === 'dividend' || trade.kind === 'tax') point.dividendsMinor += trade.amountMinor;
      at += 1;
    }
    point.investedMinor = bookOf(mine.slice(0, at)).positions.reduce((total, position) => total + position.costMinor, 0);
    points.push(point);
    if (month >= last) break;
    const [year, number] = month.split('-').map(Number);
    month = number === 12 ? `${year + 1}-01` : `${year}-${String(number + 1).padStart(2, '0')}`;
  }
  return points;
}

export interface Slice {
  symbol: string;
  valueMinor: number;
  /** Of everything held in that currency, 0 to 100. */
  share: number;
}

/** How what is held is spread, the largest first. */
export function spreadOf(valued: readonly Valued[], currency: string): Slice[] {
  const held = valued.filter(one => one.position.currency === currency && one.position.quantityE8 > 0);
  const total = held.reduce((all, one) => all + one.valueMinor, 0);
  return held
    .map(one => ({ symbol: one.position.symbol, valueMinor: one.valueMinor, share: total > 0 ? one.valueMinor / total * 100 : 0 }))
    .sort((a, b) => b.valueMinor - a.valueMinor);
}

/** A quantity as a person reads it: "3", "0,2374", never "0,23738400". */
export function formatQuantity(quantityE8: number, locale = 'es-CO'): string {
  const value = quantityE8 / QUANTITY_SCALE;
  const places = value >= 100 ? 2 : value >= 1 ? 4 : 6;
  return new Intl.NumberFormat(locale, { maximumFractionDigits: places }).format(value);
}

export interface DayWorth {
  day: IsoDate;
  /** What was held that day, at the prices known up to it. */
  valueMinor: number;
  /** What it had cost. */
  costMinor: number;
}

/**
 * What the holdings were worth on each day a price was kept, against what
 * they had cost. The app has no price history but its own, so this begins
 * the first day it looked; a ticker with no price yet counts at its cost.
 */
export function worthByDay(
  trades: readonly Trade[], prices: readonly { symbol: string; day: IsoDate; price_e6: number }[], currency: string,
  limit = 90,
): DayWorth[] {
  const mine = trades.filter(trade => trade.currency === currency).sort(order);
  const days = [...new Set(prices.map(price => price.day))].sort();
  const shown = days.length <= limit ? days : days.filter((_, at) => at % Math.ceil(days.length / limit) === 0 || at === days.length - 1);
  const latest = new Map<string, number>();
  let priceAt = 0;
  const sortedPrices = [...prices].sort((a, b) => a.day.localeCompare(b.day));
  const out: DayWorth[] = [];
  for (const day of shown) {
    while (priceAt < sortedPrices.length && sortedPrices[priceAt].day <= day) {
      latest.set(sortedPrices[priceAt].symbol, sortedPrices[priceAt].price_e6);
      priceAt += 1;
    }
    const book = bookOf(mine.filter(trade => trade.day <= day));
    let valueMinor = 0;
    let costMinor = 0;
    for (const position of book.positions) {
      if (position.quantityE8 === 0) continue;
      const price = latest.get(position.symbol);
      valueMinor += price === undefined ? position.costMinor : worthOf(position.quantityE8, price);
      costMinor += position.costMinor;
    }
    if (costMinor > 0) out.push({ day, valueMinor, costMinor });
  }
  return out;
}

/**
 * Purchases bought and sold again the same day: the ids of both halves.
 *
 * A broker's history is full of them - an order filled, cancelled and filled
 * again within minutes - and they read as sales nobody decided (Jose,
 * 2026-11-12). They stay in the arithmetic, where their few cents are part
 * of what the broker itself reports as realised; the screens only keep them
 * apart from the sales that closed a position held for days.
 */
export function sameDayPairs(trades: readonly Trade[]): Set<number> {
  const out = new Set<number>();
  const buys = trades.filter(trade => trade.kind === 'buy' && trade.symbol !== null);
  const used = new Set<number>();
  for (const sale of trades) {
    if (sale.kind !== 'sell' || sale.symbol === null || sale.quantityE8 === null) continue;
    const match = buys.find(buy => !used.has(buy.id) && buy.symbol === sale.symbol && buy.day === sale.day
      && (sale.ref !== null && buy.ref === sale.ref))
      ?? buys.find(buy => !used.has(buy.id) && buy.symbol === sale.symbol && buy.day === sale.day
        && buy.quantityE8 !== null && Math.abs(buy.quantityE8 - (sale.quantityE8 as number)) <= 200
        && (buy.time ?? '') <= (sale.time ?? '~'));
    if (!match) continue;
    used.add(match.id);
    out.add(match.id);
    out.add(sale.id);
  }
  return out;
}
