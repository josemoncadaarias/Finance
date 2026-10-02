/**
 * What Inicio says about the month's limits, and only when something needs
 * attention (mockups `14f`, `14i`, `14m`): the total gone over, or each limit
 * gone over, as a red card on top; a limit from 80 % as one quiet row.
 * Nothing at all while every limit goes well. A goal behind its date is one
 * row too.
 *
 * Every card and row says what it IS on a small line of its own - a spending
 * cap, a savings goal - and caps and goals sit in separate lists: "Remodelar
 * la cocina va atrasada" beside "Restaurante va en 96 %" read as the same
 * kind of thing (Jose, 2026-10-02).
 */

import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { IonIcon } from '@ionic/angular';

import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { I18nService } from '../../core/i18n/i18n.service';
import { LimitsService, type LimitView } from '../../core/limits/limits.service';
import { GoalsService, type GoalView } from '../../core/goals/goals.service';
import { BadgeComponent } from '../../shared/ui/badge.component';
import { LimitBarComponent } from '../../shared/ui/limit-bar.component';
import { plain, ratio } from './plans-words';

@Component({
  selector: 'app-limits-home',
  standalone: true,
  imports: [TranslatePipe, BadgeComponent, LimitBarComponent, IonIcon],
  template: `
    @let v = limits.current();
    @if (v.total && v.total.state === 'passed') {
      <button type="button" class="ui-hero red" (click)="go('/plans')">
        <span class="top">
          <span class="warn"><ion-icon name="warning-outline"></ion-icon></span>
          <span class="ui-tx">
            <span class="kind cap">{{ 'home.kind.capsTotal' | t }}</span>
            <b class="wrap">{{ 'plans.total.passed.label' | t }}</b>
            <small class="wrap"><span class="ui-r strong">{{ 'plans.overBy' | t:{ amount: money(v.total.overMinor) } }}</span> · {{ 'plans.home.passedCount' | t:{ count: v.total.passedCount } }}</small>
          </span>
          <ion-icon class="ui-chev" name="chevron-forward-outline"></ion-icon>
        </span>
        <app-limit-bar [percent]="ratio(v.total)" state="passed"></app-limit-bar>
      </button>
    } @else {
      @for (l of v.passed; track l.terms.id) {
        <button type="button" class="ui-hero red" (click)="open(l)">
          <span class="top">
            <app-badge [size]="44" [builtin]="l.categories[0]?.builtin_icon" [customId]="l.categories[0]?.custom_icon_id"
                       [tone]="l.categories[0]?.color" [seed]="l.categories[0]?.id"></app-badge>
            <span class="ui-tx">
              <span class="kind cap">{{ 'home.kind.capPassed' | t }}</span>
              <b class="wrap">{{ 'plans.home.passed' | t:{ name: l.name } }}</b>
              <small class="wrap"><span class="ui-r strong">{{ 'plans.overBy' | t:{ amount: money(l.status.overMinor) } }}</span>@if (l.status.daysLeft > 0) { · {{ 'plans.home.daysLeft' | t:{ count: l.status.daysLeft } }} }</small>
            </span>
            <ion-icon class="ui-chev" name="chevron-forward-outline"></ion-icon>
          </span>
          <app-limit-bar [percent]="ratio(l.status)" state="passed"></app-limit-bar>
        </button>
      }
    }
    @if (close().length > 0) {
      <div class="ui-list">
        @for (l of close(); track l.terms.id) {
          <button type="button" class="ui-row" (click)="open(l)">
            <app-badge [size]="40" [builtin]="l.categories[0]?.builtin_icon" [customId]="l.categories[0]?.custom_icon_id"
                       [tone]="l.categories[0]?.color" [seed]="l.categories[0]?.id"></app-badge>
            <span class="ui-tx">
              <span class="kind cap">{{ 'home.kind.cap' | t }}</span>
              <b class="ui-one">{{ l.name }}</b>
              <small class="wrap">{{ 'plans.home.closeLine' | t:{ percent: l.status.percent, left: money(l.status.remainingMinor), count: l.status.daysLeft } }}</small>
            </span>
            <ion-icon class="ui-chev" name="chevron-forward-outline"></ion-icon>
          </button>
        }
      </div>
    }
    @if (goals.late().length > 0) {
      <div class="ui-list">
        @for (g of goals.late(); track g.terms.id) {
          <button type="button" class="ui-row" (click)="openGoal(g)">
            <app-badge [size]="40" [builtin]="g.terms.icon" [fixed]="g.terms.color ?? '#34c98b'"></app-badge>
            <span class="ui-tx">
              <span class="kind goal">{{ 'home.kind.goal' | t }}</span>
              <b class="ui-one">{{ 'goals.home.late' | t:{ name: g.terms.name } }}</b>
              <small class="wrap late">{{ lateLine(g) }}</small>
            </span>
            <ion-icon class="ui-chev" name="chevron-forward-outline"></ion-icon>
          </button>
        }
      </div>
    }
  `,
  styles: [`
    :host { display: flex; flex-direction: column; gap: 10px; }
    :host:not(:empty) { margin-bottom: 10px; }
    .ui-hero {
      display: block;
      width: 100%;
      text-align: left;
      font: inherit;
      color: inherit;
      cursor: pointer;
      padding: 14px 16px;
    }
    .red {
      background: linear-gradient(145deg, rgba(var(--app-red-rgb), 0.35) 0%, rgba(var(--app-red-rgb), 0.12) 55%, var(--app-s1) 100%);
      border-color: rgba(var(--app-red-rgb), 0.5);
    }
    .top { display: flex; gap: 12px; align-items: center; }
    .ui-tx { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
    .ui-tx > b { font-size: 15.5px; }
    small { color: var(--app-mu); font-size: 13px; }
    .strong { font-weight: 600; }
    .late { color: var(--app-yel); }
    .kind {
      font-size: 11px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase;
      display: flex; align-items: center; gap: 5px;
    }
    .kind::before { content: ''; width: 7px; height: 7px; border-radius: 50%; background: currentColor; flex: none; }
    .kind.cap { color: var(--app-yel); }
    .red .kind.cap { color: var(--app-red); }
    .kind.goal { color: var(--app-pr); }
    .warn {
      width: 44px; height: 44px; border-radius: 50%; flex: none; display: grid; place-items: center;
      background: rgba(var(--app-red-rgb), 0.2); color: var(--app-red); font-size: 22px;
    }
  `],
})
export class LimitsHomeComponent {
  readonly limits = inject(LimitsService);
  readonly goals = inject(GoalsService);
  private readonly i18n = inject(I18nService);
  private readonly router = inject(Router);

  /** From 80 % and not over: one quiet row each. */
  readonly close = computed<LimitView[]>(() => this.limits.current().fine.filter(l => l.status.state === 'close'));

  money = plain;
  ratio = ratio;

  openGoal(g: GoalView): void {
    void this.router.navigateByUrl(`/plans/goal/${g.terms.id}`);
  }

  lateLine(g: GoalView): string {
    const s = g.status;
    if (s.monthsLeft === 0) return this.i18n.t('goals.line.overdue', { left: plain(s.remainingMinor) });
    return this.i18n.t('goals.home.lateLine', { needed: plain(s.neededPerMonthMinor ?? 0) });
  }

  go(url: string): void {
    void this.router.navigateByUrl(url);
  }

  open(view: LimitView): void {
    this.limits.month.set(this.limits.thisMonth());
    void this.router.navigateByUrl(`/plans/${view.terms.id}`);
  }
}
