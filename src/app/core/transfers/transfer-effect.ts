/**
 * What a transfer between two accounts does to net worth, from what each end
 * changes (migration 056; mockups `17a`-`17f`, Jose 2026-10-03).
 *
 * An end that changes its product only never touches the account's balance,
 * so it is not counted: the leaving end's amount comes off net worth unless it
 * left a product only, the arriving end's amount goes on unless it arrived in
 * a product only. Every other answer - both, or net worth alone - moves the
 * balance, and so net worth.
 *
 *   both / both              the money only changes account: no change
 *   product / both|netWorth  earnings nobody counted arrive as money: it rises
 *   both|netWorth / product  money leaves for earnings nobody counts: it falls
 *   product / product        earnings move between products: no change
 *   netWorth on either side  the balances move like an ordinary transfer, and
 *                            the product at that end keeps its figure
 *
 * Pure: amounts in, a verdict out. The words live in the form.
 */

import type { TransferScope } from '../database/repositories/transfers.repository';

export interface TransferEffect {
  /** Which way net worth moves. */
  kind: 'up' | 'down' | 'same';
  /** By how much, in the currency of `side`; zero for 'same'. */
  amountMinor: number;
  /** Whose amount and currency that is: the end that counts alone. */
  side: 'from' | 'to' | null;
}

export function transferEffect(input: {
  fromScope: TransferScope;
  toScope: TransferScope;
  /** Positive, each in its own account's currency. */
  fromMinor: number;
  toMinor: number;
}): TransferEffect {
  const leaves = input.fromScope !== 'product';
  const arrives = input.toScope !== 'product';
  if (leaves === arrives) return { kind: 'same', amountMinor: 0, side: null };
  return arrives
    ? { kind: 'up', amountMinor: input.toMinor, side: 'to' }
    : { kind: 'down', amountMinor: input.fromMinor, side: 'from' };
}
