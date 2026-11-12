/**
 * One position, read from a photo or a screenshot of a broker's app (Jose,
 * 2026-11-12): how many units, the price and the day they were bought at,
 * and what they cost - to fill the purchase form, never to save by itself
 * (rule 22).
 *
 * No broker is named. A screen of one position is labels and values, and
 * each broker words the labels its own way: "Acciones", "Unidades", "Volumen
 * de la posición"; "Precio de apertura", "Precio de compra"; "Fecha de
 * apertura", "Hora de apertura"; "Valor de apertura", "Invertido". A value
 * sits to the right of its label on the same row, or under it when the
 * screen is a small table. A label printed on two or three lines is one
 * label. Pure: the phone's reader hands the lines and their boxes.
 */

import type { IsoDate } from '../database/types';
import type { OcrLine, OcrPage } from '../statements/ocr-items';
import { NOT_A_TICKER, PRICE_SCALE, QUANTITY_SCALE, scaledOf } from './read-broker';

export interface PositionRead {
  symbol: string | null;
  quantityE8: number | null;
  /** The price each unit was bought at. */
  priceE6: number | null;
  /** What the purchase cost, in cents: read, or worked out from the other two. */
  amountMinor: number | null;
  day: IsoDate | null;
  currency: string | null;
  /** The price on the day of the picture, when the screen says it. */
  currentE6: number | null;
  /** What was read off the picture, by name: the form says what to check. */
  found: ('symbol' | 'quantity' | 'price' | 'amount' | 'day')[];
}

type Field = 'quantity' | 'price' | 'amount' | 'day' | 'current';

/** The words of each thing, most telling first. Spanish and English; accents folded. */
const LABELS: [Field, RegExp][] = [
  ['current', /\b(ultimo precio|precio actual|precio de mercado|last price|current price|market price)\b/],
  ['price', /\b(precio de (apertura|compra|entrada)|precio promedio|precio medio|open(ing)? price|purchase price|buy price|entry price|average price|avg\.? price)\b/],
  ['day', /\b((fecha|hora|dia) de (apertura|compra|entrada)|abierta el|comprad[ao] el|open(ing)? (date|time)|purchase date|opened on|bought on)\b/],
  ['amount', /\b(valor de (apertura|compra)|importe invertido|monto invertido|invertido|inversion|invested|amount invested|open(ing)? value|purchase value|cost basis)\b/],
  ['quantity', /\b(acciones|unidades|volumen|cantidad|titulos|participaciones|shares|units|volume|quantity)\b/],
];

const CODES = 'USD|EUR|GBP|COP|CHF|CAD|AUD|MXN|BRL|JPY';

const MONTHS: [RegExp, number][] = [
  [/^(ene|jan)/, 1], [/^feb/, 2], [/^mar/, 3], [/^(abr|apr)/, 4], [/^may/, 5], [/^jun/, 6], [/^jul/, 7], [/^(ago|aug)/, 8],
  [/^sep/, 9], [/^oct/, 10], [/^nov/, 11], [/^(dic|dec)/, 12],
];

function fold(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function iso(year: number, month: number, day: number): IsoDate | null {
  if (year < 1990 || year > 2999 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const text = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return new Date(`${text}T00:00:00Z`).toISOString().slice(0, 10) === text ? text as IsoDate : null;
}

/** "10 Jun 2024, 08:53", "09.11.2026", "09/11/2026", "2026-11-09", "Jun 10, 2024". Day first when it could be either. */
export function dayIn(text: string): IsoDate | null {
  const folded = fold(text);
  const ymd = folded.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (ymd) return iso(Number(ymd[1]), Number(ymd[2]), Number(ymd[3]));
  const dmy = folded.match(/(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (dmy) return iso(Number(dmy[3]), Number(dmy[2]), Number(dmy[1])) ?? iso(Number(dmy[3]), Number(dmy[1]), Number(dmy[2]));
  const monthOf = (word: string): number | null => MONTHS.find(([shape]) => shape.test(word))?.[1] ?? null;
  const dMy = folded.match(/(\d{1,2})\s*(?:de\s+)?([a-z]{3,10})\.?,?\s*(?:de\s+)?(\d{4})/);
  if (dMy && monthOf(dMy[2])) return iso(Number(dMy[3]), monthOf(dMy[2]) as number, Number(dMy[1]));
  const Mdy = folded.match(/([a-z]{3,10})\.?\s+(\d{1,2}),?\s+(\d{4})/);
  if (Mdy && monthOf(Mdy[1])) return iso(Number(Mdy[3]), monthOf(Mdy[1]) as number, Number(Mdy[2]));
  return null;
}

/**
 * The one number of a value, as plain digits with a full stop: "$117.41",
 * "0.848395", "50.00 USD", "1.234,56", "1,234.56". A lone separator with
 * exactly three digits after it groups thousands, unless the number starts
 * with a zero.
 */
export function numberIn(text: string): string | null {
  if (dayIn(text) !== null) return null;
  const match = text.replace(/\s+(?=\d)/g, ' ').match(/\d[\d.,]*/);
  if (!match) return null;
  const raw = match[0].replace(/[.,]+$/, '');
  if (/[%]/.test(text.slice((match.index ?? 0) + match[0].length, (match.index ?? 0) + match[0].length + 2))) return null;
  const lastDot = raw.lastIndexOf('.');
  const lastComma = raw.lastIndexOf(',');
  const mark = Math.max(lastDot, lastComma);
  if (mark < 0) return raw;
  const both = lastDot >= 0 && lastComma >= 0;
  const after = raw.length - mark - 1;
  const once = raw.split(/[.,]/).length === 2;
  const groups = !both && (!once || (after === 3 && !raw.startsWith('0')));
  if (groups) return raw.replace(/[.,]/g, '');
  return `${raw.slice(0, mark).replace(/[.,]/g, '') || '0'}.${raw.slice(mark + 1)}`;
}

interface Block { text: string; left: number; right: number; top: number; bottom: number; }

/** A label printed on several lines is one label: lines stacked close, starting at the same edge, none of them a value. */
function blocksOf(page: OcrPage): Block[] {
  const lines = [...page.lines].filter(line => line.text.trim() !== '').sort((a, b) => a.top - b.top || a.left - b.left);
  const blocks: Block[] = [];
  const isValue = (line: OcrLine): boolean => numberIn(line.text) !== null || dayIn(line.text) !== null;
  for (const line of lines) {
    const height = line.bottom - line.top;
    const above = blocks.find(block => Math.abs(block.left - line.left) <= page.width * 0.03
      && line.top - block.bottom < height * 0.8 && line.top - block.bottom > -height * 0.3);
    if (above && !isValue(line) && numberIn(above.text) === null && dayIn(above.text) === null) {
      above.text = `${above.text} ${line.text.trim()}`;
      above.bottom = line.bottom;
      above.right = Math.max(above.right, line.right);
    } else {
      blocks.push({ text: line.text.trim(), left: line.left, right: line.right, top: line.top, bottom: line.bottom });
    }
  }
  return blocks;
}

/** The value of a label: after it on its own line, to its right on its row, or under it in its column. */
function valueOf(label: Block, shape: RegExp, blocks: readonly Block[], reads: (text: string) => boolean): string | null {
  const own = fold(label.text);
  const at = own.search(shape);
  const rest = label.text.slice(at + (own.slice(at).match(shape)?.[0].length ?? 0));
  if (reads(rest)) return rest;
  const height = label.bottom - label.top;
  const beside = blocks
    .filter(block => block !== label && block.left > (label.left + label.right) / 2
      // Its middle inside the label's own height: a row, not the line under a tall heading.
      && (block.top + block.bottom) / 2 > label.top - height * 0.25 && (block.top + block.bottom) / 2 < label.bottom + height * 0.25
      && reads(block.text))
    .sort((a, b) => a.left - b.left)[0];
  if (beside) return beside.text;
  const under = blocks
    .filter(block => block !== label && block.top >= label.bottom - height * 0.2 && block.top - label.bottom < height * 4
      && block.left < label.right && block.right > label.left && reads(block.text))
    .sort((a, b) => a.top - b.top)[0];
  return under ? under.text : null;
}

function tickerOf(blocks: readonly Block[]): string | null {
  const shape = /^[A-Z][A-Z0-9]{0,5}(?:\.[A-Z]{1,2})?$/;
  const fits = (word: string): boolean => shape.test(word) && !NOT_A_TICKER.has(word) && !new RegExp(`^(${CODES})$`).test(word);
  // "Comprar NVDA", "Buy NVDA": the surest.
  for (const block of blocks) {
    const said = block.text.match(/^(?:comprar?|compra de|buy|bought)\s+([A-Z][A-Z0-9.]{0,7})\b/i);
    if (said && fits(said[1].toUpperCase())) return bare(said[1].toUpperCase());
  }
  // "NVDA.US", or a line that is a ticker and nothing else (a tag beside it is let go).
  for (const block of blocks) {
    const first = block.text.trim().split(/\s+/)[0];
    if (/^[A-Z][A-Z0-9]{0,5}\.[A-Z]{2}$/.test(first)) return bare(first);
  }
  for (const block of blocks) {
    const words = block.text.trim().split(/\s+/);
    if (words.length <= 2 && fits(words[0]) && words[0].length >= 2 && (words.length === 1 || !/^[A-Za-z]{3,}$/.test(words[1]))) return words[0];
  }
  return null;
}

function bare(symbol: string): string {
  return symbol.endsWith('.US') ? symbol.slice(0, -3) : symbol;
}

/** What a picture of one position says. Pure. */
export function readPosition(pages: readonly OcrPage[]): PositionRead {
  const blocks = pages.flatMap(page => blocksOf(page));
  const got = new Map<Field, string>();
  const isNumber = (text: string): boolean => numberIn(text) !== null;
  const isDay = (text: string): boolean => dayIn(text) !== null;
  for (const [field, shape] of LABELS) {
    for (const block of blocks) {
      if (got.has(field) || !shape.test(fold(block.text))) continue;
      // A label already taken for something more telling ("Precio de apertura" is no "apertura" of a value).
      const value = valueOf(block, shape, blocks, field === 'day' ? isDay : isNumber);
      if (value !== null) got.set(field, value);
    }
  }

  const all = blocks.map(block => block.text).join(' ');
  const code = all.match(new RegExp(`(?<![A-Za-z])(${CODES})(?![A-Za-z])`));
  const plain = (field: Field): string | null => (got.has(field) ? numberIn(got.get(field) as string) : null);

  let quantityE8 = plain('quantity') !== null ? scaledOf(plain('quantity') as string, QUANTITY_SCALE) : null;
  const priceE6 = plain('price') !== null ? scaledOf(plain('price') as string, PRICE_SCALE) : null;
  let amountMinor = plain('amount') !== null ? scaledOf(plain('amount') as string, 100) : null;
  const found: PositionRead['found'] = [];
  if (quantityE8 !== null && quantityE8 > 0) found.push('quantity'); else quantityE8 = null;
  if (priceE6 !== null && priceE6 > 0) found.push('price');
  if (amountMinor !== null && amountMinor > 0) found.push('amount'); else amountMinor = null;

  // The third from the other two.
  if (amountMinor === null && quantityE8 !== null && priceE6 !== null && priceE6 > 0) {
    amountMinor = Number((BigInt(quantityE8) * BigInt(priceE6) + 500_000_000_000n) / 1_000_000_000_000n);
  } else if (quantityE8 === null && amountMinor !== null && priceE6 !== null && priceE6 > 0) {
    quantityE8 = Number((BigInt(amountMinor) * 1_000_000_000_000n + BigInt(priceE6) / 2n) / BigInt(priceE6));
  }

  const day = got.has('day') ? dayIn(got.get('day') as string) : null;
  if (day !== null) found.push('day');
  const symbol = tickerOf(blocks);
  if (symbol !== null) found.push('symbol');
  const current = plain('current');

  return {
    symbol, quantityE8, priceE6: priceE6 !== null && priceE6 > 0 ? priceE6 : null, amountMinor, day,
    currency: code ? code[1] : /\$/.test(all) ? 'USD' : null,
    currentE6: current !== null ? scaledOf(current, PRICE_SCALE) : null,
    found,
  };
}
