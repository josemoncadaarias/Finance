/**
 * "Barra de abajo" (Jose, 2026-10-15, mockups `33a`-`33f`): which three
 * screens the floating bar carries and in what order. The "+" in the middle
 * and Más at the end never move: the "+" is how a movement is registered, and
 * Más is where every screen not on the bar is reached. The app opens on the
 * first button.
 *
 * Pure, with no Angular in it, so it is tested in Node (`bar-choice.test.mjs`);
 * `ViewPrefsService` keeps the choice on the device.
 */
import type { TranslationKey } from '../i18n/translations';

export type BarId = 'home' | 'accounts' | 'report' | 'debts' | 'plans' | 'yields' | 'review' | 'categories' | 'currencies' | 'tax';

export interface BarScreen {
  id: BarId;
  /** Where the button goes. */
  route: string;
  /** Routes that light the button, besides its own (a screen it leads to). */
  also?: string[];
  icon: string;
  color: string;
  /** The short word under the icon. */
  label: TranslationKey;
  /** What the screen is, in the list to choose from. */
  about: TranslationKey;
}

export const BAR_SCREENS: BarScreen[] = [
  { id: 'home', route: '/movements', icon: 'home-outline', color: '#6378ff', label: 'ui.tab.home', about: 'bar.about.home' },
  { id: 'accounts', route: '/accounts', also: ['/products', '/debts', '/currencies'], icon: 'wallet-outline', color: '#34c98b', label: 'ui.tab.accounts', about: 'bar.about.accounts' },
  { id: 'report', route: '/report', icon: 'stats-chart-outline', color: '#9b7bff', label: 'ui.tab.report', about: 'bar.about.report' },
  { id: 'debts', route: '/debts', icon: 'receipt-outline', color: '#f6b93b', label: 'bar.debts', about: 'bar.about.debts' },
  { id: 'plans', route: '/plans', icon: 'speedometer-outline', color: '#ff9152', label: 'bar.plans', about: 'bar.about.plans' },
  { id: 'yields', route: '/products', icon: 'trending-up-outline', color: '#2ec4b6', label: 'bar.yields', about: 'bar.about.yields' },
  { id: 'review', route: '/review', icon: 'checkmark-done-outline', color: '#6378ff', label: 'bar.review', about: 'bar.about.review' },
  { id: 'categories', route: '/categories', icon: 'pricetags-outline', color: '#d07bf0', label: 'bar.categories', about: 'bar.about.categories' },
  { id: 'currencies', route: '/currencies', icon: 'cash-outline', color: '#a3d65c', label: 'bar.currencies', about: 'bar.about.currencies' },
  { id: 'tax', route: '/tax', icon: 'calculator-outline', color: '#ff9152', label: 'bar.tax', about: 'bar.about.tax' },
];

/** How the app comes: Inicio, Cuentas, Reporte. */
export const DEFAULT_BAR: readonly BarId[] = ['home', 'accounts', 'report'];

const byId = new Map(BAR_SCREENS.map(s => [s.id, s]));
export const barScreen = (id: BarId): BarScreen => byId.get(id)!;

/** The bar to draw from what was stored: three different known screens, or how the app comes. */
export function barOf(stored: unknown): BarId[] {
  if (!Array.isArray(stored) || stored.length !== 3) return [...DEFAULT_BAR];
  const ids = stored.filter((id): id is BarId => typeof id === 'string' && byId.has(id as BarId));
  return ids.length === 3 && new Set(ids).size === 3 ? ids : [...DEFAULT_BAR];
}

/**
 * The bar with `id` put on button `slot`. A screen already on another button
 * swaps places with the one it replaces, so no screen is ever on it twice.
 */
export function withChoice(bar: readonly BarId[], slot: number, id: BarId): BarId[] {
  const next = [...bar];
  if (slot < 0 || slot >= next.length) return next;
  const was = next.indexOf(id);
  if (was >= 0) next[was] = next[slot];
  next[slot] = id;
  return next;
}

/** The bar after the button at `from` is dragged to `to`. */
export function movedBar(bar: readonly BarId[], from: number, to: number): BarId[] {
  const next = [...bar];
  if (from < 0 || from >= next.length) return next;
  const [id] = next.splice(from, 1);
  next.splice(Math.max(0, Math.min(to, next.length)), 0, id);
  return next;
}

/** Where the app opens: the first button. */
export function startRoute(bar: readonly BarId[]): string {
  return barScreen(bar[0] ?? 'home').route;
}

/**
 * Which button an address lights: the one whose routes match it most closely
 * (Deudas on the bar lights for /debts, not Cuentas), or Más for any other
 * screen - they are all reached from there.
 */
export function buttonFor(bar: readonly BarId[], url: string): BarId | 'more' {
  const path = url.split(/[?#]/)[0];
  let best: BarId | null = null;
  let length = 0;
  for (const id of bar) {
    const s = barScreen(id);
    for (const prefix of [s.route, ...(s.also ?? [])]) {
      // A screen's own route beats another's "also" of the same length.
      const score = prefix.length + (prefix === s.route ? 0.5 : 0);
      if ((path === prefix || path.startsWith(prefix + '/')) && score > length) {
        best = id;
        length = score;
      }
    }
  }
  return best ?? 'more';
}

/** Of how the app comes, what is no longer on the bar: Más lists it on top. */
export function leftTheBar(bar: readonly BarId[]): BarId[] {
  return DEFAULT_BAR.filter(id => !bar.includes(id));
}
