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

import { Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';

import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { I18nService } from '../../core/i18n/i18n.service';
import { formatMoney } from '../../core/database/money';
import { DEFAULT_COLOR } from '../../core/theme/palette';
import { ThemeService } from '../../core/theme/theme.service';
import { BadgeComponent } from '../../shared/ui/badge.component';
import type { Slice } from './group-movements';
import {
  BOX_H, BOX_W, CHART_DARK, CHART_LIGHT, MAX_NAMED, REST_DARK, REST_LIGHT, R_OUT,
  arcPath, chartColours, layoutDonut,
} from './donut-layout';

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
  imports: [TranslatePipe, BadgeComponent],
  template: `
    @if (slices().length === 0) {
      <div class="ui-card empty">
        <app-badge class="c" shape="ci" [size]="64" builtin="pie-chart-outline" fixed="#8c9bb5"></app-badge>
        <p>{{ 'donut.empty' | t }}</p>
      </div>
    } @else {
      @if (parts().length > 0) {
        <div class="ui-card chart">
          <div class="box">
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
              </button>
            }
            <button type="button" class="center" (click)="centerTapped()">
              @if (chosen(); as part) {
                <span class="ui-lab" [class.ui-one]="part.slice" [class.two]="!part.slice">{{ labelOf(part) }}</span>
                <b>{{ short(part.amountMinor) }}</b>
                <small>{{ shareLine(part) }}</small>
                @if (part.slice) { <small class="open">{{ 'chart.open' | t }}</small> }
              } @else {
                <span class="ui-lab">{{ 'chart.spent' | t }}</span>
                <b>{{ short(spentMinor()) }}</b>
                <small>{{ countLine(spentCount()) }}</small>
              }
            </button>
          </div>
          <p class="hint">{{ 'chart.tapHint' | t }}</p>
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
    .box { position: relative; width: 100%; max-width: 380px; margin: 0 auto; aspect-ratio: ${BOX_W} / ${BOX_H}; }
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
    .face { display: inline-grid; border-radius: 11px; flex: none; }
    /* A picture of its own keeps its look and wears its slice's colour as a ring. */
    .face.picture { box-shadow: 0 0 0 2px var(--app-s1), 0 0 0 4.5px var(--ring); }
    .more {
      width: 32px; height: 32px; border-radius: 10px; background: var(--app-s3); color: var(--app-mu);
      display: grid; place-items: center; font-size: 11px; flex: none;
    }
    .more.big { width: 38px; height: 38px; font-size: 12px; border-radius: 12px; }
    .center {
      position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); width: 34%;
      border: 0; background: none; padding: 0; font-family: inherit; color: var(--app-tx); text-align: center; cursor: pointer;
      display: flex; flex-direction: column; align-items: center;
    }
    .center .ui-lab { font-size: 10.5px; max-width: 100%; }
    /* "20 categorías más" is the app's own words: shown whole, on two lines. */
    .center .ui-lab.two { white-space: normal; line-height: 1.25; }
    .center b { font-size: 25px; letter-spacing: -0.4px; margin-top: 2px; line-height: 1.15; }
    .center small { color: var(--app-mu); font-size: 12px; margin-top: 1px; }
    .center .open { color: var(--app-pr); margin-top: 3px; }
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

  constructor() {
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

  shareLine(part: Part): string {
    return this.i18n.t('chart.share', { pct: part.pct, count: this.countLine(part.count) });
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

  /** "5,24 M", "845 mil": the figure inside the ring, short enough to fit. */
  short(minor: number): string {
    const units = Math.abs(minor) / 100;
    const locale = this.i18n.dateLocale();
    if (units >= 1_000_000) {
      return this.i18n.t('chart.millions', {
        n: (units / 1_000_000).toLocaleString(locale, { maximumFractionDigits: 2, minimumFractionDigits: 2 }),
      });
    }
    if (units >= 1_000) {
      return this.i18n.t('chart.thousands', { n: Math.round(units / 1_000).toLocaleString(locale) });
    }
    return Math.round(units).toLocaleString(locale);
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
