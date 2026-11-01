/**
 * Draws SavedBannerService's banner (mockups `53a`-`53f`), once, in the shell,
 * over everything: the app's own wallet a little larger than the banner, its
 * cards over the top edge; what was saved and its figure; "Deshacer"; and the
 * bar that runs out in 5 seconds, still while the finger is on it.
 */

import { Component, inject, signal } from '@angular/core';
import { IonIcon } from '@ionic/angular';

import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { SAVED_BANNER_MS, SavedBannerService } from '../../core/ui/saved-banner.service';

@Component({
  selector: 'app-saved-banner',
  standalone: true,
  imports: [IonIcon, TranslatePipe],
  template: `
    @if (banner.notice(); as n) {
      @for (k of [n.key]; track k) {
        <div class="saved-banner" role="status" [class.deleted]="n.phase === 'deleted'" [class.pressed]="pressed()"
             [style.transform]="lift() ? 'translateY(' + lift() + 'px)' : null"
             (pointerdown)="down($event)" (pointermove)="move($event)" (pointerup)="up($event, n.phase)" (pointercancel)="cancel()">
          <img class="logo" src="assets/icon/saved-logo.png" alt="" draggable="false">
          @if (n.phase === 'saved') {
            <div class="line">
              <span class="kind"><ion-icon name="checkmark-circle"></ion-icon>{{ n.targets.length > 1 ? ('saved.manyKind' | t) : (kindKey(n.side) | t) }}</span>
              <b class="amount" [class.out]="n.side === 'expense'" [class.in]="n.side === 'income'" [class.move]="n.side === 'transfer'">{{ n.amount }}</b>
            </div>
            <div class="line low">
              <span class="what"><b class="title">{{ n.title }}</b><small>{{ n.sub }}</small></span>
              <button type="button" class="act" data-act (click)="banner.undo()"><ion-icon name="arrow-undo-outline"></ion-icon>{{ 'saved.undo' | t }}</button>
            </div>
          } @else {
            <div class="line low">
              <span class="what">
                <span class="kind gone"><ion-icon name="arrow-undo-outline"></ion-icon>{{ n.targets.length > 1 ? ('saved.gone.many' | t:{ count: n.targets.length }) : (goneKey(n.side) | t) }}</span>
                <b class="title">{{ n.targets.length > 1 ? n.sub : n.title }}</b>
                <small>@if (n.amount) {<span>{{ n.amount.replace('−', '').replace('+', '') }} · </span>}{{ (n.targets.length > 1 ? 'saved.goneSubMany' : 'saved.goneSub') | t }}</small>
              </span>
              <button type="button" class="act" data-act (click)="banner.recover()">{{ (n.targets.length > 1 ? 'saved.recoverMany' : 'saved.recover') | t }}</button>
            </div>
          }
          <div class="track"><div class="fill" [style.animation-duration.ms]="ms" [style.animation-play-state]="pressed() ? 'paused' : 'running'" (animationend)="banner.close(n.key)"></div></div>
          @if (pressed() && n.phase === 'saved') { <p class="held">{{ 'saved.held' | t }}</p> }
        </div>
      }
    }
  `,
  styles: [`
    .saved-banner {
      position: fixed;
      left: 12px;
      right: 12px;
      top: calc(30px + var(--ion-safe-area-top, 0px));
      /* Over every sheet and form: Ionic's overlays start at 20000, the
         statement's reading at 40000. */
      z-index: 45000;
      background: var(--app-s2);
      border: 1px solid var(--app-line);
      border-radius: 20px;
      padding: 12px 12px 17px 84px;
      box-shadow: 0 14px 34px rgba(0, 0, 0, 0.45);
      touch-action: none;
      user-select: none;
      -webkit-user-select: none;
      animation: saved-in 0.22s ease-out;
      transition: transform 0.12s ease-out;
      color: var(--app-tx);
    }
    .saved-banner.pressed { transform: scale(0.985); }
    @keyframes saved-in { from { transform: translateY(-24px); opacity: 0; } to { transform: none; opacity: 1; } }
    .logo {
      position: absolute;
      left: 8px;
      top: -20px;
      width: 68px;
      height: auto;
      pointer-events: none;
      filter: drop-shadow(0 6px 10px rgba(0, 0, 0, 0.35));
    }
    .deleted .logo { filter: drop-shadow(0 6px 10px rgba(0, 0, 0, 0.35)) grayscale(0.4); }
    .line { display: flex; align-items: center; gap: 8px; }
    .line.low { align-items: flex-end; margin-top: 2px; }
    .kind {
      flex: 1;
      min-width: 0;
      display: flex;
      align-items: center;
      gap: 5px;
      color: var(--app-grn);
      font-size: 12.5px;
      font-weight: 600;
      white-space: nowrap;
    }
    .kind ion-icon { font-size: 15px; flex: none; }
    .kind.gone { color: var(--app-mu); flex: none; }
    .amount { font-size: 16px; white-space: nowrap; }
    .amount.out { color: var(--app-red); }
    .amount.in { color: var(--app-grn); }
    .amount.move { color: var(--app-move); }
    .what { flex: 1; min-width: 0; display: flex; flex-direction: column; }
    .title { font-size: 15.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .what small { color: var(--app-mu); font-size: 12.5px; line-height: 1.35; margin-top: 1px; text-wrap: pretty; }
    .act {
      flex: none;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 7px 11px;
      border-radius: 14px;
      background: var(--app-s3, var(--app-s1));
      color: var(--app-pr);
      font-size: 13px;
      font-weight: 600;
      font-family: inherit;
      border: 0;
    }
    .act ion-icon { font-size: 15px; }
    .track {
      position: absolute;
      left: 14px;
      right: 14px;
      bottom: 7px;
      height: 4px;
      border-radius: 2px;
      background: rgba(var(--app-grn-rgb), 0.18);
      overflow: hidden;
    }
    .fill { height: 100%; border-radius: 2px; background: var(--app-grn); animation-name: saved-run; animation-timing-function: linear; animation-fill-mode: forwards; }
    .deleted .track { background: rgba(142, 154, 178, 0.2); }
    .deleted .fill { background: var(--app-mu); }
    @keyframes saved-run { from { width: 100%; } to { width: 0; } }
    .held { margin: 10px 0 -6px; text-align: center; font-size: 12px; color: var(--app-mu); }
  `],
})
export class SavedBannerComponent {
  readonly banner = inject(SavedBannerService);
  readonly ms = SAVED_BANNER_MS;
  readonly pressed = signal(false);
  readonly lift = signal(0);
  private startY: number | null = null;
  private moved = false;

  kindKey(side: string): 'saved.income' | 'saved.transfer' | 'saved.expense' {
    return side === 'income' ? 'saved.income' : side === 'transfer' ? 'saved.transfer' : 'saved.expense';
  }

  goneKey(side: string): 'saved.gone.income' | 'saved.gone.transfer' | 'saved.gone.expense' {
    return side === 'income' ? 'saved.gone.income' : side === 'transfer' ? 'saved.gone.transfer' : 'saved.gone.expense';
  }

  down(event: PointerEvent): void {
    if ((event.target as HTMLElement).closest('[data-act]')) return;
    this.startY = event.clientY;
    this.moved = false;
    this.pressed.set(true);
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
  }

  move(event: PointerEvent): void {
    if (this.startY === null) return;
    const dy = event.clientY - this.startY;
    if (Math.abs(dy) > 8) this.moved = true;
    this.lift.set(Math.min(0, dy));
  }

  up(event: PointerEvent, phase: string): void {
    if (this.startY === null) return;
    const dy = event.clientY - this.startY;
    this.startY = null;
    this.pressed.set(false);
    this.lift.set(0);
    if (dy < -30) this.banner.close();
    else if (!this.moved && phase === 'saved') void this.banner.edit();
  }

  cancel(): void {
    this.startY = null;
    this.pressed.set(false);
    this.lift.set(0);
  }
}
