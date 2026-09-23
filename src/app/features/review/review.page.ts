/**
 * What the app has read, waiting for a person to answer it.
 *
 * The point of the whole feature and not a detail of it - Jose, 2026-09-23:
 * "eso es lo mas importante de todo esto en realidad". Nothing reaches the
 * ledger from here without somebody saying so, and everything on this screen
 * can be corrected before it does.
 *
 * A statement arrives as a batch of many, so it is answered as a batch: the
 * list is read down, anything wrong is corrected in place, and one button
 * accepts the lot. A notification arrives alone and is answered alone. Both
 * are the same rows on the same screen.
 */

import { Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonButton, IonIcon,
  IonList, IonItem, IonLabel, IonNote, IonInput, IonSelect, IonSelectOption,
  IonSpinner, IonMenuButton, IonPopover,
} from '@ionic/angular';

import { DatabaseService } from '../../core/database/database.service';
import { ProposalsRepository, type MovementProposal } from '../../core/database/repositories/proposals.repository';
import type { AccountRow, CategoryRow } from '../../core/database/types';
import { AccountsRepository } from '../../core/database/repositories/accounts.repository';
import { CategoriesRepository } from '../../core/database/repositories/categories.repository';
import { TransactionsRepository } from '../../core/database/repositories/transactions.repository';
import { TransfersRepository } from '../../core/database/repositories/transfers.repository';
import { accept, isComplete } from '../../core/proposals/accept';
import { merchantKeyOf } from '../../core/proposals/merchant';
import { StatementsService } from '../../core/statements/statements.service';
import { formatMoney, parseTypedAmountToMinor } from '../../core/database/money';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ConfirmComponent } from '../../shared/confirm/confirm.component';
import { CategorySheetComponent } from '../../shared/category-sheet/category-sheet.component';
import { IconComponent } from '../../core/icons/icon.component';

/** A proposal with everything the screen needs to explain it. */
interface Line {
  proposal: MovementProposal;
  account: AccountRow | null;
  /** The movement it may already be, in words. */
  sameAs: string | null;
  /** The other half of a transfer, in words. */
  pairedWith: string | null;
  /** What was read, as the statement or the notification put it. */
  evidence: string;
  /** True where the sign was guessed from the words rather than proved. */
  guessed: boolean;
}

/**
 * A shop that turns up more than once among the readings.
 *
 * Answering for it once is the difference between confirming a statement in
 * a minute and confirming it in twenty.
 */
interface Repeated {
  merchant: string;
  /** What it was called, in the wording a person recognises. */
  sample: string;
  count: number;
  /** The category they all share, or null while they disagree or have none. */
  category: CategoryRow | null;
}

/** The rows of one statement, or of one batch of notifications. */
interface Batch {
  key: string;
  title: string;
  lines: Line[];
}

@Component({
  selector: 'app-review',
  standalone: true,
  imports: [
    CommonModule, FormsModule, TranslatePipe, ConfirmComponent, CategorySheetComponent,
    IconComponent,
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonButton, IonIcon,
    IonList, IonItem, IonLabel, IonNote, IonInput, IonSelect, IonSelectOption,
    IonSpinner, IonMenuButton, IonPopover,
  ],
  templateUrl: './review.page.html',
  styleUrls: ['./review.page.scss'],
})
export class ReviewPage {
  private readonly database = inject(DatabaseService);
  private readonly i18n = inject(I18nService);
  private readonly statements = inject(StatementsService);

  /** What the statement just read said about itself, while it is still true. */
  readonly justRead = computed(() => {
    const last = this.statements.lastImport();
    if (last === null) return null;
    const { reading } = last;
    const balances = reading.balances === 'checked'
      ? this.i18n.t('statement.balances.checked', {
          opening: this.money(reading.opening_minor),
          closing: this.money(reading.closing_minor),
        })
      : reading.balances === 'off'
        ? this.i18n.t('statement.balances.off', {
            opening: this.money(reading.opening_minor),
            closing: this.money(reading.closing_minor),
            read: this.money(reading.read_minor),
            amount: this.money(Math.abs(reading.offBy_minor)),
          })
        : this.i18n.t('statement.balances.unchecked');
    return {
      read: this.i18n.t('statement.read', { count: last.proposed, file: this.fileOf(last.batch) }),
      knownAlready: last.knownAlready > 0
        ? this.i18n.t('statement.knownAlready', { count: last.knownAlready })
        : null,
      balances,
      off: reading.balances === 'off',
    };
  });

  /** The name of the file, without the moment it was read. */
  private fileOf(batch: string): string {
    return batch.replace(/\s\d{4}-\d{2}-\d{2}T.*$/, '');
  }

  readonly loading = signal(true);
  readonly working = signal(false);
  readonly error = signal('');

  readonly batches = signal<Batch[]>([]);
  readonly categories = signal<CategoryRow[]>([]);
  readonly accounts = signal<AccountRow[]>([]);

  /** The row whose amount or date is being corrected, if any. */
  readonly editing = signal<number | null>(null);

  /**
   * The row whose category is being chosen, if any.
   *
   * The sheet is the movement form's, shared rather than copied: this screen
   * asked the same question with a bare select - a short list of names, no
   * pictures, nothing to search - and Jose asked for the one he already knows.
   */
  readonly choosingFor = signal<Line | null>(null);

  /**
   * What is on offer depends on which way the money went.
   *
   * For one row that is its own sign. For a shop that repeats it is the sign
   * they all share - and where they do not share one, the whole list, because
   * a name that is sometimes money in and sometimes money out cannot be filed
   * from half of it.
   */
  readonly choosingKind = computed<'expense' | 'income' | 'both'>(() => {
    const line = this.choosingFor();
    if (line !== null) return (line.proposal.amount_minor ?? -1) < 0 ? 'expense' : 'income';

    const repeated = this.choosingMerchant();
    if (repeated === null) return 'expense';

    const signs = new Set<'expense' | 'income'>();
    for (const batch of this.batches()) {
      for (const one of batch.lines) {
        if (merchantKeyOf(one.proposal.description) !== repeated.merchant) continue;
        signs.add((one.proposal.amount_minor ?? -1) < 0 ? 'expense' : 'income');
      }
    }
    return signs.size === 1 ? [...signs][0] : 'both';
  });

  /** The category on a row, for the button that opens the sheet. */
  categoryOf(line: Line): CategoryRow | null {
    const id = line.proposal.category_id;
    return id === null ? null : this.categories().find(category => category.id === id) ?? null;
  }

  async chooseCategory(id: number): Promise<void> {
    if (this.choosingMerchant() !== null) {
      await this.fileAllAs(id);
      return;
    }
    const line = this.choosingFor();
    this.choosingFor.set(null);
    if (line) await this.setCategory(line, id);
  }
  /**
   * The question on screen, if any.
   *
   * A dialog rather than a button that changes under the thumb: Jose asked
   * for it by name after meeting the second kind, and the app already has one
   * component for "are you sure" - the same one the movements and the
   * products use.
   */
  readonly asking = signal<
    { kind: 'accept' | 'discard' | 'forget'; batch: Batch } |
    { kind: 'acceptOne'; line: Line } |
    { kind: 'discardOne'; line: Line } | null>(null);

  readonly total = computed(() => this.batches().reduce((sum, batch) => sum + batch.lines.length, 0));

  /**
   * The shops that turn up more than once, with what they are all filed as.
   *
   * Shown above the list so the repeated ones are settled in one answer each
   * and what is left to read is the handful that are not repeated.
   */
  readonly repeated = computed<Repeated[]>(() => {
    const seen = new Map<string, { sample: string; count: number; categories: Set<number | null> }>();
    for (const batch of this.batches()) {
      for (const line of batch.lines) {
        const merchant = merchantKeyOf(line.proposal.description);
        if (merchant.length === 0) continue;
        const found = seen.get(merchant)
          ?? { sample: line.proposal.description ?? merchant, count: 0, categories: new Set<number | null>() };
        found.count += 1;
        found.categories.add(line.proposal.category_id);
        seen.set(merchant, found);
      }
    }

    return [...seen.entries()]
      .filter(([, found]) => found.count > 1)
      .map(([merchant, found]) => ({
        merchant,
        sample: found.sample,
        count: found.count,
        category: found.categories.size === 1
          ? this.categories().find(one => one.id === [...found.categories][0]) ?? null
          : null,
      }))
      .sort((one, other) => other.count - one.count);
  });

  /** The repeated shop whose category is being chosen, if any. */
  readonly choosingMerchant = signal<Repeated | null>(null);

  async fileAllAs(categoryId: number): Promise<void> {
    const repeated = this.choosingMerchant();
    this.choosingMerchant.set(null);
    if (!repeated) return;

    this.working.set(true);
    try {
      await new ProposalsRepository(this.database.driver).fileAllAs(repeated.merchant, categoryId);
      await this.refresh();
    } finally {
      this.working.set(false);
    }
  }

  /**
   * The batch whose other two answers are on show, and where to draw them.
   *
   * Saving is what somebody came here to do; undoing the import and throwing
   * it away are neither frequent nor urgent. As three buttons in a row they
   * read as three equal choices and took two goes at an icon that nobody
   * could name. Behind one dot-dot-dot they are two lines of plain words.
   */
  readonly menuFor = signal<Batch | null>(null);
  readonly menuAt = signal<Event | undefined>(undefined);

  openMenu(event: Event, batch: Batch): void {
    this.menuAt.set(event);
    this.menuFor.set(batch);
  }

  /** Closes the menu and asks the question it chose. */
  fromMenu(kind: 'forget' | 'discard'): void {
    const batch = this.menuFor();
    this.menuFor.set(null);
    if (batch) this.asking.set({ kind, batch });
  }

  constructor() {
    // Not in the constructor and not on entering: the database is opened once
    // at startup, and a screen that reads it before that is a screen showing
    // "Database is not initialized yet" - which is what Jose met when a
    // reload landed him straight here. This waits for it, and reads again
    // whenever the data changes, which is how every other screen here works.
    effect(() => {
      this.database.dataVersion();
      if (this.database.status() === 'ready') void this.refresh();
    });
  }

  async refresh(): Promise<void> {
    if (this.database.status() !== 'ready') return;
    this.loading.set(true);
    // Whatever went wrong last time was about the state being left behind,
    // and this is that state being read again.
    this.error.set('');
    try {
      const db = this.database.driver;
      const proposals = new ProposalsRepository(db);
      const accounts = new AccountsRepository(db);
      const categories = new CategoriesRepository(db);
      const transactions = new TransactionsRepository(db);

      const [waiting, allAccounts, allCategories] = await Promise.all([
        proposals.pending(), accounts.list(), categories.list(),
      ]);
      this.accounts.set(allAccounts);
      this.categories.set(allCategories);

      const accountOf = new Map(allAccounts.map(account => [account.id, account]));
      const known = new Map<string, Batch>();
      const waitingById = new Map(waiting.map(one => [one.id, one]));

      for (const proposal of waiting) {
        const account = proposal.account_id === null ? null : accountOf.get(proposal.account_id) ?? null;
        const evidence = this.evidenceOf(proposal);

        let sameAs: string | null = null;
        if (proposal.maybe_same_as !== null) {
          const already = await transactions.findById(proposal.maybe_same_as);
          if (already) {
            sameAs = this.i18n.t('review.maybeSame', {
              date: this.dayText(already.occurred_on),
              amount: formatMoney(already.amount_minor, 'COP'),
              note: already.description ?? '',
            });
          }
        }

        const other = proposal.pairs_with === null ? null : waitingById.get(proposal.pairs_with) ?? null;
        const pairedWith = other === null ? null : this.i18n.t('review.pairedWith', {
          account: (other.account_id === null ? null : accountOf.get(other.account_id)?.name) ?? '',
        });

        const batch = known.get(proposal.batch) ?? {
          key: proposal.batch,
          title: this.titleOf(proposal, account),
          lines: [],
        };
        batch.lines.push({
          proposal,
          account,
          sameAs,
          pairedWith,
          evidence,
          guessed: this.guessedOf(proposal),
        });
        known.set(proposal.batch, batch);
      }

      this.batches.set([...known.values()]);
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : String(error));
    } finally {
      this.loading.set(false);
    }
  }

  // -------------------------------------------------------------------------
  // What the screen says about a row
  // -------------------------------------------------------------------------

  private read(proposal: MovementProposal): Record<string, unknown> {
    try {
      return JSON.parse(proposal.evidence) as Record<string, unknown> ?? {};
    } catch {
      return {};
    }
  }

  private evidenceOf(proposal: MovementProposal): string {
    const read = this.read(proposal);
    if (typeof read['line'] === 'string') return read['line'];
    const title = typeof read['title'] === 'string' ? read['title'] : '';
    const text = typeof read['text'] === 'string' ? read['text'] : '';
    return [title, text].filter(Boolean).join(' - ');
  }

  private guessedOf(proposal: MovementProposal): boolean {
    return this.read(proposal)['confidence'] === 'low';
  }

  private titleOf(proposal: MovementProposal, account: AccountRow | null): string {
    const read = this.read(proposal);
    const where = account?.name ?? this.i18n.t('review.noAccount');
    if (proposal.source === 'notification') return this.i18n.t('review.fromNotification', { account: where });
    const file = typeof read['file'] === 'string' ? read['file'] : '';
    return this.i18n.t('review.fromStatement', { account: where, file });
  }

  /** Whether this row can be written at all, for the button that writes it. */
  ready(line: Line): boolean {
    return isComplete(line.proposal);
  }

  /**
   * The rows of a batch that can actually be written.
   *
   * "Guardar los 9 movimientos" promised nine and delivered eight, because
   * one of them had no category and the database will not take it. A button
   * that says a number has to mean that number.
   */
  readyLines(batch: Batch): Line[] {
    return batch.lines.filter(line => this.ready(line));
  }

  /** How many of a batch are still waiting on something. */
  waitingOn(batch: Batch): number {
    return batch.lines.length - this.readyLines(batch).length;
  }

  /** What a row is still missing, said rather than only greyed out. */
  missing(line: Line): string | null {
    const proposal = line.proposal;
    if (proposal.account_id === null) return this.i18n.t('review.needsAccount');
    if (proposal.amount_minor === null || proposal.amount_minor === 0) {
      return this.i18n.t('review.needsAmount');
    }
    if (proposal.category_id === null && proposal.pairs_with === null) {
      return this.i18n.t('review.needsCategory');
    }
    return null;
  }

  /**
   * A day, written the way this app writes days.
   *
   * It was left to the browser, which writes 09/02/2026 for the 2nd of
   * September in an en-US locale - beside a flag saying "2026-09-01", so one
   * card carried two formats and neither of them the app's. Jose could not
   * reconcile what he was looking at, and he was right not to.
   */
  dayText(iso: string | null): string {
    if (!iso) return '';
    const [year, month, day] = iso.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString(
      this.i18n.language() === 'en' ? 'en-GB' : 'es-CO',
      { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  }

  money(minor: number | null, currency?: string): string {
    if (minor === null) return '—';
    return formatMoney(minor, currency ?? 'COP');
  }

  // -------------------------------------------------------------------------
  // Correcting one
  // -------------------------------------------------------------------------

  async setCategory(line: Line, categoryId: number | null): Promise<void> {
    await this.save(line, { category_id: categoryId });
  }

  async setAccount(line: Line, accountId: number): Promise<void> {
    await this.save(line, { account_id: accountId });
  }

  async setDate(line: Line, on: string): Promise<void> {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(on)) return;
    await this.save(line, { occurred_on: on });
  }

  /**
   * The amount, typed the way the app itself writes it.
   *
   * The sign is kept from what was read: somebody correcting 45.000 to 46.000
   * is correcting the figure, not turning an expense into an income. Turning
   * it round is what the two buttons beside it are for.
   */
  async setAmount(line: Line, typed: string): Promise<void> {
    const text = typed.trim();
    if (text.length === 0) return;
    try {
      const minor = parseTypedAmountToMinor(text.replace(/^-/, ''));
      const negative = (line.proposal.amount_minor ?? -1) < 0 || text.startsWith('-');
      await this.save(line, { amount_minor: negative ? -minor : minor });
    } catch {
      this.error.set(this.i18n.t('review.error.amount'));
    }
  }

  async turnAround(line: Line): Promise<void> {
    if (line.proposal.amount_minor === null) return;
    await this.save(line, { amount_minor: -line.proposal.amount_minor });
  }

  private async save(line: Line, fields: Parameters<ProposalsRepository['correct']>[1]): Promise<void> {
    this.error.set('');
    const proposals = new ProposalsRepository(this.database.driver);
    await proposals.correct(line.proposal.id, fields);
    await this.refresh();
  }

  // -------------------------------------------------------------------------
  // Answering
  // -------------------------------------------------------------------------



  /** What the dialog says, which is different for each of the five. */
  askTitle(): string {
    const asking = this.asking();
    if (asking === null) return '';
    if (asking.kind === 'discardOne') return this.i18n.t('review.discard.sure');
    if (asking.kind === 'acceptOne') return this.i18n.t('review.accept.sure', { count: 1 });
    // Saving asks about the ones it can save; the other two are about the
    // whole batch, ready or not.
    const count = asking.kind === 'accept'
      ? this.readyLines(asking.batch).length
      : asking.batch.lines.length;
    // Discarding a whole batch is its own sentence: the one a single row uses
    // says 'this movement', which is not what is about to happen.
    if (asking.kind === 'discard') return this.i18n.t('review.discard.sureAll', { count });
    return this.i18n.t(`review.${asking.kind}.sure`, { count });
  }

  askBody(): string {
    const asking = this.asking();
    if (asking === null) return '';
    if (asking.kind === 'discardOne') return this.i18n.t('review.discard.body');
    // Asking about one movement, it is worth saying WHICH: the amount, where
    // it is being filed and the day. A confirmation that only asks "are you
    // sure" adds a tap and says nothing.
    if (asking.kind === 'acceptOne') {
      const line = asking.line;
      return [
        this.money(line.proposal.amount_minor, line.account?.currency_code),
        this.categoryOf(line)?.name ?? '',
        this.dayText(line.proposal.occurred_on),
        line.account?.name ?? '',
      ].filter(Boolean).join(' · ');
    }
    return this.i18n.t(`review.${asking.kind}.body`);
  }

  askLabel(): string {
    const asking = this.asking();
    if (asking === null) return '';
    const kind = asking.kind === 'discardOne' ? 'discard'
      : asking.kind === 'acceptOne' ? 'accept'
      : asking.kind;
    return this.i18n.t(`review.${kind}.do`);
  }

  askIcon(): string {
    const kind = this.asking()?.kind;
    if (kind === 'accept' || kind === 'acceptOne') return 'checkmark-done-outline';
    // Undoing the import destroys nothing, so it is not a bin: it is the same
    // arrow the button that opened it carries.
    if (kind === 'forget') return 'arrow-undo-outline';
    return 'trash-outline';
  }

  /**
   * The colour of the question, which is three different things here.
   *
   * Saving is ordinary, undoing an import destroys nothing and comes back,
   * and discarding is the only one that does not. Painting all three red said
   * the same thing about all three.
   */
  askTone(): 'danger' | 'primary' | 'medium' {
    const kind = this.asking()?.kind;
    if (kind === 'accept' || kind === 'acceptOne') return 'primary';
    if (kind === 'forget') return 'medium';
    return 'danger';
  }

  /** Does whatever was being asked about. */
  async confirmed(): Promise<void> {
    const asking = this.asking();
    this.asking.set(null);
    if (asking === null) return;

    if (asking.kind === 'accept') {
      await this.write(this.readyLines(asking.batch).map(line => line.proposal));
    } else if (asking.kind === 'acceptOne') {
      await this.write([asking.line.proposal]);
    } else if (asking.kind === 'discard') {
      await this.rejectAll(asking.batch);
    } else if (asking.kind === 'discardOne') {
      await this.rejectOne(asking.line);
    } else {
      await this.forget(asking.batch);
    }
  }

  private async write(proposals: readonly MovementProposal[]): Promise<void> {
    this.working.set(true);
    this.error.set('');
    try {
      const db = this.database.driver;
      const result = await accept({
        proposals: new ProposalsRepository(db),
        transactions: new TransactionsRepository(db),
        transfers: new TransfersRepository(db),
      }, proposals);

      if (result.refused.length > 0) {
        this.error.set(this.i18n.t('review.error.incomplete', { count: result.refused.length }));
      }
      this.database.dataChanged();
      await this.refresh();
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : String(error));
    } finally {
      this.working.set(false);
    }
  }

  private async rejectOne(line: Line): Promise<void> {
    this.working.set(true);
    try {
      await new ProposalsRepository(this.database.driver).reject(line.proposal.id);
      await this.refresh();
    } finally {
      this.working.set(false);
    }
  }

  private async rejectAll(batch: Batch): Promise<void> {
    this.working.set(true);
    try {
      const proposals = new ProposalsRepository(this.database.driver);
      for (const line of batch.lines) await proposals.reject(line.proposal.id);
      await this.refresh();
    } finally {
      this.working.set(false);
    }
  }

  /**
   * Off the screen, without deciding anything.
   *
   * The third answer, and the one Jose asked for: not saved, not thrown
   * away - just gone, and the same statement imported again brings it back.
   */
  private async forget(batch: Batch): Promise<void> {
    this.working.set(true);
    try {
      await new ProposalsRepository(this.database.driver).forget(batch.key);
      this.statements.lastImport.set(null);
      await this.refresh();
    } finally {
      this.working.set(false);
    }
  }
}
