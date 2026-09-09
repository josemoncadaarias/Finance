/**
 * The month view: what came in, what went out, and where it went.
 *
 * Transfers are left out of the totals on purpose. Moving money from
 * Bancolombia to Nequi is not income and not spending, and counting it as
 * either is how a month ends up looking twice as busy as it was.
 */

import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonContent, IonHeader, IonToolbar, IonTitle, IonList, IonItem, IonLabel,
  IonNote, IonIcon, IonButton, IonButtons, IonSpinner, IonItemDivider,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { chevronBackOutline, chevronForwardOutline, swapHorizontalOutline, lockClosedOutline } from 'ionicons/icons';

import { DatabaseService } from '../../core/database/database.service';
import { TransactionsRepository } from '../../core/database/repositories/transactions.repository';
import { AccountsRepository } from '../../core/database/repositories/accounts.repository';
import { CategoriesRepository } from '../../core/database/repositories/categories.repository';
import type { TransactionRow } from '../../core/database/types';
import { MoneyPipe } from '../../shared/money.pipe';
import { SignPipe } from '../../shared/sign.pipe';

interface DisplayRow {
  transaction: TransactionRow;
  accountName: string;
  currency: string;
  categoryName: string;
  isTransfer: boolean;
}

interface DayGroup {
  date: string;
  label: string;
  rows: DisplayRow[];
}

const MONTHS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

@Component({
  selector: 'app-transactions',
  templateUrl: './transactions.page.html',
  styleUrls: ['./transactions.page.scss'],
  imports: [
    CommonModule, MoneyPipe, SignPipe,
    IonContent, IonHeader, IonToolbar, IonTitle, IonList, IonItem, IonLabel,
    IonNote, IonIcon, IonButton, IonButtons, IonSpinner, IonItemDivider,
  ],
})
export class TransactionsPage {
  private readonly database = inject(DatabaseService);

  /** First day of the month being shown. */
  readonly month = signal(startOfMonth(new Date()));
  readonly days = signal<DayGroup[] | null>(null);
  readonly incomeMinor = signal(0);
  readonly expenseMinor = signal(0);

  readonly status = this.database.status;

  readonly monthLabel = computed(() => {
    const date = this.month();
    return `${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
  });

  readonly isCurrentMonth = computed(() => {
    const now = startOfMonth(new Date());
    return this.month().getTime() >= now.getTime();
  });

  readonly count = computed(() => (this.days() ?? []).reduce((n, day) => n + day.rows.length, 0));

  constructor() {
    addIcons({ chevronBackOutline, chevronForwardOutline, swapHorizontalOutline, lockClosedOutline });

    // Watches the status only: load() reads month(), and tracking that here
    // would race with step(), which loads on purpose.
    effect(() => {
      this.database.dataVersion();
      if (this.database.status() === 'ready') untracked(() => void this.load());
    });
  }

  async load(): Promise<void> {
    if (this.database.status() !== 'ready') return;
    this.days.set(null);

    const driver = this.database.driver;
    const transactions = new TransactionsRepository(driver);
    const accounts = new AccountsRepository(driver);
    const categories = new CategoriesRepository(driver);

    const from = isoDay(this.month());
    const to = isoDay(endOfMonth(this.month()));

    const [rows, accountList, categoryList] = await Promise.all([
      transactions.list({ from, to }),
      accounts.list({ includeArchived: true }),
      categories.list({ includeArchived: true }),
    ]);

    const accountsById = new Map(accountList.map(a => [a.id, a]));
    const categoriesById = new Map(categoryList.map(c => [c.id, c]));

    const display: DisplayRow[] = rows.map(transaction => {
      const account = accountsById.get(transaction.account_id);
      const category = transaction.category_id !== null
        ? categoriesById.get(transaction.category_id)
        : undefined;
      return {
        transaction,
        accountName: account?.name ?? '—',
        currency: account?.currency_code ?? 'COP',
        categoryName: category?.name ?? 'Transferencia',
        isTransfer: transaction.transfer_id !== null,
      };
    });

    // Totals use the base amount so a month mixing pesos and dollars still adds
    // up, and skip transfers, which move money without earning or spending it.
    let income = 0;
    let expense = 0;
    for (const row of display) {
      if (row.isTransfer) continue;
      const amount = row.transaction.amount_base_minor;
      if (amount > 0) income += amount;
      else expense += amount;
    }
    this.incomeMinor.set(income);
    this.expenseMinor.set(expense);

    this.days.set(groupByDay(display));
  }

  async step(months: number): Promise<void> {
    const date = this.month();
    this.month.set(new Date(date.getFullYear(), date.getMonth() + months, 1));
    await this.load();
  }
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function isoDay(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function groupByDay(rows: readonly DisplayRow[]): DayGroup[] {
  const byDate = new Map<string, DisplayRow[]>();
  for (const row of rows) {
    const date = row.transaction.occurred_on;
    (byDate.get(date) ?? byDate.set(date, []).get(date)!).push(row);
  }

  return [...byDate.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, dayRows]) => ({ date, label: dayLabel(date), rows: dayRows }));
}

function dayLabel(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number);
  return `${day} de ${MONTHS[month - 1]}`;
}
