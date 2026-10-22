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

import { canReadImages, statementAccept, statementFiles } from '../../core/statements/image-text';
import { currencyName, flagOf } from '../../core/currencies/catalog';
import { PaywallService } from '../../core/paywall/paywall.service';
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
import { AmountInputDirective } from '../../shared/ui/amount-input.directive';
import { balanceFromAvailable, balanceFromOwed, openingFor, standingOf } from '../../core/cards/card-setup';
import { EA_SCALE, eaFromMonthly, monthlyFromEa } from '../../core/loans/schedule';

const TYPES: AccountType[] = ['debit', 'credit', 'cash', 'investment'];

@Component({
  selector: 'app-account-editor',
  imports: [AmountInputDirective, 
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
  /** The kind a new account starts as: Deudas opens it as a card. */
  readonly startType = input<AccountType | null>(null);
  /**
   * A bank's message with no account to go to (Jose, 2026-10-16, mockups
   * 35a-35e): the form starts with that bank's name, says what it is for,
   * and hands back the account it made.
   */
  readonly forBank = input<string | null>(null);
  /** The account just made, or null after a correction or a delete. */
  readonly saved = output<number | null>();
  readonly cancelled = output<void>();

  private readonly statements = inject(StatementsService);
  private readonly router = inject(Router);

  private readonly flow = inject(StatementFlowService);
  private readonly toast = inject(ToastService);
  private readonly pro = inject(PaywallService);

  /** Pesos are free; an account in another currency is Pro (rule 21). */
  chooseCurrency(code: string): void {
    this.pickingCurrency.set(false);
    if (code !== 'COP' && !this.pro.can('currencies')) { this.pro.ask('currencies'); return; }
    this.currency.set(code);
  }

  addCurrency(): void {
    if (!this.pro.can('currencies')) { this.pro.ask('currencies'); return; }
    this.addingCurrency.set(true);
  }

  /** The first statement is free; the file picker opens only when one more may be read. */
  async pickStatement(input: HTMLInputElement): Promise<void> {
    if (await this.pro.allow('statements')) input.click();
  }

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
      this.saved.emit(null);
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
  /** The rate the card charges, as typed, and how the bank quotes it. */
  readonly cardRateText = signal('');
  readonly cardRateQuoted = signal<'ea' | 'mv'>('ea');
  /** The typed rate as E.A. scaled, whichever way it was typed; null when empty. */
  readonly cardRateScaled = computed(() => {
    const typed = rateScaledOf(this.cardRateText());
    if (typed === null || typed === 0) return null;
    return this.cardRateQuoted() === 'ea' ? typed : eaFromMonthly(typed);
  });
  /** "Es 2,11 % cada mes" or "Equivale a 28,50 % E.A.". */
  readonly cardRateLine = computed(() => {
    const ea = this.cardRateScaled();
    if (ea === null) return '';
    return this.cardRateQuoted() === 'ea'
      ? this.i18n.t('loans.form.rate.monthly', { rate: rateText(monthlyFromEa(ea), 2) })
      : this.i18n.t('loans.form.rate.annual', { rate: rateText(ea, 2) });
  });
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

  // -------------------------------------------------------------------------
  // A card set up by what the bank's app shows (32a-32d)
  // -------------------------------------------------------------------------

  /**
   * A card is asked "Cupo total" and "Cupo disponible hoy" (or what is owed),
   * never an opening balance. Not when it comes from a statement: there the
   * opening is the statement's, and its movements go on top of it.
   */
  readonly cardSetup = computed(() => this.isCredit() && this.fromStatement() === null);
  /** "Sé mi cupo disponible" or "Sé lo que debo". */
  readonly cardMode = signal<'available' | 'owed'>('available');
  /** The two answers are offered on a new card, and on one with no limit or past it. */
  readonly cardModes = signal(true);
  readonly available = signal(new AmountBuffer());
  /** Set once the available credit is typed: until then, editing the limit keeps the debt. */
  private availableTyped = false;
  readonly owed = signal(new AmountBuffer());

  /** What the movements on record add up to: the balance today less the opening. */
  private readonly movementsSum = computed(() => {
    const account = this.editing();
    const held = this.held();
    return account === null || held === null ? 0 : held.balance - account.opening_balance_minor;
  });

  /** The balance the card is to hold today, or null while a figure is missing. */
  readonly cardBalance = computed<number | null>(() => {
    if (this.cardMode() === 'owed') return balanceFromOwed(this.owed().minor);
    const limit = this.creditLimit().minor;
    if (limit <= 0 || this.available().isEmpty) return null;
    return balanceFromAvailable(limit, this.available().minor);
  });

  /** The card under the two figures: what they mean, said back before saving. */
  readonly cardResult = computed<{ label: string; amount: string; tone: 'y' | 'g' | 'r' | ''; line: string } | null>(() => {
    const balance = this.cardBalance();
    if (balance === null) return null;
    const editingLine = this.isNew() ? null : this.movements() === 1
      ? this.i18n.t('cards.setup.withOne')
      : this.i18n.t('cards.setup.withMovements', { count: this.movements().toLocaleString(this.i18n.dateLocale()) });
    if (this.cardMode() === 'owed') {
      const limit = this.creditLimit().minor;
      if (limit <= 0) return editingLine === null ? null : { label: this.i18n.t('summary.owedToday'), amount: this.money(-balance), tone: 'y', line: editingLine };
      const left = limit + balance;
      return left < 0
        ? { label: this.i18n.t('summary.creditOver'), amount: this.money(-left), tone: 'r', line: editingLine ?? this.i18n.t('cards.setup.over.hint') }
        : { label: this.i18n.t('cards.available'), amount: this.money(left), tone: 'g', line: editingLine ?? this.i18n.t('cards.setup.left.hint') };
    }
    switch (standingOf(balance)) {
      case 'owes': return { label: this.i18n.t('summary.owedToday'), amount: this.money(-balance), tone: 'y', line: editingLine ?? this.i18n.t('cards.setup.owes.hint') };
      case 'favour': return { label: this.i18n.t('summary.inFavour'), amount: this.money(balance), tone: 'g', line: editingLine ?? this.i18n.t('cards.setup.favour.hint') };
      default: return { label: this.i18n.t('summary.owedNothing'), amount: this.money(0), tone: '', line: editingLine ?? this.i18n.t('cards.setup.clear.hint') };
    }
  });

  /** A limit typed: on a card in use, the debt stays and the available credit follows. */
  onLimit(buffer: AmountBuffer): void {
    this.creditLimit.set(buffer);
    const held = this.held();
    if (!this.isNew() && !this.availableTyped && held !== null && buffer.minor + held.balance >= 0) {
      this.available.set(AmountBuffer.from(buffer.minor + held.balance));
    }
  }

  onAvailable(buffer: AmountBuffer): void {
    this.availableTyped = true;
    this.available.set(buffer);
  }

  /** Whether the limit typed differs from the one in force, so "Vigente desde" is asked. */
  readonly limitChanged = computed(() => {
    const account = this.editing();
    return account !== null && this.creditLimit().minor > 0 && this.creditLimit().minor !== account.credit_limit_minor;
  });

  /** The opening figure to save: worked out from the card's figures, or as typed. */
  private openingToSave(): number {
    if (!this.cardSetup()) return this.openingBalance().minor;
    const balance = this.cardBalance();
    const account = this.editing();
    if (balance === null) return account?.opening_balance_minor ?? 0;
    if (account !== null && this.held() === null) return account.opening_balance_minor;
    return openingFor(balance, this.movementsSum());
  }

  readonly title = computed(() =>
    this.i18n.t(this.isNew() ? 'accounts.new' : 'accounts.edit'));

  /**
   * What is still missing. Same idea as the entry screen: a disabled button
   * that says nothing is the app refusing without explaining itself.
   */
  readonly missing = computed<string | null>(() => {
    if (this.name().trim() === '') return this.i18n.t('accounts.need.name');
    if (this.isNew() && this.currency() === '') return this.i18n.t('accounts.need.currency');
    if (this.cardSetup() && this.cardMode() === 'available') {
      if (this.creditLimit().minor <= 0) return this.i18n.t('cards.setup.need.limit');
      if (this.available().isEmpty) return this.i18n.t('cards.setup.need.available');
    }
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
    if (!account && this.startType()) this.type.set(this.startType()!);
    if (!account && this.forBank()) this.name.set(this.forBank()!);
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
      if (!row) return;
      this.held.set({ balance: row.balance_minor, available: row.available_credit_minor });
      // A card in use starts on what it holds today (32d).
      const limit = account.credit_limit_minor ?? 0;
      if (limit > 0 && limit + row.balance_minor >= 0) {
        this.cardModes.set(false);
        this.cardMode.set('available');
        this.available.set(AmountBuffer.from(limit + row.balance_minor));
      } else {
        this.cardMode.set('owed');
        this.owed.set(AmountBuffer.from(Math.max(0, -row.balance_minor)));
      }
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
    this.cardRateQuoted.set(account.card_rate_quoted ?? 'ea');
    this.cardRateText.set(account.card_rate_scaled == null ? ''
      : rateText(account.card_rate_quoted === 'mv' ? monthlyFromEa(account.card_rate_scaled) : account.card_rate_scaled, 2));
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

  readonly currencyName = computed(() => {
    const kept = this.currencies().find(c => c.code === this.currency());
    return kept ? this.nameOf(kept) : '';
  });

  flag(code: string): string {
    return flagOf(code);
  }

  /** A currency's name in the app's language (the catalogue's), else as kept. */
  nameOf(option: { code: string; name: string }): string {
    return currencyName(option.code, option.name, this.i18n.language());
  }

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
        opening_balance_minor: this.openingToSave(),
        opened_on: this.openedOn(),
        statement_day: this.isCredit() ? dayOf(this.statementDay()) : null,
        due_day: this.isCredit() ? dayOf(this.dueDay()) : null,
        card_rate_scaled: this.isCredit() ? this.cardRateScaled() : null,
        card_rate_quoted: this.isCredit() && this.cardRateScaled() !== null ? this.cardRateQuoted() : null,
      };

      let createdId: number | null = null;
      if (account) {
        await accounts.update(account.id, { ...shared, archived: this.archived() });
        await this.saveLimit(account.id);
      } else {
        // From a statement, the account and its proposals are written together:
        // a reading that fails leaves no account behind (Jose, 2026-10-14: the
        // account looked made while nothing of the statement had come in).
        const read = this.fromStatement();
        if (read !== null) {
          this.busyLabel.set(this.i18n.t('ui.import.savingNew', { count: read.reading.rows.length }));
          const db = this.database.driver;
          let done: { batch: string; proposed: number } | null = null;
          await db.transaction(async () => {
            const id = await accounts.create({
              ...shared,
              currency_code: this.currency(),
              opening_balance_base_minor: this.currency() === 'COP' ? this.openingBalance().minor : 0,
            });
            await this.saveLimit(id);
            done = await this.statements.proposeRead(id, read);
            createdId = id;
          });
          this.fromStatement.set(null);
          this.database.dataChanged();
          // Straight to that statement on Por revisar, opened; leaving closes this sheet.
          const imported = done as unknown as { batch: string; proposed: number };
          await this.router.navigate(['/review'], { queryParams: { batch: imported.batch } });
          this.saved.emit(createdId);
          this.toast.say(this.i18n.t('ui.import.newDone', { count: imported.proposed }), 5000);
          return;
        }
        const id = await accounts.create({
          ...shared,
          currency_code: this.currency(),
          // A peso account's opening balance is already in the base currency.
          // A foreign one starts at zero until a rate says otherwise, rather
          // than pretending dollars are pesos.
          opening_balance_base_minor:
            this.currency() === 'COP' ? shared.opening_balance_minor : 0,
        });
        await this.saveLimit(id);
        createdId = id;
      }

      this.database.dataChanged();
      this.saved.emit(createdId);
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
  /** PDF, and on the phone photos or screenshots too, several at once. */
  readonly statementAccept = statementAccept();
  readonly readsImages = canReadImages();

  async onStatementPicked(input: HTMLInputElement): Promise<void> {
    const account = this.editing();
    const chosen = statementFiles(input.files);
    const file = chosen.length > 0 ? chosen : null;
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
  private async readForNewAccount(file: File[], input: HTMLInputElement): Promise<void> {
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
    // A card's statement makes a card, with the limit it prints.
    if (read.account.card) {
      this.type.set('credit');
      if (read.account.credit_limit_minor !== null && this.creditLimit().minor === 0) {
        this.creditLimit.set(AmountBuffer.from(read.account.credit_limit_minor));
      }
    }
  }

  /** Lets the sheet finish closing, then goes. */
  private async leaveFor(url: string): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 350));
    await this.router.navigateByUrl(url);
  }

  private async readStatement(accountId: number, file: File[], input: HTMLInputElement): Promise<void> {
    this.error.set('');
    const done = await this.flow.run(file, (password, watch) =>
      this.statements.importInto(accountId, file, password, watch));
    if (done === 'again') { input.click(); return; }
    if (done === null) return;
    this.database.dataChanged();
    this.cancelled.emit();
    await this.leaveFor(`/review?batch=${encodeURIComponent(done.batch)}`);
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

/** "28,5" or "2.1" as a percentage scaled by 1,000,000; null when it is no number. */
function rateScaledOf(text: string): number | null {
  const n = Number(text.trim().replace(',', '.'));
  return text.trim() !== '' && Number.isFinite(n) && n >= 0 && n < 1000 ? Math.round(n * EA_SCALE / 100) : null;
}

function rateText(scaled: number, digits: number): string {
  return new Intl.NumberFormat('es-CO', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(scaled * 100 / EA_SCALE);
}
