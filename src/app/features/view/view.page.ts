/**
 * "Personaliza tu vista" (31e-31h): the screens, then one screen's blocks,
 * each with its switch and a handle to drag it up or down. Más →
 * Preferencias.
 */
import { AskButtonComponent } from '../../shared/ui/ask-button.component';
import { Component, computed, inject } from '@angular/core';
import { Location } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { NgTemplateOutlet } from '@angular/common';
import { IonContent, IonIcon } from '@ionic/angular';
import { IonReorderGroup } from '@ionic/angular/ion-reorder-group';
import { IonReorder } from '@ionic/angular/ion-reorder';

import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { VIEW_SCREENS, ViewPrefsService, type ViewBlock, type ViewScreen } from '../../core/ui/view-prefs.service';
import { BadgeComponent } from '../../shared/ui/badge.component';
import { barScreen } from '../../core/ui/bar-choice';

@Component({
  selector: 'app-view',
  imports: [AskButtonComponent, IonContent, IonIcon, IonReorderGroup, IonReorder, NgTemplateOutlet, TranslatePipe, BadgeComponent],
  template: `
    <ion-content [fullscreen]="true">
      <header class="ui-titlebar">
        <button type="button" class="back" (click)="back()" [attr.aria-label]="'ui.back' | t">
          <ion-icon name="chevron-back-outline"></ion-icon>
        </button>
        <h1>{{ (screen() ? screens[screen()!].title : 'view.title') | t }}</h1>
        <app-ask-button></app-ask-button>
      </header>

      <div class="ui-main">
        @if (screen(); as s) {
          <p class="lead">{{ 'view.screen.lead' | t }}</p>
          <div class="ui-list" data-tour="view-blocks">
            <!-- A pinned block stays first; the rest are dragged by their handle. -->
            @for (block of pinnedOf(s); track block.key) {
              <ng-container *ngTemplateOutlet="row; context: { block, movable: false }"></ng-container>
            }
            <ion-reorder-group [disabled]="false" (ionReorderEnd)="reordered(s, $event)">
              @for (block of movableOf(s); track block.key) {
                <ng-container *ngTemplateOutlet="row; context: { block, movable: true }"></ng-container>
              }
            </ion-reorder-group>
          </div>
          <p class="lead after">{{ (s === 'home' ? 'view.home.order' : 'view.order') | t }}</p>

          <ng-template #row let-block="block" let-movable="movable">
            <div class="ui-row">
              <app-badge [size]="40" [builtin]="block.icon" [fixed]="block.color"></app-badge>
              <span class="ui-tx">
                <b class="wrap">{{ block.title | t }}</b>
                @if (block.about) { <small class="wrap">{{ block.about | t }}</small> }
              </span>
              @if (block.fixed) {
                <small class="always">{{ 'view.always' | t }}</small>
              } @else {
                <button type="button" class="ui-switch" [class.on]="prefs.shown(block.key)" role="switch"
                        [attr.aria-checked]="prefs.shown(block.key)" [attr.aria-label]="block.title | t"
                        (click)="prefs.set(block.key, !prefs.shown(block.key))"></button>
              }
              @if (movable) {
                <ion-reorder class="grip" [attr.aria-label]="'view.drag' | t">
                  <ion-icon name="reorder-three-outline"></ion-icon>
                </ion-reorder>
              }
            </div>
          </ng-template>

          <div class="ui-card promise">
            <ion-icon name="shield-checkmark-outline"></ion-icon>
            <span>{{ (s === 'home' ? 'view.home.promise' : s === 'report' ? 'view.report.promise' : 'view.promise') | t }}</span>
          </div>
        } @else {
          <p class="lead">{{ 'view.lead' | t }}</p>
          <!-- The bottom bar first: it is on every screen (33a). -->
          <div class="ui-list bar-row" data-tour="view-bar">
            <button type="button" class="ui-row" (click)="openBar()">
              <app-badge [size]="40" builtin="apps-outline" fixed="#4cb8f5"></app-badge>
              <span class="ui-tx">
                <b class="wrap">{{ 'bar.title' | t }}</b>
                <small class="wrap">{{ barLine() }}</small>
              </span>
              <ion-icon class="ui-chev" name="chevron-forward-outline"></ion-icon>
            </button>
          </div>
          <div class="ui-list" data-tour="view-screens">
            @for (s of order; track s) {
              <button type="button" class="ui-row" (click)="open(s)">
                <app-badge [size]="40" [builtin]="screens[s].icon" [fixed]="screens[s].color"></app-badge>
                <span class="ui-tx">
                  <b class="wrap">{{ screens[s].title | t }}</b>
                  <small>{{ countLine(s) }}</small>
                </span>
                <ion-icon class="ui-chev" name="chevron-forward-outline"></ion-icon>
              </button>
            }
          </div>
          @if (prefs.changed()) {
            <button type="button" class="reset" (click)="prefs.reset()">
              <ion-icon name="refresh-outline"></ion-icon>{{ 'view.reset' | t }}
            </button>
          }
        }
        <div class="ui-page-end"></div>
      </div>
    </ion-content>
  `,
  styles: [`
    .lead { margin: 4px 4px 12px; color: var(--app-mu); font-size: 14px; line-height: 1.4; }
    .always { color: var(--app-mu); font-size: 12.5px; flex: none; }
    .lead.after { margin: 10px 4px 0; font-size: 13px; }
    .bar-row { margin-bottom: 12px; }
    ion-reorder-group { display: block; }
    .grip { flex: none; display: grid; place-items: center; width: 34px; height: 40px; margin-right: -6px; color: var(--app-mu); }
    .grip ion-icon { font-size: 24px; }
    /* The row being dragged lifts above the others. */
    ion-reorder-group .ui-row.reorder-selected { background: var(--app-s2); box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35); border-radius: 14px; }
    .promise { display: flex; gap: 10px; align-items: flex-start; margin-top: 14px; padding: 12px 14px;
      color: var(--app-mu); font-size: 13.5px; line-height: 1.4;
      ion-icon { font-size: 20px; color: var(--app-yel); flex: none; } }
    .reset { display: flex; align-items: center; justify-content: center; gap: 6px; width: 100%; margin-top: 16px;
      padding: 10px; border: 0; background: none; color: var(--app-pr); font: inherit; font-size: 15px; font-weight: 600; cursor: pointer;
      ion-icon { font-size: 18px; } }
  `],
})
export class ViewPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly i18n = inject(I18nService);
  readonly prefs = inject(ViewPrefsService);

  readonly screens = VIEW_SCREENS;
  readonly order: ViewScreen[] = ['home', 'debts', 'report'];
  private readonly param = toSignal(this.route.paramMap.pipe(map(p => p.get('screen'))), { initialValue: null });
  readonly screen = computed<ViewScreen | null>(() => {
    const s = this.param();
    return s === 'home' || s === 'debts' || s === 'report' ? s : null;
  });

  pinnedOf(s: ViewScreen): ViewBlock[] {
    this.prefs.hidden();
    return this.prefs.orderOf(s).filter(b => b.pinned);
  }

  movableOf(s: ViewScreen): ViewBlock[] {
    this.prefs.hidden();
    return this.prefs.orderOf(s).filter(b => !b.pinned);
  }

  /** A block dropped somewhere else: the list goes back and is redrawn in the new order. */
  reordered(s: ViewScreen, event: Event): void {
    const detail = (event as CustomEvent<{ from: number; to: number; complete: (r?: boolean) => void }>).detail;
    detail.complete(false);
    this.prefs.move(s, detail.from, detail.to);
  }

  /** "3 de 4 bloques". */
  countLine(s: ViewScreen): string {
    return this.i18n.t('view.count', { shown: this.prefs.shownCount(s), of: VIEW_SCREENS[s].blocks.length });
  }

  /** "Inicio · Cuentas · Reporte": the bar's buttons, in order. */
  readonly barLine = computed(() => this.prefs.bar().map(id => this.i18n.t(barScreen(id).label)).join(' · '));

  openBar(): void {
    void this.router.navigate(['/view', 'bar']);
  }

  open(s: ViewScreen): void {
    void this.router.navigate(['/view', s]);
  }

  back(): void {
    this.location.back();
  }
}
