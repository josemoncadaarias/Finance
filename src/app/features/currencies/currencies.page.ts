/**
 * Monedas y tasas (mockups 2c, 2d, 2e): today's dollar, every currency the
 * app knows with the rate it is valued at, typing a rate for today, and
 * adding a currency. One screen, reached from Cuentas (Jose, 2026-09-28):
 * it used to be the foot of the accounts screen and the inside of "¿De
 * dónde sale?".
 *
 * Nothing here changes how rates work: the TRM is fetched as before, a typed
 * rate is dated today as before (rule 4), and history is never recalculated.
 */

import { Component, computed, effect, inject, signal } from '@angular/core';
import { Location } from '@angular/common';
import { IonContent, IonIcon, IonModal, IonSpinner } from '@ionic/angular';

import { DatabaseService } from '../../core/database/database.service';
import { RatesRepository, RATE_SCALE, type Rate } from '../../core/database/repositories/rates.repository';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { RatesService } from '../../core/rates/rates.service';
import { shortDay } from '../../core/filters/period';
import { CurrencyDialogComponent } from '../../shared/currency-dialog/currency-dialog.component';
import { JumpComponent } from '../../shared/ui/jump.component';

interface CurrencyLine {
  code: string;
  name: string;
  symbol: string;
  used: number;
  rate: Rate | null;
}

const CODE_COLORS: Record<string, string> = { COP: '#2ec4b6', USD: '#34c98b', EUR: '#f6b93b' };

@Component({
  selector: 'app-currencies',
  standalone: true,
  imports: [IonContent, IonIcon, IonModal, IonSpinner, TranslatePipe, CurrencyDialogComponent, JumpComponent],
  template: `
    <ion-content #page [scrollEvents]="true" (ionScroll)="jump.measure()">
      <header class="ui-titlebar">
        <button type="button" class="back" (click)="back()" [attr.aria-label]="'ui.back' | t">
          <ion-icon name="chevron-back"></ion-icon>
        </button>
        <h1>{{ 'ui.currencies.title' | t }}</h1>
        <button type="button" class="ui-pill line" (click)="adding.set(true)">
          <ion-icon name="add"></ion-icon>{{ 'ui.currencies.add' | t }}
        </button>
      </header>

      <div class="ui-main">
        <!-- The dollar has a public source; the app fetches it rather than
             asking somebody to look it up. -->
        <section class="ui-hero trm">
          <span class="ui-lab">{{ dollarTitle() }}</span>
          @if (rates.currentText(); as value) {
            <div class="ui-big">{{ value }}</div>
            <p class="ui-sub">{{ rates.current()!.source === 'trm' ? ('ui.currencies.official' | t) : ('ui.currencies.typedByHand' | t) }}</p>
          } @else {
            <p class="ui-sub none">{{ 'accounts.trm.none' | t }}</p>
          }
          <div class="refresh">
            <button type="button" class="ui-chip" [disabled]="rates.state() === 'checking'" (click)="refresh()">
              @if (rates.state() === 'checking') { <ion-spinner name="dots"></ion-spinner> }
              @else { <ion-icon name="refresh-outline"></ion-icon> }
              {{ 'accounts.trm.refresh' | t }}
            </button>
            @switch (rates.state()) {
              @case ('updated') { <span class="ui-g">{{ 'accounts.trm.updated' | t }}</span> }
              @case ('offline') { <span class="ui-y">{{ 'accounts.trm.offline' | t }}</span> }
              @case ('failed') { <span class="ui-y">{{ 'accounts.trm.failed' | t }}</span> }
            }
          </div>
        </section>

        <h3 class="ui-h">{{ 'ui.currencies.yours' | t }}</h3>
        <div class="ui-list">
          @for (line of lines(); track line.code) {
            <button type="button" class="ui-row" [disabled]="line.code === 'COP'" (click)="typeRate(line)">
              <span class="code" [style.color]="colorOf(line.code)" [style.background]="tintOf(line.code)">{{ line.code }}</span>
              <span class="ui-tx">
                <b class="ui-one">{{ line.name }} {{ line.symbol }}</b>
                <small>{{ usedText(line.used) }}</small>
              </span>
              <span class="value">
                @if (line.code === 'COP') {
                  <b>{{ 'ui.currencies.main' | t }}</b>
                } @else if (line.rate) {
                  <b>{{ rateText(line.rate.rate_scaled) }}</b>
                  <small>{{ line.rate.source === 'trm' ? ('accounts.trm.official' | t) : line.rate.source === 'derived' ? ('ui.currencies.derived' | t) : ('ui.currencies.typed' | t) }}</small>
                } @else {
                  <b class="ui-y">{{ 'ui.currencies.noRate' | t }}</b>
                  <small>{{ 'ui.currencies.cannotValue' | t }}</small>
                }
              </span>
              @if (line.code !== 'COP') { <ion-icon class="ui-chev" name="chevron-forward-outline"></ion-icon> }
            </button>
          }
        </div>
        <p class="hint">{{ 'accounts.currencies.hint' | t }}</p>
        <p class="hint">{{ 'ui.currencies.offline' | t }}</p>
        <div class="ui-page-end"></div>
      </div>

      <app-jump #jump [content]="page"></app-jump>
    </ion-content>

    <!-- Today's rate for one currency, typed by hand (2d). -->
    <ion-modal class="confirm-sheet" [isOpen]="typing() !== null" (didDismiss)="typing.set(null)">
      <ng-template>
        @if (typing(); as line) {
          <div class="confirm-dialog">
            <span class="badge gold">{{ line.code }}</span>
            <h2>{{ 'ui.currencies.todayRate' | t:{ code: line.code } }}</h2>
            <p>{{ 'ui.currencies.todayRate.hint' | t:{ one: oneOf(line) } }}</p>
            <div class="ui-inputs">
              <label class="ui-input">
                <span>{{ line.code }} → COP</span>
                <input inputmode="decimal" [value]="draft()" (input)="draft.set($any($event.target).value ?? '')"
                       (keydown.enter)="saveRate()">
              </label>
            </div>
            <div class="buttons">
              <button type="button" class="ui-btn ghost" (click)="typing.set(null)">{{ 'entry.cancel' | t }}</button>
              <button type="button" class="ui-btn" [disabled]="!draftValid()" (click)="saveRate()">{{ 'entry.save' | t }}</button>
            </div>
          </div>
        }
      </ng-template>
    </ion-modal>

    <app-currency-dialog [open]="adding()" (saved)="added()" (cancelled)="adding.set(false)"></app-currency-dialog>
  `,
  styles: [`
    .ui-titlebar { background: transparent; border-bottom: 0; }
    .trm .ui-big { font-size: 32px; }
    .trm .none { margin: 8px 0; }
    .refresh { display: flex; align-items: center; gap: 12px; margin-top: 12px; font-size: 13.5px; flex-wrap: wrap; }
    .refresh .ui-chip { display: inline-flex; align-items: center; gap: 6px; }
    .refresh ion-icon { font-size: 17px; }
    .refresh ion-spinner { width: 18px; height: 18px; }
    .code {
      width: 42px; height: 42px; border-radius: 50%; display: grid; place-items: center; flex: none;
      font-size: 11.5px; font-weight: 700;
    }
    .value { display: flex; flex-direction: column; align-items: flex-end; flex: none; text-align: right; }
    .value b { font-weight: 600; font-size: 15px; }
    .value small { color: var(--app-mu); font-size: 12px; }
    button.ui-row:disabled { opacity: 1; cursor: default; }
    .hint { margin: 10px 4px 0; font-size: 13.5px; line-height: 1.45; color: var(--app-mu); }
  `],
})
export class CurrenciesPage {
  private readonly database = inject(DatabaseService);
  private readonly i18n = inject(I18nService);
  private readonly location = inject(Location);
  readonly rates = inject(RatesService);

  readonly lines = signal<CurrencyLine[]>([]);
  readonly adding = signal(false);
  readonly typing = signal<CurrencyLine | null>(null);
  readonly draft = signal('');

  readonly draftValid = computed(() => {
    const value = parseRate(this.draft());
    return Number.isFinite(value) && value > 0;
  });

  /** "Dólar hoy · TRM del 27 sept". */
  readonly dollarTitle = computed(() => {
    const rate = this.rates.current();
    const today = this.i18n.t('ui.currencies.dollarToday');
    if (!rate) return today;
    return `${today} · ${this.i18n.t('accounts.trm.on', { date: this.shortDate(rate.on_date) })}`;
  });

  constructor() {
    effect(() => {
      this.database.dataVersion();
      if (this.database.status() === 'ready') void this.load();
    });
  }

  private async load(): Promise<void> {
    const rows = await this.database.driver.query<{ code: string; name: string; symbol: string; used: number }>(
      `SELECT c.code, c.name, c.symbol,
              (SELECT COUNT(*) FROM accounts a WHERE a.currency_code = c.code) AS used
       FROM currencies c ORDER BY used DESC, c.code`);
    const inForce = await new RatesRepository(this.database.driver).allInForce('COP', todayIso());
    this.lines.set(rows.map(row => ({ ...row, rate: inForce.get(row.code) ?? null })));
    await this.rates.load();
  }

  async refresh(): Promise<void> {
    await this.rates.refresh({ force: true });
    await this.load();
  }

  typeRate(line: CurrencyLine): void {
    if (line.code === 'COP') return;
    this.draft.set(line.rate ? this.rateText(line.rate.rate_scaled) : '');
    this.typing.set(line);
  }

  /** Dated today, so tomorrow's figure never reinterprets today's (rule 4). */
  async saveRate(): Promise<void> {
    const line = this.typing();
    if (!line || !this.draftValid()) return;
    const value = parseRate(this.draft());
    await new RatesRepository(this.database.driver).set({
      on_date: todayIso(), base_code: line.code, quote_code: 'COP',
      rate_scaled: Math.round(value * RATE_SCALE),
    });
    this.typing.set(null);
    this.database.dataChanged();
  }

  async added(): Promise<void> {
    this.adding.set(false);
    await this.load();
  }

  back(): void {
    this.location.back();
  }

  usedText(count: number): string {
    return count === 1 ? this.i18n.t('accounts.currencies.used.one') : this.i18n.t('accounts.currencies.used', { count });
  }

  oneOf(line: CurrencyLine): string {
    return line.name.toLowerCase();
  }

  colorOf(code: string): string {
    return CODE_COLORS[code] ?? '#9b7bff';
  }

  tintOf(code: string): string {
    const n = parseInt(this.colorOf(code).slice(1), 16);
    return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, 0.16)`;
  }

  rateText(scaled: number): string {
    return new Intl.NumberFormat('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(scaled / RATE_SCALE);
  }

  private shortDate(iso: string): string {
    return shortDay(iso, this.i18n.dateLocale());
  }
}

function todayIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/** "3.912,40" and "3912.40" both read as 3912.4: with a comma, dots are thousands. */
function parseRate(text: string): number {
  const clean = text.replace(/[^0-9.,]/g, '');
  return Number(clean.includes(',') ? clean.replace(/\./g, '').replace(',', '.') : clean);
}
