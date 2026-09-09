/**
 * Where the money is: every account with its balance, grouped the way the
 * accounts really exist.
 *
 * Balances are never stored, only derived, so this page is a read of the
 * ledger rather than of a cached number that could have drifted.
 */

import { Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  IonContent, IonHeader, IonToolbar, IonTitle, IonList, IonItem, IonLabel,
  IonNote, IonRefresher, IonRefresherContent, IonSpinner, IonIcon, IonBadge, IonMenuButton, IonButtons,
  IonButton, IonModal,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { walletOutline, cardOutline, cashOutline, trendingUpOutline, archiveOutline } from 'ionicons/icons';

import { DatabaseService } from '../../core/database/database.service';
import { FilterService } from '../../core/filters/filter.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { LanguageButtonComponent } from '../../core/i18n/language-button.component';
import { AccountsRepository } from '../../core/database/repositories/accounts.repository';
import { CustomIconsRepository, iconDataUrl } from '../../core/database/repositories/custom-icons.repository';
import { AccountEditorComponent } from './account-editor.component';
import type { AccountRow, GroupedBalance } from '../../core/database/types';
import { MoneyPipe } from '../../shared/money.pipe';
import { SignPipe } from '../../shared/sign.pipe';

@Component({
  selector: 'app-accounts',
  templateUrl: './accounts.page.html',
  styleUrls: ['./accounts.page.scss'],
  imports: [
    CommonModule, MoneyPipe, SignPipe, TranslatePipe, LanguageButtonComponent,
    AccountEditorComponent,
    IonContent, IonHeader, IonToolbar, IonTitle, IonList, IonItem, IonLabel,
    IonNote, IonRefresher, IonRefresherContent, IonSpinner, IonIcon, IonBadge, IonMenuButton, IonButtons,
    IonButton, IonModal,
  ],
})
export class AccountsPage {
  private readonly database = inject(DatabaseService);
  private readonly filter = inject(FilterService);
  private readonly router = inject(Router);

  /** Non-null while the editor is open; its account is null when creating. */
  readonly editor = signal<{ account: AccountRow | null } | null>(null);

  /** Data URLs for user-supplied icons, built once each. */
  private readonly iconUrls = signal<Map<number, string>>(new Map());

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
    await this.loadIcons();
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

  /**
   * Opens the summary on the account that was tapped.
   *
   * A balance is a total, and the next question is always what it is made
   * of — so the row that shows the number leads to the movements behind it.
   * A currency of a multi-currency account opens on its own, because that
   * is the row the balance belongs to: ARQ USD and ARQ EUR hold different
   * money.
   *
   * Choosing here counts as choosing by hand, so the summary stops guessing
   * which account to open on from then on.
   */
  open(account: AccountRow): void {
    this.filter.selectAccount(account.id);
    void this.router.navigateByUrl('/movements');
  }
  iconUrl(id: number | null): string | undefined {
    return id === null ? undefined : this.iconUrls().get(id);
  }

  /** Loads the images accounts wear, so a bank logo renders as itself. */
  private async loadIcons(): Promise<void> {
    if (this.database.status() !== 'ready') return;

    const repository = new CustomIconsRepository(this.database.driver);
    const urls = new Map(this.iconUrls());
    for (const icon of await repository.list()) {
      if (urls.has(icon.id)) continue;
      const full = await repository.findById(icon.id);
      if (full) urls.set(icon.id, iconDataUrl(full));
    }
    this.iconUrls.set(urls);
  }

  edit(account: AccountRow | null): void {
    this.editor.set({ account });
  }

  onSaved(): void {
    this.editor.set(null);
  }
}
