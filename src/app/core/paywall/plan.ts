/**
 * What is free and what is paid (rule 21; decided by Jose, 2026-10-15).
 *
 * The ONE place that says it. Every screen asks `PaywallService`, which asks
 * this table; no engine knows money exists. Moving a feature to free is one
 * line here, never a migration.
 *
 * Three rules this obeys:
 * 1. A lock never hides money: it stops something NEW, never what is on record.
 * 2. A lock is never felt offline: the last answer holds.
 * 3. One place answers the question: here.
 *
 * Pure, tested in `paywall-plan.test.mjs`.
 */

export type Feature =
  | 'currencies'       // an account in another currency
  | 'statements'       // reading a PDF statement
  | 'products'         // a product that earns
  | 'noticeSources'    // a bank's app or SMS sender read
  | 'noticeMovements'  // movements saved from messages, each month
  | 'loans'
  | 'limits'           // spending caps
  | 'goals'            // savings goals
  | 'reportFull'       // the report's paid sections
  | 'reportExport'     // the report as a spreadsheet
  | 'tax'              // the income-tax simulator
  | 'newCategories'    // creating a category (renaming and hiding are free)
  | 'ownImages'        // an account's or category's own picture
  | 'assistant';       // a question to the assistant, each month (registering by it is free)

export interface Allowance {
  /** How many may be used without paying. */
  free: number;
  /** Counted once for ever, or again each month. */
  per: 'ever' | 'month';
}

export const PLAN: Record<Feature, Allowance> = {
  currencies: { free: 0, per: 'ever' },
  statements: { free: 1, per: 'ever' },
  products: { free: 1, per: 'ever' },
  noticeSources: { free: 1, per: 'ever' },
  noticeMovements: { free: 15, per: 'month' },
  loans: { free: 1, per: 'ever' },
  limits: { free: 1, per: 'ever' },
  goals: { free: 1, per: 'ever' },
  reportFull: { free: 0, per: 'ever' },
  reportExport: { free: 0, per: 'ever' },
  tax: { free: 0, per: 'ever' },
  // Jose, 2026-10-30: a few free ("me parece demasiado cobrar por eso").
  // Counted as the person creates them, never the ones the app brings.
  newCategories: { free: 5, per: 'ever' },
  ownImages: { free: 0, per: 'ever' },
  // Jose, 2026-10-22: some free, the rest paid. Nothing is charged per use
  // (no AI behind it), so the allowance is generous: enough to make it a
  // habit, short of asking every day. Registering by it is never counted.
  assistant: { free: 20, per: 'month' },
};

/** The report's sections anybody sees; the rest are `reportFull`. */
export const FREE_REPORT_SECTIONS: readonly string[] = ['headline', 'versus', 'categories', 'biggest'];

/**
 * Whether the app charges. On since 2026-10-30 (Jose, once his own Finance
 * Pro for good was granted): the free version is what anybody without Pro
 * sees, and the "Ver la app como alguien sin Pro" switch that let it be
 * tried is gone. Turning it off again is this one line.
 */
export const CHARGING = true;

/**
 * Whether everything is open: a purchase, the trial or a grant (an active
 * entitlement in the store), or the app not charging where it is running -
 * not at all, or where nothing can be bought (a browser, no store key): a
 * lock there would be a door with no way through.
 */
export function isUnlocked(entitled: boolean, charging: boolean): boolean {
  return entitled || !charging;
}

/** Days with everything open after installing. */
export const TRIAL_DAYS = 7;

/**
 * Prices in pesos, shown only until the store answers with its own: Play
 * rounded the 11,900 and 69,900 Jose typed to 12,000 and 70,000 (2026-10-15).
 */
export const PRICES = { monthly: 12_000, yearly: 70_000 } as const;

/**
 * Whether one more of `feature` may be used, with `used` already in use (this
 * month, for a monthly allowance). Unlocked answers yes to everything.
 */
export function canUse(feature: Feature, used: number, unlocked: boolean): boolean {
  return unlocked || used < PLAN[feature].free;
}

/** How many more are free, for the line that says so ("Te quedan 3 este mes"). */
export function freeLeft(feature: Feature, used: number): number {
  return Math.max(0, PLAN[feature].free - used);
}

export function reportSectionFree(id: string): boolean {
  return FREE_REPORT_SECTIONS.includes(id);
}

/** Whether the trial that began on `startedOn` (YYYY-MM-DD) still runs on `today`. */
export function inTrial(startedOn: string | null, today: string): boolean {
  if (startedOn === null) return false;
  const days = (Date.parse(today + 'T00:00:00Z') - Date.parse(startedOn + 'T00:00:00Z')) / 86_400_000;
  return days >= 0 && days < TRIAL_DAYS;
}
