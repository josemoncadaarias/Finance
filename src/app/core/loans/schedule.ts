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
 * - Insurance is a fixed figure per installment or a monthly share of what is
 *   still owed (seguro de vida deudor falls with the balance).
 *
 * Money is in minor units; every interest is rounded to the cent. The
 * bank's own figures can differ by a few pesos, and the typed ones win.
 */

export const EA_SCALE = 1_000_000;

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

/** The capital-and-interest installment the person agreed, if the bank's figure says it. */
function agreedPayment(terms: LoanTerms): number | null {
  if (terms.bankInstallmentMinor === null || terms.insuranceKind !== 'fixed') return null;
  const pay = terms.bankInstallmentMinor - terms.insuranceMinor;
  return pay > 0 ? pay : null;
}

/** The original schedule's balance after `count` installments, nothing paid ahead. */
function theoretical(terms: LoanTerms, count: number): { balance: number; rows: InstallmentRow[] } {
  let balance = terms.principalMinor;
  let previous = terms.disbursedOn;
  let rateScaled = rateOn(terms, previous);
  let rate = periodRate(rateScaled, terms.periodMonths);
  let pay = agreedPayment(terms) ?? annuity(balance, rate, terms.installments);
  const capitalEach = Math.round(terms.principalMinor / terms.installments);
  const rows: InstallmentRow[] = [];
  for (let number = 1; number <= count && balance > 0; number++) {
    const dueOn = dueDate(terms.firstDueOn, terms.periodMonths, number);
    const nowRate = rateOn(terms, previous);
    if (nowRate !== rateScaled) {
      rateScaled = nowRate;
      rate = periodRate(rateScaled, terms.periodMonths);
      pay = annuity(balance, rate, terms.installments - number + 1);
    }
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
  const before = theoretical(terms, terms.paidBefore);
  const rows: ScheduleRow[] = [...before.rows];
  let balance = terms.paidBefore > 0 ? (terms.balanceAfterBeforeMinor ?? before.balance) : terms.principalMinor;

  const byNumber = new Map<number, LoanPayment>();
  for (const p of payments) if (p.kind === 'installment' && p.number !== null) byNumber.set(p.number, p);
  const extras = payments.filter(p => p.kind !== 'installment').sort((a, b) => a.paidOn.localeCompare(b.paidOn));

  let previous = terms.paidBefore > 0 ? dueDate(terms.firstDueOn, terms.periodMonths, terms.paidBefore) : terms.disbursedOn;
  let rateScaled = rateOn(terms, previous);
  let rate = periodRate(rateScaled, terms.periodMonths);
  let pay = agreedPayment(terms) ?? annuity(terms.principalMinor, periodRate(rateOn(terms, terms.disbursedOn), terms.periodMonths), terms.installments);
  if (rateScaled !== rateOn(terms, terms.disbursedOn)) pay = annuity(balance, rate, terms.installments - terms.paidBefore);
  let capitalEach = Math.round(balance / Math.max(1, terms.installments - terms.paidBefore));
  let lastNumber = terms.installments;

  // Payments ahead made before the first installment the walk sees.
  let extraAt = 0;
  const applyExtra = (amount: number, mode: ExtraMode | 'payoff', paidOn: string, planned: boolean, afterNumber: number) => {
    const taken = Math.min(amount, balance);
    if (taken <= 0) return;
    balance -= taken;
    rows.push({ type: 'extra', paidOn, amountMinor: taken, mode, planned, balanceAfterMinor: balance });
    const remaining = lastNumber - afterNumber;
    if (mode === 'installment' && remaining > 0) {
      if (terms.system === 'fixed_installment') pay = annuity(balance, rate, remaining);
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
      if (terms.system === 'fixed_installment') pay = annuity(balance, rate, Math.max(1, lastNumber - number + 1));
    }
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
      const interest = Math.round(balance * rate);
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
  const elapsed = days(lastDue, today);
  const span = Math.max(1, days(lastDue, nextDue));
  const interest = Math.round(schedule.balanceMinor * (Math.pow(1 + rate, elapsed / span) - 1));
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
  return theoretical({ ...terms, paidBefore: 0 }, count).balance;
}

/** The first installment, capital and interest, as the schedule works it out (insurance apart). */
export function firstInstallment(terms: LoanTerms): { paymentMinor: number; insuranceMinor: number } {
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
