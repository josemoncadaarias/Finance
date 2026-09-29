/**
 * A note's box as tall as what it holds (Jose, 2026-09-29).
 *
 * The note is a one-line textarea that only grew while it was typed into, so
 * a long note the app wrote itself - the usual one, or one being corrected -
 * showed its first line and hid the rest, and while it was being written the
 * text scrolled inside that one line, which made reaching its end with the
 * cursor a fight. The box is measured again whenever its text changes, from
 * the keyboard or from the form, and again when its width does.
 *
 *     <textarea [appAutoGrow]="note()" [value]="note()"></textarea>
 */

import { Directive, ElementRef, OnDestroy, afterRenderEffect, inject, input } from '@angular/core';

@Directive({
  selector: 'textarea[appAutoGrow]',
  standalone: true,
  host: { '(input)': 'fit()' },
})
export class AutoGrowDirective implements OnDestroy {
  private readonly field = inject<ElementRef<HTMLTextAreaElement>>(ElementRef).nativeElement;

  /** The text on show; read only so the box is measured when it changes. */
  readonly appAutoGrow = input<string | null | undefined>('');

  /** Only a change of width re-measures: the height is ours to set. */
  private width = 0;
  private readonly resized = typeof ResizeObserver === 'undefined'
    ? null
    : new ResizeObserver(([entry]) => {
      const width = Math.round(entry.contentRect.width);
      if (width === this.width) return;
      this.width = width;
      this.fit();
    });

  constructor() {
    this.resized?.observe(this.field);
    afterRenderEffect(() => {
      this.appAutoGrow();
      this.fit();
    });
  }

  fit(): void {
    const field = this.field;
    // Measured at no height, so a box that held more than it holds now shrinks.
    field.style.height = 'auto';
    field.style.height = `${field.scrollHeight}px`;
  }

  ngOnDestroy(): void {
    this.resized?.disconnect();
  }
}
