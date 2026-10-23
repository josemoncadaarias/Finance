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
import { canReadImages, statementAccept, statementFiles } from '../../core/statements/image-text';
import { ReceiptService } from '../../core/receipts/receipt.service';
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
import type { Frequent } from '../../core/compose/frequent';
import { HabitsService } from '../../core/compose/habits.service';
import { HabitRowComponent } from './habit-row.component';
import { merchantKeyOf } from '../../core/proposals/merchant';

@Component({
  selector: 'app-compose-host',
  standalone: true,
  imports: [IonModal, IonIcon, TranslatePipe, EntryComponent, AccountPickerComponent, BadgeComponent, HabitRowComponent],
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
          <div class="ui-list statement">
            <!-- Fixed payments and habits live one tap away, never over the "+"'s own
                 options (Jose, 2026-10-22). -->
            @if (dueFixed().length > 0 || frequent().length > 0) {
              <button type="button" class="ui-row" (click)="quick.set(true)" data-tour="plus-quick">
                <app-badge shape="ci" [size]="38" builtin="repeat-outline" fixed="#34c98b"></app-badge>
                <span class="ui-tx"><b>{{ 'plus.quick.row' | t }}</b>@for (line of quickLines(); track line) { <small class="wrap">{{ line }}</small> }</span>
                <ion-icon class="ui-chev" name="chevron-forward-outline"></ion-icon>
              </button>
            }
            <!-- The assistant (39a): a movement said in words, or a question. -->
            <button type="button" class="ui-row" (click)="openAssistant()" data-tour="plus-assistant">
              <app-badge shape="ci" [size]="38" builtin="sparkles-outline" fixed="#6378ff"></app-badge>
              <span class="ui-tx"><b>{{ 'ai.title' | t }}</b><small class="wrap">{{ 'ai.plus.hint1' | t }}</small><small class="wrap">{{ 'ai.plus.hint2' | t }}</small></span>
              <ion-icon class="ui-chev" name="chevron-forward-outline"></ion-icon>
            </button>
            @if (images) {
              <!-- A receipt's photo (Jose, 2026-10-22): the spending form, filled in. -->
              <button type="button" class="ui-row" (click)="receiptAsk.set(true)">
                <app-badge shape="ci" [size]="38" builtin="receipt-outline" fixed="#ff9152"></app-badge>
                <span class="ui-tx"><b>{{ 'receipt.row' | t }}</b><small class="wrap">{{ 'receipt.row.hint' | t }}</small></span>
                <ion-icon class="ui-chev" name="chevron-forward-outline"></ion-icon>
              </button>
            }
            <button type="button" class="ui-row" (click)="startImport()">
              <app-badge shape="ci" [size]="38" builtin="document-text-outline" fixed="#9b7bff"></app-badge>
              <span class="ui-tx"><b>{{ 'ui.new.statement' | t }}</b>@if (images) { <small>{{ 'ui.new.statement.images' | t }}</small> }</span>
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

    <!-- "Pagos fijos y frecuentes": what the "+" offers one tap away. -->
    <ion-modal [initialBreakpoint]="1" [breakpoints]="[0, 1]" [handle]="false" class="ui-sheet" [isOpen]="quick()" (didDismiss)="quick.set(false)">
      <ng-template>
        <div class="ui-sheet-body ion-content-scroll-host plus-sheet">
          <button type="button" class="sheet-cancel" (click)="quick.set(false)">{{ 'entry.cancel' | t }}</button>
          <div class="grab"></div>
          <h2 class="center">{{ 'plus.quick.row' | t }}</h2>
          <!-- Fixed payments not seen yet this month (Jose, 2026-10-22): one tap opens
               the form filled in; nothing is ever saved by itself. -->
          @if (dueFixed().length > 0) {
            <div class="ui-h due-h">{{ 'plus.due.title' | t }}</div>
            <p class="hint due-hint">{{ 'plus.due.hint' | t }}</p>
            <div class="ui-list due">
              @for (f of dueFixed().slice(0, 5); track f.name) {
                <button type="button" class="ui-row" (click)="quick.set(false); registerFixed(f)">
                  <app-badge shape="sq" [size]="38" builtin="repeat-outline" fixed="#ff6b6b"></app-badge>
                  <span class="ui-tx"><b>{{ f.name }}</b><small>{{ dueLine(f) }}</small></span>
                  <b class="due-amount">{{ pesos(f.averageMinor) }}</b>
                </button>
              }
              @if (dueFixed().length > 5) {
                <button type="button" class="ui-row" (click)="quick.set(false); seeAllFixed()">
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
                <app-habit-row [habit]="f" [before]="closeQuick"></app-habit-row>
              }
            </div>
          }
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

    <input #file type="file" [accept]="accept" [multiple]="images" hidden (change)="picked($any($event.target))">

    <!-- Where the receipt's photo comes from: the camera, or the gallery. -->
    <ion-modal [initialBreakpoint]="1" [breakpoints]="[0, 1]" [handle]="false" class="ui-sheet" [isOpen]="receiptAsk()" (didDismiss)="receiptAsk.set(false)">
      <ng-template>
        <div class="ui-sheet-body ion-content-scroll-host">
          <button type="button" class="sheet-cancel" (click)="receiptAsk.set(false)">{{ 'entry.cancel' | t }}</button>
          <div class="grab"></div>
          <h2 class="center">{{ 'receipt.where' | t }}</h2>
          <p class="hint center">{{ 'receipt.where.hint' | t }}</p>
          <div class="ui-list">
            <button type="button" class="ui-row" (click)="pickReceipt(camera)">
              <app-badge shape="ci" [size]="38" builtin="camera-outline" fixed="#ff9152"></app-badge>
              <span class="ui-tx"><b>{{ 'receipt.camera' | t }}</b></span>
            </button>
            <button type="button" class="ui-row" (click)="pickReceipt(gallery)">
              <app-badge shape="ci" [size]="38" builtin="images-outline" fixed="#9b7bff"></app-badge>
              <span class="ui-tx"><b>{{ 'receipt.gallery' | t }}</b></span>
            </button>
          </div>
        </div>
      </ng-template>
    </ion-modal>
    <input #camera type="file" accept="image/*" capture="environment" hidden (change)="receiptPicked($any($event.target))">
    <input #gallery type="file" accept="image/*" hidden (change)="receiptPicked($any($event.target))">
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
          const [r, accounts] = await Promise.all([this.assistant.recurring(), new AccountsRepository(db).list()]);
          this.accountNames = new Map(accounts.map(a => [a.id, a.name]));
          this.accountCurrency = new Map(accounts.map(a => [a.id, a.currency_code]));
          this.dueFixed.set(r.fixed.filter(f => f.thisMonthMinor === 0 && f.accountId !== null)
            .sort((a, b) => (a.day ?? 99) - (b.day ?? 99)));
          // A fixed payment has its own row above (or is paid): never twice.
          const skip = new Set(r.fixed.map(f => merchantKeyOf(f.name)).filter(Boolean));
          const habits = await this.habits.read({ skip });
          this.frequent.set([...habits.pinned, ...habits.frequent]);
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

  private readonly habits = inject(HabitsService);
  /** Closes "Pagos fijos y frecuentes" before a habit opens the form. */
  readonly closeQuick = () => this.quick.set(false);

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

  readonly receiptAsk = signal(false);

  /** The sheet with "Pagos de este mes" and "Lo que más registras". */
  readonly quick = signal(false);

  /** What waits behind "Pagos fijos y frecuentes", one line each. */
  quickLines(): string[] {
    const due = this.dueFixed().length;
    const often = this.frequent().length;
    return [
      due === 0 ? '' : due === 1 ? this.i18n.t('plus.quick.due.one') : this.i18n.t('plus.quick.due', { count: due }),
      often === 0 ? '' : often === 1 ? this.i18n.t('plus.quick.frequent.one') : this.i18n.t('plus.quick.frequent', { count: often }),
    ].filter(Boolean);
  }
  private readonly receipts = inject(ReceiptService);

  pickReceipt(input: HTMLInputElement): void {
    this.receiptAsk.set(false);
    this.compose.sheet.set(false);
    input.click();
  }

  async receiptPicked(input: HTMLInputElement): Promise<void> {
    const file = input.files?.[0];
    input.value = '';
    if (file) await this.receipts.fromPhoto(file);
  }

  /** PDF, and on the phone photos or screenshots too, several at once. */
  readonly accept = statementAccept();
  readonly images = canReadImages();

  async picked(input: HTMLInputElement): Promise<void> {
    const file = statementFiles(input.files);
    input.value = '';
    if (file.length === 0) return;

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
