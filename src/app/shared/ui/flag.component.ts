/**
 * A language's flag in a circle, drawn rather than written as an emoji (flag
 * emoji do not render on many Android phones). Colombia for Spanish, the
 * United States for English (Jose, 2026-09-28, mockup `8b`).
 */

import { Component, input } from '@angular/core';

@Component({
  selector: 'app-flag',
  standalone: true,
  template: `
    <svg viewBox="0 0 30 30" [attr.width]="size()" [attr.height]="size()" aria-hidden="true">
      @if (code() === 'co') {
        <rect width="30" height="15" fill="#FCD116"/>
        <rect y="15" width="30" height="7.5" fill="#003893"/>
        <rect y="22.5" width="30" height="7.5" fill="#CE1126"/>
      } @else {
        <rect width="30" height="30" fill="#fff"/>
        @for (i of stripes; track i) {
          <rect [attr.y]="i * 4.62" width="30" height="2.31" fill="#B22234"/>
        }
        <rect width="14" height="16.2" fill="#3C3B6E"/>
        @for (i of stars; track i) {
          <circle [attr.cx]="2 + (i % 3) * 5" [attr.cy]="2.7 + ((i - (i % 3)) / 3) * 5" r=".9" fill="#fff"/>
        }
      }
    </svg>
  `,
  styles: [`
    :host { display: inline-grid; flex: none; }
    svg { border-radius: 50%; box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.15); background: #fff; }
  `],
})
export class FlagComponent {
  readonly code = input<string>('co');
  readonly size = input(38);
  readonly stripes = [0, 1, 2, 3, 4, 5, 6];
  readonly stars = [0, 1, 2, 3, 4, 5, 6, 7, 8];
}
