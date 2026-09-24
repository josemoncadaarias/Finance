/**
 * The analyses of the yields summary.
 *
 * Each is a pure function from the facts gathered once (`YieldsReportData`)
 * to one block, or null when it has nothing to say - the same contract as
 * the money summary's (rule 20). The list at the bottom is the order on the
 * screen and in the spreadsheet.
 */

import { formatMoney } from '../database/money';
import { inflationOver } from '../inflation/inflation';
import { monthName } from '../filters/period';
import type { Block, ComparisonBlock, RankedBlock, Section, TrendBlock } from './blocks';
import { money, percent } from './blocks';
import { daysBetween } from './report-data';
import { fill } from './report-words';
import { inPeriod, paidOf, type YieldDayRow, type YieldsReportData } from './yields-data';

/** A rate as stored - E.A. scaled by a million - as a percentage. */
const rateOf = (scaled: number): number => Math.round(scaled / 100) / 100;

const rateText = (scaled: number, locale: string): string =>
  `${rateOf(scaled).toLocaleString(locale, { maximumFractionDigits: 2 })} %`;

/** The days of this period, in the report's currency, with what was left out. */
function periodDays(data: YieldsReportData): { rows: YieldDayRow[]; amounts: Map<YieldDayRow, number> } {
  const rows: YieldDayRow[] = [];
  const amounts = new Map<YieldDayRow, number>();
  for (const day of data.days) {
    if (!inPeriod(data, day.on_date)) continue;
    const amount = data.inReportCurrency(paidOf(day), day.account_id, day.on_date);
    if (amount === null) continue;
    rows.push(day);
    amounts.set(day, amount);
  }
  return { rows, amounts };
}

const sum = (values: Iterable<number>): number => {
  let total = 0;
  for (const value of values) total += value;
  return total;
};

/**
 * What was earning and what it earned: the net, the days, the money earning
 * on an average day (each product once a day, however many parts its rate
 * has), and that as a yearly return.
 */
function earning(data: YieldsReportData) {
  const { rows, amounts } = periodDays(data);
  const net = sum(amounts.values());
  const dates = [...new Set(rows.map(day => day.on_date))].sort();
  const days = dates.length;
  const baseOf = new Map<string, number>();
  for (const day of rows) {
    const key = `${day.product_id}|${day.on_date}`;
    if (!baseOf.has(key)) {
      baseOf.set(key, data.inReportCurrency(day.balance_minor, day.account_id, day.on_date) ?? 0);
    }
  }
  const averageBase = days > 0 ? sum(baseOf.values()) / days : 0;
  const effective = averageBase > 0
    ? Math.pow(1 + net / averageBase / days, 365) - 1
    : null;
  return { rows, amounts, net, days, first: dates[0], last: dates[days - 1], averageBase, effective };
}

// ---------------------------------------------------------------------------

/**
 * The period in figures: what was earned, what was withheld, a day's worth on
 * average, and what that comes to as a yearly return on what was earning.
 *
 * The return is worked out, not quoted: two products at different rates and
 * a withholding in between make the rate on the product page the wrong
 * answer to "how much did my money actually earn".
 */
export const yieldHeadline: Section<YieldsReportData> = data => {
  const { rows, net, days, effective: yearly } = earning(data);
  if (rows.length === 0) return null;
  const words = data.words;

  const withheld = sum(rows.map(day =>
    data.inReportCurrency(day.withholding_minor, day.account_id, day.on_date) ?? 0));
  const effective = yearly === null ? null : yearly * 100;

  const figures: Extract<Block, { kind: 'figures' }>['figures'] = [
    { label: words['report.yields.net'], value: money(net, data.currency), tone: 'good' },
    {
      label: words['report.yields.perDay'],
      value: money(Math.round(net / days), data.currency),
      note: fill(words['report.yields.perDayNote'], { days }),
    },
  ];
  if (effective !== null && Number.isFinite(effective)) {
    figures.push({
      label: words['report.yields.effective'],
      value: percent(Math.round(effective * 100) / 100),
      note: words['report.yields.effectiveNote'],
    });
  }
  if (withheld > 0) {
    figures.push({
      label: words['report.yields.withheld'],
      value: money(withheld, data.currency),
      tone: 'warn',
      note: words['report.yields.withheldNote'],
    });
  }

  return { kind: 'figures', id: 'yields-headline', title: words['report.yields.headline'], figures };
};

/**
 * Where it came from: account by account for all of them, product by product
 * for one - with the rate each is on today, which is what someone deciding
 * where to move money wants beside the figure.
 */
/**
 * A product as the reader knows it. An account holding a single product is
 * just the account - "Savings account" is a name the app gave, not one the
 * person would recognise - and across every account a product carries its
 * account's name in front.
 */
function productLabel(data: YieldsReportData, id: number): string {
  const product = data.products.find(one => one.id === id);
  if (!product) return '?';
  const account = data.accounts.find(one => one.id === product.account_id);
  if (!account) return product.name;
  const alone = data.products.filter(one => one.account_id === product.account_id).length === 1;
  if (alone) return account.name;
  return data.account === null ? `${account.name} · ${product.name}` : product.name;
}

export const yieldByWhere: Section<YieldsReportData> = data => {
  const { rows, amounts } = periodDays(data);
  const perAccount = data.account === null;

  const totals = new Map<number, number>();
  const latest = new Map<number, YieldDayRow>();
  for (const day of rows) {
    const key = perAccount ? day.account_id : day.product_id;
    totals.set(key, (totals.get(key) ?? 0) + (amounts.get(day) ?? 0));
    const seen = latest.get(key);
    if (!seen || day.on_date > seen.on_date
        || (day.on_date === seen.on_date && day.annual_rate_scaled > seen.annual_rate_scaled)) {
      latest.set(key, day);
    }
  }
  if (totals.size < 2) return null;

  const grand = sum(totals.values());
  const nameOf = (key: number) => perAccount
    ? data.accounts.find(account => account.id === key)?.name ?? '?'
    : productLabel(data, key);
  const iconOf = (key: number) => perAccount ? data.accounts.find(account => account.id === key) : undefined;

  const block: RankedBlock = {
    kind: 'ranked',
    id: 'yields-where',
    title: data.words[perAccount ? 'report.yields.byAccount' : 'report.yields.byProduct'],
    rowsAre: data.words[perAccount ? 'report.yields.rows.accounts' : 'report.yields.rows.products'],
    rows: [...totals.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([key, total]) => ({
        label: nameOf(key),
        value: money(total, data.currency),
        share: grand > 0 ? Math.round((total / grand) * 1000) / 10 : 0,
        note: fill(data.words['report.yields.rateNote'], {
          rate: rateText(latest.get(key)!.annual_rate_scaled, data.locale),
        }),
        icon: iconOf(key)?.builtin_icon ?? null,
        customIconId: iconOf(key)?.custom_icon_id ?? null,
        // Money that came in: drawn green like every income on the summary.
        flow: 'in' as const,
      })),
    totalLabel: data.words['report.yields.net'],
    total: money(grand, data.currency),
  };
  return block;
};

/**
 * Against inflation: did the money keep its value, and by how much.
 *
 * Jose, 2026-09-24. The same days and the same average as the headline, set
 * against the DANE's index over those days. Four figures: inflation at a
 * yearly pace, the real return ((1 + return) / (1 + inflation) - 1), what
 * inflation took from the money that was earning, and what is left of the
 * yield after it. A month the DANE has not published is estimated and the
 * note says which. Pesos only: the index says what pesos lost, and a report
 * of one dollar account has nothing to compare with it.
 */
export const yieldVersusInflation: Section<YieldsReportData> = data => {
  if (data.currency !== 'COP') return null;
  const { rows, net, first, last, averageBase, effective } = earning(data);
  if (rows.length === 0 || effective === null || averageBase <= 0) return null;
  const inflation = inflationOver(data.inflation, first, last);
  if (inflation === null) return null;
  const words = data.words;

  const real = (1 + effective) / (1 + inflation.annual) - 1;
  const took = Math.round(averageBase * inflation.rate);
  const kept = net - took;
  const ahead = real >= 0;
  const round2 = (value: number) => Math.round(value * 10_000) / 100;

  const source = inflation.estimated.length > 0
    ? fill(words['report.yields.inflation.estimated'], {
        months: inflation.estimated.map(month => monthLabel(month, data.locale)).join(', '),
      })
    : fill(words['report.yields.inflation.published'], {
        month: monthLabel(inflation.lastPublished!, data.locale),
      });

  return {
    kind: 'figures',
    id: 'yields-inflation',
    title: words['report.yields.inflation'],
    figures: [
      {
        label: words['report.yields.inflation.real'],
        value: percent(round2(real)),
        tone: ahead ? 'good' : 'bad',
        note: words[ahead ? 'report.yields.inflation.ahead' : 'report.yields.inflation.behind'],
      },
      {
        label: words['report.yields.inflation.rate'],
        value: percent(round2(inflation.annual)),
        note: source,
      },
      {
        label: words['report.yields.inflation.took'],
        value: money(took, data.currency),
        tone: 'warn',
        note: fill(words['report.yields.inflation.tookNote'], { amount: formatMoney(Math.round(averageBase), data.currency) }),
      },
      {
        label: words['report.yields.inflation.kept'],
        value: money(kept, data.currency),
        tone: kept >= 0 ? 'good' : 'bad',
        note: words['report.yields.inflation.keptNote'],
      },
    ],
  };
};

/** "Septiembre 2026", in the reader's own language. */
function monthLabel(month: string, locale: string): string {
  const [year, at] = month.split('-').map(Number);
  const name = monthName(new Date(year, at - 1, 1), locale);
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${year}`;
}

/**
 * Month by month, up to the end of the period: how it has grown.
 *
 * A year at most, and only from the first month anything was worked out -
 * eleven empty bars before the first yield say nothing. The average leaves
 * out a month still running, which would drag it down for no reason but the
 * calendar.
 */
/** The last month the charts reach: the end of the period, or today. */
const lastMonth = (data: YieldsReportData): string =>
  (data.period.to && data.period.to < data.today ? data.period.to : data.today).slice(0, 7);

/**
 * Up to twelve months ending at `end`, from the first one that has anything,
 * every month in between - so a month with nothing is a zero rather than a
 * gap nobody notices.
 */
function monthsUpTo(seen: readonly string[], end: string): string[] {
  const months = seen.filter(month => month <= end).sort();
  if (months.length === 0) return [];
  const [endYear, endMonth] = end.split('-').map(Number);
  const floor = endMonth === 12 ? `${endYear}-01` : `${endYear - 1}-${String(endMonth + 1).padStart(2, '0')}`;
  const all: string[] = [];
  for (let at = months[0] > floor ? months[0] : floor; at <= end; ) {
    all.push(at);
    const [year, month] = at.split('-').map(Number);
    at = month === 12 ? `${year + 1}-01` : `${year}-${String(month + 1).padStart(2, '0')}`;
  }
  return all;
}

/**
 * What was earning at the close of each month: every product's balance on
 * its last day of the month, in pesos at that day's rate. Deposits make it
 * grow as much as yields do, which is why the chart after it exists.
 */
function balanceByMonth(data: YieldsReportData, end: string): Map<string, number> {
  const last = new Map<string, YieldDayRow>();
  for (const day of data.days) {
    if (day.on_date > data.today || day.on_date.slice(0, 7) > end) continue;
    const key = `${day.on_date.slice(0, 7)}|${day.product_id}`;
    const seen = last.get(key);
    if (!seen || day.on_date > seen.on_date) last.set(key, day);
  }
  const totals = new Map<string, number>();
  for (const [key, day] of last) {
    const month = key.slice(0, 7);
    const amount = data.inReportCurrency(day.balance_minor, day.account_id, day.on_date) ?? 0;
    totals.set(month, (totals.get(month) ?? 0) + amount);
  }
  return totals;
}

/** What was earned each month, in pesos at each day's rate. */
function earnedByMonth(data: YieldsReportData, end: string): Map<string, number> {
  const totals = new Map<string, number>();
  for (const day of data.days) {
    if (day.on_date > data.today) continue;
    const month = day.on_date.slice(0, 7);
    if (month > end) continue;
    const amount = data.inReportCurrency(paidOf(day), day.account_id, day.on_date);
    if (amount === null) continue;
    totals.set(month, (totals.get(month) ?? 0) + amount);
  }
  return totals;
}

/**
 * How the money grew: what was earning at the close of each month, against
 * the close of the first one. Jose, 2026-09-24: "mostrar una grafica de como
 * va creciendo el dinero". Measured from the first month rather than from
 * zero, the way a stock chart is: drawn from zero, 12% of growth over
 * seventy million is nine bars of the same height. A month that closed
 * below the first is a bar below the line.
 */
export const yieldGrowth: Section<YieldsReportData> = data => {
  const end = lastMonth(data);
  const totals = balanceByMonth(data, end);
  const all = monthsUpTo([...totals.keys()], end);
  if (all.length < 2) return null;
  const start = totals.get(all[0]) ?? 0;
  return {
    kind: 'trend',
    id: 'yields-growth',
    title: fill(data.words['report.yields.growth'], { month: monthLabel(all[0], data.locale) }),
    points: all.map(month => ({
      label: monthLabel(month, data.locale),
      value: money((totals.get(month) ?? 0) - start, data.currency),
    })),
  };
};

/**
 * What the yields alone have added, month after month: a running total. It
 * only ever rises, and how steeply is the compounding made visible.
 */
export const yieldEarnedSoFar: Section<YieldsReportData> = data => {
  const end = lastMonth(data);
  const totals = earnedByMonth(data, end);
  const all = monthsUpTo([...totals.keys()], end);
  if (all.length < 2) return null;
  let running = 0;
  return {
    kind: 'trend',
    id: 'yields-earned-so-far',
    title: data.words['report.yields.soFar'],
    points: all.map(month => {
      running += totals.get(month) ?? 0;
      return { label: monthLabel(month, data.locale), value: money(running, data.currency) };
    }),
  };
};

export const yieldByMonth: Section<YieldsReportData> = data => {
  const end = lastMonth(data);
  const totals = earnedByMonth(data, end);

  const all = monthsUpTo([...totals.keys()], end);
  if (all.length < 2) return null;

  const running = data.today.slice(0, 7);
  const whole = all.filter(month => month !== running);
  const average = whole.length > 0
    ? Math.round(sum(whole.map(month => totals.get(month) ?? 0)) / whole.length)
    : 0;

  const block: TrendBlock = {
    kind: 'trend',
    id: 'yields-by-month',
    title: data.words['report.yields.byMonth'],
    points: all.map(month => ({
      label: monthLabel(month, data.locale),
      value: money(totals.get(month) ?? 0, data.currency),
    })),
    averageLabel: data.words['report.yields.byMonth.average'],
    average: money(average, data.currency),
    aboveAverage: whole
      .filter(month => (totals.get(month) ?? 0) > average)
      .map(month => monthLabel(month, data.locale)),
  };
  return block;
};

/**
 * This period against the same stretch of the one before, account by account
 * (or product by product for one account). The same days on both sides: 24
 * days of this month against 24 of the last, never against all 31 (rule 20).
 */
export const yieldVersusBefore: Section<YieldsReportData> = data => {
  const before = data.before;
  if (before === null || before.period.from === null || before.period.to === null) return null;
  const perAccount = data.account === null;
  const keyOf = (day: YieldDayRow) => (perAccount ? day.account_id : day.product_id);

  const now = new Map<number, number>();
  const then = new Map<number, number>();
  for (const day of data.days) {
    const amount = data.inReportCurrency(paidOf(day), day.account_id, day.on_date);
    if (amount === null) continue;
    if (inPeriod(data, day.on_date)) now.set(keyOf(day), (now.get(keyOf(day)) ?? 0) + amount);
    else if (day.on_date >= before.period.from && day.on_date <= before.period.to) {
      then.set(keyOf(day), (then.get(keyOf(day)) ?? 0) + amount);
    }
  }
  if (then.size === 0 || now.size === 0) return null;

  const keys = [...new Set([...now.keys(), ...then.keys()])]
    .sort((a, b) => (now.get(b) ?? 0) - (now.get(a) ?? 0));
  const nameOf = (key: number) => perAccount
    ? data.accounts.find(account => account.id === key)?.name ?? '?'
    : productLabel(data, key);

  const block: ComparisonBlock = {
    kind: 'comparison',
    id: 'yields-versus-before',
    title: data.words['report.yields.versusBefore'],
    beforeLabel: before.label,
    nowLabel: data.periodLabel,
    caveat: before.clipped ? data.words['report.yields.sameDays'] : undefined,
    rows: keys.map(key => {
      const was = then.get(key) ?? 0;
      const is = now.get(key) ?? 0;
      return {
        label: nameOf(key),
        before: money(was, data.currency),
        now: money(is, data.currency),
        changePercent: was > 0 ? Math.round(((is - was) / was) * 1000) / 10 : null,
        growthIs: 'good' as const,
      };
    }),
  };
  return block;
};

/**
 * What is worth saying in words: where the month is heading at this pace,
 * what is still owed and when it lands, how many days were withheld, and
 * which account pays best today.
 */
/**
 * "From January your money earning went from X to Y; Z of that was yields":
 * the growth chart cannot tell what was put in from what was earned, so one
 * sentence does. Null with under two months to compare.
 */
function growthLine(data: YieldsReportData): string | null {
  const end = lastMonth(data);
  const balances = balanceByMonth(data, end);
  const all = monthsUpTo([...balances.keys()], end);
  if (all.length < 2) return null;
  const from = balances.get(all[0]) ?? 0;
  const to = balances.get(all[all.length - 1]) ?? 0;
  if (from <= 0) return null;
  const earned = earnedByMonth(data, end);
  const yielded = sum(all.slice(1).map(month => earned.get(month) ?? 0));
  const change = Math.round(((to - from) / from) * 1000) / 10;
  return fill(data.words['report.yields.note.growth'], {
    month: monthLabel(all[0], data.locale),
    from: formatMoney(from, data.currency),
    to: formatMoney(to, data.currency),
    change: `${change > 0 ? '+' : ''}${change.toLocaleString(data.locale)} %`,
    earned: formatMoney(yielded, data.currency),
  });
}

export const yieldNotes: Section<YieldsReportData> = data => {
  const words = data.words;
  const lines: { text: string; tone?: 'good' | 'bad' | 'warn' | 'plain' }[] = [];
  const { rows, amounts } = periodDays(data);

  const growth = growthLine(data);
  if (growth !== null) lines.push({ text: growth });

  // Where this month is heading. Only for a month still running, and said to
  // be a projection: rule 20 never passes an estimate off as a figure.
  const { from, to } = data.period;
  if (data.period.kind === 'month' && from && to && data.today >= from && data.today < to && rows.length > 0) {
    const daysSoFar = daysBetween(from, data.today);
    const perDay = sum(amounts.values()) / daysSoFar;
    lines.push({
      text: fill(words['report.yields.note.projection'], {
        amount: formatMoney(Math.round(perDay * daysBetween(from, to)), data.currency),
      }),
    });
  }

  // Owed and not yet paid: parts of a rate paid at the end of the month.
  const owed = data.days.filter(day => day.paid_on !== null && day.paid_on > data.today && day.on_date <= data.today);
  const owedTotal = sum(owed.map(day => data.inReportCurrency(paidOf(day), day.account_id, day.on_date) ?? 0));
  if (owedTotal > 0) {
    const when = owed.filter(day => paidOf(day) > 0).map(day => day.paid_on!).sort()[0];
    lines.push({
      text: fill(words['report.yields.note.pending'], {
        amount: formatMoney(owedTotal, data.currency),
        date: new Date(`${when}T12:00:00`).toLocaleDateString(data.locale, { day: 'numeric', month: 'long' }),
      }),
    });
  }

  const withheldDays = new Set(rows.filter(day => day.withholding_minor > 0).map(day => day.on_date)).size;
  if (withheldDays > 0) {
    lines.push({ tone: 'warn', text: fill(words['report.yields.note.withheldDays'], { days: withheldDays }) });
  }

  if (data.account === null) {
    const latest = new Map<number, YieldDayRow>();
    for (const day of data.days) {
      if (day.on_date > data.today) continue;
      const seen = latest.get(day.account_id);
      if (!seen || day.on_date > seen.on_date) latest.set(day.account_id, day);
    }
    const best = [...latest.values()].sort((a, b) => b.annual_rate_scaled - a.annual_rate_scaled)[0];
    if (best && latest.size > 1) {
      lines.push({
        tone: 'good',
        text: fill(words['report.yields.note.bestRate'], {
          account: data.accounts.find(account => account.id === best.account_id)?.name ?? '?',
          rate: rateText(best.annual_rate_scaled, data.locale),
        }),
      });
    }
  }

  const skipped = data.days.filter(day =>
    inPeriod(data, day.on_date) && data.inReportCurrency(paidOf(day), day.account_id, day.on_date) === null);
  if (skipped.length > 0) {
    const currencies = [...new Set(skipped.map(day =>
      data.accounts.find(account => account.id === day.account_id)?.currency_code ?? '?'))];
    lines.push({ tone: 'warn', text: fill(words['report.yields.note.noRate'], { currency: currencies.join(', ') }) });
  }

  if (lines.length === 0) return null;
  return { kind: 'note', id: 'yields-notes', title: words['report.yields.notes'], lines };
};

/** The order on the screen and in the spreadsheet. */
export const YIELD_SECTIONS: readonly Section<YieldsReportData>[] = [
  yieldHeadline,
  yieldVersusInflation,
  yieldNotes,
  yieldGrowth,
  yieldEarnedSoFar,
  yieldByWhere,
  yieldByMonth,
  yieldVersusBefore,
];

export function buildYieldsReport(data: YieldsReportData): Block[] {
  return YIELD_SECTIONS.map(section => section(data)).filter((block): block is Block => block !== null);
}
