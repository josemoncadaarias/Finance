/**
 * Whether the screen is held sideways (or is a tablet lying down): wide and
 * not very tall. Then the floating bar becomes a rail on the left and each
 * screen spreads into columns (mockups `58a`-`58l`, Jose, 2026-11-18).
 *
 * One place answers it, for the TypeScript and for the styles. The body
 * carries:
 * - `wide` while the screen is sideways: the rail, sheets of a readable width,
 *   forms as a panel on the right;
 * - `panel` while such a form is open on the right (an `entry-sheet` modal):
 *   the page moves into the space left of it, so what was tapped stays in view;
 * - `cols` while sideways AND no panel is open: the pages spread into columns.
 *   With a panel open a page has a phone's width again and reads as a phone.
 * A stylesheet writes `:host-context(body.cols)` (a component) or
 * `body.cols ...` (global.scss) and never repeats the media query.
 */

import { computed, Injectable, signal } from '@angular/core';

/** Sideways and at least this wide: a phone held sideways is 640-950 px. */
export const WIDE_QUERY = '(orientation: landscape) and (min-width: 640px)';

/** The modals that open as a panel on the right when sideways (global.scss). */
const PANEL_CLASS = 'entry-sheet';

@Injectable({ providedIn: 'root' })
export class LayoutService {
  private readonly media = typeof matchMedia === 'function' ? matchMedia(WIDE_QUERY) : null;

  /** True while the screen is sideways and wide enough for columns. */
  readonly wide = signal(this.media?.matches ?? false);

  /** How many panels are open on the right (one form can open another). */
  private readonly panels = signal(0);

  /** True while a form is open as a panel on the right. */
  readonly panel = computed(() => this.wide() && this.panels() > 0);

  /** Sideways with the whole width for the page: lay it out in columns. */
  readonly cols = computed(() => this.wide() && this.panels() === 0);

  constructor() {
    this.apply();
    this.media?.addEventListener?.('change', event => {
      this.wide.set(event.matches);
      this.apply();
    });
    if (typeof document === 'undefined') return;
    // Ionic's overlay events bubble up from the modal itself.
    document.addEventListener('ionModalWillPresent', event => {
      if (!isPanel(event.target)) return;
      this.panels.update(n => n + 1);
      this.apply();
    });
    document.addEventListener('ionModalWillDismiss', event => {
      if (!isPanel(event.target)) return;
      this.panels.update(n => Math.max(0, n - 1));
      this.apply();
    });
  }

  private apply(): void {
    if (typeof document === 'undefined') return;
    const body = document.body.classList;
    body.toggle('wide', this.wide());
    body.toggle('panel', this.panel());
    body.toggle('cols', this.cols());
  }
}

function isPanel(target: EventTarget | null): boolean {
  return target instanceof Element && target.classList.contains(PANEL_CLASS);
}
