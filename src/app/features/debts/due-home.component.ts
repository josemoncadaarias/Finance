/**
 * Inicio's "Esta semana" (mockup `11o`; Jose, 2026-10-02): a card's statement
 * or a loan's installment that is late or falls due within seven days, one
 * row each, saying what it is on a small line of its own - as the caps and
 * goals beside it do. Nothing at all when nothing is due. A row opens the
 * card's or the loan's page, where "Pagar" is.
 */

import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { IonIcon } from '@ionic/angular';

import { DatabaseService } from '../../core/database/database.service';
import type { AccountRow } from '../../core/database/types';
import { I18nService } from '../../core/i18n/i18n.service';
import type { TranslationKey } from '../../core/i18n/translations';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { isoDay } from '../../core/filters/period';
import { loadCards } from '../../core/cards/card-data';
import { LoansRepository } from '../../core/loans/loans.repository';
import { loanSchedule } from '../../core/loans/schedule';
import { dueSoon, type DueItem } from '../../core/debts/due-soon';
import { BadgeComponent } from '../../shared/ui/badge.component';
import { plain, shortDate } from './card-words';

interface DueRow { item: DueItem; account: AccountRow }

@Component({
  selector: 'app-due-home',
  standalone: true,
  imports: [TranslatePipe, BadgeComponent, IonIcon],
  template: `
    @if (rows().length > 0) {
      <div class="ui-list">
        @for (r of rows(); track r.item.kind + r.item.id) {
          <button type="button" class="ui-row" (click)="open(r)">
            <app-badge shape="ci" [size]="40" [builtin]="r.account.builtin_icon" [customId]="r.account.custom_icon_id"
                       [tone]="r.account.color" [seed]="r.account.id" [fallback]="r.item.kind === 'card' ? 'card' : 'cash'"></app-badge>
            <span class="ui-tx">
              <span class="kind" [class.late]="r.item.overdue">{{ kindOf(r.item) | t }}</span>
              <b class="ui-one">{{ r.account.name }}</b>
              <small class="wrap" [class.late]="r.item.overdue">{{ lineOf(r.item) }}</small>
            </span>
            <ion-icon class="ui-chev" name="chevron-forward-outline"></ion-icon>
          </button>
        }
      </div>
    }
  `,
  styles: [`
    :host { display: block; }
    :host:has(.ui-list) { margin-bottom: 10px; }
    .ui-tx { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
    small { color: var(--app-mu); font-size: 13px; }
    small.late { color: var(--app-red); }
    .kind {
      font-size: 11px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase;
      display: flex; align-items: center; gap: 5px; color: var(--app-yel);
    }
    .kind::before { content: ''; width: 7px; height: 7px; border-radius: 50%; background: currentColor; flex: none; }
    .kind.late { color: var(--app-red); }
  `],
})
export class DueHomeComponent {
  private readonly database = inject(DatabaseService);
  private readonly i18n = inject(I18nService);
  private readonly router = inject(Router);

  private readonly loaded = signal<{ items: DueItem[]; accounts: Map<number, AccountRow> }>({ items: [], accounts: new Map() });

  readonly rows = computed<DueRow[]>(() => {
    const { items, accounts } = this.loaded();
    return items.flatMap(item => {
      const account = accounts.get(item.id);
      return account ? [{ item, account }] : [];
    });
  });

  constructor() {
    effect(() => {
      this.database.dataVersion();
      if (this.database.status() !== 'ready') return;
      void untracked(() => this.load());
    });
  }

  private async load(): Promise<void> {
    const today = isoDay(new Date());
    const [cards, loans] = await Promise.all([
      loadCards(this.database.driver, today),
      new LoansRepository(this.database.driver).all(),
    ]);
    const open = loans.filter(l => !l.account.archived);
    const accounts = new Map<number, AccountRow>([...cards.map(c => [c.account.id, c.account] as const), ...open.map(l => [l.account.id, l.account] as const)]);
    const items = dueSoon(
      cards.map(c => ({ id: c.account.id, currency: c.account.currency_code, statement: c.statement })),
      open.map(l => {
        const s = loanSchedule(l.terms, l.payments, today);
        return { id: l.account.id, installments: l.terms.installments, next: s.next, done: s.done };
      }),
      today);
    this.loaded.set({ items, accounts });
  }

  kindOf(item: DueItem): TranslationKey {
    if (item.kind === 'card') return item.overdue ? 'home.kind.cardLate' : 'home.kind.card';
    return item.overdue ? 'home.kind.loanLate' : 'home.kind.loan';
  }

  lineOf(item: DueItem): string {
    const amount = plain(item.amountMinor, item.currency);
    const what = item.kind === 'card'
      ? this.i18n.t('home.due.card', { amount })
      : this.i18n.t('home.due.loan', { number: item.number ?? 0, of: item.of ?? 0, amount });
    return `${what} · ${this.when(item)}`;
  }

  private when(item: DueItem): string {
    const date = shortDate(item.dueOn, this.i18n);
    if (item.daysLeft === 0) return this.i18n.t('home.due.today');
    if (item.daysLeft === 1) return this.i18n.t('home.due.tomorrow');
    if (item.daysLeft === -1) return this.i18n.t('home.due.yesterday');
    if (item.daysLeft < 0) return this.i18n.t('home.due.late', { date, count: -item.daysLeft });
    return this.i18n.t('home.due.in', { date, count: item.daysLeft });
  }

  open(r: DueRow): void {
    void this.router.navigate(r.item.kind === 'card' ? ['/debts', r.item.id] : ['/debts/loan', r.item.id]);
  }
}
