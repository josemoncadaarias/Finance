/**
 * Where the money is: every account with its balance, grouped the way the
 * accounts really exist.
 *
 * Balances are never stored, only derived, so this page is a read of the
 * ledger rather than of a cached number that could have drifted.
 */

import { Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonContent, IonHeader, IonToolbar, IonTitle, IonList, IonItem, IonLabel,
  IonNote, IonRefresher, IonRefresherContent, IonSpinner, IonIcon, IonBadge, IonMenuButton, IonButtons,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { walletOutline, cardOutline, cashOutline, trendingUpOutline, archiveOutline } from 'ionicons/icons';

import { DatabaseService } from '../../core/database/database.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { AccountsRepository } from '../../core/database/repositories/accounts.repository';
import type { GroupedBalance } from '../../core/database/types';
import { MoneyPipe } from '../../shared/money.pipe';
import { SignPipe } from '../../shared/sign.pipe';

@Component({
  selector: 'app-accounts',
  templateUrl: './accounts.page.html',
  styleUrls: ['./accounts.page.scss'],
  imports: [
    CommonModule, MoneyPipe, SignPipe, TranslatePipe,
    IonContent, IonHeader, IonToolbar, IonTitle, IonList, IonItem, IonLabel,
    IonNote, IonRefresher, IonRefresherContent, IonSpinner, IonIcon, IonBadge, IonMenuButton, IonButtons,
  ],
})
export class AccountsPage {
  private readonly database = inject(DatabaseService);

  readonly grouped = signal<GroupedBalance[] | null>(null);
  readonly netWorthMinor = signal(0);
  readonly showArchived = signal(false);

  readonly status = this.database.status;
  readonly error = this.database.error;

  /** Archived accounts are history; they stay out of the way until asked for. */
  readonly visible = computed(() => {
    const all = this.grouped() ?? [];
    if (this.showArchived()) return all;
    return all
      .map(entry => ({ ...entry, balances: entry.balances.filter(b => !b.account.archived) }))
      .filter(entry => entry.balances.length > 0);
  });

  readonly archivedCount = computed(
    () => (this.grouped() ?? []).flatMap(e => e.balances).filter(b => b.account.archived).length,
  );

  constructor() {
    addIcons({ walletOutline, cardOutline, cashOutline, trendingUpOutline, archiveOutline });

    // The database opens in the background, so the page cannot read it once at
    // construction and be done. This reruns the moment it becomes ready.
    effect(() => {
      // Reads dataVersion so an import elsewhere in the app refreshes this
      // screen, not just the first open.
      this.database.dataVersion();
      if (this.database.status() === 'ready') void this.load();
    });
  }

  async load(): Promise<void> {
    if (this.database.status() !== 'ready') return;

    const accounts = new AccountsRepository(this.database.driver);
    const [grouped, netWorth] = await Promise.all([
      accounts.balancesByGroup({ includeArchived: true }),
      accounts.netWorthMinor(),
    ]);
    this.grouped.set(grouped);
    this.netWorthMinor.set(netWorth);
  }

  async refresh(event: CustomEvent): Promise<void> {
    await this.load();
    (event.target as HTMLIonRefresherElement).complete();
  }

  toggleArchived(): void {
    this.showArchived.update(shown => !shown);
  }

  iconFor(type: string): string {
    switch (type) {
      case 'credit': return 'card-outline';
      case 'cash': return 'cash-outline';
      case 'investment': return 'trending-up-outline';
      default: return 'wallet-outline';
    }
  }
}
