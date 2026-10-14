/**
 * A plain amount box that reads what the keyboard did the way the movement
 * form's amount does (`typedInto`): a digit lands where the cursor is, the
 * thousands' full stops are grouping and not cents, a comma - or one full
 * stop typed alone - starts the cents, and pasted "3.800.000" is three
 * million eight hundred thousand (Jose, 2026-10-14: an account's opening
 * balance pasted as "3,8000000", and every digit typed went after the comma).
 *
 * <input inputmode="decimal" [value]="x().text" [appAmountInput]="x()" (amountChange)="x.set($event)">
 */
import { Directive, ElementRef, HostListener, inject, input, output } from '@angular/core';

import { AmountBuffer, typedInto } from '../../features/entry/amount-buffer';

@Directive({ selector: 'input[appAmountInput]', standalone: true })
export class AmountInputDirective {
  readonly appAmountInput = input.required<AmountBuffer>();
  readonly amountChange = output<AmountBuffer>();

  private readonly field = inject<ElementRef<HTMLInputElement>>(ElementRef);

  @HostListener('input')
  typed(): void {
    const element = this.field.nativeElement;
    const edit = typedInto(this.appAmountInput(), element.value, element.selectionStart ?? element.value.length);
    // Told directly: a character refused leaves the text as it was, and the
    // binding would see nothing to redraw.
    element.value = edit.buffer.text;
    try { element.setSelectionRange(edit.caret, edit.caret); } catch { /* not focused */ }
    this.amountChange.emit(edit.buffer);
  }
}
