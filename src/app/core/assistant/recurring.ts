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
  const fixedKeyOf = new Map<FixedPayment, string>();
  for (const [key, x] of shops) {
    if (x.amounts.length < needed) continue;
    const average = Math.round(x.amounts.reduce((sum, v) => sum + v, 0) / x.amounts.length);
    if (average <= 0 || x.amounts.some(v => Math.abs(v - average) > average * STEADY)) continue;
    fixedKeys.add(key);
    fixed.push({ name: x.last.name, category: x.last.category, monthsSeen: x.amounts.length, averageMinor: average,
      thisMonthMinor: 0,
      accountId: x.last.accountId ?? null, categoryId: x.last.categoryId ?? null, day: x.last.day ?? null });
    fixedKeyOf.set(fixed[fixed.length - 1], key);
  }
  fixed.sort((a, b) => b.averageMinor - a.averageMinor);
  const paidNow = paidThisMonth(fixed, fixedKeyOf, current);

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
  // This month, the payments matched to a fixed one are taken out the same way.
  const now = new Map(current.categories);
  for (const key of paidNow) {
    const at = current.shops.get(key);
    if (at) now.set(at.category, (now.get(at.category) ?? 0) - at.minor);
  }
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

/**
 * Which of this month's spendings is each fixed payment (Jose, 2026-11-11:
 * "Mercado OR", saved from another account with the note "Mercado OR mas
 * impuesto 4x1000", still showed as not paid - its words made another key).
 * One spending settles one fixed payment, in three passes, each only with
 * what the passes before left:
 * 1. the same shop or note, folded (`merchantKeyOf`);
 * 2. one name holding every word of the other ("MERCADO OR" in "MERCADO OR
 *    MAS IMPUESTO"), the closest amount first;
 * 3. the same category for about the usual amount (within `STEADY`), the
 *    closest first - a note written another way altogether.
 * Sets each payment's `thisMonthMinor` and hands back the keys used.
 */
function paidThisMonth(fixed: FixedPayment[], keyOf: ReadonlyMap<FixedPayment, string>, current: MonthSpend): Set<string> {
  const used = new Set<string>();
  const open = new Set(fixed);
  const settle = (f: FixedPayment, key: string, minor: number) => {
    f.thisMonthMinor = minor; used.add(key); open.delete(f);
  };
  for (const f of fixed) {
    const key = keyOf.get(f) ?? '';
    const at = current.shops.get(key);
    if (at && at.minor > 0) settle(f, key, at.minor);
  }
  const wordsOf = (key: string) => key.split(' ').filter(w => w.length > 0);
  const within = (a: string[], b: string[]) => a.length > 0 && a.some(w => w.length >= 3) && a.every(w => b.includes(w));
  const pass = (fits: (f: FixedPayment, key: string, at: ShopMonth) => boolean) => {
    // Every pair that fits, the closest amounts first, so two payments of
    // one category each take their own spending.
    const pairs: { f: FixedPayment; key: string; minor: number; gap: number }[] = [];
    for (const f of fixed) {
      if (!open.has(f)) continue;
      for (const [key, at] of current.shops) {
        if (used.has(key) || at.minor <= 0 || !fits(f, key, at)) continue;
        pairs.push({ f, key, minor: at.minor, gap: Math.abs(at.minor - f.averageMinor) });
      }
    }
    pairs.sort((a, b) => a.gap - b.gap);
    for (const p of pairs) if (open.has(p.f) && !used.has(p.key)) settle(p.f, p.key, p.minor);
  };
  pass((f, key) => {
    const mine = wordsOf(keyOf.get(f) ?? ''), theirs = wordsOf(key);
    return within(mine, theirs) || within(theirs, mine);
  });
  pass((f, _key, at) => at.category === f.category && Math.abs(at.minor - f.averageMinor) <= f.averageMinor * STEADY);
  return used;
}

/**
 * The fixed payments not seen yet this month, by the day they are usually
 * paid: what "Pagos de este mes" in the "+" lists and what the assistant
 * answers to "¿qué pagos fijos me faltan?" - one rule, so both say the same
 * (Jose, 2026-11-06: the "+" sent him to the assistant for "the other 2" and
 * the assistant listed every fixed payment, paid or not). One whose account
 * is gone has nowhere to open the form on, and is left out of both.
 */
export function stillToPay(fixed: readonly FixedPayment[]): FixedPayment[] {
  return fixed.filter(f => f.thisMonthMinor <= 0 && f.accountId !== null)
    .sort((a, b) => (a.day ?? 99) - (b.day ?? 99));
}
