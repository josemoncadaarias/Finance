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

import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { App } from '@capacitor/app';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonIcon,
  IonList, IonItem, IonLabel, IonNote, IonToggle, IonSpinner, IonMenuButton,
} from '@ionic/angular';

import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { LanguageButtonComponent } from '../../core/i18n/language-button.component';
import { ConfirmComponent } from '../../shared/confirm/confirm.component';
import {
  BankNotifications, type CaughtNotification, type SeenApp,
} from '../../core/notifications/bank-notifications';

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [
    TranslatePipe, LanguageButtonComponent, ConfirmComponent,
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonIcon,
    IonList, IonItem, IonLabel, IonNote, IonToggle, IonSpinner, IonMenuButton,
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
  readonly asking = signal<'forgetCaught' | 'forgetEverything' | null>(null);

  /** The ones being kept, first: they are what this screen is for. */
  readonly sortedApps = computed(() => [...this.apps()].sort((one, other) =>
    Number(other.watched) - Number(one.watched)
    || other.last - one.last));

  readonly newest = computed(() =>
    [...this.caught()].sort((one, other) => other.postedAt - one.postedAt));

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

  async answered(): Promise<void> {
    const question = this.asking();
    this.asking.set(null);
    if (question === 'forgetCaught') await BankNotifications.forgetCaught();
    if (question === 'forgetEverything') await BankNotifications.forgetEverything();
    await this.look();
  }

  readonly askTitle = computed(() => this.i18n.t(
    this.asking() === 'forgetEverything'
      ? 'notifications.forgetAll.sure' : 'notifications.forgetCaught.sure'));

  readonly askBody = computed(() => this.i18n.t(
    this.asking() === 'forgetEverything'
      ? 'notifications.forgetAll.body' : 'notifications.forgetCaught.body'));

  /** When it arrived, in the reader's own language. */
  when(at: number): string {
    return new Date(at).toLocaleString(this.i18n.dateLocale(), {
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    });
  }
}
