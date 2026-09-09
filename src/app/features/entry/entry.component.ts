/**
 * Recording a movement, and correcting one.
 *
 * The thing Monefy is genuinely good at is that adding an expense costs four
 * taps: amount, category, done. Everything here is arranged around not being
 * slower than that — the keypad opens focused, the category grid is one screen
 * with no scrolling for the common ones, and account and date are already
 * filled with the answer that is right most of the time.
 *
 * Editing reuses the same screen. Saving an edit locks the row, so a later
 * re-import of the Monefy backup leaves the correction alone.
 */

import { Component, computed, inject, input, output, signal, type OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonContent, IonHeader, IonToolbar, IonTitle, IonButton, IonButtons, IonIcon,
  IonItem, IonLabel, IonInput, IonDatetime, IonModal, IonList, IonNote,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import * as allIcons from 'ionicons/icons';

import { DatabaseService } from '../../core/database/database.service';
import { CategoriesRepository } from '../../core/database/repositories/categories.repository';
import { AccountsRepository } from '../../core/database/repositories/accounts.repository';
import { TransactionsRepository } from '../../core/database/repositories/transactions.repository';
import type { AccountRow, CategoryRow, TransactionRow } from '../../core/database/types';
import { formatMoney } from '../../core/database/money';
import { AmountBuffer } from './amount-buffer';

export type EntryKind = 'expense' | 'income';

export interface EntryRequest {
  kind: EntryKind;
  /** Present when correcting an existing movement. */
  editing?: TransactionRow;
  /**
   * The account to start on: whichever one the summary screen is showing.
   * Null when it is showing all of them, and then the most recently used one
   * is the better guess.
   */
  preferredAccountId?: number | null;
}

@Component({
  selector: 'app-entry',
  imports: [
    CommonModule,
    IonContent, IonHeader, IonToolbar, IonTitle, IonButton, IonButtons, IonIcon,
    IonItem, IonLabel, IonInput, IonDatetime, IonModal, IonList, IonNote,
  ],
  templateUrl: './entry.component.html',
  styleUrls: ['./entry.component.scss'],
})
export class EntryComponent implements OnInit {
  private readonly database = inject(DatabaseService);

  readonly request = input.required<EntryRequest>();
  readonly saved = output<void>();
  readonly cancelled = output<void>();

  readonly amount = signal(new AmountBuffer());
  readonly categoryId = signal<number | null>(null);
  readonly accountId = signal<number | null>(null);
  readonly occurredOn = signal(todayIso());
  readonly note = signal('');
  readonly saving = signal(false);
  readonly error = signal('');

  readonly categories = signal<CategoryRow[]>([]);
  readonly accounts = signal<AccountRow[]>([]);
  readonly showAccounts = signal(false);
  readonly showDate = signal(false);

  readonly isEditing = computed(() => this.request().editing !== undefined);
  readonly kind = computed(() => this.request().kind);

  readonly account = computed(() =>
    this.accounts().find(a => a.id === this.accountId()) ?? null);

  readonly currency = computed(() => this.account()?.currency_code ?? 'COP');

  readonly display = computed(() => {
    const buffer = this.amount();
    return buffer.isEmpty ? '0' : buffer.text;
  });

  readonly canSave = computed(() =>
    this.amount().minor > 0 && this.categoryId() !== null && this.accountId() !== null);

  readonly dateLabel = computed(() => {
    const iso = this.occurredOn();
    if (iso === todayIso()) return 'Hoy';
    const [year, month, day] = iso.split('-').map(Number);
    const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
      'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    return `${day} ${months[month - 1]} ${year}`;
  });

  constructor() {
    addIcons(allIcons as unknown as Record<string, string>);
  }

  ngOnInit(): void {
    // Not the constructor: a required input has no value there yet, and load()
    // reads one. Angular says so with NG0950 rather than a blank screen, which
    // is how this was caught.
    void this.load();
  }

  private async load(): Promise<void> {
    if (this.database.status() !== 'ready') return;
    const driver = this.database.driver;

    const [categories, accounts] = await Promise.all([
      new CategoriesRepository(driver).list({
        kind: this.kind() === 'expense' ? 'expense' : 'income',
      }),
      new AccountsRepository(driver).list(),
    ]);

    this.categories.set(categories);
    this.accounts.set(accounts);

    const editing = this.request().editing;
    if (editing) {
      this.amount.set(AmountBuffer.from(editing.amount_minor));
      this.categoryId.set(editing.category_id);
      this.accountId.set(editing.account_id);
      this.occurredOn.set(editing.occurred_on);
      this.note.set(editing.description ?? '');
    } else {
      this.accountId.set(await this.defaultAccount(accounts));
    }
  }

  /**
   * Where a new movement should land before anyone chooses.
   *
   * Alphabetical order put 'ARQ EUR' first, which would have quietly recorded
   * pesos as euros. In order of preference: the account the screen is already
   * filtered to, then the one used most recently, then anything in the base
   * currency.
   */
  private async defaultAccount(accounts: readonly AccountRow[]): Promise<number | null> {
    if (accounts.length === 0) return null;

    const preferred = this.request().preferredAccountId;
    if (preferred != null && accounts.some(a => a.id === preferred)) return preferred;

    const recent = await this.database.driver.queryOne<{ account_id: number }>(
      `SELECT account_id FROM transactions
       WHERE transfer_id IS NULL
       ORDER BY occurred_on DESC, id DESC
       LIMIT 1`,
    );
    if (recent && accounts.some(a => a.id === recent.account_id)) return recent.account_id;

    return (accounts.find(a => a.currency_code === 'COP') ?? accounts[0]).id;
  }

  press(key: string): void {
    const buffer = this.amount();
    if (key === '<') buffer.backspace();
    else if (key === ',') buffer.separator();
    else buffer.push(key);
    // A new object so the signal notices: the buffer mutates in place.
    this.amount.set(Object.assign(Object.create(AmountBuffer.prototype), buffer));
  }

  pickCategory(id: number): void {
    this.categoryId.set(id);
  }

  pickAccount(id: number): void {
    this.accountId.set(id);
    this.showAccounts.set(false);
  }

  pickDate(value: string | null): void {
    if (value) this.occurredOn.set(value.slice(0, 10));
    this.showDate.set(false);
  }

  money(minor: number): string {
    return formatMoney(minor, this.currency(), { withSymbol: false });
  }

  async save(): Promise<void> {
    if (!this.canSave() || this.saving()) return;
    this.saving.set(true);
    this.error.set('');

    try {
      const transactions = new TransactionsRepository(this.database.driver);
      // The sign comes from the button pressed, never from what was typed.
      const signed = this.kind() === 'expense' ? -this.amount().minor : this.amount().minor;
      const editing = this.request().editing;

      if (editing) {
        // Locks the row, so a re-import of the backup will not undo this.
        await transactions.update(editing.id, {
          account_id: this.accountId()!,
          category_id: this.categoryId(),
          occurred_on: this.occurredOn(),
          amount_minor: signed,
          description: this.note().trim() || null,
        });
      } else {
        await transactions.create({
          account_id: this.accountId()!,
          category_id: this.categoryId(),
          occurred_on: this.occurredOn(),
          amount_minor: signed,
          description: this.note().trim() || null,
          source: 'manual',
        });
      }

      this.database.dataChanged();
      this.saved.emit();
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : String(error));
    } finally {
      this.saving.set(false);
    }
  }

  async remove(): Promise<void> {
    const editing = this.request().editing;
    if (!editing) return;

    this.saving.set(true);
    try {
      await new TransactionsRepository(this.database.driver).delete(editing.id);
      this.database.dataChanged();
      this.saved.emit();
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : String(error));
    } finally {
      this.saving.set(false);
    }
  }
}

function todayIso(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}
