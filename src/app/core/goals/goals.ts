/**
 * Goals (plans, part 3, step 2; mockups `15a`-`15m`): what a goal has, what
 * it still needs a month, and whether the person's own pace gets there in
 * time. Pure: the figures come in, nothing is read here.
 *
 * What a goal has is what its places hold - never a sum of contributions
 * typed somewhere else - so the goal and the accounts cannot disagree.
 */

import { monthOf, shiftMonth, spentIn, type SpendRow } from '../limits/limits';

export type GoalKind = 'custom' | 'emergency';
export type PlaceCounts = 'all' | 'from_start';

export interface GoalPlace {
  id: number;
  accountId: number;
  /** Null: the whole account. */
  productId: number | null;
  counts: PlaceCounts;
  /** What the place held when it was added, in the account's currency. */
  startMinor: number;
}

export interface GoalTerms {
  id: number;
  name: string;
  icon: string;
  color: string | null;
  amountMinor: number;
  /** 'YYYY-MM', or null for no date. */
  dueMonth: string | null;
  kind: GoalKind;
  months: number | null;
  allAccounts: boolean;
  startedOn: string;
  reachedOn: string | null;
  archived: boolean;
  places: GoalPlace[];
}

export type GoalState = 'reached' | 'onTime' | 'late' | 'noDate';

export interface GoalStatus {
  savedMinor: number;
  percent: number;
  remainingMinor: number;
  /** What each month still needs to arrive by the date; null with no date. */
  neededPerMonthMinor: number | null;
  /** Months left until the date, this one included; 0 once it has passed. */
  monthsLeft: number | null;
  /** What came in a month, on average, over the last three months. */
  paceMinor: number;
  /** The month the pace arrives in; null when the pace does not grow. */
  arrivalMonth: string | null;
  /** How many months after the date the pace arrives. */
  lateBy: number;
  /** It grows, but too slowly to arrive within ten years. */
  tooSlow: boolean;
  state: GoalState;
}

/** What one place counts for its goal, in its own currency. */
export function placeCount(place: GoalPlace, holdsMinor: number): number {
  return place.counts === 'all' ? holdsMinor : holdsMinor - place.startMinor;
}

/** Months from `from` to `to` ('YYYY-MM'), negative when `to` is earlier. */
export function monthsBetween(from: string, to: string): number {
  const [fy, fm] = from.split('-').map(Number);
  const [ty, tm] = to.split('-').map(Number);
  return (ty * 12 + tm) - (fy * 12 + fm);
}

/**
 * The goal's standing today. `savedMinor` is what its places hold today and
 * `savedBeforeMinor` what they held three months ago, both in pesos at
 * today's rate, so the pace is the money's and never a rate's movement.
 */
export function goalStatus(
  goal: Pick<GoalTerms, 'amountMinor' | 'dueMonth' | 'reachedOn'>,
  savedMinor: number, savedBeforeMinor: number, today: string,
): GoalStatus {
  const saved = Math.max(0, savedMinor);
  const remaining = Math.max(0, goal.amountMinor - saved);
  const percent = Math.min(100, Math.round((saved / goal.amountMinor) * 100));
  const pace = Math.round((savedMinor - savedBeforeMinor) / 3);
  const thisMonth = monthOf(today);
  // Past ten years a month is no answer anyone can plan by.
  const monthsToGo = pace > 0 ? Math.ceil(remaining / pace) : Infinity;
  const tooSlow = remaining > 0 && pace > 0 && monthsToGo > 120;
  const arrivalMonth = remaining === 0 ? thisMonth
    : pace > 0 && !tooSlow ? shiftMonth(thisMonth, monthsToGo) : null;

  const monthsLeft = goal.dueMonth === null ? null : Math.max(0, monthsBetween(thisMonth, goal.dueMonth));
  const neededPerMonthMinor = monthsLeft === null ? null
    : Math.ceil(remaining / Math.max(1, monthsLeft));

  let state: GoalState;
  let lateBy = 0;
  if (goal.reachedOn !== null || remaining === 0) state = 'reached';
  else if (goal.dueMonth === null) state = 'noDate';
  else if (arrivalMonth === null || arrivalMonth > goal.dueMonth || monthsLeft === 0) {
    state = 'late';
    lateBy = arrivalMonth === null ? 0 : Math.max(0, monthsBetween(goal.dueMonth, arrivalMonth));
  } else state = 'onTime';

  return {
    savedMinor: saved, percent, remainingMinor: remaining, neededPerMonthMinor, monthsLeft,
    paceMinor: pace, arrivalMonth, lateBy, tooSlow, state,
  };
}

/**
 * What the person spends a month, for an emergency fund: the summary's own
 * rule over the whole months before this one (up to six), counting only the
 * months since spending was first on record, so a young ledger is not
 * averaged with months it never saw.
 */
export function monthlySpend(rows: readonly SpendRow[], today: string, back = 6): number {
  const now = monthOf(today);
  const spent: number[] = [];
  for (let i = back; i >= 1; i--) {
    const month = shiftMonth(now, -i);
    spent.push(spentIn(rows.filter(row => monthOf(row.occurredOn) === month && row.inNetWorth)));
  }
  const first = spent.findIndex(minor => minor > 0);
  if (first < 0) return 0;
  const counted = spent.slice(first);
  return Math.round(counted.reduce((sum, minor) => sum + minor, 0) / counted.length);
}

/** An emergency fund's figure: so many months of what is spent, to the thousand. */
export function emergencyAmount(monthlyMinor: number, months: number): number {
  return Math.round((monthlyMinor * months) / 1_000_00) * 1_000_00;
}
