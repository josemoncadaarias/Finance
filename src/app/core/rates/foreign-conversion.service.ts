/**
 * Keeps the day's rates fresh and every foreign movement valued in pesos,
 * without being asked and without being felt.
 *
 * Two jobs:
 *
 *   - On opening, today's dollar and euro rates are fetched, once a day. Jose
 *     assumed on 2026-09-18 that the TRM refreshed whenever the app opened,
 *     and it did not: it only refreshed from a button on the accounts screen.
 *   - After every change to the database, any foreign movement without a peso
 *     figure gets one (see convert-pending.ts).
 *
 * Neither may be felt on the phone, which was Jose's condition. So:
 *
 *   - Nothing here runs while the screen is being drawn. The opening job waits
 *     a few seconds, past migrations, the first screen and the icons; the
 *     after-a-change job waits until changes stop coming.
 *   - The network is asynchronous and never holds anything up. At most one
 *     pass runs at a time.
 *   - The usual pass is one small question over the foreign accounts' rows
 *     that finds nothing, and then it stops. Screens are told to redraw only
 *     when a figure actually changed.
 *   - The network is asked at most every few minutes while something stays
 *     unvalued, so offline it does not try and fail on every save.
 */

import { Injectable, effect, inject, untracked } from '@angular/core';

import { DatabaseService } from '../database/database.service';
import { RatesRepository } from '../database/repositories/rates.repository';
import { RatesService } from './rates.service';
import { convertPendingForeign } from './convert-pending';
import { rateToPesosOn } from './historical-rates';

/** Past the opening rush before anything is fetched. */
const OPENING_DELAY_MS = 4_000;
/** How long changes must stop coming before a pass runs. */
const QUIET_MS = 2_000;
/** How long something unvalued waits before the network is asked again. */
const RETRY_MS = 5 * 60_000;

@Injectable({ providedIn: 'root' })
export class ForeignConversionService {
  private readonly database = inject(DatabaseService);
  private readonly rates = inject(RatesService);

  private opened = false;
  private running = false;
  private again = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private lastNetworkTry = 0;

  constructor() {
    effect(() => {
      this.database.dataVersion();
      const ready = this.database.status() === 'ready';
      untracked(() => {
        if (!ready) return;
        if (!this.opened) {
          this.opened = true;
          setTimeout(() => void this.onOpening(), OPENING_DELAY_MS);
          return;
        }
        this.schedule();
      });
    });
  }

  /** Today's rates, then a pass. Once per launch, after the opening rush. */
  private async onOpening(): Promise<void> {
    try {
      // The dollar: the service already keeps to once a day, and does nothing
      // if today's TRM is on record.
      await this.rates.refresh();
      await this.refreshEuroToday();
    } catch {
      // Offline or refused: the stored rates stand, which is rule 1.
    }
    await this.run();
  }

  /**
   * Today's euro in pesos, once a day.
   *
   * The dollar has its own service; the euro had nothing, so a euro movement
   * saved offline had no rate at all to stand in for its day's.
   */
  private async refreshEuroToday(): Promise<void> {
    const today = todayIso();
    const rates = new RatesRepository(this.database.driver);
    if ((await rates.inForce('EUR', 'COP', today))?.on_date === today) return;

    const euro = await rateToPesosOn('EUR', today);
    if (euro) {
      await rates.set({
        on_date: today, base_code: 'EUR', quote_code: 'COP',
        rate_scaled: euro.rate_scaled, source: euro.source,
      });
    }
  }

  /** A pass once changes have stopped coming for a moment. */
  private schedule(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.run();
    }, QUIET_MS);
  }

  private async run(): Promise<void> {
    // One pass at a time; a change during it earns one more pass after.
    if (this.running) {
      this.again = true;
      return;
    }
    this.running = true;

    try {
      const mayFetch = Date.now() - this.lastNetworkTry > RETRY_MS;
      const result = await convertPendingForeign(this.database.driver, {
        fetchRate: mayFetch ? (currency, date) => rateToPesosOn(currency, date) : undefined,
      });
      if (mayFetch && (result.pending > 0 || result.onCachedRate > 0)) {
        this.lastNetworkTry = Date.now();
      }

      // Redraw only for figures that actually changed. The pass that follows
      // finds nothing to do, so this does not loop.
      if (result.converted > 0) this.database.dataChanged();
    } catch {
      // A failed pass leaves every movement as it was, and the next change
      // tries again. Nothing to tell anyone about.
    } finally {
      this.running = false;
      if (this.again) {
        this.again = false;
        this.schedule();
      }
    }
  }
}

function todayIso(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}
