/**
 * "¿Qué cambia?" (4y): the three answers and what each one does, for an
 * income or a spending on an account with products. One sheet for the
 * movement form and the products screen's form (`core/yields/entry-scope.ts`
 * says what each answer writes).
 */

import { Component, computed, inject, input, output } from '@angular/core';
import { IonIcon, IonModal } from '@ionic/angular';

import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { scopeOptionKeys, type EntryScope } from '../../core/yields/entry-scope';
import type { TranslationKey } from '../../core/i18n/translations';
import { BadgeComponent } from '../ui/badge.component';

/** The row's and the sheet's icon, and its colour. */
export const SCOPE_ICON = 'git-compare-outline';
export const SCOPE_TONE = '#9b7bff';

@Component({
  selector: 'app-scope-sheet',
  standalone: true,
  imports: [IonIcon, IonModal, TranslatePipe, BadgeComponent],
  template: `
    <ion-modal [initialBreakpoint]="1" [breakpoints]="[0, 1]" [handle]="false" class="ui-sheet"
               [isOpen]="open()" (didDismiss)="closed.emit()">
      <ng-template>
        <div class="ui-sheet-body ion-content-scroll-host">
          <button type="button" class="sheet-cancel" (click)="closed.emit()">{{ 'entry.cancel' | t }}</button>
          <div class="grab"></div>
          <div class="sheet-icon"><app-badge shape="ci" [size]="48" [builtin]="icon" [fixed]="tone"></app-badge></div>
          <h2 class="center">{{ title() || ('products.entry.scope' | t) }}</h2>
          <div class="ui-list">
            @for (option of options(); track option.id) {
              <button type="button" class="ui-row plain" (click)="chosen.emit(option.id)">
                <span class="ui-tx"><b class="wrap">{{ option.name }}</b><small class="wrap">{{ option.detail }}</small></span>
                <span class="ui-tick" [class.on]="scope() === option.id">
                  @if (scope() === option.id) { <ion-icon name="checkmark"></ion-icon> }
                </span>
              </button>
            }
          </div>
        </div>
      </ng-template>
    </ion-modal>
  `,
})
export class ScopeSheetComponent {
  private readonly i18n = inject(I18nService);

  readonly open = input(false);
  readonly kind = input<'income' | 'expense'>('income');
  readonly scope = input<EntryScope>('both');
  /** At one end of a transfer between two accounts (17b): its own title and words. */
  readonly title = input<string>('');
  readonly transferSide = input<'from' | 'to' | null>(null);
  readonly chosen = output<EntryScope>();
  readonly closed = output<void>();

  readonly icon = SCOPE_ICON;
  readonly tone = SCOPE_TONE;

  readonly options = computed(() => {
    const side = this.transferSide();
    if (side === null) return scopeOptionsIn(this.i18n, this.kind());
    // The names stay those of a spending (leaving) or an income (arriving);
    // what each does is said for a transfer.
    return scopeOptionsIn(this.i18n, side === 'from' ? 'expense' : 'income').map(option => ({
      ...option, detail: this.i18n.t(`transfer.scope.${side}.${option.id}.hint` as TranslationKey),
    }));
  });
}

/** The answers in words, for the sheet and for the row that names the chosen one. */
export function scopeOptionsIn(i18n: I18nService, kind: 'income' | 'expense') {
  return scopeOptionKeys(kind).map(option => ({ id: option.id, name: i18n.t(option.name), detail: i18n.t(option.detail) }));
}
