/**
 * Reading the banks' messages, as a pending row of Inicio's balance card.
 *
 * It began as a card of its own under the balance (mockup 57g; Jose,
 * 2026-11-11: his partner never knew the bank's notices could be read).
 * Jose, 2026-11-19: on his own phone it was right - Android had taken the
 * access away and nothing said so - but a big card was too much. Now it is a
 * row inside "Pendientes" (`app-attention-home`), which counts it:
 *
 * - `lost`: the app was reading a bank (a message proposed, or a source tied
 *   to an account) and the notification access is off now. Red: messages are
 *   being missed.
 * - `sms`: SMS senders are being read and the SMS permission is gone. Red too.
 * - `invite`: nothing was ever read, the access is off, there is an account.
 *   Amber, with an X ("Ahora no") that puts it away for good on this device.
 *
 * Not shown with the sample data, nor while "Primeros pasos" is on Inicio (it
 * carries the same step for a new app). Android only.
 */

import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { App } from '@capacitor/app';
import { DEVICE } from '../../core/device/device';
import { IonIcon } from '@ionic/angular';

import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { DatabaseService } from '../../core/database/database.service';
import { DemoService } from '../../core/demo/demo.service';
import { BankNotifications } from '../../core/notifications/bank-notifications';
import { FirstStepsService } from '../../core/ui/first-steps.service';
import { NEW_FOR_DAYS } from '../../core/ui/first-steps';
import { BadgeComponent } from '../../shared/ui/badge.component';

/** Where "Ahora no" is kept on the device. */
const PUT_AWAY = 'finance.noticesInvite.away';

export type NoticeNeed = 'lost' | 'sms' | 'invite';

const WORDS = {
  lost: { title: 'invite.lost.title', text: 'invite.lost.text' },
  sms: { title: 'invite.sms.title', text: 'invite.sms.text' },
  invite: { title: 'invite.invite.title', text: 'invite.invite.text' },
} as const;

@Component({
  selector: 'app-notices-invite',
  standalone: true,
  imports: [TranslatePipe, BadgeComponent, IonIcon],
  template: `
    @if (needs().length > 0) {
      <div class="ui-list" data-tour="notices-invite">
        @for (need of needs(); track need) {
          <div class="ui-row line">
            <button type="button" class="go" (click)="fix(need)">
              <app-badge shape="ci" [size]="40" [builtin]="need === 'sms' ? 'chatbox-outline' : 'notifications-outline'"
                         [fixed]="need === 'invite' ? '#6378ff' : '#ff6b6b'"></app-badge>
              <span class="ui-tx">
                <span class="kind" [class.late]="need !== 'invite'">{{ 'invite.kind' | t }}</span>
                <b class="wrap">{{ words[need].title | t }}</b>
                <small class="wrap">{{ words[need].text | t }}</small>
              </span>
              <ion-icon class="ui-chev" name="chevron-forward-outline"></ion-icon>
            </button>
            @if (need === 'invite') {
              <button type="button" class="away" [attr.aria-label]="'invite.later' | t" (click)="later()">
                <ion-icon name="close-outline"></ion-icon>
              </button>
            }
          </div>
        }
      </div>
    }
  `,
  styles: [`
    :host { display: block; }
    .line { display: flex; align-items: center; gap: 4px; }
    .go { flex: 1; min-width: 0; display: flex; align-items: center; gap: 12px; background: none; border: 0;
          padding: 0; font: inherit; color: inherit; text-align: left; cursor: pointer; }
    .ui-tx { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
    .wrap { text-wrap: pretty; }
    small { color: var(--app-mu); font-size: 13px; line-height: 1.35; }
    .kind {
      font-size: 11px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase;
      display: flex; align-items: center; gap: 5px; color: var(--app-yel);
    }
    .kind::before { content: ''; width: 7px; height: 7px; border-radius: 50%; background: currentColor; flex: none; }
    .kind.late { color: var(--app-red); }
    .away { background: none; border: 0; color: var(--app-mu); font-size: 20px; padding: 6px; cursor: pointer; flex: none; }
  `],
})
export class NoticesInviteComponent {
  readonly words = WORDS;
  private readonly database = inject(DatabaseService);
  private readonly demo = inject(DemoService);
  private readonly steps = inject(FirstStepsService);

  /** What the phone says: can it read notifications, may it, may it read SMS. */
  private readonly phone = signal({ supported: false, enabled: true, smsGranted: true, smsWatched: false });
  /** Accounts on record, and the day of the first. */
  private readonly accounts = signal<{ n: number; first: string | null }>({ n: 0, first: null });
  /** Some bank's message was ever read here, or a source tied to an account. */
  private readonly usedBanks = signal(true);
  private readonly away = signal(readAway());

  /** "Primeros pasos" is on Inicio, carrying the same step. */
  private readonly stepsShowing = computed(() => {
    const { n, first } = this.accounts();
    if (this.steps.hidden() || n === 0 || first === null) return false;
    return (Date.now() - Date.parse(first.slice(0, 10))) / 86_400_000 < NEW_FOR_DAYS;
  });

  /** What is missing, most urgent first. */
  readonly needs = computed<NoticeNeed[]>(() => {
    const phone = this.phone();
    if (!phone.supported || this.demo.active() || this.accounts().n === 0) return [];
    const out: NoticeNeed[] = [];
    if (!phone.enabled && this.usedBanks()) out.push('lost');
    if (phone.smsWatched && !phone.smsGranted) out.push('sms');
    if (!phone.enabled && !this.usedBanks() && !this.away() && !this.stepsShowing()) out.push('invite');
    return out;
  });
  /** Something is being missed (not a mere invitation). */
  readonly urgent = computed(() => this.needs().some(n => n !== 'invite'));

  constructor() {
    effect(() => {
      this.database.dataVersion();
      if (this.database.status() !== 'ready') return;
      void untracked(() => this.load());
    });
    // Coming back from Android's screen: the row goes once access is given.
    if (DEVICE.native) {
      void App.addListener('appStateChange', ({ isActive }) => { if (isActive) void this.readPhone(); });
    }
  }

  private async load(): Promise<void> {
    try {
      const row = await this.database.driver.queryOne<{ n: number; first: string | null }>(
        'SELECT COUNT(*) AS n, MIN(created_at) AS first FROM accounts');
      this.accounts.set({ n: row?.n ?? 0, first: row?.first ?? null });
      const used = await this.database.driver.queryOne<{ n: number }>(
        `SELECT (SELECT COUNT(*) FROM movement_proposals WHERE source = 'notification')
              + (SELECT COUNT(*) FROM settings WHERE key = 'notices.sourceAccounts'
                   AND value NOT IN ('{}', '', 'null')) AS n`);
      this.usedBanks.set((used?.n ?? 0) > 0);
    } catch {
      this.accounts.set({ n: 0, first: null });
      this.usedBanks.set(true);
    }
    await this.readPhone();
  }

  private async readPhone(): Promise<void> {
    try {
      const { supported } = await BankNotifications.isSupported();
      if (!supported) return this.phone.set({ supported: false, enabled: true, smsGranted: true, smsWatched: false });
      const [{ enabled }, { granted }, { senders }] = await Promise.all([
        BankNotifications.isEnabled(), BankNotifications.smsAccess(), BankNotifications.senders()]);
      const smsWatched = senders.some(s => s.package === 'sms' && s.watched && !s.hidden);
      this.phone.set({ supported: true, enabled, smsGranted: granted, smsWatched });
    } catch {
      this.phone.set({ supported: false, enabled: true, smsGranted: true, smsWatched: false });
    }
  }

  /** Android's own screen where the access is given back. */
  async fix(need: NoticeNeed): Promise<void> {
    if (need === 'sms') {
      const { granted } = await BankNotifications.askSms();
      // Android stops asking once refused twice: then the app's own page.
      if (!granted) await BankNotifications.openAppSettings();
      await this.readPhone();
      return;
    }
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
