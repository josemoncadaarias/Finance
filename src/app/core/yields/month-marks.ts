/**
 * Where a month already worked out has to be worked out again (2026-10-02).
 *
 * Each accrual keeps, per account, a mark of what each month holds
 * (`YieldsRepository.monthMarks`); comparing it with what the months hold now
 * says the earliest month that changed - a movement typed late, one deleted,
 * an entry, a typed balance or a rate dated back.
 */

/**
 * The first day of the earliest month whose marks differ, or null when none
 * does. A month present on one side only is a change too. '0000-00' - the
 * opening balance - comes first of all, and stands for the very beginning.
 */
export function earliestChange(before: Record<string, string>, now: Record<string, string>): string | null {
  const months = [...new Set([...Object.keys(before), ...Object.keys(now)])].sort();
  const changed = months.find(month => before[month] !== now[month]);
  if (changed === undefined) return null;
  return changed === '0000-00' ? '0000-01-01' : `${changed}-01`;
}
