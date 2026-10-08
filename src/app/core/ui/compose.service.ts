/**
 * The one way in to a new movement: the "+" in the middle of the floating bar
 * (mockup `1e`), on every screen.
 *
 * It used to be a pair of pills and a round transfer at the foot of the
 * summary screen, and another copy on the products screen. The redesign has
 * one form, reached from one place, so the form's host lives in the shell
 * (`ComposeHostComponent`) and every screen asks this service to open it:
 * the "+" sheet, a row tapped to be corrected, the products screen's own
 * buttons.
 *
 * Which account a new movement starts on is the screen's to say: the summary
 * names the account on show through FilterService; a screen that is about
 * another account (an account's page in Rendimientos) says so through
 * `context` while it is open.
 */

import { Injectable, inject, signal } from '@angular/core';

import { FilterService } from '../filters/filter.service';
import type { EntryKind, EntryRequest } from '../../features/entry/entry.component';
import type { TransactionRow } from '../database/types';

@Injectable({ providedIn: 'root' })
export class ComposeService {
  private readonly filter = inject(FilterService);

  /** The movement form, open while this is not null. */
  readonly entry = signal<EntryRequest | null>(null);

  /** The "+" sheet: Gasto, Ingreso, Transferir, Importar extracto PDF. */
  readonly sheet = signal(false);

  /** "¿De qué cuenta es?" before a statement is read (mockup `6t`). */
  readonly importing = signal(false);

  /**
   * The account a screen is about when it is not the summary's: set by the
   * screen while it is open, cleared when it leaves.
   */
  readonly context = signal<number | null>(null);

  /**
   * A screen that answers the "+" itself: an account's page on the products
   * screen opens the form on that account and its products. Answers true
   * when it took the question.
   */
  handler: ((kind: EntryKind) => boolean) | null = null;

  /** Bumped when a movement has been saved, for screens that want to know. */
  readonly saved = signal(0);

  private accountInView(): number | null {
    return this.context() ?? this.filter.accountId();
  }

  open(kind: EntryKind, extra: Partial<EntryRequest> = {}): void {
    this.sheet.set(false);
    if (this.handler?.(kind)) return;
    // A transfer leaves the account on show, to wherever it usually sends
    // money (Jose, 2026-09-25).
    this.entry.set({
      kind,
      preferredAccountId: this.accountInView(),
      preferredSide: kind === 'transfer' ? 'from' : undefined,
      ...extra,
    });
  }

  /**
   * Opens a movement for correction. Either leg of a transfer opens the whole
   * transfer, both accounts and both amounts: that is the act recorded.
   */
  edit(transaction: TransactionRow): void {
    this.entry.set({
      kind: transaction.transfer_id !== null
        ? 'transfer'
        : transaction.amount_minor >= 0 ? 'income' : 'expense',
      editing: transaction,
    });
  }

  startImport(): void {
    this.sheet.set(false);
    this.importing.set(true);
  }

  close(): void {
    this.entry.set(null);
  }

  done(): void {
    this.entry.set(null);
    this.saved.update(n => n + 1);
  }

  /**
   * A proposal opened as a transfer hands its own buttons back to the review
   * screen (Jose, 2026-10-08): "No ver más", "Descartar" - each asked there -
   * or back to spending or income in the proposal's own form, with what was
   * typed. The review screen answers it and clears it.
   */
  readonly proposalAsk = signal<ProposalAsk | null>(null);
}

export interface ProposalAsk {
  id: number;
  kind: 'forget' | 'discard' | 'back';
  typed?: { amountMinor: number; onDate: string; accountId: number | null; note: string; sign: 1 | -1 };
}
