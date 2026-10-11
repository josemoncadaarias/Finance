/**
 * The guided tour on screen (mockups `22a`-`22h`, `23g`): everything dims but
 * what the step lights, and a bubble above or below it says what it is. It is
 * mounted once in the app shell and draws whatever `TourService` has on.
 *
 * A step whose part is not on screen (an account with no products, say) is
 * skipped rather than pointing at nothing.
 */

import { Component, computed, effect, HostListener, inject, signal, untracked } from '@angular/core';
import { IonIcon } from '@ionic/angular';

import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { TOURS, TourService } from '../../core/tour/tour.service';

interface Box { x: number; y: number; w: number; h: number }
const PAD = 6;

@Component({
  selector: 'app-tour-overlay',
  standalone: true,
  imports: [TranslatePipe, IonIcon],
  template: `
    @if (tour.active(); as now) {
      <div class="catch" (click)="$event.stopPropagation()"></div>
      @if (now.step < 0) {
        @let w = welcome();
        <div class="dim"></div>
        @if (w) {
          <div class="welcome" role="dialog" aria-modal="true">
            <span class="icon"><ion-icon name="compass-outline"></ion-icon></span>
            <b>{{ w.title | t }}</b>
            <p>{{ w.text | t:{ count: steps().length } }}</p>
            <button type="button" class="ui-btn" (click)="tour.next()">{{ 'tour.start' | t }}</button>
            <button type="button" class="later" (click)="tour.end()">{{ 'tour.notNow' | t }}</button>
          </div>
        }
      } @else if (box(); as b) {
        <div class="hole" [style.left.px]="b.x" [style.top.px]="b.y" [style.width.px]="b.w" [style.height.px]="b.h"
             [style.border-radius.px]="radius()"></div>
        @let s = steps()[now.step];
        <div class="bubble" role="dialog" aria-modal="true"
             [style.top.px]="below() ? b.y + b.h + 14 : null"
             [style.bottom.px]="below() ? null : viewH() - b.y + 14">
          <span class="arrow" [class.up]="below()" [style.left.px]="arrowX()"></span>
          <b>{{ s.title | t }}</b>
          <p>{{ s.text | t }}</p>
          <div class="foot">
            @if (steps().length > 1) {
              <span class="dots">
                @for (d of steps(); track $index) { <i [class.on]="$index === now.step"></i> }
              </span>
              <span class="of">{{ 'tour.of' | t:{ step: now.step + 1, count: steps().length } }}</span>
            }
            <span class="grow"></span>
            @if (!last()) { <button type="button" class="skip" (click)="tour.end()">{{ 'tour.skip' | t }}</button> }
            <button type="button" class="go" (click)="tour.next()">{{ (last() ? (steps().length > 1 ? 'tour.done' : 'tour.gotIt') : 'tour.next') | t }}</button>
          </div>
        </div>
      }
    }
  `,
  styles: [`
    :host { position: fixed; inset: 0; z-index: 60000; pointer-events: none; }
    :host:empty { display: none; }
    .catch { position: fixed; inset: 0; pointer-events: auto; }
    .dim { position: fixed; inset: 0; background: rgba(3, 6, 14, 0.78); }
    .hole {
      position: fixed; box-shadow: 0 0 0 4000px rgba(3, 6, 14, 0.74); border: 2px solid var(--app-pr);
      transition: all 0.25s ease;
    }
    .welcome, .bubble {
      position: fixed; left: 16px; right: 16px; pointer-events: auto; color: var(--app-tx);
      background: var(--app-s2); border: 1px solid var(--app-line); box-shadow: 0 12px 30px rgba(0, 0, 0, 0.45);
    }
    .welcome {
      left: 22px; right: 22px; top: 50%; transform: translateY(-50%); border-radius: 24px; padding: 22px;
      text-align: center; display: flex; flex-direction: column; align-items: center; gap: 8px;
    }
    .welcome .icon {
      width: 60px; height: 60px; border-radius: 50%; display: grid; place-items: center; font-size: 30px;
      background: rgba(var(--app-pr-rgb), 0.16); color: var(--app-pr); margin-bottom: 4px;
    }
    .welcome b { font-size: 20px; }
    .welcome p, .bubble p { margin: 0; color: var(--app-mu); font-size: 14.5px; line-height: 1.45; }
    .welcome .ui-btn { margin-top: 12px; width: 100%; }
    .later { background: none; border: 0; color: var(--app-mu); font: inherit; font-size: 14px; padding: 8px; cursor: pointer; }
    .bubble { border-radius: 20px; padding: 16px; display: flex; flex-direction: column; gap: 5px; }
    .bubble b { font-size: 16.5px; }
    .arrow {
      position: absolute; width: 14px; height: 14px; background: var(--app-s2); transform: rotate(45deg);
      bottom: -8px; border-right: 1px solid var(--app-line); border-bottom: 1px solid var(--app-line);
    }
    .arrow.up { bottom: auto; top: -8px; border: 0; border-left: 1px solid var(--app-line); border-top: 1px solid var(--app-line); }
    .foot { display: flex; align-items: center; gap: 10px; margin-top: 9px; }
    .dots { display: inline-flex; gap: 5px; }
    .dots i { width: 6px; height: 6px; border-radius: 3px; background: var(--app-s3); }
    .dots i.on { width: 16px; background: var(--app-pr); }
    .of { color: var(--app-mu); font-size: 12.5px; }
    .grow { flex: 1; }
    .skip { background: none; border: 0; color: var(--app-mu); font: inherit; font-size: 14px; padding: 8px 6px; cursor: pointer; }
    .go {
      border: 0; border-radius: 13px; padding: 9px 18px; font: inherit; font-weight: 700; font-size: 14px; cursor: pointer;
      color: #fff; background: linear-gradient(135deg, var(--app-pr), var(--app-pr2));
    }
  `],
})
export class TourOverlayComponent {
  readonly tour = inject(TourService);

  readonly box = signal<Box | null>(null);
  readonly viewH = signal(window.innerHeight);
  private viewW = window.innerWidth;
  private radiusOf = 18;

  readonly steps = computed(() => { const now = this.tour.active(); return now ? TOURS[now.id].steps : []; });
  readonly welcome = computed(() => { const now = this.tour.active(); return now ? TOURS[now.id].welcome : undefined; });
  readonly last = computed(() => { const now = this.tour.active(); return !!now && now.step === this.steps().length - 1; });
  /** The bubble goes under what is lit when that sits in the top half. */
  readonly below = computed(() => { const b = this.box(); return !!b && b.y + b.h / 2 < this.viewH() / 2; });
  readonly arrowX = computed(() => {
    const b = this.box();
    if (!b) return 0;
    return Math.min(Math.max(b.x + b.w / 2 - 16 - 7, 18), this.viewW - 32 - 32);
  });
  readonly radius = () => this.radiusOf;

  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    effect(() => {
      const now = this.tour.active();
      this.box.set(null);
      if (!now || now.step < 0) return;
      const step = TOURS[now.id].steps[now.step];
      untracked(() => this.place(step.target!));
    });
  }

  @HostListener('window:resize')
  onResize(): void {
    const now = this.tour.active();
    if (now && now.step >= 0) this.place(TOURS[now.id].steps[now.step].target!, false);
  }

  /** Finds what the step lights, brings it into view and measures it. */
  private place(target: string, scroll = true): void {
    if (this.timer) clearTimeout(this.timer);
    const element = findShown(target);
    if (!element) {
      // Nothing to point at: on to the next step, or the tour ends.
      this.timer = setTimeout(() => this.tour.next(), 0);
      return;
    }
    if (scroll) element.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    this.timer = setTimeout(() => {
      const r = element.getBoundingClientRect();
      this.viewH.set(window.innerHeight);
      this.viewW = window.innerWidth;
      const style = getComputedStyle(element);
      this.radiusOf = Math.max(14, Math.min(parseFloat(style.borderTopLeftRadius) || 18, 40) + PAD);
      this.box.set({ x: r.left - PAD, y: r.top - PAD, w: r.width + PAD * 2, h: r.height + PAD * 2 });
    }, scroll ? 380 : 0);
  }
}

/** The one element marked with this name that is actually on screen. */
function findShown(target: string): HTMLElement | null {
  for (const element of Array.from(document.querySelectorAll<HTMLElement>(`[data-tour="${target}"]`))) {
    if (element.closest('.ion-page-hidden')) continue;
    const r = element.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return element;
  }
  return null;
}
