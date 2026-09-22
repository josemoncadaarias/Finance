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

import {
  Component, ElementRef, HostListener, computed, inject, input, output, signal, viewChild,
  type OnDestroy, type OnInit,
} from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Keyboard } from '@capacitor/keyboard';
import {
  IonHeader, IonToolbar, IonButton, IonButtons, IonIcon, IonTextarea, IonDatetime, IonModal,
  IonList, IonItem, IonLabel, IonFooter, IonContent, IonSearchbar, IonInput, IonToggle, IonSpinner,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import * as allIcons from 'ionicons/icons';

import { DatabaseService } from '../../core/database/database.service';
import type { SqlDriver } from '../../core/database/sql-driver';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { monthName } from '../../core/filters/period';
import { formatMoney } from '../../core/database/money';
import { YieldsRepository, type CushionEntry, type YieldPocket } from '../../core/database/repositories/yields.repository';
import { ProductKindsRepository, type ProductKind } from '../../core/database/repositories/product-kinds.repository';
import { TaxParametersRepository } from '../../core/database/repositories/tax-parameters.repository';
import { TransfersRepository } from '../../core/database/repositories/transfers.repository';
import { TransactionsRepository } from '../../core/database/repositories/transactions.repository';
import { CategoriesRepository, type UsedCategory } from '../../core/database/repositories/categories.repository';
import { AccountsRepository } from '../../core/database/repositories/accounts.repository';
import type { AccountRow, CategoryKind, CategoryRow } from '../../core/database/types';
import { IconComponent } from '../../core/icons/icon.component';
import { CategoryEditorComponent } from '../categories/category-editor.component';
import { ProductKindEditorComponent } from '../categories/product-kind-editor.component';
import { BusyOverlayComponent } from '../../shared/busy-overlay.component';
import { InfoHintComponent } from '../../shared/info-hint.component';
import { ConfirmComponent } from '../../shared/confirm/confirm.component';
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

@Component({
  selector: 'app-cushion-entry',
  imports: [
    TranslatePipe, IconComponent, CategoryEditorComponent, BusyOverlayComponent, InfoHintComponent, ConfirmComponent,
    IonHeader, IonToolbar, IonButton, IonButtons, IonIcon, IonTextarea, IonDatetime, IonModal,
    IonList, IonItem, IonLabel, IonFooter, IonContent, IonSearchbar, IonInput, IonToggle, IonSpinner,
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
export class CushionEntryComponent implements OnInit, OnDestroy {
  private readonly database = inject(DatabaseService);
  readonly i18n = inject(I18nService);

  readonly request = input.required<CushionEntryRequest>();
  readonly saved = output<void>();
  readonly cancelled = output<void>();

  /**
   * The account this is about, and its products.
   *
   * Copies of what the request arrived with rather than the request itself,
   * because they can change: the account is a button now, and picking
   * another one loads its products in place. An income recorded on the wrong
   * account used to mean closing the form, going back, opening the right
   * account and starting again.
   */
  readonly account = signal<AccountRow | null>(null);
  readonly pockets = signal<readonly YieldPocket[]>([]);

  /** Open while another account is being chosen. */
  readonly pickingAccount = signal(false);

  /** Set while its products are being fetched, which is one query. */
  readonly switching = signal(false);

  /**
   * The accounts worth offering: the ones that have products.
   *
   * This form records income and spending against a PRODUCT, so an account
   * with none has nothing for it to land in. Archived accounts are left out
   * for the same reason they are everywhere else.
   */
  private readonly withProducts = signal<AccountRow[]>([]);

  /**
   * How the list is ordered, under the key every other account picker uses.
   *
   * One preference about one list. Choosing A-Z while recording a movement
   * leaves the products form's list in A-Z too, which is what anyone would
   * expect of a choice they made once.
   */
  readonly accountOrder = signal<'use' | 'name'>(readAccountOrder());

  setAccountOrder(order: 'use' | 'name'): void {
    this.accountOrder.set(order);
    try {
      localStorage.setItem('finance.accountOrder', order);
    } catch {
      // A browser with site data blocked still gets the order for this visit.
    }
  }

  /** How many movements each account carries, for the "most used" order. */
  private readonly useCounts = signal<Map<number, number>>(new Map());

  readonly switchable = computed(() => {
    const offered = this.withProducts();

    // `localeCompare` so "Éxito" files under E and not after Z.
    if (this.accountOrder() === 'name') {
      return [...offered].sort((a, b) => a.name.localeCompare(b.name, 'es'));
    }

    const times = this.useCounts();
    return [...offered].sort((a, b) => {
      const byUse = (times.get(b.id) ?? 0) - (times.get(a.id) ?? 0);
      return byUse !== 0 ? byUse : a.name.localeCompare(b.name, 'es');
    });
  });

  readonly amount = signal(new AmountBuffer());
  readonly pending = signal<Pending | null>(null);

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

  /**
   * True while the note is being written: the phone's keyboard is up, where
   * this form's own keypad was, and the note and its suggestions need the room.
   * The same treatment the movement screen got.
   */
  readonly writingNote = signal(false);

  /** The note's box, so it can be brought into view and let go of. */
  private readonly noteBox = viewChild<ElementRef<HTMLElement>>('noteBox');
  private readonly noteField = viewChild<ElementRef<HTMLTextAreaElement>>('noteField');

  /** Tapping a suggestion blurs the note for a moment; this rides that out. */
  private noteBlurTimer: ReturnType<typeof setTimeout> | null = null;

  /** Undoes the keyboard listener when the form closes. */
  private keyboardClosed: { remove: () => Promise<void> } | null = null;

  ngOnDestroy(): void {
    void this.keyboardClosed?.remove();
  }

  /** The account in force, and the bits of it the template asks for. */
  readonly accountId = computed(() => this.account()?.id ?? this.request().account.id);
  readonly currency = computed(() => this.account()?.currency_code ?? this.request().account.currency_code);
  readonly accountName = computed(() => this.account()?.name ?? this.request().account.name);

  /** Which accounts this form could be pointed at instead. */
  private async loadSwitchable(): Promise<void> {
    if (this.database.status() !== 'ready') return;

    const driver = this.database.driver;
    const all = await new AccountsRepository(driver).list();
    const yields = new YieldsRepository(driver);

    // An account with no product has nowhere for this to land, so it is not
    // offered. One query each, over a list that is tens long, once.
    const withProducts: AccountRow[] = [];
    for (const account of all) {
      if ((await yields.pockets(account.id)).length > 0) withProducts.push(account);
    }

    this.withProducts.set(withProducts);

    // What each one is used for, so "most used" has something to go on.
    void new AccountsRepository(driver).timesUsed()
      .then(counts => this.useCounts.set(counts));
  }

  /**
   * Points the form at another account, and loads its products.
   *
   * The amount, the date and the note are kept: they are what was being
   * written, and the account was the thing that was wrong. What cannot be
   * kept is the product - it belonged to the old account - so the new
   * account's usual one is chosen, the same one a fresh form would start on.
   */
  async switchAccount(account: AccountRow): Promise<void> {
    this.pickingAccount.set(false);
    if (account.id === this.accountId()) return;

    this.switching.set(true);
    try {
      const pockets = await new YieldsRepository(this.database.driver).pockets(account.id);
      this.account.set(account);
      this.pockets.set(pockets);

      const usual = (pockets.find(pocket => pocket.is_default === 1) ?? pockets[0])?.id ?? null;
      this.pocketId.set(usual);
      this.toPocketId.set(this.isTransfer() ? this.otherThan(usual) : null);
    } finally {
      this.switching.set(false);
    }
  }

  startNote(): void {
    if (this.noteBlurTimer !== null) {
      clearTimeout(this.noteBlurTimer);
      this.noteBlurTimer = null;
    }
    this.writingNote.set(true);
    setTimeout(() => this.noteBox()?.nativeElement.scrollIntoView({ block: 'center', behavior: 'smooth' }), 250);
  }

  /** Leaving it - unless the focus is coming straight back, as a suggestion does. */
  endNote(): void {
    if (this.noteBlurTimer !== null) clearTimeout(this.noteBlurTimer);
    this.noteBlurTimer = setTimeout(() => {
      this.writingNote.set(false);
    // Nothing of the search stays behind it: the list under the note was
    // still there once the note was written, pushing the form down.
    this.noteSuggestions.set([]);
      this.noteBlurTimer = null;
    }, 250);
  }

  /** Done: keyboard down, focus off, the keypad back. */
  finishNote(): void {
    if (this.noteBlurTimer !== null) {
      clearTimeout(this.noteBlurTimer);
      this.noteBlurTimer = null;
    }
    this.writingNote.set(false);
    // Nothing of the search stays behind it: the list under the note was
    // still there once the note was written, pushing the form down.
    this.noteSuggestions.set([]);
    this.noteBox()?.nativeElement.querySelector('textarea')?.blur();
    if (Capacitor.isNativePlatform()) void Keyboard.hide().catch(() => undefined);
  }
  readonly saving = signal(false);

  /**
   * What is happening while the sheet cannot be used.
   *
   * Saving or deleting a product's movement works the yields out again from
   * the day it happened, which on a phone is seconds of a screen that looked
   * frozen - Jose deleted one, saw nothing, and wondered whether it had
   * worked.
   */
  readonly busyLabel = signal('');
  readonly error = signal('');
  /** Which side's product the sheet is asking for, or null when it is closed. */
  readonly pickingPocket = signal<'from' | 'to' | null>(null);
  readonly showDate = signal(false);

  /** What the entry changes: the product, the product and net worth, or net worth alone. */
  readonly scope = signal<'product' | 'both' | 'netWorth'>('product');

  /**
   * What the entry being corrected already is.
   *
   * An entry with no movement behind it only ever touched what the product
   * gathered; one with a movement is the other half of a cash-in. Changing the
   * answer rewrites it into the other shape.
   */
  private scopeWhenOpened: 'product' | 'both' | 'netWorth' = 'product';
  /** Anything that reaches net worth is a movement of the account, with a category. */
  /**
   * Always. A cashback the bank paid into a product is income like any other,
   * so it is filed under the income categories rather than a second list of
   * its own - migration 037. Decision by Jose, 2026-09-17.
   */
  readonly usesCategory = computed(() => true);

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
  /** Open while the "what does this change" sheet is asking. */
  readonly choosingScope = signal(false);

  /** The three answers, each with the sentence that explains it. */
  readonly scopeOptions = computed(() => {
    const expense = this.request().kind === 'expense';
    return ([
      ['product', 'cushion.entry.scope.product', 'cushion.entry.scope.product.hint'],
      ['both', 'cushion.entry.scope.both', 'cushion.entry.scope.both.hint'],
      ['netWorth',
       expense ? 'cushion.entry.scope.netWorthExpense' : 'cushion.entry.scope.netWorthIncome',
       expense ? 'cushion.entry.scope.netWorthExpense.hint' : 'cushion.entry.scope.netWorthIncome.hint'],
    ] as const).map(([id, name, detail]) => ({
      id: id as 'product' | 'both' | 'netWorth',
      name: this.i18n.t(name),
      detail: this.i18n.t(detail),
    }));
  });

  /** What the line on the form says. */
  readonly scopeName = computed(() =>
    this.scopeOptions().find(option => option.id === this.scope())?.name ?? '');

  chooseScope(id: 'product' | 'both' | 'netWorth'): void {
    this.scope.set(id);
    this.choosingScope.set(false);
  }

  readonly browsingCategories = signal(false);
  readonly categorySearch = signal('');
  /** Four across and two down, the way the movement screen does it. */
  readonly shortlistSize = 8;

  /**
   * What it is, in place of a category: the user's own list, kept in the
   * database. Cashback and interest are taxed differently, which is why each
   * kind says which of the two it behaves like.
   */
  readonly kinds = signal<ProductKind[]>([]);

  /** The one chosen, by id. */
  readonly productKindId = signal<number | null>(null);

  /** The sheet where the list itself is kept: add, rename, re-icon, remove. */
  readonly managingKinds = signal(false);
  readonly editingKind = signal<ProductKind | null>(null);

  private kindsRepo(): ProductKindsRepository {
    return new ProductKindsRepository(this.database.driver);
  }

  private async loadKinds(): Promise<void> {
    if (this.database.status() !== 'ready') return;
    const kinds = await this.kindsRepo().list();
    this.kinds.set(kinds);
    if (!kinds.some(kind => kind.id === this.productKindId())) {
      this.productKindId.set(kinds[0]?.id ?? null);
    }
  }

  /** The editor, on one of them or on a new one. */
  openKinds(kind: ProductKind | null): void {
    this.editingKind.set(kind);
    this.managingKinds.set(true);
  }

  /** Saved or removed: the list is read again and the new one chosen. */
  async kindSaved(id: number): Promise<void> {
    this.managingKinds.set(false);
    await this.loadKinds();
    if (this.kinds().some(kind => kind.id === id)) this.productKindId.set(id);
  }

  /** The chosen kind, for the line that offers to edit it. */
  chosenKindShown(): ProductKind | null {
    return this.chosenKind();
  }

  /** What the chosen kind is, for the figures that follow it. */
  private chosenKind(): ProductKind | null {
    return this.kinds().find(kind => kind.id === this.productKindId()) ?? null;
  }

  /** The movement form's keypad, key for key: backspace, and "=" on the bar. */
  readonly keys = [
    '1', '2', '3', '+',
    '4', '5', '6', '-',
    '7', '8', '9', '×',
    ',', '0', '<', '÷',
  ];

  /** True while an arithmetic operator is waiting for its second number. */
  readonly midSum = computed(() => this.pending() !== null);

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


  /**
   * Open while a category is being made or corrected, from this form.
   *
   * Making one used to mean leaving the movement, going to the categories
   * screen and starting again - so the category that was missing got filed
   * under whichever old one was closest.
   */
  readonly editingCategory = signal<{ category: CategoryRow | null; kind: CategoryKind } | null>(null);

  /** Corrects the one chosen; with none chosen, makes one. */
  editChosenCategory(): void {
    const chosen = this.selectedCategory();
    this.editingCategory.set({
      category: chosen ? ({ ...chosen } as unknown as CategoryRow) : null,
      kind: this.request().kind === 'expense' ? 'expense' : 'income',
    });
  }

  newCategory(): void {
    this.editingCategory.set({ category: null, kind: this.request().kind === 'expense' ? 'expense' : 'income' });
  }

  /** Saved: the list is read again, so the new or corrected one is in it. */
  async categorySaved(): Promise<void> {
    this.editingCategory.set(null);
    await this.loadCategories();
  }

  /** The category chosen, for the line that names it. */
  readonly selectedCategory = computed(() =>
    this.categories().find(category => category.id === this.categoryId()) ?? null);

  /** The most used, plus the one chosen when it is not among them. */
  readonly shortlist = computed(() => {
    const all = this.categories();
    // One of the eight is the way to the rest, when there are more.
    const room = all.length > this.shortlistSize ? this.shortlistSize - 1 : this.shortlistSize;
    const top = all.slice(0, room);
    const chosen = all.find(category => category.id === this.categoryId());
    return chosen && !top.includes(chosen) ? [...top.slice(0, room - 1), chosen] : top;
  });

  /**
   * Which order the category list is in, shared with the movement form.
   *
   * The same key, so choosing A-Z while recording a movement leaves the
   * product's own list in A-Z too: it is one preference about one list, and
   * two of them would mean answering the same question twice.
   */
  readonly categoryOrder = signal<'use' | 'name'>(readCategoryOrder());

  setCategoryOrder(order: 'use' | 'name'): void {
    this.categoryOrder.set(order);
    try {
      localStorage.setItem('finance.categoryOrder', order);
    } catch {
      // A browser with site data blocked still gets the order for this visit.
    }
  }

  readonly foundCategories = computed(() => {
    const term = fold(this.categorySearch());
    const found = term === ''
      ? this.categories()
      : this.categories().filter(category => fold(category.name).includes(term));

    // The repository already hands them over most-used first.
    if (this.categoryOrder() === 'use') return found;

    // `localeCompare` so "Éxito" files under E and not after Z.
    return [...found].sort((a, b) => a.name.localeCompare(b.name, 'es'));
  });

  readonly pendingLabel = computed(() => {
    const sum = this.pending();
    return sum ? `${formatMoney(sum.leftMinor, this.currency(), { withSymbol: false })} ${sum.operator}` : '';
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

  async ngOnInit(): Promise<void> {
    // However the keyboard is closed - the Android back button included,
    // which leaves the focus where it was - the note is finished.
    if (Capacitor.isNativePlatform()) {
      void Keyboard.addListener('keyboardDidHide', () => {
        if (this.writingNote()) this.finishNote();
      }).then(handle => { this.keyboardClosed = handle; });
    }
    // The usual product, as a movement in the account would start on; a
    // transfer sends from it to the next one.
    this.account.set(this.request().account);
    this.pockets.set(this.request().pockets);
    void this.loadSwitchable();

    const pockets = this.request().pockets;
    const usual = (pockets.find(pocket => pocket.is_default === 1) ?? pockets[0])?.id ?? null;
    this.pocketId.set(usual);
    if (this.isTransfer()) this.toPocketId.set(this.otherThan(usual));
    else void this.loadCategories();

    // The kinds a product movement can be, which are the user's own.
    await this.loadKinds();

    // A gasto on a product is money leaving: it left the account and it left
    // the net worth, and saying so is nearly always the right answer. An
    // ingreso is usually the bank paying into the product, which is not net
    // worth until it is cashed in. Either can be changed before saving.
    if (this.request().kind === 'expense') this.scope.set('both');

    // Correcting an entry: the screen opens on what it says.
    const editing = this.request().editing;
    if (editing) {
      this.amount.set(AmountBuffer.from(Math.abs(editing.amount_minor)));
      // The category it was filed under. An entry that only ever touched the
      // product carries it on the entry itself; one that was also a movement
      // carries it on the movement, and that is read further down.
      //
      // This was still reading the old product_kind_id, which nothing shows
      // any more: correcting an income opened with no category chosen at all,
      // while an expense looked right only because it defaults to the scope
      // that reads the movement's.
      if (editing.category_id !== null) this.categoryId.set(editing.category_id);
      if (pockets.some(pocket => pocket.id === editing.pocket_id)) this.pocketId.set(editing.pocket_id);
      this.onDate.set(editing.on_date);
      this.note.set(editing.note ?? '');

      // What it already is: an entry with a movement behind it is half of a
      // cash-in, one without is only the product's. The answer can be
      // changed, and saving then rewrites it into the other shape.
      this.scopeWhenOpened = editing.transaction_id === null ? 'product' : 'netWorth';
      this.scope.set(this.scopeWhenOpened);

      // And on the category its movement carries, so correcting it does not
      // quietly refile it under something else.
      if (editing.transaction_id !== null) void this.loadEditedCategory(editing.transaction_id);
    }
  }

  /** The category of the movement behind the entry being corrected. */
  private async loadEditedCategory(transactionId: number): Promise<void> {
    const row = await this.database.driver.queryOne<{ category_id: number | null }>(
      'SELECT category_id FROM transactions WHERE id = ?', [transactionId]);
    if (row?.category_id != null) this.categoryId.set(row.category_id);
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

  useNote(note: string, pressed?: Event): void {
    pressed?.preventDefault();
    this.note.set(note);
    this.noteSuggestions.set([]);
    this.noteQuery++;
    // The tap blurred the note; the person is still writing it.
    this.startNote();
  }

  /**
   * The coarse word the column has carried since before these were categories
   * of their own: three fixed values, one of which every entry still gets.
   *
   * Never rewritten and never dropped, so an entry written today still reads
   * correctly to anything that has not been taught about the new table.
   */
  private legacyKind(): 'correction' | 'cashback' | 'other' {
    return 'other';
  }

  /**
   * Puts the overlay up and hands the screen back long enough to draw it:
   * everything after this holds the thread until it is done.
   */
  private async sayBusy(label: string): Promise<void> {
    this.busyLabel.set(this.i18n.t(label as never));
    await new Promise(resolve => setTimeout(resolve));
  }

  /** Taken on the press, for the reason the movement form explains. */
  clearNote(pressed?: Event): void {
    pressed?.preventDefault();
    this.note.set('');
    this.noteSuggestions.set([]);
    this.noteQuery++;
    this.emptyTheField();
  }

  /**
   * Empties the note, in the signal and in the field.
   *
   * Writing the signal alone was not enough: `[value]` is a one-way binding
   * into a web component that has been keeping its own copy since the first
   * keystroke, and it went on showing the text that had been typed. The
   * field is told directly, which is the only thing it is sure to believe.
   */
  private emptyTheField(): void {
    const field = this.noteField();
    if (field) field.nativeElement.value = '';
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
    return this.pockets().find(pocket => pocket.id === id)?.name ?? '';
  }

  private otherThan(id: number | null): number | null {
    return this.pockets().find(pocket => pocket.id !== id)?.id ?? null;
  }

  /** Deletes the entry being corrected, and works its days out again. */
  /**
   * Unwrites an entry, whatever shape it had.
   *
   * An entry that is half of a cash-in is deleted through its movement, which
   * takes both halves with it - left alone, the half that stayed would move the
   * product's balance on its own.
   */
  private async removeWhatItWas(db: SqlDriver, yields: YieldsRepository, editing: CushionEntry): Promise<void> {
    if (editing.transaction_id !== null) {
      await new TransactionsRepository(db).delete(editing.transaction_id);
      return;
    }
    await yields.removeAdjustment(editing.id);
  }

  /** Open while the delete is being confirmed. Nothing is gone until it is. */
  readonly confirmingDelete = signal(false);

  askToDelete(): void {
    if (this.request().editing) this.confirmingDelete.set(true);
  }

  async remove(): Promise<void> {
    const editing = this.request().editing;
    if (!editing || this.saving()) return;
    this.confirmingDelete.set(false);
    this.saving.set(true);
    this.error.set('');
    await this.sayBusy('busy.deletingMovement');
    try {
      const db = this.database.driver;
      const yields = new YieldsRepository(db);
      const tax = new TaxParametersRepository(db);
      const accountId = this.accountId();
      await db.transaction(async () => {
        await this.removeWhatItWas(db, yields, editing);
        await yields.clearDays(accountId, editing.on_date);
      });
      await accrueAndSettle(db, yields, tax, accountId, todayIso());
      // The account that changed has just been worked out.
      await yields.markAccrued(todayIso(), { onlyIfKnown: true });
      this.database.dataChanged();
      this.saved.emit();
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : String(error));
    } finally {
      this.saving.set(false);
      this.busyLabel.set('');
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
    await this.sayBusy('busy.saving');

    try {
      const db = this.database.driver;
      const yields = new YieldsRepository(db);
      const tax = new TaxParametersRepository(db);
      const { kind, editing } = this.request();
      // The LIVE account and its products, not the ones the form opened on:
      // the account is a button now, and saving to the one it started from
      // would put the money in the account the user had just corrected away
      // from - silently, and in the one place that cannot be undone by
      // closing the form.
      const account = this.account() ?? this.request().account;
      const pockets = this.pockets();
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
          // Correcting one that already was a movement: it is written again
          // from scratch rather than patched, because what changes may be its
          // shape - a movement with a product half, or without one.
          if (editing) await this.removeWhatItWas(db, yields, editing);

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
        } else if (editing && this.scopeWhenOpened === 'product') {
          await yields.updateAdjustment(editing.id, {
            on_date: this.onDate(),
            amount_minor: signed,
            kind: this.legacyKind(),
            category_id: this.categoryId(),
            pocket_id: this.pocketId(),
            note: this.note().trim() || null,
          });
        } else {
          // It was a movement and is now only the product's: the movement goes,
          // and with it the half that kept the product's balance where it was.
          if (editing) await this.removeWhatItWas(db, yields, editing);

          await yields.adjust({
            account_id: account.id,
            on_date: this.onDate(),
            amount_minor: signed,
            kind: this.legacyKind(),
            category_id: this.categoryId(),
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
      // The account that changed has just been worked out.
      await yields.markAccrued(todayIso(), { onlyIfKnown: true });
      this.database.dataChanged();
      this.saved.emit();
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : String(error));
    } finally {
      this.saving.set(false);
      this.busyLabel.set('');
    }
  }
}

/** Today, one year back. Text dates compare in the same order as real ones. */
function aYearAgo(): string {
  const today = todayIso();
  return `${Number(today.slice(0, 4)) - 1}${today.slice(4)}`;
}

/** The category list's order, read from the movement form's own key. */
function readCategoryOrder(): 'use' | 'name' {
  try {
    return localStorage.getItem('finance.categoryOrder') === 'name' ? 'name' : 'use';
  } catch {
    return 'use';
  }
}

/** Lowercased and without accents, for searching. */
function fold(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}
/** The account list's order, the key every picker in the app shares. */
function readAccountOrder(): 'use' | 'name' {
  try {
    return localStorage.getItem('finance.accountOrder') === 'use' ? 'use' : 'name';
  } catch {
    return 'name';
  }
}
