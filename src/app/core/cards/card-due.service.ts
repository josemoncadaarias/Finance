/**
 * The phone's reminder on a card's payment day (Jose, 2026-10-15): "💳 Hoy
 * pagas {tarjeta} · $ X", what is left of the statement and from which
 * cut-off, with "Pagar ahora" and "Ver la tarjeta" - the shape of the
 * "Movimiento detectado" notice (the app's icon, its colour, an emoji).
 *
 * Scheduled ahead with the phone's own alarms, so it rings with the app
 * closed, and worked out again on every change to the data: a payment saved
 * takes back a reminder on its way, and one already shown. Only for cards
 * with both days set, and never while the sample data is loaded. Local only:
 * no internet, no server.
 */
import { Injectable, effect, inject, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications, type ActionPerformed } from '@capacitor/local-notifications';

import { DatabaseService } from '../database/database.service';
import { formatMoney } from '../database/money';
import { I18nService } from '../i18n/i18n.service';
import { DemoService } from '../demo/demo.service';
import { isoDay, fromIsoDay } from '../filters/period';
import { loadCards } from './card-data';
import { DUE_HOUR, duePlans, dueNoticeId, type DuePlan } from './due-reminder';

const CHANNEL = 'card_due';
const ACTIONS = 'card_due';
/** Reminders already scheduled or shown, as `account@dueOn`: one each, ever. */
const TOLD_KEY = 'finance.cardDue.told';
/** The permission is asked once, not on every pass. */
const ASKED_KEY = 'finance.cardDue.asked';
const KIND = 'cardDue';

@Injectable({ providedIn: 'root' })
export class CardDueService {
  private readonly database = inject(DatabaseService);
  private readonly i18n = inject(I18nService);
  private readonly demo = inject(DemoService);
  private readonly router = inject(Router);
  private ready: Promise<void> | null = null;
  private readyIn = '';
  private running = false;
  private again = false;

  constructor() {
    if (!Capacitor.isNativePlatform()) return;
    // Registered first thing, so a tap that opened the app is not missed.
    void LocalNotifications.addListener('localNotificationActionPerformed', action => this.tapped(action));
    effect(() => {
      this.database.dataVersion();
      this.demo.active();
      this.i18n.language();
      if (this.database.status() !== 'ready') return;
      untracked(() => void this.plan());
    });
  }

  private tapped(action: ActionPerformed): void {
    const extra = action.notification.extra as { kind?: string; accountId?: number } | undefined;
    if (extra?.kind !== KIND || !extra.accountId) return;
    void this.router.navigate(['/debts', extra.accountId], action.actionId === 'pay' ? { queryParams: { pay: 1 } } : {});
  }

  /** The channel and the two buttons, made once per opening. */
  private setUp(): Promise<void> {
    // The buttons' words follow the app's language.
    if (this.readyIn !== this.i18n.language()) { this.ready = null; this.readyIn = this.i18n.language(); }
    this.ready ??= (async () => {
      await LocalNotifications.createChannel({
        id: CHANNEL, name: this.i18n.t('cardDue.channel'), description: this.i18n.t('cardDue.channel.about'),
        importance: 4, visibility: 0, vibration: true,
      });
      await LocalNotifications.registerActionTypes({
        types: [{ id: ACTIONS, actions: [
          { id: 'pay', title: this.i18n.t('cardDue.pay'), foreground: true },
          { id: 'view', title: this.i18n.t('cardDue.view'), foreground: true },
        ] }],
      });
    })().catch(() => undefined);
    return this.ready;
  }

  /** One pass at a time; a change arriving mid-pass runs one more after it. */
  private async plan(): Promise<void> {
    if (this.running) { this.again = true; return; }
    this.running = true;
    try {
      do {
        this.again = false;
        await this.planOnce();
      } while (this.again);
    } catch {
      // A phone that refuses is told nothing; the card's page still says it.
    } finally {
      this.running = false;
    }
  }

  private async planOnce(): Promise<void> {
    const now = new Date();
    const today = isoDay(now);
    const cards = this.demo.active() ? [] : await loadCards(this.database.driver, today);
    const plans = duePlans(cards.map(card => ({ accountId: card.account.id, statement: card.statement })), today, now.getHours());
    const names = new Map(cards.map(card => [card.account.id, card.account]));

    // Whatever this service put on the phone before goes; what is still owed comes back.
    const owed = new Set(plans.map(p => p.accountId));
    const pending = (await LocalNotifications.getPending()).notifications
      .filter(n => (n.extra as { kind?: string } | undefined)?.kind === KIND);
    if (pending.length) await LocalNotifications.cancel({ notifications: pending.map(n => ({ id: n.id })) });
    // A reminder already shown for a statement now paid is taken off the phone.
    const shown = (await LocalNotifications.getDeliveredNotifications()).notifications
      .filter(n => (n.extra as { kind?: string; accountId?: number } | undefined)?.kind === KIND
        && !owed.has((n.extra as { accountId: number }).accountId));
    if (shown.length) await LocalNotifications.removeDeliveredNotifications({ notifications: shown });
    if (plans.length === 0) return;

    const told = this.told();
    const toSend = plans.filter(p => p.when === 'later' || !told.has(`${p.accountId}@${p.dueOn}`));
    if (toSend.length === 0 || !(await this.allowed())) return;
    await this.setUp();

    await LocalNotifications.schedule({
      notifications: toSend.map(p => {
        const account = names.get(p.accountId)!;
        const at = fromIsoDay(p.dueOn);
        at.setHours(DUE_HOUR, 0, 0, 0);
        return {
          id: dueNoticeId(p.accountId),
          title: this.i18n.t('cardDue.title', { card: account.name, amount: this.money(p.remainingMinor, account.currency_code) }),
          body: this.bodyOf(p, account.currency_code),
          largeBody: this.bodyOf(p, account.currency_code),
          channelId: CHANNEL,
          smallIcon: 'ic_stat_movement',
          largeIcon: 'ic_notice_logo',
          iconColor: '#6378FF',
          actionTypeId: ACTIONS,
          autoCancel: true,
          extra: { kind: KIND, accountId: p.accountId },
          // Inexact on purpose: an exact alarm would send the person to Android's
          // "Alarms & reminders" settings first; a few minutes late is fine for this.
          isExactNotification: false,
          ...(p.when === 'later' ? { schedule: { at, allowWhileIdle: true } } : {}),
        };
      }),
    });
    for (const p of toSend) told.add(`${p.accountId}@${p.dueOn}`);
    this.keep(told);
  }

  private bodyOf(p: DuePlan, currency: string): string {
    const left = this.money(p.remainingMinor, currency);
    const cut = fromIsoDay(p.cutOn).toLocaleDateString(this.i18n.dateLocale(), { day: 'numeric', month: 'long' });
    return p.paidMinor > 0
      ? this.i18n.t('cardDue.bodyPart', { paid: this.money(p.paidMinor, currency), amount: left, cut })
      : this.i18n.t('cardDue.body', { amount: left, cut });
  }

  /** "$ 491.125", cents dropped when there are none, as the movement notice does. */
  private money(minor: number, currency: string): string {
    return formatMoney(minor, currency, { shown: true }).replace(/[.,]00$/, '');
  }

  /** Allowed to post: asked once, and only once there is something to say. */
  private async allowed(): Promise<boolean> {
    const now = await LocalNotifications.checkPermissions();
    if (now.display === 'granted') return true;
    if (now.display === 'denied' || this.read(ASKED_KEY) === '1') return false;
    this.write(ASKED_KEY, '1');
    return (await LocalNotifications.requestPermissions()).display === 'granted';
  }

  private told(): Set<string> {
    try { return new Set(JSON.parse(this.read(TOLD_KEY) ?? '[]') as string[]); } catch { return new Set(); }
  }

  private keep(told: Set<string>): void {
    this.write(TOLD_KEY, JSON.stringify([...told].slice(-60)));
  }

  private read(key: string): string | null {
    try { return localStorage.getItem(key); } catch { return null; }
  }

  private write(key: string, value: string): void {
    try { localStorage.setItem(key, value); } catch { /* a reminder may repeat; nothing breaks */ }
  }
}
