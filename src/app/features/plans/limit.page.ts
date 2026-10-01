/**
 * One limit's page (mockups `14e`, `14k`).
 *
 * What is spent of it this month and the pace, red when it went over and
 * with the movement that took it over; the months before against the limit;
 * a figure for next month from the average of the last three, with "Usar"
 * (Jose asked for it not to be forgotten); and the movements that count.
 */

import { Component, computed, inject, signal } from '@angular/core';
import { Location } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { IonContent, IonIcon, IonModal } from '@ionic/angular';

import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { roundedLimit, shiftMonth } from '../../core/limits/limits';
import { LimitsService, MONTHS_BACK } from '../../core/limits/limits.service';
import { fromIsoDay } from '../../core/filters/period';
import { BadgeComponent } from '../../shared/ui/badge.component';
import { LimitBarComponent } from '../../shared/ui/limit-bar.component';
import { ConfirmComponent } from '../../shared/confirm/confirm.component';
import { LimitEditorComponent } from './limit-editor.component';
import { lineOf, longDay, monthLabel, plain, ratio, shortDay } from './plans-words';

@Component({
  selector: 'app-limit',
  templateUrl: './limit.page.html',
  styleUrls: ['./limit.page.scss'],
  imports: [TranslatePipe, BadgeComponent, LimitBarComponent, LimitEditorComponent, ConfirmComponent, IonContent, IonIcon, IonModal],
})
export class LimitPage {
  readonly limits = inject(LimitsService);
  private readonly route = inject(ActivatedRoute);
  private readonly location = inject(Location);
  private readonly i18n = inject(I18nService);

  private readonly id = Number(this.route.snapshot.paramMap.get('id'));
  readonly editing = signal(false);
  readonly deleting = signal(false);

  readonly view = computed(() => this.limits.monthView(this.limits.month()).limits.find(l => l.terms.id === this.id) ?? null);
  readonly s = computed(() => this.view()?.status ?? null);
  readonly label = computed(() => monthLabel(this.limits.month(), this.i18n));
  readonly atNewest = computed(() => this.limits.month() >= this.limits.thisMonth());
  readonly atOldest = computed(() => this.limits.month() <= shiftMonth(this.limits.thisMonth(), -MONTHS_BACK));
  readonly current = computed(() => this.limits.month() === this.limits.thisMonth());

  readonly sub = computed(() => {
    const v = this.view();
    if (!v) return '';
    return this.i18n.t('plans.page.sub', { amount: plain(v.terms.amountMinor), scope: v.account?.name ?? this.i18n.t('ui.allAccounts') });
  });

  /** The bars of the six months, each against the tallest of them or the limit. */
  readonly bars = computed(() => {
    const s = this.s();
    if (!s) return [];
    const top = Math.max(s.amountMinor, ...s.history.map(h => h.spentMinor)) || 1;
    return s.history.map(h => ({
      label: fromIsoDay(`${h.month}-01`).toLocaleDateString(this.i18n.dateLocale(), { month: 'short' }).replace('.', ''),
      height: Math.round((h.spentMinor / top) * 100),
      over: h.spentMinor > s.amountMinor,
      spent: h.spentMinor,
    }));
  });
  readonly lineAt = computed(() => {
    const s = this.s();
    if (!s) return 0;
    const top = Math.max(s.amountMinor, ...s.history.map(h => h.spentMinor)) || 1;
    return Math.round((s.amountMinor / top) * 100);
  });
  /** The latest month of the six that went over, said under the chart. */
  readonly lastOver = computed(() => {
    const s = this.s();
    if (!s) return null;
    const over = [...s.history].reverse().find(h => h.spentMinor > s.amountMinor && h.month !== this.limits.month());
    return over ? { month: monthLabel(over.month, this.i18n).split(' ')[0].toLowerCase(), by: plain(over.spentMinor - s.amountMinor) } : null;
  });

  /** A figure for next month, from the average of the last three, when it says something. */
  readonly suggestion = computed(() => {
    const s = this.s();
    if (!s || s.averageMinor === null || !this.current()) return null;
    const figure = roundedLimit(s.averageMinor);
    if (figure === s.amountMinor) return null;
    if (s.state !== 'passed' && s.averageMinor <= s.amountMinor) return null;
    return { average: s.averageMinor, figure };
  });

  back(): void {
    this.location.back();
  }

  step(by: number): void {
    this.limits.month.update(month => shiftMonth(month, by));
  }

  async use(figure: number): Promise<void> {
    await this.limits.setAmount(this.id, figure);
  }

  async remove(): Promise<void> {
    this.deleting.set(false);
    await this.limits.remove(this.id);
    this.location.back();
  }

  money = plain;
  ratio = ratio;

  line(): string {
    const s = this.s();
    return s ? lineOf(s, this.i18n) : '';
  }

  short(iso: string): string {
    return shortDay(iso, this.i18n);
  }

  long(iso: string): string {
    return longDay(iso, this.i18n);
  }

  accountName(id: number): string {
    return this.limits.accounts().find(a => a.id === id)?.name ?? '';
  }
}
