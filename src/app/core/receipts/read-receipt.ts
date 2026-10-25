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
 * - **the rows**: a phone's reader hands back loose pieces, and which ones
 *   share a row depends on a height every phone may measure apart (Jose's
 *   phone joined "DESCUENTO" and "AHORRO", another did not). So a photo is
 *   laid out at every row height from half to one and a half times its usual
 *   one (`readReceiptPhoto`), and the layout that joins the fewest of the
 *   summary's words or figures on one row is read - the same on any phone.
 * Pure, tested in `read-receipt.test.mjs` on invented receipts.
 */

import type { IsoDate } from '../database/types';
import { itemsOfPage, middleHeight, type OcrPage } from '../statements/ocr-items';
import { linesOf } from '../statements/statement';
import { dateIn, moneyIn, type TextItem } from '../statements/tokens';

export interface Receipt {
  /** The total paid, in minor units; null when no amount was read. */
  totalMinor: number | null;
  /** False when no line said "total" and the amount was chosen another way. */
  totalSure: boolean;
  /**
   * How an unsure total was chosen: the amount printed largest (a screenshot of
   * a bank's app shows the movement biggest), one written as money going out
   * ("-$17.060"), or the largest figure. Null when a line said "total".
   */
  totalFrom?: 'prominent' | 'charged' | 'largest' | null;
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
    // A date or an hour is not money: "12/10/2026", "10:45", "2026-10-12".
    // A minus in front of an amount is a sign, not a date: "-$17.060,97".
    const before = text[at - 1] ?? ' ', after = text[at + match[0].length] ?? ' ';
    const dateDash = before === '-' && /\d/.test(text[at - 2] ?? '');
    if (/[/:]/.test(before) || dateDash || /[/:]/.test(after)) continue;
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
    const rest = text.slice(at).replace(/^(\d{1,2})\s+de\s+/i, '$1 ');
    let day = dateIn(rest, null);
    // "24 de oct" with no year: this year's, or last year's when that is still ahead.
    if (!day) {
      const year = Number(today.slice(0, 4));
      day = dateIn(rest, year);
      if (day && day > today) day = dateIn(rest, year - 1);
    }
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
const COUNT = /\btotal\s+(de\s+)?(items?|[ií]tems?|art[ií]culos|unidades|productos|cantidad|l[ií]neas?|detalles?|referencias)\b/i;
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
interface Word { part: Part; strong: boolean }
/** A discount, a saving or a tax: words that may stand side by side on one row. */
const ADJUSTMENT = /\b(descuentos?|ahorros?|discount|savings|iva|impuestos?|impoconsumo|propina|servicio|tip|vat|tax)\b/gi;
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
  // On a summary line a bare figure at its end may be longer: "IVA = 3681".
  const bare = (SUMMARY.test(text) ? /(?:^|[\s=])\$?\s*(\d{1,7})\s*$/ : /(?:^|\s)\$?\s*(\d{1,3})\s*$/).exec(text);
  return bare && !/%\s*$/.test(text) && !COUNT.test(text) ? [Number(bare[1]) * 100] : [];
}

/**
 * Where a receipt's summary begins. Read upwards from its total - the line
 * saying "TOTAL A PAGAR", "TOTAL COP"... or else the last plain total -
 * over the summary's own lines, and never past a count of the items ("Total
 * Linea Detalles: 9"): above it is the list of items, whose tax column ("IVA
 * 19 0") and heading ("Total") read like a summary too (Jose, 2026-10-25).
 */
function summaryStart(rows: readonly Row[]): number {
  const isTotal = (r: Row) => PLAIN.test(r.text) && !NOT_TOTAL.test(r.text) && !COUNT.test(r.text);
  let anchor = rows.findIndex(r => STRONG.test(r.text) && !COUNT.test(r.text));
  if (anchor < 0) anchor = rows.map(isTotal).lastIndexOf(true);
  if (anchor < 0) return rows.findIndex(r => OPENS_SUMMARY.test(r.text) && !COUNT.test(r.text));
  let start = anchor;
  for (let i = anchor - 1; i >= 0 && anchor - i <= 12; i--) {
    const r = rows[i];
    if (COUNT.test(r.text)) break;
    if (!SUMMARY.test(r.text)) {
      if (start - i > 2) break;
      continue;
    }
    start = i;
  }
  // The summary opens on a subtotal or a total, as before.
  for (let i = start; i <= anchor; i++) if (OPENS_SUMMARY.test(rows[i].text) && !COUNT.test(rows[i].text)) return i;
  return anchor;
}

/** The ways the summary's words can be paired with its figures. */
function pairings(rows: readonly Row[]): Pairing[] {
  const start = summaryStart(rows);
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
  // A row may carry two words side by side ("DESCUENTO AHORRO 13.463"): one
  // phone joins lines another keeps apart, so each word counts on its own.
  const wordsOf = (i: number): Word[] => {
    const text = rows[i].text;
    const apart = OPENS_SUMMARY.test(text) ? [] : [...text.matchAll(ADJUSTMENT)];
    return apart.length > 1
      ? apart.map(m => ({ part: partOf(m[0]), strong: false }))
      : [{ part: partOf(text), strong: STRONG.test(text) }];
  };
  const perRow = labels.map(wordsOf);
  const words = perRow.flat();
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
    // Two words on a row with one figure: which is whose is not known here.
    if (minor !== undefined && perRow[n].length === 1) own.pairs.push({ ...perRow[n][0], minor });
  });
  // Every word with a figure of its own line: the photo was level, trust it.
  if (own.pairs.length === words.length) found.unshift(own);
  else found.push(own);
  return found.filter(p => totalOf(p) !== null);
}

/**
 * A balance, before and after ("$349.249,59 → $332.188,62"), or what is
 * available: never what was paid.
 */
const BALANCE = /→|->|\b(saldo|disponible|cupo|balance|available)\b/i;

/** Whether a line's amount may be the total when no line says "total". */
function couldBeTheTotal(line: string): boolean {
  return !NOT_TOTAL.test(line) && !NOT_A_NAME.test(line) && !BALANCE.test(line);
}

/** The amounts of a line written with a minus in front: money that went out. */
function chargedIn(line: string): number[] {
  const found: number[] = [];
  for (const match of line.matchAll(/(?:^|[^\d])[-−–]\s*(\$?\s*\d[\d.,]*)/g)) found.push(...amountsIn(match[1]));
  return found;
}

/** The receipt in `items` (as `itemsOfPage` lays a photo out), read on `today`. */
export function readReceipt(items: readonly TextItem[], today: IsoDate): Receipt {
  const lines = linesOf(items).map(l => l.text);
  const rows: Row[] = lines.map(text => ({ text, amounts: figuresOf(text) }));

  const ways = pairings(rows);
  const chosen = ways.find(addsUp) ?? ways.find(sensible) ?? ways[0];
  let totalMinor: number | null = chosen ? totalOf(chosen) : null;
  let totalSure = totalMinor !== null;
  let totalFrom: Receipt['totalFrom'] = null;
  if (totalMinor === null) {
    const candidates = lines.filter(couldBeTheTotal);
    // Money written as going out ("-$17.060,97") is what was paid.
    const charged = candidates.flatMap(chargedIn);
    const all = candidates.flatMap(amountsIn);
    if (charged.length > 0) { totalMinor = Math.max(...charged); totalFrom = 'charged'; }
    else if (all.length > 0) { totalMinor = Math.max(...all); totalFrom = 'largest'; }
    totalSure = false;
  }

  let onDate: IsoDate | null = null;
  for (const line of lines) {
    onDate = dateAnywhere(line, today);
    if (onDate) break;
  }

  return { totalMinor, totalSure, totalFrom, onDate, shop: shopOf(lines) };
}


/** How many rows join two of a summary's words, or a summary word with two figures. */
function joined(lines: readonly string[]): number {
  let count = 0;
  for (const text of lines) {
    if (!SUMMARY.test(text) || COUNT.test(text)) continue;
    const words = [...text.matchAll(ADJUSTMENT)].length + (OPENS_SUMMARY.test(text) ? 1 : 0);
    if (words > 1 || figuresOf(text).length > 1) count++;
  }
  return count;
}

/**
 * A receipt from what a phone's reader handed back. Its pieces are laid out
 * at every row height from half to one and a half times the page's usual one,
 * and the layout that joins the fewest summary words or figures on a row is
 * read (the usual height first on a tie): which pieces share a row then no
 * longer depends on the phone.
 */
export function readReceiptPhoto(pages: readonly OcrPage[], today: IsoDate): Receipt {
  let best: { items: TextItem[]; joins: number; off: number } | null = null;
  for (let step = 0; step <= 20; step++) {
    const factor = 0.5 + step * 0.05;
    const items = pages.flatMap((page, i) => {
      const usual = middleHeight(page.lines.map(l => Math.round(l.bottom - l.top)));
      return itemsOfPage(page, i + 1, usual * factor);
    });
    const joins = joined(linesOf(items).map(l => l.text));
    const off = Math.abs(factor - 1);
    if (!best || joins < best.joins || (joins === best.joins && off < best.off)) best = { items, joins, off };
  }
  const receipt = readReceipt(best?.items ?? [], today);
  if (receipt.totalSure) return receipt;
  // No line says "total": the amount printed clearly larger than every other
  // is the one the picture is about - a bank app's movement, a ticket's sum.
  const prominent = prominentAmount(pages);
  return prominent === null ? receipt : { ...receipt, totalMinor: prominent, totalFrom: 'prominent' };
}

/** The amount on a line at least 1.4 times as tall as any other line with an amount. */
function prominentAmount(pages: readonly OcrPage[]): number | null {
  const withMoney = pages.flatMap(page => page.lines)
    .filter(line => couldBeTheTotal(line.text) && amountsIn(line.text).length > 0)
    .map(line => ({ line, height: line.bottom - line.top }))
    .sort((a, b) => b.height - a.height);
  if (withMoney.length === 0) return null;
  const [first, second] = withMoney;
  if (second && first.height < second.height * 1.4) return null;
  const charged = chargedIn(first.line.text);
  return charged.length > 0 ? Math.max(...charged) : Math.max(...amountsIn(first.line.text));
}
