/**
 * The period every screen is filtered by.
 *
 * Day, week, month, year, all time, or a range picked by hand — and stepping
 * one period backwards or forwards, which is what the swipe gesture does. All
 * of it is plain data and pure functions, so it is testable without a browser
 * and cannot drift from what the screens show.
 *
 * Dates are ISO strings throughout, matching the database. Ranges are
 * **inclusive at both ends**, because that is what `occurred_on BETWEEN ? AND ?`
 * means and a half-open range would quietly drop the last day of every month.
 */

export type PeriodKind = 'day' | 'week' | 'month' | 'year' | 'all' | 'range';

export interface Period {
  kind: PeriodKind;
  /** Inclusive first day, `YYYY-MM-DD`. Null only when the kind is `all`. */
  from: string | null;
  /** Inclusive last day. Null only when the kind is `all`. */
  to: string | null;
}

/**
 * Month and weekday names come from `Intl`, which already knows every
 * language, rather than from a list written by hand in one of them.
 *
 * The formatters are built once per locale and kept: constructing one costs
 * far more than using it, and this runs for every group heading in a list that
 * can hold a year of movements.
 */
const formatters = new Map<string, { month: Intl.DateTimeFormat; weekday: Intl.DateTimeFormat }>();

function namesFor(locale: string) {
  let found = formatters.get(locale);
  if (!found) {
    found = {
      month: new Intl.DateTimeFormat(locale, { month: 'long' }),
      weekday: new Intl.DateTimeFormat(locale, { weekday: 'long' }),
    };
    formatters.set(locale, found);
  }
  return found;
}

export function monthName(date: Date, locale = 'es-CO'): string {
  return namesFor(locale).month.format(date);
}

export function weekdayName(date: Date, locale = 'es-CO'): string {
  return namesFor(locale).weekday.format(date);
}

/** Everything, with no bounds. */
export const ALL_TIME: Period = { kind: 'all', from: null, to: null };

export function isoDay(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/**
 * Parses an ISO day into a local `Date` at midnight.
 *
 * Built from the parts rather than `new Date(iso)`, which reads a bare
 * `YYYY-MM-DD` as UTC and lands on the previous day for anyone west of
 * Greenwich — Colombia included. That would shift every period by one day.
 */
export function fromIsoDay(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/** The period of the given kind containing `date`. */
export function periodContaining(kind: PeriodKind, date: Date): Period {
  switch (kind) {
    case 'all':
      return ALL_TIME;

    case 'day':
      return { kind, from: isoDay(date), to: isoDay(date) };

    case 'week': {
      // Weeks run Monday to Sunday, which is how a Colombian week reads.
      const monday = new Date(date);
      const weekday = (date.getDay() + 6) % 7;
      monday.setDate(date.getDate() - weekday);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      return { kind, from: isoDay(monday), to: isoDay(sunday) };
    }

    case 'month': {
      const first = new Date(date.getFullYear(), date.getMonth(), 1);
      const last = new Date(date.getFullYear(), date.getMonth() + 1, 0);
      return { kind, from: isoDay(first), to: isoDay(last) };
    }

    case 'year':
      return {
        kind,
        from: isoDay(new Date(date.getFullYear(), 0, 1)),
        to: isoDay(new Date(date.getFullYear(), 11, 31)),
      };

    case 'range':
      // A range has no natural period around a date; the caller supplies both
      // ends. Falling back to the day keeps the function total.
      return { kind: 'day', from: isoDay(date), to: isoDay(date) };
  }
}

/** The period of the given kind containing today. */
export function currentPeriod(kind: PeriodKind, today: Date = new Date()): Period {
  return periodContaining(kind, today);
}

/**
 * Steps a period backwards or forwards — one swipe.
 *
 * `all` and `range` do not step: neither has a next one. Returning the period
 * unchanged lets the caller swipe without having to check first.
 */
export function shiftPeriod(period: Period, steps: number): Period {
  if (period.kind === 'all' || period.kind === 'range' || period.from === null) {
    return period;
  }

  const start = fromIsoDay(period.from);

  switch (period.kind) {
    case 'day':
      start.setDate(start.getDate() + steps);
      break;
    case 'week':
      start.setDate(start.getDate() + steps * 7);
      break;
    case 'month':
      // Day 1 first: stepping from the 31st would otherwise skip short months.
      start.setDate(1);
      start.setMonth(start.getMonth() + steps);
      break;
    case 'year':
      start.setFullYear(start.getFullYear() + steps);
      break;
  }

  return periodContaining(period.kind, start);
}

/** A custom range, with the ends put in order if they arrive reversed. */
export function rangePeriod(from: string, to: string): Period {
  return from <= to
    ? { kind: 'range', from, to }
    : { kind: 'range', from: to, to: from };
}

/** True when the period includes today, so the app knows not to step forward. */
export function includesToday(period: Period, today: Date = new Date()): boolean {
  if (period.kind === 'all') return true;
  if (period.from === null || period.to === null) return true;
  const day = isoDay(today);
  return period.from <= day && day <= period.to;
}

/**
 * What the period strip shows: "septiembre 2026", "8 de septiembre", "2026".
 *
 * Short enough to sit in a header, and specific enough that the year is never
 * a guess — a month label without its year is a small trap in an app holding
 * five years of history.
 *
 * `allLabel` is passed in rather than written here: this module formats dates
 * and knows nothing about which language the app is speaking.
 */
export function periodLabel(period: Period, locale = 'es-CO', allLabel = 'All'): string {
  if (period.kind === 'all') return allLabel;
  if (period.from === null || period.to === null) return allLabel;

  const start = fromIsoDay(period.from);
  const joiner = locale.startsWith('es') ? ' de ' : ' ';

  switch (period.kind) {
    case 'day':
      return `${weekdayName(start, locale)} ${start.getDate()}${joiner}${monthName(start, locale)}`;

    case 'week': {
      const end = fromIsoDay(period.to);
      const sameMonth = start.getMonth() === end.getMonth();
      return sameMonth
        ? `${start.getDate()}–${end.getDate()}${joiner}${monthName(start, locale)}`
        : `${start.getDate()} ${monthName(start, locale)} – ${end.getDate()} ${monthName(end, locale)}`;
    }

    case 'month':
      return `${monthName(start, locale)} ${start.getFullYear()}`;

    case 'year':
      return String(start.getFullYear());

    case 'range': {
      const end = fromIsoDay(period.to);
      return `${start.getDate()}/${start.getMonth() + 1}/${start.getFullYear()} – ` +
             `${end.getDate()}/${end.getMonth() + 1}/${end.getFullYear()}`;
    }
  }
}

/** The period buttons, in the order Monefy lists them. Named by the screen. */
export const PERIOD_KINDS: { kind: PeriodKind; label: string }[] = [
  { kind: 'day', label: 'period.day' },
  { kind: 'week', label: 'period.week' },
  { kind: 'month', label: 'period.month' },
  { kind: 'year', label: 'period.year' },
  { kind: 'all', label: 'period.all' },
  { kind: 'range', label: 'period.range' },
];
