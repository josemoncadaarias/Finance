/**
 * Choosing an account from a list: the one list the app shows everywhere.
 *
 * "Cancelar" at the top, a heading, the two orders - most used and A-Z,
 * under the key every account list shares - one list with each account's
 * icon and currency, and a tick on the one in force. It began inside the
 * product form, a copy of the movement form's; the products screen's account
 * sheet needed it too (Jose, 2026-09-24), and by the rule that a control on two
 * screens has one definition it is this component now. Which accounts are
 * offered is the caller's business - the products screen offers only the ones
 * with products - and the order is this one's.
 *
 *     <app-account-picker [open]="picking()" [accounts]="withProducts()"
 *                         [selectedId]="line.account.id"
 *                         (chosen)="switchTo($event)" (closed)="picking.set(false)">
 *     </app-account-picker>
 */

import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { IonModal, IonHeader, IonToolbar, IonButtons, IonButton, IonContent, IonList, IonItem, IonLabel, IonIcon } from '@ionic/angular';

import { DatabaseService } from '../../core/database/database.service';
import { AccountsRepository } from '../../core/database/repositories/accounts.repository';
import type { AccountRow } from '../../core/database/types';
import { IconComponent } from '../../core/icons/icon.component';
import { TranslatePipe } from '../../core/i18n/translate.pipe';

/** The account list's order, the key every picker in the app shares. */
function readAccountOrder(): 'use' | 'name' {
  try {
    return localStorage.getItem('finance.accountOrder') === 'use' ? 'use' : 'name';
  } catch {
    return 'name';
  }
}

@Component({
  selector: 'app-account-picker',
  templateUrl: './account-picker.component.html',
  styleUrls: ['./account-picker.component.scss'],
  imports: [
    TranslatePipe, IconComponent,
    IonModal, IonHeader, IonToolbar, IonButtons, IonButton, IonContent, IonList, IonItem, IonLabel, IonIcon,
  ],
})
export class AccountPickerComponent {
  private readonly database = inject(DatabaseService);

  readonly open = input(false);
  readonly accounts = input<readonly AccountRow[]>([]);
  readonly selectedId = input<number | null>(null);
  /**
   * The heading over the list, said for the occasion: "Desde dónde" where
   * money leaves, "Hacia dónde" where it arrives, "Cuenta" when an account is
   * only being looked at. "Desde dónde" when nothing is said.
   */
  readonly heading = input<string | null>(null);

  readonly chosen = output<AccountRow>();
  readonly closed = output<void>();

  readonly order = signal<'use' | 'name'>(readAccountOrder());
  private readonly useCounts = signal<Map<number, number>>(new Map());

  constructor() {
    // What each account is used for, read when the list opens, so "most used"
    // has something to go on and a closed picker costs nothing.
    effect(() => {
      if (!this.open() || this.database.status() !== 'ready') return;
      void new AccountsRepository(this.database.driver).timesUsed()
        .then(counts => this.useCounts.set(counts));
    });
  }

  setOrder(order: 'use' | 'name'): void {
    this.order.set(order);
    try {
      localStorage.setItem('finance.accountOrder', order);
    } catch {
      // A browser with site data blocked still gets the order for this visit.
    }
  }

  /** `localeCompare` so "Éxito" files under E and not after Z. */
  readonly ordered = computed(() => {
    const list = [...this.accounts()];
    if (this.order() === 'name') return list.sort((a, b) => a.name.localeCompare(b.name, 'es'));
    const times = this.useCounts();
    return list.sort((a, b) => {
      const byUse = (times.get(b.id) ?? 0) - (times.get(a.id) ?? 0);
      return byUse !== 0 ? byUse : a.name.localeCompare(b.name, 'es');
    });
  });

  choose(account: AccountRow): void {
    this.chosen.emit(account);
  }
}
