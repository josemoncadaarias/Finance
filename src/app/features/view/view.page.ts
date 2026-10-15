/**
 * "Personaliza tu vista" (31e-31h): the screens, then one screen's blocks,
 * each with its switch. Más → Preferencias. Order is not chosen yet; the
 * blocks show in the app's own order.
 */
import { Component, computed, inject } from '@angular/core';
import { Location } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { IonContent, IonIcon } from '@ionic/angular';

import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { VIEW_SCREENS, ViewPrefsService, type ViewScreen } from '../../core/ui/view-prefs.service';
import { BadgeComponent } from '../../shared/ui/badge.component';

@Component({
  selector: 'app-view',
  imports: [IonContent, IonIcon, TranslatePipe, BadgeComponent],
  template: `
    <ion-content [fullscreen]="true">
      <header class="ui-titlebar">
        <button type="button" class="back" (click)="back()" [attr.aria-label]="'ui.back' | t">
          <ion-icon name="chevron-back-outline"></ion-icon>
        </button>
        <h1>{{ (screen() ? screens[screen()!].title : 'view.title') | t }}</h1>
      </header>

      <div class="ui-main">
        @if (screen(); as s) {
          <p class="lead">{{ 'view.screen.lead' | t }}</p>
          <div class="ui-list" data-tour="view-blocks">
            @for (block of screens[s].blocks; track block.key) {
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
              </div>
            }
          </div>

          @if (s === 'home' && prefs.shown('home.chart') && prefs.shown('home.list')) {
            <div class="ui-h">{{ 'view.home.first' | t }}</div>
            <div class="ui-seg">
              <button type="button" [class.on]="prefs.first() === 'chart'" (click)="prefs.setFirst('chart')">
                <ion-icon name="pie-chart-outline"></ion-icon>{{ 'summary.chart' | t }}
              </button>
              <button type="button" [class.on]="prefs.first() === 'list'" (click)="prefs.setFirst('list')">
                <ion-icon name="list-outline"></ion-icon>{{ 'summary.movements' | t }}
              </button>
            </div>
          }

          <div class="ui-card promise">
            <ion-icon name="shield-checkmark-outline"></ion-icon>
            <span>{{ (s === 'home' ? 'view.home.promise' : s === 'report' ? 'view.report.promise' : 'view.promise') | t }}</span>
          </div>
        } @else {
          <p class="lead">{{ 'view.lead' | t }}</p>
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
    .ui-seg button { gap: 6px; }
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

  /** "3 de 4 bloques". */
  countLine(s: ViewScreen): string {
    return this.i18n.t('view.count', { shown: this.prefs.shownCount(s), of: VIEW_SCREENS[s].blocks.length });
  }

  open(s: ViewScreen): void {
    void this.router.navigate(['/view', s]);
  }

  back(): void {
    this.location.back();
  }
}
