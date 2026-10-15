/**
 * "Personaliza tu vista" (Jose, 2026-10-15, mockups 31d-31i, from his
 * partner): which blocks each screen shows. Hiding moves nothing and deletes
 * nothing - it is only what is drawn - and "Volver a como viene la app" puts
 * it all back, and each screen's order is dragged there too (Jose,
 * 2026-10-15). Kept on the device, as the theme is.
 *
 * Two promises the screens keep whatever is chosen here: the first block of
 * each screen (Inicio's balance, Deudas' total, the report's figures) is
 * always shown, and a payment already late is always said on Inicio.
 */
import { Injectable, computed, signal } from '@angular/core';

import { VIEW_SCREENS, firstFace, movedKeys, orderedBlocks, type ViewBlock, type ViewScreen } from './view-order';
import { DEFAULT_BAR, barOf, movedBar, startRoute, withChoice, type BarId } from './bar-choice';

export { VIEW_SCREENS, type ViewBlock, type ViewScreen } from './view-order';

const KEY = 'finance.view';

interface Stored {
  hidden: string[];
  /** Each screen's blocks in the order chosen; empty for how the app comes. */
  order: Partial<Record<ViewScreen, string[]>>;
  /** The bottom bar's three buttons (33b); none for how the app comes. */
  bar?: BarId[];
}

@Injectable({ providedIn: 'root' })
export class ViewPrefsService {
  private readonly stored = signal<Stored>(read());

  readonly hidden = computed(() => new Set(this.stored().hidden));

  /**
   * A screen's blocks in the order chosen (dragged on "Personaliza tu vista"):
   * a pinned block first, then the stored order, then any block the stored
   * order does not know yet in the app's own order.
   */
  orderOf(screen: ViewScreen): ViewBlock[] {
    return orderedBlocks(screen, this.stored().order[screen] ?? []);
  }

  /** The keys of a screen's blocks in order, for a screen to lay itself out by. */
  readonly homeOrder = computed(() => { this.stored(); return this.orderOf('home').map(b => b.key); });
  readonly debtsOrder = computed(() => { this.stored(); return this.orderOf('debts').map(b => b.key); });
  /** The report's block ids in the order chosen. */
  readonly reportOrder = computed(() => { this.stored(); return this.orderOf('report').map(b => b.key.slice('report.'.length)); });

  /** What Inicio opens on: whichever of the chart and the list comes first. */
  readonly first = computed<'chart' | 'list'>(() => firstFace(this.homeOrder()));

  /** The bottom bar's three buttons, in order (33b). */
  readonly bar = computed<BarId[]>(() => barOf(this.stored().bar));
  /** Where the app opens: the bar's first button. */
  startRoute(): string {
    return startRoute(this.bar());
  }

  /** Button `slot` of the bar becomes `id` (one already on it swaps places). */
  setBarButton(slot: number, id: BarId): void {
    this.saveBar(withChoice(this.bar(), slot, id));
  }

  /** The bar's button at `from` dragged to `to`. */
  moveBarButton(from: number, to: number): void {
    if (from !== to) this.saveBar(movedBar(this.bar(), from, to));
  }

  resetBar(): void {
    this.saveBar([...DEFAULT_BAR]);
  }

  private saveBar(bar: BarId[]): void {
    const comes = bar.every((id, i) => id === DEFAULT_BAR[i]);
    const { bar: _, ...rest } = this.stored();
    this.save(comes ? rest : { ...rest, bar });
  }

  /** Moves the block at `from` to `to` among a screen's movable blocks. */
  move(screen: ViewScreen, from: number, to: number): void {
    if (from === to) return;
    const order = movedKeys(screen, this.stored().order[screen] ?? [], from, to);
    this.save({ ...this.stored(), order: { ...this.stored().order, [screen]: order } });
  }

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


  /** How many of a screen's blocks show. */
  shownCount(screen: ViewScreen): number {
    return VIEW_SCREENS[screen].blocks.filter(block => this.shown(block.key)).length;
  }

  /** Whether anything differs from how the app comes. */
  readonly changed = computed(() => this.stored().hidden.length > 0 || !!this.stored().bar
    || (Object.keys(VIEW_SCREENS) as ViewScreen[]).some(s => {
      const now = this.orderOf(s).map(b => b.key), comes = VIEW_SCREENS[s].blocks.map(b => b.key);
      return now.some((k, i) => k !== comes[i]);
    }));

  reset(): void {
    this.save({ hidden: [], order: {} });
  }

  private save(next: Stored): void {
    this.stored.set(next);
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* kept for this opening only */ }
  }
}

function read(): Stored {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null') as (Partial<Stored> & { first?: string }) | null;
    const order: Stored['order'] = {};
    for (const s of Object.keys(VIEW_SCREENS) as ViewScreen[]) {
      const list = raw?.order?.[s];
      if (Array.isArray(list)) order[s] = list.filter((k): k is string => typeof k === 'string');
    }
    // A first face chosen before the order existed (2026-10-15): the list ahead of the chart.
    if (raw?.first === 'list' && !order.home) order.home = ['home.attention', 'home.figures', 'home.list', 'home.chart'];
    const bar = raw?.bar === undefined ? undefined : barOf(raw.bar);
    return {
      hidden: Array.isArray(raw?.hidden) ? raw.hidden.filter((k): k is string => typeof k === 'string') : [],
      order,
      ...(bar ? { bar } : {}),
    };
  } catch {
    return { hidden: [], order: {} };
  }
}
