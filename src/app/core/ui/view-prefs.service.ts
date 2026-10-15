/**
 * "Personaliza tu vista" (Jose, 2026-10-15, mockups 31d-31i, from his
 * partner): which blocks each screen shows. Hiding moves nothing and deletes
 * nothing - it is only what is drawn - and "Volver a como viene la app" puts
 * it all back. Kept on the device, as the theme is.
 *
 * Two promises the screens keep whatever is chosen here: the first block of
 * each screen (Inicio's balance, Deudas' total, the report's figures) is
 * always shown, and a payment already late is always said on Inicio.
 */
import { Injectable, computed, signal } from '@angular/core';

import type { TranslationKey } from '../i18n/translations';

const KEY = 'finance.view';

export type ViewScreen = 'home' | 'debts' | 'report';

export interface ViewBlock {
  /** `screen.block`, as stored. */
  key: string;
  title: TranslationKey;
  about?: TranslationKey;
  icon: string;
  color: string;
  /** Always shown: the screen's own reason to exist. */
  fixed?: boolean;
}

export const VIEW_SCREENS: Record<ViewScreen, { title: TranslationKey; icon: string; color: string; blocks: ViewBlock[] }> = {
  home: {
    title: 'ui.tab.home', icon: 'home-outline', color: '#6378ff',
    blocks: [
      { key: 'home.figures', title: 'view.home.figures', about: 'view.home.figures.about', icon: 'wallet-outline', color: '#6378ff', fixed: true },
      { key: 'home.attention', title: 'view.home.attention', about: 'view.home.attention.about', icon: 'notifications-outline', color: '#ef5b66' },
      { key: 'home.chart', title: 'view.home.chart', about: 'view.home.chart.about', icon: 'pie-chart-outline', color: '#ff9152' },
      { key: 'home.list', title: 'view.home.list', about: 'view.home.list.about', icon: 'list-outline', color: '#34c98b' },
    ],
  },
  debts: {
    title: 'ui.face.debts', icon: 'receipt-outline', color: '#f6b93b',
    blocks: [
      { key: 'debts.total', title: 'view.debts.total', about: 'view.debts.total.about', icon: 'receipt-outline', color: '#9b7bff', fixed: true },
      { key: 'debts.cards', title: 'cards.title', about: 'view.debts.cards.about', icon: 'card-outline', color: '#f6b93b' },
      { key: 'debts.loans', title: 'loans.title', about: 'view.debts.loans.about', icon: 'cash-outline', color: '#9b7bff' },
    ],
  },
  report: {
    title: 'ui.tab.report', icon: 'stats-chart-outline', color: '#9b7bff',
    blocks: [
      { key: 'report.headline', title: 'report.headline', icon: 'podium-outline', color: '#6378ff', fixed: true },
      { key: 'report.versus', title: 'report.versus', icon: 'swap-vertical-outline', color: '#2ec4b6' },
      { key: 'report.jumps', title: 'report.jump', icon: 'flash-outline', color: '#ef5b66' },
      { key: 'report.categories', title: 'report.categories', icon: 'pie-chart-outline', color: '#ff9152' },
      { key: 'report.categories-versus', title: 'report.versus.categories', icon: 'git-compare-outline', color: '#4cb8f5' },
      { key: 'report.recurring', title: 'report.recurring', icon: 'repeat-outline', color: '#9b7bff' },
      { key: 'report.repeated', title: 'report.repeated', icon: 'copy-outline', color: '#d07bf0' },
      { key: 'report.by-month', title: 'report.byMonth', icon: 'bar-chart-outline', color: '#34c98b' },
      { key: 'report.ahead', title: 'report.ahead', icon: 'analytics-outline', color: '#4cb8f5' },
      { key: 'report.accounts', title: 'report.accounts', icon: 'wallet-outline', color: '#a3d65c' },
      { key: 'report.biggest', title: 'report.biggest', icon: 'arrow-up-circle-outline', color: '#f6b93b' },
    ],
  },
};

interface Stored {
  hidden: string[];
  first: 'chart' | 'list';
}

@Injectable({ providedIn: 'root' })
export class ViewPrefsService {
  private readonly stored = signal<Stored>(read());

  readonly hidden = computed(() => new Set(this.stored().hidden));
  /** What Inicio opens on when both faces are shown. */
  readonly first = computed(() => this.stored().first);

  shown(key: string): boolean {
    return !this.hidden().has(key);
  }

  /** The report's block ids the person turned off (the screen and the sheet leave them out). */
  readonly reportHidden = computed(() => new Set([...this.hidden()]
    .filter(key => key.startsWith('report.')).map(key => key.slice('report.'.length))));

  set(key: string, on: boolean): void {
    const hidden = new Set(this.stored().hidden);
    if (on) hidden.delete(key); else hidden.add(key);
    // Inicio keeps at least one of its two faces: turning one off turns the other on.
    if (!on && key === 'home.chart') hidden.delete('home.list');
    if (!on && key === 'home.list') hidden.delete('home.chart');
    this.save({ ...this.stored(), hidden: [...hidden] });
  }

  setFirst(first: 'chart' | 'list'): void {
    this.save({ ...this.stored(), first });
  }

  /** How many of a screen's blocks show. */
  shownCount(screen: ViewScreen): number {
    return VIEW_SCREENS[screen].blocks.filter(block => this.shown(block.key)).length;
  }

  /** Whether anything differs from how the app comes. */
  readonly changed = computed(() => this.stored().hidden.length > 0 || this.stored().first !== 'chart');

  reset(): void {
    this.save({ hidden: [], first: 'chart' });
  }

  private save(next: Stored): void {
    this.stored.set(next);
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* kept for this opening only */ }
  }
}

function read(): Stored {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<Stored> | null;
    return {
      hidden: Array.isArray(raw?.hidden) ? raw.hidden.filter((k): k is string => typeof k === 'string') : [],
      first: raw?.first === 'list' ? 'list' : 'chart',
    };
  } catch {
    return { hidden: [], first: 'chart' };
  }
}
