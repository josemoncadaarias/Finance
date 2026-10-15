/**
 * Finance Pro (mockup `34a`): what it opens, the two prices and the trial.
 * There is no store behind it yet (rule 21), so buying says so; the switch at
 * the foot shows the app as somebody without Pro sees it, to try the locks.
 */
import { Component, computed, inject, signal } from '@angular/core';
import { Location } from '@angular/common';
import { IonContent, IonIcon } from '@ionic/angular';

import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { I18nService } from '../../core/i18n/i18n.service';
import { PaywallService } from '../../core/paywall/paywall.service';
import { PRICES, TRIAL_DAYS } from '../../core/paywall/plan';
import { BadgeComponent } from '../../shared/ui/badge.component';
import { ToastService } from '../../shared/ui/toast.service';

@Component({
  selector: 'app-pro',
  imports: [IonContent, IonIcon, TranslatePipe, BadgeComponent],
  template: `
    <ion-content [fullscreen]="true">
      <header class="ui-titlebar">
        <button type="button" class="back" (click)="back()" [attr.aria-label]="'ui.back' | t">
          <ion-icon name="close"></ion-icon>
        </button>
      </header>
      <div class="ui-main">
        <div class="head" data-tour="pro-head">
          <div class="face"><app-badge shape="ci" [size]="64" builtin="diamond-outline" fixed="#f6b93b"></app-badge></div>
          <b>{{ 'pro.name' | t }}</b>
          <p class="ui-sub">{{ 'pro.lead' | t }}</p>
        </div>

        <div class="ui-list" data-tour="pro-perks">
          @for (p of perks; track p.key) {
            <div class="ui-row plain">
              <app-badge [size]="38" [builtin]="p.icon" [fixed]="p.color"></app-badge>
              <span class="ui-tx"><b class="wrap">{{ $any('pro.perk.' + p.key) | t }}</b><small class="wrap">{{ $any('pro.perk.' + p.key + '.text') | t }}</small></span>
            </div>
          }
        </div>

        <div class="prices" data-tour="pro-prices">
          <button type="button" class="price" [class.on]="plan() === 'yearly'" (click)="plan.set('yearly')">
            <span class="save">{{ 'pro.saving' | t:{ n: saving } }}</span>
            <small>{{ 'pro.yearly' | t }}</small>
            <b>{{ pro.plans()?.yearly?.price ?? peso(prices.yearly) }}</b>
            <small>{{ 'pro.perMonth' | t:{ amount: peso(perMonth) } }}</small>
          </button>
          <button type="button" class="price" [class.on]="plan() === 'monthly'" (click)="plan.set('monthly')">
            <small>{{ 'pro.monthly' | t }}</small>
            <b>{{ pro.plans()?.monthly?.price ?? peso(prices.monthly) }}</b>
            <small>{{ 'pro.eachMonth' | t }}</small>
          </button>
        </div>

        @if (pro.entitled()) {
          <div class="ui-card active">
            <ion-icon name="checkmark-circle"></ion-icon>
            <span class="ui-tx"><b class="wrap">{{ 'pro.active' | t }}</b><small class="wrap">{{ 'pro.active.hint' | t }}</small></span>
          </div>
        } @else {
          <button type="button" class="ui-btn buy" [disabled]="busy()" (click)="buy()">{{ 'pro.trial' | t:{ days: days } }}</button>
          <p class="small">{{ after() }}</p>
          <button type="button" class="link" [disabled]="busy()" (click)="restore()">{{ 'pro.restore' | t }}</button>
        }
        <p class="small private"><ion-icon name="shield-checkmark-outline"></ion-icon> {{ 'pro.private' | t }}</p>

        <div class="ui-list preview">
          <div class="ui-row plain">
            <span class="ui-tx"><b class="wrap">{{ 'pro.preview' | t }}</b><small class="wrap">{{ 'pro.preview.hint' | t }}</small></span>
            <button type="button" class="ui-switch" [class.on]="pro.previewFree()" role="switch" [attr.aria-checked]="pro.previewFree()"
                    [attr.aria-label]="'pro.preview' | t" (click)="pro.setPreviewFree(!pro.previewFree())"></button>
          </div>
        </div>
        <div class="ui-page-end"></div>
      </div>
    </ion-content>
  `,
  styles: [`
    .head { text-align: center; margin: 0 0 18px; }
    .head .face { display: flex; justify-content: center; margin-bottom: 10px; }
    .head b { font-size: 24px; }
    .head .ui-sub { margin: 4px 0 0; }
    .prices { display: flex; gap: 10px; margin-top: 22px; }
    .price {
      flex: 1; min-width: 0; position: relative; display: flex; flex-direction: column; gap: 3px; text-align: left;
      padding: 14px 12px; border-radius: 18px; background: var(--app-s1); border: 2px solid var(--app-border);
      color: inherit; font: inherit; cursor: pointer;
      small { color: var(--app-mu); font-size: 12.5px; }
      b { font-size: 20px; }
    }
    .price.on { border-color: var(--app-pr); background: rgba(var(--app-pr-rgb), 0.12); }
    .save { position: absolute; top: -11px; right: 10px; padding: 3px 9px; border-radius: 9px;
      background: var(--app-grn); color: #06210f; font-size: 11.5px; font-weight: 800; }
    .buy { width: 100%; margin-top: 18px; }
    .small { text-align: center; color: var(--app-mu); font-size: 12.5px; margin: 8px 4px 0; line-height: 1.4; }
    .private ion-icon { vertical-align: -2px; }
    .link { display: block; width: 100%; margin-top: 10px; padding: 10px; border: 0; background: none;
      color: var(--app-pr); font: inherit; font-size: 15px; font-weight: 600; cursor: pointer; }
    .preview { margin-top: 28px; }
    .active { display: flex; align-items: center; gap: 12px; margin-top: 18px; padding: 14px 16px;
      ion-icon { font-size: 28px; color: var(--app-grn); flex: none; } }
  `],
})
export class ProPage {
  readonly pro = inject(PaywallService);
  private readonly i18n = inject(I18nService);
  private readonly toast = inject(ToastService);
  private readonly location = inject(Location);

  readonly days = TRIAL_DAYS;
  readonly prices = PRICES;
  readonly perMonth = Math.round(PRICES.yearly / 12);
  readonly saving = Math.round((1 - PRICES.yearly / (PRICES.monthly * 12)) * 100);
  readonly plan = signal<'yearly' | 'monthly'>('yearly');
  readonly busy = signal(false);

  constructor() {
    void this.pro.loadPlans();
  }
  readonly perks = [
    { key: 'notices', icon: 'notifications-outline', color: '#f6b93b' },
    { key: 'yields', icon: 'trending-up-outline', color: '#2ec4b6' },
    { key: 'statements', icon: 'document-text-outline', color: '#9b7bff' },
    { key: 'currencies', icon: 'globe-outline', color: '#a3d65c' },
    { key: 'debts', icon: 'receipt-outline', color: '#ff9152' },
    { key: 'report', icon: 'stats-chart-outline', color: '#6378ff' },
  ];

  readonly after = computed(() => {
    const store = this.pro.plans()?.[this.plan()]?.price;
    return this.plan() === 'yearly'
      ? this.i18n.t('pro.after.yearly', { amount: store ?? this.peso(PRICES.yearly) })
      : this.i18n.t('pro.after.monthly', { amount: store ?? this.peso(PRICES.monthly) });
  });

  peso(amount: number): string {
    return '$ ' + amount.toLocaleString('es-CO');
  }

  /** Through Google Play; in a browser there is no store, and it says so. */
  async buy(): Promise<void> {
    if (!this.pro.storeAvailable) { this.toast.say(this.i18n.t('pro.notYet'), 5000); return; }
    this.busy.set(true);
    try {
      const result = await this.pro.buy(this.plan());
      if (result === 'bought') this.toast.say(this.i18n.t('pro.bought'), 5000);
      else if (result === 'failed') this.toast.say(this.i18n.t('pro.failed'), 5000);
      else if (result === 'unavailable') this.toast.say(this.i18n.t('pro.unavailable'), 5000);
    } finally {
      this.busy.set(false);
    }
  }

  async restore(): Promise<void> {
    if (!this.pro.storeAvailable) { this.toast.say(this.i18n.t('pro.notYet'), 5000); return; }
    this.busy.set(true);
    try {
      this.toast.say(this.i18n.t(await this.pro.restore() ? 'pro.restored' : 'pro.notFound'), 5000);
    } finally {
      this.busy.set(false);
    }
  }

  back(): void {
    this.location.back();
  }
}
