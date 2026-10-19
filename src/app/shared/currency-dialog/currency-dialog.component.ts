/**
 * Adding a currency: chosen from a list ready to use, each with its flag,
 * never a code typed by hand (mockup 37c; Jose, 2026-10-19: any code or
 * symbol could be typed, and a currency whose value nobody can fetch was as
 * easy to make as the dollar). The list is `core/currencies/catalog.ts`; the
 * ones the app cannot value by itself say that their value is typed.
 *
 * One component for the two screens that offer it (Monedas y TRM and the
 * account form). It saves the currency itself and says which one it saved.
 */

import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { IonModal, IonIcon } from '@ionic/angular';

import { DatabaseService } from '../../core/database/database.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { searchCatalog, type CatalogCurrency } from '../../core/currencies/catalog';

@Component({
  selector: 'app-currency-dialog',
  imports: [TranslatePipe, IonModal, IonIcon],
  template: `
    <!-- Always in the page and opened by the flag: an ion-modal created
         already open never shows (see confirm-dialogs.test.mjs). -->
    <ion-modal [initialBreakpoint]="1" [breakpoints]="[0, 1]" [handle]="false" class="ui-sheet"
               [isOpen]="open()" (didDismiss)="cancelled.emit()">
      <ng-template>
        <div class="ui-sheet-body ion-content-scroll-host">
          <div class="grab"></div>
          <div class="sheet-head">
            <button type="button" class="link left" (click)="cancelled.emit()">{{ 'entry.cancel' | t }}</button>
            <h2>{{ 'accounts.currency.add' | t }}</h2>
            <span class="right"></span>
          </div>

          <div class="ui-search">
            <ion-icon name="search-outline"></ion-icon>
            <input type="search" [placeholder]="'ui.currencies.search' | t" [value]="search()"
                   (input)="search.set($any($event.target).value ?? '')">
          </div>

          @if (error()) { <p class="error">{{ error() }}</p> }

          <div class="ui-list">
            @for (one of found(); track one.code) {
              <button type="button" class="ui-row" [disabled]="saving() || kept().has(one.code)" (click)="add(one)">
                <span class="flag">{{ one.flag }}</span>
                <span class="ui-tx">
                  <b>{{ one.code }} · {{ nameOf(one) }}</b>
                  @if (!one.auto) { <small>{{ 'ui.currencies.typedOnly' | t }}</small> }
                </span>
                @if (kept().has(one.code)) { <span class="ui-tag have">{{ 'ui.currencies.have' | t }}</span> }
              </button>
            }
            @if (found().length === 0) {
              <p class="nothing">{{ 'ui.picker.nothing' | t:{ search: search() } }}</p>
            }
          </div>
        </div>
      </ng-template>
    </ion-modal>
  `,
  styles: [`
    .ui-search { margin: 4px 0 10px; }
    .flag {
      width: 40px; height: 40px; border-radius: 50%; display: grid; place-items: center; flex: none;
      background: var(--app-s2); font-size: 23px; line-height: 1;
    }
    .ui-row:disabled { opacity: 1; cursor: default; }
    .ui-tx small { color: var(--app-mu); font-size: 12.5px; white-space: normal; }
    .have { background: rgba(52, 201, 139, 0.18); color: var(--app-grn); flex: none; }
    .nothing, .error { margin: 12px 4px; font-size: 14px; color: var(--app-mu); }
    .error { color: var(--app-red); }
  `],
})
export class CurrencyDialogComponent {
  private readonly database = inject(DatabaseService);
  private readonly i18n = inject(I18nService);

  readonly open = input(false);
  /** The code of the currency just added. */
  readonly saved = output<string>();
  readonly cancelled = output<void>();

  readonly search = signal('');
  readonly error = signal('');
  readonly saving = signal(false);
  /** The codes already kept, marked "Ya la tienes". */
  readonly kept = signal<ReadonlySet<string>>(new Set());

  readonly found = computed(() => searchCatalog(this.search()));

  constructor() {
    // Every opening starts with the whole list and reads what is kept now.
    effect(() => {
      if (!this.open()) return;
      this.search.set('');
      this.error.set('');
      void this.readKept();
    });
  }

  nameOf(one: CatalogCurrency): string {
    return one[this.i18n.language()];
  }

  private async readKept(): Promise<void> {
    if (this.database.status() !== 'ready') return;
    const rows = await this.database.driver.query<{ code: string }>('SELECT code FROM currencies');
    this.kept.set(new Set(rows.map(row => row.code)));
  }

  /**
   * Adds it, with two minor units: the money helpers assume cents for every
   * currency, so a yen is kept with two decimals too, as it always was here.
   * A code already kept is never written over (it is marked and disabled).
   */
  async add(one: CatalogCurrency): Promise<void> {
    if (this.kept().has(one.code)) return;
    this.saving.set(true);
    try {
      await this.database.driver.run(
        'INSERT OR IGNORE INTO currencies (code, name, symbol, minor_units) VALUES (?, ?, ?, 2)',
        [one.code, this.nameOf(one), one.symbol],
      );
      this.saved.emit(one.code);
    } catch (problem) {
      this.error.set(problem instanceof Error ? problem.message : String(problem));
    } finally {
      this.saving.set(false);
    }
  }
}
