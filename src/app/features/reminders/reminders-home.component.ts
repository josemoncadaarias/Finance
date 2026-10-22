/**
 * Inicio's reminders (Jose, 2026-10-22): late, or due within a week, inside
 * "Pendientes" beside the cards and loans due. A row opens the movement form
 * filled in; saving it settles the month.
 */
import { Component, inject } from '@angular/core';
import { IonIcon } from '@ionic/angular';

import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { I18nService } from '../../core/i18n/i18n.service';
import { formatMoney } from '../../core/database/money';
import { fromIsoDay, isoDay } from '../../core/filters/period';
import { RemindersService } from '../../core/reminders/reminders.service';
import type { Occurrence } from '../../core/reminders/reminders';
import { BadgeComponent } from '../../shared/ui/badge.component';

@Component({
  selector: 'app-reminders-home',
  standalone: true,
  imports: [TranslatePipe, BadgeComponent, IonIcon],
  template: `
    @if (reminders.soon().length > 0) {
      <div class="ui-list">
        @for (o of reminders.soon(); track o.reminder.id) {
          <button type="button" class="ui-row" (click)="reminders.openForm(o)">
            <app-badge shape="ci" [size]="40" builtin="notifications-outline" [fixed]="o.late ? '#ff6b6b' : '#f5b544'"></app-badge>
            <span class="ui-tx">
              <span class="kind" [class.late]="o.late">{{ (o.late ? 'home.kind.reminderLate' : 'home.kind.reminder') | t }}</span>
              <b class="ui-one">{{ o.reminder.title }}</b>
              <small class="wrap" [class.late]="o.late">{{ lineOf(o) }}</small>
            </span>
            <ion-icon class="ui-chev" name="chevron-forward-outline"></ion-icon>
          </button>
        }
      </div>
    }
  `,
  styles: [`
    :host { display: block; }
    .ui-tx { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
    small { color: var(--app-mu); font-size: 13px; }
    small.late { color: var(--app-red); }
    .kind {
      font-size: 11px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase;
      display: flex; align-items: center; gap: 5px; color: var(--app-yel);
    }
    .kind::before { content: ''; width: 7px; height: 7px; border-radius: 50%; background: currentColor; flex: none; }
    .kind.late { color: var(--app-red); }
  `],
})
export class RemindersHomeComponent {
  readonly reminders = inject(RemindersService);
  private readonly i18n = inject(I18nService);

  lineOf(o: Occurrence): string {
    const today = isoDay(new Date());
    const days = Math.round((fromIsoDay(o.dueOn).getTime() - fromIsoDay(today).getTime()) / 86_400_000);
    const date = fromIsoDay(o.dueOn).toLocaleDateString(this.i18n.dateLocale(), { day: 'numeric', month: 'short' });
    const when = days === 0 ? this.i18n.t('home.due.today') : days === 1 ? this.i18n.t('home.due.tomorrow')
      : days === -1 ? this.i18n.t('home.due.yesterday') : days < 0 ? this.i18n.t('home.due.late', { date, count: -days })
      : this.i18n.t('home.due.in', { date, count: days });
    return [o.reminder.amountMinor ? formatMoney(o.reminder.amountMinor, 'COP') : '', when].filter(Boolean).join(' · ');
  }
}
