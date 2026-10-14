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
        <ion-icon [name]="toast.icon()"></ion-icon><span class="said">{{ text }}</span>
        @if (toast.action(); as action) {
          <button type="button" class="act" (click)="$event.stopPropagation(); toast.act()">{{ action.label }}</button>
        }
      </div>
    }
  `,
})
export class ToastComponent {
  readonly toast = inject(ToastService);
}
