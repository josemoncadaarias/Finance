/**
 * The few calls to Google Sheets the prices need, and nothing else.
 *
 * The token carries `drive.file`: it reaches only files this app made in the
 * person's Drive, which is one spreadsheet. Nothing of the person's goes
 * anywhere but their own Google account - the tickers they hold are written
 * into their own sheet and the prices are read back.
 */

import { SHEET_COLUMNS, sheetRows, stillLoading } from './quotes';

const BASE = 'https://sheets.googleapis.com/v4/spreadsheets';

export type SheetsFailure =
  /** The token is not good (any more): ask Google again. */
  | 'auth'
  /** The sheet was deleted from Drive: make another. */
  | 'gone'
  /** The Sheets API is not switched on for this app's Google project. */
  | 'disabled'
  | 'network'
  | 'server';

export class SheetsError extends Error {
  readonly kind: SheetsFailure;
  constructor(kind: SheetsFailure, detail = '') {
    super(detail || kind);
    this.name = 'SheetsError';
    this.kind = kind;
  }
}

export type Fetcher = typeof fetch;

async function ask(fetcher: Fetcher, url: string, token: string, init: RequestInit = {}): Promise<unknown> {
  let response: Response;
  try {
    response = await fetcher(url, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
      signal: AbortSignal.timeout(20_000),
    });
  } catch (failure) {
    throw new SheetsError('network', failure instanceof Error ? failure.message : String(failure));
  }
  if (response.ok) return response.json();
  const detail = await response.text().catch(() => '');
  if (response.status === 401) throw new SheetsError('auth', detail);
  if (response.status === 404) throw new SheetsError('gone', detail);
  if (response.status === 403) {
    throw new SheetsError(/has not been used|is disabled|SERVICE_DISABLED|accessNotConfigured/i.test(detail) ? 'disabled' : 'auth', detail);
  }
  throw new SheetsError('server', `${response.status} ${detail.slice(0, 200)}`);
}

/** Makes the spreadsheet. Its locale is fixed so a formula's commas are commas on every account. */
export async function createSheet(token: string, title: string, fetcher: Fetcher = fetch): Promise<string> {
  const made = await ask(fetcher, BASE, token, {
    method: 'POST',
    body: JSON.stringify({ properties: { title, locale: 'en_US' } }),
  }) as { spreadsheetId?: string };
  if (!made.spreadsheetId) throw new SheetsError('server', 'no spreadsheet id');
  return made.spreadsheetId;
}

const wait = (ms: number) => new Promise<void>(resolve => { setTimeout(resolve, ms); });

/**
 * Writes the tickers with their formulas and reads what they work out to.
 *
 * Google fills a GOOGLEFINANCE cell a moment after it is written, so the
 * reading is tried a few times while any cell still says it is loading.
 */
export async function askSheet(
  token: string, sheetId: string, candidates: readonly string[],
  options: { fetcher?: Fetcher; pause?: (ms: number) => Promise<void>; tries?: number } = {},
): Promise<unknown[][]> {
  const fetcher = options.fetcher ?? fetch;
  const pause = options.pause ?? wait;
  const rows = sheetRows(candidates);
  const last = String.fromCharCode(64 + SHEET_COLUMNS);
  const range = `A1:${last}${Math.max(rows.length, 1)}`;

  await ask(fetcher, `${BASE}/${sheetId}/values/A1:${last}2000:clear`, token, { method: 'POST', body: '{}' });
  await ask(fetcher, `${BASE}/${sheetId}/values/${range}?valueInputOption=USER_ENTERED`, token, {
    method: 'PUT',
    body: JSON.stringify({ range, majorDimension: 'ROWS', values: rows }),
  });

  let values: unknown[][] = [];
  for (let attempt = 0; attempt < (options.tries ?? 5); attempt += 1) {
    await pause(attempt === 0 ? 1200 : 2000);
    const read = await ask(fetcher, `${BASE}/${sheetId}/values/${range}?valueRenderOption=UNFORMATTED_VALUE`, token) as { values?: unknown[][] };
    values = read.values ?? [];
    if (!stillLoading(values)) break;
  }
  return values;
}
