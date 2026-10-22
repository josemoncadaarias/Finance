/**
 * Which debt to pay first, and what paying more each month would do (Jose,
 * 2026-10-19, mockups `40d`-`40g`).
 *
 * The rule, said the way the assistant says it:
 *   1. A card's statement still to pay, first: paid whole, the bank charges
 *      no interest on it.
 *   2. Then the debts that can be finished soon - with the money free today
 *      and what is left over each month (what came in less what went out, on
 *      average), paying them one after another in this order, in at most
 *      `REACH_MONTHS` months - from the highest rate to the lowest (the same
 *      rate: the smaller first, it is finished sooner).
 *   3. A debt too big to finish soon (a mortgage) is never "pay first", however
 *      it costs: it is said apart, with why.
 *
 * What paying more would do is worked out month by month: every debt pays its
 * own installment, and the extra goes to the first of the order; once a debt
 * is finished, its installment joins the extra for the next. A debt said
 * apart keeps its installment and takes no extra.
 *
 * Pure: every figure comes in, already in pesos. Nothing is advised beyond
 * the person's own figures.
 */

import { EA_SCALE } from '../loans/schedule';

/** A debt is "finished soon" when the money free today and what is left over each month pay it in this many months. */
export const REACH_MONTHS = 24;
/** A simulation never runs past this: a debt that would never end is said so. */
const MAX_MONTHS = 600;

export interface DebtIn {
  kind: 'card' | 'loan';
  id: number;
  name: string;
  /** What is owed today, as a positive figure. */
  balanceMinor: number;
  /** E.A. scaled by 1,000,000; null when nothing is known. */
  rateScaled: number | null;
  /** Typed on the card or the loan, or the month's legal maximum taken as a reference. */
  rateFrom: 'typed' | 'reference' | null;
  /** A loan's installment, capital and interest (no insurance); 0 for a card. */
  installmentMinor: number;
  /** A loan's installments still to pay. */
  installmentsLeft: number;
  /** A loan's interest still to pay, as its schedule works it out. */
  interestLeftMinor: number;
  /** A loan's interest if it were paid off today (since its last due date). */
  payoffInterestMinor: number;
  /** A card: what is left of its last statement, and when it is due. */
  statementLeftMinor: number;
  dueOn: string | null;
}

/** The rate of one month from an E.A. */
export function monthlyRate(rateScaled: number): number {
  return Math.pow(1 + rateScaled / EA_SCALE, 1 / 12) - 1;
}

/** What a debt charges in interest this month, at its rate, on what is owed today. */
export function interestThisMonth(debt: DebtIn): number {
  if (debt.rateScaled === null || debt.balanceMinor <= 0) return 0;
  return Math.round(debt.balanceMinor * monthlyRate(debt.rateScaled));
}

/**
 * Months to pay a sum off: 0 when the money free today already covers it,
 * else what is left after it over what is left over each month; Infinity when
 * nothing is left over.
 */
export function monthsToFinish(balanceMinor: number, leftOverPerMonthMinor: number, freeNowMinor = 0): number {
  const rest = balanceMinor - Math.max(0, freeNowMinor);
  if (rest <= 0) return 0;
  if (leftOverPerMonthMinor <= 0) return Infinity;
  return Math.ceil(rest / leftOverPerMonthMinor);
}

export interface Advice {
  /** Card statements still to pay, the soonest first. */
  statements: DebtIn[];
  /** Debts to pay first, in order, each with what paying it today would save. */
  order: { debt: DebtIn; months: number; savingTodayMinor: number }[];
  /** Too big to finish soon: kept apart, each with its months. */
  apart: { debt: DebtIn; months: number }[];
  /** Debts whose rate is not known: cannot be weighed. */
  unknown: DebtIn[];
}

/**
 * Which debt to pay first. `rate` (the avalanche, what is advised): the
 * highest rate first, so the least interest is paid. `balance` (the snowball,
 * offered beside it on Jose's word, 2026-10-22): the smallest first, so a debt
 * is closed sooner, usually at a little more interest.
 */
export function advise(debts: readonly DebtIn[], leftOverPerMonthMinor: number, freeNowMinor = 0, by: 'rate' | 'balance' = 'rate'): Advice {
  const owed = debts.filter(d => d.balanceMinor > 0);
  const statements = owed.filter(d => d.kind === 'card' && d.statementLeftMinor > 0)
    .sort((a, b) => (a.dueOn ?? '9999').localeCompare(b.dueOn ?? '9999'));
  const known = owed.filter(d => d.rateScaled !== null);
  const unknown = owed.filter(d => d.rateScaled === null);
  const byRate = by === 'balance'
    ? [...known].sort((a, b) => (a.balanceMinor - b.balanceMinor) || (b.rateScaled! - a.rateScaled!))
    : [...known].sort((a, b) => (b.rateScaled! - a.rateScaled!) || (a.balanceMinor - b.balanceMinor));
  const order: Advice['order'] = [];
  const apart: Advice['apart'] = [];
  // Paid one after another: each takes what the ones before it left.
  let owedSoFar = statements.reduce((sum, d) => sum + d.statementLeftMinor, 0);
  for (const debt of byRate) {
    // A card's statement is already counted: the rest of what it owes comes on top.
    const adds = debt.balanceMinor - (statements.includes(debt) ? debt.statementLeftMinor : 0);
    const months = monthsToFinish(owedSoFar + adds, leftOverPerMonthMinor, freeNowMinor);
    if (months <= REACH_MONTHS) {
      owedSoFar += adds;
      const saving = debt.kind === 'loan' ? Math.max(0, debt.interestLeftMinor - debt.payoffInterestMinor) : 0;
      order.push({ debt, months, savingTodayMinor: saving });
    } else {
      apart.push({ debt, months });
    }
  }
  return { statements, order, apart, unknown };
}

export interface ExtraResult {
  debt: DebtIn;
  /** Months to finish it paying only its installment, and with the extra. */
  monthsBefore: number;
  monthsAfter: number;
  /** Interest paid in each case; their difference is what is saved. */
  interestBeforeMinor: number;
  interestAfterMinor: number;
  /** Never ends at its installment (it does not cover the interest). */
  endless: boolean;
}

export interface ExtraPlan {
  extraMinor: number;
  /** The debts the extra goes to, in order. */
  results: ExtraResult[];
  savedMinor: number;
}

/**
 * Paying `extraMinor` more each month, in the order given: each debt pays its
 * installment, the extra goes to the first still owed, and a finished debt's
 * installment joins the extra. Loans only - a card has no installment.
 */
export function payMore(order: readonly DebtIn[], extraMinor: number): ExtraPlan {
  const loans = order.filter(d => d.kind === 'loan' && d.rateScaled !== null && d.installmentMinor > 0);
  const before = loans.map(d => alone(d));

  const balance = loans.map(d => d.balanceMinor);
  const interest = loans.map(() => 0);
  const doneAt = loans.map(() => 0);
  for (let month = 1; month <= MAX_MONTHS && balance.some(b => b > 0); month++) {
    let pool = extraMinor;
    loans.forEach((d, i) => {
      if (balance[i] <= 0) { pool += d.installmentMinor; return; }
      const owedInterest = Math.round(balance[i] * monthlyRate(d.rateScaled!));
      interest[i] += owedInterest;
      balance[i] = balance[i] + owedInterest - d.installmentMinor;
      if (balance[i] <= 0) { pool += -balance[i]; balance[i] = 0; doneAt[i] = month; }
    });
    for (let i = 0; i < loans.length && pool > 0; i++) {
      if (balance[i] <= 0) continue;
      const paid = Math.min(pool, balance[i]);
      balance[i] -= paid;
      pool -= paid;
      if (balance[i] <= 0) doneAt[i] = month;
    }
  }
  const results = loans.map((debt, i): ExtraResult => ({
    debt,
    monthsBefore: before[i].months,
    monthsAfter: doneAt[i] || MAX_MONTHS,
    interestBeforeMinor: before[i].interest,
    interestAfterMinor: interest[i],
    endless: before[i].endless,
  }));
  const savedMinor = results.reduce((sum, r) => sum + Math.max(0, r.interestBeforeMinor - r.interestAfterMinor), 0);
  return { extraMinor, results, savedMinor };
}

/** A loan paid at its own installment: months and interest. */
function alone(debt: DebtIn): { months: number; interest: number; endless: boolean } {
  let balance = debt.balanceMinor;
  let interest = 0;
  const rate = monthlyRate(debt.rateScaled!);
  for (let month = 1; month <= MAX_MONTHS; month++) {
    const owed = Math.round(balance * rate);
    interest += owed;
    balance = balance + owed - debt.installmentMinor;
    if (balance <= 0) return { months: month, interest, endless: false };
  }
  return { months: MAX_MONTHS, interest, endless: true };
}

/** The month `months` from today's: "2027-01" from "2026-10-19" and 3. */
export function monthAfter(today: string, months: number): string {
  const [y, m] = today.split('-').map(Number);
  const at = new Date(Date.UTC(y, m - 1 + months, 1));
  return `${at.getUTCFullYear()}-${String(at.getUTCMonth() + 1).padStart(2, '0')}`;
}
