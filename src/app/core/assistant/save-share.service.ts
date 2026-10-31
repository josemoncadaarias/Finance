/**
 * "Cuánto ahorrar cada mes" (Jose, 2026-10-31, mockups `51f`, `51g`): the
 * share of what comes in that "Puedes gastar hoy" sets aside for the goals
 * before working out what can be spent. 20 % by default (the saving of the
 * 50/30/20 rule). Kept in `settings` (`budget.savePct`), so it travels in the
 * backup.
 */

import { Injectable, effect, inject, signal, untracked } from '@angular/core';

import { DatabaseService } from '../database/database.service';
import { SAVE_PCT_DEFAULT, savePctOf } from './spend-room';

const KEY = 'budget.savePct';

@Injectable({ providedIn: 'root' })
export class SaveShareService {
  private readonly database = inject(DatabaseService);
  readonly pct = signal(SAVE_PCT_DEFAULT);
  private loaded = -1;

  constructor() {
    // Read again after a restore or an erase, which change every setting.
    effect(() => {
      const version = this.database.dataVersion();
      if (this.database.status() !== 'ready' || version === this.loaded) return;
      this.loaded = version;
      void untracked(() => this.load());
    });
  }

  async load(): Promise<number> {
    const row = await this.database.driver.queryOne<{ value: string }>('SELECT value FROM settings WHERE key = ?', [KEY]);
    const pct = savePctOf(row?.value);
    if (pct !== this.pct()) this.pct.set(pct);
    return pct;
  }

  async set(pct: number): Promise<void> {
    const value = savePctOf(String(pct));
    this.pct.set(value);
    await this.database.driver.run(
      `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      [KEY, String(value), new Date().toISOString()]);
  }
}
