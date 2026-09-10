/**
 * The control that changes the theme.
 *
 * Two shapes from one component, the same way the language button works: a
 * single icon that cycles, for a toolbar, and three options spelled out for the
 * drawer, where a setting is looked for rather than noticed.
 *
 * The spelled-out shape is a list of rows rather than three buttons in a line.
 * Three small buttons squeezed side by side read as one control someone has to
 * decode; three rows with an icon, a name and a tick read as a choice, and each
 * row is a comfortable target.
 */

import { Component, inject, input } from '@angular/core';
import { IonButton, IonIcon, IonItem, IonLabel, IonList } from '@ionic/angular';

import { TranslatePipe } from '../i18n/translate.pipe';
import { ThemeService, THEMES } from './theme.service';
import type { TranslationKey } from '../i18n/translations';

@Component({
  selector: 'app-theme-button',
  imports: [TranslatePipe, IonButton, IonIcon, IonItem, IonLabel, IonList],
  styles: [`
    :host { display: contents; }

    ion-list.themes {
      margin: 0;
      padding: 0;
      background: none;
    }

    .themes ion-item {
      --background: transparent;
      --padding-start: 0.75rem;
      --inner-padding-end: 0.75rem;
      --min-height: 2.9rem;
      font-size: 0.88rem;
    }

    /* The one in use, marked on the row itself: a tick at the end and the
       accent on the icon, rather than a filled button that has to be compared
       against the other two to be understood. */
    .themes ion-item.on {
      --background: rgba(var(--ion-color-primary-rgb), 0.1);
      font-weight: 600;
    }

    .themes ion-item.on ion-icon[slot='start'],
    .themes ion-item.on .tick {
      color: var(--ion-color-primary);
    }

    .themes ion-icon[slot='start'] {
      color: var(--ion-color-medium);
      font-size: 1.15rem;
    }
  `],
  template: `
    @if (wide()) {
      <ion-list class="themes" lines="none">
        @for (option of themes; track option.value) {
          <ion-item button detail="false"
                    [class.on]="theme.choice() === option.value"
                    (click)="theme.set(option.value)">
            <ion-icon slot="start" [name]="option.icon"></ion-icon>
            <ion-label>{{ $any(option.label) | t }}</ion-label>
            @if (theme.choice() === option.value) {
              <ion-icon slot="end" class="tick" name="checkmark-outline"></ion-icon>
            }
          </ion-item>
        }
      </ion-list>
    } @else {
      <ion-button (click)="theme.next()" [attr.aria-label]="label() | t">
        <ion-icon slot="icon-only" [name]="icon()"></ion-icon>
      </ion-button>
    }
  `,
})
export class ThemeButtonComponent {
  readonly theme = inject(ThemeService);
  readonly themes = THEMES;

  /** Spelled out as three rows, rather than one icon that cycles. */
  readonly wide = input(false);

  icon(): string {
    return THEMES.find(option => option.value === this.theme.choice())?.icon
      ?? 'phone-portrait-outline';
  }

  label(): TranslationKey {
    return (THEMES.find(option => option.value === this.theme.choice())?.label
      ?? 'theme.system') as TranslationKey;
  }
}
