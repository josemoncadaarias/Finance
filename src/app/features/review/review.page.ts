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

import { Component, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, IonIcon, IonSpinner, IonModal } from '@ionic/angular';
import { Location } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

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
import { foldText } from '../../core/text/fold-text';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ConfirmComponent } from '../../shared/confirm/confirm.component';
import { CategorySheetComponent } from '../../shared/category-sheet/category-sheet.component';
import { BadgeComponent } from '../../shared/ui/badge.component';
import { JumpComponent } from '../../shared/ui/jump.component';
import { AccountPickerComponent } from '../../shared/account-picker/account-picker.component';
import { ComposeService, type ProposalAsk } from '../../core/ui/compose.service';
import { ProposalFormComponent, type ProposalAnswer } from './proposal-form.component';
import { NoticeInboxService } from '../../core/notices/notice-inbox.service';

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
  /** The other messages that told this same movement, in words. */
  seenBy: string | null;
  /** A message from another source that may be this one, in words. */
  twin: string | null;
  /** Saved as a transfer before: the account at the other end (learned). */
  transferTo: number | null;
  /** The other bank's message telling this same transfer, still waiting. */
  partner: MovementProposal | null;
}

/**
 * A shop that turns up more than once among the readings.
 *
 * Answering for it once is the difference between confirming a statement in
 * a minute and confirming it in twenty.
 */
interface Repeated {
  /** The origin it repeats in: each statement or sender has its own. */
  batch: string;
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
    BadgeComponent, JumpComponent, AccountPickerComponent, ProposalFormComponent,
    IonContent, IonIcon, IonSpinner, IonModal,
  ],
  templateUrl: './review.page.html',
  styleUrls: ['./review.page.scss'],
})
export class ReviewPage {
  private readonly database = inject(DatabaseService);
  private readonly notices = inject(NoticeInboxService);
  readonly i18n = inject(I18nService);
  private readonly statements = inject(StatementsService);
  private readonly compose = inject(ComposeService);
  private readonly location = inject(Location);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly info = signal<string | null>(null);

  back(): void {
    this.location.back();
  }

  /** While choosing, the selection bar takes the tab bar's place. */
  private readonly hideTabs = effect(() => {
    document.body.classList.toggle('choosing', this.selecting());
  });

  ngOnDestroy(): void {
    document.body.classList.remove('choosing');
  }

  /** Every row of every shop that repeats in an origin, for the tick on their heading. */
  allShopLines(batch: Batch): Line[] {
    return this.repeatedOf(batch).flatMap(shop => this.linesOfShop(shop));
  }

  /**
   * What the statement says the account held, against what the app says.
   *
   * Shown once the reading has been answered, because until then the app's
   * figure is still moving. The two are compared AT THE STATEMENT'S LAST DAY
   * and not today: anything typed since then is not a disagreement, it is the
   * days since then.
   */
  readonly squaring = signal<{
    accountId: number;
    accountName: string;
    currency: string;
    day: string;
    theirs: number;
    ours: number;
    /** What the account's opening figure is now, for the question asked. */
    opening: number;
  } | null>(null);

  /**
   * How the readings are sorted and which of them are shown.
   *
   * A statement is fifty lines on a phone, and the two questions somebody
   * actually asks of it are "what is the biggest thing here" and "what still
   * needs me". Both are one tap now. The order lives here rather than in the
   * repository because it is about looking, not about the data.
   */
  readonly sortBy = signal<'date' | 'amount'>('date');
  readonly showOnly = signal<'all' | 'waiting' | 'flagged'>('all');

  /**
   * The list as it is being looked at, worked out once per change of the
   * rows or the filters and read from here by everything on the screen.
   *
   * It used to be worked out again by every call from the template - and
   * `daysOf` called it once per day, per change detection, which on a phone
   * is every frame of a scroll. With a statement of two hundred rows that
   * was the stutter Jose felt scrolling the list after an import.
   */
  private readonly shownByBatch = computed(() =>
    new Map(this.batches().map(batch => [batch.key, this.filterBatch(batch)])));

  shownIn(batch: Batch): Line[] {
    return this.shownByBatch().get(batch.key) ?? this.filterBatch(batch);
  }

  /** Filtered, then sorted. */
  private filterBatch(batch: Batch): Line[] {
    const only = this.showOnly();
    const term = foldText(this.search());
    const account = this.accountFilter();
    const lines = batch.lines.filter(line => {
      if (account !== null && line.proposal.account_id !== account) return false;
      if (term.length > 0 && !this.matches(line, term)) return false;
      if (only === 'waiting') return !this.ready(line);
      if (only === 'flagged') return line.sameAs !== null || line.pairedWith !== null || line.guessed || line.twin !== null;
      return true;
    });

    return this.sortBy() === 'amount'
      // By what it is worth, biggest first, whichever way the money went: the
      // question is "what is the large thing here", and a large expense and a
      // large income are both answers to it.
      ? [...lines].sort((one, other) =>
          Math.abs(other.proposal.amount_minor ?? 0) - Math.abs(one.proposal.amount_minor ?? 0))
      : lines;
  }

  /**
   * What is typed in the search (Jose, 2026-09-25: a statement can bring
   * dozens). It narrows the list like the filters do, so "Todos" in the
   * selection bar ticks only what was found.
   */
  readonly search = signal('');

  /** What a row says, as the search reads it: the words, the amount, where. */
  private matches(line: Line, term: string): boolean {
    const said = [
      line.proposal.description, line.evidence, line.account?.name, this.categoryOf(line)?.name,
      this.money(line.proposal.amount_minor, line.account?.currency_code),
      this.dayText(line.proposal.occurred_on),
    ].filter(Boolean).join(' ');
    // Digits as typed too: "45900" finds "$ 45.900,00".
    const digits = term.replace(/[^\d]/g, '');
    return foldText(said).includes(term)
      || (digits.length >= 3 && said.replace(/[^\d]/g, '').includes(digits));
  }

  /** The filter that is on, in the words the button beside it uses. */
  readonly filterName = computed(() => {
    const typed = this.search().trim();
    if (typed.length > 0) return this.i18n.t('review.search.named', { term: typed });
    return this.i18n.t(this.showOnly() === 'waiting' ? 'review.only.waiting' : 'review.only.flagged');
  });

  /** "Ver todos": every filter off, the search included. */
  showEverything(): void {
    this.showOnly.set('all');
    this.search.set('');
  }

  // -------------------------------------------------------------------------
  // The redesign (mockups 6a-6z)
  // -------------------------------------------------------------------------

  /** Which account's movements are on show; null is "Todas las cuentas". */
  readonly accountFilter = signal<number | null>(null);
  readonly pickingAccount = signal(false);
  readonly choosingView = signal(false);
  readonly batchMenu = signal<Batch | null>(null);
  readonly balancesFor = signal<Batch | null>(null);

  /** The accounts with something waiting, first, for the account list. */
  readonly waitingByAccount = computed(() => {
    const counts = new Map<number, number>();
    for (const batch of this.batches()) {
      for (const line of batch.lines) {
        if (line.proposal.account_id !== null) counts.set(line.proposal.account_id, (counts.get(line.proposal.account_id) ?? 0) + 1);
      }
    }
    return counts;
  });

  readonly accountLabel = computed(() =>
    this.accounts().find(one => one.id === this.accountFilter())?.name ?? this.i18n.t('summary.allAccounts'));

  readonly shownAccount = computed(() => this.accounts().find(one => one.id === this.accountFilter()) ?? null);

  /** "Todos · por fecha": what is shown and in what order, on one chip. */
  readonly viewLabel = computed(() => {
    const only = this.i18n.t(this.showOnly() === 'waiting' ? 'review.only.waiting'
      : this.showOnly() === 'flagged' ? 'review.only.flagged' : 'review.only.all');
    const order = this.i18n.t(this.sortBy() === 'amount' ? 'ui.review.byAmount' : 'ui.review.byDate');
    return `${only} · ${order}`;
  });

  readonly filtering = computed(() => this.showOnly() !== 'all' || this.search().trim() !== '' || this.accountFilter() !== null);

  /**
   * A filter or a search on (the account aside): the screen then shows the
   * rows that match and nothing about whole origins - no "Guardar los N",
   * no repeated shops, no origin with nothing left in it (Jose, 2026-10-05).
   */
  readonly narrowed = computed(() => this.showOnly() !== 'all' || this.search().trim() !== '');

  /** The origins on view: under a filter, only those with a row that matches. */
  readonly shownBatches = computed(() =>
    this.filtering() ? this.batches().filter(batch => this.shownIn(batch).length > 0) : this.batches());

  /**
   * An origin seen only in part - a filter, a search, or an account that
   * holds only some of its rows. Its card and its repeated shops speak of
   * the whole origin, so they step aside; seen whole (a statement of the
   * account chosen above), it is shown as always.
   */
  partial(batch: Batch): boolean {
    return this.narrowed() || this.shownIn(batch).length < batch.lines.length;
  }

  readonly shownCount = computed(() => this.batches().reduce((sum, batch) => sum + this.shownIn(batch).length, 0));

  countOf(count: number): string {
    return count === 1 ? this.i18n.t('ui.count.movement') : this.i18n.t('ui.count.movements', { count });
  }

  /** How many flagged or waiting, for the rows of the "Mostrar" sheet. */
  readonly waitingCount = computed(() => this.batches().reduce((sum, batch) => sum + this.waitingOn(batch), 0));
  readonly flaggedCount = computed(() => this.batches().reduce((sum, batch) =>
    sum + batch.lines.filter(line => line.sameAs !== null || line.pairedWith !== null || line.guessed
      || line.twin !== null).length, 0));

  /** A batch's rows, by day, the first day open (the rule for every list). */
  private readonly daysByBatch = computed(() =>
    new Map(this.batches().map(batch => [batch.key, this.groupDays(batch)])));

  daysOf(batch: Batch): { key: string; title: string; lines: Line[]; totalMinor: number; currency: string }[] {
    return this.daysByBatch().get(batch.key) ?? this.groupDays(batch);
  }

  private groupDays(batch: Batch): { key: string; title: string; lines: Line[]; totalMinor: number; currency: string }[] {
    const days = new Map<string, { key: string; title: string; lines: Line[]; totalMinor: number; currency: string }>();
    for (const line of this.shownIn(batch).filter(one => one.sameAs === null)) {
      const key = `${batch.key}|${this.sortBy() === 'amount' ? 'all' : line.proposal.occurred_on ?? ''}`;
      const day = days.get(key) ?? {
        key, title: this.sortBy() === 'amount' ? '' : this.longDay(line.proposal.occurred_on),
        lines: [], totalMinor: 0, currency: line.account?.currency_code ?? 'COP',
      };
      day.lines.push(line);
      day.totalMinor += line.proposal.amount_minor ?? 0;
      days.set(key, day);
    }
    // Newest first, the way every list of movements reads.
    return [...days.values()].sort((a, b) => b.key.localeCompare(a.key));
  }

  private readonly dayState = signal<ReadonlyMap<string, boolean>>(new Map());

  /** Everything starts folded here (Jose, 2026-10-05); a day opens when tapped. */
  isDayOpen(_batch: Batch, key: string): boolean {
    return this.dayState().get(key) ?? false;
  }

  toggleDay(batch: Batch, key: string): void {
    const next = new Map(this.dayState());
    next.set(key, !this.isDayOpen(batch, key));
    this.dayState.set(next);
  }

  /**
   * Open EVERYTHING, or fold everything (Jose, 2026-10-05): every origin,
   * its days, its repeated shops and what is already on record - never
   * "all but the first".
   */
  toggleAllDays(): void {
    const open = this.allDaysClosed();
    const batches = this.batches();
    this.batchState.set(new Map(batches.map(batch => [batch.key, open])));
    this.dayState.set(new Map(batches.flatMap(batch => this.daysOf(batch).map(day => [day.key, open] as const))));
    this.knownOpen.set(new Set(open ? batches.map(batch => batch.key) : []));
    this.shopsOpen.set(new Set(open ? batches.map(batch => batch.key) : []));
  }

  /** Folded when no origin is open (an origin's insides cannot be seen without it). */
  readonly allDaysClosed = computed(() => this.batches().every(batch => !this.isBatchOpen(batch)));

  /** The origins whose "Comercios que se repiten" is open. */
  readonly shopsOpen = signal<ReadonlySet<string>>(new Set());

  toggleShops(batch: Batch): void {
    const next = new Set(this.shopsOpen());
    if (next.has(batch.key)) next.delete(batch.key); else next.add(batch.key);
    this.shopsOpen.set(next);
  }

  /** "Viernes 26 de septiembre". */
  longDay(iso: string | null): string {
    if (!iso) return this.i18n.t('ui.review.noDate');
    const [year, month, day] = iso.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    const locale = this.i18n.dateLocale();
    const weekday = date.toLocaleDateString(locale, { weekday: 'long' });
    const monthText = date.toLocaleDateString(locale, { month: 'long' });
    const text = this.i18n.t('ui.review.dayTitle', { weekday, day, month: monthText });
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  /** Ticks every row of a day or a shop, or none when all of them are ticked. */
  toggleMany(lines: readonly Line[]): void {
    const next = new Set(this.selectedIds());
    const all = lines.every(line => next.has(line.proposal.id));
    for (const line of lines) {
      if (all) next.delete(line.proposal.id);
      else next.add(line.proposal.id);
    }
    this.selectedIds.set(next);
  }

  /** 'on', 'half' or 'off', for the tick of a day or a shop. */
  tickOf(lines: readonly Line[]): 'on' | 'half' | 'off' {
    const ids = this.selectedIds();
    const ticked = lines.filter(line => ids.has(line.proposal.id)).length;
    return ticked === 0 ? 'off' : ticked === lines.length ? 'on' : 'half';
  }

  pickedOf(lines: readonly Line[]): number {
    const ids = this.selectedIds();
    return lines.filter(line => ids.has(line.proposal.id)).length;
  }

  /** The rows of a repeated shop, wherever they are. */
  linesOfShop(shop: Repeated): Line[] {
    return this.linesByMerchant().get(`${shop.batch}|${shop.merchant}`) ?? [];
  }

  /** Every row by its shop, read once rather than once per shop per frame. */
  private readonly linesByMerchant = computed(() => {
    const byMerchant = new Map<string, Line[]>();
    for (const line of this.batches().flatMap(batch => batch.lines)) {
      // What the ledger already holds is answered apart, never with its shop.
      if (line.sameAs !== null) continue;
      const key = `${line.proposal.batch}|${merchantKeyOf(line.proposal.description)}`;
      const found = byMerchant.get(key);
      if (found) found.push(line); else byMerchant.set(key, [line]);
    }
    return byMerchant;
  });

  /** A row tapped: ticked while choosing, opened in the movement form otherwise. */
  tapped(line: Line): void {
    if (this.selecting()) this.toggle(line);
    // Saved as a transfer last time: it opens as one, ready to save.
    else if ((line.transferTo !== null || this.partnerOf(line) !== null) && line.proposal.account_id !== null) this.asTransfer(line);
    else this.openLine.set(line);
  }

  /** The other half of a transfer between two banks, while it waits too. */
  private partnerOf(line: Line): MovementProposal | null {
    return line.partner;
  }

  /**
   * "Transferir" on a proposal (Jose, 2026-10-08): the one movement form,
   * opened as a transfer. The message's account is the end the money left
   * (or reached, for money in) with its usual product; the other end is the
   * account the person used last time for this shape of message, or else the
   * one this account most often sends money to (or receives from). Saving it
   * marks the proposal saved and teaches the source's mold.
   */
  asTransfer(line: Line, typed?: { amountMinor: number; onDate: string; accountId: number | null; note: string; sign: 1 | -1 }): void {
    const accountId = typed?.accountId ?? line.proposal.account_id;
    const sign = typed?.sign ?? ((line.proposal.amount_minor ?? 0) >= 0 ? 1 : -1);
    const amountMinor = typed?.amountMinor ?? Math.abs(line.proposal.amount_minor ?? 0);
    const onDate = typed?.onDate || line.proposal.occurred_on || '';
    this.openLine.set(null);
    if (accountId === null) return;
    const partner = this.partnerOf(line);
    const other = line.transferTo ?? partner?.account_id ?? null;
    this.compose.entry.set({
      kind: 'transfer',
      ...(other !== null && other !== accountId
        ? { route: sign < 0 ? { from: accountId, to: other } : { from: other, to: accountId } }
        : { preferredAccountId: accountId, preferredSide: sign < 0 ? 'from' as const : 'to' as const }),
      start: { amountMinor, onDate, note: typed?.note ?? '' },
      proposal: { id: line.proposal.id, accountId, said: line.evidence, ...(partner ? { pairId: partner.id } : {}) },
    });
  }

  /** What was typed in the one form before going back to the proposal's own. */
  readonly typedBack = signal<NonNullable<ProposalAsk['typed']> | null>(null);

  /**
   * The eye, the bin or Gasto/Ingreso pressed in the one form opened from a
   * proposal as a transfer: answered here, as from the proposal's own form.
   */
  private readonly fromTransfer = effect(() => {
    const ask = this.compose.proposalAsk();
    if (ask === null) return;
    untracked(() => {
      this.compose.proposalAsk.set(null);
      const line = this.batches().flatMap(batch => batch.lines).find(one => one.proposal.id === ask.id);
      if (!line) return;
      if (ask.kind === 'forget') this.asking.set({ kind: 'forgetOne', line });
      else if (ask.kind === 'discard') this.asking.set({ kind: 'discardOne', line });
      else {
        // Spending or income after all: the two banks' messages were not
        // one transfer, so each is proposed on its own again.
        if (line.partner) {
          void new ProposalsRepository(this.database.driver).unpair(line.proposal.id).then(() => this.refresh());
        }
        this.typedBack.set(ask.typed ?? null);
        this.openLine.set({ ...line, partner: null, transferTo: null });
      }
    });
  });

  // --- one row, answered in the movement form (6e-6h) ----------------------

  readonly openLine = signal<Line | null>(null);

  async answer(line: Line, fields: ProposalAnswer): Promise<void> {
    this.working.set(true);
    try {
      const proposals = new ProposalsRepository(this.database.driver);
      await proposals.correct(line.proposal.id, fields);
      const updated = await proposals.byId(line.proposal.id);
      this.openLine.set(null);
      if (updated) await this.write([updated]);
    } finally {
      this.working.set(false);
    }
  }

  /** Closes the form a proposal was answered from, once the answer is yes. */
  private closeAnswered(line: Line): void {
    if (this.openLine()?.proposal.id === line.proposal.id) this.openLine.set(null);
    if (this.compose.entry()?.proposal?.id === line.proposal.id) this.compose.close();
  }

  forgetOpen(): void {
    const line = this.openLine();
    if (!line) return;
    // Asked over the form, which stays open: "Cancelar" leaves it as it was.
    this.asking.set({ kind: 'forgetOne', line });
  }

  discardOpen(): void {
    const line = this.openLine();
    if (!line) return;
    // Asked over the form, which stays open: "Cancelar" leaves it as it was.
    this.asking.set({ kind: 'discardOne', line });
  }

  /** The file a batch was read from. */
  fileName(batch: Batch): string {
    if (batch.lines[0]?.proposal.source === 'notification') {
      const names = [...new Set(batch.lines.map(line => line.account?.name ?? null))];
      if (names.length === 1) return names[0] ?? this.i18n.t('review.noAccount');
      return this.i18n.t('ui.review.manyAccounts', { count: names.filter(Boolean).length });
    }
    const read = this.read(batch.lines[0]?.proposal ?? ({ evidence: '{}' } as MovementProposal));
    return typeof read['file'] === 'string' ? read['file'] : this.fileOf(batch.key);
  }

  /**
   * What each statement said about its own arithmetic, kept per batch on this
   * device (Jose, 2026-10-05: the mark showed only beside the statement read
   * last, so one statement had it and the next did not, and it was taken for
   * "everything here is ready"). It says one thing only: the statement's
   * opening balance plus what was read equals its closing balance.
   */
  private readonly checks = signal<Record<string, StatementCheck>>(loadChecks());

  private readonly keepCheck = effect(() => {
    const last = this.statements.lastImport();
    if (last === null || last.reading.balances === 'unchecked') return;
    const { reading } = last;
    const all = { ...loadChecks(), [last.batch]: {
      off: reading.balances === 'off', opening: reading.opening_minor ?? 0, closing: reading.closing_minor ?? 0,
      read: reading.read_minor ?? 0, offBy: reading.offBy_minor ?? 0,
    } };
    try { localStorage.setItem(CHECKS_KEY, JSON.stringify(all)); } catch { /* the mark is a convenience */ }
    this.checks.set(all);
  });

  /** What the statement said about its own arithmetic, for its batch. */
  checkOf(batch: Batch): { off: boolean; line: string; gap: string } | null {
    const kept = this.checks()[batch.key];
    if (!kept) return null;
    const line = kept.off
      ? this.i18n.t('statement.balances.off', {
          opening: this.money(kept.opening), closing: this.money(kept.closing),
          read: this.money(kept.read), amount: this.money(Math.abs(kept.offBy)),
        })
      : this.i18n.t('statement.balances.checked', { opening: this.money(kept.opening), closing: this.money(kept.closing) });
    return { off: kept.off, line, gap: kept.off ? this.money(Math.abs(kept.offBy)) : '' };
  }

  startImport(): void {
    this.compose.startImport();
  }

  /** How many a filter is hiding, so it never hides silently. */
  hiddenIn(batch: Batch): number {
    return batch.lines.length - this.shownIn(batch).length;
  }

  // --- moving through a long list ------------------------------------------

  private readonly content = viewChild(IonContent);

  async toTop(): Promise<void> {
    await this.content()?.scrollToTop(300);
  }

  async toBottom(): Promise<void> {
    await this.content()?.scrollToBottom(300);
  }

  /** Open while the statement's own arithmetic is being read. */
  readonly explaining = signal(false);

  /** Open while another figure is being typed instead. */
  readonly typingBalance = signal(false);
  readonly typedBalance = signal('');

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
      // The number beside the title counts everything waiting on this screen,
      // which after a second reading is more than this one brought. Jose read
      // the two as one figure and they disagreed: they are two figures, and
      // the screen says so rather than leaving it to be worked out.
      alsoWaiting: this.total() > last.proposed
        ? this.i18n.t('statement.alsoWaiting', { count: this.total() })
        : null,
      balances,
      off: reading.balances === 'off',
    };
  });

  /** How far apart the two are, which is the figure the question is about. */
  readonly squaringGap = computed(() => {
    const squaring = this.squaring();
    return squaring === null ? 0 : squaring.theirs - squaring.ours;
  });

  /**
   * Works out whether there is anything to square, after an answer.
   *
   * Only where the statement gave a closing balance and an account to compare
   * it with, and only while they actually differ: a card that says "these two
   * agree" is a card nobody needs to read.
   */
  private async lookForDrift(): Promise<void> {
    const last = this.statements.lastImport();
    if (last === null || last.reading.closing_minor === null) return this.squaring.set(null);

    const accountId = last.accountId;
    const day = last.reading.rows[last.reading.rows.length - 1]?.occurred_on ?? null;
    if (accountId === null || day === null) return this.squaring.set(null);

    // Not while its own rows are still waiting: the app's figure is going to
    // move as they are answered, and a difference that is about to change is
    // not worth showing.
    const waiting = await new ProposalsRepository(this.database.driver).ofBatch(last.batch);
    if (waiting.some(one => one.status === 'pending')) return this.squaring.set(null);

    const accounts = new AccountsRepository(this.database.driver);
    const account = await accounts.findById(accountId);
    if (!account) return this.squaring.set(null);

    const ours = await accounts.balanceOn(accountId, day);
    if (ours === last.reading.closing_minor) return this.squaring.set(null);

    this.squaring.set({
      accountId,
      accountName: account.name,
      currency: account.currency_code,
      day,
      theirs: last.reading.closing_minor,
      ours,
      opening: account.opening_balance_minor,
    });
  }

  /** Asks before moving it: it is a figure of his own, not a reading. */
  askToSquare(to?: number): void {
    const squaring = this.squaring();
    if (squaring === null) return;
    this.asking.set({ kind: 'square', to: to ?? squaring.theirs });
  }

  askToSquareTyped(): void {
    try {
      this.askToSquare(parseTypedAmountToMinor(this.typedBalance().trim()));
    } catch {
      this.error.set(this.i18n.t('review.error.amount'));
    }
  }

  /** Makes the account say what the bank said, by moving its opening figure. */
  async square(to?: number): Promise<void> {
    const squaring = this.squaring();
    if (squaring === null) return;

    this.working.set(true);
    try {
      await new AccountsRepository(this.database.driver)
        .squareWith(squaring.accountId, squaring.day, to ?? squaring.theirs);
      this.squaring.set(null);
      this.typingBalance.set(false);
      this.statements.lastImport.set(null);
      this.database.dataChanged();
    } finally {
      this.working.set(false);
    }
  }

  /** The figure typed by hand instead of either of the two offered. */
  async squareToTyped(): Promise<void> {
    try {
      await this.square(parseTypedAmountToMinor(this.typedBalance().trim()));
    } catch {
      this.error.set(this.i18n.t('review.error.amount'));
    }
  }

  /** The name of the file, without the moment it was read. */
  fileOf(batch: string): string {
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

    // Several ticked: the side they share, or the whole list where they mix.
    if (this.choosingForSelection()) {
      const sides = new Set(this.selectedLines().map(one =>
        (one.proposal.amount_minor ?? -1) < 0 ? 'expense' as const : 'income' as const));
      return sides.size === 1 ? [...sides][0] : 'both';
    }

    const repeated = this.choosingMerchant();
    if (repeated === null) return 'expense';

    const signs = new Set<'expense' | 'income'>();
    for (const batch of this.batches()) {
      if (batch.key !== repeated.batch) continue;
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
    return id === null ? null : this.categoriesById().get(id) ?? null;
  }

  private readonly categoriesById = computed(() => new Map(this.categories().map(category => [category.id, category])));

  async chooseCategory(id: number): Promise<void> {
    if (this.choosingForSelection()) {
      this.choosingForSelection.set(false);
      await this.fileSelected(id);
      return;
    }
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
    { kind: 'accept' | 'discard' | 'forget' | 'discardKnown'; batch: Batch } |
    /** The rows chosen by hand, whatever batch they are in. */
    { kind: 'acceptSelected' } | { kind: 'discardSelected' } | { kind: 'forgetSelected' } |
    { kind: 'acceptOne'; line: Line } |
    { kind: 'discardOne'; line: Line } |
    /** "No ver más" from the form of one row (the eye). */
    { kind: 'forgetOne'; line: Line } |
    /** Moving the opening balance, which is a figure of Jose's own. */
    { kind: 'square'; to: number } |
    /** Leaving it as it is, which is also an answer to the same question. */
    { kind: 'leaveBalance' } | null>(null);

  readonly total = computed(() => this.batches().reduce((sum, batch) => sum + batch.lines.length, 0));

  /**
   * The shops that turn up more than once, with what they are all filed as.
   *
   * Shown above the list so the repeated ones are settled in one answer each
   * and what is left to read is the handful that are not repeated.
   */
  readonly repeated = computed<ReadonlyMap<string, Repeated[]>>(() => {
    // Within each origin (Jose, 2026-10-05): a shop repeated in one bank's
    // statement is answered there, never mixed with another bank's.
    const byBatch = new Map<string, Repeated[]>();
    for (const batch of this.batches()) {
      const seen = new Map<string, { sample: string; count: number; categories: Set<number | null> }>();
      for (const line of batch.lines) {
        if (line.sameAs !== null) continue;
        const merchant = merchantKeyOf(line.proposal.description);
        if (merchant.length === 0) continue;
        const found = seen.get(merchant)
          ?? { sample: line.proposal.description ?? merchant, count: 0, categories: new Set<number | null>() };
        found.count += 1;
        found.categories.add(line.proposal.category_id);
        seen.set(merchant, found);
      }
      byBatch.set(batch.key, [...seen.entries()]
        .filter(([, found]) => found.count > 1)
        .map(([merchant, found]) => ({
          batch: batch.key,
          merchant,
          sample: found.sample,
          count: found.count,
          category: found.categories.size === 1
            ? this.categories().find(one => one.id === [...found.categories][0]) ?? null
            : null,
        }))
        .sort((one, other) => other.count - one.count));
    }
    return byBatch;
  });

  repeatedOf(batch: Batch): Repeated[] {
    return this.repeated().get(batch.key) ?? [];
  }

  /** The repeated shop whose category is being chosen, if any. */
  readonly choosingMerchant = signal<Repeated | null>(null);

  // -------------------------------------------------------------------------
  // Choosing several by hand
  // -------------------------------------------------------------------------

  /**
   * Several rows answered at once (Jose, 2026-09-25): tick them, then give
   * them one category, save them or discard them together. The repeated
   * shops above do that for rows that share a name; this is for rows that
   * share only what the person knows about them. Entered from "Seleccionar"
   * or by a long press on a row, the way Android lists do it.
   */
  readonly selecting = signal(false);
  private readonly selectedIds = signal<ReadonlySet<number>>(new Set());
  /** The category sheet is open for the selection. */
  readonly choosingForSelection = signal(false);

  /** Every row on view, across batches, as the filter leaves it. */
  private readonly shownLines = computed(() => this.batches().flatMap(batch => this.shownIn(batch)));

  /** What is ticked and still waiting: a row answered meanwhile drops out. */
  readonly selectedLines = computed(() => {
    const ids = this.selectedIds();
    return this.batches().flatMap(batch => batch.lines).filter(line => ids.has(line.proposal.id));
  });

  readonly selectedReady = computed(() => this.selectedLines().filter(line => this.ready(line)));

  /**
   * Ticked rows that cannot be written yet. While there is one, saving the
   * selection waits and the bar says how many (Jose, 2026-10-05: a row with
   * no category could be ticked and the button still offered to save).
   */
  readonly selectedWaiting = computed(() => this.selectedLines().filter(line => !this.ready(line)));

  /** "Ver cuáles": the list narrowed to what still needs something. */
  seeWaiting(): void {
    this.showOnly.set('waiting');
    this.selectedIds.set(new Set(this.selectedWaiting().map(line => line.proposal.id)));
  }

  readonly allShownSelected = computed(() => {
    const shown = this.shownLines();
    const ids = this.selectedIds();
    return shown.length > 0 && shown.every(line => ids.has(line.proposal.id));
  });

  isSelected(line: Line): boolean {
    return this.selectedIds().has(line.proposal.id);
  }

  toggle(line: Line): void {
    const next = new Set(this.selectedIds());
    if (!next.delete(line.proposal.id)) next.add(line.proposal.id);
    this.selectedIds.set(next);
  }

  startSelecting(line?: Line): void {
    this.selecting.set(true);
    this.selectedIds.set(new Set(line ? [line.proposal.id] : []));
  }

  /** A long press starts choosing with that row ticked; Android's own gesture. */
  pressed(event: Event, line: Line): void {
    if (this.selecting()) return;
    event.preventDefault();
    this.startSelecting(line);
  }

  /**
   * A long press on a shop or on a day starts choosing with all its rows
   * ticked, as a long press on one row starts it with that row (Jose,
   * 2026-09-28: it only worked on the rows).
   */
  pressedMany(event: Event, lines: readonly Line[]): void {
    event.preventDefault();
    if (this.selecting()) return;
    this.selecting.set(true);
    this.selectedIds.set(new Set(lines.map(line => line.proposal.id)));
  }

  stopSelecting(): void {
    this.selecting.set(false);
    this.selectedIds.set(new Set());
  }

  /** All that the filter shows, or none if they are all ticked already. */
  selectAllShown(): void {
    this.selectedIds.set(this.allShownSelected()
      ? new Set()
      : new Set(this.shownLines().map(line => line.proposal.id)));
  }

  /**
   * One category for every ticked row. The selection stays, so the next tap
   * can save them - which is almost always what comes next.
   */
  private async fileSelected(categoryId: number): Promise<void> {
    this.working.set(true);
    try {
      await new ProposalsRepository(this.database.driver)
        .fileThese(this.selectedLines().map(line => line.proposal.id), categoryId);
      await this.refresh();
    } finally {
      this.working.set(false);
    }
  }

  async fileAllAs(categoryId: number): Promise<void> {
    const repeated = this.choosingMerchant();
    this.choosingMerchant.set(null);
    if (!repeated) return;

    this.working.set(true);
    try {
      await new ProposalsRepository(this.database.driver).fileAllAs(repeated.merchant, categoryId, repeated.batch);
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
      // The language too: the titles, the dates and the sentences about a
      // duplicate or a pair are built here, once, and stored on each row. An
      // import made in English left "Statement of Ualá" sitting there after
      // the flag was switched, because nothing asked for them again.
      this.i18n.language();
      if (this.database.status() === 'ready') void this.refresh();
    });
    // The banks' messages that arrived since the last look: read now, so
    // opening this screen is enough. A new proposal redraws it by itself.
    void this.notices.read();
    // "Movimiento detectado" tapped on the phone: its message's proposal opens.
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe(params => {
      const raw = params.get('notice');
      if (!raw) return;
      try {
        this.askedNotice = JSON.parse(raw) as { source: string; text: string; at: number; digits?: string };
      } catch {
        this.askedNotice = null;
      }
      this.openAskedNotice();
    });
  }

  /** The message the phone's notice was about, until its proposal is found. */
  private askedNotice: { source: string; text: string; at: number; digits?: string } | null = null;

  /**
   * Opens the proposal the notice was about: the same source (or a message
   * folded into it) and words, the nearest in time. It may not exist yet -
   * the message is read as the app opens - so this is tried again after each
   * reading until it is found.
   */
  private openAskedNotice(): void {
    const asked = this.askedNotice;
    if (!asked) return;
    // The same words first; failing that, the same source within two
    // minutes (Jose, 2026-10-09: a Rappi purchase in Didi opened the whole
    // list - an app's notice may carry its words in the title alone, and the
    // phone's notice and the kept message are not always worded alike).
    let best: { line: Line; apart: number } | null = null;
    let near: { line: Line; apart: number } | null = null;
    // Last, the same money within ten minutes from any source (Jose,
    // 2026-10-09: a Plata SMS opened nothing). The notice carries the amount
    // as the bank wrote it: digits with or without its cents.
    let sameMoney: { line: Line; apart: number } | null = null;
    const digits = Number(asked.digits ?? '');
    for (const batch of this.batches()) {
      for (const line of batch.lines) {
        if (line.proposal.source !== 'notification') continue;
        type Said = { package?: string; title?: string; text?: string; postedAt?: number };
        const read = this.read(line.proposal) as Said & { sightings?: { evidence?: Said }[] };
        const said: Said[] = [read, ...(Array.isArray(read.sightings) ? read.sightings.map(one => one?.evidence ?? {}) : [])];
        const minor = Math.abs(line.proposal.amount_minor ?? 0);
        if (digits > 0 && (minor === digits || minor === digits * 100)) {
          const apart = Math.min(...said.map(one => Math.abs((one.postedAt ?? 0) - asked.at)));
          if (apart < 10 * 60_000 && (!sameMoney || apart < sameMoney.apart)) sameMoney = { line, apart };
        }
        for (const one of said) {
          if (one.package !== asked.source) continue;
          const apart = Math.abs((one.postedAt ?? 0) - asked.at);
          const words = [one.text, one.title].map(text => sameWords(text ?? ''));
          if (words.includes(sameWords(asked.text))) {
            if (apart < 10 * 60_000 && (!best || apart < best.apart)) best = { line, apart };
          } else if (apart < 2 * 60_000 && (!near || apart < near.apart)) {
            near = { line, apart };
          }
        }
      }
    }
    best ??= near ?? sameMoney;
    if (!best) return;
    this.askedNotice = null;
    this.tapped(best.line);
    void this.router.navigate([], { relativeTo: this.route, queryParams: { notice: null }, queryParamsHandling: 'merge', replaceUrl: true });
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
      // The messages still waiting, by key, so a possible twin is named only
      // while the other one is still here to compare with.
      const waitingKeys = new Set<string>();
      for (const one of waiting) {
        const read = this.read(one);
        if (typeof read['key'] === 'string') waitingKeys.add(read['key']);
        for (const seen of this.sightingsOf(one)) waitingKeys.add(seen.key);
      }
      const waitingById = new Map(waiting.map(one => [one.id, one]));
      // The movements some proposals may repeat, read in one query rather than
      // one per proposal: every query crosses into native code on the phone.
      const maybeIds = [...new Set(waiting.map(one => one.maybe_same_as).filter((id): id is number => id !== null))];
      const alreadyById = new Map((await transactions.findByIds(maybeIds)).map(row => [row.id, row]));

      for (const proposal of waiting) {
        const account = proposal.account_id === null ? null : accountOf.get(proposal.account_id) ?? null;
        const evidence = this.evidenceOf(proposal);

        let sameAs: string | null = null;
        if (proposal.maybe_same_as !== null) {
          const already = alreadyById.get(proposal.maybe_same_as);
          if (already) {
            sameAs = this.i18n.t('review.maybeSame', {
              date: this.dayText(already.occurred_on),
              amount: formatMoney(already.amount_minor, 'COP'),
              note: already.description ?? '',
            });
          }
        }

        const other = proposal.pairs_with === null ? null : waitingById.get(proposal.pairs_with) ?? null;
        // Two banks telling one transfer are ONE row (Jose, 2026-10-08): the
        // money leaving is shown, as the transfer; the arriving half rides
        // with it and is answered with it.
        const messagePair = other !== null && proposal.source === 'notification' && other.source === 'notification'
          && other.account_id !== null && proposal.account_id !== null;
        if (messagePair && (proposal.amount_minor ?? 0) > 0) continue;
        const pairedWith = other === null ? null : messagePair ? this.i18n.t('ui.review.pairTransfer', {
          account: accountOf.get(other.account_id!)?.name ?? '',
        }) : this.i18n.t('review.pairedWith', {
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
          seenBy: messagePair
            ? this.i18n.t('ui.review.seenBy', { files: [...new Set([...this.sightingsOf(proposal), ...this.sightingsOf(other!)].map(one => one.file)
              .concat(String(this.read(other!)['file'] ?? '')).filter(Boolean))].join(' · ') })
            : this.seenByOf(proposal),
          twin: this.twinOf(proposal, waitingKeys),
          transferTo: messagePair ? other!.account_id : this.transferToOf(proposal),
          partner: messagePair ? other : null,
        });
        known.set(proposal.batch, batch);
      }

      this.batches.set([...known.values()]);
      this.openAskedNotice();
      await this.lookForDrift();
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

  /** The messages folded into this one, as each was kept. */
  private sightingsOf(proposal: MovementProposal): { key: string; file: string }[] {
    const sightings = this.read(proposal)['sightings'];
    if (!Array.isArray(sightings)) return [];
    return sightings
      .map(one => (one as { evidence?: { key?: unknown; file?: unknown } })?.evidence)
      .filter((e): e is { key: string; file: string } => typeof e?.key === 'string' && typeof e?.file === 'string');
  }

  private seenByOf(proposal: MovementProposal): string | null {
    const files = [...new Set(this.sightingsOf(proposal).map(one => one.file))];
    return files.length ? this.i18n.t('ui.review.seenBy', { files: files.join(' · ') }) : null;
  }

  private twinOf(proposal: MovementProposal, waiting: ReadonlySet<string>): string | null {
    const twin = this.read(proposal)['twin'] as { key?: unknown; file?: unknown; postedAt?: unknown } | undefined;
    if (!twin || typeof twin.key !== 'string' || typeof twin.file !== 'string' || typeof twin.postedAt !== 'number') return null;
    if (!waiting.has(twin.key)) return null;
    const time = new Date(twin.postedAt).toLocaleTimeString(this.i18n.dateLocale(), { hour: 'numeric', minute: '2-digit' });
    return this.i18n.t('ui.review.twin', { file: twin.file, time });
  }

  /** Undoes a merge of messages: each becomes a proposal of its own again. */
  async separateOpen(): Promise<void> {
    const line = this.openLine();
    if (!line || this.working()) return;
    this.working.set(true);
    try {
      await new ProposalsRepository(this.database.driver).separate(line.proposal.id);
      this.openLine.set(null);
      this.database.dataChanged();
      await this.refresh();
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : String(error));
    } finally {
      this.working.set(false);
    }
  }

  private transferToOf(proposal: MovementProposal): number | null {
    const to = this.read(proposal)['transferTo'];
    return typeof to === 'number' ? to : null;
  }

  private guessedOf(proposal: MovementProposal): boolean {
    return this.read(proposal)['confidence'] === 'low';
  }

  private titleOf(proposal: MovementProposal, account: AccountRow | null): string {
    const read = this.read(proposal);
    const where = account?.name ?? this.i18n.t('review.noAccount');
    // A message's batch is named by who sent it: the account may differ row
    // by row, and "Notificación · Sin cuenta" said nothing (2026-10-05).
    if (proposal.source === 'notification') {
      return typeof read['file'] === 'string' && read['file'] ? read['file'] as string
        : this.i18n.t('review.fromNotification', { account: where });
    }
    return this.i18n.t('ui.review.statementOf', { account: where });
  }

  /** Whether this row can be written at all, for the button that writes it. */
  ready(line: Line): boolean {
    // One learned as a transfer is saved through the form, one tap, never as
    // a spending by "Guardar los listos".
    // The two halves of a transfer between banks are written together, as
    // the transfer they are.
    return (line.transferTo === null || line.proposal.pairs_with !== null) && isComplete(line.proposal);
  }

  /**
   * The rows of a batch that can actually be written.
   *
   * "Guardar los 9 movimientos" promised nine and delivered eight, because
   * one of them had no category and the database will not take it. A button
   * that says a number has to mean that number.
   */
  readyLines(batch: Batch): Line[] {
    return this.readyByBatch().get(batch.key) ?? batch.lines.filter(line => this.ready(line));
  }

  private readonly readyByBatch = computed(() =>
    new Map(this.batches().map(batch => [batch.key,
      // A possible twin of another message waits for the person: saved with
      // the rest, one purchase would be written twice.
      batch.lines.filter(line => line.sameAs === null && line.twin === null && this.ready(line))])));

  /** How many of a batch are still waiting on something (what is already typed is not). */
  waitingOn(batch: Batch): number {
    return batch.lines.filter(line => line.sameAs === null && line.twin === null).length - this.readyLines(batch).length;
  }

  /**
   * The rows of a batch the ledger seems to hold already (Jose, 2026-10-05:
   * a bank's SMS ticked for the first time brought back everything he had
   * typed). They sit apart, folded, with one answer for all of them, and
   * "Guardar los listos" never writes them a second time.
   */
  knownIn(batch: Batch): Line[] {
    return this.shownIn(batch).filter(line => line.sameAs !== null);
  }

  readonly knownOpen = signal<ReadonlySet<string>>(new Set());

  /**
   * Each origin folds as a whole (Jose, 2026-10-05: two statements one after
   * the other read as one list). All start folded; a search opens them all.
   */
  private readonly batchState = signal<ReadonlyMap<string, boolean>>(new Map());

  isBatchOpen(batch: Batch): boolean {
    if (this.search().trim().length > 0) return true;
    return this.batchState().get(batch.key) ?? false;
  }

  toggleBatch(batch: Batch): void {
    const next = new Map(this.batchState());
    next.set(batch.key, !this.isBatchOpen(batch));
    this.batchState.set(next);
  }

  toggleKnown(batch: Batch): void {
    const next = new Set(this.knownOpen());
    if (next.has(batch.key)) next.delete(batch.key); else next.add(batch.key);
    this.knownOpen.set(next);
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
    return formatMoney(minor, currency ?? 'COP', { withSymbol: false });
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
    if (asking.kind === 'forgetOne') return this.i18n.t('review.forget.sure.one');
    if (asking.kind === 'acceptOne') return this.i18n.t('review.accept.sure', { count: 1 });
    if (asking.kind === 'square') {
      return this.i18n.t('review.square.sure', { account: this.squaring()?.accountName ?? '' });
    }
    if (asking.kind === 'leaveBalance') return this.i18n.t('review.square.leave.sure');
    if (asking.kind === 'acceptSelected') {
      return this.i18n.t('review.accept.sure', { count: this.selectedLines().length });
    }
    if (asking.kind === 'discardSelected') {
      return this.i18n.t('review.discard.sureAll', { count: this.selectedLines().length });
    }
    if (asking.kind === 'discardKnown') {
      return this.i18n.t('review.discard.sureAll', { count: this.knownIn(asking.batch).length });
    }
    if (asking.kind === 'forgetSelected') {
      const count = this.selectedLines().length;
      return count === 1 ? this.i18n.t('review.forget.sure.one') : this.i18n.t('review.forget.sure', { count });
    }
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
    if (asking.kind === 'forgetOne') return this.i18n.t('review.forget.one.body');
    if (asking.kind === 'leaveBalance') return this.i18n.t('review.square.leave.body');
    if (asking.kind === 'discardSelected') return this.i18n.t('review.discard.body');
    if (asking.kind === 'discardKnown') return this.i18n.t('ui.review.known.body');
    if (asking.kind === 'forgetSelected') return this.i18n.t('review.forget.body');
    if (asking.kind === 'acceptSelected') {
      // Ticked is not the same as ready: say which ones stay behind, and why.
      const left = this.selectedLines().length - this.selectedReady().length;
      const body = this.i18n.t('review.accept.body');
      return left === 0 ? body : `${body} ${this.i18n.t('review.select.notReady', { count: left })}`;
    }
    if (asking.kind === 'square') {
      const squaring = this.squaring();
      if (squaring === null) return '';
      // What actually changes, in the two figures it changes between: the
      // opening balance moves by the gap, and nothing else moves at all.
      const moved = asking.to - squaring.ours;
      return this.i18n.t('review.square.body', {
        from: this.money(squaring.opening, squaring.currency),
        to: this.money(squaring.opening + moved, squaring.currency),
        balance: this.money(asking.to, squaring.currency),
        date: this.dayText(squaring.day),
      });
    }
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
    if (asking.kind === 'leaveBalance') return this.i18n.t('review.square.leave.do');
    if (asking.kind === 'forgetOne') return this.i18n.t('review.forget.one.do');
    const kind = asking.kind === 'discardOne' || asking.kind === 'discardSelected' || asking.kind === 'discardKnown' ? 'discard'
      : asking.kind === 'acceptOne' || asking.kind === 'acceptSelected' ? 'accept'
      : asking.kind === 'forgetSelected' ? 'forget'
      : asking.kind;
    return this.i18n.t(`review.${kind}.do`);
  }

  askIcon(): string {
    const kind = this.asking()?.kind;
    if (kind === 'square') return 'swap-vertical-outline';
    if (kind === 'leaveBalance') return 'remove-circle-outline';
    if (kind === 'accept' || kind === 'acceptOne' || kind === 'acceptSelected') return 'checkmark-done-outline';
    // Undoing the import destroys nothing, so it is not a bin: it is the same
    // arrow the button that opened it carries.
    if (kind === 'forget' || kind === 'forgetSelected' || kind === 'forgetOne') return 'eye-off-outline';
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
    if (kind === 'accept' || kind === 'acceptOne' || kind === 'acceptSelected' || kind === 'square') {
      return 'primary';
    }
    if (kind === 'leaveBalance') return 'medium';
    if (kind === 'forget' || kind === 'forgetSelected' || kind === 'forgetOne') return 'medium';
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
    } else if (asking.kind === 'acceptSelected') {
      await this.write(this.selectedLines().map(line => line.proposal));
      // What could not be saved stays ticked, so it is plain what is left.
      if (this.selectedLines().length === 0) this.stopSelecting();
    } else if (asking.kind === 'discardSelected') {
      await this.rejectSelected();
      this.stopSelecting();
    } else if (asking.kind === 'discard') {
      await this.rejectAll(asking.batch);
    } else if (asking.kind === 'forgetSelected') {
      this.working.set(true);
      try {
        await new ProposalsRepository(this.database.driver).forgetThese(this.selectedLines().map(line => line.proposal.id));
        this.database.dataChanged();
        this.stopSelecting();
        await this.refresh();
      } finally {
        this.working.set(false);
      }
    } else if (asking.kind === 'forgetOne') {
      this.closeAnswered(asking.line);
      this.working.set(true);
      try {
        await new ProposalsRepository(this.database.driver).forgetThese([asking.line.proposal.id]);
        this.database.dataChanged();
        await this.refresh();
      } finally {
        this.working.set(false);
      }
    } else if (asking.kind === 'discardKnown') {
      await this.rejectLines(this.knownIn(asking.batch));
    } else if (asking.kind === 'square') {
      await this.square(asking.to);
    } else if (asking.kind === 'leaveBalance') {
      this.squaring.set(null);
      this.statements.lastImport.set(null);
    } else if (asking.kind === 'discardOne') {
      this.closeAnswered(asking.line);
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
      // The count on Más and the dot on the bar read it too.
      this.database.dataChanged();
      await this.refresh();
    } finally {
      this.working.set(false);
    }
  }

  private async rejectSelected(): Promise<void> {
    this.working.set(true);
    try {
      await new ProposalsRepository(this.database.driver)
        .rejectThese(this.selectedLines().map(line => line.proposal.id));
      // The count on Más and the dot on the bar read it too.
      this.database.dataChanged();
      await this.refresh();
    } finally {
      this.working.set(false);
    }
  }

  private async rejectLines(lines: readonly Line[]): Promise<void> {
    this.working.set(true);
    try {
      await new ProposalsRepository(this.database.driver).rejectThese(lines.map(line => line.proposal.id));
      this.database.dataChanged();
      await this.refresh();
    } finally {
      this.working.set(false);
    }
  }

  private async rejectAll(batch: Batch): Promise<void> {
    this.working.set(true);
    try {
      // One statement for the whole batch: on the phone each call crosses
      // the bridge, and fifty of them were fifty crossings.
      await new ProposalsRepository(this.database.driver)
        .rejectThese(batch.lines.map(line => line.proposal.id));
      // The count on Más and the dot on the bar read it too.
      this.database.dataChanged();
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
      // The count on Más and the dot on the bar read it too.
      this.database.dataChanged();
      await this.refresh();
    } finally {
      this.working.set(false);
    }
  }
}

interface StatementCheck { off: boolean; opening: number; closing: number; read: number; offBy: number }

const CHECKS_KEY = 'finance.statementChecks';

function loadChecks(): Record<string, StatementCheck> {
  try { return JSON.parse(localStorage.getItem(CHECKS_KEY) ?? '{}') ?? {}; } catch { return {}; }
}

/** Text compared as words: spaces and line breaks of any kind count as one. */
function sameWords(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}
