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
  IonContent, IonHeader, IonToolbar, IonTitle, IonButton, IonButtons, IonIcon,
  IonList, IonItem, IonLabel, IonNote, IonSpinner, IonModal, IonSearchbar,
  IonToggle, IonBadge, IonRadio, IonRadioGroup, IonDatetime,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  chevronBackOutline, chevronForwardOutline, searchOutline, closeOutline,
  listOutline, pieChartOutline, calendarOutline, walletOutline, swapHorizontalOutline,
  chevronDownOutline, chevronUpOutline, lockClosedOutline,
} from 'ionicons/icons';

import { DatabaseService } from '../../core/database/database.service';
import { FilterService } from '../../core/filters/filter.service';
import { PERIOD_KINDS, periodLabel, includesToday, rangePeriod } from '../../core/filters/period';
import { MovementsStore } from './movements.store';
import { DonutComponent } from './donut.component';
import { MoneyPipe } from '../../shared/money.pipe';
import { SwipeDirective } from '../../shared/swipe.directive';
import type { Grouping } from './group-movements';

@Component({
  selector: 'app-movements',
  templateUrl: './movements.page.html',
  styleUrls: ['./movements.page.scss'],
  imports: [
    CommonModule, FormsModule, MoneyPipe, DonutComponent, SwipeDirective,
    IonContent, IonHeader, IonToolbar, IonTitle, IonButton, IonButtons, IonIcon,
    IonList, IonItem, IonLabel, IonNote, IonSpinner, IonModal, IonSearchbar,
    IonToggle, IonBadge, IonRadio, IonRadioGroup, IonDatetime,
  ],
})
export class MovementsPage {
  readonly filter = inject(FilterService);
  readonly store = inject(MovementsStore);
  readonly database = inject(DatabaseService);

  readonly status = this.database.status;
  readonly periodKinds = PERIOD_KINDS;

  readonly showPeriodSheet = signal(false);
  readonly showAccountSheet = signal(false);
  readonly showSearch = signal(false);
  readonly rangeStart = signal<string | null>(null);
  readonly rangeEnd = signal<string | null>(null);

  readonly label = computed(() => periodLabel(this.filter.period()));
  readonly atNewest = computed(() => includesToday(this.filter.period()));
  readonly canStep = computed(() => {
    const kind = this.filter.period().kind;
    return kind !== 'all' && kind !== 'range';
  });

  readonly accountLabel = computed(() => this.store.selectedAccount()?.name ?? 'Todas las cuentas');

  /** Selectable accounts: everything, since a single pick ignores the flags. */
  readonly selectable = computed(() =>
    [...this.store.accounts()].sort((a, b) => {
      if (a.archived !== b.archived) return a.archived - b.archived;
      return a.name.localeCompare(b.name);
    }),
  );

  constructor() {
    addIcons({
      chevronBackOutline, chevronForwardOutline, searchOutline, closeOutline,
      listOutline, pieChartOutline, calendarOutline, walletOutline, swapHorizontalOutline,
      chevronDownOutline, chevronUpOutline, lockClosedOutline,
    });
  }

  setGrouping(grouping: Grouping): void {
    this.filter.grouping.set(grouping);
  }

  choosePeriod(kind: string): void {
    if (kind === 'range') {
      // Leave the sheet open: the range needs two dates before it means
      // anything, and closing would throw away the half-made choice.
      return;
    }
    this.filter.setPeriodKind(kind as never);
    this.showPeriodSheet.set(false);
  }

  applyRange(): void {
    const from = this.rangeStart();
    const to = this.rangeEnd();
    if (!from || !to) return;
    this.filter.period.set(rangePeriod(from.slice(0, 10), to.slice(0, 10)));
    this.showPeriodSheet.set(false);
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

  closeSearch(): void {
    this.filter.search.set('');
    this.showSearch.set(false);
  }
}
