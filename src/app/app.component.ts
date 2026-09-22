/**
 * The shell: a navigation drawer and whatever page is open.
 *
 * See `app.component.html` for why navigation is a drawer and not a tab bar.
 */

import { Component, effect, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  IonApp, IonRouterOutlet, IonMenu, IonHeader, IonToolbar, IonTitle,
  IonContent, IonList, IonItem, IonIcon, IonLabel, MenuController,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { DRAWN_ICONS } from './core/icons/drawn-icons';
import * as allIcons from 'ionicons/icons';
import { TranslatePipe } from './core/i18n/translate.pipe';
import { LanguageButtonComponent } from './core/i18n/language-button.component';
import { ThemeButtonComponent } from './core/theme/theme-button.component';
import { ThemeService } from './core/theme/theme.service';
import { DatabaseService } from './core/database/database.service';
import { GoogleAccountService } from './core/cloud/google-account.service';
import { CloudBackupService } from './core/cloud/cloud-backup.service';
import { ForeignConversionService } from './core/rates/foreign-conversion.service';
import { CustomIconsService } from './core/icons/custom-icons.service';
import { AvatarComponent } from './core/cloud/avatar.component';

interface Section {
  path: string;
  /** Translation keys, resolved by the template. */
  label: string;
  /** One line saying what the screen answers, for someone new to the app. */
  hint: string;
  icon: string;
}

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  imports: [
    RouterLink, TranslatePipe, LanguageButtonComponent, ThemeButtonComponent, AvatarComponent,
    IonApp, IonRouterOutlet, IonMenu, IonHeader, IonToolbar, IonTitle,
    IonContent, IonList, IonItem, IonIcon, IonLabel,
  ],
})
export class AppComponent {
  private readonly menu = inject(MenuController);
  private readonly router = inject(Router);
  private readonly database = inject(DatabaseService);

  /**
   * The images accounts and categories wear, read as soon as there is a
   * database to read them from rather than when a screen first needs one. On
   * a phone that wait was visible, and what showed meanwhile was a generic
   * icon rather than the bank own logo.
   */
  private readonly customIcons = inject(CustomIconsService);

  /**
   * Injected for its side effect: the service paints the theme in an effect of
   * its own, and nothing else asks for it at startup. Without this the app
   * would open in whatever the stylesheet defaults to and correct itself only
   * once the drawer was opened.
   */
  private readonly theme = inject(ThemeService);

  // No import and no screen reviewing what one assumed: since
  // 2026-09-12 everything is entered by hand, and a backup is the way data
  // moves between the browser and the phone.
  readonly sections: Section[] = [
    { path: '/movements', label: 'nav.summary', hint: 'nav.summary.hint', icon: 'pie-chart-outline' },
    { path: '/report', label: 'nav.report', hint: 'nav.report.hint', icon: 'stats-chart-outline' },
    { path: '/accounts', label: 'nav.accounts', hint: 'nav.accounts.hint', icon: 'wallet-outline' },
    { path: '/categories', label: 'nav.categories', hint: 'nav.categories.hint', icon: 'pricetags-outline' },
    { path: '/products', label: 'nav.products', hint: 'nav.products.hint', icon: 'piggy-bank' },
    { path: '/tax', label: 'nav.tax', hint: 'nav.tax.hint', icon: 'calculator-outline' },
    { path: '/export', label: 'nav.export', hint: 'nav.export.hint', icon: 'swap-vertical-outline' },
    { path: '/account', label: 'nav.account', hint: 'nav.account.hint', icon: 'person-circle-outline' },
  ];

  /** Public so the drawer can show who is signed in. */
  readonly google = inject(GoogleAccountService);
  /**
   * Injected here and nowhere used: starting it is the point.
   *
   * It watches the database and listens for the app being put away, and it
   * cannot do either until something asks for it. Left to the toolbar button
   * that injects it, it would start whenever the first screen happened to
   * draw - and stop existing on a screen that has no toolbar.
   */
  private readonly cloud = inject(CloudBackupService);

  /** Values foreign movements in pesos at their own day's rate. Same reason. */
  private readonly foreign = inject(ForeignConversionService);

  constructor() {
    // Every icon, once, for the whole app: see the note above the class.
    addIcons(allIcons as unknown as Record<string, string>);
    // The ones drawn here, because Ionicons has none like them.
    addIcons(DRAWN_ICONS);

    // Signed in last time? Then signed in now, without being asked again.
    // It fails quietly on purpose: signed out is the ordinary state of this
    // app, not something to report on startup.
    void this.google.restore();

    effect(() => {
      this.database.dataVersion();
      if (this.database.status() === 'ready') void this.customIcons.load();
    });
  }

  /**
   * Whether this is the screen on show.
   *
   * By whole path segment, not by prefix. "/accounts" begins with "/account",
   * so a prefix test lit both "Cuentas" and "Cuenta" whenever the accounts
   * screen was open - two sections apparently current at once.
   */
  isCurrent(path: string): boolean {
    const url = this.router.url.split(/[?#]/)[0];
    return url === path || url.startsWith(path + '/');
  }

  close(): void {
    void this.menu.close();
  }
}
