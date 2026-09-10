/**
 * The shell: a navigation drawer and whatever page is open.
 *
 * See `app.component.html` for why navigation is a drawer and not a tab bar.
 */

import { Component, effect, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  IonApp, IonRouterOutlet, IonMenu, IonHeader, IonToolbar, IonTitle,
  IonContent, IonList, IonItem, IonIcon, IonLabel, IonBadge, MenuController,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import * as allIcons from 'ionicons/icons';
import { TranslatePipe } from './core/i18n/translate.pipe';
import { LanguageButtonComponent } from './core/i18n/language-button.component';


import { DatabaseService } from './core/database/database.service';
import { ReviewRepository } from './core/database/repositories/review.repository';

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
    IonContent, IonList, IonItem, IonIcon, IonLabel, IonBadge,
  ],
})
export class AppComponent {
  private readonly database = inject(DatabaseService);
  private readonly menu = inject(MenuController);
  private readonly router = inject(Router);

  readonly sections: Section[] = [
    { path: '/movements', label: 'nav.summary', hint: 'nav.summary.hint', icon: 'pie-chart-outline' },
    { path: '/accounts', label: 'nav.accounts', hint: 'nav.accounts.hint', icon: 'wallet-outline' },
    { path: '/categories', label: 'nav.categories', hint: 'nav.categories.hint', icon: 'pricetags-outline' },
    { path: '/review', label: 'nav.review', hint: 'nav.review.hint', icon: 'alert-circle-outline' },
    { path: '/cushion', label: 'nav.cushion', hint: 'nav.cushion.hint', icon: 'bed-outline' },
    { path: '/import', label: 'nav.import', hint: 'nav.import.hint', icon: 'cloud-upload-outline' },
    { path: '/export', label: 'nav.export', hint: 'nav.export.hint', icon: 'cloud-download-outline' },
  ];

  /**
   * How many assumptions are still unreviewed.
   *
   * On the drawer rather than only on its own screen: an assumption nobody
   * knows about is the one that quietly makes a total wrong, so the app says
   * out loud that it is waiting for an answer.
   */
  readonly pending = signal(0);

  constructor() {
    // Every icon, once, for the whole app: see the note above the class.
    addIcons(allIcons as unknown as Record<string, string>);

    effect(() => {
      this.database.dataVersion();
      if (this.database.status() === 'ready') void this.countPending();
    });
  }

  private async countPending(): Promise<void> {
    this.pending.set(await new ReviewRepository(this.database.driver).openCount());
  }

  isCurrent(path: string): boolean {
    return this.router.url.startsWith(path);
  }

  close(): void {
    void this.menu.close();
  }
}
