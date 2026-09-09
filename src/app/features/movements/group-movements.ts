/**
 * Turns a flat list of movements into the groups the screen shows.
 *
 * Grouping and sorting travel together, because one implies the other: by date
 * you want newest first, and by category you want whoever spent the most first.
 * Offering them as independent controls would let the user pick combinations
 * that answer no question.
 *
 * Pure functions over plain data — no database, no Angular — so the ordering
 * rules can be tested directly.
 */

import type { TransactionRow } from '../../core/database/types';

export type Grouping = 'date' | 'category';

/** How the movements inside a group are ordered. */
export type SortWithin = 'date' | 'amount';

/** What a movement means for the money, and therefore what colour it is. */
export type Flow =
  /** Money arrived: income. */
  | 'in'
  /** Money left: an expense. */
  | 'out'
  /** Money moved between the user's own accounts. Neither earned nor spent. */
  | 'moved';

export interface Movement {
  transaction: TransactionRow;
  accountName: string;
  currency: string;
  /** The real category, or the other account's name for a transfer. */
  label: string;
  icon: string | null;
  flow: Flow;
}

export interface MovementGroup {
  /** Stable identity for tracking, and for remembering what is collapsed. */
  key: string;
  title: string;
  /** For a category group, its icon. Null for a date group. */
  icon: string | null;
  count: number;
  /**
   * The group's total, in the base currency so a mixed-currency group still
   * adds up. Signed: negative spent, positive received.
   */
  totalBaseMinor: number;
  flow: Flow;
  movements: Movement[];
}

export interface Totals {
  /** Money that came in, as a positive figure. */
  inMinor: number;
  /** Money that went out, as a positive figure. */
  outMinor: number;
  /**
   * Money moved between the user's own accounts, as a positive figure.
   *
   * Only ever non-zero when a single account is in scope. Across all accounts a
   * transfer is invisible, because nothing entered or left.
   */
  movedMinor: number;
}

/**
 * Decides what a movement means.
 *
 * A transfer leg is `moved` rather than `out`, even though the money really did
 * leave the account. Monefy paints it red like any expense, and that is the
 * confusion worth not inheriting: spending is money gone, a transfer is money
 * somewhere else.
 */
export function flowOf(transaction: TransactionRow): Flow {
  if (transaction.transfer_id !== null) return 'moved';
  return transaction.amount_minor >= 0 ? 'in' : 'out';
}

/** Filters by free text over the description and the label. */
export function matchesSearch(movement: Movement, search: string): boolean {
  const term = search.trim().toLowerCase();
  if (term === '') return true;
  return (
    (movement.transaction.description ?? '').toLowerCase().includes(term) ||
    movement.label.toLowerCase().includes(term) ||
    movement.accountName.toLowerCase().includes(term)
  );
}

export function totalsOf(movements: readonly Movement[]): Totals {
  let inMinor = 0;
  let outMinor = 0;
  let movedMinor = 0;

  for (const movement of movements) {
    const amount = Math.abs(movement.transaction.amount_base_minor);
    if (movement.flow === 'in') inMinor += amount;
    else if (movement.flow === 'out') outMinor += amount;
    else movedMinor += amount;
  }

  return { inMinor, outMinor, movedMinor };
}

const MONTHS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

function dayTitle(iso: string): string {
  const [, month, day] = iso.split('-').map(Number);
  return `${day} de ${MONTHS[month - 1]}`;
}

/**
 * Groups movements for display.
 *
 * By date: one group per day, newest first, movements inside kept in the order
 * they arrived from the database.
 *
 * By category: one group per label, ordered by how much left through it, so the
 * biggest spender is at the top. Income and transfers sort after spending
 * rather than competing with it on size, since "which category took the most
 * money" is the question the ordering exists to answer.
 */
export function groupMovements(
  movements: readonly Movement[],
  grouping: Grouping,
  sortWithin: SortWithin = 'date',
): MovementGroup[] {
  const groups = new Map<string, MovementGroup>();

  for (const movement of movements) {
    const key = grouping === 'date' ? movement.transaction.occurred_on : movement.label;

    let group = groups.get(key);
    if (!group) {
      group = {
        key,
        title: grouping === 'date' ? dayTitle(key) : key,
        icon: grouping === 'date' ? null : movement.icon,
        count: 0,
        totalBaseMinor: 0,
        flow: movement.flow,
        movements: [],
      };
      groups.set(key, group);
    }

    group.movements.push(movement);
    group.count += 1;
    group.totalBaseMinor += movement.transaction.amount_base_minor;

    // A day mixing income and spending is neither; a category is whatever its
    // movements consistently are.
    if (group.flow !== movement.flow) {
      group.flow = group.totalBaseMinor >= 0 ? 'in' : 'out';
    }
  }

  // Inside a group, either the most recent or the largest first. Sorting by
  // amount uses the magnitude, so the biggest movement leads whichever
  // direction it went.
  for (const group of groups.values()) {
    group.movements.sort((a, b) =>
      sortWithin === 'amount'
        ? Math.abs(b.transaction.amount_base_minor) - Math.abs(a.transaction.amount_base_minor)
        : b.transaction.occurred_on.localeCompare(a.transaction.occurred_on));
  }

  const ordered = [...groups.values()];

  if (grouping === 'date') {
    ordered.sort((a, b) => b.key.localeCompare(a.key));
  } else {
    ordered.sort((a, b) => {
      // What came in first, then everything that left, each largest first.
      //
      // The opposite order reads better as an answer to "where did the money
      // go", and was what this did at first. Jose uses Monefy every day and
      // reads it the other way round, so it follows him: income is the
      // context you read the spending against.
      const rank = (group: MovementGroup) => (group.flow === 'in' ? 0 : 1);
      if (rank(a) !== rank(b)) return rank(a) - rank(b);
      return Math.abs(b.totalBaseMinor) - Math.abs(a.totalBaseMinor);
    });
  }

  return ordered;
}

/**
 * Each spending category's share of the period, for the donut.
 *
 * Only outgoing money gets a slice: a chart mixing what you earned with what
 * you spent answers nothing. Transfers are included when they are in scope,
 * because for a single account money that left is money that left — but they
 * arrive marked `moved` so the chart can paint them as something other than
 * spending.
 */
export interface Slice {
  label: string;
  icon: string | null;
  amountMinor: number;
  /** Rounded to a whole number, the way Monefy shows it. */
  percent: number;
  flow: Flow;
}

export function slicesOf(movements: readonly Movement[]): Slice[] {
  const byLabel = new Map<string, Slice>();
  let total = 0;

  for (const movement of movements) {
    if (movement.flow === 'in') continue;

    const amount = Math.abs(movement.transaction.amount_base_minor);
    total += amount;

    const slice = byLabel.get(movement.label);
    if (slice) {
      slice.amountMinor += amount;
    } else {
      byLabel.set(movement.label, {
        label: movement.label,
        icon: movement.icon,
        amountMinor: amount,
        percent: 0,
        flow: movement.flow,
      });
    }
  }

  const slices = [...byLabel.values()].sort((a, b) => b.amountMinor - a.amountMinor);
  for (const slice of slices) {
    slice.percent = total === 0 ? 0 : Math.round((slice.amountMinor / total) * 100);
  }
  return slices;
}
