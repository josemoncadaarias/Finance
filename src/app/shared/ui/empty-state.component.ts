import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { IonIcon } from '@ionic/angular';

import { AccentService } from '../../core/theme/accent.service';
import { BadgeComponent } from './badge.component';

/**
 * What a screen or a section says when it has nothing to show (idea 20,
 * Jose, 2026-10-22): an icon, a title, one sentence and the one thing to do
 * next. One definition, so every empty place reads the same.
 *
 * `compact` is for a section inside a screen (less room above, a quiet
 * button); without it, it is the whole screen's message.
 */
@Component({
  selector: 'app-empty',
  standalone: true,
  imports: [IonIcon, BadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ui-empty" [class.compact]="compact()">
      <app-badge shape="ci" [size]="compact() ? 52 : 68" [builtin]="icon()" [fixed]="tone()"></app-badge>
      <h2>{{ title() }}</h2>
      @if (text()) { <p>{{ text() }}</p> }
      @if (action()) {
        <button type="button" class="ui-btn" [class.ghost]="compact()" (click)="act.emit()">
          @if (actionIcon()) { <ion-icon [name]="actionIcon()!"></ion-icon> }{{ action() }}
        </button>
      }
      @if (second()) {
        <button type="button" class="second" (click)="secondAct.emit()">{{ second() }}</button>
      }
    </div>
  `,
  styles: [`
    .ui-empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      padding: 56px 16px 8px;
      gap: 8px;
    }
    .ui-empty.compact { padding: 24px 12px 8px; }
    h2 { margin: 8px 0 0; font-size: 19px; font-weight: 700; text-wrap: balance; }
    .compact h2 { font-size: 16px; }
    p { margin: 0 0 12px; color: var(--app-mu); font-size: 14px; line-height: 1.45; text-wrap: pretty; max-width: 340px; }
    .ui-btn { display: flex; gap: 6px; justify-content: center; align-items: center; max-width: 340px; }
    .second {
      background: none; border: 0; padding: 10px; font: inherit; font-size: 14px;
      color: var(--app-pr); cursor: pointer;
    }
  `],
})
export class EmptyStateComponent {
  readonly icon = input.required<string>();
  readonly title = input.required<string>();
  readonly text = input<string>('');
  /** The badge's colour; the accent when none. */
  readonly color = input<string | null>(null);
  private readonly accent = inject(AccentService);
  readonly tone = computed(() => this.color() ?? this.accent.accent().color);
  readonly action = input<string>('');
  readonly actionIcon = input<string | null>(null);
  readonly second = input<string>('');
  readonly compact = input(false);
  readonly act = output<void>();
  readonly secondAct = output<void>();
}
