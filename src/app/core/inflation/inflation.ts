/**
 * The inflation a return is set against.
 *
 * The DANE publishes one index a month, and with it the figure everybody
 * quotes: the ANNUAL inflation, that month's index against the same month a
 * year before. Jose, 2026-09-24, after a first version annualised January to
 * September and came out at 7.98% - Colombian prices rise most at the start
 * of the year, so that pace is not a year's inflation at all:
 *
 *   - compare against the AVERAGE of the annual inflation the DANE has
 *     published for the year so far, month by month - "el promedio del año
 *     hasta esa fecha";
 *   - never take figures of another year: a period in 2026 is measured with
 *     2026's figures;
 *   - with nothing of that year published yet (the first days of January),
 *     take last year's December, and say so.
 *
 * A period that crosses a year end is measured year by year, each weighted by
 * its days in the period. Nothing here is ever fetched: it works on the months
 * it is handed.
 */

export interface InflationMonth {
  /** `YYYY-MM`. */
  month: string;
  /** The DANE's index times 100 (base December 2018 = 100). */
  index_scaled: number;
}

export interface InflationReference {
  /** The annual inflation to compare with, as a fraction: 0.0577 is 5.77%. */
  annual: number;
  /** The published months averaged, first and last `YYYY-MM`, of the last year covered. */
  firstMonth: string | null;
  lastMonth: string | null;
  /** Set when no month of that year was published: last year's December was used. */
  borrowed: string | null;
}

const DAY = 86_400_000;

function toTime(day: string): number {
  return Date.parse(`${day}T00:00:00Z`);
}

function sameMonthYearBefore(month: string): string {
  return `${Number(month.slice(0, 4)) - 1}${month.slice(4)}`;
}

/** The annual inflation the DANE published for one month, or null if it has not. */
function annualOf(index: ReadonlyMap<string, number>, month: string): number | null {
  const now = index.get(month);
  const before = index.get(sameMonthYearBefore(month));
  return now && before ? now / before - 1 : null;
}

/** One year's reference up to a month of it: the average of what was published. */
function yearReference(index: ReadonlyMap<string, number>, year: number, upTo: number) {
  const published: { month: string; annual: number }[] = [];
  for (let at = 1; at <= upTo; at += 1) {
    const month = `${year}-${String(at).padStart(2, '0')}`;
    const annual = annualOf(index, month);
    if (annual !== null) published.push({ month, annual });
  }
  if (published.length > 0) {
    return {
      annual: published.reduce((sum, one) => sum + one.annual, 0) / published.length,
      firstMonth: published[0].month,
      lastMonth: published[published.length - 1].month,
      borrowed: null,
    };
  }
  const december = `${year - 1}-12`;
  const annual = annualOf(index, december);
  return annual === null ? null : { annual, firstMonth: null, lastMonth: null, borrowed: december };
}

/**
 * The inflation to set a return from `from` to `to` (both `YYYY-MM-DD`)
 * against. Null when there is nothing to go on.
 */
export function inflationReference(
  months: readonly InflationMonth[], from: string, to: string,
): InflationReference | null {
  if (to < from) return null;
  const index = new Map(months.map(one => [one.month, one.index_scaled]));

  let weighted = 0;
  let days = 0;
  let last: ReturnType<typeof yearReference> = null;
  for (let year = Number(from.slice(0, 4)); year <= Number(to.slice(0, 4)); year += 1) {
    const start = `${year}-01-01` > from ? `${year}-01-01` : from;
    const end = `${year}-12-31` < to ? `${year}-12-31` : to;
    const reference = yearReference(index, year, Number(end.slice(5, 7)));
    if (reference === null) return null;
    const inYear = Math.round((toTime(end) - toTime(start)) / DAY) + 1;
    weighted += reference.annual * inYear;
    days += inYear;
    last = reference;
  }
  if (last === null || days === 0) return null;
  return {
    annual: weighted / days,
    firstMonth: last.firstMonth,
    lastMonth: last.lastMonth,
    borrowed: last.borrowed,
  };
}
