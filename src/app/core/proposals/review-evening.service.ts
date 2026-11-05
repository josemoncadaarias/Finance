/**
 * "Tienes movimientos por revisar" at the end of the day (Jose, 2026-11-05):
 * at 8 p.m., while something still waits in Movimientos por revisar, the
 * phone says so. One waiting: its words and figure, and a tap opens that
 * movement; several: how many, and a tap opens the list with them unfolded.
 *
 * Worked out again on every change to the data, so saving the last one takes
 * the notice back before it rings. It counts what the app has already read:
 * a bank message that arrives with the app closed rings as "Movimiento
 * detectado" on its own and joins the count the next time the app opens.
 * Never with the sample data. Local only.
 */
import { Injectable, effect, inject, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications, type ActionPerformed } from '@capacitor/local-notifications';

import { DatabaseService } from '../database/database.service';
import { formatMoney } from '../database/money';
import { DemoService } from '../demo/demo.service';
import { I18nService } from '../i18n/i18n.service';

const KIND = 'reviewEvening';
const CHANNEL = 'review_evening';
const NOTICE_ID = 7_300_002;
/** The hour it rings. */
export const EVENING_HOUR = 20;

/** When the next evening notice rings: today at 8 p.m., or tomorrow once that passed. */
export function nextEvening(now: Date): Date {
  const at = new Date(now.getFullYear(), now.getMonth(), now.getDate(), EVENING_HOUR, 0, 0, 0);
  if (at.getTime() <= now.getTime()) at.setDate(at.getDate() + 1);
  return at;
}

@Injectable({ providedIn: 'root' })
export class ReviewEveningService {
  private readonly database = inject(DatabaseService);
  private readonly demo = inject(DemoService);
  private readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  private running = false;
  private again = false;

  constructor() {
    if (!Capacitor.isNativePlatform()) return;
    void LocalNotifications.addListener('localNotificationActionPerformed', action => this.tapped(action));
    effect(() => {
      this.database.dataVersion();
      this.demo.active();
      this.i18n.language();
      if (this.database.status() !== 'ready') return;
      untracked(() => void this.plan());
    });
  }

  private async plan(): Promise<void> {
    if (this.running) { this.again = true; return; }
    this.running = true;
    try {
      do {
        this.again = false;
        await this.planOnce();
      } while (this.again);
    } catch {
      // The list still says what waits.
    } finally {
      this.running = false;
    }
  }

  private async planOnce(): Promise<void> {
    const mine = (await LocalNotifications.getPending()).notifications
      .filter(n => (n.extra as { kind?: string } | undefined)?.kind === KIND);
    if (mine.length) await LocalNotifications.cancel({ notifications: mine.map(n => ({ id: n.id })) });
    const waiting = this.demo.active() ? [] : await this.database.driver.query<{ id: number; description: string | null; amount_minor: number | null; currency: string | null }>(
      `SELECT p.id, p.description, p.amount_minor, a.currency_code AS currency
       FROM movement_proposals p LEFT JOIN accounts a ON a.id = p.account_id
       WHERE p.status = 'pending' ORDER BY p.id DESC`);
    if (waiting.length === 0) {
      // One already shown for movements now answered is taken off the phone.
      const shown = (await LocalNotifications.getDeliveredNotifications()).notifications
        .filter(n => (n.extra as { kind?: string } | undefined)?.kind === KIND);
      if (shown.length) await LocalNotifications.removeDeliveredNotifications({ notifications: shown });
      return;
    }
    if ((await LocalNotifications.checkPermissions()).display !== 'granted') return;
    await LocalNotifications.createChannel({
      id: CHANNEL, name: this.i18n.t('evening.channel'), description: this.i18n.t('evening.channel.about'),
      importance: 4, visibility: 0, vibration: true,
    });
    const one = waiting.length === 1 ? waiting[0] : null;
    const figure = one?.amount_minor != null
      ? formatMoney(Math.abs(one.amount_minor), one.currency ?? 'COP', { shown: true }).replace(/[.,]00$/, '')
      : null;
    const title = one
      ? this.i18n.t('evening.one.title')
      : this.i18n.t('evening.many.title', { count: waiting.length });
    const body = one
      ? (figure
        ? this.i18n.t('evening.one.body', { what: one.description?.trim() || this.i18n.t('evening.one.noWords'), amount: figure })
        : this.i18n.t('evening.one.bodyNoAmount', { what: one.description?.trim() || this.i18n.t('evening.one.noWords') }))
      : this.i18n.t('evening.many.body');
    await LocalNotifications.schedule({
      notifications: [{
        id: NOTICE_ID,
        title, body, largeBody: body,
        channelId: CHANNEL,
        smallIcon: 'ic_stat_movement',
        largeIcon: 'ic_notice_logo',
        iconColor: '#6378FF',
        autoCancel: true,
        extra: { kind: KIND, proposalId: one?.id ?? null },
        isExactNotification: false,
        schedule: { at: nextEvening(new Date()), allowWhileIdle: true },
      }],
    });
  }

  private tapped(action: ActionPerformed): void {
    const extra = action.notification.extra as { kind?: string; proposalId?: number | null } | undefined;
    if (extra?.kind !== KIND) return;
    const queryParams = extra.proposalId ? { proposal: extra.proposalId } : { open: 'pending' };
    void this.router.navigate(['/review'], { queryParams });
  }
}
