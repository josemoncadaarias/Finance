/**
 * A loan's schedule, worked out from what was agreed and what was paid
 * (debts, part 2; Jose, 2026-10-01). Nothing here is stored: the terms, the
 * rate history and the payments are, and this walks them every time.
 *
 * - The rate is kept as E.A. and turned into the period's rate as
 *   (1 + E.A.) ^ (months / 12) - 1, the rate in force when the period began.
 * - Fixed installment (French): the installment stays the same; it is worked
 *   out again only when the rate changes or a payment ahead asks for a lower
 *   installment. Constant capital: the same capital each time, interest on
 *   top, so the installment falls.
 * - The installments a loan had before the app are a record: their figures
 *   come from the original schedule, and what was owed after them is the
 *   figure the person stated, when they stated one.
 * - A paid installment carries what was really paid; the schedule continues
 *   from the balance it left. One not paid whose day has passed is overdue.
 * - A payment ahead is applied after the last installment due on or before
 *   its day, and either keeps the installment (a shorter term) or keeps the
 *   term (a lower installment) - the debtor's choice (Ley 1555 de 2012).
 * - One paid between two installments is liquidated to its day (the
 *   Superfinanciera): the next installment's interest is the balance before
 *   it for the days up to the payment, plus the balance after it for the
 *   rest, each at the daily rate (1 + E.A.) ^ (1 / 365) - 1. A payment on an
 *   installment's own day changes nothing in how that period is counted.
 * - Insurance is a fixed figure per installment or a monthly share of what is
 *   still owed (seguro de vida deudor falls with the balance).
 *
 * Money is in minor units; every interest is rounded to the cent. The
 * bank's own figures can differ by a few pesos, and the typed ones win.
 */

import type { UvrLookup, UvrValue } from './uvr';

export const EA_SCALE = 1_000_000;
/** A loan in UVR runs in millionths of a UVR. */
export const UVR_MICRO = 1_000_000;

export type LoanSystem = 'fixed_installment' | 'constant_capital';
export type ExtraMode = 'term' | 'installment';

export interface LoanTerms {
  principalMinor: number;
  system: LoanSystem;
  installments: number;
  periodMonths: number;
  disbursedOn: string;
  firstDueOn: string;
  insuranceKind: 'fixed' | 'balance';
  insuranceMinor: number;
  /** Monthly share of the balance, scaled by 1,000,000. */
  insuranceRateScaled: number;
  /** The installment the bank states, insurance included. */
  bankInstallmentMinor: number | null;
  paidBefore: number;
  balanceAfterBeforeMinor: number | null;
  /** E.A. history, any order. */
  rates: { validFrom: string; annualRateScaled: number }[];
  /**
   * A loan in UVR: the schedule runs in UVR and is shown in pesos at each
   * day's UVR. Its stated balance and installment (balanceAfterBeforeMinor,
   * bankInstallmentMinor) are then in millionths of a UVR; the principal and
   * the insurance stay in pesos, as the bank states them.
   */
  unit?: 'COP' | 'UVR';
  /**
   * Cyclic decreasing installment (UVR): the yearly rate the installment
   * falls by inside each year, scaled by 1,000,000. Null for every other.
   */
  decreaseScaled?: number | null;
  /** The UVR of a day, for a loan in UVR. */
  uvr?: UvrLookup;
}

export interface LoanPayment {
  kind: 'installment' | 'extra' | 'payoff';
  number: number | null;
  paidOn: string;
  capitalMinor: number;
  interestMinor: number;
  insuranceMinor: number;
  lateMinor: number;
  extraMode: ExtraMode | null;
  /** For a loan in UVR: the capital paid, in millionths of a UVR. */
  capitalUvrMicro?: number | null;
}

/** A payment ahead not made yet, to see what it would do. */
export interface PlannedExtra {
  amountMinor: number;
  mode: ExtraMode;
  /** Once with the next installment, after every one, or in June and December. */
  every: 'once' | 'monthly' | 'primas';
}

export type RowState = 'before' | 'paid' | 'overdue' | 'next' | 'future';

export interface InstallmentRow {
  type: 'installment';
  number: number;
  dueOn: string;
  capitalMinor: number;
  interestMinor: number;
  insuranceMinor: number;
  lateMinor: number;
  /** Capital, interest, insurance and default interest. */
  totalMinor: number;
  balanceAfterMinor: number;
  state: RowState;
  /** For a loan in UVR: the same installment in UVR, and the UVR it was turned into pesos at. */
  uvr?: InstallmentUvr;
}

export interface InstallmentUvr {
  value: number;
  kind: UvrValue['kind'];
  capital: number;
  interest: number;
  /** Capital and interest: the installment as the bank states it in UVR. */
  installment: number;
  balanceAfter: number;
}

export interface ExtraRow {
  type: 'extra';
  paidOn: string;
  amountMinor: number;
  mode: ExtraMode | 'payoff';
  planned: boolean;
  balanceAfterMinor: number;
}

export type ScheduleRow = InstallmentRow | ExtraRow;

export interface LoanSchedule {
  rows: ScheduleRow[];
  /** What is owed today, after everything recorded. */
  balanceMinor: number;
  paidCount: number;
  /** Installments in the schedule, paid and still to pay. */
  totalCount: number;
  next: InstallmentRow | null;
  overdue: InstallmentRow[];
  lastDueOn: string | null;
  capitalPaidMinor: number;
  interestPaidMinor: number;
  interestLeftMinor: number;
  insuranceLeftMinor: number;
  /** Interest over the whole life: paid and still to pay. */
  interestTotalMinor: number;
  insuranceTotalMinor: number;
  /** What is still to pay from today: installments, insurance and planned payments ahead. */
  toPayMinor: number;
  /** The installment due next, as the schedule works it out. */
  installmentMinor: number;
  done: boolean;
  /** For a loan in UVR: today's UVR and what is owed in UVR. */
  uvrToday?: UvrValue | null;
  balanceUvr?: number;
}

/** The installment of a French loan, capital and interest. */
export function annuity(balanceMinor: number, rate: number, count: number): number {
  if (count <= 0) return balanceMinor;
  if (rate === 0) return Math.round(balanceMinor / count);
  return Math.round(balanceMinor * rate / (1 - Math.pow(1 + rate, -count)));
}

/** The rate of one period from an E.A. */
export function periodRate(annualRateScaled: number, periodMonths: number): number {
  return Math.pow(1 + annualRateScaled / EA_SCALE, periodMonths / 12) - 1;
}

/** The E.A. that a monthly rate (M.V.) amounts to, scaled. */
export function eaFromMonthly(monthlyScaled: number): number {
  return Math.round((Math.pow(1 + monthlyScaled / EA_SCALE, 12) - 1) * EA_SCALE);
}

export function monthlyFromEa(annualRateScaled: number): number {
  return Math.round(periodRate(annualRateScaled, 1) * EA_SCALE);
}

/** The day of installment `number`: the first one's day, `periodMonths` apart, clamped to short months. */
export function dueDate(firstDueOn: string, periodMonths: number, number: number): string {
  const [y, m, d] = firstDueOn.split('-').map(Number);
  const at = new Date(Date.UTC(y, m - 1 + (number - 1) * periodMonths, 1));
  const last = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth() + 1, 0)).getUTCDate();
  return `${at.getUTCFullYear()}-${pad(at.getUTCMonth() + 1)}-${pad(Math.min(d, last))}`;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function rateOn(terms: LoanTerms, day: string): number {
  const sorted = [...terms.rates].sort((a, b) => a.validFrom.localeCompare(b.validFrom));
  let rate = sorted[0]?.annualRateScaled ?? 0;
  for (const r of sorted) if (r.validFrom <= day) rate = r.annualRateScaled;
  return rate;
}

function insuranceFor(terms: LoanTerms, balanceMinor: number): number {
  return terms.insuranceKind === 'fixed'
    ? terms.insuranceMinor
    : Math.round(balanceMinor * terms.insuranceRateScaled * terms.periodMonths / EA_SCALE);
}

/** The installment of a French loan, unrounded: the level a cyclic installment is set from. */
function annuityExact(balance: number, rate: number, count: number): number {
  if (count <= 0) return balance;
  if (rate === 0) return balance / count;
  return balance * rate / (1 - Math.pow(1 + rate, -count));
}

/**
 * Cyclic decreasing installment (UVR; Superfinanciera): inside each year the
 * installment falls by the same factor every period, and each year starts
 * at the level that leaves the same balance at its end as the constant
 * installment would. So the first one of `left` periods is the constant
 * installment times sum(v^k) / sum(v^k g^(k-1)).
 */
function decreaseOf(terms: LoanTerms): number | null {
  if (terms.system !== 'fixed_installment' || !terms.decreaseScaled) return null;
  return 1 - (Math.pow(1 + terms.decreaseScaled / EA_SCALE, terms.periodMonths / 12) - 1);
}

function cycleLength(terms: LoanTerms): number {
  return Math.max(1, Math.round(12 / terms.periodMonths));
}

function cycleShare(rate: number, left: number, g: number): number {
  const v = 1 / (1 + rate);
  let plain = 0;
  let falling = 0;
  for (let k = 1; k <= left; k++) {
    plain += Math.pow(v, k);
    falling += Math.pow(v, k) * Math.pow(g, k - 1);
  }
  return plain / falling;
}

/**
 * The capital-and-interest installment of a fixed or cyclic loan, period by
 * period. `level` is the constant installment the cycle is set against;
 * `restart` sets it again (a new rate, a payment ahead lowering the
 * installment) from the period about to be counted.
 */
class Pace {
  private level: number;
  private anchor = 1;
  private pending = false;
  readonly g: number | null;
  private readonly length: number;

  constructor(terms: LoanTerms, level: number) {
    this.g = decreaseOf(terms);
    this.length = cycleLength(terms);
    this.level = level;
  }

  /** The installment of `number`, capital and interest. */
  at(number: number, rate: number): number {
    if (this.g === null) return Math.round(this.level);
    const k = ((number - 1) % this.length) + 1;
    if (k === 1) this.anchor = 1;
    if (this.pending) { this.anchor = k; this.pending = false; }
    return Math.round(this.level * cycleShare(rate, this.length - this.anchor + 1, this.g) * Math.pow(this.g, k - this.anchor));
  }

  /** A new constant installment from the next period on. */
  restart(balance: number, rate: number, remaining: number): void {
    this.level = this.g === null ? annuity(balance, rate, remaining) : annuityExact(balance, rate, remaining);
    this.pending = true;
  }
}

/** The capital-and-interest installment the person agreed, if the bank's figure says it. */
function agreedPayment(terms: LoanTerms): number | null {
  if (decreaseOf(terms) !== null) return null;
  if (terms.bankInstallmentMinor === null || (terms.unit !== 'UVR' && terms.insuranceKind !== 'fixed')) return null;
  if (terms.unit === 'UVR') return terms.bankInstallmentMinor;
  const pay = terms.bankInstallmentMinor - terms.insuranceMinor;
  return pay > 0 ? pay : null;
}

/** The original schedule's balance after `count` installments, nothing paid ahead. */
function theoretical(terms: LoanTerms, count: number): { balance: number; rows: InstallmentRow[] } {
  let balance = terms.principalMinor;
  let previous = terms.disbursedOn;
  let rateScaled = rateOn(terms, previous);
  let rate = periodRate(rateScaled, terms.periodMonths);
  const pace = new Pace(terms, agreedPayment(terms) ?? (decreaseOf(terms) !== null
    ? annuityExact(balance, rate, terms.installments) : annuity(balance, rate, terms.installments)));
  const capitalEach = Math.round(terms.principalMinor / terms.installments);
  const rows: InstallmentRow[] = [];
  for (let number = 1; number <= count && balance > 0; number++) {
    const dueOn = dueDate(terms.firstDueOn, terms.periodMonths, number);
    const nowRate = rateOn(terms, previous);
    if (nowRate !== rateScaled) {
      rateScaled = nowRate;
      rate = periodRate(rateScaled, terms.periodMonths);
      pace.restart(balance, rate, terms.installments - number + 1);
    }
    const pay = pace.at(number, rate);
    const interest = Math.round(balance * rate);
    const insurance = insuranceFor(terms, balance);
    let capital = terms.system === 'constant_capital' ? capitalEach : pay - interest;
    if (number === terms.installments || capital > balance || balance - capital < 100) capital = balance;
    balance -= capital;
    rows.push({
      type: 'installment', number, dueOn, capitalMinor: capital, interestMinor: interest,
      insuranceMinor: insurance, lateMinor: 0, totalMinor: capital + interest + insurance,
      balanceAfterMinor: balance, state: 'before',
    });
    previous = dueOn;
  }
  return { balance, rows };
}

export function loanSchedule(terms: LoanTerms, payments: LoanPayment[], today: string, planned: PlannedExtra | null = null): LoanSchedule {
  return terms.unit === 'UVR' ? uvrSchedule(terms, payments, today, planned) : walk(terms, payments, today, planned);
}

/** The schedule in the loan's own unit: pesos in minor units, or millionths of a UVR. */
function walk(terms: LoanTerms, payments: LoanPayment[], today: string, planned: PlannedExtra | null = null): LoanSchedule {
  const before = theoretical(terms, terms.paidBefore);
  const rows: ScheduleRow[] = [...before.rows];
  let balance = terms.paidBefore > 0 ? (terms.balanceAfterBeforeMinor ?? before.balance) : terms.principalMinor;

  const byNumber = new Map<number, LoanPayment>();
  for (const p of payments) if (p.kind === 'installment' && p.number !== null) byNumber.set(p.number, p);
  const extras = payments.filter(p => p.kind !== 'installment').sort((a, b) => a.paidOn.localeCompare(b.paidOn));

  let previous = terms.paidBefore > 0 ? dueDate(terms.firstDueOn, terms.periodMonths, terms.paidBefore) : terms.disbursedOn;
  let rateScaled = rateOn(terms, previous);
  let rate = periodRate(rateScaled, terms.periodMonths);
  const firstRate = periodRate(rateOn(terms, terms.disbursedOn), terms.periodMonths);
  const pace = new Pace(terms, agreedPayment(terms) ?? (decreaseOf(terms) !== null
    ? annuityExact(terms.principalMinor, firstRate, terms.installments) : annuity(terms.principalMinor, firstRate, terms.installments)));
  if (rateScaled !== rateOn(terms, terms.disbursedOn)) pace.restart(balance, rate, terms.installments - terms.paidBefore);
  let capitalEach = Math.round(balance / Math.max(1, terms.installments - terms.paidBefore));
  let lastNumber = terms.installments;

  // Payments ahead made inside the period now running: the balance before
  // each and its day, so the next installment's interest counts the days.
  let pieces: { on: string; balanceBefore: number }[] = [];
  let periodStart = previous;

  // Payments ahead made before the first installment the walk sees.
  let extraAt = 0;
  const applyExtra = (amount: number, mode: ExtraMode | 'payoff', paidOn: string, planned: boolean, afterNumber: number) => {
    const taken = Math.min(amount, balance);
    if (taken <= 0) return;
    if (!planned && paidOn > periodStart) pieces.push({ on: paidOn, balanceBefore: balance });
    balance -= taken;
    rows.push({ type: 'extra', paidOn, amountMinor: taken, mode, planned, balanceAfterMinor: balance });
    const remaining = lastNumber - afterNumber;
    if (mode === 'installment' && remaining > 0) {
      if (terms.system === 'fixed_installment') pace.restart(balance, rate, remaining);
      else capitalEach = Math.round(balance / remaining);
    }
  };
  while (extraAt < extras.length && extras[extraAt].paidOn < dueDate(terms.firstDueOn, terms.periodMonths, terms.paidBefore + 1)) {
    const e = extras[extraAt++];
    applyExtra(e.capitalMinor, e.kind === 'payoff' ? 'payoff' : (e.extraMode ?? 'term'), e.paidOn, false, terms.paidBefore);
  }

  let next: InstallmentRow | null = null;
  let plannedDone = false;
  const overdue: InstallmentRow[] = [];
  let paidCount = terms.paidBefore;
  let interestPaid = before.rows.reduce((s, r) => s + r.interestMinor, 0);
  let interestLeft = 0;
  let insuranceLeft = 0;
  let insuranceTotal = before.rows.reduce((s, r) => s + r.insuranceMinor, 0);
  let toPay = 0;

  for (let number = terms.paidBefore + 1; number <= 600 && balance > 0; number++) {
    const dueOn = dueDate(terms.firstDueOn, terms.periodMonths, number);
    const nowRate = rateOn(terms, previous);
    if (nowRate !== rateScaled) {
      rateScaled = nowRate;
      rate = periodRate(rateScaled, terms.periodMonths);
      if (terms.system === 'fixed_installment') pace.restart(balance, rate, Math.max(1, lastNumber - number + 1));
    }
    const pay = pace.at(number, rate);
    const paid = byNumber.get(number);
    let row: InstallmentRow;
    if (paid) {
      const capital = Math.min(paid.capitalMinor, balance);
      balance -= capital;
      paidCount++;
      interestPaid += paid.interestMinor;
      insuranceTotal += paid.insuranceMinor;
      row = {
        type: 'installment', number, dueOn, capitalMinor: capital, interestMinor: paid.interestMinor,
        insuranceMinor: paid.insuranceMinor, lateMinor: paid.lateMinor,
        totalMinor: capital + paid.interestMinor + paid.insuranceMinor + paid.lateMinor,
        balanceAfterMinor: balance, state: 'paid',
      };
    } else {
      const interest = pieces.length > 0
        ? splitInterest(pieces, periodStart, dueOn, balance, rateScaled)
        : Math.round(balance * rate);
      const insurance = insuranceFor(terms, balance);
      let capital = terms.system === 'constant_capital' ? capitalEach : pay - interest;
      if (capital <= 0) capital = Math.min(balance, 1);
      if (capital > balance || balance - capital < 100 || (terms.system === 'constant_capital' && number >= lastNumber)) capital = balance;
      balance -= capital;
      interestLeft += interest;
      insuranceLeft += insurance;
      insuranceTotal += insurance;
      toPay += capital + interest + insurance;
      const state: RowState = dueOn < today ? 'overdue' : next === null ? 'next' : 'future';
      row = {
        type: 'installment', number, dueOn, capitalMinor: capital, interestMinor: interest,
        insuranceMinor: insurance, lateMinor: 0, totalMinor: capital + interest + insurance,
        balanceAfterMinor: balance, state,
      };
      if (state === 'overdue') overdue.push(row);
      if (state === 'next') next = row;
    }
    rows.push(row);
    pieces = [];
    periodStart = dueOn;

    // Recorded payments ahead up to the next installment's day.
    const nextDue = dueDate(terms.firstDueOn, terms.periodMonths, number + 1);
    while (extraAt < extras.length && extras[extraAt].paidOn < nextDue) {
      const e = extras[extraAt++];
      applyExtra(e.capitalMinor, e.kind === 'payoff' ? 'payoff' : (e.extraMode ?? 'term'), e.paidOn, false, number);
    }
    // A planned payment ahead goes with installments not yet paid.
    if (planned && !paid && balance > 0) {
      const month = Number(dueOn.slice(5, 7));
      const fits = planned.every === 'monthly'
        || (planned.every === 'primas' && (month === 6 || month === 12))
        || (planned.every === 'once' && !plannedDone);
      if (fits) {
        const amount = Math.min(planned.amountMinor, balance);
        toPay += amount;
        applyExtra(amount, planned.mode, dueOn, true, number);
        plannedDone = true;
      }
    }
    previous = dueOn;
  }

  const installments = rows.filter((r): r is InstallmentRow => r.type === 'installment');
  const owed = currentBalance(terms, before.balance, payments);
  const firstOpen = installments.find(r => r.state !== 'before' && r.state !== 'paid') ?? null;
  return {
    rows,
    balanceMinor: owed,
    paidCount,
    totalCount: installments.length,
    next: overdue[0] ?? next,
    overdue,
    lastDueOn: installments.at(-1)?.dueOn ?? null,
    capitalPaidMinor: terms.principalMinor - owed,
    interestPaidMinor: interestPaid,
    interestLeftMinor: interestLeft,
    insuranceLeftMinor: insuranceLeft,
    interestTotalMinor: interestPaid + interestLeft,
    insuranceTotalMinor: insuranceTotal,
    toPayMinor: toPay,
    installmentMinor: firstOpen ? firstOpen.totalMinor : 0,
    done: owed <= 0,
  };
}

/**
 * A period's interest when capital was paid inside it: each stretch between
 * payments at the balance it held, at the daily rate of the E.A.
 */
export function splitInterest(pieces: readonly { on: string; balanceBefore: number }[], from: string, to: string, balanceAfter: number, annualRateScaled: number): number {
  const daily = Math.pow(1 + annualRateScaled / EA_SCALE, 1 / 365) - 1;
  let total = 0;
  let cursor = from;
  for (const piece of pieces) {
    total += piece.balanceBefore * (Math.pow(1 + daily, days(cursor, piece.on)) - 1);
    cursor = piece.on;
  }
  total += balanceAfter * (Math.pow(1 + daily, days(cursor, to)) - 1);
  return Math.round(total);
}

/**
 * A loan in UVR: the schedule is walked in millionths of a UVR - the rate
 * is the real one, over the UVR - and every figure is then turned into pesos
 * at the UVR of its own day: an installment at its due date's, what is owed
 * at today's. A paid installment shows what was paid. Insurance is in pesos,
 * fixed or a share of the balance in pesos.
 */
function uvrSchedule(terms: LoanTerms, payments: LoanPayment[], today: string, planned: PlannedExtra | null): LoanSchedule {
  const lookup = terms.uvr ?? (() => null);
  const fallback = lookup(today)?.value ?? 1;
  const value = (day: string) => lookup(day)?.value ?? fallback;
  const toUnits = (pesosMinor: number, day: string) => Math.round(pesosMinor / 100 / value(day) * UVR_MICRO);
  const toPesos = (units: number, day: string) => Math.round(units / UVR_MICRO * value(day) * 100);
  const uvrOf = (units: number) => units / UVR_MICRO;

  const unitTerms: LoanTerms = {
    ...unitTermsOf(terms, value),
  };
  const unitPayments = payments.map(p => ({
    ...p,
    capitalMinor: p.capitalUvrMicro ?? toUnits(p.capitalMinor, p.paidOn),
    interestMinor: toUnits(p.interestMinor, p.paidOn),
    insuranceMinor: 0,
    lateMinor: 0,
  }));
  const unitPlanned = planned ? { ...planned, amountMinor: toUnits(planned.amountMinor, today) } : null;
  const u = walk(unitTerms, unitPayments, today, unitPlanned);

  const paidByNumber = new Map<number, LoanPayment>();
  for (const p of payments) if (p.kind === 'installment' && p.number !== null) paidByNumber.set(p.number, p);

  let interestPaid = 0, interestLeft = 0, insuranceLeft = 0, insuranceTotal = 0, toPay = 0, capitalPaid = 0;
  const rows: ScheduleRow[] = u.rows.map(row => {
    if (row.type === 'extra') {
      const amount = toPesos(row.amountMinor, row.paidOn);
      if (row.planned) toPay += amount; else capitalPaid += amount;
      return { ...row, amountMinor: amount, balanceAfterMinor: toPesos(row.balanceAfterMinor, row.paidOn) };
    }
    const at = lookup(row.dueOn) ?? { value: fallback, kind: 'projected' as const };
    const uvr: InstallmentUvr = {
      value: at.value, kind: at.kind,
      capital: uvrOf(row.capitalMinor), interest: uvrOf(row.interestMinor),
      installment: uvrOf(row.capitalMinor + row.interestMinor), balanceAfter: uvrOf(row.balanceAfterMinor),
    };
    const paid = row.state === 'paid' ? paidByNumber.get(row.number) : undefined;
    if (paid) {
      interestPaid += paid.interestMinor;
      insuranceTotal += paid.insuranceMinor;
      capitalPaid += paid.capitalMinor;
      return {
        ...row, capitalMinor: paid.capitalMinor, interestMinor: paid.interestMinor, insuranceMinor: paid.insuranceMinor,
        lateMinor: paid.lateMinor, totalMinor: paid.capitalMinor + paid.interestMinor + paid.insuranceMinor + paid.lateMinor,
        balanceAfterMinor: toPesos(row.balanceAfterMinor, row.dueOn), uvr,
      };
    }
    const capital = toPesos(row.capitalMinor, row.dueOn);
    const interest = toPesos(row.interestMinor, row.dueOn);
    const before = toPesos(row.balanceAfterMinor + row.capitalMinor, row.dueOn);
    const insurance = insuranceFor(terms, before);
    insuranceTotal += insurance;
    if (row.state === 'before') {
      interestPaid += interest;
      capitalPaid += capital;
    } else {
      interestLeft += interest;
      insuranceLeft += insurance;
      toPay += capital + interest + insurance;
    }
    return {
      ...row, capitalMinor: capital, interestMinor: interest, insuranceMinor: insurance,
      totalMinor: capital + interest + insurance, balanceAfterMinor: toPesos(row.balanceAfterMinor, row.dueOn), uvr,
    };
  });

  const installments = rows.filter((r): r is InstallmentRow => r.type === 'installment');
  const byNumber = new Map(installments.map(r => [r.number, r]));
  const overdue = u.overdue.map(r => byNumber.get(r.number)!);
  const next = u.next ? byNumber.get(u.next.number) ?? null : null;
  const firstOpen = installments.find(r => r.state !== 'before' && r.state !== 'paid') ?? null;
  return {
    rows,
    balanceMinor: toPesos(u.balanceMinor, today),
    paidCount: u.paidCount,
    totalCount: u.totalCount,
    next,
    overdue,
    lastDueOn: u.lastDueOn,
    capitalPaidMinor: capitalPaid,
    interestPaidMinor: interestPaid,
    interestLeftMinor: interestLeft,
    insuranceLeftMinor: insuranceLeft,
    interestTotalMinor: interestPaid + interestLeft,
    insuranceTotalMinor: insuranceTotal,
    toPayMinor: toPay,
    installmentMinor: firstOpen ? firstOpen.totalMinor : 0,
    done: u.done,
    uvrToday: lookup(today),
    balanceUvr: uvrOf(u.balanceMinor),
  };
}

/** A loan in UVR as the walk sees it: the principal in UVR, no insurance (it is in pesos). */
function unitTermsOf(terms: LoanTerms, value: (day: string) => number): LoanTerms {
  return {
    ...terms,
    principalMinor: Math.round(terms.principalMinor / 100 / value(terms.disbursedOn) * UVR_MICRO),
    insuranceKind: 'fixed', insuranceMinor: 0, insuranceRateScaled: 0, uvr: undefined,
  };
}

/** What is owed after everything recorded, whatever the projection says. */
function currentBalance(terms: LoanTerms, theoreticalBefore: number, payments: LoanPayment[]): number {
  let balance = terms.paidBefore > 0 ? (terms.balanceAfterBeforeMinor ?? theoreticalBefore) : terms.principalMinor;
  for (const p of payments) balance -= p.capitalMinor;
  return Math.max(0, balance);
}

/**
 * Paying the whole loan today: what is owed plus the interest of the days
 * since the last installment, at the period's rate. Approximate - the bank's
 * figure is the one that counts.
 */
export function payoffToday(terms: LoanTerms, payments: LoanPayment[], today: string): { balanceMinor: number; interestMinor: number; totalMinor: number; sinceOn: string } {
  const schedule = loanSchedule(terms, payments, today);
  const installments = schedule.rows.filter((r): r is InstallmentRow => r.type === 'installment');
  const lastDue = [...installments].reverse().find(r => r.dueOn <= today)?.dueOn ?? terms.disbursedOn;
  const nextDue = installments.find(r => r.dueOn > today)?.dueOn ?? today;
  const rate = periodRate(rateOn(terms, lastDue), terms.periodMonths);
  const span = Math.max(1, days(lastDue, nextDue));
  // Capital paid since the last installment earned interest until its day.
  const growth = (from: string, to: string) => Math.pow(1 + rate, days(from, to) / span) - 1;
  const since = payments.filter(p => p.kind !== 'installment' && p.paidOn > lastDue && p.paidOn <= today)
    .sort((a, b) => a.paidOn.localeCompare(b.paidOn));
  let held = schedule.balanceMinor + since.reduce((sum, p) => sum + p.capitalMinor, 0);
  let cursor = lastDue;
  let accrued = 0;
  for (const p of since) {
    accrued += held * growth(cursor, p.paidOn);
    held -= p.capitalMinor;
    cursor = p.paidOn;
  }
  accrued += held * growth(cursor, today);
  const interest = Math.round(accrued);
  return { balanceMinor: schedule.balanceMinor, interestMinor: interest, totalMinor: schedule.balanceMinor + interest, sinceOn: lastDue };
}

/** How many installments had fallen due by `today` (a loan begun before the app). */
export function dueBy(terms: Pick<LoanTerms, 'firstDueOn' | 'periodMonths' | 'installments'>, today: string): number {
  let count = 0;
  while (count < terms.installments && dueDate(terms.firstDueOn, terms.periodMonths, count + 1) <= today) count++;
  return count;
}

/** What the original schedule says is owed after `count` installments. */
export function theoreticalBalance(terms: LoanTerms, count: number): number {
  if (terms.unit === 'UVR') {
    const units = theoreticalUnits(terms, count);
    const day = count > 0 ? dueDate(terms.firstDueOn, terms.periodMonths, count) : terms.disbursedOn;
    return Math.round(units / UVR_MICRO * (terms.uvr?.(day)?.value ?? 0) * 100);
  }
  return theoretical({ ...terms, paidBefore: 0 }, count).balance;
}

/** A loan in UVR: what the original schedule says is owed after `count` installments, in millionths of a UVR. */
export function theoreticalUnits(terms: LoanTerms, count: number): number {
  const value = (day: string) => terms.uvr?.(day)?.value ?? 1;
  return theoretical({ ...unitTermsOf(terms, value), paidBefore: 0 }, count).balance;
}

/** The first installment, capital and interest, as the schedule works it out (insurance apart). */
export function firstInstallment(terms: LoanTerms): { paymentMinor: number; insuranceMinor: number; uvr?: number } {
  if (terms.unit === 'UVR') {
    const s = uvrSchedule({ ...terms, bankInstallmentMinor: null, paidBefore: 0, balanceAfterBeforeMinor: null }, [], terms.disbursedOn, null);
    const row = s.rows.find((r): r is InstallmentRow => r.type === 'installment');
    return row
      ? { paymentMinor: row.capitalMinor + row.interestMinor, insuranceMinor: row.insuranceMinor, uvr: row.uvr?.installment }
      : { paymentMinor: 0, insuranceMinor: 0 };
  }
  const rows = theoretical({ ...terms, bankInstallmentMinor: null }, 1).rows;
  const row = rows[0];
  return row
    ? { paymentMinor: row.capitalMinor + row.interestMinor, insuranceMinor: row.insuranceMinor }
    : { paymentMinor: 0, insuranceMinor: 0 };
}

function days(from: string, to: string): number {
  const ms = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
  return Math.round((ms(to) - ms(from)) / 86_400_000);
}
