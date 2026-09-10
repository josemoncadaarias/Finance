/**
 * The one place an account's or a category's icon is drawn.
 *
 * The schema allows exactly one of two things: a name from the built-in
 * catalog, or an image the user supplied. Every screen that drew an icon had
 * to remember both, and most of them remembered only the first — so every
 * account and category given a real logo appeared wearing `pricetag-outline`,
 * which is what `outlined(null)` falls back to. That bug was found and fixed
 * separately on the accounts screen, the summary screen, the movement list and
 * the donut, and was still live in six more places.
 *
 * Six places cannot each remember. One component can:
 *
 *     <app-icon [builtin]="category.builtin_icon"
 *               [customId]="category.custom_icon_id"></app-icon>
 *
 * `size` is a CSS length so the image and the glyph come out the same size
 * wherever it is used; without it an `<img>` in an `ion-item` renders at its
 * natural width and pushes the row apart.
 */

import { Component, computed, inject, input } from '@angular/core';
import { IonIcon } from '@ionic/angular';

import { CustomIconsService } from './custom-icons.service';
import { outlined } from './icon-catalog';

@Component({
  selector: 'app-icon',
  standalone: true,
  imports: [IonIcon],
  template: `
    @if (url(); as src) {
      <img [src]="src" alt="" class="image"
           [style.width]="size()" [style.height]="size()">
    } @else {
      <ion-icon [name]="name()" [style.fontSize]="size()"></ion-icon>
    }
  `,
  styles: [`
    :host { display: inline-flex; align-items: center; justify-content: center; }

    /* Rounded rather than circular: a bank logo is usually square, and a
       circle crops the corners off the letters. */
    .image {
      border-radius: 4px;
      object-fit: cover;
      flex: none;
    }
  `],
})
export class IconComponent {
  private readonly customIcons = inject(CustomIconsService);

  /** A name from the catalog, with or without its `-outline` suffix. */
  readonly builtin = input<string | null | undefined>(null);

  /** The id of the user's own image, when it wears one. */
  readonly customId = input<number | null | undefined>(null);

  /**
   * What to draw when there is neither — a category with no icon at all, or an
   * image that has not finished loading. Per call site, because the honest
   * stand-in for an account is a wallet and for a category a price tag.
   */
  readonly fallback = input('pricetag');

  readonly size = input('1.25rem');

  readonly url = computed(() => this.customIcons.urlFor(this.customId()));

  readonly name = computed(() => outlined(this.builtin() ?? this.fallback()));
}
