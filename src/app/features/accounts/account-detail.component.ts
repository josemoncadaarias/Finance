/**
 * One account, shown beside the list of accounts when the phone is held
 * sideways (mockup `58e`, Jose 2026-11-18): its balance, what came in and
 * left this month, its balance at the close of each of the last six months,
 * its latest movements, and the ways on - its movements on Inicio, editing it.
 *
 * It only reads: one query for the account's movements of the last months,
 * worked out by `balance-months.ts`, read again when the data changes.
 */

import { Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { IonIcon } from '@ionic/angular';

import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { I18nService } from '../../core/i18n/i18n.service';
import { DatabaseService } from '../../core/database/database.service';
import { TransactionsRepository, type DetailedTransaction } from '../../core/database/repositories/transactions.repository';
import type { AccountBalance } from '../../core/database/types';
import { monthBefore, monthlyCloses, thisMonthFlows, type MonthClose } from '../../core/accounts/balance-months';
import { todayIso } from '../../core/yields/days';
import { BadgeComponent } from '../../shared/ui/badge.component';
import { MoneyPipe } from '../../shared/money.pipe';
import { MOVE_COLOR } from '../../core/theme/palette';

/** Months of history drawn: half a year, then today. */
const MONTHS = 6;
/** Latest movements listed. */
const LATEST = 5;

interface Point { x: number; y: number; label: string; closeMinor: number }

@Component({
  selector: 'app-account-detail',
  standalone: true,
  imports: [IonIcon, TranslatePipe, BadgeComponent, MoneyPipe],
  template: `
    @let b = balance();
    @let account = b.account;
    <section class="ui-card detail">
      <div class="head">
        <app-badge shape="ci" [size]="44" [builtin]="account.builtin_icon" [customId]="account.custom_icon_id"
                   [tone]="account.color" [seed]="account.id" fallback="wallet"></app-badge>
        <span class="ui-tx"><b class="ui-one">{{ account.name }}</b><small class="ui-one">{{ line() }}</small></span>
        <button type="button" class="ui-round" (click)="closed.emit()" [attr.aria-label]="'accounts.detail.close' | t" [title]="'accounts.detail.close' | t">
          <ion-icon name="close"></ion-icon>
        </button>
      </div>

      <span class="ui-lab">{{ 'accounts.detail.balance' | t }}</span>
      <div class="big" [class.ui-y]="b.balance_minor < 0">{{ b.balance_minor | money:account.currency_code }}
        <small>{{ account.currency_code }}</small></div>
      <div class="flows">
        <span><ion-icon name="arrow-down" class="ui-g"></ion-icon>{{ 'accounts.detail.in' | t:{ month: monthName() } }}
          <b class="ui-g">{{ flows().inMinor | money:account.currency_code }}</b></span>
        <span><ion-icon name="arrow-up" class="ui-r"></ion-icon>{{ 'accounts.detail.out' | t:{ month: monthName() } }}
          <b class="ui-r">{{ flows().outMinor | money:account.currency_code }}</b></span>
      </div>

      @if (chart(); as c) {
        <span class="ui-lab trend">{{ 'accounts.detail.trend' | t }}</span>
        <svg viewBox="0 0 300 96" preserveAspectRatio="none" class="line" aria-hidden="true">
          <path class="area" [attr.d]="c.area"></path>
          <path class="stroke" [attr.d]="c.path"></path>
          @for (p of c.points; track p.label) { <circle [attr.cx]="p.x" [attr.cy]="p.y" r="2.6"></circle> }
        </svg>
        <div class="months">@for (p of c.points; track p.label) { <span>{{ p.label }}</span> }</div>
      }

      <div class="acts">
        <button type="button" class="ui-btn" (click)="toHome.emit()"><ion-icon name="list-outline"></ion-icon>{{ 'accounts.detail.toHome' | t }}</button>
        <button type="button" class="ui-btn ghost" (click)="edit.emit()"><ion-icon name="create-outline"></ion-icon>{{ 'accounts.detail.edit' | t }}</button>
      </div>
    </section>

    <h3 class="ui-h">{{ 'accounts.detail.latest' | t }}</h3>
    @if (latest().length === 0) {
      <p class="none">{{ 'accounts.detail.none' | t }}</p>
    } @else {
      <div class="ui-list">
        @for (m of latest(); track m.id) {
          <div class="ui-row">
            @if (m.transfer_id !== null) {
              <app-badge shape="ci" [size]="34" builtin="swap-horizontal" [fixed]="MOVE"></app-badge>
            } @else {
              <app-badge [size]="34" [builtin]="m.category_icon" [customId]="m.category_custom_icon_id" [tone]="m.category_color" [seed]="m.category_id ?? 0"></app-badge>
            }
            <span class="ui-tx"><b class="ui-one">{{ titleOf(m) }}</b><small class="ui-one">{{ dayOf(m.occurred_on) }}</small></span>
            <span class="ui-am" [class.ui-g]="m.amount_minor > 0 && m.transfer_id === null" [class.ui-t]="m.transfer_id !== null">{{ m.amount_minor | money:account.currency_code }}</span>
          </div>
        }
      </div>
    }
  `,
  styles: [`
    :host { display: block; }
    .detail { padding: 14px; }
    .head { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
    .head .ui-tx { flex: 1; min-width: 0; }
    .head b { font-size: 16.5px; }
    .big { font-size: 26px; font-weight: 700; margin: 2px 0 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      small { font-size: 13px; color: var(--app-mu); font-weight: 500; } }
    .flows { display: flex; flex-direction: column; gap: 3px; font-size: 13px; color: var(--app-mu);
      span { display: flex; align-items: center; gap: 6px; } b { margin-left: auto; font-weight: 600; } ion-icon { font-size: 14px; } }
    .trend { display: block; margin-top: 14px; }
    .line { width: 100%; height: 84px; margin-top: 6px; display: block; overflow: visible;
      .area { fill: rgba(var(--app-pr-rgb), 0.16); stroke: none; }
      .stroke { fill: none; stroke: var(--app-pr); stroke-width: 2.2; vector-effect: non-scaling-stroke; }
      circle { fill: var(--app-pr); } }
    .months { display: flex; justify-content: space-between; font-size: 10.5px; color: var(--app-mu); margin-top: 3px; text-transform: capitalize; }
    .acts { display: flex; flex-direction: column; gap: 8px; margin-top: 14px; }
    .acts .ui-btn { width: 100%; }
    .none { color: var(--app-mu); font-size: 13.5px; margin: 0 4px; }
  `],
})
export class AccountDetailComponent {
  private readonly database = inject(DatabaseService);
  private readonly i18n = inject(I18nService);
  readonly MOVE = MOVE_COLOR;

  readonly balance = input.required<AccountBalance>();
  readonly closed = output<void>();
  readonly toHome = output<void>();
  readonly edit = output<void>();

  private readonly moved = signal<DetailedTransaction[]>([]);
  private readonly today = todayIso();

  private readonly load = effect(() => {
    const id = this.balance().account.id;
    this.database.dataVersion();
    untracked(() => void this.read(id));
  });

  private generation = 0;
  private async read(accountId: number): Promise<void> {
    const mine = ++this.generation;
    const from = `${monthBefore(this.today, MONTHS - 1)}-01`;
    const rows = await new TransactionsRepository(this.database.driver).listDetailed({ accountIds: [accountId], from });
    if (mine === this.generation) this.moved.set(rows);
  }

  readonly flows = computed(() => thisMonthFlows(this.moved(), this.today));

  readonly latest = computed(() => this.moved()
    .filter(m => m.occurred_on <= this.today)
    .sort((a, b) => b.occurred_on.localeCompare(a.occurred_on) || b.id - a.id)
    .slice(0, LATEST));

  readonly monthName = computed(() => new Date(`${this.today}T12:00:00`).toLocaleDateString(this.i18n.dateLocale(), { month: 'long' }));

  readonly line = computed(() => {
    const account = this.balance().account;
    return `${account.currency_code} · ${this.i18n.t(`accounts.type.${account.type}`)}`;
  });

  readonly chart = computed(() => {
    const closes: MonthClose[] = monthlyCloses(this.balance().balance_minor, this.moved(), this.today, MONTHS);
    const values = closes.map(c => c.closeMinor);
    const max = Math.max(...values), min = Math.min(...values);
    const span = max - min || 1;
    const locale = this.i18n.dateLocale();
    const points: Point[] = closes.map((c, i) => ({
      x: (i / (closes.length - 1)) * 300,
      y: 90 - ((c.closeMinor - min) / span) * 80,
      closeMinor: c.closeMinor,
      label: i === closes.length - 1
        ? this.i18n.t('accounts.detail.today')
        : new Date(`${c.month}-15T12:00:00`).toLocaleDateString(locale, { month: 'short' }).replace('.', ''),
    }));
    const path = points.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join('');
    return { points, path, area: `${path}L300,96L0,96Z` };
  });

  titleOf(m: DetailedTransaction): string {
    if (m.description) return m.description;
    if (m.transfer_id !== null && m.other_account_name) return m.other_account_name;
    return m.category_name ?? '';
  }

  dayOf(iso: string): string {
    return new Date(`${iso}T12:00:00`).toLocaleDateString(this.i18n.dateLocale(), { day: 'numeric', month: 'short' });
  }
}
