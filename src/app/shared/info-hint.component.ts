/**
 * An explanation that waits to be asked for.
 *
 * A form explains itself with a sentence above the fields, and on a phone
 * that sentence is three lines of the screen spent on something read once and
 * true for ever after. Jose, 2026-09-21: the note on "mover entre productos"
 * needed a scroll to reach, and what was in the way was a paragraph he had
 * already read a hundred times.
 *
 * So the sentence lives behind a small mark beside the date. It is still
 * there for the first time, or the time the answer is not obvious, and it
 * costs one line instead of three the rest of the time.
 */

import { Component, input } from '@angular/core';
import { IonIcon, IonPopover } from '@ionic/angular';

/** Each mark opens its own explanation, so each needs a name of its own. */
let count = 0;

@Component({
  selector: 'app-info-hint',
  imports: [IonIcon, IonPopover],
  template: `
    <button type="button" class="info-hint" [id]="id"
            [attr.aria-label]="label() || text()">
      <ion-icon name="information-circle-outline"></ion-icon>
    </button>

    <ion-popover class="info-hint-popover" [trigger]="id"
                 side="top" alignment="center" [showBackdrop]="true">
      <ng-template>
        <p class="info-hint-body">{{ text() }}</p>
      </ng-template>
    </ion-popover>
  `,
  styles: [`
    .info-hint {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex: none;
      width: 2rem;
      height: 2rem;
      padding: 0;
      border: none;
      border-radius: 50%;
      background: none;
      color: var(--ion-color-medium);
      font-size: 1.15rem;
      cursor: pointer;

      &:active { color: var(--ion-color-primary); }
    }
  `],
})
export class InfoHintComponent {
  /** What the explanation says. */
  readonly text = input.required<string>();
  /** A shorter name for a screen reader, when the text itself is long. */
  readonly label = input('');

  readonly id = `info-hint-${++count}`;
}
