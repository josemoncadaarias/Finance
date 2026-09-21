/**
 * The screen the app opens on: where the money went, in the period and account
 * you are asking about.
 *
 * The donut and the list are two views of one thing, not two screens. The
 * control beside the balance swaps between them, which is how Monefy does it
 * and why it feels quick.
 */

import { Component, computed, inject, signal, effect, untracked, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonContent, IonHeader, IonToolbar, IonButton, IonButtons, IonIcon,
  IonList, IonItem, IonLabel, IonNote, IonSpinner, IonModal, IonSearchbar,
  IonToggle, IonBadge, IonRadio, IonRadioGroup, IonDatetime, IonFooter, IonMenuButton,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import * as allIcons from 'ionicons/icons';

import { DatabaseService } from '../../core/database/database.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { LanguageButtonComponent } from '../../core/i18n/language-button.component';
import { CloudButtonComponent } from '../../core/cloud/cloud-button.component';
import { FilterService } from '../../core/filters/filter.service';
import {
  PERIOD_KINDS, periodLabel, includesToday, rangePeriod, monthName,
} from '../../core/filters/period';
import { MovementsStore } from './movements.store';
import { DonutComponent } from './donut.component';
import { MoneyPipe } from '../../shared/money.pipe';
import { SwipeDirective } from '../../shared/swipe.directive';
import { EntryComponent, type EntryKind, type EntryRequest } from '../entry/entry.component';
import type { Grouping } from './group-movements';
import type { AccountRow, TransactionRow } from '../../core/database/types';
import { AccountEditorComponent } from '../accounts/account-editor.component';
import { outlined } from '../../core/icons/icon-catalog';
import { CustomIconsService } from '../../core/icons/custom-icons.service';
import { IconComponent } from '../../core/icons/icon.component';
import { todayIso } from '../../core/yields/days';
import { reportWorkbook, reportFileName } from '../../core/report/report-workbook';
import { reportWords } from '../../core/report/report-words';
import type { ReportData } from '../../core/report/report-data';
import { saveFile } from '../../core/files/save-file';
import { XLSX_MIME } from '../../core/xlsx/xlsx-writer';

@Component({
  selector: 'app-movements',
  templateUrl: './movements.page.html',
  styleUrls: ['./movements.page.scss'],
  imports: [
    IconComponent,
    CommonModule, FormsModule, MoneyPipe, DonutComponent, SwipeDirective, EntryComponent,
    TranslatePipe, LanguageButtonComponent, CloudButtonComponent, AccountEditorComponent,
    IonContent, IonHeader, IonToolbar, IonButton, IonButtons, IonIcon,
    IonList, IonItem, IonLabel, IonNote, IonSpinner, IonModal, IonSearchbar,
    IonToggle, IonBadge, IonRadio, IonRadioGroup, IonDatetime, IonFooter, IonMenuButton,
  ],
})
export class MovementsPage {
  readonly filter = inject(FilterService);
  readonly store = inject(MovementsStore);
  readonly database = inject(DatabaseService);
  readonly i18n = inject(I18nService);

  readonly status = this.database.status;
  readonly periodKinds = PERIOD_KINDS;

  /** The three ways of reading the list, each with its ordering settled. */
  readonly views: { id: Grouping; label: string; icon: string }[] = [
    { id: 'date', label: 'summary.view.date', icon: 'calendar-outline' },
    { id: 'category', label: 'summary.view.category', icon: 'pie-chart-outline' },
    { id: 'largest', label: 'summary.view.largest', icon: 'trending-down-outline' },
  ];

  readonly showPeriodSheet = signal(false);
  readonly showAccountSheet = signal(false);
  readonly showSearch = signal(false);

  /** Icon names arrive with or without their suffix; this settles it. */
  readonly outlined = outlined;

  /** Non-null while the entry screen is open, describing what it is editing. */
  readonly entry = signal<EntryRequest | null>(null);

  /** Non-null while an account is being edited from this screen. */
  readonly editingAccount = signal<AccountRow | null>(null);
  /**
   * Whether the two date pickers are showing.
   *
   * Its own state, not read from the period. The period only becomes a range
   * once both dates exist, so keying the pickers off `period().kind === 'range'`
   * meant they appeared only after they had already been used — which is to
   * say never. That was the bug: picking "entre dos fechas" did nothing at all.
   */
  readonly choosingRange = signal(false);

  /** Which end of the range the calendar is setting. One at a time. */
  readonly rangeSide = signal<'from' | 'to'>('from');

  readonly rangeStart = signal<string | null>(null);
  readonly rangeEnd = signal<string | null>(null);

  /** Today, so a picker opens somewhere useful rather than in 1970. */
  readonly today = todayIso();

  readonly label = computed(() =>
    periodLabel(this.filter.period(), this.i18n.dateLocale(), this.i18n.t('period.all')));
  readonly atNewest = computed(() => includesToday(this.filter.period()));
  readonly canStep = computed(() => {
    const kind = this.filter.period().kind;
    return kind !== 'all' && kind !== 'range';
  });

  readonly accountLabel = computed(() =>
    this.store.selectedAccount()?.name ?? this.i18n.t('summary.allAccounts'));

  /**
   * The icon standing for what is on screen: the account's own, or the wallet
   * that means all of them.
   *
   * A screen that shows one account's money and one that shows everything look
   * identical otherwise, and the difference changes what every figure below
   * means.
   */
  readonly customIcons = inject(CustomIconsService);

  /**
   * The image the selected account wears, when it wears one.
   *
   * An account can carry a real bank logo instead of a built-in icon, and
   * this screen drew the built-in one regardless - so every account given
   * a logo showed the wrong picture here while showing the right one on
   * the accounts screen.
   */
  readonly accountImage = computed(() =>
    this.customIcons.urlFor(this.store.selectedAccount()?.custom_icon_id));

  readonly accountIcon = computed(() =>
    this.store.selectedAccount()?.builtin_icon ?? 'albums-outline');

  /**
   * Where in the list the reader is: hard against the top, hard against the
   * bottom, or somewhere between.
   *
   * Both true at once is not a contradiction - it is a list that fits on the
   * screen, and the honest answer there is to show no jump controls at all.
   */
  private readonly atTop = signal(true);
  private readonly atBottom = signal(true);

  // Named, not just "the first ion-content": the two modals below carry one
  // each, and a query by type would start matching whichever opened.
  private readonly content = viewChild<IonContent>('list');

  /**
   * Re-reads the position.
   *
   * `ionScroll` fires on every frame of a drag, so this writes a signal only
   * when one of the two answers actually changes - otherwise the whole list
   * would redraw while it is moving, which is the one moment that has to stay
   * cheap. Reading `scrollHeight` is a layout read, but on a windowed list
   * that is a hundred and fifty rows, not four thousand.
   *
   * The 4px slack is for fractional device pixels: on a 2.75x screen the
   * bottom of a scroller is rarely a whole number, and without it the "go
   * down" button never quite goes away.
   */
  private async measure(): Promise<void> {
    const content = this.content();
    if (!content) return;

    const element = await content.getScrollElement();
    const top = element.scrollTop <= 4;
    const bottom = element.scrollTop + element.clientHeight >= element.scrollHeight - 4;

    if (top !== this.atTop()) this.atTop.set(top);
    if (bottom !== this.atBottom()) this.atBottom.set(bottom);
  }

  onScroll(): void {
    void this.measure();
  }

  async toTop(): Promise<void> {
    await this.content()?.scrollToTop(300);
    await this.measure();
  }

  async toBottom(): Promise<void> {
    await this.content()?.scrollToBottom(300);
    await this.measure();
  }

  /**
   * Folding changes how tall the list is, and no scroll event says so, so the
   * position is re-read afterwards - otherwise closing everything while at the
   * bottom leaves a "go down" button pointing at nothing.
   */
  foldAll(): void {
    this.store.toggleAll();
    setTimeout(() => void this.measure(), 0);
  }

  /** True when the list is long enough for any of this to be worth showing. */
  readonly scrollable = computed(() =>
    this.filter.showList()
    && this.filter.grouping() !== 'largest'
    && this.store.groups().length > 1);

  /**
   * The floating fold control.
   *
   * Absent at the top, because the list's own fold button is sitting there in
   * plain sight and two controls for one job is one too many.
   */
  readonly showFold = computed(() => this.scrollable() && !this.atTop());

  readonly showJumpUp = computed(() => this.scrollable() && !this.atTop());

  readonly showJumpDown = computed(() => this.scrollable() && !this.atBottom());

  /**
   * Opens the account sheet with the selected row already on screen.
   *
   * Marking it is not enough on its own: with twenty accounts the mark can be
   * three screens down, and a list that has to be searched for the answer is
   * the same problem as no answer. Waiting for `didPresent` matters - during
   * the animation the row has no final position to scroll to.
   */
  revealSelectedAccount(): void {
    const id = this.filter.accountId();
    const row = document.getElementById(`account-option-${id ?? 'all'}`);
    row?.scrollIntoView({ block: 'center' });
  }

  /** The image a category wears, for a group heading. */
  iconUrl(id: number | null): string | undefined {
    return this.customIcons.urlFor(id);
  }

  /** The line under the name: which currency, or how many accounts are in. */
  readonly accountHint = computed(() => {
    const account = this.store.selectedAccount();
    if (account) {
      const parts = [account.currency_code];
      if (account.type === 'credit') parts.push(this.i18n.t('summary.creditCard'));
      if (!account.include_in_net_worth) parts.push(this.i18n.t('summary.setAside'));
      if (account.archived) parts.push(this.i18n.t('summary.archived'));
      return parts.join(' · ');
    }

    const counted = this.store.accounts()
      .filter(a => !a.archived && (this.filter.includeExcluded() || a.include_in_net_worth === 1))
      .length;
    const hidden = this.filter.includeExcluded() ? 0 : this.store.hiddenCount();

    return hidden === 0
      ? this.i18n.t('summary.accountsCounted', { count: counted })
      : this.i18n.t('summary.accountsWithHidden', { count: counted, hidden });
  });

  /** Selectable accounts: everything, since a single pick ignores the flags. */
  readonly selectable = computed(() =>
    [...this.store.accounts()].sort((a, b) => {
      if (a.archived !== b.archived) return a.archived - b.archived;
      return a.name.localeCompare(b.name);
    }),
  );

  constructor() {
    // Account and category icons come from the user's data, so which names
    // are needed is not known until runtime. Ionicons draws nothing for a name
    // it was never given - which is exactly why the two main buttons rendered
    // as empty circles.
    addIcons(allIcons as unknown as Record<string, string>);

    // The images accounts wear. Loaded here rather than left to whichever
    // screen happens to have loaded them already: an account with a bank logo
    // was drawing a built-in icon on this screen and the right logo on the
    // accounts one, which is the kind of difference nobody reports as a bug -
    // they just stop trusting the header.
    effect(() => {
      this.database.dataVersion();
      if (this.database.status() === 'ready') void this.customIcons.load();
    });

    // A new question deserves a fresh budget: the pause this avoids is the
    // one before the first rows appear, and that happens again every time
    // the account, the period, the grouping or the search changes.
    effect(() => {
      this.filter.accountId();
      this.filter.period();
      this.filter.grouping();
      this.filter.search();
      this.filter.categoryFilter();
      untracked(() => {
        this.rowBudget.set(MovementsPage.ROW_BUDGET);
        this.groupRows.set(new Map());
      });
    });
  }

  /**
   * How many rows the list is willing to draw at once.
   *
   * Neither the query nor the grouping is what makes a long list slow: eight
   * hundred movements group in under a millisecond. What costs is building
   * eight hundred Ionic components, each a custom element with its own shadow
   * DOM - which is why a year of a credit card stuttered for a second or two
   * before anything appeared.
   *
   * So the list draws whole groups until it has drawn about this many rows,
   * and offers the rest. A budget rather than a page: cutting a group in half
   * would put a heading on screen with a fraction of its movements under it,
   * and the total beside that heading would stop matching what is below it.
   */
  private static readonly ROW_BUDGET = 150;

  readonly rowBudget = signal(MovementsPage.ROW_BUDGET);

  /** The groups actually drawn: whole ones, up to the budget. */
  readonly shownGroups = computed(() => {
    const groups = this.store.groups();
    const budget = this.rowBudget();

    // Headings are cheap and rows are not, so an open group is what counts
    // against the budget. Closed ones cost a single row each.
    const shown = [];
    let rows = 0;
    for (const group of groups) {
      if (shown.length > 0 && rows >= budget) break;
      shown.push(group);
      rows += this.store.isCollapsed(group.key)
        ? 1
        : Math.min(group.movements.length, MovementsPage.GROUP_ROWS);
    }
    return shown;
  });

  /** Movements waiting behind the button, so it can say how many. */
  readonly hiddenGroups = computed(() =>
    this.store.groups().length - this.shownGroups().length);

  showMore(): void {
    this.rowBudget.update(budget => budget + MovementsPage.ROW_BUDGET * 2);
  }

  /**
   * How much of each opened group is drawn.
   *
   * The outer budget counts whole groups, which is right until a single
   * group is enormous - "everything, by category" puts four thousand
   * movements under one heading, and drawing them to honour "at least one
   * group" is the hang it was meant to prevent. A group is windowed too.
   */
  private static readonly GROUP_ROWS = 60;

  private readonly groupRows = signal<ReadonlyMap<string, number>>(new Map());

  rowsShownIn(key: string): number {
    return this.groupRows().get(key) ?? MovementsPage.GROUP_ROWS;
  }

  showMoreIn(key: string): void {
    this.groupRows.update(current => {
      const next = new Map(current);
      next.set(key, this.rowsShownIn(key) + MovementsPage.GROUP_ROWS * 3);
      return next;
    });
  }
  setGrouping(grouping: Grouping): void {
    this.filter.setView(grouping);
  }

  /** Says what the ordering inside each group is, so it is never a guess. */
  withinNote(): string {
    return this.i18n.t(this.filter.grouping() === 'category'
      ? 'summary.within.category'
      : 'summary.within.date');
  }

  choosePeriod(kind: string): void {
    if (kind === 'range') {
      // The sheet stays open: a range needs two dates before it means
      // anything, and closing would throw away the half-made choice. Seed the
      // two pickers with the period on screen, so "between two dates" starts
      // from what is already being looked at instead of from nothing.
      const current = this.filter.period();
      this.rangeStart.set(this.rangeStart() ?? current.from ?? this.today);
      this.rangeEnd.set(this.rangeEnd() ?? current.to ?? this.today);
      this.choosingRange.set(true);
      return;
    }

    this.choosingRange.set(false);
    this.filter.setPeriodKind(kind as never);
    this.showPeriodSheet.set(false);
  }

  applyRange(): void {
    const from = this.rangeStart();
    const to = this.rangeEnd();
    if (!from || !to) return;

    // Picked back to front is a legitimate mistake, and swapping is friendlier
    // than refusing: an empty range would just look broken.
    const [start, end] = [from.slice(0, 10), to.slice(0, 10)].sort();

    this.filter.period.set(rangePeriod(start, end));
    this.choosingRange.set(false);
    this.showPeriodSheet.set(false);
  }

  /** One end of the range, as it reads on its button. */
  dayShown(iso: string | null): string {
    return iso ? this.dayLabel(iso.slice(0, 10)) : '—';
  }

  /** The range as it currently stands, for the button that applies it. */
  rangeLabel(): string {
    const from = this.rangeStart();
    const to = this.rangeEnd();
    if (!from || !to) return '';

    const [start, end] = [from.slice(0, 10), to.slice(0, 10)].sort();
    return `${this.dayLabel(start)} – ${this.dayLabel(end)}`;
  }

  private dayLabel(iso: string): string {
    const [year, month, day] = iso.split('-').map(Number);
    return `${day} ${monthName(new Date(year, month - 1, day), this.i18n.dateLocale())} ${year}`;
  }

  // -------------------------------------------------------------------------
  // The financial summary
  // -------------------------------------------------------------------------

  /** Set while the file is being written, which is a moment on a long period. */
  readonly exporting = signal(false);
  /** What happened, said once under the button rather than in an alert. */
  readonly exportNotice = signal('');

  /**
   * The period on screen, as a spreadsheet.
   *
   * Everything it reports on is already here - the dates, the account, the
   * movements the donut adds up - so it asks nothing. What it must NOT do is
   * ask the database again: a second query would be a second way of getting
   * the same figures, and the day the two disagreed by a peso neither would
   * be believed.
   */
  async exportSummary(): Promise<void> {
    const movements = this.store.inScope();
    if (movements.length === 0) {
      this.exportNotice.set(this.i18n.t('report.nothing'));
      return;
    }

    this.exporting.set(true);
    this.exportNotice.set('');
    // One turn of the event loop, so the button shows it is working before
    // the writing blocks it.
    await new Promise(resolve => setTimeout(resolve));

    try {
      const data: ReportData = {
        period: this.filter.period(),
        periodLabel: this.label(),
        account: this.store.selectedAccount(),
        accounts: this.store.accounts(),
        movements,
        basis: this.store.basis(),
        currency: this.store.currency(),
        today: todayIso(),
        words: reportWords(key => this.i18n.t(key)),
      };

      const name = reportFileName(data);
      const saved = await saveFile(new Blob([reportWorkbook(data)], { type: XLSX_MIME }), name);
      if (saved) this.exportNotice.set(this.i18n.t('report.saved', { file: name }));
    } catch (error) {
      this.exportNotice.set(error instanceof Error ? error.message : String(error));
    } finally {
      this.exporting.set(false);
    }
  }

  editAccount(account: AccountRow): void {
    this.showAccountSheet.set(false);
    this.editingAccount.set(account);
  }

  onAccountSaved(): void {
    this.editingAccount.set(null);
  }

  pickAccount(id: number | null): void {
    this.filter.selectAccount(id);
    this.showAccountSheet.set(false);
  }

  /** A flick left or right steps the period, when the period can step. */
  onSwipe(steps: number): void {
    if (this.canStep() && (steps < 0 || !this.atNewest())) {
      this.filter.step(steps);
    }
  }

  add(kind: EntryKind): void {
    this.entry.set({ kind, preferredAccountId: this.filter.accountId() });
  }

  /**
   * Opens a movement for correction.
   *
   * Tapping either leg of a transfer opens the whole transfer — both accounts
   * and both amounts — because that is the act that was recorded. The entry
   * screen rewrites the two legs together; there is no way to change one side
   * on its own, which is what would leave money arriving from nowhere.
   */
  edit(transaction: TransactionRow): void {
    this.entry.set({
      kind: transaction.transfer_id !== null
        ? 'transfer'
        : transaction.amount_minor >= 0 ? 'income' : 'expense',
      editing: transaction,
    });
  }

  onSaved(): void {
    this.entry.set(null);
  }

  closeSearch(): void {
    this.filter.search.set('');
    this.showSearch.set(false);
  }
}

/** Today as an ISO day, in local time. */

