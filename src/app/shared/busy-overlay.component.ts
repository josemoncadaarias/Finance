/**
 * The screen while something long is happening underneath it.
 *
 * Reading five years of history out of the database, or writing it back in,
 * takes seconds on a phone, and the screen simply sat there: nothing moved, no
 * button responded, and the only honest reading of that is that the app had
 * frozen. Jose asked for it after restoring a backup on his phone and watching
 * a minute of nothing.
 *
 * So the page behind is blurred and dimmed - it is not usable right now, and
 * saying that is kinder than letting someone tap into it - and what is
 * happening is named, with how far along it is when that can be known. A bar
 * that cannot say a percentage says so by moving on its own rather than
 * pretending to a figure it does not have.
 */

import { Component, input, output } from '@angular/core';
import { IonSpinner } from '@ionic/angular';

@Component({
  selector: 'app-busy-overlay',
  standalone: true,
  imports: [IonSpinner],
  template: `
    <div class="sheet" role="status" aria-live="polite">
      <ion-spinner name="crescent"></ion-spinner>
      <p class="label">{{ label() }}</p>
      @if (detail()) { <p class="detail">{{ detail() }}</p> }

      <div class="bar" [class.unknown]="percent() === null">
        <div class="fill" [style.width.%]="percent() ?? 100"></div>
      </div>
      @if (percent() !== null) { <p class="percent">{{ percent() }}%</p> }

      @if (warning()) { <p class="warn">{{ warning() }}</p> }

      <!-- A way out. Only where the caller has one to offer: a restore that
           is half written cannot be stopped, and a button that lies about
           that is worse than no button. -->
      @if (cancelLabel()) {
        <button type="button" class="stop" (click)="cancelled.emit()">
          {{ cancelLabel() }}
        </button>
      }
    </div>
  `,
  styles: [`
    :host {
      position: fixed;
      inset: 0;
      z-index: 20000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1.5rem;

      /* The page is still there and still readable enough to know where you
         are, but plainly out of reach. */
      background: rgba(0, 0, 0, 0.45);
      backdrop-filter: blur(6px);
      -webkit-backdrop-filter: blur(6px);
    }

    .stop {
      margin-top: 0.35rem;
      padding: 0.45rem 1.1rem;
      border: 1px solid rgba(255, 255, 255, 0.35);
      border-radius: 999px;
      background: none;
      color: inherit;
      font-size: 0.82rem;
      cursor: pointer;
    }

    .sheet {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.55rem;
      width: 100%;
      max-width: 20rem;
      padding: 1.6rem 1.35rem 1.4rem;
      border-radius: 18px;
      background: var(--ion-background-color);
      box-shadow: 0 12px 40px rgba(0, 0, 0, 0.35);
      text-align: center;
    }

    ion-spinner { width: 2rem; height: 2rem; color: var(--ion-color-primary); }

    .label { margin: 0; font-size: 1rem; font-weight: 600; }

    .detail {
      margin: 0;
      font-size: 0.8rem;
      color: var(--ion-color-medium);
      font-variant-numeric: tabular-nums;
    }

    .bar {
      width: 100%;
      height: 6px;
      margin-top: 0.35rem;
      border-radius: 999px;
      overflow: hidden;
      background: var(--ion-color-step-150, rgba(128, 128, 128, 0.25));
    }

    .fill {
      height: 100%;
      border-radius: 999px;
      background: var(--ion-color-primary);
      transition: width 0.2s ease-out;
    }

    /* Nothing to measure: the bar travels instead of standing at a number it
       would be inventing. */
    .bar.unknown .fill {
      width: 40% !important;
      animation: travel 1.1s ease-in-out infinite;
    }

    @keyframes travel {
      0% { transform: translateX(-100%); }
      100% { transform: translateX(250%); }
    }

    @media (prefers-reduced-motion: reduce) {
      .bar.unknown .fill { animation: none; }
      .fill { transition: none; }
    }

    .percent {
      margin: 0;
      font-size: 0.78rem;
      color: var(--ion-color-medium);
      font-variant-numeric: tabular-nums;
    }

    .warn {
      margin: 0.35rem 0 0;
      font-size: 0.76rem;
      line-height: 1.4;
      color: var(--ion-color-warning-shade);
    }
  `],
})
export class BusyOverlayComponent {
  /** What is happening, in the user's words. */
  readonly label = input.required<string>();

  /** The measurable part of it: "8.400 de 16.194 filas". */
  readonly detail = input<string>('');

  /** 0 to 100, or null while there is nothing to measure. */
  readonly percent = input<number | null>(null);

  /** Anything they should not do while it runs, such as closing the app. */
  readonly warning = input<string>('');

  /**
   * The words on the way out, where there is one. Empty means there is not,
   * and then nothing is drawn: this overlay covers things that can be
   * stopped safely and things that cannot.
   */
  readonly cancelLabel = input<string>('');
  readonly cancelled = output<void>();
}
