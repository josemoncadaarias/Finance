/**
 * The shell: a navigation drawer and whatever page is open.
 *
 * See `app.component.html` for why navigation is a drawer and not a tab bar.
 */

import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  IonApp, IonRouterOutlet, IonMenu, IonHeader, IonToolbar, IonTitle,
  IonContent, IonList, IonItem, IonIcon, IonLabel, MenuController,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import * as allIcons from 'ionicons/icons';
import { TranslatePipe } from './core/i18n/translate.pipe';
import { LanguageButtonComponent } from './core/i18n/language-button.component';
import { ThemeButtonComponent } from './core/theme/theme-button.component';
import { ThemeService } from './core/theme/theme.service';

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
    RouterLink, TranslatePipe, LanguageButtonComponent, ThemeButtonComponent,
    IonApp, IonRouterOutlet, IonMenu, IonHeader, IonToolbar, IonTitle,
    IonContent, IonList, IonItem, IonIcon, IonLabel,
  ],
})
export class AppComponent {
  private readonly menu = inject(MenuController);
  private readonly router = inject(Router);

  /**
   * Injected for its side effect: the service paints the theme in an effect of
   * its own, and nothing else asks for it at startup. Without this the app
   * would open in whatever the stylesheet defaults to and correct itself only
   * once the drawer was opened.
   */
  private readonly theme = inject(ThemeService);

  // No Monefy import and no screen reviewing what it assumed: since
  // 2026-09-12 everything is entered by hand, and a backup is the way data
  // moves between the browser and the phone.
  readonly sections: Section[] = [
    { path: '/movements', label: 'nav.summary', hint: 'nav.summary.hint', icon: 'pie-chart-outline' },
    { path: '/accounts', label: 'nav.accounts', hint: 'nav.accounts.hint', icon: 'wallet-outline' },
    { path: '/categories', label: 'nav.categories', hint: 'nav.categories.hint', icon: 'pricetags-outline' },
    { path: '/cushion', label: 'nav.cushion', hint: 'nav.cushion.hint', icon: 'bed-outline' },
    { path: '/tax', label: 'nav.tax', hint: 'nav.tax.hint', icon: 'calculator-outline' },
    { path: '/export', label: 'nav.export', hint: 'nav.export.hint', icon: 'swap-vertical-outline' },
  ];

  constructor() {
    // Every icon, once, for the whole app: see the note above the class.
    addIcons(allIcons as unknown as Record<string, string>);
  }

  isCurrent(path: string): boolean {
    return this.router.url.startsWith(path);
  }

  close(): void {
    void this.menu.close();
  }
}
