/**
 * A habit's options, opened by a long press on it (mockup 42f): pin it on
 * top, open the form, or stop offering it. Mounted once in the shell, so it
 * opens over the "+" and over the assistant alike.
 */
import { Component, inject } from '@angular/core';
import { IonIcon, IonModal } from '@ionic/angular';

import { HabitsService } from '../../core/compose/habits.service';
import type { Frequent } from '../../core/compose/frequent';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { I18nService } from '../../core/i18n/i18n.service';
import { BadgeComponent } from './badge.component';
import { ToastService } from './toast.service';

@Component({
  selector: 'app-habit-options',
  imports: [IonModal, IonIcon, TranslatePipe, BadgeComponent],
  template: `
    <ion-modal [initialBreakpoint]="1" [breakpoints]="[0, 1]" [handle]="false" class="ui-sheet" [isOpen]="habits.options() !== null"
               (didDismiss)="habits.options.set(null)">
      <ng-template>
        @if (habits.options(); as f) {
          <div class="ui-sheet-body">
            <button type="button" class="sheet-cancel" (click)="habits.options.set(null)">{{ 'entry.cancel' | t }}</button>
            <div class="grab"></div>
            <h2 class="center">{{ habits.title(f) }}</h2>
            <p class="ui-sub center">{{ habits.noteLine(f) }}</p>
            <div class="ui-list">
              <button type="button" class="ui-row" (click)="togglePin(f)">
                <app-badge shape="ci" [size]="36" [builtin]="f.pinned ? 'star-outline' : 'star'" fixed="#f5b942"></app-badge>
                <span class="ui-tx"><b>{{ (f.pinned ? 'habit.unpin' : 'habit.pin') | t }}</b>
                  <small>{{ (f.pinned ? 'habit.unpin.sub' : 'habit.pin.sub') | t }}</small></span>
              </button>
              <button type="button" class="ui-row" (click)="openIt(f)">
                <app-badge shape="ci" [size]="36" builtin="create-outline" fixed="#6378ff"></app-badge>
                <span class="ui-tx"><b>{{ 'habit.open' | t }}</b><small>{{ 'habit.open.sub' | t }}</small></span>
              </button>
              <button type="button" class="ui-row" (click)="hideIt(f)">
                <app-badge shape="ci" [size]="36" builtin="eye-off-outline" fixed="#f2706a"></app-badge>
                <span class="ui-tx"><b>{{ 'habit.hide' | t }}</b><small>{{ 'habit.hide.sub' | t }}</small></span>
              </button>
            </div>
          </div>
        }
      </ng-template>
    </ion-modal>
  `,
  styles: [`.ui-sub.center { text-align: center; margin: -6px 8px 14px; }`],
})
export class HabitOptionsComponent {
  readonly habits = inject(HabitsService);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18nService);

  async togglePin(f: Frequent): Promise<void> {
    this.habits.options.set(null);
    if (f.pinned) await this.habits.unpin(f); else await this.habits.pin(f);
    this.toast.say(this.i18n.t(f.pinned ? 'habit.unpinned' : 'habit.pinned', { name: this.habits.title(f) }));
  }

  openIt(f: Frequent): void {
    this.habits.options.set(null);
    this.habits.open(f);
  }

  async hideIt(f: Frequent): Promise<void> {
    this.habits.options.set(null);
    await this.habits.hide(f);
    this.toast.say(this.i18n.t('habit.hidden', { name: this.habits.title(f) }), 6000, {
      action: { label: this.i18n.t('habit.hidden.undo'), run: () => void this.habits.unhide(f) },
    });
  }
}
