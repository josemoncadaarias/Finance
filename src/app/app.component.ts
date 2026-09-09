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
import { TranslatePipe } from './core/i18n/translate.pipe';
import { LanguageButtonComponent } from './core/i18n/language-button.component';
import { pieChartOutline, walletOutline, cloudUploadOutline } from 'ionicons/icons';

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
    RouterLink, TranslatePipe, LanguageButtonComponent,
    IonApp, IonRouterOutlet, IonMenu, IonHeader, IonToolbar, IonTitle,
    IonContent, IonList, IonItem, IonIcon, IonLabel,
  ],
})
export class AppComponent {
  private readonly menu = inject(MenuController);
  private readonly router = inject(Router);

  readonly sections: Section[] = [
    { path: '/movements', label: 'nav.summary', hint: 'nav.summary.hint', icon: 'pie-chart-outline' },
    { path: '/accounts', label: 'nav.accounts', hint: 'nav.accounts.hint', icon: 'wallet-outline' },
    { path: '/import', label: 'nav.import', hint: 'nav.import.hint', icon: 'cloud-upload-outline' },
  ];

  constructor() {
    addIcons({ pieChartOutline, walletOutline, cloudUploadOutline });
  }

  isCurrent(path: string): boolean {
    return this.router.url.startsWith(path);
  }

  close(): void {
    void this.menu.close();
  }
}
