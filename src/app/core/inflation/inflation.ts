/**
 * What inflation did to pesos over a stretch of days.
 *
 * The DANE publishes one index a month; a month's variation is its index over
 * the one before. A period rarely starts on the first, so each month's
 * variation is spread evenly over its days, compounding, and the period takes
 * the days it covers.
 *
 * A month not published yet - the running one, always, and the one before it
 * until about the 8th - is estimated: the average month of the last twelve
 * that were published. The answer says which months were estimated, and the
 * screen says so, the way the tax simulator labels a figure it borrowed.
 * Nothing here is ever fetched: it works on the months it is handed.
 */

export interface InflationMonth {
  /** `YYYY-MM`. */
  month: string;
  /** The DANE's index times 100 (base December 2018 = 100). */
  index_scaled: number;
}

export interface InflationOver {
  /** What pesos lost over the days, as a fraction: 0.012 is 1.2%. */
  rate: number;
  /** The same at a yearly pace, so it sits beside an E.A. rate. */
  annual: number;
  /** Months of the period that had to be estimated, `YYYY-MM`. */
  estimated: string[];
  /** The last month the DANE has published, or null with none on record. */
  lastPublished: string | null;
}

const DAY = 86_400_000;

function toTime(day: string): number {
  return Date.parse(`${day}T00:00:00Z`);
}

function monthBefore(month: string): string {
  const [year, number] = month.split('-').map(Number);
  return number === 1 ? `${year - 1}-12` : `${year}-${String(number - 1).padStart(2, '0')}`;
}

function monthsBetween(from: string, to: string): number {
  const [a, b] = [from, to].map(month => Number(month.slice(0, 4)) * 12 + Number(month.slice(5, 7)));
  return b - a;
}

function daysIn(month: string): number {
  const [year, number] = month.split('-').map(Number);
  return new Date(Date.UTC(year, number, 0)).getUTCDate();
}

/**
 * Inflation from the start of `from` to the end of `to`, both `YYYY-MM-DD`.
 * Null when there is nothing to go on: no months at all, or a period that
 * starts before the first one on record.
 */
export function inflationOver(
  months: readonly InflationMonth[], from: string, to: string,
): InflationOver | null {
  if (months.length < 2 || to < from) return null;
  const index = new Map(months.map(one => [one.month, one.index_scaled]));
  const sorted = [...index.keys()].sort();
  const last = sorted[sorted.length - 1];

  // The estimate: the average month of the last twelve published.
  const yearAgo = `${Number(last.slice(0, 4)) - 1}${last.slice(4)}`;
  const base = index.has(yearAgo) ? yearAgo : sorted[0];
  const span = monthsBetween(base, last);
  const typical = Math.pow(index.get(last)! / index.get(base)!, 1 / span) - 1;

  let factor = 1;
  const estimated: string[] = [];
  for (let t = toTime(from); t <= toTime(to); t += DAY) {
    const month = new Date(t).toISOString().slice(0, 7);
    let variation: number;
    if (index.has(month) && index.has(monthBefore(month))) {
      variation = index.get(month)! / index.get(monthBefore(month))! - 1;
    } else if (month > last) {
      variation = typical;
      if (!estimated.includes(month)) estimated.push(month);
    } else {
      return null;
    }
    factor *= Math.pow(1 + variation, 1 / daysIn(month));
  }

  const days = Math.round((toTime(to) - toTime(from)) / DAY) + 1;
  return {
    rate: factor - 1,
    annual: Math.pow(factor, 365 / days) - 1,
    estimated,
    lastPublished: last,
  };
}
