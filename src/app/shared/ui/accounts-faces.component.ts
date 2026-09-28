/**
 * The two faces of the Cuentas tab: "Saldos | Rendimientos" (Jose,
 * 2026-09-28). Saldos is every account with today's balance and net worth;
 * Rendimientos is only the accounts that earn, with what they have been paid.
 * Two screens, one switch at the top of both.
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
    </div>
  `,
  styles: [`
    :host { display: block; }
    .faces { margin: 0; }
    .faces button { gap: 8px; }
    .faces ion-icon { font-size: 18px; }
  `],
})
export class AccountsFacesComponent {
  private readonly router = inject(Router);
  readonly on = input<'balances' | 'yields'>('balances');

  go(url: string): void {
    if (!this.router.url.startsWith(url)) void this.router.navigateByUrl(url, { replaceUrl: true });
  }
}
