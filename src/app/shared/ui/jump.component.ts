/**
 * The two arrows of a long list (Jose, 2026-09-28): up only once the list has
 * left the top, down only while there is more below. Pressed against the
 * right edge, see-through, 38px, so they cover little.
 *
 *     <ion-content #page [scrollEvents]="true" (ionScroll)="jump.measure()">
 *       ...
 *       <app-jump #jump [content]="page"></app-jump>
 *     </ion-content>
 *
 * The one definition for every screen but Inicio, which keeps its own
 * because its search hides them while the keyboard is up.
 */

import { Component, DestroyRef, ElementRef, afterNextRender, inject, input, signal, Injector } from '@angular/core';
import { IonContent, IonIcon } from '@ionic/angular';

import { TranslatePipe } from '../../core/i18n/translate.pipe';

@Component({
  selector: 'app-jump',
  standalone: true,
  imports: [IonIcon, TranslatePipe],
  host: { slot: 'fixed' },
  styles: [`
    :host { position: absolute; inset: 0; pointer-events: none; }
    .ui-jump { pointer-events: auto; }
  `],
  template: `
    @if (!hidden() && (!atTop() || !atBottom())) {
      <div class="ui-jump" [class.row]="row()">
        @if (!atTop()) {
          <button type="button" (click)="toTop()" [attr.aria-label]="'ui.toTop' | t" [title]="'ui.toTop' | t">
            <ion-icon name="arrow-up-outline"></ion-icon>
          </button>
        }
        @if (!atBottom()) {
          <button type="button" (click)="toBottom()" [attr.aria-label]="'ui.toBottom' | t" [title]="'ui.toBottom' | t">
            <ion-icon name="arrow-down-outline"></ion-icon>
          </button>
        }
      </div>
    }
  `,
})
export class JumpComponent {
  private readonly injector = inject(Injector);

  readonly content = input.required<IonContent>();
  /** Side by side above the bar (the tax simulator's value column). */
  readonly row = input(false);
  readonly hidden = input(false);

  readonly atTop = signal(true);
  readonly atBottom = signal(true);

  constructor() {
    // Once drawn, and again a moment later when the data has arrived.
    // And whenever the page's content changes: the list arrives after the
    // page is drawn, and folding changes its height with no scroll at all.
    const host = inject(ElementRef<HTMLElement>).nativeElement as HTMLElement;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const observer = new MutationObserver(() => {
      if (timer !== null) return;
      timer = setTimeout(() => { timer = null; void this.measure(); }, 150);
    });
    afterNextRender(() => {
      void this.measure();
      const page = host.closest('ion-content');
      if (page) observer.observe(page, { childList: true, subtree: true });
    }, { injector: this.injector });
    inject(DestroyRef).onDestroy(() => observer.disconnect());
  }

  /** Re-reads the position; writes only what changed, since it runs per frame. */
  async measure(): Promise<void> {
    const element = await this.content().getScrollElement();
    const top = element.scrollTop <= 4;
    const bottom = element.scrollTop + element.clientHeight >= element.scrollHeight - 4;
    if (top !== this.atTop()) this.atTop.set(top);
    if (bottom !== this.atBottom()) this.atBottom.set(bottom);
  }

  async toTop(): Promise<void> {
    await this.content().scrollToTop(300);
    await this.measure();
  }

  async toBottom(): Promise<void> {
    await this.content().scrollToBottom(300);
    await this.measure();
  }
}
