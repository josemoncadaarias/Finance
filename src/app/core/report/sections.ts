/**
 * The analyses themselves.
 *
 * Each one is a pure function from `ReportData` to a block, or to null when it
 * has nothing to say about this period. They know nothing about screens or
 * spreadsheets, which is what lets both read them, and nothing about the
 * database, which is what lets the test runner run them.
 *
 * They add up the period with `totalsOf` and `slicesOf` - the summary screen's
 * own functions, not copies of them. The report must never be able to disagree
 * with the screen the user just came from.
 */

import { slicesOf, totalsOf, type Movement } from '../../features/movements/group-movements';
import {
  count, date, money, percent, text,
  type Block, type FiguresBlock, type RankedBlock, type Section, type Value,
} from './blocks';
import { daysElapsed, type ReportData } from './report-data';
import { fill } from './report-words';
import {
  versusBefore, categoriesVersusBefore, recurringSpending, repeatedCharges, spendingByMonth, unusualJumps,
} from './sections-over-time';


/** What a movement is worth here, always positive. */
function amount(movement: Movement, data: ReportData): number {
  return Math.abs(data.basis === 'own'
    ? movement.transaction.amount_minor
    : movement.transaction.amount_base_minor);
}

// ---------------------------------------------------------------------------

/**
 * The figures that answer "how did this period go" before anything is read.
 *
 * Income, spending and what is left are the three anyone looks for. The rest
 * are there because they explain those three: the average says whether the
 * total is a pace or an accident, and the biggest expense plus the biggest
 * category are, more often than not, the whole explanation.
 */
export const headlineFigures: Section<ReportData> = data => {
  if (data.movements.length === 0) return null;

  const words = data.words;
  const totals = totalsOf(data.movements, data.basis);
  const balance = totals.inMinor - totals.outMinor;
  const { days, whole } = daysElapsed(data);

  const figures: FiguresBlock['figures'] = [
    { label: words['report.headline.income'], value: money(totals.inMinor, data.currency), tone: 'good' },
    { label: words['report.headline.expenses'], value: money(totals.outMinor, data.currency), tone: 'bad' },
    {
      label: words['report.headline.balance'],
      value: money(balance, data.currency),
      tone: balance < 0 ? 'bad' : 'good',
      note: balance < 0 ? words['report.headline.overspent'] : undefined,
    },
  ];

  /*
   * What was left of what came in.
   *
   * Only when something came in AND something was left. With no income the
   * fraction has nothing to divide by; with a negative balance it produces
   * figures like -1,565%, which is what Jose's September really works out to
   * - a month whose income landed in another account - and which reads as a
   * broken number rather than as a fact. The balance above is already red and
   * already says he spent more than he received, which is the same news said
   * in a way that can be believed.
   */
  if (totals.inMinor > 0 && balance >= 0) {
    figures.push({
      label: words['report.headline.saved'],
      value: percent(Math.round((balance / totals.inMinor) * 100)),
      tone: balance < 0 ? 'bad' : 'good',
      note: words['report.headline.savedNote'],
    });
  }

  // Money moved between the user's own accounts, and money that arrived that
  // way. The summary screen shows both beside income and spending, and the
  // report has to as well: the categories further down include what was
  // moved, so leaving it out here left a total that could not be reconciled
  // with the one above it - 16.6M of spending against 18.07M of categories,
  // with nothing on the page explaining the 1.47M between them.
  if (totals.movedMinor > 0) {
    figures.push({ label: words['summary.moved'], value: money(totals.movedMinor, data.currency) });
  }
  if (totals.receivedMinor > 0) {
    figures.push({ label: words['summary.received'], value: money(totals.receivedMinor, data.currency) });
  }

  figures.push({ label: words['report.headline.movements'], value: count(data.movements.length) });

  // The daily average, over the days that have HAPPENED. Over the whole of a
  // month that is only three weeks old it would read a third low, and low is
  // the direction that tells the user what they would like to hear.
  if (days > 0 && totals.outMinor > 0) {
    figures.push({
      label: words['report.headline.perDay'],
      value: money(Math.round(totals.outMinor / days), data.currency),
      note: whole ? undefined : fill(words['report.headline.perDayNote'], { days }),
    });
  }

  // What came in a day, beside what went out. Both or neither: one alone
  // invites the reader to compare it against a total instead of its opposite.
  if (days > 0 && totals.inMinor > 0) {
    figures.push({
      label: words['report.headline.inPerDay'],
      value: money(Math.round(totals.inMinor / days), data.currency),
      note: whole ? undefined : fill(words['report.headline.perDayNote'], { days }),
    });
  }

  const spent = data.movements.filter(movement => movement.flow === 'out');
  if (spent.length > 0) {
    const biggest = spent.reduce((worst, movement) =>
      amount(movement, data) > amount(worst, data) ? movement : worst);
    figures.push({
      label: words['report.headline.biggest'],
      value: money(amount(biggest, data), data.currency),
      note: biggest.transaction.description?.trim() || biggest.label,
    });
  }

  const top = slicesOf(data.movements, data.basis).find(slice => slice.flow === 'out');
  if (top) {
    figures.push({
      label: words['report.headline.topCategory'],
      value: text(top.label),
      note: `${top.percent}% · ${words['report.column.amount']}`,
    });
  }

  return { kind: 'figures', id: 'headline', title: words['report.headline'], about: words['report.about.headline'], figures };
};

// ---------------------------------------------------------------------------

/**
 * The donut, written out.
 *
 * The ring answers "which is biggest" at a glance and nothing else: it cannot
 * say 14% against 11%, and it cannot be read at all past a handful of slices.
 * Here every category is a row with its share, its amount and how many
 * movements are behind it - which is the question the ring always raises and
 * never answers.
 *
 * `slicesOf` is the summary screen's own, so the percentages are the same
 * percentages, down to the same rounding.
 */
export const categoryBreakdown: Section<ReportData> = data => {
  const slices = slicesOf(data.movements, data.basis);
  if (slices.length === 0) return null;

  const behind = new Map<string, number>();
  for (const movement of data.movements) {
    behind.set(movement.label, (behind.get(movement.label) ?? 0) + 1);
  }

  const rows: RankedBlock['rows'] = slices.map(slice => ({
    label: slice.label,
    value: money(slice.amountMinor, data.currency),
    // Income has no share of what was spent, and shows none rather than a 0%
    // that reads as "this was nothing".
    share: slice.flow === 'in' || slice.flow === 'received' ? undefined : slice.percent,
    behind: behind.get(slice.label),
    icon: slice.icon,
    customIconId: slice.customIconId,
    flow: slice.flow,
  }));

  /*
   * The total is the headline's own arithmetic, not a re-sum of the rows.
   *
   * Those two can differ, and on Jose's real August they did - by 1,429.90.
   * A refund on a credit card comes off its own category, and that category
   * was one he also uses for income; `slicesOf` gives a slice the flow of the
   * FIRST movement it sees, so the slice was an income slice and the refund
   * went quietly inside it instead of off the spending.
   *
   * That is how the donut on the summary screen behaves, and it is not this
   * report's business to change it. What this report must not do is print two
   * totals that cannot be reconciled: the user compares the table's total
   * against "Gastos" above it, and a difference nothing explains costs the
   * trust of both figures. So the total is `outMinor + movedMinor`, exactly
   * what the headline shows, and it agrees by construction.
   */
  const totals = totalsOf(data.movements, data.basis);
  const spent = totals.outMinor + totals.movedMinor;

  return {
    kind: 'ranked',
    id: 'categories',
    title: data.words['report.categories'],
    about: data.words['report.about.categories'],
    rowsAre: data.words['report.categories.row'],
    rows,
    totalLabel: data.words['report.categories.total'],
    total: money(spent, data.currency),
  };
};

// ---------------------------------------------------------------------------

/** How many of the biggest are worth listing, and the fewest worth listing at all. */
const BIGGEST = 10;
const BIGGEST_AT_LEAST = 5;

/**
 * The biggest movements of the period.
 *
 * A month that went wrong is usually three movements, not thirty small ones,
 * and this is the fastest way to see whether that is the case. Below a handful
 * of movements the list is just the list again, so it says nothing and removes
 * itself.
 */
export const biggestMovements: Section<ReportData> = data => {
  const spent = data.movements.filter(movement => movement.flow === 'out');
  if (spent.length < BIGGEST_AT_LEAST) return null;

  const rows = [...spent]
    .sort((a, b) => amount(b, data) - amount(a, data))
    .slice(0, BIGGEST)
    .map(movement => ({
      label: movement.transaction.description?.trim() || movement.label,
      value: money(amount(movement, data), data.currency),
      icon: movement.icon,
      customIconId: movement.customIconId,
      flow: movement.flow,
      // The date and the category, which is what tells two similar amounts
      // apart when the note is empty or says the same thing twice.
      note: `${movement.transaction.occurred_on} · ${movement.label}`,
    }));

  return {
    kind: 'ranked',
    id: 'biggest',
    title: data.words['report.biggest'],
    about: data.words['report.about.biggest'],
    rowsAre: data.words['report.biggest.row'],
    rows,
  };
};

// ---------------------------------------------------------------------------

/**
 * Spending split by account, and only when that is a question.
 *
 * With one account chosen the answer is the whole report, so the section is
 * not there. With all of them it is the missing half of the donut: the
 * categories say what the money was for, and this says where it came from -
 * which card is carrying the month.
 */
export const spendingByAccount: Section<ReportData> = data => {
  if (data.account !== null) return null;

  const spent = new Map<number, { name: string; total: number; behind: number }>();
  let all = 0;

  for (const movement of data.movements) {
    if (movement.flow !== 'out' && movement.flow !== 'refund') continue;

    const signed = movement.flow === 'refund' ? -amount(movement, data) : amount(movement, data);
    const id = movement.transaction.account_id;
    const found = spent.get(id);
    if (found) {
      found.total += signed;
      found.behind += 1;
    } else {
      spent.set(id, { name: movement.accountName, total: signed, behind: 1 });
    }
    all += signed;
  }

  if (spent.size < 2) return null;

  const accounts = new Map(data.accounts.map(account => [account.id, account]));
  const rows = [...spent.entries()]
    .sort(([, a], [, b]) => b.total - a.total)
    .map(([id, found]) => ({
      label: found.name,
      value: money(found.total, data.currency),
      share: all > 0 ? Math.round((found.total / all) * 100) : undefined,
      behind: found.behind,
      icon: accounts.get(id)?.builtin_icon ?? null,
      customIconId: accounts.get(id)?.custom_icon_id ?? null,
      flow: 'out' as const,
    }));

  return {
    kind: 'ranked',
    id: 'accounts',
    title: data.words['report.accounts'],
    about: data.words['report.about.accounts'],
    rowsAre: data.words['report.accounts.row'],
    rows,
    totalLabel: data.words['report.categories.total'],
    total: money(all, data.currency),
  };
};

// ---------------------------------------------------------------------------

/**
 * The report, in the order it is read - on screen and on the sheet alike.
 *
 * A new analysis is a function above and a line here. Nothing else changes:
 * not the screen, not the spreadsheet.
 */
export const SECTIONS: readonly Section<ReportData>[] = [
  // What happened, then whether that is normal, then what is behind it.
  headlineFigures,
  versusBefore,
  unusualJumps,
  categoryBreakdown,
  categoriesVersusBefore,
  recurringSpending,
  repeatedCharges,
  spendingByMonth,
  spendingByAccount,
  biggestMovements,
];

/** Runs them, dropping the ones with nothing to say. */
export function buildReport(data: ReportData): Block[] {
  return SECTIONS.map(section => section(data)).filter((block): block is Block => block !== null);
}

/** Re-exported so a caller needs only this module. */
export type { Block, Value };
