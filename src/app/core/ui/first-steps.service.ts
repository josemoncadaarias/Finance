/**
 * Whether "Primeros pasos" was put away on this device (mockup 44e), and the
 * way to bring it back from Más → Preferencias → Guías.
 */

import { Injectable, signal } from '@angular/core';

const HIDDEN_KEY = 'finance.firstSteps.hidden';

@Injectable({ providedIn: 'root' })
export class FirstStepsService {
  readonly hidden = signal(readHidden());

  setHidden(hidden: boolean): void {
    this.hidden.set(hidden);
    try {
      if (hidden) localStorage.setItem(HIDDEN_KEY, 'yes');
      else localStorage.removeItem(HIDDEN_KEY);
    } catch {
      // Storage switched off: the choice holds for this run.
    }
  }
}

function readHidden(): boolean {
  try { return localStorage.getItem(HIDDEN_KEY) === 'yes'; } catch { return false; }
}
