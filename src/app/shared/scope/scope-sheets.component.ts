/**
 * Choosing what is being looked at: which dates, which account.
 *
 * The two sheets, and the account editor they lead to, in one place. They
 * began on the summary screen; the financial summary needs exactly the same
 * two questions asked exactly the same way, and a second copy of a period
 * picker is a second copy that drifts. The buttons that OPEN them stay with
 * each screen - the summary has room for an account with its icon and a
 * stepper across the top, a narrower screen may not - but what opens is one
 * thing with one definition.
 *
 * It answers to `FilterService`, which is where the period and the account
 * live for the whole app, so a screen using this needs no state of its own.
 *
 *     <app-scope-sheets #scope></app-scope-sheets>
 *     <button (click)="scope.openAccounts()">…</button>
 */

import { Component, computed, inject, signal } from '@angular/core';
import {
  IonModal, IonHeader, IonToolbar, IonButtons, IonButton, IonIcon, IonContent,
  IonList, IonItem, IonLabel, IonBadge, IonRadio, IonRadioGroup, IonDatetime, IonToggle,
} from '@ionic/angular';

import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { FilterService } from '../../core/filters/filter.service';
import { PERIOD_KINDS, monthName, rangePeriod } from '../../core/filters/period';
import { MovementsStore } from '../../features/movements/movements.store';
import { AccountEditorComponent } from '../../features/accounts/account-editor.component';
import { IconComponent } from '../../core/icons/icon.component';
import { todayIso } from '../../core/yields/days';
import type { AccountRow } from '../../core/database/types';

@Component({
  selector: 'app-scope-sheets',
  templateUrl: './scope-sheets.component.html',
  styleUrls: ['./scope-sheets.component.scss'],
  imports: [
    TranslatePipe, IconComponent, AccountEditorComponent,
    IonModal, IonHeader, IonToolbar, IonButtons, IonButton, IonIcon, IonContent,
    IonList, IonItem, IonLabel, IonBadge, IonRadio, IonRadioGroup, IonDatetime, IonToggle,
  ],
})
export class ScopeSheetsComponent {
  readonly filter = inject(FilterService);
  readonly store = inject(MovementsStore);
  readonly i18n = inject(I18nService);

  readonly periodKinds = PERIOD_KINDS;
  readonly today = todayIso();

  readonly showPeriodSheet = signal(false);
  readonly showAccountSheet = signal(false);

  /** Non-null while an account is being edited from the picker. */
  readonly editingAccount = signal<AccountRow | null>(null);

  /**
   * Whether the two date pickers are showing.
   *
   * Its own state, not read from the period. The period only becomes a range
   * once both dates exist, so keying the pickers off `period().kind === 'range'`
   * meant they appeared only after they had already been used - which is to
   * say never.
   */
  readonly choosingRange = signal(false);
  readonly rangeSide = signal<'from' | 'to'>('from');
  readonly rangeStart = signal<string | null>(null);
  readonly rangeEnd = signal<string | null>(null);

  openPeriod(): void {
    this.showPeriodSheet.set(true);
  }

  openAccounts(): void {
    this.showAccountSheet.set(true);
  }

  readonly accountLabel = computed(() =>
    this.store.selectedAccount()?.name ?? this.i18n.t('summary.allAccounts'));

  /**
   * The accounts worth offering.
   *
   * Archived ones are not: an account is archived precisely to say it is over,
   * and a picker that keeps offering it is a list that grows for ever with
   * things nobody will choose. The one exception is an archived account that
   * is currently in force - it has to be in the list it is selected in, or
   * the list is telling a different story from the screen behind it.
   */
  readonly selectable = computed(() => {
    const chosen = this.filter.accountId();
    return this.store.accounts()
      .filter(account => account.archived === 0 || account.id === chosen)
      .sort((a, b) => a.name.localeCompare(b.name));
  });

  /**
   * Brings the account in force into view when the picker opens.
   *
   * Marking it is not enough on its own: with twenty accounts the mark can be
   * three screens down, and a list that has to be searched for the answer is
   * the same problem as no answer. Waiting for `didPresent` matters - during
   * the animation the row has no final position to scroll to.
   */
  revealSelectedAccount(): void {
    const id = this.filter.accountId();
    document.getElementById(`account-option-${id ?? 'all'}`)?.scrollIntoView({ block: 'center' });
  }

  pickAccount(id: number | null): void {
    this.filter.selectAccount(id);
    this.showAccountSheet.set(false);
  }

  editAccount(account: AccountRow): void {
    this.showAccountSheet.set(false);
    this.editingAccount.set(account);
  }

  onAccountSaved(): void {
    this.editingAccount.set(null);
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

  /** One end of the range, as it reads on its button. */
  dayShown(iso: string | null): string {
    return iso ? this.dayLabel(iso.slice(0, 10)) : '—';
  }

  private dayLabel(iso: string): string {
    const [year, month, day] = iso.split('-').map(Number);
    return `${day} ${monthName(new Date(year, month - 1, day), this.i18n.dateLocale())} ${year}`;
  }
}
