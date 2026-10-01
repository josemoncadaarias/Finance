/**
 * Creating an account, and correcting one that exists.
 *
 * Three things here can only come from Jose and had no way in until now: the
 * icon (a real bank logo rather than another wallet), whether the account
 * counts towards net worth (until today that lived in the importer's table and
 * needed a code change), and a credit card's limit with the history behind it.
 *
 * The currency of an existing account is not editable. Every amount already
 * stored is denominated in it, and changing the label would silently reinterpret
 * years of movements — 2,013.33 dollars becoming 2,013.33 pesos. A wrong
 * currency is fixed by making the right account and moving the money across,
 * which leaves a trail.
 */

import {
  Component, HostListener, computed, inject, input, output, signal, type OnInit,
} from '@angular/core';
import { IonIcon, IonModal, IonDatetime } from '@ionic/angular';
import { addIcons } from 'ionicons';
import * as allIcons from 'ionicons/icons';

import { Router } from '@angular/router';

import { DatabaseService } from '../../core/database/database.service';
import { AccountsRepository } from '../../core/database/repositories/accounts.repository';
import { StatementsService, type ReadStatement } from '../../core/statements/statements.service';
import { warmUpPdfReader } from '../../core/statements/pdf-text';
import { StatementFlowService } from '../../core/statements/statement-flow.service';
import { ConfirmComponent } from '../../shared/confirm/confirm.component';
import { BadgeComponent } from '../../shared/ui/badge.component';
import { FaceEditorComponent, type FaceChoice } from '../../shared/ui/face-editor.component';
import { ToastService } from '../../shared/ui/toast.service';
import { BusyOverlayComponent } from '../../shared/busy-overlay.component';
import { CreditLimitsRepository, type CreditLimitChange } from '../../core/database/repositories/credit-limits.repository';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { CurrencyDialogComponent } from '../../shared/currency-dialog/currency-dialog.component';
import { ACCOUNT_ICONS } from '../../core/icons/icon-catalog';
import { AmountBuffer } from '../entry/amount-buffer';
import { formatMoney } from '../../core/database/money';
import { shortDay } from '../../core/filters/period';
import type { AccountRow, AccountType } from '../../core/database/types';

const TYPES: AccountType[] = ['debit', 'credit', 'cash', 'investment'];

@Component({
  selector: 'app-account-editor',
  imports: [
    CurrencyDialogComponent, TranslatePipe, BusyOverlayComponent, ConfirmComponent,
    BadgeComponent, FaceEditorComponent, IonIcon, IonModal, IonDatetime,
  ],
  templateUrl: './account-editor.component.html',
  styleUrls: ['./account-editor.component.scss'],
})
export class AccountEditorComponent implements OnInit {
  private readonly database = inject(DatabaseService);
  readonly i18n = inject(I18nService);

  /** The account being corrected, or null when creating one. */
  readonly editing = input<AccountRow | null>(null);
  readonly saved = output<void>();
  readonly cancelled = output<void>();

  private readonly statements = inject(StatementsService);
  private readonly router = inject(Router);

  private readonly flow = inject(StatementFlowService);
  private readonly toast = inject(ToastService);

  /** Open while the face - icon, colour, image - is being chosen (2l-2n). */
  readonly editingFace = signal(false);
  readonly nameFocused = signal(false);
  readonly pickingCurrency = signal(false);
  readonly color = signal<string | null>(null);

  /** What the account holds today, for "Así se verá". */
  private readonly held = signal<{ balance: number; available: number | null } | null>(null);

  /**
   * A statement read for an account that does not exist yet.
   *
   * Held until the form is saved, because its movements have to point at an
   * account and there is none. What it filled in - the name, the opening
   * balance, the day - is on the form by then and can be corrected like
   * anything else typed there.
   */
  readonly fromStatement = signal<ReadStatement | null>(null);

  /** What that statement filled in, for the line that says so. */
  readonly statementSaid = computed(() => {
    const read = this.fromStatement();
    if (read === null) return null;
    return this.i18n.t('statement.filledIn', {
      file: read.file.name,
      count: read.reading.rows.length,
    });
  });

  readonly accountIcons = ACCOUNT_ICONS;
  readonly types = TYPES;

  readonly name = signal('');
  readonly type = signal<AccountType>('debit');
  readonly currency = signal('COP');
  readonly builtinIcon = signal<string | null>('wallet');
  readonly customIconId = signal<number | null>(null);
  readonly includeInNetWorth = signal(true);
  readonly archived = signal(false);

  /**
   * How many movements would go with the account, and whether the question
   * has been asked yet.
   *
   * The count is read when the editor opens, because the warning has to say
   * what will actually be lost rather than a general caution - "its 4,512
   * movements" is a different sentence from "some movements".
   */
  readonly movements = signal(0);
  readonly confirmingDelete = signal(false);

  private async readMovementCount(id: number): Promise<void> {
    this.movements.set(await new AccountsRepository(this.database.driver).movementCount(id));
  }

  /** What deleting takes with it, said before it is done. */
  readonly deleteLine = computed(() => {
    const count = this.movements();
    if (count === 0) return this.i18n.t('accounts.delete.empty');
    if (count === 1) return this.i18n.t('accounts.delete.withMovements.one');
    return this.i18n.t('accounts.delete.withMovements', { count: count.toLocaleString(this.i18n.dateLocale()) });
  });

  /** Asks first. The second press is the one that does it. */
  askToDelete(): void {
    this.confirmingDelete.set(true);
  }

  async deleteAccount(): Promise<void> {
    const account = this.editing();
    if (!account) return;

    this.saving.set(true);
    try {
      // Five years of movements go with it, one delete at a time underneath.
      this.busyLabel.set(this.i18n.t('busy.deleting'));
      await new Promise(resolve => setTimeout(resolve));
      await new AccountsRepository(this.database.driver).deleteWithHistory(account.id);
      this.database.dataChanged();
      this.saved.emit();
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : String(error));
    } finally {
      this.saving.set(false);
      this.confirmingDelete.set(false);
    }
  }
  readonly openingBalance = signal(new AmountBuffer());
  readonly openedOn = signal(todayIso());

  readonly creditLimit = signal(new AmountBuffer());
  readonly limitHistory = signal<CreditLimitChange[]>([]);
  readonly limitEffectiveOn = signal(todayIso());

  /** A card's cut-off and payment days, both optional; '' is none. */
  readonly statementDay = signal('');
  readonly dueDay = signal('');
  /** Paid in the month it closes when the payment day comes after the cut-off. */
  readonly sameMonth = computed(() => Number(this.dueDay()) > Number(this.statementDay()) && this.statementDay() !== '');

  readonly currencies = signal<{ code: string; name: string }[]>([]);

  /** Open while a currency the app does not know yet is being added. */
  readonly addingCurrency = signal(false);
  readonly saving = signal(false);

  /** Set while the account and its history are being removed. */
  readonly busyLabel = signal('');
  readonly error = signal('');
  readonly showDate = signal<'opened' | 'limit' | null>(null);

  readonly isNew = computed(() => this.editing() === null);
  readonly isCredit = computed(() => this.type() === 'credit');

  readonly title = computed(() =>
    this.i18n.t(this.isNew() ? 'accounts.new' : 'accounts.edit'));

  /**
   * What is still missing. Same idea as the entry screen: a disabled button
   * that says nothing is the app refusing without explaining itself.
   */
  readonly missing = computed<string | null>(() => {
    if (this.name().trim() === '') return this.i18n.t('accounts.need.name');
    if (this.isNew() && this.currency() === '') return this.i18n.t('accounts.need.currency');
    return null;
  });

  readonly canSave = computed(() => this.missing() === null);

  /** Keeps a day field to digits, at most two, at most 31. */
  onDay(which: 'statement' | 'due', input: HTMLInputElement): void {
    let text = input.value.replace(/\D/g, '').slice(0, 2);
    if (Number(text) > 31) text = '31';
    if (text === '0' || text === '00') text = '';
    input.value = text;
    (which === 'statement' ? this.statementDay : this.dueDay).set(text);
  }

  constructor() {
    addIcons(allIcons as unknown as Record<string, string>);
  }

  ngOnInit(): void {
    void this.load();
    // While the form is being read, rather than while somebody waits for an
    // answer. See warmUpPdfReader.
    if (this.editing()) void warmUpPdfReader();
  }

  private async load(): Promise<void> {
    if (this.database.status() !== 'ready') return;

    this.currencies.set(await this.database.driver.query<{ code: string; name: string }>(
      'SELECT code, name FROM currencies ORDER BY code'));

    const account = this.editing();
    if (!account) {
      // Chosen as "Es de una cuenta nueva" from the "+": the statement was
      // read there, and this form is where it is filled in from.
      const pending = this.statements.pendingNewAccount();
      if (pending !== null) {
        this.statements.pendingNewAccount.set(null);
        this.fillFrom(pending);
      }
      return;
    }

    void this.readMovementCount(account.id);

    this.name.set(account.name);
    this.type.set(account.type);
    this.currency.set(account.currency_code);
    this.builtinIcon.set(account.builtin_icon);
    this.customIconId.set(account.custom_icon_id);
    this.color.set(account.color);
    void new AccountsRepository(this.database.driver).balances({ includeArchived: true }).then(rows => {
      const row = rows.find(r => r.account.id === account.id);
      if (row) this.held.set({ balance: row.balance_minor, available: row.available_credit_minor });
    });
    this.includeInNetWorth.set(account.include_in_net_worth === 1);
    this.archived.set(account.archived === 1);
    this.openingBalance.set(AmountBuffer.from(account.opening_balance_minor));
    this.openedOn.set(account.opened_on);

    if (account.credit_limit_minor !== null) {
      this.creditLimit.set(AmountBuffer.from(account.credit_limit_minor));
    }
    this.statementDay.set(account.statement_day === null ? '' : String(account.statement_day));
    this.dueDay.set(account.due_day === null ? '' : String(account.due_day));
    await this.loadLimitHistory();
  }

  private async loadLimitHistory(): Promise<void> {
    const account = this.editing();
    if (!account || account.type !== 'credit') return;

    this.limitHistory.set(
      await new CreditLimitsRepository(this.database.driver).history(account.id));
  }

  /** Escape closes, Enter saves — the same reflexes as everywhere else. */
  @HostListener('document:keydown', ['$event'])
  onKey(event: KeyboardEvent): void {
    if (event.defaultPrevented || event.ctrlKey || event.altKey || event.metaKey) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      this.cancelled.emit();
      return;
    }

    if (event.key === 'Enter' && this.showDate() === null) {
      event.preventDefault();
      if (this.canSave()) void this.save();
    }
  }

  /**
   * A currency was just added in the dialog: offer it, and pick it, since
   * adding one from this form means this account is in it.
   */
  async onCurrencyAdded(code: string): Promise<void> {
    this.currencies.set(await this.database.driver.query<{ code: string; name: string }>(
      'SELECT code, name FROM currencies ORDER BY code'));
    this.currency.set(code);
    this.addingCurrency.set(false);
  }

  onFace(choice: FaceChoice): void {
    this.builtinIcon.set(choice.builtin_icon ?? (choice.custom_icon_id === null ? 'wallet' : this.builtinIcon()));
    this.customIconId.set(choice.custom_icon_id);
    this.color.set(choice.color);
    this.editingFace.set(false);
  }

  readonly currencyName = computed(() =>
    this.currencies().find(c => c.code === this.currency())?.name ?? '');

  typeIcon(type: AccountType): string {
    switch (type) {
      case 'credit': return 'card';
      case 'cash': return 'cash';
      case 'investment': return 'trending-up';
      default: return 'wallet';
    }
  }

  typeColor(type: AccountType): string {
    switch (type) {
      case 'credit': return '#f6b93b';
      case 'cash': return '#a3d65c';
      case 'investment': return '#e8c15a';
      default: return '#6378ff';
    }
  }

  /** "Jueves 31 jul 2026", or "Hoy · domingo 27 sept". */
  longDate(iso: string): string {
    const [year, month, day] = iso.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    const locale = this.i18n.dateLocale();
    const weekday = date.toLocaleDateString(locale, { weekday: 'long' });
    const short = shortDay(iso, locale);
    const text = iso === todayIso() ? `${this.i18n.t('ui.today')} · ${weekday} ${short}` : `${weekday} ${short} ${year}`;
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  /** The grey line of "Así se verá": what a card has left, or the currency. */
  readonly faceLine = computed(() => {
    const held = this.held();
    if (this.type() === 'credit' && held?.available !== null && held?.available !== undefined) {
      return this.i18n.t('ui.picker.available', { amount: formatMoney(held.available, this.currency(), { withSymbol: false }) });
    }
    return this.i18n.t(`accounts.type.${this.type()}` as 'accounts.type.debit');
  });

  readonly faceAmount = computed(() => {
    const held = this.held();
    return held === null ? '' : formatMoney(held.balance, this.currency(), { withSymbol: false });
  });

  readonly faceTone = computed<'plain' | 'owes'>(() => ((this.held()?.balance ?? 0) < 0 ? 'owes' : 'plain'));

  pickDate(value: string | null): void {
    if (value) {
      const iso = value.slice(0, 10);
      if (this.showDate() === 'opened') this.openedOn.set(iso);
      else this.limitEffectiveOn.set(iso);
    }
    this.showDate.set(null);
  }

  dateLabel(iso: string): string {
    return `${shortDay(iso, this.i18n.dateLocale())} ${iso.slice(0, 4)}`;
  }

  money(minor: number): string {
    return formatMoney(minor, this.currency(), { withSymbol: false });
  }

  /** Types into an amount field. Bound through ngModel on a plain input. */
  onAmount(which: 'opening' | 'limit', text: string): void {
    const buffer = new AmountBuffer();
    for (const character of text) {
      if (/[0-9]/.test(character)) buffer.push(character);
      else if (character === ',' || character === '.') buffer.separator();
    }
    if (which === 'opening') this.openingBalance.set(buffer);
    else this.creditLimit.set(buffer);
  }

  async save(): Promise<void> {
    if (!this.canSave() || this.saving()) return;
    this.saving.set(true);
    this.error.set('');

    try {
      const accounts = new AccountsRepository(this.database.driver);
      const account = this.editing();

      const shared = {
        name: this.name().trim(),
        type: this.type(),
        builtin_icon: this.builtinIcon(),
        custom_icon_id: this.customIconId(),
        ...(this.color() !== null ? { color: this.color()! } : {}),
        include_in_net_worth: this.includeInNetWorth(),
        opening_balance_minor: this.openingBalance().minor,
        opened_on: this.openedOn(),
        statement_day: this.isCredit() ? dayOf(this.statementDay()) : null,
        due_day: this.isCredit() ? dayOf(this.dueDay()) : null,
      };

      if (account) {
        await accounts.update(account.id, { ...shared, archived: this.archived() });
        await this.saveLimit(account.id);
      } else {
        const id = await accounts.create({
          ...shared,
          currency_code: this.currency(),
          // A peso account's opening balance is already in the base currency.
          // A foreign one starts at zero until a rate says otherwise, rather
          // than pretending dollars are pesos.
          opening_balance_base_minor:
            this.currency() === 'COP' ? this.openingBalance().minor : 0,
        });
        await this.saveLimit(id);

        // The statement that filled this form in now has an account to
        // belong to. Its movements are proposed, not written: the review
        // screen is still where a person answers for each of them.
        const read = this.fromStatement();
        if (read !== null) {
          await this.statements.proposeRead(id, read);
          this.fromStatement.set(null);
          this.database.dataChanged();
          this.saved.emit();
          // After the sheet has closed, not while it is closing. Routing out
          // from under an ion-modal mid-dismiss left Jose on the form he had
          // just saved, with the movements waiting on a screen he could only
          // reach by reloading.
          await this.leaveFor('/review');
          return;
        }
      }

      this.database.dataChanged();
      this.saved.emit();
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : String(error));
    } finally {
      this.saving.set(false);
      this.busyLabel.set('');
    }
  }

  /**
   * Records the limit as a dated change, not as a bare field.
   *
   * Writing it through the repository is what keeps the history and the
   * account's current limit in step, and what stops a limit from ever being
   * mistaken for money.
   */
  private async saveLimit(accountId: number): Promise<void> {
    if (!this.isCredit()) return;

    const limit = this.creditLimit().minor;
    if (limit <= 0) return;

    const current = this.editing()?.credit_limit_minor ?? null;
    if (current === limit) return;

    await new CreditLimitsRepository(this.database.driver).set({
      account_id: accountId,
      limit_minor: limit,
      effective_on: this.limitEffectiveOn(),
      note: this.i18n.t(current === null ? 'accounts.limit.initial' : 'accounts.limit.changed'),
    });
  }

  // -------------------------------------------------------------------------
  // A statement
  // -------------------------------------------------------------------------

  /**
   * Opens a statement for this account.
   *
   * Nothing is saved here: what the file says becomes proposals, and the
   * review screen is where a person accepts, corrects or throws each of them
   * away. A statement that asks for a password asks once, here.
   *
   * The input lives in the template rather than being built here, so that
   * Angular hears the change itself. Built by hand it fired outside the
   * framework: the reading finished, the rows were saved, and the screen went
   * on showing a spinner until it was reloaded.
   */
  async onStatementPicked(input: HTMLInputElement): Promise<void> {
    const account = this.editing();
    const file = input.files?.[0];
    // Cleared straight away, or picking the same file twice in a row fires
    // nothing the second time: the value has not changed.
    input.value = '';
    if (!file) return;
    if (account) await this.readStatement(account.id, file, input);
    else await this.readForNewAccount(file, input);
  }

  /**
   * A statement opened while the account is still being made.
   *
   * It fills the form in rather than saving anything: the bank's name, what
   * the account held when the period began, and the day it began. Every field
   * it fills is a field that can be corrected before pressing save.
   */
  private async readForNewAccount(file: File, input: HTMLInputElement): Promise<void> {
    this.error.set('');
    const read = await this.flow.run(file, (password, watch) => this.statements.read(file, password, watch));
    if (read === 'again') { input.click(); return; }
    if (read === null) return;
    this.fillFrom(read);
  }

  /** Only what is still empty, and only what the statement actually said. */
  private fillFrom(read: ReadStatement): void {
    this.fromStatement.set(read);
    if (read.account.name && this.name().trim() === '') this.name.set(read.account.name);
    if (read.account.opening_minor !== null && this.openingBalance().minor === 0) {
      this.openingBalance.set(AmountBuffer.from(read.account.opening_minor));
    }
    if (read.account.opened_on) this.openedOn.set(read.account.opened_on);
  }

  /** Lets the sheet finish closing, then goes. */
  private async leaveFor(url: string): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 350));
    await this.router.navigateByUrl(url);
  }

  private async readStatement(accountId: number, file: File, input: HTMLInputElement): Promise<void> {
    this.error.set('');
    const done = await this.flow.run(file, (password, watch) =>
      this.statements.importInto(accountId, file, password, watch));
    if (done === 'again') { input.click(); return; }
    if (done === null) return;
    this.database.dataChanged();
    this.cancelled.emit();
    await this.leaveFor('/review');
    const read = done.proposed === 1 ? this.i18n.t('ui.count.movement') : this.i18n.t('ui.count.movements', { count: done.proposed });
    const known = done.knownAlready > 0
      ? this.i18n.t('ui.import.done.known', { count: done.knownAlready })
      : this.i18n.t('ui.import.done.none');
    this.toast.say(this.i18n.t('ui.import.done', { read, known }));
  }
}

/** A day of the month typed in, or null for none or nonsense. */
function dayOf(text: string): number | null {
  const day = Number(text.trim());
  return text.trim() !== '' && Number.isInteger(day) && day >= 1 && day <= 31 ? day : null;
}

function todayIso(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}
