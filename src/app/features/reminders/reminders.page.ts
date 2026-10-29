/**
 * Recordatorios (Jose, 2026-10-22): what is coming, what is late, the fixed
 * payments the app can remind of, and a form to make or change one. Each
 * reminder rings on the phone and opens the movement form filled in; nothing
 * is saved without the person (rule 22).
 */
import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { Location } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { IonContent, IonDatetime, IonIcon, IonModal } from '@ionic/angular';

import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { I18nService } from '../../core/i18n/i18n.service';
import { DatabaseService } from '../../core/database/database.service';
import { AccountsRepository } from '../../core/database/repositories/accounts.repository';
import { CategoriesRepository } from '../../core/database/repositories/categories.repository';
import type { AccountRow, CategoryRow } from '../../core/database/types';
import { formatMoney } from '../../core/database/money';
import { AmountBuffer } from '../entry/amount-buffer';
import { AmountInputDirective } from '../../shared/ui/amount-input.directive';
import { DateFieldComponent } from '../../shared/ui/date-field.component';
import { BadgeComponent } from '../../shared/ui/badge.component';
import { AskButtonComponent } from '../../shared/ui/ask-button.component';
import { ConfirmComponent } from '../../shared/confirm/confirm.component';
import { AccountPickerComponent } from '../../shared/account-picker/account-picker.component';
import { CategorySheetComponent } from '../../shared/category-sheet/category-sheet.component';
import { ToastService } from '../../shared/ui/toast.service';
import { RemindersService } from '../../core/reminders/reminders.service';
import { addDays, dayIn, monthOfDay, nextOccurrence, shiftMonth, type Occurrence, type Reminder, type Repeat } from '../../core/reminders/reminders';
import { AssistantService } from '../../core/assistant/assistant.service';
import { Capacitor } from '@capacitor/core';
import type { FixedPayment } from '../../core/assistant/recurring';
import { merchantKeyOf } from '../../core/proposals/merchant';
import { fromIsoDay, isoDay } from '../../core/filters/period';

/** The next day of the month `day` falls on, from `today`. */
function nextDue(today: string, day: number): string {
  const here = dayIn(monthOfDay(today), day);
  return here >= today ? here : dayIn(shiftMonth(monthOfDay(today), 1), day);
}

/** The hours offered to ring at. */
const HOURS = [7, 8, 9, 12, 18, 20];
const BEFORE = [0, 1, 3] as const;

@Component({
  selector: 'app-reminders',
  templateUrl: './reminders.page.html',
  styleUrls: ['./reminders.page.scss'],
  imports: [TranslatePipe, IonContent, IonDatetime, IonIcon, IonModal, BadgeComponent, AskButtonComponent, ConfirmComponent,
    AccountPickerComponent, CategorySheetComponent, DateFieldComponent, AmountInputDirective],
})
export class RemindersPage {
  readonly reminders = inject(RemindersService);
  private readonly database = inject(DatabaseService);
  readonly i18n = inject(I18nService);
  private readonly assistant = inject(AssistantService);
  private readonly toast = inject(ToastService);
  private readonly location = inject(Location);
  private readonly router = inject(Router);

  readonly hours = HOURS;
  readonly before = BEFORE;
  readonly days = Array.from({ length: 31 }, (_, i) => i + 1);

  readonly accounts = signal<AccountRow[]>([]);
  readonly categories = signal<CategoryRow[]>([]);
  /** Fixed payments with no reminder yet: "¿Te aviso de estos?". */
  readonly suggestions = signal<FixedPayment[]>([]);

  readonly upcoming = computed(() => [...this.reminders.occurrences()].sort((a, b) => a.dueOn.localeCompare(b.dueOn)));
  readonly paused = computed(() => this.reminders.all().filter(r => !r.active));
  readonly finished = computed(() => this.reminders.all().filter(r => r.active && r.repeat === 'once' && r.doneMonth));

  /** The reminder whose actions are open. */
  readonly picked = signal<Occurrence | Reminder | null>(null);
  readonly deleting = signal<Reminder | null>(null);

  // ---- The form -------------------------------------------------------------
  readonly editing = signal<number | null | 'new'>(null);
  readonly title = signal('');
  readonly amount = signal(new AmountBuffer());
  readonly repeat = signal<Repeat>('monthly');
  readonly day = signal(5);
  readonly onDate = signal<string>(addDays(isoDay(new Date()), 1));
  readonly daysBefore = signal<number>(0);
  readonly hour = signal(8);
  readonly minute = signal(0);
  readonly pickingTime = signal(false);
  /** A time not among the quick ones. */
  readonly customTime = computed(() => this.minute() !== 0 || !HOURS.includes(this.hour()));
  /** The time sheet's value: today at the hour chosen. */
  readonly timeValue = computed(() => `${isoDay(new Date())}T${String(this.hour()).padStart(2, '0')}:${String(this.minute()).padStart(2, '0')}:00`);
  /**
   * The month the reminder being edited is already settled for. Editing does
   * not reopen it (Jose, 2026-10-29: a reminder set for the very minute never
   * rang, and the form said it would): the form says so, and offers to ring
   * this month too.
   */
  private readonly editingDone = signal<string | null>(null);
  /** Settled because a payment of its shop is on record this month. */
  readonly paidByShop = signal(false);
  readonly remindAgain = signal(false);
  readonly doneThisMonth = computed(() =>
    this.repeat() === 'monthly' && !this.remindAgain() && (this.editingDone() ?? '') >= this.thisMonth);

  /** When the form's reminder would ring next, the way the phone works it out. */
  private readonly ringAt = computed(() => {
    const today = isoDay(new Date());
    const draft: Reminder = {
      id: 0, title: '', amountMinor: null, accountId: null, categoryId: null, note: null,
      repeat: this.repeat(), dayOfMonth: this.day(), onDate: this.onDate(), hour: this.hour(), minute: this.minute(),
      daysBefore: this.daysBefore(), shop: null, active: true,
      doneMonth: this.repeat() === 'monthly' && !this.remindAgain() ? this.editingDone() : null, snoozedTo: null,
    };
    const ringOn = nextOccurrence(draft, today)?.ringOn
      ?? addDays(this.repeat() === 'once' ? this.onDate() : nextDue(today, this.day()), -this.daysBefore());
    const at = fromIsoDay(ringOn);
    at.setHours(this.hour(), this.minute(), 0, 0);
    return at;
  });
  readonly ringsNow = computed(() => this.ringAt().getTime() <= Date.now());
  readonly accountId = signal<number | null>(null);
  readonly categoryId = signal<number | null>(null);
  private shop: string | null = null;
  readonly pickingAccount = signal(false);
  readonly pickingCategory = signal(false);
  readonly tried = signal(false);

  readonly missing = computed(() => this.title().trim() === '');

  constructor() {
    effect(() => {
      this.database.dataVersion();
      if (this.database.status() !== 'ready') return;
      void untracked(() => this.load());
    });
    // `?new=1` (from the assistant or Más) opens the form at once.
    const route = inject(ActivatedRoute).snapshot.queryParamMap;
    if (route.get('new')) setTimeout(() => this.newOne(), 200);
  }

  private async load(): Promise<void> {
    const db = this.database.driver;
    const [accounts, categories] = await Promise.all([new AccountsRepository(db).list(), new CategoriesRepository(db).list()]);
    this.accounts.set(accounts.filter(a => !a.archived));
    this.categories.set(categories.filter(c => !c.archived));
    try {
      const r = await this.assistant.recurring();
      const taken = new Set(this.reminders.all().map(x => x.shop).filter(Boolean));
      this.suggestions.set(r.fixed.filter(f => f.accountId !== null && !taken.has(merchantKeyOf(f.name))).slice(0, 6));
    } catch {
      this.suggestions.set([]);
    }
  }

  back(): void {
    this.location.back();
  }

  // ---- Words ------------------------------------------------------------------

  money(minor: number): string {
    return formatMoney(minor, 'COP');
  }

  accountName(id: number | null): string {
    return id === null ? '' : this.accounts().find(a => a.id === id)?.name ?? '';
  }

  category(id: number | null): CategoryRow | null {
    return id === null ? null : this.categories().find(c => c.id === id) ?? null;
  }

  /** "El 5 de cada mes" or "El 25 de octubre". */
  whenOf(r: Reminder): string {
    if (r.repeat === 'monthly') return this.i18n.t('reminders.monthly', { day: r.dayOfMonth ?? 1 });
    return this.i18n.t('reminders.once', { date: this.date(r.onDate ?? isoDay(new Date())) });
  }

  /** "vence mañana", "venció el 5 de octubre, hace 3 días". */
  dueOf(o: Occurrence): string {
    const today = isoDay(new Date());
    const days = Math.round((fromIsoDay(o.dueOn).getTime() - fromIsoDay(today).getTime()) / 86_400_000);
    const date = this.date(o.dueOn);
    if (days === 0) return this.i18n.t('home.due.today');
    if (days === 1) return this.i18n.t('home.due.tomorrow');
    if (days === -1) return this.i18n.t('home.due.yesterday');
    if (days < 0) return this.i18n.t('home.due.late', { date, count: -days });
    return this.i18n.t('home.due.in', { date, count: days });
  }

  lineOf(o: Occurrence): string {
    return [o.reminder.amountMinor ? this.money(o.reminder.amountMinor) : '', this.whenOf(o.reminder), this.dueOf(o)].filter(Boolean).join(' · ');
  }

  ringsOf(r: Reminder): string {
    const at = this.hourText(r.hour, r.minute ?? 0);
    return r.daysBefore === 0 ? this.i18n.t('reminders.rings.same', { hour: at })
      : this.i18n.t(r.daysBefore === 1 ? 'reminders.rings.before.one' : 'reminders.rings.before', { count: r.daysBefore, hour: at });
  }

  /** "Sonará el miércoles 22 de octubre a las 9:30 p. m.", or at once when that has passed. */
  ringsWhen(): string {
    if (this.ringsNow()) return this.i18n.t('reminders.form.ringsNow');
    const at = this.ringAt();
    const date = at.toLocaleDateString(this.i18n.dateLocale(), { weekday: 'long', day: 'numeric', month: 'long' }).replace(',', '');
    const said = this.i18n.t('reminders.form.ringsOn', { date, hour: this.hourText(at.getHours(), at.getMinutes()) });
    // "a las 9:30 p. m." already ends the sentence.
    return said.endsWith('.') ? said : `${said}.`;
  }

  pickTime(value: string | null): void {
    this.pickingTime.set(false);
    const m = /T?(\d{2}):(\d{2})/.exec(value ?? '');
    if (!m) return;
    this.hour.set(Number(m[1]));
    this.minute.set(Number(m[2]));
  }

  hourText(hour: number, minute = 0): string {
    const d = new Date(2026, 0, 1, hour, minute);
    return d.toLocaleTimeString(this.i18n.dateLocale(), { hour: 'numeric', minute: '2-digit' });
  }

  date(day: string): string {
    return fromIsoDay(day).toLocaleDateString(this.i18n.dateLocale(), { day: 'numeric', month: 'long' });
  }

  occurrenceOf(r: Reminder): Occurrence | null {
    return nextOccurrence(r, isoDay(new Date()));
  }

  isOccurrence(x: Occurrence | Reminder): x is Occurrence {
    return 'reminder' in x;
  }

  reminderOf(x: Occurrence | Reminder): Reminder {
    return this.isOccurrence(x) ? x.reminder : x;
  }

  // ---- Actions ------------------------------------------------------------------

  register(o: Occurrence): void {
    this.picked.set(null);
    this.reminders.openForm(o);
  }

  async done(o: Occurrence): Promise<void> {
    this.picked.set(null);
    const before = o.reminder.doneMonth;
    await this.reminders.markDone(o.reminder.id, o.month);
    this.toast.say(this.i18n.t(o.reminder.repeat === 'once' ? 'reminders.doneOnce' : 'reminders.doneMonth'), 4000,
      { action: { label: this.i18n.t('reminders.undo'), run: () => void this.reminders.undoDone(o.reminder.id, before) } });
  }

  async tomorrow(o: Occurrence): Promise<void> {
    this.picked.set(null);
    await this.reminders.snooze(o.reminder.id);
    this.toast.say(this.i18n.t('reminders.snoozed', { hour: this.hourText(o.reminder.hour, o.reminder.minute ?? 0) }), 3000);
  }

  async setActive(r: Reminder, active: boolean): Promise<void> {
    this.picked.set(null);
    await this.reminders.setActive(r.id, active);
  }

  async remove(): Promise<void> {
    const r = this.deleting();
    this.deleting.set(null);
    this.picked.set(null);
    if (r) await this.reminders.remove(r.id);
  }

  /** "Avisarme" on a fixed payment: every month on its usual day, its usual amount. */
  async remindOf(f: FixedPayment): Promise<void> {
    await this.reminders.create({
      title: f.name, amountMinor: f.averageMinor > 0 ? f.averageMinor : null, accountId: f.accountId, categoryId: f.categoryId,
      note: f.name, repeat: 'monthly', dayOfMonth: f.day ?? 1, onDate: null, hour: 8, daysBefore: 1, shop: merchantKeyOf(f.name) || null,
    });
    this.toast.say(this.i18n.t('reminders.suggested', { name: f.name, day: f.day ?? 1 }), 3500);
  }

  // ---- The form -----------------------------------------------------------------

  newOne(): void {
    this.picked.set(null);
    this.shop = null;
    this.title.set('');
    this.amount.set(new AmountBuffer());
    this.repeat.set('monthly');
    this.day.set(Math.min(28, new Date().getDate()));
    this.onDate.set(addDays(isoDay(new Date()), 1));
    this.daysBefore.set(0);
    this.hour.set(8);
    this.minute.set(0);
    this.accountId.set(null);
    this.categoryId.set(null);
    this.tried.set(false);
    this.editingDone.set(null);
    this.remindAgain.set(false);
    this.paidByShop.set(false);
    this.editing.set('new');
  }

  edit(r: Reminder): void {
    this.picked.set(null);
    this.shop = r.shop;
    this.title.set(r.title);
    this.amount.set(r.amountMinor ? AmountBuffer.from(r.amountMinor) : new AmountBuffer());
    this.repeat.set(r.repeat);
    this.day.set(r.dayOfMonth ?? 1);
    this.onDate.set(r.onDate ?? addDays(isoDay(new Date()), 1));
    this.daysBefore.set(r.daysBefore);
    this.hour.set(r.hour);
    this.minute.set(r.minute ?? 0);
    this.accountId.set(r.accountId);
    this.categoryId.set(r.categoryId);
    this.tried.set(false);
    this.remindAgain.set(false);
    this.paidByShop.set(false);
    this.editingDone.set(r.repeat === 'monthly' ? r.doneMonth : null);
    if (r.repeat === 'monthly' && r.shop && r.doneMonth === this.thisMonth) void this.readPaidByShop(r.shop);
    this.editing.set(r.id);
  }

  private async readPaidByShop(shop: string): Promise<void> {
    const rows = await this.database.driver.query<{ description: string | null }>(
      'SELECT description FROM transactions WHERE amount_minor < 0 AND occurred_on BETWEEN ? AND ?',
      [`${this.thisMonth}-01`, `${this.thisMonth}-31`]);
    this.paidByShop.set(rows.some(row => merchantKeyOf(row.description) === shop));
  }

  async save(): Promise<void> {
    this.tried.set(true);
    if (this.missing()) return;
    const id = this.editing();
    const minor = this.amount().minor;
    const input = {
      title: this.title().trim(), amountMinor: minor > 0 ? minor : null, accountId: this.accountId(), categoryId: this.categoryId(),
      note: this.title().trim(), repeat: this.repeat(), dayOfMonth: this.day(), onDate: this.onDate(), hour: this.hour(),
      minute: this.minute(), daysBefore: this.daysBefore(), shop: this.shop,
    };
    if (id === 'new') await this.reminders.create(input);
    else if (typeof id === 'number') {
      const before = this.reminders.all().find(r => r.id === id);
      await this.reminders.update(id, { ...input, active: before?.active ?? true });
      if (this.remindAgain()) await this.reminders.undoDone(id, null);
    }
    this.editing.set(null);
    this.toast.say(this.i18n.t('reminders.saved'), 2500);
  }

  /** Today's month, for the form's line under "Cada mes". */
  readonly thisMonth = monthOfDay(isoDay(new Date()));

  /** Only a phone can ring. */
  readonly native = Capacitor.isNativePlatform();
  readonly testing = signal(false);
  readonly tested = signal<{ result: 'sent' | 'off' | 'channelOff' | 'failed'; detail?: string } | null>(null);

  /** "Probar el aviso": one notice now, and what the phone did with it. */
  async test(): Promise<void> {
    this.testing.set(true);
    try {
      this.tested.set(await this.reminders.testNotice());
    } finally {
      this.testing.set(false);
    }
  }

  readonly testIcon = computed(() => this.tested()?.result === 'sent' ? 'checkmark-circle-outline' : 'notifications-off-outline');
  readonly testTitle = computed(() => {
    const r = this.tested()?.result;
    return r === 'sent' ? this.i18n.t('reminders.test.sent') : r === 'off' ? this.i18n.t('reminders.test.off')
      : r === 'channelOff' ? this.i18n.t('reminders.test.channelOff') : this.i18n.t('reminders.test.failed');
  });
  readonly testHint = computed(() => {
    const r = this.tested()?.result;
    return r === 'sent' ? this.i18n.t('reminders.test.sent.hint') : r === 'off' ? this.i18n.t('reminders.test.off.hint')
      : r === 'channelOff' ? this.i18n.t('reminders.test.channelOff.hint') : this.i18n.t('reminders.test.failed.hint');
  });

  openNoticeSettings(): void {
    void this.reminders.openNoticeSettings();
  }

  goAssistant(): void {
    void this.router.navigate(['/assistant']);
  }
}
