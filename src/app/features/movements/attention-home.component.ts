/**
 * What needs attention on Inicio, folded into one line (mockups `23b`, `23c`;
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
import { IonIcon } from '@ionic/angular';

import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { LimitsService } from '../../core/limits/limits.service';
import { GoalsService } from '../../core/goals/goals.service';
import { TourService } from '../../core/tour/tour.service';
import { DueHomeComponent } from '../debts/due-home.component';
import { LimitsHomeComponent } from '../plans/limits-home.component';

const OPEN_KEY = 'finance.attentionOpen';

@Component({
  selector: 'app-attention-home',
  standalone: true,
  // Hidden from "Personaliza tu vista", it still shows a payment already late
  // or a cap gone over (31f): those are never kept quiet.
  host: { '[hidden]': '(onlyUrgent() && !urgent()) || total() === 0' },
  imports: [TranslatePipe, IonIcon, DueHomeComponent, LimitsHomeComponent],
  template: `
    @if (total() > 0) {
      <button type="button" class="ui-card bar" [class.open]="open()" data-tour="attention" (click)="toggle()" [attr.aria-expanded]="open()">
        <span class="bell" [class.red]="urgent()"><ion-icon name="notifications-outline"></ion-icon></span>
        <span class="what">
          <b>{{ 'home.attention.title' | t:{ count: total() } }}</b>
          <span class="pills">
            @if (payments() > 0) { <span class="pill" [class.red]="paymentsLate()">{{ 'home.attention.payments' | t:{ count: payments() } }}</span> }
            @if (caps() > 0) { <span class="pill" [class.red]="capsPassed()">{{ 'home.attention.caps' | t:{ count: caps() } }}</span> }
            @if (goalsLate() > 0) { <span class="pill goal">{{ 'home.attention.goals' | t:{ count: goalsLate() } }}</span> }
          </span>
        </span>
        <ion-icon class="ui-chev" [name]="open() ? 'chevron-up-outline' : 'chevron-down-outline'"></ion-icon>
      </button>
    }
    <div class="rows" [hidden]="!open() || total() === 0">
      <app-due-home></app-due-home>
      <app-limits-home></app-limits-home>
    </div>
  `,
  styles: [`
    :host { display: block; }
    :host([hidden]) { display: none; }
    .bar {
      display: flex; align-items: center; gap: 12px; width: 100%; text-align: left;
      font: inherit; color: inherit; cursor: pointer; padding: 11px 14px;
    }
    .bell {
      width: 36px; height: 36px; border-radius: 50%; flex: none; display: grid; place-items: center;
      background: rgba(var(--app-yel-rgb), 0.18); color: var(--app-yel); font-size: 19px;
    }
    .bell.red { background: rgba(var(--app-red-rgb), 0.18); color: var(--app-red); }
    .what { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 5px; }
    .what > b { font-size: 15px; }
    .pills { display: flex; gap: 6px; flex-wrap: wrap; }
    .pill {
      padding: 3px 9px; border-radius: 999px; font-size: 12.5px; font-weight: 600; white-space: nowrap;
      background: rgba(var(--app-yel-rgb), 0.18); color: var(--app-yel);
    }
    .pill.red { background: rgba(var(--app-red-rgb), 0.18); color: var(--app-red); }
    .pill.goal { background: rgba(var(--app-pr-rgb), 0.18); color: var(--app-pr); }
    /* The space around this block is the page's (Inicio's slots); inside it,
       the bar and its rows are 10px apart, and nothing hangs off the end. */
    .bar.open { margin-bottom: 10px; }
    .rows { display: flex; flex-direction: column; gap: 10px; }
    .rows > * { margin: 0 !important; }
    .rows > :empty { display: none; }
    .rows[hidden] { display: none; }
  `],
})
export class AttentionHomeComponent {
  private readonly limits = inject(LimitsService);
  private readonly goals = inject(GoalsService);
  private readonly tour = inject(TourService);
  private readonly due = viewChild(DueHomeComponent);

  readonly open = signal(readOpen());
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
  readonly capsPassed = computed(() => {
    const v = this.limits.current();
    return (v.total?.state === 'passed') || v.passed.length > 0;
  });
  readonly goalsLate = computed(() => this.goals.late().length);
  readonly total = computed(() => this.payments() + this.caps() + this.goalsLate());
  readonly urgent = computed(() => this.paymentsLate() || this.capsPassed());

  constructor() {
    // The first time something is pending, the tour says what this line is (23g).
    effect(() => {
      if (this.total() > 0) this.tour.offer('attention');
    });
  }

  toggle(): void {
    const next = !this.open();
    this.open.set(next);
    try { localStorage.setItem(OPEN_KEY, next ? '1' : '0'); } catch { /* storage may refuse */ }
  }
}

function readOpen(): boolean {
  try { return localStorage.getItem(OPEN_KEY) === '1'; } catch { return false; }
}
