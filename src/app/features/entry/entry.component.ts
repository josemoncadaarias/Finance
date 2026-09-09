/**
 * Recording a movement, correcting one, and moving money between accounts.
 *
 * The thing Monefy is genuinely good at is that adding an expense costs three
 * steps: amount, category, save. Everything here is arranged around not being
 * slower than that — the keypad is ready, the category grid needs no scrolling
 * for the common ones, and account and date already hold the answer that is
 * right most of the time.
 *
 * A transfer is the same screen with the category grid swapped for two
 * accounts, because it is the same act: an amount, a where, a when.
 *
 * Editing saves through the repository, which locks the row, so a later
 * re-import of the Monefy backup leaves the correction alone.
 */

import { Component, computed, inject, input, output, signal, type OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonContent, IonHeader, IonToolbar, IonButton, IonButtons, IonIcon,
  IonItem, IonInput, IonDatetime, IonModal, IonList, IonLabel, IonFooter,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import * as allIcons from 'ionicons/icons';

import { DatabaseService } from '../../core/database/database.service';
import { CategoriesRepository } from '../../core/database/repositories/categories.repository';
import { AccountsRepository } from '../../core/database/repositories/accounts.repository';
import { TransactionsRepository } from '../../core/database/repositories/transactions.repository';
import { TransfersRepository } from '../../core/database/repositories/transfers.repository';
import type { AccountRow, CategoryRow, TransactionRow } from '../../core/database/types';
import { deriveRateScaled, formatMoney } from '../../core/database/money';
import { AmountBuffer } from './amount-buffer';

export type EntryKind = 'expense' | 'income' | 'transfer';

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
    IonContent, IonHeader, IonToolbar, IonButton, IonButtons, IonIcon,
    IonItem, IonInput, IonDatetime, IonModal, IonList, IonLabel, IonFooter,
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
  /** Only used when a transfer crosses currencies. */
  readonly targetAmount = signal(new AmountBuffer());
  readonly editingTarget = signal(false);

  readonly categoryId = signal<number | null>(null);
  readonly accountId = signal<number | null>(null);
  readonly toAccountId = signal<number | null>(null);
  readonly occurredOn = signal(todayIso());
  readonly note = signal('');
  readonly saving = signal(false);
  readonly error = signal('');

  readonly categories = signal<CategoryRow[]>([]);
  readonly accounts = signal<AccountRow[]>([]);
  /** Which picker is open: the source account, the destination, or neither. */
  readonly picking = signal<'from' | 'to' | null>(null);
  readonly showDate = signal(false);

  readonly kind = computed(() => this.request().kind);
  readonly isEditing = computed(() => this.request().editing !== undefined);
  readonly isTransfer = computed(() => this.kind() === 'transfer');

  readonly account = computed(() => this.find(this.accountId()));
  readonly toAccount = computed(() => this.find(this.toAccountId()));

  readonly currency = computed(() => this.account()?.currency_code ?? 'COP');
  readonly targetCurrency = computed(() => this.toAccount()?.currency_code ?? 'COP');

  /** True when the two sides of a transfer are in different currencies. */
  readonly crossesCurrency = computed(() =>
    this.isTransfer() && this.toAccount() !== null && this.currency() !== this.targetCurrency());

  readonly activeBuffer = computed(() =>
    this.editingTarget() ? this.targetAmount() : this.amount());

  readonly title = computed(() => {
    if (this.isEditing()) return 'Editar movimiento';
    if (this.isTransfer()) return 'Transferencia';
    return this.kind() === 'expense' ? 'Nuevo gasto' : 'Nuevo ingreso';
  });

  readonly selectedCategory = computed(() =>
    this.categories().find(c => c.id === this.categoryId()) ?? null);

  readonly dateLabel = computed(() => {
    const iso = this.occurredOn();
    if (iso === todayIso()) return 'Hoy';
    const [year, month, day] = iso.split('-').map(Number);
    const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
      'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    return `${day} ${months[month - 1]} ${year}`;
  });

  /**
   * What is still missing, in the order it should be fixed.
   *
   * Shown as a prompt rather than left for the user to work out from a greyed
   * button. A disabled control that says nothing is the app refusing without
   * explaining itself.
   */
  readonly missing = computed<string | null>(() => {
    if (this.amount().minor <= 0) return 'Escribe el monto';
    if (this.accountId() === null) return 'Escoge la cuenta';

    if (this.isTransfer()) {
      if (this.toAccountId() === null) return 'Escoge la cuenta de destino';
      if (this.toAccountId() === this.accountId()) return 'Las dos cuentas no pueden ser la misma';
      if (this.crossesCurrency() && this.targetAmount().minor <= 0) {
        return `Escribe cuánto llegó en ${this.targetCurrency()}`;
      }
      return null;
    }

    if (this.categoryId() === null) return 'Escoge una categoría';
    return null;
  });

  readonly canSave = computed(() => this.missing() === null);

  constructor() {
    addIcons(allIcons as unknown as Record<string, string>);
  }

  ngOnInit(): void {
    // Not the constructor: a required input has no value there yet, and load()
    // reads one. Angular says so with NG0950 rather than a blank screen.
    void this.load();
  }

  private find(id: number | null): AccountRow | null {
    return id === null ? null : this.accounts().find(a => a.id === id) ?? null;
  }

  private async load(): Promise<void> {
    if (this.database.status() !== 'ready') return;
    const driver = this.database.driver;

    const [categories, accounts] = await Promise.all([
      this.isTransfer()
        ? Promise.resolve([] as CategoryRow[])
        : new CategoriesRepository(driver).list({
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
      return;
    }

    const from = await this.defaultAccount(accounts);
    this.accountId.set(from);
    if (this.isTransfer()) {
      this.toAccountId.set(await this.defaultDestination(accounts, from));
    }
  }

  /**
   * Where a new movement should land before anyone chooses.
   *
   * Alphabetical order put 'ARQ EUR' first, which would have quietly recorded
   * pesos as euros. In order of preference: the account the screen is already
   * filtered to, then the one used most recently, then anything in pesos.
   */
  private async defaultAccount(accounts: readonly AccountRow[]): Promise<number | null> {
    if (accounts.length === 0) return null;

    const preferred = this.request().preferredAccountId;
    if (preferred != null && accounts.some(a => a.id === preferred)) return preferred;

    // A transfer starts from wherever money usually leaves, which is not the
    // same as where it was last spent. The most recent expense is on the
    // credit card, and money almost never leaves a credit card — starting
    // there also drags the destination somewhere strange, since the card has
    // barely any outgoing history to learn from.
    const recent = await this.database.driver.queryOne<{ account_id: number }>(
      this.isTransfer()
        ? `SELECT account_id, COUNT(*) AS times
           FROM transactions
           WHERE transfer_leg = 'from'
           GROUP BY account_id
           ORDER BY times DESC
           LIMIT 1`
        : `SELECT account_id FROM transactions
           WHERE transfer_id IS NULL
           ORDER BY occurred_on DESC, id DESC
           LIMIT 1`,
    );
    if (recent && accounts.some(a => a.id === recent.account_id)) return recent.account_id;

    return (accounts.find(a => a.currency_code === 'COP') ?? accounts[0]).id;
  }

  /**
   * Where money most often goes from that account.
   *
   * Transfers repeat: the same card gets paid from the same account month
   * after month. Offering last time's destination is right far more often than
   * offering whatever sorts first.
   */
  private async defaultDestination(
    accounts: readonly AccountRow[],
    from: number | null,
  ): Promise<number | null> {
    if (from === null) return null;

    const usual = await this.database.driver.queryOne<{ account_id: number }>(
      `SELECT other.account_id AS account_id, COUNT(*) AS times
       FROM transactions t
       JOIN transactions other
         ON other.transfer_id = t.transfer_id AND other.id <> t.id
       WHERE t.account_id = ? AND t.transfer_leg = 'from'
       GROUP BY other.account_id
       ORDER BY times DESC
       LIMIT 1`,
      [from],
    );
    if (usual && accounts.some(a => a.id === usual.account_id)) return usual.account_id;

    // No history from this account. The account that receives transfers most
    // often is a far better guess than whichever sorts first — for Jose that
    // is the credit card, which is paid every month.
    const popular = await this.database.driver.queryOne<{ account_id: number }>(
      `SELECT account_id, COUNT(*) AS times
       FROM transactions
       WHERE transfer_leg = 'to' AND account_id <> ?
       GROUP BY account_id
       ORDER BY times DESC
       LIMIT 1`,
      [from],
    );
    if (popular && accounts.some(a => a.id === popular.account_id)) return popular.account_id;

    // Last resort: something in the same currency, so the amount means the
    // same on both sides.
    const currency = accounts.find(a => a.id === from)?.currency_code;
    return (
      accounts.find(a => a.id !== from && a.currency_code === currency) ??
      accounts.find(a => a.id !== from)
    )?.id ?? null;
  }

  press(key: string): void {
    const buffer = this.activeBuffer();
    if (key === '<') buffer.backspace();
    else if (key === ',') buffer.separator();
    else buffer.push(key);

    // A new object so the signal notices: the buffer mutates in place.
    const copy = Object.assign(Object.create(AmountBuffer.prototype), buffer);
    if (this.editingTarget()) this.targetAmount.set(copy);
    else this.amount.set(copy);
  }

  focusAmount(target: boolean): void {
    this.editingTarget.set(target);
  }

  pickCategory(id: number): void {
    this.categoryId.set(id);
  }

  async pickAccount(id: number): Promise<void> {
    if (this.picking() === 'to') {
      this.toAccountId.set(id);
    } else {
      this.accountId.set(id);
      // Changing where the money leaves from changes where it usually goes.
      if (this.isTransfer() && this.toAccountId() === id) {
        this.toAccountId.set(await this.defaultDestination(this.accounts(), id));
      }
    }
    this.picking.set(null);
  }

  swapAccounts(): void {
    const from = this.accountId();
    this.accountId.set(this.toAccountId());
    this.toAccountId.set(from);
  }

  pickDate(value: string | null): void {
    if (value) this.occurredOn.set(value.slice(0, 10));
    this.showDate.set(false);
  }

  money(minor: number, currency = this.currency()): string {
    return formatMoney(minor, currency, { withSymbol: false });
  }

  async save(): Promise<void> {
    if (!this.canSave() || this.saving()) return;
    this.saving.set(true);
    this.error.set('');

    try {
      if (this.isTransfer()) await this.saveTransfer();
      else await this.saveMovement();

      this.database.dataChanged();
      this.saved.emit();
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : String(error));
    } finally {
      this.saving.set(false);
    }
  }

  private async saveMovement(): Promise<void> {
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
      return;
    }

    await transactions.create({
      account_id: this.accountId()!,
      category_id: this.categoryId(),
      occurred_on: this.occurredOn(),
      amount_minor: signed,
      description: this.note().trim() || null,
      source: 'manual',
    });
  }

  private async saveTransfer(): Promise<void> {
    const out = this.amount().minor;
    const into = this.crossesCurrency() ? this.targetAmount().minor : out;

    // Across currencies the two amounts differ, and the rate between them is
    // worth keeping: it is the rate the provider actually applied that day,
    // which cannot be looked up afterwards.
    const rateScaled = this.crossesCurrency() ? deriveRateScaled(out, into) : null;

    await new TransfersRepository(this.database.driver).create({
      occurred_on: this.occurredOn(),
      description: this.note().trim() || null,
      from: { account_id: this.accountId()!, amount_minor: out },
      to: {
        account_id: this.toAccountId()!,
        amount_minor: into,
        rate_scaled: rateScaled,
        amount_base_minor: this.crossesCurrency() ? out : undefined,
        rate_source: rateScaled === null ? null : 'derived',
      },
      source: 'manual',
    });
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
