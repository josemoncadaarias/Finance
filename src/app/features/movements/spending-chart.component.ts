/**
 * Where the period's money went (mockups `16i`-`16m`, chosen by Jose on
 * 2026-10-02, replacing the small ring of `1a`).
 *
 * A big ring with what was spent inside it, and round it each category's
 * icon and percent, joined to its slice by a line in right angles - so a
 * slice is never told only by its colour, which could repeat and which a
 * category with a picture of its own never had. Under it, the categories
 * with their figures and a bar of their share in their slice's colour; then
 * income and money moved, as the list always held.
 *
 * Colours, places and lines are `donut-layout.ts`: eight chart colours at
 * most, the rest folded into one grey "N categorías más" that opens in the
 * list. Inside this card a category's icon wears its slice's colour, and a
 * picture of its own gets a ring of it.
 *
 * Tapping a slice or its icon shows that category in the middle of the ring
 * and dims the rest; tapping it again lets it go, and tapping the middle
 * opens its movements. A row of the list opens its movements, as it always
 * did. Only spending is in the ring: money moved between one's own accounts
 * was neither spent nor earned (Jose, 2026-09-28).
 */

import { Component, ElementRef, afterRenderEffect, computed, effect, inject, input, output, signal, untracked, viewChild } from '@angular/core';

import { IonIcon } from '@ionic/angular';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { I18nService } from '../../core/i18n/i18n.service';
import { amountsHidden, formatMoney } from '../../core/database/money';
import { DEFAULT_COLOR } from '../../core/theme/palette';
import { ThemeService } from '../../core/theme/theme.service';
import { BadgeComponent } from '../../shared/ui/badge.component';
import type { Slice } from './group-movements';
import {
  BOX_H, BOX_W, CY, R_IN, CHART_DARK, CHART_LIGHT, MAX_NAMED, REST_DARK, REST_LIGHT, R_OUT,
  arcPath, chartColours, layoutDonut,
} from './donut-layout';

/** The ring's hole, as a share of the box's width in container units (cqw). */
const HOLE = 2 * R_IN / BOX_W * 100;
/** The smallest a line in the hole may get before a long name takes a second line. */
const MIN_FONT = 9;

/**
 * Shrinks one line of the hole until it is no wider than `allowed` px: from
 * the stylesheet's size, measured as drawn, so the phone's font and letter
 * size count. A name that may wrap stays within two lines.
 */
function fitLine(el: HTMLElement, allowed: number): void {
  el.style.fontSize = '';
  el.style.maxWidth = `${allowed}px`;
  let size = parseFloat(getComputedStyle(el).fontSize);
  const lineHeight = () => parseFloat(getComputedStyle(el).lineHeight) || size * 1.2;
  const tooBig = () => el.scrollWidth > allowed + 0.5 || el.scrollHeight > lineHeight() * 2 + 1;
  for (let i = 0; i < 12 && tooBig() && size > MIN_FONT; i++) {
    size = Math.max(MIN_FONT, size * Math.min(0.94, allowed / el.scrollWidth));
    el.style.fontSize = `${size.toFixed(1)}px`;
  }
}

const REST = '__rest';

/** One slice of the ring: a category, or the rest folded together. */
interface Part {
  key: string;
  slice: Slice | null;
  /** The categories inside "N categorías más". */
  folded: Slice[];
  amountMinor: number;
  count: number;
  pct: number;
  color: string;
  path: string;
  pathOn: string;
  line: string;
  dot: [number, number];
  /** Where its icon sits, as a share of the box. */
  left: number;
  top: number;
}

@Component({
  selector: 'app-spending-chart',
  standalone: true,
  imports: [TranslatePipe, BadgeComponent, IonIcon],
  template: `
    @if (slices().length === 0) {
      <div class="ui-card empty">
        <app-badge class="c" shape="ci" [size]="64" builtin="pie-chart-outline" fixed="#8c9bb5"></app-badge>
        <p>{{ 'donut.empty' | t }}</p>
      </div>
    } @else {
      @if (parts().length > 0) {
        <div class="ui-card chart">
          <div class="box" #box>
            <svg [attr.viewBox]="'0 0 ' + boxW + ' ' + boxH" aria-hidden="true">
              @for (part of parts(); track part.key) {
                <g [class.dim]="isDim(part)">
                  <path [attr.d]="selected() === part.key ? part.pathOn : part.path" [attr.fill]="part.color" (click)="pick(part)"></path>
                  <path class="line" [attr.d]="part.line" [attr.stroke]="part.color"></path>
                  <circle [attr.cx]="part.dot[0]" [attr.cy]="part.dot[1]" r="2.2" [attr.fill]="part.color"></circle>
                </g>
              }
            </svg>
            @for (part of parts(); track part.key) {
              <button type="button" class="spot" [class.dim]="isDim(part)"
                      [style.left.%]="part.left" [style.top.%]="part.top" (click)="pick(part)"
                      [attr.aria-label]="labelOf(part) + ', ' + part.pct + '%'">
                @if (part.slice; as slice) {
                  <span class="face" [class.picture]="slice.customIconId != null" [style.--ring]="part.color">
                    <app-badge [size]="32" [builtin]="slice.icon" [customId]="slice.customIconId" [fixed]="part.color"></app-badge>
                  </span>
                } @else {
                  <span class="more">+{{ part.folded.length }}</span>
                }
                <span class="pct">{{ part.pct }}%</span>
                <span class="val">{{ whole(part.amountMinor, false) }}</span>
              </button>
            }
            <button type="button" class="center" #centre [class.picked]="chosen()" (click)="centerTapped()">
              @if (chosen(); as part) {
                <span class="ui-lab" data-fit="0.6">{{ part.pct }} %</span>
                <b data-fit="0.8">{{ whole(part.amountMinor) }}</b>
              } @else {
                <span class="ui-lab" data-fit="0.66">{{ 'chart.spent' | t }}</span>
                <b data-fit="0.8">{{ whole(spentMinor()) }}</b>
                <small data-fit="0.7">{{ countLine(spentCount()) }}</small>
              }
            </button>
          </div>
          <!-- The slice tapped is named under the ring, where its words have
               room; the hole keeps only its share and its figure (Jose,
               2026-10-15: nothing cut short inside the donut). -->
          @if (chosen(); as part) {
            <button type="button" class="picked-line" (click)="centerTapped()">
              @if (part.slice; as slice) {
                <span class="face" [class.picture]="slice.customIconId != null" [style.--ring]="part.color">
                  <app-badge [size]="30" [builtin]="slice.icon" [customId]="slice.customIconId" [fixed]="part.color"></app-badge>
                </span>
              } @else {
                <span class="more">+{{ part.folded.length }}</span>
              }
              <span class="what"><b>{{ labelOf(part) }}</b><small>{{ countLine(part.count) }}</small></span>
              @if (part.slice) { <span class="go">{{ 'chart.open' | t }}<ion-icon name="chevron-forward-outline"></ion-icon></span> }
            </button>
          } @else {
            <p class="hint">{{ 'chart.tapHint' | t }}</p>
          }
        </div>

        <!-- The categories, each with a bar of its share in its slice's colour. -->
        <div class="ui-list bars">
          @for (part of parts(); track part.key) {
            @if (part.slice; as slice) {
              <button type="button" class="ui-row bar" [class.dim]="isDim(part)" (click)="tapped.emit(slice.label)">
                <span class="face" [class.picture]="slice.customIconId != null" [style.--ring]="part.color">
                  <app-badge [size]="38" [builtin]="slice.icon" [customId]="slice.customIconId" [fixed]="part.color"></app-badge>
                </span>
                <span class="body">
                  <span class="top"><b class="ui-one">{{ slice.label }}</b><span class="amt">{{ money(part.amountMinor) }}</span><span class="pc">{{ part.pct }}%</span></span>
                  <span class="track"><i [style.width.%]="widthOf(part)" [style.background]="part.color"></i></span>
                </span>
              </button>
            } @else {
              <button type="button" class="ui-row bar" [class.dim]="isDim(part)" (click)="restOpen.set(!restOpen())">
                <span class="more big">+{{ part.folded.length }}</span>
                <span class="body">
                  <span class="top"><b class="ui-one">{{ moreLabel(part.folded.length) }}</b><span class="amt">{{ money(part.amountMinor) }}</span><span class="pc">{{ part.pct }}%</span></span>
                  <span class="track"><i [style.width.%]="widthOf(part)" [style.background]="part.color"></i></span>
                </span>
                <span class="chev">{{ restOpen() ? '▴' : '▾' }}</span>
              </button>
              @if (restOpen()) {
                @for (slice of part.folded; track slice.label) {
                  <button type="button" class="ui-row bar inner" (click)="tapped.emit(slice.label)">
                    <app-badge [size]="38" [builtin]="slice.icon" [customId]="slice.customIconId" [fixed]="part.color"></app-badge>
                    <span class="body">
                      <span class="top"><b class="ui-one">{{ slice.label }}</b><span class="amt">{{ money(slice.amountMinor) }}</span><span class="pc">{{ pctOf(slice.amountMinor) }}%</span></span>
                      <span class="track"><i [style.width.%]="widthOfMinor(slice.amountMinor)" [style.background]="part.color"></i></span>
                    </span>
                  </button>
                }
              }
            }
          }
        </div>
      }

      <!-- Income and money moved, as the list always held them. -->
      @if (others().length > 0) {
        <div class="ui-list all">
          @for (row of others(); track row.label + row.flow) {
            <button type="button" class="ui-row" (click)="tapped.emit(row.label)">
              <app-badge [size]="42" [builtin]="row.icon" [customId]="row.customIconId"
                         [tone]="row.color" [seed]="row.seed"></app-badge>
              <span class="ui-tx">
                <b>{{ row.label }}</b>
                <small>{{ countLine(row.count ?? 0) }}</small>
              </span>
              <span class="ui-am" [class.ui-g]="arrived(row)" [class.ui-t]="row.flow === 'moved'">
                {{ arrived(row) ? '+' : '' }}{{ money(row.amountMinor) }}
              </span>
            </button>
          }
        </div>
      }
    }
  `,
  styles: [`
    :host { display: block; }
    .chart { padding: 12px; }
    .box { position: relative; width: 100%; max-width: 380px; margin: 0 auto; aspect-ratio: ${BOX_W} / ${BOX_H}; container-type: inline-size; }
    svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
    svg path { cursor: pointer; transition: opacity 0.15s; }
    svg .line { fill: none; stroke-width: 1.5; stroke-linejoin: round; opacity: 0.9; pointer-events: none; }
    g.dim { opacity: 0.22; }
    .spot {
      position: absolute; transform: translateX(-50%); width: 56px;
      display: flex; flex-direction: column; align-items: center; gap: 8px;
      border: 0; background: none; padding: 0; font-family: inherit; color: var(--app-tx); cursor: pointer;
      transition: opacity 0.15s;
    }
    .spot.dim, .bar.dim { opacity: 0.32; }
    .pct { font-size: 12.5px; font-weight: 600; font-variant-numeric: tabular-nums; line-height: 1; }
    .val { font-size: 10.5px; color: var(--app-mu); font-variant-numeric: tabular-nums; line-height: 1; margin-top: -5px; white-space: nowrap; }
    .face { display: inline-grid; border-radius: 11px; flex: none; }
    /* A picture of its own keeps its look and wears its slice's colour as a ring. */
    .face.picture { box-shadow: 0 0 0 2px var(--app-s1), 0 0 0 4.5px var(--ring); }
    .more {
      width: 32px; height: 32px; border-radius: 10px; background: var(--app-s3); color: var(--app-mu);
      display: grid; place-items: center; font-size: 11px; flex: none;
    }
    .more.big { width: 38px; height: 38px; font-size: 12px; border-radius: 12px; }
    .center {
      position: absolute; left: 50%; top: ${CY / BOX_H * 100}%; transform: translate(-50%, -50%); width: ${HOLE * 0.82}cqw;
      border: 0; background: none; padding: 0; font-family: inherit; color: var(--app-tx); text-align: center; cursor: pointer;
      display: flex; flex-direction: column; align-items: center;
    }
    /* Everything in the middle is measured against the hole, never the screen:
       a narrow phone shrinks the ring, and the words shrink with it. */
    /* The lines above and below the figure sit where the hole is narrower:
       they get less width than the figure, which has the widest middle. */
    .center .ui-lab { font-size: min(10.5px, ${HOLE * 0.085}cqw); }
    /* "20 categorías más" is the app's own words: shown whole, on two lines. */
    /* Nothing in the hole ends in "…": every line is shrunk to fit instead
       (Jose, 2026-10-15). A category's name may take two lines. */
    .center > * { white-space: nowrap; overflow: visible; }
    .center b { font-size: min(25px, ${HOLE * 0.26}cqw); letter-spacing: -0.4px; margin-top: 2px; line-height: 1.15; white-space: nowrap; }
    .center small { color: var(--app-mu); font-size: min(12px, ${HOLE * 0.09}cqw); line-height: 1.2; margin-top: 1px; }
    .picked-line {
      display: flex; align-items: center; gap: 10px; width: 100%; margin-top: 4px; padding: 8px 10px;
      border: 0; border-radius: 14px; background: var(--app-s2); color: var(--app-tx); font: inherit; text-align: left; cursor: pointer;
    }
    .picked-line .what { flex: 1; min-width: 0; display: flex; flex-direction: column; }
    .picked-line .what b { font-weight: 600; font-size: 14.5px; white-space: normal; }
    .picked-line .what small { color: var(--app-mu); font-size: 12.5px; }
    .picked-line .go { display: flex; align-items: center; gap: 2px; color: var(--app-pr); font-size: 13px; font-weight: 600; flex: none; }
    .picked-line .go ion-icon { font-size: 15px; }
    /* A slice tapped: its share over its figure. */
    .center.picked .ui-lab { font-size: min(12px, ${HOLE * 0.1}cqw); font-weight: 600; letter-spacing: 0; }
    .hint { margin: 2px 0 0; text-align: center; color: var(--app-mu); font-size: 12.5px; }
    .bars { margin-top: 12px; }
    .bar { gap: 12px; }
    .bar.inner { padding-left: 30px; background: var(--app-s2); }
    .body { flex: 1; min-width: 0; display: flex; flex-direction: column; }
    .top { display: flex; align-items: baseline; gap: 8px; }
    .top b { flex: 1; min-width: 0; font-weight: 500; font-size: 15px; }
    .amt { font-weight: 600; font-size: 14.5px; font-variant-numeric: tabular-nums; }
    .pc { width: 36px; text-align: right; color: var(--app-mu); font-size: 13.5px; font-variant-numeric: tabular-nums; }
    .track { height: 6px; border-radius: 4px; background: var(--app-s2); margin-top: 7px; overflow: hidden; }
    .bar.inner .track { background: var(--app-s3); }
    .track i { display: block; height: 100%; border-radius: 4px; min-width: 4px; }
    .chev { color: var(--app-mu); font-size: 14px; flex: none; }
    .all { margin-top: 12px; }
    .empty { text-align: center; padding: 28px 16px; }
    .empty .c { margin: 0 auto 12px; }
    .empty p { margin: 0; color: var(--app-mu); font-size: 14px; }
  `],
})
export class SpendingChartComponent {
  private readonly i18n = inject(I18nService);
  private readonly theme = inject(ThemeService);

  readonly slices = input<readonly Slice[]>([]);
  readonly currency = input('COP');
  /** What was spent, net of refunds: the figure inside the ring. */
  readonly spentMinor = input(0);
  readonly highlighted = input<string | null>(null);
  readonly tapped = output<string>();

  readonly boxW = BOX_W;
  readonly boxH = BOX_H;

  /** The slice tapped, shown in the middle; null shows the total. */
  readonly selected = signal<string | null>(null);
  readonly restOpen = signal(false);

  private readonly box = viewChild<ElementRef<HTMLElement>>('box');
  private readonly centre = viewChild<ElementRef<HTMLElement>>('centre');
  private readonly boxWidth = signal(0);
  /** What the middle says, as drawn: any change to it fits it again. */
  private readonly centreText = computed(() => {
    const part = this.chosen();
    return part
      ? `${part.pct}|${this.whole(part.amountMinor)}`
      : `${this.whole(this.spentMinor())}|${this.countLine(this.spentCount())}|${this.i18n.language()}`;
  });

  constructor() {
    // The middle figure is measured as drawn and shrunk until it fits the
    // ring's hole with room to spare (Jose, 2026-10-15: "que no vaya a salirse
    // o tocar"). Measured, not estimated: the phone's font, its letter size
    // (up to 130 %) and the screen's width all count. Only when the figure or
    // the ring's width change - never on scroll.
    effect(onCleanup => {
      const box = this.box()?.nativeElement;
      if (!box || typeof ResizeObserver === 'undefined') return;
      const watch = new ResizeObserver(() => this.boxWidth.set(box.clientWidth));
      watch.observe(box);
      onCleanup(() => watch.disconnect());
    });
    afterRenderEffect(() => {
      const width = this.boxWidth();
      this.centreText();
      const centre = this.centre()?.nativeElement;
      if (!centre || width <= 0) return;
      const hole = width * HOLE / 100;
      for (const el of Array.from(centre.querySelectorAll<HTMLElement>('[data-fit]'))) {
        fitLine(el, hole * Number(el.dataset['fit']));
      }
    });

    // Another period or account is another ring: nothing stays chosen on it.
    effect(() => {
      this.slices();
      untracked(() => { this.selected.set(null); this.restOpen.set(false); });
    });
  }

  readonly spending = computed(() =>
    this.slices().filter(slice => slice.flow === 'out' && slice.amountMinor > 0)
      .sort((a, b) => b.amountMinor - a.amountMinor));

  readonly others = computed(() => this.slices().filter(slice => !(slice.flow === 'out' && slice.amountMinor > 0)));

  private readonly spentTotal = computed(() =>
    this.spending().reduce((sum, slice) => sum + slice.amountMinor, 0));

  readonly spentCount = computed(() => this.spending().reduce((sum, slice) => sum + (slice.count ?? 0), 0));

  /** The ring's slices: up to eight categories, then the rest in one grey. */
  readonly parts = computed<Part[]>(() => {
    const all = this.spending();
    const total = this.spentTotal();
    if (all.length === 0 || total <= 0) return [];
    const named = all.length <= MAX_NAMED ? all : all.slice(0, MAX_NAMED - 1);
    const folded = all.slice(named.length);
    const dark = this.theme.isDark();
    const palette = dark ? CHART_DARK : CHART_LIGHT;
    const colours = chartColours(named.map(slice => ({ own: ownColour(slice) })));
    const amounts = [...named.map(slice => slice.amountMinor), ...(folded.length ? [folded.reduce((sum, s) => sum + s.amountMinor, 0)] : [])];
    const layout = layoutDonut(amounts);
    return amounts.map((amountMinor, i) => {
      const slice = i < named.length ? named[i] : null;
      const arc = layout.arcs[i], spot = layout.spots[i];
      return {
        key: slice ? `${slice.label}|${slice.flow}` : REST,
        slice,
        folded: slice ? [] : folded,
        amountMinor,
        count: slice ? slice.count ?? 0 : folded.reduce((sum, s) => sum + (s.count ?? 0), 0),
        pct: Math.round(amountMinor / total * 100),
        color: slice ? palette[colours[i]] : dark ? REST_DARK : REST_LIGHT,
        path: arcPath(arc.a0, arc.a1),
        pathOn: arcPath(arc.a0, arc.a1, R_OUT + 5),
        line: layout.lines[i],
        dot: layout.dots[i],
        left: spot.x / BOX_W * 100,
        top: (spot.y - 24) / BOX_H * 100,
      };
    });
  });

  /** What the middle shows: the slice tapped, or the one the screen filters by. */
  readonly chosen = computed(() => {
    const key = this.selected();
    if (key) return this.parts().find(part => part.key === key) ?? null;
    const label = this.highlighted();
    return label ? this.parts().find(part => part.slice?.label === label) ?? null : null;
  });

  isDim(part: Part): boolean {
    const chosen = this.chosen();
    return chosen !== null && chosen.key !== part.key;
  }

  pick(part: Part): void {
    this.selected.set(this.selected() === part.key ? null : part.key);
    if (part.key === REST && this.selected() === REST) this.restOpen.set(true);
  }

  /** The middle: with a category chosen, its movements; otherwise nothing. */
  centerTapped(): void {
    const part = this.chosen();
    if (part?.slice) this.tapped.emit(part.slice.label);
    else if (part) this.selected.set(null);
  }

  labelOf(part: Part): string {
    return part.slice ? part.slice.label : this.moreLabel(part.folded.length);
  }

  moreLabel(n: number): string {
    return this.i18n.t(n === 1 ? 'chart.moreOne' : 'chart.more', { count: n });
  }

  countLine(count: number): string {
    return count === 1 ? this.i18n.t('ui.count.movement') : this.i18n.t('ui.count.movements', { count });
  }

  pctOf(minor: number): number {
    const total = this.spentTotal();
    return total > 0 ? Math.round(minor / total * 100) : 0;
  }

  /** A bar's length: its share of the largest, so the largest fills the row. */
  widthOf(part: Part): number {
    return this.widthOfMinor(part.amountMinor);
  }

  widthOfMinor(minor: number): number {
    const largest = Math.max(...this.parts().map(part => part.amountMinor), 1);
    return Math.max(minor / largest * 100, 1);
  }

  arrived(slice: Slice): boolean {
    return slice.flow === 'in' || slice.flow === 'received';
  }

  money(minor: number): string {
    return formatMoney(Math.abs(minor), this.currency(), { withSymbol: false });
  }

  /**
   * The whole figure, in pesos without cents: "$ 1.396.098" in the middle
   * and "153.571" under a percent (Jose, 2026-10-15: "1,40 M" was not read
   * as 1.4 million by everybody).
   */
  whole(minor: number, symbol = true): string {
    if (amountsHidden()) return '••••';
    const n = Math.round(Math.abs(minor) / 100).toLocaleString('es-CO');
    if (!symbol) return n;
    return this.currency() === 'COP' ? `$ ${n}` : `${n} ${this.currency()}`;
  }

}

/**
 * The colour a category asks for: its own, unless it has none to speak of -
 * the schema's default grey nobody chose, or no colour behind a picture.
 */
function ownColour(slice: Slice): string | null {
  const color = slice.color?.trim();
  if (!color || color.toUpperCase() === DEFAULT_COLOR) return null;
  return color;
}
