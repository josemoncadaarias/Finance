/**
 * The currency balances and reports are shown in (mockup 37d). Pesos unless
 * the person chooses another one they keep; a currency with no rate on
 * record is never in force, so nothing is ever shown at an invented value.
 *
 * Kept on the device, like the theme: it changes how figures read, never
 * what is stored (`in-main.ts`).
 */

import { computed, effect, inject, Injectable, signal } from '@angular/core';

import { DatabaseService } from '../database/database.service';
import { fetchTrm } from '../rates/trm-client';
import { rateBook, rateOn, type RateBook } from './in-main';

const KEY = 'finance.mainCurrency';
/** A year and a bit of TRM, so a year of movements reads at its own days. */
const HISTORY_DAYS = 400;

@Injectable({ providedIn: 'root' })
export class MainCurrencyService {
  private readonly database = inject(DatabaseService);

  /** What the person chose. */
  readonly chosen = signal<string>(readChosen());
  /** The chosen currency's rates to pesos by day; empty for pesos. */
  readonly book = signal<RateBook>({ days: [], rates: [] });
  /** Bumped when the book is read again, so the screens redraw once. */
  readonly version = signal(0);

  /** The currency in force: the one chosen while it has a rate, else pesos. */
  readonly code = computed(() =>
    this.chosen() !== 'COP' && this.book().days.length > 0 ? this.chosen() : 'COP');

  constructor() {
    effect(() => {
      this.database.dataVersion();
      const chosen = this.chosen();
      if (this.database.status() === 'ready') void this.readBook(chosen);
    });
  }

  /** Today's rate of the currency in force, null for pesos. */
  todayRate(): number | null {
    if (this.code() === 'COP') return null;
    return rateOn(this.book(), todayIso());
  }

  /** Chooses one, and brings the dollar's history in so old months read right. */
  async choose(code: string): Promise<void> {
    try { localStorage.setItem(KEY, code); } catch { /* kept for this visit only */ }
    this.chosen.set(code);
    if (code === 'USD') await this.backfillTrm();
    await this.readBook(code);
  }

  private async readBook(code: string): Promise<void> {
    if (code === 'COP') {
      this.book.set({ days: [], rates: [] });
      this.version.update(v => v + 1);
      return;
    }
    const db = this.database.driver;
    // The rates on record first, then the rate each movement of an account
    // in that currency was saved with, for the days the first do not cover.
    const official = await db.query<{ on_date: string; rate_scaled: number }>(
      `SELECT on_date, rate_scaled FROM exchange_rates
       WHERE base_code = ? AND quote_code = 'COP' ORDER BY on_date`, [code]);
    const fromMovements = await db.query<{ on_date: string; rate_scaled: number }>(
      `SELECT t.occurred_on AS on_date, t.rate_scaled FROM transactions t
       JOIN accounts a ON a.id = t.account_id
       WHERE a.currency_code = ? AND t.rate_scaled IS NOT NULL ORDER BY t.occurred_on`, [code]);
    if (this.chosen() !== code) return;
    this.book.set(rateBook([...official, ...fromMovements]));
    this.version.update(v => v + 1);
  }

  /** The TRM of the last months, once, quietly: offline it is simply skipped. */
  private async backfillTrm(): Promise<void> {
    if (this.database.status() !== 'ready') return;
    try {
      const quotes = await fetchTrm(HISTORY_DAYS);
      const db = this.database.driver;
      await db.transaction(async () => {
        for (const quote of quotes) {
          await db.run(
            `INSERT OR IGNORE INTO exchange_rates (on_date, base_code, quote_code, rate_scaled, source, fetched_at)
             VALUES (?, 'USD', 'COP', ?, 'trm', ?)`,
            [quote.on_date, quote.rate_scaled, new Date().toISOString()]);
        }
      });
    } catch {
      // The rates already kept stand (rule 1).
    }
  }
}

function readChosen(): string {
  try {
    return localStorage.getItem(KEY) || 'COP';
  } catch {
    return 'COP';
  }
}

function todayIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}
