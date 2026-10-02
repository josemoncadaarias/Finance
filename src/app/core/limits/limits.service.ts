/**
 * The limits as every screen sees them, read once and kept in step with the
 * data (plans, part 3; mockups `14a`-`14p`).
 *
 * Planes, a limit's page, Inicio's card, the line on Más and the red dot on
 * the bar all read this one service, so they cannot disagree. It also watches
 * for a level crossed - a limit reaching 80 % or going past, the total going
 * past - between one reading and the next, which is what a saved movement
 * does, and then says so: the sheet at saving and the phone's notification,
 * each only when the person has not turned it off (`14p`), and each once a
 * month per limit and level.
 */

import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

import { DatabaseService } from '../database/database.service';
import type { AccountRow, CategoryRow } from '../database/types';
import { I18nService } from '../i18n/i18n.service';
import { formatMoney } from '../database/money';
import { isoDay } from '../filters/period';
import {
  crossings, levelOf, limitStatus, stillOver, monthOf, shiftMonth, totalStatus,
  type Crossing, type Level, type LimitStatus, type LimitTerms, type SpendRow, type TotalStatus,
} from './limits';
import { LimitsRepository, type LimitInput, type LimitNotices } from './limits.repository';

/** How far back Planes can be looked at, in months. */
export const MONTHS_BACK = 12;

export interface LimitView {
  terms: LimitTerms;
  status: LimitStatus;
  categories: CategoryRow[];
  /** Its categories' names, as one. */
  name: string;
  /** The one account it is on, or null for every account. */
  account: AccountRow | null;
}

export interface MonthView {
  month: string;
  limits: LimitView[];
  total: TotalStatus | null;
  passed: LimitView[];
  fine: LimitView[];
}

/** What the sheet at saving says (`14h`, `14n`). */
export type LimitAlert =
  | { kind: 'limit'; view: LimitView; again?: boolean }
  | { kind: 'total'; month: MonthView; again?: boolean };

const TOLD_KEY = 'finance.limits.told';

function readTold(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(TOLD_KEY) ?? '[]') as string[]);
  } catch {
    return new Set();
  }
}

function saveTold(told: Set<string>, month: string): void {
  try {
    // Only this month's: older ones can never be told again anyway.
    localStorage.setItem(TOLD_KEY, JSON.stringify([...told].filter(key => key.startsWith(month))));
  } catch {
    // A browser with site data blocked may be told twice; nothing breaks.
  }
}

@Injectable({ providedIn: 'root' })
export class LimitsService {
  private readonly database = inject(DatabaseService);
  private readonly i18n = inject(I18nService);

  readonly limits = signal<LimitTerms[]>([]);
  private readonly rows = signal<SpendRow[]>([]);
  readonly categories = signal<Map<number, CategoryRow>>(new Map());
  readonly accounts = signal<AccountRow[]>([]);
  readonly notices = signal<LimitNotices>({ atSave: true, phone: true, at80: true });
  readonly loaded = signal(false);
  readonly today = signal(isoDay(new Date()));

  /** The month Planes is on. */
  readonly month = signal(monthOf(isoDay(new Date())));
  readonly thisMonth = computed(() => monthOf(this.today()));

  /** The sheet at saving, while it is up. */
  readonly alert = signal<LimitAlert | null>(null);

  readonly viewed = computed(() => this.monthView(this.month()));
  readonly current = computed(() => this.monthView(this.thisMonth()));

  /** Categories some limit already covers: a category goes in one limit at most. */
  readonly taken = computed(() => new Map(this.limits().flatMap(limit => limit.categoryIds.map(id => [id, limit.id] as const))));

  private levels: {
    month: string; ids: Set<number>; at: Map<number | 'total', Level>; spent: Map<number | 'total', number>;
  } | null = null;
  /** Set while a limit itself is changed: lowering a figure under what was spent is not a purchase. */
  private quiet = false;

  constructor() {
    effect(() => {
      this.database.dataVersion();
      if (this.database.status() !== 'ready') return;
      void untracked(() => this.load());
    });
  }

  private get repo(): LimitsRepository {
    return new LimitsRepository(this.database.driver);
  }

  async load(): Promise<void> {
    const db = this.database.driver;
    const today = isoDay(new Date());
    const since = `${shiftMonth(monthOf(today), -(MONTHS_BACK + 6))}-01`;
    const [limits, rows, categories, accounts, notices] = await Promise.all([
      this.repo.all(),
      this.repo.rows(since),
      db.query<CategoryRow>('SELECT * FROM categories'),
      db.query<AccountRow>('SELECT * FROM accounts'),
      this.repo.notices(),
    ]);
    this.today.set(today);
    this.limits.set(limits);
    this.rows.set(rows);
    this.categories.set(new Map(categories.map(c => [c.id, c])));
    this.accounts.set(accounts);
    this.notices.set(notices);
    this.loaded.set(true);
    this.watch();
  }

  /** The movements of the given categories since `since`, for the form's average. */
  rowsFor(categoryIds: readonly number[], since: string): Promise<SpendRow[]> {
    return this.repo.rows(since, categoryIds);
  }

  monthView(month: string): MonthView {
    const today = this.today();
    const rows = this.rows();
    const categories = this.categories();
    const accounts = this.accounts();
    const limits = this.limits().map(terms => {
      const own = terms.categoryIds.map(id => categories.get(id)).filter((c): c is CategoryRow => !!c);
      return {
        terms,
        status: limitStatus(terms, rows, month, today),
        categories: own,
        name: own.map(c => c.name).join(', '),
        account: terms.accountId === null ? null : accounts.find(a => a.id === terms.accountId) ?? null,
      };
    }).sort((a, b) => b.status.percent - a.status.percent);
    return {
      month,
      limits,
      total: limits.length ? totalStatus(limits.map(l => l.status), month, today) : null,
      passed: limits.filter(l => l.status.state === 'passed'),
      fine: limits.filter(l => l.status.state !== 'passed'),
    };
  }

  view(id: number, month = this.month()): LimitView | null {
    return this.monthView(month).limits.find(l => l.terms.id === id) ?? null;
  }

  async save(id: number | null, input: LimitInput): Promise<number> {
    this.quiet = true;
    const saved = id === null ? await this.repo.create(input) : (await this.repo.update(id, input), id);
    if (this.notices().phone) void this.askPermission();
    this.database.dataChanged();
    return saved;
  }

  async setAmount(id: number, amountMinor: number): Promise<void> {
    this.quiet = true;
    await this.repo.setAmount(id, amountMinor);
    this.database.dataChanged();
  }

  async remove(id: number): Promise<void> {
    this.quiet = true;
    await this.repo.remove(id);
    this.database.dataChanged();
  }

  async setNotice(key: keyof LimitNotices, on: boolean): Promise<void> {
    await this.repo.setNotice(key, on);
    this.notices.update(n => ({ ...n, [key]: on }));
    if (on && key !== 'atSave') void this.askPermission();
  }

  // ------------------------------------------------------------ the notices

  /** Compares this reading with the last one of the same month, and says what went up a level. */
  private watch(): void {
    const view = this.current();
    const at = new Map<number | 'total', Level>(view.limits.map(l => [l.terms.id, levelOf(l.status.spentMinor, l.status.amountMinor)]));
    if (view.total) at.set('total', levelOf(view.total.spentMinor, view.total.amountMinor));
    const spent = new Map<number | 'total', number>(view.limits.map(l => [l.terms.id, l.status.spentMinor]));
    const amounts = new Map<number | 'total', number>(view.limits.map(l => [l.terms.id, l.status.amountMinor]));
    if (view.total) {
      spent.set('total', view.total.spentMinor);
      amounts.set('total', view.total.amountMinor);
    }
    const ids = new Set(view.limits.map(l => l.terms.id));
    const before = this.levels;
    this.levels = { month: view.month, ids, at, spent };
    if (this.quiet) { this.quiet = false; return; }
    if (!before || before.month !== view.month) return;
    // A limit that was not there before is not a crossing, and the total is
    // not either while the set of limits changed: a new limit is not a purchase.
    const known = new Map([...before.at].filter(([key]) => key !== 'total' || sameSet(before.ids, ids)));
    for (const key of ids) if (!before.ids.has(key)) known.delete(key);
    const found = crossings(known, at).filter(c => c.key === 'total' || before.ids.has(c.key as number));
    if (found.length) { this.tell(found, view); return; }
    // Nothing crossed, but a cap already past took more: said at saving only,
    // every time - the phone is told once a month, on the crossing.
    if (!this.notices().atSave) return;
    const knownSpent = new Map([...before.spent].filter(([key]) => known.has(key)));
    const over = stillOver(knownSpent, spent, amounts);
    const limit = view.limits.find(l => over.includes(l.terms.id));
    if (limit) this.alert.set({ kind: 'limit', view: limit, again: true });
    else if (over.includes('total')) this.alert.set({ kind: 'total', month: view, again: true });
  }

  private tell(found: Crossing[], view: MonthView): void {
    const told = readTold();
    const fresh = found.filter(c => !told.has(`${view.month}|${c.key}|${c.level}`));
    if (!fresh.length) return;
    for (const c of fresh) told.add(`${view.month}|${c.key}|${c.level}`);
    saveTold(told, view.month);

    const notices = this.notices();
    const total = fresh.find(c => c.key === 'total');
    const passed = fresh.filter(c => c.key !== 'total' && c.level === 100)
      .map(c => view.limits.find(l => l.terms.id === c.key)!).filter(Boolean);
    const close = fresh.filter(c => c.key !== 'total' && c.level === 80)
      .map(c => view.limits.find(l => l.terms.id === c.key)!).filter(l => l && l.terms.warnAt80);

    if (notices.atSave) {
      if (total) this.alert.set({ kind: 'total', month: view });
      else if (passed.length) this.alert.set({ kind: 'limit', view: passed[0] });
    }
    if (!notices.phone) return;
    const notes: { title: string; body: string }[] = [];
    if (total && view.total) {
      notes.push({
        title: this.i18n.t('plans.notify.total.title'),
        body: this.i18n.t('plans.notify.total.body', { over: this.money(view.total.overMinor), count: view.total.passedCount }),
      });
    }
    for (const l of passed) {
      notes.push({
        title: this.i18n.t('plans.notify.passed.title', { name: l.name }),
        body: this.i18n.t('plans.notify.passed.body', { spent: this.money(l.status.spentMinor), amount: this.money(l.status.amountMinor), over: this.money(l.status.overMinor) }),
      });
    }
    if (notices.at80) {
      for (const l of close) {
        notes.push({
          title: this.i18n.t('plans.notify.close.title', { name: l.name, percent: l.status.percent }),
          body: this.i18n.t('plans.notify.close.body', { left: this.money(l.status.remainingMinor), count: l.status.daysLeft }),
        });
      }
    }
    if (notes.length) void this.notify(notes);
  }

  private money(minor: number): string {
    return formatMoney(minor, 'COP', { withSymbol: false });
  }

  private async askPermission(): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) return false;
    try {
      const now = await LocalNotifications.checkPermissions();
      if (now.display === 'granted') return true;
      return (await LocalNotifications.requestPermissions()).display === 'granted';
    } catch {
      return false;
    }
  }

  /** The phone's own notification, local: no internet, no server. */
  private async notify(notes: { title: string; body: string }[]): Promise<void> {
    if (!(await this.askPermission())) return;
    const base = Math.floor(Date.now() / 1000) % 1_000_000_000;
    try {
      await LocalNotifications.schedule({
        notifications: notes.map((note, i) => ({ id: base + i, title: note.title, body: note.body })),
      });
    } catch {
      // A phone that refuses is told nothing; the red cards still say it.
    }
  }
}

function sameSet(a: Set<number>, b: Set<number>): boolean {
  return a.size === b.size && [...a].every(x => b.has(x));
}
