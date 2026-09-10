/**
 * The official TRM, from the Colombian government's open-data service.
 *
 * The TRM is the only exchange rate that is genuinely public and historical:
 * the rate a bank applied to a particular purchase is not published anywhere,
 * which is why that one is typed in by hand and this one is not.
 *
 * Two things this deliberately does not do:
 *
 *   - **Guess.** A response that is missing, malformed, or holds something
 *     that is not a number produces an error, never a number. A wrong rate
 *     silently applied to net worth is worse than no rate at all.
 *   - **Block.** The app is offline-first. This is called when there is a
 *     chance of a connection, and the answer when there is none is "use what
 *     was cached and say so", which is the caller's job.
 *
 * A quote carries a validity range: Friday's rate covers the weekend. Storing
 * it under `vigenciadesde` and asking for "the most recent on or before this
 * day" reproduces that without keeping the range around.
 */

/** Where the data comes from, and what it is. */
const ENDPOINT = 'https://www.datos.gov.co/resource/32sa-8pi3.json';

/** Rates are integers scaled by 10,000, like everywhere else. */
const RATE_SCALE = 10_000;

export interface TrmQuote {
  /** The day the rate takes effect, `YYYY-MM-DD`. */
  on_date: string;
  /** Pesos per dollar, scaled by 10,000. */
  rate_scaled: number;
}

export interface TrmClientOptions {
  /** Swappable so tests never touch the network. */
  fetcher?: typeof fetch;
  /** Give up rather than leave someone staring at a spinner. */
  timeoutMs?: number;
}

export class TrmError extends Error {
  // Declared and assigned rather than written as a constructor parameter
  // property: Node runs these files by stripping types only, and a parameter
  // property would need a real compiler.
  override readonly cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'TrmError';
    this.cause = cause;
  }
}

/**
 * The most recent quotes, newest first.
 *
 * `limit` above one is useful on a first run: it fills in the days the app was
 * closed, so a movement dated last Tuesday can still be valued at Tuesday's
 * rate rather than today's.
 */
export async function fetchTrm(limit = 1, options: TrmClientOptions = {}): Promise<TrmQuote[]> {
  const fetcher = options.fetcher ?? fetch;
  const url = `${ENDPOINT}?$order=vigenciadesde%20DESC&$limit=${Math.max(1, Math.min(limit, 500))}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 8000);

  let payload: unknown;
  try {
    const response = await fetcher(url, { signal: controller.signal });
    if (!response.ok) {
      throw new TrmError(`The TRM service answered ${response.status}`);
    }
    payload = await response.json();
  } catch (error) {
    if (error instanceof TrmError) throw error;
    throw new TrmError('The TRM could not be fetched', error);
  } finally {
    clearTimeout(timeout);
  }

  if (!Array.isArray(payload)) {
    throw new TrmError('The TRM service answered something that is not a list');
  }

  const quotes = payload.map(parseQuote).filter((quote): quote is TrmQuote => quote !== null);
  if (quotes.length === 0) {
    throw new TrmError('The TRM service answered nothing usable');
  }
  return quotes;
}

/**
 * One row of the service's answer, or null if it cannot be trusted.
 *
 * Rows are dropped rather than defaulted: a malformed row is one rate the app
 * will not have, which is recoverable. A made-up one is a wrong net worth,
 * which is not.
 */
function parseQuote(row: unknown): TrmQuote | null {
  if (typeof row !== 'object' || row === null) return null;

  const record = row as Record<string, unknown>;
  const from = record['vigenciadesde'];
  const value = record['valor'];

  if (typeof from !== 'string' || typeof value !== 'string') return null;

  // "2026-09-10T00:00:00.000" — the day is all that matters.
  const on_date = from.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(on_date)) return null;

  // The service writes it with a dot, whatever a Colombian keyboard would do.
  const rate = Number(value);
  if (!Number.isFinite(rate) || rate <= 0) return null;

  return { on_date, rate_scaled: Math.round(rate * RATE_SCALE) };
}
