/**
 * The goals as every screen sees them, read once per change of the data
 * (plans, part 3, step 2; mockups `15a`-`15m`).
 *
 * Presupuestos' Metas, a goal's page, Más and Inicio read this one service.
 * A goal reached is marked the first time it is seen reached, and stays so.
 */

import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';

import { DatabaseService } from '../database/database.service';
import type { AccountRow } from '../database/types';
import type { YieldProduct } from '../database/repositories/yields.repository';
import { YieldsRepository } from '../database/repositories/yields.repository';
import { isoDay } from '../filters/period';
import { monthOf, shiftMonth } from '../limits/limits';
import { emergencyAmount, goalStatus, monthlySpend, type GoalPlace, type GoalStatus, type GoalTerms } from './goals';
import { GoalsRepository, inPesos, placeKey, savedOn, type GoalInput } from './goals.repository';

export interface PlaceView {
  place: GoalPlace;
  account: AccountRow | null;
  product: YieldProduct | null;
  /** What it counts for the goal today, in pesos. */
  pesos: number;
}

export interface GoalView {
  terms: GoalTerms;
  status: GoalStatus;
  places: PlaceView[];
}

/** The same day `by` months away, clamped to the month's end. */
function shiftDay(day: string, by: number): string {
  const month = shiftMonth(monthOf(day), by);
  const [y, m] = month.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${month}-${String(Math.min(Number(day.slice(8, 10)), last)).padStart(2, '0')}`;
}

@Injectable({ providedIn: 'root' })
export class GoalsService {
  private readonly database = inject(DatabaseService);

  readonly goals = signal<GoalView[]>([]);
  readonly accounts = signal<AccountRow[]>([]);
  readonly products = signal<YieldProduct[]>([]);
  readonly loaded = signal(false);
  readonly today = signal(isoDay(new Date()));
  /** What is spent a month, for an emergency fund. */
  readonly monthlySpendMinor = signal(0);

  readonly live = computed(() => this.goals().filter(g => !g.terms.archived));
  readonly inCourse = computed(() => this.live().filter(g => g.status.state !== 'reached')
    .sort((a, b) => order(a) - order(b)));
  readonly reached = computed(() => this.live().filter(g => g.status.state === 'reached'));
  readonly late = computed(() => this.inCourse().filter(g => g.status.state === 'late'));
  readonly totals = computed(() => this.inCourse().reduce(
    (sum, g) => ({ saved: sum.saved + g.status.savedMinor, amount: sum.amount + g.terms.amountMinor }), { saved: 0, amount: 0 }));

  /** Places another goal holds: account and product, by goal. */
  readonly taken = computed(() => new Map(this.goals().flatMap(g => g.terms.places.map(p => [placeKey(p.accountId, p.productId), g.terms] as const))));
  readonly allAccountsGoal = computed(() => this.goals().find(g => g.terms.allAccounts && !g.terms.archived)?.terms ?? null);

  constructor() {
    effect(() => {
      this.database.dataVersion();
      if (this.database.status() !== 'ready') return;
      void untracked(() => this.load());
    });
  }

  private get repo(): GoalsRepository {
    return new GoalsRepository(this.database.driver);
  }

  async load(): Promise<void> {
    const db = this.database.driver;
    const today = isoDay(new Date());
    const repo = this.repo;
    const [terms, accounts, products, rates, spend, loans] = await Promise.all([
      repo.all(),
      db.query<AccountRow>('SELECT * FROM accounts'),
      new YieldsRepository(db).allProducts(),
      repo.rates(today),
      repo.spendRows(`${shiftMonth(monthOf(today), -6)}-01`),
      db.query<{ account_id: number }>('SELECT account_id FROM loans'),
    ]);
    this.loans = new Set(loans.map(l => l.account_id));
    const now = await savedOn(repo, terms, today, rates);
    const before = await savedOn(repo, terms, shiftDay(today, -3), rates);

    const views: GoalView[] = [];
    for (const goal of terms) {
      const status = goalStatus(goal, now.saved.get(goal.id) ?? 0, before.saved.get(goal.id) ?? 0, today);
      if (status.state === 'reached' && goal.reachedOn === null && !goal.archived) {
        // Reached for the first time: kept, so using the money later does not undo it.
        await repo.setReached(goal.id, today);
        goal.reachedOn = today;
      }
      views.push({
        terms: goal,
        status,
        places: goal.places.map(place => ({
          place,
          account: accounts.find(a => a.id === place.accountId) ?? null,
          product: place.productId === null ? null : products.find(p => p.id === place.productId) ?? null,
          pesos: now.byPlace.get(placeKey(place.accountId, place.productId)) ?? 0,
        })),
      });
    }
    this.today.set(today);
    this.accounts.set(accounts);
    this.products.set(products);
    this.monthlySpendMinor.set(monthlySpend(spend, today));
    this.goals.set(views);
    this.loaded.set(true);
  }

  view(id: number): GoalView | null {
    return this.goals().find(g => g.terms.id === id) ?? null;
  }

  /** What an emergency fund of so many months would be today. */
  emergencyFor(months: number): number {
    return emergencyAmount(this.monthlySpendMinor(), months);
  }

  /** What the goal had at the close of each of the last six months, and today. */
  async history(goal: GoalTerms): Promise<{ month: string; savedMinor: number }[]> {
    const repo = this.repo;
    const today = this.today();
    const rates = await repo.rates(today);
    const all = this.goals().map(g => g.terms);
    const out: { month: string; savedMinor: number }[] = [];
    for (let back = 5; back >= 1; back--) {
      const month = shiftMonth(monthOf(today), -back);
      const [y, m] = month.split('-').map(Number);
      const end = `${month}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, '0')}`;
      out.push({ month, savedMinor: Math.max(0, (await savedOn(repo, all, end, rates)).saved.get(goal.id) ?? 0) });
    }
    out.push({ month: monthOf(today), savedMinor: this.view(goal.id)?.status.savedMinor ?? 0 });
    return out;
  }

  /**
   * Every place a goal could use, with what it holds today: the live accounts
   * that are not a card or a loan, and their products. For the editor's list.
   */
  async places(): Promise<{ accountId: number; productId: number | null; nativeMinor: number; pesos: number | null }[]> {
    const repo = this.repo;
    const today = this.today();
    const facts = await repo.accountFacts();
    const usable = this.accounts().filter(a => !a.archived && a.type !== 'credit' && facts.has(a.id) && !this.isLoan(a.id));
    const keys = [
      ...usable.map(a => ({ accountId: a.id, productId: null as number | null })),
      ...this.products().filter(p => usable.some(a => a.id === p.account_id)).map(p => ({ accountId: p.account_id, productId: p.id as number | null })),
    ];
    const [holds, rates] = await Promise.all([repo.holdsOn(keys, today), repo.rates(today)]);
    return keys.map(k => {
      const nativeMinor = holds.get(placeKey(k.accountId, k.productId)) ?? 0;
      const currency = facts.get(k.accountId)?.currency ?? 'COP';
      return { ...k, nativeMinor, pesos: inPesos(nativeMinor, currency, rates) };
    });
  }

  /** "Todas tus cuentas" today: what the counted accounts hold, and what each other goal takes off it. */
  async allAccountsNow(exceptId: number | null): Promise<{ everything: number; others: { name: string; pesos: number }[] }> {
    const repo = this.repo;
    const today = this.today();
    const rates = await repo.rates(today);
    const facts = await repo.accountFacts();
    const all = await repo.allAccountsOn(today);
    let everything = 0;
    for (const [id, minor] of all) everything += inPesos(minor, facts.get(id)!.currency, rates) ?? 0;
    const others = this.live().filter(g => g.terms.id !== exceptId && !g.terms.allAccounts)
      .map(g => ({ name: g.terms.name, pesos: g.places.filter(p => all.has(p.place.accountId)).reduce((sum, p) => sum + Math.max(0, p.pesos), 0) }))
      .filter(o => o.pesos > 0);
    return { everything, others };
  }

  private loans = new Set<number>();
  isLoan(accountId: number): boolean {
    return this.loans.has(accountId);
  }

  async save(id: number | null, input: GoalInput): Promise<number> {
    const today = this.today();
    const saved = id === null ? await this.repo.create(input, today) : (await this.repo.update(id, input, today), id);
    this.database.dataChanged();
    return saved;
  }

  async setAmount(id: number, amountMinor: number): Promise<void> {
    await this.repo.setAmount(id, amountMinor);
    this.database.dataChanged();
  }

  async setDueMonth(id: number, month: string | null): Promise<void> {
    await this.repo.setDueMonth(id, month);
    this.database.dataChanged();
  }

  async setArchived(id: number, archived: boolean): Promise<void> {
    await this.repo.setArchived(id, archived);
    this.database.dataChanged();
  }

  async remove(id: number): Promise<void> {
    await this.repo.remove(id);
    this.database.dataChanged();
  }
}

/** Late first, then those with a date, nearest first, then the rest. */
function order(g: GoalView): number {
  if (g.status.state === 'late') return 0;
  if (g.terms.dueMonth) return 1 + Number(g.terms.dueMonth.replace('-', '')) / 1e6;
  return 3;
}
