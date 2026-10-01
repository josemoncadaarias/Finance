/**
 * A loan's form, new or corrected (mockups 13c, 13d; debts, part 2).
 *
 * The rate is typed as the bank says it, E.A. or M.V., and kept as E.A.;
 * the installment is worked out and can be compared with the one the bank
 * states (rule 7: both are kept). A loan begun before the app counts its
 * installments already due as paid, without writing a movement for any of
 * them; what is owed after them is worked out and can be corrected.
 */

import { Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { IonIcon } from '@ionic/angular';

import { DatabaseService } from '../../core/database/database.service';
import { AccountsRepository } from '../../core/database/repositories/accounts.repository';
import type { AccountRow } from '../../core/database/types';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { isoDay } from '../../core/filters/period';
import { LoansRepository, type LoanInput, type LoanRow } from '../../core/loans/loans.repository';
import {
  EA_SCALE, dueBy, eaFromMonthly, firstInstallment, monthlyFromEa, theoreticalBalance, type LoanTerms,
} from '../../core/loans/schedule';
import { BadgeComponent } from '../../shared/ui/badge.component';
import { ConfirmComponent } from '../../shared/confirm/confirm.component';
import { AmountBuffer } from '../entry/amount-buffer';
import { plain } from './card-words';

/** The faces a loan can wear, each with its colour. */
export const LOAN_FACES: [string, string][] = [
  ['cash-outline', '#9b7bff'], ['car-sport-outline', '#4cb8f5'], ['home-outline', '#ff9152'],
  ['school-outline', '#34c98b'], ['briefcase-outline', '#f6b93b'],
];

@Component({
  selector: 'app-loan-editor',
  templateUrl: './loan-editor.component.html',
  styleUrls: ['./loan-editor.component.scss'],
  imports: [TranslatePipe, BadgeComponent, ConfirmComponent, IonIcon],
})
export class LoanEditorComponent implements OnInit {
  private readonly database = inject(DatabaseService);
  private readonly i18n = inject(I18nService);

  readonly editing = input<LoanRow | null>(null);
  readonly saved = output<number>();
  readonly cancelled = output<void>();
  readonly deleted = output<void>();

  readonly faces = LOAN_FACES;
  readonly today = isoDay(new Date());

  readonly name = signal('');
  readonly face = signal(LOAN_FACES[0]);
  readonly principal = signal(new AmountBuffer());
  readonly rateText = signal('');
  readonly rateQuoted = signal<'ea' | 'mv'>('ea');
  readonly rateKind = signal<'fixed' | 'variable'>('fixed');
  readonly system = signal<'fixed_installment' | 'constant_capital'>('fixed_installment');
  readonly installments = signal('');
  readonly periodMonths = signal(1);
  readonly disbursedOn = signal(this.today);
  readonly firstDueOn = signal(addMonth(this.today));
  readonly insuranceKind = signal<'fixed' | 'balance'>('fixed');
  readonly insurance = signal(new AmountBuffer());
  readonly insuranceRateText = signal('');
  readonly bankInstallment = signal(new AmountBuffer());
  readonly paidFrom = signal<number | null>(null);
  readonly paidBeforeText = signal<string | null>(null);
  readonly balanceStated = signal(new AmountBuffer());
  readonly newRateFrom = signal(this.today);
  readonly newRateText = signal('');

  readonly payers = signal<AccountRow[]>([]);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly confirmingDelete = signal(false);

  readonly isNew = computed(() => this.editing() === null);

  /** The typed rate, as E.A. scaled, whichever way it was typed. */
  readonly annualRateScaled = computed(() => {
    const typed = percentScaled(this.rateText());
    if (typed === null) return null;
    return this.rateQuoted() === 'ea' ? typed : eaFromMonthly(typed);
  });

  /** "Es 1,2808 % cada mes" or "Equivale a 16,50 % E.A.". */
  readonly rateLine = computed(() => {
    const ea = this.annualRateScaled();
    if (ea === null) return '';
    return this.rateQuoted() === 'ea'
      ? this.i18n.t('loans.form.rate.monthly', { rate: percentText(monthlyFromEa(ea), 4) })
      : this.i18n.t('loans.form.rate.annual', { rate: percentText(ea, 2) });
  });

  readonly count = computed(() => {
    const n = Number(this.installments());
    return Number.isInteger(n) && n >= 1 && n <= 600 ? n : null;
  });

  /** The terms as typed, or null while something is missing. */
  readonly terms = computed<LoanTerms | null>(() => {
    const ea = this.annualRateScaled();
    const n = this.count();
    if (ea === null || n === null || this.principal().minor <= 0) return null;
    if (this.firstDueOn() <= this.disbursedOn()) return null;
    return {
      principalMinor: this.principal().minor,
      system: this.system(),
      installments: n,
      periodMonths: this.periodMonths(),
      disbursedOn: this.disbursedOn(),
      firstDueOn: this.firstDueOn(),
      insuranceKind: this.insuranceKind(),
      insuranceMinor: this.insuranceKind() === 'fixed' ? this.insurance().minor : 0,
      insuranceRateScaled: this.insuranceKind() === 'balance' ? (percentScaled(this.insuranceRateText()) ?? 0) : 0,
      bankInstallmentMinor: this.bankInstallment().minor > 0 ? this.bankInstallment().minor : null,
      paidBefore: 0,
      balanceAfterBeforeMinor: null,
      rates: [{ validFrom: this.disbursedOn(), annualRateScaled: ea }],
    };
  });

  /** The installment worked out: capital and interest, and insurance on top. */
  readonly worked = computed(() => {
    const terms = this.terms();
    if (!terms) return null;
    const first = firstInstallment(terms);
    return { ...first, totalMinor: first.paymentMinor + first.insuranceMinor };
  });

  readonly bankLine = computed(() => {
    const worked = this.worked();
    const bank = this.bankInstallment().minor;
    if (!worked || bank <= 0) return '';
    const gap = bank - worked.totalMinor;
    if (Math.abs(gap) < 100) return this.i18n.t('loans.form.bank.matches');
    return this.i18n.t('loans.form.bank.gap', { amount: plain(Math.abs(gap)), sign: gap > 0 ? '+' : '−' });
  });

  /** Installments already due by today: a loan begun before the app. */
  readonly dueAlready = computed(() => {
    const terms = this.terms();
    return terms ? dueBy(terms, this.today) : 0;
  });

  readonly paidBefore = computed(() => {
    const typed = this.paidBeforeText();
    if (typed === null) return this.dueAlready();
    const n = Number(typed);
    return Number.isInteger(n) && n >= 0 && n <= (this.count() ?? 0) ? n : this.dueAlready();
  });

  readonly owedWorked = computed(() => {
    const terms = this.terms();
    return terms && this.paidBefore() > 0 ? theoreticalBalance(terms, this.paidBefore()) : null;
  });

  readonly laterRates = computed(() => (this.editing()?.terms.rates ?? []).slice(1));

  readonly missing = computed<string | null>(() => {
    if (this.name().trim() === '') return this.i18n.t('loans.need.name');
    if (this.principal().minor <= 0) return this.i18n.t('loans.need.principal');
    if (this.annualRateScaled() === null) return this.i18n.t('loans.need.rate');
    if (this.count() === null) return this.i18n.t('loans.need.count');
    if (this.firstDueOn() <= this.disbursedOn()) return this.i18n.t('loans.need.dates');
    return null;
  });

  async ngOnInit(): Promise<void> {
    const accounts = await new AccountsRepository(this.database.driver).list();
    const loanIds = new Set(await new LoansRepository(this.database.driver).ids());
    // A loan in pesos is paid from an account in pesos.
    this.payers.set(accounts.filter(a => a.type !== 'credit' && a.currency_code === 'COP' && !loanIds.has(a.id)));

    const loan = this.editing();
    if (!loan) {
      this.paidFrom.set((this.payers().find(a => a.type === 'debit') ?? this.payers()[0])?.id ?? null);
      return;
    }
    const t = loan.terms;
    this.name.set(loan.account.name);
    this.face.set(LOAN_FACES.find(f => f[0] === loan.account.builtin_icon) ?? [loan.account.builtin_icon ?? 'cash-outline', loan.account.color]);
    this.principal.set(AmountBuffer.from(t.principalMinor));
    this.rateQuoted.set(loan.rateQuoted);
    const ea = t.rates[0]?.annualRateScaled ?? 0;
    this.rateText.set(percentText(loan.rateQuoted === 'ea' ? ea : monthlyFromEa(ea), loan.rateQuoted === 'ea' ? 2 : 4));
    this.rateKind.set(loan.rateKind);
    this.system.set(t.system);
    this.installments.set(String(t.installments));
    this.periodMonths.set(t.periodMonths);
    this.disbursedOn.set(t.disbursedOn);
    this.firstDueOn.set(t.firstDueOn);
    this.insuranceKind.set(t.insuranceKind);
    this.insurance.set(AmountBuffer.from(t.insuranceMinor));
    this.insuranceRateText.set(t.insuranceRateScaled ? percentText(t.insuranceRateScaled, 4) : '');
    if (t.bankInstallmentMinor) this.bankInstallment.set(AmountBuffer.from(t.bankInstallmentMinor));
    this.paidFrom.set(loan.paidFromAccountId);
    this.paidBeforeText.set(String(t.paidBefore));
    if (t.balanceAfterBeforeMinor !== null) this.balanceStated.set(AmountBuffer.from(t.balanceAfterBeforeMinor));
  }

  onAmount(which: 'principal' | 'insurance' | 'bank' | 'balance', text: string): void {
    const buffer = new AmountBuffer();
    for (const character of text) {
      if (/[0-9]/.test(character)) buffer.push(character);
      else if (character === ',') buffer.separator();
    }
    ({ principal: this.principal, insurance: this.insurance, bank: this.bankInstallment, balance: this.balanceStated })[which].set(buffer);
  }

  money(minor: number | null): string {
    return minor === null ? '' : plain(minor);
  }

  async save(): Promise<void> {
    const terms = this.terms();
    if (this.missing() !== null || !terms || this.saving()) return;
    this.saving.set(true);
    this.error.set('');
    const input: LoanInput = {
      name: this.name(),
      builtinIcon: this.face()[0],
      color: this.face()[1],
      principalMinor: terms.principalMinor,
      annualRateScaled: this.annualRateScaled()!,
      rateQuoted: this.rateQuoted(),
      rateKind: this.rateKind(),
      system: terms.system,
      installments: terms.installments,
      periodMonths: terms.periodMonths,
      disbursedOn: terms.disbursedOn,
      firstDueOn: terms.firstDueOn,
      insuranceKind: terms.insuranceKind,
      insuranceMinor: terms.insuranceMinor,
      insuranceRateScaled: terms.insuranceRateScaled,
      bankInstallmentMinor: terms.bankInstallmentMinor,
      paidFromAccountId: this.paidFrom(),
      paidBefore: this.paidBefore(),
      balanceAfterBeforeMinor: this.paidBefore() > 0 && this.balanceStated().minor > 0 ? this.balanceStated().minor : null,
    };
    try {
      const loans = new LoansRepository(this.database.driver);
      const loan = this.editing();
      const id = loan ? (await loans.update(loan.account.id, input), loan.account.id) : await loans.create(input);
      const later = percentScaled(this.newRateText());
      if (loan && this.rateKind() === 'variable' && later !== null && this.newRateFrom() > terms.disbursedOn) {
        await loans.setRateFrom(id, this.newRateFrom(), this.rateQuoted() === 'ea' ? later : eaFromMonthly(later));
      }
      this.database.dataChanged();
      this.saved.emit(id);
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : String(error));
    } finally {
      this.saving.set(false);
    }
  }

  async removeRate(validFrom: string): Promise<void> {
    const loan = this.editing();
    if (!loan) return;
    await new LoansRepository(this.database.driver).removeRate(loan.account.id, validFrom);
    this.database.dataChanged();
    this.saved.emit(loan.account.id);
  }

  async remove(): Promise<void> {
    const loan = this.editing();
    if (!loan) return;
    this.saving.set(true);
    try {
      await new AccountsRepository(this.database.driver).deleteWithHistory(loan.account.id);
      this.database.dataChanged();
      this.deleted.emit();
    } finally {
      this.saving.set(false);
      this.confirmingDelete.set(false);
    }
  }

  rateOf(scaled: number): string {
    return percentText(scaled, 2);
  }
}

/** "16,5" or "16.5" percent as a fraction scaled by 1,000,000; null when not a number. */
function percentScaled(text: string): number | null {
  const n = Number(text.trim().replace(',', '.'));
  return text.trim() !== '' && Number.isFinite(n) && n >= 0 ? Math.round(n * EA_SCALE / 100) : null;
}

function percentText(scaled: number, digits: number): string {
  return new Intl.NumberFormat('es-CO', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(scaled * 100 / EA_SCALE);
}

function addMonth(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const at = new Date(Date.UTC(y, m, 1));
  const last = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth() + 1, 0)).getUTCDate();
  return `${at.getUTCFullYear()}-${String(at.getUTCMonth() + 1).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`;
}
