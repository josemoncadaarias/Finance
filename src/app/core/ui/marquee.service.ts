/**
 * Text cut short with "…" shows the rest of itself.
 *
 * Asked for by Jose on 2026-09-24, for every screen: a name, a note or a hint
 * that does not fit slides sideways so it can be read whole. How, as agreed:
 *
 *   - **Once**, anywhere: a second after it comes into view it slides to its
 *     end, rests, slides back and stays still. Tapping it plays it again.
 *     Ten long names moving together forever would be a list nobody can read.
 *   - **Without stopping**, only where a text stands alone and is marked
 *     `marquee-loop` - the account in a header.
 *   - **Never** when the phone asks for reduced motion, and never a text that
 *     fits: only one whose own box is narrower than its text moves.
 *
 * One service for the whole app rather than a directive on each of the
 * thirty-odd places that clip text: it finds them itself - any element with
 * a text of its own that the stylesheet clips with an ellipsis - so a new
 * screen gets it without anyone remembering to ask. It looks only at
 * elements it has not seen, a moment after the page stops changing, and the
 * movement is a CSS animation of `text-indent`, which the phone runs without
 * the app's help.
 */

import { Injectable } from '@angular/core';

/** How fast the text travels, in pixels a second. */
const SPEED = 40;
/** The pause before a text first moves, and at each end of its trip. */
const DELAY_MS = 1000;
const REST_MS = 900;

@Injectable({ providedIn: 'root' })
export class MarqueeService {
  private started = false;
  private readonly seen = new WeakSet<Element>();
  private readonly played = new WeakSet<Element>();
  private readonly running = new WeakMap<Element, Animation>();
  private scanTimer: ReturnType<typeof setTimeout> | null = null;
  private visible: IntersectionObserver | null = null;
  private resized: ResizeObserver | null = null;

  /** Called once, when the app starts. Does nothing where motion is unwelcome. */
  start(): void {
    if (this.started || typeof window === 'undefined') return;
    this.started = true;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    if (typeof IntersectionObserver === 'undefined' || !('animate' in Element.prototype)) return;

    this.visible = new IntersectionObserver(entries => {
      let stagger = 0;
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const element = entry.target as HTMLElement;
        this.visible?.unobserve(element);
        if (this.played.has(element)) continue;
        this.played.add(element);
        // One after another, a breath apart, rather than a list lurching at once.
        setTimeout(() => this.playOnce(element), DELAY_MS + stagger);
        stagger += 180;
      }
    }, { threshold: 0.9 });

    // A looping text whose box changes size - a rotated phone, a new account
    // chosen - is measured again.
    this.resized = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(entries => {
      for (const entry of entries) this.loop(entry.target as HTMLElement);
    });

    new MutationObserver(() => this.scheduleScan())
      .observe(document.body, { childList: true, subtree: true, characterData: true });
    this.scheduleScan();

    // A tap on a clipped text plays it again, whatever else the tap does.
    document.addEventListener('pointerdown', event => {
      const target = event.target as HTMLElement | null;
      const clipped = target ? this.clippedAround(target) : null;
      if (clipped && !clipped.classList.contains('marquee-loop')) this.playOnce(clipped);
    }, { passive: true, capture: true });
  }

  private scheduleScan(): void {
    if (this.scanTimer !== null) clearTimeout(this.scanTimer);
    this.scanTimer = setTimeout(() => {
      this.scanTimer = null;
      this.scan();
    }, 350);
  }

  /** Every element not seen before that clips a text of its own. */
  private scan(): void {
    const root = document.querySelector('ion-app') ?? document.body;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const element = node as HTMLElement;
      if (this.seen.has(element)) {
        // A looping text keeps being checked: its words change with the account.
        if (element.classList.contains('marquee-loop')) this.loop(element);
        continue;
      }
      if (!this.hasOwnText(element)) continue;
      this.seen.add(element);
      if (!this.clips(element)) continue;
      if (element.classList.contains('marquee-loop')) {
        this.resized?.observe(element);
        this.loop(element);
      } else {
        this.visible?.observe(element);
      }
    }
  }

  /** A text node of its own, not only one inside a child. */
  private hasOwnText(element: HTMLElement): boolean {
    for (const child of Array.from(element.childNodes)) {
      if (child.nodeType === Node.TEXT_NODE && child.textContent && child.textContent.trim() !== '') return true;
    }
    return false;
  }

  private clips(element: HTMLElement): boolean {
    const style = getComputedStyle(element);
    return style.textOverflow === 'ellipsis' && style.whiteSpace.startsWith('nowrap');
  }

  /**
   * How far the text runs past its box, in pixels; zero when it fits. The
   * words' own width, measured with a range, so a text in the middle of
   * moving measures the same as a still one.
   */
  private overflow(element: HTMLElement): number {
    const range = document.createRange();
    range.selectNodeContents(element);
    const text = range.getBoundingClientRect().width;
    const style = getComputedStyle(element);
    const box = element.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    const extra = Math.ceil(text - box);
    return extra > 1 ? extra : 0;
  }

  /** The clipped text a tap landed on, or near. */
  private clippedAround(target: HTMLElement): HTMLElement | null {
    let element: HTMLElement | null = target;
    for (let depth = 0; element && depth < 4; depth += 1, element = element.parentElement) {
      if (this.seen.has(element) && this.clips(element) && this.overflow(element) > 0) return element;
    }
    return null;
  }

  /** To the end, a rest, and back; the ellipsis returns when it is over. */
  private playOnce(element: HTMLElement): void {
    const distance = this.overflow(element);
    if (distance === 0 || this.running.has(element) || !element.isConnected) return;
    const travel = Math.min(Math.max((distance / SPEED) * 1000, 1200), 8000);
    const total = travel * 2 + REST_MS;
    element.style.textOverflow = 'clip';
    const animation = element.animate([
      { textIndent: '0px', offset: 0 },
      { textIndent: `-${distance}px`, offset: travel / total },
      { textIndent: `-${distance}px`, offset: (travel + REST_MS) / total },
      { textIndent: '0px', offset: 1 },
    ], { duration: total, easing: 'ease-in-out' });
    this.running.set(element, animation);
    const done = () => {
      this.running.delete(element);
      element.style.textOverflow = '';
    };
    animation.onfinish = done;
    animation.oncancel = done;
  }

  /** Round and round while it does not fit; still again the moment it does. */
  private loop(element: HTMLElement): void {
    const distance = this.overflow(element);
    const current = this.running.get(element);
    const wanted = distance > 0 ? `${distance}` : '';
    if (current && element.dataset['marqueeDistance'] === wanted) return;
    current?.cancel();
    this.running.delete(element);
    element.dataset['marqueeDistance'] = wanted;
    if (distance === 0) {
      element.style.textOverflow = '';
      return;
    }
    const travel = Math.min(Math.max((distance / SPEED) * 1000, 1500), 10000);
    const total = REST_MS * 2 + travel * 2;
    element.style.textOverflow = 'clip';
    const animation = element.animate([
      { textIndent: '0px', offset: 0 },
      { textIndent: '0px', offset: REST_MS / total },
      { textIndent: `-${distance}px`, offset: (REST_MS + travel) / total },
      { textIndent: `-${distance}px`, offset: (REST_MS * 2 + travel) / total },
      { textIndent: '0px', offset: 1 },
    ], { duration: total, iterations: Infinity, easing: 'ease-in-out' });
    this.running.set(element, animation);
  }
}
