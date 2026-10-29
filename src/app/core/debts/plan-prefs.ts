/**
 * What "Salir de tus deudas" remembers on this device: the extra chosen and
 * the order. A per-device convenience (it never changes a figure), so the
 * browser's storage, guarded.
 */

import { suggestedExtra } from './debt-plan';

const EXTRA_KEY = 'finance.debtPlan.extra';
const BY_KEY = 'finance.debtPlan.by';

function read(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function write(key: string, value: string): void {
  try { localStorage.setItem(key, value); } catch { /* a private window: kept for this visit */ }
}

/** The extra the person chose, or half of what is left over when they never did. */
export function keptExtra(leftOverMinor: number): number {
  const kept = read(EXTRA_KEY);
  const value = kept === null ? NaN : Number(kept);
  return Number.isFinite(value) && value >= 0 ? value : suggestedExtra(leftOverMinor);
}
export function keepExtra(minor: number): void { write(EXTRA_KEY, String(minor)); }

export function keptOrder(): 'rate' | 'balance' { return read(BY_KEY) === 'balance' ? 'balance' : 'rate'; }
export function keepOrder(by: 'rate' | 'balance'): void { write(BY_KEY, by); }
