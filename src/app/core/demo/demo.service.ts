/**
 * The sample data a new user can explore, and erasing everything on the
 * phone (Jose, 2026-10-09; mockups `21a`-`21f`).
 *
 * - **Offered only on an empty app** (`empty`): no account at all. Anybody
 *   with data of their own never sees it, so the sample can never be mixed
 *   with real figures.
 * - **While it is loaded** (`active`, kept in `settings` as `demo.loaded`)
 *   the copy in Drive is not written (`CloudBackupService.save`) and the
 *   bank's messages are not proposed (`NoticeInboxService`): invented money
 *   must never replace a real copy, nor real messages land among invented
 *   accounts.
 * - **Erasing** leaves the database as a fresh install has it and forgets
 *   which Drive copy this device continues, so the next copy asks before it
 *   replaces the one up there instead of sending an empty database over it.
 */

import { Injectable, effect, inject, signal, untracked } from '@angular/core';

import { DatabaseService } from '../database/database.service';
import { rememberSeen } from '../cloud/cloud-backup.service';
import { BankNotifications } from '../notifications/bank-notifications';
import { todayIso } from '../yields/days';

const FLAG = 'demo.loaded';

/** What erasing everything would take away, said before it is done. */
export interface WhatWouldGo {
  accounts: number;
  cards: number;
  loans: number;
  movements: number;
  since: string | null;
  yieldDays: number;
  products: number;
  limits: number;
  goals: number;
}

@Injectable({ providedIn: 'root' })
export class DemoService {
  private readonly database = inject(DatabaseService);

  /** The sample data is what the app holds. */
  readonly active = signal(false);
  /** No account at all: a fresh install, or one just erased. Null until read. */
  readonly empty = signal<boolean | null>(null);

  constructor() {
    effect(() => {
      this.database.dataVersion();
      if (this.database.status() !== 'ready') return;
      untracked(() => void this.read());
    });
  }

  private async read(): Promise<void> {
    try {
      const db = this.database.driver;
      const flag = await db.queryOne<{ value: string }>('SELECT value FROM settings WHERE key = ?', [FLAG]);
      const accounts = await db.queryOne<{ n: number }>('SELECT COUNT(*) AS n FROM accounts');
      this.active.set(flag?.value === '1');
      this.empty.set((accounts?.n ?? 0) === 0);
    } catch {
      // Read again on the next change.
    }
  }

  /**
   * Builds the sample data for today. One transaction: on the phone every
   * statement crosses into the native side, and in the browser every one
   * would write the whole database out again - inside a transaction both
   * happen once, at the end. Refused unless the app is empty.
   */
  async load(onProgress: (fraction: number) => void): Promise<void> {
    const db = this.database.driver;
    const accounts = await db.queryOne<{ n: number }>('SELECT COUNT(*) AS n FROM accounts');
    if ((accounts?.n ?? 0) > 0) throw new Error('The app already holds accounts of its own.');
    // Loaded only when asked for: nobody with data of their own carries it.
    const { buildShowcase } = await import('./showcase');
    await db.transaction(async () => {
      await buildShowcase(db, todayIso(), async fraction => {
        onProgress(fraction);
        // Hands the screen the thread back long enough to draw the bar.
        await new Promise(resolve => setTimeout(resolve, 0));
      });
      await db.run(
        'INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)',
        [FLAG, '1', new Date().toISOString()]);
    });
    this.database.dataChanged();
  }

  /**
   * Everything on this phone gone. `messages` also forgets the bank messages
   * the phone kept until now, so they do not all come back as proposals into
   * an empty app; erasing only the sample keeps them.
   */
  async eraseAll(options: { messages: boolean }): Promise<void> {
    await this.database.eraseAll();
    // This install no longer continues the copy it wrote to Drive.
    rememberSeen('');
    if (options.messages) await BankNotifications.forgetCaught().catch(() => undefined);
    this.active.set(false);
    this.empty.set(true);
  }

  /** The counts "Borrar todos los datos" shows before anything goes. */
  async whatWouldGo(): Promise<WhatWouldGo> {
    const db = this.database.driver;
    const one = async (sql: string) => (await db.queryOne<{ n: number }>(sql))?.n ?? 0;
    const since = await db.queryOne<{ first: string | null }>('SELECT MIN(occurred_on) AS first FROM transactions');
    return {
      accounts: await one('SELECT COUNT(*) AS n FROM accounts'),
      cards: await one("SELECT COUNT(*) AS n FROM accounts WHERE type = 'credit'"),
      loans: await one('SELECT COUNT(*) AS n FROM loans'),
      movements: await one('SELECT COUNT(*) AS n FROM transactions'),
      since: since?.first ?? null,
      yieldDays: await one('SELECT COUNT(DISTINCT on_date) AS n FROM yield_days'),
      products: await one('SELECT COUNT(*) AS n FROM products'),
      limits: await one('SELECT COUNT(*) AS n FROM spending_limits'),
      goals: await one('SELECT COUNT(*) AS n FROM goals'),
    };
  }
}
