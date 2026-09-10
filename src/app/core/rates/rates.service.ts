/**
 * Keeping the TRM current, without ever depending on being online.
 *
 * The rule the whole app is built on: if a network value is missing, use the
 * last one cached and say that is what you are doing. So this refreshes when
 * it can, stores what it gets, and never blocks anything on the answer.
 *
 * It also never lets a failed refresh look like a success. `state` is what the
 * screen shows, and "the rate is from three days ago because the last two
 * attempts failed" is a different thing from "the rate is from three days ago
 * because that is the last quote there is" — the second is normal, the first
 * is worth knowing.
 */

import { Injectable, computed, inject, signal } from '@angular/core';

import { DatabaseService } from '../database/database.service';
import { RatesRepository, RATE_SCALE, type Rate } from '../database/repositories/rates.repository';
import { fetchTrm, TrmError } from './trm-client';

export type RefreshState = 'idle' | 'checking' | 'updated' | 'offline' | 'failed';

/** The dollar is the only rate that has a public source; the rest are typed. */
const TRM_CURRENCY = 'USD';
const BASE_CURRENCY = 'COP';

/** How much history to pull when the app has never seen a rate. */
const FIRST_RUN_DAYS = 30;

@Injectable({ providedIn: 'root' })
export class RatesService {
  private readonly database = inject(DatabaseService);

  readonly state = signal<RefreshState>('idle');
  readonly lastError = signal('');

  /** The rate the app is currently valuing dollars at, if any. */
  readonly current = signal<Rate | null>(null);

  /** The rate as a number, for anything that needs to compute with it. */
  readonly currentValue = computed(() => {
    const rate = this.current();
    return rate === null ? null : rate.rate_scaled / RATE_SCALE;
  });

  /**
   * The rate as it should be read: 3.116,47 rather than 3,116.47.
   *
   * Formatted here rather than by a pipe in the template, because Angular's
   * number pipe formats in whatever locale the app was registered with — which
   * is US English — and a Colombian rate printed with a comma for thousands is
   * a different number to anyone reading it quickly.
   */
  readonly currentText = computed(() => {
    const value = this.currentValue();
    if (value === null) return null;
    return new Intl.NumberFormat('es-CO', {
      minimumFractionDigits: 2, maximumFractionDigits: 2,
    }).format(value);
  });

  /**
   * True when the rate in force is older than today.
   *
   * Normal on a weekend or a holiday — the TRM simply is not quoted — so this
   * is stated, not warned about. The screen decides how loudly to say it.
   */
  readonly isFromEarlierDay = computed(() => {
    const rate = this.current();
    return rate !== null && rate.on_date < todayIso();
  });

  async load(): Promise<void> {
    if (this.database.status() !== 'ready') return;

    const rates = new RatesRepository(this.database.driver);
    this.current.set(await rates.inForce(TRM_CURRENCY, BASE_CURRENCY, todayIso()));
  }

  /**
   * Fetches the TRM and stores whatever comes back.
   *
   * Called on demand and once when the app opens; either way a failure leaves
   * the stored rates exactly as they were.
   */
  async refresh(options: { force?: boolean } = {}): Promise<void> {
    if (this.database.status() !== 'ready') return;
    if (this.state() === 'checking') return;

    const rates = new RatesRepository(this.database.driver);
    const today = todayIso();

    // Already have today's, and nobody asked twice.
    const existing = await rates.inForce(TRM_CURRENCY, BASE_CURRENCY, today);
    if (!options.force && existing?.on_date === today) {
      this.current.set(existing);
      this.state.set('idle');
      return;
    }

    this.state.set('checking');
    this.lastError.set('');

    try {
      // Nothing stored at all: pull a month, so movements from the days the
      // app was closed can still be valued at their own day's rate.
      const quotes = await fetchTrm(existing === null ? FIRST_RUN_DAYS : 5);

      for (const quote of quotes) {
        await rates.set({
          on_date: quote.on_date,
          base_code: TRM_CURRENCY,
          quote_code: BASE_CURRENCY,
          rate_scaled: quote.rate_scaled,
          source: 'trm',
        });
      }

      this.current.set(await rates.inForce(TRM_CURRENCY, BASE_CURRENCY, today));
      this.state.set('updated');
      this.database.dataChanged();
    } catch (error) {
      // The stored rates are untouched; the screen keeps showing the last one
      // and now knows the attempt failed.
      this.current.set(existing);
      this.lastError.set(error instanceof Error ? error.message : String(error));
      this.state.set(error instanceof TrmError && !navigator.onLine ? 'offline' : 'failed');
    }
  }
}

function todayIso(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}
