/**
 * What comes back every month (Jose, 2026-10-22), worked out from any
 * person's months - never from a list of shops or category names.
 *
 * Two kinds, said apart and added together:
 * - **Fixed payments**: the same note or shop in most months, for about the
 *   same amount each time (a rent, a plan, a subscription). Its figure is
 *   its average.
 * - **Every-month spending**: a category spent on in most months whose amount
 *   moves (the market, fuel). Its figure is the average of the last three
 *   whole months - recent enough to follow prices, a month with nothing
 *   counting as zero - with the lowest and highest month beside it. What the
 *   fixed payments in that category cost is taken out first, so nothing is
 *   counted twice.
 *
 * A fixed payment turns up in at least 60 % of the months looked at (4 of 6);
 * every-month spending in at least 80 % (5 of 6: one month without it is
 * allowed), since a category that is merely frequent is not "every month".
 * Never fewer than 3 months. Pure, tested in `recurring.test.mjs`.
 */

/** How far a month's amount may stray from the average and still be "the same" payment. */
export const STEADY = 0.25;
/** Months whose spending makes the every-month estimate. */
export const RECENT_MONTHS = 3;
const FIXED_SHARE = 0.6;
const EVERY_MONTH_SHARE = 0.8;

export interface Face {
  label: string;
  icon: string | null;
  customIconId: number | null;
  color: string | null;
  seed: number | null;
}

/** A shop or note in one month: what it cost, and where and when it was last paid. */
export interface ShopMonth {
  minor: number;
  name: string;
  category: string;
  /** The account, the category and the day of the month it was last paid on, when known. */
  accountId?: number;
  categoryId?: number | null;
  day?: number;
}

/** One month: each shop or note with what it cost, and each spending category. */
export interface MonthSpend {
  shops: Map<string, ShopMonth>;
  categories: Map<string, number>;
}

export interface FixedPayment {
  name: string;
  category: string;
  monthsSeen: number;
  averageMinor: number;
  thisMonthMinor: number;
  /** Where and when it was paid the last time: what "Pagos de este mes" starts the form on. */
  accountId: number | null;
  categoryId: number | null;
  day: number | null;
}

export interface EveryMonthSpend {
  category: string;
  monthsSeen: number;
  /** The average of the last three whole months, the fixed payments taken out. */
  averageMinor: number;
  lowMinor: number;
  highMinor: number;
  thisMonthMinor: number;
}

export interface Recurring {
  /** Whole months looked at, the newest first, the empty ones before any record left out. */
  looked: number;
  /** In how many months a fixed payment has to turn up; every-month spending, `neededEvery`. */
  needed: number;
  neededEvery: number;
  fixed: FixedPayment[];
  everyMonth: EveryMonthSpend[];
  /**
   * Categories spent on often - as often as a fixed payment, short of every
   * month (Jose, 2026-10-22: shown apart, never left out). Their figure is
   * what they come to a month over every month looked at. Not in the totals.
   */
  frequent: EveryMonthSpend[];
  fixedMinor: number;
  everyMonthMinor: number;
  /** The whole spending of an ordinary month, for the share. */
  spendMinor: number;
}

/**
 * `months` newest first (the last whole month at 0); `current` is this month
 * so far.
 */
export function recurringOf(months: readonly MonthSpend[], current: MonthSpend): Recurring {
  const list = [...months];
  // Months before anything was recorded are not months of the habit.
  while (list.length > 0 && list[list.length - 1].categories.size === 0) list.pop();
  const looked = list.length;
  const needed = Math.max(3, Math.ceil(looked * FIXED_SHARE));
  const neededEvery = Math.max(3, Math.ceil(looked * EVERY_MONTH_SHARE));
  const empty = { looked, needed, neededEvery, fixed: [], everyMonth: [], frequent: [], fixedMinor: 0, everyMonthMinor: 0, spendMinor: 0 };
  if (looked < 3) return empty;

  // Fixed payments.
  // Newest month first, so the first time a shop is met is its latest payment.
  const shops = new Map<string, { amounts: number[]; last: ShopMonth }>();
  list.forEach(month => {
    for (const [key, at] of month.shops) {
      const was = shops.get(key);
      if (was) was.amounts.push(at.minor);
      else shops.set(key, { amounts: [at.minor], last: at });
    }
  });
  const fixed: FixedPayment[] = [];
  const fixedKeys = new Set<string>();
  for (const [key, x] of shops) {
    if (x.amounts.length < needed) continue;
    const average = Math.round(x.amounts.reduce((sum, v) => sum + v, 0) / x.amounts.length);
    if (average <= 0 || x.amounts.some(v => Math.abs(v - average) > average * STEADY)) continue;
    fixedKeys.add(key);
    fixed.push({ name: x.last.name, category: x.last.category, monthsSeen: x.amounts.length, averageMinor: average,
      thisMonthMinor: current.shops.get(key)?.minor ?? 0,
      accountId: x.last.accountId ?? null, categoryId: x.last.categoryId ?? null, day: x.last.day ?? null });
  }
  fixed.sort((a, b) => b.averageMinor - a.averageMinor);

  // A category's month, the fixed payments in it taken out.
  const rest = (month: MonthSpend): Map<string, number> => {
    const out = new Map(month.categories);
    for (const [key, at] of month.shops) {
      if (!fixedKeys.has(key)) continue;
      out.set(at.category, (out.get(at.category) ?? 0) - at.minor);
    }
    return out;
  };
  const rests = list.map(rest);
  const now = rest(current);
  const categories = new Set(rests.flatMap(m => [...m.keys()]));
  const everyMonth: EveryMonthSpend[] = [];
  const frequent: EveryMonthSpend[] = [];
  for (const category of categories) {
    const amounts = rests.map(m => Math.max(0, m.get(category) ?? 0));
    const seen = amounts.filter(v => v > 0);
    if (seen.length < needed) continue;
    const every = seen.length >= neededEvery;
    const into = every ? everyMonth : frequent;
    // Every month: the last three months, to follow today's prices. Often but
    // not every month: what it comes to a month over all the months looked at.
    const window = every ? amounts.slice(0, RECENT_MONTHS) : amounts;
    const average = Math.round(window.reduce((sum, v) => sum + v, 0) / window.length);
    if (average <= 0) continue;
    into.push({ category, monthsSeen: seen.length, averageMinor: average,
      lowMinor: Math.min(...seen), highMinor: Math.max(...seen), thisMonthMinor: Math.max(0, now.get(category) ?? 0) });
  }
  everyMonth.sort((a, b) => b.averageMinor - a.averageMinor);
  frequent.sort((a, b) => b.averageMinor - a.averageMinor);

  const all = list.reduce((sum, m) => sum + [...m.categories.values()].reduce((t, v) => t + v, 0), 0);
  return {
    looked, needed, neededEvery, fixed, everyMonth, frequent,
    fixedMinor: fixed.reduce((sum, f) => sum + f.averageMinor, 0),
    everyMonthMinor: everyMonth.reduce((sum, e) => sum + e.averageMinor, 0),
    spendMinor: Math.round(all / looked),
  };
}
