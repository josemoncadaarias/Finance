/**
 * "Puedes gastar hoy" from what the person RECEIVES, never from everything
 * they hold (Jose, 2026-10-31, mockups `51a`-`51g`: the app said 230 million
 * could be spent in a month while a 500 million goal was still open).
 *
 *   what comes in, in a normal month (the average of the last 3 whole months)
 *   - what is set aside for the goals: a share of it (20 % by default), or
 *     what the goals with a date ask this month, whichever is larger
 *   - what was already spent this month
 *   - the payments still to come this month: fixed payments not seen yet and
 *     loan installments due
 *   = what is left for the rest of the month, spread over the days left.
 *
 * The money already saved is not counted at all. A card's statement is not
 * a payment here: every purchase was already counted as spending.
 *
 * Pure: every figure comes in, already in pesos. For a big purchase the
 * assistant still weighs the money held ("¿me alcanza?"); this is only the
 * everyday figure.
 */

import { daysInMonth, monthOf } from '../limits/limits';

/** What comes in, set aside for the goals, by default (the 50/30/20 rule's saving). */
export const SAVE_PCT_DEFAULT = 20;
export const SAVE_PCT_CHOICES = [10, 20, 30] as const;
/** Whole months averaged for what comes in. */
export const INCOME_MONTHS = 3;

export interface RoomPayment {
  kind: 'fixed' | 'loan';
  name: string;
  amountMinor: number;
  /** 'YYYY-MM-DD' when known (a loan's due day), else null. */
  dueOn: string | null;
}

export interface SpendRoom {
  /** The average of what came in over the months looked at. */
  incomeMinor: number;
  /** The months averaged, 'YYYY-MM', oldest first. */
  months: string[];
  /** Nothing came in over those months: the figure cannot be worked out. */
  noIncome: boolean;
  savePct: number;
  /** What is set aside for the goals this month. */
  saveMinor: number;
  /** Whether that is the share, or what the dated goals ask (larger). */
  saveFrom: 'percent' | 'goals';
  /** What the goals with a date ask this month, in all. */
  goalsAskMinor: number;
  spentMinor: number;
  payments: RoomPayment[];
  paymentsMinor: number;
  /** What is left for the rest of the month; negative when already over. */
  leftMinor: number;
  perDayMinor: number;
  monthEnd: string;
  daysLeft: number;
}

/** A sum spread over the days left, rounded down to whole hundreds of pesos. */
export function perDayOf(minor: number, days: number): number {
  if (minor <= 0 || days <= 0) return 0;
  return Math.floor(minor / days / 10_000) * 10_000;
}

/** A share kept in settings: any whole percent from 0 to 90, else the default. */
export function savePctOf(value: string | null | undefined): number {
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 && n <= 90 ? n : SAVE_PCT_DEFAULT;
}

export function spendRoom(input: {
  /** What came in each whole month looked at. */
  incomes: readonly { month: string; inMinor: number }[];
  savePct: number;
  goalsAskMinor: number;
  spentMinor: number;
  payments: readonly RoomPayment[];
  today: string;
}): SpendRoom {
  const months = [...input.incomes].sort((a, b) => a.month.localeCompare(b.month));
  const total = months.reduce((sum, m) => sum + Math.max(0, m.inMinor), 0);
  const incomeMinor = months.length > 0 ? Math.round(total / months.length) : 0;
  const share = Math.round(incomeMinor * input.savePct / 100);
  const goalsAskMinor = Math.max(0, input.goalsAskMinor);
  const saveFrom = goalsAskMinor > share ? 'goals' : 'percent';
  const saveMinor = Math.max(share, goalsAskMinor);
  const payments = input.payments.filter(p => p.amountMinor > 0);
  const paymentsMinor = payments.reduce((sum, p) => sum + p.amountMinor, 0);
  const spentMinor = Math.max(0, input.spentMinor);
  const leftMinor = incomeMinor - saveMinor - spentMinor - paymentsMinor;
  const month = monthOf(input.today);
  const last = daysInMonth(month);
  const daysLeft = last - Number(input.today.slice(8, 10)) + 1;
  return {
    incomeMinor, months: months.map(m => m.month), noIncome: incomeMinor <= 0,
    savePct: input.savePct, saveMinor, saveFrom, goalsAskMinor,
    spentMinor, payments, paymentsMinor, leftMinor,
    perDayMinor: perDayOf(leftMinor, daysLeft),
    monthEnd: `${month}-${String(last).padStart(2, '0')}`, daysLeft,
  };
}
