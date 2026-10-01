/**
 * Where the money is: every account with its balance, grouped the way the
 * accounts really exist.
 *
 * Balances are never stored, only derived, so this page is a read of the
 * ledger rather than of a cached number that could have drifted.
 */

import { Component, computed, effect, inject, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonContent, IonRefresher, IonRefresherContent, IonSpinner, IonIcon, IonModal,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import * as allIcons from 'ionicons/icons';

import { DatabaseService } from '../../core/database/database.service';
import { FilterService } from '../../core/filters/filter.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { AccountsRepository } from '../../core/database/repositories/accounts.repository';
import { RATE_SCALE } from '../../core/database/repositories/rates.repository';
import { I18nService } from '../../core/i18n/i18n.service';
import { RatesService } from '../../core/rates/rates.service';
import type { NetWorth } from '../../core/database/repositories/accounts.repository';
import { AccountEditorComponent } from './account-editor.component';
import { LoansRepository } from '../../core/loans/loans.repository';
import type { AccountBalance, AccountRow, GroupedBalance } from '../../core/database/types';
import { MoneyPipe } from '../../shared/money.pipe';
import { formatMoney } from '../../core/database/money';
import { CustomIconsService } from '../../core/icons/custom-icons.service';
import { BadgeComponent } from '../../shared/ui/badge.component';
import { JumpComponent } from '../../shared/ui/jump.component';
import { AccountsFacesComponent } from '../../shared/ui/accounts-faces.component';
import { AccentService } from '../../core/theme/accent.service';
import { shortDay } from '../../core/filters/period';

/** The colour each currency's code badge wears (2a, 2c). */
const CODE_COLORS: Record<string, string> = { COP: '#2ec4b6', USD: '#34c98b', EUR: '#f6b93b' };

@Component({
  selector: 'app-accounts',
  templateUrl: './accounts.page.html',
  styleUrls: ['./accounts.page.scss'],
  imports: [
    NgTemplateOutlet, MoneyPipe, TranslatePipe, AccountEditorComponent,
    BadgeComponent, JumpComponent, AccountsFacesComponent,
    IonContent, IonRefresher, IonRefresherContent, IonSpinner, IonIcon, IonModal,
  ],
})
export class AccountsPage {
  private readonly database = inject(DatabaseService);
  private readonly filter = inject(FilterService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly accentService = inject(AccentService);
  readonly accent = computed(() => this.accentService.accent().color);
  private readonly i18n = inject(I18nService);
  readonly rates = inject(RatesService);

  /** Non-null while the editor is open; its account is null when creating. */
  readonly editor = signal<{ account: AccountRow | null } | null>(null);


  readonly grouped = signal<GroupedBalance[] | null>(null);
  /** The accounts that are loans: their pencil opens the loan's own form. */
  readonly loanIds = signal<ReadonlySet<number>>(new Set());
  readonly netWorthMinor = signal(0);
  readonly showArchived = signal(false);


  /**
   * The currencies the app knows, and the form for adding one.
   *
   * On this screen rather than behind a settings menu: a currency exists to
   * denominate an account, so this is where someone goes looking for it. It
   * was reachable only from inside the new-account form before, which is to
   * say not reachable at all unless you were already making an account.
   */
  readonly currencies = signal<{ code: string; name: string; symbol: string; used: number }[]>([]);

  /** The total, and every line that makes it. */
  readonly worth = signal<NetWorth | null>(null);
  readonly showBreakdown = signal(false);

  /** Currencies holding money that has no rate to value it with. */
  readonly missingRates = computed(() => this.worth()?.missingRatesFor ?? []);

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

    // "Es de una cuenta nueva", chosen after reading a statement from the
    // "+": the new-account form opens filled in from it (2h).
    this.route.queryParamMap.subscribe(params => {
      if (params.get('new') !== 'statement') return;
      this.editor.set({ account: null });
      void this.router.navigate([], { queryParams: {}, replaceUrl: true });
    });

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
    this.loanIds.set(new Set(await new LoansRepository(this.database.driver).ids()));
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

  openCurrencies(): void {
    void this.router.navigateByUrl('/currencies');
  }

  /** "COP, USD, EUR · TRM del 27 sept". */
  readonly currenciesLine = computed(() => {
    const codes = this.currencies().filter(c => c.used > 0).map(c => c.code).join(', ');
    const trm = this.rates.current();
    if (!trm) return codes;
    const day = shortDay(trm.on_date, this.i18n.dateLocale());
    return `${codes} · ${this.i18n.t('accounts.trm.on', { date: day })}`;
  });

  readonly archivedToggle = computed(() => {
    const count = this.archivedCount();
    const key = this.showArchived()
      ? (count === 1 ? 'accounts.hideArchived.one' : 'accounts.hideArchived')
      : (count === 1 ? 'accounts.showArchived.one' : 'accounts.showArchived');
    return this.i18n.t(key as 'accounts.showArchived', { count });
  });

  currencyCount(count: number): string {
    return count === 1 ? this.i18n.t('accounts.currencies.one') : this.i18n.t('accounts.currencies', { count });
  }

  /** The grey line under an account: what a card has left, or why it is apart. */
  lineOf(balance: AccountBalance): string {
    const account = balance.account;
    if (balance.available_credit_minor !== null && account.credit_limit_minor) {
      return this.i18n.t('accounts.availableOf', {
        available: formatMoney(balance.available_credit_minor, account.currency_code, { withSymbol: false }),
        limit: formatMoney(account.credit_limit_minor, account.currency_code, { withSymbol: false }),
      });
    }
    if (account.archived) return '';
    if (this.loanIds().has(account.id)) return this.i18n.t('loans.kind');
    if (!account.include_in_net_worth) return this.i18n.t('ui.account.setAside');
    if (this.missingRates().includes(account.currency_code) && balance.balance_minor !== 0) {
      return this.i18n.t('ui.account.noRate');
    }
    return '';
  }

  /** How much of a card's limit is spent, for the bar under it. */
  usedPct(balance: AccountBalance): number {
    const limit = balance.account.credit_limit_minor ?? 0;
    if (limit <= 0) return 0;
    return Math.max(0, Math.min(100, Math.round((limit - (balance.available_credit_minor ?? limit)) / limit * 100)));
  }

  codeColor(code: string): string {
    return CODE_COLORS[code] ?? '#9b7bff';
  }

  codeTint(code: string): string {
    const n = parseInt(this.codeColor(code).slice(1), 16);
    return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, 0.16)`;
  }

  private accountOf(id: number): AccountRow | undefined {
    for (const entry of this.grouped() ?? []) {
      for (const balance of entry.balances) if (balance.account.id === id) return balance.account;
    }
    return undefined;
  }

  iconOf(id: number): string | null { return this.accountOf(id)?.builtin_icon ?? null; }
  customOf(id: number): number | null { return this.accountOf(id)?.custom_icon_id ?? null; }
  colorOf(id: number): string | null { return this.accountOf(id)?.color ?? null; }
  isCard(id: number): boolean { return this.accountOf(id)?.type === 'credit'; }

  edit(account: AccountRow | null): void {
    if (account && this.loanIds().has(account.id)) {
      void this.router.navigate(['/debts/loan', account.id]);
      return;
    }
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
