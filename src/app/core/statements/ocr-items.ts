/**
 * A photo or a screenshot of a statement, turned into what the PDF reader
 * reads (Jose, 2026-10-22: "leer movimientos de imágenes"; rule 22 called it
 * the door OCR opens into the same reading).
 *
 * The phone's text recognition hands back lines with their boxes in the
 * image's pixels, the top of the image at 0. A PDF hands back pieces in
 * points, its bottom at 0, and the statement reader groups a line by height
 * within a few points. So this lays the lines out as a PDF would have:
 * - pieces whose middles sit at about the same height are one row (a photo is
 *   never perfectly level, and a table's columns come back as separate lines);
 * - each row gets one height, going down the page as a PDF's does;
 * - x is scaled to a page about 600 points wide, so the reader's columns
 *   measure the same on a photo as on a PDF.
 *
 * And it mends the one slip that breaks figures most: a space read inside a
 * number ("45. 900,00", "1 .234"). Letters taken for digits are not guessed
 * at: a wrong digit is money, and the statement's own balances are what
 * catch a misread (the review screen's "No cuadra"). Pure, tested in
 * `ocr-items.test.mjs`.
 */

import type { TextItem } from './tokens';

/** One line the phone recognised, in the image's pixels. */
export interface OcrLine {
  text: string;
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** One image read: its size and its lines. */
export interface OcrPage {
  width: number;
  height: number;
  lines: OcrLine[];
}

/** The width a page is laid out to, in PDF points. */
const PAGE_WIDTH = 600;
/** The height between two rows, in PDF points (the reader joins within 3). */
const ROW_STEP = 14;
/** Two pieces are one row when their middles differ by less than this share of a line's height. */
const SAME_ROW = 0.55;

/** A space read inside a figure: "45. 900,00" → "45.900,00", "1 .234" → "1.234". */
export function mendNumbers(text: string): string {
  return text
    .replace(/(\d)\s*([.,])\s+(?=\d)/g, '$1$2')
    .replace(/(\d)\s+([.,])(?=\d)/g, '$1$2')
    .replace(/\s+/g, ' ')
    .trim();
}

/** The middle value of whole heights (the lower one of the two middles). */
export function middleHeight(heights: readonly number[]): number {
  const counts = new Map<number, number>();
  for (const h of heights) counts.set(h, (counts.get(h) ?? 0) + 1);
  let seen = 0;
  const want = Math.floor(heights.length / 2);
  for (let h = Math.min(...heights); h <= Math.max(...heights); h++) {
    seen += counts.get(h) ?? 0;
    if (seen > want) return h;
  }
  return heights[0] ?? 0;
}

/** The pieces of one image, as the PDF reader takes them. */
export function itemsOfPage(page: OcrPage, pageNumber: number, lineHeightOverride?: number): TextItem[] {
  const lines = page.lines
    .map(line => ({ ...line, text: mendNumbers(line.text) }))
    .filter(line => line.text.length > 0 && line.bottom > line.top);
  if (lines.length === 0) return [];

  // The middle line height, counted rather than sorted so it is the same
  // number on every phone. Tests pass other heights to prove a receipt reads
  // the same however a phone groups its rows.
  const lineHeight = lineHeightOverride ?? middleHeight(lines.map(l => Math.round(l.bottom - l.top)));
  const middle = (l: OcrLine) => (l.top + l.bottom) / 2;

  const rows: { middle: number; lines: OcrLine[] }[] = [];
  for (const line of [...lines].sort((a, b) => (middle(a) - middle(b)) || (a.left - b.left))) {
    const row = rows[rows.length - 1];
    if (row && Math.abs(middle(line) - row.middle) < lineHeight * SAME_ROW) {
      row.lines.push(line);
      row.middle = row.lines.reduce((sum, l) => sum + middle(l), 0) / row.lines.length;
    } else {
      rows.push({ middle: middle(line), lines: [line] });
    }
  }

  const scale = page.width > 0 ? PAGE_WIDTH / page.width : 1;
  const top = rows.length * ROW_STEP;
  const items: TextItem[] = [];
  rows.forEach((row, index) => {
    for (const line of row.lines) {
      items.push({ text: line.text, x: Math.round(line.left * scale), y: top - index * ROW_STEP, page: pageNumber });
    }
  });
  return items;
}

/** Several images of one statement, in the order chosen: page 1, 2, 3... */
export function itemsOfPages(pages: readonly OcrPage[]): TextItem[] {
  return pages.flatMap((page, i) => itemsOfPage(page, i + 1));
}
