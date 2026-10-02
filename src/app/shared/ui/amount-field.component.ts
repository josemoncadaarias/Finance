/**
 * The amount of every movement form, typed with the phone's own keyboard.
 *
 * The app's keypad is gone (Jose, 2026-10-02: "el teclado numérico que ofrece
 * Android es suficiente"). What it gave that the phone's keyboard does not is
 * kept here, beside the figure: a key that erases the last digit and an X that
 * clears it all, both there whether the keyboard is up or not.
 *
 * The field shows the amount grouped in thousands, as before, and the digits
 * stay the app's own (`AmountBuffer`): what the keyboard does is read back
 * with `typedInto`, so a comma and a full stop both start the cents whichever
 * the phone's language offers, and 45.900 never becomes 45,9.
 */

import { Component, ElementRef, afterNextRender, input, output, viewChild } from '@angular/core';
import { IonIcon } from '@ionic/angular';

import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { AmountBuffer, typedInto } from '../../features/entry/amount-buffer';

@Component({
  selector: 'app-amount-field',
  standalone: true,
  imports: [IonIcon, TranslatePipe],
  styles: [`
    :host { display: block; }
    .amount {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
      min-height: 62px;
      padding: 2px 4px 0;
    }
    .sign {
      font-size: 30px;
      font-weight: 600;
      &.expense { color: var(--app-red); }
      &.income { color: var(--app-grn); }
      &.transfer { color: var(--app-move); }
    }
    input {
      field-sizing: content;
      min-width: 1ch;
      max-width: 100%;
      flex: 0 1 auto;
      border: 0;
      outline: 0;
      background: none;
      color: var(--app-tx);
      caret-color: var(--app-pr);
      padding: 0;
      font: inherit;
      font-size: 44px;
      font-weight: 700;
      letter-spacing: -0.5px;
      font-variant-numeric: tabular-nums;
      text-align: center;
      &::placeholder { color: var(--app-tx); opacity: 1; }
      &.long { font-size: 34px; }
      &.longer { font-size: 28px; }
    }
    .currency { font-size: 15px; color: var(--app-mu); font-weight: 500; align-self: baseline; padding-top: 22px; }
    .keys { display: inline-flex; gap: 2px; margin-left: 6px; flex: none; }
    .keys button {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      border: 0;
      background: var(--app-s2, rgba(127, 127, 127, 0.14));
      color: var(--app-mu);
      display: grid;
      place-items: center;
      cursor: pointer;
      ion-icon { font-size: 22px; }
      &:active { filter: brightness(1.25); }
    }

    /* One side of a transfer between currencies: smaller, no sign. */
    :host(.small) .amount { min-height: 0; padding: 0; flex-wrap: wrap; }
    :host(.small) input { font-size: 24px; &.long { font-size: 20px; } &.longer { font-size: 17px; } }
    :host(.small) .keys { flex-basis: 100%; justify-content: center; gap: 8px; margin: 4px 0 0; }
    :host(.small) .keys button { width: 32px; height: 32px; ion-icon { font-size: 18px; } }
  `],
  template: `
    <div class="amount">
      @if (sign()) { <span class="sign" [class]="tone()">{{ sign() }}</span> }
      <input #field type="text" inputmode="decimal" autocomplete="off" enterkeyhint="done" placeholder="0"
             [value]="buffer().text" [class.long]="buffer().text.length > 9" [class.longer]="buffer().text.length > 12"
             [attr.aria-label]="'entry.amount' | t"
             (input)="typed()" (focus)="toEnd(); focused.emit()" (click)="toEnd()"
             (keydown.enter)="$event.preventDefault(); done.emit()">
      @if (currency()) { <span class="currency">{{ currency() }}</span> }
      @if (!buffer().isEmpty) {
        <span class="keys">
          <!-- pointerdown keeps the focus, so the keyboard stays where it was. -->
          <button type="button" (pointerdown)="$event.preventDefault()" (click)="erase()"
                  [attr.aria-label]="'entry.erase' | t" [title]="'entry.erase' | t">
            <ion-icon name="backspace-outline"></ion-icon>
          </button>
          <button type="button" (pointerdown)="$event.preventDefault()" (click)="clear()"
                  [attr.aria-label]="'entry.clearAmount' | t" [title]="'entry.clearAmount' | t">
            <ion-icon name="close"></ion-icon>
          </button>
        </span>
      }
    </div>
  `,
})
export class AmountFieldComponent {
  readonly buffer = input.required<AmountBuffer>();
  readonly sign = input<string | null>(null);
  /** 'expense', 'income' or 'transfer', for the sign's colour. */
  readonly tone = input<string>('');
  readonly currency = input<string | null>(null);
  /** Put the cursor in it once drawn: a new movement starts on its amount. */
  readonly autofocus = input(false);

  readonly changed = output<AmountBuffer>();
  readonly focused = output<void>();
  /** Enter on a computer, "done" on the phone's keyboard. */
  readonly done = output<void>();

  private readonly field = viewChild.required<ElementRef<HTMLInputElement>>('field');

  constructor() {
    afterNextRender(() => {
      if (this.autofocus()) setTimeout(() => this.focus(), 350);
    });
  }

  focus(): void {
    this.field().nativeElement.focus();
  }

  blur(): void {
    this.field().nativeElement.blur();
  }

  typed(): void {
    const element = this.field().nativeElement;
    const next = typedInto(this.buffer(), element.value);
    // Told directly: a character refused leaves the text as it was, and the
    // binding would not notice anything to redraw.
    element.value = next.text;
    this.toEnd();
    this.changed.emit(next);
  }

  erase(): void {
    const next = this.buffer().copy();
    next.backspace();
    this.changed.emit(next);
  }

  clear(): void {
    this.changed.emit(new AmountBuffer());
  }

  /** The caret lives at the end: typing adds, erasing takes from there. */
  toEnd(): void {
    const element = this.field().nativeElement;
    const end = element.value.length;
    setTimeout(() => { try { element.setSelectionRange(end, end); } catch { /* not focused */ } });
  }
}
