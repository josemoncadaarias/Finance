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
}

/** The part of the store's entitlement read here. */
export interface EntitlementLike {
  productIdentifier: string;
  productPlanIdentifier?: string | null;
  periodType?: string | null;
  willRenew?: boolean | null;
  expirationDate?: string | null;
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
  const e = Object.values(active)[0];
  if (!e) return null;
  return {
    plan: planOf(e),
    trial: (e.periodType ?? '').toUpperCase() === 'TRIAL',
    renews: e.willRenew !== false,
    until: e.expirationDate ?? null,
    productId: e.productIdentifier.split(':')[0],
    manageUrl,
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
