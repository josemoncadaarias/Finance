/**
 * The movements as a CSV anyone can open.
 *
 * This is the readable export: a spreadsheet, an accountant, a check against
 * the bank. It is **not** the backup — a CSV flattens what the database knows
 * (which leg belongs to which transfer, which rows were corrected by hand,
 * what a limit was in 2023) and reading it back would lose all of it. The
 * backup is the database itself; see `export-backup.ts`.
 *
 * Every amount is written twice: in the account's own currency and in pesos,
 * because those are different questions and a file with only one of them
 * cannot answer the other.
 */

import type { SqlDriver } from '../sql-driver';
import { formatMoney } from '../money';

export interface ExportRow {
  occurred_on: string;
  account: string;
  currency_code: string;
  category: string | null;
  amount_minor: number;
  amount_base_minor: number;
  rate_scaled: number | null;
  description: string | null;
  transfer_id: number | null;
  transfer_leg: string | null;
  other_account: string | null;
  locked: number;
  source: string;
  confidence: string;
}

/**
 * The words the file itself uses.
 *
 * Passed in rather than written here: the file is the app talking, so it
 * speaks whichever language the app is set to. The data inside — account
 * names, categories, notes — stays exactly as it was typed, like everywhere
 * else.
 */
export interface CsvWords {
  headers: string[];
  transfer: string;
  movement: string;
  transferLeg: (leg: string) => string;
  yes: string;
  no: string;
}

/** Spanish, which is what a Colombian accountant will be handed. */
export const SPANISH_WORDS: CsvWords = {
  headers: [
    'fecha', 'cuenta', 'moneda', 'categoria', 'monto', 'monto_en_pesos', 'tasa',
    'nota', 'tipo', 'contraparte', 'corregido_a_mano', 'origen', 'confianza',
  ],
  transfer: 'Transferencia',
  movement: 'movimiento',
  transferLeg: leg => `transferencia (${leg})`,
  yes: 'si',
  no: 'no',
};

export async function exportMovements(db: SqlDriver): Promise<ExportRow[]> {
  return db.query<ExportRow>(
    `SELECT t.occurred_on, a.name AS account, a.currency_code,
            c.name AS category, t.amount_minor, t.amount_base_minor, t.rate_scaled,
            t.description, t.transfer_id, t.transfer_leg,
            other.name AS other_account, t.locked, t.source, t.confidence
     FROM transactions t
     JOIN accounts a ON a.id = t.account_id
     LEFT JOIN categories c ON c.id = t.category_id
     LEFT JOIN transactions sibling
       ON sibling.transfer_id = t.transfer_id AND sibling.id <> t.id
     LEFT JOIN accounts other ON other.id = sibling.account_id
     ORDER BY t.occurred_on, t.id`,
  );
}

/**
 * Turns the rows into CSV text.
 *
 * Semicolons, not commas: a Colombian amount is written `1.234,56`, and a file
 * separated by commas opens in Excel here as one column of nonsense. The
 * amounts are written the way they are read on screen for the same reason —
 * this file is for a person, and a person reading 9421.28 in a column headed
 * "monto" will not thank anyone for the dot.
 */
export function toCsv(rows: readonly ExportRow[], words: CsvWords = SPANISH_WORDS): string {
  const lines = [words.headers.join(';')];

  for (const row of rows) {
    lines.push([
      row.occurred_on,
      row.account,
      row.currency_code,
      row.category ?? (row.transfer_id !== null ? words.transfer : ''),
      formatMoney(row.amount_minor, row.currency_code, { withSymbol: false }),
      formatMoney(row.amount_base_minor, 'COP', { withSymbol: false }),
      row.rate_scaled === null ? '' : (row.rate_scaled / 10_000).toFixed(4).replace('.', ','),
      row.description ?? '',
      row.transfer_id === null ? words.movement : words.transferLeg(row.transfer_leg ?? ''),
      row.other_account ?? '',
      row.locked ? words.yes : words.no,
      row.source,
      row.confidence,
    ].map(escapeField).join(';'));
  }

  // A trailing newline: some tools drop the last line without it.
  return lines.join('\r\n') + '\r\n';
}

/**
 * Quotes a field when it needs it.
 *
 * A note can hold a semicolon, a quote, or a line break — "Pago 50%; resto en
 * efectivo" would otherwise become two columns.
 */
function escapeField(value: string): string {
  const text = String(value ?? '');
  if (!/[;"\r\n]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

/**
 * A file name that sorts chronologically and never collides.
 *
 * The shape a spreadsheet reads without being told anything, and for this
 * reason: two
 * exports on one day must not overwrite each other.
 */
export function exportFileName(now: Date, extension: string): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const time = `${pad(now.getHours())}${pad(now.getMinutes())}`;
  return `finance-${date}-${time}.${extension}`;
}
