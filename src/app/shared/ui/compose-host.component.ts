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

@Component({
  selector: 'app-compose-host',
  standalone: true,
  imports: [IonModal, IonIcon, TranslatePipe, EntryComponent, AccountPickerComponent, BadgeComponent],
  template: `
    <ion-modal class="ui-sheet" [isOpen]="compose.sheet()" (didDismiss)="compose.sheet.set(false)">
      <ng-template>
        <div class="ui-sheet-body plus-sheet">
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
              <app-badge shape="ci" [size]="50" builtin="swap-horizontal" [fixed]="accent.accent().color"></app-badge>
              <b>{{ 'ui.new.transfer' | t }}</b>
            </button>
          </div>
          <div class="ui-list statement">
            <button type="button" class="ui-row" (click)="startImport()">
              <app-badge shape="ci" [size]="38" builtin="document-text-outline" fixed="#9b7bff"></app-badge>
              <span class="ui-tx"><b>{{ 'ui.new.statement' | t }}</b></span>
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
  readonly compose = inject(ComposeService);
  private readonly database = inject(DatabaseService);
  private readonly statements = inject(StatementsService);
  private readonly flow = inject(StatementFlowService);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18nService);
  private readonly toast = inject(ToastService);

  private readonly file = viewChild.required<ElementRef<HTMLInputElement>>('file');

  readonly accounts = signal<AccountRow[]>([]);
  readonly accent = inject(AccentService);

  /** Which account the file being chosen is for; null for a new account. */
  private target: number | null = null;

  constructor() {
    effect(() => {
      if (!this.compose.importing() || this.database.status() !== 'ready') return;
      void untracked(async () => {
        this.accounts.set(await new AccountsRepository(this.database.driver).list());
      });
    });
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
    await this.router.navigateByUrl('/review');
    const read = done.proposed === 1 ? this.i18n.t('ui.count.movement') : this.i18n.t('ui.count.movements', { count: done.proposed });
    const known = done.knownAlready > 0
      ? this.i18n.t('ui.import.done.known', { count: done.knownAlready })
      : this.i18n.t('ui.import.done.none');
    this.toast.say(this.i18n.t('ui.import.done', { read, known }));
  }
}
