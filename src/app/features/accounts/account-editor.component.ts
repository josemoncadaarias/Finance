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
import { FormsModule } from '@angular/forms';
import {
  IonContent, IonHeader, IonToolbar, IonButtons, IonButton, IonIcon, IonItem,
  IonInput, IonLabel, IonSelect, IonSelectOption, IonToggle, IonList, IonNote,
  IonFooter, IonModal, IonDatetime,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import * as allIcons from 'ionicons/icons';

import { DatabaseService } from '../../core/database/database.service';
import { AccountsRepository } from '../../core/database/repositories/accounts.repository';
import { CreditLimitsRepository, type CreditLimitChange } from '../../core/database/repositories/credit-limits.repository';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { IconPickerComponent, type IconChoice } from '../../core/icons/icon-picker.component';
import { ACCOUNT_ICONS } from '../../core/icons/icon-catalog';
import { AmountBuffer } from '../entry/amount-buffer';
import { formatMoney } from '../../core/database/money';
import { monthName } from '../../core/filters/period';
import type { AccountRow, AccountType } from '../../core/database/types';

const TYPES: AccountType[] = ['debit', 'credit', 'cash', 'investment'];

@Component({
  selector: 'app-account-editor',
  imports: [
    FormsModule, TranslatePipe, IconPickerComponent,
    IonContent, IonHeader, IonToolbar, IonButtons, IonButton, IonIcon, IonItem,
    IonInput, IonLabel, IonSelect, IonSelectOption, IonToggle, IonList, IonNote,
    IonFooter, IonModal, IonDatetime,
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

  readonly accountIcons = ACCOUNT_ICONS;
  readonly types = TYPES;

  readonly name = signal('');
  readonly type = signal<AccountType>('debit');
  readonly currency = signal('COP');
  readonly builtinIcon = signal<string | null>('wallet');
  readonly customIconId = signal<number | null>(null);
  readonly includeInNetWorth = signal(true);
  readonly archived = signal(false);
  readonly openingBalance = signal(new AmountBuffer());
  readonly openedOn = signal(todayIso());

  readonly creditLimit = signal(new AmountBuffer());
  readonly limitHistory = signal<CreditLimitChange[]>([]);
  readonly limitEffectiveOn = signal(todayIso());

  readonly currencies = signal<{ code: string; name: string }[]>([]);

  /** Open while a currency the app does not know yet is being added. */
  readonly addingCurrency = signal(false);
  readonly newCode = signal('');
  readonly newName = signal('');
  readonly newSymbol = signal('');
  readonly saving = signal(false);
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

  constructor() {
    addIcons(allIcons as unknown as Record<string, string>);
  }

  ngOnInit(): void {
    void this.load();
  }

  private async load(): Promise<void> {
    if (this.database.status() !== 'ready') return;

    this.currencies.set(await this.database.driver.query<{ code: string; name: string }>(
      'SELECT code, name FROM currencies ORDER BY code'));

    const account = this.editing();
    if (!account) return;

    this.name.set(account.name);
    this.type.set(account.type);
    this.currency.set(account.currency_code);
    this.builtinIcon.set(account.builtin_icon);
    this.customIconId.set(account.custom_icon_id);
    this.includeInNetWorth.set(account.include_in_net_worth === 1);
    this.archived.set(account.archived === 1);
    this.openingBalance.set(AmountBuffer.from(account.opening_balance_minor));
    this.openedOn.set(account.opened_on);

    if (account.credit_limit_minor !== null) {
      this.creditLimit.set(AmountBuffer.from(account.credit_limit_minor));
    }
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
   * Adds a currency the app did not know about.
   *
   * Three currencies were seeded because they are the ones Jose holds; a
   * fourth should not need a code change. Minor units are fixed at two: every
   * currency this app is likely to meet has cents, and the amount helpers
   * assume it — a currency without them would need work far beyond this form,
   * and pretending otherwise here would store amounts a hundred times off.
   */
  async saveCurrency(): Promise<void> {
    const code = this.newCode().trim().toUpperCase();
    const name = this.newName().trim();

    if (!/^[A-Z]{3}$/.test(code)) {
      this.error.set(this.i18n.t('accounts.currency.badCode'));
      return;
    }
    if (name === '') {
      this.error.set(this.i18n.t('accounts.currency.needName'));
      return;
    }

    try {
      await this.database.driver.run(
        `INSERT INTO currencies (code, name, symbol, minor_units) VALUES (?, ?, ?, 2)
         ON CONFLICT(code) DO UPDATE SET name = excluded.name, symbol = excluded.symbol`,
        [code, name, this.newSymbol().trim() || code],
      );

      this.currencies.set(await this.database.driver.query<{ code: string; name: string }>(
        'SELECT code, name FROM currencies ORDER BY code'));

      this.currency.set(code);
      this.addingCurrency.set(false);
      this.newCode.set('');
      this.newName.set('');
      this.newSymbol.set('');
      this.error.set('');
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : String(error));
    }
  }

  onIcon(choice: IconChoice): void {
    this.builtinIcon.set(choice.builtin_icon);
    this.customIconId.set(choice.custom_icon_id);
  }

  pickDate(value: string | null): void {
    if (value) {
      const iso = value.slice(0, 10);
      if (this.showDate() === 'opened') this.openedOn.set(iso);
      else this.limitEffectiveOn.set(iso);
    }
    this.showDate.set(null);
  }

  dateLabel(iso: string): string {
    const [year, month, day] = iso.split('-').map(Number);
    return `${day} ${monthName(new Date(year, month - 1, day), this.i18n.dateLocale())} ${year}`;
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
        include_in_net_worth: this.includeInNetWorth(),
        opening_balance_minor: this.openingBalance().minor,
        opened_on: this.openedOn(),
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
      }

      this.database.dataChanged();
      this.saved.emit();
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : String(error));
    } finally {
      this.saving.set(false);
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
}

function todayIso(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}
