/**
 * The two questions a proposal has to be asked before anyone sees it.
 *
 * 1. Is this already in the ledger? The same purchase reaches the app twice -
 *    once as the bank's notification the day it is authorised, once in the
 *    statement the day it is posted - with a different date and a different
 *    description. An exact fingerprint, which is what the old importer used,
 *    would never see it. So the check is tolerant, and what it produces is a
 *    QUESTION on the review screen rather than a silent skip.
 *
 * 2. Is this half of a transfer? Money moved between two of the person's own
 *    accounts is reported twice, leaving one and arriving in the other.
 *    Accepted apart, those two become an expense and an income, and every
 *    spending figure in the report is wrong by that amount.
 *
 * Both are pure functions over rows already read, so they are tested without a
 * browser and without a bank. Rule 22.
 */

import type { IsoDate } from '../database/types';
import { merchantKeyOf } from './merchant';

/** How far apart the two readings of one movement may sit. */
export const DAYS_APART = 4;

/** A movement already on record, as much of it as the check needs. */
export interface LedgerMovement {
  id: number;
  account_id: number;
  occurred_on: IsoDate;
  amount_minor: number;
  description: string | null;
}

/** A reading waiting to be answered, as much of it as the checks need. */
export interface Reading {
  id?: number;
  account_id: number | null;
  occurred_on: IsoDate | null;
  amount_minor: number | null;
  description: string | null;
}

/** Whole days between two dates, however far apart. */
export function daysBetween(one: IsoDate, other: IsoDate): number {
  const day = 24 * 60 * 60 * 1000;
  return Math.abs(Date.parse(`${one}T00:00:00Z`) - Date.parse(`${other}T00:00:00Z`)) / day;
}

/**
 * The movement this reading is probably the same as, or null.
 *
 * The amount has to match to the cent: a bank does not round, and two
 * movements of an account that differ by a peso are two movements. What is
 * allowed to differ is the date, by a few days, and the description entirely.
 *
 * Where several could match, the one whose description names the same merchant
 * wins, and after that the nearest date. Two identical purchases on one day -
 * the same bus fare twice - are a real thing, so a candidate already spoken
 * for by another reading is passed over rather than claimed twice.
 */
export function sameMovementAs(
  reading: Reading,
  ledger: readonly LedgerMovement[],
  alreadyTaken: ReadonlySet<number> = new Set(),
): number | null {
  if (reading.account_id === null || reading.occurred_on === null || reading.amount_minor === null) {
    return null;
  }
  const merchant = merchantKeyOf(reading.description);

  const candidates = ledger
    .filter(movement => !alreadyTaken.has(movement.id))
    .filter(movement => movement.account_id === reading.account_id)
    .filter(movement => movement.amount_minor === reading.amount_minor)
    .filter(movement => daysBetween(movement.occurred_on, reading.occurred_on!) <= DAYS_APART)
    .map(movement => ({
      movement,
      sameMerchant: merchant.length > 0 && merchantKeyOf(movement.description) === merchant,
      apart: daysBetween(movement.occurred_on, reading.occurred_on!),
    }))
    .sort((a, b) =>
      (Number(b.sameMerchant) - Number(a.sameMerchant)) || (a.apart - b.apart) || (a.movement.id - b.movement.id));

  return candidates[0]?.movement.id ?? null;
}

/**
 * The pairs among these readings that are the two halves of one transfer.
 *
 * One leaves an account and the other arrives in a different one, for the same
 * amount, within a few days. Nothing else is enough: two accounts of the same
 * person can perfectly well spend and receive the same figure in a week
 * without it being a transfer, which is exactly why this ends up as a question
 * and not as a decision.
 *
 * Each reading is paired at most once, and the closest dates pair first, so a
 * salary arriving in two accounts does not tangle.
 */
export function transferPairs(readings: readonly Reading[]): Array<[number, number]> {
  const usable = readings.filter(
    (reading): reading is Reading & { id: number; account_id: number; occurred_on: IsoDate; amount_minor: number } =>
      reading.id !== undefined
      && reading.account_id !== null
      && reading.occurred_on !== null
      && reading.amount_minor !== null
      && reading.amount_minor !== 0);

  const possible: { out: number; in: number; apart: number }[] = [];
  for (const leaving of usable) {
    if (leaving.amount_minor > 0) continue;
    for (const arriving of usable) {
      if (arriving.amount_minor <= 0) continue;
      if (arriving.account_id === leaving.account_id) continue;
      if (arriving.amount_minor !== -leaving.amount_minor) continue;
      const apart = daysBetween(leaving.occurred_on, arriving.occurred_on);
      if (apart > DAYS_APART) continue;
      possible.push({ out: leaving.id, in: arriving.id, apart });
    }
  }

  possible.sort((a, b) => (a.apart - b.apart) || (a.out - b.out) || (a.in - b.in));
  const taken = new Set<number>();
  const pairs: Array<[number, number]> = [];
  for (const candidate of possible) {
    if (taken.has(candidate.out) || taken.has(candidate.in)) continue;
    taken.add(candidate.out);
    taken.add(candidate.in);
    pairs.push([candidate.out, candidate.in]);
  }
  return pairs;
}
