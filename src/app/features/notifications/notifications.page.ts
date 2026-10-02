/**
 * What the banks actually post, shown raw.
 *
 * Rule 22's first step and nothing beyond it, in Jose's own words: read the
 * notifications his banks post and show them for a few days, interpreting
 * nothing. Half of them may be "open the app to see", and finding that out
 * here costs an afternoon; finding it out after a parser is written costs the
 * parser.
 *
 * So there is no movement, no amount, no category and no account on this
 * screen. There is a list of apps the phone has been seen posting from, a tick
 * beside the ones worth keeping, and the text of what they said. Everything
 * this screen learns goes into the design of the next step.
 */

import { Component, DestroyRef, computed, effect, inject, signal, viewChild } from '@angular/core';
import { Location } from '@angular/common';
import { App } from '@capacitor/app';
import { IonContent, IonIcon, IonSpinner, IonModal } from '@ionic/angular';

import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { BadgeComponent } from '../../shared/ui/badge.component';
import { JumpComponent } from '../../shared/ui/jump.component';
import { ConfirmComponent } from '../../shared/confirm/confirm.component';
import { foldText } from '../../core/text/fold-text';
import {
  BankNotifications, type CaughtNotification, type SeenApp, type SeenSender,
} from '../../core/notifications/bank-notifications';

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [TranslatePipe, ConfirmComponent, BadgeComponent, JumpComponent, IonContent, IonIcon, IonSpinner, IonModal],
  templateUrl: './notifications.page.html',
  styleUrls: ['./notifications.page.scss'],
})
export class NotificationsPage {
  readonly i18n = inject(I18nService);
  private readonly location = inject(Location);

  // ---------------------------------------------------------------------------
  // The redesign (mockups 7a-7l)
  // ---------------------------------------------------------------------------

  readonly face = signal<'apps' | 'caught'>('apps');
  readonly menuOpen = signal(false);
  readonly pickingApp = signal(false);
  readonly info = signal<string | null>(null);
  /** Which app's notices are on show; null is "Todas las apps". */
  readonly appFilter = signal<string | null>(null);

  back(): void {
    this.location.back();
  }

  setFace(face: 'apps' | 'caught'): void {
    this.face.set(face);
    if (face === 'caught') this.stopSelecting();
  }

  /** While choosing, the selection bar takes the tab bar's place. */
  private readonly hideTabs = effect(() => {
    document.body.classList.toggle('choosing', this.selecting());
  });

  ngOnDestroy(): void {
    document.body.classList.remove('choosing');
  }

  readonly appFilterApp = computed(() => this.apps().find(app => app.package === this.appFilter()) ?? null);

  /** The apps that have something kept, with how much, for the app list. */
  readonly appsWithCaught = computed(() => {
    const kept = new Map<string, number>();
    for (const one of this.caught()) kept.set(one.package, (kept.get(one.package) ?? 0) + 1);
    return this.apps().filter(app => kept.has(app.package))
      .map(app => ({ package: app.package, label: app.label, kept: kept.get(app.package) ?? 0 }));
  });

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

  /** What they said, by day, newest first; the first day open. */
  readonly caughtDays = computed(() => {
    const days = new Map<string, { key: string; title: string; items: CaughtNotification[] }>();
    const filter = this.appFilter();
    for (const one of this.newest()) {
      if (filter !== null && one.package !== filter) continue;
      const date = new Date(one.postedAt);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      const day = days.get(key) ?? { key, title: this.dayTitle(date), items: [] };
      day.items.push(one);
      days.set(key, day);
    }
    return [...days.values()];
  });

  private dayTitle(date: Date): string {
    const today = new Date();
    const same = date.toDateString() === today.toDateString();
    const weekday = date.toLocaleDateString(this.i18n.dateLocale(), { weekday: 'long' });
    const text = `${weekday} ${date.getDate()}`;
    const capital = text.charAt(0).toUpperCase() + text.slice(1);
    return same ? this.i18n.t('ui.today.day', { day: text }) : capital;
  }

  private readonly dayState = signal<ReadonlyMap<string, boolean>>(new Map());

  isDayOpen(key: string): boolean {
    const set = this.dayState().get(key);
    return set !== undefined ? set : this.caughtDays()[0]?.key === key;
  }

  toggleDay(key: string): void {
    const next = new Map(this.dayState());
    next.set(key, !this.isDayOpen(key));
    this.dayState.set(next);
  }

  readonly allDaysClosed = computed(() => this.caughtDays().every(day => !this.isDayOpen(day.key)));

  toggleAllDays(): void {
    const open = this.allDaysClosed();
    this.dayState.set(new Map(this.caughtDays().map(day => [day.key, open])));
  }

  readonly loading = signal(true);
  /** False in a browser and on iOS, which is an ordinary state. */
  readonly supported = signal(false);
  readonly enabled = signal(false);

  readonly apps = signal<SeenApp[]>([]);
  readonly caught = signal<CaughtNotification[]>([]);
  /** Senders inside messaging apps that texted amounts of money (rule 22, SMS). */
  readonly senders = signal<SeenSender[]>([]);

  readonly sortedSenders = computed(() => this.senders().filter(one => !one.hidden
    && (this.term().length === 0 || foldText(`${one.sender} ${one.app}`).includes(this.term())))
    .sort((one, other) => Number(other.watched) - Number(one.watched) || other.last - one.last));

  readonly hiddenSenders = computed(() => this.senders().filter(one => one.hidden)
    .sort((one, other) => one.sender.localeCompare(other.sender)));

  senderLine(one: SeenSender): string {
    return this.i18n.t(one.count === 1 ? 'ui.notifications.senderLine.one' : 'ui.notifications.senderLine',
      { count: one.count, app: one.app });
  }

  /** Starts or stops keeping what one sender says - never the whole messaging app. */
  async watchSender(one: SeenSender, on: boolean): Promise<void> {
    if (one.watched === on) return;
    await BankNotifications.watchSender({ package: one.package, sender: one.sender, on });
    await this.look();
  }

  /** Puts a sender away; asked first only when something it said was kept. */
  async hideSender(one: SeenSender): Promise<void> {
    if (this.caught().some(kept => kept.package === one.package && kept.sender === one.sender)) {
      this.hidingSender.set(one);
      this.asking.set('hideSender');
      return;
    }
    await BankNotifications.hideSender({ package: one.package, sender: one.sender, on: true });
    await this.look();
  }

  async unhideSender(one: SeenSender): Promise<void> {
    await BankNotifications.hideSender({ package: one.package, sender: one.sender, on: false });
    await this.look();
  }

  private readonly hidingSender = signal<SeenSender | null>(null);

  /** "1 app · 2 remitentes": what the hidden group holds. */
  readonly hiddenLine = computed(() => {
    const apps = this.hiddenApps().length;
    const senders = this.hiddenSenders().length;
    const parts: string[] = [];
    if (apps > 0) parts.push(this.i18n.t(apps === 1 ? 'ui.notifications.appsOne' : 'ui.notifications.apps', { count: apps }));
    if (senders > 0) parts.push(this.i18n.t(senders === 1 ? 'ui.notifications.sendersOne' : 'ui.notifications.senders', { count: senders }));
    return parts.join(' · ');
  });

  /** Which question is on screen, or null. */
  readonly asking = signal<'forgetCaught' | 'forgetEverything' | 'hide' | 'hideSender' | null>(null);
  /** The apps a "hide" question is about: one, or the ticked ones. */
  private readonly hiding = signal<SeenApp[]>([]);

  /**
   * Several apps answered at once (Jose, 2026-09-25): tick them, then keep
   * what they say, stop keeping it, or hide them. The same bar and gesture as
   * the review screen - "Seleccionar", or a long press on a row.
   */
  readonly selecting = signal(false);
  private readonly selectedPkgs = signal<ReadonlySet<string>>(new Set());

  readonly selectedApps = computed(() => {
    const ticked = this.selectedPkgs();
    return this.sortedApps().filter(app => ticked.has(app.package));
  });

  readonly allSelected = computed(() =>
    this.sortedApps().length > 0 && this.selectedApps().length === this.sortedApps().length);

  isSelected(app: SeenApp): boolean {
    return this.selectedPkgs().has(app.package);
  }

  toggle(app: SeenApp): void {
    const next = new Set(this.selectedPkgs());
    if (!next.delete(app.package)) next.add(app.package);
    this.selectedPkgs.set(next);
  }

  startSelecting(app?: SeenApp): void {
    this.selecting.set(true);
    this.selectedPkgs.set(new Set(app ? [app.package] : []));
  }

  pressed(event: Event, app: SeenApp): void {
    if (this.selecting()) return;
    event.preventDefault();
    this.startSelecting(app);
  }

  stopSelecting(): void {
    this.selecting.set(false);
    this.selectedPkgs.set(new Set());
  }

  selectAll(): void {
    this.selectedPkgs.set(this.allSelected()
      ? new Set() : new Set(this.sortedApps().map(app => app.package)));
  }

  /** Keep, or stop keeping, what every ticked app says. */
  async watchSelected(on: boolean): Promise<void> {
    for (const app of this.selectedApps()) {
      if (app.watched !== on) await BankNotifications.watch({ package: app.package, on });
    }
    this.stopSelecting();
    await this.look();
  }

  hideSelected(): void {
    void this.hideAll(this.selectedApps());
  }
  /** The hidden apps' list is folded away until asked for. */
  readonly showHidden = signal(false);

  /** The ones being kept, first: they are what this screen is for. */
  /**
   * What is typed in the search: it narrows both lists, the apps by name and
   * package, and what they said by app, title and text.
   */
  readonly search = signal('');
  private readonly term = computed(() => foldText(this.search()));

  /** Enough on screen for a search and the two arrows to be worth having. */
  readonly longList = computed(() => this.apps().length + this.caught().length > 8);

  private readonly content = viewChild(IonContent);

  async toTop(): Promise<void> {
    await this.content()?.scrollToTop(300);
  }

  async toBottom(): Promise<void> {
    await this.content()?.scrollToBottom(300);
  }

  readonly sortedApps = computed(() => this.apps().filter(app => !app.hidden
    && (this.term().length === 0 || foldText(`${app.label} ${app.package}`).includes(this.term())))
    .sort((one, other) =>
    Number(other.watched) - Number(one.watched)
    || other.last - one.last));

  readonly hiddenApps = computed(() => this.apps().filter(app => app.hidden)
    .sort((one, other) => one.label.localeCompare(other.label)));

  readonly newest = computed(() => this.caught()
    .filter(one => this.term().length === 0
      || foldText(`${one.app} ${one.title} ${one.text}`).includes(this.term()))
    .sort((one, other) => other.postedAt - one.postedAt));

  /** Apps that are there, but not one of them matches what was typed. */
  readonly nothingFound = computed(() =>
    this.term().length > 0 && this.apps().some(app => !app.hidden) && this.sortedApps().length === 0);

  /**
   * Read again whenever the screen comes into view and whenever the app comes
   * back to the front: what arrived meanwhile - or the permission just given
   * in Android's settings - shows without anybody having to ask for it.
   */
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

      const { enabled } = await BankNotifications.isEnabled();
      this.enabled.set(enabled);

      this.apps.set((await BankNotifications.apps()).apps);
      this.senders.set((await BankNotifications.senders()).senders);
      this.caught.set((await BankNotifications.caught()).caught);
    } finally {
      this.loading.set(false);
    }
  }

  async openSettings(): Promise<void> {
    await BankNotifications.openSettings();
  }

  /**
   * Starts or stops keeping what one app says.
   *
   * Off by default for every app, including the banks: the permission Android
   * grants is to read EVERY notification on the phone, and what this app does
   * with that has to be narrower than what it was given. Whoever ticks an app
   * is saying "keep this one", and nothing else is kept.
   */
  async watch(app: SeenApp, on: boolean): Promise<void> {
    if (app.watched === on) return;
    await BankNotifications.watch({ package: app.package, on });
    await this.look();
  }

  /**
   * Puts an app away: the phone stops noting it at all. Asked first only when
   * something it said was kept, because that goes with it; an app that was
   * never ticked has nothing to lose and comes back from the list below.
   */
  async hide(app: SeenApp): Promise<void> {
    await this.hideAll([app]);
  }

  private async hideAll(apps: SeenApp[]): Promise<void> {
    if (apps.length === 0) return;
    const packages = new Set(apps.map(app => app.package));
    if (this.caught().some(one => packages.has(one.package))) {
      this.hiding.set(apps);
      this.asking.set('hide');
      return;
    }
    await this.putAway(apps);
  }

  private async putAway(apps: SeenApp[]): Promise<void> {
    for (const app of apps) await BankNotifications.hide({ package: app.package, on: true });
    this.stopSelecting();
    await this.look();
  }

  async unhide(app: SeenApp): Promise<void> {
    await BankNotifications.hide({ package: app.package, on: false });
    await this.look();
  }

  async answered(): Promise<void> {
    const question = this.asking();
    this.asking.set(null);
    const apps = this.hiding();
    this.hiding.set([]);
    const sender = this.hidingSender();
    this.hidingSender.set(null);
    if (question === 'hideSender' && sender) {
      await BankNotifications.hideSender({ package: sender.package, sender: sender.sender, on: true });
      await this.look();
      return;
    }
    if (question === 'hide') {
      await this.putAway(apps);
      return;
    }
    if (question === 'forgetCaught') await BankNotifications.forgetCaught();
    if (question === 'forgetEverything') await BankNotifications.forgetEverything();
    await this.look();
  }

  readonly askTitle = computed(() => {
    const question = this.asking();
    if (question === 'hideSender') {
      return this.i18n.t('ui.notifications.hideSender.sure', { sender: this.hidingSender()?.sender ?? '' });
    }
    if (question === 'hide') {
      const apps = this.hiding();
      return apps.length === 1
        ? this.i18n.t('notifications.hide.sure', { app: apps[0].label })
        : this.i18n.t('notifications.hide.sureMany', { count: apps.length });
    }
    return this.i18n.t(question === 'forgetEverything'
      ? 'notifications.forgetAll.sure' : 'notifications.forgetCaught.sure');
  });

  readonly askBody = computed(() => {
    const question = this.asking();
    if (question === 'hide' || question === 'hideSender') return this.i18n.t('notifications.hide.body');
    return this.i18n.t(question === 'forgetEverything'
      ? 'notifications.forgetAll.body' : 'notifications.forgetCaught.body');
  });

  readonly askConfirm = computed(() => this.i18n.t(
    this.asking() === 'hide' || this.asking() === 'hideSender' ? 'notifications.hide.do' : 'notifications.forget.do'));

  cancelled(): void {
    this.asking.set(null);
    this.hiding.set([]);
    this.hidingSender.set(null);
  }

  /** When it arrived, in the reader's own language. */
  when(at: number): string {
    return new Date(at).toLocaleString(this.i18n.dateLocale(), {
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    });
  }
}
