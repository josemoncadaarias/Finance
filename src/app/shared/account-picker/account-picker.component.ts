/**
 * Choosing an account from a list: the one list the app shows everywhere.
 *
 * A sheet from the bottom with its grab handle: "Cancelar", a heading said
 * for the occasion, the two orders - most used and A-Z, under the key every
 * account list shares - one list with each account in its circle, what it
 * holds under its name, and a tick on the one in force (mockups `1k`, `1r`,
 * `6t`). Which accounts are offered is the caller's business, the order is
 * this one's.
 *
 * A list that chooses which account to LOOK AT starts with "Todas las
 * cuentas" (`showAll`); one that chooses where a movement comes from, or
 * whose statement it is, does not - they belong to one account (Jose,
 * 2026-09-28).
 *
 *     <app-account-picker [open]="picking()" [accounts]="withProducts()"
 *                         [selectedId]="line.account.id"
 *                         (chosen)="switchTo($event)" (closed)="picking.set(false)">
 *     </app-account-picker>
 */

import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { IonModal, IonIcon } from '@ionic/angular';

import { DatabaseService } from '../../core/database/database.service';
import { AccountsRepository } from '../../core/database/repositories/accounts.repository';
import type { AccountRow } from '../../core/database/types';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { I18nService } from '../../core/i18n/i18n.service';
import { formatMoney } from '../../core/database/money';
import { BadgeComponent } from '../ui/badge.component';
import { foldText } from '../../core/text/fold-text';

/** The account list's order, the key every picker in the app shares. */
export function readAccountOrder(): 'use' | 'name' {
  try {
    return localStorage.getItem('finance.accountOrder') === 'use' ? 'use' : 'name';
  } catch {
    return 'name';
  }
}

export function saveAccountOrder(order: 'use' | 'name'): void {
  try {
    localStorage.setItem('finance.accountOrder', order);
  } catch {
    // A browser with site data blocked still gets the order for this visit.
  }
}

@Component({
  selector: 'app-account-picker',
  templateUrl: './account-picker.component.html',
  styleUrls: ['./account-picker.component.scss'],
  imports: [TranslatePipe, BadgeComponent, IonModal, IonIcon],
})
export class AccountPickerComponent {
  private readonly database = inject(DatabaseService);
  private readonly i18n = inject(I18nService);

  readonly open = input(false);
  readonly accounts = input<readonly AccountRow[]>([]);
  readonly selectedId = input<number | null>(null);
  /**
   * The heading over the list, said for the occasion: "Desde dónde" where
   * money leaves, "Hacia dónde" where it arrives, "Cuenta" when an account is
   * only being looked at. "Desde dónde" when nothing is said.
   */
  readonly heading = input<string | null>(null);
  /** "Todas las cuentas" first, for a list that chooses what to look at. */
  readonly showAll = input(false);
  /** What "Todas las cuentas" says under it: net worth and how many. */
  readonly allDetail = input('');
  /** What each row says under its name: what it holds, or what it is. */
  readonly detail = input<'balance' | 'kind'>('balance');
  /** "Es de una cuenta nueva" at the foot (importing a statement). */
  readonly offerNew = input(false);

  readonly chosen = output<AccountRow>();
  readonly chosenAll = output<void>();
  readonly newAccount = output<void>();
  readonly closed = output<void>();

  readonly order = signal<'use' | 'name'>(readAccountOrder());
  /** What was typed into the search, cleared each time the list opens. */
  readonly search = signal('');
  private readonly useCounts = signal<Map<number, number>>(new Map());
  private readonly balances = signal<Map<number, { balance: number; available: number | null }>>(new Map());
  readonly productCounts = signal<Map<number, number>>(new Map());

  constructor() {
    // What each account is used for and holds, read when the list opens, so
    // a closed picker costs nothing. Two queries, whatever the count.
    effect(() => {
      if (this.open()) this.search.set('');
    });
    effect(() => {
      if (!this.open() || this.database.status() !== 'ready') return;
      const accounts = new AccountsRepository(this.database.driver);
      void accounts.timesUsed().then(counts => this.useCounts.set(counts));
      void accounts.balances({ includeArchived: true }).then(rows => this.balances.set(new Map(
        rows.map(row => [row.account.id, { balance: row.balance_minor, available: row.available_credit_minor }]))));
      void this.database.driver.query<{ account_id: number; n: number }>(
        'SELECT account_id, COUNT(*) AS n FROM products GROUP BY account_id')
        .then(rows => this.productCounts.set(new Map(rows.map(r => [r.account_id, r.n]))))
        .catch(() => undefined);
    });
  }

  setOrder(order: 'use' | 'name'): void {
    this.order.set(order);
    saveAccountOrder(order);
  }

  /** `localeCompare` so "Éxito" files under E and not after Z. */
  readonly ordered = computed(() => {
    const wanted = foldText(this.search());
    const list = this.accounts().filter(a => wanted === '' || foldText(a.name).includes(wanted));
    if (this.order() === 'name') return list.sort((a, b) => a.name.localeCompare(b.name, 'es'));
    const times = this.useCounts();
    return list.sort((a, b) => {
      const byUse = (times.get(b.id) ?? 0) - (times.get(a.id) ?? 0);
      return byUse !== 0 ? byUse : a.name.localeCompare(b.name, 'es');
    });
  });

  /** The grey line under an account's name. */
  lineOf(account: AccountRow): string {
    if (this.detail() === 'kind') {
      const products = this.productCounts().get(account.id) ?? 0;
      const kind = this.i18n.t(`accounts.type.${account.type}` as 'accounts.type.debit');
      return products > 1
        ? `${kind} · ${this.i18n.t('ui.count.products', { count: products })}`
        : `${kind} · ${account.currency_code}`;
    }
    const held = this.balances().get(account.id);
    if (!held) return account.currency_code;
    const money = (minor: number) => formatMoney(minor, account.currency_code, { withSymbol: false });
    const suffix = account.currency_code === 'COP' ? '' : ` ${account.currency_code}`;
    if (account.type === 'credit') {
      if (held.available !== null) {
        return this.i18n.t('ui.picker.available', { amount: money(held.available) }) + suffix;
      }
      return this.i18n.t('ui.picker.owes', { amount: money(Math.abs(held.balance)) }) + suffix;
    }
    return money(held.balance) + suffix;
  }

  choose(account: AccountRow): void {
    this.chosen.emit(account);
  }
}
