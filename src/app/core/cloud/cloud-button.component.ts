/**
 * The cloud in the corner: one tap to put today's data in Drive.
 *
 * It sits in the toolbar of every screen for the same reason the flag does:
 * the moment you want it is the moment you just finished entering something,
 * and that is never the account screen. Jose asked for it outright - with no
 * server of ours there is nothing that saves on its own, so the way to save
 * has to be where the hand already is.
 *
 * It only appears when there is an account signed in. Signed out it would be
 * a button that opens a screen to explain why it cannot work, and the drawer
 * already has that screen with its name on it.
 *
 * It saves and it never restores. Restoring replaces everything on the phone,
 * and one tap away on every screen is the wrong distance for that.
 */

import { Component, computed, inject } from '@angular/core';
import { IonIcon, IonSpinner } from '@ionic/angular';

import { CloudBackupService } from './cloud-backup.service';
import { GoogleAccountService } from './google-account.service';
import { TranslatePipe } from '../i18n/translate.pipe';

@Component({
  selector: 'app-cloud-button',
  imports: [IonIcon, IonSpinner, TranslatePipe],
  template: `
    @if (shown()) {
      <button type="button" class="cloud-button" [class]="cloud.state()"
              [disabled]="cloud.state() === 'working'"
              (click)="cloud.save()"
              [attr.aria-label]="label() | t" [title]="label() | t">
        @switch (cloud.state()) {
          @case ('working') { <ion-spinner name="crescent"></ion-spinner> }
          @case ('done') { <ion-icon name="checkmark-circle"></ion-icon> }
          @case ('failed') { <ion-icon name="alert-circle"></ion-icon> }
          @default { <ion-icon name="cloud-upload-outline"></ion-icon> }
        }
      </button>
    }
  `,
  styles: [`
    .cloud-button {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 2.4rem;
      height: 2.4rem;
      border: none;
      border-radius: 50%;
      background: none;
      color: var(--ion-color-medium);
      font-size: 1.25rem;
      cursor: pointer;

      /* The toolbar it sits in is coloured on some screens and not on others,
         so the icon takes the toolbar's own text colour where one is set. */
      color: inherit;
      opacity: 0.85;

      &:active { opacity: 1; }
      &[disabled] { opacity: 0.6; }

      ion-spinner { width: 1.15rem; height: 1.15rem; }

      /* Said in colour for a moment, then back to the plain cloud: a tick
         that stays on screen for ever stops meaning "just now". */
      &.done { color: var(--ion-color-success); opacity: 1; }
      &.failed { color: var(--ion-color-danger); opacity: 1; }
    }
  `],
})
export class CloudButtonComponent {
  readonly cloud = inject(CloudBackupService);
  private readonly google = inject(GoogleAccountService);

  readonly shown = computed(() => this.google.user() !== null);

  readonly label = computed(() => {
    switch (this.cloud.state()) {
      case 'working': return 'cloud.saving';
      case 'done': return 'cloud.saved';
      case 'failed': return 'cloud.failed';
      default: return 'cloud.save';
    }
  });
}
