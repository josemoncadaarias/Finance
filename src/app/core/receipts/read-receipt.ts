/**
 * What a photo of a receipt says (Jose, 2026-10-22; rule 22's OCR door, part
 * 2): the total, the day and the shop - enough to open the spending form
 * filled in, never to save anything by itself.
 *
 * Read by shape and by ordinary words, no shop or chain named:
 * - **the total** is the amount on the line that says it ("TOTAL A PAGAR",
 *   "VALOR TOTAL", "TOTAL"), or on the line under it; never a subtotal, the
 *   VAT, the change, the cash handed over or a count of items. With no such
 *   line, the largest amount on the receipt, marked unsure;
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

/** The receipt in `items` (as `itemsOfPage` lays a photo out), read on `today`. */
export function readReceipt(items: readonly TextItem[], today: IsoDate): Receipt {
  const lines = linesOf(items).map(l => l.text);

  let best: { score: number; minor: number } | null = null;
  lines.forEach((line, i) => {
    if (!PLAIN.test(line) && !STRONG.test(line)) return;
    if (NOT_TOTAL.test(line) && !STRONG.test(line)) return;
    const here = amountsIn(line);
    const below = lines[i + 1] && !PLAIN.test(lines[i + 1]) ? amountsIn(lines[i + 1]) : [];
    const minor = here.length > 0 ? here[here.length - 1] : below[0];
    if (minor === undefined) return;
    const score = STRONG.test(line) ? 2 : 1;
    if (!best || score > best.score || (score === best.score && minor > best.minor)) best = { score, minor };
  });

  let totalMinor: number | null = (best as { minor: number } | null)?.minor ?? null;
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
