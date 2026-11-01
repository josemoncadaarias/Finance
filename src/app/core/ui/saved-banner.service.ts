/**
 * The "Guardado" banner (Jose, 2026-11-01, mockups `53a`-`53f`): right after a
 * spending, an income or a transfer is saved, a banner on top of everything
 * says what was saved for 5 seconds. A tap opens it in the one form to correct
 * it; "Deshacer" deletes it, with "Recuperar" for a few seconds after; swiped
 * up or left alone, it goes and the movement stays saved.
 *
 * Callers only say what was written (`saved`); the banner reads how to say it.
 */

import { Injectable, inject, signal } from '@angular/core';

import { DatabaseService } from '../database/database.service';
import { formatMoney } from '../database/money';
import type { TransactionRow } from '../database/types';
import { deleteWithSnapshot, restoreSnapshot, type MovementSnapshot } from '../database/repositories/undo-delete';
import { I18nService } from '../i18n/i18n.service';
import { ToastService } from '../../shared/ui/toast.service';
import { ComposeService } from './compose.service';

/** How long the banner stays, in milliseconds. */
export const SAVED_BANNER_MS = 5000;

export type SavedTarget = { transactionId: number } | { transferId: number };

export interface SavedNotice {
  /** Changes on every new banner, so its bar starts again. */
  key: number;
  phase: 'saved' | 'deleted';
  side: 'expense' | 'income' | 'transfer';
  title: string;
  sub: string;
  /** The figure as said: signed for a spending or an income. */
  amount: string;
  target: SavedTarget;
  snapshot?: MovementSnapshot;
}

@Injectable({ providedIn: 'root' })
export class SavedBannerService {
  private readonly database = inject(DatabaseService);
  private readonly i18n = inject(I18nService);
  private readonly toast = inject(ToastService);
  private readonly compose = inject(ComposeService);

  readonly notice = signal<SavedNotice | null>(null);
  private keys = 0;
  private busy = false;

  /** Says what was just saved. Never fails a save: a banner it cannot read is not shown. */
  async saved(target: SavedTarget): Promise<void> {
    try {
      const said = 'transferId' in target ? await this.readTransfer(target.transferId) : await this.readMovement(target.transactionId);
      if (!said) return;
      // The quiet toast of the same save would only repeat it.
      this.toast.dismiss();
      this.notice.set({ ...said, key: ++this.keys, phase: 'saved', target });
    } catch {
      /* the movement is saved; the banner is only a courtesy */
    }
  }

  /** Its bar ran out, or it was swiped away. */
  close(key?: number): void {
    const now = this.notice();
    if (now && (key === undefined || now.key === key)) this.notice.set(null);
  }

  /** A tap: that movement in the one form. */
  async edit(): Promise<void> {
    const now = this.notice();
    if (!now || now.phase !== 'saved') return;
    this.notice.set(null);
    const db = this.database.driver;
    const row = 'transferId' in now.target
      ? await db.queryOne<TransactionRow>("SELECT * FROM transactions WHERE transfer_id = ? ORDER BY transfer_leg = 'from' DESC LIMIT 1", [now.target.transferId])
      : await db.queryOne<TransactionRow>('SELECT * FROM transactions WHERE id = ?', [now.target.transactionId]);
    if (!row) return;
    // With "Registrar otro" the form is still open: it closes first, so the
    // movement opens in a form of its own.
    if (this.compose.entry()) {
      this.compose.close();
      setTimeout(() => this.compose.edit(row), 350);
    } else {
      this.compose.edit(row);
    }
  }

  /** "Deshacer": deleted as the form deletes it, kept to be put back. */
  async undo(): Promise<void> {
    const now = this.notice();
    if (!now || now.phase !== 'saved' || this.busy) return;
    this.busy = true;
    try {
      const snapshot = await deleteWithSnapshot(this.database.driver, now.target);
      this.database.dataChanged();
      this.notice.set({ ...now, key: ++this.keys, phase: 'deleted', snapshot });
    } catch (error) {
      this.notice.set(null);
      this.toast.say(error instanceof Error ? error.message : String(error), 5000, { icon: 'alert-circle-outline' });
    } finally {
      this.busy = false;
    }
  }

  /** "Recuperar": back exactly as it was. */
  async recover(): Promise<void> {
    const now = this.notice();
    if (!now || now.phase !== 'deleted' || !now.snapshot || this.busy) return;
    this.busy = true;
    try {
      await restoreSnapshot(this.database.driver, now.snapshot);
      this.database.dataChanged();
      this.notice.set(null);
      this.toast.say(this.i18n.t('saved.back'), 2500);
    } catch (error) {
      this.notice.set(null);
      this.toast.say(error instanceof Error ? error.message : String(error), 5000, { icon: 'alert-circle-outline' });
    } finally {
      this.busy = false;
    }
  }

  private async readMovement(id: number): Promise<Omit<SavedNotice, 'key' | 'phase' | 'target'> | null> {
    const row = await this.database.driver.queryOne<{ amount_minor: number; description: string | null; occurred_on: string; account: string; currency: string; category: string | null }>(
      `SELECT t.amount_minor, t.description, t.occurred_on, a.name AS account, a.currency_code AS currency, c.name AS category
       FROM transactions t JOIN accounts a ON a.id = t.account_id LEFT JOIN categories c ON c.id = t.category_id
       WHERE t.id = ?`, [id]);
    if (!row) return null;
    const side = row.amount_minor < 0 ? 'expense' : 'income';
    const note = row.description?.trim() || '';
    const title = note || row.category || row.account;
    const sub = [note ? row.category : null, row.account, this.day(row.occurred_on)].filter(Boolean).join(' · ');
    const figure = formatMoney(Math.abs(row.amount_minor), row.currency);
    return { side, title, sub, amount: (side === 'expense' ? '−' : '+') + figure };
  }

  private async readTransfer(id: number): Promise<Omit<SavedNotice, 'key' | 'phase' | 'target'> | null> {
    const db = this.database.driver;
    const transfer = await db.queryOne<{ occurred_on: string; description: string | null }>('SELECT occurred_on, description FROM transfers WHERE id = ?', [id]);
    if (!transfer) return null;
    // An end that changed a product only has no leg: its account is the product's.
    const ends = await db.query<{ leg: string; account: string; currency: string; amount_minor: number }>(
      `SELECT t.transfer_leg AS leg, a.name AS account, a.currency_code AS currency, t.amount_minor
       FROM transactions t JOIN accounts a ON a.id = t.account_id WHERE t.transfer_id = ?
       UNION ALL
       SELECT e.transfer_leg AS leg, a.name AS account, a.currency_code AS currency, e.amount_minor
       FROM product_entries e JOIN products p ON p.id = e.product_id JOIN accounts a ON a.id = p.account_id
       WHERE e.transfer_id = ?`, [id, id]);
    const from = ends.find(e => e.leg === 'from');
    const to = ends.find(e => e.leg === 'to');
    if (!from && !to) return null;
    const leaving = from ?? to!;
    const title = `${from?.account ?? '…'} → ${to?.account ?? '…'}`;
    const sub = [transfer.description?.trim() || null, this.day(transfer.occurred_on)].filter(Boolean).join(' · ');
    return { side: 'transfer', title, sub, amount: formatMoney(Math.abs(leaving.amount_minor), leaving.currency) };
  }

  /** "hoy", "ayer", or the day in words. */
  private day(iso: string): string {
    const today = new Date();
    const at = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (iso === at(today)) return this.i18n.t('ui.today');
    const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
    if (iso === at(yesterday)) return this.i18n.t('saved.yesterday');
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(this.i18n.dateLocale(), { day: 'numeric', month: 'short' });
  }
}
