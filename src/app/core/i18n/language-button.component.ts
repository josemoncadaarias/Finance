/**
 * The flag in the corner: what language you are reading, and one tap to change
 * it.
 *
 * It sits in the toolbar of every screen rather than only in the drawer,
 * because someone who ended up in the wrong language needs to fix it from
 * wherever they are — and a drawer whose own labels are in a language they
 * cannot read is a poor place to hide the way out. The drawer keeps a version
 * of it too, as the place where settings live.
 *
 * The flags are drawn rather than written as emoji: flag emoji do not render
 * on Windows at all (they come out as "CO"), and a control whose whole job is
 * to be recognised at a glance cannot depend on the platform's font.
 */

import { Component, computed, inject, input, signal } from '@angular/core';
import { IonIcon, IonModal, IonContent, IonList, IonItem, IonLabel } from '@ionic/angular';

import { I18nService } from './i18n.service';
import { TranslatePipe } from './translate.pipe';
import type { Language } from './translations';

@Component({
  selector: 'app-language-button',
  imports: [IonIcon, IonModal, IonContent, IonList, IonItem, IonLabel, TranslatePipe],
  template: `
    <button type="button" class="flag-button" [class.wide]="wide()"
            (click)="open.set(true)"
            [attr.aria-label]="'nav.language' | t">
      <span class="flag" [class]="'flag-' + i18n.current().flag"></span>
      @if (wide()) {
        <span class="name">{{ i18n.current().name }}</span>
        <ion-icon name="chevron-forward-outline"></ion-icon>
      }
    </button>

    <ion-modal [isOpen]="open()" (didDismiss)="open.set(false)"
               [initialBreakpoint]="0.4" [breakpoints]="[0, 0.4]">
      <ng-template>
        <ion-content class="sheet">
          <h2>{{ 'nav.language' | t }}</h2>
          <ion-list>
            @for (option of i18n.languages; track option.code) {
              <ion-item button lines="full" (click)="choose(option.code)"
                        [class.selected]="i18n.language() === option.code">
                <span class="flag" slot="start" [class]="'flag-' + option.flag"></span>
                <ion-label>{{ option.name }}</ion-label>
                @if (i18n.language() === option.code) {
                  <ion-icon slot="end" name="checkmark-outline" color="primary"></ion-icon>
                }
              </ion-item>
            }
          </ion-list>
        </ion-content>
      </ng-template>
    </ion-modal>
  `,
  styles: [`
    :host { display: contents; }

    .flag-button {
      display: inline-flex;
      align-items: center;
      gap: 0.45rem;
      padding: 0.3rem 0.55rem 0.3rem 0.35rem;
      border: none;
      background: none;
      cursor: pointer;
      color: var(--ion-text-color);

      &.wide {
        width: 100%;
        padding: 0.85rem 1rem;
        font-size: 1rem;
      }

      .name { flex: 1; text-align: left; }
      ion-icon { color: var(--ion-color-medium); font-size: 0.9rem; }
    }

    /* Drawn flags: three bands each, in the right proportions. */
    .flag {
      display: inline-block;
      width: 1.4rem;
      height: 1rem;
      flex: none;
      border-radius: 2px;
      border: 1px solid rgba(128, 128, 128, 0.35);
      background-size: cover;
    }

    /* Colombia: yellow over blue over red, the yellow half the height. */
    .flag-co {
      background-image: linear-gradient(
        to bottom,
        #fcd116 0 50%,
        #003893 50% 75%,
        #ce1126 75% 100%);
    }

    /* The Union Jack, drawn as SVG: gradients could only manage the upright
       cross, and a flag missing its diagonals reads as a different country's
       — the first attempt came out looking Finnish. */
    .flag-gb {
      background-image: url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 60 30'><clipPath id='s'><path d='M0,0 v30 h60 v-30 z'/></clipPath><clipPath id='t'><path d='M30,15 h30 v15 z v15 h-30 z h-30 v-15 z v-15 h30 z'/></clipPath><g clip-path='url(%23s)'><path d='M0,0 v30 h60 v-30 z' fill='%23012169'/><path d='M0,0 L60,30 M60,0 L0,30' stroke='%23fff' stroke-width='6'/><path d='M0,0 L60,30 M60,0 L0,30' clip-path='url(%23t)' stroke='%23C8102E' stroke-width='4'/><path d='M30,0 v30 M0,15 h60' stroke='%23fff' stroke-width='10'/><path d='M30,0 v30 M0,15 h60' stroke='%23C8102E' stroke-width='6'/></g></svg>");
    }

    .sheet {
      --padding-start: 1rem;
      --padding-end: 1rem;
      --padding-top: 1rem;

      h2 { margin: 0 0 0.5rem; font-size: 1.05rem; }
      ion-item.selected { --background: var(--ion-color-light); }
      .flag { margin-inline-end: 0.85rem; }
    }
  `],
})
export class LanguageButtonComponent {
  readonly i18n = inject(I18nService);

  /** Wide shows the language's name beside the flag, for the drawer. */
  readonly wide = input(false);

  readonly open = signal(false);

  choose(language: Language): void {
    this.i18n.set(language);
    this.open.set(false);
  }
}
