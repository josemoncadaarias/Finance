/**
 * What Inicio says about the month's limits, and only when something needs
 * attention (mockups `14f`, `14i`, `14m`): the total gone over, or each limit
 * gone over, as a red card on top; a limit from 80 % as one quiet row.
 * Nothing at all while every limit goes well.
 */

import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { IonIcon } from '@ionic/angular';

import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { LimitsService, type LimitView } from '../../core/limits/limits.service';
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
              <b class="ui-one">{{ 'plans.home.close' | t:{ name: l.name, percent: l.status.percent } }}</b>
              <small class="ui-one">{{ 'plans.line.close' | t:{ left: money(l.status.remainingMinor), count: l.status.daysLeft } }}</small>
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
    .warn {
      width: 44px; height: 44px; border-radius: 50%; flex: none; display: grid; place-items: center;
      background: rgba(var(--app-red-rgb), 0.2); color: var(--app-red); font-size: 22px;
    }
  `],
})
export class LimitsHomeComponent {
  readonly limits = inject(LimitsService);
  private readonly router = inject(Router);

  /** From 80 % and not over: one quiet row each. */
  readonly close = computed<LimitView[]>(() => this.limits.current().fine.filter(l => l.status.state === 'close'));

  money = plain;
  ratio = ratio;

  go(url: string): void {
    void this.router.navigateByUrl(url);
  }

  open(view: LimitView): void {
    this.limits.month.set(this.limits.thisMonth());
    void this.router.navigateByUrl(`/plans/${view.terms.id}`);
  }
}
