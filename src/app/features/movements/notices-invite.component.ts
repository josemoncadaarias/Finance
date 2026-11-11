/**
 * "¿Quieres que tus compras aparezcan solas?" on Inicio (mockup 57g; Jose,
 * 2026-11-11: his partner never knew the bank's notices could be read,
 * because nothing on Inicio said so).
 *
 * One card, on an Android phone where the app may not read notifications
 * yet and there is at least one account. Its button opens Android's own
 * screen to allow it; from then on the app finds the person's banks by
 * itself (the listener, `NotificationCatcher`). "Ahora no" puts it away for
 * good on this device; Más → Notificaciones del teléfono stays the way in.
 * Not shown while "Primeros pasos" is on Inicio (it carries the same step),
 * nor with the sample data.
 */

import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { DatabaseService } from '../../core/database/database.service';
import { DemoService } from '../../core/demo/demo.service';
import { BankNotifications } from '../../core/notifications/bank-notifications';
import { FirstStepsService } from '../../core/ui/first-steps.service';
import { NEW_FOR_DAYS } from '../../core/ui/first-steps';
import { BadgeComponent } from '../../shared/ui/badge.component';

/** Where "Ahora no" is kept on the device. */
const PUT_AWAY = 'finance.noticesInvite.away';

@Component({
  selector: 'app-notices-invite',
  standalone: true,
  host: { '[hidden]': '!shown()' },
  imports: [TranslatePipe, BadgeComponent],
  template: `
    @if (shown()) {
      <section class="ui-card invite" data-tour="notices-invite">
        <app-badge shape="ci" [size]="54" builtin="notifications-outline" fixed="#6378ff"></app-badge>
        <b>{{ 'invite.title' | t }}</b>
        <p>{{ 'invite.text' | t }}</p>
        <button type="button" class="ui-btn" (click)="allow()">{{ 'invite.do' | t }}</button>
        <button type="button" class="later" (click)="later()">{{ 'invite.later' | t }}</button>
        <small>{{ 'invite.after' | t }}</small>
      </section>
    }
  `,
  styles: [`
    :host { display: block; }
    .invite { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 6px; padding: 18px 16px; }
    .invite b { font-size: 16.5px; margin-top: 4px; text-wrap: pretty; }
    .invite p { margin: 0; color: var(--app-mu); font-size: 13.5px; line-height: 1.45; text-wrap: pretty; }
    .invite .ui-btn { width: 100%; margin-top: 10px; }
    .invite .later { background: none; border: 0; color: var(--ion-color-primary); font: inherit; font-size: 14px; font-weight: 600; padding: 8px; }
    .invite small { color: var(--app-mu); font-size: 12.5px; line-height: 1.4; text-wrap: pretty; }
  `],
})
export class NoticesInviteComponent {
  private readonly database = inject(DatabaseService);
  private readonly demo = inject(DemoService);
  private readonly steps = inject(FirstStepsService);

  /** Whether the phone can read notifications, and whether it may already. */
  private readonly phone = signal<{ supported: boolean; enabled: boolean }>({ supported: false, enabled: true });
  /** Accounts on record, and the day of the first. */
  private readonly accounts = signal<{ n: number; first: string | null }>({ n: 0, first: null });
  private readonly away = signal(readAway());

  /** "Primeros pasos" is on Inicio, carrying the same step. */
  private readonly stepsShowing = computed(() => {
    const { n, first } = this.accounts();
    if (this.steps.hidden() || n === 0 || first === null) return false;
    return (Date.now() - Date.parse(first.slice(0, 10))) / 86_400_000 < NEW_FOR_DAYS;
  });

  readonly shown = computed(() => {
    const phone = this.phone();
    return phone.supported && !phone.enabled && !this.away() && !this.demo.active()
      && this.accounts().n > 0 && !this.stepsShowing();
  });

  constructor() {
    effect(() => {
      this.database.dataVersion();
      if (this.database.status() !== 'ready') return;
      void untracked(() => this.load());
    });
    // Coming back from Android's screen: the card goes once access is given.
    if (Capacitor.isNativePlatform()) {
      void App.addListener('appStateChange', ({ isActive }) => { if (isActive) void this.readPhone(); });
    }
  }

  private async load(): Promise<void> {
    try {
      const row = await this.database.driver.queryOne<{ n: number; first: string | null }>(
        'SELECT COUNT(*) AS n, MIN(created_at) AS first FROM accounts');
      this.accounts.set({ n: row?.n ?? 0, first: row?.first ?? null });
    } catch {
      this.accounts.set({ n: 0, first: null });
    }
    await this.readPhone();
  }

  private async readPhone(): Promise<void> {
    try {
      const { supported } = await BankNotifications.isSupported();
      if (!supported) return this.phone.set({ supported: false, enabled: true });
      const { enabled } = await BankNotifications.isEnabled();
      this.phone.set({ supported: true, enabled });
    } catch {
      this.phone.set({ supported: false, enabled: true });
    }
  }

  /** Android's own screen where reading notifications is allowed. */
  async allow(): Promise<void> {
    await BankNotifications.openSettings();
  }

  later(): void {
    this.away.set(true);
    try { localStorage.setItem(PUT_AWAY, '1'); } catch { /* it shows again next time */ }
  }
}

function readAway(): boolean {
  try { return localStorage.getItem(PUT_AWAY) === '1'; } catch { return false; }
}
