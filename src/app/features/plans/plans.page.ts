/**
 * Planes (plans, part 3; mockups `14b`, `14c`, `14g`, `14l`, `14p`).
 *
 * Its two faces are Límites and Metas; goals come in the next step. The
 * limits of the month on view: every limit together on top - or, red, the
 * one that went over, or the total when that is what went over - then each
 * limit, those that went over first and each in its own red card. The bell
 * opens Avisos, where each notice is turned off and back on.
 */

import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { Location, NgTemplateOutlet } from '@angular/common';
import { Router } from '@angular/router';
import { IonContent, IonIcon, IonModal, IonSpinner } from '@ionic/angular';

import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { FilterService } from '../../core/filters/filter.service';
import { fromIsoDay, periodContaining } from '../../core/filters/period';
import { averageBefore, shiftMonth, type SpendRow } from '../../core/limits/limits';
import { LimitsService, MONTHS_BACK, type LimitView } from '../../core/limits/limits.service';
import type { LimitNotices } from '../../core/limits/limits.repository';
import type { CategoryRow } from '../../core/database/types';
import { BadgeComponent } from '../../shared/ui/badge.component';
import { LimitBarComponent } from '../../shared/ui/limit-bar.component';
import { LimitEditorComponent } from './limit-editor.component';
import { lineOf, monthLabel, plain, ratio, shortDay, toneOf } from './plans-words';

@Component({
  selector: 'app-plans',
  templateUrl: './plans.page.html',
  styleUrls: ['./plans.page.scss'],
  imports: [TranslatePipe, NgTemplateOutlet, BadgeComponent, LimitBarComponent, LimitEditorComponent, IonContent, IonIcon, IonModal, IonSpinner],
})
export class PlansPage {
  readonly limits = inject(LimitsService);
  private readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly filter = inject(FilterService);

  readonly face = signal<'limits' | 'goals'>('limits');
  readonly avisos = signal(false);
  /** The editor: null closed, 0 a new limit, otherwise that limit. */
  readonly editing = signal<number | null>(null);
  /** A new limit started on a category of "Donde más gastas". */
  readonly startOn = signal<number | null>(null);

  readonly view = this.limits.viewed;
  readonly label = computed(() => monthLabel(this.limits.month(), this.i18n));
  readonly atNewest = computed(() => this.limits.month() >= this.limits.thisMonth());
  readonly atOldest = computed(() => this.limits.month() <= shiftMonth(this.limits.thisMonth(), -MONTHS_BACK));

  /** The red card on top when only limits went over, not the total: the one that went over most. */
  readonly worst = computed<LimitView | null>(() =>
    [...this.view().passed].sort((a, b) => b.status.overMinor - a.status.overMinor)[0] ?? null);
  readonly overSum = computed(() => this.view().passed.reduce((sum, l) => sum + l.status.overMinor, 0));

  /** Where the money goes most, for a first limit: three months' average, three categories. */
  readonly most = signal<{ category: CategoryRow; averageMinor: number }[]>([]);

  constructor() {
    this.limits.month.set(this.limits.thisMonth());
    effect(() => {
      if (!this.limits.loaded() || this.limits.limits().length > 0) return;
      this.limits.categories();
      void untracked(() => this.loadMost());
    });
  }

  private async loadMost(): Promise<void> {
    const today = this.limits.today();
    const expense = [...this.limits.categories().values()].filter(c => c.kind === 'expense' && !c.archived);
    const rows = await this.limits.rowsFor(expense.map(c => c.id), `${shiftMonth(today.slice(0, 7), -3)}-01`);
    const byCategory = new Map<number, SpendRow[]>();
    for (const row of rows) {
      if (!row.inNetWorth) continue;
      byCategory.set(row.categoryId, [...(byCategory.get(row.categoryId) ?? []), row]);
    }
    this.most.set(expense
      .map(category => ({ category, averageMinor: averageBefore(byCategory.get(category.id) ?? [], today) ?? 0 }))
      .filter(m => m.averageMinor > 0)
      .sort((a, b) => b.averageMinor - a.averageMinor)
      .slice(0, 3));
  }

  back(): void {
    this.location.back();
  }

  step(by: number): void {
    this.limits.month.update(month => shiftMonth(month, by));
  }

  open(view: LimitView): void {
    void this.router.navigateByUrl(`/plans/${view.terms.id}`);
  }

  newLimit(categoryId: number | null = null): void {
    this.startOn.set(categoryId);
    this.editing.set(0);
  }

  /** The total went over: Inicio on that month, by category. */
  seeWhere(): void {
    this.filter.selectAccount(null);
    this.filter.period.set(periodContaining('month', fromIsoDay(`${this.limits.month()}-01`)));
    this.filter.setView('category');
    this.filter.showList.set(true);
    void this.router.navigateByUrl('/movements');
  }

  setNotice(key: keyof LimitNotices): void {
    void this.limits.setNotice(key, !this.limits.notices()[key]);
  }

  money = plain;
  ratio = ratio;
  tone = toneOf;

  line(view: LimitView): string {
    return lineOf(view.status, this.i18n);
  }

  since(view: LimitView): string {
    return view.status.passedWith ? shortDay(view.status.passedWith.occurredOn, this.i18n) : '';
  }

  /** What one limit or every limit covers: "todas las cuentas" or the one. */
  scope(view: LimitView): string {
    return view.account ? view.account.name : this.i18n.t('ui.allAccounts');
  }
}
