import type { Rate } from '../database/repositories/rates.repository';

/**
 * The first day of the run of official TRM rows, ending today, that hold the
 * value in force today: the day that TRM started to rule. Null when today's
 * value is not an official TRM (typed by hand, sample data).
 */
export function trmSince(history: readonly Rate[], today: string): string | null {
  const upToToday = history.filter(rate => rate.on_date <= today)
    .sort((a, b) => (a.on_date < b.on_date ? 1 : -1));
  const current = upToToday[0];
  if (!current || current.source !== 'trm') return null;
  let since = current.on_date;
  for (const rate of upToToday.slice(1)) {
    if (rate.source !== 'trm' || rate.rate_scaled !== current.rate_scaled) break;
    since = rate.on_date;
  }
  return since;
}
