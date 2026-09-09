/**
 * The donut Monefy opens on: where the period's money went, at a glance.
 *
 * Drawn as SVG arcs rather than with a charting library. The whole thing is one
 * ring of segments and a few labels; a library would be more code to configure
 * than to write, and one more thing to keep working offline.
 *
 * Colour carries meaning and nothing else: red left as spending, a neutral tone
 * left as a transfer, and the ring is the only place either appears.
 */

import { Component, computed, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import * as allIcons from 'ionicons/icons';

import type { Slice } from './group-movements';
import { formatMoney } from '../../core/database/money';

interface Segment {
  slice: Slice;
  path: string;
  colour: string;
  /** Where to anchor the label, on the outside of the ring. */
  labelX: number;
  labelY: number;
}

const SIZE = 280;
const CENTRE = SIZE / 2;
const OUTER = 104;
const INNER = 64;

/**
 * Spending shades, walked in order so neighbouring slices stay distinguishable.
 * Warm and desaturated rather than a rainbow: this is one category of thing —
 * money leaving — split into parts, not six unrelated series.
 */
const SPENT = ['#c8553d', '#e0913f', '#b5457a', '#7f5aa6', '#a8603c', '#d16b8a', '#6b5b95', '#c9a227'];

/** Transfers never take a spending colour; they are money moved, not gone. */
const MOVED = '#5b7c99';

/** Income never reaches the ring, only the legend, and always reads as green. */
const INCOME = '#2f9e6e';

@Component({
  selector: 'app-donut',
  imports: [CommonModule, IonIcon],
  template: `
    @if (slices().length === 0) {
      <div class="empty">
        <p>Nada en este periodo</p>
      </div>
    } @else {
      <!-- A month with income but no spending has an empty ring and a legend
           worth reading, so the two are shown independently. -->
      @if (segments().length > 0) {
      <div class="ring">
      <svg [attr.viewBox]="'0 0 ' + size + ' ' + size" class="donut" role="img"
           [attr.aria-label]="'Gasto por categoría: ' + summary()">
        @for (segment of segments(); track segment.slice.label) {
          <path [attr.d]="segment.path" [attr.fill]="segment.colour"
                class="segment" [class.dimmed]="highlighted() && highlighted() !== segment.slice.label"
                (click)="sliceTapped.emit(segment.slice.label)"
                (keydown.enter)="sliceTapped.emit(segment.slice.label)"
                tabindex="0" role="button"
                [attr.aria-label]="segment.slice.label + ', ' + segment.slice.percent + ' por ciento'">
            <title>{{ segment.slice.label }} — {{ segment.slice.percent }}%</title>
          </path>
        }

        <text [attr.x]="centre" [attr.y]="centre - 10" class="figure out">
          {{ outLabel() }}
        </text>
        <text [attr.x]="centre" [attr.y]="centre + 12" class="figure in">
          {{ inLabel() }}
        </text>
        @if (movedMinor() > 0) {
          <text [attr.x]="centre" [attr.y]="centre + 33" class="figure moved">
            {{ movedLabel() }}
          </text>
        }
      </svg>

        @for (segment of labelled(); track segment.slice.label) {
          <ion-icon [name]="segment.slice.icon ?? 'pricetag-outline'"
                    class="ring-icon"
                    [style.left.%]="segment.labelX / size * 100"
                    [style.top.%]="segment.labelY / size * 100"
                    [style.color]="segment.colour"
                    (click)="sliceTapped.emit(segment.slice.label)"></ion-icon>
        }
      </div>
      }

      <ul class="legend">
        @for (row of legend(); track row.slice.label) {
          <li (click)="sliceTapped.emit(row.slice.label)"
              (keydown.enter)="sliceTapped.emit(row.slice.label)" tabindex="0"
              [class.income]="row.slice.flow === 'in'">
            <ion-icon [name]="row.slice.icon ?? 'pricetag-outline'"
                      [style.color]="row.colour"></ion-icon>
            <span class="name">{{ row.slice.label }}</span>
            <span class="percent">{{ row.slice.flow === 'in' ? '' : row.slice.percent + '%' }}</span>
            <span class="amount">{{ money(row.slice.amountMinor) }}</span>
          </li>
        }
      </ul>
    }
  `,
  styles: [`
    :host { display: block; }

    .empty {
      padding: 3rem 1rem;
      text-align: center;
      color: var(--ion-color-medium);
      p { margin: 0; }
    }

    /* As wide as the screen allows: this is the screen the app opens on, and a
       small ring wastes the space it is given. */
    .ring { position: relative; width: 100%; max-width: min(88vw, 23rem); margin: 0.25rem auto 0.75rem; }

    .ring-icon {
      position: absolute;
      transform: translate(-50%, -50%);
      font-size: 1.3rem;
      cursor: pointer;
      filter: drop-shadow(0 0 2px var(--ion-background-color));
    }

    .legend li ion-icon { font-size: 1.1rem; align-self: center; }
    .legend li.income .amount { color: var(--ion-color-success); }

    .donut {
      display: block;
      width: 100%;
      max-width: 100%;
      margin: 0;
    }

    .segment {
      cursor: pointer;
      transition: opacity 140ms ease;
      outline: none;
    }
    .segment:hover, .segment:focus-visible { opacity: 0.82; }
    .segment.dimmed { opacity: 0.28; }

    .figure {
      text-anchor: middle;
      font-size: 14px;
      font-variant-numeric: tabular-nums;
      fill: var(--ion-text-color);
    }
    .figure.out { fill: var(--ion-color-danger); font-weight: 600; font-size: 17px; }
    .figure.in { fill: var(--ion-color-success); }
    .figure.moved { fill: var(--ion-color-medium); font-size: 12px; }

    .legend {
      list-style: none;
      margin: 0;
      padding: 0 1rem 1rem;
      display: flex;
      flex-direction: column;
      gap: 0.1rem;
    }

    .legend li {
      display: grid;
      grid-template-columns: 0.75rem 1fr auto auto;
      gap: 0.6rem;
      align-items: baseline;
      padding: 0.45rem 0.25rem;
      border-bottom: 1px solid var(--ion-color-light-shade);
      cursor: pointer;
      font-size: 0.9rem;
    }

    .swatch { width: 0.75rem; height: 0.75rem; border-radius: 2px; align-self: center; }
    .name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .percent { color: var(--ion-color-medium); font-variant-numeric: tabular-nums; min-width: 2.5rem; text-align: right; }
    .amount { font-variant-numeric: tabular-nums; }

    @media (prefers-reduced-motion: reduce) {
      .segment { transition: none; }
    }
  `],
})
export class DonutComponent {
  constructor() {
    // Ionicons only renders a name that has been registered. The categories
    // come from the user's data, so which icons are needed is not known until
    // runtime - registering the set the app can assign is the honest answer,
    // and tree-shaking still drops the rest of the library from the bundle.
    addIcons(allIcons as unknown as Record<string, string>);
  }

  readonly slices = input.required<Slice[]>();
  readonly inMinor = input(0);
  readonly outMinor = input(0);
  readonly movedMinor = input(0);
  readonly currency = input('COP');
  /** Label of the slice to emphasise, if any. */
  readonly highlighted = input<string | null>(null);

  readonly sliceTapped = output<string>();

  readonly size = SIZE;
  readonly centre = CENTRE;

  /** Only spending is drawn: a ring mixing what came in with what went out
   * answers nothing. Income lives in the legend. */
  readonly spentSlices = computed(() => this.slices().filter(s => s.flow !== 'in'));

  readonly segments = computed<Segment[]>(() => {
    const slices = this.spentSlices();
    const total = slices.reduce((sum, slice) => sum + slice.amountMinor, 0);
    if (total === 0) return [];

    let angle = -Math.PI / 2; // start at twelve o'clock
    let spentIndex = 0;

    return slices.map(slice => {
      const sweep = (slice.amountMinor / total) * Math.PI * 2;
      const end = angle + sweep;
      const mid = angle + sweep / 2;

      const path = ringSegment(angle, end);
      const colour = slice.flow === 'moved' ? MOVED : SPENT[spentIndex++ % SPENT.length];

      angle = end;

      return {
        slice,
        path,
        colour,
        labelX: CENTRE + Math.cos(mid) * (OUTER + 18),
        labelY: CENTRE + Math.sin(mid) * (OUTER + 18),
      };
    });
  });

  /**
   * The slices big enough to carry an icon on the ring without colliding.
   *
   * Below about a twentieth of the circle two icons sit on top of each other
   * and the ring stops being readable, so the small ones live in the legend
   * only.
   */
  readonly labelled = computed(() => this.segments().filter(s => s.slice.percent >= 5));

  /**
   * Every slice with a colour: the ones on the ring keep theirs, and income —
   * which the ring does not draw — takes the colour that means money in.
   *
   * Jose asked for income to appear here and to appear first, on the same
   * reasoning as the list: what came in is the context the spending is read
   * against.
   */
  readonly legend = computed(() => {
    const drawn = new Map(this.segments().map(segment => [segment.slice.label, segment.colour]));
    return this.slices().map(slice => ({
      slice,
      colour: drawn.get(slice.label) ?? INCOME,
    }));
  });

  readonly summary = computed(() =>
    this.segments().map(s => `${s.slice.label} ${s.slice.percent}%`).join(', '),
  );

  money(minor: number): string {
    return formatMoney(minor, this.currency(), { withSymbol: false });
  }

  outLabel(): string { return `−${this.money(this.outMinor())}`; }
  inLabel(): string { return `+${this.money(this.inMinor())}`; }
  movedLabel(): string { return `⇄ ${this.money(this.movedMinor())}`; }
}

/**
 * One segment of the ring, as an SVG path.
 *
 * A full circle cannot be drawn as a single arc — start and end coincide and
 * the renderer draws nothing — so a lone category is closed as two half arcs.
 */
function ringSegment(start: number, end: number): string {
  const full = end - start >= Math.PI * 2 - 0.0001;
  if (full) {
    return [
      `M ${CENTRE} ${CENTRE - OUTER}`,
      `A ${OUTER} ${OUTER} 0 1 1 ${CENTRE} ${CENTRE + OUTER}`,
      `A ${OUTER} ${OUTER} 0 1 1 ${CENTRE} ${CENTRE - OUTER}`,
      `M ${CENTRE} ${CENTRE - INNER}`,
      `A ${INNER} ${INNER} 0 1 0 ${CENTRE} ${CENTRE + INNER}`,
      `A ${INNER} ${INNER} 0 1 0 ${CENTRE} ${CENTRE - INNER}`,
      'Z',
    ].join(' ');
  }

  const large = end - start > Math.PI ? 1 : 0;
  const p = (radius: number, angle: number) =>
    `${(CENTRE + Math.cos(angle) * radius).toFixed(2)} ${(CENTRE + Math.sin(angle) * radius).toFixed(2)}`;

  return [
    `M ${p(OUTER, start)}`,
    `A ${OUTER} ${OUTER} 0 ${large} 1 ${p(OUTER, end)}`,
    `L ${p(INNER, end)}`,
    `A ${INNER} ${INNER} 0 ${large} 0 ${p(INNER, start)}`,
    'Z',
  ].join(' ');
}
