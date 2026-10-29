/**
 * What needs attention on Inicio, one line (mockups `49a`, `49f`; Jose,
 * 2026-10-29: "demasiada info junta"): "2 pagos por hacer · 3 topes pasados",
 * red only when something is late or passed; a tap opens the rows in a sheet.
 *
 * Before that: folded into one line (mockups `23b`, `23c`;
 * Jose, 2026-10-11, option A). "Esta semana" (cards and loans due) and the
 * caps and goals used to stack above the balance, and with several of them the
 * chart and the movements fell below the screen. Now one card says how many
 * and of what kind - "4 pendientes · 2 pagos · 1 tope · 1 meta" - and opens to
 * the same rows as before. Folded by default; the person's choice is kept on
 * the device. Nothing at all when nothing is pending.
 *
 * The rows themselves are still `app-due-home` and `app-limits-home`, kept in
 * the page while folded (hidden) so their counts are always at hand.
 */

import { input } from '@angular/core';
import { Component, computed, effect, inject, signal, viewChild } from '@angular/core';
import { IonIcon, IonModal } from '@ionic/angular';
import { I18nService } from '../../core/i18n/i18n.service';

import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { LimitsService } from '../../core/limits/limits.service';
import { GoalsService } from '../../core/goals/goals.service';
import { TourService } from '../../core/tour/tour.service';
import { DueHomeComponent } from '../debts/due-home.component';
import { LimitsHomeComponent } from '../plans/limits-home.component';
import { RemindersHomeComponent } from '../reminders/reminders-home.component';
import { RemindersService } from '../../core/reminders/reminders.service';

@Component({
  selector: 'app-attention-home',
  standalone: true,
  // Hidden from "Personaliza tu vista", it still shows a payment already late
  // or a cap gone over (31f): those are never kept quiet.
  host: { '[hidden]': '(onlyUrgent() && !urgent()) || total() === 0' },
  imports: [TranslatePipe, IonIcon, IonModal, DueHomeComponent, LimitsHomeComponent, RemindersHomeComponent],
  template: `
    @if (total() > 0) {
      <!-- One line (49a): what is pending, red only when something is late or passed. -->
      <button type="button" class="ui-card bar" [class.red]="urgent()" data-tour="attention" (click)="open.set(true)">
        <span class="dot"></span>
        <b>{{ line() }}</b>
        <ion-icon class="ui-chev" name="chevron-forward-outline"></ion-icon>
      </button>
    }
    <!-- The rows as they always were, in a sheet (49f). Kept mounted so their
         counts are at hand while it is closed. -->
    <ion-modal [initialBreakpoint]="1" [breakpoints]="[0, 1]" [handle]="false" class="ui-sheet"
               [keepContentsMounted]="true" [isOpen]="open()" (didDismiss)="open.set(false)">
      <ng-template>
        <div class="ui-sheet-body ion-content-scroll-host attention-sheet">
          <button type="button" class="sheet-cancel" (click)="open.set(false)">{{ 'entry.cancel' | t }}</button>
          <div class="grab"></div>
          <h2 class="center">{{ 'home.attention.sheet' | t }}</h2>
          <div class="rows" (click)="leave($event)">
            <app-due-home></app-due-home>
            <app-reminders-home></app-reminders-home>
            <app-limits-home></app-limits-home>
          </div>
        </div>
      </ng-template>
    </ion-modal>
  `,
  styles: [`
    :host { display: block; }
    :host([hidden]) { display: none; }
    .bar {
      display: flex; align-items: center; gap: 10px; width: 100%; text-align: left;
      font: inherit; color: inherit; cursor: pointer; padding: 12px 14px;
    }
    .bar b { flex: 1; min-width: 0; font-size: 14.5px; font-weight: 500; line-height: 1.35; text-wrap: pretty; }
    .dot { width: 9px; height: 9px; border-radius: 50%; flex: none; background: var(--app-yel); }
    .bar.red { background: rgba(var(--app-red-rgb), 0.12); }
    .bar.red .dot { background: var(--app-red); }
    .bar.red b { color: var(--app-red); }
    .attention-sheet h2 { margin: 0 0 12px; font-size: 19px; }
    .rows { display: flex; flex-direction: column; gap: 10px; padding-bottom: 12px; }
    .rows > * { margin: 0 !important; }
    .rows > :empty { display: none; }
  `],
})
export class AttentionHomeComponent {
  private readonly limits = inject(LimitsService);
  private readonly goals = inject(GoalsService);
  private readonly tour = inject(TourService);
  private readonly reminders = inject(RemindersService);
  readonly reminderCount = computed(() => this.reminders.soon().length);
  readonly remindersLate = computed(() => this.reminders.soon().some(o => o.late));
  private readonly due = viewChild(DueHomeComponent);

  private readonly i18n = inject(I18nService);
  readonly open = signal(false);
  /** Set when the person turned Pendientes off. */
  readonly onlyUrgent = input(false);

  readonly payments = computed(() => this.due()?.rows().length ?? 0);
  readonly paymentsLate = computed(() => (this.due()?.rows() ?? []).some(r => r.item.overdue));
  /** Every cap Inicio would show: the total gone over counts as the caps in it. */
  readonly caps = computed(() => {
    const v = this.limits.current();
    const passed = v.total && v.total.state === 'passed' ? v.total.passedCount : v.passed.length;
    return passed + v.fine.filter(l => l.status.state === 'close').length;
  });
  /** Caps gone over, and caps close to their figure, apart. */
  private readonly capsOver = computed(() => {
    const v = this.limits.current();
    return v.total && v.total.state === 'passed' ? v.total.passedCount : v.passed.length;
  });
  private readonly capsNear = computed(() => this.limits.current().fine.filter(l => l.status.state === 'close').length);
  /** "2 pagos por hacer · 3 topes pasados": each kind only when it has something. */
  readonly line = computed(() => {
    // The two first kinds by name, the rest as "y N más": one line, not a list.
    const kinds: [Parameters<I18nService['t']>[0], number][] = ([
      ['home.attention.paymentsDue', this.payments()],
      ['home.attention.capsPassed', this.capsOver()],
      ['home.attention.reminders', this.reminderCount()],
      ['home.attention.goalsLate', this.goalsLate()],
      ['home.attention.capsNear', this.capsNear()],
    ] as [Parameters<I18nService['t']>[0], number][]).filter(([, count]) => count > 0);
    const named = kinds.slice(0, 2).map(([key, count]) => this.i18n.t(key, { count }));
    const rest = kinds.slice(2).reduce((sum, [, count]) => sum + count, 0);
    if (rest > 0) named.push(this.i18n.t('home.attention.more', { count: rest }));
    return named.join(' · ');
  });
  readonly capsPassed = computed(() => {
    const v = this.limits.current();
    return (v.total?.state === 'passed') || v.passed.length > 0;
  });
  readonly goalsLate = computed(() => this.goals.late().length);
  readonly total = computed(() => this.payments() + this.reminderCount() + this.caps() + this.goalsLate());
  readonly urgent = computed(() => this.paymentsLate() || this.remindersLate() || this.capsPassed());

  constructor() {
    // The first time something is pending, the tour says what this line is (23g).
    effect(() => {
      if (this.total() > 0) this.tour.offer('attention');
    });
  }

  /** A row tapped leads somewhere: the sheet closes behind it. */
  leave(event: Event): void {
    if ((event.target as HTMLElement).closest('button, a, [role=button]')) this.open.set(false);
  }
}
