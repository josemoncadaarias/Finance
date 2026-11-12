/**
 * How the investments have gone over time: the gain or loss, day by day,
 * apart from what was put in (Jose, 2026-11-12: "solamente los rendimientos,
 * no lo comprado").
 *
 * The gain on a day is what was held that day at that day's price, less what
 * it had cost, plus what selling had already left. Buying more moves the
 * value and the cost by the same amount, so a purchase never shows as a
 * gain: only prices move this line.
 *
 * The app has no price history of the market. What it knows of a ticker's
 * price is what the person's own history says - the price of each purchase
 * and sale - plus every price it kept since it began asking, and today's.
 * Between two known prices the line is drawn straight, and the answer says
 * so (`estimated`): it is never passed off as the market's own curve.
 *
 * Pure, and worked in today's units: a purchase made before a split is
 * counted as the units and the price it became.
 */

import type { IsoDate } from '../database/types';
import { bookOf, worthOf, type Quote, type Trade } from './positions';

export type Range = '1D' | '5D' | '1M' | '6M' | 'YTD' | '1Y' | '5Y' | 'MAX';
export const RANGES: readonly Range[] = ['1D', '5D', '1M', '6M', 'YTD', '1Y', '5Y', 'MAX'];

export interface ReturnPoint {
  day: IsoDate;
  /** Gain or loss since the period began. */
  gainMinor: number;
  /** What was held that day, at that day's price, and what it had cost. */
  valueMinor: number;
  costMinor: number;
}

export interface Returns {
  points: ReturnPoint[];
  from: IsoDate;
  to: IsoDate;
  /** The gain or loss over the period: the last point. */
  changeMinor: number;
  /** Over what was invested at the start plus what was bought since. Null with nothing to divide by. */
  pct: number | null;
  /** Dividends less withholding received in the period: on top of the line, never inside it. */
  dividendsMinor: number;
  /** Some day's price was drawn between two known ones rather than known. */
  estimated: boolean;
  /** Something held has no price newer than a few days: its line stays flat to today. */
  flat: boolean;
}

const DAY = 86_400_000;
const timeOf = (day: string): number => Date.parse(`${day}T00:00:00Z`);
const dayOf = (time: number): IsoDate => new Date(time).toISOString().slice(0, 10) as IsoDate;

/** The first day of a range that ends today. */
export function rangeStart(range: Range, today: IsoDate): IsoDate | null {
  const [year, month, day] = today.split('-').map(Number);
  const back = (months: number): IsoDate => {
    const total = year * 12 + (month - 1) - months;
    const y = Math.floor(total / 12);
    const m = total % 12 + 1;
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return `${y}-${String(m).padStart(2, '0')}-${String(Math.min(day, last)).padStart(2, '0')}` as IsoDate;
  };
  switch (range) {
    case '1D': return dayOf(timeOf(today) - DAY);
    // Five days the market opens are a calendar week.
    case '5D': return dayOf(timeOf(today) - 7 * DAY);
    case '1M': return back(1);
    case '6M': return back(6);
    case 'YTD': return `${year}-01-01` as IsoDate;
    case '1Y': return back(12);
    case '5Y': return back(60);
    case 'MAX': return null;
  }
}

function order(a: Trade, b: Trade): number {
  return a.day.localeCompare(b.day) || (a.time ?? '').localeCompare(b.time ?? '') || (a.id - b.id);
}

interface Known { day: IsoDate; priceE6: number; }

export function returnsOf(
  trades: readonly Trade[],
  prices: readonly { symbol: string; day: IsoDate; price_e6: number }[],
  quotes: ReadonlyMap<string, Quote>,
  options: { currency: string; symbol?: string | null; range: Range; today: IsoDate; samples?: number },
): Returns | null {
  const { currency, range, today } = options;
  const symbol = options.symbol ?? null;
  const sorted = trades
    .filter(trade => trade.currency === currency && trade.symbol !== null && (symbol === null || trade.symbol === symbol))
    .sort(order);
  if (!sorted.some(trade => trade.kind === 'buy')) return null;

  // Everything in today's units: each split after a trade multiplies its
  // units and divides its price.
  const splits = new Map<string, { at: number; day: IsoDate; factor: number }[]>();
  sorted.forEach((trade, at) => {
    if (trade.kind !== 'split' || !trade.ratio) return;
    const list = splits.get(trade.symbol as string) ?? [];
    list.push({ at, day: trade.day, factor: trade.ratio[0] / trade.ratio[1] });
    splits.set(trade.symbol as string, list);
  });
  const factorAfter = (name: string, test: (split: { at: number; day: IsoDate }) => boolean): number =>
    (splits.get(name) ?? []).filter(test).reduce((all, split) => all * split.factor, 1);

  const known = new Map<string, Known[]>();
  const note = (name: string, day: IsoDate, priceE6: number): void => {
    if (!(priceE6 > 0)) return;
    const list = known.get(name) ?? [];
    list.push({ day, priceE6 });
    known.set(name, list);
  };

  const adjusted: Trade[] = [];
  sorted.forEach((trade, at) => {
    if (trade.kind === 'split') return;
    const name = trade.symbol as string;
    if ((trade.kind !== 'buy' && trade.kind !== 'sell') || trade.quantityE8 === null) { adjusted.push(trade); return; }
    const factor = factorAfter(name, split => split.at > at);
    const priceE6 = trade.priceE6 === null ? null : Math.round(trade.priceE6 / factor);
    adjusted.push({ ...trade, quantityE8: Math.round(trade.quantityE8 * factor), priceE6 });
    if (priceE6 !== null) note(name, trade.day, priceE6);
  });
  const names = new Set(adjusted.map(trade => trade.symbol as string));
  for (const price of prices) {
    if (!names.has(price.symbol)) continue;
    note(price.symbol, price.day, Math.round(price.price_e6 / factorAfter(price.symbol, split => split.day > price.day)));
  }
  for (const name of names) {
    const quote = quotes.get(name);
    if (!quote) continue;
    if (quote.previousE6 !== null) note(name, dayOf(timeOf(quote.day) - DAY), quote.previousE6);
    note(name, quote.day, quote.priceE6);
  }
  // The last one noted for a day wins: a price kept over the price of a trade.
  for (const [name, list] of known) {
    const byDay = new Map<string, Known>();
    for (const one of list) byDay.set(one.day, one);
    known.set(name, [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day)));
  }

  const priceOn = (name: string, day: IsoDate): { priceE6: number; exact: boolean } | null => {
    const list = known.get(name);
    if (!list || list.length === 0) return null;
    let low = 0;
    let high = list.length - 1;
    if (day <= list[0].day) return { priceE6: list[0].priceE6, exact: day === list[0].day };
    if (day >= list[high].day) return { priceE6: list[high].priceE6, exact: day === list[high].day };
    while (high - low > 1) {
      const middle = (low + high) >> 1;
      if (list[middle].day <= day) low = middle; else high = middle;
    }
    if (list[low].day === day) return { priceE6: list[low].priceE6, exact: true };
    const span = timeOf(list[high].day) - timeOf(list[low].day);
    const part = (timeOf(day) - timeOf(list[low].day)) / span;
    return { priceE6: Math.round(list[low].priceE6 + (list[high].priceE6 - list[low].priceE6) * part), exact: false };
  };

  const first = adjusted.find(trade => trade.kind === 'buy')!.day;
  const asked = rangeStart(range, today);
  const from = asked === null || asked < first ? first : asked;
  if (from > today) return null;

  let estimated = false;
  let upTo = 0;
  const stateOn = (day: IsoDate, mark: boolean): { gain: number; value: number; cost: number } => {
    while (upTo < adjusted.length && adjusted[upTo].day <= day) upTo += 1;
    const book = bookOf(adjusted.slice(0, upTo));
    let gain = 0;
    let value = 0;
    let cost = 0;
    for (const position of book.positions) {
      gain += position.realizedMinor;
      if (position.quantityE8 === 0) continue;
      const price = priceOn(position.symbol, day);
      const worth = price === null ? position.costMinor : worthOf(position.quantityE8, price.priceE6);
      if (mark && (price === null || !price.exact)) estimated = true;
      gain += worth - position.costMinor;
      value += worth;
      cost += position.costMinor;
    }
    return { gain, value, cost };
  };

  // Where the period begins: the close of its first day ("a day" is today
  // against yesterday's close) - or nothing yet, when the period reaches
  // back to the first purchase.
  const whole = from === first;
  const base = whole ? { gain: 0, value: 0, cost: 0 } : stateOn(from, false);

  const span = Math.round((timeOf(today) - timeOf(from)) / DAY);
  const samples = options.samples ?? 120;
  const days: IsoDate[] = [];
  if (span <= samples) {
    for (let at = 0; at <= span; at += 1) days.push(dayOf(timeOf(from) + at * DAY));
  } else {
    for (let at = 0; at <= samples; at += 1) days.push(dayOf(timeOf(from) + Math.round(span * at / samples) * DAY));
  }

  const points: ReturnPoint[] = [];
  for (const day of [...new Set(days)]) {
    if (!whole && day === from) {
      points.push({ day, gainMinor: 0, valueMinor: base.value, costMinor: base.cost });
      continue;
    }
    const state = stateOn(day, day !== today);
    points.push({ day, gainMinor: state.gain - base.gain, valueMinor: state.value, costMinor: state.cost });
  }

  const held = bookOf(adjusted).positions.filter(position => position.quantityE8 > 0);
  const flat = held.some(position => {
    const list = known.get(position.symbol);
    return !list || list.length === 0 || timeOf(today) - timeOf(list[list.length - 1].day) > 4 * DAY;
  });

  const inPeriod = adjusted.filter(trade => (whole ? trade.day >= from : trade.day > from) && trade.day <= today);
  const bought = inPeriod.filter(trade => trade.kind === 'buy').reduce((sum, trade) => sum + Math.abs(trade.amountMinor), 0);
  const invested = base.value + bought;
  const changeMinor = points[points.length - 1].gainMinor;
  return {
    points,
    from,
    to: today,
    changeMinor,
    pct: invested > 0 ? changeMinor / invested * 100 : null,
    dividendsMinor: inPeriod.filter(trade => trade.kind === 'dividend' || trade.kind === 'tax')
      .reduce((sum, trade) => sum + trade.amountMinor, 0),
    estimated,
    flat,
  };
}
