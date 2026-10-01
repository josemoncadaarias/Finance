/**
 * The UVR (unidad de valor real), day by day, from what the app knows.
 *
 * The Banco de la República publishes it every month for the 16th to the
 * 15th of the next one, by one rule: the UVR of the 15th of the month before,
 * grown by the monthly variation of the IPC of the month before the period
 * starts, in proportion to the days run (Ley 546 de 1999, metodología de la
 * Junta Directiva):
 *
 *     UVR(t) = UVR(15) * (1 + i) ^ (t / d),  rounded to 4 decimals
 *
 * t is the days since the 15th, d the days of the period, i the variation
 * (as published, two decimals of a percent). Checked against the bulletin of
 * 16 Sep - 15 Oct 2026 (Jose's reference package, 2026-10-01): from the 15th
 * of September and August's 0.39 %, all thirty published values come out
 * exactly.
 *
 * So a published or typed value is used as it is; any other day is worked
 * out from the nearest one through the IPC the app already keeps
 * (`inflation_months`), and says so: 'derived'. Where the IPC of a month is
 * not published yet, the last published variation stands in, and the value
 * says 'projected' - that is the case for every installment still to come.
 */

export type UvrKind = 'official' | 'typed' | 'derived' | 'projected';

export interface UvrValue {
  value: number;
  kind: UvrKind;
}

/** The UVR on a day, or null when nothing at all is known to work it from. */
export type UvrLookup = (day: string) => UvrValue | null;

/** UVR values are stored scaled by 10,000 (four decimals, as published). */
export const UVR_SCALE = 10_000;

export interface UvrSource {
  /** Values published or typed, by day: the value scaled by 10,000. */
  known: readonly { day: string; valueScaled: number; source: 'official' | 'typed' }[];
  /** The DANE's IPC, one row a month, the index times 100. */
  ipc: readonly { month: string; index: number }[];
}

/** A lookup over what is known, cached by day. */
export function uvrLookup(source: UvrSource): UvrLookup {
  const known = new Map<string, UvrValue>();
  for (const k of source.known) known.set(k.day, { value: k.valueScaled / UVR_SCALE, kind: k.source });
  const index = new Map(source.ipc.map(r => [r.month, r.index]));
  const months = [...index.keys()].sort();

  /** The month's variation as published: a fraction rounded to 4 decimals (0.39 % = 0.0039). */
  const variation = (month: string): { value: number; projected: boolean } | null => {
    const now = index.get(month);
    const before = index.get(shiftMonth(month, -1));
    if (now !== undefined && before !== undefined) return { value: Math.round((now / before - 1) * 10_000) / 10_000, projected: false };
    // Not published: the last published one stands in.
    const last = months.filter(m => m < month && index.has(shiftMonth(m, -1))).at(-1);
    if (!last) return null;
    return { value: Math.round((index.get(last)! / index.get(shiftMonth(last, -1))! - 1) * 10_000) / 10_000, projected: true };
  };

  // The 15th of each month, worked out once.
  const fifteenths = new Map<string, UvrValue | null>();
  const knownDays = [...known.keys()].sort();

  /** The UVR of the 15th of `month`, from a known day of the period it closes or opens, walking months if needed. */
  const fifteenth = (month: string): UvrValue | null => {
    if (fifteenths.has(month)) return fifteenths.get(month)!;
    fifteenths.set(month, null);
    const result = findFifteenth(month);
    fifteenths.set(month, result);
    return result;
  };

  const findFifteenth = (month: string): UvrValue | null => {
    const exact = known.get(`${month}-15`);
    if (exact) return exact;
    // A known day inside the period that starts on the 16th of `month`.
    const start = `${month}-16`;
    const end = `${shiftMonth(month, 1)}-15`;
    const inside = knownDays.find(day => day >= start && day <= end);
    const v = variation(shiftMonth(month, -1));
    if (inside && v) {
      const d = daysBetween(`${month}-15`, end);
      const t = daysBetween(`${month}-15`, inside);
      return { value: known.get(inside)!.value / Math.pow(1 + v.value, t / d), kind: 'derived' };
    }
    // Otherwise from a neighbour: forward from the month before, or back from the month after.
    const nearest = knownDays.length === 0 ? null : (knownDays[0] > end ? 'after' : 'before');
    if (nearest === 'before') {
      const previous = fifteenth(shiftMonth(month, -1));
      const grow = variation(shiftMonth(month, -2));
      if (previous && grow) return { value: round4(previous.value * (1 + grow.value)), kind: worse(previous.kind, grow.projected) };
    } else if (nearest === 'after') {
      const next = fifteenth(shiftMonth(month, 1));
      if (next && v) return { value: next.value / (1 + v.value), kind: worse(next.kind, v.projected) };
    }
    return null;
  };

  const cache = new Map<string, UvrValue | null>();
  return (day: string) => {
    if (cache.has(day)) return cache.get(day)!;
    let result: UvrValue | null = known.get(day) ?? null;
    if (!result) {
      // The period a day belongs to starts on the 16th of its month, or of the month before.
      const month = Number(day.slice(8, 10)) >= 16 ? day.slice(0, 7) : shiftMonth(day.slice(0, 7), -1);
      const base = fifteenth(month);
      const v = variation(shiftMonth(month, -1));
      if (base && v) {
        const d = daysBetween(`${month}-15`, `${shiftMonth(month, 1)}-15`);
        const t = daysBetween(`${month}-15`, day);
        result = { value: round4(base.value * Math.pow(1 + v.value, t / d)), kind: worse(base.kind, v.projected) };
      }
    }
    cache.set(day, result);
    return result;
  };
}

function worse(kind: UvrKind, projected: boolean): UvrKind {
  if (projected || kind === 'projected') return 'projected';
  return 'derived';
}

function round4(value: number): number {
  return Math.round(value * UVR_SCALE) / UVR_SCALE;
}

export function shiftMonth(month: string, by: number): string {
  const [y, m] = month.split('-').map(Number);
  const at = new Date(Date.UTC(y, m - 1 + by, 1));
  return `${at.getUTCFullYear()}-${String(at.getUTCMonth() + 1).padStart(2, '0')}`;
}

function daysBetween(from: string, to: string): number {
  const ms = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
  return Math.round((ms(to) - ms(from)) / 86_400_000);
}
