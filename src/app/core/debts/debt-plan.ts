/**
 * "Salir de tus deudas": a plan for several debts (Jose, 2026-10-29, mockups
 * `48a`-`48l`).
 *
 * Every debt keeps its own monthly payment - a loan its installment, a card
 * what the person usually pays it - and an extra the person chooses goes to
 * the first of an order; once a debt is finished, what was paid on it joins
 * the extra for the next one. Two orders:
 *   - `rate` ("Pagar menos intereses", recommended): the highest rate first;
 *   - `balance` ("Cerrar una pronto"): the smallest first.
 * It is compared with the same plan putting nothing extra in: every debt its
 * own payment, a finished one's payment still moving to the next. So the only
 * difference said is what the extra does.
 *
 * A loan with more than `APART_MONTHS` installments left (a mortgage) keeps
 * its installment and takes nothing: it is said apart.
 *
 * Pure: every figure comes in, already in pesos. Nothing is advised beyond
 * the person's own figures.
 */

import { monthlyRate } from '../assistant/debts-advice';

/** A loan with more installments left than this is too big to finish soon. */
export const APART_MONTHS = 120;
/** No simulation runs past fifty years: such a debt "does not end". */
const MAX_MONTHS = 600;

export interface PlanDebt {
  kind: 'card' | 'loan';
  id: number;
  name: string;
  balanceMinor: number;
  /** E.A. scaled by 1,000,000; never null here (a debt without one is weighed at a reference). */
  rateScaled: number;
  rateFrom: 'typed' | 'reference';
  /** What it is paid each month: a loan's installment, a card's usual payment. */
  paymentMinor: number;
  /** Where that payment came from: a card with no payment on record gets an estimate. */
  paymentFrom: 'installment' | 'usual' | 'estimated';
  /** A loan's installments left; 0 for a card. */
  installmentsLeft: number;
}

export interface PlanStep {
  debt: PlanDebt;
  /** Months from now to its last payment (1 = next month); MAX_MONTHS when it never ends. */
  months: number;
  interestMinor: number;
  /** Paying only its own payment, it never ends: it does not cover its interest. */
  endlessAlone: boolean;
  monthsAlone: number;
}

export interface Plan {
  by: 'rate' | 'balance';
  extraMinor: number;
  steps: PlanStep[];
  /** Too big to finish soon: each keeps its installment. */
  apart: PlanDebt[];
  /** Months until the last debt of the order is finished; MAX_MONTHS when never. */
  months: number;
  interestMinor: number;
  /** The same plan with nothing extra: what the extra is compared with. */
  baseMonths: number;
  baseInterestMinor: number;
  /** With nothing extra it never ends: the comparison has no end either. */
  baseEndless: boolean;
  savedMinor: number;
  soonerMonths: number;
  /** The plan never ends: what is paid does not cover the interest. */
  endless: boolean;
}

/** The estimate for a card with no payment on record: its month's interest and 1/24 of what it owes. */
export function estimatedCardPayment(balanceMinor: number, rateScaled: number): number {
  return Math.round(balanceMinor * monthlyRate(rateScaled) + balanceMinor / 24);
}

/** The order of the plan. */
export function orderOf(debts: readonly PlanDebt[], by: 'rate' | 'balance'): PlanDebt[] {
  return [...debts].sort(by === 'rate'
    ? (a, b) => (b.rateScaled - a.rateScaled) || (a.balanceMinor - b.balanceMinor)
    : (a, b) => (a.balanceMinor - b.balanceMinor) || (b.rateScaled - a.rateScaled));
}

/** Which debts the plan works with, and which are kept apart. */
export function splitApart(debts: readonly PlanDebt[]): { inPlan: PlanDebt[]; apart: PlanDebt[] } {
  const owed = debts.filter(d => d.balanceMinor > 0);
  const apart = owed.filter(d => d.kind === 'loan' && d.installmentsLeft > APART_MONTHS);
  return { inPlan: owed.filter(d => !apart.includes(d)), apart };
}

/** One debt paid only its own payment. */
function alone(debt: PlanDebt): { months: number; interest: number; endless: boolean } {
  let balance = debt.balanceMinor;
  let interest = 0;
  const rate = monthlyRate(debt.rateScaled);
  for (let month = 1; month <= MAX_MONTHS; month++) {
    const owed = Math.round(balance * rate);
    interest += owed;
    balance = balance + owed - debt.paymentMinor;
    if (balance <= 0) return { months: month, interest, endless: false };
  }
  return { months: MAX_MONTHS, interest, endless: true };
}

/** The plan for these debts, this extra each month and this order. */
export function planDebts(debts: readonly PlanDebt[], extraMinor: number, by: 'rate' | 'balance'): Plan {
  const { inPlan, apart } = splitApart(debts);
  const order = orderOf(inPlan, by);
  const balance = order.map(d => d.balanceMinor);
  const interest = order.map(() => 0);
  const doneAt = order.map(() => 0);
  const extra = Math.max(0, extraMinor);
  for (let month = 1; month <= MAX_MONTHS && balance.some(b => b > 0); month++) {
    let pool = extra;
    order.forEach((d, i) => {
      if (balance[i] <= 0) { pool += d.paymentMinor; return; }
      const owed = Math.round(balance[i] * monthlyRate(d.rateScaled));
      interest[i] += owed;
      balance[i] = balance[i] + owed - d.paymentMinor;
      if (balance[i] <= 0) { pool += -balance[i]; balance[i] = 0; doneAt[i] = month; }
    });
    for (let i = 0; i < order.length && pool > 0; i++) {
      if (balance[i] <= 0) continue;
      const paid = Math.min(pool, balance[i]);
      balance[i] -= paid;
      pool -= paid;
      if (balance[i] <= 0) doneAt[i] = month;
    }
  }
  const steps = order.map((debt, i): PlanStep => {
    const a = alone(debt);
    return { debt, months: doneAt[i] || MAX_MONTHS, interestMinor: interest[i], endlessAlone: a.endless, monthsAlone: a.months };
  });
  const months = steps.reduce((most, s) => Math.max(most, s.months), 0);
  const interestMinor = steps.reduce((sum, s) => sum + s.interestMinor, 0);
  const endless = months >= MAX_MONTHS;
  const base = extra > 0 ? planDebts(debts, 0, by) : null;
  const baseMonths = base ? base.months : months;
  const baseInterestMinor = base ? base.interestMinor : interestMinor;
  const baseEndless = base ? base.endless : endless;
  return {
    by, extraMinor: extra, steps, apart, months, interestMinor, baseMonths, baseInterestMinor, baseEndless,
    savedMinor: baseEndless || endless ? 0 : Math.max(0, baseInterestMinor - interestMinor),
    soonerMonths: baseEndless || endless ? 0 : Math.max(0, baseMonths - months),
    endless,
  };
}

/** What several extras each get: "Con más, sales antes" (48e). */
export function extraChoices(debts: readonly PlanDebt[], by: 'rate' | 'balance', extras: readonly number[]): Plan[] {
  return extras.map(extra => planDebts(debts, extra, by));
}

/** The extras offered beside the one chosen: round figures around what is left over. */
export function extrasToOffer(leftOverMinor: number): number[] {
  const base = [10_000_000, 30_000_000, 50_000_000, 100_000_000];
  if (leftOverMinor > 100_000_000) base.push(Math.floor(leftOverMinor / 5_000_000) * 5_000_000);
  return [...new Set(base)].sort((a, b) => a - b);
}

/** What the plan suggests putting in, before the person says: half of what is left over, in steps of 50,000. */
export function suggestedExtra(leftOverMinor: number): number {
  return Math.max(0, Math.floor(leftOverMinor / 2 / 5_000_000) * 5_000_000);
}
