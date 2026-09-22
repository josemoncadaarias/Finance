/**
 * Every movement of one account's products, as one history.
 *
 * Three places hold what moves a product's balance, and a history has to show
 * them as the acts a person did, not as the rows they became:
 *
 *   * **Movements of the account** - the ones from the movements screen. Only
 *     those from the day each product's balance was stated count: anything
 *     earlier is already inside that figure. A movement that names no product
 *     is the usual product's, the rule the balances follow.
 *   * **A transfer between two products** is two legs; it is one line here.
 *   * **Entries on the product alone** (cashback, a correction). Cashing in is
 *     a movement plus the same amount out of, or into, what the product
 *     gathered - one act, shown once, as its movement.
 *
 * The days the bank pays are not here: they have their own list.
 */

import type { IsoDate } from '../database/types';
import type { DetailedTransaction } from '../database/repositories/transactions.repository';

export interface MovementProduct {
  id: number;
  name: string;
  source: 'ledger' | 'manual';
  is_default: 1 | null;
}

export interface MovementEntry {
  id: number;
  on_date: IsoDate;
  amount_minor: number;
  kind: 'cashback' | 'correction' | 'other';
  /** The kind it was filed under, before kinds became ordinary categories. */
  product_kind_id?: number | null;
  /** The ordinary category it is filed under, since migration 037. */
  category_id?: number | null;
  product_id: number | null;
  note: string | null;
  transaction_id: number | null;
}

export interface MovementWithdrawal {
  id: number;
  on_date: IsoDate;
  amount_minor: number;
  product_id: number | null;
  note: string | null;
  transaction_id: number | null;
}

export type ProductMovement =
  | {
      type: 'transaction'; key: string; on: IsoDate; amountMinor: number; productId: number;
      transaction: DetailedTransaction;
      /** Half of a cash-in: the product's balance did not move, net worth did. */
      cashIn: boolean;
    }
  | {
      type: 'transfer'; key: string; on: IsoDate; amountMinor: number;
      fromProductId: number; toProductId: number;
      /** The leg the money left from, which is what the movement screen opens. */
      transaction: DetailedTransaction;
    }
  | { type: 'entry'; key: string; on: IsoDate; amountMinor: number; productId: number; entry: MovementEntry }
  | { type: 'withdrawal'; key: string; on: IsoDate; amountMinor: number; productId: number; withdrawal: MovementWithdrawal };

export function productMovements(input: {
  accountId: number;
  products: readonly MovementProduct[];
  /** The day from which each product's balance counts movements. */
  startDays: ReadonlyMap<number, IsoDate>;
  transactions: readonly DetailedTransaction[];
  entries: readonly MovementEntry[];
  withdrawals: readonly MovementWithdrawal[];
}): ProductMovement[] {
  const { accountId, products } = input;
  if (products.length === 0) return [];

  const known = new Set(products.map(product => product.id));
  // Movements naming no product belong to the usual one; entries naming none
  // to the one following the account, or the first - each the rule its own
  // balance follows.
  const usual = (products.find(product => product.is_default === 1) ?? products[0]).id;
  const fallback = (products.find(product => product.source === 'ledger') ?? products[0]).id;
  const movementProduct = (id: number | null) => (id !== null && known.has(id) ? id : usual);
  const entryProduct = (id: number | null) => (id !== null && known.has(id) ? id : fallback);
  const counts = (productId: number, on: IsoDate) => on >= (input.startDays.get(productId) ?? '0000-01-01');

  const cashedIn = new Set<number>();
  for (const half of [...input.entries, ...input.withdrawals]) {
    if (half.transaction_id !== null) cashedIn.add(half.transaction_id);
  }

  const legsOf = new Map<number, DetailedTransaction[]>();
  for (const row of input.transactions) {
    if (row.transfer_id === null) continue;
    legsOf.set(row.transfer_id, [...(legsOf.get(row.transfer_id) ?? []), row]);
  }

  const out: ProductMovement[] = [];
  const done = new Set<number>();

  for (const row of input.transactions) {
    if (row.account_id !== accountId) continue;

    // Both legs in this account: money moved between two of its products.
    if (row.transfer_id !== null && row.other_account_id === accountId) {
      if (done.has(row.transfer_id)) continue;
      done.add(row.transfer_id);
      const legs = legsOf.get(row.transfer_id) ?? [row];
      const from = legs.find(leg => leg.transfer_leg === 'from') ?? row;
      const to = legs.find(leg => leg.transfer_leg === 'to') ?? row;
      const fromProductId = movementProduct(from.product_id);
      const toProductId = movementProduct(to.product_id);
      if (!counts(fromProductId, from.occurred_on) && !counts(toProductId, to.occurred_on)) continue;
      out.push({
        type: 'transfer', key: `x:${row.transfer_id}`, on: from.occurred_on,
        amountMinor: Math.abs(from.amount_minor), fromProductId, toProductId, transaction: from,
      });
      continue;
    }

    const productId = movementProduct(row.product_id);
    if (!counts(productId, row.occurred_on)) continue;
    out.push({
      type: 'transaction', key: `t:${row.id}`, on: row.occurred_on, amountMinor: row.amount_minor,
      productId, transaction: row, cashIn: cashedIn.has(row.id),
    });
  }

  for (const entry of input.entries) {
    if (entry.transaction_id !== null) continue;
    out.push({
      type: 'entry', key: `a:${entry.id}`, on: entry.on_date, amountMinor: entry.amount_minor,
      productId: entryProduct(entry.product_id), entry,
    });
  }

  // A withdrawal whose movement is gone still took money out of the product.
  for (const withdrawal of input.withdrawals) {
    if (withdrawal.transaction_id !== null) continue;
    out.push({
      type: 'withdrawal', key: `w:${withdrawal.id}`, on: withdrawal.on_date, amountMinor: -withdrawal.amount_minor,
      productId: entryProduct(withdrawal.product_id), withdrawal,
    });
  }

  return out.sort((a, b) => (a.on === b.on ? b.key.localeCompare(a.key) : b.on.localeCompare(a.on)));
}

/** Whether a movement touches a product: its own, or either end of a transfer. */
export function movementTouches(movement: ProductMovement, productId: number): boolean {
  return movement.type === 'transfer'
    ? movement.fromProductId === productId || movement.toProductId === productId
    : movement.productId === productId;
}
