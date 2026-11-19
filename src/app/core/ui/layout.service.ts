/**
 * Whether the screen is held sideways (or is a tablet lying down): wide and
 * not very tall. Then the floating bar becomes a rail on the left and each
 * screen spreads into columns (mockups `58a`-`58l`, Jose, 2026-11-18).
 *
 * One place answers it, for the TypeScript and for the styles. The body
 * carries `wide` and `cols` while the screen is sideways (the two are the
 * same since 2026-11-19: forms no longer open as a panel on the right, which
 * Jose found ugly - they cover the screen with the form in a centred column,
 * as on a phone held upright). A stylesheet writes `:host-context(body.cols)`
 * (a component) or `body.wide ...` (global.scss) and never repeats the query.
 */

import { computed, Injectable, signal } from '@angular/core';

/** Sideways and at least this wide: a phone held sideways is 640-950 px. */
export const WIDE_QUERY = '(orientation: landscape) and (min-width: 640px)';

@Injectable({ providedIn: 'root' })
export class LayoutService {
  private readonly media = typeof matchMedia === 'function' ? matchMedia(WIDE_QUERY) : null;

  /** True while the screen is sideways and wide enough for columns. */
  readonly wide = signal(this.media?.matches ?? false);

  /** Sideways: lay the pages out in columns. */
  readonly cols = computed(() => this.wide());

  constructor() {
    this.apply();
    this.media?.addEventListener?.('change', event => {
      this.wide.set(event.matches);
      this.apply();
    });
  }

  private apply(): void {
    if (typeof document === 'undefined') return;
    const body = document.body.classList;
    body.toggle('wide', this.wide());
    body.toggle('cols', this.cols());
  }
}
