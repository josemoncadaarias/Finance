/**
 * The question asked before something is destroyed.
 *
 * One component, because "are you sure" is one thing and because the two
 * places that were missing it were missing it silently: Jose mis-tapped
 * delete on a movement and it was gone, with nothing asked and nothing to
 * undo. Anything that cannot be taken back goes through here.
 *
 *     <app-confirm [open]="asking()" [title]="'...' | t"
 *                  (confirmed)="reallyDelete()" (cancelled)="asking.set(false)">
 *     </app-confirm>
 *
 * It draws the same dialog the products screen already used - the styles are
 * in global.scss, since a modal's content is rendered outside the component
 * that declares it - so a confirmation looks the same wherever it is asked.
 */

import { Component, input, output } from '@angular/core';
import { IonModal, IonButton, IonIcon } from '@ionic/angular';

import { TranslatePipe } from '../../core/i18n/translate.pipe';

@Component({
  selector: 'app-confirm',
  imports: [TranslatePipe, IonModal, IonButton, IonIcon],
  template: `
    <ion-modal class="confirm-sheet" [isOpen]="open()" (didDismiss)="cancelled.emit()">
      <ng-template>
        <div class="confirm-dialog">
          <span class="badge"><ion-icon [name]="icon()"></ion-icon></span>
          <h2>{{ title() }}</h2>
          @if (body()) { <p>{{ body() }}</p> }
          @if (error()) { <p class="error">{{ error() }}</p> }

          <div class="buttons">
            <!-- Cancel first, and quiet. The destructive one is never the
                 button a thumb lands on by default. -->
            <ion-button fill="outline" color="medium" (click)="cancelled.emit()">
              {{ 'entry.cancel' | t }}
            </ion-button>
            <ion-button color="danger" [disabled]="busy()" (click)="confirmed.emit()">
              {{ confirmLabel() }}
            </ion-button>
          </div>
        </div>
      </ng-template>
    </ion-modal>
  `,
})
export class ConfirmComponent {
  readonly open = input(false);
  readonly title = input.required<string>();
  /** A second line: what will be lost, or what happens instead. */
  readonly body = input('');
  readonly confirmLabel = input.required<string>();
  readonly icon = input('trash-outline');
  /** Shown in the dialog when the act itself failed. */
  readonly error = input('');
  readonly busy = input(false);

  readonly confirmed = output<void>();
  readonly cancelled = output<void>();
}
