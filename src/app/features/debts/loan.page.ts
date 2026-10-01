/**
 * One loan's page: Resumen | Cuotas | Abonar (mockups 13e-13r, the route in
 * 13s; debts, part 2).
 *
 * Everything on it is worked out by core/loans/schedule.ts from the terms and
 * what was paid. Paying an installment, paying ahead and paying it all open
 * the one transfer form with the payment's split (EntryRequest.loan); nothing
 * is written until it is saved there.
 */

import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { Location } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { IonContent, IonIcon, IonModal, IonSpinner } from '@ionic/angular';

import { DatabaseService } from '../../core/database/database.service';
import { AccountsRepository } from '../../core/database/repositories/accounts.repository';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { fromIsoDay, isoDay } from '../../core/filters/period';
import { ComposeService } from '../../core/ui/compose.service';
import { usualPayer } from '../../core/cards/card-data';
import { LoansRepository, type LoanRow } from '../../core/loans/loans.repository';
import {
  EA_SCALE, loanSchedule, payoffToday, type ExtraRow, type InstallmentRow, type LoanSchedule, type PlannedExtra,
} from '../../core/loans/schedule';
import { BadgeComponent } from '../../shared/ui/badge.component';
import { ConfirmComponent } from '../../shared/confirm/confirm.component';
import { AmountBuffer } from '../entry/amount-buffer';
import { LoanEditorComponent } from './loan-editor.component';
import { longDay, plain, shortDate, uvrText } from './card-words';

type Tab = 'summary' | 'installments' | 'ahead';
type Every = PlannedExtra['every'];

const AMOUNTS = [1_000_000_00, 2_000_000_00, 5_000_000_00, 10_000_000_00];

@Component({
  selector: 'app-loan',
  templateUrl: './loan.page.html',
  styleUrls: ['./loan.page.scss'],
  imports: [TranslatePipe, BadgeComponent, ConfirmComponent, LoanEditorComponent, IonContent, IonIcon, IonModal, IonSpinner],
})
export class LoanPage {
  private readonly database = inject(DatabaseService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly compose = inject(ComposeService);
  private readonly i18n = inject(I18nService);

  private readonly id = Number(this.route.snapshot.paramMap.get('id'));
  readonly today = isoDay(new Date());

  readonly loan = signal<LoanRow | null | undefined>(undefined);
  readonly tab = signal<Tab>('summary');

  /** Cuotas opens on the installment to pay, not on the first of the loan. */
  private readonly toNext = effect(() => {
    if (this.tab() !== 'installments') return;
    setTimeout(() => document.querySelector('app-loan .inst.next, app-loan .inst.late')
      ?.scrollIntoView({ block: 'center' }), 150);
  });
  readonly editing = signal(false);
  readonly filter = signal<'all' | 'left' | 'paid'>('all');
  readonly openYears = signal<Set<string> | null>(null);
  readonly undoing = signal<{ id: number; label: string } | null>(null);
  readonly busy = signal(false);

  // Paying ahead
  readonly amounts = AMOUNTS;
  readonly aheadAmount = signal(new AmountBuffer());
  readonly every = signal<Every>('once');
  readonly payingAll = signal(false);

  readonly schedule = computed<LoanSchedule | null>(() => {
    const loan = this.loan();
    return loan ? loanSchedule(loan.terms, loan.payments, this.today) : null;
  });

  readonly installments = computed(() =>
    (this.schedule()?.rows ?? []).filter((r): r is InstallmentRow => r.type === 'installment'));

  /** A payment ahead the page suggests: about a tenth of what is owed, in round millions. */
  readonly suggested = computed(() => {
    const owed = this.schedule()?.balanceMinor ?? 0;
    const million = 1_000_000_00;
    return Math.max(million / 2, Math.min(10 * million, Math.round(owed / 10 / million) * million));
  });

  readonly suggestion = computed(() => {
    const loan = this.loan();
    const base = this.schedule();
    if (!loan || !base || base.done || base.balanceMinor <= this.suggested()) return null;
    const term = loanSchedule(loan.terms, loan.payments, this.today, { amountMinor: this.suggested(), mode: 'term', every: 'once' });
    return {
      amount: plain(this.suggested()),
      end: this.monthYear(term.lastDueOn),
      fewer: base.totalCount - term.totalCount,
      saves: plain(base.toPayMinor - term.toPayMinor),
    };
  });

  readonly aheadMinor = computed(() => this.aheadAmount().minor);

  /** The three answers side by side: shorter term, lower installment, and nothing ahead. */
  readonly compare = computed(() => {
    const loan = this.loan();
    const base = this.schedule();
    const amount = this.aheadMinor();
    if (!loan || !base || amount <= 0 || base.done) return null;
    const plan = (mode: 'term' | 'installment') =>
      loanSchedule(loan.terms, loan.payments, this.today, { amountMinor: amount, mode, every: this.every() });
    const term = plan('term');
    const lower = plan('installment');
    const installmentAfter = (s: LoanSchedule) => {
      const extra = s.rows.findIndex(r => r.type === 'extra' && r.planned);
      const after = s.rows.slice(extra + 1).find((r): r is InstallmentRow => r.type === 'installment');
      return after?.totalMinor ?? s.installmentMinor;
    };
    const plannedTotal = (s: LoanSchedule) => s.rows
      .filter((r): r is ExtraRow => r.type === 'extra' && r.planned).reduce((t, r) => t + r.amountMinor, 0);
    return {
      base,
      term: { s: term, saves: base.toPayMinor - term.toPayMinor, fewer: base.totalCount - term.totalCount, ahead: plannedTotal(term) },
      lower: { s: lower, saves: base.toPayMinor - lower.toPayMinor, installment: installmentAfter(lower), ahead: plannedTotal(lower) },
    };
  });

  /** How much each round amount saves, once and shortening the term. */
  readonly ladder = computed(() => {
    const loan = this.loan();
    const base = this.schedule();
    if (!loan || !base || base.done) return [];
    return AMOUNTS.filter(a => a < base.balanceMinor).map(amount => {
      const s = loanSchedule(loan.terms, loan.payments, this.today, { amountMinor: amount, mode: 'term', every: 'once' });
      return { amount, end: s.lastDueOn, fewer: base.totalCount - s.totalCount, saves: base.toPayMinor - s.toPayMinor };
    });
  });

  readonly payoff = computed(() => {
    const loan = this.loan();
    return loan ? payoffToday(loan.terms, loan.payments, this.today) : null;
  });

  readonly rateLine = computed(() => {
    const loan = this.loan();
    if (!loan) return '';
    const rates = loan.terms.rates;
    const ea = [...rates].reverse().find(r => r.validFrom <= this.today)?.annualRateScaled ?? rates[0]?.annualRateScaled ?? 0;
    const pct = new Intl.NumberFormat('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(ea * 100 / EA_SCALE);
    return this.i18n.t('loans.head', {
      rate: pct,
      system: (loan.terms.unit === 'UVR' ? 'UVR · ' : '') + this.i18n.t(loan.terms.decreaseScaled
        ? 'loans.system.cyclic.short'
        : loan.terms.system === 'fixed_installment' ? 'loans.system.fixed.short' : 'loans.system.capital.short'),
    });
  });

  /** The installments grouped by year, the year of the next one first open. */
  readonly years = computed(() => {
    const filter = this.filter();
    const groups = new Map<string, (InstallmentRow | ExtraRow)[]>();
    for (const row of this.schedule()?.rows ?? []) {
      if (row.type === 'installment') {
        const done = row.state === 'paid' || row.state === 'before';
        if (filter === 'left' && done) continue;
        if (filter === 'paid' && !done) continue;
      } else if (row.planned) continue;
      const year = (row.type === 'installment' ? row.dueOn : row.paidOn).slice(0, 4);
      if (!groups.has(year)) groups.set(year, []);
      groups.get(year)!.push(row);
    }
    return [...groups.entries()].map(([year, rows]) => {
      const inst = rows.filter((r): r is InstallmentRow => r.type === 'installment');
      return {
        year, rows,
        count: inst.length,
        interest: inst.reduce((s, r) => s + r.interestMinor, 0),
        extras: rows.length - inst.length,
      };
    });
  });

  constructor() {
    effect(() => {
      this.database.dataVersion();
      this.compose.saved();
      if (this.database.status() !== 'ready') return;
      void untracked(() => this.load());
    });
  }

  private async load(): Promise<void> {
    const loans = await new LoansRepository(this.database.driver).all();
    this.loan.set(loans.find(l => l.account.id === this.id) ?? null);
    if (this.aheadAmount().isEmpty) this.aheadAmount.set(AmountBuffer.from(this.suggested()));
  }

  // ------------------------------------------------------------ words
  /** A loan in UVR: what the UVR adds to the capital, in pesos, by the time it is paid (projected). */
  uvrGrowth(s: LoanSchedule): number {
    return Math.max(0, s.toPayMinor - s.interestLeftMinor - s.insuranceLeftMinor - s.balanceMinor);
  }

  /** A UVR figure, four decimals unless said. */
  uvr(value: number, digits = 4): string {
    return uvrText(value, digits);
  }

  money(minor: number | null | undefined): string {
    return plain(Math.round(minor ?? 0));
  }

  long(iso: string | null | undefined): string {
    return iso ? longDay(iso, this.i18n) : '';
  }

  short(iso: string | null | undefined): string {
    return iso ? shortDate(iso, this.i18n) : '';
  }

  monthYear(iso: string | null | undefined): string {
    return iso ? fromIsoDay(iso).toLocaleDateString(this.i18n.dateLocale(), { month: 'short', year: 'numeric' }).replace('.', '').replace(' de ', ' ') : '';
  }

  when(iso: string): string {
    const days = Math.round((fromIsoDay(iso).getTime() - fromIsoDay(this.today).getTime()) / 86_400_000);
    if (days === 0) return this.i18n.t('cards.when.today');
    if (days === 1) return this.i18n.t('cards.when.tomorrow');
    if (days > 1) return this.i18n.t('cards.when.left', { count: days });
    return days === -1 ? this.i18n.t('cards.when.agoOne') : this.i18n.t('cards.when.ago', { count: -days });
  }

  stateIcon(state: InstallmentRow['state']): string {
    if (state === 'paid' || state === 'before') return 'checkmark-circle';
    return state === 'overdue' ? 'alert-circle' : 'ellipse-outline';
  }

  /** A round figure with no cents, for amounts the person picks. */
  whole(minor: number): string {
    return new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(minor / 100);
  }

  fewerLine(count: number): string {
    return count === 1 ? this.i18n.t('loans.ladder.fewerOne') : this.i18n.t('loans.ladder.fewer', { count });
  }

  millions(minor: number): number {
    return minor / 100_000_000;
  }

  share(part: number): number {
    const principal = this.loan()?.terms.principalMinor ?? 0;
    return principal > 0 ? Math.max(0, Math.min(100, part / principal * 100)) : 0;
  }

  shareOfPrincipal(part: number): number {
    return Math.round(this.share(part));
  }

  // ------------------------------------------------------------ actions
  back(): void {
    if (window.history.length > 1) this.location.back();
    else void this.router.navigateByUrl('/debts');
  }

  isOpen(year: string, index: number): boolean {
    const open = this.openYears();
    if (open) return open.has(year);
    const nextYear = this.schedule()?.next?.dueOn.slice(0, 4);
    return nextYear ? year === nextYear : index === 0;
  }

  toggleYear(year: string, index: number): void {
    const open = new Set(this.openYears() ?? this.years().filter((y, i) => this.isOpen(y.year, i)).map(y => y.year));
    if (open.has(year)) open.delete(year); else open.add(year);
    this.openYears.set(open);
  }

  pickAmount(minor: number): void {
    this.aheadAmount.set(AmountBuffer.from(minor));
  }

  onAhead(text: string): void {
    const buffer = new AmountBuffer();
    for (const character of text) {
      if (/[0-9]/.test(character)) buffer.push(character);
      else if (character === ',') buffer.separator();
    }
    this.aheadAmount.set(buffer);
  }

  toAhead(): void {
    this.aheadAmount.set(AmountBuffer.from(this.suggested()));
    this.tab.set('ahead');
  }

  private async payer(): Promise<number | null> {
    const loan = this.loan();
    if (!loan) return null;
    const accounts = await new AccountsRepository(this.database.driver).list();
    if (loan.paidFromAccountId !== null && accounts.some(a => a.id === loan.paidFromAccountId)) return loan.paidFromAccountId;
    return usualPayer(this.database.driver, loan.account.id);
  }

  private async open(amountMinor: number, entry: { kind: 'installment' | 'extra' | 'payoff'; number: number | null; title: string; interestMinor: number; insuranceMinor: number; mode: 'term' | 'installment' | null }): Promise<void> {
    const loan = this.loan();
    if (!loan) return;
    const from = await this.payer();
    const start = { amountMinor, onDate: this.today, note: '' };
    const request = { start, loan: { accountId: loan.account.id, ...entry } };
    this.compose.open('transfer', from !== null
      ? { ...request, route: { from, to: loan.account.id } }
      : { ...request, preferredAccountId: loan.account.id, preferredSide: 'to' });
  }

  async payInstallment(): Promise<void> {
    const next = this.schedule()?.next;
    const loan = this.loan();
    if (!next || !loan) return;
    await this.open(next.totalMinor, {
      kind: 'installment', number: next.number,
      title: this.i18n.t('loans.pay.title', { number: next.number, of: loan.terms.installments }),
      interestMinor: next.interestMinor, insuranceMinor: next.insuranceMinor, mode: null,
    });
  }

  async payAhead(mode: 'term' | 'installment'): Promise<void> {
    const amount = this.aheadMinor();
    if (amount <= 0) return;
    await this.open(amount, {
      kind: 'extra', number: null, title: this.i18n.t('loans.ahead.title'), interestMinor: 0, insuranceMinor: 0, mode,
    });
  }

  async payEverything(): Promise<void> {
    const p = this.payoff();
    if (!p) return;
    await this.open(p.totalMinor, {
      kind: 'payoff', number: null, title: this.i18n.t('loans.payoff.title'), interestMinor: p.interestMinor, insuranceMinor: 0, mode: null,
    });
  }

  askUndo(row: InstallmentRow | ExtraRow): void {
    const loan = this.loan();
    if (!loan) return;
    const payment = row.type === 'installment'
      ? loan.payments.find(p => p.kind === 'installment' && p.number === row.number)
      : loan.payments.find(p => p.kind !== 'installment' && p.paidOn === row.paidOn && p.capitalMinor === row.amountMinor);
    if (!payment) return;
    this.undoing.set({
      id: payment.id,
      label: row.type === 'installment'
        ? this.i18n.t('loans.undo.installment', { number: row.number })
        : this.i18n.t('loans.undo.ahead', { amount: this.money(row.amountMinor) }),
    });
  }

  async undo(): Promise<void> {
    const undoing = this.undoing();
    if (!undoing) return;
    this.busy.set(true);
    try {
      await new LoansRepository(this.database.driver).deletePayment(undoing.id);
      this.database.dataChanged();
    } finally {
      this.busy.set(false);
      this.undoing.set(null);
    }
  }

  async archive(): Promise<void> {
    const loan = this.loan();
    if (!loan) return;
    await new AccountsRepository(this.database.driver).update(loan.account.id, { archived: true });
    this.database.dataChanged();
    void this.router.navigateByUrl('/debts', { replaceUrl: true });
  }

  onDeleted(): void {
    this.editing.set(false);
    void this.router.navigateByUrl('/debts', { replaceUrl: true });
  }
}
