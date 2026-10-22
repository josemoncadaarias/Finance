/**
 * What a photo of a receipt says (Jose, 2026-10-22; rule 22's OCR door, part
 * 2): the total, the day and the shop - enough to open the spending form
 * filled in, never to save anything by itself.
 *
 * Read by shape and by ordinary words, no shop or chain named:
 * - **the total** is the amount that goes with the line that says it ("TOTAL
 *   A PAGAR", "VALOR TOTAL", "TOTAL"); never a subtotal, the VAT, the change,
 *   the cash handed over or a count of items. A receipt's summary is a
 *   column of words beside a column of figures, and in a photo held at an
 *   angle the figures slide a row up or down against their words (Jose,
 *   2026-10-22: "VALOR TOTAL" read the saving printed above it). So the words
 *   of the summary are paired with its figures BY ORDER, the column shifted a
 *   row either way or past a stray figure (a pen stroke over the words), and
 *   of the ways to pair them the one whose figures add up (subtotal less
 *   discounts, plus taxes, is the total) wins; when a misread digit stops
 *   every way adding up, the first that makes sense (the total no smaller
 *   than a discount or a tax, no larger than the subtotal with nothing added).
 *   With no such line, the largest amount on the receipt, marked unsure;
 * - **the day** is the first date written anywhere on it that is not in the
 *   future nor more than two years old;
 * - **the shop** is the first line at the top with words in it that is not an
 *   ID number, an address, a phone or the invoice's legal text.
 * Pure, tested in `read-receipt.test.mjs` on invented receipts.
 */

import type { IsoDate } from '../database/types';
import { linesOf } from '../statements/statement';
import { dateIn, moneyIn, type TextItem } from '../statements/tokens';

export interface Receipt {
  /** The total paid, in minor units; null when no amount was read. */
  totalMinor: number | null;
  /** False when no line said "total" and the largest amount was taken. */
  totalSure: boolean;
  onDate: IsoDate | null;
  shop: string | null;
}

const STRONG = /\b(total\s+a\s+pagar|valor\s+a\s+pagar|neto\s+a\s+pagar|total\s+pagado|valor\s+total|total\s+factura|total\s+venta|total\s+compra|gran\s+total|total\s+cop|amount\s+due|total\s+due)\b/i;
const PLAIN = /\btotal\b/i;
/** Lines whose amount is never the total paid. */
const NOT_TOTAL = /\b(sub\s*-?\s*total|total\s+(items?|art[ií]culos|unidades|productos|iva|impuestos?|descuentos?|ahorro|base|cantidad)|base\s+gravable|iva|impoconsumo|cambio|vueltos?|efectivo|recibido|cash|change|tax)\b/i;
/** Lines that are the shop's papers, not its name. */
const NOT_A_NAME = /\b(nit|rut|c\.?c\.?|tel[eé]?f?o?n?o?|tel|cel|celular|direcci[oó]n|dir|factura|resoluci[oó]n|r[eé]gimen|responsable|fecha|hora|caja|cajero|ticket|recibo|tiquete|pos|www|com|calle|carrera|cra|cl|kr|av|avenida|no\.?|n[uú]mero|autorizaci[oó]n|vigencia|desde|hasta|prefijo|iva)\b|https?:|@/i;

/** Every amount written in a line, left to right. */
export function amountsIn(text: string): number[] {
  const found: number[] = [];
  const shape = /(?:\$\s*)?\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{1,2})?|\$\s*\d+(?:[.,]\d{1,2})?|\d+[.,]\d{2}(?!\d)|\d{4,}/g;
  for (const match of text.matchAll(shape)) {
    const at = match.index ?? 0;
    // A date or an hour is not money: "12/10/2026", "10:45".
    const before = text[at - 1] ?? ' ', after = text[at + match[0].length] ?? ' ';
    if (/[/:\-]/.test(before) || /[/:]/.test(after)) continue;
    const money = moneyIn(match[0], 2);
    if (money && money.minor > 0) found.push(money.minor);
  }
  return found;
}

function dateAnywhere(text: string, today: IsoDate): IsoDate | null {
  const earliest = `${Number(today.slice(0, 4)) - 2}${today.slice(4)}`;
  for (const match of text.matchAll(/\d{1,4}(?=[\s/\-.]*[\dA-Za-z])/g)) {
    const at = match.index ?? 0;
    if (at > 0 && /\d/.test(text[at - 1])) continue;
    const day = dateIn(text.slice(at), null);
    if (day && day <= today && day >= earliest) return day;
  }
  return null;
}

function tidyName(text: string): string {
  const name = text.replace(/\s+/g, ' ').trim();
  // A receipt prints its name in capitals; the note reads better in words.
  if (name === name.toUpperCase() && /[A-ZÁÉÍÓÚÑ]{2}/.test(name)) {
    return name.toLowerCase().replace(/(^|[\s.-])(\p{L})/gu, (_, sep: string, c: string) => sep + c.toUpperCase());
  }
  return name;
}

function shopOf(lines: readonly string[]): string | null {
  for (const line of lines.slice(0, 8)) {
    const letters = (line.match(/\p{L}/gu) ?? []).length;
    const visible = line.replace(/\s/g, '').length;
    if (letters < 3 || letters < visible * 0.5) continue;
    if (NOT_A_NAME.test(line) || PLAIN.test(line)) continue;
    return tidyName(line);
  }
  return null;
}

/** A line of a receipt's summary: a subtotal, a discount, a tax, a tip or a total. */
const SUMMARY = /\b(sub\s*-?\s*total|total|descuentos?|ahorros?|iva|impuestos?|impoconsumo|propina|servicio|base|discount|savings|tip|vat|tax)\b/i;
/** The line that opens a summary: a subtotal or a total, never a count of items. */
const OPENS_SUMMARY = /\b(sub\s*-?\s*total|total)\b/i;
const COUNT = /\btotal\s+(items?|[ií]tems?|art[ií]culos|unidades|productos|cantidad)\b/i;
/** What a summary line is, for checking that its figures add up. */
type Part = 'subtotal' | 'less' | 'more' | 'total' | 'other';

function partOf(text: string): Part {
  if (/\bsub\s*-?\s*total\b/i.test(text)) return 'subtotal';
  if (STRONG.test(text) || (PLAIN.test(text) && !NOT_TOTAL.test(text))) return 'total';
  if (/\b(descuentos?|ahorros?|discount|savings)\b/i.test(text)) return 'less';
  if (/\b(iva|impuestos?|impoconsumo|propina|servicio|tip|vat|tax)\b/i.test(text)) return 'more';
  return 'other';
}

interface Row { text: string; amounts: number[] }
interface Pairing { pairs: { part: Part; strong: boolean; minor: number }[] }

/** The total a pairing gives: the strongest total line, the larger on a tie. */
function totalOf(p: Pairing): number | null {
  let best: { score: number; minor: number } | null = null;
  for (const pair of p.pairs) {
    if (pair.part !== 'total') continue;
    const score = pair.strong ? 2 : 1;
    if (!best || score > best.score || (score === best.score && pair.minor > best.minor)) best = { score, minor: pair.minor };
  }
  return best?.minor ?? null;
}

/** Whether a pairing's figures add up: the subtotal, less some, plus some, is the total. */
function addsUp(p: Pairing): boolean {
  const total = totalOf(p);
  const sub = p.pairs.find(x => x.part === 'subtotal')?.minor;
  if (total === null || sub === undefined) return false;
  const rest = p.pairs.filter(x => x.part === 'less' || x.part === 'more' || x.part === 'other').slice(0, 8);
  for (let mask = 1; mask < 1 << rest.length; mask++) {
    let sum = sub;
    rest.forEach((x, i) => {
      if (mask & (1 << i)) sum += x.part === 'less' ? -x.minor : x.part === 'more' ? x.minor : 0;
    });
    if (sum === total) return true;
  }
  return false;
}

/**
 * Whether a pairing can be a receipt at all: the total is never smaller than a
 * discount, a tax or a tip, and with nothing added it is never more than the
 * subtotal. A misread digit stops a pairing adding up; this still tells the
 * total from the saving printed beside it.
 */
function sensible(p: Pairing): boolean {
  const total = totalOf(p);
  if (total === null) return false;
  if (p.pairs.some(x => (x.part === 'less' || x.part === 'more') && x.minor > total)) return false;
  const sub = p.pairs.find(x => x.part === 'subtotal')?.minor;
  return sub === undefined || p.pairs.some(x => x.part === 'more') || total <= sub;
}

/**
 * The figures of a line: its amounts, or a small one written bare at its end
 * ("IVA 19% 921") - on a summary line that is a figure, not a count.
 */
function figuresOf(text: string): number[] {
  const found = amountsIn(text);
  if (found.length > 0) return found;
  const bare = /(?:^|\s)\$?\s*(\d{1,3})\s*$/.exec(text);
  return bare && !/%\s*$/.test(text) && !COUNT.test(text) ? [Number(bare[1]) * 100] : [];
}

/** The ways the summary's words can be paired with its figures. */
function pairings(rows: readonly Row[]): Pairing[] {
  const start = rows.findIndex(r => OPENS_SUMMARY.test(r.text) && !COUNT.test(r.text));
  if (start < 0) return [];
  const labels: number[] = [];
  for (let i = start; i < rows.length; i++) {
    if (!SUMMARY.test(rows[i].text) || COUNT.test(rows[i].text)) continue;
    // The summary is one run of lines: a tax breakdown printed further down
    // ("TARIFA BASE IMPUESTO", "IVA 19%") is another table, not part of it.
    if (labels.length > 0 && i - labels[labels.length - 1] > 2) break;
    labels.push(i);
  }
  const first = labels[0], last = labels[labels.length - 1];
  const words = labels.map(i => ({ part: partOf(rows[i].text), strong: STRONG.test(rows[i].text) }));
  const figures = (from: number, to: number): number[] => rows.slice(Math.max(0, from), to + 1)
    .filter(r => r.amounts.length > 0).map(r => r.amounts[r.amounts.length - 1]);
  const paired = (amounts: number[]): Pairing => ({ pairs: words.map((w, i) => ({ ...w, minor: amounts[i] })) });

  const found: Pairing[] = [];
  // The column of figures beside the words, a row above and below them too: a
  // photo held at an angle slides it, and a stroke of a pen or a stamp may add
  // a stray figure. Every run of as many figures as there are words is a way.
  const column = figures(first - 1, last + 1);
  for (let at = 0; at + words.length <= column.length; at++) found.push(paired(column.slice(at, at + words.length)));
  // Each word with the figure on its own line, or on the line under it.
  const own: Pairing = { pairs: [] };
  labels.forEach((i, n) => {
    const below = rows[i + 1] && !SUMMARY.test(rows[i + 1].text) ? rows[i + 1].amounts : [];
    const minor = rows[i].amounts.length > 0 ? rows[i].amounts[rows[i].amounts.length - 1] : below[0];
    if (minor !== undefined) own.pairs.push({ ...words[n], minor });
  });
  // Every word with a figure of its own line: the photo was level, trust it.
  if (own.pairs.length === words.length) found.unshift(own);
  else found.push(own);
  return found.filter(p => totalOf(p) !== null);
}

/** The receipt in `items` (as `itemsOfPage` lays a photo out), read on `today`. */
export function readReceipt(items: readonly TextItem[], today: IsoDate): Receipt {
  const lines = linesOf(items).map(l => l.text);
  const rows: Row[] = lines.map(text => ({ text, amounts: figuresOf(text) }));

  const ways = pairings(rows);
  const chosen = ways.find(addsUp) ?? ways.find(sensible) ?? ways[0];
  let totalMinor: number | null = chosen ? totalOf(chosen) : null;
  let totalSure = totalMinor !== null;
  if (totalMinor === null) {
    const all = lines.filter(l => !NOT_TOTAL.test(l) && !NOT_A_NAME.test(l)).flatMap(amountsIn);
    totalMinor = all.length > 0 ? Math.max(...all) : null;
    totalSure = false;
  }

  let onDate: IsoDate | null = null;
  for (const line of lines) {
    onDate = dateAnywhere(line, today);
    if (onDate) break;
  }

  return { totalMinor, totalSure, onDate, shop: shopOf(lines) };
}
