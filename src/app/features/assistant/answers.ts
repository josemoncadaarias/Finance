/**
 * The assistant's answers about the whole picture (Jose, 2026-10-19, mockups
 * `40b`-`40j`): how a period goes, where the money went, what is owed, which
 * debt to pay first, what paying more would do, what is due, what one has,
 * how the caps and goals go.
 *
 * Each answer is a sentence and a card made of plain pieces - a heading, a
 * line with its figure, a numbered step, a row with its icon, a note, buttons
 * that go somewhere - so it can be kept in the conversation's history as it
 * is. Every figure comes from `AssistantService`, which reads what the rest
 * of the app already works out.
 *
 * Every word is said whole and plainly (Jose, 2026-10-19: "siempre hay que
 * ser muy claros"): what a figure is stands beside it, a comparison names
 * what it compares, and no step leaves its "before what?" unsaid.
 */

import type { TranslationKey } from '../../core/i18n/translations';
import type { Period } from '../../core/filters/period';
import type { Slice } from '../../features/movements/group-movements';
import type { AccountRow } from '../../core/database/types';
import type { LimitView } from '../../core/limits/limits.service';
import type { GoalView } from '../../core/goals/goals.service';
import type { DebtView, PeriodPicture, Picture, RecurringPicture, YieldsPicture } from '../../core/assistant/assistant.service';
import { advise, interestThisMonth, monthAfter, payMore, type DebtIn } from '../../core/assistant/debts-advice';
import { perDay } from '../../core/assistant/free-money';
import { EA_SCALE } from '../../core/loans/schedule';

export type Tone = 'ok' | 'warn' | 'bad' | 'plain';

/** One piece of an answer's card. Text may carry "**" around what is said in bold. */
export interface RichBlock {
  lab?: string;
  line?: { k: string; v: string; cls?: string };
  step?: { n: number; color: string; title: string; lines: string[] };
  row?: { icon: string; color: string; round: boolean; title: string; value: string; lines: string[] };
  ranked?: { icon: string | null; customId: number | null; color: string | null; seed: number | null; name: string; amount: string; pct: number; change: string; cls: string };
  note?: string;
}

/** Where a button goes. Plain data, so it survives in the history. */
export interface RichButton {
  label: string;
  ghost: boolean;
  route?: string[];
  query?: Record<string, string>;
  /** Opens the transfer form into this account, with this amount. */
  transferTo?: { accountId: number; amountMinor: number };
  /** Opens the report on this period, every account. */
  report?: Period;
}

export interface RichCard {
  kind: 'rich';
  tone: Tone;
  band: string | null;
  blocks: RichBlock[];
  buttons: RichButton[];
}

export interface Said {
  key: TranslationKey;
  values: Record<string, string | number>;
  /** Several phrases said as one, already in words: used instead of the key. */
  text?: string;
}

/** "a, b y c", each name once. */
export function names(s: Speech, list: readonly string[]): string {
  const once = [...new Set(list)];
  if (once.length <= 1) return once.join('');
  return `${once.slice(0, -1).join(', ')}${s.t('ai.due.and')}${once[once.length - 1]}`;
}

/** What an answer needs from the page: words and figures, in the app's language. */
export interface Speech {
  t: (key: TranslationKey, values?: Record<string, string | number>) => string;
  pesos: (minor: number) => string;
  /** "25 de octubre". */
  date: (iso: string) => string;
  /** "enero de 2027" from "2027-01". */
  month: (yyyyMm: string) => string;
  today: string;
}

export interface Answer {
  said: Said;
  card: RichCard | null;
  /** Chips to offer, as sentences the person could say next. */
  next: TranslationKey[];
}

const COLORS = { yel: '#f5b544', pur: '#a07cff', org: '#ff8a4c', cya: '#38bdf8', blu: '#6378ff', grn: '#34c98b', red: '#ff6b6b' };
const STEP_COLORS = [COLORS.yel, COLORS.pur, COLORS.org, COLORS.cya, COLORS.blu];

const rate = (scaled: number) => `${new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1 }).format(scaled * 100 / EA_SCALE)} %`;
const card = (blocks: RichBlock[], buttons: RichButton[] = [], tone: Tone = 'plain', band: string | null = null): RichCard =>
  ({ kind: 'rich', tone, band, blocks, buttons });

// ---------------------------------------------------------------------------
// "¿Cómo voy este mes?" (40b)
// ---------------------------------------------------------------------------

export function howAmI(s: Speech, pic: PeriodPicture, picture: Picture | null, limits: readonly LimitView[]): Answer {
  const saved = pic.inMinor - pic.outMinor;
  const blocks: RichBlock[] = [
    { lab: s.t('ai.period.span', { label: pic.label, from: s.date(pic.from), to: s.date(pic.to) }) },
    { line: { k: s.t('ai.period.in'), v: `+${s.pesos(pic.inMinor)}`, cls: 'ui-g' } },
    { line: { k: s.t('ai.period.out'), v: `−${s.pesos(pic.outMinor)}`, cls: 'ui-r' } },
    { line: { k: s.t(saved >= 0 ? 'ai.period.leftUp' : 'ai.period.leftDown'), v: s.pesos(Math.abs(saved)), cls: saved >= 0 ? 'ui-g' : 'ui-r' } },
  ];
  let said: Said = saved >= 0
    ? { key: 'ai.period.answerUp', values: { label: pic.label, in: s.pesos(pic.inMinor), out: s.pesos(pic.outMinor), saved: s.pesos(saved) } }
    : { key: 'ai.period.answerDown', values: { label: pic.label, in: s.pesos(pic.inMinor), out: s.pesos(pic.outMinor), short: s.pesos(-saved) } };

  if (pic.before && pic.before.outMinor > 0) {
    const b = pic.before;
    const change = Math.round((pic.outMinor - b.outMinor) * 100 / b.outMinor);
    blocks.push({ lab: s.t(pic.partial ? 'ai.period.vsSameDays' : 'ai.period.vs', { label: b.label }) });
    blocks.push({ line: { k: s.t('ai.period.spentIn', { label: b.label }), v: s.pesos(b.outMinor) } });
    blocks.push({ line: { k: s.t('ai.period.spentIn', { label: pic.label }), v: s.pesos(pic.outMinor) } });
    blocks.push({ line: { k: s.t('ai.period.difference'),
      v: change === 0 ? s.t('ai.period.same') : s.t(change < 0 ? 'ai.period.less' : 'ai.period.more', { pct: Math.abs(change) }),
      cls: change < 0 ? 'ui-g' : change > 0 ? 'ui-y' : '' } });
    const moves = categoryChanges(pic.slices, b.slices);
    if (moves.up) blocks.push({ line: { k: s.t('ai.period.up'), v: `${moves.up.label} · +${s.pesos(moves.up.by)}`, cls: 'ui-y' } });
    if (moves.down) blocks.push({ line: { k: s.t('ai.period.down'), v: `${moves.down.label} · −${s.pesos(moves.down.by)}`, cls: 'ui-g' } });
    said = { key: saved >= 0 ? 'ai.period.answerUpVs' : 'ai.period.answerDownVs',
      values: { ...said.values, pct: Math.abs(change), than: b.label,
        how: s.t(change <= 0 ? 'ai.period.howLess' : 'ai.period.howMore', { pct: Math.abs(change), than: b.label }) } };
  }

  // The caps and what is left: only about the month running now.
  const current = pic.partial && pic.period.kind === 'month';
  if (current && limits.length > 0) {
    blocks.push({ lab: s.t('ai.period.caps') });
    const tight = limits.filter(l => l.status.state === 'close' || l.status.state === 'passed' || l.status.state === 'fast');
    for (const l of tight) {
      blocks.push({ line: { k: l.name, v: s.t('ai.period.capUsed', { pct: l.status.percent }), cls: l.status.state === 'passed' ? 'ui-r' : 'ui-y' } });
    }
    blocks.push({ line: { k: s.t(tight.length > 0 ? 'ai.period.capsOthers' : 'ai.period.capsAll'), v: s.t('ai.period.capsFine'), cls: 'ui-g' } });
  }
  if (current && picture) {
    const f = picture.free;
    // Where the free money comes from, line by line (Jose, 2026-10-20: 239
    // million said alone read as a mistake).
    const minus = (minor: number) => minor > 0 ? `−${s.pesos(minor)}` : s.pesos(0);
    blocks.push({ lab: s.t('ai.period.rest', { end: s.date(f.monthEnd) }) });
    blocks.push({ line: { k: s.t('ai.money.accounts'), v: s.pesos(f.inAccountsMinor) } });
    if (f.inGoalsMinor > 0) blocks.push({ line: { k: s.t('ai.money.inGoals'), v: minus(f.inGoalsMinor) } });
    blocks.push({ line: { k: s.t('ai.money.payments'), v: minus(f.paymentsMinor) } });
    blocks.push({ line: { k: s.t('ai.money.goals'), v: minus(f.goalsMonthMinor) } });
    blocks.push({ line: { k: s.t('ai.money.free'), v: s.pesos(Math.max(0, f.freeMinor)), cls: f.freeMinor > 0 ? 'ui-g' : 'ui-r' } });
    blocks.push({ line: { k: s.t(f.daysLeft === 1 ? 'ai.period.perDay.one' : 'ai.period.perDay', { count: f.daysLeft }), v: s.pesos(perDay(f.freeMinor, f.daysLeft)) } });
    blocks.push({ note: s.t('ai.money.left') });
  }
  return {
    said,
    card: card(blocks, [{ label: s.t('ai.period.report'), ghost: true, report: pic.period }]),
    next: ['ai.next.top', 'ai.next.lastMonth', 'ai.next.year'],
  };
}

/** The category that grew most and the one that fell most, against the period before. */
function categoryChanges(now: readonly Slice[], before: readonly Slice[]): { up: { label: string; by: number } | null; down: { label: string; by: number } | null } {
  const was = new Map(before.map(sl => [sl.label, sl.amountMinor]));
  const is = new Map(now.map(sl => [sl.label, sl.amountMinor]));
  let up: { label: string; by: number } | null = null;
  let down: { label: string; by: number } | null = null;
  for (const label of new Set([...was.keys(), ...is.keys()])) {
    const by = (is.get(label) ?? 0) - (was.get(label) ?? 0);
    if (by > 0 && (!up || by > up.by)) up = { label, by };
    if (by < 0 && (!down || -by > down.by)) down = { label, by: -by };
  }
  return { up, down };
}

// ---------------------------------------------------------------------------
// "¿En qué gasté más?" (40c)
// ---------------------------------------------------------------------------

export function topSpending(s: Speech, pic: PeriodPicture): Answer {
  if (pic.slices.length === 0) return { said: { key: 'ai.top.none', values: { label: pic.label } }, card: null, next: ['ai.next.howAmI'] };
  const top = pic.slices.slice(0, 5);
  const was = new Map((pic.before?.slices ?? []).map(sl => [sl.label, sl.amountMinor]));
  const first = top[0].amountMinor;
  const blocks: RichBlock[] = [{ lab: s.t('ai.top.span', { label: pic.label, total: s.pesos(pic.outMinor) }) }];
  for (const sl of top) {
    const before = was.get(sl.label);
    const change = before === undefined || before <= 0 ? null : Math.round((sl.amountMinor - before) * 100 / before);
    blocks.push({ ranked: {
      icon: sl.icon, customId: sl.customIconId, color: sl.color ?? null, seed: sl.seed ?? null, name: sl.label,
      amount: s.pesos(sl.amountMinor), pct: Math.max(4, Math.round(sl.amountMinor * 100 / first)),
      change: change === null ? (pic.before ? s.t('ai.top.new') : '') : change === 0 ? s.t('ai.top.same') : `${change > 0 ? '+' : '−'}${Math.abs(change)} %`,
      cls: change === null ? 'mu' : change > 0 ? 'ui-r' : change < 0 ? 'ui-g' : 'mu',
    } });
  }
  const rest = pic.slices.slice(5);
  if (rest.length > 0) blocks.push({ note: s.t('ai.top.more', { count: rest.length, amount: s.pesos(rest.reduce((sum, sl) => sum + sl.amountMinor, 0)) }) });
  if (pic.before) blocks.push({ note: s.t(pic.partial ? 'ai.top.vsSameDays' : 'ai.top.vs', { label: pic.before.label }) });
  const moves = pic.before ? categoryChanges(pic.slices, pic.before.slices) : { up: null };
  return {
    said: moves.up
      ? { key: 'ai.top.answerGrew', values: { label: pic.label, name: top[0].label, amount: s.pesos(first), grew: moves.up.label, than: pic.before!.label } }
      : { key: 'ai.top.answer', values: { label: pic.label, name: top[0].label, amount: s.pesos(first) } },
    card: card(blocks, [{ label: s.t('ai.top.all'), ghost: true, report: pic.period }]),
    next: ['ai.next.howAmI', 'ai.next.lastMonth'],
  };
}

// ---------------------------------------------------------------------------
// "¿Cuánto debo?" (40d)
// ---------------------------------------------------------------------------

function rateLine(s: Speech, d: DebtView): string {
  if (d.rateScaled === null) return s.t('ai.debts.noRate');
  if (d.rateFrom === 'reference') return s.t('ai.debts.rateReference', { rate: rate(d.rateScaled), month: s.month(d.referenceMonth ?? '') });
  return s.t('ai.debts.rate', { rate: rate(d.rateScaled) });
}

function debtRow(s: Speech, d: DebtView): RichBlock {
  const lines: string[] = [];
  if (d.kind === 'card') {
    if (d.statementLeftMinor > 0 && d.dueOn) {
      lines.push(s.t(d.dueOn < s.today ? 'ai.debts.statementLate' : 'ai.debts.statement', { amount: s.pesos(d.statementLeftMinor), date: s.date(d.dueOn) }));
    }
    lines.push(`${rateLine(s, d)} · ${s.t('ai.debts.monthInterest', { amount: s.pesos(interestThisMonth(d)) })}`);
  } else {
    lines.push(`${rateLine(s, d)} · ${s.t('ai.debts.installments', { count: d.installmentsLeft, amount: s.pesos(d.nextMinor) })}`);
    if (d.interestLeftMinor > 0) lines.push(s.t('ai.debts.interestLeft', { amount: s.pesos(d.interestLeftMinor) }));
  }
  return { row: { icon: d.account.builtin_icon ?? (d.kind === 'card' ? 'card-outline' : 'cash-outline'), color: d.account.color ?? COLORS.yel,
    round: d.kind === 'card', title: d.name, value: s.pesos(d.balanceMinor), lines } };
}

export function debts(s: Speech, list: readonly DebtView[]): Answer {
  if (list.length === 0) return { said: { key: 'ai.debts.none', values: {} }, card: null, next: ['ai.next.howAmI'] };
  const total = list.reduce((sum, d) => sum + d.balanceMinor, 0);
  const cards = list.filter(d => d.kind === 'card');
  const loans = list.filter(d => d.kind === 'loan');
  const interest = list.map(d => ({ d, i: interestThisMonth(d) }));
  const interestTotal = interest.reduce((sum, x) => sum + x.i, 0);
  const most = [...interest].sort((a, b) => b.i - a.i)[0];
  const blocks: RichBlock[] = [];
  if (cards.length > 0) blocks.push({ line: { k: s.t('ai.debts.cards', { count: cards.length }), v: s.pesos(cards.reduce((sum, d) => sum + d.balanceMinor, 0)) } });
  if (loans.length > 0) blocks.push({ line: { k: s.t('ai.debts.loans', { count: loans.length }), v: s.pesos(loans.reduce((sum, d) => sum + d.balanceMinor, 0)) } });
  blocks.push({ line: { k: s.t('ai.debts.interestMonth'), v: s.pesos(interestTotal), cls: 'ui-r' } });
  for (const d of [...list].sort((a, b) => a.balanceMinor - b.balanceMinor)) blocks.push(debtRow(s, d));
  const ref = list.find(d => d.rateFrom === 'reference');
  if (ref) blocks.push({ note: s.t('ai.debts.referenceNote', { month: s.month(ref.referenceMonth ?? '') }) });
  const mostly = interestTotal > 0 && most.i * 100 / interestTotal >= 60 && list.length > 1;
  return {
    said: { key: mostly ? 'ai.debts.answerMostly' : 'ai.debts.answer',
      values: { total: s.pesos(total), count: list.length, interest: s.pesos(interestTotal), name: most?.d.name ?? '' } },
    card: card(blocks, [{ label: s.t('ai.debts.see'), ghost: true, route: ['/debts'] }]),
    next: ['ai.next.payFirst', 'ai.next.due'],
  };
}

// ---------------------------------------------------------------------------
// "¿Qué deuda pago primero?" (40e)
// ---------------------------------------------------------------------------

export function payFirst(s: Speech, list: readonly DebtView[], freeMinor: number, leftOverMinor: number): Answer {
  if (list.length === 0) return { said: { key: 'ai.debts.none', values: {} }, card: null, next: ['ai.next.howAmI'] };
  const free = Math.max(0, freeMinor);
  const advice = advise(list, leftOverMinor, free);
  // A card whose statement is first is said once: paying its statement is its step.
  const a = { ...advice, order: advice.order.filter(o => !advice.statements.includes(o.debt)) };
  const view = (d: DebtIn) => list.find(x => x.kind === d.kind && x.id === d.id)!;
  const blocks: RichBlock[] = [{ lab: s.t('ai.first.order') }];
  let n = 1;
  for (const st of a.statements) {
    const d = view(st);
    blocks.push({ step: { n, color: STEP_COLORS[(n - 1) % STEP_COLORS.length],
      title: s.t('ai.first.statementTitle', { name: d.name, amount: s.pesos(d.statementLeftMinor) }),
      lines: [s.t(d.dueOn && d.dueOn < s.today ? 'ai.first.statementLate' : 'ai.first.statementBy', { date: s.date(d.dueOn ?? s.today) }),
        s.t('ai.first.statementWhy', { rate: rate(d.rateScaled ?? 0) })] } });
    n++;
  }
  a.order.forEach((o, i) => {
    const d = view(o.debt);
    const lines = [s.t(i === 0 ? 'ai.first.highest' : 'ai.first.rate', { rate: rate(d.rateScaled!) }),
      o.months === 0 ? s.t('ai.first.finishNow')
        : s.t('ai.first.finishIn', { count: o.months, save: s.pesos(leftOverMinor) })];
    if (o.savingTodayMinor > 0) lines.push(s.t('ai.first.saveToday', { amount: s.pesos(o.savingTodayMinor) }));
    if (d.kind === 'loan') lines.push(s.t('ai.first.askTerm'));
    blocks.push({ step: { n, color: STEP_COLORS[(n - 1) % STEP_COLORS.length], title: `${d.name} · ${s.pesos(d.balanceMinor)}`, lines } });
    n++;
  });
  if (a.apart.length > 0) {
    blocks.push({ lab: s.t('ai.first.apart') });
    for (const x of a.apart) {
      const d = view(x.debt);
      blocks.push({ row: { icon: d.account.builtin_icon ?? 'cash-outline', color: d.account.color ?? COLORS.cya, round: d.kind === 'card',
        title: `${d.name} · ${s.pesos(d.balanceMinor)}`, value: '',
        lines: [leftOverMinor > 0 ? s.t('ai.first.tooBig', { save: s.pesos(leftOverMinor) }) : s.t('ai.first.nothingLeft'), s.t('ai.first.keepPaying', { rate: rate(d.rateScaled!) })] } });
    }
  }
  // The other way people pay debts: the smallest first (Jose, 2026-10-22).
  const snow = advise(list, leftOverMinor, free, 'balance');
  const snowOrder = snow.order.filter(o => !snow.statements.includes(o.debt));
  const sameOrder = snowOrder.map(o => o.debt.id).join() === a.order.map(o => o.debt.id).join();
  if (snowOrder.length > 1 && !sameOrder) {
    blocks.push({ lab: s.t('ai.first.snowball') });
    snowOrder.forEach((o, i) => blocks.push({ line: { k: `${i + 1}. ${view(o.debt).name}`,
      v: o.months === 0 ? s.t('ai.first.snowballNow') : s.t(o.months === 1 ? 'ai.first.snowballMonth' : 'ai.first.snowballMonths', { count: o.months }) } }));
    blocks.push({ note: s.t('ai.first.snowballNote') });
  }
  const referenced = list.filter(x => x.rateFrom === 'reference');
  if (referenced.length > 0) {
    blocks.push({ note: s.t(referenced.length === 1 ? 'ai.first.reference' : 'ai.first.referenceMany', {
      name: referenced[0].name, names: names(s, referenced.map(d => d.name)),
      month: s.month(referenced[0].referenceMonth ?? ''), rate: rate(referenced[0].rateScaled!) }) });
  }
  blocks.push({ note: s.t('ai.first.disclaimer') });

  const buttons: RichButton[] = [];
  const st = a.statements[0];
  if (st) buttons.push({ label: s.t('ai.first.payStatement'), ghost: false, route: ['/debts', String(st.id)], query: { pay: '1' } });
  const top = a.order[0]?.debt;
  if (top) buttons.push({ label: s.t('ai.first.payTo', { name: top.name }), ghost: buttons.length > 0,
    route: top.kind === 'loan' ? ['/debts', 'loan', String(top.id)] : ['/debts', String(top.id)] });

  let said: Said;
  const firstOrder = a.order[0];
  if (st && firstOrder) said = { key: 'ai.first.answerBoth', values: { card: st.name, name: firstOrder.debt.name } };
  else if (st) said = { key: 'ai.first.answerStatement', values: { card: st.name } };
  else if (firstOrder) said = { key: 'ai.first.answerDebt', values: { name: firstOrder.debt.name } };
  else {
    const highest = [...list].filter(d => d.rateScaled !== null).sort((x, y) => y.rateScaled! - x.rateScaled!)[0];
    said = { key: 'ai.first.answerNone', values: { name: highest?.name ?? list[0].name } };
  }
  return { said, card: card(blocks, buttons), next: ['ai.next.payMore', 'ai.next.debts'] };
}

// ---------------------------------------------------------------------------
// "¿Y si abono X al mes?" (40f)
// ---------------------------------------------------------------------------

export function payMoreAnswer(s: Speech, list: readonly DebtView[], extraMinor: number, leftOverMinor: number): Answer {
  const loans = list.filter(d => d.kind === 'loan' && d.rateScaled !== null && d.installmentMinor > 0);
  if (loans.length === 0) return { said: { key: 'ai.more.noLoans', values: {} }, card: null, next: ['ai.next.payFirst'] };
  const a = advise(loans, leftOverMinor + extraMinor);
  let order: DebtIn[] = a.order.map(o => o.debt);
  if (order.length === 0) order = [...loans].sort((x, y) => y.rateScaled! - x.rateScaled!);
  const plan = payMore(order, extraMinor);
  const blocks: RichBlock[] = [{ lab: s.t('ai.more.how') }];
  plan.results.forEach((r, i) => {
    const lines = i === 0
      ? [s.t('ai.more.firstGoes', { amount: s.pesos(extraMinor), name: r.debt.name })]
      : [s.t('ai.more.thenGoes', { prev: plan.results[i - 1].debt.name, amount: s.pesos(extraMinor), name: r.debt.name })];
    lines.push(r.endless
      ? s.t('ai.more.endsNow', { month: s.month(monthAfter(s.today, r.monthsAfter)) })
      : s.t('ai.more.ends', { month: s.month(monthAfter(s.today, r.monthsAfter)), before: s.month(monthAfter(s.today, r.monthsBefore)) }));
    blocks.push({ step: { n: i + 1, color: STEP_COLORS[i % STEP_COLORS.length],
      title: s.t(i === 0 ? 'ai.more.first' : 'ai.more.then', { name: r.debt.name }), lines } });
  });
  const others = loans.filter(d => !plan.results.some(r => r.debt.id === d.id));
  if (others.length > 0) {
    blocks.push({ step: { n: plan.results.length + 1, color: COLORS.cya, title: s.t('ai.more.othersTitle'),
      lines: [s.t('ai.more.others', { names: names(s, others.map(d => d.name)) })] } });
  }
  blocks.push({ lab: s.t('ai.more.saved') });
  for (const r of plan.results) blocks.push({ line: { k: s.t('ai.more.in', { name: r.debt.name }), v: s.pesos(Math.max(0, r.interestBeforeMinor - r.interestAfterMinor)), cls: 'ui-g' } });
  blocks.push({ line: { k: s.t('ai.more.total'), v: s.pesos(plan.savedMinor), cls: 'ui-g' } });
  blocks.push({ note: s.t(leftOverMinor >= extraMinor ? 'ai.more.canPay' : 'ai.more.cannotPay', { save: s.pesos(leftOverMinor), amount: s.pesos(extraMinor) }) });
  return {
    said: { key: 'ai.more.answer', values: { amount: s.pesos(extraMinor), saved: s.pesos(plan.savedMinor) } },
    card: card(blocks),
    next: ['ai.next.payFirst', 'ai.next.debts'],
  };
}

// ---------------------------------------------------------------------------
// "¿Qué pagos tengo este mes?" (40h)
// ---------------------------------------------------------------------------

export interface DueIn {
  name: string;
  kind: 'card' | 'loan';
  id: number;
  amountMinor: number;
  dueOn: string;
  from: AccountRow | null;
  icon: string | null;
  color: string | null;
}

export function due(s: Speech, payments: readonly DueIn[], holds: ReadonlyMap<number, number>, monthEnd: string): Answer {
  if (payments.length === 0) return { said: { key: 'ai.due.none', values: { end: s.date(monthEnd) } }, card: null, next: ['ai.next.howAmI'] };
  const total = payments.reduce((sum, p) => sum + p.amountMinor, 0);
  const late = payments.filter(p => p.dueOn < s.today);
  const blocks: RichBlock[] = [];
  for (const p of payments) {
    const when = s.t(p.dueOn < s.today ? 'ai.due.late' : 'ai.due.on', { date: s.date(p.dueOn) });
    blocks.push({ row: { icon: p.icon ?? (p.kind === 'card' ? 'card-outline' : 'cash-outline'), color: p.color ?? COLORS.yel, round: p.kind === 'card',
      title: p.name, value: s.pesos(p.amountMinor),
      lines: [p.from ? s.t('ai.due.from', { when, account: p.from.name }) : when] } });
  }
  // Each account the payments leave from: does it hold enough?
  const byAccount = new Map<number, { account: AccountRow; outMinor: number; names: string[]; firstOn: string }>();
  for (const p of payments) {
    if (!p.from) continue;
    const at = byAccount.get(p.from.id) ?? { account: p.from, outMinor: 0, names: [], firstOn: p.dueOn };
    at.outMinor += p.amountMinor;
    at.names.push(p.name);
    if (p.dueOn < at.firstOn) at.firstOn = p.dueOn;
    byAccount.set(p.from.id, at);
  }
  let short: { account: AccountRow; minor: number; firstOn: string } | null = null;
  if (byAccount.size > 0) {
    blocks.push({ lab: s.t('ai.due.enough') });
    for (const at of byAccount.values()) {
      const has = holds.get(at.account.id) ?? 0;
      const lacks = at.outMinor - has;
      const lines = [s.t(at.names.length > 1 ? 'ai.due.leaves' : 'ai.due.leavesOne',
        { has: s.pesos(Math.max(0, has)), out: s.pesos(at.outMinor), names: names(s, at.names) })];
      lines.push(lacks > 0 ? s.t('ai.due.lacks', { amount: s.pesos(lacks), date: s.date(at.firstOn < s.today ? s.today : at.firstOn) }) : s.t('ai.due.reaches'));
      blocks.push({ row: { icon: at.account.builtin_icon ?? 'wallet-outline', color: at.account.color ?? COLORS.blu, round: true, title: at.account.name, value: '', lines } });
      if (lacks > 0 && (!short || lacks > short.minor)) short = { account: at.account, minor: lacks, firstOn: at.firstOn };
    }
  }
  const text = [
    s.t('ai.due.answer', { count: payments.length, end: s.date(monthEnd), total: s.pesos(total) }),
    late.length > 0 ? s.t('ai.due.latePart', { count: late.length }) : '',
    short ? s.t('ai.due.shortPart', { account: short.account.name }) : '',
  ].filter(Boolean).join(' ');
  const buttons: RichButton[] = short
    ? [{ label: s.t('ai.due.move', { account: short.account.name }), ghost: false, transferTo: { accountId: short.account.id, amountMinor: short.minor } }]
    : [{ label: s.t('ai.debts.see'), ghost: true, route: ['/debts'] }];
  return {
    said: { key: 'ai.due.answer', values: {}, text },
    card: card(blocks, buttons, short ? 'warn' : 'plain', short ? s.t('ai.due.band', { account: short.account.name, amount: s.pesos(short.minor) }) : null),
    next: ['ai.next.payFirst', 'ai.next.free'],
  };
}

// ---------------------------------------------------------------------------
// "¿Cuánto tengo?" (40i)
// ---------------------------------------------------------------------------

export function have(s: Speech, h: { haveMinor: number; oweMinor: number; haveCount: number; oweCount: number; worthMinor: number }): Answer {
  const blocks: RichBlock[] = [
    { line: { k: s.t('ai.have.have', { count: h.haveCount }), v: s.pesos(h.haveMinor), cls: 'ui-g' } },
    { line: { k: s.t('ai.have.owe', { count: h.oweCount }), v: h.oweMinor > 0 ? `−${s.pesos(h.oweMinor)}` : s.pesos(0), cls: h.oweMinor > 0 ? 'ui-r' : '' } },
    { line: { k: s.t('ai.have.worth'), v: s.pesos(h.worthMinor), cls: h.worthMinor < 0 ? 'ui-r' : '' } },
  ];
  if (h.worthMinor < 0) blocks.push({ note: s.t('ai.have.negative') });
  blocks.push({ note: s.t('ai.have.leftOut') });
  return {
    said: { key: h.oweMinor > 0 ? 'ai.have.answer' : 'ai.have.answerNoDebt',
      values: { have: s.pesos(h.haveMinor), owe: s.pesos(h.oweMinor), worth: s.pesos(h.worthMinor) } },
    card: card(blocks, [{ label: s.t('ai.have.see'), ghost: true, route: ['/accounts'] }]),
    next: ['ai.next.debts', 'ai.next.howAmI'],
  };
}

export function accountHas(s: Speech, account: AccountRow, holdsMinor: number, dues: readonly DueIn[]): Answer {
  const mine = dues.filter(d => d.from?.id === account.id);
  if (mine.length === 0) return { said: { key: 'ai.have.account', values: { account: account.name, amount: s.pesos(holdsMinor) } }, card: null, next: ['ai.next.have'] };
  const d = mine[0];
  return {
    said: { key: d.dueOn < s.today ? 'ai.have.accountLate' : 'ai.have.accountDue',
      values: { account: account.name, amount: s.pesos(holdsMinor), date: s.date(d.dueOn), name: d.name, due: s.pesos(d.amountMinor) } },
    card: null,
    next: ['ai.next.due'],
  };
}

// ---------------------------------------------------------------------------
// "¿Cómo van mis topes y mis metas?" (40j)
// ---------------------------------------------------------------------------

export function plans(s: Speech, limits: readonly LimitView[], goals: readonly GoalView[]): Answer {
  if (limits.length === 0 && goals.length === 0) {
    return { said: { key: 'ai.plans.none', values: {} }, card: null, next: ['ai.next.howAmI'] };
  }
  const blocks: RichBlock[] = [];
  if (limits.length > 0) {
    blocks.push({ lab: s.t('ai.plans.caps') });
    for (const l of limits) {
      blocks.push({ line: { k: l.name, v: s.t('ai.plans.of', { done: s.pesos(l.status.spentMinor), amount: s.pesos(l.status.amountMinor) }),
        cls: l.status.state === 'passed' ? 'ui-r' : l.status.state === 'good' ? 'ui-g' : 'ui-y' } });
    }
  }
  const late = goals.filter(g => g.status.state === 'late');
  if (goals.length > 0) {
    blocks.push({ lab: s.t('ai.plans.goals') });
    for (const g of goals) {
      const reached = g.status.state === 'reached';
      blocks.push({ line: { k: g.terms.name, v: reached ? s.t('ai.plans.reached') : s.t('ai.plans.of', { done: s.pesos(g.status.savedMinor), amount: s.pesos(g.terms.amountMinor) }),
        cls: reached ? 'ui-g' : g.status.state === 'late' ? 'ui-y' : '' } });
      if (g.status.state === 'late' && g.status.neededPerMonthMinor !== null && g.terms.dueMonth) {
        blocks.push({ note: s.t(g.status.arrivalMonth ? 'ai.plans.lateArrives' : 'ai.plans.late', {
          name: g.terms.name, need: s.pesos(g.status.neededPerMonthMinor), date: s.month(g.terms.dueMonth),
          arrives: g.status.arrivalMonth ? s.month(g.status.arrivalMonth) : '' }) });
      }
    }
  }
  const tight = limits.filter(l => l.status.state !== 'good');
  const capsSaid = limits.length === 0 ? '' : tight.length === 0
    ? s.t('ai.plans.capsFine', { count: limits.length })
    : s.t('ai.plans.capsTight', { total: limits.length, count: tight.length, names: names(s, tight.map(l => l.name)) });
  const goalsSaid = goals.length === 0 ? '' : late.length === 0
    ? s.t('ai.plans.goalsFine', { count: goals.length })
    : s.t('ai.plans.goalsLate', { total: goals.length, count: late.length, names: names(s, late.map(g => g.terms.name)) });
  return {
    said: { key: goalsSaid && capsSaid ? 'ai.plans.answerBoth' : capsSaid ? 'ai.plans.answerCaps' : 'ai.plans.answerGoals', values: { caps: capsSaid, goals: goalsSaid } },
    card: card(blocks, [{ label: s.t('ai.plans.see'), ghost: true, route: ['/plans'] }]),
    next: ['ai.next.howGoals', 'ai.next.howAmI'],
  };
}

// ---------------------------------------------------------------------------
// One cap or one goal, by its name (Jose, 2026-10-22)
// ---------------------------------------------------------------------------

export function oneCap(s: Speech, l: LimitView): Answer {
  const st = l.status;
  const passed = st.state === 'passed';
  const blocks: RichBlock[] = [
    { line: { k: s.t('ai.oneCap.spent'), v: s.pesos(st.spentMinor), cls: passed ? 'ui-r' : '' } },
    { line: { k: s.t('ai.oneCap.amount'), v: s.pesos(st.amountMinor) } },
    passed
      ? { line: { k: s.t('ai.oneCap.over'), v: s.pesos(st.overMinor), cls: 'ui-r' } }
      : { line: { k: s.t('ai.oneCap.left'), v: s.pesos(st.remainingMinor), cls: 'ui-g' } },
  ];
  if (!passed && st.daysLeft > 0) {
    blocks.push({ line: { k: s.t(st.daysLeft === 1 ? 'ai.oneCap.perDay.one' : 'ai.oneCap.perDay', { count: st.daysLeft }), v: s.pesos(st.perDayMinor) } });
  }
  if (st.lastMonthSoFarMinor > 0) blocks.push({ line: { k: s.t('ai.oneCap.lastMonth'), v: s.pesos(st.lastMonthSoFarMinor) } });
  const key: TranslationKey = passed ? 'ai.oneCap.answerPassed' : st.state === 'close' ? 'ai.oneCap.answerClose'
    : st.state === 'fast' ? 'ai.oneCap.answerFast' : 'ai.oneCap.answerGood';
  return {
    said: { key, values: { name: l.name, pct: st.percent, spent: s.pesos(st.spentMinor), amount: s.pesos(st.amountMinor),
      left: s.pesos(st.remainingMinor), over: s.pesos(st.overMinor), day: s.pesos(st.perDayMinor) } },
    card: card(blocks, [{ label: s.t('ai.oneCap.see'), ghost: true, route: ['/plans', String(l.terms.id)] }],
      passed ? 'bad' : st.state === 'good' ? 'plain' : 'warn'),
    next: ['ai.next.plans', 'ai.next.howAmI'],
  };
}

export function oneGoal(s: Speech, g: GoalView): Answer {
  const st = g.status;
  const blocks: RichBlock[] = [
    { line: { k: s.t('ai.goal.saved'), v: s.pesos(st.savedMinor), cls: 'ui-g' } },
    { line: { k: s.t('ai.goal.amount'), v: s.pesos(g.terms.amountMinor) } },
  ];
  let key: TranslationKey;
  if (st.state === 'reached') key = 'ai.goal.answerReached';
  else {
    blocks.push({ line: { k: s.t('ai.goal.left'), v: s.pesos(st.remainingMinor) } });
    if (st.neededPerMonthMinor !== null && g.terms.dueMonth) {
      blocks.push({ line: { k: s.t('ai.goal.need', { month: s.month(g.terms.dueMonth) }), v: s.pesos(st.neededPerMonthMinor) } });
    }
    blocks.push({ line: { k: s.t('ai.goal.pace'), v: s.pesos(st.paceMinor) } });
    if (st.arrivalMonth) blocks.push({ line: { k: s.t('ai.goal.arrives'), v: s.month(st.arrivalMonth), cls: st.state === 'late' ? 'ui-y' : 'ui-g' } });
    else if (st.paceMinor > 0) blocks.push({ note: s.t('ai.goal.tooSlow') });
    else blocks.push({ note: s.t('ai.goal.noPace') });
    key = st.state === 'late' ? 'ai.goal.answerLate' : st.state === 'onTime' ? 'ai.goal.answerOnTime' : 'ai.goal.answerNoDate';
  }
  return {
    said: { key, values: { name: g.terms.name, pct: st.percent, saved: s.pesos(st.savedMinor), amount: s.pesos(g.terms.amountMinor),
      left: s.pesos(st.remainingMinor), need: st.neededPerMonthMinor !== null ? s.pesos(st.neededPerMonthMinor) : '',
      date: g.terms.dueMonth ? s.month(g.terms.dueMonth) : '', arrives: st.arrivalMonth ? s.month(st.arrivalMonth) : '' } },
    card: card(blocks, [{ label: s.t('ai.goal.see'), ghost: true, route: ['/plans', 'goal', String(g.terms.id)] }],
      st.state === 'late' ? 'warn' : 'plain'),
    next: ['ai.next.plans', 'ai.next.howGoals'],
  };
}

// ---------------------------------------------------------------------------
// "¿Qué pago cada mes?" (Jose, 2026-10-22)
// ---------------------------------------------------------------------------

export function recurring(s: Speech, r: RecurringPicture): Answer {
  if (r.looked < 3) return { said: { key: 'ai.recurring.tooSoon', values: { count: r.looked } }, card: null, next: ['ai.next.top'] };
  const blocks: RichBlock[] = [];
  if (r.items.length > 0) {
    blocks.push({ lab: s.t('ai.recurring.span', { count: r.looked }) });
    for (const i of r.items.slice(0, 10)) {
      blocks.push({ row: { icon: i.icon ?? 'repeat-outline', color: i.color ?? COLORS.blu, round: false, title: i.name, value: s.pesos(i.averageMinor),
        lines: [`${i.category} · ${s.t('ai.recurring.months', { seen: i.monthsSeen, of: r.looked })}`,
          s.t(i.thisMonthMinor > 0 ? 'ai.recurring.paid' : 'ai.recurring.notYet')] } });
    }
    if (r.items.length > 10) blocks.push({ note: s.t('ai.recurring.more', { count: r.items.length - 10 }) });
    const share = r.spendMinor > 0 ? Math.round(r.totalMinor * 100 / r.spendMinor) : 0;
    blocks.push({ line: { k: s.t('ai.recurring.total'), v: s.pesos(r.totalMinor) } });
    if (share > 0) blocks.push({ line: { k: s.t('ai.recurring.share'), v: `${share}\u00a0%` } });
  }
  if (r.everyMonth.length > 0) {
    blocks.push({ lab: s.t('ai.recurring.everyMonthTitle') });
    blocks.push({ note: s.t('ai.recurring.everyMonth', { names: names(s, r.everyMonth) }) });
  }
  blocks.push({ note: s.t('ai.recurring.how', { needed: r.needed, count: r.looked }) });
  const share = r.spendMinor > 0 ? Math.round(r.totalMinor * 100 / r.spendMinor) : 0;
  return {
    said: r.items.length === 0
      ? { key: 'ai.recurring.none', values: { count: r.looked } }
      : { key: r.items.length === 1 ? 'ai.recurring.answerOne' : 'ai.recurring.answer', values: { count: r.items.length, total: s.pesos(r.totalMinor), share } },
    card: card(blocks),
    next: ['ai.next.top', 'ai.next.howAmI'],
  };
}

// ---------------------------------------------------------------------------
// "¿Cuánto me han dado mis cuentas?" (Jose, 2026-10-22)
// ---------------------------------------------------------------------------

export function yieldsAnswer(s: Speech, y: YieldsPicture | null): Answer {
  if (y === null) return { said: { key: 'ai.yields.none', values: {} }, card: null, next: ['ai.next.have'] };
  const blocks: RichBlock[] = [{ lab: s.t('ai.period.span', { label: y.label, from: s.date(y.from), to: s.date(y.to) }) }];
  for (const a of y.accounts) {
    blocks.push({ row: { icon: a.account.builtin_icon ?? 'wallet-outline', color: a.account.color ?? COLORS.grn, round: true,
      title: a.account.name, value: `+${s.pesos(a.minor)}`, lines: [] } });
  }
  blocks.push({ line: { k: s.t('ai.yields.total'), v: `+${s.pesos(y.totalMinor)}`, cls: 'ui-g' } });
  let change: number | null = null;
  if (y.before && y.before.minor > 0) {
    change = Math.round((y.totalMinor - y.before.minor) * 100 / y.before.minor);
    blocks.push({ line: { k: s.t(y.partial ? 'ai.yields.beforeSameDays' : 'ai.yields.before', { label: y.before.label }), v: s.pesos(y.before.minor) } });
  }
  const waiting = y.waiting.reduce((sum, w) => sum + w.minor, 0);
  if (waiting > 0) {
    blocks.push({ lab: s.t('ai.yields.waitingTitle') });
    for (const w of y.waiting.slice(0, 5)) blocks.push({ line: { k: w.account.name, v: s.pesos(w.minor) } });
    if (y.waiting.length > 5) {
      const rest = y.waiting.slice(5);
      blocks.push({ line: { k: s.t('ai.yields.waitingMore', { count: rest.length }), v: s.pesos(rest.reduce((sum, w) => sum + w.minor, 0)) } });
    }
    blocks.push({ line: { k: s.t('ai.yields.waitingTotal'), v: s.pesos(waiting), cls: 'ui-g' } });
    blocks.push({ note: s.t('ai.yields.waitingNote') });
  }
  if (y.workedUntil) blocks.push({ note: s.t('ai.yields.workedUntil', { date: s.date(y.workedUntil) }) });
  blocks.push({ note: s.t('ai.yields.net') });
  const top = y.accounts[0];
  const said: Said = y.totalMinor <= 0
    ? { key: 'ai.yields.nothing', values: { label: y.label } }
    : { key: change === null ? 'ai.yields.answer' : change >= 0 ? 'ai.yields.answerUp' : 'ai.yields.answerDown',
      values: { label: y.label, total: s.pesos(y.totalMinor), name: top?.account.name ?? '', top: top ? s.pesos(top.minor) : '',
        pct: Math.abs(change ?? 0), than: y.before?.label ?? '' } };
  return {
    said,
    card: card(blocks, [{ label: s.t('ai.yields.see'), ghost: true, route: ['/products'] }]),
    next: ['ai.next.yieldsYear', 'ai.next.have'],
  };
}

// ---------------------------------------------------------------------------
// "¿Por qué gasté más?" (Jose, 2026-10-22)
// ---------------------------------------------------------------------------

export function whyMore(s: Speech, pic: PeriodPicture): Answer {
  const b = pic.before;
  if (!b || b.outMinor <= 0) return { said: { key: 'ai.why.noBefore', values: { label: pic.label } }, card: null, next: ['ai.next.top'] };
  const diff = pic.outMinor - b.outMinor;
  const was = new Map(b.slices.map(sl => [sl.label, sl.amountMinor]));
  const is = new Map(pic.slices.map(sl => [sl.label, sl.amountMinor]));
  const moves = [...new Set([...was.keys(), ...is.keys()])]
    .map(label => ({ label, by: (is.get(label) ?? 0) - (was.get(label) ?? 0), now: is.get(label) ?? 0, before: was.get(label) ?? 0,
      slice: pic.slices.find(sl => sl.label === label) ?? b.slices.find(sl => sl.label === label)! }));
  const up = moves.filter(m => m.by > 0).sort((x, y) => y.by - x.by).slice(0, 4);
  const down = moves.filter(m => m.by < 0).sort((x, y) => x.by - y.by).slice(0, 2);
  const blocks: RichBlock[] = [
    { lab: s.t(pic.partial ? 'ai.period.vsSameDays' : 'ai.period.vs', { label: b.label }) },
    { line: { k: s.t('ai.period.spentIn', { label: b.label }), v: s.pesos(b.outMinor) } },
    { line: { k: s.t('ai.period.spentIn', { label: pic.label }), v: s.pesos(pic.outMinor) } },
    { line: { k: s.t('ai.period.difference'), v: `${diff >= 0 ? '+' : '−'}${s.pesos(Math.abs(diff))}`, cls: diff > 0 ? 'ui-r' : 'ui-g' } },
  ];
  if (up.length > 0) {
    blocks.push({ lab: s.t('ai.why.up') });
    for (const m of up) blocks.push({ row: { icon: m.slice.icon ?? 'pricetag-outline', color: m.slice.color ?? COLORS.org, round: false,
      title: m.label, value: `+${s.pesos(m.by)}`, lines: [s.t('ai.why.fromTo', { before: s.pesos(m.before), now: s.pesos(m.now) })] } });
  }
  if (down.length > 0) {
    blocks.push({ lab: s.t('ai.why.down') });
    for (const m of down) blocks.push({ line: { k: m.label, v: `−${s.pesos(-m.by)}`, cls: 'ui-g' } });
  }
  // Said whole: what went up AND what went down, so a jump that another
  // category made up for does not read as the whole story.
  const same = Math.abs(diff) * 100 < b.outMinor * 5;
  const parts = [s.t(same ? 'ai.why.same' : diff > 0 ? 'ai.why.more' : 'ai.why.less',
    { label: pic.label, amount: s.pesos(Math.abs(diff)), than: b.label })];
  if (up[0]) parts.push(s.t('ai.why.upPart', { name: up[0].label, by: s.pesos(up[0].by) }));
  if (down[0]) parts.push(s.t('ai.why.downPart', { name: down[0].label, by: s.pesos(-down[0].by) }));
  const said: Said = { key: 'ai.why.more', values: {}, text: parts.join(' ') };
  return { said, card: card(blocks, [{ label: s.t('ai.period.report'), ghost: true, report: pic.period }]), next: ['ai.next.top', 'ai.next.recurring'] };
}

// ---------------------------------------------------------------------------
// The rate of a card, said in the chat (40g)
// ---------------------------------------------------------------------------

/** "2,1 % mensual", "28 % E.A.", "28,5": a rate as E.A. scaled, and how it was said. */
export function rateSaid(text: string): { eaScaled: number; quoted: 'ea' | 'mv' } | null {
  const folded = text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const m = /(\d+(?:[.,]\d+)?)\s*%?/.exec(folded);
  if (!m) return null;
  const n = Number(m[1].replace(',', '.'));
  if (!Number.isFinite(n) || n <= 0 || n >= 200) return null;
  const monthly = /\b(mensual|mes|m\.?\s?v\.?|monthly|month)\b/.test(folded) || (n < 6 && !/\b(e\.?\s?a\.?|anual|efectiva|annual|year)\b/.test(folded));
  const scaled = Math.round(n * EA_SCALE / 100);
  if (!monthly) return { eaScaled: scaled, quoted: 'ea' };
  return { eaScaled: Math.round((Math.pow(1 + scaled / EA_SCALE, 12) - 1) * EA_SCALE), quoted: 'mv' };
}

export { rate as rateText };
