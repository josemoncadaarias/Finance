/**
 * Reading a broker's statement: what was bought and sold, at what price, the
 * dividends, what was withheld, what was put in.
 *
 * The same idea as a bank's statement (rule 22): a PDF is text with
 * coordinates, and what a thing IS shows in its shape. Nothing here names a
 * broker. A row of a broker's history is a line with a date on it; what kind
 * of row it is comes from ordinary words of both languages ("compra",
 * "purchase", "dividendo", "withholding", "split"); what was traded has the
 * shape of a ticker ("NVDA/USD", "NVO.US", or a plain one under a column
 * headed Symbol); and the figures are told apart by the heading of the column
 * they sit under, or by the "3 @ 15.71" every trader writes.
 *
 * The witness that a trade was read right is its own arithmetic: quantity
 * times price is what was paid. A row where that does not hold is marked, and
 * the person sees it before anything is saved.
 *
 * Pure: text in, rows out. No database, no screen.
 */

import type { IsoDate } from '../database/types';
import { linesOf, type StatementLine } from '../statements/statement';
import { dateIn, type TextItem } from '../statements/tokens';

export type TradeKind =
  | 'buy' | 'sell' | 'dividend' | 'tax' | 'fee' | 'interest' | 'split' | 'deposit' | 'withdrawal';

export type AssetKind = 'stock' | 'etf' | 'crypto' | 'other';

/** A quantity is kept in hundred-millionths of a unit, a price in millionths. */
export const QUANTITY_SCALE = 100_000_000;
export const PRICE_SCALE = 1_000_000;

export interface BrokerRow {
  kind: TradeKind;
  /** As this app writes it: "NVDA", "BRK.B", "VUAA.UK". Null for cash rows. */
  symbol: string | null;
  day: IsoDate;
  /** "15:42:17", when the statement says it. */
  time: string | null;
  quantityE8: number | null;
  priceE6: number | null;
  /**
   * What it did to the cash at the broker, signed, in cents: a purchase is
   * negative, a sale or a dividend positive.
   */
  amountMinor: number;
  /** A split's "10:1": every unit became `num` over `den`. */
  ratio: [number, number] | null;
  /** The broker's own number for the row or for the position it belongs to. */
  ref: string | null;
  asset: AssetKind | null;
  /**
   * 'adds': quantity times price is the amount. 'derived': one of the three
   * was not printed and was worked out from the other two. 'off': the three
   * were printed and do not agree. 'none': a row with nothing to check.
   */
  check: 'adds' | 'derived' | 'off' | 'none';
  /** The line as it was read, for the screen that shows what was understood. */
  text: string;
}

export interface BrokerReading {
  rows: BrokerRow[];
  /** The currency the statement is kept in, when it says one. */
  currency: string | null;
  from: IsoDate | null;
  to: IsoDate | null;
  /** Lines with a date and money on them that could not be understood. */
  unread: string[];
}

// ---- Words ------------------------------------------------------------------

function fold(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** The first that matches decides, so the order is part of the rule. */
const KINDS: readonly [TradeKind, RegExp][] = [
  ['split', /\b(split|desdoblamiento|contrasplit)\b/],
  ['tax', /\b(withholding|wht|retencion|retenido|impuesto|tax)\b/],
  ['dividend', /\bdividen[dt]/],
  ['interest', /\b(interes|intereses|interest)\b/],
  ['fee', /\b(comision|comisiones|commission|fee|fees|cargo|custodia)\b/],
  ['withdrawal', /\b(retiro|retirada|withdrawal|withdraw|reembolso)\b/],
  ['deposit', /\b(deposito|deposit|consignacion|funding|ingreso de fondos|aporte)\b/],
  ['sell', /\b(sale|sell|sold|venta|vendido|vendiste|close|closed|cerrada|cierre)\b|ganancias?\s*\/\s*perdidas?|profit\s*\/\s*loss/],
  ['buy', /\b(buy|bought|compra|comprado|compraste|purchase|open|opened|abierta|apertura)\b/],
];

function kindOf(text: string): TradeKind | null {
  const folded = fold(text);
  for (const [kind, words] of KINDS) if (words.test(folded)) return kind;
  return null;
}

/** Only a cell that says nothing else: "Stock purchase" is said of an ETF too. */
function assetOf(cell: string): AssetKind | null {
  const folded = fold(cell.trim());
  if (/^etfs?$/.test(folded)) return 'etf';
  if (/^(crypto|cripto|criptomonedas?|cryptocurrency)$/.test(folded)) return 'crypto';
  if (/^(acciones|accion|stocks?|equity|equities)$/.test(folded)) return 'stock';
  return null;
}

// ---- Column headings ----------------------------------------------------------

type Role = 'quantity' | 'price' | 'amount' | 'ref' | 'symbol' | 'type' | 'other';

const HEADINGS: readonly [Role, RegExp][] = [
  ['quantity', /^(unidades|units|cantidad|quantity|qty|volumen|volume|shares|titulos|nominal)\b/],
  ['price', /^(precio|price|open price|cotizacion|tasa de apertura)\b/],
  ['amount', /^(importe|amount|monto|valor|value|total|neto|net|efectivo|purchase value)\b/],
  ['ref', /^(id|ref|referencia|numero|no\.|order|orden|position|posicion|ticket)\b/],
  ['symbol', /^(simbolo|symbol|ticker|instrumento|instrument|activo|asset)\b/],
  ['type', /^(tipo|type|operacion|transaccion|transaction|descripcion|description|concepto|activity|actividad)\b/],
];

/** A table that prints today's price is a picture of today, not a history. */
const SNAPSHOT = /(market price|precio de mercado|precio actual|current price|last price|ultimo precio|valor de mercado|market value)/;

interface Column { x: number; role: Role; }
interface Heading { columns: Column[]; snapshot: boolean; }

function headingOf(line: StatementLine): Heading | null {
  if (line.items.length < 3) return null;
  const columns: Column[] = line.items.map(item => {
    const folded = fold(item.text.trim());
    const found = HEADINGS.find(([, words]) => words.test(folded));
    return { x: item.x, role: found ? found[0] : 'other' };
  });
  const known = new Set(columns.filter(c => c.role !== 'other').map(c => c.role));
  if (known.size < 2) return null;
  // "Tipo de activo" is a heading that starts like "tipo" and like "activo":
  // only the first of each role is that role's column.
  const seen = new Set<Role>();
  for (const column of columns) {
    if (column.role === 'other') continue;
    if (seen.has(column.role)) column.role = 'other';
    else seen.add(column.role);
  }
  return { columns, snapshot: SNAPSHOT.test(fold(line.text)) };
}

function roleAt(heading: Heading | null, x: number): Role | null {
  if (!heading) return null;
  let best: Column | null = null;
  for (const column of heading.columns) {
    if (best === null || Math.abs(column.x - x) < Math.abs(best.x - x)) best = column;
  }
  return best && Math.abs(best.x - x) <= 60 ? best.role : null;
}

// ---- Dates --------------------------------------------------------------------

interface Stamp { day: IsoDate; time: string | null; }

function isoOf(year: number, month: number, day: number): IsoDate | null {
  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1990 || year > 2999) return null;
  const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return new Date(`${iso}T00:00:00Z`).toISOString().slice(0, 10) === iso ? (iso as IsoDate) : null;
}

/**
 * The date written in a piece of text, with its year: a row of a history is
 * never dated "10/09". Full stops are not taken for a date's separators here,
 * because "10.05" on a broker's statement is ten dollars and five cents.
 */
function stampIn(text: string, monthFirst: boolean): Stamp | null {
  let day: IsoDate | null = null;
  let rest = text;
  const iso = text.match(/(?<![\d.,])(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?![\d.,]\d)/);
  const dmy = text.match(/(?<![\d.,])(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?!\d)/);
  if (iso) {
    day = isoOf(Number(iso[1]), Number(iso[2]), Number(iso[3]));
    rest = text.slice((iso.index ?? 0) + iso[0].length);
  } else if (dmy) {
    const [a, b] = [Number(dmy[1]), Number(dmy[2])];
    day = monthFirst ? isoOf(Number(dmy[3]), a, b) : isoOf(Number(dmy[3]), b, a);
    rest = text.slice((dmy.index ?? 0) + dmy[0].length);
  } else if (/[A-Za-z]{3}/.test(text) && /\d{4}/.test(text)) {
    day = dateIn(text, null);
    rest = text.replace(/^.*?\d{4}/, '');
  }
  if (day === null) return null;
  const time = rest.match(/(?<!\d)(\d{1,2}):(\d{2})(?::(\d{2}))?(?!\d)/);
  return {
    day,
    time: time ? `${time[1].padStart(2, '0')}:${time[2]}:${time[3] ?? '00'}` : null,
  };
}

/** A statement that writes the month first shows it on some day past the 12th. */
function writesMonthFirst(items: readonly TextItem[]): boolean {
  let monthFirst = 0;
  let dayFirst = 0;
  for (const item of items) {
    const match = item.text.match(/(?<![\d.,])(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?!\d)/);
    if (!match) continue;
    if (Number(match[1]) > 12) dayFirst += 1;
    else if (Number(match[2]) > 12) monthFirst += 1;
  }
  return monthFirst > 0 && dayFirst === 0;
}

// ---- Numbers ------------------------------------------------------------------

type Mark = '.' | ',';

/** Which of the two a statement uses for decimals, by what cannot be read otherwise. */
function decimalMarkOf(items: readonly TextItem[]): Mark {
  let dot = 0;
  let comma = 0;
  for (const item of items) {
    for (const token of item.text.match(/\d[\d.,]*\d/g) ?? []) {
      const lastDot = token.lastIndexOf('.');
      const lastComma = token.lastIndexOf(',');
      if (lastDot >= 0 && lastComma >= 0) {
        if (lastDot > lastComma) dot += 1; else comma += 1;
      } else if (lastDot >= 0 && token.indexOf('.') === lastDot && token.length - lastDot - 1 !== 3) {
        dot += 1;
      } else if (lastComma >= 0 && token.indexOf(',') === lastComma && token.length - lastComma - 1 !== 3) {
        comma += 1;
      }
    }
  }
  return comma > dot ? ',' : '.';
}

interface Figure {
  /** Digits with a full stop for the decimals, no sign: "1234.5678". */
  plain: string;
  negative: boolean;
  /** No separator at all and seven digits or more: a number of a row, not money. */
  serial: boolean;
}

function plainOf(digits: string, mark: Mark): string | null {
  if (!/^\d[\d.,]*$/.test(digits)) return null;
  const group = mark === '.' ? ',' : '.';
  const parts = digits.split(mark);
  if (parts.length > 2) {
    // The decimal mark more than once: it was grouping thousands after all.
    return /^\d{1,3}(?:[.,]\d{3})+$/.test(digits) ? digits.replace(/[.,]/g, '') : null;
  }
  const whole = parts[0].split(group).join('');
  if (!/^\d+$/.test(whole)) return null;
  if (parts.length === 1) return whole;
  if (!/^\d*$/.test(parts[1])) return null;
  return parts[1].length > 0 ? `${whole}.${parts[1]}` : whole;
}

const CODES = 'USD|EUR|GBP|COP|MXN|CHF|CAD|AUD|JPY|BRL|PLN|GBX';

function figureIn(text: string, mark: Mark): Figure | null {
  const raw = text.trim().replace(/[‐‑‒–—―−﹘﹣－]/g, '-');
  const match = raw.match(new RegExp(`^(\\()?\\s*([-+])?\\s*(?:[$€£]|${CODES})?\\s*([-+])?\\s*(\\d[\\d.,]*)\\s*(?:${CODES})?\\s*(\\))?$`));
  if (!match) return null;
  const plain = plainOf(match[4].replace(/[.,]$/, ''), mark);
  if (plain === null) return null;
  return {
    plain,
    negative: match[1] !== undefined || match[2] === '-' || match[3] === '-',
    serial: /^\d{7,}$/.test(match[4]),
  };
}

/** "0.237384" as 23,738,400 hundred-millionths, with no float in between. */
export function scaledOf(plain: string, scale: number): number {
  const places = String(scale).length - 1;
  const [whole, fraction = ''] = plain.split('.');
  const kept = fraction.padEnd(places + 1, '0');
  const value = Number(whole) * scale + Number(kept.slice(0, places));
  return Number(kept[places]) >= 5 ? value + 1 : value;
}

// ---- Symbols ------------------------------------------------------------------

/** What a ".XX" after a ticker says: the market it trades on. */
const MARKETS = new Set([
  'US', 'UK', 'DE', 'FR', 'ES', 'NL', 'IT', 'CH', 'PL', 'PT', 'BE', 'SE', 'DK', 'NO', 'FI', 'AT', 'IE', 'CA', 'AU',
  'JP', 'HK', 'MX', 'BR', 'CO',
]);

/** Upper-case words a column of tickers also holds, which are not one. */
const NOT_A_TICKER = new Set([
  'USD', 'EUR', 'GBP', 'COP', 'ETF', 'BUY', 'SELL', 'OPEN', 'CLOSE', 'CFD', 'N/A', 'NA', 'ID', 'SL', 'TP', 'SHR', 'WHT',
  'TOTAL', 'LONG', 'SHORT',
]);

interface Found { symbol: string; currency: string | null; }

function symbolIn(text: string, underSymbolColumn: boolean): Found | null {
  const trimmed = text.trim();
  // "NVDA/USD", "BRK.B/USD 10:1".
  const pair = trimmed.match(new RegExp(`^([A-Z0-9]{1,6}(?:\\.[A-Z]{1,2})?)\\s*\\/\\s*(${CODES})\\b`));
  if (pair) return { symbol: named(pair[1]), currency: pair[2] };
  // "NVO.US", alone or inside a comment.
  for (const match of trimmed.matchAll(/(?<![A-Za-z0-9.])([A-Z][A-Z0-9]{0,5})\.([A-Z]{2})(?![A-Za-z0-9])/g)) {
    if (MARKETS.has(match[2])) return { symbol: named(`${match[1]}.${match[2]}`), currency: null };
  }
  // "Railway Co (CNI)".
  const bracket = trimmed.match(/\(([A-Z]{1,5}(?:\.[A-Z])?)\)\s*$/);
  if (bracket && !NOT_A_TICKER.has(bracket[1])) return { symbol: bracket[1], currency: null };
  // A plain one, only where the statement's own heading says tickers go.
  if (underSymbolColumn && /^[A-Z][A-Z0-9]{0,5}(?:\.[A-Z])?$/.test(trimmed) && !NOT_A_TICKER.has(trimmed)) {
    return { symbol: trimmed, currency: null };
  }
  return null;
}

/** A ticker of the United States is written bare; any other keeps its market. */
function named(symbol: string): string {
  const match = symbol.match(/^(.+)\.([A-Z]{2})$/);
  return match && match[2] === 'US' ? match[1] : symbol;
}

// ---- The reading ----------------------------------------------------------------

/** How far above or below a row the rest of a wrapped cell may be printed. */
const WRAP = 9;
/** Two cents, or half a percent: what rounding a price leaves. */
function agrees(quantityE8: number, priceE6: number, amountMinor: number): boolean {
  const worked = (quantityE8 / QUANTITY_SCALE) * (priceE6 / PRICE_SCALE) * 100;
  const gap = Math.abs(worked - Math.abs(amountMinor));
  return gap <= Math.max(2, Math.abs(amountMinor) * 0.005);
}

const DEFAULT_SIGN: Record<TradeKind, 1 | -1> = {
  buy: -1, sell: 1, dividend: 1, tax: -1, fee: -1, interest: 1, split: 1, deposit: 1, withdrawal: -1,
};

interface Draft extends BrokerRow {
  /** The amount carried its own minus on the page. */
  printedNegative: boolean;
}

export function readBroker(items: readonly TextItem[]): BrokerReading {
  const lines = linesOf(items);
  const mark = decimalMarkOf(items);
  const monthFirst = writesMonthFirst(items);

  const stamps = lines.map(line => {
    const found: { at: number; stamp: Stamp }[] = [];
    line.items.forEach((item, at) => {
      const stamp = stampIn(item.text, monthFirst);
      if (stamp) found.push({ at, stamp });
    });
    return found;
  });

  const drafts: Draft[] = [];
  const unread: string[] = [];
  const currencies = new Map<string, number>();
  let heading: Heading | null = null;

  lines.forEach((line, index) => {
    const dated = stamps[index];
    if (dated.length === 0) {
      const found = headingOf(line);
      if (found) heading = found;
      return;
    }
    // A table of today's positions, and a row with the day it was opened AND
    // the day it was closed: both retell what the history already says.
    if (heading?.snapshot || dated.length > 1) return;

    const { at: dateAt, stamp } = dated[0];
    let symbol: Found | null = null;
    let typeText = '';
    let quantity: Figure | null = null;
    let price: Figure | null = null;
    let amount: Figure | null = null;
    let ref: string | null = null;
    let ratio: [number, number] | null = null;
    const loose: Figure[] = [];

    line.items.forEach((item, at) => {
      if (at === dateAt) return;
      const text = item.text.trim();
      if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(text)) return;
      const role = roleAt(heading, item.x);

      const traded = text.match(/(\d[\d.,]*)(?:\s*\/\s*[\d.,]+)?\s*@\s*(\d[\d.,]*)/);
      if (traded) {
        const q = plainOf(traded[1], mark);
        const p = plainOf(traded[2], mark);
        if (q !== null && p !== null) {
          quantity = { plain: q, negative: false, serial: false };
          price = { plain: p, negative: false, serial: false };
        }
      }
      const split = text.match(/(?<![\d:])(\d{1,4})\s*:\s*(\d{1,4})(?![\d:])/);
      if (split && Number(split[1]) > 0 && Number(split[2]) > 0) ratio = [Number(split[1]), Number(split[2])];

      const found = symbol === null || role === 'symbol' ? symbolIn(text, role === 'symbol') : null;
      if (found && (symbol === null || role === 'symbol')) symbol = found;

      const figure = figureIn(text, mark);
      if (figure) {
        if (role === 'ref' || (figure.serial && role !== 'amount' && role !== 'quantity' && role !== 'price')) {
          ref ??= figure.plain;
        } else if (role === 'amount') amount ??= figure;
        else if (role === 'quantity') quantity ??= figure;
        else if (role === 'price') price ??= figure;
        else if (role === null) loose.push(figure);
        return;
      }
      if (role === 'type') typeText += ` ${text}`;
    });

    // What kind of row: the cell under "Tipo" first, then the whole line, then
    // a cell that wrapped onto the lines just above and below it.
    const withoutSymbol = line.items
      .filter((_, at) => at !== dateAt)
      .map(item => item.text)
      .filter(text => symbolIn(text.trim(), false) === null || kindOf(text) !== null)
      .join(' ');
    let kind = kindOf(typeText) ?? kindOf(withoutSymbol);
    if (kind === null) {
      const around = [lines[index - 1], lines[index + 1]]
        .filter((near, at) => near !== undefined && near.page === line.page && Math.abs(near.y - line.y) <= WRAP
          && stamps[index + (at === 0 ? -1 : 1)].length === 0)
        .map(near => near.text)
        .join(' ');
      kind = kindOf(around);
    }

    // With no headings to go by, the figures say what they are by their sum:
    // of three numbers, the one that is the product of the other two was paid.
    const figures: Figure[] = loose;
    if (amount === null && quantity !== null && price !== null && figures.length > 0) {
      const worked = Number((quantity as Figure).plain) * Number((price as Figure).plain);
      amount = [...figures].sort((a, b) => Math.abs(Number(a.plain) - worked) - Math.abs(Number(b.plain) - worked))[0];
    } else if (amount === null && quantity === null && price === null && figures.length >= 3) {
      search: for (let c = 0; c < figures.length; c += 1) {
        for (let a = 0; a < figures.length; a += 1) {
          for (let b = a + 1; b < figures.length; b += 1) {
            if (a === c || b === c) continue;
            const [x, y, z] = [Number(figures[a].plain), Number(figures[b].plain), Number(figures[c].plain)];
            if (z > 0 && Math.abs(x * y - z) <= Math.max(0.02, z * 0.005)) {
              quantity = figures[a]; price = figures[b]; amount = figures[c];
              break search;
            }
          }
        }
      }
    } else if (amount === null && figures.length > 0) {
      amount = figures[figures.length - 1];
    }

    const text = line.text;
    const money = (amount as Figure | null) !== null && Number((amount as Figure).plain) !== 0;
    if (kind === null) {
      if (money && symbol !== null) unread.push(text);
      return;
    }

    const found = symbol as Found | null;
    if (found?.currency) currencies.set(found.currency, (currencies.get(found.currency) ?? 0) + 1);

    let quantityE8 = quantity ? scaledOf((quantity as Figure).plain, QUANTITY_SCALE) : null;
    let priceE6 = price ? scaledOf((price as Figure).plain, PRICE_SCALE) : null;
    let amountMinor = amount ? scaledOf((amount as Figure).plain, 100) : 0;
    let check: BrokerRow['check'] = 'none';

    if (kind === 'buy' || kind === 'sell') {
      if (found === null) { if (money) unread.push(text); return; }
      if (quantityE8 !== null && quantityE8 > 0 && priceE6 !== null && amount !== null && amountMinor > 0) {
        check = agrees(quantityE8, priceE6, amountMinor) ? 'adds' : 'off';
      } else if (quantityE8 !== null && quantityE8 > 0 && amount !== null && amountMinor > 0) {
        priceE6 = Math.round((amountMinor / 100) / (quantityE8 / QUANTITY_SCALE) * PRICE_SCALE);
        check = 'derived';
      } else if (quantityE8 !== null && quantityE8 > 0 && priceE6 !== null) {
        amountMinor = Math.round((quantityE8 / QUANTITY_SCALE) * (priceE6 / PRICE_SCALE) * 100);
        check = 'derived';
      } else if (priceE6 !== null && priceE6 > 0 && amount !== null && amountMinor > 0) {
        quantityE8 = Math.round((amountMinor / 100) / (priceE6 / PRICE_SCALE) * QUANTITY_SCALE);
        check = 'derived';
      } else {
        unread.push(text);
        return;
      }
    } else if (kind === 'split') {
      if (found === null || ratio === null || (ratio as [number, number])[0] === (ratio as [number, number])[1]) return;
      quantityE8 = null; priceE6 = null; amountMinor = 0;
    } else {
      if (!money) return;
      quantityE8 = null; priceE6 = null;
    }

    drafts.push({
      kind,
      symbol: kind === 'deposit' || kind === 'withdrawal' ? null : found?.symbol ?? null,
      day: stamp.day,
      time: stamp.time,
      quantityE8,
      priceE6,
      amountMinor,
      ratio: kind === 'split' ? ratio : null,
      ref,
      asset: line.items.map(item => assetOf(item.text)).find(found => found !== null) ?? null,
      check,
      text,
      printedNegative: (amount as Figure | null)?.negative ?? false,
    });
  });

  // A statement that prints a minus on what was paid signs every row itself,
  // and then a row without one came in - a dividend taken back, a tax returned.
  const signed = drafts.some(row => row.kind === 'buy' && row.printedNegative);
  for (const row of drafts) {
    if (row.kind === 'split') continue;
    const sign = signed
      ? (row.printedNegative ? -1 : 1)
      : (row.printedNegative && DEFAULT_SIGN[row.kind] === 1 ? -1 : DEFAULT_SIGN[row.kind]);
    row.amountMinor = sign * Math.abs(row.amountMinor);
  }

  // The same thing told twice - a split listed once per position, a purchase
  // in two tables of the same file - is one thing.
  const seen = new Set<string>();
  const rows: BrokerRow[] = [];
  for (const { printedNegative: _printed, ...row } of drafts) {
    const key = row.kind === 'split'
      ? `split|${row.symbol}|${row.day}|${row.ratio?.join(':')}`
      : rowKey(row);
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push(row.kind === 'split' ? { ...row, ref: null } : row);
  }
  rows.sort((a, b) => a.day.localeCompare(b.day) || (a.time ?? '').localeCompare(b.time ?? ''));

  return {
    rows,
    currency: currencyOf(items, currencies),
    from: rows.length > 0 ? rows[0].day : null,
    to: rows.length > 0 ? rows[rows.length - 1].day : null,
    unread: unread.slice(0, 30),
  };
}

/** What makes a row itself, so reading the same statement twice adds nothing. */
export function rowKey(row: Pick<BrokerRow, 'kind' | 'symbol' | 'day' | 'time' | 'quantityE8' | 'amountMinor' | 'ref' | 'ratio'>): string {
  if (row.kind === 'split') return `split|${row.symbol}|${row.day}|${row.ratio?.join(':')}`;
  return [row.kind, row.symbol ?? '', row.day, row.time ?? '', row.quantityE8 ?? '', row.amountMinor, row.ref ?? ''].join('|');
}

function currencyOf(items: readonly TextItem[], pairs: Map<string, number>): string | null {
  const counts = new Map(pairs);
  if (counts.size === 0) {
    const code = new RegExp(`^(${CODES})$`);
    for (const item of items) {
      const text = item.text.trim();
      if (code.test(text) && text !== 'GBX') counts.set(text, (counts.get(text) ?? 0) + 1);
    }
  }
  const best = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  return best ? best[0] : null;
}
