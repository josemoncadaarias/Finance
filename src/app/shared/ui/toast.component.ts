import { Component, inject } from '@angular/core';
import { IonIcon } from '@ionic/angular';

import { ToastService } from './toast.service';

/** Draws ToastService's notice, once, in the shell. */
@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [IonIcon],
  template: `
    @if (toast.text(); as text) {
      <div class="ui-toast" role="status" (click)="toast.dismiss()">
        <ion-icon name="checkmark-circle"></ion-icon><span>{{ text }}</span>
      </div>
    }
  `,
})
export class ToastComponent {
  readonly toast = inject(ToastService);
}
