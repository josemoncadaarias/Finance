/**
 * Money coming into or going out of one product, or moved between two
 * products of the same account.
 *
 * The same screen as a movement or a transfer in an account - amount on a
 * keypad, the date, a note - because it is the same act, and that screen is
 * already the one people know. Every question is about a product, never an
 * account: the account is the one on screen.
 *
 * An income or expense says what it changes:
 *
 *   * **The product only** - a `cushion_adjustments` row saying what it is
 *     (cashback, a correction, something else). Net worth stays put.
 *   * **The product and net worth** - an ordinary movement of the account,
 *     with a category and the product, exactly as the movements screen writes
 *     one.
 *   * **Net worth only** - cashing in money the product already holds and the
 *     account never counted: Rappi's product shows 66 million, the account 60,
 *     and 3 of the 6 in between become net worth. The movement is written as
 *     above, and the same amount comes out of what the product gathered, so
 *     its balance stays exactly where it was. An expense is the reverse.
 *
 * A transfer is two legs of one transfer inside the account: its balance is
 * what it was, and only which product holds the money changes.
 */

import { Component, HostListener, computed, inject, input, output, signal, type OnInit } from '@angular/core';
import {
  IonHeader, IonToolbar, IonButton, IonButtons, IonIcon, IonTextarea, IonDatetime, IonModal,
  IonList, IonItem, IonLabel, IonFooter, IonContent, IonSearchbar,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import * as allIcons from 'ionicons/icons';

import { DatabaseService } from '../../core/database/database.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { monthName } from '../../core/filters/period';
import { formatMoney } from '../../core/database/money';
import { YieldsRepository, type CushionEntry, type YieldPocket } from '../../core/database/repositories/yields.repository';
import { TaxParametersRepository } from '../../core/database/repositories/tax-parameters.repository';
import { TransfersRepository } from '../../core/database/repositories/transfers.repository';
import { TransactionsRepository } from '../../core/database/repositories/transactions.repository';
import { CategoriesRepository, type UsedCategory } from '../../core/database/repositories/categories.repository';
import type { AccountRow } from '../../core/database/types';
import { IconComponent } from '../../core/icons/icon.component';
import { accrueAndSettle } from '../../core/yields/cdt';
import { todayIso } from '../../core/yields/days';
import { AmountBuffer } from '../entry/amount-buffer';
import { apply, isOperator, operatorFromKey, type Operator, type Pending } from '../entry/calculator';

export interface CushionEntryRequest {
  kind: 'income' | 'expense' | 'transfer';
  account: AccountRow;
  pockets: readonly YieldPocket[];
  /** An entry on the product alone, being corrected. */
  editing?: CushionEntry;
}

type EntryKind = 'cashback' | 'correction' | 'other';

@Component({
  selector: 'app-cushion-entry',
  imports: [
    TranslatePipe, IconComponent,
    IonHeader, IonToolbar, IonButton, IonButtons, IonIcon, IonTextarea, IonDatetime, IonModal,
    IonList, IonItem, IonLabel, IonFooter, IonContent, IonSearchbar,
  ],
  templateUrl: './cushion-entry.component.html',
  // The movement screen's own styles, so the two can never drift apart.
  styleUrls: ['../entry/entry.component.scss'],
  styles: [`
    .scope-label {
      margin: 0; padding: 0 1rem 0.35rem; text-align: center;
      font-size: 0.68rem; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase;
      color: var(--ion-color-medium);
    }
    .order.scope { justify-content: center; flex-wrap: wrap; padding: 0 1rem 0.5rem; }
    /* Room below it: the category grid waiting for a pick draws its outline
       outside itself, and without this the outline ran across the sentence. */
    .scope-hint {
      margin: 0; padding: 0 1rem 1rem; text-align: center;
      font-size: 0.8rem; line-height: 1.35; color: var(--ion-color-medium);
    }
  `],
})
export class CushionEntryComponent implements OnInit {
  private readonly database = inject(DatabaseService);
  readonly i18n = inject(I18nService);

  readonly request = input.required<CushionEntryRequest>();
  readonly saved = output<void>();
  readonly cancelled = output<void>();

  readonly amount = signal(new AmountBuffer());
  readonly pending = signal<Pending | null>(null);
  readonly kind = signal<EntryKind>('cashback');
  /** The product the money touches; for a transfer, the one it leaves. */
  readonly pocketId = signal<number | null>(null);
  /** For a transfer, the product it goes into. */
  readonly toPocketId = signal<number | null>(null);
  readonly onDate = signal(todayIso());
  readonly note = signal('');

  /**
   * Notes already written that match what is being typed, the same way the
   * movement screen offers them. A note repeats - "Traslado para el CDT de la
   * renta" is typed again every quarter - and typing it out each time is work
   * the app can save. They come from every movement, whichever screen wrote
   * it, so moving money between products is offered what was written on the
   * last one.
   */
  readonly noteSuggestions = signal<string[]>([]);

  /** Three letters: fewer matches half the history and helps nobody. */
  private static readonly NOTE_HINT_AT = 3;

  /** Rises with every keystroke, so a slow query cannot overwrite a newer one. */
  private noteQuery = 0;
  readonly saving = signal(false);
  readonly error = signal('');
  /** Which side's product the sheet is asking for, or null when it is closed. */
  readonly pickingPocket = signal<'from' | 'to' | null>(null);
  readonly showDate = signal(false);

  /** What the entry changes: the product, the product and net worth, or net worth alone. */
  readonly scope = signal<'product' | 'both' | 'netWorth'>('product');
  /** Anything that reaches net worth is a movement of the account, with a category. */
  readonly usesCategory = computed(() => this.scope() !== 'product');

  readonly scopeHint = computed(() => {
    const expense = this.request().kind === 'expense';
    switch (this.scope()) {
      case 'product': return this.i18n.t('cushion.entry.noNetWorth');
      case 'both': return this.i18n.t('cushion.entry.netWorthHint');
      default: return this.i18n.t(expense ? 'cushion.entry.scope.netWorthExpenseHint' : 'cushion.entry.scope.netWorthIncomeHint');
    }
  });
  readonly categoryId = signal<number | null>(null);
  /** Categories of this kind, most used first. */
  readonly categories = signal<UsedCategory[]>([]);
  readonly browsingCategories = signal(false);
  readonly categorySearch = signal('');
  readonly shortlistSize = 8;

  /** What it is, in place of a category. Cashback is not withheld and yield is. */
  readonly kinds: readonly {
    value: EntryKind;
    label: 'cushion.kind.cashback' | 'cushion.kind.correction' | 'cushion.kind.other';
    icon: string;
  }[] = [
    { value: 'cashback', label: 'cushion.kind.cashback', icon: 'pricetag-outline' },
    { value: 'correction', label: 'cushion.kind.correction', icon: 'build-outline' },
    { value: 'other', label: 'cushion.kind.other', icon: 'ellipsis-horizontal-circle-outline' },
  ];

  readonly keys = [
    '1', '2', '3', '+',
    '4', '5', '6', '-',
    '7', '8', '9', '×',
    ',', '0', '=', '÷',
  ];

  readonly isTransfer = computed(() => this.request().kind === 'transfer');
  readonly isEditing = computed(() => this.request().editing !== undefined);

  readonly title = computed(() => {
    const kind = this.request().kind;
    if (this.isEditing()) return this.i18n.t(kind === 'expense' ? 'cushion.entry.editExpense' : 'cushion.entry.editIncome');
    if (kind === 'transfer') return this.i18n.t('cushion.move.title');
    return this.i18n.t(kind === 'expense' ? 'cushion.entry.newExpense' : 'cushion.entry.newIncome');
  });

  readonly pocketName = computed(() => this.nameOf(this.pocketId()));
  readonly toPocketName = computed(() => this.nameOf(this.toPocketId()));

  /** The most used, plus the one chosen when it is not among them. */
  readonly shortlist = computed(() => {
    const all = this.categories();
    const top = all.slice(0, this.shortlistSize);
    const chosen = all.find(category => category.id === this.categoryId());
    return chosen && !top.includes(chosen) ? [...top.slice(0, this.shortlistSize - 1), chosen] : top;
  });

  readonly foundCategories = computed(() => {
    const term = fold(this.categorySearch());
    return term === '' ? this.categories() : this.categories().filter(category => fold(category.name).includes(term));
  });

  readonly pendingLabel = computed(() => {
    const sum = this.pending();
    return sum ? `${formatMoney(sum.leftMinor, this.request().account.currency_code, { withSymbol: false })} ${sum.operator}` : '';
  });

  readonly dateLabel = computed(() => {
    const iso = this.onDate();
    if (iso === todayIso()) return this.i18n.t('period.today');
    const [year, month, day] = iso.split('-').map(Number);
    return `${day} ${monthName(new Date(year, month - 1, day), this.i18n.dateLocale())} ${year}`;
  });

  readonly missing = computed<string | null>(() => {
    if (this.pending() !== null) return this.i18n.t('entry.need.finishSum');
    if (this.amount().minor <= 0) return this.i18n.t('entry.need.amount');
    if (this.isTransfer() && (this.toPocketId() === null || this.toPocketId() === this.pocketId())) {
      return this.i18n.t('cushion.move.samePocket');
    }
    if (!this.isTransfer() && this.usesCategory() && this.categoryId() === null) {
      return this.i18n.t('entry.need.category');
    }
    return null;
  });

  readonly canSave = computed(() => this.missing() === null && this.pocketId() !== null);

  constructor() {
    addIcons(allIcons as unknown as Record<string, string>);
  }

  ngOnInit(): void {
    // The usual product, as a movement in the account would start on; a
    // transfer sends from it to the next one.
    const pockets = this.request().pockets;
    const usual = (pockets.find(pocket => pocket.is_default === 1) ?? pockets[0])?.id ?? null;
    this.pocketId.set(usual);
    if (this.isTransfer()) this.toPocketId.set(this.otherThan(usual));
    else void this.loadCategories();

    // Correcting an entry: the screen opens on what it says.
    const editing = this.request().editing;
    if (editing) {
      this.amount.set(AmountBuffer.from(Math.abs(editing.amount_minor)));
      this.kind.set(editing.kind);
      if (pockets.some(pocket => pocket.id === editing.pocket_id)) this.pocketId.set(editing.pocket_id);
      this.onDate.set(editing.on_date);
      this.note.set(editing.note ?? '');
    }
  }

  private async loadCategories(): Promise<void> {
    if (this.database.status() !== 'ready') return;
    this.categories.set(await new CategoriesRepository(this.database.driver).listByUse({
      kind: this.request().kind === 'expense' ? 'expense' : 'income',
      since: aYearAgo(),
    }));
  }

  press(key: string): void {
    if (isOperator(key)) { this.operate(key); return; }
    if (key === '=') { this.equals(); return; }

    const buffer = this.amount();
    if (key === '<') buffer.backspace();
    else if (key === ',') buffer.separator();
    else buffer.push(key);
    // A new object so the signal notices: the buffer mutates in place.
    this.amount.set(Object.assign(Object.create(AmountBuffer.prototype), buffer));
  }

  operate(operator: Operator): void {
    const buffer = this.amount();
    const sum = this.pending();
    if (sum && !buffer.isEmpty) {
      this.pending.set({ leftMinor: apply(sum.leftMinor, sum.operator, buffer.minor), operator });
    } else if (!buffer.isEmpty) {
      this.pending.set({ leftMinor: buffer.minor, operator });
    } else if (sum) {
      this.pending.set({ ...sum, operator });
      return;
    } else {
      return;
    }
    this.amount.set(new AmountBuffer());
  }

  equals(): void {
    const sum = this.pending();
    if (!sum) return;
    const buffer = this.amount();
    const result = buffer.isEmpty ? sum.leftMinor : apply(sum.leftMinor, sum.operator, buffer.minor);
    this.pending.set(null);
    this.amount.set(AmountBuffer.from(Math.max(result, 0)));
  }

  clearAmount(): void {
    this.pending.set(null);
    this.amount.set(new AmountBuffer());
  }

  async onNoteInput(value: string): Promise<void> {
    this.note.set(value);

    const typed = value.trim();
    const mine = ++this.noteQuery;

    if (typed.length < CushionEntryComponent.NOTE_HINT_AT || this.database.status() !== 'ready') {
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

  clearNote(): void {
    this.note.set('');
    this.noteSuggestions.set([]);
    this.noteQuery++;
  }

  pickCategory(id: number): void {
    this.categoryId.set(id);
    this.browsingCategories.set(false);
    this.categorySearch.set('');
  }

  openCategories(): void {
    this.categorySearch.set('');
    this.browsingCategories.set(true);
  }

  /** Answers the sheet. The two ends of a transfer can never be the same product. */
  choosePocket(id: number): void {
    if (this.pickingPocket() === 'to') {
      this.toPocketId.set(id);
      if (this.pocketId() === id) this.pocketId.set(this.otherThan(id));
    } else {
      this.pocketId.set(id);
      if (this.isTransfer() && this.toPocketId() === id) this.toPocketId.set(this.otherThan(id));
    }
    this.pickingPocket.set(null);
  }

  swap(): void {
    const from = this.pocketId();
    this.pocketId.set(this.toPocketId());
    this.toPocketId.set(from);
  }

  pickDate(value: string | null): void {
    if (value) this.onDate.set(value.slice(0, 10));
    this.showDate.set(false);
  }

  private nameOf(id: number | null): string {
    return this.request().pockets.find(pocket => pocket.id === id)?.name ?? '';
  }

  private otherThan(id: number | null): number | null {
    return this.request().pockets.find(pocket => pocket.id !== id)?.id ?? null;
  }

  /** Deletes the entry being corrected, and works its days out again. */
  async remove(): Promise<void> {
    const editing = this.request().editing;
    if (!editing || this.saving()) return;
    this.saving.set(true);
    this.error.set('');
    try {
      const db = this.database.driver;
      const yields = new YieldsRepository(db);
      const tax = new TaxParametersRepository(db);
      const accountId = this.request().account.id;
      await db.transaction(async () => {
        await yields.removeAdjustment(editing.id);
        await yields.clearDays(accountId, editing.on_date);
      });
      await accrueAndSettle(db, yields, tax, accountId, todayIso());
      this.database.dataChanged();
      this.saved.emit();
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : String(error));
    } finally {
      this.saving.set(false);
    }
  }

  /** Digits, comma, backspace, Enter and Escape from a physical keyboard. */
  @HostListener('document:keydown', ['$event'])
  onKey(event: KeyboardEvent): void {
    if (event.defaultPrevented || event.ctrlKey || event.altKey || event.metaKey) return;
    if (event.key === 'Escape') { event.preventDefault(); this.cancelled.emit(); return; }
    if (this.pickingPocket() !== null || this.showDate() || this.browsingCategories()) return;
    if ((event.target as HTMLElement | null)?.closest('ion-textarea, ion-searchbar, input, textarea')) return;

    const operator = operatorFromKey(event.key);
    if (operator) { event.preventDefault(); this.operate(operator); return; }
    if (event.key === '=') { event.preventDefault(); this.equals(); return; }
    if (event.key === 'Enter') {
      event.preventDefault();
      if (this.pending() !== null) this.equals();
      else if (this.canSave()) void this.save();
      return;
    }
    if (/^[0-9]$/.test(event.key)) { event.preventDefault(); this.press(event.key); return; }
    if (event.key === ',' || event.key === '.') { event.preventDefault(); this.press(','); return; }
    if (event.key === 'Backspace') { event.preventDefault(); this.press('<'); }
  }

  async save(): Promise<void> {
    if (!this.canSave() || this.saving()) return;
    this.saving.set(true);
    this.error.set('');

    try {
      const db = this.database.driver;
      const yields = new YieldsRepository(db);
      const tax = new TaxParametersRepository(db);
      const { account, kind, pockets, editing } = this.request();
      const minor = this.amount().minor;
      // The sign comes from the button pressed, never from what was typed.
      const signed = kind === 'expense' ? -minor : minor;

      await db.transaction(async () => {
        if (kind === 'transfer') {
          // Two legs of one transfer, both in this account.
          await new TransfersRepository(db).create({
            occurred_on: this.onDate(),
            description: this.note().trim() || null,
            from: { account_id: account.id, pocket_id: this.pocketId(), amount_minor: minor },
            to: { account_id: account.id, pocket_id: this.toPocketId(), amount_minor: minor },
          });
        } else if (this.scope() !== 'product') {
          // An ordinary movement, written the way the movements screen writes
          // one: it shows there with its category and product.
          const transactionId = await new TransactionsRepository(db).create({
            account_id: account.id,
            category_id: this.categoryId(),
            // Null on an account with one product, as the movements screen does.
            pocket_id: pockets.length > 1 ? this.pocketId() : null,
            occurred_on: this.onDate(),
            amount_minor: signed,
            description: this.note().trim() || null,
            source: 'manual',
          });

          if (this.scope() === 'netWorth') {
            // The movement put the money in the product; it was already there.
            // So the same amount leaves what the product had gathered - or, for
            // an expense, goes back into it - and its balance does not move.
            if (kind === 'income') {
              await yields.withdraw({
                account_id: account.id, on_date: this.onDate(), amount_minor: minor,
                transaction_id: transactionId, pocket_id: this.pocketId(), note: this.note().trim() || null,
              });
            } else {
              await yields.adjust({
                account_id: account.id, on_date: this.onDate(), amount_minor: minor,
                kind: 'other', pocket_id: this.pocketId(), note: this.note().trim() || null,
                transaction_id: transactionId,
              });
            }
          }
        } else if (editing) {
          await yields.updateAdjustment(editing.id, {
            on_date: this.onDate(),
            amount_minor: signed,
            kind: this.kind(),
            pocket_id: this.pocketId(),
            note: this.note().trim() || null,
          });
        } else {
          await yields.adjust({
            account_id: account.id,
            on_date: this.onDate(),
            amount_minor: signed,
            kind: this.kind(),
            pocket_id: this.pocketId(),
            note: this.note().trim() || null,
          });
        }
        // What lands or leaves on a day changes what every day after it earns
        // on, so those days are worked out again - from the earlier of the two
        // dates when a correction moved it. Days corrected by hand stay.
        const from = editing && editing.on_date < this.onDate() ? editing.on_date : this.onDate();
        await yields.clearDays(account.id, from);
      });

      await accrueAndSettle(db, yields, tax, account.id, todayIso());
      this.database.dataChanged();
      this.saved.emit();
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : String(error));
    } finally {
      this.saving.set(false);
    }
  }
}

/** Today, one year back. Text dates compare in the same order as real ones. */
function aYearAgo(): string {
  const today = todayIso();
  return `${Number(today.slice(0, 4)) - 1}${today.slice(4)}`;
}

/** Lowercased and without accents, for searching. */
function fold(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}
