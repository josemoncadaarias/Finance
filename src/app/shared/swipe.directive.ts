/**
 * A horizontal flick that steps the period.
 *
 * Most of why a phone finance app feels quick is that changing month costs a
 * gesture rather
 * than a tap on a small arrow. Built on Ionic's gesture controller so it plays
 * with the scroll container instead of fighting it.
 *
 * Two rules keep it from stealing scrolls: the movement has to be mostly
 * horizontal, and it has to be long enough to be deliberate.
 */

import { Directive, ElementRef, inject, output, type OnDestroy, type OnInit } from '@angular/core';
import { GestureController, type Gesture } from '@ionic/angular';

/** How far a flick has to travel to count, in pixels. */
const THRESHOLD = 60;

/** How much more horizontal than vertical it has to be. */
const DIRECTION_RATIO = 1.6;

@Directive({
  selector: '[appSwipe]',
})
export class SwipeDirective implements OnInit, OnDestroy {
  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);
  private readonly gestures = inject(GestureController);
  private gesture?: Gesture;

  /** Negative for a swipe that should go back, positive forward. */
  readonly swiped = output<number>();

  ngOnInit(): void {
    this.gesture = this.gestures.create({
      el: this.host.nativeElement,
      gestureName: 'period-swipe',
      // Below the scroll gesture's priority, so a vertical drag still scrolls.
      gesturePriority: 10,
      direction: 'x',
      threshold: 10,
      onEnd: detail => {
        const { deltaX, deltaY } = detail;
        if (Math.abs(deltaX) < THRESHOLD) return;
        if (Math.abs(deltaX) < Math.abs(deltaY) * DIRECTION_RATIO) return;

        // Dragging right reveals what is behind, which is the earlier period.
        this.swiped.emit(deltaX > 0 ? -1 : 1);
      },
    }, true);

    this.gesture.enable(true);
  }

  ngOnDestroy(): void {
    this.gesture?.destroy();
  }
}
