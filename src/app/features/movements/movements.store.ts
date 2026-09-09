/**
 * Loads what the movements screen shows, and keeps it in step with the filter.
 *
 * The page stays a template: it reads signals and renders. Everything about
 * which rows to fetch and what they mean lives here.
 */

import { Injectable, computed, effect, inject, signal } from '@angular/core';

import { DatabaseService } from '../../core/database/database.service';
import { AccountsRepository } from '../../core/database/repositories/accounts.repository';
import {
  TransactionsRepository, type DetailedTransaction,
} from '../../core/database/repositories/transactions.repository';
import { FilterService } from '../../core/filters/filter.service';
import type { AccountRow } from '../../core/database/types';
import {
  flowOf, groupMovements, matchesSearch, slicesOf, totalsOf,
  type Movement, type MovementGroup, type Slice, type Totals,
} from './group-movements';

@Injectable({ providedIn: 'root' })
export class MovementsStore {
  private readonly database = inject(DatabaseService);
  private readonly filter = inject(FilterService);

  readonly accounts = signal<AccountRow[]>([]);
  readonly loading = signal(false);

  /** Everything in scope for the period, before search or category filtering. */
  private readonly rows = signal<Movement[]>([]);

  /** Groups the user has collapsed, by key. */
  private readonly collapsed = signal<ReadonlySet<string>>(new Set());

  readonly selectedAccount = computed(() => {
    const id = this.filter.accountId();
    return id === null ? null : this.accounts().find(a => a.id === id) ?? null;
  });

  /** How many accounts "all" is currently hiding, so the UI can offer them. */
  readonly hiddenCount = computed(() =>
    this.accounts().filter(a => !a.archived && a.include_in_net_worth === 0).length,
  );

  /** After the search box and any category picked from the donut. */
  readonly visible = computed(() => {
    const search = this.filter.search();
    const category = this.filter.categoryFilter();

    return this.rows()
      .filter(movement => category === null || movement.label === category)
      .filter(movement => matchesSearch(movement, search));
  });

  readonly totals = computed<Totals>(() => totalsOf(this.visible()));
  readonly slices = computed<Slice[]>(() => slicesOf(this.rows()));

  readonly groups = computed<MovementGroup[]>(() =>
    groupMovements(this.visible(), this.filter.grouping(), this.filter.sortWithin()),
  );

  /** True when every group is collapsed, so one control can do both jobs. */
  readonly allCollapsed = computed(() => {
    const groups = this.groups();
    return groups.length > 0 && groups.every(group => this.collapsed().has(group.key));
  });

  readonly currency = computed(() => this.selectedAccount()?.currency_code ?? 'COP');

  constructor() {
    effect(() => {
      // Reruns whenever the database opens, the data changes, or the filter
      // moves. Everything downstream is derived, so this is the only load.
      this.database.dataVersion();
      this.filter.accountId();
      this.filter.period();
      this.filter.includeExcluded();

      if (this.database.status() === 'ready') void this.load();
    });
  }

  isCollapsed(key: string): boolean {
    return this.collapsed().has(key);
  }

  toggleGroup(key: string): void {
    this.collapsed.update(current => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  collapseAll(): void {
    this.collapsed.set(new Set(this.groups().map(group => group.key)));
  }

  expandAll(): void {
    this.collapsed.set(new Set());
  }

  toggleAll(): void {
    if (this.allCollapsed()) this.expandAll();
    else this.collapseAll();
  }

  /** Only asked once: after that the filter has an answer of its own. */
  private startResolved = false;

  /**
   * Starts on the account the spending actually happens on.
   *
   * "Todas las cuentas" is a summary of everything, which is rarely the
   * question being asked when the app is opened — the answer wanted is
   * usually about the account money is spent from. Most used over the last
   * year, so a rare purchase somewhere else does not move where the app
   * opens. Choosing any account by hand, "todas" included, ends the guessing
   * for good.
   */
  private async openOnBusiestAccount(accounts: readonly AccountRow[]): Promise<void> {
    if (this.startResolved) return;
    this.startResolved = true;

    const since = aYearAgo();
    const ranked = await this.database.driver.query<{ account_id: number }>(
      `SELECT account_id, COUNT(*) AS times
       FROM transactions
       WHERE transfer_id IS NULL AND amount_minor < 0 AND occurred_on >= ?
       GROUP BY account_id
       ORDER BY times DESC
       LIMIT 5`,
      [since],
    );

    const busiest = ranked.find(row => accounts.some(a => a.id === row.account_id && !a.archived));
    this.filter.startOn(busiest?.account_id ?? null);
  }

  async load(): Promise<void> {
    const driver = this.database.driver;
    this.loading.set(true);

    try {
      const accountsRepo = new AccountsRepository(driver);
      const accounts = await accountsRepo.list({ includeArchived: true });
      this.accounts.set(accounts);

      await this.openOnBusiestAccount(accounts);

      const scope = this.filter.scopeFor(accounts);
      const period = this.filter.period();

      const detailed = await new TransactionsRepository(driver).listDetailed({
        accountIds: scope,
        from: period.from ?? undefined,
        to: period.to ?? undefined,
      });

      // A transfer is only invisible when both of its ends are inside what is
      // being looked at: moving money between two accounts you are counting
      // changes nothing. Moving it to an account outside the scope - eToro,
      // Pibank para renta, an archived one - really is money leaving, and
      // hiding it would lose it.
      const inScope = new Set(scope);
      const visible = detailed.filter(row =>
        row.transfer_id === null ||
        row.other_account_id === null ||
        !inScope.has(row.other_account_id));

      this.rows.set(visible.map(toMovement));
    } finally {
      this.loading.set(false);
    }
  }
}

/**
 * Turns a database row into something the screen can label.
 *
 * A transfer leg has no category, so it is labelled by where the money went or
 * came from — which is what it means — rather than left blank.
 */
function toMovement(row: DetailedTransaction): Movement {
  const isTransfer = row.transfer_id !== null;
  const other = row.other_account_name ?? 'otra cuenta';

  return {
    transaction: row,
    accountName: row.account_name,
    accountType: row.account_type,
    currency: row.currency_code,
    label: isTransfer
      ? row.transfer_leg === 'from' ? `A ${other}` : `De ${other}`
      : row.category_name ?? 'Sin categoría',
    icon: isTransfer ? 'swap-horizontal-outline' : row.category_icon,
    flow: flowOf(row, row.account_type),
  };
}

/** Today, one year back. Text dates compare in the same order as real ones. */
function aYearAgo(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear() - 1}-${month}-${day}`;
}
