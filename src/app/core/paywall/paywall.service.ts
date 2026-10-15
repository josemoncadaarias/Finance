/**
 * "Is this paid for?" - the one question, answered in one place (rule 21).
 *
 * Google Play is behind it through RevenueCat (Android only). While the app
 * does not charge (`CHARGING` in plan.ts) everything answers unlocked, so
 * nothing changes for anybody. "Ver la app como alguien sin Pro" on the Finance Pro
 * screen (`finance.paywall.preview`) shows the app as somebody who has not
 * paid sees it, to try the locks. When Google Play (through RevenueCat) is
 * plugged in, it changes here and nowhere else; what was last read is kept,
 * so no lock is ever felt offline. A lock stops something NEW, never what is
 * on record (rule 21, 1).
 */
import { Injectable, computed, inject, signal } from '@angular/core';
import { Capacitor } from '@capacitor/core';

import { environment } from '../../../environments/environment';
import { DatabaseService } from '../database/database.service';
import { CHARGING, PLAN, canUse, freeLeft, isUnlocked, reportSectionFree, type Feature } from './plan';

const PREVIEW_KEY = 'finance.paywall.preview';
/** The store's last answer, kept so no lock is felt offline (rule 21, 2). */
const ENTITLED_KEY = 'finance.pro.entitled';

/** A plan as the store sells it: its price in the person's currency. */
export interface StorePlan {
  price: string;
  /** The store's own package, handed back to buy it. */
  pkg: unknown;
}

export type BuyResult = 'bought' | 'cancelled' | 'failed' | 'unavailable';

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

  /** Whether the store says Finance Pro is active: bought, or in its trial. */
  readonly entitled = signal(readEntitled());

  /** Whether everything is open: paid, in the trial, or the app not charging yet. */
  readonly unlocked = computed(() => isUnlocked(this.entitled(), CHARGING, this.previewFree()));

  /** The two plans with the store's prices, once read (Android only). */
  readonly plans = signal<{ monthly: StorePlan | null; yearly: StorePlan | null } | null>(null);

  /** Whether a store is there to buy from: the app on Android with its key. */
  readonly storeAvailable = Capacitor.getPlatform() === 'android' && !!environment.revenueCatGoogleKey;

  private connecting: Promise<boolean> | null = null;

  constructor() {
    // A few seconds after opening, so nothing of it is felt at start.
    if (this.storeAvailable) setTimeout(() => void this.connect(), 4000);
  }

  /** Connects to the store once, and keeps its answer while the app runs. */
  private connect(): Promise<boolean> {
    if (!this.storeAvailable) return Promise.resolve(false);
    this.connecting ??= (async () => {
      try {
        const { Purchases } = await import('@revenuecat/purchases-capacitor');
        await Purchases.configure({ apiKey: environment.revenueCatGoogleKey });
        await Purchases.addCustomerInfoUpdateListener(info => this.heard(info));
        const { customerInfo } = await Purchases.getCustomerInfo();
        this.heard(customerInfo);
        return true;
      } catch {
        // Offline or the store not reachable: the last answer holds.
        this.connecting = null;
        return false;
      }
    })();
    return this.connecting;
  }

  /** Any active entitlement is Finance Pro: the app sells one thing. */
  private heard(info: { entitlements: { active: Record<string, unknown> } }): void {
    const on = Object.keys(info.entitlements.active).length > 0;
    this.entitled.set(on);
    try { localStorage.setItem(ENTITLED_KEY, JSON.stringify({ on, at: new Date().toISOString() })); } catch { /* kept for this opening */ }
  }

  /** The store's prices for the two plans, for the Finance Pro screen. */
  async loadPlans(): Promise<void> {
    if (!(await this.connect())) return;
    try {
      const { Purchases } = await import('@revenuecat/purchases-capacitor');
      const offerings = await Purchases.getOfferings();
      const packages = offerings.current?.availablePackages ?? [];
      const of = (type: string): StorePlan | null => {
        const found = packages.find(p => p.packageType === type);
        return found ? { price: found.product.priceString, pkg: found } : null;
      };
      this.plans.set({ monthly: of('MONTHLY'), yearly: of('ANNUAL') });
    } catch {
      this.plans.set(null);
    }
  }

  /** Buys a plan through Google Play. Nothing is charged by the app itself. */
  async buy(plan: 'monthly' | 'yearly'): Promise<BuyResult> {
    if (!(await this.connect())) return 'unavailable';
    const chosen = this.plans()?.[plan];
    if (!chosen) return 'unavailable';
    try {
      const { Purchases } = await import('@revenuecat/purchases-capacitor');
      const { customerInfo } = await Purchases.purchasePackage({ aPackage: chosen.pkg as never });
      this.heard(customerInfo);
      return 'bought';
    } catch (error) {
      return (error as { userCancelled?: boolean | null })?.userCancelled ? 'cancelled' : 'failed';
    }
  }

  /** A purchase made before (a new phone, a reinstall), brought back. */
  async restore(): Promise<boolean> {
    if (!(await this.connect())) return false;
    try {
      const { Purchases } = await import('@revenuecat/purchases-capacitor');
      const { customerInfo } = await Purchases.restorePurchases();
      this.heard(customerInfo);
      return this.entitled();
    } catch {
      return false;
    }
  }

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

function readEntitled(): boolean {
  try {
    return JSON.parse(localStorage.getItem(ENTITLED_KEY) ?? '{}').on === true;
  } catch {
    return false;
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
