/**
 * What the assistant reads from the app to answer, and what it writes when
 * the person confirms (Jose, 2026-10-19, mockups `39a`-`39o`).
 *
 * Every figure comes from what the rest of the app already works out - the
 * accounts' balances, the cards' statements, the loans' schedules, the goals,
 * the caps - never computed a second way (rule 20). What the person teaches
 * it is kept in the database, so it travels in the backup: a word for a
 * category in the merchant dictionary every other screen learns from, a word
 * for an account and the shape of a sentence under `assistant.learned`.
 */

import { Injectable, inject } from '@angular/core';

import { DatabaseService } from '../database/database.service';
import { AccountsRepository } from '../database/repositories/accounts.repository';
import { CategoriesRepository } from '../database/repositories/categories.repository';
import { ProposalsRepository } from '../database/repositories/proposals.repository';
import { TaxParametersRepository } from '../database/repositories/tax-parameters.repository';
import { TransactionsRepository } from '../database/repositories/transactions.repository';
import { YieldsRepository, type YieldProduct } from '../database/repositories/yields.repository';
import type { AccountRow, CategoryRow } from '../database/types';
import { AccrualEngine } from '../yields/accrual';
import { accrueAndSettle } from '../yields/cdt';
import { usualScope, writeScoped } from '../yields/entry-scope';
import { loadCards, usualPayer } from '../cards/card-data';
import { LoansRepository } from '../loans/loans.repository';
import { loanSchedule, payoffToday } from '../loans/schedule';
import { GoalsRepository, inPesos, savedOn } from '../goals/goals.repository';
import { GoalsService } from '../goals/goals.service';
import { LimitsService, type LimitView } from '../limits/limits.service';
import { monthOf, shiftMonth, daysInMonth } from '../limits/limits';
import { wordCategoryOf } from '../proposals/common-words';
import { merchantKeyOf } from '../proposals/merchant';
import { isoDay, periodContaining, periodLabel, type Period } from '../filters/period';
import { MovementsStore } from '../../features/movements/movements.store';
import { slicesOf, totalsOf, type Slice } from '../../features/movements/group-movements';
import { daysBetween, equivalentBefore } from '../report/report-data';
import { I18nService } from '../i18n/i18n.service';
import { splitWorth } from '../worth/worth-split';
import { usuryOn } from '../debts/usury';
import type { DebtIn } from './debts-advice';
import { freeMoney, type DuePayment, type FreeMoney, type GoalMoney } from './free-money';
import { fold, type Learned, type LearnedRoute, type PhraseContext } from './read-phrase';

const LEARNED_KEY = 'assistant.learned';
/** How many sentences and where they were saved are remembered. */
const PHRASES_KEPT = 300;

export interface AccountMoney {
  account: AccountRow;
  /** What it holds that counts as free, in pesos (no CDT, nothing set aside). */
  holdsMinor: number;
}

export interface Picture {
  free: FreeMoney;
  accounts: AccountMoney[];
  /** Interest products earned and nobody moved into the balance yet, by account, in pesos. */
  interest: { account: AccountRow; minor: number }[];
}

export interface SpentIn {
  category: CategoryRow;
  /** This month up to today, and last month up to the same day, in pesos. */
  nowMinor: number;
  beforeMinor: number;
  cap: LimitView | null;
}

/** A period in figures, against the same days of the one before (40b, 40c). */
export interface PeriodPicture {
  period: Period;
  label: string;
  /** The period reaches today: only its days so far are counted, and compared. */
  partial: boolean;
  /** The first and last day counted. */
  from: string;
  to: string;
  inMinor: number;
  outMinor: number;
  before: { label: string; from: string; to: string; inMinor: number; outMinor: number; slices: Slice[] } | null;
  /** Spending by category, largest first. */
  slices: Slice[];
}

/**
 * A fixed payment (Jose, 2026-10-22): the same shop or note, paid in most of
 * the last months, for about the same amount each time - the rent, a plan,
 * a subscription.
 */
export interface RecurringItem {
  /** What it is called, as last written. */
  name: string;
  /** Its category, drawn beside it. */
  category: string;
  icon: string | null;
  customIconId: number | null;
  color: string | null;
  seed: number | null;
  /** In how many of the months looked at it turned up. */
  monthsSeen: number;
  /** What it costs in a month it turns up, on average. */
  averageMinor: number;
  /** What it has cost so far this month. */
  thisMonthMinor: number;
}

export interface RecurringPicture {
  /** How many whole months were looked at (up to six). */
  looked: number;
  /** In how many of them a payment has to turn up to count. */
  needed: number;
  items: RecurringItem[];
  /** All of it in an ordinary month, and the whole average spending, for the share. */
  totalMinor: number;
  spendMinor: number;
  /** Categories with spending every month, whose amount changes: named, not added. */
  everyMonth: string[];
}

/** How far a month's amount may stray from the average and still be "the same" payment. */
const STEADY = 0.25;

/** What the accounts that earn paid over a period, net of withholding, in pesos. */
export interface YieldsPicture {
  period: Period;
  label: string;
  partial: boolean;
  from: string;
  to: string;
  totalMinor: number;
  accounts: { account: AccountRow; minor: number }[];
  /** The same days of the period before. */
  before: { label: string; minor: number } | null;
  /** The last day worked out, when it is before the period's end. */
  workedUntil: string | null;
  /** Interest the products hold that is not in the balance yet (rule 15). */
  waiting: { account: AccountRow; minor: number }[];
}

/** One debt as the assistant speaks of it (40d-40h). */
export interface DebtView extends DebtIn {
  account: AccountRow;
  /** The next payment: its day and what it is (a statement, an installment with its insurance). */
  nextOn: string | null;
  nextMinor: number;
  /** The month the reference rate is of, when it is the reference. */
  referenceMonth: string | null;
}

@Injectable({ providedIn: 'root' })
export class AssistantService {
  private readonly database = inject(DatabaseService);
  private readonly goals = inject(GoalsService);
  private readonly limits = inject(LimitsService);
  private readonly store = inject(MovementsStore);
  private readonly i18n = inject(I18nService);

  private get db() {
    return this.database.driver;
  }

  // -------------------------------------------------------------------------
  // What a sentence is read against
  // -------------------------------------------------------------------------

  async context(): Promise<PhraseContext & { accountRows: AccountRow[]; categoryRows: CategoryRow[]; productRows: YieldProduct[] }> {
    const db = this.db;
    const [accounts, categories, products, merchants, learned] = await Promise.all([
      new AccountsRepository(db).list(),
      new CategoriesRepository(db).list(),
      new YieldsRepository(db).allProducts(),
      db.query<{ merchant: string; category_id: number }>('SELECT merchant, category_id FROM merchant_categories'),
      this.learned(),
    ]);
    const live = new Set(accounts.map(a => a.id));
    const kinds = new Map(categories.map(c => [c.id, c]));
    return {
      accounts: accounts.map(a => ({ id: a.id, name: a.name, type: a.type })),
      products: products.filter(p => live.has(p.account_id)).map(p => ({ id: p.id, accountId: p.account_id, name: p.name })),
      categories: categories.filter(c => c.kind === 'income' || c.kind === 'expense')
        .map(c => ({ id: c.id, name: c.name, kind: c.kind as 'income' | 'expense' })),
      merchants: new Map(merchants.filter(m => kinds.has(m.category_id)).map(m => [m.merchant, m.category_id])),
      commonWord: (word, side) => wordCategoryOf(word, side === 'income' ? 1 : -1)?.es ?? null,
      learned,
      today: isoDay(new Date()),
      accountRows: accounts,
      categoryRows: categories,
      productRows: products,
    };
  }

  async learned(): Promise<Learned> {
    const row = await this.db.queryOne<{ value: string }>('SELECT value FROM settings WHERE key = ?', [LEARNED_KEY]);
    if (!row) return { accounts: {}, shapes: {}, phrases: {} };
    try {
      const parsed = JSON.parse(row.value) as Partial<Learned>;
      return { accounts: parsed.accounts ?? {}, shapes: parsed.shapes ?? {}, phrases: parsed.phrases ?? {} };
    } catch {
      return { accounts: {}, shapes: {}, phrases: {} };
    }
  }

  private async keep(learned: Learned): Promise<void> {
    await this.db.run(
      `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      [LEARNED_KEY, JSON.stringify(learned), new Date().toISOString()]);
  }

  /** "la rappi" means this account from now on. */
  async learnAccountWord(words: string, accountId: number): Promise<void> {
    const key = fold(words).replace(/[^a-z0-9ñ ]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (!key) return;
    const learned = await this.learned();
    learned.accounts[key] = accountId;
    await this.keep(learned);
  }

  /** A sentence of this shape, with no verb, meant this. */
  async learnShape(shape: string, meant: 'register' | 'afford'): Promise<void> {
    const learned = await this.learned();
    learned.shapes[shape] = meant;
    await this.keep(learned);
  }

  /** A sentence said this way was saved here: the next one said the same way goes there too. */
  async learnPhrase(key: string, route: LearnedRoute): Promise<void> {
    if (!key || route.accountId === null) return;
    const learned = await this.learned();
    const phrases = { ...(learned.phrases ?? {}) };
    delete phrases[key];
    learned.phrases = { ...phrases, [key]: route };
    // The newest few hundred are kept; a sentence not said for long goes first.
    const keys = Object.keys(learned.phrases);
    if (keys.length > PHRASES_KEPT) for (const old of keys.slice(0, keys.length - PHRASES_KEPT)) delete learned.phrases[old];
    await this.keep(learned);
  }

  /** A word for a thing filed under a category: the same dictionary every screen learns from. */
  async learnWord(word: string, categoryId: number): Promise<void> {
    await new ProposalsRepository(this.db).learn(word, categoryId, isoDay(new Date()));
  }

  // -------------------------------------------------------------------------
  // The picture: what is free, and why
  // -------------------------------------------------------------------------

  async picture(): Promise<Picture> {
    const db = this.db;
    const today = isoDay(new Date());
    const month = monthOf(today);
    const monthEnd = `${month}-${String(daysInMonth(month)).padStart(2, '0')}`;
    const goalsRepo = new GoalsRepository(db);
    const yields = new YieldsRepository(db);
    const [facts, rates, balances, products, cards, loans] = await Promise.all([
      goalsRepo.accountFacts(),
      goalsRepo.rates(today),
      new AccountsRepository(db).balances({ leaveOutSetAside: true }),
      yields.allProducts(),
      loadCards(db, today),
      new LoansRepository(db).all(),
    ]);

    // What each counted account holds, its CDTs left out.
    const counted = balances.filter(b => facts.get(b.account.id)?.inAll);
    const cdts = products.filter(p => p.kind === 'cdt' && p.include_in_net_worth === 1 && counted.some(b => b.account.id === p.account_id));
    const cdtHeld = cdts.length > 0 ? await goalsRepo.holdsOn(cdts.map(p => ({ accountId: p.account_id, productId: p.id })), today) : new Map<string, number>();
    const accounts: AccountMoney[] = counted.map(b => {
      const inCdts = cdts.filter(p => p.account_id === b.account.id)
        .reduce((sum, p) => sum + Math.max(0, cdtHeld.get(`${p.account_id}:${p.id}`) ?? 0), 0);
      return { account: b.account, holdsMinor: inPesos(b.balance_minor - inCdts, b.account.currency_code, rates) ?? 0 };
    });
    const inAccountsMinor = accounts.reduce((sum, a) => sum + a.holdsMinor, 0);

    // The payments coming: what is left of each card's statement, the installments due by the month's end.
    const payments: DuePayment[] = [];
    for (const card of cards) {
      const s = card.statement;
      if ((s.state !== 'due' && s.state !== 'partial' && s.state !== 'overdue') || s.remainingMinor <= 0) continue;
      const pesos = inPesos(s.remainingMinor, card.account.currency_code, rates);
      if (pesos === null) continue;
      payments.push({ kind: 'card', id: card.account.id, name: card.account.name, amountMinor: pesos,
        dueOn: s.dueOn ?? today, fromAccountId: await usualPayer(db, card.account.id) });
    }
    for (const loan of loans) {
      if (loan.account.archived) continue;
      const schedule = loanSchedule(loan.terms, loan.payments, today);
      for (const row of schedule.rows) {
        if (row.type !== 'installment') continue;
        if (row.state === 'overdue' || ((row.state === 'next' || row.state === 'future') && row.dueOn <= monthEnd)) {
          payments.push({ kind: 'loan', id: loan.account.id, name: loan.account.name, amountMinor: row.totalMinor,
            dueOn: row.dueOn, fromAccountId: loan.paidFromAccountId });
        }
      }
    }
    payments.sort((a, b) => a.dueOn.localeCompare(b.dueOn));

    // The goals: what they hold, and what this month would want.
    await this.goals.load();
    const live = this.goals.live();
    const lastMonthEnd = `${shiftMonth(month, -1)}-${String(daysInMonth(shiftMonth(month, -1))).padStart(2, '0')}`;
    const before = await savedOn(goalsRepo, live.map(g => g.terms), lastMonthEnd, rates);
    const freeProduct = (p: YieldProduct | null) => p === null || (p.kind !== 'cdt' && p.include_in_net_worth === 1);
    const goalMoney: GoalMoney[] = live.map(g => {
      const saved = Math.max(0, g.status.savedMinor);
      const countedMinor = g.terms.allAccounts ? saved
        : Math.max(0, g.places.filter(p => facts.get(p.place.accountId)?.inAll && freeProduct(p.product))
          .reduce((sum, p) => sum + p.pesos, 0));
      const atStart = g.terms.allAccounts ? saved : Math.max(0, before.saved.get(g.terms.id) ?? 0);
      return {
        id: g.terms.id, name: g.terms.name, icon: g.terms.icon, color: g.terms.color,
        amountMinor: g.terms.amountMinor, savedMinor: saved, savedAtMonthStartMinor: atStart,
        dueMonth: g.terms.dueMonth, paceMinor: g.status.paceMinor,
        reached: g.status.state === 'reached', countedMinor: Math.min(saved, countedMinor),
      };
    });

    return {
      free: freeMoney({ inAccountsMinor, payments, goals: goalMoney, today }),
      accounts,
      interest: await this.interest(rates),
    };
  }

  /**
   * What each account's products earned beyond what the account itself
   * counts - the products screen's "available" figure, worked out the same way.
   */
  private async interest(rates: Awaited<ReturnType<GoalsRepository['rates']>>): Promise<{ account: AccountRow; minor: number }[]> {
    const db = this.db;
    const today = isoDay(new Date());
    const yields = new YieldsRepository(db);
    const enrolled = await yields.accounts();
    if (enrolled.length === 0) return [];
    const all = await new AccountsRepository(db).balances();
    const products = await yields.allProducts();
    const productsOf = new Map<number, YieldProduct[]>();
    for (const e of enrolled) productsOf.set(e.account_id, products.filter(p => p.account_id === e.account_id));
    const held = await new AccrualEngine(db, yields, new TaxParametersRepository(db)).heldByProducts(today, productsOf);
    const landed = await yields.landedByProducts(today, productsOf);
    const out: { account: AccountRow; minor: number }[] = [];
    for (const [accountId, list] of productsOf) {
      const balance = all.find(b => b.account.id === accountId);
      if (!balance || balance.account.archived || list.length === 0) continue;
      const productsMinor = list.reduce((sum, p) => sum + (held.get(accountId)?.get(p.id) ?? 0) + (landed.get(accountId)?.total.get(p.id) ?? 0), 0);
      const available = productsMinor - balance.balance_minor;
      const pesos = inPesos(available, balance.account.currency_code, rates);
      if (pesos !== null && pesos >= 100) out.push({ account: balance.account, minor: pesos });
    }
    return out.sort((a, b) => b.minor - a.minor);
  }

  /** The cap this category falls under this month, if any. */
  capOf(categoryId: number | null): LimitView | null {
    if (categoryId === null) return null;
    return this.limits.current().limits.find(l => l.terms.categoryIds.includes(categoryId)) ?? null;
  }

  async spentIn(category: CategoryRow): Promise<SpentIn> {
    const today = isoDay(new Date());
    const month = monthOf(today);
    const day = Number(today.slice(8, 10));
    const last = shiftMonth(month, -1);
    const lastDay = Math.min(day, daysInMonth(last));
    const sum = async (from: string, to: string) => (await this.db.queryOne<{ total: number | null }>(
      `SELECT SUM(amount_base_minor) AS total FROM transactions
        WHERE category_id = ? AND transfer_id IS NULL AND occurred_on BETWEEN ? AND ?`,
      [category.id, from, to]))?.total ?? 0;
    const sign = category.kind === 'expense' ? -1 : 1;
    return {
      category,
      nowMinor: sign * await sum(`${month}-01`, today),
      beforeMinor: sign * await sum(`${last}-01`, `${last}-${String(lastDay).padStart(2, '0')}`),
      cap: this.capOf(category.id),
    };
  }

  // -------------------------------------------------------------------------
  // The whole picture (40b-40j)
  // -------------------------------------------------------------------------

  /**
   * A period across every account counted in net worth, in pesos, read the
   * way the summary and the report read it (`totalsOf`, `slicesOf`): only its
   * days so far when it reaches today, against the same days of the one before.
   */
  async periodPicture(asked: Period | null): Promise<PeriodPicture> {
    const today = isoDay(new Date());
    const period = asked ?? periodContaining('month', new Date());
    const from = period.from ?? today;
    const to = period.to !== null && period.to < today ? period.to : today;
    const partial = period.to === null || period.to >= today;
    const counted: Period = { ...period, from, to };
    const locale = this.i18n.dateLocale();
    const all = this.i18n.t('period.all');
    const movements = await this.store.movementsFor(counted, undefined, true);
    const totals = totalsOf(movements, 'base');
    const spending = (list: typeof movements) => slicesOf(list, 'base')
      .filter(slice => slice.flow === 'out' && slice.amountMinor > 0)
      .sort((a, b) => b.amountMinor - a.amountMinor);
    const earlier = equivalentBefore(period, daysBetween(from, to) + 1);
    let before: PeriodPicture['before'] = null;
    if (earlier !== null && earlier.from !== null && earlier.to !== null) {
      const list = await this.store.movementsFor(earlier, undefined, true);
      const t = totalsOf(list, 'base');
      before = { label: periodLabel(earlier, locale, all), from: earlier.from, to: earlier.to,
        inMinor: t.inMinor, outMinor: t.outMinor, slices: spending(list) };
    }
    return {
      period, label: periodLabel(period, locale, all), partial, from, to,
      inMinor: totals.inMinor, outMinor: totals.outMinor, before, slices: spending(movements),
    };
  }

  /**
   * What comes back every month: each spending category that turned up in at
   * least 4 of the last 6 whole months (3 of 3, 3 of 4, 3 of 5), the way the
   * report's "Gastos que se repiten" judges it - by turning up, never by a
   * name looking like a subscription.
   */
  async recurring(): Promise<RecurringPicture> {
    const now = new Date();
    type Movements = Awaited<ReturnType<MovementsStore['movementsFor']>>;
    const spending = (list: Movements) => slicesOf(list, 'base').filter(slice => slice.flow === 'out' && slice.amountMinor > 0);
    /** Each payment of a month by its shop or note: what it cost, and how it looks. */
    const byShop = (list: Movements) => {
      const out = new Map<string, { minor: number; m: Movements[number] }>();
      for (const m of list) {
        if (m.flow !== 'out') continue;
        const key = merchantKeyOf(m.transaction.description);
        if (!key) continue;
        const at = out.get(key);
        const minor = Math.abs(m.transaction.amount_base_minor);
        if (at) { at.minor += minor; at.m = m; } else out.set(key, { minor, m });
      }
      return out;
    };
    const months: Movements[] = [];
    for (let back = 1; back <= 6; back++) {
      months.push(await this.store.movementsFor(periodContaining('month', new Date(now.getFullYear(), now.getMonth() - back, 1)), undefined, true));
    }
    // Months before anything was recorded are not months of the habit.
    while (months.length > 0 && spending(months[months.length - 1]).length === 0) months.pop();
    const looked = months.length;
    const needed = Math.max(3, Math.ceil(looked * 0.6));
    const current = byShop(await this.store.movementsFor(periodContaining('month', now), undefined, true));

    const seen = new Map<string, { amounts: number[]; m: Movements[number] }>();
    for (const list of [...months].reverse()) {
      for (const [key, at] of byShop(list)) {
        const was = seen.get(key);
        if (was) { was.amounts.push(at.minor); was.m = at.m; } else seen.set(key, { amounts: [at.minor], m: at.m });
      }
    }
    const items: RecurringItem[] = [];
    if (looked >= 3) {
      for (const [key, x] of seen) {
        if (x.amounts.length < needed) continue;
        const average = Math.round(x.amounts.reduce((sum, v) => sum + v, 0) / x.amounts.length);
        if (average <= 0 || x.amounts.some(v => Math.abs(v - average) > average * STEADY)) continue;
        const t = x.m;
        items.push({ name: (t.transaction.description ?? '').trim(), category: t.label, icon: t.icon, customIconId: t.customIconId,
          color: t.color ?? null, seed: t.seed ?? null, monthsSeen: x.amounts.length, averageMinor: average,
          thisMonthMinor: current.get(key)?.minor ?? 0 });
      }
    }
    items.sort((a, b) => b.averageMinor - a.averageMinor);
    // Categories spent on every month, whose amount moves: said by name.
    const counts = new Map<string, { months: number; total: number }>();
    for (const list of months) for (const sl of spending(list)) {
      const at = counts.get(sl.label) ?? { months: 0, total: 0 };
      at.months += 1; at.total += sl.amountMinor;
      counts.set(sl.label, at);
    }
    const fixedCategories = new Set(items.map(i => i.category));
    const everyMonth = looked < 3 ? [] : [...counts.entries()]
      .filter(([label, c]) => c.months === looked && !fixedCategories.has(label))
      .sort((a, b) => b[1].total - a[1].total).slice(0, 6).map(([label]) => label);
    const all = months.reduce((sum, list) => sum + spending(list).reduce((t, sl) => t + sl.amountMinor, 0), 0);
    return {
      looked, needed, items, everyMonth,
      totalMinor: items.reduce((sum, i) => sum + i.averageMinor, 0),
      spendMinor: looked > 0 ? Math.round(all / looked) : 0,
    };
  }

  /**
   * What the accounts that earn paid over a period (this month when none is
   * said), net of withholding, each in pesos at today's rate; against the
   * same days of the period before. Null when no account earns.
   */
  async yieldsPicture(asked: Period | null, accountId: number | null): Promise<YieldsPicture | null> {
    const db = this.db;
    const today = isoDay(new Date());
    const yields = new YieldsRepository(db);
    const enrolled = (await yields.accounts()).map(e => e.account_id)
      .filter(id => accountId === null || id === accountId);
    if (enrolled.length === 0) return null;
    const period = asked ?? periodContaining('month', new Date());
    const from = period.from ?? '2000-01-01';
    const to = period.to !== null && period.to < today ? period.to : today;
    const partial = period.to === null || period.to >= today;
    const [rates, rows] = await Promise.all([new GoalsRepository(db).rates(today), new AccountsRepository(db).balances()]);
    const pesos = (map: Map<number, number>) => {
      const out: { account: AccountRow; minor: number }[] = [];
      for (const [id, minor] of map) {
        const account = rows.find(b => b.account.id === id)?.account;
        const value = account ? inPesos(minor, account.currency_code, rates) : null;
        if (account && value !== null && value !== 0) out.push({ account, minor: value });
      }
      return out.sort((a, b) => b.minor - a.minor);
    };
    const accounts = pesos(await yields.earnedBetween(enrolled, from, to));
    const locale = this.i18n.dateLocale();
    const all = this.i18n.t('period.all');
    const earlier = period.from ? equivalentBefore(period, daysBetween(from, to) + 1) : null;
    let before: YieldsPicture['before'] = null;
    if (earlier && earlier.from && earlier.to) {
      const was = pesos(await yields.earnedBetween(enrolled, earlier.from, earlier.to));
      before = { label: periodLabel(earlier, locale, all), minor: was.reduce((sum, a) => sum + a.minor, 0) };
    }
    const last = (await db.queryOne<{ last: string | null }>(
      `SELECT MAX(on_date) AS last FROM yield_days WHERE account_id IN (${enrolled.map(() => '?').join(',')})`, enrolled))?.last ?? null;
    const waiting = (await this.interest(rates)).filter(w => accountId === null || w.account.id === accountId);
    return {
      period, label: periodLabel(period, locale, all), partial, from, to,
      totalMinor: accounts.reduce((sum, a) => sum + a.minor, 0), accounts, before,
      workedUntil: last !== null && last < to ? last : null, waiting,
    };
  }

  /**
   * Every debt in pesos: each card with what it owes, what is left of its
   * statement and its rate (typed on the card, or the month's legal maximum as
   * a reference); each loan with its schedule's balance, installment, interest
   * still to pay and what paying it off today would cost.
   */
  async debts(): Promise<{ debts: DebtView[]; reference: { rateScaled: number; month: string } }> {
    const db = this.db;
    const today = isoDay(new Date());
    const reference = usuryOn(today);
    const [cards, loans, rates] = await Promise.all([
      loadCards(db, today), new LoansRepository(db).all(), new GoalsRepository(db).rates(today),
    ]);
    const out: DebtView[] = [];
    for (const card of cards) {
      const owed = inPesos(Math.max(0, -card.balanceMinor), card.account.currency_code, rates);
      if (owed === null || owed <= 0) continue;
      const s = card.statement;
      const statementDue = (s.state === 'due' || s.state === 'partial' || s.state === 'overdue') && s.remainingMinor > 0;
      const left = statementDue ? inPesos(s.remainingMinor, card.account.currency_code, rates) ?? 0 : 0;
      const typed = card.account.card_rate_scaled;
      out.push({
        kind: 'card', id: card.account.id, name: card.account.name, account: card.account,
        balanceMinor: owed, rateScaled: typed ?? reference.rateScaled, rateFrom: typed ? 'typed' : 'reference',
        referenceMonth: typed ? null : reference.month,
        installmentMinor: 0, installmentsLeft: 0, interestLeftMinor: 0, payoffInterestMinor: 0,
        statementLeftMinor: left, dueOn: statementDue ? s.dueOn : null,
        nextOn: statementDue ? s.dueOn : null, nextMinor: left,
      });
    }
    for (const loan of loans) {
      if (loan.account.archived) continue;
      const schedule = loanSchedule(loan.terms, loan.payments, today);
      if (schedule.done || schedule.balanceMinor <= 0) continue;
      const rate = [...loan.terms.rates].sort((a, b) => a.validFrom.localeCompare(b.validFrom))
        .filter(r => r.validFrom <= today).pop() ?? loan.terms.rates[0];
      const next = schedule.overdue[0] ?? schedule.next;
      out.push({
        kind: 'loan', id: loan.account.id, name: loan.account.name, account: loan.account,
        balanceMinor: schedule.balanceMinor, rateScaled: rate?.annualRateScaled ?? null, rateFrom: rate ? 'typed' : null,
        referenceMonth: null,
        installmentMinor: next ? next.capitalMinor + next.interestMinor : 0,
        installmentsLeft: Math.max(0, schedule.totalCount - schedule.paidCount),
        interestLeftMinor: schedule.interestLeftMinor,
        payoffInterestMinor: payoffToday(loan.terms, loan.payments, today).interestMinor,
        statementLeftMinor: 0, dueOn: next?.dueOn ?? null,
        nextOn: next?.dueOn ?? null, nextMinor: next?.totalMinor ?? 0,
      });
    }
    return { debts: out, reference };
  }

  /**
   * What is left over in a month, on average: what came in less what went out
   * over the last three whole months, every account counted (never below
   * nothing). What paying a debt off "soon" is measured with.
   */
  async leftOverPerMonth(): Promise<number> {
    const today = new Date();
    let total = 0;
    for (let back = 1; back <= 3; back++) {
      const month = periodContaining('month', new Date(today.getFullYear(), today.getMonth() - back, 1));
      const t = totalsOf(await this.store.movementsFor(month, undefined, true), 'base');
      total += t.inMinor - t.outMinor;
    }
    return Math.max(0, Math.round(total / 3));
  }

  /** The rate a card charges, typed in the chat (40g). */
  async setCardRate(accountId: number, rateScaled: number, quoted: 'ea' | 'mv'): Promise<void> {
    await new AccountsRepository(this.db).update(accountId, { card_rate_scaled: rateScaled, card_rate_quoted: quoted });
    this.database.dataChanged();
  }

  /** What every account holds today, in pesos, and net worth as what one has and owes (40i). */
  async holdings(): Promise<{ haveMinor: number; oweMinor: number; haveCount: number; oweCount: number; worthMinor: number;
    balances: { account: AccountRow; minor: number }[] }> {
    const db = this.db;
    const accounts = new AccountsRepository(db);
    const [worth, loanIds, balances, rates] = await Promise.all([
      accounts.netWorth(), new LoansRepository(db).ids(), accounts.balances({ leaveOutSetAside: true }),
      new GoalsRepository(db).rates(isoDay(new Date())),
    ]);
    const loans = new Set(loanIds);
    const types = new Map(balances.map(b => [b.account.id, b.account.type]));
    const split = splitWorth(worth.lines, id => loans.has(id) ? 'loan' : types.get(id) === 'credit' ? 'card' : 'other');
    return {
      haveMinor: split.haveMinor, oweMinor: split.oweMinor, haveCount: split.haveCount,
      oweCount: split.owe.length, worthMinor: worth.totalMinor,
      balances: balances.filter(b => !b.account.archived)
        .map(b => ({ account: b.account, minor: inPesos(b.balance_minor, b.account.currency_code, rates) ?? 0 })),
    };
  }

  /** The caps of this month and the goals, as their own screens have them (40j). */
  plans(): { limits: LimitView[]; goals: ReturnType<GoalsService['live']> } {
    return { limits: this.limits.current().limits, goals: this.goals.live() };
  }

  async loadGoals(): Promise<void> {
    await this.goals.load();
  }

  // -------------------------------------------------------------------------
  // Saving what was confirmed
  // -------------------------------------------------------------------------

  /**
   * The product a movement on this account lands in by habit, and whether
   * the habit answers "¿Qué cambia?" as an ordinary movement.
   */
  async usual(accountId: number, side: 'expense' | 'income', categoryId: number | null): Promise<{ products: YieldProduct[]; productId: number | null; ordinary: boolean }> {
    const products = await new YieldsRepository(this.db).products(accountId);
    if (products.length === 0) return { products, productId: null, ordinary: true };
    const productId = (products.find(p => p.is_default === 1) ?? products[0]).id;
    const scope = await usualScope(this.db, { accountId, side: side === 'income' ? 'in' : 'out', categoryId });
    return { products, productId, ordinary: scope === 'both' };
  }

  /**
   * A spending or an income written as the movement form writes an ordinary
   * one: on the account, its product when it has several, the note taught to
   * the dictionary, and the account's yields worked out again from that day.
   */
  async register(input: {
    side: 'expense' | 'income'; accountId: number; productId: number | null; categoryId: number;
    amountMinor: number; onDate: string; note: string;
  }): Promise<void> {
    const db = this.db;
    const yields = new YieldsRepository(db);
    const products = await yields.products(input.accountId);
    const note = input.note.trim() || null;
    if (products.length > 0) {
      await db.transaction(async () => {
        await writeScoped(db, yields, {
          scope: 'both', kind: input.side, accountId: input.accountId, categoryId: input.categoryId,
          productId: input.productId, movementProductId: products.length > 1 ? input.productId : null,
          onDate: input.onDate, amountMinor: input.amountMinor, note,
        });
        await yields.clearDays(input.accountId, input.onDate);
      });
      await accrueAndSettle(db, yields, new TaxParametersRepository(db), input.accountId, isoDay(new Date()));
      await yields.markAccrued(isoDay(new Date()), { onlyIfKnown: true });
    } else {
      await new TransactionsRepository(db).create({
        account_id: input.accountId, category_id: input.categoryId, product_id: null,
        occurred_on: input.onDate,
        amount_minor: input.side === 'expense' ? -input.amountMinor : input.amountMinor,
        description: note, source: 'manual',
      });
    }
    if (note) await new ProposalsRepository(db).learn(note, input.categoryId, input.onDate);
    this.database.dataChanged();
  }
}
