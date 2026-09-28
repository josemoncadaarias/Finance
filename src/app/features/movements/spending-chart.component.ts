/**
 * Where the period's money went (mockup `1a`).
 *
 * The ring keeps one size whatever the month holds. Beside it, the five
 * largest categories and "N categorías más", names cut with "…" (they slide),
 * percentages in a column of their own; what was spent sits inside the ring.
 * Under it, every category with its figure - income first, then spending,
 * each largest first, the order of the list. Tapping a slice, a legend line
 * or a row shows that category's movements, as the donut always did.
 *
 * Only spending is in the ring. Money moved between one's own accounts is on
 * the card above, never here: it was neither spent nor earned (Jose,
 * 2026-09-28).
 */

import { Component, computed, inject, input, output } from '@angular/core';

import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { I18nService } from '../../core/i18n/i18n.service';
import { formatMoney } from '../../core/database/money';
import { displayColor } from '../../core/theme/palette';
import { BadgeComponent } from '../../shared/ui/badge.component';
import type { Slice } from './group-movements';

interface Arc { slice: Slice | null; color: string; dash: string; offset: number; }

const OTHERS = '#8c9bb5';
const RADIUS = 15.9;
const RING = 2 * Math.PI * RADIUS;

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
      @if (spending().length > 0) {
        <div class="ui-card chart">
          <div class="ring">
            <svg width="124" height="124" viewBox="0 0 42 42" aria-hidden="true">
              <circle cx="21" cy="21" [attr.r]="radius" fill="none" class="track" stroke-width="6"></circle>
              @for (arc of arcs(); track $index) {
                <circle cx="21" cy="21" [attr.r]="radius" fill="none" [attr.stroke]="arc.color" stroke-width="6"
                        [attr.stroke-dasharray]="arc.dash" [attr.stroke-dashoffset]="arc.offset"
                        [class.dim]="highlighted() !== null && arc.slice?.label !== highlighted()"
                        (click)="arc.slice && tapped.emit(arc.slice.label)"></circle>
              }
            </svg>
            <div class="center">
              <div>
                <div class="ui-lab">{{ 'chart.spent' | t }}</div>
                <b>{{ short(spentMinor()) }}</b>
              </div>
            </div>
          </div>
          <div class="legend">
            @for (row of legend(); track row.label) {
              <button type="button" (click)="tapped.emit(row.label)">
                <app-badge [size]="24" [builtin]="row.icon" [customId]="row.customIconId"
                           [tone]="row.color" [seed]="row.seed"></app-badge>
                <span class="name ui-one">{{ row.label }}</span>
                <span class="pct">{{ pctOf(row) }}%</span>
              </button>
            }
            @if (rest().count > 0) {
              <div class="line rest">
                <span class="more">+{{ rest().count }}</span>
                <span class="name ui-one">{{ restLabel() }}</span>
                <span class="pct">{{ rest().pct }}%</span>
              </div>
            }
          </div>
        </div>
      }

      <div class="ui-list all">
        @for (row of slices(); track row.label + row.flow) {
          <button type="button" class="ui-row" (click)="tapped.emit(row.label)">
            <app-badge [size]="42" [builtin]="row.icon" [customId]="row.customIconId"
                       [tone]="row.color" [seed]="row.seed"></app-badge>
            <span class="ui-tx">
              <b>{{ row.label }}</b>
              <small>{{ lineOf(row) }}</small>
            </span>
            <span class="ui-am" [class.ui-g]="arrived(row)" [class.ui-p]="row.flow === 'moved'">
              {{ arrived(row) ? '+' : '' }}{{ money(row.amountMinor) }}
            </span>
          </button>
        }
      </div>
    }
  `,
  styles: [`
    :host { display: block; }
    .chart { display: flex; align-items: center; gap: 16px; }
    .ring { position: relative; flex: none; width: 124px; height: 124px; }
    svg { transform: rotate(-90deg); }
    .track { stroke: var(--app-s2); }
    circle { cursor: pointer; transition: opacity 0.15s; }
    circle.dim { opacity: 0.3; }
    .center { position: absolute; inset: 0; display: grid; place-items: center; text-align: center; pointer-events: none; }
    .center .ui-lab { font-size: 10.5px; }
    .center b { font-size: 14px; display: block; }
    .legend { flex: 1; min-width: 0; }
    .legend button, .legend .line {
      display: flex; align-items: center; gap: 8px; margin: 3px 0; font-size: 13.5px; width: 100%;
      border: 0; background: none; color: var(--app-tx); padding: 0; font-family: inherit; text-align: left; cursor: pointer;
    }
    .name { flex: 1; }
    .pct { width: 34px; text-align: right; font-variant-numeric: tabular-nums; color: var(--app-mu); flex: none; }
    .more { width: 24px; height: 24px; border-radius: 8px; background: var(--app-s3); display: grid; place-items: center; font-size: 11px; color: var(--app-mu); flex: none; }
    .rest .name { color: var(--app-mu); }
    .all { margin-top: 12px; }
    .empty { text-align: center; padding: 28px 16px; }
    .empty .c { margin: 0 auto 12px; }
    .empty p { margin: 0; color: var(--app-mu); font-size: 14px; }
  `],
})
export class SpendingChartComponent {
  private readonly i18n = inject(I18nService);

  readonly slices = input<readonly Slice[]>([]);
  readonly currency = input('COP');
  /** What was spent, net of refunds: the figure inside the ring. */
  readonly spentMinor = input(0);
  readonly highlighted = input<string | null>(null);
  readonly tapped = output<string>();

  readonly radius = RADIUS;

  readonly spending = computed(() =>
    this.slices().filter(slice => slice.flow === 'out' && slice.amountMinor > 0));

  private readonly spentTotal = computed(() =>
    this.spending().reduce((sum, slice) => sum + slice.amountMinor, 0));

  readonly legend = computed(() => this.spending().slice(0, 5));

  readonly rest = computed(() => {
    const others = this.spending().slice(5);
    const total = this.spentTotal();
    const amount = others.reduce((sum, slice) => sum + slice.amountMinor, 0);
    return { count: others.length, pct: total > 0 ? Math.round(amount / total * 100) : 0 };
  });

  readonly restLabel = computed(() => {
    const n = this.rest().count;
    return this.i18n.t(n === 1 ? 'chart.moreOne' : 'chart.more', { count: n });
  });

  /** The ring: the five largest in their colours, the rest in one grey. */
  readonly arcs = computed<Arc[]>(() => {
    const total = this.spentTotal();
    if (total <= 0) return [];
    const parts: { slice: Slice | null; color: string; share: number }[] = this.legend().map(slice => ({
      slice, color: displayColor(slice.color, slice.seed), share: slice.amountMinor / total,
    }));
    const restShare = this.spending().slice(5).reduce((sum, slice) => sum + slice.amountMinor, 0) / total;
    if (restShare > 0) parts.push({ slice: null, color: OTHERS, share: restShare });

    const gap = parts.length > 1 ? 0.7 / 100 * RING : 0;
    let offset = 0;
    return parts.map(part => {
      const length = Math.max(part.share * RING - gap, 0.01);
      const arc = { slice: part.slice, color: part.color, dash: `${length} ${RING - length}`, offset: -offset };
      offset += part.share * RING;
      return arc;
    });
  });

  pctOf(slice: Slice): number {
    const total = this.spentTotal();
    return total > 0 ? Math.round(slice.amountMinor / total * 100) : 0;
  }

  arrived(slice: Slice): boolean {
    return slice.flow === 'in' || slice.flow === 'received';
  }

  lineOf(slice: Slice): string {
    const count = slice.count ?? 0;
    const counted = count === 1 ? this.i18n.t('ui.count.movement') : this.i18n.t('ui.count.movements', { count });
    if (slice.flow === 'out' && slice.amountMinor > 0) return `${this.pctOf(slice)} % · ${counted}`;
    return counted;
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
