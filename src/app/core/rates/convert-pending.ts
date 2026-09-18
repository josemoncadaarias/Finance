/**
 * Puts a peso figure on foreign movements, at the official rate of their day.
 *
 * Every movement stores two amounts: what moved, in its account's currency,
 * and what that was worth in pesos on the day. The second is what lets
 * dollars, euros and pesos be added together - the donut on "all accounts"
 * is built from it.
 *
 * A movement saved in a dollar or euro account with no rate given used to get
 * its own amount copied into the peso figure: 30 dollars stored as 30 pesos,
 * silently. Jose found it on 2026-09-18 when his dollar spending showed up in
 * the donut as a sliver - 60 of his 283 foreign movements carried it.
 *
 * Each is valued at the official rate of its own day: rule 3, a movement is
 * worth what it cost the day it happened. That rate is looked for in this
 * order:
 *
 *   1. Stored for that very day.
 *   2. Fetched for that day, and stored, so the next one needs no network.
 *   3. Offline: the last rate the app has - rule 1 of this project, "if a
 *      network value is missing, the last cached value is used and flagged as
 *      such". The first version refused anything older than a long weekend
 *      and left the movement out of the donut instead; Jose asked why a donut
 *      could not at least be drawn without a network, and the rule was on his
 *      side. It is marked `cached`, and the next pass with a network replaces
 *      it with the day's own rate.
 *
 * Only a currency with no rate on record at all is left as it is - and
 * counted, never guessed at.
 */

import type { SqlDriver } from '../database/sql-driver';
import { convertToBaseMinor } from '../database/money';
import { RatesRepository } from '../database/repositories/rates.repository';
import type { RateToPesos } from './historical-rates';

export interface ConversionResult {
  /** Movements given a rate on this pass, exact or stand-in. */
  converted: number;
  /** Movements left on a stand-in rate, still waiting for their day's own. */
  onCachedRate: number;
  /** Movements with no rate to be had at all. */
  pending: number;
}

interface Candidate {
  id: number;
  occurred_on: string;
  amount_minor: number;
  currency_code: string;
  /** 'cached' when it already carries a stand-in, waiting to be improved. */
  rate_source: string | null;
}

export async function convertPendingForeign(
  db: SqlDriver,
  options: {
    /** Where a missing rate comes from. None: only rates already stored. */
    fetchRate?: (currency: string, date: string) => Promise<RateToPesos | null>;
    now?: () => string;
  } = {},
): Promise<ConversionResult> {
  // Only the rows of foreign accounts are read - a few hundred out of sixteen
  // thousand - through the index on (account_id, occurred_on). This runs after
  // every change to the database, and on an ordinary day it finds nothing, so
  // what it costs is one small question.
  //
  // A movement on a stand-in rate can only be improved by its day's own rate,
  // which only the network can bring. With no network to ask it is not read
  // at all - offline, the pass after a save is that one question and no more.
  const improving = options.fetchRate ? ` OR t.rate_source = 'cached'` : '';
  const candidates = await db.query<Candidate>(
    `SELECT t.id, t.occurred_on, t.amount_minor, a.currency_code, t.rate_source
     FROM transactions t
     JOIN accounts a ON a.id = t.account_id
     WHERE t.account_id IN (SELECT id FROM accounts WHERE currency_code <> 'COP')
       AND t.amount_minor <> 0
       AND (t.amount_base_minor = t.amount_minor${improving})
     ORDER BY t.occurred_on, t.id`);
  if (candidates.length === 0) return { converted: 0, onCachedRate: 0, pending: 0 };

  const rates = new RatesRepository(db, options.now);

  // One answer per currency and day, however many movements share it.
  const days = new Map<string, { currency: string; date: string }>();
  for (const row of candidates) {
    days.set(`${row.currency_code}|${row.occurred_on}`, { currency: row.currency_code, date: row.occurred_on });
  }

  type Found = { rate_scaled: number; source: 'trm' | 'derived' | 'cached' };
  const exact = new Map<string, Found>();
  const standIn = new Map<string, Found>();

  for (const [key, { currency, date }] of days) {
    const stored = await rates.inForce(currency, 'COP', date);
    if (stored && stored.on_date === date) {
      exact.set(key, { rate_scaled: stored.rate_scaled, source: currency === 'USD' ? 'trm' : 'derived' });
      continue;
    }

    const fetched = options.fetchRate ? await options.fetchRate(currency, date) : null;
    if (fetched) {
      await rates.set({
        on_date: date, base_code: currency, quote_code: 'COP',
        rate_scaled: fetched.rate_scaled, source: fetched.source,
      });
      exact.set(key, { rate_scaled: fetched.rate_scaled, source: fetched.source === 'trm' ? 'trm' : 'derived' });
      continue;
    }

    // Offline. The rate in force before that day if there is one, otherwise
    // the newest the app has - "the last cached value", in the rule's words.
    const fallback = stored ?? (await rates.history(currency, 'COP', 1))[0] ?? null;
    if (fallback) standIn.set(key, { rate_scaled: fallback.rate_scaled, source: 'cached' });
  }

  let converted = 0;
  let onCachedRate = 0;
  let pending = 0;

  await db.transaction(async () => {
    for (const row of candidates) {
      const key = `${row.currency_code}|${row.occurred_on}`;
      // A movement already on a stand-in only moves for its day's own rate;
      // swapping one stand-in for another would be churn, not an improvement.
      const rate = exact.get(key) ?? (row.rate_source === 'cached' ? undefined : standIn.get(key));
      if (!rate) {
        if (row.rate_source === 'cached') onCachedRate += 1;
        else pending += 1;
        continue;
      }
      await db.run(
        `UPDATE transactions
         SET amount_base_minor = ?, rate_scaled = ?, rate_source = ?, confidence = 'low'
         WHERE id = ?`,
        [convertToBaseMinor(row.amount_minor, rate.rate_scaled), rate.rate_scaled, rate.source, row.id]);
      converted += 1;
      if (rate.source === 'cached') onCachedRate += 1;
    }
  });

  return { converted, onCachedRate, pending };
}
