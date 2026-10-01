/**
 * How much of a limit is spent, drawn once for every screen that shows one
 * (Planes, a limit's page, Inicio, the sheet at saving; mockups `14c`-`14n`).
 *
 * Under the limit: one bar in the colour of its state. Past it, the limit is a
 * white mark and the bar runs on beyond it, striped red, so what went over is
 * seen as its own piece and not as a full bar.
 */

import { Component, computed, input } from '@angular/core';

import type { LimitState } from '../../core/limits/limits';

@Component({
  selector: 'app-limit-bar',
  standalone: true,
  template: `
    @if (percent() > 100) {
      <span class="bar"><i class="fill y" [style.width.%]="mark()"></i><i class="past" [style.width.%]="100 - mark()"></i></span>
      <b class="mark" [style.left.%]="mark()"></b>
    } @else {
      <span class="bar"><i class="fill" [class.g]="state() === 'good'" [class.y]="state() !== 'good'" [style.width.%]="percent()"></i></span>
    }
  `,
  styles: [`
    :host { display: block; position: relative; margin-top: 10px; }
    .bar { display: flex; height: var(--h, 8px); border-radius: 5px; background: var(--app-s3); overflow: hidden; }
    i { display: block; height: 100%; }
    .g { background: var(--app-grn); }
    .y { background: var(--app-yel); }
    .past { background: repeating-linear-gradient(45deg, var(--app-red) 0 6px, rgba(var(--app-red-rgb), 0.55) 6px 12px); }
    .mark {
      position: absolute;
      top: -5px;
      width: 2px;
      height: calc(var(--h, 8px) + 10px);
      margin-left: -1px;
      border-radius: 2px;
      background: var(--app-tx);
    }
    :host(.big) { --h: 10px; }
  `],
})
export class LimitBarComponent {
  readonly percent = input(0);
  readonly state = input<LimitState>('good');

  /** Where the limit falls on a bar that runs past it. */
  readonly mark = computed(() => Math.round(1_000_000 / Math.max(this.percent(), 1)) / 100);
}
