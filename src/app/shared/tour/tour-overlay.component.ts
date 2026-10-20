/**
 * The guided tour on screen (mockups `22a`-`22h`, `23g`): everything dims but
 * what the step lights, and a bubble above or below it says what it is. It is
 * mounted once in the app shell and draws whatever `TourService` has on.
 *
 * A step whose part is not on screen (an account with no products, say) is
 * skipped rather than pointing at nothing.
 */

import { Component, computed, effect, HostListener, inject, signal, untracked } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { IonIcon } from '@ionic/angular';

import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { TOURS, TourService, type TourStep } from '../../core/tour/tour.service';

interface Box { x: number; y: number; w: number; h: number }
const PAD = 6;

@Component({
  selector: 'app-tour-overlay',
  standalone: true,
  imports: [TranslatePipe, IonIcon, NgTemplateOutlet],
  template: `
    @if (tour.active(); as now) {
      @if (now.step < 0 || centred() || box()) {
        <div class="catch" (click)="$event.stopPropagation()"></div>
      }
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
      } @else if (centred()) {
        @let c = steps()[now.step];
        <div class="dim"></div>
        <div class="bubble centred" role="dialog" aria-modal="true">
          @if (now.news) { <span class="new">{{ 'tour.new' | t }}</span> }
          <b>{{ c.title | t }}</b>
          <p>{{ c.text | t }}</p>
          <ng-container *ngTemplateOutlet="foot; context: { now: now }"></ng-container>
        </div>
      } @else if (box(); as b) {
        <div class="hole" [style.transform]="'translate3d(' + b.x + 'px,' + b.y + 'px,0)'" [style.width.px]="b.w" [style.height.px]="b.h"
             [style.border-radius.px]="radius()" (click)="$event.stopPropagation()"></div>
        @let s = steps()[now.step];
        <div class="bubble" role="dialog" aria-modal="true"
             [style.top.px]="placement() === 'below' ? b.y + b.h + 14 : null"
             [style.bottom.px]="placement() === 'above' ? viewH() - b.y + 14 : placement() === 'inside' ? 104 : null">
          @if (placement() !== 'inside') {
            <span class="arrow" [class.up]="placement() === 'below'" [style.left.px]="arrowX()"></span>
          }
          @if (now.news) { <span class="new">{{ 'tour.new' | t }}</span> }
          <b>{{ s.title | t }}</b>
          <p>{{ s.text | t }}</p>
          <ng-container *ngTemplateOutlet="foot; context: { now: now }"></ng-container>
        </div>
      }
    }
    <ng-template #foot let-now="now">
      @if (steps().length > 1) {
        <div class="progress">
          <span class="dots">
            @for (d of steps(); track $index) { <i [class.on]="$index === now.step"></i> }
          </span>
          <span class="of">{{ 'tour.of' | t:{ step: now.step + 1, count: steps().length } }}</span>
        </div>
      }
      <div class="foot">
        <span class="grow"></span>
        @if (!last()) { <button type="button" class="skip" (click)="tour.end()">{{ 'tour.skip' | t }}</button> }
        <button type="button" class="go" (click)="tour.next()">{{ (last() ? (steps().length > 1 ? 'tour.done' : 'tour.gotIt') : 'tour.next') | t }}</button>
      </div>
    </ng-template>
  `,
  styles: [`
    :host { position: fixed; inset: 0; z-index: 60000; pointer-events: none; }
    .new { display: inline-block; align-self: flex-start; width: fit-content; margin-bottom: 6px; padding: 2px 9px; border-radius: 10px; font-size: 11.5px; font-weight: 700;
      background: rgba(var(--app-grn-rgb), 0.18); color: var(--app-grn); }
    :host:empty { display: none; }
    .catch { position: fixed; inset: 0; pointer-events: auto; touch-action: none; }
    .dim { position: fixed; inset: 0; background: rgba(3, 6, 14, 0.78); }
    .hole {
      /* No transition: animating a 4000px shadow repaints the whole screen
         every frame, which froze slower phones. */
      position: fixed; left: 0; top: 0; pointer-events: auto; touch-action: none; will-change: transform;
      box-shadow: 0 0 0 4000px rgba(3, 6, 14, 0.74); border: 2px solid var(--app-pr);
    }
    .welcome, .bubble {
      position: fixed; left: 16px; right: 16px; pointer-events: auto; touch-action: none; color: var(--app-tx);
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
    .welcome p, .bubble p { margin: 0; color: var(--app-mu); font-size: 14.5px; line-height: 1.45; white-space: pre-line; }
    .welcome .ui-btn { margin-top: 12px; width: 100%; }
    .later { background: none; border: 0; color: var(--app-mu); font: inherit; font-size: 14px; padding: 8px; cursor: pointer; }
    .bubble.centred { top: 50%; transform: translateY(-50%); left: 22px; right: 22px; }
    .bubble { border-radius: 20px; padding: 16px; display: flex; flex-direction: column; gap: 5px; }
    .bubble b { font-size: 16.5px; }
    .arrow {
      position: absolute; width: 14px; height: 14px; background: var(--app-s2); transform: rotate(45deg);
      bottom: -8px; border-right: 1px solid var(--app-line); border-bottom: 1px solid var(--app-line);
    }
    .arrow.up { bottom: auto; top: -8px; border: 0; border-left: 1px solid var(--app-line); border-top: 1px solid var(--app-line); }
    /* The count has a line of its own over the buttons: beside them, ten
       dots and a big letter size squeezed "1 de 10" onto three lines. */
    .progress { display: flex; align-items: center; gap: 10px; margin-top: 9px; }
    .foot { display: flex; align-items: center; gap: 10px; margin-top: 4px; }
    .dots { display: flex; flex-wrap: wrap; gap: 5px; min-width: 0; flex: 1; }
    .dots i { flex: none; }
    .dots i { width: 6px; height: 6px; border-radius: 3px; background: var(--app-s3); }
    .dots i.on { width: 16px; background: var(--app-pr); }
    .of { color: var(--app-mu); font-size: 12.5px; white-space: nowrap; flex: none; }
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
  /** Where the room for what is lit ends: over the floating bar. */
  private areaBottom = window.innerHeight;

  readonly steps = computed(() => this.tour.active()?.steps ?? []);
  readonly welcome = computed(() => { const now = this.tour.active(); return now ? TOURS[now.id].welcome : undefined; });
  readonly last = computed(() => { const now = this.tour.active(); return !!now && now.step === this.steps().length - 1; });
  /**
   * Where the bubble goes: under what is lit when that sits in the top half,
   * above it otherwise, and over its lower part when what is lit is taller
   * than the room either side (a long list) - never off the screen.
   */
  readonly placement = computed<'below' | 'above' | 'inside'>(() => {
    const b = this.box();
    if (!b) return 'below';
    const room = 210;
    const under = this.areaBottom - (b.y + b.h);
    const over = b.y;
    const prefer = b.y + b.h / 2 < this.viewH() / 2 ? 'below' : 'above';
    if (prefer === 'below' && under >= room) return 'below';
    if (prefer === 'above' && over >= room) return 'above';
    if (under >= room) return 'below';
    if (over >= room) return 'above';
    return 'inside';
  });
  readonly arrowX = computed(() => {
    const b = this.box();
    if (!b) return 0;
    return Math.min(Math.max(b.x + b.w / 2 - 16 - 7, 18), this.viewW - 32 - 32);
  });
  readonly radius = () => this.radiusOf;
  /** The step lights nothing: its card sits in the middle of the screen. */
  readonly centred = computed(() => {
    const now = this.tour.active();
    if (!now || now.step < 0) return false;
    const step = now.steps[now.step];
    return !step.target && !step.sel;
  });

  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    effect(() => {
      const now = this.tour.active();
      this.box.set(null);
      if (!now || now.step < 0) return;
      const step = now.steps[now.step];
      if (!step.target && !step.sel) return;
      untracked(() => this.place(selectorOf(step), true, 0));
    });
  }

  /** Nothing under the tour scrolls while it is up: what is lit would drift away from its frame. */
  @HostListener('touchmove', ['$event'])
  @HostListener('wheel', ['$event'])
  holdStill(event: Event): void {
    if (this.tour.active() && event.cancelable) event.preventDefault();
  }

  @HostListener('window:resize')
  onResize(): void {
    const now = this.tour.active();
    if (!now || now.step < 0) return;
    const step = now.steps[now.step];
    if (step.target || step.sel) this.place(selectorOf(step), false, 0);
  }

  /** Finds what the step lights, brings it into view and measures it. */
  private place(selector: string, scroll: boolean, tries: number): void {
    if (this.timer) clearTimeout(this.timer);
    const element = findShown(selector);
    if (!element) {
      // Not drawn yet, or not on this screen at all (an account with no
      // products): looked for again for a moment, then the step is skipped.
      // Nothing blocks the screen meanwhile (the catch layer waits for a frame).
      this.timer = setTimeout(() => tries < 6 ? this.place(selector, scroll, tries + 1) : this.tour.next(), 250);
      return;
    }
    const measure = () => {
      const area = areaFor(element);
      const r = element.getBoundingClientRect();
      this.viewH.set(window.innerHeight);
      this.viewW = window.innerWidth;
      this.areaBottom = area.bottom;
      const style = getComputedStyle(element);
      this.radiusOf = Math.max(14, Math.min(parseFloat(style.borderTopLeftRadius) || 18, 40) + PAD);
      // Only the part on screen is lit, never what the floating bar or the
      // title covers: a list longer than the screen is cut at those edges.
      const top = Math.max(r.top - PAD, area.top);
      const bottom = Math.min(r.bottom + PAD, area.bottom);
      this.box.set({ x: r.left - PAD, y: top, w: r.width + PAD * 2, h: Math.max(bottom - top, 24) });
    };
    if (!scroll) { measure(); return; }
    void bringIntoView(element).then(moved => {
      if (!moved) { measure(); return; }
      // The jump is instant: measured on the next frame, and once more in case
      // the page was still laying itself out.
      requestAnimationFrame(() => { measure(); this.timer = setTimeout(measure, 200); });
    });
  }
}

/** Room the bubble needs beside what is lit. */
const BUBBLE_ROOM = 220;

/**
 * The part of the screen where a lit element can be seen: under the page's
 * title bar and above the floating tab bar - unless the element is IN the
 * tab bar or another fixed layer, which never scrolls.
 */
function areaFor(element: HTMLElement): { top: number; bottom: number } {
  const full = { top: 8, bottom: window.innerHeight - 8 };
  if (element.closest('app-tab-bar') || !element.closest('ion-content')) return full;
  const header = element.closest('.ion-page')?.querySelector<HTMLElement>(':scope > ion-header');
  const headerBottom = header ? header.getBoundingClientRect().bottom : 0;
  const bar = document.querySelector<HTMLElement>('app-tab-bar nav');
  const barRect = bar?.getBoundingClientRect();
  const barTop = barRect && barRect.height > 0 && !element.closest('ion-modal') ? barRect.top : window.innerHeight;
  return { top: Math.max(headerBottom + 6, 8), bottom: Math.min(barTop - 8, window.innerHeight - 8) };
}

/**
 * Scrolls what holds the element so it sits in full view with room for the
 * bubble beside it, or, when it is taller than that, its top just under the
 * title. Answers whether anything moved.
 */
async function bringIntoView(element: HTMLElement): Promise<boolean> {
  const area = areaFor(element);
  const r = element.getBoundingClientRect();
  const free = area.bottom - area.top;
  const seen = r.top >= area.top && r.bottom <= area.bottom;
  const room = Math.max(area.bottom - r.bottom, r.top - area.top);
  if (seen && (room >= BUBBLE_ROOM || r.height + BUBBLE_ROOM > free)) return false;
  const scroller = await scrollerOf(element);
  if (!scroller) {
    element.scrollIntoView({ block: 'center', behavior: 'instant' as ScrollBehavior });
    return true;
  }
  // Short enough: it and the bubble under it, together in the middle of the
  // room. Taller: its top under the title, the bubble over its lower part.
  const wantTop = r.height + BUBBLE_ROOM <= free
    ? area.top + Math.max(12, (free - r.height - BUBBLE_ROOM) / 2)
    : area.top + 12;
  const before = scroller.scrollTop;
  const delta = r.top - wantTop;
  const max = scroller.scrollHeight - scroller.clientHeight;
  const to = Math.max(0, Math.min(before + delta, max));
  if (Math.abs(to - before) < 2) return false;
  // Instant: a smooth scroll on a slow phone ran long under the tour.
  scroller.scrollTo({ top: to, behavior: 'instant' as ScrollBehavior });
  return true;
}

/** The element that scrolls it: an ion-content's inner scroll, or the nearest scrolling parent. */
async function scrollerOf(element: HTMLElement): Promise<HTMLElement | null> {
  const content = element.closest('ion-content') as (HTMLElement & { getScrollElement?: () => Promise<HTMLElement> }) | null;
  if (content?.getScrollElement) {
    try { return await content.getScrollElement(); } catch { /* falls through to the parents */ }
  }
  for (let node = element.parentElement; node; node = node.parentElement) {
    const overflow = getComputedStyle(node).overflowY;
    if ((overflow === 'auto' || overflow === 'scroll') && node.scrollHeight > node.clientHeight) return node;
  }
  return null;
}

function selectorOf(step: TourStep): string {
  return step.sel ?? `[data-tour="${step.target}"]`;
}

/** The one element it names that is actually on screen. */
function findShown(selector: string): HTMLElement | null {
  for (const element of Array.from(document.querySelectorAll<HTMLElement>(selector))) {
    if (element.closest('.ion-page-hidden')) continue;
    const r = element.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return element;
  }
  return null;
}
