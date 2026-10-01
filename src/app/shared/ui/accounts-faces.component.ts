/**
 * The faces of the Cuentas tab: "Saldos | Rendimientos | Deudas" (Jose,
 * 2026-09-28, and Deudas 2026-10-01). Saldos is every account with today's
 * balance and net worth; Rendimientos is only the accounts that earn, with
 * what they have been paid; Deudas is what is owed, card by card. Three
 * screens, one switch at the top of each.
 */

import { Component, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { IonIcon } from '@ionic/angular';

import { TranslatePipe } from '../../core/i18n/translate.pipe';

@Component({
  selector: 'app-accounts-faces',
  standalone: true,
  imports: [IonIcon, TranslatePipe],
  template: `
    <div class="ui-seg faces">
      <button type="button" [class.on]="on() === 'balances'" (click)="go('/accounts')">
        <ion-icon name="wallet-outline"></ion-icon><span>{{ 'ui.face.balances' | t }}</span>
      </button>
      <button type="button" [class.on]="on() === 'yields'" (click)="go('/products')">
        <ion-icon name="trending-up-outline"></ion-icon><span>{{ 'ui.face.yields' | t }}</span>
      </button>
      <button type="button" [class.on]="on() === 'debts'" (click)="go('/debts')">
        <ion-icon name="receipt-outline"></ion-icon><span>{{ 'ui.face.debts' | t }}</span>
      </button>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .faces { margin: 0; }
    .faces button { gap: 6px; min-width: 0; }
    .faces span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .faces ion-icon { font-size: 18px; flex: none; }
  `],
})
export class AccountsFacesComponent {
  private readonly router = inject(Router);
  readonly on = input<'balances' | 'yields' | 'debts'>('balances');

  go(url: string): void {
    if (!this.router.url.startsWith(url)) void this.router.navigateByUrl(url, { replaceUrl: true });
  }
}
