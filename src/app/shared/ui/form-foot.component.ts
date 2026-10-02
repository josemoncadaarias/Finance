/**
 * The foot of every movement form: what is still missing, "Registrar otro"
 * where the form offers it, and Guardar - the movement form, a product's own
 * movement and a proposal being checked.
 *
 * It used to carry the app's own keypad; that is gone (Jose, 2026-10-02) and
 * the amount is typed with the phone's keyboard (`app-amount-field`).
 */
import { Component, input, output } from '@angular/core';
import { IonIcon } from '@ionic/angular';

import { TranslatePipe } from '../../core/i18n/translate.pipe';

@Component({
  selector: 'app-form-foot',
  standalone: true,
  imports: [IonIcon, TranslatePipe],
  styles: [`
    :host { display: block; flex: none; }
    .pad { background: var(--app-bg); border-top: 1px solid var(--app-line); }
    .missing {
      margin: 0;
      padding: 8px 16px;
      text-align: center;
      color: var(--app-yel);
      font-size: 13.5px;
    }
    .actions {
      display: flex;
      gap: 8px;
      padding: 8px 12px calc(10px + var(--ion-safe-area-bottom, 0px));
    }
    .again {
      flex: none;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      border: 1px solid var(--app-line);
      background: var(--app-s1);
      color: var(--app-mu);
      border-radius: 16px;
      padding: 0 12px;
      font: inherit;
      font-size: 14px;
      cursor: pointer;
      ion-icon { font-size: 20px; }
      &.on { color: var(--app-pr); border-color: rgba(var(--app-pr-rgb), 0.5); background: rgba(var(--app-pr-rgb), 0.1); }
    }
    .save {
      flex: 1;
      height: 52px;
      border: 0;
      border-radius: 16px;
      background: linear-gradient(90deg, var(--app-pr), var(--app-pr2, var(--app-pr)));
      color: #fff;
      font: inherit;
      font-size: 17px;
      font-weight: 700;
      cursor: pointer;
      &:disabled { opacity: 0.45; filter: grayscale(0.4); cursor: default; }
    }
  `],
  template: `
    <footer class="pad">
      @if (missing(); as hint) { <p class="missing">{{ hint }}</p> }
      <div class="actions">
        @if (offerAgain()) {
          <button type="button" class="again" [class.on]="again()" role="switch" [attr.aria-checked]="again()"
                  (click)="againChange.emit(!again())" [title]="'entry.again.hint' | t">
            <ion-icon [name]="again() ? 'checkbox' : 'square-outline'"></ion-icon>{{ 'entry.again' | t }}
          </button>
        }
        <button type="button" class="save" [disabled]="!canSave()" (click)="save.emit()">{{ 'entry.save' | t }}</button>
      </div>
    </footer>
  `,
})
export class FormFootComponent {
  readonly missing = input<string | null>(null);
  readonly canSave = input(false);
  readonly offerAgain = input(false);
  readonly again = input(false);

  readonly save = output<void>();
  readonly againChange = output<boolean>();

}
