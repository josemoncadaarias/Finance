/**
 * The months of inflation the app knows, and a quiet attempt to learn more.
 *
 * Offline-first like the TRM (rule 1): the app ships with every month up to
 * the day it was built, reads them from its own database, and on the phone
 * asks the Banco de la Republica for newer ones at most once a day, never
 * waiting for the answer. A month typed by the person is never overwritten.
 */

import { inject, Injectable } from '@angular/core';
import { Capacitor, CapacitorHttp } from '@capacitor/core';

import { DatabaseService } from '../database/database.service';
import { todayIso } from '../yields/days';
import type { InflationMonth } from './inflation';
import { IPC_REFERER, IPC_URL, parseIpc } from './ipc-client';

const TRIED_KEY = 'finance.inflationTried';

@Injectable({ providedIn: 'root' })
export class InflationService {
  private readonly database = inject(DatabaseService);

  async months(): Promise<InflationMonth[]> {
    return this.database.driver.query<InflationMonth>(
      'SELECT month, index_scaled FROM inflation_months ORDER BY month');
  }

  /** Asks for newer months if one may have been published. Never throws. */
  async refreshIfDue(known: readonly InflationMonth[]): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    const today = todayIso();
    const last = known.at(-1)?.month ?? '';
    // The DANE publishes a month early in the next one: nothing newer can
    // exist while the last on record is the month before this one.
    const previous = new Date(Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 2, 1))
      .toISOString().slice(0, 7);
    if (last >= previous) return;
    try {
      if (localStorage.getItem(TRIED_KEY) === today) return;
      localStorage.setItem(TRIED_KEY, today);
    } catch { /* no storage: ask anyway */ }

    try {
      const response = await CapacitorHttp.get({
        url: IPC_URL, headers: { Referer: IPC_REFERER }, connectTimeout: 8000, readTimeout: 15000,
      });
      if (response.status !== 200) return;
      const payload = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
      const fresh = parseIpc(payload).filter(one => one.month > last);
      const now = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
      for (const one of fresh) {
        await this.database.driver.run(
          `INSERT INTO inflation_months (month, index_scaled, source, fetched_at)
           VALUES (?, ?, 'dane', ?)
           ON CONFLICT (month) DO UPDATE SET index_scaled = excluded.index_scaled, fetched_at = excluded.fetched_at
           WHERE inflation_months.source = 'dane'`,
          [one.month, one.index_scaled, now]);
      }
    } catch {
      // Offline, refused, or an answer that could not be trusted: the months
      // on record stay, and the newer ones are estimated on the screen.
    }
  }
}
