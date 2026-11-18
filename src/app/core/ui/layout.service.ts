/**
 * Whether the screen is held sideways (or is a tablet lying down): wide and
 * not very tall. Then the floating bar becomes a rail on the left and each
 * screen spreads into columns (mockups `58a`-`58l`, Jose, 2026-11-18).
 *
 * One place answers it, for the TypeScript (`wide()`) and for the styles: the
 * body carries the class `wide`, so a stylesheet writes
 * `:host-context(body.wide)` (a component) or `body.wide ...` (global.scss)
 * and never repeats the media query.
 */

import { Injectable, signal } from '@angular/core';

/** Sideways and at least this wide: a phone held sideways is 640-950 px. */
export const WIDE_QUERY = '(orientation: landscape) and (min-width: 640px)';

@Injectable({ providedIn: 'root' })
export class LayoutService {
  private readonly media = typeof matchMedia === 'function' ? matchMedia(WIDE_QUERY) : null;

  /** True while the screen is sideways and wide enough for columns. */
  readonly wide = signal(this.media?.matches ?? false);

  constructor() {
    this.apply(this.wide());
    this.media?.addEventListener?.('change', event => {
      this.wide.set(event.matches);
      this.apply(event.matches);
    });
  }

  private apply(wide: boolean): void {
    if (typeof document !== 'undefined') document.body.classList.toggle('wide', wide);
  }
}
