/**
 * A short notice that goes away by itself: "Se guardó ...", "Leí 18
 * movimientos". The redesign's way of saying a one-off outcome, instead of a
 * green box that stays on the screen (Jose, 2026-09-28: minimal).
 */

import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly text = signal<string | null>(null);
  private timer: ReturnType<typeof setTimeout> | null = null;

  say(text: string, ms = 4500): void {
    if (this.timer) clearTimeout(this.timer);
    this.text.set(text);
    this.timer = setTimeout(() => this.text.set(null), ms);
  }

  dismiss(): void {
    if (this.timer) clearTimeout(this.timer);
    this.text.set(null);
  }
}
