/**
 * An account, a category or a product, as the redesign draws them: its icon
 * in its own colour on a tint of that colour. Categories and products in a
 * rounded square, accounts in a circle - the shape says which is which.
 *
 * An image of the person's own (a bank's logo) fills the shape, with the
 * colour behind it, so a logo with a transparent background takes it
 * (mockups `2q`, `2r`).
 */

import { Component, computed, inject, input } from '@angular/core';
import { IonIcon } from '@ionic/angular';

import { CustomIconsService } from '../../core/icons/custom-icons.service';
import { outlined } from '../../core/icons/icon-catalog';
import { displayColor, tint } from '../../core/theme/palette';

@Component({
  selector: 'app-badge',
  standalone: true,
  imports: [IonIcon],
  template: `
    @if (url(); as src) {
      <img [src]="src" alt="">
    } @else if (coming()) {
      <span class="coming"></span>
    } @else {
      <ion-icon [name]="name()"></ion-icon>
    }
  `,
  host: {
    '[class.ci]': "shape() === 'ci'",
    '[class.image]': 'url() !== undefined',
    '[style.width.px]': 'size()',
    '[style.height.px]': 'size()',
    '[style.color]': 'color()',
    '[style.background]': 'plate()',
    '[style.--badge-icon.px]': 'iconSize()',
  },
  styles: [`
    :host {
      display: inline-grid;
      place-items: center;
      flex: none;
      border-radius: 30%;
      overflow: hidden;
    }
    :host(.ci) { border-radius: 50%; }
    ion-icon { font-size: var(--badge-icon); }
    img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .coming { width: 50%; height: 50%; border-radius: 30%; background: currentColor; opacity: 0.35; }
  `],
})
export class BadgeComponent {
  private readonly customIcons = inject(CustomIconsService);

  readonly builtin = input<string | null | undefined>(null);
  readonly customId = input<number | null | undefined>(null);
  /** The row's own colour; the schema default is drawn from the palette. */
  readonly tone = input<string | null | undefined>(null);
  /** The row's id, so a row on the default colour always gets the same one. */
  readonly seed = input<number | null | undefined>(0);
  /** A colour that is not a row's: the swap of a transfer, a state. */
  readonly fixed = input<string | null>(null);
  readonly shape = input<'sq' | 'ci'>('sq');
  readonly size = input(42);
  readonly fallback = input('pricetag');

  readonly url = computed(() => this.customIcons.urlFor(this.customId()));
  readonly coming = computed(() =>
    this.customId() !== null && this.customId() !== undefined
    && this.url() === undefined && this.customIcons.loading());
  readonly name = computed(() => outlined(this.builtin() ?? this.fallback()));
  readonly color = computed(() => this.fixed() ?? displayColor(this.tone(), this.seed()));
  readonly plate = computed(() => tint(this.color(), this.url() ? 0.9 : 0.16));
  readonly iconSize = computed(() => Math.round(this.size() * 0.48));
}
