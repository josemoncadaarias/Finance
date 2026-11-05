/**
 * "Tu resumen de {mes} está listo" (Jose, 2026-11-05, after Lukas): on the
 * first day of a month the phone says the month that ended can be looked at,
 * and until it is, Más carries it with a dot, as "Movimientos por revisar"
 * does. There is no second report: it opens the Reporte on that month - its
 * figures against the month before, its two faces (Movimientos and
 * Rendimientos) and its spreadsheet - so nothing is worked out twice.
 *
 * Which month was looked at is kept on the device. A month with no movement
 * is no summary. Never with the sample data. Local only.
 */
import { Injectable, effect, inject, signal, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications, type ActionPerformed } from '@capacitor/local-notifications';

import { DatabaseService } from '../database/database.service';
import { DemoService } from '../demo/demo.service';
import { FilterService } from '../filters/filter.service';
import { fromIsoDay, isoDay, type Period } from '../filters/period';
import { I18nService } from '../i18n/i18n.service';

const SEEN_KEY = 'finance.monthSummary.seen';
const KIND = 'monthSummary';
const CHANNEL = 'month_summary';
/** One notice on the phone at a time, always this id. */
const NOTICE_ID = 7_300_001;
/** The hour the first day of the month rings. */
export const SUMMARY_HOUR = 9;

/** `YYYY-MM` of the month before the one `day` is in. */
export function monthBefore(day: Date): string {
  const at = new Date(day.getFullYear(), day.getMonth() - 1, 1);
  return `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}`;
}

/** The whole of a `YYYY-MM` month as a period. */
export function monthPeriod(month: string): Period {
  const [y, m] = month.split('-').map(Number);
  return { kind: 'month', from: isoDay(new Date(y, m - 1, 1)), to: isoDay(new Date(y, m, 0)) };
}

@Injectable({ providedIn: 'root' })
export class MonthSummaryService {
  private readonly database = inject(DatabaseService);
  private readonly demo = inject(DemoService);
  private readonly filter = inject(FilterService);
  private readonly i18n = inject(I18nService);
  private readonly router = inject(Router);

  /** The month whose summary waits to be looked at, `YYYY-MM`, or null. */
  readonly pending = signal<string | null>(null);

  constructor() {
    if (Capacitor.isNativePlatform()) {
      void LocalNotifications.addListener('localNotificationActionPerformed', action => this.tapped(action));
    }
    effect(() => {
      this.database.dataVersion();
      this.demo.active();
      this.i18n.language();
      if (this.database.status() !== 'ready') return;
      untracked(() => void this.refresh());
    });
  }

  /** "octubre", "October": the month's name in the app's language. */
  nameOf(month: string): string {
    return fromIsoDay(`${month}-01`).toLocaleDateString(this.i18n.dateLocale(), { month: 'long' });
  }

  /** The Reporte on that month, every account, and the month marked as seen. */
  open(month: string): void {
    this.filter.selectAccount(null);
    this.filter.period.set(monthPeriod(month));
    this.markSeen(month);
    void this.router.navigateByUrl('/report');
  }

  /** Whatever opens the Reporte on the waiting month has looked at it. */
  seenIfShown(period: Period): void {
    const waiting = this.pending();
    if (!waiting) return;
    const whole = monthPeriod(waiting);
    if (period.from === whole.from && period.to === whole.to) this.markSeen(waiting);
  }

  private markSeen(month: string): void {
    try { localStorage.setItem(SEEN_KEY, month); } catch { /* seen again next time */ }
    if (this.pending() === month) this.pending.set(null);
  }

  private seen(): string | null {
    try { return localStorage.getItem(SEEN_KEY); } catch { return null; }
  }

  private async refresh(): Promise<void> {
    try {
      const now = new Date();
      const last = monthBefore(now);
      if (this.demo.active() || this.seen() === last) {
        this.pending.set(null);
      } else {
        const whole = monthPeriod(last);
        const row = await this.database.driver.queryOne<{ n: number }>(
          'SELECT COUNT(*) AS n FROM transactions WHERE occurred_on BETWEEN ? AND ?', [whole.from, whole.to]);
        this.pending.set((row?.n ?? 0) > 0 ? last : null);
      }
      if (Capacitor.isNativePlatform()) await this.schedule(now);
    } catch {
      // Más simply shows no summary waiting.
    }
  }

  /** One notice for the first day of next month, about the month running now. */
  private async schedule(now: Date): Promise<void> {
    const mine = (await LocalNotifications.getPending()).notifications
      .filter(n => (n.extra as { kind?: string } | undefined)?.kind === KIND);
    if (mine.length) await LocalNotifications.cancel({ notifications: mine.map(n => ({ id: n.id })) });
    if (this.demo.active()) return;
    // Asked for by the reminders and the cards; this one only uses what was allowed.
    if ((await LocalNotifications.checkPermissions()).display !== 'granted') return;
    const accounts = await this.database.driver.queryOne<{ n: number }>('SELECT COUNT(*) AS n FROM accounts WHERE archived = 0');
    if ((accounts?.n ?? 0) === 0) return;
    await LocalNotifications.createChannel({
      id: CHANNEL, name: this.i18n.t('summary.channel'), description: this.i18n.t('summary.channel.about'),
      importance: 3, visibility: 0,
    });
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const at = new Date(now.getFullYear(), now.getMonth() + 1, 1, SUMMARY_HOUR, 0, 0, 0);
    const name = this.nameOf(month);
    await LocalNotifications.schedule({
      notifications: [{
        id: NOTICE_ID,
        title: this.i18n.t('summary.notice.title', { month: name }),
        body: this.i18n.t('summary.notice.body', { month: name }),
        largeBody: this.i18n.t('summary.notice.body', { month: name }),
        channelId: CHANNEL,
        smallIcon: 'ic_stat_movement',
        largeIcon: 'ic_notice_logo',
        iconColor: '#6378FF',
        autoCancel: true,
        extra: { kind: KIND, month },
        isExactNotification: false,
        schedule: { at, allowWhileIdle: true },
      }],
    });
  }

  private tapped(action: ActionPerformed): void {
    const extra = action.notification.extra as { kind?: string; month?: string } | undefined;
    if (extra?.kind !== KIND || !extra.month) return;
    const go = () => this.open(extra.month!);
    if (this.database.status() === 'ready') go();
    else setTimeout(go, 1500);
  }
}
