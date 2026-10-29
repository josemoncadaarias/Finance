/**
 * "Primeros pasos" on Inicio (idea 19, mockups 44a-44e): for an app made in
 * the last 30 days, five steps that get it working - an account, the first
 * spending, a cap, the copy in Drive, the bank's notices - each ticked by
 * itself when it happens. A step tapped says what it is for and takes the
 * person there; the X puts the card away (Más → Preferencias → Guías brings
 * it back). What the phone cannot do (Drive and notices in a browser, the
 * notices on an iPhone) is no step at all.
 */

import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { IonIcon, IonModal } from '@ionic/angular';

import { TranslatePipe } from '../../core/i18n/translate.pipe';
import type { TranslationKey } from '../../core/i18n/translations';
import { DatabaseService } from '../../core/database/database.service';
import { DemoService } from '../../core/demo/demo.service';
import { GoogleAccountService } from '../../core/cloud/google-account.service';
import { BankNotifications } from '../../core/notifications/bank-notifications';
import { ComposeService } from '../../core/ui/compose.service';
import { FirstStepsService } from '../../core/ui/first-steps.service';
import { firstStepsShown, nextStep, stepsOf, type StepFacts, type StepId } from '../../core/ui/first-steps';
import { isoDay } from '../../core/filters/period';
import { BadgeComponent } from '../../shared/ui/badge.component';
import { ConfirmComponent } from '../../shared/confirm/confirm.component';

const LOOK: Record<StepId, { icon: string; color: string }> = {
  account: { icon: 'wallet-outline', color: '#6378ff' },
  expense: { icon: 'arrow-up', color: '#ff6b6b' },
  cap: { icon: 'speedometer-outline', color: '#f6b93b' },
  drive: { icon: 'cloud-upload-outline', color: '#4cb8f5' },
  notices: { icon: 'notifications-outline', color: '#9b7bff' },
};

@Component({
  selector: 'app-first-steps',
  standalone: true,
  host: { '[hidden]': '!shown()' },
  imports: [TranslatePipe, IonIcon, IonModal, BadgeComponent, ConfirmComponent],
  template: `
    @if (shown()) {
      @if (next() === null) {
        <!-- Every step done (44d): one line of goodbye, and it hides itself. -->
        <section class="ui-card steps done" data-tour="first-steps">
          <app-badge shape="ci" [size]="50" builtin="trophy-outline" fixed="#e8c15a"></app-badge>
          <b>{{ 'steps.done.title' | t }}</b>
          <p>{{ 'steps.done.text' | t }}</p>
          <button type="button" class="ui-btn ghost" (click)="prefs.setHidden(true)">{{ 'steps.hide.do' | t }}</button>
        </section>
      } @else {
        <section class="ui-card steps" data-tour="first-steps">
          <div class="head">
            <app-badge shape="ci" [size]="38" builtin="rocket-outline" fixed="#6378ff"></app-badge>
            <span class="ui-tx">
              <b>{{ 'steps.title' | t }}</b>
              <small>{{ 'steps.count' | t:{ done: doneCount(), count: steps().length } }}</small>
            </span>
            <button type="button" class="x" (click)="asking.set(true)" [attr.aria-label]="'steps.hide.do' | t">
              <ion-icon name="close"></ion-icon>
            </button>
          </div>
          <div class="bar"><i [style.width.%]="100 * doneCount() / steps().length"></i></div>
          @for (step of steps(); track step.id) {
            <button type="button" class="step" [class.lit]="step.id === next()" [class.ok]="step.done"
                    [disabled]="step.done" (click)="opened.set(step.id)">
              @if (step.done) {
                <span class="tick on"><ion-icon name="checkmark"></ion-icon></span>
              } @else {
                <span class="tick"></span>
              }
              <span class="ui-tx">
                <b>{{ k(step.id, 'title') | t }}</b>
                @if (!step.done) { <small>{{ k(step.id, 'line') | t }}</small> }
              </span>
              @if (!step.done) { <ion-icon class="ui-chev" name="chevron-forward-outline"></ion-icon> }
            </button>
          }
        </section>
      }

      <!-- A step tapped (44b): what it is for, and the button that does it. -->
      <ion-modal [initialBreakpoint]="1" [breakpoints]="[0, 1]" [handle]="false" class="ui-sheet"
                 [isOpen]="opened() !== null" (didDismiss)="opened.set(null)">
        <ng-template>
          @if (opened(); as id) {
            <div class="ui-sheet-body ion-content-scroll-host step-sheet">
              <button type="button" class="sheet-cancel" (click)="opened.set(null)">{{ 'entry.cancel' | t }}</button>
              <div class="grab"></div>
              <div class="center">
                <app-badge shape="ci" [size]="54" [builtin]="look(id).icon" [fixed]="look(id).color"></app-badge>
                <h2>{{ k(id, 'sheet') | t }}</h2>
                <p>{{ k(id, 'why') | t }}</p>
              </div>
              <button type="button" class="ui-btn" (click)="go(id)">{{ k(id, 'do') | t }}</button>
              <button type="button" class="ui-btn ghost" (click)="opened.set(null)">{{ 'steps.later' | t }}</button>
            </div>
          }
        </ng-template>
      </ion-modal>

      <!-- The X (44e): asked, and where to bring it back. -->
      <app-confirm [open]="asking()" icon="eye-off-outline" tone="primary"
                   [title]="'steps.hide.title' | t" [body]="'steps.hide.body' | t"
                   [confirmLabel]="'steps.hide.do' | t"
                   (confirmed)="asking.set(false); prefs.setHidden(true)" (cancelled)="asking.set(false)"></app-confirm>
    }
  `,
  styles: [`
    :host { display: block; }
    .steps { padding: 0; overflow: hidden; }
    .head { display: flex; align-items: center; gap: 10px; padding: 14px 14px 10px; }
    .head b { font-size: 15.5px; }
    .head small { color: var(--app-mu); font-size: 12.8px; }
    .x { background: none; border: 0; color: var(--app-mu); font-size: 22px; padding: 4px; display: grid; place-items: center; }
    .bar { height: 6px; border-radius: 4px; background: var(--app-s3, rgba(127,127,127,.25)); margin: 0 14px 8px; overflow: hidden; }
    .bar i { display: block; height: 100%; background: var(--ion-color-primary); border-radius: 4px; }
    .step {
      width: 100%; display: flex; align-items: center; gap: 13px; padding: 11px 14px; border: 0;
      background: none; text-align: left; font: inherit; color: var(--app-tx);
    }
    .step + .step { border-top: 1px solid var(--app-line, rgba(127,127,127,.18)); }
    .step.lit { background: color-mix(in srgb, var(--ion-color-primary) 10%, transparent); }
    .step.lit .tick:not(.on) { border-color: var(--ion-color-primary); }
    .step.ok b { color: var(--app-mu); text-decoration: line-through; }
    .step[disabled] { opacity: 1; }
    .step .ui-tx b { white-space: normal; text-wrap: pretty; font-weight: 500; }
    .step .ui-tx small { white-space: normal; text-wrap: pretty; }
    .tick { width: 24px; height: 24px; border-radius: 50%; border: 2px solid var(--app-mu); flex: none; box-sizing: border-box; }
    .tick.on { border: 0; background: var(--ion-color-primary); display: grid; place-items: center; color: #fff; font-size: 15px; }
    .done { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 6px; padding: 18px 16px; }
    .done b { font-size: 16.5px; }
    .done p { margin: 0; color: var(--app-mu); font-size: 13.5px; line-height: 1.4; text-wrap: pretty; }
    .done .ui-btn { width: 100%; margin-top: 8px; }
    .step-sheet .center { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 8px; }
    .step-sheet h2 { margin: 4px 0 0; }
    .step-sheet p { margin: 0 0 8px; color: var(--app-mu); line-height: 1.45; text-wrap: pretty; }
    .step-sheet .ui-btn { width: 100%; margin-top: 10px; }
  `],
})
export class FirstStepsComponent {
  private readonly database = inject(DatabaseService);
  private readonly demo = inject(DemoService);
  private readonly google = inject(GoogleAccountService);
  private readonly compose = inject(ComposeService);
  private readonly router = inject(Router);
  readonly prefs = inject(FirstStepsService);

  private readonly facts = signal<StepFacts | null>(null);
  readonly opened = signal<StepId | null>(null);
  readonly asking = signal(false);

  readonly steps = computed(() => {
    const facts = this.facts();
    return facts === null ? [] : stepsOf(facts);
  });
  readonly next = computed(() => nextStep(this.steps()));
  readonly doneCount = computed(() => this.steps().filter(step => step.done).length);
  readonly shown = computed(() => {
    const facts = this.facts();
    return facts !== null && !this.demo.active() && firstStepsShown(facts, this.prefs.hidden());
  });

  constructor() {
    effect(() => {
      this.database.dataVersion();
      this.google.user();
      if (this.database.status() !== 'ready' || this.prefs.hidden()) return;
      void untracked(() => this.load());
    });
  }

  /** A step's own word: `steps.<id>.<part>`. */
  k(id: StepId, part: 'title' | 'line' | 'sheet' | 'why' | 'do'): TranslationKey {
    return `steps.${id}.${part}` as TranslationKey;
  }

  look(id: StepId): { icon: string; color: string } {
    return LOOK[id];
  }

  private async load(): Promise<void> {
    const db = this.database.driver;
    try {
      const accounts = await db.queryOne<{ n: number; first: string | null }>(
        'SELECT COUNT(*) AS n, MIN(created_at) AS first FROM accounts');
      const expenses = await db.queryOne<{ n: number }>(
        `SELECT COUNT(*) AS n FROM transactions t JOIN categories c ON c.id = t.category_id
         WHERE c.kind = 'expense'`);
      const caps = await db.queryOne<{ n: number }>('SELECT COUNT(*) AS n FROM spending_limits');
      this.facts.set({
        accounts: accounts?.n ?? 0,
        expenses: expenses?.n ?? 0,
        caps: caps?.n ?? 0,
        drive: this.google.available ? this.google.user() !== null : null,
        notices: await this.noticesOn(),
        firstAccountOn: accounts?.first ? accounts.first.slice(0, 10) : null,
        today: isoDay(new Date()),
      });
    } catch {
      this.facts.set(null);
    }
  }

  /** A bank's app or SMS sender being read; null where the phone cannot. */
  private async noticesOn(): Promise<boolean | null> {
    try {
      const { supported } = await BankNotifications.isSupported();
      if (!supported) return null;
      const { apps } = await BankNotifications.apps();
      if (apps.some(app => app.watched)) return true;
      const { senders } = await BankNotifications.senders();
      return senders.some(sender => sender.watched);
    } catch {
      return null;
    }
  }

  async go(id: StepId): Promise<void> {
    this.opened.set(null);
    if (id === 'expense') return this.compose.open('expense');
    const where: Record<StepId, string> = {
      account: '/accounts?new=account', expense: '', cap: '/plans?new=limit',
      drive: '/account', notices: '/notifications',
    };
    await this.router.navigateByUrl(where[id]);
  }
}
