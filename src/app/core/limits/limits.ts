/**
 * Spending limits, worked out (plans, part 3, step 1; mockups `14a`-`14p`).
 *
 * A limit is a figure a month for one or several categories, on every account
 * or on one. What was spent is never stored: it is the movements of the month,
 * added up with the summary's own rule (`totalsOf`: expenses less what came
 * back on a card, never income, never a transfer), so a limit and the donut
 * cannot disagree by a peso. Figures are pesos at each movement's own rate
 * (`amount_base_minor`), as everywhere a figure crosses currencies.
 *
 * Pure: no database, no Angular, so `run-tests.mjs` checks every rule.
 */

import type { TransactionRow } from '../database/types';
import { flowOf, totalsOf, type Movement } from '../../features/movements/group-movements';

export interface LimitTerms {
  id: number;
  amountMinor: number;
  /** Null: every account counted in net worth. */
  accountId: number | null;
  warnAt80: boolean;
  categoryIds: readonly number[];
}

/** One movement under a category some limit covers. */
export interface SpendRow {
  id: number;
  categoryId: number;
  accountId: number;
  accountType: string;
  /** Whether its account counts in net worth: "every account" means those. */
  inNetWorth: boolean;
  occurredOn: string;
  /** In pesos, signed as stored: negative is money out. */
  amountMinor: number;
  description: string | null;
}

/** Red past the limit, amber from 80 % or ahead of the month's pace, green otherwise. */
export type LimitState = 'good' | 'fast' | 'close' | 'passed';

export interface MonthSpent {
  month: string;
  spentMinor: number;
}

export interface LimitStatus {
  id: number;
  amountMinor: number;
  spentMinor: number;
  /** Whole percent of the limit spent. */
  percent: number;
  /** What is left, never below zero. */
  remainingMinor: number;
  /** What went past the limit, zero while under it. */
  overMinor: number;
  state: LimitState;
  /** Days of the month still to come, today included; zero for a month over. */
  daysLeft: number;
  /** What is left over what is left of the month, a day. */
  perDayMinor: number;
  /** The month before, up to the same day. */
  lastMonthSoFarMinor: number;
  /** The movement that took it past the limit, and its day. */
  passedWith: SpendRow | null;
  /** The six months up to the one on view, oldest first. */
  history: MonthSpent[];
  /** The average of the three whole months before this one, or null with none of them spent. */
  averageMinor: number | null;
  /** The month's movements under it, newest first. */
  rows: SpendRow[];
}

export interface TotalStatus {
  amountMinor: number;
  spentMinor: number;
  percent: number;
  remainingMinor: number;
  overMinor: number;
  state: LimitState;
  daysLeft: number;
  perDayMinor: number;
  /** How many limits are past theirs. */
  passedCount: number;
}

/** "2026-10" of "2026-10-18". */
export function monthOf(iso: string): string {
  return iso.slice(0, 7);
}

export function shiftMonth(month: string, by: number): string {
  const [y, m] = month.split('-').map(Number);
  const at = new Date(Date.UTC(y, m - 1 + by, 1));
  return `${at.getUTCFullYear()}-${String(at.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function daysInMonth(month: string): number {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** The movements a limit counts, of any month. */
export function rowsOf(limit: LimitTerms, rows: readonly SpendRow[]): SpendRow[] {
  const categories = new Set(limit.categoryIds);
  return rows.filter(row => categories.has(row.categoryId)
    && (limit.accountId === null ? row.inNetWorth : row.accountId === limit.accountId));
}

/** As the summary reads it: one movement, in the shape `totalsOf` adds up. */
function asMovement(row: SpendRow): Movement {
  const transaction = { amount_minor: row.amountMinor, amount_base_minor: row.amountMinor, transfer_id: null } as TransactionRow;
  return { transaction, flow: flowOf(transaction, row.accountType) } as Movement;
}

/** What these movements spent, by the summary's rule. */
export function spentIn(rows: readonly SpendRow[]): number {
  return totalsOf(rows.map(asMovement), 'base').outMinor;
}

/** What one movement adds to what was spent: an expense adds, a refund takes off, income nothing. */
export function spendOf(row: SpendRow): number {
  const flow = asMovement(row).flow;
  if (flow === 'out') return Math.abs(row.amountMinor);
  if (flow === 'refund') return -Math.abs(row.amountMinor);
  return 0;
}

function inMonth(rows: readonly SpendRow[], month: string, upToDay = 31): SpendRow[] {
  return rows.filter(row => monthOf(row.occurredOn) === month && Number(row.occurredOn.slice(8, 10)) <= upToDay);
}

function percentOf(spent: number, amount: number): number {
  return amount > 0 ? Math.round((spent / amount) * 100) : 0;
}

/** Days still to come in `month` as of `today`, today included. */
export function daysLeftIn(month: string, today: string): number {
  const now = monthOf(today);
  if (month < now) return 0;
  if (month > now) return daysInMonth(month);
  return daysInMonth(month) - Number(today.slice(8, 10)) + 1;
}

function stateOf(spent: number, amount: number, month: string, today: string): LimitState {
  if (spent > amount) return 'passed';
  if (spent * 100 >= amount * 80) return 'close';
  if (monthOf(today) === month) {
    // Ahead of the month: more spent than the share of the month gone by.
    const gone = Number(today.slice(8, 10)) / daysInMonth(month);
    if (spent > amount * gone) return 'fast';
  }
  return 'good';
}

/** The average of the three whole months before the current one, or null with nothing spent in them. */
export function averageBefore(rows: readonly SpendRow[], today: string): number | null {
  const now = monthOf(today);
  const months = [1, 2, 3].map(back => spentIn(inMonth(rows, shiftMonth(now, -back))));
  const total = months.reduce((sum, spent) => sum + spent, 0);
  return total > 0 ? Math.round(total / 3) : null;
}

/** A figure to offer as a limit: up to a round step (1,000; 10,000 from 100,000; 100,000 from a million). */
export function roundedLimit(minor: number): number {
  const step = minor >= 1_000_000_00 ? 100_000_00 : minor >= 100_000_00 ? 10_000_00 : 1_000_00;
  return Math.ceil(minor / step) * step;
}

/** An average as it is offered in the form: to the thousand. */
export function roundedAverage(minor: number): number {
  return Math.round(minor / 1_000_00) * 1_000_00;
}

export function limitStatus(limit: LimitTerms, allRows: readonly SpendRow[], month: string, today: string): LimitStatus {
  const own = rowsOf(limit, allRows);
  const rows = inMonth(own, month);
  const spentMinor = spentIn(rows);
  const amountMinor = limit.amountMinor;
  const remainingMinor = Math.max(0, amountMinor - spentMinor);
  const daysLeft = daysLeftIn(month, today);

  // The movement that took it over: the running sum, in the order they happened.
  let passedWith: SpendRow | null = null;
  if (spentMinor > amountMinor) {
    let running = 0;
    for (const row of [...rows].sort((a, b) => a.occurredOn.localeCompare(b.occurredOn) || a.id - b.id)) {
      running += spendOf(row);
      if (running > amountMinor) { passedWith = row; break; }
    }
  }

  const before = shiftMonth(month, -1);
  const sameDay = monthOf(today) === month ? Number(today.slice(8, 10)) : daysInMonth(month);

  return {
    id: limit.id,
    amountMinor,
    spentMinor,
    percent: percentOf(spentMinor, amountMinor),
    remainingMinor,
    overMinor: Math.max(0, spentMinor - amountMinor),
    state: stateOf(spentMinor, amountMinor, month, today),
    daysLeft,
    perDayMinor: daysLeft > 0 ? Math.floor(remainingMinor / daysLeft) : 0,
    lastMonthSoFarMinor: spentIn(inMonth(own, before, sameDay)),
    passedWith,
    history: [5, 4, 3, 2, 1, 0].map(back => {
      const m = shiftMonth(month, -back);
      return { month: m, spentMinor: spentIn(inMonth(own, m)) };
    }),
    averageMinor: averageBefore(own, today),
    rows: [...rows].sort((a, b) => b.occurredOn.localeCompare(a.occurredOn) || b.id - a.id),
  };
}

/** Every limit together: what they allow, what was spent under them, and how many are past theirs. */
export function totalStatus(statuses: readonly LimitStatus[], month: string, today: string): TotalStatus {
  const amountMinor = statuses.reduce((sum, s) => sum + s.amountMinor, 0);
  const spentMinor = statuses.reduce((sum, s) => sum + s.spentMinor, 0);
  const remainingMinor = Math.max(0, amountMinor - spentMinor);
  const daysLeft = daysLeftIn(month, today);
  return {
    amountMinor,
    spentMinor,
    percent: percentOf(spentMinor, amountMinor),
    remainingMinor,
    overMinor: Math.max(0, spentMinor - amountMinor),
    state: stateOf(spentMinor, amountMinor, month, today),
    daysLeft,
    perDayMinor: daysLeft > 0 ? Math.floor(remainingMinor / daysLeft) : 0,
    passedCount: statuses.filter(s => s.state === 'passed').length,
  };
}

/** How far a limit has gone, for the notices: nothing, 80 %, or past it. */
export type Level = 0 | 80 | 100;

export function levelOf(spentMinor: number, amountMinor: number): Level {
  if (spentMinor > amountMinor) return 100;
  return spentMinor * 100 >= amountMinor * 80 ? 80 : 0;
}

export interface Crossing {
  /** A limit's id, or 'total' for every limit together. */
  key: number | 'total';
  level: 80 | 100;
}

/**
 * What went up a level between two readings of the same month: a limit that
 * reached 80 % or went past, or the total going past. A limit that did not
 * exist before is not a crossing - a backup restored is not a purchase.
 */
export function crossings(before: ReadonlyMap<number | 'total', Level>, after: ReadonlyMap<number | 'total', Level>): Crossing[] {
  const found: Crossing[] = [];
  for (const [key, level] of after) {
    const was = before.get(key);
    if (was === undefined || level <= was || level === 0) continue;
    if (key === 'total' && level !== 100) continue;
    found.push({ key, level });
  }
  return found;
}

/**
 * What was already past and took more spending between two readings: a
 * purchase into a cap already passed crosses nothing, and still deserves to
 * be told at saving (Jose, 2026-10-02: a Restaurante expense over a cap
 * passed earlier in the month said nothing). Readings carry what was spent
 * per key; a key missing from either side is not compared.
 */
export function stillOver(before: ReadonlyMap<number | 'total', number>, after: ReadonlyMap<number | 'total', number>,
                          amounts: ReadonlyMap<number | 'total', number>): (number | 'total')[] {
  const found: (number | 'total')[] = [];
  for (const [key, spent] of after) {
    const was = before.get(key);
    const amount = amounts.get(key);
    if (was === undefined || amount === undefined) continue;
    if (was > amount && spent > was) found.push(key);
  }
  return found;
}
