/**
 * "Barra de abajo" (mockups `33b`-`33d`; Jose, 2026-10-15): which three
 * screens the floating bar carries, and in what order. Personaliza tu vista →
 * Barra de abajo. The bar as it will look on top; its three buttons, each
 * tapped to choose another screen and dragged by ☰; the "+" and Más said as
 * fixed; and the way back to how the app comes.
 */
import { Component, computed, inject, signal } from '@angular/core';
import { Location } from '@angular/common';
import { IonContent, IonIcon, IonModal } from '@ionic/angular';
import { IonReorderGroup } from '@ionic/angular/ion-reorder-group';
import { IonReorder } from '@ionic/angular/ion-reorder';

import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ViewPrefsService } from '../../core/ui/view-prefs.service';
import { BAR_SCREENS, DEFAULT_BAR, barScreen, type BarId } from '../../core/ui/bar-choice';
import { BadgeComponent } from '../../shared/ui/badge.component';

@Component({
  selector: 'app-bar-choice',
  imports: [IonContent, IonIcon, IonModal, IonReorderGroup, IonReorder, TranslatePipe, BadgeComponent],
  template: `
    <ion-content [fullscreen]="true">
      <header class="ui-titlebar">
        <button type="button" class="back" (click)="back()" [attr.aria-label]="'ui.back' | t">
          <ion-icon name="chevron-back-outline"></ion-icon>
        </button>
        <h1>{{ 'bar.title' | t }}</h1>
      </header>

      <div class="ui-main">
        <p class="lead">{{ 'bar.lead' | t }}</p>

        <div class="ui-h first">{{ 'bar.preview' | t }}</div>
        <div class="ui-card preview" data-tour="bar-preview">
          <div class="mini">
            @for (b of buttons(); track b.id; let i = $index) {
              @if (i === 2) { <span class="plus"><ion-icon name="add"></ion-icon></span> }
              <span class="btn" [class.on]="i === 0"><ion-icon [name]="b.icon"></ion-icon><span>{{ b.label | t }}</span></span>
            }
            <span class="btn"><ion-icon name="grid-outline"></ion-icon><span>{{ 'ui.tab.more' | t }}</span></span>
          </div>
          <small class="opens">{{ 'bar.opensOn' | t:{ name: (buttons()[0].label | t) } }}</small>
        </div>

        <div class="ui-h">{{ 'bar.yours' | t }}</div>
        <div class="ui-list" data-tour="bar-buttons">
          <ion-reorder-group [disabled]="false" (ionReorderEnd)="reordered($event)">
            @for (b of buttons(); track b.id; let i = $index) {
              <div class="ui-row">
                <button type="button" class="pick" (click)="picking.set(i)">
                  <app-badge [size]="40" [builtin]="b.icon" [fixed]="b.color"></app-badge>
                  <span class="ui-tx">
                    <b class="wrap">{{ b.label | t }}</b>
                    <small class="wrap">{{ 'bar.button' | t:{ n: i + 1 } }} · {{ b.about | t }}</small>
                  </span>
                  <ion-icon class="swap" name="swap-horizontal-outline"></ion-icon>
                </button>
                <ion-reorder class="grip" [attr.aria-label]="'view.drag' | t">
                  <ion-icon name="reorder-three-outline"></ion-icon>
                </ion-reorder>
              </div>
            }
          </ion-reorder-group>
        </div>
        <p class="lead after">{{ 'bar.howTo' | t }}</p>

        <div class="ui-h">{{ 'bar.fixed' | t }}</div>
        <div class="ui-list fixed">
          <div class="ui-row">
            <app-badge [size]="40" builtin="add" fixed="#6378ff"></app-badge>
            <span class="ui-tx"><b class="wrap">{{ 'bar.plus' | t }}</b><small class="wrap">{{ 'bar.plus.about' | t }}</small></span>
            <small class="always">{{ 'view.always' | t }}</small>
          </div>
          <div class="ui-row">
            <app-badge [size]="40" builtin="grid-outline" fixed="#8a94a6"></app-badge>
            <span class="ui-tx"><b class="wrap">{{ 'bar.more' | t }}</b><small class="wrap">{{ 'bar.more.about' | t }}</small></span>
            <small class="always">{{ 'view.always' | t }}</small>
          </div>
        </div>

        @if (!comesAsIs()) {
          <button type="button" class="reset" (click)="prefs.resetBar()">
            <ion-icon name="refresh-outline"></ion-icon>{{ 'bar.reset' | t }}
          </button>
        }
        <div class="ui-page-end"></div>
      </div>
    </ion-content>

    <!-- Which screen goes on the button tapped (33c). -->
    <ion-modal [initialBreakpoint]="1" [breakpoints]="[0, 1]" [handle]="false" class="ui-sheet" [isOpen]="picking() !== null" (didDismiss)="picking.set(null)">
      <ng-template>
        <div class="ui-sheet-body ion-content-scroll-host">
          <button type="button" class="sheet-cancel" (click)="picking.set(null)">{{ 'entry.cancel' | t }}</button>
          <div class="grab"></div>
          <h2 class="center">{{ 'bar.pick' | t:{ n: (picking() ?? 0) + 1 } }}</h2>
          <p class="sheet-sub">{{ 'bar.pick.now' | t:{ name: (current().label | t) } }}</p>
          <div class="ui-list">
            @for (s of screens; track s.id) {
              @let at = prefs.bar().indexOf(s.id);
              <button type="button" class="ui-row" (click)="choose(s.id)">
                <app-badge [size]="38" [builtin]="s.icon" [fixed]="s.color"></app-badge>
                <span class="ui-tx">
                  <b>{{ s.label | t }}</b>
                  <small class="wrap-s">{{ at >= 0 && at !== picking() ? ('bar.pick.taken' | t:{ n: at + 1 }) : (s.about | t) }}</small>
                </span>
                @if (at === picking()) { <ion-icon name="checkmark" class="check"></ion-icon> }
              </button>
            }
          </div>
        </div>
      </ng-template>
    </ion-modal>
  `,
  styles: [`
    .lead { margin: 4px 4px 12px; color: var(--app-mu); font-size: 14px; line-height: 1.4; }
    .lead.after { margin: 10px 4px 0; font-size: 13px; }
    .preview { padding: 14px 8px 10px; }
    .mini {
      display: flex; align-items: center; height: 60px; padding: 0 5px; border-radius: 30px;
      background: var(--app-nav); border: 1px solid var(--app-nav-border);
    }
    .mini .btn {
      flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: center; gap: 3px;
      color: var(--app-nav-mu); font-size: 11px; padding: 6px 0; border-radius: 24px;
      span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
      ion-icon { font-size: 21px; }
    }
    .mini .btn.on { background: rgba(var(--app-pr-rgb), 0.2); color: var(--app-pr); font-weight: 500; }
    .mini .plus {
      flex: none; width: 46px; height: 46px; margin: 0 4px; border-radius: 50%; display: grid; place-items: center;
      background: linear-gradient(135deg, var(--app-pr), var(--app-pr2)); color: #fff; font-size: 25px;
    }
    .opens { display: block; text-align: center; margin-top: 9px; color: var(--app-mu); font-size: 12.5px; }
    ion-reorder-group { display: block; }
    .pick {
      flex: 1; min-width: 0; display: flex; align-items: center; gap: 12px; padding: 0; border: 0; background: none;
      color: inherit; font: inherit; text-align: left; cursor: pointer;
    }
    .swap { flex: none; font-size: 20px; color: var(--app-pr); }
    .grip { flex: none; display: grid; place-items: center; width: 34px; height: 40px; margin-right: -6px; color: var(--app-mu); }
    .grip ion-icon { font-size: 24px; }
    ion-reorder-group .ui-row.reorder-selected { background: var(--app-s2); box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35); border-radius: 14px; }
    .fixed .ui-row { opacity: 0.8; }
    .always { color: var(--app-mu); font-size: 12.5px; flex: none; }
    .sheet-sub { text-align: center; color: var(--app-mu); font-size: 14px; margin: -4px 0 12px; }
    .check { font-size: 20px; color: var(--app-pr); flex: none; }
    .reset { display: flex; align-items: center; justify-content: center; gap: 6px; width: 100%; margin-top: 16px;
      padding: 10px; border: 0; background: none; color: var(--app-pr); font: inherit; font-size: 15px; font-weight: 600; cursor: pointer;
      ion-icon { font-size: 18px; } }
  `],
})
export class BarPage {
  private readonly location = inject(Location);
  readonly prefs = inject(ViewPrefsService);

  readonly screens = BAR_SCREENS;
  readonly buttons = computed(() => this.prefs.bar().map(barScreen));
  readonly comesAsIs = computed(() => this.prefs.bar().every((id, i) => id === DEFAULT_BAR[i]));

  /** The button whose screen is being chosen, or none. */
  readonly picking = signal<number | null>(null);
  readonly current = computed(() => this.buttons()[this.picking() ?? 0]);

  choose(id: BarId): void {
    const slot = this.picking();
    if (slot !== null) this.prefs.setBarButton(slot, id);
    this.picking.set(null);
  }

  /** A button dropped somewhere else: the list goes back and is redrawn in the new order. */
  reordered(event: Event): void {
    const detail = (event as CustomEvent<{ from: number; to: number; complete: (r?: boolean) => void }>).detail;
    detail.complete(false);
    this.prefs.moveBarButton(detail.from, detail.to);
  }

  back(): void {
    this.location.back();
  }
}
