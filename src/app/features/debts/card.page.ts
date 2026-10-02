/**
 * One credit card's page (mockups `12d`-`12i`; debts, part 1, 2026-10-01).
 *
 * Its statement, worked out from its movements (`core/cards/statement.ts`),
 * in whichever state it is: to pay, paid in part, paid, overdue, without its
 * two days, or nothing owed. "Pagar" opens the one transfer form from the
 * account that pays this card most, to the card, with what is left of the
 * statement; the form offers the usual note for that route by itself (Jose,
 * 2026-10-01). Nothing is written until it is saved there.
 *
 * The bank's statement can say another figure (a purchase of the cut-off day
 * it posts later, a fee nobody typed...). The person may type it; it then is
 * the statement, the app's own figure stays beside it with the difference,
 * and "¿Por qué...?" says plainly every reason the two can differ (Jose,
 * 2026-10-02, after his Rappi Card said 34,591.00 and the app 98,606.99).
 */

import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { Location } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { IonContent, IonIcon, IonModal, IonSpinner } from '@ionic/angular';

import { DatabaseService } from '../../core/database/database.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { FilterService } from '../../core/filters/filter.service';
import { ComposeService } from '../../core/ui/compose.service';
import { isoDay } from '../../core/filters/period';
import { clearBankFigure, loadCards, setBankFigure, usualPayer, type CardSummary } from '../../core/cards/card-data';
import { AmountBuffer } from '../entry/amount-buffer';
import { BadgeComponent } from '../../shared/ui/badge.component';
import { AccountEditorComponent } from '../accounts/account-editor.component';
import { longDay, plain, shortDate } from './card-words';

@Component({
  selector: 'app-card',
  templateUrl: './card.page.html',
  styleUrls: ['./card.page.scss'],
  imports: [TranslatePipe, BadgeComponent, AccountEditorComponent, IonContent, IonIcon, IonModal, IonSpinner],
})
export class CardPage {
  private readonly database = inject(DatabaseService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly filter = inject(FilterService);
  private readonly compose = inject(ComposeService);
  private readonly i18n = inject(I18nService);

  private readonly id = Number(this.route.snapshot.paramMap.get('id'));
  readonly card = signal<CardSummary | null | undefined>(undefined);
  readonly editing = signal(false);
  /** The sheet where the bank's figure is typed, and the one explaining why it can differ. */
  readonly typing = signal(false);
  readonly why = signal(false);
  readonly figure = signal(new AmountBuffer());

  /** Every reason the two can differ, then the minimum payment and what to do. */
  readonly reasons = [
    { key: 'cutDay', icon: 'calendar-outline', color: '#4cb8f5' },
    { key: 'pending', icon: 'hourglass-outline', color: '#f6b93b' },
    { key: 'payments', icon: 'swap-horizontal', color: '#6378ff' },
    { key: 'fees', icon: 'receipt-outline', color: '#ef5b66' },
    { key: 'installments', icon: 'layers-outline', color: '#9b7bff' },
    { key: 'foreign', icon: 'globe-outline', color: '#2ec4b6' },
    { key: 'refunds', icon: 'arrow-undo-outline', color: '#34c98b' },
    { key: 'typed', icon: 'create-outline', color: '#ff9152' },
    { key: 'minimum', icon: 'wallet-outline', color: '#8a94a6' },
    { key: 'what', icon: 'bulb-outline', color: '#f6b93b' },
  ];

  readonly s = computed(() => this.card()?.statement ?? null);
  private readonly currency = computed(() => this.card()?.account.currency_code ?? 'COP');

  constructor() {
    effect(() => {
      this.database.dataVersion();
      this.compose.saved();
      if (this.database.status() !== 'ready') return;
      void untracked(() => this.load());
    });
  }

  private async load(): Promise<void> {
    const cards = await loadCards(this.database.driver, isoDay(new Date()));
    this.card.set(cards.find(card => card.account.id === this.id) ?? null);
  }

  money(minor: number): string {
    return plain(minor, this.currency());
  }

  long(iso: string | null): string {
    return iso ? longDay(iso, this.i18n) : '';
  }

  short(iso: string | null): string {
    return iso ? shortDate(iso, this.i18n) : '';
  }

  /** "Corte el 25 · pagas el 10", or what the card is without them. */
  readonly sub = computed(() => {
    const account = this.card()?.account;
    if (!account) return '';
    if (account.statement_day === null || account.due_day === null) return this.i18n.t('cards.kind');
    return this.i18n.t('cards.days', { cut: account.statement_day, due: account.due_day });
  });

  /** "faltan 9 días", "es hoy", "hace 2 días". */
  readonly when = computed(() => {
    const days = this.s()?.daysLeft ?? 0;
    if (days === 0) return this.i18n.t('cards.when.today');
    if (days === 1) return this.i18n.t('cards.when.tomorrow');
    if (days > 1) return this.i18n.t('cards.when.left', { count: days });
    return days === -1 ? this.i18n.t('cards.when.agoOne') : this.i18n.t('cards.when.ago', { count: -days });
  });

  readonly paidPct = computed(() => {
    const s = this.s();
    if (!s || s.statementMinor <= 0) return 0;
    return Math.min(100, Math.round(s.paidMinor / s.statementMinor * 100));
  });

  /** "Tu extracto dice 64.015,99 menos.", and why when the app can tell. */
  readonly bankLines = computed(() => {
    const s = this.s();
    if (!s || s.bankMinor === null) return [];
    const lines = [this.i18n.t('cards.bank.computed', { amount: this.money(s.computedMinor) })];
    const diff = s.differenceMinor;
    lines.push(diff === 0 ? this.i18n.t('cards.bank.same')
      : this.i18n.t(diff > 0 ? 'cards.bank.diffLess' : 'cards.bank.diffMore', { diff: this.money(Math.abs(diff)) }));
    if (diff > 0 && diff === s.cutDayMinor) {
      lines.push(this.i18n.t(s.cutDayCount === 1 ? 'cards.bank.cutDay.one' : 'cards.bank.cutDay',
        { count: s.cutDayCount, date: this.short(s.cutOn) }));
    }
    return lines;
  });

  /** Before any figure is typed: purchases recorded on the cut-off day, which the bank may post later. */
  readonly cutDayHint = computed(() => {
    const s = this.s();
    if (!s || s.bankMinor !== null || s.cutDayCount === 0) return '';
    return this.i18n.t(s.cutDayCount === 1 ? 'cards.bank.hintCutDay.one' : 'cards.bank.hintCutDay',
      { count: s.cutDayCount, amount: this.money(s.cutDayMinor) });
  });

  /** Whether the statement has a cut-off a bank figure can belong to. */
  readonly canType = computed(() => {
    const s = this.s();
    return !!s && s.cutOn !== null && s.state !== 'clear';
  });

  openTyping(): void {
    const s = this.s();
    const buffer = new AmountBuffer();
    if (s?.bankMinor !== null && s?.bankMinor !== undefined) {
      for (const character of plain(s.bankMinor, this.currency())) {
        if (/[0-9]/.test(character)) buffer.push(character);
        else if (character === ',') buffer.separator();
      }
    }
    this.figure.set(buffer);
    this.typing.set(true);
  }

  onFigure(text: string): void {
    const buffer = new AmountBuffer();
    for (const character of text) {
      if (/[0-9]/.test(character)) buffer.push(character);
      else if (character === ',') buffer.separator();
    }
    this.figure.set(buffer);
  }

  async saveFigure(): Promise<void> {
    const cutOn = this.s()?.cutOn;
    if (!cutOn || this.figure().isEmpty) return;
    await setBankFigure(this.database.driver, this.id, cutOn, this.figure().minor);
    this.typing.set(false);
    this.database.dataChanged();
  }

  async resetFigure(): Promise<void> {
    const cutOn = this.s()?.cutOn;
    if (!cutOn) return;
    await clearBankFigure(this.database.driver, this.id, cutOn);
    this.database.dataChanged();
  }

  /** What there is to buy with: the limit less what is owed. */
  readonly available = computed(() => this.card()?.availableMinor ?? null);

  back(): void {
    if (window.history.length > 1) this.location.back();
    else void this.router.navigateByUrl('/debts');
  }

  movements(): void {
    this.filter.selectAccount(this.id);
    void this.router.navigateByUrl('/movements');
  }

  async pay(): Promise<void> {
    const s = this.s();
    if (!s) return;
    const payer = await usualPayer(this.database.driver, this.id);
    const amountMinor = s.remainingMinor > 0 ? s.remainingMinor : s.debtMinor;
    const start = { amountMinor, onDate: isoDay(new Date()), note: '' };
    // From the account that pays it most; with none yet, the form's own
    // route into this card.
    this.compose.open('transfer', payer !== null
      ? { route: { from: payer, to: this.id }, start }
      : { preferredAccountId: this.id, preferredSide: 'to', start });
  }
}
