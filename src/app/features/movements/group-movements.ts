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
import { monthName } from '../../core/filters/period';

/**
 * How the list is read.
 *
 * One control, not two. Grouping and ordering used to be separate choices,
 * which put "Fecha / Categoría" and "Reciente / Monto" side by side as if they
 * were the same kind of decision — and nothing on screen said the second only
 * applied inside the groups the first had made. Picking "Monto" looked like it
 * would order everything by size and did not.
 *
 * These three are the questions actually being asked, and each one settles its
 * own ordering:
 *
 *   - `date`: what have I been spending on lately (grouped by day, newest first)
 *   - `category`: where is my money going (grouped by category, biggest first)
 *   - `largest`: what were my biggest movements (no groups, largest first)
 */
export type Grouping = 'date' | 'category' | 'largest';

/** How the movements inside a group are ordered. */
export type SortWithin = 'date' | 'amount';

/** What a movement means for the money, and therefore what colour it is. */
export type Flow =
  /** Money arrived: income. */
  | 'in'
  /** Money left: an expense. */
  | 'out'
  /** Money moved between the user's own accounts. Neither earned nor spent. */
  | 'moved'
  /**
   * Money that came back on a credit card: a refund, a reversed charge, a fee
   * corrected. It reduces what was spent rather than adding to what was
   * earned — the card is borrowed money, so nothing arrived.
   */
  | 'refund';

export interface Movement {
  transaction: TransactionRow;
  accountName: string;
  /** Needed to read a positive amount on a credit card correctly. */
  accountType: string;
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
  /** Money that went out, net of refunds, as a positive figure. */
  outMinor: number;
  /** Money that came back on a credit card, as a positive figure. */
  refundedMinor: number;
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
export function flowOf(transaction: TransactionRow, accountType = 'debit'): Flow {
  if (transaction.transfer_id !== null) return 'moved';
  if (transaction.amount_minor < 0) return 'out';

  // A credit card holds the bank's money, not yours. Money arriving on it did
  // not enter your net worth; it undid a charge. Counted as income it would
  // inflate what you earned with refunds and reversed fees, which is exactly
  // what Jose said it must never do.
  return accountType === 'credit' ? 'refund' : 'in';
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

/**
 * Which figure of a movement to add up.
 *
 * Two amounts are stored: what actually moved (`amount_minor`, in the
 * account's own currency) and what it was worth in pesos (`amount_base_minor`).
 * Which one to use is not a detail — it is the difference between a dollar
 * account's month reading 2,013.33 and 8,700,000.
 *
 * One account: its own currency, because every movement in it is already in
 * that currency and converting would answer a question nobody asked. Several
 * accounts at once: pesos, because dollars and euros cannot be added together
 * and the base amount is the only thing they have in common.
 */
export type AmountBasis = 'own' | 'base';

function amountOf(movement: Movement, basis: AmountBasis): number {
  return basis === 'own'
    ? movement.transaction.amount_minor
    : movement.transaction.amount_base_minor;
}

export function totalsOf(movements: readonly Movement[], basis: AmountBasis = 'base'): Totals {
  let inMinor = 0;
  let outMinor = 0;
  let movedMinor = 0;
  let refundedMinor = 0;

  for (const movement of movements) {
    const amount = Math.abs(amountOf(movement, basis));
    if (movement.flow === 'in') inMinor += amount;
    else if (movement.flow === 'out') outMinor += amount;
    else if (movement.flow === 'refund') refundedMinor += amount;
    else movedMinor += amount;
  }

  // Refunds come off what was spent rather than adding to what was earned.
  return { inMinor, outMinor: outMinor - refundedMinor, refundedMinor, movedMinor };
}

function dayTitle(iso: string, locale: string): string {
  const [year, month, day] = iso.split('-').map(Number);
  const name = monthName(new Date(year, month - 1, day), locale);
  return locale.startsWith('es') ? `${day} de ${name}` : `${day} ${name}`;
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
 *
 * Largest: no groups at all. Every movement in one list, biggest first, because
 * the question is about individual movements and any grouping would break the
 * ordering into pieces.
 */
export function groupMovements(
  movements: readonly Movement[],
  grouping: Grouping,
  sortWithin: SortWithin = 'date',
  locale = 'es-CO',
  allLabel = 'All movements',
  basis: AmountBasis = 'base',
): MovementGroup[] {
  if (grouping === 'largest') return [flatByAmount(movements, allLabel, basis)];

  const groups = new Map<string, MovementGroup>();

  for (const movement of movements) {
    const key = grouping === 'date' ? movement.transaction.occurred_on : movement.label;

    let group = groups.get(key);
    if (!group) {
      group = {
        key,
        title: grouping === 'date' ? dayTitle(key, locale) : key,
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
    group.totalBaseMinor += amountOf(movement, basis);

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
        ? Math.abs(amountOf(b, basis)) - Math.abs(amountOf(a, basis))
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
 * Every movement in one list, largest first.
 *
 * Still a group, so the list renders the same way, but one that carries no
 * heading of its own: a single "Todos" bar above an ungrouped list would be
 * furniture. The screen skips the heading when there is only this group.
 */
function flatByAmount(
  movements: readonly Movement[],
  allLabel: string,
  basis: AmountBasis,
): MovementGroup {
  const sorted = [...movements].sort((a, b) =>
    Math.abs(amountOf(b, basis)) - Math.abs(amountOf(a, basis)));

  const totalBaseMinor = sorted.reduce((sum, m) => sum + amountOf(m, basis), 0);

  return {
    key: 'largest',
    title: allLabel,
    icon: null,
    count: sorted.length,
    totalBaseMinor,
    flow: totalBaseMinor >= 0 ? 'in' : 'out',
    movements: sorted,
  };
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

export function slicesOf(movements: readonly Movement[], basis: AmountBasis = 'base'): Slice[] {
  const byLabel = new Map<string, Slice>();

  for (const movement of movements) {
    // A refund is negative spending: it comes off its own category rather than
    // standing on its own, so a month of returns shrinks the slice it undid.
    const signed = movement.flow === 'refund'
      ? -Math.abs(amountOf(movement, basis))
      : Math.abs(amountOf(movement, basis));

    const slice = byLabel.get(movement.label);
    if (slice) {
      slice.amountMinor += signed;
    } else {
      byLabel.set(movement.label, {
        label: movement.label,
        icon: movement.icon,
        amountMinor: signed,
        percent: 0,
        flow: movement.flow === 'refund' ? 'out' : movement.flow,
      });
    }
  }

  const slices = [...byLabel.values()].filter(slice => slice.amountMinor !== 0);

  // Percentages are shares of spending, since that is what the ring draws.
  // Income has no share of it and shows none.
  const spent = slices
    .filter(slice => slice.flow !== 'in')
    .reduce((sum, slice) => sum + Math.max(slice.amountMinor, 0), 0);

  for (const slice of slices) {
    slice.percent = slice.flow === 'in' || spent === 0
      ? 0
      : Math.round((Math.max(slice.amountMinor, 0) / spent) * 100);
  }

  // Income first, then spending largest first - the same order as the list.
  return slices.sort((a, b) => {
    const rank = (slice: Slice) => (slice.flow === 'in' ? 0 : 1);
    if (rank(a) !== rank(b)) return rank(a) - rank(b);
    return Math.abs(b.amountMinor) - Math.abs(a.amountMinor);
  });
}
