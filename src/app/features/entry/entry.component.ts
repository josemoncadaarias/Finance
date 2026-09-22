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
  Component, ElementRef, HostListener, computed, inject, input, output, signal, viewChild,
  type OnDestroy, type OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Capacitor } from '@capacitor/core';
import { Keyboard } from '@capacitor/keyboard';
import {
  IonContent, IonHeader, IonToolbar, IonButton, IonButtons, IonIcon,
  IonItem, IonInput, IonTextarea, IonDatetime, IonModal, IonList, IonLabel, IonFooter,
  IonSearchbar, IonNote,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import * as allIcons from 'ionicons/icons';

import { DatabaseService } from '../../core/database/database.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { monthName } from '../../core/filters/period';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import {
  CategoriesRepository, type UsedCategory,
} from '../../core/database/repositories/categories.repository';
import { AccountsRepository } from '../../core/database/repositories/accounts.repository';
import { YieldsRepository } from '../../core/database/repositories/yields.repository';
import type { YieldPocket } from '../../core/database/repositories/yields.repository';
import { TransactionsRepository } from '../../core/database/repositories/transactions.repository';
import { TransfersRepository } from '../../core/database/repositories/transfers.repository';
import type { AccountRow, CategoryKind, CategoryRow, TransactionRow } from '../../core/database/types';
import { deriveRateScaled, formatMoney } from '../../core/database/money';
import { AmountBuffer } from './amount-buffer';
import {
  apply, isOperator, operatorFromKey, type Operator, type Pending,
} from './calculator';
import { outlined } from '../../core/icons/icon-catalog';
import { IconComponent } from '../../core/icons/icon.component';
import { CategoryEditorComponent } from '../categories/category-editor.component';

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
    IconComponent,
    CommonModule, TranslatePipe,
    IonContent, IonHeader, IonToolbar, IonButton, IonButtons, IonIcon,
    CategoryEditorComponent,
    IonItem, IonInput, IonTextarea, IonDatetime, IonModal, IonList, IonLabel, IonFooter,
    IonSearchbar, IonNote,
  ],
  templateUrl: './entry.component.html',
  styleUrls: ['./entry.component.scss'],
})
export class EntryComponent implements OnInit, OnDestroy {
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

  /** Every category of this kind, ordered by how often it is used. */
  readonly categories = signal<UsedCategory[]>([]);

  /**
   * The products of the account in play, and which one the money touches.
   *
   * Only ever a question when an account has more than one. Money arriving has
   * to land somewhere and money leaving has to come from somewhere, and until
   * the movement said which, the yields module assumed the first product -
   * so a deposit into a CDT earned at the savings rate and a withdrawal from
   * one shrank the other.
   *
   * The first product is the answer nearly every time, so it is the one
   * already chosen: an account's first product is the savings account it
   * started as, which is where a salary lands and a card payment leaves from.
   */
  readonly pockets = signal<YieldPocket[]>([]);
  readonly pocketId = signal<number | null>(null);

  /** The far side of a transfer has products of its own. */
  readonly toPockets = signal<YieldPocket[]>([]);
  readonly toPocketId = signal<number | null>(null);

  readonly splitAccount = computed(() => this.pockets().length > 1);
  readonly splitTarget = computed(() => this.toPockets().length > 1);

  /**
   * True when both legs sit on one account: money moving between two of its
   * products, which is a different act from moving it between accounts. The
   * screen then talks about products - they are what changes - and names the
   * account underneath.
   */
  readonly betweenProducts = computed(() =>
    this.isTransfer() && this.accountId() !== null && this.toAccountId() === this.accountId());

  /** Open while the full list with its search box is showing. */
  readonly browsingCategories = signal(false);
  readonly categorySearch = signal('');
  readonly accounts = signal<AccountRow[]>([]);

  /**
   * How the account picker is ordered: by name, or by how much each is used.
   *
   * By name to begin with, because a list you can predict is faster to read
   * than one that is merely short - which is the opposite of the categories,
   * where the everyday handful is the whole point and the rest is a tail.
   *
   * Kept in localStorage beside the category order, for the same reason: a
   * picker has to open at once, and a database read is a round trip the
   * moment of opening cannot afford.
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

  readonly orderedAccounts = computed(() => {
    const all = this.accounts();
    if (this.accountOrder() === 'name') {
      // `localeCompare` so "Éxito" files under E and not after Z.
      return [...all].sort((a, b) => a.name.localeCompare(b.name, 'es'));
    }

    const times = this.useCounts();
    return [...all].sort((a, b) => {
      const byUse = (times.get(b.id) ?? 0) - (times.get(a.id) ?? 0);
      return byUse !== 0 ? byUse : a.name.localeCompare(b.name, 'es');
    });
  });
  /** Which picker is open: the source account, the destination, or neither. */
  readonly picking = signal<'from' | 'to' | null>(null);
  readonly showDate = signal(false);

  /** Icon names arrive with or without their suffix; this settles it. */
  readonly outlined = outlined;
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
  /**
   * The keys, as they are laid out: three columns of digits and one of
   * arithmetic.
   *
   * Backspace sits where '=' used to. Correcting a digit is something that
   * happens on nearly every amount, and it was only reachable at the top of
   * the screen beside the figure - while '=' is only needed when a sum is
   * being added up, which is when it appears beside the save button instead.
   */
  readonly keys = [
    '1', '2', '3', '+',
    '4', '5', '6', '-',
    '7', '8', '9', '×',
    ',', '0', '<', '÷',
  ];

  /** Set when the screen is editing an existing transfer rather than a movement. */
  readonly editingTransferId = signal<number | null>(null);
  /** Notes used before that match what is being typed. */
  readonly noteSuggestions = signal<string[]>([]);

  /**
   * True while the note is being written, which on a phone means the system
   * keyboard is up and has taken the bottom half of the screen - exactly where
   * the note and the suggestions under it were being drawn.
   *
   * While it is on, the app's own keypad goes away (it cannot help type a
   * note) and, on a screen too short for the rest, so does everything above
   * the note. What is left is the amount, the note, and the notes already
   * written that match it.
   */
  readonly writingNote = signal(false);

  /** The note's box, so it can be brought into view when it is tapped. */
  private readonly noteBox = viewChild<ElementRef<HTMLElement>>('noteBox');
  private readonly noteField = viewChild<ElementRef<HTMLTextAreaElement>>('noteField');

  /** Tapping a suggestion blurs the note for a moment; this rides that out. */
  private noteBlurTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * Leaves the note for good: the keyboard down, the focus off the field, and
   * the app's own keypad back.
   *
   * On Android the back button closes the keyboard and leaves the focus where
   * it was, so nothing told the form the note was finished and the keypad
   * stayed away until something else was tapped. The keyboard plugin reports
   * the close, and this is what it calls.
   */
  finishNote(): void {
    if (this.noteBlurTimer !== null) {
      clearTimeout(this.noteBlurTimer);
      this.noteBlurTimer = null;
    }
    this.writingNote.set(false);
    // Nothing of the search stays behind it: the list under the note was
    // still there once the note was written, pushing the form down.
    this.noteSuggestions.set([]);
    const field = this.noteBox()?.nativeElement.querySelector('textarea');
    field?.blur();
    if (Capacitor.isNativePlatform()) void Keyboard.hide().catch(() => undefined);
  }

  startNote(): void {
    if (this.noteBlurTimer !== null) {
      clearTimeout(this.noteBlurTimer);
      this.noteBlurTimer = null;
    }
    this.writingNote.set(true);
    // After the keypad has gone and the keyboard has come up.
    setTimeout(() => this.noteBox()?.nativeElement.scrollIntoView({ block: 'center', behavior: 'smooth' }), 250);
  }

  /**
   * Leaving the note - unless the focus is coming straight back, which is what
   * tapping one of the suggestions does.
   */
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
    if (this.betweenProducts()) {
      return this.i18n.t(this.isEditing() ? 'entry.editProductTransfer' : 'entry.productTransfer');
    }
    if (this.isEditing()) return this.i18n.t(this.isTransfer() ? 'entry.editTransfer' : 'entry.editMovement');
    if (this.isTransfer()) return this.i18n.t('entry.transfer');
    return this.i18n.t(this.kind() === 'expense' ? 'entry.newExpense' : 'entry.newIncome');
  });

  readonly selectedCategory = computed(() =>
    this.categories().find(c => c.id === this.categoryId()) ?? null);

  /**
   * How many categories the grid offers before the rest go behind "see all".
   *
   * Four, plus the door to the rest, is exactly one row — and a single row is
   * worth more than the extra coverage a second one buys: it leaves the amount
   * and the keypad in view, which is what the screen is for. The four most
   * used carry two thirds of what gets recorded here, and everything else is
   * one tap and a search away.
   */
  /**
   * How many categories the grid offers before "Ver todas".
   *
   * Four was a single row. The grid wraps and takes the height the screen has
   * left, so this is now "enough to fill a tall phone" rather than "enough for
   * one row" - on a short screen the extra rows are simply scrolled to, and
   * the ordering puts what is actually used at the top either way.
   */
  /**
   * Four across, two down: the grid never takes a third row.
   *
   * The way in to the rest of them is one of those eight tiles, not an extra
   * one below - a ninth tile alone on a row of its own cost a whole row of the
   * screen, which on a phone is a row the note wanted.
   */
  private static readonly SHORTLIST = 8;

  /**
   * The grid: the most used, plus whichever one is already chosen.
   *
   * Editing a movement filed under a rare category must show that category as
   * selected, or the screen would look like nothing was chosen and quietly
   * invite re-picking.
   */
  readonly shortlist = computed<UsedCategory[]>(() => {
    const all = this.categories();
    // One of the eight goes to "see them all" when there are more.
    const room = all.length > EntryComponent.SHORTLIST
      ? EntryComponent.SHORTLIST - 1
      : EntryComponent.SHORTLIST;
    const top = all.slice(0, room);

    const chosen = this.categoryId();
    if (chosen === null || top.some(category => category.id === chosen)) return top;

    const missing = all.find(category => category.id === chosen);
    return missing ? [...top.slice(0, room - 1), missing] : top;
  });

  /** True when there is more than the grid is showing. */
  readonly hasMoreCategories = computed(() =>
    this.categories().length > EntryComponent.SHORTLIST);

/**
   * How the full list is ordered, and the user's to choose.
   *
   * It came back from the database by how often each category was used in the
   * last year, and stayed that way. That is the right default - habit is what
   * you are picking from - but past the first handful it reads as no order at
   * all: forty categories used two, two and one times, with the counts hidden
   * on the unused ones so there was nothing on screen to explain the sequence.
   *
   * So: two orders, the choice remembered, and the count shown on every row
   * including the ones at zero, so whichever order is on can be seen to be an
   * order.
   */
  readonly categoryOrder = signal<'use' | 'name'>(readOrder());

  setCategoryOrder(order: 'use' | 'name'): void {
    this.categoryOrder.set(order);
    try {
      localStorage.setItem('finance.categoryOrder', order);
    } catch {
      // A browser with site data blocked still gets the order for this visit.
    }
  }

  /**
   * The full list, filtered by what is typed and ordered as asked.
   *
   * Accents are folded away: someone looking for "Tecnología" should not have
   * to produce the accent, and nobody types one while hurrying.
   */
  readonly foundCategories = computed<UsedCategory[]>(() => {
    const term = fold(this.categorySearch());
    const found = term === ''
      ? this.categories()
      : this.categories().filter(category => fold(category.name).includes(term));

    if (this.categoryOrder() === 'use') return found;

    // `localeCompare` so "Éxito" files under E and not after Z.
    return [...found].sort((a, b) => a.name.localeCompare(b.name, 'es'));
  });

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
    if (this.amount().minor <= 0) return this.i18n.t('entry.need.amount');
    if (this.accountId() === null) return this.i18n.t('entry.need.account');

    if (this.isTransfer()) {
      if (this.toAccountId() === null) return this.i18n.t('entry.need.destination');
      // One account on both sides is a transfer between two of its products -
      // how a CDT is funded out of the savings beside it. It needs two
      // products to move between, and they have to be different ones.
      if (this.toAccountId() === this.accountId()) {
        if (!this.splitAccount()) return this.i18n.t('entry.need.differentAccounts');
        if (this.pocketId() === null || this.pocketId() === this.toPocketId()) {
          return this.i18n.t('entry.need.differentProducts');
        }
      }
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

  /** Undoes the keyboard listener when the form closes. */
  private keyboardClosed: { remove: () => Promise<void> } | null = null;

  ngOnDestroy(): void {
    void this.keyboardClosed?.remove();
  }

  ngOnInit(): void {
    // The phone's keyboard closing is the end of writing a note, however it
    // was closed - the back button included, which does not blur the field.
    if (Capacitor.isNativePlatform()) {
      void Keyboard.addListener('keyboardDidHide', () => {
        if (this.writingNote()) this.finishNote();
      }).then(handle => { this.keyboardClosed = handle; });
    }
    // Not the constructor: a required input has no value there yet, and load()
    // reads one. Angular says so with NG0950 rather than a blank screen.
    void this.load();
  }

  private find(id: number | null): AccountRow | null {
    return id === null ? null : this.accounts().find(a => a.id === id) ?? null;
  }

  private async load(): Promise<void> {
    // The products belong to whichever accounts end up chosen, so they are
    // read after that is settled. Reading them first was the whole of why the
    // picker never appeared: the account was still null, so there were no
    // products to show and the row decided there was nothing to ask.
    await this.loadAccountsAndCategories();
    await this.loadPockets();
  }

  private async loadAccountsAndCategories(): Promise<void> {
    if (this.database.status() !== 'ready') return;
    const driver = this.database.driver;

    const [categories, accounts] = await Promise.all([
      this.isTransfer()
        ? Promise.resolve([] as UsedCategory[])
        : new CategoriesRepository(driver).listByUse({
            kind: this.kind() === 'expense' ? 'expense' : 'income',
            since: aYearAgo(),
          }),
      new AccountsRepository(driver).list(),
    ]);

    this.categories.set(categories);
    this.accounts.set(accounts);
    void new AccountsRepository(this.database.driver).timesUsed()
      .then(counts => this.useCounts.set(counts));

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
    this.nearLegPocketId = found.from.pocket_id ?? null;
    this.farLegPocketId = found.to.pocket_id ?? null;
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
       WHERE t.account_id = ? AND t.transfer_leg = ? AND other.account_id <> t.account_id
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
      kind: this.kind() === 'expense' ? 'expense' : 'income',
    });
  }

  newCategory(): void {
    this.editingCategory.set({ category: null, kind: this.kind() === 'expense' ? 'expense' : 'income' });
  }

  /** Saved: the list is read again, so the new or corrected one is in it. */
  async categorySaved(): Promise<void> {
    this.editingCategory.set(null);
    await this.loadCategories();
  }

  /** The categories this movement can be filed under, read again. */
  private async loadCategories(): Promise<void> {
    if (this.database.status() !== 'ready' || this.isTransfer()) return;
    this.categories.set(await new CategoriesRepository(this.database.driver).listByUse({
      kind: this.kind() === 'expense' ? 'expense' : 'income',
      since: aYearAgo(),
    }));
  }

  /** Empties the note in one tap, rather than holding backspace down. */
  /**
   * Taken on the way down, not on the click.
   *
   * A tap on either of these blurs the note first, which hides the keyboard,
   * which moves everything on screen - so the finger comes up somewhere else
   * and the click never happens. Jose's "x" did nothing at all for that
   * reason. Answering the press instead, with the default prevented so the
   * note never loses focus, keeps the screen still and the tap lands.
   *
   * The click handler stays for a keyboard or a mouse that sends no pointer
   * event; both of these say the same thing twice without harm.
   */
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


  /** Starts the amount over, sum and all. */
  clearAmount(): void {
    this.pending.set(null);
    if (this.editingTarget()) this.targetAmount.set(new AmountBuffer());
    else this.amount.set(new AmountBuffer());
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

    // A picker or a sheet is open: it owns the keyboard.
    if (this.picking() !== null || this.showDate() || this.browsingCategories()) return;

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
    this.browsingCategories.set(false);
    this.categorySearch.set('');
  }

  openCategories(): void {
    this.categorySearch.set('');
    this.browsingCategories.set(true);
  }

  async pickAccount(id: number): Promise<void> {
    // The products belong to the account, so the question changes with it.
    const toSide = this.picking() === 'to';
    if (toSide) this.toAccountId.set(id);
    else this.accountId.set(id);
    await this.loadPockets();

    // Landing on the same account on both sides is a transfer between two of
    // its products, which is a real thing to want. Only an account with a
    // single product cannot do it, and there the other side moves to wherever
    // this one usually sends. Moving it in every case was what made editing a
    // transfer between products impossible: choosing the account it comes out
    // of changed the account it goes to.
    if (this.isTransfer() && this.toAccountId() === this.accountId() && this.pockets().length < 2) {
      const other = await this.counterpart(this.accounts(), id, toSide ? 'to' : 'from');
      if (toSide) this.accountId.set(other);
      else this.toAccountId.set(other);
      await this.loadPockets();
    }

    // Straight on to the product, when the account has more than one. The
    // sheet stays open and changes what it is asking; anything else means
    // reopening it to answer the obvious follow-up.
    const side = this.picking() === 'to' ? this.toPockets() : this.pockets();
    const account = this.picking() === 'to' ? this.toAccount() : this.account();
    this.pocketSide.set(this.picking());
    this.picking.set(null);

    // Straight on to the product when the account has more than one, in a
    // sheet of its own: the follow-up is obvious enough that making it be
    // asked for is worse than asking it.
    if (side.length > 1 && account) this.pickingPocket.set(account);
  }

  swapAccounts(): void {
    const from = this.accountId();
    this.accountId.set(this.toAccountId());
    this.toAccountId.set(from);

    // The products swap with them: on one account they are the whole of what
    // the two sides are, and leaving them put would turn the transfer around
    // without turning it around.
    const fromPocket = this.pocketId();
    const fromPockets = this.pockets();
    this.pocketId.set(this.toPocketId());
    this.pockets.set(this.toPockets());
    this.toPocketId.set(fromPocket);
    this.toPockets.set(fromPockets);
  }

  pickDate(value: string | null): void {
    if (value) this.occurredOn.set(value.slice(0, 10));
    this.showDate.set(false);
  }

  money(minor: number, currency = this.currency()): string {
    return formatMoney(minor, currency, { withSymbol: false });
  }

  async save(): Promise<void> {
    // A sum still being added up is finished by saving it, rather than the
    // form refusing until '=' is pressed. Enter has always done this.
    if (this.pending() !== null) this.equals();
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

  /**
   * Reads the products of whichever account is in play.
   *
   * Called on load and whenever the account changes, because the answer is
   * only ever about that account - switching from Dale to Nequi replaces the
   * whole question, and keeping the old choice would file a movement against
   * a product belonging to somewhere else.
   */
  private async loadPockets(): Promise<void> {
    if (this.database.status() !== 'ready') return;
    const yields = new YieldsRepository(this.database.driver);

    // The product already on screen wins when it still belongs to the account.
    // Resetting both sides to the default on every account pick was what made
    // the far side move by itself: choosing Plata again for "from" put "from"
    // back on its first product and pushed "to" off it.
    const read = async (accountId: number | null, currentId: number | null, storedId: number | null) => {
      if (accountId === null) return { pockets: [] as YieldPocket[], chosen: null };
      const pockets = await yields.pockets(accountId);
      const known = (id: number | null) => id !== null && pockets.some(pocket => pocket.id === id);
      const chosen = known(currentId) ? currentId : known(storedId) ? storedId : defaultPocket(pockets);
      return { pockets, chosen };
    };

    const editing = this.request().editing;
    const storedFor = (accountId: number | null) =>
      editing && editing.account_id === accountId ? editing.pocket_id ?? null : null;

    // A transfer between two products of one account has the same account on
    // both legs, so which leg a stored product belongs to cannot be told from
    // the account alone: each leg's product is remembered as it was read.
    const nearStored = this.editingTransferId() !== null
      ? this.nearLegPocketId
      : storedFor(this.accountId());
    const here = await read(this.accountId(), this.pocketId(), nearStored);
    this.pockets.set(here.pockets);
    this.pocketId.set(here.chosen);

    // A transfer moves between two products as much as between two accounts,
    // and they are asked for separately because they are separate questions -
    // the far account's savings pocket is not this one's.
    const far = this.isTransfer()
      ? await read(this.toAccountId(), this.toPocketId(), this.farLegPocket())
      : { pockets: [] as YieldPocket[], chosen: null };
    // Both sides on one account: the far side starts on a different product,
    // because money does not move from a product to itself.
    const farChosen = this.toAccountId() === this.accountId() && far.chosen === here.chosen
      ? far.pockets.find(pocket => pocket.id !== here.chosen)?.id ?? far.chosen
      : far.chosen;
    this.toPockets.set(far.pockets);
    this.toPocketId.set(farChosen);
  }

  /** The products recorded on each leg of the transfer being corrected. */
  private nearLegPocketId: number | null = null;
  private farLegPocketId: number | null = null;

  private farLegPocket(): number | null {
    return this.farLegPocketId;
  }

  /**
   * The account whose products the sheet is asking about, or null while it is
   * still asking which account.
   *
   * Two steps in one sheet rather than a second control on the form: the
   * product is the same question narrowed, and a row of products sitting on
   * the form looked like a setting someone had left lying around. It also
   * scales - ten products are a list to scroll, where ten chips in a row are
   * a wall.
   */
  readonly pickingPocket = signal<AccountRow | null>(null);

  /**
   * Which side the PRODUCT sheet is asking about.
   *
   * Its own signal, not the one that opens the account sheet. That one means
   * "the accounts are open", and the product sheet was reading it to know
   * which side it was for - so opening the products straight from the form
   * had to set it, and setting it opened the whole list of accounts behind
   * them. Two questions were sharing one answer.
   */
  readonly pocketSide = signal<'from' | 'to' | null>(null);

  /** The product's own name, for the line under the account. */
  pocketName(pockets: readonly YieldPocket[], id: number | null): string {
    return pockets.find(pocket => pocket.id === id)?.name ?? '';
  }

  /** Answers the second step and closes the sheet. */
  choosePocket(id: number): void {
    const toSide = this.pocketSide() === 'to';
    if (toSide) this.toPocketId.set(id);
    else this.pocketId.set(id);

    // Between two products of one account the other side cannot be this same
    // one, so it moves to another - with two products, the only other. The
    // side just chosen is never the one that moves. The products' own form
    // does the same.
    if (this.betweenProducts()) {
      const other = toSide ? this.pocketId() : this.toPocketId();
      if (other === id) {
        const next = this.pockets().find(pocket => pocket.id !== id)?.id ?? null;
        if (toSide) this.pocketId.set(next);
        else this.toPocketId.set(next);
      }
    }

    this.pickingPocket.set(null);
  }

  pickPocketTo(id: number): void {
    this.toPocketId.set(id);
  }

  pickPocket(id: number): void {
    this.pocketId.set(id);
  }

  /** Closing it drops the second step too, so it reopens at the account. */
  closeAccountSheet(): void {
    this.pickingPocket.set(null);
    this.picking.set(null);
  }

  /**
   * Opening the sheet starts at the account - except on a transfer between two
   * products of one account, where the account is not the question being
   * asked. There it opens on the products, and keeps a way back to the
   * accounts for the day the money really is going somewhere else.
   */
  openAccountSheet(which: 'from' | 'to'): void {
    this.picking.set(which);
    this.pocketSide.set(which);
    const side = which === 'to' ? this.toAccount() : this.account();
    const pockets = which === 'to' ? this.toPockets() : this.pockets();
    this.pickingPocket.set(this.betweenProducts() && side && pockets.length > 1 ? side : null);
  }

  /** From the products back to the accounts, for the side being chosen. */
  chooseAnotherAccount(): void {
    // Back to the accounts, for the side the products were being chosen for.
    this.picking.set(this.pocketSide());
    this.pickingPocket.set(null);
  }

  /**
   * The products of one side, without asking about the account again.
   *
   * Changing only the product meant picking the account a second time so the
   * sheet would follow with its products - a step that answered a question
   * nobody had asked. The product line is its own button now.
   */
  openPocketSheet(which: 'from' | 'to'): void {
    const side = which === 'to' ? this.toAccount() : this.account();
    if (!side) return;
    // The products alone. The account has its own button above them, and
    // opening its sheet here only ever put it behind these.
    this.pocketSide.set(which);
    this.pickingPocket.set(side);
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
        pocket_id: this.splitAccount() ? this.pocketId() : null,
        occurred_on: this.occurredOn(),
        amount_minor: signed,
        description: this.note().trim() || null,
      });
      return;
    }

    await transactions.create({
      account_id: this.accountId()!,
      category_id: this.categoryId(),
      // Null on an account with one product: there is nothing to choose, and
      // a column filled in anyway would be a fact nobody stated.
      pocket_id: this.splitAccount() ? this.pocketId() : null,
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
      from: {
        account_id: this.accountId()!,
        pocket_id: this.splitAccount() ? this.pocketId() : null,
        amount_minor: out,
      },
      to: {
        account_id: this.toAccountId()!,
        pocket_id: this.splitTarget() ? this.toPocketId() : null,
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

/**
 * Which product a movement lands in when nobody has said.
 *
 * The one the user marked as usual. It was matched by name for one commit,
 * against "Cuenta de ahorros", which works until somebody renames one - and
 * which writes into the code a decision belonging to the person using it.
 *
 * It falls back to the first only if no product is marked, which the schema
 * makes unlikely: every account had one set when the flag was added.
 */
function defaultPocket(pockets: readonly YieldPocket[]): number | null {
  const usual = pockets.find(pocket => pocket.is_default === 1);
  return (usual ?? pockets[0])?.id ?? null;
}

/** The order last chosen, or habit if there is none to read. */
function readOrder(): 'use' | 'name' {
  try {
    return localStorage.getItem('finance.categoryOrder') === 'name' ? 'name' : 'use';
  } catch {
    return 'use';
  }
}

/** The account picker's order, remembered beside the category one. */
function readAccountOrder(): 'use' | 'name' {
  try {
    return localStorage.getItem('finance.accountOrder') === 'use' ? 'use' : 'name';
  } catch {
    return 'name';
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

/**
 * Lowercased and stripped of accents, for searching.
 *
 * "Tecnologia" has to find "Tecnología": nobody reaches for the accent key
 * while hurrying, and a search that insists on it finds nothing.
 */
function fold(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}
