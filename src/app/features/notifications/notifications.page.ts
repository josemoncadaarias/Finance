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

import { Component, DestroyRef, computed, inject, signal, viewChild } from '@angular/core';
import { App } from '@capacitor/app';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonIcon,
  IonList, IonItem, IonLabel, IonNote, IonToggle, IonSpinner, IonMenuButton, IonSearchbar,
} from '@ionic/angular';

import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { LanguageButtonComponent } from '../../core/i18n/language-button.component';
import { ConfirmComponent } from '../../shared/confirm/confirm.component';
import { foldText } from '../../core/text/fold-text';
import {
  BankNotifications, type CaughtNotification, type SeenApp,
} from '../../core/notifications/bank-notifications';

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [
    TranslatePipe, LanguageButtonComponent, ConfirmComponent,
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonIcon,
    IonList, IonItem, IonLabel, IonNote, IonToggle, IonSpinner, IonMenuButton, IonSearchbar,
  ],
  templateUrl: './notifications.page.html',
  styleUrls: ['./notifications.page.scss'],
})
export class NotificationsPage {
  private readonly i18n = inject(I18nService);

  readonly loading = signal(true);
  /** False in a browser and on iOS, which is an ordinary state. */
  readonly supported = signal(false);
  readonly enabled = signal(false);

  readonly apps = signal<SeenApp[]>([]);
  readonly caught = signal<CaughtNotification[]>([]);

  /** Which question is on screen, or null. */
  readonly asking = signal<'forgetCaught' | 'forgetEverything' | 'hide' | null>(null);
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
    if (question === 'hide') return this.i18n.t('notifications.hide.body');
    return this.i18n.t(question === 'forgetEverything'
      ? 'notifications.forgetAll.body' : 'notifications.forgetCaught.body');
  });

  readonly askConfirm = computed(() => this.i18n.t(
    this.asking() === 'hide' ? 'notifications.hide.do' : 'notifications.forget.do'));

  cancelled(): void {
    this.asking.set(null);
    this.hiding.set([]);
  }

  /** When it arrived, in the reader's own language. */
  when(at: number): string {
    return new Date(at).toLocaleString(this.i18n.dateLocale(), {
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    });
  }
}
