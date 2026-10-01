/**
 * One goal's page (mockups `15h`-`15k`).
 *
 * What it has of its figure and what each month needs; the person's own pace
 * and where it lands; where the money sits, place by place; how it grew over
 * the last months against the target; and the ways forward - pay in (the one
 * transfer form, already pointed at the goal), move the date when it is late,
 * archive it once reached. Nothing here moves money by itself.
 */

import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { Location } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { IonContent, IonIcon, IonModal } from '@ionic/angular';

import { DatabaseService } from '../../core/database/database.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { fromIsoDay } from '../../core/filters/period';
import { GoalsService, type PlaceView } from '../../core/goals/goals.service';
import { usualPayer } from '../../core/cards/card-data';
import { ComposeService } from '../../core/ui/compose.service';
import { BadgeComponent } from '../../shared/ui/badge.component';
import { ConfirmComponent } from '../../shared/confirm/confirm.component';
import { GoalEditorComponent } from './goal-editor.component';
import { goalLine, placeName, placesLine } from './goal-words';
import { longDay, monthLabel, plain } from './plans-words';

@Component({
  selector: 'app-goal',
  templateUrl: './goal.page.html',
  styleUrls: ['./limit.page.scss', './goal.page.scss'],
  imports: [TranslatePipe, BadgeComponent, ConfirmComponent, GoalEditorComponent, IonContent, IonIcon, IonModal],
})
export class GoalPage {
  readonly goals = inject(GoalsService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly i18n = inject(I18nService);
  private readonly compose = inject(ComposeService);
  private readonly database = inject(DatabaseService);

  private readonly id = Number(this.route.snapshot.paramMap.get('id'));
  readonly editing = signal(false);
  readonly deleting = signal(false);
  readonly history = signal<{ month: string; savedMinor: number }[]>([]);

  readonly view = computed(() => this.goals.view(this.id));
  readonly s = computed(() => this.view()?.status ?? null);

  readonly sub = computed(() => {
    const v = this.view();
    return v ? placesLine(v.places, v.terms.allAccounts, this.i18n) : '';
  });

  readonly line = computed(() => {
    const v = this.view();
    return v ? goalLine(v.status, v.terms.dueMonth, v.terms.kind === 'emergency' ? v.terms.months : null, this.i18n, false) : '';
  });

  /** "A tu ritmo llegas en mayo de 2027", or that it does not grow. */
  readonly paceTitle = computed(() => {
    const s = this.s();
    if (!s) return '';
    return s.arrivalMonth ? this.i18n.t('goals.page.arrives', { month: monthLabel(s.arrivalMonth, this.i18n).toLowerCase() })
      : this.i18n.t(s.tooSlow ? 'goals.page.tooSlow' : 'goals.page.noPace');
  });

  /** An emergency fund whose spending moved: the figure it would be today. */
  readonly refresh = computed(() => {
    const v = this.view();
    if (!v || v.terms.kind !== 'emergency' || !v.terms.months) return null;
    const now = this.goals.emergencyFor(v.terms.months);
    return now > 0 && Math.abs(now - v.terms.amountMinor) * 20 > v.terms.amountMinor ? now : null;
  });

  readonly bars = computed(() => {
    const v = this.view();
    const h = this.history();
    if (!v || h.length === 0) return [];
    const top = Math.max(v.terms.amountMinor, ...h.map(x => x.savedMinor)) || 1;
    return h.map((x, i) => ({
      label: fromIsoDay(`${x.month}-01`).toLocaleDateString(this.i18n.dateLocale(), { month: 'short' }).replace('.', ''),
      height: Math.round((x.savedMinor / top) * 100),
      now: i === h.length - 1,
      saved: x.savedMinor,
    }));
  });
  readonly lineAt = computed(() => {
    const v = this.view();
    const h = this.history();
    if (!v) return 0;
    const top = Math.max(v.terms.amountMinor, ...h.map(x => x.savedMinor)) || 1;
    return Math.round((v.terms.amountMinor / top) * 100);
  });

  constructor() {
    effect(() => {
      const v = this.view();
      if (!v) return;
      untracked(() => void this.goals.history(v.terms).then(h => this.history.set(h)));
    });
  }

  back(): void {
    this.location.back();
  }

  money = plain;
  placeName = placeName;

  long(iso: string | null): string {
    return iso ? longDay(iso, this.i18n) : '';
  }

  monthLabelOf(month: string): string {
    return monthLabel(month, this.i18n).toLowerCase();
  }

  share(p: PlaceView): number {
    const total = this.s()?.savedMinor ?? 0;
    return total > 0 ? Math.round((Math.max(0, p.pesos) / total) * 100) : 0;
  }

  /**
   * Aportar: the one transfer form, into the place that holds most of the goal,
   * from the account that usually feeds it, with what this month needs.
   */
  async payIn(): Promise<void> {
    const v = this.view();
    if (!v) return;
    const s = v.status;
    const amountMinor = s.neededPerMonthMinor ?? 0;
    const start = { amountMinor, onDate: this.goals.today(), note: '' };
    const target = [...v.places].sort((a, b) => b.pesos - a.pesos)[0];
    if (!target) {
      this.compose.open('transfer', { start });
      return;
    }
    const from = await usualPayer(this.database.driver, target.place.accountId);
    if (from !== null) {
      this.compose.open('transfer', { start, route: { from, to: target.place.accountId, toProductId: target.place.productId } });
    } else if (target.place.productId !== null) {
      // Money moved between the account's own products.
      this.compose.open('transfer', { start, route: { from: target.place.accountId, to: target.place.accountId, toProductId: target.place.productId } });
    } else {
      this.compose.open('transfer', { start, preferredAccountId: target.place.accountId, preferredSide: 'to' });
    }
  }

  moveDate(): void {
    const s = this.s();
    if (s?.arrivalMonth) void this.goals.setDueMonth(this.id, s.arrivalMonth);
  }

  useRefresh(): void {
    const now = this.refresh();
    if (now) void this.goals.setAmount(this.id, now);
  }

  async archive(): Promise<void> {
    await this.goals.setArchived(this.id, !this.view()?.terms.archived);
    this.back();
  }

  newGoal(): void {
    void this.router.navigateByUrl('/plans?face=goals&new=1');
  }

  async remove(): Promise<void> {
    this.deleting.set(false);
    await this.goals.remove(this.id);
    this.back();
  }
}
