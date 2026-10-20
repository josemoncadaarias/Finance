/**
 * The legal maximum rate (tasa de usura) for consumer and ordinary credit, by
 * month: 1.5 times the interés bancario corriente the Superfinanciera
 * certifies each month. A card whose own rate is not on record is weighed at
 * it, said as a reference: cards usually charge close to it.
 *
 * Shipped as known, from the Superfinanciera's resolutions as reported by
 * actualicese.com and portafolio.co (looked up 2026-09-29). A month not here
 * takes the latest one before it, and says which month that was.
 */

import { EA_SCALE } from '../loans/schedule';

const KNOWN: readonly { month: string; percent: number }[] = [
  { month: '2026-08', percent: 29.66 },
  { month: '2026-09', percent: 29.24 },
];

/** The reference for a day: the rate as E.A. scaled, and the month it is of. */
export function usuryOn(today: string): { rateScaled: number; month: string } {
  const month = today.slice(0, 7);
  const known = [...KNOWN].reverse().find(k => k.month <= month) ?? KNOWN[0];
  return { rateScaled: Math.round(known.percent * EA_SCALE / 100), month: known.month };
}
