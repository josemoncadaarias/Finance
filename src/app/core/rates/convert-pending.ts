/**
 * Puts a peso figure on foreign movements that were saved without one.
 *
 * Every movement stores two amounts: what moved, in its account's currency,
 * and what that was worth in pesos on the day. The second is what lets
 * dollars, euros and pesos be added together - the donut on "all accounts"
 * is built from it.
 *
 * A movement saved in a dollar or euro account with no rate given used to get
 * its own amount copied into the peso figure: 30 dollars stored as 30 pesos,
 * silently. The repository's fallback assumed that no rate meant a peso
 * account. Jose found it on 2026-09-18 when his dollar spending showed up in
 * the donut as a sliver - 60 of his 283 foreign movements carried it, 12 of
 * them spending, the rest legs of transfers between his own accounts.
 *
 * This finds them - a foreign account, a peso figure equal to its own amount -
 * and values each at the official rate of its own day: rule 3, a movement is
 * worth what it cost the day it happened, never today's rate. The rate is
 * stored in exchange_rates so the next movement on that day needs no network,
 * and the movement records which rate it used and that it is the official
 * reference rather than what the bank actually charged.
 *
 * A movement with no rate to be had - offline, or a currency nobody publishes -
 * is left as it is and counted as pending, and the next pass tries again. It is
 * never guessed at.
 */

import type { SqlDriver } from '../database/sql-driver';
import { convertToBaseMinor } from '../database/money';
import { RatesRepository } from '../database/repositories/rates.repository';
import type { RateToPesos } from './historical-rates';

export interface ConversionResult {
  /** Movements that now carry a real peso figure. */
  converted: number;
  /** Movements still waiting for a rate. */
  pending: number;
}

/** How far back a stored rate may stand in for a missing day: a long weekend. */
const NEAREST_DAYS = 5;

interface Pending {
  id: number;
  occurred_on: string;
  amount_minor: number;
  currency_code: string;
}

export async function convertPendingForeign(
  db: SqlDriver,
  options: {
    /** Where a missing rate comes from. None: only rates already stored. */
    fetchRate?: (currency: string, date: string) => Promise<RateToPesos | null>;
    now?: () => string;
  } = {},
): Promise<ConversionResult> {
  const pending = await db.query<Pending>(
    `SELECT t.id, t.occurred_on, t.amount_minor, a.currency_code
     FROM transactions t
     JOIN accounts a ON a.id = t.account_id
     WHERE a.currency_code <> 'COP'
       AND t.amount_minor <> 0
       AND t.amount_base_minor = t.amount_minor
     ORDER BY t.occurred_on, t.id`);
  if (pending.length === 0) return { converted: 0, pending: 0 };

  const rates = new RatesRepository(db, options.now);

  // One rate per currency and day, however many movements share it.
  const wanted = new Map<string, { currency: string; date: string }>();
  for (const row of pending) wanted.set(`${row.currency_code}|${row.occurred_on}`, {
    currency: row.currency_code, date: row.occurred_on,
  });

  const found = new Map<string, { rate_scaled: number; fromTrm: boolean }>();
  for (const [key, { currency, date }] of wanted) {
    const stored = await rates.inForce(currency, 'COP', date);
    if (stored && stored.on_date === date) {
      found.set(key, { rate_scaled: stored.rate_scaled, fromTrm: currency === 'USD' });
      continue;
    }

    const fetched = options.fetchRate ? await options.fetchRate(currency, date) : null;
    if (fetched) {
      await rates.set({
        on_date: date, base_code: currency, quote_code: 'COP',
        rate_scaled: fetched.rate_scaled, source: fetched.source,
      });
      found.set(key, { rate_scaled: fetched.rate_scaled, fromTrm: fetched.source === 'trm' });
      continue;
    }

    // Nothing for that exact day and nothing to fetch it with. A rate from a
    // few days before is what was in force over a weekend or a holiday; one
    // from months before is a different rate, and is not used.
    if (stored && daysBetween(stored.on_date, date) <= NEAREST_DAYS) {
      found.set(key, { rate_scaled: stored.rate_scaled, fromTrm: currency === 'USD' });
    }
  }

  let converted = 0;
  await db.transaction(async () => {
    for (const row of pending) {
      const rate = found.get(`${row.currency_code}|${row.occurred_on}`);
      if (!rate) continue;
      await db.run(
        `UPDATE transactions
         SET amount_base_minor = ?, rate_scaled = ?, rate_source = ?, confidence = 'low'
         WHERE id = ?`,
        [convertToBaseMinor(row.amount_minor, rate.rate_scaled), rate.rate_scaled,
         rate.fromTrm ? 'trm' : 'derived', row.id]);
      converted += 1;
    }
  });

  return { converted, pending: pending.length - converted };
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);
}
