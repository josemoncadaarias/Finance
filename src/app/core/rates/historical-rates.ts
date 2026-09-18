/**
 * What a foreign currency was worth in pesos on a given day, from official
 * sources.
 *
 * Two of them, both public and both deterministic - the project rule is that an
 * exact figure comes from a source that publishes it, never from a guess:
 *
 *   - USD: the TRM itself, certified daily by the Superintendencia Financiera
 *     and published on datos.gov.co. Each row says the days it is in force.
 *   - EUR: there is no official euro-peso rate in Colombia. The European Central
 *     Bank publishes the euro against the dollar every business day, and the
 *     TRM gives the dollar against the peso, so the euro in pesos is the one
 *     times the other - official on both sides, derived in between. Jose's
 *     point on 2026-09-18: "así como hay TRM para USD también debe haber para
 *     euros".
 *
 * Rates are integers scaled by 10,000, like every rate in this app.
 */

const TRM_ENDPOINT = 'https://www.datos.gov.co/resource/32sa-8pi3.json';
const ECB_ENDPOINT = 'https://api.frankfurter.dev/v1';

export type Fetcher = typeof fetch;

/** A rate to pesos, and where it came from. */
export interface RateToPesos {
  rate_scaled: number;
  /** For exchange_rates.source: which official figure it is. */
  source: 'trm' | 'ecb-trm';
}

async function json(url: string, fetcher: Fetcher): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetcher(url, { signal: controller.signal });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * The TRM in force on a day, scaled by 10,000.
 *
 * The last one certified on or before it: a Saturday or a holiday keeps the
 * rate certified before it, which is how the TRM itself works.
 */
export async function trmOn(date: string, fetcher: Fetcher = fetch): Promise<number | null> {
  const where = encodeURIComponent(`vigenciadesde <= '${date}T00:00:00'`);
  const payload = await json(
    `${TRM_ENDPOINT}?$where=${where}&$order=vigenciadesde%20DESC&$limit=1`, fetcher);
  const row = Array.isArray(payload) ? payload[0] as { valor?: string } | undefined : undefined;
  const value = Number.parseFloat(row?.valor ?? '');
  return Number.isFinite(value) && value > 0 ? Math.round(value * 10_000) : null;
}

/**
 * Dollars per euro on a day, scaled by 100,000 - the ECB quotes five figures.
 *
 * The ECB publishes on business days only; asked about a weekend it answers
 * with the Friday, which is the rate that was in force.
 */
export async function eurUsdOn(date: string, fetcher: Fetcher = fetch): Promise<number | null> {
  const payload = await json(`${ECB_ENDPOINT}/${date}?base=EUR&symbols=USD`, fetcher);
  const value = (payload as { rates?: { USD?: number } } | null)?.rates?.USD;
  return typeof value === 'number' && value > 0 ? Math.round(value * 100_000) : null;
}

/**
 * A currency in pesos on a day, or null when there is no official figure for
 * it or no way to reach one right now.
 *
 * Null is an answer, not a failure: rule 3 of this project is that a currency
 * with no rate on record is reported, never guessed at.
 */
export async function rateToPesosOn(
  currency: string, date: string, fetcher: Fetcher = fetch,
): Promise<RateToPesos | null> {
  if (currency === 'USD') {
    const trm = await trmOn(date, fetcher);
    return trm === null ? null : { rate_scaled: trm, source: 'trm' };
  }

  if (currency === 'EUR') {
    const [eurUsd, trm] = await Promise.all([eurUsdOn(date, fetcher), trmOn(date, fetcher)]);
    if (eurUsd === null || trm === null) return null;
    // Integers the whole way: 1.16480 USD/EUR (x100,000) times 4,049.3500
    // COP/USD (x10,000), brought back to the x10,000 every rate here uses.
    // One rounding, at the end.
    return { rate_scaled: Math.round((eurUsd * trm) / 100_000), source: 'ecb-trm' };
  }

  return null;
}
