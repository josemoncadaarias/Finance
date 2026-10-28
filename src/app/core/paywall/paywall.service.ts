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
import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { Capacitor } from '@capacitor/core';

import { environment } from '../../../environments/environment';
import { DatabaseService } from '../database/database.service';
import { GoogleAccountService } from '../cloud/google-account.service';
import { isAnonymous, proIdOf } from './pro-id';
import { CHARGING, PLAN, canUse, freeLeft, isUnlocked, reportSectionFree, type Feature } from './plan';
import { changeModeFor, lapsedOn, subscriptionOf, trialDaysOf, type EntitlementLike, type ProPlan, type Subscription } from './subscription';

const PREVIEW_KEY = 'finance.paywall.preview';
/** The assistant's questions this month (`{ month, n }`). */
const QUESTIONS_KEY = 'assistant.questions';
/** The store's last answer, kept so no lock is felt offline (rule 21, 2). */
const ENTITLED_KEY = 'finance.pro.entitled';

/** A plan as the store sells it: its price in the person's currency. */
export interface StorePlan {
  price: string;
  /** Days of free trial Google still offers this person on it, or null. */
  trialDays: number | null;
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
  assistant: { icon: 'sparkles-outline', color: '#6378ff' },
};

@Injectable({ providedIn: 'root' })
export class PaywallService {
  private readonly database = inject(DatabaseService);
  private readonly google = inject(GoogleAccountService);

  /** Set while the free version is being looked at. */
  readonly previewFree = signal(readPreview());

  /** Whether the store says Finance Pro is active: bought, or in its trial. */
  readonly entitled = signal(readEntitled().on === true);

  /** What is paid for, when it is: the plan, the trial, until when (34i-34l). */
  readonly subscription = signal<Subscription | null>(readEntitled().sub ?? null);

  /** Ever bought Finance Pro, so no free trial is promised again (34o). */
  readonly everPaid = signal(readEntitled().everPaid === true);

  /** When a Finance Pro no longer active ran out (34p). */
  readonly lapsed = signal<string | null>(readEntitled().lapsed ?? null);

  /** Whether everything is open: paid, in the trial, or the app not charging yet. */
  readonly unlocked = computed(() => isUnlocked(this.entitled(), CHARGING, this.previewFree()));

  /** The two plans with the store's prices, once read (Android only). */
  readonly plans = signal<{ monthly: StorePlan | null; yearly: StorePlan | null } | null>(null);

  /** Whether a store is there to buy from: the app on Android with its key. */
  readonly storeAvailable = Capacitor.getPlatform() === 'android' && !!environment.revenueCatGoogleKey;

  private connecting: Promise<boolean> | null = null;

  /**
   * The id this person carries in the store, made from their Google account
   * (`proIdOf`): the same on every phone and every install, so a Finance Pro
   * given from RevenueCat's dashboard to it never runs out (Jose,
   * 2026-10-28). Null until the store answers; the store's anonymous id
   * while no Google account is signed in.
   */
  readonly proCode = signal<string | null>(readEntitled().code ?? null);

  constructor() {
    // A few seconds after opening, so nothing of it is felt at start.
    if (this.storeAvailable) setTimeout(() => void this.connect(), 4000);
    // Signed in to Google, or into another account: the store follows it.
    effect(() => {
      const email = this.google.user()?.email ?? '';
      if (!email || !this.storeAvailable) return;
      void untracked(() => this.follow(email));
    });
  }

  /** Logs the store into the id of this Google account, keeping what was bought before. */
  private async follow(email: string): Promise<void> {
    const id = await proIdOf(email);
    if (!id || !(await this.connect())) return;
    try {
      const { Purchases } = await import('@revenuecat/purchases-capacitor');
      const { appUserID } = await Purchases.getAppUserID();
      if (appUserID === id) return;
      // A purchase made under the anonymous id moves to this one (RevenueCat's own rule).
      const { customerInfo } = await Purchases.logIn({ appUserID: id });
      this.heard(customerInfo);
      this.proCode.set(id);
      this.keep();
    } catch { /* offline: tried again on the next opening */ }
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
        try { this.proCode.set((await Purchases.getAppUserID()).appUserID); this.keep(); } catch { /* shown once it answers */ }
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
  private heard(info: {
    entitlements: { active: Record<string, unknown>; all?: Record<string, unknown> };
    managementURL?: string | null; allPurchasedProductIdentifiers?: string[];
  }): void {
    const active = info.entitlements.active as Record<string, EntitlementLike>;
    const all = (info.entitlements.all ?? {}) as Record<string, EntitlementLike>;
    const sub = subscriptionOf(active, info.managementURL ?? null);
    const on = sub !== null;
    const everPaid = Object.keys(all).length > 0 || (info.allPurchasedProductIdentifiers?.length ?? 0) > 0;
    const lapsed = lapsedOn(all, active);
    this.entitled.set(on);
    this.subscription.set(sub);
    this.everPaid.set(everPaid);
    this.lapsed.set(lapsed);
    this.keep();
  }

  /** The store's last answer, kept on the device so it holds offline. */
  private keep(): void {
    try {
      localStorage.setItem(ENTITLED_KEY, JSON.stringify({
        on: this.entitled(), sub: this.subscription(), everPaid: this.everPaid(), lapsed: this.lapsed(),
        code: this.proCode(), at: new Date().toISOString(),
      }));
    } catch { /* kept for this opening */ }
  }

  /** Whether the code is tied to a Google account, so it follows the person to another phone. */
  readonly codeFollows = computed(() => !isAnonymous(this.proCode()));

  /** The store's prices for the two plans, for the Finance Pro screen. */
  async loadPlans(): Promise<void> {
    if (!(await this.connect())) return;
    try {
      const { Purchases } = await import('@revenuecat/purchases-capacitor');
      // Read again: a plan changed or cancelled in Google Play shows at once.
      try { this.heard((await Purchases.getCustomerInfo()).customerInfo); } catch { /* the last answer holds */ }
      const offerings = await Purchases.getOfferings();
      const packages = offerings.current?.availablePackages ?? [];
      const of = (type: string): StorePlan | null => {
        const found = packages.find(p => p.packageType === type);
        // Google offers the trial's phase only to whom it still applies.
        return found ? { price: found.product.priceString, trialDays: trialDaysOf(found.product.defaultOption?.freePhase), pkg: found } : null;
      };
      this.plans.set({ monthly: of('MONTHLY'), yearly: of('ANNUAL') });
    } catch {
      this.plans.set(null);
    }
  }

  /**
   * Buys a plan through Google Play. Nothing is charged by the app itself.
   * With a plan already paid it is a change of plan: to the year at once,
   * crediting what is left of the month; to the month when the year is over.
   */
  async buy(plan: ProPlan): Promise<BuyResult> {
    if (!(await this.connect())) return 'unavailable';
    const chosen = this.plans()?.[plan];
    if (!chosen) return 'unavailable';
    const current = this.subscription();
    const change = current && current.plan !== plan
      ? { oldProductIdentifier: current.productId, replacementMode: changeModeFor(plan) }
      : null;
    try {
      const { Purchases } = await import('@revenuecat/purchases-capacitor');
      const { customerInfo } = await Purchases.purchasePackage({ aPackage: chosen.pkg as never, storeProductChangeInfo: change as never });
      this.heard(customerInfo);
      return 'bought';
    } catch (error) {
      return (error as { userCancelled?: boolean | null })?.userCancelled ? 'cancelled' : 'failed';
    }
  }

  /** Google Play's page for this subscription: cancel, the card, payments, or reactivate. */
  manage(): void {
    const sub = this.subscription();
    const url = sub?.manageUrl
      ?? `https://play.google.com/store/account/subscriptions?sku=${sub?.productId ?? 'finance_pro'}&package=com.jadexlabs.finance`;
    // Capacitor hands a URL outside the app to Android, which opens Google Play.
    window.location.href = url;
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
      case 'assistant': return (await this.questions()).n;
      default: return 0;
    }
  }

  /** The assistant's questions answered this month, kept in the database so a backup carries them. */
  private async questions(): Promise<{ month: string; n: number }> {
    const month = new Date().toISOString().slice(0, 7);
    const row = await this.database.driver.queryOne<{ value: string }>(
      'SELECT value FROM settings WHERE key = ?', [QUESTIONS_KEY]);
    try {
      const kept = JSON.parse(row?.value ?? '{}') as { month?: string; n?: number };
      return { month, n: kept.month === month && typeof kept.n === 'number' ? kept.n : 0 };
    } catch {
      return { month, n: 0 };
    }
  }

  /**
   * Whether the assistant may answer one more question, counting it when it
   * may. Past the month's free ones the sheet says why; registering never asks.
   */
  async askQuestion(): Promise<boolean> {
    if (this.database.status() !== 'ready') return true;
    if (this.unlocked()) return true;
    const { month, n } = await this.questions();
    if (!(await this.allow('assistant', n))) return false;
    await this.database.driver.run(
      `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      [QUESTIONS_KEY, JSON.stringify({ month, n: n + 1 }), new Date().toISOString()]);
    return true;
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

function readEntitled(): { on?: boolean; sub?: Subscription | null; everPaid?: boolean; lapsed?: string | null; code?: string | null } {
  try {
    return JSON.parse(localStorage.getItem(ENTITLED_KEY) ?? '{}');
  } catch {
    return {};
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
