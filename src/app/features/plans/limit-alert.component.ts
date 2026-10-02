/**
 * The sheet when a saved movement takes a limit, or the total of every limit,
 * past it (mockups `14h`, `14n`), and again for each expense saved into one
 * already past (Jose, 2026-10-02). Nothing is blocked,
 * the movement is already saved. "No volver a mostrar esto" turns the sheet
 * off; Avisos in Planes turns it back on (Jose, 2026-10-01).
 */

import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { IonIcon, IonModal } from '@ionic/angular';

import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { LimitsService } from '../../core/limits/limits.service';
import { LimitBarComponent } from '../../shared/ui/limit-bar.component';
import { plain, ratio } from './plans-words';

@Component({
  selector: 'app-limit-alert',
  standalone: true,
  imports: [TranslatePipe, LimitBarComponent, IonIcon, IonModal],
  template: `
    <ion-modal [initialBreakpoint]="1" [breakpoints]="[0, 1]" [handle]="false" class="ui-sheet" [isOpen]="limits.alert() !== null"
               (didDismiss)="close()">
      <ng-template>
        @if (limits.alert(); as a) {
          <div class="ui-sheet-body alert">
            <div class="grab"></div>
            <span class="icon"><ion-icon name="alert-circle-outline"></ion-icon></span>
            @if (a.kind === 'total') {
              @let t = a.month.total!;
              <b class="title">{{ (a.again ? 'plans.alert.total.again' : 'plans.alert.total') | t }}</b>
              <p class="ui-sub">{{ 'plans.alert.total.body' | t:{ spent: money(t.spentMinor), amount: money(t.amountMinor) } }}</p>
              <p class="over">{{ 'plans.overBy' | t:{ amount: money(t.overMinor) } }} · {{ 'plans.home.passedCount' | t:{ count: t.passedCount } }}</p>
              <app-limit-bar class="big" [percent]="ratio(t)" state="passed"></app-limit-bar>
            } @else {
              @let s = a.view.status;
              <b class="title">{{ (a.again ? 'plans.alert.limit.again' : 'plans.alert.limit') | t:{ name: a.view.name } }}</b>
              <p class="ui-sub">{{ 'plans.alert.limit.body' | t:{ spent: money(s.spentMinor), amount: money(s.amountMinor) } }}</p>
              <p class="over">{{ 'plans.overBy' | t:{ amount: money(s.overMinor) } }}@if (s.daysLeft > 0) { · {{ 'plans.home.daysLeft' | t:{ count: s.daysLeft } }} }</p>
              <app-limit-bar class="big" [percent]="ratio(s)" state="passed"></app-limit-bar>
            }
            <p class="note">{{ 'plans.alert.saved' | t }}</p>
            <button type="button" class="never" (click)="never.set(!never())" role="checkbox" [attr.aria-checked]="never()">
              <span class="ui-tick" [class.on]="never()">@if (never()) { <ion-icon name="checkmark"></ion-icon> }</span>
              <span class="ui-tx"><b>{{ 'plans.alert.never' | t }}</b><small>{{ 'plans.alert.never.hint' | t }}</small></span>
            </button>
            <div class="two">
              <button type="button" class="ui-btn ghost" (click)="close()">{{ 'plans.alert.ok' | t }}</button>
              <button type="button" class="ui-btn" (click)="see()">{{ (a.kind === 'total' ? 'plans.alert.seeAll' : 'plans.alert.see') | t }}</button>
            </div>
          </div>
        }
      </ng-template>
    </ion-modal>
  `,
  styles: [`
    .alert { padding-bottom: calc(24px + var(--ion-safe-area-bottom, 0px)); text-align: center; }
    .icon {
      width: 60px; height: 60px; border-radius: 50%; margin: 4px auto 10px; display: grid; place-items: center;
      background: rgba(var(--app-red-rgb), 0.18); color: var(--app-red); font-size: 32px;
    }
    .title { display: block; font-size: 19px; line-height: 1.3; }
    .ui-sub { margin: 8px 0 4px; }
    .over { color: var(--app-red); font-weight: 600; margin: 0 0 6px; }
    app-limit-bar { text-align: left; }
    .note { color: var(--app-mu); font-size: 13px; margin: 12px 2px; text-align: left; }
    .never {
      display: flex; gap: 10px; align-items: center; width: 100%; padding: 6px 4px 12px; border: 0; background: none;
      color: inherit; font: inherit; text-align: left; cursor: pointer;
      .ui-tx { display: flex; flex-direction: column; }
      b { font-size: 14.5px; font-weight: 500; }
      small { color: var(--app-mu); font-size: 12.5px; }
    }
    .two { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  `],
})
export class LimitAlertComponent {
  readonly limits = inject(LimitsService);
  private readonly router = inject(Router);

  readonly never = signal(false);

  money = plain;
  ratio = ratio;

  close(): void {
    if (this.limits.alert() === null) return;
    if (this.never()) void this.limits.setNotice('atSave', false);
    this.never.set(false);
    this.limits.alert.set(null);
  }

  see(): void {
    const a = this.limits.alert();
    this.close();
    this.limits.month.set(this.limits.thisMonth());
    void this.router.navigateByUrl(a?.kind === 'limit' ? `/plans/${a.view.terms.id}` : '/plans');
  }
}
