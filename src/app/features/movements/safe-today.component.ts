/**
 * "Puedes gastar hoy" on Inicio (Jose, 2026-10-22, idea 1; reworked
 * 2026-10-31, mockups `51a`-`51g`): what can be spent each day to the
 * month's end, from what the person RECEIVES in a normal month - never from
 * what they hold (230 million saved is not a month's spending).
 *
 * `AssistantService.spendRoom` (pure `spendRoom`): the average of what came in
 * over the last three whole months, less the share set aside for the goals
 * (`SaveShareService`, 20 % by default, or what the dated goals ask when
 * larger), less what was spent this month and the payments still to come,
 * spread over the days left. Worked out with every account: one account
 * chosen shows the same figure, and a card, a loan or an account outside
 * net worth shows nothing (Jose, 2026-10-28). Read again on every data
 * change, a new day and a new share.
 */

import { Component, effect, inject, signal, untracked } from '@angular/core';
import { IonIcon, IonModal } from '@ionic/angular';

import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { I18nService } from '../../core/i18n/i18n.service';
import { DatabaseService } from '../../core/database/database.service';
import { AssistantService } from '../../core/assistant/assistant.service';
import { SaveShareService } from '../../core/assistant/save-share.service';
import { type SpendRoom } from '../../core/assistant/spend-room';
import { formatMoney } from '../../core/database/money';
import { isoDay } from '../../core/filters/period';
import { FilterService } from '../../core/filters/filter.service';
import { ComposeService } from '../../core/ui/compose.service';
import { Router } from '@angular/router';
import { SaveShareSheetComponent } from '../../shared/save-share/save-share-sheet.component';

@Component({
  selector: 'app-safe-today',
  standalone: true,
  host: { '[hidden]': 'room() === null' },
  imports: [TranslatePipe, IonIcon, IonModal, SaveShareSheetComponent],
  template: `
    @if (room(); as r) {
      @if (r.noIncome) {
        <!-- 51e: nothing came in, so nothing can be worked out. -->
        <div class="ui-card today wide" data-tour="safe-today">
          <span class="sun"><ion-icon name="sunny-outline"></ion-icon></span>
          <span class="what">
            <span class="lab">{{ 'today.title' | t }}</span>
            <small>{{ 'today.noIncome' | t }}</small>
            <button type="button" class="link" (click)="addIncome()">{{ 'today.noIncome.go' | t }}</button>
          </span>
        </div>
      } @else {
        <!-- 51a / 51d: one row; how it is worked out, one tap away. -->
        <button type="button" class="ui-card today" [class.bad]="r.leftMinor < 0" (click)="open.set(true)" data-tour="safe-today">
          <span class="sun"><ion-icon name="sunny-outline"></ion-icon></span>
          <span class="what">
            <span class="lab">{{ 'today.title' | t }}</span>
            <small>{{ subLine(r) }}</small>
          </span>
          <b class="big" [class.red]="r.leftMinor <= 0">{{ short(r.perDayMinor) }}</b>
          <ion-icon class="ui-chev" name="chevron-forward-outline"></ion-icon>
        </button>
      }

      <ion-modal [initialBreakpoint]="1" [breakpoints]="[0, 1]" [handle]="false" class="ui-sheet" [isOpen]="open()" (didDismiss)="open.set(false)">
        <ng-template>
          <div class="ui-sheet-body ion-content-scroll-host today-sheet">
            <button type="button" class="sheet-cancel" (click)="open.set(false)">{{ 'ui.close' | t }}</button>
            <div class="grab"></div>
            <h2 class="center">{{ 'today.how.title' | t }}</h2>
            <div class="ui-list">
              <div class="ui-row plain"><span class="ui-tx"><b>{{ 'today.income' | t }}</b><small>{{ 'today.income.sub' | t:{ months: monthsText(r.months) } }}</small></span><b>{{ money(r.incomeMinor) }}</b></div>
              @if (r.saveFrom === 'goals') {
                <div class="ui-row plain"><span class="ui-tx"><b>{{ 'today.save.goals' | t }}</b><small>{{ 'today.save.goals.sub' | t:{ ask: money(r.goalsAskMinor), pct: r.savePct, share: money(shareOf(r)) } }}</small></span><b class="ui-p">{{ minus(r.saveMinor) }}</b></div>
              } @else {
                <div class="ui-row plain"><span class="ui-tx"><b>{{ 'today.save' | t:{ pct: r.savePct } }}</b><small>{{ 'today.save.sub' | t }}</small></span><b class="ui-p">{{ minus(r.saveMinor) }}</b></div>
              }
              <div class="ui-row plain"><span class="ui-tx"><b>{{ 'today.spent' | t:{ month: monthName(r.monthEnd) } }}</b></span><b class="ui-r">{{ minus(r.spentMinor) }}</b></div>
              @if (r.paymentsMinor > 0) {
                <div class="ui-row plain"><span class="ui-tx"><b>{{ 'today.payments' | t }}</b></span><b class="ui-r">{{ minus(r.paymentsMinor) }}</b></div>
                @for (p of r.payments; track p.kind + p.name + p.dueOn) {
                  <div class="ui-row plain sub"><span class="ui-tx"><small>{{ p.dueOn ? p.name + ' · ' + day(p.dueOn) : p.name }}</small></span><small>{{ money(p.amountMinor) }}</small></div>
                }
              }
              <div class="ui-row plain total">
                <span class="ui-tx"><b>{{ (r.leftMinor < 0 ? 'today.left.over' : 'today.left') | t }}</b></span>
                <b [class.ui-g]="r.leftMinor > 0" [class.ui-r]="r.leftMinor <= 0">{{ money(r.leftMinor < 0 ? -r.leftMinor : r.leftMinor) }}</b>
              </div>
              <div class="ui-row plain total">
                <span class="ui-tx"><b>{{ (r.daysLeft === 1 ? 'today.perDay.one' : 'today.perDay') | t:{ count: r.daysLeft } }}</b></span>
                <b [class.ui-g]="r.perDayMinor > 0">{{ money(r.perDayMinor) }}</b>
              </div>
            </div>

            <p class="hint note"><ion-icon name="lock-closed-outline"></ion-icon> {{ 'today.saved' | t:{ held: short(held()) } }}</p>
            <p class="hint note">{{ 'today.cards' | t }}</p>
            @if (account()) { <p class="hint note">{{ 'today.allAccounts' | t }}</p> }
            <button type="button" class="ui-btn ghost" (click)="shareOpen.set(true)">
              <ion-icon name="save-outline"></ion-icon>{{ 'today.change' | t }}
            </button>
            <button type="button" class="ui-btn ghost" (click)="ask()">
              <ion-icon name="sparkles-outline"></ion-icon>{{ 'today.ask' | t }}
            </button>
          </div>
        </ng-template>
      </ion-modal>
      <app-save-share-sheet [open]="shareOpen()" (closed)="shareOpen.set(false)"></app-save-share-sheet>
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
    .what { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
    .lab { font-size: 14.5px; font-weight: 500; }
    .what small { white-space: normal; }
    .today.wide { align-items: flex-start; cursor: default; }
    .today.bad { background: rgba(var(--app-red-rgb), 0.12); }
    .today.bad .sun { background: rgba(var(--app-red-rgb), 0.16); color: var(--app-red); }
    .link { border: 0; background: none; padding: 6px 0 0; font: inherit; font-size: 14px; font-weight: 500; color: var(--app-pr); text-align: left; cursor: pointer; }
    .big { font-size: 15.5px; font-weight: 700; color: var(--app-grn); white-space: nowrap; }
    .big.red { color: var(--app-red); }
    .today .ui-chev { flex: none; }
    .short { color: var(--app-red); }
    small { color: var(--app-mu); font-size: 13.5px; line-height: 1.4; text-wrap: pretty; }
    .today-sheet .ui-row.plain { display: flex; justify-content: space-between; align-items: center; gap: 10px; }
    /* Every line is read whole: it wraps, its figure never does. */
    .today-sheet .ui-tx b, .today-sheet .ui-tx small { white-space: normal; overflow: visible; text-overflow: clip; text-wrap: pretty; }
    .today-sheet .ui-row > b, .today-sheet .ui-row > small { flex: none; white-space: nowrap; }
    .today-sheet .ui-row.sub { padding-top: 0; min-height: 0; padding-left: 28px; }
    .today-sheet .ui-row.total b { font-size: 16px; }
    .today-sheet .note { margin: 12px 4px; line-height: 1.45; }
    .today-sheet .note ion-icon { vertical-align: -2px; }
    .today-sheet .ui-btn { margin-top: 8px; }
  `],
})
export class SafeTodayComponent {
  private readonly database = inject(DatabaseService);
  private readonly assistant = inject(AssistantService);
  private readonly share = inject(SaveShareService);
  private readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  private readonly filter = inject(FilterService);
  private readonly compose = inject(ComposeService);

  readonly room = signal<SpendRoom | null>(null);
  /** What the counted accounts hold: said as NOT counted. */
  readonly held = signal(0);
  readonly open = signal(false);
  readonly shareOpen = signal(false);
  /** The account chosen on Inicio, by name, or null for every account. */
  readonly account = signal<string | null>(null);
  private read = '';

  constructor() {
    effect(() => {
      const version = this.database.dataVersion();
      const chosen = this.filter.accountId();
      const pct = this.share.pct();
      if (this.database.status() !== 'ready') return;
      const mark = `${version}:${isoDay(new Date())}:${chosen ?? 'all'}:${pct}`;
      if (mark === this.read) return;
      this.read = mark;
      void untracked(async () => {
        try {
          const picture = await this.assistant.picture();
          // One account chosen: nothing for a card, a loan or an account
          // outside net worth; the whole figure for any other.
          const named = chosen === null ? null : picture.accounts.find(a => a.account.id === chosen && !a.account.archived);
          if (chosen !== null && !named) { this.room.set(null); return; }
          this.account.set(named?.account.name ?? null);
          this.held.set(picture.free.inAccountsMinor);
          this.room.set(await this.assistant.spendRoom(picture, await this.share.load()));
        } catch {
          this.room.set(null);
        }
      });
    });
  }

  subLine(r: SpendRoom): string {
    if (r.leftMinor < 0) return this.i18n.t('today.over', { over: this.short(-r.leftMinor) });
    if (r.daysLeft === 1) return this.i18n.t('today.sub.one');
    return this.i18n.t(this.account() ? 'today.sub.all' : 'today.sub', { end: this.day(r.monthEnd) });
  }

  shareOf(r: SpendRoom): number {
    return Math.round(r.incomeMinor * r.savePct / 100);
  }

  /** "julio, agosto y septiembre". */
  monthsText(months: readonly string[]): string {
    const names = months.map(m => this.monthName(`${m}-01`));
    return new Intl.ListFormat(this.i18n.dateLocale(), { style: 'long', type: 'conjunction' }).format(names);
  }

  monthName(iso: string): string {
    const [y, m] = iso.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString(this.i18n.dateLocale(), { month: 'long' });
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

  addIncome(): void {
    this.compose.open('income');
  }

  async ask(): Promise<void> {
    this.open.set(false);
    await this.router.navigateByUrl('/assistant');
  }
}
