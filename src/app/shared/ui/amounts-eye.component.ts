/**
 * The eye on every screen with money (mockups 28): hides or shows every
 * amount in the app at once. Always the same round button, at the top right
 * of the screen's big card.
 */
import { Component, inject } from '@angular/core';
import { IonIcon } from '@ionic/angular';

import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { PrivacyService } from '../../core/ui/privacy.service';

@Component({
  selector: 'app-amounts-eye',
  standalone: true,
  imports: [IonIcon, TranslatePipe],
  styles: [`
    :host { display: inline-flex; flex: none; }
    button {
      width: 38px; height: 38px; border-radius: 50%; border: 0; padding: 0;
      display: grid; place-items: center; cursor: pointer;
      background: rgba(255, 255, 255, 0.1); color: var(--app-tx);
      ion-icon { font-size: 21px; }
    }
    :host-context(:root:not(.ion-palette-dark)) button { background: rgba(0, 0, 0, 0.06); }
  `],
  template: `
    <button type="button" (click)="$event.stopPropagation(); privacy.toggle()"
            [attr.aria-label]="(privacy.hidden() ? 'ui.amounts.show' : 'ui.amounts.hide') | t"
            [title]="(privacy.hidden() ? 'ui.amounts.show' : 'ui.amounts.hide') | t">
      <ion-icon [name]="privacy.hidden() ? 'eye-off-outline' : 'eye-outline'"></ion-icon>
    </button>
  `,
})
export class AmountsEyeComponent {
  readonly privacy = inject(PrivacyService);
}
