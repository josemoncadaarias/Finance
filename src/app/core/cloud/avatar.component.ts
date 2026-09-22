/**
 * Whoever is signed in, as a picture or as their initial.
 *
 * Both screens that show the account drew this themselves, and both had the
 * same hole: they fell back to an initial when there was no photo URL, and
 * not when there WAS one that failed to load. Google's profile URLs expire,
 * and none of them load with no network - which is most of the time in an
 * offline-first app. Jose saw a half-drawn image where his face should be.
 *
 * So the fallback is on the load failing, not on the URL being absent, and
 * it lives in one component because there is one answer to "who is signed
 * in" and it should look the same in both places.
 */

import { Component, computed, input, signal } from '@angular/core';

@Component({
  selector: 'app-avatar',
  template: `
    @if (photoUrl() && !failed()) {
      <img [src]="photoUrl()" alt="" (error)="failed.set(true)">
    } @else {
      <span class="letter">{{ initial() }}</span>
    }
  `,
  styles: [`
    :host {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      border-radius: 50%;
      background: rgba(var(--ion-color-primary-rgb), 0.16);
      color: var(--ion-color-primary);
    }

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      /* A photo that has not arrived yet is a hole in the layout; the host's
         own colour fills it until it does. */
      background: transparent;
    }

    .letter {
      font-weight: 700;
      text-transform: uppercase;
      line-height: 1;
    }
  `],
})
export class AvatarComponent {
  readonly photoUrl = input<string | null>(null);
  readonly name = input('');
  readonly email = input('');

  /** True once the image has failed; the initial takes over for good. */
  readonly failed = signal(false);

  readonly initial = computed(() =>
    (this.name().trim() || this.email().trim() || '?').charAt(0));
}
