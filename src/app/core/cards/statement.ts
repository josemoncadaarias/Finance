/**
 * A credit card's statement, worked out from its own movements (debts,
 * part 1; Jose, 2026-10-01).
 *
 * A card closes its statement at the end of its cut-off day and wants it
 * paid by its payment day. So, on any day:
 *
 *   - the last cut-off is the latest cut-off day BEFORE today - on the
 *     cut-off day itself the cycle is still open until the day ends;
 *   - the statement is what was owed at the close of that day;
 *   - what is left of it is the statement less everything that came INTO
 *     the card after it (payments, refunds);
 *   - what was bought after it goes to the next statement;
 *   - it is due on the first payment day after the cut-off.
 *
 * A day past the end of a short month is that month's last day. Nothing is
 * stored: it is all read again from the movements whenever it is asked.
 *
 * The bank's own statement can differ - a purchase of the cut-off day it
 * posts the next day, a fee nobody typed, an installment purchase billed one
 * installment at a time - so the person may type the figure the bank states
 * for that cut-off (`card_statements`, 2026-10-02). It then IS the statement,
 * what is left of it is worked out from it the same way, and the app's own
 * figure is kept beside it to say by how much the two differ and, where it
 * can, why.
 */

export interface CardMovement {
  onDate: string;
  /** Signed, as in the ledger: a purchase is negative, a payment positive. */
  amountMinor: number;
}

export interface CardInput {
  statementDay: number | null;
  dueDay: number | null;
  today: string;
  openingMinor: number;
  movements: CardMovement[];
  /** What the bank's statement says, typed by the person, by cut-off day. */
  bankFigures?: ReadonlyMap<string, number>;
}

export type CardState =
  /** No cut-off or payment day on the card yet. */
  | 'noDates'
  /** Nothing owed at all. */
  | 'clear'
  /** The last statement closed with nothing to pay; what is owed is for the next one. */
  | 'nothingDue'
  | 'due'
  | 'partial'
  | 'paid'
  | 'overdue';

export interface CardStatement {
  state: CardState;
  /** What is owed today, as a positive figure (0 when nothing). */
  debtMinor: number;
  /** The last cut-off and its payment day; null without dates. */
  cutOn: string | null;
  dueOn: string | null;
  /** The next cut-off, after today. */
  nextCutOn: string | null;
  /** What is owed for the statement: the bank's figure when typed, else the app's. */
  statementMinor: number;
  /** What the movements say was owed at the close of the cut-off. */
  computedMinor: number;
  /** The figure typed from the bank's statement for this cut-off, if any. */
  bankMinor: number | null;
  /** The app's figure less the bank's (positive: the app counts more). 0 without one. */
  differenceMinor: number;
  /** Purchases dated on the cut-off day itself, as a positive figure, and how many. */
  cutDayMinor: number;
  cutDayCount: number;
  /** What came into the card after the cut-off, up to today. */
  paidMinor: number;
  /** What is left of the statement. */
  remainingMinor: number;
  /** Purchases after the cut-off, as a positive figure. */
  afterCutMinor: number;
  /** The last day a payment came in after the cut-off, if any. */
  lastPaidOn: string | null;
  /** Days from today to the payment day (negative once it has passed). */
  daysLeft: number | null;
}

export function cardStatement(input: CardInput): CardStatement {
  const debtMinor = Math.max(0, -(input.openingMinor + sum(input.movements.filter(m => m.onDate <= input.today))));
  const empty: CardStatement = {
    state: 'noDates', debtMinor, cutOn: null, dueOn: null, nextCutOn: null,
    statementMinor: 0, computedMinor: 0, bankMinor: null, differenceMinor: 0, cutDayMinor: 0, cutDayCount: 0, paidMinor: 0, remainingMinor: 0, afterCutMinor: 0, lastPaidOn: null, daysLeft: null,
  };
  if (!validDay(input.statementDay) || !validDay(input.dueDay)) return empty;

  const cutOn = lastCutBefore(input.statementDay!, input.today);
  const dueOn = dueAfter(cutOn, input.dueDay!);
  const nextCutOn = dayIn(addMonths(cutOn, 1), input.statementDay!);

  const closed = input.movements.filter(m => m.onDate <= cutOn);
  const after = input.movements.filter(m => m.onDate > cutOn && m.onDate <= input.today);
  const computedMinor = Math.max(0, -(input.openingMinor + sum(closed)));
  const bankMinor = input.bankFigures?.get(cutOn) ?? null;
  const statementMinor = bankMinor ?? computedMinor;
  const credits = after.filter(m => m.amountMinor > 0);
  const paidMinor = sum(credits);
  const remainingMinor = Math.max(0, statementMinor - paidMinor);
  // What goes to the next statement. With the bank's figure, whatever the bank
  // left out of this one (a purchase of the cut-off day it posted later) goes
  // there too, so it is what is owed beyond what is left of this one.
  const afterCutMinor = bankMinor === null
    ? -sum(after.filter(m => m.amountMinor < 0))
    : Math.max(0, debtMinor - remainingMinor);
  const onCutDay = closed.filter(m => m.onDate === cutOn && m.amountMinor < 0);
  const lastPaidOn = credits.length > 0 ? credits.map(m => m.onDate).sort().at(-1)! : null;
  const daysLeft = daysBetween(input.today, dueOn);

  let state: CardState;
  if (debtMinor === 0 && remainingMinor === 0) state = 'clear';
  else if (statementMinor === 0) state = 'nothingDue';
  else if (remainingMinor === 0) state = 'paid';
  else if (input.today > dueOn) state = 'overdue';
  else if (paidMinor > 0) state = 'partial';
  else state = 'due';

  return {
    state, debtMinor, cutOn, dueOn, nextCutOn, statementMinor, computedMinor, bankMinor,
    differenceMinor: bankMinor === null ? 0 : computedMinor - bankMinor,
    cutDayMinor: -sum(onCutDay), cutDayCount: onCutDay.length,
    paidMinor, remainingMinor, afterCutMinor, lastPaidOn, daysLeft,
  };
}

function validDay(day: number | null): boolean {
  return day !== null && Number.isInteger(day) && day >= 1 && day <= 31;
}

function sum(movements: CardMovement[]): number {
  return movements.reduce((total, m) => total + m.amountMinor, 0);
}

/** The cut-off day of the month `monthOf` falls in, clamped to its end. */
function dayIn(monthOf: string, day: number): string {
  const [y, m] = monthOf.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${y}-${String(m).padStart(2, '0')}-${String(Math.min(day, last)).padStart(2, '0')}`;
}

function addMonths(iso: string, months: number): string {
  const [y, m] = iso.split('-').map(Number);
  const at = new Date(Date.UTC(y, m - 1 + months, 1));
  return `${at.getUTCFullYear()}-${String(at.getUTCMonth() + 1).padStart(2, '0')}-01`;
}

/** The latest cut-off day strictly before `today`. */
export function lastCutBefore(day: number, today: string): string {
  const here = dayIn(today, day);
  return here < today ? here : dayIn(addMonths(today, -1), day);
}

/** The first payment day after the cut-off. */
export function dueAfter(cutOn: string, day: number): string {
  const here = dayIn(cutOn, day);
  return here > cutOn ? here : dayIn(addMonths(cutOn, 1), day);
}

function daysBetween(from: string, to: string): number {
  const ms = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
  return Math.round((ms(to) - ms(from)) / 86_400_000);
}
