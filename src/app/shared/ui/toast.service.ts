/**
 * A short notice that goes away by itself: "Se guardó ...", "Leí 18
 * movimientos". The redesign's way of saying a one-off outcome, instead of a
 * green box that stays on the screen (Jose, 2026-09-28: minimal).
 *
 * It shows the time it has left as a bar that runs out, stops while the
 * finger is on it, and goes at once when swiped away or tapped (Jose,
 * 2026-11-10: a receipt's 12-second notice had to be waited out).
 */

import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly text = signal<string | null>(null);
  /** A button inside the notice, such as "Deshacer". */
  readonly action = signal<{ label: string; run: () => void } | null>(null);
  readonly icon = signal<string>('checkmark-circle');
  /** How long the notice on show lasts, for its bar. */
  readonly ms = signal(4500);
  /** Rises with every notice, so the bar starts again for each one. */
  readonly key = signal(0);
  readonly paused = signal(false);
  private timer: ReturnType<typeof setTimeout> | null = null;
  private endsAt = 0;
  private left = 0;

  say(text: string, ms = 4500, extra: { action?: { label: string; run: () => void }; icon?: string } = {}): void {
    this.stopTimer();
    this.text.set(text);
    this.action.set(extra.action ?? null);
    this.icon.set(extra.icon ?? 'checkmark-circle');
    this.ms.set(ms);
    this.key.update(k => k + 1);
    this.paused.set(false);
    this.startTimer(ms);
  }

  dismiss(): void {
    this.stopTimer();
    this.paused.set(false);
    this.text.set(null);
    this.action.set(null);
  }

  /** The finger is on the notice: its time stops. */
  pause(): void {
    if (!this.text() || this.paused()) return;
    this.left = Math.max(0, this.endsAt - Date.now());
    this.stopTimer();
    this.paused.set(true);
  }

  /** The finger is off: its time runs again from where it stopped. */
  resume(): void {
    if (!this.text() || !this.paused()) return;
    this.paused.set(false);
    this.startTimer(this.left);
  }

  /** The button pressed: done once, and the notice goes. */
  act(): void {
    const action = this.action();
    this.dismiss();
    action?.run();
  }

  private startTimer(ms: number): void {
    this.endsAt = Date.now() + ms;
    this.timer = setTimeout(() => this.dismiss(), ms);
  }

  private stopTimer(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }
}
