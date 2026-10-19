/**
 * The assistant's button, at the top right of every screen (Jose,
 * 2026-10-19, mockups `39p`-`39r`): one round button with the sparkles,
 * defined once and dropped into each screen's title bar.
 */

import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { IonIcon } from '@ionic/angular';

import { TranslatePipe } from '../../core/i18n/translate.pipe';

@Component({
  selector: 'app-ask-button',
  imports: [IonIcon, TranslatePipe],
  template: `
    <button type="button" class="ui-round on" data-tour="ask" (click)="open()"
            [attr.aria-label]="'ai.ask' | t" [title]="'ai.ask' | t">
      <ion-icon name="sparkles-outline"></ion-icon>
    </button>
  `,
  styles: [`:host { display: contents; }`],
})
export class AskButtonComponent {
  private readonly router = inject(Router);

  open(): void {
    void this.router.navigate(['/assistant']);
  }
}
