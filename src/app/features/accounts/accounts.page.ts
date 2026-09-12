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
  IonButton, IonModal, IonInput,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import * as allIcons from 'ionicons/icons';

import { DatabaseService } from '../../core/database/database.service';
import { FilterService } from '../../core/filters/filter.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { LanguageButtonComponent } from '../../core/i18n/language-button.component';
import { AccountsRepository } from '../../core/database/repositories/accounts.repository';
import { CustomIconsRepository, iconDataUrl } from '../../core/database/repositories/custom-icons.repository';
import { RatesRepository, RATE_SCALE } from '../../core/database/repositories/rates.repository';
import { I18nService } from '../../core/i18n/i18n.service';
import { RatesService } from '../../core/rates/rates.service';
import type { NetWorth } from '../../core/database/repositories/accounts.repository';
import { AccountEditorComponent } from './account-editor.component';
import type { AccountRow, GroupedBalance } from '../../core/database/types';
import { MoneyPipe } from '../../shared/money.pipe';
import { SignPipe } from '../../shared/sign.pipe';
import { outlined } from '../../core/icons/icon-catalog';
import { IconComponent } from '../../core/icons/icon.component';
import { CustomIconsService } from '../../core/icons/custom-icons.service';

@Component({
  selector: 'app-accounts',
  templateUrl: './accounts.page.html',
  styleUrls: ['./accounts.page.scss'],
  imports: [
    IconComponent,
    CommonModule, MoneyPipe, SignPipe, TranslatePipe, LanguageButtonComponent,
    AccountEditorComponent,
    IonContent, IonHeader, IonToolbar, IonTitle, IonList, IonItem, IonLabel,
    IonNote, IonRefresher, IonRefresherContent, IonSpinner, IonIcon, IonBadge, IonMenuButton, IonButtons,
    IonButton, IonModal, IonInput,
  ],
})
export class AccountsPage {
  private readonly database = inject(DatabaseService);
  private readonly filter = inject(FilterService);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18nService);
  readonly rates = inject(RatesService);

  /** Non-null while the editor is open; its account is null when creating. */
  readonly editor = signal<{ account: AccountRow | null } | null>(null);

  /** Data URLs for user-supplied icons, built once each. */
  private readonly iconUrls = signal<Map<number, string>>(new Map());

  readonly grouped = signal<GroupedBalance[] | null>(null);
  readonly netWorthMinor = signal(0);
  readonly showArchived = signal(false);

  /** Icon names arrive with or without their suffix; this settles it. */
  readonly outlined = outlined;

  /**
   * The currencies the app knows, and the form for adding one.
   *
   * On this screen rather than behind a settings menu: a currency exists to
   * denominate an account, so this is where someone goes looking for it. It
   * was reachable only from inside the new-account form before, which is to
   * say not reachable at all unless you were already making an account.
   */
  readonly currencies = signal<{ code: string; name: string; symbol: string; used: number }[]>([]);
  readonly addingCurrency = signal(false);
  readonly newCode = signal('');
  readonly newName = signal('');
  readonly newSymbol = signal('');
  readonly currencyError = signal('');

  /** The total, and every line that makes it. */
  readonly worth = signal<NetWorth | null>(null);
  readonly showBreakdown = signal(false);

  /** The rate being typed in, per currency, while the sheet is open. */
  readonly rateDrafts = signal<Record<string, string>>({});

  /** Currencies holding money that has no rate to value it with. */
  readonly missingRates = computed(() => this.worth()?.missingRatesFor ?? []);

  /** Every non-peso currency in play, so a rate can be set before it is missed. */
  readonly foreignCurrencies = computed(() => {
    const seen = new Set<string>();
    for (const line of this.worth()?.lines ?? []) {
      if (line.currency_code !== 'COP') seen.add(line.currency_code);
    }
    return [...seen].sort();
  });

  readonly status = this.database.status;
  readonly error = this.database.error;

  /** Archived accounts are history; they stay out of the way until asked for. */
  /** How the list is sorted: by what is in each account, or by name. */
  readonly sortBy = signal<'amount' | 'name'>('amount');

  /**
   * The live accounts, sorted as asked.
   *
   * Sorting a group by its largest balance keeps a multi-currency account
   * together: ARQ is one account holding two currencies, and splitting it
   * across the list to sort its halves separately would say otherwise.
   */
  readonly visible = computed(() => {
    const live = (this.grouped() ?? [])
      .map(entry => ({ ...entry, balances: entry.balances.filter(b => !b.account.archived) }))
      .filter(entry => entry.balances.length > 0);

    return this.sorted(live);
  });

  /**
   * Archived accounts, kept entirely apart.
   *
   * An archived account is history and nothing else: its money is gone, spent
   * or moved elsewhere long ago. It is excluded from net worth by the query
   * that computes it, and mixing it into the same list as the live ones - in
   * alphabetical order, next to real balances - said the opposite.
   */
  readonly archived = computed(() => {
    const dead = (this.grouped() ?? [])
      .map(entry => ({ ...entry, balances: entry.balances.filter(b => b.account.archived) }))
      .filter(entry => entry.balances.length > 0);

    return this.sorted(dead);
  });

  private sorted(entries: GroupedBalance[]): GroupedBalance[] {
    const byName = (entry: GroupedBalance) =>
      entry.group?.name ?? entry.balances[0].account.name;

    // A group is placed by its largest balance, so one big currency is not
    // hidden behind an empty sibling.
    const size = (entry: GroupedBalance) =>
      Math.max(...entry.balances.map(balance => Math.abs(balance.balance_minor)));

    return [...entries].sort((a, b) =>
      this.sortBy() === 'name'
        ? byName(a).localeCompare(byName(b))
        : size(b) - size(a));
  }

  readonly archivedCount = computed(
    () => (this.grouped() ?? []).flatMap(e => e.balances).filter(b => b.account.archived).length,
  );

  /** What is typed into a currency's rate box, or the rate already in force. */
  rateDraft(currency: string): string {
    const typed = this.rateDrafts()[currency];
    if (typed !== undefined) return typed;

    const line = this.worth()?.lines.find(l => l.currency_code === currency && l.rate);
    return line?.rate ? String(line.rate.rate_scaled / RATE_SCALE) : '';
  }

  onRateTyped(currency: string, text: string): void {
    this.rateDrafts.update(drafts => ({ ...drafts, [currency]: text }));
  }

  /**
   * Records today's rate for a currency.
   *
   * Typed by hand for now: the official TRM comes from a public API, and
   * fetching it is Phase 4. Until then the app asks rather than assuming, and
   * whatever is entered is dated today so tomorrow's figure does not silently
   * reinterpret today's.
   */
  async saveRate(currency: string): Promise<void> {
    const typed = this.rateDraft(currency).replace(/[^0-9.,]/g, '').replace(',', '.');
    const value = Number(typed);
    if (!Number.isFinite(value) || value <= 0) return;

    await new RatesRepository(this.database.driver).set({
      on_date: todayIso(),
      base_code: currency,
      quote_code: 'COP',
      rate_scaled: Math.round(value * RATE_SCALE),
    });

    this.rateDrafts.update(drafts => {
      const next = { ...drafts };
      delete next[currency];
      return next;
    });
    await this.load();
  }

  private async loadCurrencies(): Promise<void> {
    // Counted so a currency nothing uses can be told apart from one that is
    // holding money.
    this.currencies.set(await this.database.driver.query<{
      code: string; name: string; symbol: string; used: number;
    }>(
      `SELECT c.code, c.name, c.symbol,
              (SELECT COUNT(*) FROM accounts a WHERE a.currency_code = c.code) AS used
       FROM currencies c ORDER BY used DESC, c.code`,
    ));
  }

  /**
   * Adds a currency the app did not ship with.
   *
   * Minor units are fixed at two: every currency this app is likely to meet
   * has cents and the money helpers assume it, so offering the choice would be
   * offering a way to store amounts a hundred times off.
   */
  async saveCurrency(): Promise<void> {
    const code = this.newCode().trim().toUpperCase();
    const name = this.newName().trim();

    if (!/^[A-Z]{3}$/.test(code)) {
      this.currencyError.set(this.i18n.t('accounts.currency.badCode'));
      return;
    }
    if (name === '') {
      this.currencyError.set(this.i18n.t('accounts.currency.needName'));
      return;
    }

    try {
      await this.database.driver.run(
        `INSERT INTO currencies (code, name, symbol, minor_units) VALUES (?, ?, ?, 2)
         ON CONFLICT(code) DO UPDATE SET name = excluded.name, symbol = excluded.symbol`,
        [code, name, this.newSymbol().trim() || code],
      );

      await this.loadCurrencies();
      this.addingCurrency.set(false);
      this.newCode.set('');
      this.newName.set('');
      this.newSymbol.set('');
      this.currencyError.set('');
    } catch (error) {
      this.currencyError.set(error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * Asks the TRM service for today's rate.
   *
   * Nothing waits on it: the screen is already showing what it has, and this
   * either improves it or leaves it exactly as it was.
   */
  async refreshTrm(): Promise<void> {
    await this.rates.refresh({ force: true });
    await this.load();
  }

  /**
   * A rate as it should be read, in Colombian notation.
   *
   * Angular's number pipe formats in the locale the app was registered with —
   * US English — so 3.116,47 came out as 3,116.47, which reads as three
   * thousand something to the wrong eye and as three point one to the right
   * one.
   */
  rateText(scaled: number): string {
    return new Intl.NumberFormat('es-CO', {
      minimumFractionDigits: 2, maximumFractionDigits: 2,
    }).format(scaled / RATE_SCALE);
  }

  setSort(by: 'amount' | 'name'): void {
    this.sortBy.set(by);
  }

  constructor() {
    addIcons(allIcons as unknown as Record<string, string>);

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
    const [grouped, worth] = await Promise.all([
      // A product set outside net worth - the tax CDTs - is not the account's to spend.
      accounts.balancesByGroup({ includeArchived: true, leaveOutSetAside: true }),
      accounts.netWorth(),
    ]);
    this.grouped.set(grouped);
    this.worth.set(worth);
    this.netWorthMinor.set(worth.totalMinor);
    await this.loadCurrencies();
    await this.loadIcons();
    await this.rates.load();
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
  /**
   * The images, from the one service that holds them.
   *
   * This screen used to keep its own copy of the read-the-blobs loop, which is
   * the duplication `CustomIconsService` exists to end - and now that the
   * icons are drawn by <app-icon>, which reads that service, a private copy
   * would have left this screen showing fallbacks while holding the right
   * images in a map nothing looks at.
   */
  private readonly customIcons = inject(CustomIconsService);

  private async loadIcons(): Promise<void> {
    await this.customIcons.load();
  }

  edit(account: AccountRow | null): void {
    this.editor.set({ account });
  }

  onSaved(): void {
    this.editor.set(null);
  }
}

/** Today as an ISO day, in local time. */
function todayIso(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}
