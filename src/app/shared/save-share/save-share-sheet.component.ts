/**
 * "Cuánto ahorrar cada mes" (mockup `51f`): the share of what comes in that
 * "Puedes gastar hoy" sets aside for the goals. Opened from Más →
 * Preferencias and from the sheet of "Puedes gastar hoy".
 */

import { Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonIcon, IonModal } from '@ionic/angular';

import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { I18nService } from '../../core/i18n/i18n.service';
import { SaveShareService } from '../../core/assistant/save-share.service';
import { SAVE_PCT_CHOICES } from '../../core/assistant/spend-room';
import { ToastService } from '../ui/toast.service';

@Component({
  selector: 'app-save-share-sheet',
  standalone: true,
  imports: [TranslatePipe, IonIcon, IonModal, FormsModule],
  template: `
    <ion-modal [initialBreakpoint]="1" [breakpoints]="[0, 1]" [handle]="false" class="ui-sheet" [isOpen]="open()" (didDismiss)="closed.emit()">
      <ng-template>
        <div class="ui-sheet-body ion-content-scroll-host save-sheet">
          <button type="button" class="sheet-cancel" (click)="closed.emit()">{{ 'entry.cancel' | t }}</button>
          <div class="grab"></div>
          <h2 class="center">{{ 'save.title' | t }}</h2>
          <p class="hint">{{ 'save.intro' | t }}</p>
          <div class="ui-list">
            @for (pct of choices; track pct) {
              <button type="button" class="ui-row" (click)="choose(pct)">
                <span class="ui-tx"><b>{{ 'save.pct' | t:{ pct } }}</b><small class="wrap">{{ $any('save.' + pct) | t }}</small></span>
                @if (share.pct() === pct && !typing()) { <ion-icon class="ui-p check" name="checkmark"></ion-icon> }
              </button>
            }
            <button type="button" class="ui-row" (click)="typing.set(true)">
              <span class="ui-tx"><b>{{ 'save.other' | t }}</b><small class="wrap">{{ other() ? ('save.pct' | t:{ pct: share.pct() }) : ('save.other.sub' | t) }}</small></span>
              @if (other() && !typing()) { <ion-icon class="ui-p check" name="checkmark"></ion-icon> }
            </button>
          </div>
          @if (typing()) {
            <div class="other">
              <input class="ui-input" type="number" inputmode="numeric" min="0" max="90" [(ngModel)]="typed" [attr.aria-label]="'save.other' | t">
              <span>%</span>
              <button type="button" class="ui-btn" [disabled]="!valid()" (click)="choose(typedNumber())">{{ 'save.other.save' | t }}</button>
            </div>
            <p class="hint">{{ 'save.other.sub' | t }}</p>
          }
          <p class="hint">{{ 'save.goals' | t }}</p>
        </div>
      </ng-template>
    </ion-modal>
  `,
  styles: [`
    .save-sheet .hint { margin: 10px 4px; line-height: 1.45; }
    .save-sheet .check { font-size: 22px; flex: none; }
    .other { display: flex; align-items: center; gap: 10px; margin-top: 12px; }
    .other .ui-input { width: 90px; flex: none; text-align: center; }
    .other .ui-btn { flex: 1; }
  `],
})
export class SaveShareSheetComponent {
  readonly share = inject(SaveShareService);
  private readonly i18n = inject(I18nService);
  private readonly toast = inject(ToastService);

  readonly open = input(false);
  readonly closed = output<void>();
  readonly choices = SAVE_PCT_CHOICES;
  readonly typing = signal(false);
  typed: number | null = null;
  readonly other = computed(() => !(SAVE_PCT_CHOICES as readonly number[]).includes(this.share.pct()));

  typedNumber(): number {
    return Number(this.typed);
  }

  valid(): boolean {
    const n = this.typedNumber();
    return this.typed !== null && Number.isInteger(n) && n >= 0 && n <= 90;
  }

  async choose(pct: number): Promise<void> {
    await this.share.set(pct);
    this.typing.set(false);
    this.closed.emit();
    this.toast.say(this.i18n.t('save.done', { pct }));
  }
}
