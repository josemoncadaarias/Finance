/**
 * Guided tours (mockups `22a`-`22i`, `23g`; Jose, 2026-10-11). The first time
 * the app opens with accounts in it, and the first time a person reaches a
 * part with something to learn, a short tour: the screen dims, one thing is
 * lit, a bubble says what it does, with "Siguiente", the step it is on and
 * "Omitir". Each tour is shown once; Más → Preferencias → Guías turns them off,
 * replays the first one and brings them all back.
 *
 * What a tour lights is found by `data-tour="..."` on the element, so a screen
 * only marks its parts and never knows a tour exists. Which tours were seen is
 * a preference of this device (localStorage), like the theme: it is not data,
 * and losing it only shows a tour again.
 */

import { Injectable, signal } from '@angular/core';

import type { TranslationKey } from '../i18n/translations';

export type TourId = 'home' | 'attention' | 'yields';

export interface TourStep {
  /** The `data-tour` value of what is lit; none for the welcome card. */
  target?: string;
  title: TranslationKey;
  text: TranslationKey;
}

export const TOURS: Record<TourId, { welcome?: { title: TranslationKey; text: TranslationKey }; steps: TourStep[] }> = {
  home: {
    welcome: { title: 'tour.home.welcome.title', text: 'tour.home.welcome.text' },
    steps: [
      { target: 'plus', title: 'tour.home.plus.title', text: 'tour.home.plus.text' },
      { target: 'scope', title: 'tour.home.scope.title', text: 'tour.home.scope.text' },
      { target: 'hero', title: 'tour.home.hero.title', text: 'tour.home.hero.text' },
      { target: 'faces', title: 'tour.home.faces.title', text: 'tour.home.faces.text' },
      { target: 'tabs', title: 'tour.home.tabs.title', text: 'tour.home.tabs.text' },
      { target: 'more', title: 'tour.home.end.title', text: 'tour.home.end.text' },
    ],
  },
  attention: {
    steps: [{ target: 'attention', title: 'tour.attention.title', text: 'tour.attention.text' }],
  },
  yields: {
    steps: [
      { target: 'yields-figure', title: 'tour.yields.figure.title', text: 'tour.yields.figure.text' },
      { target: 'yields-tabs', title: 'tour.yields.tabs.title', text: 'tour.yields.tabs.text' },
      { target: 'yields-products', title: 'tour.yields.products.title', text: 'tour.yields.products.text' },
    ],
  },
};

const ON_KEY = 'finance.tours.on';
const SEEN_KEY = 'finance.tours.seen';

export interface ActiveTour {
  id: TourId;
  /** -1 is the welcome card, before the first step. */
  step: number;
}

@Injectable({ providedIn: 'root' })
export class TourService {
  readonly enabled = signal(read(ON_KEY) !== '0');
  readonly active = signal<ActiveTour | null>(null);
  private seen = new Set<TourId>(parseSeen(read(SEEN_KEY)));
  /** Asked while another tour was on screen: started when that one ends. */
  private waiting: TourId[] = [];

  /** Starts a tour the first time it is asked for, if tours are on. */
  offer(id: TourId): void {
    if (!this.enabled() || this.seen.has(id)) return;
    if (this.active()) {
      if (this.active()!.id !== id && !this.waiting.includes(id)) this.waiting.push(id);
      return;
    }
    // Inicio's own tour comes before any other, so the person meets the app first.
    if (id !== 'home' && !this.seen.has('home')) {
      if (!this.waiting.includes(id)) this.waiting.push(id);
      return;
    }
    this.start(id);
  }

  /** Starts a tour whether it was seen or not (Más → Guías). */
  replay(id: TourId): void {
    this.waiting = [];
    this.start(id);
  }

  next(): void {
    const now = this.active();
    if (!now) return;
    if (now.step + 1 < TOURS[now.id].steps.length) this.active.set({ id: now.id, step: now.step + 1 });
    else this.end();
  }

  /** "Omitir", "Ahora no" or "Listo": the tour is seen either way. */
  end(): void {
    const now = this.active();
    if (!now) return;
    this.seen.add(now.id);
    write(SEEN_KEY, [...this.seen].join(','));
    this.active.set(null);
    const following = this.waiting.shift();
    if (following && this.enabled() && !this.seen.has(following)) setTimeout(() => this.start(following), 400);
  }

  setEnabled(on: boolean): void {
    this.enabled.set(on);
    write(ON_KEY, on ? '1' : '0');
    if (!on) { this.waiting = []; this.active.set(null); }
  }

  /** Every tour shows again the next time its part is reached. */
  resetAll(): void {
    this.seen.clear();
    write(SEEN_KEY, '');
  }

  private start(id: TourId): void {
    this.active.set({ id, step: TOURS[id].welcome ? -1 : 0 });
  }
}

function parseSeen(raw: string | null): TourId[] {
  return (raw ?? '').split(',').filter((t): t is TourId => t in TOURS);
}

function read(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}

function write(key: string, value: string): void {
  try { localStorage.setItem(key, value); } catch { /* storage may refuse */ }
}
