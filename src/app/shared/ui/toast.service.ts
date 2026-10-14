/**
 * A short notice that goes away by itself: "Se guardó ...", "Leí 18
 * movimientos". The redesign's way of saying a one-off outcome, instead of a
 * green box that stays on the screen (Jose, 2026-09-28: minimal).
 */

import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly text = signal<string | null>(null);
  /** A button inside the notice, such as "Deshacer". */
  readonly action = signal<{ label: string; run: () => void } | null>(null);
  readonly icon = signal<string>('checkmark-circle');
  private timer: ReturnType<typeof setTimeout> | null = null;

  say(text: string, ms = 4500, extra: { action?: { label: string; run: () => void }; icon?: string } = {}): void {
    if (this.timer) clearTimeout(this.timer);
    this.text.set(text);
    this.action.set(extra.action ?? null);
    this.icon.set(extra.icon ?? 'checkmark-circle');
    this.timer = setTimeout(() => this.dismiss(), ms);
  }

  dismiss(): void {
    if (this.timer) clearTimeout(this.timer);
    this.text.set(null);
    this.action.set(null);
  }

  /** The button pressed: done once, and the notice goes. */
  act(): void {
    const action = this.action();
    this.dismiss();
    action?.run();
  }
}
