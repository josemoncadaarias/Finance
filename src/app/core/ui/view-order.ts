/**
 * The blocks of each screen "Personaliza tu vista" can hide or move, and the
 * pure arithmetic of their order (Jose, 2026-10-15). `ViewPrefsService`
 * keeps the choice; this file knows nothing of Angular, so it is tested in
 * Node (`view-prefs.test.mjs`).
 */
import type { TranslationKey } from '../i18n/translations';


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
  /** Always first, never moved (Deudas' total, the report's figures). */
  pinned?: boolean;
}

export const VIEW_SCREENS: Record<ViewScreen, { title: TranslationKey; icon: string; color: string; blocks: ViewBlock[] }> = {
  home: {
    title: 'ui.tab.home', icon: 'home-outline', color: '#6378ff',
    blocks: [
      { key: 'home.attention', title: 'view.home.attention', about: 'view.home.attention.about', icon: 'notifications-outline', color: '#ef5b66' },
      { key: 'home.figures', title: 'view.home.figures', about: 'view.home.figures.about', icon: 'wallet-outline', color: '#6378ff', fixed: true },
      { key: 'home.chart', title: 'view.home.chart', about: 'view.home.chart.about', icon: 'pie-chart-outline', color: '#ff9152' },
      { key: 'home.list', title: 'view.home.list', about: 'view.home.list.about', icon: 'list-outline', color: '#34c98b' },
    ],
  },
  debts: {
    title: 'ui.face.debts', icon: 'receipt-outline', color: '#f6b93b',
    blocks: [
      { key: 'debts.total', title: 'view.debts.total', about: 'view.debts.total.about', icon: 'receipt-outline', color: '#9b7bff', fixed: true, pinned: true },
      { key: 'debts.cards', title: 'cards.title', about: 'view.debts.cards.about', icon: 'card-outline', color: '#f6b93b' },
      { key: 'debts.loans', title: 'loans.title', about: 'view.debts.loans.about', icon: 'cash-outline', color: '#9b7bff' },
    ],
  },
  report: {
    title: 'ui.tab.report', icon: 'stats-chart-outline', color: '#9b7bff',
    blocks: [
      { key: 'report.headline', title: 'report.headline', icon: 'podium-outline', color: '#6378ff', fixed: true, pinned: true },
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


/**
 * A screen's blocks in order: a pinned block first, then those in `stored`,
 * then any block `stored` does not know yet, in the app's own order.
 */
export function orderedBlocks(screen: ViewScreen, stored: readonly string[]): ViewBlock[] {
  const blocks = VIEW_SCREENS[screen].blocks;
  const rank = (b: ViewBlock) => {
    if (b.pinned) return -1;
    const i = stored.indexOf(b.key);
    return i >= 0 ? i : stored.length + blocks.indexOf(b);
  };
  return [...blocks].sort((a, b) => rank(a) - rank(b));
}

/** The movable keys after the one at `from` is dropped at `to`. */
export function movedKeys(screen: ViewScreen, stored: readonly string[], from: number, to: number): string[] {
  const movable = orderedBlocks(screen, stored).filter(b => !b.pinned).map(b => b.key);
  if (from < 0 || from >= movable.length) return movable;
  const [key] = movable.splice(from, 1);
  movable.splice(Math.max(0, Math.min(to, movable.length)), 0, key);
  return movable;
}

/** Inicio opens on whichever of the chart and the list comes first. */
export function firstFace(homeKeys: readonly string[]): 'chart' | 'list' {
  return homeKeys.indexOf('home.list') < homeKeys.indexOf('home.chart') ? 'list' : 'chart';
}

/** Blocks in the order chosen: those named in `order` by their place, any other after, as they came. */
export function inOrder<B extends { id: string }>(blocks: readonly B[], order: readonly string[]): B[] {
  const rank = (b: B) => { const i = order.indexOf(b.id); return i >= 0 ? i : order.length + blocks.indexOf(b); };
  return [...blocks].sort((a, b) => rank(a) - rank(b));
}
