/**
 * "Is this paid for?" - the one question, answered in one place (rule 21).
 *
 * Today there is no store behind it: everything answers unlocked, so nothing
 * changes for anybody. "Ver la app como alguien sin Pro" on the Finance Pro
 * screen (`finance.paywall.preview`) shows the app as somebody who has not
 * paid sees it, to try the locks. When Google Play (through RevenueCat) is
 * plugged in, it changes here and nowhere else; what was last read is kept,
 * so no lock is ever felt offline. A lock stops something NEW, never what is
 * on record (rule 21, 1).
 */
import { Injectable, computed, inject, signal } from '@angular/core';

import { DatabaseService } from '../database/database.service';
import { PLAN, canUse, freeLeft, reportSectionFree, type Feature } from './plan';

const PREVIEW_KEY = 'finance.paywall.preview';

/** How each feature is drawn on the sheet a lock opens. */
export const FEATURE_FACE: Record<Feature, { icon: string; color: string }> = {
  currencies: { icon: 'globe-outline', color: '#a3d65c' },
  statements: { icon: 'document-text-outline', color: '#9b7bff' },
  products: { icon: 'trending-up-outline', color: '#2ec4b6' },
  noticeSources: { icon: 'notifications-outline', color: '#f6b93b' },
  noticeMovements: { icon: 'notifications-outline', color: '#f6b93b' },
  loans: { icon: 'receipt-outline', color: '#ff9152' },
  limits: { icon: 'speedometer-outline', color: '#ff9152' },
  goals: { icon: 'flag-outline', color: '#34c98b' },
  reportFull: { icon: 'stats-chart-outline', color: '#6378ff' },
  reportExport: { icon: 'download-outline', color: '#6378ff' },
  tax: { icon: 'calculator-outline', color: '#ff9152' },
  newCategories: { icon: 'pricetags-outline', color: '#d07bf0' },
  ownImages: { icon: 'image-outline', color: '#d07bf0' },
};

@Injectable({ providedIn: 'root' })
export class PaywallService {
  private readonly database = inject(DatabaseService);

  /** Set while the free version is being looked at. */
  readonly previewFree = signal(readPreview());

  /** Whether everything is open: paid, in the trial, or no store yet. */
  readonly unlocked = computed(() => !this.previewFree());

  /** The feature whose sheet is open (`app-pro-sheet`, in the shell). */
  readonly asking = signal<Feature | null>(null);

  can(feature: Feature, used = 0): boolean {
    return canUse(feature, used, this.unlocked());
  }

  left(feature: Feature, used: number): number {
    return this.unlocked() ? Infinity : freeLeft(feature, used);
  }

  sectionOpen(id: string): boolean {
    return this.unlocked() || reportSectionFree(id);
  }

  /**
   * Whether one more may be used now. When not, the sheet saying why opens
   * and the answer is no. `used` is counted here unless the caller knows it.
   */
  async allow(feature: Feature, used?: number): Promise<boolean> {
    if (this.unlocked()) return true;
    const count = used ?? await this.used(feature);
    if (canUse(feature, count, false)) return true;
    this.asking.set(feature);
    return false;
  }

  /** Opens the sheet for a feature that is simply paid. */
  ask(feature: Feature): void {
    this.asking.set(feature);
  }

  /** How many of a feature are in use, as the free allowance counts them. */
  async used(feature: Feature): Promise<number> {
    if (PLAN[feature].free === 0 || this.database.status() !== 'ready') return 0;
    const db = this.database.driver;
    const count = async (sql: string, args: unknown[] = []) =>
      (await db.queryOne<{ n: number }>(sql, args))?.n ?? 0;
    switch (feature) {
      case 'statements':
        return count("SELECT COUNT(DISTINCT batch) AS n FROM movement_proposals WHERE source = 'statement'");
      case 'products': return count('SELECT COUNT(*) AS n FROM products');
      case 'loans': return count('SELECT COUNT(*) AS n FROM loans');
      case 'limits': return count('SELECT COUNT(*) AS n FROM spending_limits');
      case 'goals': return count('SELECT COUNT(*) AS n FROM goals WHERE archived = 0');
      case 'noticeMovements': return this.messagesThisMonth();
      default: return 0;
    }
  }

  /** Movements saved from bank messages since the 1st of this month. */
  async messagesThisMonth(): Promise<number> {
    if (this.database.status() !== 'ready') return 0;
    const now = new Date();
    const first = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const row = await this.database.driver.queryOne<{ n: number }>(
      "SELECT COUNT(*) AS n FROM movement_proposals WHERE source = 'notification' AND status = 'accepted' AND updated_at >= ?",
      [first]);
    return row?.n ?? 0;
  }

  setPreviewFree(on: boolean): void {
    this.previewFree.set(on);
    try {
      if (on) localStorage.setItem(PREVIEW_KEY, 'free');
      else localStorage.removeItem(PREVIEW_KEY);
    } catch { /* storage blocked: the switch holds for this opening only */ }
  }
}

function readPreview(): boolean {
  try {
    return localStorage.getItem(PREVIEW_KEY) === 'free';
  } catch {
    return false;
  }
}

/** A route behind Pro: not entered while locked, and the sheet says why. */
export function proGuard(feature: Feature) {
  return () => inject(PaywallService).allow(feature);
}
