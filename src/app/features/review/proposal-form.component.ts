/**
 * One proposal, checked in the shape of the movement form (mockups 6e-6h):
 * what the statement said on top, its keypad for the amount, the account,
 * the category, the day and the note - the same note as every other screen,
 * rising while it is written with the notes used before under it, plus what
 * the statement said, to keep it as it came.
 *
 * Nothing is written until "Guardar": then the corrections go onto the
 * proposal and the proposal is accepted, exactly as the review screen's own
 * "save" does (rule 22: never written without that answer). The bin in the
 * title bar is "Descartar", asked first by the screen that opened this.
 */

import { Component, ElementRef, computed, inject, input, output, signal, viewChild, type OnInit } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { IonIcon, IonModal, IonDatetime } from '@ionic/angular';

import { DatabaseService } from '../../core/database/database.service';
import { TransactionsRepository } from '../../core/database/repositories/transactions.repository';
import type { MovementProposal } from '../../core/database/repositories/proposals.repository';
import type { AccountRow, CategoryRow } from '../../core/database/types';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { monthName } from '../../core/filters/period';
import { formatMoney } from '../../core/database/money';
import { AmountBuffer } from '../entry/amount-buffer';
import { apply, isOperator, type Operator, type Pending } from '../entry/calculator';
import { BadgeComponent } from '../../shared/ui/badge.component';
import { AccountPickerComponent } from '../../shared/account-picker/account-picker.component';
import { CategorySheetComponent } from '../../shared/category-sheet/category-sheet.component';

/** What the form hands back: the corrections to make before accepting. */
export interface ProposalAnswer {
  account_id: number | null;
  occurred_on: string | null;
  amount_minor: number | null;
  description: string | null;
  category_id: number | null;
}

import { KeypadComponent } from '../../shared/ui/keypad.component';
import { AutoGrowDirective } from '../../shared/ui/auto-grow.directive';
@Component({
  selector: 'app-proposal-form',
  standalone: true,
  imports: [NgTemplateOutlet, TranslatePipe, BadgeComponent, AccountPickerComponent, CategorySheetComponent, IonIcon, IonModal, IonDatetime, KeypadComponent, AutoGrowDirective],
  styleUrls: ['../entry/entry.component.scss'],
  styles: [`
    .said {
      display: flex; align-items: center; gap: 8px; padding: 9px 12px; border-radius: 14px;
      border: 1px dashed var(--app-s3); color: var(--app-mu); font-family: ui-monospace, monospace; font-size: 13px;
      ion-icon { font-size: 17px; flex: none; }
      > span:not(.ui-info) { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    }
    .same {
      display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 14px;
      background: rgba(var(--app-yel-rgb), 0.12); border: 1px solid rgba(var(--app-yel-rgb), 0.45);
      .ui-tx small { color: var(--app-yel); white-space: normal; }
      .ui-tx b { white-space: normal; }
    }
    .needs { background: rgba(var(--app-yel-rgb), 0.12); }
    .needs .ui-tx b { color: var(--app-yel); }
    .ui-row.plain .grow { flex: 1; min-width: 0; display: flex; align-items: center; gap: 13px; border: 0; background: none; color: var(--app-tx); padding: 0; font: inherit; text-align: left; cursor: pointer; }
    .tag { font-size: 11px; padding: 1px 6px; border-radius: 6px; margin-left: 6px; font-weight: 500; }
    .tag.learned { background: rgba(var(--app-grn-rgb), 0.16); color: var(--app-grn); }
    .guessed-sign { margin: 8px 0 0; }
    .tag.guessed { background: rgba(var(--app-yel-rgb), 0.16); color: var(--app-yel); }
    .as-came { display: block; }
  `],
  template: `
    <div class="entry" [class.writing-note]="writingNote()">
      <header class="entry-top">
        <button type="button" class="x" (click)="close()" [attr.aria-label]="'entry.cancel' | t">
          <ion-icon name="close"></ion-icon>
        </button>
        <h1>{{ 'ui.review.check' | t }}</h1>
        <button type="button" class="bin" (click)="discard.emit()" [attr.aria-label]="'review.discard' | t">
          <ion-icon name="trash-outline"></ion-icon>
        </button>
      </header>

      <div class="entry-scroll">
        <div class="entry-body" (click)="bodyTapped($event)">
          <!-- While the note is written the rest steps aside by CSS (.writing-note);
           the note is never drawn a second time, or the phone drops its keyboard. -->
            <div class="ui-seg kinds">
              <button type="button" class="red" [class.on]="sign() < 0" (click)="sign.set(-1)">
                <ion-icon name="arrow-up"></ion-icon><span>{{ 'ui.new.expense' | t }}</span>
              </button>
              <button type="button" class="grn" [class.on]="sign() > 0" (click)="sign.set(1)">
                <ion-icon name="arrow-down"></ion-icon><span>{{ 'ui.new.income' | t }}</span>
              </button>
              <button type="button" class="blu" disabled>
                <ion-icon name="swap-horizontal"></ion-icon><span>{{ 'ui.new.transfer' | t }}</span>
              </button>
            </div>

            <!-- What the statement said, in one line; its (i) opens it whole. -->
            <div class="said">
              <ion-icon name="document-text-outline"></ion-icon>
              <span>{{ evidence() }}</span>
              <span class="ui-info" role="button" (click)="info.set(evidence())" [attr.aria-label]="'ui.info' | t">
                <ion-icon name="information"></ion-icon>
              </span>
            </div>

            @if (sameAs()) {
              <div class="same">
                <app-badge [size]="36" builtin="copy-outline" fixed="#f6b93b"></app-badge>
                <span class="ui-tx"><small>{{ 'ui.review.maybeThis' | t }}</small><b>{{ sameAs() }}</b></span>
              </div>
            }

            <!-- The statement carried no running balance: whether it is money
                 in or out was read from the words, and may be wrong. -->
            @if (guessed()) {
              <div class="ui-banner warn guessed-sign"><ion-icon name="help-circle-outline"></ion-icon><span>{{ 'review.guessed' | t }}</span></div>
            }

            @if (pendingLabel(); as sum) { <p class="pending">{{ sum }}</p> }
            <section class="amount" (click)="keypadOpen.set(true)">
              <span class="sign" [class.expense]="sign() < 0" [class.income]="sign() > 0">{{ sign() < 0 ? '−' : '+' }}</span>
              <span class="value">{{ amount().isEmpty ? '0' : amount().text }}</span>
              <span class="currency">{{ currency() }}</span>
            </section>

            <div class="ui-list ends">
              <div class="ui-row end" [class.needed]="account() === null">
                <span class="side">{{ (sign() < 0 ? 'entry.from' : 'ui.side.to') | t }}</span>
                <div class="what">
                  <button type="button" class="acc" (click)="pickingAccount.set(true)">
                    @if (account(); as acc) {
                      <app-badge shape="ci" [size]="28" [builtin]="acc.builtin_icon" [customId]="acc.custom_icon_id"
                                 [tone]="acc.color" [seed]="acc.id" fallback="wallet"></app-badge>
                      <b class="ui-one">{{ acc.name }}</b>
                    } @else {
                      <b class="ui-y">{{ 'entry.pickAccount' | t }}</b>
                    }
                  </button>
                </div>
                <ion-icon class="ui-chev" name="chevron-down-outline" (click)="pickingAccount.set(true)"></ion-icon>
              </div>
              <div class="ui-row pick category" [class.needs]="category() === null">
                <button type="button" class="grow" (click)="pickingCategory.set(true)">
                  @if (category(); as chosen) {
                    <app-badge [size]="42" [builtin]="chosen.builtin_icon" [customId]="chosen.custom_icon_id"
                               [tone]="chosen.color" [seed]="chosen.id"></app-badge>
                    <span class="ui-tx"><span class="k">{{ 'entry.category' | t }}</span>
                      <b>{{ chosen.name }}@if (from() === 'learned') {<span class="tag learned">{{ 'review.learned' | t }}</span>}@if (from() === 'guessed') {<span class="tag guessed">{{ 'review.fromWords' | t }}</span>}</b></span>
                  } @else {
                    <app-badge [size]="42" builtin="help" fixed="#f6b93b"></app-badge>
                    <span class="ui-tx"><span class="k">{{ 'entry.category' | t }}</span><b>{{ 'review.pickCategory' | t }}</b></span>
                  }
                </button>
                <ion-icon class="ui-chev" [name]="category() === null ? 'chevron-forward-outline' : 'chevron-down-outline'" (click)="pickingCategory.set(true)"></ion-icon>
              </div>
              <div class="ui-row day">
                <button type="button" class="grow" (click)="pickingDate.set(true)">
                  <ion-icon name="calendar-outline"></ion-icon>
                  <span class="ui-tx"><b>{{ dateLabel() }}</b></span>
                </button>
                <ion-icon class="ui-chev" name="chevron-down-outline" (click)="pickingDate.set(true)"></ion-icon>
              </div>
              <ng-container [ngTemplateOutlet]="noteTpl"></ng-container>
            </div>
        </div>
      </div>

      @if (!writingNote()) {
        <app-keypad [open]="keypadOpen()" (openChange)="keypadOpen.set($event)"
                    [missing]="missing()" [canSave]="missing() === null && !busy()"
                    [operator]="pending()?.operator ?? null"
                    (pressed)="press($event)" (save)="save()"></app-keypad>
      }
    </div>

    <ng-template #noteTpl>
      <div class="ui-row note" [class.writing]="writingNote()">
        @if (!writingNote()) { <ion-icon name="create-outline"></ion-icon> }
        <span class="ui-tx">
          <span class="k">
            {{ 'ui.note' | t }}
            @if (writingNote()) { <button type="button" class="done" (click)="finishNote()">{{ 'entry.noteDone' | t }}</button> }
          </span>
          <textarea #noteField [placeholder]="'ui.note.placeholder' | t" [value]="note()" [appAutoGrow]="note()" rows="1"
                    (focus)="writingNote.set(true)" (input)="onNote($any($event.target).value ?? '')"></textarea>
          @if (!writingNote() && note() === original() && note() !== '') { <small>{{ 'ui.review.fromStatement' | t }}</small> }
        </span>
        @if (note() !== '') {
          <!-- On the press, keeping the note's focus: see clearNote in the movement form. -->
          <button type="button" class="clear-note" (pointerdown)="clearNote($event)" (click)="clearNote()"
                  [attr.aria-label]="'entry.clearNote' | t">
            <ion-icon name="close-circle"></ion-icon>
          </button>
        }
      </div>
      @if (writingNote() && (hints().length > 0 || original())) {
        <div class="hints">
          @for (hint of hints(); track hint) {
            <button type="button" class="ui-row" (pointerdown)="useNote(hint, $event)" (click)="useNote(hint)">
              <ion-icon name="time-outline"></ion-icon>
              <span class="ui-tx"><b class="hint-text">{{ hint }}</b></span>
              <ion-icon class="use" name="arrow-up-outline"></ion-icon>
            </button>
          }
          @if (original()) {
            <button type="button" class="ui-row" (pointerdown)="useNote(original(), $event)" (click)="useNote(original())">
              <ion-icon name="document-text-outline"></ion-icon>
              <span class="ui-tx"><b class="hint-text">{{ original() }}</b><small>{{ 'ui.review.asItCame' | t }}</small></span>
              <ion-icon class="use" name="arrow-up-outline"></ion-icon>
            </button>
          }
        </div>
      }
    </ng-template>

    <app-account-picker [open]="pickingAccount()" [accounts]="accounts()" [selectedId]="account()?.id ?? null"
                        [heading]="(sign() < 0 ? 'entry.fromWhere' : 'entry.toWhere') | t"
                        (chosen)="accountId.set($event.id); pickingAccount.set(false)" (closed)="pickingAccount.set(false)"></app-account-picker>

    <app-category-sheet [open]="pickingCategory()" [kind]="sign() < 0 ? 'expense' : 'income'" [chosen]="categoryId()"
                        (picked)="categoryId.set($event); from.set('typed'); pickingCategory.set(false)"
                        (cancelled)="pickingCategory.set(false)"></app-category-sheet>

    <ion-modal [initialBreakpoint]="1" [breakpoints]="[0, 1]" [handle]="false" class="ui-sheet" [isOpen]="pickingDate()" (didDismiss)="pickingDate.set(false)">
      <ng-template>
        <div class="ui-sheet-body ion-content-scroll-host date-sheet">
          <div class="grab"></div>
          <ion-datetime presentation="date" [value]="day()" [locale]="i18n.dateLocale()" [firstDayOfWeek]="1"
                        [showDefaultButtons]="true" [doneText]="'entry.doneDate' | t" [cancelText]="'entry.cancel' | t"
                        (ionChange)="pickDate($any($event.detail).value)" (ionCancel)="pickingDate.set(false)"></ion-datetime>
        </div>
      </ng-template>
    </ion-modal>

    @if (info(); as said) {
      <div class="info-scrim" (click)="info.set(null)"></div>
      <div class="info-bubble" (click)="info.set(null)">{{ said }}</div>
    }
  `,
})
export class ProposalFormComponent implements OnInit {
  private readonly database = inject(DatabaseService);
  readonly i18n = inject(I18nService);

  readonly proposal = input.required<MovementProposal>();
  /** What was read, as the statement put it. */
  readonly evidence = input('');
  /** The movement it may already be, in words. */
  readonly sameAs = input<string | null>(null);
  /** Whether money in or out was read from the words rather than proved. */
  readonly guessed = input(false);
  readonly accounts = input<readonly AccountRow[]>([]);
  readonly categories = input<readonly CategoryRow[]>([]);
  readonly busy = input(false);

  readonly answered = output<ProposalAnswer>();
  readonly discard = output<void>();
  readonly cancelled = output<void>();

  private readonly noteField = viewChild<ElementRef<HTMLTextAreaElement>>('noteField');

  /** Folded once the amount is read: a proposal usually has its amount already. */
  readonly keypadOpen = signal(false);

  /** A tap anywhere on the lists below the amount folds the keypad away. */
  bodyTapped(event: Event): void {
    const target = event.target as HTMLElement | null;
    if (target?.closest('.ui-list')) this.keypadOpen.set(false);
  }
  readonly isOperator = isOperator;

  readonly amount = signal(new AmountBuffer());
  readonly pending = signal<Pending | null>(null);
  readonly sign = signal<1 | -1>(-1);
  readonly accountId = signal<number | null>(null);
  readonly categoryId = signal<number | null>(null);
  readonly from = signal<MovementProposal['category_from']>(null);
  readonly day = signal<string>('');
  readonly note = signal('');
  readonly original = signal('');
  readonly hints = signal<string[]>([]);
  readonly writingNote = signal(false);
  readonly pickingAccount = signal(false);
  readonly pickingCategory = signal(false);
  readonly pickingDate = signal(false);
  readonly info = signal<string | null>(null);
  private noteQuery = 0;

  readonly account = computed(() => this.accounts().find(one => one.id === this.accountId()) ?? null);
  readonly category = computed(() => this.categories().find(one => one.id === this.categoryId()) ?? null);
  readonly currency = computed(() => this.account()?.currency_code ?? 'COP');

  readonly pendingLabel = computed(() => {
    const sum = this.pending();
    if (!sum) return '';
    const shown = (minor: number) => formatMoney(minor, this.currency(), { withSymbol: false });
    const buffer = this.amount();
    if (buffer.isEmpty) return `${shown(sum.leftMinor)} ${sum.operator}`;
    return `${shown(sum.leftMinor)} ${sum.operator} ${shown(buffer.minor)} = ${shown(Math.max(apply(sum.leftMinor, sum.operator, buffer.minor), 0))}`;
  });

  readonly dateLabel = computed(() => {
    const iso = this.day();
    if (!iso) return this.i18n.t('ui.review.noDate');
    const [year, month, day] = iso.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    const locale = this.i18n.dateLocale();
    const weekday = date.toLocaleDateString(locale, { weekday: 'long' });
    const text = `${weekday} ${day} ${monthName(date, locale).slice(0, 4).replace(/\.$/, '')} ${year}`;
    return text.charAt(0).toUpperCase() + text.slice(1);
  });

  /** The amount, or the result of the sum still being typed. */
  private readonly effectiveMinor = computed(() => {
    const sum = this.pending();
    const buffer = this.amount();
    if (!sum) return buffer.minor;
    return buffer.isEmpty ? sum.leftMinor : Math.max(apply(sum.leftMinor, sum.operator, buffer.minor), 0);
  });

  readonly missing = computed<string | null>(() => {
    // A sum being added up counts as its result: saving finishes it.
    if (this.effectiveMinor() <= 0) return this.i18n.t('entry.need.amount');
    if (this.accountId() === null) return this.i18n.t('entry.need.account');
    if (this.categoryId() === null) return this.i18n.t('entry.need.category');
    if (!this.day()) return this.i18n.t('ui.review.noDate');
    return null;
  });

  ngOnInit(): void {
    const proposal = this.proposal();
    // Open only when there is no amount yet to read: a notification that said
    // nothing but "you have a new movement".
    this.keypadOpen.set(proposal.amount_minor === null || proposal.amount_minor === 0);
    if (proposal.amount_minor !== null) {
      this.amount.set(AmountBuffer.from(Math.abs(proposal.amount_minor)));
      this.sign.set(proposal.amount_minor < 0 ? -1 : 1);
    }
    this.accountId.set(proposal.account_id);
    this.categoryId.set(proposal.category_id);
    this.from.set(proposal.category_from);
    this.day.set(proposal.occurred_on ?? '');
    this.note.set(proposal.description ?? '');
    this.original.set(proposal.description ?? '');
  }

  press(key: string): void {
    if (key === 'C') { this.clear(); return; }
    if (isOperator(key)) { this.operate(key); return; }
    if (key === '=') { this.equals(); return; }
    const buffer = this.amount();
    if (key === '<') buffer.backspace();
    else if (key === ',') buffer.separator();
    else buffer.push(key);
    this.amount.set(Object.assign(Object.create(AmountBuffer.prototype), buffer));
  }

  private operate(operator: Operator): void {
    const buffer = this.amount();
    const sum = this.pending();
    if (sum && !buffer.isEmpty) this.pending.set({ leftMinor: apply(sum.leftMinor, sum.operator, buffer.minor), operator });
    else if (!buffer.isEmpty) this.pending.set({ leftMinor: buffer.minor, operator });
    else if (sum) { this.pending.set({ ...sum, operator }); return; }
    else return;
    this.amount.set(new AmountBuffer());
  }

  private equals(): void {
    const sum = this.pending();
    if (!sum) return;
    const buffer = this.amount();
    const result = buffer.isEmpty ? sum.leftMinor : apply(sum.leftMinor, sum.operator, buffer.minor);
    this.pending.set(null);
    this.amount.set(AmountBuffer.from(Math.max(result, 0)));
  }

  clear(): void {
    this.pending.set(null);
    this.amount.set(new AmountBuffer());
  }

  pickDate(value: string | null): void {
    if (value) this.day.set(value.slice(0, 10));
    this.pickingDate.set(false);
  }

  async onNote(value: string): Promise<void> {
    this.note.set(value);
    const typed = value.trim();
    const mine = ++this.noteQuery;
    if (typed.length < 2 || this.database.status() !== 'ready') { this.hints.set([]); return; }
    const found = await new TransactionsRepository(this.database.driver).suggestNotes(typed);
    if (mine === this.noteQuery) this.hints.set(found.filter(note => note !== value).slice(0, 6));
  }

  useNote(note: string, pressed?: Event): void {
    pressed?.preventDefault();
    this.note.set(note);
    const field = this.noteField();
    if (field) field.nativeElement.value = note;
    this.hints.set([]);
  }

  /**
   * The note's own X, there while it is written too. Answered on the press
   * with the default prevented, so the note keeps its focus and the keyboard
   * stays (the movement form's clearNote says why).
   */
  clearNote(pressed?: Event): void {
    pressed?.preventDefault();
    this.noteQuery++;
    this.note.set('');
    this.hints.set([]);
    const field = this.noteField();
    if (field) field.nativeElement.value = '';
  }

  /** The X: while the note is being written it only leaves the note. */
  close(): void {
    if (this.writingNote()) {
      this.finishNote();
      return;
    }
    this.cancelled.emit();
  }

  finishNote(): void {
    this.writingNote.set(false);
    this.hints.set([]);
    this.noteField()?.nativeElement.blur();
  }

  save(): void {
    // A sum still being added up is finished by saving it: there is no "=".
    if (this.pending() !== null) this.equals();
    if (this.missing() !== null) return;
    this.answered.emit({
      account_id: this.accountId(),
      occurred_on: this.day() || null,
      amount_minor: this.sign() * this.amount().minor,
      description: this.note().trim() === '' ? null : this.note().trim(),
      category_id: this.categoryId(),
    });
  }
}
