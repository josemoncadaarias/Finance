/**
 * Recording a movement, correcting one, and moving money between accounts.
 *
 * The thing a good expense app gets right is that adding an expense costs three
 * steps: amount, category, save. Everything here is arranged around not being
 * slower than that — the cursor waits in the amount, the category grid needs no scrolling
 * for the common ones, and account and date already hold the answer that is
 * right most of the time.
 *
 * A transfer is the same screen with the category grid swapped for two
 * accounts, because it is the same act: an amount, a where, a when.
 *
 * Editing saves through the repository, which locks the row, so a later
 * later pass over the data leaves the correction alone.
 */

import {
  Component, ElementRef, HostListener, computed, effect, inject, input, output, signal, untracked, viewChild,
  type OnDestroy, type OnInit,
} from '@angular/core';
import { CommonModule, NgTemplateOutlet } from '@angular/common';
import { Capacitor } from '@capacitor/core';
import { Keyboard } from '@capacitor/keyboard';
import { IonIcon, IonDatetime, IonModal } from '@ionic/angular';
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
import type { ProductEntry, YieldProduct } from '../../core/database/repositories/yields.repository';
import { TransactionsRepository } from '../../core/database/repositories/transactions.repository';
import { TransfersRepository, type TransferScope } from '../../core/database/repositories/transfers.repository';
import type { TranslationKey } from '../../core/i18n/translations';
import type { AccountRow, CategoryKind, CategoryRow, TransactionRow } from '../../core/database/types';
import { deriveRateScaled, formatMoney } from '../../core/database/money';
import { AmountBuffer } from './amount-buffer';
import { cardStatement } from '../../core/cards/statement';
import { bankFigures, cardMovements } from '../../core/cards/card-data';
import { whatItHolds } from '../../core/yields/holdings';
import { DEFAULT_SCOPE, rewriteScoped, scopeOfMovement, usualScope, writeScoped, type EntryScope } from '../../core/yields/entry-scope';
import { transferEffect } from '../../core/transfers/transfer-effect';
import { accrueAndSettle } from '../../core/yields/cdt';
import { TaxParametersRepository } from '../../core/database/repositories/tax-parameters.repository';
import { usualNote, type NoteContext } from '../../core/notes/usual-note';
import { outlined } from '../../core/icons/icon-catalog';
import { CategoryEditorComponent } from '../categories/category-editor.component';
import { ConfirmComponent } from '../../shared/confirm/confirm.component';
import { BadgeComponent } from '../../shared/ui/badge.component';
import { ScopeSheetComponent, SCOPE_ICON, SCOPE_TONE, scopeOptionsIn } from '../../shared/scope-sheet/scope-sheet.component';
import { productIcon, productSeed } from '../../core/icons/product-face';
import { AccentService } from '../../core/theme/accent.service';

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
  /**
   * Which end of a transfer that account is. The summary screen leaves it as
   * the destination - looking at a card and pressing transfer means paying it.
   * The products screen makes it the origin: looking at the account holding
   * the savings, the move is money leaving it (Jose, 2026-09-24).
   */
  preferredSide?: 'from' | 'to';
  /**
   * What was already written somewhere else, carried over rather than typed
   * twice. The products screen hands its form here when the account chosen
   * has no products: the amount, the day and the note were the right ones,
   * only the form was not.
   */
  start?: { amountMinor: number; onDate: string; note: string; again?: boolean };
  /**
   * Both ends of a transfer, already chosen: the products screen's move
   * between products hands itself here when one end is pointed at another
   * account (Jose, 2026-09-29: the account could be changed there before the
   * redesign, and only the product could after it).
   */
  route?: { from: number; to: number; fromProductId?: number | null; toProductId?: number | null };
  /**
   * A loan's installment or payment ahead (debts, part 2). The amount is what
   * leaves the account; the form shows how it splits - capital into the loan,
   * interest, insurance and default interest as spending - each figure
   * editable, and writes it whole through LoansRepository.recordPayment.
   */
  loan?: LoanEntry;
  /**
   * A product's own movement being corrected - one saved as "Solo el
   * producto", with no movement of the account (Jose, 2026-10-08: one form
   * for everything, wherever it is opened from).
   */
  editingEntry?: ProductEntry;
}

export interface LoanEntry {
  accountId: number;
  kind: 'installment' | 'extra' | 'payoff';
  number: number | null;
  /** "Cuota 24 de 60", said by the page that opened the form. */
  title: string;
  interestMinor: number;
  insuranceMinor: number;
  mode: 'term' | 'installment' | null;
}

import { FormFootComponent } from '../../shared/ui/form-foot.component';
import { AmountFieldComponent } from '../../shared/ui/amount-field.component';
import { foldText } from '../../core/text/fold-text';
import { LoansRepository } from '../../core/loans/loans.repository';
import { AutoGrowDirective } from '../../shared/ui/auto-grow.directive';
import { ToastService } from '../../shared/ui/toast.service';
@Component({
  selector: 'app-entry',
  imports: [
    CommonModule, NgTemplateOutlet, TranslatePipe, BadgeComponent, ScopeSheetComponent,
    CategoryEditorComponent, ConfirmComponent, FormFootComponent, AmountFieldComponent, AutoGrowDirective,
    IonIcon, IonDatetime, IonModal,
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
  /**
   * Gasto, Ingreso or Transferir chosen at the top of the form: the host opens
   * the form again for that kind, carrying the amount, the day and the note.
   */
  readonly switchTo = output<EntryRequest>();

  readonly amount = signal(new AmountBuffer());

  /**
   * The cursor starts in the amount on a new movement, so the phone's
   * keyboard comes up for it; not on one being corrected, nor on a loan's
   * payment, whose amount is already the installment.
   */
  readonly autofocusAmount = signal(false);
  private readonly amountField = viewChild(AmountFieldComponent);

  /**
   * "Registrar otro": save and start the next movement at once, on the same
   * account, kind and day. Off every time a movement is opened (Jose,
   * 2026-09-28): it used to be remembered, and a form that saved and stayed
   * open when a single movement was meant looked like a save that failed.
   * Kept only while the same form switches between Gasto, Ingreso and
   * Transferir.
   */
  readonly again = signal(false);
  private readonly toast = inject(ToastService);

  setAgain(on: boolean): void {
    this.again.set(on);
  }

  /** What the amount field typed, erased or cleared. */
  setAmount(buffer: AmountBuffer, target: boolean): void {
    this.editingTarget.set(target);
    if (target) this.targetAmount.set(buffer);
    else this.amount.set(buffer);
  }

  /** Enter in the amount: saves on a computer when it can, else lets the keyboard go. */
  amountDone(): void {
    if (this.canSave()) void this.save();
    else this.amountField()?.blur();
  }
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
  readonly products = signal<YieldProduct[]>([]);
  readonly productId = signal<number | null>(null);

  /** The far side of a transfer has products of its own. */
  readonly toProducts = signal<YieldProduct[]>([]);
  readonly toProductId = signal<number | null>(null);

  readonly splitAccount = computed(() => this.products().length > 1);
  readonly splitTarget = computed(() => this.toProducts().length > 1);

  /**
   * "¿Qué cambia?" (`core/yields/entry-scope.ts`), asked here too whenever the
   * account has products (Jose, 2026-09-28): an ordinary movement for a
   * salary, the product alone for a gain not to be counted in net worth yet.
   * A movement being corrected is asked too (Jose, 2026-10-06: it could not
   * be changed afterwards), starting on the shape it has; a loan's payment
   * keeps its own.
   */
  readonly asksScope = computed(() =>
    !this.isTransfer() && this.products().length > 0 && this.loanPayment() === null);
  /** The shape of the movement being corrected, read off its rows when it opened. */
  private scopeWhenOpened: EntryScope | null = null;
  readonly scope = signal<EntryScope>(DEFAULT_SCOPE);
  readonly choosingScope = signal(false);
  /** Chosen by hand: the habit stops following the form. */
  private scopeTouched = false;
  private scopeAsked = 0;

  readonly scopeIcon = SCOPE_ICON;
  readonly scopeTone = SCOPE_TONE;
  readonly scopeName = computed(() =>
    scopeOptionsIn(this.i18n, this.kind() === 'expense' ? 'expense' : 'income')
      .find(option => option.id === this.scope())?.name ?? '');

  chooseScope(id: EntryScope): void {
    this.scopeTouched = true;
    this.scope.set(id);
    this.choosingScope.set(false);
  }

  /**
   * "¿Qué cambia?" at each end of a transfer between two DIFFERENT accounts,
   * for the end whose account has products (Jose, 2026-10-03; mockup 17b):
   * the leaving end takes a spending's answers, the arriving end an income's
   * (`TransferScope`, migration 056). Moving earnings that never counted to
   * another account is not net worth going down. Every transfer starts on
   * "Producto y patrimonio" - what every transfer has always been - and a
   * move between products of one account asks nothing: its net worth never
   * moves.
   */
  readonly fromScopeChosen = signal<TransferScope>('both');
  readonly toScopeChosen = signal<TransferScope>('both');
  readonly choosingTransferScope = signal<'from' | 'to' | null>(null);
  private readonly betweenAccounts = computed(() =>
    this.isTransfer() && this.loanEntry() === null && this.accountId() !== null
    && this.toAccountId() !== null && this.accountId() !== this.toAccountId());
  readonly asksFromScope = computed(() => this.betweenAccounts() && this.products().length > 0);
  readonly asksToScope = computed(() => this.betweenAccounts() && this.toProducts().length > 0);
  /** What each end will be saved as: its answer where it is asked, otherwise as always. */
  readonly fromScope = computed<TransferScope>(() => this.asksFromScope() ? this.fromScopeChosen() : 'both');
  readonly toScope = computed<TransferScope>(() => this.asksToScope() ? this.toScopeChosen() : 'both');

  /** The chip's words: the answer, said as a spending's (leaving) or an income's (arriving). */
  scopeChipName(side: 'from' | 'to'): string {
    const scope = side === 'from' ? this.fromScope() : this.toScope();
    return scopeOptionsIn(this.i18n, side === 'from' ? 'expense' : 'income')
      .find(option => option.id === scope)?.name ?? '';
  }

  chooseTransferScope(scope: EntryScope): void {
    if (this.choosingTransferScope() === 'to') this.toScopeChosen.set(scope);
    else this.fromScopeChosen.set(scope);
    this.choosingTransferScope.set(null);
  }

  /** The end being answered, by name, for the sheet's title. */
  readonly transferScopeTitle = computed(() => {
    const side = this.choosingTransferScope();
    if (side === null) return '';
    const account = side === 'to' ? this.toAccount() : this.account();
    return this.i18n.t(side === 'to' ? 'transfer.scope.arriving' : 'transfer.scope.leaving', { account: account?.name ?? '' });
  });

  /**
   * What the transfer does to net worth, worked out from the two answers
   * (`transferEffect`), and one line per end with products saying what
   * happens there - so nobody has to reason it through. Shown whenever an
   * end is asked.
   */
  readonly transferSummary = computed(() => {
    if (!this.asksFromScope() && !this.asksToScope()) return null;
    const out = this.amount().minor;
    const into = this.crossesCurrency() ? this.targetAmount().minor : out;
    const effect = transferEffect({ fromScope: this.fromScope(), toScope: this.toScope(), fromMinor: out, toMinor: into });
    const amount = effect.side === null ? ''
      : this.money(effect.amountMinor, effect.side === 'to' ? this.targetCurrency() : this.currency());
    const title = effect.kind === 'same'
      ? this.i18n.t('transfer.effect.same')
      : this.i18n.t(effect.kind === 'up' ? 'transfer.effect.up' : 'transfer.effect.down', { amount });
    const lines: string[] = [];
    const end = (side: 'from' | 'to') => {
      const account = (side === 'from' ? this.account() : this.toAccount())?.name ?? '';
      const asked = side === 'from' ? this.asksFromScope() : this.asksToScope();
      if (!asked) return;
      const products = side === 'from' ? this.products() : this.toProducts();
      const product = (this.productOf(products, side === 'from' ? this.productId() : this.toProductId()) ?? products[0])?.name ?? '';
      const scope = side === 'from' ? this.fromScope() : this.toScope();
      lines.push(this.i18n.t(`transfer.effect.${side}.${scope}` as TranslationKey, { account, product }));
    };
    end('from');
    end('to');
    if (effect.kind === 'same' && this.fromScope() === 'both' && this.toScope() === 'both') {
      lines.splice(0, lines.length, this.i18n.t('transfer.effect.onlyMoves'));
    }
    return { kind: effect.kind, title, lines };
  });

  /** The answer this person usually gives for the account, category and side. */
  private readonly offerUsualScope = effect(() => {
    const asks = this.asksScope();
    const accountId = this.accountId();
    const categoryId = this.categoryId();
    const kind = this.kind();
    untracked(() => {
      if (!asks || accountId === null || this.scopeTouched || this.database.status() !== 'ready') return;
      const asked = ++this.scopeAsked;
      void usualScope(this.database.driver, { accountId, side: kind === 'income' ? 'in' : 'out', categoryId })
        .then(found => { if (asked === this.scopeAsked && !this.scopeTouched) this.scope.set(found); });
    });
  });

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

  /** The account list's search, emptied whenever the list opens. */
  readonly accountSearch = signal('');
  private readonly clearAccountSearch = effect(() => { if (this.picking() !== null) this.accountSearch.set(''); });

  readonly orderedAccounts = computed(() => {
    const wanted = foldText(this.accountSearch());
    const all = this.accounts().filter(a => wanted === '' || foldText(a.name).includes(wanted));
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
  /** Set when the screen is editing an existing transfer rather than a movement. */
  readonly editingTransferId = signal<number | null>(null);
  /** Notes used before that match what is being typed. */
  readonly noteSuggestions = signal<string[]>([]);

  /**
   * True while the note is being written, which on a phone means the system
   * keyboard is up and has taken the bottom half of the screen - exactly where
   * the note and the suggestions under it were being drawn.
   *
   * While it is on, the foot with Guardar goes away (it cannot help type a
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
   * the foot with Guardar back.
   *
   * On Android the back button closes the keyboard and leaves the focus where
   * it was, so nothing told the form the note was finished and the foot
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

  /**
   * The X (and Escape). While the note is being written it only leaves the
   * note, back to the movement as it was; the next one closes the movement.
   * Tapping the X blurs the note first, so a blur still waiting to land counts
   * as writing too.
   */
  close(): void {
    if (this.writingNote() || this.noteBlurTimer !== null) {
      this.finishNote();
      return;
    }
    this.cancelled.emit();
  }

  startNote(): void {
    if (this.noteBlurTimer !== null) {
      clearTimeout(this.noteBlurTimer);
      this.noteBlurTimer = null;
    }
    this.writingNote.set(true);
    // After the foot has gone and the keyboard has come up.
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
  readonly isEditing = computed(() => this.request().editing !== undefined || this.request().editingEntry !== undefined);
  readonly isTransfer = computed(() =>
    this.kind() === 'transfer' || this.request().editing?.transfer_id != null);

  readonly account = computed(() => this.find(this.accountId()));
  readonly toAccount = computed(() => this.find(this.toAccountId()));

  readonly currency = computed(() => this.account()?.currency_code ?? 'COP');
  readonly targetCurrency = computed(() => this.toAccount()?.currency_code ?? 'COP');

  /** True when the two sides of a transfer are in different currencies. */
  readonly crossesCurrency = computed(() =>
    this.isTransfer() && this.toAccount() !== null && this.currency() !== this.targetCurrency());


  readonly title = computed(() => {
    if (this.betweenProducts() && this.isEditing()) return this.i18n.t('entry.editTransfer');
    if (this.isEditing()) return this.i18n.t(this.isTransfer() ? 'entry.editTransfer' : 'entry.editMovement');
    if (this.isTransfer()) return this.i18n.t('ui.new.transfer');
    return this.i18n.t(this.kind() === 'expense' ? 'entry.newExpense' : 'entry.newIncome');
  });

  readonly selectedCategory = computed(() =>
    this.categories().find(c => c.id === this.categoryId()) ?? null);

  /**
   * How many categories the grid offers before the rest go behind "see all".
   *
   * Four, plus the door to the rest, is exactly one row — and a single row is
   * worth more than the extra coverage a second one buys: it leaves the amount
   * and the amount in view, which is what the screen is for. The four most
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

  /** "Hoy · domingo 27 sept", "Viernes 25 sept" (mockup 1f). */
  readonly dateLabel = computed(() => {
    const iso = this.occurredOn();
    const [year, month, day] = iso.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    const locale = this.i18n.dateLocale();
    const weekday = date.toLocaleDateString(locale, { weekday: 'long' });
    const short = monthName(date, locale).slice(0, 4).replace(/\.$/, '');
    let text = `${weekday} ${day} ${short.length > 3 ? short.slice(0, 4) : short}`;
    if (year !== new Date().getFullYear()) text += ` ${year}`;
    if (iso === todayIso()) return this.i18n.t('ui.today.day', { day: text });
    if (iso === shiftIso(todayIso(), -1)) return this.i18n.t('ui.yesterday.day', { day: text });
    return text.charAt(0).toUpperCase() + text.slice(1);
  });

  /** The chip beside the day: "Ayer" from today, "Hoy" from any other day. */
  readonly quickDayLabel = computed(() =>
    this.i18n.t(this.occurredOn() === todayIso() ? 'period.yesterday' : 'period.today'));

  quickDay(): void {
    this.occurredOn.set(this.occurredOn() === todayIso() ? shiftIso(todayIso(), -1) : todayIso());
  }

  /**
   * What is still missing, in the order it should be fixed.
   *
   * Shown as a prompt rather than left for the user to work out from a greyed
   * button. A disabled control that says nothing is the app refusing without
   * explaining itself.
   */
  private readonly effectiveMinor = computed(() => this.amount().minor);

  readonly missing = computed<string | null>(() => {
    if (this.effectiveMinor() <= 0) return this.i18n.t('entry.need.amount');
    if (this.loanEntry() && this.loanCapital() < 0) return this.i18n.t('loans.pay.tooLittle');
    if (this.accountId() === null) return this.i18n.t('entry.need.account');

    if (this.isTransfer()) {
      if (this.toAccountId() === null) return this.i18n.t('entry.need.destination');
      // One account on both sides is a transfer between two of its products -
      // how a CDT is funded out of the savings beside it. It needs two
      // products to move between, and they have to be different ones.
      if (this.toAccountId() === this.accountId()) {
        if (!this.splitAccount()) return this.i18n.t('entry.need.differentAccounts');
        if (this.productId() === null || this.productId() === this.toProductId()) {
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

  constructor() {
    addIcons(allIcons as unknown as Record<string, string>);
  }

  // ---------------------------------------------------------------------------
  // Move it all (core/yields/holdings.ts; Jose, 2026-09-25)
  // ---------------------------------------------------------------------------

  /** What the side money leaves from holds today; null while unknown or empty. */
  readonly fromHolds = signal<number | null>(null);
  private holdsAsked = 0;

  /**
   * Asked again whenever the transfer's origin changes: the product chosen
   * when the account is split into several, the account's balance otherwise.
   * A card in debt or an empty product offers nothing.
   */
  private readonly readHolds = effect(() => {
    const account = this.accountId();
    const product = this.splitAccount() ? this.productId() : null;
    const loan = this.request().loan;
    const asked = ++this.holdsAsked;
    this.fromHolds.set(null);
    this.holdsNow.set(null);
    if (loan || account === null || this.database.status() !== 'ready') return;
    void whatItHolds(this.database.driver, account, product, todayIso()).then(held => {
      if (asked !== this.holdsAsked) return;
      this.holdsNow.set(held);
      this.fromHolds.set(held > 0 ? held : null);
    });
  });

  /**
   * What the account - or the product chosen in it - holds right now, signed:
   * said under the amount of a new income, and "Gastar todo" on a new spending
   * (Jose, 2026-10-08, as "Pasar todo" does on a transfer). Not on a movement
   * being corrected: its own amount is already inside the figure.
   */
  readonly holdsNow = signal<number | null>(null);

  readonly holdsNowText = computed(() => {
    const held = this.holdsNow();
    if (held === null) return '';
    return `${held < 0 ? '\u2212' : ''}${formatMoney(Math.abs(held), this.currency(), { withSymbol: false })}`;
  });

  /**
   * On a credit card the balance is a debt, so "Saldo actual" says nothing
   * useful (Jose, 2026-10-08): a spending says the credit still available,
   * amber once the amount typed goes past it; an income (a payment, a
   * refund) says what is owed and what is available. A card with no limit
   * on record says only what is owed.
   */
  readonly cardLine = computed<{ owed: string; available: string | null; over: boolean } | null>(() => {
    const account = this.account();
    const held = this.holdsNow();
    if (!account || account.type !== 'credit' || held === null) return null;
    const money = (minor: number) => formatMoney(minor, this.currency(), { withSymbol: false });
    const owed = Math.max(0, -held);
    const limit = account.credit_limit_minor;
    const available = limit === null ? null : limit - owed;
    return {
      owed: money(owed),
      available: available === null ? null : `${available < 0 ? '\u2212' : ''}${money(Math.abs(available))}`,
      over: available !== null && this.kind() === 'expense' && this.amount().minor > available,
    };
  });

  readonly fromHoldsText = computed(() => {
    const held = this.fromHolds();
    return held === null ? '' : formatMoney(held, this.currency(), { withSymbol: false });
  });

  /**
   * The figure "Pasar todo" put in, while it is still the amount. Turning the
   * move around makes it the other side's balance, which may be less - saved
   * like that it could leave the new origin below zero - so it goes back to
   * nothing (Jose, 2026-09-25). An amount typed by hand stays: turning the
   * direction is then all that was meant.
   */
  private filledWithAll: number | null = null;

  /** Clears the amount if it is still the one "Pasar todo" wrote. */
  private forgetFilledAll(): void {
    if (this.filledWithAll !== null && this.amount().minor === this.filledWithAll) {
      this.amount.set(new AmountBuffer());
    }
    this.filledWithAll = null;
  }

  /**
   * What the card a transfer goes to owes, for "Pagar todo" (Jose,
   * 2026-10-08): null when the far end is not a card, owes nothing, or is in
   * another currency (then the arriving figure is typed apart).
   */
  readonly toCardOwes = signal<number | null>(null);
  /** What is left of the card's last statement, when it has dates and differs from the whole debt. */
  readonly toCardBill = signal<number | null>(null);
  private owesAsked = 0;

  private readonly readOwes = effect(() => {
    const to = this.toAccount();
    const transfer = this.isTransfer();
    const asked = ++this.owesAsked;
    this.toCardOwes.set(null);
    this.toCardBill.set(null);
    if (!transfer || !to || to.type !== 'credit' || this.database.status() !== 'ready') return;
    const db = this.database.driver;
    void Promise.all([cardMovements(db, to.id), bankFigures(db)]).then(([movements, typed]) => {
      if (asked !== this.owesAsked) return;
      const statement = cardStatement({
        statementDay: to.statement_day, dueDay: to.due_day, today: todayIso(),
        openingMinor: to.opening_balance_minor, movements, bankFigures: typed.get(to.id),
      });
      this.toCardOwes.set(statement.debtMinor > 0 ? statement.debtMinor : null);
      const bill = ['due', 'partial', 'overdue'].includes(statement.state) ? statement.remainingMinor : 0;
      this.toCardBill.set(bill > 0 && bill !== statement.debtMinor ? bill : null);
    });
  });

  /**
   * The figures the amount can be filled with in one tap, side by side in one
   * row (mockup 18, option A; Jose, 2026-10-08): what the origin holds -
   * "Pasar todo" on a transfer, "Gastar todo" on a new spending - and, into a
   * card, what is left of its statement and its whole debt. The tile whose
   * figure is the amount on show is marked.
   */
  readonly fillTiles = computed<{ key: string; label: string; minor: number; text: string; on: boolean }[]>(() => {
    const tiles: { key: string; label: string; minor: number; currency: string }[] = [];
    const held = this.fromHolds();
    if (this.isTransfer()) {
      if (held !== null) tiles.push({ key: 'all', label: this.i18n.t('products.move.all'), minor: held, currency: this.currency() });
      if (!this.crossesCurrency() && !this.loanEntry()) {
        const bill = this.toCardBill();
        const owes = this.toCardOwes();
        if (bill !== null) tiles.push({ key: 'bill', label: this.i18n.t('ui.entry.payBill'), minor: bill, currency: this.targetCurrency() });
        if (owes !== null) tiles.push({ key: 'debt', label: this.i18n.t('ui.entry.payAll'), minor: owes, currency: this.targetCurrency() });
      }
    } else if (!this.isEditing() && !this.loanEntry() && this.kind() === 'expense' && held !== null) {
      tiles.push({ key: 'spend', label: this.i18n.t('ui.entry.spendAll'), minor: held, currency: this.currency() });
    }
    const amount = this.amount().minor;
    const marked = tiles.find(tile => tile.minor === amount)?.key;
    return tiles.map(tile => ({
      key: tile.key, label: tile.label, minor: tile.minor,
      text: formatMoney(tile.minor, tile.currency, { withSymbol: false }),
      on: tile.key === marked,
    }));
  });

  /** Fills the amount with a tile's figure; "Invertir" clears it again. */
  fillWith(minor: number): void {
    this.amount.set(AmountBuffer.from(minor));
    this.filledWithAll = minor;
  }

  // ---------------------------------------------------------------------------
  // The usual note (core/notes/usual-note.ts; Jose, 2026-09-25)
  // ---------------------------------------------------------------------------

  /**
   * True once the person has written in the note or cleared it: from then on
   * the note is theirs and the app stops offering one.
   */
  private noteIsTheirs = false;
  /** Rises with every question, so a slow answer cannot land on a newer one. */
  private usualNoteAsked = 0;

  /**
   * What the note is written for, as far as the form can say yet: a transfer
   * as soon as it has both accounts, a spending or an income once its
   * category is chosen - before that the account's most common note is too
   * vague to be worth writing.
   */
  private readonly noteContext = computed<NoteContext | null>(() => {
    const from = this.accountId();
    if (from === null) return null;
    if (this.isTransfer()) {
      const to = this.toAccountId();
      if (to === null) return null;
      if (to === from && this.splitAccount()) {
        const fromProduct = this.productId();
        const toProduct = this.toProductId();
        const usual = defaultProduct(this.products());
        if (fromProduct === null || toProduct === null || usual === null) return null;
        return { kind: 'betweenProducts', accountId: from, fromProductId: fromProduct, toProductId: toProduct, usualProductId: usual };
      }
      return { kind: 'transfer', fromAccountId: from, toAccountId: to };
    }
    const category = this.categoryId();
    if (category === null) return null;
    const side = this.kind() === 'income' ? 'in' : 'out';
    // On an account with products the note is read the way the product's own
    // movements are written too: what was said on this product, for this
    // category - entries saved as "Solo el producto" included - and the
    // account's own habit when the product has none (Jose, 2026-10-08: an
    // income on a product offered no note here and did on the other form).
    const product = this.productId();
    const usual = defaultProduct(this.products());
    if (product !== null && usual !== null) {
      return { kind: 'product', accountId: from, productId: product, usualProductId: usual, side, categoryId: category };
    }
    return { kind: 'movement', accountId: from, side, categoryId: category };
  });

  private readonly offerUsualNote = effect(() => {
    const context = this.noteContext();
    if (context === null) return;
    untracked(() => void this.fillUsualNote(context));
  });

  private async fillUsualNote(context: NoteContext): Promise<void> {
    // Never over a movement being corrected, a note carried from another form,
    // or one the person wrote.
    if (this.isEditing() || this.request().start?.note || this.noteIsTheirs) return;
    if (this.database.status() !== 'ready') return;
    const asked = ++this.usualNoteAsked;
    const found = await usualNote(this.database.driver, context, todayIso());
    if (asked !== this.usualNoteAsked || this.noteIsTheirs) return;
    this.note.set(found ?? '');
    this.usualNoteShown.set(found !== null && found !== '');
    const field = this.noteField();
    if (field) field.nativeElement.value = found ?? '';
  }

  /** Undoes the keyboard listener when the form closes. */
  private keyboardClosed: { remove: () => Promise<void> } | null = null;

  ngOnDestroy(): void {
    void this.keyboardClosed?.remove();
  }

  ngOnInit(): void {
    this.autofocusAmount.set(!this.isEditing() && !this.request().loan);
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
    await this.loadProducts();
    const editing = this.request().editing;
    if (editing) {
      this.loanPayment.set(await new LoansRepository(this.database.driver)
        .paymentOf({ transferId: this.editingTransferId(), transactionId: editing.id }));
    }
  }

  /** The loan payment the movement being corrected belongs to: deleting it undoes the whole payment. */
  readonly loanPayment = signal<{ id: number; loanName: string; kind: 'installment' | 'extra' | 'payoff'; number: number | null } | null>(null);

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

    const entry = this.request().editingEntry;
    if (entry) {
      this.amount.set(AmountBuffer.from(Math.abs(entry.amount_minor)));
      this.categoryId.set(entry.category_id);
      this.accountId.set(entry.account_id);
      this.productId.set(entry.product_id);
      this.occurredOn.set(entry.on_date);
      this.note.set(entry.note ?? '');
      this.scopeWhenOpened = 'product';
      this.scopeTouched = true;
      this.scope.set('product');
      return;
    }

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
      // Its answer, as its rows say it: a movement with its other half on a
      // product is "net worth alone", any other one "both".
      this.scopeWhenOpened = await scopeOfMovement(this.database.driver, editing.id);
      this.scopeTouched = true;
      this.scope.set(this.scopeWhenOpened);
      return;
    }

    if (this.isTransfer()) {
      const given = this.request().route;
      const exists = (id: number) => accounts.some(account => account.id === id);
      if (given && exists(given.from) && exists(given.to)) {
        this.accountId.set(given.from);
        this.toAccountId.set(given.to);
        // Read by loadProducts as the products already on screen.
        this.productId.set(given.fromProductId ?? null);
        this.toProductId.set(given.toProductId ?? null);
        // Products given are kept; with none, the route this account's money
        // usually takes between its products is chosen (loadProducts).
        this.routeSet = given.fromProductId != null || given.toProductId != null;
      } else {
        const route = await this.defaultRoute(accounts);
        this.accountId.set(route.from);
        this.toAccountId.set(route.to);
      }
    } else {
      this.accountId.set(await this.defaultAccount(accounts));
    }

    const start = this.request().start;
    if (start) {
      if (start.amountMinor > 0) this.amount.set(AmountBuffer.from(start.amountMinor));
      this.occurredOn.set(start.onDate);
      this.note.set(start.note);
      if (start.again) this.again.set(true);
    }
    const loan = this.request().loan;
    if (loan) {
      this.loanInterest.set(AmountBuffer.from(loan.interestMinor));
      this.loanInsurance.set(AmountBuffer.from(loan.insuranceMinor));
      this.loanMode.set(loan.mode ?? 'term');
    }
  }

  // ---------------------------------------------------------------------------
  // A loan's payment (debts, part 2; mockups 13g, 13h, 13o, 13r)
  // ---------------------------------------------------------------------------

  /** The loan this payment is for, while it still goes into that loan. */
  readonly loanEntry = computed(() => {
    const loan = this.request().loan ?? null;
    return loan && this.isTransfer() && this.toAccountId() === loan.accountId ? loan : null;
  });
  readonly loanInterest = signal(new AmountBuffer());
  readonly loanInsurance = signal(new AmountBuffer());
  readonly loanLate = signal(new AmountBuffer());
  readonly loanMode = signal<'term' | 'installment'>('term');
  /** A loan in UVR: how much the UVR moved the debt by the payment's day; written with the payment. */
  readonly loanUvrAdjust = signal(0);
  private readonly readUvrAdjust = effect(() => {
    const loan = this.loanEntry();
    const day = this.occurredOn();
    if (!loan || this.database.status() !== 'ready') { untracked(() => this.loanUvrAdjust.set(0)); return; }
    void new LoansRepository(this.database.driver).uvrAdjustment(loan.accountId, day)
      .then(amount => this.loanUvrAdjust.set(amount)).catch(() => this.loanUvrAdjust.set(0));
  });
  /** What is left for the capital once interest, insurance and default interest are taken. */
  readonly loanCapital = computed(() =>
    this.effectiveMinor() - this.loanInterest().minor - this.loanInsurance().minor - this.loanLate().minor);

  onLoanFigure(which: 'interest' | 'insurance' | 'late', text: string): void {
    const buffer = new AmountBuffer();
    for (const character of text) {
      if (/[0-9]/.test(character)) buffer.push(character);
      else if (character === ',') buffer.separator();
    }
    (which === 'interest' ? this.loanInterest : which === 'insurance' ? this.loanInsurance : this.loanLate).set(buffer);
  }

  private async saveLoanPayment(loan: LoanEntry): Promise<void> {
    await new LoansRepository(this.database.driver).recordPayment({
      loanAccountId: loan.accountId,
      fromAccountId: this.accountId()!,
      kind: loan.kind,
      number: loan.number,
      paidOn: this.occurredOn(),
      capitalMinor: this.loanCapital(),
      interestMinor: this.loanInterest().minor,
      insuranceMinor: this.loanInsurance().minor,
      lateMinor: this.loanLate().minor,
      extraMode: loan.kind === 'extra' ? this.loanMode() : null,
      note: this.note().trim() || null,
      interestCategory: this.i18n.t('loans.category.interest'),
      insuranceCategory: this.i18n.t('loans.category.insurance'),
      uvrCategory: this.i18n.t('loans.category.uvr'),
    });
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
    // Each end as it stands, a leg or a product's own entry (migration 056).
    this.accountId.set(found.fromEnd.account_id);
    this.nearLegProductId = found.fromEnd.product_id ?? null;
    this.farLegProductId = found.toEnd.product_id ?? null;
    this.toAccountId.set(found.toEnd.account_id);
    this.amount.set(AmountBuffer.from(found.fromEnd.amount_minor));
    this.targetAmount.set(AmountBuffer.from(found.toEnd.amount_minor));
    this.fromScopeChosen.set(found.fromEnd.scope);
    this.toScopeChosen.set(found.toEnd.scope);
    this.occurredOn.set(found.transfer.occurred_on);
    this.note.set(found.transfer.description ?? found.from?.description ?? found.to?.description ?? '');
  }

  /**
   * Which way a transfer should point before anyone chooses.
   *
   * On the summary screen the account on show is where the money is going:
   * opening a transfer while looking at the credit card means paying that
   * card, not taking money out of it. (The products screen asks the other way
   * round, with `preferredSide: 'from'`.) So the destination is settled, and the only open question is
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
      // Leaving it: to wherever this account sends money most often.
      if (this.request().preferredSide === 'from') {
        return { from: selected, to: await this.counterpart(accounts, selected, 'from') };
      }
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
    this.noteIsTheirs = true;
    this.usualNoteShown.set(false);
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
    this.noteIsTheirs = true;
    this.note.set('');
    this.usualNoteShown.set(false);
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


  useNote(note: string, pressed?: Event): void {
    pressed?.preventDefault();
    this.noteIsTheirs = true;
    this.note.set(note);
    this.noteSuggestions.set([]);
    this.noteQuery++;
    // The tap blurred the note; the person is still writing it.
    this.startNote();
  }

  /**
   * The computer's keyboard: Escape closes, and Enter saves while no field
   * has the cursor. A digit typed with the cursor nowhere goes into the
   * amount, which takes the cursor from there - correcting a backlog of
   * movements on a computer should not need the mouse between each one.
   *
   * Typing inside any field is left to the field: in the note, digits are text.
   */
  @HostListener('document:keydown', ['$event'])
  onKey(event: KeyboardEvent): void {
    if (event.defaultPrevented || event.ctrlKey || event.altKey || event.metaKey) return;

    const target = event.target as HTMLElement | null;
    const typingText = target?.closest('ion-input, ion-searchbar, input, textarea') !== null;

    if (event.key === 'Escape') {
      event.preventDefault();
      this.close();
      return;
    }

    // A picker or a sheet is open: it owns the keyboard.
    if (this.picking() !== null || this.showDate() || this.browsingCategories()) return;

    if (typingText) return;

    if (event.key === 'Enter') {
      event.preventDefault();
      if (this.canSave()) void this.save();
      return;
    }

    if (/^[0-9]$/.test(event.key)) {
      event.preventDefault();
      const next = this.amount().copy();
      next.push(event.key);
      this.setAmount(next, false);
      this.amountField()?.focus();
    }
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
    // Another account is another question: back to what a transfer always was.
    (toSide ? this.toScopeChosen : this.fromScopeChosen).set('both');
    await this.loadProducts();

    // Landing on the same account on both sides is a transfer between two of
    // its products, which is a real thing to want. Only an account with a
    // single product cannot do it, and there the other side moves to wherever
    // this one usually sends. Moving it in every case was what made editing a
    // transfer between products impossible: choosing the account it comes out
    // of changed the account it goes to.
    if (this.isTransfer() && this.toAccountId() === this.accountId() && this.products().length < 2) {
      const other = await this.counterpart(this.accounts(), id, toSide ? 'to' : 'from');
      if (toSide) this.accountId.set(other);
      else this.toAccountId.set(other);
      await this.loadProducts();
    }

    // Straight on to the product, when the account has more than one. The
    // sheet stays open and changes what it is asking; anything else means
    // reopening it to answer the obvious follow-up.
    const side = this.picking() === 'to' ? this.toProducts() : this.products();
    const account = this.picking() === 'to' ? this.toAccount() : this.account();
    this.productSide.set(this.picking());
    this.picking.set(null);

    // Straight on to the product when the account has more than one, in a
    // sheet of its own: the follow-up is obvious enough that making it be
    // asked for is worse than asking it.
    if (side.length > 1 && account) this.pickingProduct.set(account);
  }

  swapAccounts(): void {
    this.forgetFilledAll();
    const from = this.accountId();
    this.accountId.set(this.toAccountId());
    this.toAccountId.set(from);

    // The products swap with them: on one account they are the whole of what
    // the two sides are, and leaving them put would turn the transfer around
    // without turning it around.
    const fromProduct = this.productId();
    const fromProducts = this.products();
    this.productId.set(this.toProductId());
    this.products.set(this.toProducts());
    this.toProductId.set(fromProduct);
    this.toProducts.set(fromProducts);
    // Each end keeps its answer as it changes sides: the three answers are
    // the same at both ends, said as a spending's or an income's.
    const fromScope = this.fromScopeChosen();
    this.fromScopeChosen.set(this.toScopeChosen());
    this.toScopeChosen.set(fromScope);
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
      const loan = this.loanEntry();
      if (loan) await this.saveLoanPayment(loan);
      else if (this.isTransfer()) await this.saveTransfer();
      else if (this.request().editingEntry) await this.saveEntry(this.request().editingEntry!);
      else if (this.request().editing && this.reshapes()) await this.saveReshaped();
      else if (!this.request().editing && this.asksScope() && this.scope() !== 'both') await this.saveScoped();
      else await this.saveMovement();

      await this.workOutAgain();
      this.database.dataChanged();
      if (this.again() && !this.isEditing()) {
        this.startNext();
        this.toast.say(this.i18n.t('entry.again.saved'), 2500);
      } else {
        this.saved.emit();
      }
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : String(error));
    } finally {
      this.saving.set(false);
    }
  }

  /**
   * The next movement, after one saved with "Registrar otro" on: the same
   * kind, account, products and day; the amount, the category and the note
   * empty, and the cursor back in the amount.
   */
  private startNext(): void {
    this.amount.set(new AmountBuffer());
    this.targetAmount.set(new AmountBuffer());
    this.editingTarget.set(false);
    if (!this.isTransfer()) this.categoryId.set(null);
    this.noteIsTheirs = false;
    this.usualNoteShown.set(false);
    this.note.set('');
    const field = this.noteField();
    if (field) field.nativeElement.value = '';
    this.error.set('');
    this.amountField()?.focus();
    // The next one asks the habit again, once its category is chosen.
    this.scopeTouched = false;
    this.scope.set(DEFAULT_SCOPE);
  }

  /**
   * Reads the products of whichever account is in play.
   *
   * Called on load and whenever the account changes, because the answer is
   * only ever about that account - switching from Dale to Nequi replaces the
   * whole question, and keeping the old choice would file a movement against
   * a product belonging to somewhere else.
   */
  private async loadProducts(): Promise<void> {
    if (this.database.status() !== 'ready') return;
    const yields = new YieldsRepository(this.database.driver);

    // The product already on screen wins when it still belongs to the account.
    // Resetting both sides to the default on every account pick was what made
    // the far side move by itself: choosing Plata again for "from" put "from"
    // back on its first product and pushed "to" off it.
    const read = async (accountId: number | null, currentId: number | null, storedId: number | null) => {
      if (accountId === null) return { products: [] as YieldProduct[], chosen: null };
      const products = await yields.products(accountId);
      const known = (id: number | null) => id !== null && products.some(product => product.id === id);
      const chosen = known(currentId) ? currentId : known(storedId) ? storedId : defaultProduct(products);
      return { products, chosen };
    };

    const editing = this.request().editing;
    const entry = this.request().editingEntry;
    const storedFor = (accountId: number | null) =>
      editing && editing.account_id === accountId ? editing.product_id ?? null
        : entry && entry.account_id === accountId ? entry.product_id ?? null : null;

    // A transfer between two products of one account has the same account on
    // both legs, so which leg a stored product belongs to cannot be told from
    // the account alone: each leg's product is remembered as it was read.
    const nearStored = this.editingTransferId() !== null
      ? this.nearLegProductId
      : storedFor(this.accountId());
    const here = await read(this.accountId(), this.productId(), nearStored);
    this.products.set(here.products);
    this.productId.set(here.chosen);

    // A transfer moves between two products as much as between two accounts,
    // and they are asked for separately because they are separate questions -
    // the far account's savings product is not this one's.
    const far = this.isTransfer()
      ? await read(this.toAccountId(), this.toProductId(), this.farLegProduct())
      : { products: [] as YieldProduct[], chosen: null };
    // Both sides on one account: the far side starts on a different product,
    // because money does not move from a product to itself.
    const farChosen = this.toAccountId() === this.accountId() && far.chosen === here.chosen
      ? far.products.find(product => product.id !== here.chosen)?.id ?? far.chosen
      : far.chosen;
    this.toProducts.set(far.products);
    this.toProductId.set(farChosen);

    // Between two products of one account: the route this account's money
    // most often takes, for a new move - from a product that is not the usual
    // one into the one it most often goes to (as the product form starts).
    if (this.isTransfer() && this.accountId() !== null && this.toAccountId() === this.accountId()
        && here.products.length > 1) {
      await this.readRoutePairs(this.accountId()!, here.products);
      if (this.editingTransferId() === null && !this.routeSet) {
        this.routeSet = true;
        const usual = defaultProduct(here.products);
        const best = this.routePairs().find(pair => pair.from !== usual);
        if (best) {
          this.productId.set(best.from);
          this.toProductId.set(best.to);
        } else if (usual !== null) {
          const other = here.products.find(product => product.id !== usual)?.id ?? null;
          if (other !== null) { this.productId.set(other); this.toProductId.set(usual); }
        }
      }
    } else {
      this.routePairs.set([]);
    }
  }

  /** The route between products is chosen once; after that the person's choices stand. */
  private routeSet = false;

  /** The products recorded on each leg of the transfer being corrected. */
  private nearLegProductId: number | null = null;
  private farLegProductId: number | null = null;

  private farLegProduct(): number | null {
    return this.farLegProductId;
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
  readonly pickingProduct = signal<AccountRow | null>(null);

  /**
   * Which side the PRODUCT sheet is asking about.
   *
   * Its own signal, not the one that opens the account sheet. That one means
   * "the accounts are open", and the product sheet was reading it to know
   * which side it was for - so opening the products straight from the form
   * had to set it, and setting it opened the whole list of accounts behind
   * them. Two questions were sharing one answer.
   */
  readonly productSide = signal<'from' | 'to' | null>(null);

  /** The product's own name, for the line under the account. */
  productName(products: readonly YieldProduct[], id: number | null): string {
    return products.find(product => product.id === id)?.name ?? '';
  }

  /** Answers the second step and closes the sheet. */
  chooseProduct(id: number): void {
    const toSide = this.productSide() === 'to';
    if (toSide) this.toProductId.set(id);
    else this.productId.set(id);

    // Between two products of one account the other side cannot be this same
    // one, so it moves - to the product the route most often uses with the one
    // just chosen (Jose, 2026-09-28), and failing that to another. The side
    // just chosen is never the one that moves. Everything that follows the
    // ends follows it too: the usual note and "Pasar todo".
    if (this.betweenProducts()) {
      const other = toSide ? this.productId() : this.toProductId();
      if (other === id) {
        const next = this.partnerOf(id, toSide ? 'to' : 'from');
        if (toSide) this.productId.set(next);
        else this.toProductId.set(next);
      }
    }

    this.pickingProduct.set(null);
  }

  pickProductTo(id: number): void {
    this.toProductId.set(id);
  }

  pickProduct(id: number): void {
    this.productId.set(id);
  }

  /** Closing it drops the second step too, so it reopens at the account. */
  closeAccountSheet(): void {
    this.pickingProduct.set(null);
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
    this.productSide.set(which);
    const side = which === 'to' ? this.toAccount() : this.account();
    const products = which === 'to' ? this.toProducts() : this.products();
    this.pickingProduct.set(this.betweenProducts() && side && products.length > 1 ? side : null);
  }

  /** From the products back to the accounts, for the side being chosen. */
  chooseAnotherAccount(): void {
    // Back to the accounts, for the side the products were being chosen for.
    this.picking.set(this.productSide());
    this.pickingProduct.set(null);
  }

  /**
   * The products of one side, without asking about the account again.
   *
   * Changing only the product meant picking the account a second time so the
   * sheet would follow with its products - a step that answered a question
   * nobody had asked. The product line is its own button now.
   */
  openProductSheet(which: 'from' | 'to'): void {
    const side = which === 'to' ? this.toAccount() : this.account();
    if (!side) return;
    // The products alone. The account has its own button above them, and
    // opening its sheet here only ever put it behind these.
    this.productSide.set(which);
    this.pickingProduct.set(side);
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
        product_id: this.splitAccount() ? this.productId() : null,
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
      product_id: this.splitAccount() ? this.productId() : null,
      occurred_on: this.occurredOn(),
      amount_minor: signed,
      description: this.note().trim() || null,
      source: 'manual',
    });
  }

  /**
   * A new income or spending that is not an ordinary movement: the product's
   * alone, or net worth alone. Written as the products screen writes it, and
   * the account's days worked out again from its date, as that screen does.
   */
  private async saveScoped(): Promise<void> {
    const db = this.database.driver;
    const yields = new YieldsRepository(db);
    const accountId = this.accountId()!;
    await db.transaction(async () => {
      await writeScoped(db, yields, {
        scope: this.scope(),
        kind: this.kind() === 'expense' ? 'expense' : 'income',
        accountId,
        categoryId: this.categoryId(),
        productId: this.productId(),
        movementProductId: this.splitAccount() ? this.productId() : null,
        onDate: this.occurredOn(),
        amountMinor: this.amount().minor,
        note: this.note().trim() || null,
      });
      await yields.clearDays(accountId, this.occurredOn());
    });
    await accrueAndSettle(db, yields, new TaxParametersRepository(db), accountId, todayIso());
    await yields.markAccrued(todayIso(), { onlyIfKnown: true });
  }

  /**
   * Whether a correction changes the movement's shape: another answer to
   * "¿Qué cambia?", an account without products where a product half was
   * kept, or "net worth alone" turned from income to spending (its half is
   * a cash-out one way and an entry the other). Otherwise the row is
   * patched, and `TransactionsRepository.update` keeps its half in step.
   */
  private reshapes(): boolean {
    const editing = this.request().editing;
    if (!editing || this.scopeWhenOpened === null) return false;
    const now: EntryScope = this.asksScope() ? this.scope() : 'both';
    if (now !== this.scopeWhenOpened) return true;
    const wasIncome = editing.amount_minor > 0;
    return now === 'netWorth' && wasIncome !== (this.kind() === 'income');
  }

  /**
   * A correction into another shape is written again from scratch, as the
   * products screen does: the movement and its half go, the new shape is
   * written, and both accounts' days are worked out again from the earlier
   * date.
   */
  private async saveReshaped(): Promise<void> {
    const editing = this.request().editing!;
    const db = this.database.driver;
    const yields = new YieldsRepository(db);
    const accountId = this.accountId()!;
    const from = editing.occurred_on < this.occurredOn() ? editing.occurred_on : this.occurredOn();
    await db.transaction(async () => {
      await rewriteScoped(db, yields, editing.id, {
        scope: this.asksScope() ? this.scope() : 'both',
        kind: this.kind() === 'expense' ? 'expense' : 'income',
        accountId,
        categoryId: this.categoryId(),
        productId: this.productId(),
        movementProductId: this.splitAccount() ? this.productId() : null,
        onDate: this.occurredOn(),
        amountMinor: this.amount().minor,
        note: this.note().trim() || null,
      });
      await yields.clearDays(accountId, from);
      if (editing.account_id !== accountId) await yields.clearDays(editing.account_id, editing.occurred_on);
    });
    const tax = new TaxParametersRepository(db);
    await accrueAndSettle(db, yields, tax, accountId, todayIso());
    if (editing.account_id !== accountId) await accrueAndSettle(db, yields, tax, editing.account_id, todayIso());
    await yields.markAccrued(todayIso(), { onlyIfKnown: true });
  }

  /**
   * A product's own movement corrected. Kept as "Solo el producto", the row is
   * patched; another answer writes it again in its new shape, as any
   * correction into another shape is.
   */
  private async saveEntry(entry: ProductEntry): Promise<void> {
    const db = this.database.driver;
    const yields = new YieldsRepository(db);
    const accountId = this.accountId()!;
    const kind = this.kind() === 'expense' ? 'expense' : 'income';
    const scope: EntryScope = this.asksScope() ? this.scope() : 'both';
    await db.transaction(async () => {
      if (scope === 'product' && accountId === entry.account_id) {
        await yields.updateAdjustment(entry.id, {
          on_date: this.occurredOn(),
          amount_minor: kind === 'expense' ? -this.amount().minor : this.amount().minor,
          kind: 'other',
          category_id: this.categoryId(),
          product_id: this.productId(),
          note: this.note().trim() || null,
        });
      } else {
        await yields.removeAdjustment(entry.id);
        await writeScoped(db, yields, {
          scope, kind, accountId,
          categoryId: this.categoryId(),
          productId: this.productId(),
          movementProductId: this.splitAccount() ? this.productId() : null,
          onDate: this.occurredOn(),
          amountMinor: this.amount().minor,
          note: this.note().trim() || null,
        });
      }
    });
    this.touched.push({ accountId: entry.account_id, from: entry.on_date });
  }

  /**
   * Every account with products a save touched, from the earliest day it
   * touched: those days are worked out again at once, as the products screen
   * always did after its own form saved - so its figures are right the moment
   * the form closes, whichever screen it was opened from.
   */
  private touched: { accountId: number; from: string }[] = [];

  private async workOutAgain(): Promise<void> {
    const ends = [
      { accountId: this.accountId(), products: this.products().length },
      { accountId: this.isTransfer() ? this.toAccountId() : null, products: this.toProducts().length },
    ];
    for (const end of ends) {
      if (end.accountId !== null && end.products > 0) this.touched.push({ accountId: end.accountId, from: this.occurredOn() });
    }
    const editing = this.request().editing;
    if (editing && this.touched.some(one => one.accountId === editing.account_id)) {
      this.touched.push({ accountId: editing.account_id, from: editing.occurred_on });
    }
    const earliest = new Map<number, string>();
    for (const one of this.touched) {
      const seen = earliest.get(one.accountId);
      if (seen === undefined || one.from < seen) earliest.set(one.accountId, one.from);
    }
    this.touched = [];
    if (earliest.size === 0) return;
    const db = this.database.driver;
    const yields = new YieldsRepository(db);
    const tax = new TaxParametersRepository(db);
    for (const [accountId, from] of earliest) {
      await yields.clearDays(accountId, from);
      await accrueAndSettle(db, yields, tax, accountId, todayIso());
    }
    await yields.markAccrued(todayIso(), { onlyIfKnown: true });
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
        product_id: this.splitAccount() ? this.productId() : null,
        amount_minor: out,
        scope: this.fromScope(),
      },
      to: {
        account_id: this.toAccountId()!,
        product_id: this.splitTarget() ? this.toProductId() : null,
        amount_minor: into,
        rate_scaled: rateScaled,
        amount_base_minor: this.crossesCurrency() ? out : undefined,
        rate_source: rateScaled === null ? null : ('derived' as const),
        scope: this.toScope(),
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

  // ---------------------------------------------------------------------------
  // The redesign's drawing (mockups 1f-1n, 4t01-4t13)
  // ---------------------------------------------------------------------------

  private readonly accent = inject(AccentService);
  readonly accentColor = computed(() => this.accent.accent().color);

  /** The one form, opened again for another kind with what was written. */
  switchKind(kind: EntryKind): void {
    if (this.isEditing()) return;
    const current = this.isTransfer() ? 'transfer' : this.kind();
    if (kind === current) return;
    this.switchTo.emit({
      kind,
      preferredAccountId: this.accountId() ?? this.request().preferredAccountId,
      preferredSide: kind === 'transfer' ? 'from' : undefined,
      start: {
        amountMinor: this.amount().minor,
        onDate: this.occurredOn(),
        note: this.noteIsTheirs ? this.note() : '',
        again: this.again(),
      },
    });
  }

  /** A note used before, split around what is being typed, to underline it (1g). */
  hintParts(hint: string): [string, string, string] {
    const typed = this.note().trim();
    if (typed === '') return [hint, '', ''];
    const at = hint.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
      .indexOf(typed.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase());
    if (at < 0 || hint.length !== hint.normalize('NFD').replace(/[\u0300-\u036f]/g, '').length) return [hint, '', ''];
    return [hint.slice(0, at), hint.slice(at, at + typed.length), hint.slice(at + typed.length)];
  }

  /** "Desde" where money leaves, "Hacia" where it arrives. */
  sideLabel(side: 'from' | 'to'): string {
    if (side === 'to' || (!this.isTransfer() && this.kind() === 'income')) return this.i18n.t('ui.side.to');
    return this.i18n.t('entry.from');
  }

  productOf(products: readonly YieldProduct[], id: number | null): YieldProduct | null {
    return products.find(product => product.id === id) ?? null;
  }

  faceOf(product: YieldProduct): string {
    return productIcon(product);
  }

  seedOf(product: YieldProduct): number {
    return productSeed(product);
  }

  /** What an (i) beside a product says, when there is something to say. */
  productNote(side: 'from' | 'to'): string | null {
    const product = side === 'to'
      ? this.productOf(this.toProducts(), this.toProductId())
      : this.productOf(this.products(), this.productId());
    if (!product || !this.isTransfer()) return null;
    if (product.include_in_net_worth === 0) return this.i18n.t('ui.info.setAside');
    if (product.kind === 'cdt') return this.i18n.t('ui.info.cdt');
    if (this.betweenProducts() && side === 'to') return this.i18n.t('ui.info.betweenProducts');
    return null;
  }

  readonly info = signal<string | null>(null);

  showInfo(text: string): void {
    this.info.set(text);
  }

  /** "tasa 3.935,15": the rate the two amounts of a transfer imply. */
  readonly rateText = computed(() => {
    const out = this.amount().minor;
    const into = this.targetAmount().minor;
    if (out <= 0 || into <= 0) return '';
    const rate = out >= into ? out / into : into / out;
    return this.i18n.t('ui.rate', {
      rate: rate.toLocaleString(this.i18n.dateLocale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    });
  });

  /** True while the note on show is the usual one the app wrote. */
  readonly usualNoteShown = signal(false);

  /** What each account holds, for the account list. */
  private readonly accountBalances = signal<ReadonlyMap<number, { balance: number; available: number | null }>>(new Map());

  private readonly readBalances = effect(() => {
    if (this.picking() === null || this.database.status() !== 'ready') return;
    void untracked(async () => {
      const rows = await new AccountsRepository(this.database.driver).balances();
      this.accountBalances.set(new Map(rows.map(row =>
        [row.account.id, { balance: row.balance_minor, available: row.available_credit_minor }])));
    });
  });

  balanceLine(account: AccountRow): string {
    const held = this.accountBalances().get(account.id);
    if (!held) return account.currency_code;
    const money = (minor: number) => formatMoney(minor, account.currency_code, { withSymbol: false });
    const suffix = account.currency_code === 'COP' ? '' : ` ${account.currency_code}`;
    if (account.type === 'credit' && held.available !== null) {
      return this.i18n.t('ui.picker.available', { amount: money(held.available) }) + suffix;
    }
    return money(held.balance) + suffix;
  }

  /** What each product of the sheet on show holds today. */
  private readonly productHoldings = signal<ReadonlyMap<number, number>>(new Map());

  private readonly readProductHoldings = effect(() => {
    const account = this.pickingProduct();
    if (account === null || this.database.status() !== 'ready') return;
    const list = this.productSide() === 'to' ? this.toProducts() : this.products();
    void untracked(async () => {
      const held = new Map<number, number>();
      for (const product of list) {
        held.set(product.id, await whatItHolds(this.database.driver, account.id, product.id, todayIso()));
      }
      this.productHoldings.set(held);
    });
  });

  productLine(product: YieldProduct): string {
    const held = this.productHoldings().get(product.id);
    const currency = this.pickingProduct()?.currency_code ?? this.currency();
    const figure = held === undefined ? '' : formatMoney(held, currency, { withSymbol: false });
    if (product.is_default === 1) {
      return figure ? `${this.i18n.t('entry.product.usual')} · ${figure}` : this.i18n.t('entry.product.usual');
    }
    return figure;
  }

  /** "Sale de · Ahorro Verde", "Entra a · Ahorro Verde". */
  readonly productSheetTitle = computed(() => {
    const account = this.pickingProduct()?.name ?? '';
    const into = this.productSide() === 'to' || (!this.isTransfer() && this.kind() === 'income');
    return `${this.i18n.t(into ? 'entry.product.into' : 'entry.product.from')} · ${account}`;
  });

  readonly deleteBody = computed(() => {
    const payment = this.loanPayment();
    if (payment) {
      return payment.kind === 'installment' && payment.number !== null
        ? this.i18n.t('loans.delete.installment', { number: payment.number, loan: payment.loanName })
        : this.i18n.t('loans.delete.extra', { loan: payment.loanName });
    }
    if (this.betweenProducts()) {
      return this.i18n.t('entry.deleteTransfer.hintProducts', { account: this.account()?.name ?? '' });
    }
    if (this.isTransfer()) {
      return `${this.i18n.t('entry.deleteTransfer.hint', {
        from: this.account()?.name ?? '', to: this.toAccount()?.name ?? '' })} ${this.i18n.t('entry.delete.body')}`;
    }
    return this.i18n.t('entry.delete.body');
  });

  /**
   * How often money has moved from each product of this account to each
   * other one: the account's own moves between its products, a leg naming no
   * product being the usual one's.
   */
  private readonly routePairs = signal<{ from: number; to: number; times: number }[]>([]);

  private async readRoutePairs(accountId: number, products: readonly YieldProduct[]): Promise<void> {
    const usual = (products.find(product => product.is_default === 1) ?? products[0])?.id ?? null;
    if (usual === null) { this.routePairs.set([]); return; }
    const rows = await this.database.driver.query<{ from_id: number | null; to_id: number | null; times: number }>(
      `SELECT f.product_id AS from_id, t.product_id AS to_id, COUNT(*) AS times
       FROM transactions f
       JOIN transactions t ON t.transfer_id = f.transfer_id AND t.id <> f.id
       WHERE f.account_id = ? AND t.account_id = f.account_id AND f.transfer_leg = 'from'
       GROUP BY f.product_id, t.product_id
       ORDER BY times DESC`, [accountId]);
    const exists = (id: number) => products.some(product => product.id === id);
    this.routePairs.set(rows
      .map(row => ({ from: row.from_id ?? usual, to: row.to_id ?? usual, times: row.times }))
      .filter(pair => pair.from !== pair.to && exists(pair.from) && exists(pair.to)));
  }

  /**
   * The product the other end most often is, when `id` sits on `side`: where
   * money from it usually goes, or where money into it usually comes from.
   * With no history, the usual product, or the first other one.
   */
  private partnerOf(id: number, side: 'from' | 'to'): number | null {
    const found = this.routePairs()
      .filter(pair => (side === 'from' ? pair.from : pair.to) === id)
      .sort((a, b) => b.times - a.times)[0];
    if (found) return side === 'from' ? found.to : found.from;
    const usual = this.products().find(product => product.is_default === 1)?.id ?? null;
    if (usual !== null && usual !== id) return usual;
    return this.products().find(product => product.id !== id)?.id ?? null;
  }

  /** Open while the delete is being confirmed. Nothing is gone until it is. */
  readonly confirmingDelete = signal(false);

  /**
   * What the dialog asks, which is not the same question for a transfer.
   *
   * Deleting one leg of a transfer would leave money arriving from nowhere,
   * so both go - and the person about to tap it should be told that before,
   * not discover it after.
   */
  readonly deleteTitle = computed(() =>
    this.i18n.t(this.isTransfer() ? 'entry.deleteTransfer.ask' : 'entry.deleteMovement.ask'));

  askToDelete(): void {
    if (this.isEditing()) this.confirmingDelete.set(true);
  }

  async remove(): Promise<void> {
    const editing = this.request().editing;
    const entry = this.request().editingEntry;
    if (!editing && !entry) return;
    this.confirmingDelete.set(false);

    this.saving.set(true);
    try {
      if (entry) {
        await new YieldsRepository(this.database.driver).removeAdjustment(entry.id);
        this.touched.push({ accountId: entry.account_id, from: entry.on_date });
        await this.workOutAgain();
        this.database.dataChanged();
        this.saved.emit();
        return;
      }
      if (!editing) return;
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
function defaultProduct(products: readonly YieldProduct[]): number | null {
  const usual = products.find(product => product.is_default === 1);
  return (usual ?? products[0])?.id ?? null;
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

function shiftIso(iso: string, days: number): string {
  const [year, month, day] = iso.split('-').map(Number);
  const date = new Date(year, month - 1, day + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
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

