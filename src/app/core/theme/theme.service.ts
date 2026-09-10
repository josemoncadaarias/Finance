/**
 * Light, dark, or whatever the phone is doing.
 *
 * Three states rather than two, and the third is the default on purpose: most
 * people set their phone once and expect every app to follow it. An app that
 * picks its own side is one more thing to go and change at night.
 *
 * The choice lives in `localStorage` next to the language, and for the same
 * reason: it has to be known before the first frame is drawn, and long before
 * the database is open. A theme that arrives a moment late is a white flash in
 * a dark room.
 *
 * Ionic ships three ways of doing this. `dark.system.css` follows the phone and
 * cannot be overridden; `dark.always.css` ignores it. This app imports
 * `dark.class.css`, which paints dark only when `.ion-palette-dark` is on the
 * root element — so the class is ours to put there, and "follow the phone"
 * becomes a media query this service listens to rather than a decision it
 * cannot take back.
 */

import { Injectable, effect, signal } from '@angular/core';

export type ThemeChoice = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'finance.theme';

/** What Ionic's `dark.class.css` looks for. */
const DARK_CLASS = 'ion-palette-dark';

export const THEMES: { value: ThemeChoice; label: string; icon: string }[] = [
  { value: 'system', label: 'theme.system', icon: 'phone-portrait-outline' },
  { value: 'light', label: 'theme.light', icon: 'sunny-outline' },
  { value: 'dark', label: 'theme.dark', icon: 'moon-outline' },
];

@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly choice = signal<ThemeChoice>(readStored());

  /** What the phone itself is set to, kept live while the app is open. */
  private readonly systemIsDark = signal(prefersDark());

  /** What is actually being painted right now. */
  readonly isDark = signal(false);

  constructor() {
    // The phone can change under the app: a schedule, or someone flipping it
    // in the notification shade. Following the phone has to mean following it,
    // not reading it once at startup.
    const media = matchMedia?.('(prefers-color-scheme: dark)');
    media?.addEventListener?.('change', event => this.systemIsDark.set(event.matches));

    effect(() => {
      const dark = this.choice() === 'system' ? this.systemIsDark() : this.choice() === 'dark';
      this.isDark.set(dark);
      document.documentElement.classList.toggle(DARK_CLASS, dark);
    });
  }

  set(choice: ThemeChoice): void {
    this.choice.set(choice);
    try {
      localStorage.setItem(STORAGE_KEY, choice);
    } catch {
      // A private window or blocked storage. The choice holds for this session,
      // which is enough; not being able to remember it is no reason to refuse
      // to make it.
    }
  }

  /**
   * Steps through the three, for a single button that cycles.
   *
   * System first, because that is where someone should be able to get back to
   * without hunting for a "reset".
   */
  next(): void {
    const order: ThemeChoice[] = ['system', 'light', 'dark'];
    const at = order.indexOf(this.choice());
    this.set(order[(at + 1) % order.length]);
  }
}

function prefersDark(): boolean {
  try {
    return matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {
    return false;
  }
}

function readStored(): ThemeChoice {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
  } catch {
    // Storage can be unavailable entirely. Following the phone is the right
    // thing to do when nothing is known.
  }
  return 'system';
}
