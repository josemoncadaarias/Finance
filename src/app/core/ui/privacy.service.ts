/**
 * The eye that hides every amount (Jose, 2026-10-14, mockups 28): one switch
 * for the whole app, so hiding them on Cuentas hides them on Inicio too, and
 * the same eye sits on every screen with money to bring them back.
 *
 * It works where amounts become text (`formatMoney`), so no screen has to know
 * about it; what is typed into a field and what is written to a file are left
 * alone. "Ocultar montos al abrir" (Más → Preferencias) starts the app hidden.
 */
import { Injectable, signal } from '@angular/core';

import { hideAmountsWhen } from '../database/money';

const ON_OPEN_KEY = 'finance.amounts.hideOnOpen';

function read(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}

@Injectable({ providedIn: 'root' })
export class PrivacyService {
  /** Start every opening with the amounts hidden. */
  readonly hideOnOpen = signal(read(ON_OPEN_KEY) === '1');
  readonly hidden = signal(this.hideOnOpen());

  constructor() {
    // Read inside formatMoney, so every computed figure and template that
    // shows money follows the eye by itself.
    hideAmountsWhen(() => this.hidden());
  }

  toggle(): void {
    this.hidden.update(hidden => !hidden);
  }

  setHideOnOpen(on: boolean): void {
    this.hideOnOpen.set(on);
    try { localStorage.setItem(ON_OPEN_KEY, on ? '1' : '0'); } catch { /* a preference, nothing more */ }
  }
}
