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
const OUTER = 92;
const INNER = 60;

/**
 * Spending shades, walked in order so neighbouring slices stay distinguishable.
 * Warm and desaturated rather than a rainbow: this is one category of thing —
 * money leaving — split into parts, not six unrelated series.
 */
const SPENT = ['#c8553d', '#e0913f', '#b5457a', '#7f5aa6', '#a8603c', '#d16b8a', '#6b5b95', '#c9a227'];

/** Transfers never take a spending colour; they are money moved, not gone. */
const MOVED = '#5b7c99';

@Component({
  selector: 'app-donut',
  imports: [CommonModule, IonIcon],
  template: `
    @if (segments().length === 0) {
      <div class="empty">
        <p>Nada en este periodo</p>
      </div>
    } @else {
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

        <text [attr.x]="centre" [attr.y]="centre - 12" class="figure out">
          {{ outLabel() }}
        </text>
        <text [attr.x]="centre" [attr.y]="centre + 10" class="figure in">
          {{ inLabel() }}
        </text>
        @if (movedMinor() > 0) {
          <text [attr.x]="centre" [attr.y]="centre + 30" class="figure moved">
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

      <ul class="legend">
        @for (segment of segments(); track segment.slice.label) {
          <li (click)="sliceTapped.emit(segment.slice.label)"
              (keydown.enter)="sliceTapped.emit(segment.slice.label)" tabindex="0">
            <ion-icon [name]="segment.slice.icon ?? 'pricetag-outline'"
                      [style.color]="segment.colour"></ion-icon>
            <span class="name">{{ segment.slice.label }}</span>
            <span class="percent">{{ segment.slice.percent }}%</span>
            <span class="amount">{{ money(segment.slice.amountMinor) }}</span>
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

    .ring { position: relative; width: 100%; max-width: 17rem; margin: 0.5rem auto 1rem; }

    .ring-icon {
      position: absolute;
      transform: translate(-50%, -50%);
      font-size: 1.15rem;
      cursor: pointer;
      filter: drop-shadow(0 0 2px var(--ion-background-color));
    }

    .legend li ion-icon { font-size: 1.1rem; align-self: center; }

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
      font-size: 13px;
      font-variant-numeric: tabular-nums;
      fill: var(--ion-text-color);
    }
    .figure.out { fill: var(--ion-color-danger); font-weight: 600; font-size: 15px; }
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

  readonly segments = computed<Segment[]>(() => {
    const slices = this.slices();
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
        labelX: CENTRE + Math.cos(mid) * (OUTER + 24),
        labelY: CENTRE + Math.sin(mid) * (OUTER + 24),
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
