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
 * screen gets it without anyone remembering to ask.
 *
 * **What the phone taught it** (2026-09-24, the first version): animating
 * `text-indent` and walking the whole page after every change was smooth on a
 * computer and jumped on Jose's phone - a millimetre, then the end - because
 * both run on the thread the app itself runs on. So the text now moves by a
 * `transform` on a wrapper made for the length of the slide, which the phone
 * runs on its own, off that thread; and only what was added to the page is
 * looked at. While it moves, the text sits in a `.marquee-track` span; when a
 * once-slide ends it is put back where it was, so the "…" returns.
 */

import { Injectable } from '@angular/core';

/** How fast the text travels, in pixels a second. */
const SPEED = 40;
/** The pause before a text first moves, and at each end of its trip. */
const DELAY_MS = 1000;
const REST_MS = 900;
const TRACK = 'marquee-track';

@Injectable({ providedIn: 'root' })
export class MarqueeService {
  private started = false;
  private readonly seen = new WeakSet<Element>();
  private readonly played = new WeakSet<Element>();
  private readonly running = new WeakMap<Element, { animation: Animation; distance: number }>();
  private readonly pending = new Set<Node>();
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

    // A looping text whose box changes size is measured again.
    this.resized = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(entries => {
      for (const entry of entries) this.loop(entry.target as HTMLElement);
    });

    new MutationObserver(records => {
      for (const record of records) {
        // Its own wrapping and unwrapping is not news.
        if (this.isTrack(record.target)) continue;
        // A looping text whose words changed is measured again.
        const loop = this.loopAround(record.target);
        if (loop) this.pending.add(loop);
        record.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE && !this.isTrack(node)) this.pending.add(node);
        });
      }
      if (this.pending.size > 0) this.scheduleScan();
    }).observe(document.body, { childList: true, subtree: true, characterData: true });

    this.pending.add(document.querySelector('ion-app') ?? document.body);
    this.scheduleScan();

    // A tap on a clipped text plays it again, whatever else the tap does.
    document.addEventListener('pointerdown', event => {
      const target = event.target as HTMLElement | null;
      const clipped = target ? this.clippedAround(target) : null;
      if (clipped && !clipped.classList.contains('marquee-loop')) this.playOnce(clipped);
    }, { passive: true, capture: true });
  }

  private isTrack(node: Node): boolean {
    return node instanceof HTMLElement && node.classList.contains(TRACK);
  }

  private loopAround(node: Node): HTMLElement | null {
    const element = node instanceof HTMLElement ? node : node.parentElement;
    return element?.closest<HTMLElement>('.marquee-loop') ?? null;
  }

  private scheduleScan(): void {
    if (this.scanTimer !== null) clearTimeout(this.scanTimer);
    this.scanTimer = setTimeout(() => {
      this.scanTimer = null;
      const roots = [...this.pending];
      this.pending.clear();
      for (const root of roots) if (root.isConnected) this.scan(root as HTMLElement);
    }, 350);
  }

  /** The elements under `root`, itself included, not seen before that clip a text of their own. */
  private scan(root: HTMLElement): void {
    if (root.classList?.contains('marquee-loop') && this.seen.has(root)) {
      this.loop(root);
      return;
    }
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    for (let node: Node | null = root; node; node = walker.nextNode()) {
      const element = node as HTMLElement;
      if (this.seen.has(element) || this.isTrack(element) || !this.hasOwnText(element)) continue;
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
   * words' own width, measured with a range, whether or not they are wrapped
   * and moving.
   */
  private overflow(element: HTMLElement): number {
    const range = document.createRange();
    range.selectNodeContents(this.trackOf(element) ?? element);
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
      if (this.isTrack(element)) continue;
      if (this.seen.has(element) && this.clips(element) && this.overflow(element) > 0) return element;
    }
    return null;
  }

  private trackOf(element: HTMLElement): HTMLElement | null {
    const first = element.firstElementChild;
    return first instanceof HTMLElement && this.isTrack(first) && element.childNodes.length === 1 ? first : null;
  }

  /** Puts the text in a span of its own, the one thing that moves. */
  private wrap(element: HTMLElement): HTMLElement {
    const existing = this.trackOf(element);
    if (existing) return existing;
    const track = document.createElement('span');
    track.className = TRACK;
    track.style.display = 'inline-block';
    track.style.whiteSpace = 'nowrap';
    track.style.willChange = 'transform';
    while (element.firstChild) track.appendChild(element.firstChild);
    element.appendChild(track);
    return track;
  }

  /** Back as it was, so the ellipsis draws again. */
  private unwrap(element: HTMLElement): void {
    const track = this.trackOf(element);
    if (!track) return;
    while (track.firstChild) element.insertBefore(track.firstChild, track);
    track.remove();
  }

  /** To the end, a rest, and back; the ellipsis returns when it is over. */
  private playOnce(element: HTMLElement): void {
    if (this.running.has(element) || !element.isConnected) return;
    const distance = this.overflow(element);
    if (distance === 0) return;
    const travel = Math.min(Math.max((distance / SPEED) * 1000, 1200), 8000);
    const total = travel * 2 + REST_MS;
    const track = this.wrap(element);
    const animation = track.animate([
      { transform: 'translateX(0)', offset: 0 },
      { transform: `translateX(-${distance}px)`, offset: travel / total },
      { transform: `translateX(-${distance}px)`, offset: (travel + REST_MS) / total },
      { transform: 'translateX(0)', offset: 1 },
    ], { duration: total, easing: 'ease-in-out' });
    this.running.set(element, { animation, distance });
    const done = () => {
      this.running.delete(element);
      this.unwrap(element);
    };
    animation.onfinish = done;
    animation.oncancel = done;
  }

  /** Round and round while it does not fit; still again the moment it does. */
  private loop(element: HTMLElement): void {
    if (!element.isConnected) return;
    const distance = this.overflow(element);
    const current = this.running.get(element);
    if (current && Math.abs(current.distance - distance) <= 2) return;
    if (current) {
      current.animation.onfinish = null;
      current.animation.oncancel = null;
      current.animation.cancel();
      this.running.delete(element);
    }
    if (distance === 0) {
      this.unwrap(element);
      return;
    }
    const travel = Math.min(Math.max((distance / SPEED) * 1000, 1500), 10000);
    const total = REST_MS * 2 + travel * 2;
    const track = this.wrap(element);
    const animation = track.animate([
      { transform: 'translateX(0)', offset: 0 },
      { transform: 'translateX(0)', offset: REST_MS / total },
      { transform: `translateX(-${distance}px)`, offset: (REST_MS + travel) / total },
      { transform: `translateX(-${distance}px)`, offset: (REST_MS * 2 + travel) / total },
      { transform: 'translateX(0)', offset: 1 },
    ], { duration: total, iterations: Infinity, easing: 'ease-in-out' });
    this.running.set(element, { animation, distance });
  }
}
