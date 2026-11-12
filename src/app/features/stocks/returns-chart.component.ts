/**
 * "Rendimiento": the gain or loss over time, apart from what was put in
 * (Jose, 2026-11-12). One line that goes above and below zero, the periods
 * the tools people know offer, and a finger on the line says that day's
 * figure. For everything held, or for one ticker.
 */
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { IonIcon } from '@ionic/angular';

import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { I18nService } from '../../core/i18n/i18n.service';
import type { TranslationKey } from '../../core/i18n/translations';
import type { IsoDate } from '../../core/database/types';
import { amountsHidden, formatMoney } from '../../core/database/money';
import { fromIsoDay, isoDay } from '../../core/filters/period';
import type { Quote, Trade } from '../../core/stocks/positions';
import { RANGES, returnsOf, type Range } from '../../core/stocks/returns';

const WIDTH = 300;
const HEIGHT = 130;
const PAD = 8;

@Component({
  selector: 'app-returns-chart',
  standalone: true,
  imports: [TranslatePipe, IonIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ranges" role="tablist">
      @for (one of ranges; track one) {
        <button type="button" [class.on]="range() === one" (click)="choose(one)">{{ word('stocks.range.' + one) }}</button>
      }
    </div>

    @if (view(); as v) {
      <div class="head" [class.up]="v.shown >= 0" [class.down]="v.shown < 0">
        <ion-icon [name]="v.shown >= 0 ? 'trending-up' : 'trending-down'"></ion-icon>
        <b>{{ signed(v.shown) }}</b>
        @if (v.pct !== null && touched() === null) { <span>{{ pct(v.pct) }}</span> }
      </div>
      <div class="when">{{ v.when }}</div>

      <svg [attr.viewBox]="box" preserveAspectRatio="none" (pointerdown)="touch($event)" (pointermove)="touch($event)"
           (pointerup)="touched.set(null)" (pointerleave)="touched.set(null)" (pointercancel)="touched.set(null)">
        <polygon [attr.points]="v.area" [class.up]="v.total >= 0" [class.down]="v.total < 0" class="area"></polygon>
        <line x1="0" [attr.x2]="width" [attr.y1]="v.zero" [attr.y2]="v.zero" class="zero"></line>
        <polyline [attr.points]="v.line" [class.up]="v.total >= 0" [class.down]="v.total < 0" class="line"></polyline>
        @if (v.mark; as m) {
          <line [attr.x1]="m.x" [attr.x2]="m.x" y1="0" [attr.y2]="height" class="cursor"></line>
          <circle [attr.cx]="m.x" [attr.cy]="m.y" r="3.5" [class.up]="v.shown >= 0" [class.down]="v.shown < 0" class="dot"></circle>
        }
      </svg>
      <div class="axis"><span>{{ v.from }}</span><span>{{ 'stocks.returns.zero' | t }}</span><span>{{ v.to }}</span></div>

      @if (v.dividends !== 0) { <p class="note">{{ 'stocks.returns.dividends' | t:{ amount: money(v.dividends) } }}</p> }
      @if (v.flat) { <p class="note warn">{{ 'stocks.returns.flat' | t }}</p> }
      @if (v.estimated) { <p class="note">{{ 'stocks.returns.estimated' | t }}</p> }
    } @else {
      <p class="note">{{ 'stocks.returns.none' | t }}</p>
    }
  `,
  styles: [`
    :host { display: block; }
    .ranges { display: flex; gap: 4px; background: var(--app-s2); border-radius: 12px; padding: 3px; margin-bottom: 12px;
      overflow-x: auto; scrollbar-width: none; &::-webkit-scrollbar { display: none; }
      button { flex: 1 0 auto; padding-left: 11px !important; padding-right: 11px !important; border: 0; background: none; color: var(--app-mu); font: inherit; font-size: 12.5px; font-weight: 600;
        padding: 7px 0; border-radius: 9px; cursor: pointer; white-space: nowrap; }
      button.on { background: var(--app-pr); color: #fff; } }
    .head { display: flex; align-items: center; flex-wrap: wrap; gap: 7px; font-size: 22px;
      ion-icon { font-size: 22px; } b { font-weight: 800; } span { font-size: 15px; font-weight: 700; }
      &.up { color: var(--app-grn); } &.down { color: var(--app-red); } }
    .when { font-size: 12.5px; color: var(--app-mu); margin: 2px 0 8px; min-height: 17px; text-wrap: pretty; }
    svg { display: block; width: 100%; height: 150px; touch-action: pan-y; cursor: crosshair;
      .line { fill: none; stroke-width: 2.2; stroke-linejoin: round; stroke-linecap: round; vector-effect: non-scaling-stroke; }
      .line.up, .dot.up { stroke: var(--app-grn); } .line.down, .dot.down { stroke: var(--app-red); }
      .area.up { fill: rgba(var(--app-grn-rgb), 0.14); } .area.down { fill: rgba(var(--app-red-rgb), 0.14); }
      .zero { stroke: var(--app-mu); stroke-width: 1; stroke-dasharray: 4 4; vector-effect: non-scaling-stroke; opacity: 0.7; }
      .cursor { stroke: var(--app-mu); stroke-width: 1; vector-effect: non-scaling-stroke; }
      .dot { fill: var(--app-s1); stroke-width: 2; vector-effect: non-scaling-stroke; } }
    .axis { display: flex; justify-content: space-between; gap: 8px; font-size: 11.5px; color: var(--app-mu); margin-top: 5px;
      span:nth-child(2) { opacity: 0.8; } }
    .note.warn { color: var(--app-yel); }
    .note { margin: 9px 0 0; font-size: 12.5px; color: var(--app-mu); line-height: 1.4; text-wrap: pretty; }
  `],
})
export class ReturnsChartComponent {
  private readonly i18n = inject(I18nService);

  readonly trades = input.required<readonly Trade[]>();
  readonly prices = input.required<readonly { symbol: string; day: IsoDate; price_e6: number }[]>();
  readonly quotes = input.required<ReadonlyMap<string, Quote>>();
  readonly currency = input.required<string>();
  /** One ticker, or everything held when null. */
  readonly symbol = input<string | null>(null);

  readonly ranges = RANGES;
  readonly range = signal<Range>(readRange());
  /** The point under the finger. */
  readonly touched = signal<number | null>(null);
  readonly width = WIDTH;
  readonly height = HEIGHT;
  readonly box = `0 0 ${WIDTH} ${HEIGHT}`;

  private readonly returns = computed(() => returnsOf(this.trades(), this.prices(), this.quotes(), {
    currency: this.currency(), symbol: this.symbol(), range: this.range(), today: isoDay(new Date()) as IsoDate,
  }));

  readonly view = computed(() => {
    const found = this.returns();
    if (found === null || found.points.length < 2) return null;
    const points = found.points;
    const most = Math.max(0, ...points.map(point => point.gainMinor));
    const least = Math.min(0, ...points.map(point => point.gainMinor));
    const span = Math.max(1, most - least);
    const x = (at: number): number => at / (points.length - 1) * WIDTH;
    const y = (minor: number): number => PAD + (most - minor) / span * (HEIGHT - 2 * PAD);
    const line = points.map((point, at) => `${x(at).toFixed(1)},${y(point.gainMinor).toFixed(1)}`).join(' ');
    const zero = y(0);
    const at = this.touched();
    const point = at === null ? null : points[Math.min(points.length - 1, Math.max(0, at))];
    return {
      line,
      area: `0,${zero.toFixed(1)} ${line} ${WIDTH},${zero.toFixed(1)}`,
      zero,
      total: found.changeMinor,
      shown: point ? point.gainMinor : found.changeMinor,
      pct: found.pct,
      when: point
        ? this.i18n.t('stocks.returns.on', { day: this.day(point.day) })
        : this.i18n.t(found.changeMinor >= 0 ? 'stocks.returns.gained' : 'stocks.returns.lost', { day: this.day(found.from) }),
      mark: point && at !== null ? { x: x(Math.min(points.length - 1, Math.max(0, at))), y: y(point.gainMinor) } : null,
      from: this.day(found.from),
      to: this.day(found.to),
      dividends: found.dividendsMinor,
      estimated: found.estimated,
      flat: found.flat,
      count: points.length,
    };
  });

  choose(range: Range): void {
    this.range.set(range);
    this.touched.set(null);
    try { localStorage.setItem(RANGE_KEY, range); } catch { /* kept for this visit only */ }
  }

  touch(event: PointerEvent): void {
    const view = this.view();
    if (!view) return;
    const box = (event.currentTarget as SVGElement).getBoundingClientRect();
    const part = Math.min(1, Math.max(0, (event.clientX - box.left) / box.width));
    this.touched.set(Math.round(part * (view.count - 1)));
  }

  word(key: string): string {
    return this.i18n.t(key as TranslationKey);
  }

  money(minor: number): string {
    return formatMoney(minor, this.currency());
  }

  signed(minor: number): string {
    const text = formatMoney(Math.abs(minor), this.currency());
    return amountsHidden() ? text : `${minor < 0 ? '−' : '+'}${text}`;
  }

  pct(value: number): string {
    const text = new Intl.NumberFormat(this.i18n.dateLocale(), { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(Math.abs(value));
    return `(${value < 0 ? '−' : '+'}${text} %)`;
  }

  private day(day: string): string {
    return new Intl.DateTimeFormat(this.i18n.dateLocale(), { day: 'numeric', month: 'short', year: 'numeric' }).format(fromIsoDay(day));
  }
}

const RANGE_KEY = 'finance.stocks.range';

function readRange(): Range {
  try {
    const kept = localStorage.getItem(RANGE_KEY) as Range | null;
    return kept !== null && RANGES.includes(kept) ? kept : 'MAX';
  } catch {
    return 'MAX';
  }
}
