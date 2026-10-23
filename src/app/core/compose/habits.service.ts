/**
 * What the person registers most, read once and shown in two places: the
 * "+" ("Pagos fijos y frecuentes") and the assistant's bulb and welcome
 * (Jose, 2026-10-23, mockups `42a`-`42f`). One definition, so the two never
 * disagree: the habits come from `habitsOf`, the words of a row from here,
 * and a tap opens the one movement form filled in (nothing saved by itself,
 * rule 22).
 *
 * What the person pins on top or hides is kept in `settings` under
 * `habits.choice`, so it travels in the backup.
 */
import { Injectable, inject, signal } from '@angular/core';

import { DatabaseService } from '../database/database.service';
import { AccountsRepository } from '../database/repositories/accounts.repository';
import { CategoriesRepository } from '../database/repositories/categories.repository';
import type { AccountRow, CategoryRow } from '../database/types';
import { formatMoney } from '../database/money';
import { isoDay } from '../filters/period';
import { I18nService } from '../i18n/i18n.service';
import { ComposeService } from '../ui/compose.service';
import { habitsOf, pinOf, WINDOW_DAYS, type Frequent, type Habits, type PinnedHabit } from './frequent';
import { pastMovements } from './frequent-data';

const CHOICE_KEY = 'habits.choice';
/** As many habits as "Ver los N" ever lists. */
const ALL = 30;

interface Choice {
  pins: PinnedHabit[];
  hidden: string[];
}

@Injectable({ providedIn: 'root' })
export class HabitsService {
  private readonly database = inject(DatabaseService);
  private readonly compose = inject(ComposeService);
  private readonly i18n = inject(I18nService);

  /** The habit whose options are open (long press, mockup 42f; `app-habit-options`). */
  readonly options = signal<Frequent | null>(null);

  private accounts = new Map<number, AccountRow>();
  private categories = new Map<number, CategoryRow>();
  private products = new Map<number, string>();

  /**
   * The habits up to today: the pinned, then the rest (at most `shown`),
   * leaving out the fixed payments in `skip` (the "+" lists them above).
   */
  async read(options: { skip?: ReadonlySet<string>; shown?: number } = {}): Promise<Habits & { all: Frequent[] }> {
    const db = this.database.driver;
    const today = isoDay(new Date());
    const [accounts, categories, products, past, choice] = await Promise.all([
      new AccountsRepository(db).list(), new CategoriesRepository(db).list({ includeArchived: true }),
      db.query<{ id: number; name: string }>('SELECT id, name FROM products'), pastMovements(db, today), this.choice(),
    ]);
    this.accounts = new Map(accounts.map(a => [a.id, a]));
    this.categories = new Map(categories.map(c => [c.id, c]));
    this.products = new Map(products.map(p => [p.id, p.name]));
    const live = new Set(accounts.map(a => a.id));
    const alive = (accountId: number | null) => accountId === null || live.has(accountId);
    const pins = choice.pins.filter(p => alive(p.accountId) && alive(p.toAccountId));
    const rows = past.filter(m => live.has(m.accountId) && alive(m.toAccountId ?? null));
    const common = { skip: options.skip, pins, hidden: new Set(choice.hidden) };
    const shown = habitsOf(rows, today, { ...common, shown: options.shown });
    // Every habit, for "Ver los N" (most used first, no mix of kinds needed).
    const all = habitsOf(rows, today, { ...common, shown: ALL }).frequent;
    return { ...shown, all };
  }

  category(f: Frequent): CategoryRow | undefined {
    return f.categoryId !== null ? this.categories.get(f.categoryId) : undefined;
  }

  /**
   * "Bolsillo Viajes → Cuenta principal" between two products of one account,
   * "Banco Azul → Tarjeta Coral" between two accounts, "Mercado · Tarjeta
   * Coral" for a spending or an income.
   */
  title(f: Frequent): string {
    const account = this.accounts.get(f.accountId)?.name ?? '';
    if (f.kind === 'transfer') {
      if (f.toAccountId === f.accountId) {
        const from = this.products.get(f.productId ?? -1);
        const to = this.products.get(f.toProductId ?? -1);
        if (from && to) return `${from} → ${to}`;
      }
      return `${account} → ${this.accounts.get(f.toAccountId ?? -1)?.name ?? ''}`;
    }
    return [this.category(f)?.name, account].filter(Boolean).join(' · ');
  }

  /** One short line under a row: "Gasto · «Almuerzo» · 22 veces", "Cajita Naranja · «Retiro» · 18 veces". */
  shortLine(f: Frequent): string {
    const kind = f.kind === 'transfer' && f.toAccountId === f.accountId
      ? this.accounts.get(f.accountId)?.name ?? ''
      : f.kind === 'transfer' ? this.i18n.t('plus.frequent.transfer')
      : this.i18n.t(f.kind === 'income' ? 'plus.frequent.income' : 'plus.frequent.expense');
    const note = f.note ? `«${f.note}»` : f.loose ? this.i18n.t('habit.notes') : '';
    const uses = f.uses === 0 ? this.i18n.t('habit.pinnedOnly')
      : this.i18n.t(f.uses === 1 ? 'habit.times.one' : 'habit.times', { count: f.uses });
    return [kind, note, uses].filter(Boolean).join(' · ');
  }

  /** "«Almuerzo» · 22 veces en 3 meses", "Notas distintas · 14 veces en 3 meses". */
  noteLine(f: Frequent): string {
    const note = f.note ? `«${f.note}»` : f.loose ? this.i18n.t('habit.notes') : '';
    const months = Math.round(WINDOW_DAYS / 30);
    const uses = f.uses === 0
      ? this.i18n.t('habit.unused', { months })
      : this.i18n.t(f.uses === 1 ? 'habit.uses.one' : 'habit.uses', { count: f.uses, months });
    return [note, uses].filter(Boolean).join(' · ');
  }

  amount(f: Frequent): string {
    return formatMoney(f.amountMinor ?? 0, this.accounts.get(f.accountId)?.currency_code ?? 'COP');
  }

  /** The one form, filled in as it was the last times; saved only by the person. */
  open(f: Frequent): void {
    const start = {
      amountMinor: f.amountMinor ?? 0, onDate: isoDay(new Date()), note: f.note,
      // The last amounts only when the amount is not filled in already.
      amounts: f.amountMinor === null ? f.lastAmounts : [], notes: f.otherNotes,
    };
    if (f.kind === 'transfer') {
      this.compose.open('transfer', {
        route: { from: f.accountId, to: f.toAccountId ?? f.accountId, fromProductId: f.productId, toProductId: f.toProductId },
        start,
      });
      return;
    }
    this.compose.open(f.kind, {
      preferredAccountId: f.accountId,
      start: { ...start, categoryId: f.categoryId, productId: f.productId },
    });
  }

  async pin(f: Frequent): Promise<void> {
    const choice = await this.choice();
    if (!choice.pins.some(p => p.key === f.key)) choice.pins.push(pinOf(f));
    choice.hidden = choice.hidden.filter(k => k !== f.key);
    await this.keep(choice);
  }

  async unpin(f: Frequent): Promise<void> {
    const choice = await this.choice();
    choice.pins = choice.pins.filter(p => p.key !== f.key);
    await this.keep(choice);
  }

  /** "No mostrarlo aquí": the movements stay, the habit is not offered again. */
  async hide(f: Frequent): Promise<void> {
    const choice = await this.choice();
    choice.pins = choice.pins.filter(p => p.key !== f.key);
    if (!choice.hidden.includes(f.key)) choice.hidden.push(f.key);
    await this.keep(choice);
  }

  /** "Deshacer" after hiding it. */
  async unhide(f: Frequent): Promise<void> {
    const choice = await this.choice();
    choice.hidden = choice.hidden.filter(k => k !== f.key);
    await this.keep(choice);
  }

  private async choice(): Promise<Choice> {
    const row = await this.database.driver.queryOne<{ value: string }>('SELECT value FROM settings WHERE key = ?', [CHOICE_KEY]);
    try {
      const parsed = row ? (JSON.parse(row.value) as Partial<Choice>) : {};
      return { pins: parsed.pins ?? [], hidden: parsed.hidden ?? [] };
    } catch {
      return { pins: [], hidden: [] };
    }
  }

  private async keep(choice: Choice): Promise<void> {
    await this.database.driver.run(
      `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      [CHOICE_KEY, JSON.stringify(choice), new Date().toISOString()]);
    this.database.dataChanged();
  }
}
