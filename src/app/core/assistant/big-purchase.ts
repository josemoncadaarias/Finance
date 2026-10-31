/**
 * "¿Me alcanza?" for a big purchase (Jose, 2026-10-31, mockups `52a`-`52g`:
 * with 230 million free and a 500 million goal open, the app must never say
 * "yes" to an apartment of 230 million - "no te puedes quedar sin patrimonio
 * libre").
 *
 * A purchase that fits in what is left this month is answered from the month
 * (`spendRoom`). A bigger one is weighed against the money held, never all of
 * it:
 *   what the accounts hold
 *   - what the goals already keep
 *   - this month's payments
 *   - a cushion of 6 months of normal spending, less what an emergency fund
 *     already keeps (so none when the fund covers it)
 *   - half of what is left, for the goals still in progress, never more than
 *     what they lack
 *   = what can go to a big purchase.
 * Taking more than 70 % of that is "yes, but it takes most of it".
 *
 * Pure: every figure comes in, already in pesos.
 */

export const CUSHION_MONTHS = 6;
export const GOALS_SHARE = 0.5;
export const MOST_SHARE = 0.7;

export interface BigRoom {
  inAccountsMinor: number;
  inGoalsMinor: number;
  paymentsMinor: number;
  /** Six months of normal spending. */
  cushionNeedMinor: number;
  /** What an emergency fund already keeps (inside `inGoalsMinor`). */
  emergencyMinor: number;
  /** The cushion set aside here: what the emergency fund does not cover. */
  cushionMinor: number;
  /** What the goals in progress still lack, in all. */
  goalsLackMinor: number;
  /** Half of what is left after the cushion, up to what they lack. */
  forGoalsMinor: number;
  /** What can go to a big purchase. */
  roomMinor: number;
}

export function bigRoom(input: {
  inAccountsMinor: number;
  inGoalsMinor: number;
  paymentsMinor: number;
  monthlySpendMinor: number;
  emergencyKeptMinor: number;
  goalsLackMinor: number;
}): BigRoom {
  const free = Math.max(0, input.inAccountsMinor - input.inGoalsMinor - input.paymentsMinor);
  const cushionNeedMinor = Math.max(0, Math.round(input.monthlySpendMinor * CUSHION_MONTHS));
  const emergencyMinor = Math.max(0, input.emergencyKeptMinor);
  const cushionMinor = Math.min(free, Math.max(0, cushionNeedMinor - emergencyMinor));
  const afterCushion = free - cushionMinor;
  const goalsLackMinor = Math.max(0, input.goalsLackMinor);
  const forGoalsMinor = Math.min(goalsLackMinor, Math.floor(afterCushion * GOALS_SHARE));
  return {
    inAccountsMinor: input.inAccountsMinor, inGoalsMinor: input.inGoalsMinor, paymentsMinor: input.paymentsMinor,
    cushionNeedMinor, emergencyMinor, cushionMinor, goalsLackMinor, forGoalsMinor,
    roomMinor: afterCushion - forGoalsMinor,
  };
}

export type BigVerdict = 'yes' | 'most' | 'no';

export interface BigWeighed {
  verdict: BigVerdict;
  /** What would stay for another big purchase. */
  afterMinor: number;
  /** What is missing when it does not fit. */
  shortMinor: number;
  /** The share of the room it takes, in whole percent. */
  pct: number;
}

export function weighBig(roomMinor: number, amountMinor: number): BigWeighed {
  if (amountMinor > roomMinor) {
    return { verdict: 'no', afterMinor: roomMinor - amountMinor, shortMinor: amountMinor - roomMinor, pct: 100 };
  }
  const share = roomMinor > 0 ? amountMinor / roomMinor : 1;
  return { verdict: share > MOST_SHARE ? 'most' : 'yes', afterMinor: roomMinor - amountMinor, shortMinor: 0, pct: Math.round(share * 100) };
}
