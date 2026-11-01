/**
 * "Puedes gastar hoy" for the ONE account chosen on Inicio (Jose, 2026-11-01,
 * mockups `54a`-`54h`: with one account chosen it showed the figure of all
 * of them). All accounts keep `spendRoom` (51). One account:
 *
 *   - an account income comes into (a salary account): what usually comes
 *     into it a month (its income and the transfers it receives, average of
 *     the last 3 whole months), less the savings share of its income only,
 *     less what already left it this month (spending and transfers to other
 *     accounts), less the payments usually made from it (fixed payments not
 *     seen yet, a card's statement, a loan's installment) - and never more
 *     than it holds free today;
 *   - any other account, fed by transfers or by nothing (a wallet, a savings
 *     pocket): what it holds, less what the goals keep in it and the payments
 *     usually made from it (Jose, the same day: "obvio podemos gastar de ella
 *     normal también");
 *   - a card: what is usually spent with it a month, less what was spent
 *     this month - never more than its available credit, which is the bank's
 *     money, never the person's.
 *
 * Spread over the days left. Pure: every figure comes in, in pesos.
 */

import { daysInMonth, monthOf } from '../limits/limits';
import { perDayOf, type RoomPayment } from './spend-room';

export type AccountRoomMode = 'income' | 'balance' | 'card';

export interface AccountMonth {
  month: string;
  /** Income that came into the account. */
  inMinor: number;
  /** Transfers it received from the person's other accounts. */
  receivedMinor: number;
  /** Spending from it (on a card: purchases, net of refunds). */
  outMinor: number;
}

export interface AccountRoom {
  mode: AccountRoomMode;
  months: string[];
  incomeMinor: number;
  receivedMinor: number;
  /** Income and transfers received, a month. */
  inflowMinor: number;
  savePct: number;
  saveMinor: number;
  /** What already left it this month (a card: what was spent with it). */
  outMinor: number;
  payments: RoomPayment[];
  paymentsMinor: number;
  holdsMinor: number;
  keptMinor: number;
  /** A card: what is usually spent with it a month. */
  usualMinor: number;
  /** The ceiling: what it holds free, or a card's available credit; null for none. */
  capMinor: number | null;
  /** The figure was cut down to that ceiling. */
  capped: boolean;
  /** What it would be without the ceiling. */
  wantedMinor: number;
  leftMinor: number;
  perDayMinor: number;
  monthEnd: string;
  daysLeft: number;
}

const average = (values: readonly number[]) =>
  values.length > 0 ? Math.round(values.reduce((s, v) => s + Math.max(0, v), 0) / values.length) : 0;

export function accountRoom(input: {
  kind: 'money' | 'card';
  months: readonly AccountMonth[];
  savePct: number;
  /** This month so far: spending, and what was sent to other accounts. */
  thisMonth: { outMinor: number; sentMinor: number };
  payments: readonly RoomPayment[];
  holdsMinor: number;
  keptMinor: number;
  /** A card's available credit; null when it has no limit on record. */
  availableMinor?: number | null;
  today: string;
}): AccountRoom {
  const months = [...input.months].sort((a, b) => a.month.localeCompare(b.month));
  const incomeMinor = average(months.map(m => m.inMinor));
  const receivedMinor = average(months.map(m => m.receivedMinor));
  const payments = input.payments.filter(p => p.amountMinor > 0);
  const paymentsMinor = payments.reduce((s, p) => s + p.amountMinor, 0);
  const keptMinor = Math.max(0, Math.min(input.keptMinor, Math.max(0, input.holdsMinor)));
  const month = monthOf(input.today);
  const last = daysInMonth(month);
  const daysLeft = last - Number(input.today.slice(8, 10)) + 1;
  const base = {
    months: months.map(m => m.month), incomeMinor, receivedMinor, inflowMinor: 0,
    savePct: input.savePct, saveMinor: 0, outMinor: 0, payments: [] as RoomPayment[], paymentsMinor: 0,
    holdsMinor: input.holdsMinor, keptMinor: 0, usualMinor: 0, capMinor: null as number | null, capped: false, wantedMinor: 0,
    monthEnd: `${month}-${String(last).padStart(2, '0')}`, daysLeft,
  };
  const done = (room: Omit<AccountRoom, 'perDayMinor'>): AccountRoom => ({ ...room, perDayMinor: perDayOf(room.leftMinor, daysLeft) });

  if (input.kind === 'card') {
    const usualMinor = average(months.map(m => m.outMinor));
    const outMinor = Math.max(0, input.thisMonth.outMinor);
    const wanted = usualMinor - outMinor;
    const cap = input.availableMinor ?? null;
    const capped = cap !== null && cap < wanted;
    return done({ ...base, mode: 'card', usualMinor, outMinor, capMinor: cap, capped, wantedMinor: wanted, leftMinor: capped ? Math.max(cap, 0) : wanted });
  }

  const free = input.holdsMinor - keptMinor - paymentsMinor;
  if (incomeMinor > 0) {
    const inflowMinor = incomeMinor + receivedMinor;
    const saveMinor = Math.round(incomeMinor * input.savePct / 100);
    const outMinor = Math.max(0, input.thisMonth.outMinor) + Math.max(0, input.thisMonth.sentMinor);
    const wanted = inflowMinor - saveMinor - outMinor - paymentsMinor;
    const capped = free < wanted;
    return done({
      ...base, mode: 'income', inflowMinor, saveMinor, outMinor, payments, paymentsMinor, keptMinor,
      capMinor: free, capped, wantedMinor: wanted, leftMinor: capped ? free : wanted,
    });
  }
  return done({ ...base, mode: 'balance', payments, paymentsMinor, keptMinor, wantedMinor: free, leftMinor: free });
}
