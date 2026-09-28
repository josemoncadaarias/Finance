/**
 * The keypad and the save button at the foot of every movement form: the
 * movement form, a product's own movement and a proposal being checked.
 *
 * One definition, so the three cannot drift apart again - the "Sale / Llega"
 * form of a transfer between currencies had no way to erase a digit because
 * the erase key lived beside the single amount (Jose, 2026-09-28).
 *
 * Why the app's own keypad and not the phone's number keyboard: the phone's
 * has no + − × ÷, so splitting a bill or adding two receipts would be gone,
 * and whether it offers a comma or a point depends on the keyboard's language,
 * which is how 45.900 becomes 45,9. What was wrong with ours was the room it
 * took, so:
 *
 *   - it is shown while the amount is being typed and folds away (the handle
 *     on top, or touching any other part of the form); touching the amount,
 *     or the small arrow left at the foot, brings it back;
 *   - erasing is a key of its own - a tap erases a digit, a long press all of
 *     it - so it is there in every form and every layout;
 *   - "=" is gone: the running sum shows its result as it is typed, and a
 *     second operator or saving finishes it;
 *   - saving stays at the foot whether the keypad is open or not, with
 *     "Registrar otro" beside it where a form offers it.
 */

import { Component, input, output } from '@angular/core';
import { IonIcon } from '@ionic/angular';

import { TranslatePipe } from '../../core/i18n/translate.pipe';

/** The keys, top to bottom. '<' erases; a long press on it clears. */
export const KEYPAD_KEYS = [
  '7', '8', '9', '÷',
  '4', '5', '6', '×',
  '1', '2', '3', '-',
  ',', '0', '<', '+',
] as const;

@Component({
  selector: 'app-keypad',
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
    .fold {
      display: flex;
      justify-content: center;
      width: 100%;
      border: 0;
      background: none;
      color: var(--app-mu);
      padding: 2px 0 0;
      cursor: pointer;
      ion-icon { font-size: 22px; }
      &.up {
        align-items: center;
        gap: 6px;
        padding: 6px 0 0;
        font-size: 13px;
        color: var(--app-pr);
        ion-icon { font-size: 20px; }
      }
    }
    .ui-kp { padding-bottom: 0; }
    .ui-kp button.on { background: var(--app-pr); color: #fff; }
    .ui-kp button.erase ion-icon { font-size: 24px; }
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
      @if (!open()) {
        <!-- Folded: a small arrow at the foot brings it back, as well as a
             tap on the amount (Jose, 2026-09-28). -->
        <button type="button" class="fold up" (click)="openChange.emit(true)"
                [attr.aria-label]="'entry.keypad.show' | t" [title]="'entry.keypad.show' | t">
          <ion-icon name="chevron-up"></ion-icon><span>{{ 'entry.keypad.show' | t }}</span>
        </button>
      }
      @if (open()) {
        <button type="button" class="fold" (click)="openChange.emit(false)"
                [attr.aria-label]="'entry.keypad.hide' | t" [title]="'entry.keypad.hide' | t">
          <ion-icon name="chevron-down"></ion-icon>
        </button>
        <div class="ui-kp">
          @for (key of keys; track key) {
            @if (key === '<') {
              <button type="button" class="erase" (click)="pressed.emit('<')"
                      (contextmenu)="$event.preventDefault(); pressed.emit('C')"
                      [attr.aria-label]="'entry.erase' | t" [title]="'entry.erase' | t">
                <ion-icon name="backspace-outline"></ion-icon>
              </button>
            } @else {
              <button type="button" (click)="pressed.emit(key)" [class.op]="isOperator(key)"
                      [class.on]="operator() === key">{{ key === '-' ? '−' : key }}</button>
            }
          }
        </div>
      }
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
export class KeypadComponent {
  readonly keys = KEYPAD_KEYS;

  readonly open = input(true);
  readonly missing = input<string | null>(null);
  readonly canSave = input(false);
  /** The operator of a sum being added up, lit on its key. */
  readonly operator = input<string | null>(null);
  readonly offerAgain = input(false);
  readonly again = input(false);

  readonly pressed = output<string>();
  readonly save = output<void>();
  readonly openChange = output<boolean>();
  readonly againChange = output<boolean>();

  isOperator(key: string): boolean {
    return key === '+' || key === '-' || key === '×' || key === '÷';
  }
}
