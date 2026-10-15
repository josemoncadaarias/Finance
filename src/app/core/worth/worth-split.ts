/**
 * Net worth said as two figures: what the person has and what they owe
 * (Jose, 2026-10-15, mockups 29a-29c). Both come from the very lines that make
 * the total - each line's peso value, split by its sign - so the two always
 * add up to net worth to the centavo. A line with no rate is left out, as it is
 * of the total. A card's free credit is never "what you have": it is the bank's.
 */
export type DebtKind = 'card' | 'loan' | 'other';

export interface WorthLineIn {
  account_id: number;
  baseMinor: number | null;
}

export interface WorthSplit {
  haveMinor: number;
  /** Positive: what is owed. */
  oweMinor: number;
  /** Accounts holding something. */
  haveCount: number;
  cards: number;
  loans: number;
  /** An ordinary account below zero. */
  others: number;
  /** The lines of each side, in the order given. */
  have: WorthLineIn[];
  owe: WorthLineIn[];
}

export function splitWorth<L extends WorthLineIn>(
  lines: readonly L[],
  kindOf: (accountId: number) => DebtKind,
): WorthSplit & { have: L[]; owe: L[] } {
  const have: L[] = [];
  const owe: L[] = [];
  let haveMinor = 0;
  let oweMinor = 0;
  let cards = 0, loans = 0, others = 0;
  for (const line of lines) {
    const value = line.baseMinor;
    if (value === null || value === 0) continue;
    if (value > 0) {
      have.push(line);
      haveMinor += value;
      continue;
    }
    owe.push(line);
    oweMinor -= value;
    const kind = kindOf(line.account_id);
    if (kind === 'card') cards++;
    else if (kind === 'loan') loans++;
    else others++;
  }
  return { haveMinor, oweMinor, haveCount: have.length, cards, loans, others, have, owe };
}
