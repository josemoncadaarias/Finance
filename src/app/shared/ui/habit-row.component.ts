/**
 * One habit of what the person registers most, drawn the one way wherever it
 * is offered (the "+", the assistant's bulb and welcome; mockups 42a, 42b,
 * 42e). A tap opens the one movement form filled in; a long press (Android's
 * `contextmenu`) opens its options: pin it on top, open it, hide it.
 */
import { Component, inject, input } from '@angular/core';
import { IonIcon } from '@ionic/angular';

import { HabitsService } from '../../core/compose/habits.service';
import type { Frequent } from '../../core/compose/frequent';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { MOVE_COLOR } from '../../core/theme/palette';
import { BadgeComponent } from './badge.component';

@Component({
  selector: 'app-habit-row',
  imports: [IonIcon, TranslatePipe, BadgeComponent],
  template: `
    @let f = habit();
    @let cat = habits.category(f);
    <button type="button" [class]="card() ? 'habit-card' : 'ui-row habit'" (click)="tapped()" (contextmenu)="pressed($event)">
      @if (f.kind === 'transfer') {
        <app-badge shape="ci" [size]="card() ? 36 : 38" builtin="swap-horizontal" [fixed]="MOVE"></app-badge>
      } @else {
        <app-badge shape="sq" [size]="card() ? 36 : 38" [builtin]="cat?.builtin_icon" [customId]="cat?.custom_icon_id"
                   [tone]="cat?.color" [seed]="f.categoryId"></app-badge>
      }
      <span class="ui-tx">
        <b [class.wrap]="card()">{{ habits.title(f) }}</b>
        <small>{{ card() ? habits.noteLine(f) : habits.shortLine(f) }}</small>
      </span>
      <span class="amount">
        @if (f.amountMinor !== null) {
          <b [class.in]="f.kind === 'income'" [class.move]="f.kind === 'transfer'">{{ habits.amount(f) }}</b>
          <small>{{ 'habit.usually' | t }}</small>
        } @else {
          <small>{{ 'habit.youType' | t }}</small>
        }
      </span>
      @if (f.pinned) { <ion-icon class="star" name="star"></ion-icon> }
    </button>
  `,
  styles: [`
    :host { display: block; }
    .habit { width: 100%; text-align: left; }
    .habit .ui-tx small { white-space: normal; }
    .amount { display: flex; flex-direction: column; align-items: flex-end; flex: none; max-width: 32%; text-align: right; }
    .amount b { font-weight: 600; color: var(--app-red); white-space: nowrap; }
    .amount b.in { color: var(--app-grn); }
    .amount b.move { color: var(--app-move); }
    .amount small { color: var(--app-mu); font-size: 12px; line-height: 1.25; }
    .star { color: var(--app-yel); font-size: 16px; flex: none; }
    .habit-card {
      width: 168px; height: 100%; display: flex; flex-direction: column; align-items: flex-start; gap: 6px;
      padding: 12px; border-radius: 18px; background: var(--app-s1); border: 1px solid var(--app-line);
      color: var(--app-tx); font: inherit; text-align: left; cursor: pointer;
    }
    .habit-card .ui-tx { flex: 1; }
    .habit-card .ui-tx b { white-space: normal; font-size: 14px; line-height: 1.3; }
    .habit-card .ui-tx small { white-space: normal; }
    .habit-card .amount { align-items: flex-start; text-align: left; max-width: none; }
    .habit-card { position: relative; }
    .habit-card .star { position: absolute; top: 12px; right: 12px; }
  `],
})
export class HabitRowComponent {
  readonly habits = inject(HabitsService);
  readonly habit = input.required<Frequent>();
  /** Drawn as a card that slides sideways (the assistant's welcome, 42b). */
  readonly card = input(false);
  /** Called before the form opens, so the sheet it sits in can close. */
  readonly before = input<(() => void) | null>(null);
  readonly MOVE = MOVE_COLOR;

  tapped(): void {
    this.before()?.();
    this.habits.open(this.habit());
  }

  pressed(event: Event): void {
    event.preventDefault();
    this.habits.options.set(this.habit());
  }
}
