/**
 * An account's balance at the close of each of its last months, and what
 * came in and went out this month - for the account's detail shown beside
 * the list of accounts when the phone is held sideways (mockup `58e`).
 *
 * Worked back from today's balance, which is the one figure the app already
 * trusts (opening plus every movement): the close of a month is today's
 * balance less everything dated after that month. Nothing is stored. Pure:
 * dates are ISO strings, money in minor units, as the database holds them.
 */

export interface MovedMinor {
  occurred_on: string;
  amount_minor: number;
}

export interface MonthClose {
  /** 'YYYY-MM' of the month; today's own point is the current month. */
  month: string;
  /** The balance at the close of the month, or today for the current one. */
  closeMinor: number;
}

/** 'YYYY-MM' of a month `back` months before the one `today` is in. */
export function monthBefore(today: string, back: number): string {
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7)) - 1 - back;
  const y = year + Math.floor(month / 12);
  const m = ((month % 12) + 12) % 12;
  return `${y}-${String(m + 1).padStart(2, '0')}`;
}

/**
 * The close of each of the `months` months before this one, then today: the
 * oldest first, `months + 1` points in all. `moved` must hold every movement
 * of the account dated after the oldest close (more does no harm).
 */
export function monthlyCloses(balanceMinor: number, moved: readonly MovedMinor[], today: string, months: number): MonthClose[] {
  const closes: MonthClose[] = [];
  for (let back = months; back >= 1; back--) {
    const month = monthBefore(today, back);
    // Everything dated after the month's last day is not yet in its close.
    const after = moved.reduce((sum, m) => m.occurred_on.slice(0, 7) > month ? sum + m.amount_minor : sum, 0);
    closes.push({ month, closeMinor: balanceMinor - after });
  }
  closes.push({ month: today.slice(0, 7), closeMinor: balanceMinor });
  return closes;
}

/** What came into the account and what left it in the month `today` is in (transfers too). */
export function thisMonthFlows(moved: readonly MovedMinor[], today: string): { inMinor: number; outMinor: number } {
  const month = today.slice(0, 7);
  let inMinor = 0;
  let outMinor = 0;
  for (const m of moved) {
    if (m.occurred_on.slice(0, 7) !== month || m.occurred_on > today) continue;
    if (m.amount_minor > 0) inMinor += m.amount_minor;
    else outMinor -= m.amount_minor;
  }
  return { inMinor, outMinor };
}
