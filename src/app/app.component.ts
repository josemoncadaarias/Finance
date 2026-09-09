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
import { pieChartOutline, walletOutline, cloudUploadOutline } from 'ionicons/icons';

interface Section {
  path: string;
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
    RouterLink,
    IonApp, IonRouterOutlet, IonMenu, IonHeader, IonToolbar, IonTitle,
    IonContent, IonList, IonItem, IonIcon, IonLabel,
  ],
})
export class AppComponent {
  private readonly menu = inject(MenuController);
  private readonly router = inject(Router);

  readonly sections: Section[] = [
    { path: '/movements', label: 'Resumen', hint: 'Gastos, ingresos y saldo', icon: 'pie-chart-outline' },
    { path: '/accounts', label: 'Cuentas', hint: 'Saldos y patrimonio', icon: 'wallet-outline' },
    { path: '/import', label: 'Importar', hint: 'Traer el backup de Monefy', icon: 'cloud-upload-outline' },
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
