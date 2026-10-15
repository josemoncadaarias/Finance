/**
 * A credit card set up by what the bank's app shows (Jose, 2026-10-15,
 * mockups `32a`-`32d`): "Cupo total" and "Cupo disponible hoy", or what is
 * owed, instead of an opening balance nobody knows how to fill for a card.
 *
 * A card's balance is minus the debt (rule 4), and positive when the bank
 * holds money in the person's favour. The card's form keeps asking for the
 * figures as the bank says them and works out the balance, and from it the
 * opening figure: the balance today less every movement already on record.
 * No movement is ever written or touched.
 *
 * Pure, tested in `card-setup.test.mjs`.
 */

export type CardStanding = 'owes' | 'clear' | 'favour';

/** The balance a card holds when the bank says this limit and this available credit. */
export function balanceFromAvailable(limitMinor: number, availableMinor: number): number {
  return availableMinor - limitMinor;
}

/** The balance a card holds when the bank says this much is owed (typed without a minus). */
export function balanceFromOwed(owedMinor: number): number {
  return owedMinor === 0 ? 0 : -Math.abs(owedMinor);
}

/** What the balance says: a debt, nothing, or money in the person's favour. */
export function standingOf(balanceMinor: number): CardStanding {
  return balanceMinor < 0 ? 'owes' : balanceMinor > 0 ? 'favour' : 'clear';
}

/**
 * The opening figure that makes the card hold `balanceMinor` today, given
 * that its movements on record add up to `movementsMinor`.
 */
export function openingFor(balanceMinor: number, movementsMinor: number): number {
  return balanceMinor - movementsMinor;
}
