/**
 * What an end of a movement holds once it is saved (Jose, 2026-11-18: "el
 * nuevo valor que quedaría"), said under that end of the movement form.
 *
 * Which figure moves depends on "¿Qué cambia?":
 * - "Producto y patrimonio" on an account split into several products: the
 *   product chosen moves (it is the one on show under the account); on an
 *   account with one product or none, the account's balance.
 * - "Solo el producto": the product moves, the account's balance does not.
 * - "Solo el patrimonio": the account's balance moves, the product does not
 *   (its other half is written on the product).
 *
 * Pure: the form reads the figures, this says which one and what it becomes.
 */

import type { TransferScope } from '../database/repositories/transfers.repository';

export interface AfterInput {
  scope: TransferScope;
  /** The account shows a product to choose (more than one). */
  split: boolean;
  /** The account's balance today, signed. */
  accountMinor: number;
  /** What the product in play holds today; null when the account has none. */
  productMinor: number | null;
  /** Signed: minus for money leaving this end, plus for money arriving. */
  changeMinor: number;
}

export interface After {
  /** Whose figure: the product under the account, or the account itself. */
  of: 'account' | 'product';
  minor: number;
}

export function balanceAfter(input: AfterInput): After | null {
  const { scope, split, accountMinor, productMinor, changeMinor } = input;
  if (scope === 'netWorth') return { of: 'account', minor: accountMinor + changeMinor };
  if (scope === 'product') {
    return productMinor === null ? null : { of: 'product', minor: productMinor + changeMinor };
  }
  if (split && productMinor !== null) return { of: 'product', minor: productMinor + changeMinor };
  return { of: 'account', minor: accountMinor + changeMinor };
}
