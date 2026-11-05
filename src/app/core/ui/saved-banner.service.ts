/**
 * The "Guardado" banner (Jose, 2026-11-01, mockups `53a`-`53f`): right after a
 * spending, an income or a transfer is saved, a banner on top of everything
 * says what was saved for 5 seconds. A tap opens it in the one form to correct
 * it; "Deshacer" removes it and closes the banner, with no second notice; swiped
 * up or left alone, it goes and the movement stays saved.
 *
 * Callers only say what was written (`saved`); the banner reads how to say it.
 */

import { Injectable, inject, signal } from '@angular/core';

import { DatabaseService } from '../database/database.service';
import { formatMoney } from '../database/money';
import type { TransactionRow } from '../database/types';
import { deleteWithSnapshot, type MovementTarget } from '../database/repositories/undo-delete';
import type { ProductEntry } from '../database/repositories/yields.repository';
import { noteError } from '../feedback/error-log';
import { I18nService } from '../i18n/i18n.service';
import type { TranslationKey } from '../i18n/translations';
import { ToastService } from '../../shared/ui/toast.service';
import { ComposeService } from './compose.service';

/** How long the banner stays, in milliseconds. */
export const SAVED_BANNER_MS = 5000;

export type SavedTarget = MovementTarget;

export interface SavedNotice {
  /** Changes on every new banner, so its bar starts again. */
  key: number;
  phase: 'saved';
  /**
   * A new movement can be undone; a correction or a loan's payment is only
   * said (Jose, 2026-11-05: every save shows its banner, to confirm it).
   */
  mode: SavedMode;
  side: 'expense' | 'income' | 'transfer';
  title: string;
  sub: string;
  /** The figure as said: signed for a spending or an income. */
  amount: string;
  /** What was saved: one, or several saved at once ("Guardar los listos"). */
  targets: SavedTarget[];
}

export type SavedMode = 'new' | 'edited' | 'payment';

export type Said = Omit<SavedNotice, 'key' | 'phase' | 'targets' | 'mode'>;

@Injectable({ providedIn: 'root' })
export class SavedBannerService {
  private readonly database = inject(DatabaseService);
  private readonly i18n = inject(I18nService);
  private readonly toast = inject(ToastService);
  private readonly compose = inject(ComposeService);

  readonly notice = signal<SavedNotice | null>(null);
  private keys = 0;
  private busy = false;

  /**
   * Says what was just saved. Never fails a save: a banner it cannot read is
   * not shown, and why goes to the errors "Reportar un fallo" can carry.
   */
  async saved(what: SavedTarget | readonly SavedTarget[] | null, mode: SavedMode = 'new', fallback: Said | null = null): Promise<void> {
    const all = what === null ? [] : Array.isArray(what) ? what : [what as SavedTarget];
    let targets = all.filter(t => t.transactionId !== undefined || t.transferId !== undefined || t.entryId !== undefined);
    try {
      let said = targets.length === 0 ? null
        : targets.length === 1 ? await this.readOne(targets[0]) : await this.readMany(targets);
      // A save whose rows could not be pointed at (a correction written in
      // a new shape, a loan's payment) still says what the form saved.
      if (!said) { said = fallback; targets = []; }
      if (!said) return;
      // Only a new movement is undone from the banner.
      const kept: SavedMode = mode === 'new' && targets.length === 0 ? 'edited' : mode;
      // The quiet toast of the same save would only repeat it.
      this.toast.dismiss();
      this.notice.set({ ...said, key: ++this.keys, phase: 'saved', mode: kept, targets });
    } catch (error) {
      noteError(error);
    }
  }

  /** Its bar ran out, or it was swiped away. */
  close(key?: number): void {
    const now = this.notice();
    if (now && (key === undefined || now.key === key)) this.notice.set(null);
  }

  /** A tap: that movement in the one form. Several saved at once only close. */
  async edit(): Promise<void> {
    const now = this.notice();
    if (!now || now.phase !== 'saved') return;
    this.notice.set(null);
    if (now.targets.length !== 1) return;
    const target = now.targets[0];
    const db = this.database.driver;
    let open: () => void;
    if (target.entryId !== undefined) {
      const entry = await db.queryOne<ProductEntry>('SELECT * FROM product_entries WHERE id = ?', [target.entryId]);
      if (!entry) return;
      open = () => this.compose.entry.set({ kind: entry.amount_minor < 0 ? 'expense' : 'income', editingEntry: entry });
    } else {
      const row = target.transferId !== undefined
        ? await db.queryOne<TransactionRow>("SELECT * FROM transactions WHERE transfer_id = ? ORDER BY transfer_leg = 'from' DESC LIMIT 1", [target.transferId])
        : await db.queryOne<TransactionRow>('SELECT * FROM transactions WHERE id = ?', [target.transactionId]);
      if (!row) return;
      open = () => this.compose.edit(row);
    }
    // With "Registrar otro" the form is still open: it closes first, so the
    // movement opens in a form of its own.
    if (this.compose.entry()) {
      this.compose.close();
      setTimeout(open, 350);
    } else {
      open();
    }
  }

  /** "Deshacer": removed as the form removes it, and the banner closes. */
  async undo(): Promise<void> {
    const now = this.notice();
    if (!now || now.phase !== 'saved' || now.mode !== 'new' || this.busy) return;
    this.busy = true;
    try {
      // Undoing is the decision itself: the movement goes and the banner with
      // it, with no second notice (Jose, 2026-11-01).
      for (const target of now.targets) await deleteWithSnapshot(this.database.driver, target);
      this.database.dataChanged();
      this.notice.set(null);
    } catch (error) {
      noteError(error);
      this.notice.set(null);
      this.toast.say(error instanceof Error ? error.message : String(error), 5000, { icon: 'alert-circle-outline' });
    } finally {
      this.busy = false;
    }
  }

  private readOne(target: SavedTarget): Promise<Said | null> {
    if (target.entryId !== undefined) return this.readEntry(target.entryId);
    if (target.transferId !== undefined) return this.readTransfer(target.transferId);
    return this.readMovement(target.transactionId!);
  }

  /** Several at once: how many, the first names, and the total when they are alike. */
  private async readMany(targets: readonly SavedTarget[]): Promise<Said | null> {
    const each = (await Promise.all(targets.map(t => this.readOne(t)))).filter((x): x is Said => x !== null);
    if (each.length === 0) return null;
    const names = each.slice(0, 2).map(x => x.title);
    const sub = each.length > 2
      ? this.i18n.t('saved.manyNames', { names: names.join(', '), more: each.length - 2 })
      : names.join(' · ');
    const sides = new Set(each.map(x => x.side));
    const side = sides.size === 1 ? each[0].side : 'transfer';
    return { side, title: this.i18n.t('saved.manyTitle', { count: each.length }), sub, amount: '' };
  }

  private async readEntry(id: number): Promise<Said | null> {
    const row = await this.database.driver.queryOne<{ amount_minor: number; note: string | null; on_date: string; product: string | null; account: string; currency: string; category: string | null }>(
      `SELECT e.amount_minor, e.note, e.on_date, p.name AS product, a.name AS account, a.currency_code AS currency, c.name AS category
       FROM product_entries e JOIN accounts a ON a.id = e.account_id
       LEFT JOIN products p ON p.id = e.product_id LEFT JOIN categories c ON c.id = e.category_id
       WHERE e.id = ?`, [id]);
    if (!row) return null;
    const side = row.amount_minor < 0 ? 'expense' : 'income';
    const note = row.note?.trim() || '';
    const title = note || row.category || row.product || row.account;
    const where = row.product ? `${row.account} · ${row.product}` : row.account;
    const sub = [note ? row.category : null, where, this.day(row.on_date)].filter(Boolean).join(' · ');
    const figure = formatMoney(Math.abs(row.amount_minor), row.currency);
    return { side, title, sub, amount: (side === 'expense' ? '−' : '+') + figure };
  }

  private async readMovement(id: number): Promise<Said | null> {
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

  private async readTransfer(id: number): Promise<Said | null> {
    const db = this.database.driver;
    const transfer = await db.queryOne<{ occurred_on: string; description: string | null }>('SELECT occurred_on, description FROM transfers WHERE id = ?', [id]);
    if (!transfer) return null;
    // An end that changed a product only has no leg: its account is the
    // product's. A leg naming no product is in the usual one, when the
    // account has products at all.
    const usual = `(SELECT name FROM products WHERE account_id = a.id AND is_default = 1 LIMIT 1)`;
    const ends = await db.query<{ leg: string; account_id: number; account: string; product: string | null; currency: string; amount_minor: number }>(
      `SELECT t.transfer_leg AS leg, a.id AS account_id, a.name AS account,
              COALESCE((SELECT name FROM products WHERE id = t.product_id), ${usual}) AS product,
              a.currency_code AS currency, t.amount_minor
       FROM transactions t JOIN accounts a ON a.id = t.account_id WHERE t.transfer_id = ?
       UNION ALL
       SELECT e.transfer_leg AS leg, a.id AS account_id, a.name AS account, p.name AS product,
              a.currency_code AS currency, e.amount_minor
       FROM product_entries e JOIN products p ON p.id = e.product_id JOIN accounts a ON a.id = p.account_id
       WHERE e.transfer_id = ?`, [id, id]);
    const from = ends.find(e => e.leg === 'from');
    const to = ends.find(e => e.leg === 'to');
    if (!from && !to) return null;
    const leaving = from ?? to!;
    // "Rappi cuenta → Plata" said nothing (Jose, 2026-11-05): the banner
    // says where it went from and to, and the products.
    const t = (key: TranslationKey, params: Record<string, string>) => this.i18n.t(key, params);
    let title: string;
    let products: string | null = null;
    if (from && to && from.account_id === to.account_id) {
      title = t('saved.between.title', { account: from.account });
      if (from.product && to.product) products = t('saved.between.products', { from: from.product, to: to.product });
    } else {
      title = t('saved.fromTo', { from: from?.account ?? '…', to: to?.account ?? '…' });
      if (from?.product && to?.product) products = t('saved.fromTo.both', { from: from.product, to: to.product });
      else if (from?.product) products = t('saved.fromTo.from', { from: from.product });
      else if (to?.product) products = t('saved.fromTo.to', { to: to.product });
    }
    const sub = [products, transfer.description?.trim() || null, this.day(transfer.occurred_on)].filter(Boolean).join(' · ');
    return { side: 'transfer', title, sub, amount: formatMoney(Math.abs(leaving.amount_minor), leaving.currency) };
  }

  /** "hoy", "ayer", or the day in words. */
  day(iso: string): string {
    const today = new Date();
    const at = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (iso === at(today)) return this.i18n.t('ui.today');
    const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
    if (iso === at(yesterday)) return this.i18n.t('saved.yesterday');
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(this.i18n.dateLocale(), { day: 'numeric', month: 'short' });
  }
}
