/**
 * Cuentas, its Deudas face (mockup `12b`; debts, part 1, 2026-10-01).
 *
 * What is owed today and, card by card, what is used of the limit and what
 * its statement asks for and until when. Loans come in part 2; until then
 * their section says there are none.
 */

import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent, IonIcon, IonSpinner } from '@ionic/angular';

import { DatabaseService } from '../../core/database/database.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { AccentService } from '../../core/theme/accent.service';
import { isoDay } from '../../core/filters/period';
import { loadCards, type CardSummary } from '../../core/cards/card-data';
import { AccountsFacesComponent } from '../../shared/ui/accounts-faces.component';
import { BadgeComponent } from '../../shared/ui/badge.component';
import { MoneyPipe } from '../../shared/money.pipe';
import { cardLine, plain } from './card-words';

@Component({
  selector: 'app-debts',
  templateUrl: './debts.page.html',
  styleUrls: ['./debts.page.scss'],
  imports: [TranslatePipe, MoneyPipe, AccountsFacesComponent, BadgeComponent, IonContent, IonIcon, IonSpinner],
})
export class DebtsPage {
  private readonly database = inject(DatabaseService);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18nService);
  readonly accent = inject(AccentService);

  readonly cards = signal<CardSummary[] | null>(null);

  /** Only pesos are added up; a card in another currency is listed on its own. */
  readonly owedMinor = computed(() => (this.cards() ?? [])
    .filter(card => card.account.currency_code === 'COP')
    .reduce((total, card) => total + card.statement.debtMinor, 0));

  constructor() {
    effect(() => {
      this.database.dataVersion();
      if (this.database.status() !== 'ready') return;
      void untracked(() => this.load());
    });
  }

  private async load(): Promise<void> {
    this.cards.set(await loadCards(this.database.driver, isoDay(new Date())));
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
