/**
 * A date chosen the app's way, never the phone's bare picker (Jose,
 * 2026-10-01: "en todas las pantallas deben tener un estilo acorde a la
 * app"). The day said in words, and a sheet from the bottom with the same
 * calendar the movement form uses.
 *
 * Two looks: 'field', a row of a `.ui-list` with its calendar icon, and
 * 'box', a `.ui-input` among other typed boxes.
 *
 *     <app-date-field [label]="'loans.form.disbursed' | t" [value]="disbursedOn()"
 *                     (changed)="disbursedOn.set($event)"></app-date-field>
 */

import { Component, computed, inject, input, output, signal } from '@angular/core';
import { IonDatetime, IonIcon, IonModal } from '@ionic/angular';

import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { fromIsoDay, isoDay } from '../../core/filters/period';

@Component({
  selector: 'app-date-field',
  templateUrl: './date-field.component.html',
  styleUrls: ['./date-field.component.scss'],
  imports: [TranslatePipe, IonModal, IonDatetime, IonIcon],
})
export class DateFieldComponent {
  readonly i18n = inject(I18nService);

  readonly label = input('');
  readonly value = input<string | null>(null);
  readonly min = input<string | null>(null);
  readonly max = input<string | null>(null);
  readonly look = input<'field' | 'box'>('field');
  /** A date that may be left empty ("Hasta" of a rate) offers to clear it. */
  readonly clearable = input(false);
  readonly placeholder = input('—');

  readonly changed = output<string | null>();

  readonly open = signal(false);

  /** "16 de septiembre de 2026". */
  readonly shown = computed(() => {
    const value = this.value();
    if (!value) return this.placeholder();
    return fromIsoDay(value).toLocaleDateString(this.i18n.dateLocale(), { day: 'numeric', month: 'long', year: 'numeric' });
  });

  readonly start = computed(() => this.value() ?? this.min() ?? isoDay(new Date()));

  pick(value: string | string[] | null | undefined): void {
    const day = (Array.isArray(value) ? value[0] : value)?.slice(0, 10) ?? null;
    this.open.set(false);
    if (day && day !== this.value()) this.changed.emit(day);
  }

  clear(): void {
    this.open.set(false);
    this.changed.emit(null);
  }
}
