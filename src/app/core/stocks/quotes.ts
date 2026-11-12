/**
 * Asking Google Finance for prices, through a spreadsheet of the person's own.
 *
 * The app has no server and pays for no market data (rule 21). What it can do
 * is what anybody does by hand: a Google Sheet with `=GOOGLEFINANCE("NVDA")`
 * in it, in the person's own Drive, made by the app and read back. This file
 * is the pure half - which rows to write and what the cells that come back
 * mean. `sheets-client.ts` does the asking.
 *
 * Google delays prices up to twenty minutes and gives no history through its
 * API, so the app keeps each day's price itself from the first day it looks.
 */

import { PRICE_SCALE, type AssetKind } from './read-broker';
import type { Facts } from './stocks.repository';

/** How Google Finance names the market a broker writes as ".XX". */
const GOOGLE_MARKET: Record<string, string[]> = {
  UK: ['LON'], DE: ['ETR', 'FRA'], FR: ['EPA'], ES: ['BME'], NL: ['AMS'], IT: ['BIT'], CH: ['SWX'], PL: ['WSE'],
  PT: ['ELI'], BE: ['EBR'], SE: ['STO'], DK: ['CPH'], NO: ['OSL'], FI: ['HEL'], AT: ['VIE'], IE: ['ISE'],
  CA: ['TSE'], AU: ['ASX'], JP: ['TYO'], HK: ['HKG'], MX: ['BMV'], BR: ['BVMF'], CO: ['BVC'],
};

/**
 * The ways Google Finance may write a ticker, the likeliest first.
 *
 * A broker writes a class of shares run together ("BRKB") where Google wants
 * a full stop ("BRK.B"), and a market as a suffix (".UK") where Google wants
 * a prefix ("LON:"). The first that answers a price is remembered; the
 * person can always type another (rule 7).
 */
export function candidatesFor(symbol: string, asset: AssetKind | null, currency: string): string[] {
  const out: string[] = [];
  const market = symbol.match(/^(.+)\.([A-Z]{2})$/);
  if (market && GOOGLE_MARKET[market[2]]) {
    for (const prefix of GOOGLE_MARKET[market[2]]) out.push(`${prefix}:${market[1]}`);
    out.push(market[1]);
  } else if (asset === 'crypto') {
    out.push(`${symbol}${currency}`, symbol);
  } else {
    out.push(symbol);
    if (/^[A-Z]{3,4}[AB]$/.test(symbol)) out.push(`${symbol.slice(0, -1)}.${symbol.slice(-1)}`);
    if (/^[A-Z]+\.[A-Z]$/.test(symbol)) out.push(symbol.replace('.', '-'));
  }
  return [...new Set(out)];
}

/** What is asked of each ticker, in the order of the sheet's columns after the ticker. */
const ATTRIBUTES = ['price', 'closeyest', 'name', 'currency', 'pe', 'eps', 'marketcap', 'high52', 'low52'] as const;

export const SHEET_COLUMNS = ATTRIBUTES.length + 1;

/** One row per way of writing a ticker: the ticker, then a formula per figure. */
export function sheetRows(candidates: readonly string[]): string[][] {
  return candidates.map((candidate, at) => [
    candidate,
    ...ATTRIBUTES.map(attribute => `=IFERROR(GOOGLEFINANCE(A${at + 1},"${attribute}"),"")`),
  ]);
}

export interface SheetQuote {
  /** The way of writing it that Google answered. */
  quote: string;
  /** In `currency`, as Google gave it. */
  price: number;
  previous: number | null;
  name: string | null;
  currency: string | null;
  facts: Facts;
}

function numberOf(cell: unknown): number | null {
  if (typeof cell === 'number' && Number.isFinite(cell) && cell > 0) return cell;
  if (typeof cell === 'string' && /^\d+(\.\d+)?$/.test(cell.trim())) return Number(cell);
  return null;
}

/** True while the sheet has not worked its formulas out yet. */
export function stillLoading(values: readonly unknown[][]): boolean {
  return values.some(row => row.slice(1).some(cell => typeof cell === 'string' && /^(loading|cargando)/i.test(cell.trim())));
}

/**
 * What the sheet answered, by ticker as the sheet wrote it.
 *
 * A ticker Google does not know leaves its cells empty, and is simply not in
 * the answer: the screen then says that position has no automatic price.
 */
export function quotesFrom(values: readonly unknown[][]): Map<string, SheetQuote> {
  const found = new Map<string, SheetQuote>();
  for (const row of values) {
    const quote = typeof row[0] === 'string' ? row[0].trim() : '';
    const price = numberOf(row[1]);
    if (quote === '' || price === null) continue;
    const text = (cell: unknown): string | null => typeof cell === 'string' && cell.trim() !== '' ? cell.trim() : null;
    const facts: Facts = {};
    const [pe, eps, cap, high, low] = [numberOf(row[5]), numberOf(row[6]), numberOf(row[7]), numberOf(row[8]), numberOf(row[9])];
    if (pe !== null) facts.pe = pe;
    if (eps !== null) facts.eps = eps;
    if (cap !== null) facts.marketCap = cap;
    if (high !== null) facts.high52 = high;
    if (low !== null) facts.low52 = low;
    const currency = text(row[4]);
    if (currency) facts.currency = currency;
    found.set(quote, { quote, price, previous: numberOf(row[2]), name: text(row[3]), currency, facts });
  }
  return found;
}

/**
 * A price in the currency the position is held in.
 *
 * London quotes many shares in pence ("GBX"); a fund bought in dollars may be
 * quoted in euros. `pesosPer` is the app's own rates (pesos per unit, COP as
 * 1): with no rate on record for either side there is no price - never a
 * guess (rule 3).
 */
export function inCurrency(
  price: number, from: string | null, to: string, pesosPer: ReadonlyMap<string, number>,
): number | null {
  let value = price;
  let code = (from ?? to).trim();
  if (code === 'GBX' || code === 'GBp') { value /= 100; code = 'GBP'; }
  code = code.toUpperCase();
  if (code === to) return value;
  const [a, b] = [pesosPer.get(code), pesosPer.get(to)];
  if (!a || !b) return null;
  return value * a / b;
}

export function toE6(price: number): number {
  return Math.round(price * PRICE_SCALE);
}
