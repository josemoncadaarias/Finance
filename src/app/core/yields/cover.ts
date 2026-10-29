/**
 * Covering a product that a movement would leave below zero (Jose,
 * 2026-10-29, mockups `50a`-`50h`): a spending, or money sent away, leaves
 * the account's usual product - often at 0 - and the person then moves the
 * same money in from a pocket by hand. The form offers to do both at once.
 *
 * Nothing new is stored but the link: saving writes the movement and,
 * beside it, an ordinary move between the account's products for what is
 * missing (`transfers.covers_transaction_id`, migration 062).
 *
 * Pure: which products can cover it, and the one to offer first.
 */

export interface CoverProduct {
  id: number;
  kind: string;
  include_in_net_worth: 0 | 1;
}

export interface CoverRoute { from: number; to: number; times: number }

export interface CoverOption {
  productId: number;
  /** What it holds today. */
  holdsMinor: number;
  /** Money usually moves from it into the product being covered. */
  usual: boolean;
}

export interface Cover {
  /** What the product lacks to stay at zero. */
  missingMinor: number;
  /** The products holding at least that, the one to offer first on top. Empty: none does. */
  options: CoverOption[];
}

/**
 * What is missing and who can give it. Null when the product holds enough.
 * A CDT and a product set aside from net worth are never offered: taking
 * money out of them is a decision of its own, not a top-up.
 */
export function coverFor(input: {
  amountMinor: number;
  sourceId: number;
  products: readonly CoverProduct[];
  holds: ReadonlyMap<number, number>;
  routes: readonly CoverRoute[];
  /** The product the person chose to always cover from in this account. */
  preferred?: number | null;
}): Cover | null {
  const held = input.holds.get(input.sourceId);
  if (held === undefined || input.amountMinor <= 0) return null;
  const missingMinor = input.amountMinor - Math.max(0, held);
  if (missingMinor <= 0) return null;
  const into = (id: number) => input.routes
    .filter(route => route.from === id && route.to === input.sourceId)
    .reduce((sum, route) => sum + route.times, 0);
  const options = input.products
    .filter(product => product.id !== input.sourceId && product.kind !== 'cdt' && product.include_in_net_worth === 1)
    .map(product => ({ productId: product.id, holdsMinor: input.holds.get(product.id) ?? 0, times: into(product.id) }))
    .filter(option => option.holdsMinor >= missingMinor)
    .sort((a, b) =>
      Number(b.productId === input.preferred) - Number(a.productId === input.preferred)
      || b.times - a.times || b.holdsMinor - a.holdsMinor)
    .map(({ productId, holdsMinor, times }) => ({ productId, holdsMinor, usual: times > 0 }));
  return { missingMinor, options };
}
