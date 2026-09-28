/**
 * The colour of the app: everything pressable, the tabs, the main card.
 *
 * Zafiro by default - the wallet of the app's own icon, lifted for a dark
 * background - and each person may choose another in Más → Apariencia
 * (Jose, 2026-09-28). A preference like the theme, kept in `localStorage`
 * beside it for the same reason: it has to be known before the first frame.
 *
 * It is painted by setting Ionic's primary colour on the root element, so
 * every `ion-button`, `ion-toggle` and `var(--ion-color-primary)` in the app
 * follows it without being told.
 */

import { Injectable, effect, signal } from '@angular/core';

export interface Accent {
  id: string;
  /** Translation key of its name. */
  label: string;
  color: string;
  /** The deeper end of the gradient on buttons and the "+". */
  deep: string;
}

export const ACCENTS: Accent[] = [
  { id: 'zafiro', label: 'accent.zafiro', color: '#6378ff', deep: '#4a5ef0' },
  { id: 'oceano', label: 'accent.oceano', color: '#3d8bfd', deep: '#2a6fe0' },
  { id: 'turquesa', label: 'accent.turquesa', color: '#22b8cf', deep: '#1597ab' },
  { id: 'esmeralda', label: 'accent.esmeralda', color: '#2fbf71', deep: '#219c5b' },
  { id: 'violeta', label: 'accent.violeta', color: '#9b6bff', deep: '#7f4cf0' },
  { id: 'coral', label: 'accent.coral', color: '#ff7a6b', deep: '#e85f50' },
];

const STORAGE_KEY = 'finance.accent';

@Injectable({ providedIn: 'root' })
export class AccentService {
  readonly choice = signal<string>(readStored());

  readonly accent = () => ACCENTS.find(a => a.id === this.choice()) ?? ACCENTS[0];

  constructor() {
    effect(() => paint(this.accent()));
  }

  set(id: string): void {
    if (!ACCENTS.some(a => a.id === id)) return;
    this.choice.set(id);
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // Blocked storage: the choice holds for this session.
    }
  }
}

function rgb(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  return `${n >> 16}, ${(n >> 8) & 255}, ${n & 255}`;
}

function paint(accent: Accent): void {
  const root = document.documentElement.style;
  root.setProperty('--ion-color-primary', accent.color);
  root.setProperty('--ion-color-primary-rgb', rgb(accent.color));
  root.setProperty('--ion-color-primary-contrast', '#ffffff');
  root.setProperty('--ion-color-primary-contrast-rgb', '255, 255, 255');
  root.setProperty('--ion-color-primary-shade', accent.deep);
  root.setProperty('--ion-color-primary-tint', accent.color);
  root.setProperty('--app-pr', accent.color);
  root.setProperty('--app-pr2', accent.deep);
  root.setProperty('--app-pr-rgb', rgb(accent.color));
}

function readStored(): string {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && ACCENTS.some(a => a.id === stored)) return stored;
  } catch {
    // Nothing known: the default.
  }
  return ACCENTS[0].id;
}
