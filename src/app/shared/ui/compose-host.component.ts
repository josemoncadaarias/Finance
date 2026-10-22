/**
 * What the "+" opens, on every screen: the sheet with Gasto, Ingreso,
 * Transferir and "Importar extracto PDF" (mockup `1e`), the one movement
 * form, and importing a statement - "¿De qué cuenta es?" (`6t`), the reading
 * (StatementFlow), and the review screen with a short notice (`6w`).
 *
 * Lives in the shell, once, and answers to ComposeService.
 */

import { Component, ElementRef, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { IonModal, IonIcon } from '@ionic/angular';

import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { I18nService } from '../../core/i18n/i18n.service';
import { ComposeService } from '../../core/ui/compose.service';
import { DatabaseService } from '../../core/database/database.service';
import { AccountsRepository } from '../../core/database/repositories/accounts.repository';
import { StatementsService } from '../../core/statements/statements.service';
import { StatementFlowService } from '../../core/statements/statement-flow.service';
import { warmUpPdfReader } from '../../core/statements/pdf-text';
import type { AccountRow } from '../../core/database/types';
import { EntryComponent } from '../../features/entry/entry.component';
import { AccountPickerComponent } from '../account-picker/account-picker.component';
import { BadgeComponent } from './badge.component';
import { ToastService } from './toast.service';
import { AccentService } from '../../core/theme/accent.service';
import { MOVE_COLOR } from '../../core/theme/palette';
import { AssistantService } from '../../core/assistant/assistant.service';
import type { FixedPayment } from '../../core/assistant/recurring';
import { isoDay } from '../../core/filters/period';
import { formatMoney } from '../../core/database/money';
import { CategoriesRepository } from '../../core/database/repositories/categories.repository';
import type { CategoryRow } from '../../core/database/types';
import { frequentOf, type Frequent } from '../../core/compose/frequent';
import { pastMovements } from '../../core/compose/frequent-data';
import { merchantKeyOf } from '../../core/proposals/merchant';

@Component({
  selector: 'app-compose-host',
  standalone: true,
  imports: [IonModal, IonIcon, TranslatePipe, EntryComponent, AccountPickerComponent, BadgeComponent],
  template: `
    <ion-modal [initialBreakpoint]="1" [breakpoints]="[0, 1]" [handle]="false" class="ui-sheet" [isOpen]="compose.sheet()" (didDismiss)="compose.sheet.set(false)">
      <ng-template>
        <div class="ui-sheet-body ion-content-scroll-host plus-sheet">
          <button type="button" class="sheet-cancel" (click)="compose.sheet.set(false)">{{ 'entry.cancel' | t }}</button>
          <div class="grab"></div>
          <div class="kinds">
            <button type="button" (click)="compose.open('expense')">
              <app-badge shape="ci" [size]="50" builtin="arrow-up" fixed="#ff6b6b"></app-badge>
              <b>{{ 'ui.new.expense' | t }}</b>
            </button>
            <button type="button" (click)="compose.open('income')">
              <app-badge shape="ci" [size]="50" builtin="arrow-down" fixed="#34c98b"></app-badge>
              <b>{{ 'ui.new.income' | t }}</b>
            </button>
            <button type="button" (click)="compose.open('transfer')">
              <app-badge shape="ci" [size]="50" builtin="swap-horizontal" [fixed]="MOVE"></app-badge>
              <b>{{ 'ui.new.transfer' | t }}</b>
            </button>
          </div>
          <!-- Fixed payments not seen yet this month (Jose, 2026-10-22): one tap opens
               the form filled in; nothing is ever saved by itself. -->
          @if (dueFixed().length > 0) {
            <div class="ui-h due-h">{{ 'plus.due.title' | t }}</div>
            <p class="hint due-hint">{{ 'plus.due.hint' | t }}</p>
            <div class="ui-list due">
              @for (f of dueFixed().slice(0, 5); track f.name) {
                <button type="button" class="ui-row" (click)="registerFixed(f)">
                  <app-badge shape="sq" [size]="38" builtin="repeat-outline" fixed="#ff6b6b"></app-badge>
                  <span class="ui-tx"><b>{{ f.name }}</b><small>{{ dueLine(f) }}</small></span>
                  <b class="due-amount">{{ pesos(f.averageMinor) }}</b>
                </button>
              }
              @if (dueFixed().length > 5) {
                <button type="button" class="ui-row" (click)="seeAllFixed()">
                  <span class="ui-tx"><b class="more">{{ 'plus.due.more' | t:{ count: dueFixed().length - 5 } }}</b></span>
                  <ion-icon class="ui-chev" name="chevron-forward-outline"></ion-icon>
                </button>
              }
            </div>
          }
          <!-- What the person registers most (idea F, Jose, 2026-10-22): one tap opens
               the form filled in, and nothing is saved by itself. -->
          @if (frequent().length > 0) {
            <div class="ui-h due-h">{{ 'plus.frequent.title' | t }}</div>
            <p class="hint due-hint">{{ 'plus.frequent.hint' | t }}</p>
            <div class="ui-list due">
              @for (f of frequent(); track f.key) {
                <button type="button" class="ui-row" (click)="registerFrequent(f)">
                  @if (f.kind === 'transfer') {
                    <app-badge shape="ci" [size]="38" builtin="swap-horizontal" [fixed]="MOVE"></app-badge>
                  } @else {
                    <app-badge shape="sq" [size]="38" [builtin]="categoryOf(f)?.builtin_icon" [customId]="categoryOf(f)?.custom_icon_id"
                               [tone]="categoryOf(f)?.color" [seed]="f.categoryId"></app-badge>
                  }
                  <span class="ui-tx"><b>{{ frequentTitle(f) }}</b><small>{{ frequentLine(f) }}</small></span>
                  @if (f.amountMinor !== null) {
                    <b class="due-amount" [class.in]="f.kind === 'income'">{{ frequentAmount(f) }}</b>
                  }
                </button>
              }
            </div>
          }
          <div class="ui-list statement">
            <!-- The assistant (39a): a movement said in words, or a question. -->
            <button type="button" class="ui-row" (click)="openAssistant()" data-tour="plus-assistant">
              <app-badge shape="ci" [size]="38" builtin="sparkles-outline" fixed="#6378ff"></app-badge>
              <span class="ui-tx"><b>{{ 'ai.title' | t }}</b><small class="wrap">{{ 'ai.plus.hint1' | t }}</small><small class="wrap">{{ 'ai.plus.hint2' | t }}</small></span>
              <ion-icon class="ui-chev" name="chevron-forward-outline"></ion-icon>
            </button>
            <button type="button" class="ui-row" (click)="startImport()">
              <app-badge shape="ci" [size]="38" builtin="document-text-outline" fixed="#9b7bff"></app-badge>
              <span class="ui-tx"><b>{{ 'ui.new.statement' | t }}</b></span>
              <ion-icon class="ui-chev" name="chevron-forward-outline"></ion-icon>
            </button>
            <!-- A new account from the "+" too (38a; Jose, 2026-10-19). -->
            <button type="button" class="ui-row" (click)="newAccount()">
              <app-badge shape="ci" [size]="38" builtin="wallet-outline" [fixed]="MOVE"></app-badge>
              <span class="ui-tx"><b>{{ 'ui.new.account' | t }}</b><small>{{ 'ui.new.account.hint' | t }}</small></span>
              <ion-icon class="ui-chev" name="chevron-forward-outline"></ion-icon>
            </button>
          </div>
        </div>
      </ng-template>
    </ion-modal>

    <ion-modal class="entry-sheet" [isOpen]="compose.entry() !== null" (didDismiss)="compose.close()">
      <ng-template>
        @for (request of [compose.entry()]; track request) {
          @if (request) {
            <app-entry [request]="request" (saved)="compose.done()" (cancelled)="compose.close()"
                       (switchTo)="compose.entry.set($event)"></app-entry>
          }
        }
      </ng-template>
    </ion-modal>

    <app-account-picker [open]="compose.importing()" [accounts]="accounts()" [selectedId]="null"
                        [heading]="'ui.import.whose' | t" detail="kind" [offerNew]="true"
                        (chosen)="importFor($event)" (newAccount)="importForNew()"
                        (closed)="compose.importing.set(false)"></app-account-picker>

    <input #file type="file" accept="application/pdf,.pdf" hidden (change)="picked($any($event.target))">
  `,
  styles: [`
    :host { display: contents; }
  `],
})
export class ComposeHostComponent {
  /** A transfer's own blue, whatever the accent. */
  readonly MOVE = MOVE_COLOR;

  readonly compose = inject(ComposeService);
  private readonly database = inject(DatabaseService);
  private readonly statements = inject(StatementsService);
  private readonly flow = inject(StatementFlowService);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18nService);
  private readonly toast = inject(ToastService);
  private readonly assistant = inject(AssistantService);

  private readonly file = viewChild.required<ElementRef<HTMLInputElement>>('file');

  readonly accounts = signal<AccountRow[]>([]);
  readonly accent = inject(AccentService);

  /** Which account the file being chosen is for; null for a new account. */
  private target: number | null = null;

  /** Fixed payments not seen this month, by the day they are usually paid. */
  readonly dueFixed = signal<FixedPayment[]>([]);
  private dueRead = '';

  constructor() {
    // Read when the sheet opens, once per data change and month: six months
    // of movements is not read on every tap of the "+".
    effect(() => {
      const open = this.compose.sheet();
      const version = this.database.dataVersion();
      if (!open || this.database.status() !== 'ready') return;
      const mark = `${version}:${isoDay(new Date()).slice(0, 7)}`;
      if (mark === this.dueRead) return;
      this.dueRead = mark;
      void untracked(async () => {
        try {
          const db = this.database.driver;
          const today = isoDay(new Date());
          const [r, accounts, categories, past] = await Promise.all([
            this.assistant.recurring(), new AccountsRepository(db).list(),
            new CategoriesRepository(db).list({ includeArchived: true }), pastMovements(db, today),
          ]);
          this.accountNames = new Map(accounts.map(a => [a.id, a.name]));
          this.accountCurrency = new Map(accounts.map(a => [a.id, a.currency_code]));
          this.categories = new Map(categories.map(c => [c.id, c]));
          this.dueFixed.set(r.fixed.filter(f => f.thisMonthMinor === 0 && f.accountId !== null)
            .sort((a, b) => (a.day ?? 99) - (b.day ?? 99)));
          // A fixed payment has its own row above (or is paid): never twice.
          const skip = new Set(r.fixed.map(f => merchantKeyOf(f.name)).filter(Boolean));
          const live = new Set(accounts.map(a => a.id));
          this.frequent.set(frequentOf(past.filter(m => live.has(m.accountId)), today, skip));
        } catch {
          this.dueFixed.set([]);
          this.frequent.set([]);
        }
      });
    });
    effect(() => {
      if (!this.compose.importing() || this.database.status() !== 'ready') return;
      void untracked(async () => {
        this.accounts.set(await new AccountsRepository(this.database.driver).list());
      });
    });
  }

  /** What the person registers most (`frequentOf`). */
  readonly frequent = signal<Frequent[]>([]);
  private categories = new Map<number, CategoryRow>();

  categoryOf(f: Frequent): CategoryRow | undefined {
    return f.categoryId !== null ? this.categories.get(f.categoryId) : undefined;
  }

  /** Its note; else its category; a transfer with no note says where it goes. */
  frequentTitle(f: Frequent): string {
    if (f.note) return f.note;
    if (f.kind === 'transfer') return this.i18n.t('plus.frequent.to', { account: this.accountNames.get(f.toAccountId ?? -1) ?? '' });
    return this.categoryOf(f)?.name ?? '';
  }

  /** "Gasto · Comida · Banco Azul", "Transferencia · Banco Azul → Tarjeta Coral", "Entre productos · Banco Azul". */
  frequentLine(f: Frequent): string {
    const account = this.accountNames.get(f.accountId) ?? '';
    if (f.kind === 'transfer') {
      return f.toAccountId === f.accountId
        ? `${this.i18n.t('plus.frequent.between')} · ${account}`
        : `${this.i18n.t('plus.frequent.transfer')} · ${account} → ${this.accountNames.get(f.toAccountId ?? -1) ?? ''}`;
    }
    const kind = this.i18n.t(f.kind === 'income' ? 'plus.frequent.income' : 'plus.frequent.expense');
    const category = f.note ? this.categoryOf(f)?.name : '';
    return [kind, category, account].filter(Boolean).join(' · ');
  }

  frequentAmount(f: Frequent): string {
    return formatMoney(f.amountMinor ?? 0, this.accountCurrency.get(f.accountId) ?? 'COP');
  }

  /** The one form, filled in as it was the last times; saved only by the person. */
  registerFrequent(f: Frequent): void {
    const start = { amountMinor: f.amountMinor ?? 0, onDate: isoDay(new Date()), note: f.note };
    if (f.kind === 'transfer') {
      this.compose.open('transfer', {
        route: { from: f.accountId, to: f.toAccountId ?? f.accountId, fromProductId: f.productId, toProductId: f.toProductId },
        start,
      });
      return;
    }
    this.compose.open(f.kind, {
      preferredAccountId: f.accountId,
      start: { ...start, categoryId: f.categoryId, productId: f.productId },
    });
  }

  private accountNames = new Map<number, string>();
  private accountCurrency = new Map<number, string>();

  pesos(minor: number): string {
    return formatMoney(minor, 'COP');
  }

  /** "Suele ser el día 5 · Bancolombia". */
  dueLine(f: FixedPayment): string {
    const account = f.accountId !== null ? this.accountNames.get(f.accountId) ?? '' : '';
    const when = f.day ? this.i18n.t('plus.due.day', { day: f.day }) : '';
    return [when, account].filter(Boolean).join(' · ');
  }

  /** The form, filled in with what this payment usually is; saved only by the person. */
  registerFixed(f: FixedPayment): void {
    this.compose.open('expense', {
      preferredAccountId: f.accountId,
      // The average is in pesos: an account in another currency gets its amount typed.
      start: { amountMinor: this.accountCurrency.get(f.accountId ?? -1) === 'COP' ? f.averageMinor : 0, onDate: isoDay(new Date()), note: f.name, categoryId: f.categoryId },
    });
  }

  async seeAllFixed(): Promise<void> {
    this.compose.sheet.set(false);
    await this.router.navigate(['/assistant'], { queryParams: { ask: this.i18n.t('ai.next.recurring') } });
  }

  async openAssistant(): Promise<void> {
    this.compose.sheet.set(false);
    await this.router.navigate(['/assistant']);
  }

  async newAccount(): Promise<void> {
    this.compose.sheet.set(false);
    await this.router.navigate(['/accounts'], { queryParams: { new: 'account' } });
  }

  startImport(): void {
    // The reader is heavy; loading it while the list is read means the
    // reading starts the moment a file is chosen.
    void warmUpPdfReader();
    this.compose.startImport();
  }

  importFor(account: AccountRow): void {
    this.target = account.id;
    this.compose.importing.set(false);
    this.file().nativeElement.click();
  }

  importForNew(): void {
    this.target = null;
    this.compose.importing.set(false);
    this.file().nativeElement.click();
  }

  async picked(input: HTMLInputElement): Promise<void> {
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    const accountId = this.target;
    if (accountId === null) {
      const read = await this.flow.run(file, (password, watch) => this.statements.read(file, password, watch));
      if (read === 'again') { this.file().nativeElement.click(); return; }
      if (read === null) return;
      this.statements.pendingNewAccount.set(read);
      await this.router.navigate(['/accounts'], { queryParams: { new: 'statement' } });
      return;
    }

    const done = await this.flow.run(file, (password, watch) =>
      this.statements.importInto(accountId, file, password, watch));
    if (done === 'again') { this.file().nativeElement.click(); return; }
    if (done === null) return;
    this.database.dataChanged();
    await this.router.navigate(['/review'], { queryParams: { batch: done.batch } });
    const read = done.proposed === 1 ? this.i18n.t('ui.count.movement') : this.i18n.t('ui.count.movements', { count: done.proposed });
    const known = done.knownAlready > 0
      ? this.i18n.t('ui.import.done.known', { count: done.knownAlready })
      : this.i18n.t('ui.import.done.none');
    this.toast.say(this.i18n.t('ui.import.done', { read, known }));
  }
}
