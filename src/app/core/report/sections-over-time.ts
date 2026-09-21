/**
 * The analyses that need more than one stretch of time.
 *
 * A period on its own says what happened. These say whether that is normal,
 * which is the question anyone actually has: 9.8 million of spending means
 * nothing until you know last month was 8.5.
 *
 * Same contract as the rest - pure functions over `ReportData`, returning a
 * block or null - and the same rule about having nothing to say: a first
 * month with nothing before it, or a single month asked to show a trend,
 * removes itself rather than printing a table of one column.
 */

import { slicesOf, totalsOf, type Movement } from '../../features/movements/group-movements';
import { monthName } from '../filters/period';
import { formatMoney } from '../database/money';
import {
  count, money, percent,
  type ComparisonBlock, type NoteBlock, type RankedBlock, type Section, type TrendBlock,
} from './blocks';
import { daysElapsed, monthsIn, type ReportData } from './report-data';
import { fill } from './report-words';

/** What a movement is worth here, always positive. */
function amount(movement: Movement, data: ReportData): number {
  return Math.abs(data.basis === 'own'
    ? movement.transaction.amount_minor
    : movement.transaction.amount_base_minor);
}

/**
 * The change from one figure to another, as a percentage.
 *
 * Null when there is nothing to divide by. Growth from zero is not "infinite
 * per cent", it is "this is new", and a report that prints ∞% has stopped
 * being read.
 */
function changeFrom(before: number, now: number): number | null {
  if (before === 0) return null;
  /*
   * Divided by the SIZE of the earlier figure, not the figure itself.
   *
   * Dividing by a negative one flips the sign and inverts the meaning. Jose's
   * balance went from -6,379,788 to -12,105,570 - twice as far under - and
   * the plain formula called that "+90%", which the report then painted green
   * as growth. Against the size, it is -90%: the balance fell, which is what
   * happened and what the colour should say.
   */
  return Math.round(((now - before) / Math.abs(before)) * 100);
}

/**
 * The same, for a column of a table rather than a sentence.
 *
 * Past a point a percentage stops informing. Jose's balance went from
 * 1,582,426 to 59,473,240 - "+3,658%", which says only that the earlier
 * figure was small. The two amounts sit beside it in the table and say it
 * better, so the percentage steps aside.
 *
 * A sentence is different: "Dian subió 4,201%" is the whole point of that
 * sentence, and it keeps its figure.
 */
function tabledChange(before: number, now: number): number | null {
  const change = changeFrom(before, now);
  if (change === null) return null;
  return Math.abs(change) >= 1000 ? null : change;
}

/** Spending per category, keyed the way the donut labels it. */
function spentByLabel(movements: readonly Movement[], data: ReportData): Map<string, number> {
  const totals = new Map<string, number>();
  for (const movement of movements) {
    if (movement.flow !== 'out' && movement.flow !== 'refund') continue;
    const signed = movement.flow === 'refund' ? -amount(movement, data) : amount(movement, data);
    totals.set(movement.label, (totals.get(movement.label) ?? 0) + signed);
  }
  return totals;
}

// ---------------------------------------------------------------------------

/**
 * This period against the same stretch of the one before.
 *
 * "The same stretch" is the whole point: on the 21st this is 21 days against
 * 21 days, never against a whole month. `equivalentBefore` does the cutting;
 * this says out loud that it happened, because a reader who assumes it is a
 * whole month will misread every row.
 */
export const versusBefore: Section<ReportData> = data => {
  const before = data.before;
  if (before === null || before.movements.length === 0) return null;

  const words = data.words;
  const now = totalsOf(data.movements, data.basis);
  const was = totalsOf(before.movements, data.basis);

  const rows: ComparisonBlock['rows'] = [
    {
      label: words['report.headline.income'],
      before: money(was.inMinor, data.currency),
      now: money(now.inMinor, data.currency),
      changePercent: tabledChange(was.inMinor, now.inMinor),
      growthIs: 'good',
    },
    {
      label: words['report.headline.expenses'],
      before: money(was.outMinor, data.currency),
      now: money(now.outMinor, data.currency),
      changePercent: tabledChange(was.outMinor, now.outMinor),
      growthIs: 'bad',
    },
    {
      label: words['report.headline.balance'],
      before: money(was.inMinor - was.outMinor, data.currency),
      now: money(now.inMinor - now.outMinor, data.currency),
      changePercent: tabledChange(was.inMinor - was.outMinor, now.inMinor - now.outMinor),
      growthIs: 'good',
    },
    {
      label: words['report.headline.movements'],
      before: count(before.movements.length),
      now: count(data.movements.length),
      changePercent: tabledChange(before.movements.length, data.movements.length),
      growthIs: 'good',
    },
  ];

  return {
    kind: 'comparison',
    id: 'versus',
    title: words['report.versus'],
    beforeLabel: before.label,
    nowLabel: data.periodLabel,
    caveat: before.clipped
      ? fill(words['report.versus.sameDays'], { days: daysElapsed(data).days })
      : undefined,
    rows,
  };
};

// ---------------------------------------------------------------------------

/** How many categories are worth comparing before the list becomes a wall. */
const COMPARED = 8;

/**
 * The categories, then and now.
 *
 * Ordered by what they cost THIS period, because the question is "what am I
 * spending on", not "what did I used to". A category that has gone is still
 * listed, at nought, since a habit that stopped is as much news as one that
 * started.
 */
export const categoriesVersusBefore: Section<ReportData> = data => {
  const before = data.before;
  if (before === null || before.movements.length === 0) return null;

  const now = spentByLabel(data.movements, data);
  const was = spentByLabel(before.movements, data);
  if (now.size === 0 && was.size === 0) return null;

  const labels = [...new Set([...now.keys(), ...was.keys()])]
    .sort((a, b) => (now.get(b) ?? 0) - (now.get(a) ?? 0))
    .slice(0, COMPARED);

  const rows: ComparisonBlock['rows'] = labels.map(label => ({
    label,
    before: money(was.get(label) ?? 0, data.currency),
    now: money(now.get(label) ?? 0, data.currency),
    changePercent: tabledChange(was.get(label) ?? 0, now.get(label) ?? 0),
    growthIs: 'bad',
  }));

  return {
    kind: 'comparison',
    id: 'categories-versus',
    title: data.words['report.versus.categories'],
    beforeLabel: before.label,
    nowLabel: data.periodLabel,
    rows,
  };
};

// ---------------------------------------------------------------------------

/** Groups movements by the month they happened in. */
function byMonth(movements: readonly Movement[]): Map<string, Movement[]> {
  const months = new Map<string, Movement[]>();
  for (const movement of movements) {
    const month = movement.transaction.occurred_on.slice(0, 7);
    const found = months.get(month);
    if (found) found.push(movement);
    else months.set(month, [movement]);
  }
  return months;
}

/** "Septiembre 2026", in the reader's own language. */
function monthLabel(month: string, locale: string): string {
  const [year, at] = month.split('-').map(Number);
  const name = monthName(new Date(year, at - 1, 1), locale);
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${year}`;
}

/**
 * Spending month by month, with the line it averages out to.
 *
 * Only where the period covers more than one: a single month against its own
 * average is one bar and a line through it, which answers nothing. A month
 * still running is left out of the average rather than dragging it down -
 * three weeks of September would make every finished month look extravagant.
 */
export const spendingByMonth: Section<ReportData> = data => {
  const months = monthsIn(data.period, data.today);
  if (months.length < 2) return null;

  const grouped = byMonth(data.movements);
  const thisMonth = data.today.slice(0, 7);
  const { whole } = daysElapsed(data);

  const points: TrendBlock['points'] = months.map(month => ({
    label: monthLabel(month, data.locale),
    value: money(totalsOf(grouped.get(month) ?? [], data.basis).outMinor, data.currency),
  }));

  const counted = months.filter(month => whole || month !== thisMonth);
  const total = counted.reduce((sum, month) =>
    sum + totalsOf(grouped.get(month) ?? [], data.basis).outMinor, 0);
  const average = counted.length > 0 ? Math.round(total / counted.length) : 0;

  return {
    kind: 'trend',
    id: 'by-month',
    title: data.words['report.byMonth'],
    points,
    averageLabel: data.words['report.byMonth.average'],
    average: money(average, data.currency),
    /** Which of them are above it, named rather than left to be eyeballed. */
    aboveAverage: counted
      .filter(month => totalsOf(grouped.get(month) ?? [], data.basis).outMinor > average)
      .map(month => monthLabel(month, data.locale)),
  };
};

// ---------------------------------------------------------------------------

/** Below this many months there is no such thing as a habit, only a repeat. */
const RECURRING_FROM_MONTHS = 3;
/** And it has to turn up in this share of them. */
const RECURRING_SHARE = 0.6;

/**
 * What comes back every month.
 *
 * Netflix, the phone bill, EPM, the weekly market. These are the part of the
 * spending that is already decided before the month starts, and telling them
 * apart from the rest is the single most useful thing a summary can do: it
 * turns "I spent 9.8 million" into "6 of it was going to happen anyway".
 *
 * Recurring is judged by turning up in most of the months, not by the name
 * looking like a subscription: a rule about names would need a list of them
 * and would be wrong in every country but one.
 */
export const recurringSpending: Section<ReportData> = data => {
  const months = monthsIn(data.period, data.today);
  if (months.length < RECURRING_FROM_MONTHS) return null;

  const grouped = byMonth(data.movements);
  const needed = Math.max(RECURRING_FROM_MONTHS, Math.ceil(months.length * RECURRING_SHARE));

  /** Per label: which months it appeared in, and what it cost in all. */
  const seen = new Map<string, { months: Set<string>; total: number; icon: string | null; customIconId: number | null }>();

  for (const month of months) {
    for (const movement of grouped.get(month) ?? []) {
      if (movement.flow !== 'out') continue;
      const found = seen.get(movement.label);
      if (found) {
        found.months.add(month);
        found.total += amount(movement, data);
      } else {
        seen.set(movement.label, {
          months: new Set([month]),
          total: amount(movement, data),
          icon: movement.icon,
          customIconId: movement.customIconId,
        });
      }
    }
  }

  const recurring = [...seen.entries()]
    .filter(([, found]) => found.months.size >= needed)
    .sort(([, a], [, b]) => b.total - a.total);

  if (recurring.length === 0) return null;

  const subtotal = recurring.reduce((sum, [, found]) => sum + found.total, 0);
  const allSpending = totalsOf(data.movements, data.basis).outMinor;

  const rows: RankedBlock['rows'] = recurring.map(([label, found]) => ({
    label,
    value: money(found.total, data.currency),
    share: allSpending > 0 ? Math.round((found.total / allSpending) * 100) : undefined,
    behind: found.months.size,
    icon: found.icon,
    customIconId: found.customIconId,
    flow: 'out' as const,
    note: fill(data.words['report.recurring.each'], {
      months: found.months.size,
      of: months.length,
      average: formatMoney(Math.round(found.total / found.months.size), data.currency),
    }),
  }));

  return {
    kind: 'ranked',
    id: 'recurring',
    title: data.words['report.recurring'],
    rowsAre: data.words['report.categories.row'],
    // How many months it appeared in, not how many movements: that is what
    // makes it recurring, and it is the number the reader wants to check.
    countsAre: data.words['report.recurring.months'],
    rows,
    totalLabel: fill(data.words['report.recurring.total'], {
      share: allSpending > 0 ? Math.round((subtotal / allSpending) * 100) : 0,
      average: formatMoney(Math.round(subtotal / months.length), data.currency),
    }),
    total: money(subtotal, data.currency),
  };
};

// ---------------------------------------------------------------------------

/** A category has to grow by this much before it is worth interrupting for. */
const JUMP_PERCENT = 40;
/** And by this much of the period's spending, so small things stay quiet. */
const JUMP_SHARE = 0.03;
/** At most this many, or the section stops being a warning and becomes a list. */
const JUMPS = 5;

/**
 * Where the difference actually came from.
 *
 * A total that moved is a question, not an answer. This looks for the
 * categories behind it - the ones that grew both a lot in proportion and
 * enough in money to matter - and names the biggest movement inside each,
 * which is usually the whole explanation.
 *
 * Both tests have to pass. A category that went from 1,000 to 3,000 grew 200%
 * and explains nothing; one that grew 12% on four million explains everything
 * but does not read as a jump. Only what is both is worth saying.
 */
export const unusualJumps: Section<ReportData> = data => {
  const before = data.before;
  if (before === null || before.movements.length === 0) return null;

  const now = spentByLabel(data.movements, data);
  const was = spentByLabel(before.movements, data);
  const allSpending = totalsOf(data.movements, data.basis).outMinor;
  if (allSpending <= 0) return null;

  const lines: NoteBlock['lines'] = [];

  const grown = [...now.entries()]
    .map(([label, amount]) => ({ label, amount, before: was.get(label) ?? 0 }))
    .filter(one => one.before > 0 && one.amount > one.before)
    .filter(one => (one.amount - one.before) / allSpending >= JUMP_SHARE)
    .filter(one => (changeFrom(one.before, one.amount) ?? 0) >= JUMP_PERCENT)
    .sort((a, b) => (b.amount - b.before) - (a.amount - a.before))
    .slice(0, JUMPS);

  for (const one of grown) {
    // The biggest movement in it, which is usually why it moved at all.
    const biggest = data.movements
      .filter(movement => movement.label === one.label && movement.flow === 'out')
      .sort((a, b) => amount(b, data) - amount(a, data))[0];

    lines.push({
      tone: 'warn',
      text: fill(data.words['report.jump.grew'], {
        category: one.label,
        percent: changeFrom(one.before, one.amount) ?? 0,
        because: biggest?.transaction.description?.trim()
          || data.words['report.jump.noNote'],
      }),
    });
  }

  // And the other way: something that stopped costing is worth knowing too.
  const gone = [...was.entries()]
    .filter(([label, amount]) => amount > 0 && (now.get(label) ?? 0) === 0)
    .filter(([, amount]) => amount / allSpending >= JUMP_SHARE)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 2);

  for (const [label] of gone) {
    lines.push({ tone: 'good', text: fill(data.words['report.jump.gone'], { category: label }) });
  }

  if (lines.length === 0) return null;

  return { kind: 'note', id: 'jumps', title: data.words['report.jump'], lines };
};

// ---------------------------------------------------------------------------

/** A charge has to come back this many months before it is a subscription. */
const REPEATS_FROM = 3;
/** And stay within this much of its usual size to be the same charge. */
const REPEAT_SPREAD = 0.2;
/** At most this many, or the section turns into the movements list again. */
const REPEATS = 15;

/**
 * The same charge, month after month.
 *
 * Different from the section above, and worth having beside it. That one says
 * which CATEGORIES come back - "Restaurante, every month" is true and is not
 * a commitment. This one looks for the same charge at about the same size on
 * a regular beat: Netflix, Claro, the EPM bill, the gym. That is the money
 * that leaves whether or not anyone decides anything.
 *
 * Matched on what the movement is called and how much it costs, never on a
 * list of company names - a list would have to be maintained, would be wrong
 * outside one country, and would miss the gym around the corner.
 */
export const repeatedCharges: Section<ReportData> = data => {
  const months = monthsIn(data.period, data.today);
  if (months.length < REPEATS_FROM) return null;

  /** Per note: one entry per month it appeared in, with what it cost. */
  const seen = new Map<string, { months: Map<string, number>; label: string; icon: string | null; customIconId: number | null }>();

  for (const movement of data.movements) {
    if (movement.flow !== 'out') continue;
    const note = (movement.transaction.description ?? '').trim();
    if (note === '') continue;

    const key = fold(note);
    const month = movement.transaction.occurred_on.slice(0, 7);
    const found = seen.get(key);
    if (found) {
      found.months.set(month, (found.months.get(month) ?? 0) + amount(movement, data));
    } else {
      seen.set(key, {
        months: new Map([[month, amount(movement, data)]]),
        label: note,
        icon: movement.icon,
        customIconId: movement.customIconId,
      });
    }
  }

  const repeating = [...seen.values()]
    .filter(found => found.months.size >= REPEATS_FROM)
    .map(found => {
      const amounts = [...found.months.values()].sort((a, b) => a - b);
      const middle = amounts[Math.floor(amounts.length / 2)];
      return { ...found, middle, total: amounts.reduce((sum, one) => sum + one, 0) };
    })
    // The same charge, not merely the same words: a note reused for amounts
    // all over the place is a habit of writing, not a subscription.
    .filter(one => one.middle > 0
      && [...one.months.values()].every(each =>
        Math.abs(each - one.middle) <= one.middle * REPEAT_SPREAD))
    .sort((a, b) => b.total - a.total)
    .slice(0, REPEATS);

  if (repeating.length === 0) return null;

  const eachMonth = repeating.reduce((sum, one) => sum + one.middle, 0);
  const spending = totalsOf(data.movements, data.basis).outMinor;

  return {
    kind: 'ranked',
    id: 'repeated',
    title: data.words['report.repeated'],
    rowsAre: data.words['report.repeated.row'],
    countsAre: data.words['report.recurring.months'],
    rows: repeating.map(one => ({
      label: one.label,
      value: money(one.total, data.currency),
      share: spending > 0 ? Math.round((one.total / spending) * 100) : undefined,
      behind: one.months.size,
      icon: one.icon,
      customIconId: one.customIconId,
      flow: 'out' as const,
      note: fill(data.words['report.repeated.each'], {
        amount: formatMoney(one.middle, data.currency),
      }),
    })),
    totalLabel: data.words['report.repeated.total'],
    total: money(eachMonth, data.currency),
  };
};

/** Lowercased and without accents, so one note is one charge. */
function fold(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}
