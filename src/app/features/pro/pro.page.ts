/**
 * Finance Pro (mockup `34a`): what it opens, the two prices and the trial.
 * Once paid (`34i`-`34m`, Jose, 2026-10-16) it stops selling: what is paid
 * for and until when, "TU PLAN" on that plan, the other as a change, and
 * Google Play for cancelling or the card. The switch at the foot shows the
 * app as somebody without Pro sees it, to try the locks.
 */
import { AskButtonComponent } from '../../shared/ui/ask-button.component';
import { Component, computed, inject, signal } from '@angular/core';
import { Location, NgTemplateOutlet } from '@angular/common';
import { IonContent, IonIcon } from '@ionic/angular';

import { ConfirmComponent } from '../../shared/confirm/confirm.component';
import { buyOffer, daysLeft, type ProPlan } from '../../core/paywall/subscription';

import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { I18nService } from '../../core/i18n/i18n.service';
import { PaywallService } from '../../core/paywall/paywall.service';
import { PRICES, TRIAL_DAYS } from '../../core/paywall/plan';
import { BadgeComponent } from '../../shared/ui/badge.component';
import { ToastService } from '../../shared/ui/toast.service';
import { Router } from '@angular/router';
import { copyText } from '../../core/feedback/feedback.service';

@Component({
  selector: 'app-pro',
  imports: [AskButtonComponent, IonContent, IonIcon, NgTemplateOutlet, TranslatePipe, BadgeComponent, ConfirmComponent],
  template: `
    <ion-content [fullscreen]="true">
      <header class="ui-titlebar">
        <button type="button" class="back" (click)="back()" [attr.aria-label]="'ui.back' | t">
          <ion-icon name="close"></ion-icon>
        </button>
        <span style="flex: 1"></span>
        <app-ask-button></app-ask-button>
      </header>
      <div class="ui-main">
        <div class="head" data-tour="pro-head">
          <div class="face"><app-badge shape="ci" [size]="64" builtin="diamond-outline" fixed="#f6b93b"></app-badge></div>
          <b (contextmenu)="toggleCode($event)">{{ 'pro.name' | t }}</b>
          <p class="ui-sub">{{ (pro.entitled() ? 'pro.owned.lead' : 'pro.lead') | t }}</p>
        </div>

        <ng-template #perkList>
          <div class="ui-list" data-tour="pro-perks">
            @for (p of perks; track p.key) {
              <div class="ui-row plain">
                <app-badge [size]="38" [builtin]="p.icon" [fixed]="p.color"></app-badge>
                <span class="ui-tx"><b class="wrap">{{ $any('pro.perk.' + p.key) | t }}</b><small class="wrap">{{ $any('pro.perk.' + p.key + '.text') | t }}</small></span>
              </div>
            }
          </div>
        </ng-template>

        @if (pro.entitled()) {
          <div class="ui-card status" [class.warn]="status().warn" data-tour="pro-status">
            <app-badge [size]="44" shape="ci" [builtin]="status().icon" [fixed]="status().warn ? '#f6b93b' : '#34c98b'"></app-badge>
            <span class="ui-tx"><b class="wrap">{{ status().title }}</b><small class="wrap">{{ status().line }}</small></span>
          </div>
          @if (!sub()?.granted) {
          <div class="prices" data-tour="pro-prices">
            @for (p of ownedOrder(); track p) {
              <div class="price" [class.mine]="p === mine()">
                @if (p === mine()) { <span class="save mine">{{ 'pro.mine' | t }}</span> }
                @else if (p === 'yearly') { <span class="save soft">{{ 'pro.saving' | t:{ n: saving } }}</span> }
                <small>{{ (p === 'yearly' ? 'pro.yearly' : 'pro.monthly') | t }}</small>
                <b>{{ priceOf(p) }}</b>
                <small>{{ p === 'yearly' ? ('pro.perMonth.plain' | t:{ amount: peso(perMonth) }) : ('pro.eachMonth' | t) }}</small>
              </div>
            }
          </div>
          @if (sub() && !sub()!.renews) {
            <button type="button" class="ui-btn buy" (click)="pro.manage()">{{ 'pro.reactivate' | t }}</button>
            <p class="small">{{ 'pro.reactivate.hint' | t }}</p>
          } @else if (mine() === 'monthly') {
            <button type="button" class="ui-btn buy" [disabled]="busy()" (click)="changing.set('yearly')">{{ 'pro.toYearly' | t:{ n: saving } }}</button>
            <p class="small">{{ 'pro.toYearly.hint' | t }}</p>
          } @else if (mine() === 'yearly') {
            <button type="button" class="link" [disabled]="busy()" (click)="changing.set('monthly')">{{ 'pro.toMonthly' | t }}</button>
            @if (untilDate()) { <p class="small tight">{{ 'pro.toMonthly.hint' | t:{ date: untilDate() ?? '' } }}</p> }
          }
          <div class="ui-list manage">
            <button type="button" class="ui-row" (click)="pro.manage()">
              <app-badge [size]="38" builtin="logo-google-playstore" fixed="#34c98b"></app-badge>
              <span class="ui-tx"><b class="wrap">{{ 'pro.manage' | t }}</b><small class="wrap">{{ 'pro.manage.hint' | t }}</small></span>
              <ion-icon name="chevron-forward" class="chev"></ion-icon>
            </button>
          </div>
          }
          <p class="small private"><ion-icon name="shield-checkmark-outline"></ion-icon> {{ 'pro.private' | t }}</p>
          <div class="ui-h">{{ 'pro.youHave' | t }}</div>
          <ng-container *ngTemplateOutlet="perkList"></ng-container>
        } @else {
        @if (pro.lapsed(); as ended) {
          <div class="ui-card status warn lapsed">
            <app-badge [size]="44" shape="ci" builtin="time-outline" fixed="#f6b93b"></app-badge>
            <span class="ui-tx"><b class="wrap">{{ 'pro.lapsed' | t:{ date: dateOf(ended) ?? '' } }}</b><small class="wrap">{{ 'pro.lapsed.line' | t }}</small></span>
          </div>
        }
        <ng-container *ngTemplateOutlet="perkList"></ng-container>

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

        <button type="button" class="ui-btn buy" [disabled]="busy()" (click)="buy()">{{ buyLabel() }}</button>
        <p class="small">{{ after() }}</p>
        <button type="button" class="link" [disabled]="busy()" (click)="restore()">{{ 'pro.restore' | t }}</button>
        <p class="small private"><ion-icon name="shield-checkmark-outline"></ion-icon> {{ 'pro.private' | t }}</p>
        }

        @if (showCode() && pro.proCode(); as code) {
          <div class="ui-list code">
            <div class="ui-row plain">
              <span class="ui-tx">
                <b class="wrap">{{ 'pro.code.title' | t }}</b>
                <code>{{ code }}</code>
                <small class="wrap">{{ (pro.codeFollows() ? 'pro.code.follows' : 'pro.code.anonymous') | t }}</small>
              </span>
            </div>
            <div class="ui-row plain actions">
              <button type="button" class="ui-btn ghost" (click)="copyCode(code)">{{ 'pro.code.copy' | t }}</button>
              @if (!pro.codeFollows()) {
                <button type="button" class="ui-btn ghost" (click)="signIn()">{{ 'pro.code.signIn' | t }}</button>
              }
            </div>
          </div>
        }

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
    <app-confirm [open]="changing() !== null" tone="primary" icon="swap-horizontal-outline"
                 [title]="(changing() === 'yearly' ? 'pro.change.yearly' : 'pro.change.monthly') | t"
                 [body]="changeBody()" [confirmLabel]="'pro.change.go' | t" [busy]="busy()"
                 (confirmed)="change()" (cancelled)="changing.set(null)"></app-confirm>
  `,
  styles: [`
    .code code { display: block; margin: 6px 0; font-family: ui-monospace, monospace; font-size: 15px; color: var(--app-tx); word-break: break-all; user-select: all; }
    .code .actions { display: flex; gap: 8px; flex-wrap: wrap; }
    .code .actions .ui-btn { flex: 1 1 140px; }
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
    .status { display: flex; align-items: center; gap: 12px; padding: 14px 16px; border: 1px solid rgba(52, 201, 139, 0.45); }
    .status.warn { border-color: rgba(246, 185, 59, 0.5); }
    .status.lapsed { margin-bottom: 16px; }
    .price.mine { border-color: var(--app-grn); background: rgba(52, 201, 139, 0.12); cursor: default; }
    .save.mine { background: var(--app-grn); }
    .save.soft { background: rgba(52, 201, 139, 0.22); color: var(--app-grn); }
    .tight { margin-top: 0; }
    .manage { margin-top: 16px; }
    .manage .ui-row { width: 100%; border: 0; background: none; color: inherit; font: inherit; text-align: left; cursor: pointer; }
    .chev { color: var(--app-mu); flex: none; }
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
  /** The plan being changed to, while its question is up. */
  readonly changing = signal<ProPlan | null>(null);
  readonly sub = this.pro.subscription;
  readonly mine = computed(() => this.sub()?.plan ?? null);
  /** The plan paid for first, as in 34i-34l; the year first when unknown. */
  readonly ownedOrder = computed<ProPlan[]>(() => this.mine() === 'monthly' ? ['monthly', 'yearly'] : ['yearly', 'monthly']);
  readonly untilDate = computed(() => this.dateOf(this.sub()?.until ?? null));

  /** What is paid for and until when, on top (34i-34l). */
  readonly status = computed(() => {
    const sub = this.sub();
    const t = (key: string, args?: Record<string, string | number>) => this.i18n.t(key as never, args);
    // Given from the dashboard: nothing to pay, renew or manage.
    if (sub?.granted) {
      return sub.until
        ? { icon: 'gift-outline', warn: false, title: t('pro.granted'), line: t('pro.granted.until', { date: this.untilDate() ?? '' }) }
        : { icon: 'gift-outline', warn: false, title: t('pro.granted.forever'), line: t('pro.granted.line') };
    }
    if (!sub || !sub.plan) return { icon: 'checkmark-circle', warn: false, title: t('pro.active'), line: t('pro.active.hint') };
    const date = this.untilDate() ?? '';
    const price = this.priceOf(sub.plan);
    const per = t(sub.plan === 'yearly' ? 'pro.per.year' : 'pro.per.month');
    if (!sub.renews) return { icon: 'alert-circle-outline', warn: true, title: t('pro.cancelled'), line: t('pro.cancelled.line', { date }) };
    if (sub.trial) {
      const n = daysLeft(sub.until, new Date());
      return { icon: 'gift-outline', warn: false,
        title: n <= 1 ? t('pro.trial.lastDay') : t('pro.trial.left', { n }),
        line: t('pro.trial.line', { date, price, per }) };
    }
    return { icon: 'checkmark-circle', warn: false, title: t('pro.paying', { price, per }), line: t('pro.renews', { date }) };
  });

  readonly changeBody = computed(() => this.changing() === 'yearly'
    ? this.i18n.t('pro.change.yearly.body', { price: this.priceOf('yearly') })
    : this.i18n.t('pro.change.monthly.body', { price: this.priceOf('monthly'), date: this.untilDate() ?? '' }));
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
    { key: 'assistant', icon: 'sparkles-outline', color: '#6378ff' },
  ];

  /**
   * What the buy button offers (34n-34p). Google says who still has the
   * trial; before the store answers (or in a browser) the trial is assumed
   * only for someone never seen paying.
   */
  readonly offer = computed(() => {
    const plans = this.pro.plans();
    const trialDays = plans ? plans[this.plan()]?.trialDays ?? null : TRIAL_DAYS;
    return { kind: buyOffer({ trialDays, everPaid: this.pro.everPaid(), lapsed: this.pro.lapsed() }), days: trialDays ?? TRIAL_DAYS };
  });

  readonly buyLabel = computed(() => {
    const { kind, days } = this.offer();
    const price = this.priceOf(this.plan());
    const per = this.i18n.t(this.plan() === 'yearly' ? 'pro.per.year' : 'pro.per.month');
    if (kind === 'trial') return this.i18n.t('pro.trial.start', { days });
    return this.i18n.t(kind === 'return' ? 'pro.return' : 'pro.subscribe', { price, per });
  });

  /** Under the button: the day it starts charging, or how to cancel. */
  readonly after = computed(() => {
    const { kind, days } = this.offer();
    if (kind !== 'trial') return this.i18n.t('pro.cancelAny');
    const starts = new Date(Date.now() + days * 86_400_000).toISOString();
    return this.i18n.t('pro.trial.after', {
      date: this.dateOf(starts) ?? '', price: this.priceOf(this.plan()),
      per: this.i18n.t(this.plan() === 'yearly' ? 'pro.per.theYear' : 'pro.per.month'),
    });
  });

  /** The store's price when it answered, the app's own otherwise. */
  priceOf(plan: ProPlan): string {
    return this.pro.plans()?.[plan]?.price ?? this.peso(PRICES[plan]);
  }

  /** "22 de octubre", with the year when it is not this one. */
  dateOf(iso: string | null): string | null {
    if (!iso) return null;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    const year = d.getFullYear() !== new Date().getFullYear();
    return d.toLocaleDateString(this.i18n.dateLocale(), { day: 'numeric', month: 'long', ...(year ? { year: 'numeric' } : {}) });
  }

  /** A change of plan, through Google Play, after its question. */
  async change(): Promise<void> {
    const to = this.changing();
    if (!to) return;
    this.busy.set(true);
    try {
      const result = await this.pro.buy(to);
      this.changing.set(null);
      if (result === 'bought') this.toast.say(this.i18n.t(to === 'yearly' ? 'pro.changed.yearly' : 'pro.changed.monthly'), 5000);
      else if (result === 'failed') this.toast.say(this.i18n.t('pro.change.failed'), 5000);
      else if (result === 'unavailable') this.toast.say(this.i18n.t('pro.unavailable'), 5000);
    } finally {
      this.busy.set(false);
    }
  }

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

  private readonly router = inject(Router);

  /**
   * The account's id is not on show: it only serves to grant Finance Pro from
   * RevenueCat, and on screen it read as a code to give away (Jose,
   * 2026-10-28). A long press on "Finance Pro" shows it and hides it again.
   */
  readonly showCode = signal(false);

  toggleCode(event: Event): void {
    event.preventDefault();
    this.showCode.update(on => !on);
  }

  async copyCode(code: string): Promise<void> {
    await copyText(code);
    this.toast.say(this.i18n.t('pro.code.copied'), 4000);
  }

  signIn(): void {
    void this.router.navigate(['/account']);
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
