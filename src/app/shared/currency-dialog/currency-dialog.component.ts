/**
 * Adding a currency the app does not know yet.
 *
 * It was three fields that appeared in the middle of a list the moment
 * "Agregar una moneda" was pressed, with a Save beside the last one and no
 * way to change your mind except leaving them there - on two screens, written
 * twice. Jose, 2026-09-24: "es confuso mostrar mas campos inmediatamente sin
 * poder cancelar". So it is a dialog now, with Cancel and Save side by side,
 * and it is one component because it is one question.
 *
 * It saves the currency itself and says which one it saved, so neither screen
 * carries its own copy of the rule below.
 *
 * It draws inside the same sheet as the confirmation dialog (`confirm-sheet`
 * in global.scss), so a question looks the same wherever it is asked.
 */

import { Component, effect, inject, input, output, signal } from '@angular/core';
import { IonModal, IonButton, IonIcon, IonInput } from '@ionic/angular';

import { DatabaseService } from '../../core/database/database.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';

@Component({
  selector: 'app-currency-dialog',
  imports: [TranslatePipe, IonModal, IonButton, IonIcon, IonInput],
  template: `
    <!-- Always in the page and opened by the flag: an ion-modal created
         already open never shows (see confirm-dialogs.test.mjs). -->
    <ion-modal class="confirm-sheet" [isOpen]="open()" (didDismiss)="cancelled.emit()">
      <ng-template>
        <div class="confirm-dialog">
          <span class="badge primary"><ion-icon name="cash-outline"></ion-icon></span>
          <h2>{{ 'accounts.currency.add' | t }}</h2>
          <p>{{ 'accounts.currencies.hint' | t }}</p>

          <div class="fields">
            <ion-input fill="outline" labelPlacement="stacked" maxlength="3"
                       [label]="'accounts.currency.code' | t"
                       [placeholder]="'accounts.currency.codeHint' | t"
                       [value]="code()"
                       (ionInput)="code.set($any($event.target).value ?? '')"></ion-input>
            <ion-input fill="outline" labelPlacement="stacked"
                       [label]="'accounts.currency.name' | t"
                       [value]="name()"
                       (ionInput)="name.set($any($event.target).value ?? '')"></ion-input>
            <ion-input fill="outline" labelPlacement="stacked"
                       [label]="'accounts.currency.symbol' | t"
                       [value]="symbol()"
                       (ionInput)="symbol.set($any($event.target).value ?? '')"></ion-input>
          </div>

          @if (error()) { <p class="error">{{ error() }}</p> }

          <div class="buttons">
            <ion-button fill="outline" color="medium" (click)="cancelled.emit()">
              {{ 'entry.cancel' | t }}
            </ion-button>
            <ion-button color="primary" [disabled]="saving()" (click)="save()">
              {{ 'entry.save' | t }}
            </ion-button>
          </div>
        </div>
      </ng-template>
    </ion-modal>
  `,
})
export class CurrencyDialogComponent {
  private readonly database = inject(DatabaseService);
  private readonly i18n = inject(I18nService);

  readonly open = input(false);
  /** The code of the currency just added. */
  readonly saved = output<string>();
  readonly cancelled = output<void>();

  readonly code = signal('');
  readonly name = signal('');
  readonly symbol = signal('');
  readonly error = signal('');
  readonly saving = signal(false);

  constructor() {
    // Every opening starts empty: a half-typed currency abandoned yesterday
    // is not what somebody opening this today meant to add.
    effect(() => {
      if (!this.open()) return;
      this.code.set('');
      this.name.set('');
      this.symbol.set('');
      this.error.set('');
    });
  }

  /**
   * Adds it.
   *
   * Minor units are fixed at two: every currency this app is likely to meet
   * has cents and the money helpers assume it, so offering the choice would
   * be offering a way to store amounts a hundred times off.
   *
   * A code that already exists is refused rather than overwritten. Both
   * screens used to rename it silently - typing USD with another name here
   * changed the name of the dollar every account of Jose's is kept in -
   * which is not what a button called "Agregar" promises.
   */
  async save(): Promise<void> {
    const code = this.code().trim().toUpperCase();
    const name = this.name().trim();

    if (!/^[A-Z]{3}$/.test(code)) {
      this.error.set(this.i18n.t('accounts.currency.badCode'));
      return;
    }
    if (name === '') {
      this.error.set(this.i18n.t('accounts.currency.needName'));
      return;
    }

    this.saving.set(true);
    try {
      const known = await this.database.driver.queryOne<{ code: string }>(
        'SELECT code FROM currencies WHERE code = ?', [code]);
      if (known) {
        this.error.set(this.i18n.t('accounts.currency.exists', { code }));
        return;
      }
      await this.database.driver.run(
        'INSERT INTO currencies (code, name, symbol, minor_units) VALUES (?, ?, ?, 2)',
        [code, name, this.symbol().trim() || code],
      );
      this.saved.emit(code);
    } catch (problem) {
      this.error.set(problem instanceof Error ? problem.message : String(problem));
    } finally {
      this.saving.set(false);
    }
  }
}
