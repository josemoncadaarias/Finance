/**
 * Keeps every foreign movement valued in pesos, without being asked.
 *
 * Jose did not want a rate field on the movement form, and there is no need
 * for one: the rate of the day is public for the dollar and derivable for the
 * euro, so the app can look it up itself. This runs after every change to the
 * database - a movement saved in a dollar account is valued a moment later -
 * and once when the app opens, so anything saved offline is valued the first
 * time there is a network.
 *
 * It asks the network at most every few minutes while something stays
 * pending. Offline, a pass would otherwise try and fail on every single save.
 */

import { Injectable, effect, inject, untracked } from '@angular/core';

import { DatabaseService } from '../database/database.service';
import { convertPendingForeign } from './convert-pending';
import { rateToPesosOn } from './historical-rates';

/** How long a pending movement waits before the network is asked again. */
const RETRY_MS = 5 * 60_000;

@Injectable({ providedIn: 'root' })
export class ForeignConversionService {
  private readonly database = inject(DatabaseService);

  private running = false;
  private again = false;
  private lastNetworkTry = 0;

  constructor() {
    effect(() => {
      this.database.dataVersion();
      const ready = this.database.status() === 'ready';
      untracked(() => {
        if (ready) void this.run();
      });
    });
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
      if (mayFetch && result.pending > 0) this.lastNetworkTry = Date.now();

      // New figures: every screen showing a total should redraw with them.
      // The pass that follows finds nothing to do, so this does not loop.
      if (result.converted > 0) this.database.dataChanged();
    } catch {
      // A failed pass leaves every movement as it was, still pending, and the
      // next change tries again. Nothing to tell anyone about.
    } finally {
      this.running = false;
      if (this.again) {
        this.again = false;
        void this.run();
      }
    }
  }
}
