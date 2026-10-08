/**
 * Where the app hears about movements: every app and SMS sender the phone has
 * seen, grouped by the bank (account) each one is (rule 22; mockup 19,
 * approved by Jose 2026-10-08).
 *
 * Folding sections, all closed on opening: "Tus bancos" (sources being read,
 * by the account they turned out to be - learned from what the person saved,
 * or said here with "¿De qué cuenta es?"), "Sin cuenta todavía", "Encontrados
 * en tu celular" (SMS senders with money, not yet read), "Otras apps" and
 * "Ocultas". Tapping a source shows its last messages and what became of
 * each - proposed, saved, thrown away, or ignored and why - which replaced
 * the raw list of everything kept (Jose: it no longer served anything).
 */

import { Component, DestroyRef, computed, effect, inject, signal, viewChild } from '@angular/core';
import { Location, NgTemplateOutlet } from '@angular/common';
import { App } from '@capacitor/app';
import { IonContent, IonIcon, IonSpinner, IonModal } from '@ionic/angular';

import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { BadgeComponent } from '../../shared/ui/badge.component';
import { JumpComponent } from '../../shared/ui/jump.component';
import { ConfirmComponent } from '../../shared/confirm/confirm.component';
import { foldText } from '../../core/text/fold-text';
import {
  BankNotifications, SMS_INBOX, type CaughtNotification, type SeenApp, type SeenSender,
} from '../../core/notifications/bank-notifications';
import { DatabaseService } from '../../core/database/database.service';
import { AccountsRepository } from '../../core/database/repositories/accounts.repository';
import { ProposalsRepository, type ProposalStatus } from '../../core/database/repositories/proposals.repository';
import type { AccountRow } from '../../core/database/types';
import { formatMoney } from '../../core/database/money';
import { noticeKey, noticeSource } from '../../core/notices/notice-proposals';
import { readNotice } from '../../core/notices/read-notice';
import { AccountPickerComponent } from '../../shared/account-picker/account-picker.component';

/** One place the app hears from: an app, or an SMS sender inside one. */
export interface Source {
  /** As proposals know it: the package, or `package|sender`. */
  key: string;
  kind: 'app' | 'sms';
  name: string;
  line: string;
  last: number;
  watched: boolean;
  hidden: boolean;
  /** A messaging app not ticked whole: its banks are chosen by sender. */
  bySender: boolean;
  app: SeenApp | null;
  sender: SeenSender | null;
  /** The accounts it turned out to be, the person's own word first. */
  accounts: number[];
}

type SectionKey = 'banks' | 'unknown' | 'found' | 'others' | 'hidden';

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [NgTemplateOutlet, TranslatePipe, ConfirmComponent, BadgeComponent, JumpComponent, AccountPickerComponent, IonContent, IonIcon, IonSpinner, IonModal],
  templateUrl: './notifications.page.html',
  styleUrls: ['./notifications.page.scss'],
})
export class NotificationsPage {
  readonly i18n = inject(I18nService);
  private readonly location = inject(Location);
  private readonly database = inject(DatabaseService);

  readonly info = signal<string | null>(null);

  back(): void {
    this.location.back();
  }

  /** While choosing, the selection bar takes the tab bar's place. */
  private readonly hideTabs = effect(() => {
    document.body.classList.toggle('choosing', this.selecting());
  });

  ngOnDestroy(): void {
    document.body.classList.remove('choosing');
  }

  /** A picture for an app, from ordinary words in its name - never a list of banks. */
  appIcon(pkg: string, label: string): string {
    const name = foldText(`${label} ${pkg}`);
    const words: [RegExp, string][] = [
      [/bank|banco|bancolombia|finan|pay|pago|nequi|davi/, 'business-outline'],
      [/card|tarjeta|credit|visa|master/, 'card-outline'],
      [/wallet|billetera|cartera/, 'wallet-outline'],
      [/chat|messag|mensaj|whatsapp|telegram|sms/, 'chatbubble-outline'],
      [/mail|correo|gmail|outlook/, 'mail-outline'],
      [/game|juego|play/, 'game-controller-outline'],
      [/shop|tienda|store|market/, 'bag-handle-outline'],
    ];
    for (const [pattern, icon] of words) if (pattern.test(name)) return icon;
    return 'apps-outline';
  }

  appSeed(pkg: string): number {
    let hash = 0;
    for (const char of pkg) hash = (hash * 31 + char.charCodeAt(0)) | 0;
    return Math.abs(hash);
  }

  /** "9:12 a. m.". */
  hour(at: number): string {
    return new Date(at).toLocaleTimeString(this.i18n.dateLocale(), { hour: 'numeric', minute: '2-digit' });
  }

  /** "7 de oct". */
  private short(at: number): string {
    return new Date(at).toLocaleDateString(this.i18n.dateLocale(), { day: 'numeric', month: 'short' });
  }

  /**
   * "Viernes 25 de septiembre", with the year when it is not this one, and
   * "Hoy" or "Ayer" in front (Jose, 2026-10-02).
   */
  private dayTitle(date: Date): string {
    const locale = this.i18n.dateLocale();
    const weekday = date.toLocaleDateString(locale, { weekday: 'long' });
    const month = date.toLocaleDateString(locale, { month: 'long' });
    let text = this.i18n.t('ui.review.dayTitle', { weekday, day: date.getDate(), month });
    const today = new Date();
    if (date.getFullYear() !== today.getFullYear()) text += ` ${date.getFullYear()}`;
    const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
    if (date.toDateString() === today.toDateString()) return this.i18n.t('ui.today.day', { day: text });
    if (date.toDateString() === yesterday.toDateString()) return this.i18n.t('ui.yesterday.day', { day: text });
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  readonly loading = signal(true);
  /** False in a browser and on iOS, which is an ordinary state. */
  readonly supported = signal(false);
  readonly enabled = signal(false);
  /** When Android last handed a notification over, connected or dropped the listener. */
  readonly listener = signal({ heardAt: 0, connectedAt: 0, disconnectedAt: 0 });

  /**
   * Whether the listener is really listening, said in one line (Jose,
   * 2026-10-05), in amber with the way to fix it when it is not.
   */
  readonly listening = computed(() => {
    const { heardAt, connectedAt, disconnectedAt } = this.listener();
    if (disconnectedAt > 0 && disconnectedAt > connectedAt) {
      return { warn: true, text: this.i18n.t('ui.notifications.stopped', { when: this.moment(disconnectedAt) }) };
    }
    if (heardAt === 0) return null;
    if (Date.now() - heardAt > 6 * 3600_000) {
      return { warn: true, text: this.i18n.t('ui.notifications.quiet', { when: this.moment(heardAt) }) };
    }
    return { warn: false, text: this.i18n.t('ui.notifications.heard', { when: this.moment(heardAt) }) };
  });

  /** "Hoy · lunes 5 de octubre, 12:03 p. m.". */
  private moment(at: number): string {
    return `${this.dayTitle(new Date(at))}, ${this.hour(at)}`;
  }

  readonly apps = signal<SeenApp[]>([]);
  readonly senders = signal<SeenSender[]>([]);
  readonly caught = signal<CaughtNotification[]>([]);
  readonly accounts = signal<AccountRow[]>([]);
  /** Which accounts each source turned out to be, from what was saved. */
  private readonly learnedAccounts = signal<ReadonlyMap<string, number[]>>(new Map());
  /** Which account the person said each source is. */
  private readonly assigned = signal<ReadonlyMap<string, number>>(new Map());
  private readonly outcomes = signal<ReadonlyMap<string, { status: ProposalStatus | 'joined'; amount: number | null }>>(new Map());
  /** Whether the SMS inbox may be read (null until asked). */
  readonly smsGranted = signal<boolean | null>(null);

  /** Android's dialog for reading SMS, then the list again. */
  async askSms(): Promise<void> {
    this.smsGranted.set((await BankNotifications.askSms()).granted);
    await this.look();
  }

  // ---------------------------------------------------------------------------
  // The sources, by bank (mockup 19)
  // ---------------------------------------------------------------------------

  readonly search = signal('');
  private readonly term = computed(() => foldText(this.search()));

  private accountName(id: number): string {
    return this.accounts().find(account => account.id === id)?.name ?? '';
  }

  account(id: number): AccountRow | null {
    return this.accounts().find(account => account.id === id) ?? null;
  }

  private accountsOf(key: string): number[] {
    const alive = new Set(this.accounts().filter(account => !account.archived).map(account => account.id));
    const told = this.assigned().get(key);
    if (told !== undefined && alive.has(told)) return [told];
    return (this.learnedAccounts().get(key) ?? []).filter(id => alive.has(id));
  }

  /** Every app and sender as one kind of row. */
  readonly sources = computed<Source[]>(() => {
    const out: Source[] = [];
    for (const app of this.apps()) {
      out.push({
        key: app.package, kind: 'app', name: app.label, last: app.last,
        line: this.i18n.t('ui.notifications.appLine', { count: app.count, package: app.package }),
        watched: app.watched, hidden: app.hidden, bySender: !!app.messaging && !app.watched,
        app, sender: null, accounts: this.accountsOf(app.package),
      });
    }
    for (const one of this.senders()) {
      const key = noticeSource({ package: one.package, sender: one.sender });
      out.push({
        key, kind: 'sms', name: one.sender, last: one.last, line: this.senderLine(one),
        watched: one.watched, hidden: one.hidden, bySender: false,
        app: null, sender: one, accounts: this.accountsOf(key),
      });
    }
    const term = this.term();
    return out
      .filter(one => term.length === 0 || foldText(`${one.name} ${one.key}`).includes(term))
      .sort((a, b) => b.last - a.last);
  });

  private sectionOf(one: Source): SectionKey {
    if (one.hidden) return 'hidden';
    if (one.watched) return one.accounts.length > 0 ? 'banks' : 'unknown';
    return one.kind === 'sms' ? 'found' : 'others';
  }

  readonly bySection = computed(() => {
    const map = new Map<SectionKey, Source[]>();
    for (const one of this.sources()) {
      const key = this.sectionOf(one);
      map.set(key, [...(map.get(key) ?? []), one]);
    }
    return map;
  });

  of(section: SectionKey): Source[] {
    return this.bySection().get(section) ?? [];
  }

  /** "Tus bancos": the sources read, grouped by the accounts they are. */
  readonly banks = computed(() => {
    const groups = new Map<string, { key: string; ids: number[]; title: string; sources: Source[]; last: number }>();
    for (const one of this.of('banks')) {
      const ids = [...one.accounts].sort((a, b) => a - b);
      const key = ids.join('-');
      const group = groups.get(key) ?? {
        key, ids, title: ids.map(id => this.accountName(id)).join(' · '), sources: [], last: 0,
      };
      group.sources.push(one);
      group.last = Math.max(group.last, one.last);
      groups.set(key, group);
    }
    return [...groups.values()].sort((a, b) => b.last - a.last);
  });

  bankLine(bank: { sources: Source[]; last: number }): string {
    const sources = this.i18n.t(bank.sources.length === 1 ? 'ui.notifications.count.sourceOne' : 'ui.notifications.count.sources',
      { count: bank.sources.length });
    return this.i18n.t('ui.notifications.bank.line', { sources, last: this.short(bank.last) });
  }

  sectionTitle(section: SectionKey): string {
    return this.i18n.t(section === 'banks' ? 'ui.notifications.sec.banks'
      : section === 'unknown' ? 'ui.notifications.sec.unknown'
      : section === 'found' ? 'ui.notifications.sec.found'
      : section === 'others' ? 'ui.notifications.sec.others' : 'ui.notifications.sec.hidden');
  }

  /** What each closed section says it holds. */
  sectionLine(section: SectionKey): string {
    const list = this.of(section);
    if (section === 'banks') {
      const banks = this.banks().length;
      return `${this.i18n.t(banks === 1 ? 'ui.notifications.count.bankOne' : 'ui.notifications.count.banks', { count: banks })} · ${
        this.i18n.t(list.length === 1 ? 'ui.notifications.count.sourceOne' : 'ui.notifications.count.sources', { count: list.length })}`;
    }
    const apps = list.filter(one => one.kind === 'app').length;
    const senders = list.length - apps;
    const parts: string[] = [];
    if (apps > 0) parts.push(this.i18n.t(apps === 1 ? 'ui.notifications.appsOne' : 'ui.notifications.apps', { count: apps }));
    if (senders > 0) parts.push(this.i18n.t(senders === 1 ? 'ui.notifications.sendersOne' : 'ui.notifications.senders', { count: senders }));
    const what = parts.join(' · ');
    const hint = section === 'unknown' ? 'ui.notifications.sec.unknown.line'
      : section === 'found' ? 'ui.notifications.sec.found.line'
      : section === 'others' ? 'ui.notifications.sec.others.line' : null;
    return hint ? `${what} · ${this.i18n.t(hint)}` : what;
  }

  // --- folding: everything starts closed (Jose, 2026-10-05) -----------------

  private readonly openState = signal<ReadonlyMap<string, boolean>>(new Map());

  isOpen(key: string): boolean {
    if (this.term().length > 0) return true;
    return this.openState().get(key) ?? false;
  }

  /** Section keys, for templates that name them beside an icon. */
  readonly K = { banks: 'banks' } as const;

  /** The chevron of a folding row. */
  chev(key: string): string {
    return this.isOpen(key) ? 'chevron-up-outline' : 'chevron-down-outline';
  }

  toggleOpen(key: string): void {
    const next = new Map(this.openState());
    next.set(key, !this.isOpen(key));
    this.openState.set(next);
  }

  private readonly foldKeys = computed(() => [
    ...(['banks', 'unknown', 'found', 'others', 'hidden'] as const).filter(key => this.of(key).length > 0),
    ...this.banks().map(bank => `bank:${bank.key}`),
  ]);

  readonly jumpFolded = computed<boolean | null>(() => {
    const keys = this.foldKeys();
    return keys.length > 0 ? keys.every(key => !this.isOpen(key)) : null;
  });

  foldEverything(): void {
    const open = this.jumpFolded() === true;
    this.openState.set(new Map(this.foldKeys().map(key => [key, open])));
  }

  /**
   * What the SMS part says while no sender is listed, one line per messaging
   * app: no words reach the app, nothing with money yet, or nothing yet.
   */
  readonly smsWaiting = computed(() => {
    if (this.senders().some(one => !one.hidden)) return [];
    return this.apps().filter(app => app.messaging).map(source => {
      const app = source.hidden
        ? { ...source, label: this.i18n.t('ui.notifications.sms.hiddenApp', { app: source.label }) }
        : source;
      const blank = app.blank ?? 0, plain = app.plain ?? 0, money = app.money ?? 0;
      if (blank > 0 && money === 0) {
        return { warn: true, text: this.i18n.t(blank === 1 ? 'ui.notifications.sms.blankOne' : 'ui.notifications.sms.blank', { count: blank, app: app.label }) };
      }
      if (plain > 0 && money === 0) {
        return { warn: false, text: this.i18n.t('ui.notifications.sms.plain', { app: app.label }) };
      }
      return { warn: false, text: this.i18n.t('ui.notifications.sms.none', { app: app.label }) };
    });
  });

  senderLine(one: SeenSender): string {
    if (one.package === SMS_INBOX) {
      return this.i18n.t(one.count === 1 ? 'ui.notifications.inboxLine.one' : 'ui.notifications.inboxLine',
        { count: one.count, last: this.short(one.last) });
    }
    return this.i18n.t(one.count === 1 ? 'ui.notifications.senderLine.one' : 'ui.notifications.senderLine',
      { count: one.count, app: one.app });
  }

  // --- reading one source, or keeping it -----------------------------------

  /** Starts or stops reading one source. */
  async watchSource(one: Source, on: boolean): Promise<void> {
    if (one.watched === on) return;
    if (one.sender) await BankNotifications.watchSender({ package: one.sender.package, sender: one.sender.sender, on });
    else if (one.app) await BankNotifications.watch({ package: one.app.package, on });
    await this.look();
  }

  /** Puts sources away; asked first only when something they said was kept. */
  async hideSources(list: Source[]): Promise<void> {
    if (list.length === 0) return;
    const keys = new Set(list.map(one => one.key));
    if (this.caught().some(kept => keys.has(noticeSource(kept)))) {
      this.hiding.set(list);
      this.asking.set('hide');
      return;
    }
    await this.putAway(list);
  }

  private async putAway(list: Source[]): Promise<void> {
    for (const one of list) {
      if (one.sender) await BankNotifications.hideSender({ package: one.sender.package, sender: one.sender.sender, on: true });
      else if (one.app) await BankNotifications.hide({ package: one.app.package, on: true });
    }
    this.stopSelecting();
    await this.look();
  }

  async unhide(one: Source): Promise<void> {
    if (one.sender) await BankNotifications.hideSender({ package: one.sender.package, sender: one.sender.sender, on: false });
    else if (one.app) await BankNotifications.hide({ package: one.app.package, on: false });
    await this.look();
  }

  // --- one source's page: its account and what became of its messages -----

  readonly openSource = signal<Source | null>(null);
  /** The source whose account is being chosen. */
  readonly pickingFor = signal<Source | null>(null);

  tapped(one: Source): void {
    if (this.selecting()) {
      this.toggle(one);
      return;
    }
    this.openSource.set(one);
  }

  /** The source on show, read again after a change. */
  readonly shown = computed(() => {
    const open = this.openSource();
    return open ? this.sources().find(one => one.key === open.key) ?? open : null;
  });

  /** Its last messages, each with what became of it. */
  readonly shownMessages = computed(() => {
    const source = this.shown();
    if (!source) return [];
    const outcomes = this.outcomes();
    return this.caught()
      .filter(one => noticeSource(one) === source.key)
      .sort((a, b) => b.postedAt - a.postedAt)
      .slice(0, 30)
      .map(one => ({ one, when: `${this.short(one.postedAt)} · ${this.hour(one.postedAt)}`, ...this.outcomeOf(one, outcomes) }));
  });

  private outcomeOf(
    one: CaughtNotification,
    outcomes: ReadonlyMap<string, { status: ProposalStatus | 'joined'; amount: number | null }>,
  ): { outcome: string; tone: 'grn' | 'blu' | 'mu' | 'yel' } {
    const found = outcomes.get(noticeKey(one));
    const amount = found?.amount == null ? '' : `${found.amount < 0 ? '−' : '+'}${formatMoney(Math.abs(found.amount), 'COP', { withSymbol: false })}`;
    if (found?.status === 'pending') return { outcome: this.i18n.t('ui.notifications.out.pending', { amount }), tone: 'yel' };
    if (found?.status === 'accepted') return { outcome: this.i18n.t('ui.notifications.out.accepted', { amount }), tone: 'grn' };
    if (found?.status === 'rejected') return { outcome: this.i18n.t('ui.notifications.out.rejected'), tone: 'mu' };
    if (found?.status === 'joined') return { outcome: this.i18n.t('ui.notifications.out.joined'), tone: 'blu' };
    const kind = readNotice(one.text, one.title).kind;
    if (kind === 'balance') return { outcome: this.i18n.t('ui.notifications.out.balance'), tone: 'mu' };
    if (kind === 'declined') return { outcome: this.i18n.t('ui.notifications.out.declined'), tone: 'mu' };
    if (kind === 'none') return { outcome: this.i18n.t('ui.notifications.out.none'), tone: 'mu' };
    return { outcome: this.i18n.t('ui.notifications.out.waiting'), tone: 'mu' };
  }

  /** "¿De qué cuenta es?" answered: remembered, and its waiting proposals take it. */
  async assign(account: AccountRow): Promise<void> {
    const source = this.pickingFor();
    this.pickingFor.set(null);
    if (!source || this.database.status() !== 'ready') return;
    await new ProposalsRepository(this.database.driver).assignSource(source.key, account.id);
    this.database.dataChanged();
    await this.look();
  }

  // --- choosing several -----------------------------------------------------

  readonly selecting = signal(false);
  private readonly selectedKeys = signal<ReadonlySet<string>>(new Set());

  /** What can be chosen: every source on show and not hidden. */
  private readonly choosable = computed(() => this.sources().filter(one => !one.hidden && !one.bySender));

  readonly selectedSources = computed(() => {
    const ticked = this.selectedKeys();
    return this.choosable().filter(one => ticked.has(one.key));
  });

  readonly choosableCount = computed(() => this.choosable().length);

  readonly allSelected = computed(() =>
    this.choosable().length > 0 && this.selectedSources().length === this.choosable().length);

  isSelected(one: Source): boolean {
    return this.selectedKeys().has(one.key);
  }

  toggle(one: Source): void {
    if (one.bySender || one.hidden) return;
    const next = new Set(this.selectedKeys());
    if (!next.delete(one.key)) next.add(one.key);
    this.selectedKeys.set(next);
  }

  startSelecting(one?: Source): void {
    this.selecting.set(true);
    this.selectedKeys.set(new Set(one ? [one.key] : []));
  }

  pressed(event: Event, one: Source): void {
    if (this.selecting()) return;
    event.preventDefault();
    this.startSelecting(one);
  }

  stopSelecting(): void {
    this.selecting.set(false);
    this.selectedKeys.set(new Set());
  }

  selectAll(): void {
    this.selectedKeys.set(this.allSelected() ? new Set() : new Set(this.choosable().map(one => one.key)));
  }

  async watchSelected(on: boolean): Promise<void> {
    for (const one of this.selectedSources()) {
      if (one.watched === on) continue;
      if (one.sender) await BankNotifications.watchSender({ package: one.sender.package, sender: one.sender.sender, on });
      else if (one.app) await BankNotifications.watch({ package: one.app.package, on });
    }
    this.stopSelecting();
    await this.look();
  }

  hideSelected(): void {
    void this.hideSources(this.selectedSources());
  }

  // --- the list's two arrows -----------------------------------------------

  private readonly content = viewChild(IonContent);

  async toTop(): Promise<void> {
    await this.content()?.scrollToTop(300);
  }

  async toBottom(): Promise<void> {
    await this.content()?.scrollToBottom(300);
  }

  readonly nothingFound = computed(() => this.term().length > 0 && this.sources().length === 0);

  // --- reading it all -------------------------------------------------------

  constructor() {
    const resumed = App.addListener('resume', () => void this.look());
    inject(DestroyRef).onDestroy(() => void resumed.then(handle => handle.remove()));
  }

  ionViewWillEnter(): void {
    void this.look();
  }

  /** The spinner only the first time; after that the list is replaced in place. */
  async look(): Promise<void> {
    if (!this.supported()) this.loading.set(true);
    try {
      const { supported } = await BankNotifications.isSupported();
      this.supported.set(supported);
      if (!supported) return;

      const { enabled, heardAt, connectedAt, disconnectedAt } = await BankNotifications.isEnabled();
      this.enabled.set(enabled);
      this.listener.set({ heardAt: heardAt ?? 0, connectedAt: connectedAt ?? 0, disconnectedAt: disconnectedAt ?? 0 });

      this.apps.set((await BankNotifications.apps()).apps);
      this.smsGranted.set((await BankNotifications.smsAccess()).granted);
      this.senders.set((await BankNotifications.senders()).senders);
      this.caught.set((await BankNotifications.caught()).caught);
      await this.readLedger();
    } finally {
      this.loading.set(false);
    }
  }

  /** What the app learned about each source, read once. */
  private async readLedger(): Promise<void> {
    if (this.database.status() !== 'ready') return;
    const db = this.database.driver;
    const proposals = new ProposalsRepository(db);
    const [accounts, answers, assigned, outcomes] = await Promise.all([
      new AccountsRepository(db).list(), proposals.noticeAnswers(), proposals.sourceAccounts(), proposals.noticeOutcomes(),
    ]);
    const counted = new Map<string, Map<number, number>>();
    for (const answer of answers) {
      const one = counted.get(answer.package) ?? new Map<number, number>();
      one.set(answer.account_id, (one.get(answer.account_id) ?? 0) + 1);
      counted.set(answer.package, one);
    }
    this.accounts.set(accounts);
    this.learnedAccounts.set(new Map([...counted].map(([key, ids]) =>
      [key, [...ids.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id)])));
    this.assigned.set(assigned);
    this.outcomes.set(outcomes);
  }

  async openSettings(): Promise<void> {
    await BankNotifications.openSettings();
  }

  // --- questions ------------------------------------------------------------

  readonly asking = signal<'hide' | null>(null);
  private readonly hiding = signal<Source[]>([]);

  async answered(): Promise<void> {
    const question = this.asking();
    this.asking.set(null);
    const list = this.hiding();
    this.hiding.set([]);
    if (question === 'hide') await this.putAway(list);
  }

  readonly askTitle = computed(() => {
    const list = this.hiding();
    return list.length === 1
      ? this.i18n.t('notifications.hide.sure', { app: list[0]?.name ?? '' })
      : this.i18n.t('notifications.hide.sureMany', { count: list.length });
  });

  readonly askBody = computed(() => this.i18n.t('notifications.hide.body'));

  readonly askConfirm = computed(() => this.i18n.t('notifications.hide.do'));

  cancelled(): void {
    this.asking.set(null);
    this.hiding.set([]);
  }
}
