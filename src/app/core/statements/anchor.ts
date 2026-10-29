/**
 * Whether a statement just answered should offer to move an account's
 * opening balance (rule 22, "The opening balance is what absorbs the history
 * nobody typed in"; mockups 43a-43e).
 *
 * The account's balance is its opening figure plus every movement. A
 * statement hands over a day and what the bank said the account held at its
 * close: the ANCHOR. Moving the opening figure so the balance on that day is
 * the bank's makes the account agree with the bank, and whatever is typed
 * after goes on top.
 *
 * The anchor is kept, so a statement OLDER than it, read later, adds its
 * movements before the anchor's day: the balance on that day grows by them,
 * and setting it back to the anchor lowers the opening figure by exactly as
 * much - today's balance does not move.
 *
 * Pure: the screen gathers the figures, this decides what to offer.
 */

import type { IsoDate } from '../database/types';

export interface Anchor {
  day: IsoDate;
  balanceMinor: number;
}

export type Squaring =
  /** A statement that adds up, and the account says something else at its close. */
  | { kind: 'match'; day: IsoDate; theirs: number; ours: number }
  /** An older statement moved the balance on the anchor's day. */
  | { kind: 'older'; day: IsoDate; theirs: number; ours: number }
  /** It differs, but the statement does not add up: nothing is offered. */
  | { kind: 'blocked'; day: IsoDate; theirs: number; ours: number }
  /** They agree already: worth keeping as the anchor, nothing to ask. */
  | { kind: 'agrees'; day: IsoDate; theirs: number }
  | null;

export interface SquaringInput {
  /** What the statement said about its own arithmetic. */
  balances: 'checked' | 'off' | 'unclear' | 'unchecked';
  /** The statement's last day, and its closing figure. */
  statementDay: IsoDate | null;
  closingMinor: number | null;
  /** The account's balance at the close of the statement's last day. */
  oursAtStatement: number | null;
  /** The account's anchor, if one is on record, and its balance on that day. */
  anchor: Anchor | null;
  oursAtAnchor: number | null;
}

export function squaringFor(input: SquaringInput): Squaring {
  const { anchor, statementDay } = input;

  // Older than the anchor: its movements are history before the day the
  // account already agrees with the bank on. Put that day back as it was.
  if (anchor !== null && statementDay !== null && statementDay < anchor.day) {
    if (input.oursAtAnchor === null || input.oursAtAnchor === anchor.balanceMinor) return null;
    return { kind: 'older', day: anchor.day, theirs: anchor.balanceMinor, ours: input.oursAtAnchor };
  }

  if (statementDay === null || input.closingMinor === null || input.oursAtStatement === null) return null;
  const theirs = input.closingMinor;
  const ours = input.oursAtStatement;
  if (ours === theirs) {
    // Only a statement that adds up is worth remembering as the bank's word.
    return input.balances === 'checked' ? { kind: 'agrees', day: statementDay, theirs } : null;
  }
  // A misread closing figure would anchor the account to a wrong number.
  if (input.balances !== 'checked') return { kind: 'blocked', day: statementDay, theirs, ours };
  return { kind: 'match', day: statementDay, theirs, ours };
}

/** The opening figure that makes the balance on `day` equal `to`. */
export function openingFor(openingMinor: number, oursMinor: number, toMinor: number): number {
  return openingMinor + (toMinor - oursMinor);
}
