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

import {
  Component, HostListener, computed, inject, input, output, signal, type OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonContent, IonHeader, IonToolbar, IonButton, IonButtons, IonIcon,
  IonItem, IonInput, IonDatetime, IonModal, IonList, IonLabel, IonFooter,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import * as allIcons from 'ionicons/icons';

import { DatabaseService } from '../../core/database/database.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { monthName } from '../../core/filters/period';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { CategoriesRepository } from '../../core/database/repositories/categories.repository';
import { AccountsRepository } from '../../core/database/repositories/accounts.repository';
import { TransactionsRepository } from '../../core/database/repositories/transactions.repository';
import { TransfersRepository } from '../../core/database/repositories/transfers.repository';
import type { AccountRow, CategoryRow, TransactionRow } from '../../core/database/types';
import { deriveRateScaled, formatMoney } from '../../core/database/money';
import { AmountBuffer } from './amount-buffer';
import {
  apply, isOperator, operatorFromKey, type Operator, type Pending,
} from './calculator';

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
    CommonModule, TranslatePipe,
    IonContent, IonHeader, IonToolbar, IonButton, IonButtons, IonIcon,
    IonItem, IonInput, IonDatetime, IonModal, IonList, IonLabel, IonFooter,
  ],
  templateUrl: './entry.component.html',
  styleUrls: ['./entry.component.scss'],
})
export class EntryComponent implements OnInit {
  private readonly database = inject(DatabaseService);
  readonly i18n = inject(I18nService);

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
  /**
   * A half-finished sum, when one is in progress.
   *
   * Splitting a bill or adding up a shop happens at the counter, and doing it
   * in another app and typing the result back is how amounts get mistyped.
   */
  readonly pending = signal<Pending | null>(null);

  /**
   * The pad, four columns wide.
   *
   * Backspace moved into the amount display to free this column, which is
   * where Monefy puts it too - and it is the right place: it acts on what is
   * shown there.
   */
  readonly keys = [
    '1', '2', '3', '+',
    '4', '5', '6', '-',
    '7', '8', '9', '×',
    ',', '0', '=', '÷',
  ];

  /** Set when the screen is editing an existing transfer rather than a movement. */
  readonly editingTransferId = signal<number | null>(null);
  /** Notes used before that match what is being typed. */
  readonly noteSuggestions = signal<string[]>([]);

  readonly kind = computed(() => this.request().kind);
  readonly isEditing = computed(() => this.request().editing !== undefined);
  readonly isTransfer = computed(() =>
    this.kind() === 'transfer' || this.request().editing?.transfer_id != null);

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
    if (this.isEditing()) return this.i18n.t(this.isTransfer() ? 'entry.editTransfer' : 'entry.editMovement');
    if (this.isTransfer()) return this.i18n.t('entry.transfer');
    return this.i18n.t(this.kind() === 'expense' ? 'entry.newExpense' : 'entry.newIncome');
  });

  readonly selectedCategory = computed(() =>
    this.categories().find(c => c.id === this.categoryId()) ?? null);

  readonly dateLabel = computed(() => {
    const iso = this.occurredOn();
    if (iso === todayIso()) return this.i18n.t('period.today');

    const [year, month, day] = iso.split('-').map(Number);
    const name = monthName(new Date(year, month - 1, day), this.i18n.dateLocale());
    return `${day} ${name} ${year}`;
  });

  /**
   * What is still missing, in the order it should be fixed.
   *
   * Shown as a prompt rather than left for the user to work out from a greyed
   * button. A disabled control that says nothing is the app refusing without
   * explaining itself.
   */
  readonly missing = computed<string | null>(() => {
    if (this.pending() !== null) return this.i18n.t('entry.need.finishSum');
    if (this.amount().minor <= 0) return this.i18n.t('entry.need.amount');
    if (this.accountId() === null) return this.i18n.t('entry.need.account');

    if (this.isTransfer()) {
      if (this.toAccountId() === null) return this.i18n.t('entry.need.destination');
      if (this.toAccountId() === this.accountId()) return this.i18n.t('entry.need.differentAccounts');
      if (this.crossesCurrency() && this.targetAmount().minor <= 0) {
        return this.i18n.t('entry.need.arrived', { currency: this.targetCurrency() });
      }
      return null;
    }

    if (this.categoryId() === null) return this.i18n.t('entry.need.category');
    return null;
  });

  readonly canSave = computed(() => this.missing() === null);

  /** True while a sum is waiting for its other side. */
  readonly midSum = computed(() => this.pending() !== null);

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
      // A transfer is three rows, and the leg that was tapped may be either
      // side of it. Both are loaded so the screen shows the whole act.
      if (editing.transfer_id !== null) {
        await this.loadTransfer(editing.transfer_id);
        return;
      }

      this.amount.set(AmountBuffer.from(editing.amount_minor));
      this.categoryId.set(editing.category_id);
      this.accountId.set(editing.account_id);
      this.occurredOn.set(editing.occurred_on);
      this.note.set(editing.description ?? '');
      return;
    }

    if (this.isTransfer()) {
      const route = await this.defaultRoute(accounts);
      this.accountId.set(route.from);
      this.toAccountId.set(route.to);
      return;
    }

    this.accountId.set(await this.defaultAccount(accounts));
  }

  /**
   * Fills the screen from an existing transfer.
   *
   * Both amounts are kept as they were stored rather than one being derived
   * from the other: across currencies they are two different figures, and the
   * rate between them is the one the provider actually applied that day, which
   * cannot be looked up afterwards. Re-deriving it would quietly replace a
   * fact with an approximation.
   */
  private async loadTransfer(transferId: number): Promise<void> {
    const found = await new TransfersRepository(this.database.driver).findById(transferId);
    if (!found) {
      this.error.set(this.i18n.t('entry.transferNotFound'));
      return;
    }

    this.editingTransferId.set(transferId);
    this.accountId.set(found.from.account_id);
    this.toAccountId.set(found.to.account_id);
    this.amount.set(AmountBuffer.from(found.from.amount_minor));
    this.targetAmount.set(AmountBuffer.from(found.to.amount_minor));
    this.occurredOn.set(found.transfer.occurred_on);
    this.note.set(found.transfer.description ?? found.from.description ?? '');
  }

  /**
   * Which way a transfer should point before anyone chooses.
   *
   * The account on screen is where the money is going: opening a transfer
   * while looking at the credit card means paying that card, not taking money
   * out of it. So the destination is settled, and the only open question is
   * where the money comes from — answered by whichever account has sent to
   * that destination most often.
   *
   * With no account selected, the route starts from wherever money usually
   * leaves and goes wherever that account usually sends it.
   */
  private async defaultRoute(
    accounts: readonly AccountRow[],
  ): Promise<{ from: number | null; to: number | null }> {
    if (accounts.length === 0) return { from: null, to: null };

    const selected = this.request().preferredAccountId;
    if (selected != null && accounts.some(a => a.id === selected)) {
      return { from: await this.counterpart(accounts, selected, 'to'), to: selected };
    }

    const from = await this.defaultAccount(accounts);
    return { from, to: await this.counterpart(accounts, from, 'from') };
  }

  /**
   * The account most often on the other end of `account`'s transfers.
   *
   * `side` is the side `account` sits on: 'from' looks for where its money
   * goes, 'to' for where its money comes from.
   */
  private async counterpart(
    accounts: readonly AccountRow[],
    account: number | null,
    side: 'from' | 'to',
  ): Promise<number | null> {
    if (account === null) return null;

    const usual = await this.database.driver.queryOne<{ account_id: number }>(
      `SELECT other.account_id AS account_id, COUNT(*) AS times
       FROM transactions t
       JOIN transactions other
         ON other.transfer_id = t.transfer_id AND other.id <> t.id
       WHERE t.account_id = ? AND t.transfer_leg = ?
       GROUP BY other.account_id
       ORDER BY times DESC
       LIMIT 1`,
      [account, side],
    );
    if (usual && accounts.some(a => a.id === usual.account_id)) return usual.account_id;

    // Nothing in this account's history. Fall back to something in the same
    // currency, so the amount means the same on both sides.
    const currency = accounts.find(a => a.id === account)?.currency_code;
    return (
      accounts.find(a => a.id !== account && a.currency_code === currency) ??
      accounts.find(a => a.id !== account)
    )?.id ?? null;
  }

  /**
   * Where a new movement should land before anyone chooses.
   *
   * Alphabetical order put 'ARQ EUR' first, which would have quietly recorded
   * pesos as euros. In order of preference: the account the screen is already
   * filtered to, then the one used most often for this kind of movement, then
   * anything in pesos.
   *
   * Most used, not most recent. The last movement is one movement, and a
   * single unusual purchase would move the default for everything after it.
   * Habit is steadier than that: expenses land on the credit card 954 times in
   * the last year against 173 on the next account.
   */
  private async defaultAccount(accounts: readonly AccountRow[]): Promise<number | null> {
    if (accounts.length === 0) return null;

    const preferred = this.request().preferredAccountId;
    if (preferred != null && accounts.some(a => a.id === preferred)) return preferred;

    // A transfer starts from wherever money usually leaves, which is not the
    // same as where it is usually spent: money almost never leaves a credit
    // card, and starting there drags the destination somewhere strange too.
    const where = this.isTransfer()
      ? `transfer_leg = 'from'`
      : `transfer_id IS NULL AND amount_minor ${this.kind() === 'income' ? '>' : '<'} 0`;

    // The last year first, so an account left behind years ago does not keep
    // winning on the strength of old history. Then all of it, for a database
    // whose last year is empty.
    for (const since of [aYearAgo(), '0000-01-01']) {
      const ranked = await this.database.driver.query<{ account_id: number }>(
        `SELECT account_id, COUNT(*) AS times
         FROM transactions
         WHERE ${where} AND occurred_on >= ?
         GROUP BY account_id
         ORDER BY times DESC
         LIMIT 5`,
        [since],
      );
      // The busiest one that still exists and is not archived.
      const usable = ranked.find(row => accounts.some(a => a.id === row.account_id));
      if (usable) return usable.account_id;
    }

    return (accounts.find(a => a.currency_code === 'COP') ?? accounts[0]).id;
  }

  /**
   * Notes are typed again and again — the same shop, the same rent. Three
   * letters is enough to tell one apart without offering the whole history on
   * the first keystroke.
   */
  private static readonly NOTE_HINT_AT = 3;

  /** Rises with every keystroke, so a slow query cannot overwrite a newer one. */
  private noteQuery = 0;

  async onNoteInput(value: string): Promise<void> {
    this.note.set(value);

    const typed = value.trim();
    const mine = ++this.noteQuery;

    if (typed.length < EntryComponent.NOTE_HINT_AT || this.database.status() !== 'ready') {
      this.noteSuggestions.set([]);
      return;
    }

    const found = await new TransactionsRepository(this.database.driver).suggestNotes(typed);
    if (mine !== this.noteQuery) return;

    // Not the note already written: offering back what is on screen is noise.
    this.noteSuggestions.set(found.filter(note => note !== value));
  }

  useNote(note: string): void {
    this.note.set(note);
    this.noteSuggestions.set([]);
    this.noteQuery++;
  }

  /**
   * The physical keyboard drives the on-screen one.
   *
   * On a phone this changes nothing. On a computer — which is where a backlog
   * of movements actually gets corrected — reaching for the mouse between
   * every digit is the whole cost of the task. The number row and the numeric
   * keypad both work, comma and full stop both start the cents, Enter saves
   * and Escape closes.
   *
   * Typing inside the note field is left alone: there, digits are text.
   */
  @HostListener('document:keydown', ['$event'])
  onKey(event: KeyboardEvent): void {
    if (event.defaultPrevented || event.ctrlKey || event.altKey || event.metaKey) return;

    const target = event.target as HTMLElement | null;
    const typingText = target?.closest('ion-input, ion-searchbar, input, textarea') !== null;

    if (event.key === 'Escape') {
      event.preventDefault();
      this.cancelled.emit();
      return;
    }

    // A picker or the date sheet is open: it owns the keyboard.
    if (this.picking() !== null || this.showDate()) return;

    if (typingText) return;

    const operator = operatorFromKey(event.key);
    if (operator) {
      event.preventDefault();
      this.operate(operator);
      return;
    }

    if (event.key === '=') {
      event.preventDefault();
      this.equals();
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      // Mid-sum, Enter finishes the sum rather than saving half of it.
      if (this.pending() !== null) this.equals();
      else if (this.canSave()) void this.save();
      return;
    }

    if (/^[0-9]$/.test(event.key)) {
      event.preventDefault();
      this.press(event.key);
      return;
    }

    if (event.key === ',' || event.key === '.') {
      event.preventDefault();
      this.press(',');
      return;
    }

    if (event.key === 'Backspace') {
      event.preventDefault();
      this.press('<');
      return;
    }

    // Across currencies there are two amounts; Tab moves between them.
    if (event.key === 'Tab' && this.crossesCurrency()) {
      event.preventDefault();
      this.focusAmount(!this.editingTarget());
    }
  }

  /** What the running sum looks like, for showing above the amount. */
  readonly pendingLabel = computed(() => {
    const sum = this.pending();
    if (!sum) return '';
    return `${this.money(sum.leftMinor)} ${sum.operator}`;
  });

  /**
   * Starts or continues an operation.
   *
   * Pressing a second operator finishes the first, so 2 + 3 + 4 works the way
   * anyone expects rather than needing = between each step.
   */
  operate(operator: Operator): void {
    const buffer = this.activeBuffer();
    const sum = this.pending();

    if (sum && !buffer.isEmpty) {
      this.setActive(AmountBuffer.from(apply(sum.leftMinor, sum.operator, buffer.minor)));
      this.pending.set({ leftMinor: apply(sum.leftMinor, sum.operator, buffer.minor), operator });
    } else if (!buffer.isEmpty) {
      this.pending.set({ leftMinor: buffer.minor, operator });
    } else if (sum) {
      // Changing your mind about which operator, before typing the other side.
      this.pending.set({ ...sum, operator });
      return;
    } else {
      return;
    }

    this.setActive(new AmountBuffer());
  }

  /** Finishes the sum and leaves the result as the amount. */
  equals(): void {
    const sum = this.pending();
    const buffer = this.activeBuffer();
    if (!sum) return;

    const result = buffer.isEmpty
      ? sum.leftMinor
      : apply(sum.leftMinor, sum.operator, buffer.minor);

    this.pending.set(null);
    this.setActive(AmountBuffer.from(Math.max(result, 0)));
  }

  private setActive(buffer: AmountBuffer): void {
    if (this.editingTarget()) this.targetAmount.set(buffer);
    else this.amount.set(buffer);
  }

  press(key: string): void {
    if (isOperator(key)) { this.operate(key); return; }
    if (key === '=') { this.equals(); return; }

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
        this.toAccountId.set(await this.counterpart(this.accounts(), id, 'from'));
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

    const transfers = new TransfersRepository(this.database.driver);
    const transfer = {
      occurred_on: this.occurredOn(),
      description: this.note().trim() || null,
      from: { account_id: this.accountId()!, amount_minor: out },
      to: {
        account_id: this.toAccountId()!,
        amount_minor: into,
        rate_scaled: rateScaled,
        amount_base_minor: this.crossesCurrency() ? out : undefined,
        rate_source: rateScaled === null ? null : ('derived' as const),
      },
      source: 'manual' as const,
    };

    const editing = this.editingTransferId();
    if (editing !== null) {
      // Rewrites both legs together, so the two sides can never disagree.
      await transfers.update(editing, transfer);
      return;
    }

    await transfers.create(transfer);
  }

  async remove(): Promise<void> {
    const editing = this.request().editing;
    if (!editing) return;

    this.saving.set(true);
    try {
      const transferId = this.editingTransferId();
      if (transferId !== null) {
        // Deleting one leg would leave money arriving from nowhere. The
        // header takes both with it.
        await new TransfersRepository(this.database.driver).delete(transferId);
      } else {
        await new TransactionsRepository(this.database.driver).delete(editing.id);
      }
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

/** Today, one year back. Text dates compare in the same order as real ones. */
function aYearAgo(): string {
  const now = new Date();
  return `${now.getFullYear() - 1}${todayIso().slice(4)}`;
}
