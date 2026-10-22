/**
 * Reminders, for every screen and for the phone (Jose, 2026-10-22).
 *
 * Read on every change to the data. A reminder that follows a fixed payment
 * is settled by itself when that payment shows up in its month. The phone's
 * alarms are planned again each time, like the card's payment day
 * (`CardDueService`): "🔔 {título} · $ X" with Registrar, Ya lo pagué and
 * Mañana; a tap opens the movement form filled in, and saving it settles the
 * month. Nothing is ever written as a movement by a reminder (rule 22), and
 * nothing rings while the sample data is loaded.
 */
import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications, type ActionPerformed } from '@capacitor/local-notifications';

import { DatabaseService } from '../database/database.service';
import { formatMoney } from '../database/money';
import { I18nService } from '../i18n/i18n.service';
import { DemoService } from '../demo/demo.service';
import { ComposeService } from '../ui/compose.service';
import { fromIsoDay, isoDay } from '../filters/period';
import { merchantKeyOf } from '../proposals/merchant';
import { RemindersRepository, type ReminderInput } from './reminders.repository';
import {
  addDays, dueWithin, monthOfDay, nextOccurrence, reminderNoticeId, ringPlans, settledBy,
  type Occurrence, type Reminder,
} from './reminders';

const CHANNEL = 'reminders';
const ACTIONS = 'reminder';
const KIND = 'reminder';
/** Occurrences already rung at once, as `id@dueOn`: one each. */
const TOLD_KEY = 'finance.reminders.told';
const ASKED_KEY = 'finance.reminders.asked';

@Injectable({ providedIn: 'root' })
export class RemindersService {
  private readonly database = inject(DatabaseService);
  private readonly i18n = inject(I18nService);
  private readonly demo = inject(DemoService);
  private readonly compose = inject(ComposeService);
  private readonly router = inject(Router);

  readonly all = signal<Reminder[]>([]);
  /** What each active reminder is waiting on now. */
  readonly occurrences = computed(() => {
    const today = isoDay(new Date());
    return this.all().map(r => nextOccurrence(r, today)).filter((o): o is Occurrence => o !== null);
  });
  /** Late, or due within a week: Inicio's "Pendientes". */
  readonly soon = computed(() => dueWithin(this.occurrences(), isoDay(new Date())));

  /** The form opened from a reminder: saving it settles that month. */
  private awaiting: { id: number; month: string; savesBefore: number } | null = null;
  private ready: Promise<void> | null = null;
  private readyIn = '';
  private running = false;
  private again = false;

  constructor() {
    if (Capacitor.isNativePlatform()) {
      // Registered first thing, so a tap that opened the app is not missed.
      void LocalNotifications.addListener('localNotificationActionPerformed', action => void this.tapped(action));
    }
    effect(() => {
      this.database.dataVersion();
      this.demo.active();
      this.i18n.language();
      if (this.database.status() !== 'ready') return;
      untracked(() => void this.refresh());
    });
    // The form opened from a reminder closed: saved, the month is settled.
    effect(() => {
      const open = this.compose.entry() !== null;
      const saves = this.compose.saved();
      untracked(() => {
        if (open || !this.awaiting) return;
        const a = this.awaiting;
        this.awaiting = null;
        if (saves > a.savesBefore) void this.markDone(a.id, a.month);
      });
    });
  }

  private get repo(): RemindersRepository {
    return new RemindersRepository(this.database.driver);
  }

  // ---- Changes ---------------------------------------------------------------

  async create(input: ReminderInput): Promise<number> {
    const id = await this.repo.create(input);
    this.database.dataChanged();
    return id;
  }

  async update(id: number, input: ReminderInput): Promise<void> {
    await this.repo.update(id, input);
    this.database.dataChanged();
  }

  async remove(id: number): Promise<void> {
    await this.repo.remove(id);
    this.database.dataChanged();
  }

  async setActive(id: number, active: boolean): Promise<void> {
    await this.repo.setActive(id, active);
    this.database.dataChanged();
  }

  /** "Ya lo pagué": this occurrence is settled; the next month rings again. */
  async markDone(id: number, month: string): Promise<void> {
    await this.repo.markDone(id, month);
    this.database.dataChanged();
  }

  async undoDone(id: number, previous: string | null): Promise<void> {
    await this.repo.undoDone(id, previous);
    this.database.dataChanged();
  }

  /** "Mañana": this occurrence rings again tomorrow at its hour. */
  async snooze(id: number, day = addDays(isoDay(new Date()), 1)): Promise<void> {
    await this.repo.snooze(id, day);
    this.database.dataChanged();
  }

  /** The reminder following a fixed payment, if there is one. */
  byShop(shop: string): Reminder | null {
    return this.all().find(r => r.shop === shop) ?? null;
  }

  /** The movement form, filled in with what the reminder says; saved only by the person. */
  openForm(o: Occurrence): void {
    const r = o.reminder;
    this.awaiting = { id: r.id, month: o.month, savesBefore: this.compose.saved() };
    this.compose.open('expense', {
      preferredAccountId: r.accountId,
      start: { amountMinor: r.amountMinor ?? 0, onDate: isoDay(new Date()), note: r.note ?? r.title, categoryId: r.categoryId },
    });
  }

  // ---- Reading and ringing ----------------------------------------------------

  private async refresh(): Promise<void> {
    if (this.running) { this.again = true; return; }
    this.running = true;
    try {
      do {
        this.again = false;
        await this.refreshOnce();
      } while (this.again);
    } catch {
      // The screen still lists them; the phone is told on the next change.
    } finally {
      this.running = false;
    }
  }

  private async refreshOnce(): Promise<void> {
    const today = isoDay(new Date());
    let list = await this.repo.all();
    // A fixed payment seen in its month settles that month by itself.
    const following = list.map(r => nextOccurrence(r, today)).filter((o): o is Occurrence => !!o && !!o.reminder.shop);
    if (following.length > 0) {
      const months = [...new Set(following.map(o => o.month))];
      const seen = new Map<string, string[]>();
      for (const month of months) {
        const rows = await this.database.driver.query<{ description: string | null }>(
          `SELECT description FROM transactions WHERE amount_minor < 0 AND occurred_on BETWEEN ? AND ?`,
          [`${month}-01`, `${month}-31`]);
        seen.set(month, [...new Set(rows.map(row => merchantKeyOf(row.description)).filter(Boolean))]);
      }
      const settled = following.filter(o => settledBy(o, seen));
      for (const o of settled) await this.repo.markDone(o.reminder.id, o.month);
      if (settled.length > 0) list = await this.repo.all();
    }
    this.all.set(list);
    if (Capacitor.isNativePlatform()) await this.ring(list);
  }

  private async ring(list: readonly Reminder[]): Promise<void> {
    const now = new Date();
    const today = isoDay(now);
    const occurrences = this.demo.active() ? [] : list.map(r => nextOccurrence(r, today)).filter((o): o is Occurrence => o !== null);
    const plans = ringPlans(occurrences, today, now.getHours());

    // What this service put on the phone before goes; what still waits comes back.
    const pending = (await LocalNotifications.getPending()).notifications
      .filter(n => (n.extra as { kind?: string } | undefined)?.kind === KIND);
    if (pending.length) await LocalNotifications.cancel({ notifications: pending.map(n => ({ id: n.id })) });
    const waiting = new Set(occurrences.map(o => o.reminder.id));
    const shown = (await LocalNotifications.getDeliveredNotifications()).notifications
      .filter(n => (n.extra as { kind?: string; id?: number } | undefined)?.kind === KIND
        && !waiting.has((n.extra as { id: number }).id));
    if (shown.length) await LocalNotifications.removeDeliveredNotifications({ notifications: shown });
    if (plans.length === 0) return;

    const told = this.told();
    const toSend = plans.filter(p => p.when === 'later' || !told.has(`${p.occurrence.reminder.id}@${p.occurrence.dueOn}`));
    if (toSend.length === 0 || !(await this.allowed())) return;
    await this.setUp();
    await LocalNotifications.schedule({
      notifications: toSend.map(p => {
        const o = p.occurrence;
        const at = fromIsoDay(o.ringOn);
        at.setHours(o.reminder.hour, 0, 0, 0);
        return {
          id: reminderNoticeId(o.reminder.id),
          title: this.titleOf(o),
          body: this.bodyOf(o),
          largeBody: this.bodyOf(o),
          channelId: CHANNEL,
          smallIcon: 'ic_stat_movement',
          largeIcon: 'ic_notice_logo',
          iconColor: '#6378FF',
          actionTypeId: ACTIONS,
          autoCancel: true,
          extra: { kind: KIND, id: o.reminder.id, month: o.month },
          // Inexact on purpose, as the card's: no "Alarms & reminders" permission.
          isExactNotification: false,
          ...(p.when === 'later' ? { schedule: { at, allowWhileIdle: true } } : {}),
        };
      }),
    });
    for (const p of toSend) told.add(`${p.occurrence.reminder.id}@${p.occurrence.dueOn}`);
    this.keep(told);
  }

  private titleOf(o: Occurrence): string {
    const r = o.reminder;
    return r.amountMinor
      ? this.i18n.t('reminder.notice.titleAmount', { title: r.title, amount: this.money(r.amountMinor) })
      : this.i18n.t('reminder.notice.title', { title: r.title });
  }

  private bodyOf(o: Occurrence): string {
    const date = fromIsoDay(o.dueOn).toLocaleDateString(this.i18n.dateLocale(), { weekday: 'long', day: 'numeric', month: 'long' });
    const today = isoDay(new Date());
    const key = o.dueOn === today ? 'reminder.notice.today' : o.dueOn < today ? 'reminder.notice.late' : 'reminder.notice.soon';
    return this.i18n.t(key, { date });
  }

  private async tapped(action: ActionPerformed): Promise<void> {
    const extra = action.notification.extra as { kind?: string; id?: number; month?: string } | undefined;
    if (extra?.kind !== KIND || !extra.id) return;
    if (action.actionId === 'done') { await this.markDone(extra.id, extra.month ?? monthOfDay(isoDay(new Date()))); return; }
    if (action.actionId === 'tomorrow') { await this.snooze(extra.id); return; }
    // A tap or "Registrar": the form, filled in, once the reminders are read.
    for (let i = 0; i < 40 && this.all().length === 0; i++) await new Promise(r => setTimeout(r, 250));
    const o = this.occurrences().find(x => x.reminder.id === extra.id);
    if (o) this.openForm(o);
    else void this.router.navigate(['/reminders']);
  }

  /** The channel and the three buttons, made once per opening and language. */
  private setUp(): Promise<void> {
    if (this.readyIn !== this.i18n.language()) { this.ready = null; this.readyIn = this.i18n.language(); }
    this.ready ??= (async () => {
      await LocalNotifications.createChannel({
        id: CHANNEL, name: this.i18n.t('reminder.channel'), description: this.i18n.t('reminder.channel.about'),
        importance: 4, visibility: 0, vibration: true,
      });
      await LocalNotifications.registerActionTypes({
        types: [{ id: ACTIONS, actions: [
          { id: 'register', title: this.i18n.t('reminder.notice.register'), foreground: true },
          { id: 'done', title: this.i18n.t('reminder.notice.done'), foreground: true },
          { id: 'tomorrow', title: this.i18n.t('reminder.notice.tomorrow'), foreground: true },
        ] }],
      });
    })().catch(() => undefined);
    return this.ready;
  }

  private money(minor: number): string {
    return formatMoney(minor, 'COP', { shown: true }).replace(/[.,]00$/, '');
  }

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
    this.write(TOLD_KEY, JSON.stringify([...told].slice(-120)));
  }

  private read(key: string): string | null {
    try { return localStorage.getItem(key); } catch { return null; }
  }

  private write(key: string, value: string): void {
    try { localStorage.setItem(key, value); } catch { /* a reminder may ring twice; nothing breaks */ }
  }
}
