/**
 * What a currency is worth, on a given day.
 *
 * Two different questions live in this app and they must not be answered with
 * the same number:
 *
 *   - *What did this cost me?* — a movement keeps the rate that actually
 *     applied the day it happened. That is history and never changes.
 *   - *What do I have?* — today's balance is worth today's rate. Two thousand
 *     dollars bought across five years at five different rates are still two
 *     thousand dollars, and they are worth what a dollar is worth now.
 *
 * Net worth is the second question. Summing the historical peso value of every
 * movement answers the first one and calls it the second, which is how a total
 * ends up disagreeing with the sum anyone would do by hand.
 *
 * Rates are stored by day, so "the rate in force" is simply the most recent one
 * on or before the date being asked about. Nothing is ever invented: with no
 * rate for a currency, the caller is told so rather than handed a guess.
 */

import type { SqlDriver } from '../sql-driver';
import type { IsoDate } from '../types';

/** Rates are integers scaled by 10,000, like everywhere else in the app. */
export const RATE_SCALE = 10_000;

export interface Rate {
  on_date: IsoDate;
  base_code: string;
  quote_code: string;
  rate_scaled: number;
  source: string;
}

export class RatesRepository {
  private readonly db: SqlDriver;
  private readonly now: () => string;

  constructor(db: SqlDriver, now: () => string = () => new Date().toISOString()) {
    this.db = db;
    this.now = now;
  }

  /**
   * The rate in force for a currency, on or before `asOf`.
   *
   * Deliberately not "the rate on that exact day": rates are not quoted on
   * weekends or holidays, and refusing to answer on a Sunday would be useless.
   * The most recent quote before the date is what a bank would use too.
   */
  async inForce(base: string, quote: string, asOf: IsoDate): Promise<Rate | null> {
    return this.db.queryOne<Rate>(
      `SELECT on_date, base_code, quote_code, rate_scaled, source
       FROM exchange_rates
       WHERE base_code = ? AND quote_code = ? AND on_date <= ?
       ORDER BY on_date DESC
       LIMIT 1`,
      [base, quote, asOf],
    );
  }

  /** Every currency's rate in force, in one query rather than one per currency. */
  async allInForce(quote: string, asOf: IsoDate): Promise<Map<string, Rate>> {
    const rows = await this.db.query<Rate>(
      `SELECT r.on_date, r.base_code, r.quote_code, r.rate_scaled, r.source
       FROM exchange_rates r
       JOIN (
         SELECT base_code, MAX(on_date) AS newest
         FROM exchange_rates
         WHERE quote_code = ? AND on_date <= ?
         GROUP BY base_code
       ) latest ON latest.base_code = r.base_code AND latest.newest = r.on_date
       WHERE r.quote_code = ?`,
      [quote, asOf, quote],
    );
    return new Map(rows.map(rate => [rate.base_code, rate]));
  }

  /**
   * Records a rate for a day, replacing whatever was there.
   *
   * Same day means same answer: a rate corrected because it was typed wrong
   * should not sit beside the wrong one.
   */
  async set(rate: {
    on_date: IsoDate;
    base_code: string;
    quote_code: string;
    rate_scaled: number;
    source?: string;
  }): Promise<void> {
    if (rate.rate_scaled <= 0) throw new Error('A rate has to be greater than zero');
    if (rate.base_code === rate.quote_code) throw new Error('A currency cannot be quoted against itself');

    await this.db.run(
      `INSERT INTO exchange_rates (on_date, base_code, quote_code, rate_scaled, source, fetched_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(on_date, base_code, quote_code) DO UPDATE SET
         rate_scaled = excluded.rate_scaled,
         source = excluded.source,
         fetched_at = excluded.fetched_at`,
      [rate.on_date, rate.base_code, rate.quote_code, rate.rate_scaled,
       rate.source ?? 'manual', this.now()],
    );
  }

  /** The last rates recorded for a currency, most recent first. */
  async history(base: string, quote: string, limit = 20): Promise<Rate[]> {
    return this.db.query<Rate>(
      `SELECT on_date, base_code, quote_code, rate_scaled, source
       FROM exchange_rates
       WHERE base_code = ? AND quote_code = ?
       ORDER BY on_date DESC
       LIMIT ?`,
      [base, quote, limit],
    );
  }
}

/**
 * Converts an amount at a rate, rounding to the nearest minor unit.
 *
 * Both sides are integers in minor units and the rate is scaled by 10,000, so
 * this is integer arithmetic throughout — no float ever holds an amount.
 */
export function convertAt(amountMinor: number, rateScaled: number): number {
  return Math.round((amountMinor * rateScaled) / RATE_SCALE);
}
