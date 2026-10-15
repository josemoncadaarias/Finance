/**
 * The sheet a lock opens (mockups `34b`, `34c`): what the thing does, that it
 * is part of Finance Pro, and the way to it - never a dead end. Mounted once
 * in the shell; `PaywallService.asking` opens it.
 */
import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { IonModal } from '@ionic/angular';

import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { FEATURE_FACE, PaywallService } from '../../core/paywall/paywall.service';
import { PLAN, TRIAL_DAYS } from '../../core/paywall/plan';
import { BadgeComponent } from '../ui/badge.component';

@Component({
  selector: 'app-pro-sheet',
  imports: [IonModal, TranslatePipe, BadgeComponent],
  template: `
    <ion-modal [initialBreakpoint]="1" [breakpoints]="[0, 1]" [handle]="false" class="ui-sheet" [isOpen]="pro.asking() !== null"
               (didDismiss)="pro.asking.set(null)">
      <ng-template>
        @if (pro.asking(); as f) {
          <div class="ui-sheet-body lock">
            <div class="grab"></div>
            <div class="face"><app-badge shape="ci" [size]="58" [builtin]="face().icon" [fixed]="face().color"></app-badge></div>
            <b class="title">{{ $any('pro.f.' + f + '.title') | t }}</b>
            <p class="ui-sub">{{ $any('pro.f.' + f + '.text') | t }}</p>
            @if (paidOnly()) { <p class="part">{{ 'pro.partOf' | t:{ days: days } }}</p> }
            <button type="button" class="ui-btn" (click)="see()">{{ 'pro.see' | t }}</button>
            <button type="button" class="later" (click)="pro.asking.set(null)">{{ 'pro.notNow' | t }}</button>
          </div>
        }
      </ng-template>
    </ion-modal>
  `,
  styles: [`
    .lock { text-align: center; padding-bottom: calc(18px + var(--ion-safe-area-bottom, 0px)); }
    .face { display: flex; justify-content: center; margin: 6px 0 12px; }
    .title { display: block; font-size: 18px; }
    .ui-sub { margin: 6px 8px 0; line-height: 1.4; }
    .part { color: var(--app-mu); font-size: 12.5px; margin: 10px 0 0; }
    .ui-btn { width: 100%; margin-top: 18px; }
    .later { display: block; width: 100%; margin-top: 8px; padding: 12px; border: 0; background: none;
      color: var(--app-pr); font: inherit; font-size: 15px; font-weight: 600; cursor: pointer; }
  `],
})
export class ProSheetComponent {
  readonly pro = inject(PaywallService);
  private readonly router = inject(Router);
  readonly days = TRIAL_DAYS;

  readonly face = computed(() => FEATURE_FACE[this.pro.asking() ?? 'tax']);
  /** A feature with no free allowance says it is part of Pro; a used allowance says so in its title. */
  readonly paidOnly = computed(() => PLAN[this.pro.asking() ?? 'tax'].free === 0);

  see(): void {
    this.pro.asking.set(null);
    void this.router.navigateByUrl('/pro');
  }
}
