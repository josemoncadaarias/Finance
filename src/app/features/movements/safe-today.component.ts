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
      <button type="button" class="ui-card today" [class.short]="f.freeMinor <= 0" (click)="open.set(true)" data-tour="safe-today">
        <span class="top">
          <span class="lab">{{ 'today.title' | t }}</span>
          <ion-icon name="information-circle-outline"></ion-icon>
        </span>
        @if (f.freeMinor > 0) {
          <b class="big">{{ money(daily()) }}</b>
          @if (account(); as name) {
            <small>{{ (f.daysLeft === 1 ? 'today.line.one.account' : 'today.line.account') | t:{ free: money(f.freeMinor), end: day(f.monthEnd), count: f.daysLeft, account: name } }}</small>
          } @else {
            <small>{{ (f.daysLeft === 1 ? 'today.line.one' : 'today.line') | t:{ free: money(f.freeMinor), end: day(f.monthEnd), count: f.daysLeft } }}</small>
          }
        } @else {
          <b class="big red">{{ money(0) }}</b>
          @if (account(); as name) {
            <small>{{ 'today.short.account' | t:{ short: money(-f.freeMinor), account: name } }}</small>
          } @else {
            <small>{{ 'today.short' | t:{ short: money(-f.freeMinor) } }}</small>
          }
        }
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
      display: flex; flex-direction: column; gap: 4px; padding: 14px 16px; cursor: pointer;
    }
    .top { display: flex; justify-content: space-between; align-items: center; }
    .lab { font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--app-mu); }
    .top ion-icon { color: var(--app-mu); font-size: 18px; }
    .big { font-size: 26px; font-weight: 700; color: var(--app-grn); }
    .big.red { color: var(--app-red); }
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
