/**
 * Cuentas, its Deudas face (mockup `12b`; debts, part 1, 2026-10-01).
 *
 * What is owed today and, card by card, what is used of the limit and what
 * its statement asks for and until when. Loans come in part 2; until then
 * their section says there are none.
 */

import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent, IonIcon, IonModal, IonSpinner } from '@ionic/angular';

import { DatabaseService } from '../../core/database/database.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { AccentService } from '../../core/theme/accent.service';
import { isoDay } from '../../core/filters/period';
import { loadCards, type CardSummary } from '../../core/cards/card-data';
import { AccountsFacesComponent } from '../../shared/ui/accounts-faces.component';
import { BadgeComponent } from '../../shared/ui/badge.component';
import { MoneyPipe } from '../../shared/money.pipe';
import { cardLine, plain, shortDate } from './card-words';
import { LoansRepository, type LoanRow } from '../../core/loans/loans.repository';
import { loanSchedule, type LoanSchedule } from '../../core/loans/schedule';
import { LoanEditorComponent } from './loan-editor.component';
import { AccountEditorComponent } from '../accounts/account-editor.component';

export interface LoanSummary { loan: LoanRow; s: LoanSchedule }

@Component({
  selector: 'app-debts',
  templateUrl: './debts.page.html',
  styleUrls: ['./debts.page.scss'],
  imports: [
    TranslatePipe, MoneyPipe, AccountsFacesComponent, BadgeComponent, LoanEditorComponent, AccountEditorComponent,
    IonContent, IonIcon, IonModal, IonSpinner,
  ],
})
export class DebtsPage {
  private readonly database = inject(DatabaseService);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18nService);
  readonly accent = inject(AccentService);

  readonly cards = signal<CardSummary[] | null>(null);
  readonly loans = signal<LoanSummary[]>([]);
  readonly choosing = signal(false);
  readonly newLoan = signal(false);
  readonly newCard = signal(false);
  private readonly today = isoDay(new Date());

  /** What falls due this month, cards and installments, and how much of it is interest. */
  readonly thisMonth = computed(() => {
    const month = this.today.slice(0, 7);
    let pay = 0;
    let interest = 0;
    for (const card of this.cards() ?? []) {
      const s = card.statement;
      if ((s.state === 'due' || s.state === 'partial' || s.state === 'overdue') && s.dueOn!.slice(0, 7) <= month) pay += s.remainingMinor;
    }
    for (const { s } of this.loans()) {
      for (const r of s.rows) {
        if (r.type !== 'installment' || (r.state !== 'next' && r.state !== 'future' && r.state !== 'overdue')) continue;
        if (r.dueOn.slice(0, 7) > month) continue;
        pay += r.totalMinor;
        interest += r.interestMinor;
      }
    }
    return { pay, interest };
  });

  /** Only pesos are added up; a card in another currency is listed on its own. */
  readonly owedMinor = computed(() => (this.cards() ?? [])
    .filter(card => card.account.currency_code === 'COP')
    .reduce((total, card) => total + card.statement.debtMinor, 0)
    + this.loans().reduce((total, l) => total + l.s.balanceMinor, 0));

  constructor() {
    effect(() => {
      this.database.dataVersion();
      if (this.database.status() !== 'ready') return;
      void untracked(() => this.load());
    });
  }

  private async load(): Promise<void> {
    const [cards, loans] = await Promise.all([
      loadCards(this.database.driver, this.today),
      new LoansRepository(this.database.driver).all(),
    ]);
    this.cards.set(cards);
    this.loans.set(loans.filter(l => !l.account.archived).map(loan => ({ loan, s: loanSchedule(loan.terms, loan.payments, this.today) })));
  }

  loanSub(l: LoanSummary): string {
    return this.i18n.t('loans.list.sub', { owed: plain(l.s.balanceMinor) });
  }

  loanLine(l: LoanSummary): string {
    const n = l.s.next;
    if (l.s.done) return this.i18n.t('loans.done.title');
    if (!n) return '';
    const key = n.state === 'overdue' ? 'loans.list.overdue' : 'loans.list.next';
    return this.i18n.t(key, { number: n.number, of: l.loan.terms.installments, amount: plain(n.totalMinor), date: shortDate(n.dueOn, this.i18n) });
  }

  openLoan(l: LoanSummary): void {
    void this.router.navigate(['/debts/loan', l.loan.account.id]);
  }

  startLoan(): void {
    this.choosing.set(false);
    this.newLoan.set(true);
  }

  startCard(): void {
    this.choosing.set(false);
    this.newCard.set(true);
  }

  onLoanSaved(id: number): void {
    this.newLoan.set(false);
    void this.router.navigate(['/debts/loan', id]);
  }

  used(card: CardSummary): string {
    const limit = card.account.credit_limit_minor;
    const owed = plain(card.statement.debtMinor, card.account.currency_code);
    return limit
      ? this.i18n.t('cards.used', { used: owed, limit: plain(limit, card.account.currency_code) })
      : this.i18n.t('cards.owes', { amount: owed });
  }

  line(card: CardSummary): string {
    return cardLine(card.statement, this.i18n, card.account.currency_code);
  }

  open(card: CardSummary): void {
    void this.router.navigate(['/debts', card.account.id]);
  }
}
