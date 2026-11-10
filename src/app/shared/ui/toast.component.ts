import { Component, inject, signal } from '@angular/core';
import { IonIcon } from '@ionic/angular';

import { ToastService } from './toast.service';

/**
 * Draws ToastService's notice, once, in the shell: a bar under it runs out
 * with its time, still while the finger is on it; swiped up, down or aside,
 * or tapped, it goes at once (Jose, 2026-11-10, as the "Guardado" banner).
 */
@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [IonIcon],
  template: `
    @if (toast.text(); as text) {
      @for (k of [toast.key()]; track k) {
        <div class="ui-toast" role="status" [class.pressed]="toast.paused()"
             [style.transform]="shift() ? 'translate(' + shift()!.x + 'px,' + shift()!.y + 'px)' : null"
             [style.opacity]="shift() ? fade() : null"
             (pointerdown)="down($event)" (pointermove)="move($event)" (pointerup)="up($event)" (pointercancel)="cancel()">
          <ion-icon [name]="toast.icon()"></ion-icon><span class="said">{{ text }}</span>
          @if (toast.action(); as action) {
            <button type="button" class="act" data-act (click)="$event.stopPropagation(); toast.act()">{{ action.label }}</button>
          }
          <div class="track"><div class="fill" [style.animation-duration.ms]="toast.ms()"
               [style.animation-play-state]="toast.paused() ? 'paused' : 'running'"></div></div>
        </div>
      }
    }
  `,
})
export class ToastComponent {
  readonly toast = inject(ToastService);
  readonly shift = signal<{ x: number; y: number } | null>(null);
  private start: { x: number; y: number } | null = null;
  private moved = false;

  fade(): number {
    const s = this.shift();
    if (!s) return 1;
    return Math.max(0.3, 1 - Math.max(Math.abs(s.x) / 200, Math.abs(s.y) / 90));
  }

  down(event: PointerEvent): void {
    if ((event.target as HTMLElement).closest('[data-act]')) return;
    this.start = { x: event.clientX, y: event.clientY };
    this.moved = false;
    this.toast.pause();
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
  }

  move(event: PointerEvent): void {
    if (!this.start) return;
    const x = event.clientX - this.start.x, y = event.clientY - this.start.y;
    if (Math.abs(x) > 8 || Math.abs(y) > 8) this.moved = true;
    // It follows the finger along the way it moves most.
    this.shift.set(Math.abs(x) > Math.abs(y) ? { x, y: 0 } : { x: 0, y });
  }

  up(event: PointerEvent): void {
    if (!this.start) return;
    const x = event.clientX - this.start.x, y = event.clientY - this.start.y;
    this.start = null;
    this.shift.set(null);
    // A swipe, or a tap: either way the person is done with it.
    if (Math.abs(y) > 30 || Math.abs(x) > 60 || !this.moved) this.toast.dismiss();
    else this.toast.resume();
  }

  cancel(): void {
    this.start = null;
    this.shift.set(null);
    this.toast.resume();
  }
}
