/**
 * The screen the app opens on: where the money went, in the period and account
 * you are asking about.
 *
 * The donut and the list are two views of one thing, not two screens. The
 * control beside the balance swaps between them, which is how Monefy does it
 * and why it feels quick.
 */

import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonContent, IonHeader, IonToolbar, IonButton, IonButtons, IonIcon,
  IonList, IonItem, IonLabel, IonNote, IonSpinner, IonModal, IonSearchbar,
  IonToggle, IonBadge, IonRadio, IonRadioGroup, IonDatetime, IonFooter, IonMenuButton,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import * as allIcons from 'ionicons/icons';

import { DatabaseService } from '../../core/database/database.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { LanguageButtonComponent } from '../../core/i18n/language-button.component';
import { FilterService } from '../../core/filters/filter.service';
import {
  PERIOD_KINDS, periodLabel, includesToday, rangePeriod, monthName,
} from '../../core/filters/period';
import { MovementsStore } from './movements.store';
import { DonutComponent } from './donut.component';
import { MoneyPipe } from '../../shared/money.pipe';
import { SwipeDirective } from '../../shared/swipe.directive';
import { EntryComponent, type EntryKind, type EntryRequest } from '../entry/entry.component';
import type { Grouping } from './group-movements';
import type { AccountRow, TransactionRow } from '../../core/database/types';
import { AccountEditorComponent } from '../accounts/account-editor.component';
import { outlined } from '../../core/icons/icon-catalog';

@Component({
  selector: 'app-movements',
  templateUrl: './movements.page.html',
  styleUrls: ['./movements.page.scss'],
  imports: [
    CommonModule, FormsModule, MoneyPipe, DonutComponent, SwipeDirective, EntryComponent,
    TranslatePipe, LanguageButtonComponent, AccountEditorComponent,
    IonContent, IonHeader, IonToolbar, IonButton, IonButtons, IonIcon,
    IonList, IonItem, IonLabel, IonNote, IonSpinner, IonModal, IonSearchbar,
    IonToggle, IonBadge, IonRadio, IonRadioGroup, IonDatetime, IonFooter, IonMenuButton,
  ],
})
export class MovementsPage {
  readonly filter = inject(FilterService);
  readonly store = inject(MovementsStore);
  readonly database = inject(DatabaseService);
  readonly i18n = inject(I18nService);

  readonly status = this.database.status;
  readonly periodKinds = PERIOD_KINDS;

  /** The three ways of reading the list, each with its ordering settled. */
  readonly views: { id: Grouping; label: string; icon: string }[] = [
    { id: 'date', label: 'summary.view.date', icon: 'calendar-outline' },
    { id: 'category', label: 'summary.view.category', icon: 'pie-chart-outline' },
    { id: 'largest', label: 'summary.view.largest', icon: 'trending-down-outline' },
  ];

  readonly showPeriodSheet = signal(false);
  readonly showAccountSheet = signal(false);
  readonly showSearch = signal(false);

  /** Icon names arrive with or without their suffix; this settles it. */
  readonly outlined = outlined;

  /** Non-null while the entry screen is open, describing what it is editing. */
  readonly entry = signal<EntryRequest | null>(null);

  /** Non-null while an account is being edited from this screen. */
  readonly editingAccount = signal<AccountRow | null>(null);
  /**
   * Whether the two date pickers are showing.
   *
   * Its own state, not read from the period. The period only becomes a range
   * once both dates exist, so keying the pickers off `period().kind === 'range'`
   * meant they appeared only after they had already been used — which is to
   * say never. That was the bug: picking "entre dos fechas" did nothing at all.
   */
  readonly choosingRange = signal(false);

  readonly rangeStart = signal<string | null>(null);
  readonly rangeEnd = signal<string | null>(null);

  /** Today, so a picker opens somewhere useful rather than in 1970. */
  readonly today = todayIso();

  readonly label = computed(() =>
    periodLabel(this.filter.period(), this.i18n.dateLocale(), this.i18n.t('period.all')));
  readonly atNewest = computed(() => includesToday(this.filter.period()));
  readonly canStep = computed(() => {
    const kind = this.filter.period().kind;
    return kind !== 'all' && kind !== 'range';
  });

  readonly accountLabel = computed(() =>
    this.store.selectedAccount()?.name ?? this.i18n.t('summary.allAccounts'));

  /**
   * The icon standing for what is on screen: the account's own, or the wallet
   * that means all of them.
   *
   * A screen that shows one account's money and one that shows everything look
   * identical otherwise, and the difference changes what every figure below
   * means.
   */
  readonly accountIcon = computed(() =>
    this.store.selectedAccount()?.builtin_icon ?? 'albums-outline');

  /** The line under the name: which currency, or how many accounts are in. */
  readonly accountHint = computed(() => {
    const account = this.store.selectedAccount();
    if (account) {
      const parts = [account.currency_code];
      if (account.type === 'credit') parts.push(this.i18n.t('summary.creditCard'));
      if (!account.include_in_net_worth) parts.push(this.i18n.t('summary.setAside'));
      if (account.archived) parts.push(this.i18n.t('summary.archived'));
      return parts.join(' · ');
    }

    const counted = this.store.accounts()
      .filter(a => !a.archived && (this.filter.includeExcluded() || a.include_in_net_worth === 1))
      .length;
    const hidden = this.filter.includeExcluded() ? 0 : this.store.hiddenCount();

    return hidden === 0
      ? this.i18n.t('summary.accountsCounted', { count: counted })
      : this.i18n.t('summary.accountsWithHidden', { count: counted, hidden });
  });

  /** Selectable accounts: everything, since a single pick ignores the flags. */
  readonly selectable = computed(() =>
    [...this.store.accounts()].sort((a, b) => {
      if (a.archived !== b.archived) return a.archived - b.archived;
      return a.name.localeCompare(b.name);
    }),
  );

  constructor() {
    // Account and category icons come from the user's data, so which names
    // are needed is not known until runtime. Ionicons draws nothing for a name
    // it was never given - which is exactly why the two main buttons rendered
    // as empty circles.
    addIcons(allIcons as unknown as Record<string, string>);
  }

  setGrouping(grouping: Grouping): void {
    this.filter.setView(grouping);
  }

  /** Says what the ordering inside each group is, so it is never a guess. */
  withinNote(): string {
    return this.i18n.t(this.filter.grouping() === 'category'
      ? 'summary.within.category'
      : 'summary.within.date');
  }

  choosePeriod(kind: string): void {
    if (kind === 'range') {
      // The sheet stays open: a range needs two dates before it means
      // anything, and closing would throw away the half-made choice. Seed the
      // two pickers with the period on screen, so "between two dates" starts
      // from what is already being looked at instead of from nothing.
      const current = this.filter.period();
      this.rangeStart.set(this.rangeStart() ?? current.from ?? this.today);
      this.rangeEnd.set(this.rangeEnd() ?? current.to ?? this.today);
      this.choosingRange.set(true);
      return;
    }

    this.choosingRange.set(false);
    this.filter.setPeriodKind(kind as never);
    this.showPeriodSheet.set(false);
  }

  applyRange(): void {
    const from = this.rangeStart();
    const to = this.rangeEnd();
    if (!from || !to) return;

    // Picked back to front is a legitimate mistake, and swapping is friendlier
    // than refusing: an empty range would just look broken.
    const [start, end] = [from.slice(0, 10), to.slice(0, 10)].sort();

    this.filter.period.set(rangePeriod(start, end));
    this.choosingRange.set(false);
    this.showPeriodSheet.set(false);
  }

  /** The range as it currently stands, for the button that applies it. */
  rangeLabel(): string {
    const from = this.rangeStart();
    const to = this.rangeEnd();
    if (!from || !to) return '';

    const [start, end] = [from.slice(0, 10), to.slice(0, 10)].sort();
    return `${this.dayLabel(start)} – ${this.dayLabel(end)}`;
  }

  private dayLabel(iso: string): string {
    const [year, month, day] = iso.split('-').map(Number);
    return `${day} ${monthName(new Date(year, month - 1, day), this.i18n.dateLocale())} ${year}`;
  }

  editAccount(account: AccountRow): void {
    this.showAccountSheet.set(false);
    this.editingAccount.set(account);
  }

  onAccountSaved(): void {
    this.editingAccount.set(null);
  }

  pickAccount(id: number | null): void {
    this.filter.selectAccount(id);
    this.showAccountSheet.set(false);
  }

  /** A flick left or right steps the period, when the period can step. */
  onSwipe(steps: number): void {
    if (this.canStep() && (steps < 0 || !this.atNewest())) {
      this.filter.step(steps);
    }
  }

  add(kind: EntryKind): void {
    this.entry.set({ kind, preferredAccountId: this.filter.accountId() });
  }

  /**
   * Opens a movement for correction.
   *
   * Tapping either leg of a transfer opens the whole transfer — both accounts
   * and both amounts — because that is the act that was recorded. The entry
   * screen rewrites the two legs together; there is no way to change one side
   * on its own, which is what would leave money arriving from nowhere.
   */
  edit(transaction: TransactionRow): void {
    this.entry.set({
      kind: transaction.transfer_id !== null
        ? 'transfer'
        : transaction.amount_minor >= 0 ? 'income' : 'expense',
      editing: transaction,
    });
  }

  onSaved(): void {
    this.entry.set(null);
  }

  closeSearch(): void {
    this.filter.search.set('');
    this.showSearch.set(false);
  }
}

/** Today as an ISO day, in local time. */
function todayIso(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}
