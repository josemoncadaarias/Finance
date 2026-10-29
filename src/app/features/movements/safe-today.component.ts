/**
 * "Puedes gastar hoy" on Inicio (Jose, 2026-10-22, idea 1): what is free to
 * spend each day to the month's end, and, one tap away, how it is worked out.
 *
 * The figure is the assistant's "Libre para gastar" (`freeMoney`, through
 * `AssistantService.picture`), spread over the days left with `perDay` -
 * never worked out a second way (rule 20). What the accounts counted in net
 * worth hold, less what the goals already keep, the payments still due this
 * month (cards' statements, loan installments) and what the goals would
 * want this month. Read again on every data change, on a new day and when
 * the account chosen on top changes: one account shows its own money alone
 * (`accountFree`), and a card, a loan or an account outside net worth shows
 * nothing (Jose, 2026-10-28).
 */

import { Component, effect, inject, signal, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { IonIcon, IonModal } from '@ionic/angular';

import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { I18nService } from '../../core/i18n/i18n.service';
import { DatabaseService } from '../../core/database/database.service';
import { AssistantService } from '../../core/assistant/assistant.service';
import { perDay, type FreeMoney } from '../../core/assistant/free-money';
import { formatMoney } from '../../core/database/money';
import { isoDay } from '../../core/filters/period';
import { FilterService } from '../../core/filters/filter.service';

@Component({
  selector: 'app-safe-today',
  standalone: true,
  host: { '[hidden]': 'free() === null' },
  imports: [TranslatePipe, IonIcon, IonModal],
  template: `
    @if (free(); as f) {
      <!-- One row (49a); how it is worked out, one tap away. -->
      <button type="button" class="ui-card today" (click)="open.set(true)" data-tour="safe-today">
        <span class="sun"><ion-icon name="sunny-outline"></ion-icon></span>
        <span class="lab">{{ 'today.title' | t }}</span>
        <b class="big" [class.red]="f.freeMinor <= 0">{{ short(f.freeMinor > 0 ? daily() : 0) }}</b>
        <ion-icon class="ui-chev" name="chevron-forward-outline"></ion-icon>
      </button>

      <ion-modal [initialBreakpoint]="1" [breakpoints]="[0, 1]" [handle]="false" class="ui-sheet" [isOpen]="open()" (didDismiss)="open.set(false)">
        <ng-template>
          <div class="ui-sheet-body ion-content-scroll-host today-sheet">
            <button type="button" class="sheet-cancel" (click)="open.set(false)">{{ 'ui.close' | t }}</button>
            <div class="grab"></div>
            <h2 class="center">{{ 'today.how.title' | t }}</h2>
            @if (account(); as name) {
              <p class="hint center">{{ (f.daysLeft === 1 ? 'today.how.span.one.account' : 'today.how.span.account') | t:{ end: day(f.monthEnd), count: f.daysLeft, account: name } }}</p>
            } @else {
              <p class="hint center">{{ (f.daysLeft === 1 ? 'today.how.span.one' : 'today.how.span') | t:{ end: day(f.monthEnd), count: f.daysLeft } }}</p>
            }

            @if (f.freeMinor <= 0) {
              <p class="hint center short">{{ (account() ? 'today.short.account' : 'today.short') | t:{ short: money(-f.freeMinor), account: account() ?? '' } }}</p>
            }
            <div class="ui-list">
              <div class="ui-row plain"><span class="ui-tx"><b>{{ account() ? ('today.how.inAccount' | t:{ account: account() ?? '' }) : ('ai.money.accounts' | t) }}</b></span><b>{{ money(f.inAccountsMinor) }}</b></div>
              @if (f.inGoalsMinor > 0) {
                <div class="ui-row plain"><span class="ui-tx"><b>{{ 'ai.money.inGoals' | t }}</b></span><b>{{ minus(f.inGoalsMinor) }}</b></div>
              }
              <div class="ui-row plain"><span class="ui-tx"><b>{{ 'ai.money.payments' | t }}</b></span><b>{{ minus(f.paymentsMinor) }}</b></div>
              @for (p of f.payments; track p.kind + p.id + p.dueOn) {
                <div class="ui-row plain sub"><span class="ui-tx"><small>{{ p.name }} · {{ day(p.dueOn) }}</small></span><small>{{ money(p.amountMinor) }}</small></div>
              }
              @if (!account()) {
                <div class="ui-row plain"><span class="ui-tx"><b>{{ 'ai.money.goals' | t }}</b></span><b>{{ minus(f.goalsMonthMinor) }}</b></div>
                @for (g of f.goals; track g.goal.id) {
                  @if (g.leftMinor > 0) {
                    <div class="ui-row plain sub"><span class="ui-tx"><small>{{ g.goal.name }}</small></span><small>{{ money(g.leftMinor) }}</small></div>
                  }
                }
              }
              <div class="ui-row plain total">
                <span class="ui-tx"><b>{{ 'ai.money.free' | t }}</b></span>
                <b [class.ui-g]="f.freeMinor > 0" [class.ui-r]="f.freeMinor <= 0">{{ money(f.freeMinor) }}</b>
              </div>
              <div class="ui-row plain total">
                <span class="ui-tx"><b>{{ (f.daysLeft === 1 ? 'today.perDay.one' : 'today.perDay') | t:{ count: f.daysLeft } }}</b></span>
                <b>{{ money(daily()) }}</b>
              </div>
            </div>

            <p class="hint note">{{ (account() ? 'today.how.note.account' : 'today.how.note') | t }}</p>
            <button type="button" class="ui-btn ghost" (click)="ask()">
              <ion-icon name="sparkles-outline"></ion-icon>{{ 'today.ask' | t }}
            </button>
          </div>
        </ng-template>
      </ion-modal>
    }
  `,
  styles: [`
    :host { display: block; }
    .today {
      width: 100%; border: 0; text-align: left; font: inherit; color: var(--app-tx);
      display: flex; align-items: center; gap: 10px; padding: 11px 14px; cursor: pointer;
    }
    .sun { width: 34px; height: 34px; border-radius: 50%; flex: none; display: grid; place-items: center;
      background: rgba(var(--app-yel-rgb), 0.16); color: var(--app-yel); font-size: 18px; }
    .lab { flex: 1; min-width: 0; font-size: 14.5px; font-weight: 500; white-space: nowrap; }
    .big { font-size: 15.5px; font-weight: 700; color: var(--app-grn); white-space: nowrap; }
    .big.red { color: var(--app-red); }
    .today .ui-chev { flex: none; }
    .short { color: var(--app-red); }
    small { color: var(--app-mu); font-size: 13.5px; line-height: 1.4; text-wrap: pretty; }
    .today-sheet h2 { margin: 4px 0 2px; }
    .today-sheet .ui-row.plain { display: flex; justify-content: space-between; align-items: center; gap: 10px; }
    /* Every line is read whole: it wraps, its figure never does. */
    .today-sheet .ui-tx b, .today-sheet .ui-tx small { white-space: normal; overflow: visible; text-overflow: clip; text-wrap: pretty; }
    .today-sheet .ui-row > b, .today-sheet .ui-row > small { flex: none; white-space: nowrap; }
    .today-sheet .ui-row.sub { padding-top: 0; min-height: 0; padding-left: 28px; }
    .today-sheet .ui-row.total b { font-size: 16px; }
    .today-sheet .note { margin: 12px 4px; line-height: 1.45; }
  `],
})
export class SafeTodayComponent {
  private readonly database = inject(DatabaseService);
  private readonly assistant = inject(AssistantService);
  private readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  private readonly filter = inject(FilterService);

  readonly free = signal<FreeMoney | null>(null);
  readonly daily = signal(0);
  readonly open = signal(false);
  /** The account chosen on Inicio, by name, or null for every account. */
  readonly account = signal<string | null>(null);
  private read = '';

  constructor() {
    effect(() => {
      const version = this.database.dataVersion();
      const chosen = this.filter.accountId();
      if (this.database.status() !== 'ready') return;
      const mark = `${version}:${isoDay(new Date())}:${chosen ?? 'all'}`;
      if (mark === this.read) return;
      this.read = mark;
      void untracked(async () => {
        try {
          const picture = await this.assistant.picture();
          // One account chosen: that account's own money, or nothing for a
          // card, a loan or an account outside net worth (Jose, 2026-10-28).
          const f = chosen === null ? picture.free : this.assistant.accountFree(picture, chosen);
          this.account.set(chosen === null ? null : picture.accounts.find(a => a.account.id === chosen)?.account.name ?? null);
          this.free.set(f);
          if (f === null) return;
          this.daily.set(perDay(f.freeMinor, f.daysLeft));
        } catch {
          this.free.set(null);
        }
      });
    });
  }

  /** The row's figure in whole pesos: it is rounded to hundreds anyway. */
  short(minor: number): string {
    return `$ ${formatMoney(Math.round(minor / 100), 'COP', { withSymbol: false, minorUnits: 0 })}`;
  }

  money(minor: number): string {
    return formatMoney(minor, 'COP');
  }

  minus(minor: number): string {
    return minor > 0 ? `−${this.money(minor)}` : this.money(0);
  }

  /** "31 de octubre". */
  day(iso: string): string {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(this.i18n.dateLocale(), { day: 'numeric', month: 'long' });
  }

  async ask(): Promise<void> {
    this.open.set(false);
    await this.router.navigateByUrl('/assistant');
  }
}
