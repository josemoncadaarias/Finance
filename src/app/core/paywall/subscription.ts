/**
 * What the person pays for, read from the store's answer (mockups `34i`-`34m`):
 * which plan, whether it is the free trial, whether it renews and until when.
 * Pure, so it is tested without a store (`subscription.test.mjs`).
 */

export type ProPlan = 'monthly' | 'yearly';

export interface Subscription {
  /** The plan paid for, or null when the store names one the app does not sell. */
  plan: ProPlan | null;
  /** In the free trial. */
  trial: boolean;
  /** Renews by itself; false once cancelled (still active until `until`). */
  renews: boolean;
  /** When the trial ends, the period renews, or a cancelled one runs out (ISO). */
  until: string | null;
  /** The subscription's own id in the store (Google Play: without the plan). */
  productId: string;
  /** Where the store manages it (cancel, card, payments). */
  manageUrl: string | null;
  /**
   * Given by Jadex Labs from RevenueCat's dashboard ("Grant"), never bought:
   * nothing is paid, nothing renews and there is nothing to manage in
   * Google Play (Jose, 2026-10-29: his lifetime grant read "Volver a activar").
   */
  granted: boolean;
}

/** The part of the store's entitlement read here. */
export interface EntitlementLike {
  productIdentifier: string;
  productPlanIdentifier?: string | null;
  periodType?: string | null;
  willRenew?: boolean | null;
  expirationDate?: string | null;
  /** Where it came from: PLAY_STORE, APP_STORE... or PROMOTIONAL for one granted. */
  store?: string | null;
}

/** Whether an entitlement was granted from the dashboard rather than bought. */
export function isGranted(e: EntitlementLike): boolean {
  return (e.store ?? '').toUpperCase() === 'PROMOTIONAL' || e.productIdentifier.startsWith('rc_promo');
}

/**
 * The plan of an entitlement. Google Play names it "finance_pro" with the
 * plan apart ("monthly"), or "finance_pro:monthly"; a plan named annual or
 * yearly is the year.
 */
export function planOf(e: EntitlementLike): ProPlan | null {
  const plan = (e.productPlanIdentifier ?? e.productIdentifier.split(':')[1] ?? e.productIdentifier).toLowerCase();
  if (/year|annual|anual/.test(plan)) return 'yearly';
  if (/month|mensual/.test(plan)) return 'monthly';
  return null;
}

/** The subscription behind the first active entitlement, or null without one. */
export function subscriptionOf(
  active: Record<string, EntitlementLike>, manageUrl: string | null,
): Subscription | null {
  // One bought comes first: it is the one that charges and can be managed.
  const all = Object.values(active);
  const e = all.find(one => !isGranted(one)) ?? all[0];
  if (!e) return null;
  if (isGranted(e)) {
    return { plan: null, trial: false, renews: false, until: e.expirationDate ?? null, productId: e.productIdentifier, manageUrl: null, granted: true };
  }
  return {
    plan: planOf(e),
    trial: (e.periodType ?? '').toUpperCase() === 'TRIAL',
    renews: e.willRenew !== false,
    until: e.expirationDate ?? null,
    productId: e.productIdentifier.split(':')[0],
    manageUrl,
    granted: false,
  };
}

/**
 * How a change of plan is made: to the year at once, with what is left of the
 * month credited; to the month when the year paid for is over.
 */
export function changeModeFor(to: ProPlan): 'WITH_TIME_PRORATION' | 'DEFERRED' {
  return to === 'yearly' ? 'WITH_TIME_PRORATION' : 'DEFERRED';
}

/** Whole days from `now` to `until`, never below zero. */
export function daysLeft(until: string | null, now: Date): number {
  if (!until) return 0;
  return Math.max(0, Math.ceil((new Date(until).getTime() - now.getTime()) / 86_400_000));
}

/** The length of a free phase in days, as Google Play states it (P1W = 7). */
export function trialDaysOf(phase: { billingPeriod?: { unit?: string; value?: number } | null } | null | undefined): number | null {
  const unit = phase?.billingPeriod?.unit;
  const value = phase?.billingPeriod?.value ?? 0;
  if (!unit || value <= 0) return null;
  const days = ({ DAY: 1, WEEK: 7, MONTH: 30, YEAR: 365 } as Record<string, number>)[unit];
  return days ? days * value : null;
}

/**
 * When the last Finance Pro that is no longer active ran out, or null when
 * the person never had one or has one now (`34p`).
 */
export function lapsedOn(all: Record<string, EntitlementLike>, active: Record<string, EntitlementLike>): string | null {
  if (Object.keys(active).length > 0) return null;
  const ends = Object.values(all).map(e => e.expirationDate).filter((d): d is string => !!d).sort();
  return ends.length > 0 ? ends[ends.length - 1] : null;
}

/**
 * What the buy button offers (`34n`-`34p`): the free trial only when Google
 * still offers it and the person never paid; coming back after it ran out;
 * otherwise simply subscribing.
 */
export function buyOffer(o: { trialDays: number | null; everPaid: boolean; lapsed: string | null }): 'trial' | 'return' | 'subscribe' {
  if (o.lapsed) return 'return';
  if (o.everPaid || !o.trialDays) return 'subscribe';
  return 'trial';
}
