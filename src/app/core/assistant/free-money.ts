/**
 * "Libre para gastar": how much of what the person holds is really free for
 * the rest of the month (Jose, 2026-10-19, mockups `39d`, `39i`-`39n`).
 *
 * What the accounts counted in net worth hold - never a card's credit, never a
 * CDT or a product set aside from net worth, never interest a product earned
 * and was not cashed in (rule 15) -
 *   less what the goals already hold, up to each goal's figure: money put
 *     aside for something is not free;
 *   less the payments coming: what is left of each card's statement and the
 *     loan installments due by the month's end;
 *   less what the goals would want this month.
 *
 * **A goal has no fixed instalment, and this never pretends it has one.**
 * What it would want this month is an estimate, said as one: with a date,
 * what it lacks over the months left; without a date, the person's own
 * average of the last three months; less what already went in this month,
 * never below nothing; and nothing once it is reached.
 *
 * Pure: every figure comes in, already in pesos.
 */

import { daysInMonth, monthOf } from '../limits/limits';
import { monthsBetween } from '../goals/goals';

export interface GoalMoney {
  id: number;
  name: string;
  icon: string;
  color: string | null;
  amountMinor: number;
  /** What its places hold today, inside the accounts counted here. */
  savedMinor: number;
  /** What they held at the close of last month. */
  savedAtMonthStartMinor: number;
  /** 'YYYY-MM', or null for no date. */
  dueMonth: string | null;
  /** What came in a month, on average, over the last three months. */
  paceMinor: number;
  reached: boolean;
  /**
   * Of what it holds, what sits in the money counted here - not in a CDT or a
   * product set aside, which are not counted as free in the first place.
   * Absent: all of it.
   */
  countedMinor?: number;
  /** An emergency fund: what it keeps is the cushion for a big purchase (`bigRoom`). */
  emergency?: boolean;
}

export type GoalHow = 'dated' | 'average' | 'noHistory' | 'reached';

export interface GoalThisMonth {
  goal: GoalMoney;
  how: GoalHow;
  /** What it would want this month in all. */
  aimMinor: number;
  /** What already went in this month. */
  alreadyMinor: number;
  /** What is still to put in this month: set aside from the free money. */
  leftMinor: number;
  /** A dated goal: what it lacks and the months to its date. */
  lacksMinor: number;
  monthsLeft: number;
  /** What it holds, up to its figure: not free money. */
  keptMinor: number;
}

export interface DuePayment {
  kind: 'card' | 'loan';
  id: number;
  name: string;
  amountMinor: number;
  dueOn: string;
  /** The account it is usually paid from, when known. */
  fromAccountId: number | null;
}

export interface FreeMoney {
  inAccountsMinor: number;
  inGoalsMinor: number;
  paymentsMinor: number;
  goalsMonthMinor: number;
  freeMinor: number;
  goals: GoalThisMonth[];
  payments: DuePayment[];
  /** The month's last day, and the days to it, today included. */
  monthEnd: string;
  daysLeft: number;
}

/** What one goal would want this month, and why. */
export function goalThisMonth(goal: GoalMoney, today: string): GoalThisMonth {
  // What it holds up to its figure, taken first from what is not counted anyway.
  const counted = goal.countedMinor ?? goal.savedMinor;
  const elsewhere = Math.max(0, goal.savedMinor - counted);
  const kept = Math.max(0, Math.min(counted, Math.min(goal.savedMinor, goal.amountMinor) - elsewhere));
  const already = Math.max(0, goal.savedMinor - goal.savedAtMonthStartMinor);
  const base = { goal, alreadyMinor: already, keptMinor: kept, lacksMinor: 0, monthsLeft: 0 };
  if (goal.reached || goal.savedMinor >= goal.amountMinor) {
    return { ...base, how: 'reached', aimMinor: 0, leftMinor: 0 };
  }
  if (goal.dueMonth !== null) {
    const monthsLeft = Math.max(1, monthsBetween(monthOf(today), goal.dueMonth));
    const lacks = Math.max(0, goal.amountMinor - Math.max(0, goal.savedAtMonthStartMinor));
    const aim = Math.ceil(lacks / monthsLeft);
    return { ...base, how: 'dated', aimMinor: aim, leftMinor: Math.max(0, aim - already), lacksMinor: lacks, monthsLeft };
  }
  if (goal.paceMinor > 0) {
    return { ...base, how: 'average', aimMinor: goal.paceMinor, leftMinor: Math.max(0, goal.paceMinor - already) };
  }
  return { ...base, how: 'noHistory', aimMinor: 0, leftMinor: 0 };
}

export function freeMoney(input: {
  inAccountsMinor: number;
  payments: readonly DuePayment[];
  goals: readonly GoalMoney[];
  today: string;
}): FreeMoney {
  const goals = input.goals.map(goal => goalThisMonth(goal, input.today));
  const inGoalsMinor = goals.reduce((sum, g) => sum + g.keptMinor, 0);
  const goalsMonthMinor = goals.reduce((sum, g) => sum + g.leftMinor, 0);
  const paymentsMinor = input.payments.reduce((sum, p) => sum + p.amountMinor, 0);
  const month = monthOf(input.today);
  const last = daysInMonth(month);
  const monthEnd = `${month}-${String(last).padStart(2, '0')}`;
  return {
    inAccountsMinor: input.inAccountsMinor,
    inGoalsMinor, paymentsMinor, goalsMonthMinor,
    freeMinor: input.inAccountsMinor - inGoalsMinor - paymentsMinor - goalsMonthMinor,
    goals, payments: [...input.payments],
    monthEnd,
    daysLeft: last - Number(input.today.slice(8, 10)) + 1,
  };
}

/** One place a goal keeps its money in, in pesos. */
export interface GoalPlaceMoney {
  accountId: number;
  pesos: number;
  /** False for a CDT or a product set aside: money not counted as free anyway. */
  free: boolean;
}

/**
 * What a goal keeps in one account (Jose, 2026-10-28: an emergency fund of
 * 85 million over eleven accounts left every one of them at zero, because
 * each was told the goal kept up to 85 million in it). A goal keeps its
 * figure once, across all its places: first in money that is not free anyway
 * (a CDT, a product set aside), as the whole figure does; what is left is
 * shared among its free places in proportion to what each holds.
 */
export function goalKeptIn(places: readonly GoalPlaceMoney[], amountMinor: number, accountId: number): number {
  const held = (p: GoalPlaceMoney) => Math.max(0, p.pesos);
  const saved = places.reduce((sum, p) => sum + held(p), 0);
  const elsewhere = places.filter(p => !p.free).reduce((sum, p) => sum + held(p), 0);
  const freeTotal = saved - elsewhere;
  const toKeep = Math.max(0, Math.min(saved, amountMinor) - elsewhere);
  if (freeTotal <= 0 || toKeep <= 0) return 0;
  const here = places.filter(p => p.free && p.accountId === accountId).reduce((sum, p) => sum + held(p), 0);
  return Math.round(toKeep * here / freeTotal);
}

/**
 * The same figure for one account alone (Jose, 2026-10-28: Inicio showed the
 * whole picture whatever account was chosen on top). What the account holds,
 * less what its own goal places keep, less the payments that usually leave
 * from it this month. What the goals would want this month is not split
 * between accounts - nothing says which account a goal is fed from - so it
 * stays in the figure for every account together.
 */
export function freeInAccount(input: {
  accountId: number;
  holdsMinor: number;
  payments: readonly DuePayment[];
  /** What each goal keeps in this account, up to the goal's figure. */
  keptMinor: number;
  today: string;
}): FreeMoney {
  const whole = freeMoney({ inAccountsMinor: input.holdsMinor, payments: input.payments.filter(p => p.fromAccountId === input.accountId), goals: [], today: input.today });
  const kept = Math.max(0, Math.min(input.keptMinor, Math.max(0, input.holdsMinor)));
  return { ...whole, inGoalsMinor: kept, freeMinor: whole.freeMinor - kept };
}

/** A sum spread over the days left, rounded down to whole hundreds of pesos. */
export function perDay(minor: number, days: number): number {
  if (minor <= 0 || days <= 0) return 0;
  return Math.floor(minor / days / 10_000) * 10_000;
}

export type Verdict = 'yes' | 'yesButCap' | 'no';

export interface Afford {
  verdict: Verdict;
  /** What would stay free after it. */
  afterMinor: number;
  /** What it lacks when it does not reach. */
  shortMinor: number;
  /** The cap it would pass, and by how much. */
  capOverMinor: number;
}

/** Whether a spending fits: in the free money, and inside its category's cap. */
export function afford(freeMinor: number, amountMinor: number, cap: { remainingMinor: number } | null): Afford {
  const after = freeMinor - amountMinor;
  if (after < 0) return { verdict: 'no', afterMinor: after, shortMinor: -after, capOverMinor: 0 };
  const capOver = cap ? Math.max(0, amountMinor - cap.remainingMinor) : 0;
  return { verdict: capOver > 0 ? 'yesButCap' : 'yes', afterMinor: after, shortMinor: 0, capOverMinor: capOver };
}
