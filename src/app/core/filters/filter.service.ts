/**
 * The one filter every view obeys.
 *
 * Account and period live here rather than in a page, because the donut, the
 * list and the balance are three readings of the same question and must never
 * disagree about what is being asked.
 */

import { Injectable, computed, signal } from '@angular/core';

import { currentPeriod, shiftPeriod, type Period, type PeriodKind } from './period';
import type { Grouping } from '../../features/movements/group-movements';
import type { AccountRow } from '../database/types';

@Injectable({ providedIn: 'root' })
export class FilterService {
  /** The account in scope, or null for all of them. */
  readonly accountId = signal<number | null>(null);

  readonly period = signal<Period>(currentPeriod('month'));

  readonly grouping = signal<Grouping>('date');

  readonly search = signal('');

  /** The list is shown over the donut; the control beside the balance toggles. */
  readonly showList = signal(false);

  /**
   * Whether "all accounts" also counts the ones kept out of net worth.
   *
   * Off by default: eToro, XTB and Pibank para renta are exactly the accounts
   * whose figures Jose does not want summed. On, for when he wants to see
   * everything at once anyway.
   */
  readonly includeExcluded = signal(false);

  /** Set by tapping a slice of the donut. */
  readonly categoryFilter = signal<string | null>(null);

  readonly allAccounts = computed(() => this.accountId() === null);

  /**
   * The accounts a query should cover.
   *
   * One selected account is used whatever its flags say — an archived or
   * excluded account is still viewable on its own; it just does not join the
   * total.
   */
  scopeFor(accounts: readonly AccountRow[]): number[] {
    const selected = this.accountId();
    if (selected !== null) return [selected];

    return accounts
      .filter(account => !account.archived)
      .filter(account => this.includeExcluded() || account.include_in_net_worth === 1)
      .map(account => account.id);
  }

  setPeriodKind(kind: PeriodKind): void {
    this.period.set(currentPeriod(kind));
  }

  /** One swipe: negative goes back, positive forward. */
  step(steps: number): void {
    this.period.update(period => shiftPeriod(period, steps));
  }

  selectAccount(id: number | null): void {
    this.accountId.set(id);
    // A category picked from one account's donut means nothing in another's.
    this.categoryFilter.set(null);
  }

  openCategory(label: string): void {
    this.categoryFilter.set(label);
    this.showList.set(true);
  }

  clearCategory(): void {
    this.categoryFilter.set(null);
  }

  toggleList(): void {
    this.showList.update(shown => !shown);
    if (!this.showList()) this.categoryFilter.set(null);
  }
}
