/**
 * The screen the app opens on: where the money went, in the period and account
 * you are asking about.
 *
 * The donut and the list are two views of one thing, not two screens. The
 * control beside the balance swaps between them, which is how the app Jose
 * used before does it
 * and why it feels quick.
 */

import { Component, ElementRef, computed, inject, signal, effect, untracked, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { Keyboard } from '@capacitor/keyboard';
import { IonContent, IonHeader, IonIcon, IonSpinner } from '@ionic/angular';
import { addIcons } from 'ionicons';
import * as allIcons from 'ionicons/icons';

import { DatabaseService } from '../../core/database/database.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { FilterService } from '../../core/filters/filter.service';
import {
  PERIOD_KINDS, periodLabel, includesToday, rangePeriod, monthName,
} from '../../core/filters/period';
import { MovementsStore } from './movements.store';
import { SpendingChartComponent } from './spending-chart.component';
import { MoneyPipe } from '../../shared/money.pipe';
import { SwipeDirective } from '../../shared/swipe.directive';
import type { EntryKind } from '../entry/entry.component';
import type { Flow, Grouping, Movement, MovementGroup } from './group-movements';
import type { AccountRow, TransactionRow } from '../../core/database/types';
import { ScopeSheetsComponent } from '../../shared/scope/scope-sheets.component';
import { outlined } from '../../core/icons/icon-catalog';
import { CustomIconsService } from '../../core/icons/custom-icons.service';
import { todayIso } from '../../core/yields/days';
import { YieldsRepository } from '../../core/database/repositories/yields.repository';
import { ComposeService } from '../../core/ui/compose.service';
import { AccentService } from '../../core/theme/accent.service';
import { formatMoney } from '../../core/database/money';
import { BadgeComponent } from '../../shared/ui/badge.component';
import type { Standing } from './movements.store';
import { MOVE_COLOR } from '../../core/theme/palette';

@Component({
  selector: 'app-movements',
  templateUrl: './movements.page.html',
  styleUrls: ['./movements.page.scss'],
  imports: [
    CommonModule, FormsModule, MoneyPipe, SpendingChartComponent, SwipeDirective, BadgeComponent,
    TranslatePipe, ScopeSheetsComponent,
    IonContent, IonHeader, IonIcon, IonSpinner,
  ],
})
export class MovementsPage {
  /** A transfer's own blue, whatever the accent. */
  readonly MOVE = MOVE_COLOR;

  readonly filter = inject(FilterService);
  readonly store = inject(MovementsStore);
  readonly database = inject(DatabaseService);
  readonly i18n = inject(I18nService);

  readonly status = this.database.status;
  readonly periodKinds = PERIOD_KINDS;

  private readonly compose = inject(ComposeService);
  private readonly accent = inject(AccentService);
  private readonly router = inject(Router);

  /**
   * The accounts that earn - the ones the products screen lists - so the
   * piggy bank beside the balance only appears where it leads somewhere.
   * Read again whenever the data moves: enrolling an account is a change.
   */
  readonly earning = signal<ReadonlySet<number>>(new Set());

  private readonly earningWatch = effect(() => {
    this.database.dataVersion();
    if (this.database.status() !== 'ready') return;
    void untracked(async () => {
      const enrolled = await new YieldsRepository(this.database.driver).accounts();
      this.earning.set(new Set(enrolled.map(entry => entry.account_id)));
    });
  });

  /** Straight into this account's yields, its sheet already open. */
  async toProducts(accountId: number): Promise<void> {
    await this.router.navigate(['/products'], { queryParams: { account: accountId } });
  }

  /** The three ways of reading the list, each with its ordering settled. */
  readonly views: { id: Grouping; label: string; icon: string }[] = [
    { id: 'date', label: 'summary.view.date', icon: 'calendar-outline' },
    { id: 'category', label: 'summary.view.category', icon: 'pie-chart-outline' },
    { id: 'largest', label: 'summary.view.largest', icon: 'trending-down-outline' },
  ];


  /** Icon names arrive with or without their suffix; this settles it. */
  readonly outlined = outlined;

  /** Today, so a picker opens somewhere useful rather than in 1970. */
  readonly today = todayIso();

  readonly label = computed(() => {
    const text = periodLabel(this.filter.period(), this.i18n.dateLocale(), this.i18n.t('period.all'));
    return text.charAt(0).toUpperCase() + text.slice(1);
  });
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
  private readonly searchRow = viewChild<ElementRef<HTMLElement>>('searchRow');

  /**
   * True while the search is being typed into. The keyboard takes half the
   * screen, so the compose bar steps aside and the search scrolls to the top
   * of what is left, with its results under it (Jose, 2026-09-24).
   */
  readonly searching = signal(false);

  /**
   * The keyboard going away ends the search however it went - Android's back
   * button closes it without taking the focus off the field, which would
   * leave the compose bar hidden until something else was tapped.
   */
  private keyboardClosed: { remove: () => Promise<void> } | null = null;

  private listenForKeyboard(): void {
    if (!Capacitor.isNativePlatform()) return;
    void Keyboard.addListener('keyboardDidHide', () => {
      if (!this.searching()) return;
      (document.activeElement as HTMLElement | null)?.blur();
      this.searching.set(false);
    }).then(handle => { this.keyboardClosed = handle; });
  }

  ngOnDestroy(): void {
    void this.keyboardClosed?.remove();
  }

  async startSearching(): Promise<void> {
    this.searching.set(true);
    const row = this.searchRow()?.nativeElement;
    const content = this.content();
    if (!row || !content) return;
    // After the keyboard has taken its room, or the target moves under it.
    await new Promise(resolve => setTimeout(resolve, 300));
    await content.scrollToPoint(0, Math.max(row.offsetTop - 8, 0), 250);
  }

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
  readonly scrollable = computed(() => this.status() === 'ready');

  /**
   * The floating fold control.
   *
   * Absent at the top, because the list's own fold button is sitting there in
   * plain sight and two controls for one job is one too many.
   */
  readonly showFold = computed(() => this.scrollable() && !this.atTop());

  readonly showJumpUp = computed(() => this.scrollable() && !this.atTop());

  readonly showJumpDown = computed(() => this.scrollable() && !this.atBottom());

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
      const products = this.productCounts().get(account.id) ?? 0;
      if (products > 1) parts.push(this.i18n.t('ui.count.products', { count: products }).toLowerCase());
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

  constructor() {
    this.listenForKeyboard();

    // The list changed size without a scroll: read the position again, or
    // the arrow down would wait for the first scroll to appear.
    effect(() => {
      this.shownGroups();
      this.filter.showList();
      this.store.standing();
      setTimeout(() => void this.measure(), 60);
      setTimeout(() => void this.measure(), 600);
    });
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

  private dayLabel(iso: string): string {
    const [year, month, day] = iso.split('-').map(Number);
    return `${day} ${monthName(new Date(year, month - 1, day), this.i18n.dateLocale())} ${year}`;
  }

  /** A flick left or right steps the period, when the period can step. */
  onSwipe(steps: number): void {
    if (this.canStep() && (steps < 0 || !this.atNewest())) {
      this.filter.step(steps);
    }
  }

  add(kind: EntryKind): void {
    this.compose.open(kind);
  }

  /**
   * Opens a movement for correction. Either leg of a transfer opens the whole
   * transfer - both accounts and both amounts - because that is the act that
   * was recorded (ComposeService.edit).
   */
  edit(transaction: TransactionRow): void {
    this.compose.edit(transaction);
  }

  // ---- The redesign's drawing (mockups 1a-1r) ---------------------------

  readonly accentColor = computed(() => this.accent.accent().color);

  /** How many products each account holds, for "COP · 3 productos". */
  readonly productCounts = signal<ReadonlyMap<number, number>>(new Map());

  private readonly productWatch = effect(() => {
    this.database.dataVersion();
    if (this.database.status() !== 'ready') return;
    void untracked(async () => {
      const rows = await this.database.driver.query<{ account_id: number; n: number }>(
        'SELECT account_id, COUNT(*) AS n FROM products GROUP BY account_id');
      this.productCounts.set(new Map(rows.map(row => [row.account_id, row.n])));
    });
  });

  /**
   * The small figures on the card: Entró and Salió, and in the accent,
   * Recibido and Enviado from and to one's own accounts - each only when it
   * holds something, and one left alone sits in the middle (mockup 1q).
   * Across every account Entró and Salió are always there.
   */
  readonly tiles = computed(() => {
    const totals = this.store.totals();
    const all = this.filter.allAccounts();
    const tiles: { key: string; label: string; amount: number; tone: string; transfer: boolean }[] = [];
    const keepIn = all || totals.inMinor > 0 || totals.outMinor === 0;
    const keepOut = all || totals.outMinor > 0 || totals.inMinor === 0;
    if (keepIn) tiles.push({ key: 'in', label: this.i18n.t('summary.in'), amount: totals.inMinor, tone: 'ui-g', transfer: false });
    if (keepOut) tiles.push({ key: 'out', label: this.i18n.t('summary.out'), amount: totals.outMinor, tone: 'ui-r', transfer: false });
    if (!all && totals.receivedMinor > 0) {
      tiles.push({ key: 'received', label: this.i18n.t('summary.received'), amount: totals.receivedMinor, tone: 'ui-t', transfer: true });
    }
    if (!all && totals.movedMinor > 0) {
      tiles.push({ key: 'sent', label: this.i18n.t('ui.sent'), amount: totals.movedMinor, tone: 'ui-t', transfer: true });
    }
    return tiles;
  });

  /** How much of a card's limit the debt takes, for the bar under it. */
  usedShare(standing: Standing): number | null {
    const limit = standing.limitMinor ?? null;
    if (!limit || limit <= 0) return null;
    return Math.min(100, Math.max(2, Math.round(Math.abs(Math.min(standing.amountMinor, 0)) / limit * 100)));
  }

  toggle(key: string): void {
    this.store.toggleGroup(key);
    setTimeout(() => void this.measure(), 0);
  }

  countOf(count: number): string {
    return count === 1 ? this.i18n.t('ui.count.movement') : this.i18n.t('ui.count.movements', { count });
  }

  /** A figure with its sign: "+768.000,00", "−32.000,00". */
  signed(minor: number, currency = this.store.currency()): string {
    const text = formatMoney(Math.abs(minor), currency, { withSymbol: false });
    if (minor > 0) return `+${text}`;
    if (minor < 0) return `\u2212${text}`;
    return text;
  }

  toneOf(flow: Flow): string {
    if (flow === 'in') return 'ui-g';
    if (flow === 'out' || flow === 'refund') return 'ui-r';
    return 'ui-t';
  }

  groupColor(group: MovementGroup): string | null {
    return group.movements[0]?.color ?? null;
  }

  groupSeed(group: MovementGroup): number | null {
    return group.movements[0]?.seed ?? null;
  }

  /**
   * The grey line under a movement: whatever its title does not already say.
   * A transfer says where it went ("Cuenta de ahorros → Tarjeta Coral") or
   * where it came from ("Desde Ahorro Verde · Cuenta de ahorros").
   */
  lineOf(movement: Movement): string {
    const t = movement.transaction;
    const all = this.filter.allAccounts();
    const parts: string[] = [];
    if (t.transfer_id !== null) {
      const here = movement.productName ?? movement.accountName;
      if (t.amount_minor < 0) {
        parts.push(`${here} \u2192 ${movement.otherName ?? movement.label}`);
      } else {
        parts.push(t.description ? movement.label : movement.accountName);
        if (movement.productName) parts.push(movement.productName);
      }
    } else {
      if (this.filter.grouping() === 'category') {
        parts.push(this.dayHeading(t.occurred_on));
        if (all) parts.push(movement.accountName);
      } else {
        if (t.description) parts.push(movement.label);
        if (all || !t.description) parts.push(movement.accountName);
        if (movement.productName) parts.push(movement.productName);
      }
      if (this.filter.grouping() === 'largest') parts.push(this.dayHeading(t.occurred_on));
    }
    if (t.locked) parts.push(this.i18n.t('ui.row.corrected'));
    return parts.join(' · ');
  }

  /**
   * A day as a heading: "Hoy · domingo 27", "Viernes 25"; the month joins it
   * when the period runs over more than one, and the year when it is not
   * this one.
   */
  dayHeading(iso: string): string {
    const [year, month, day] = iso.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    const locale = this.i18n.dateLocale();
    const weekday = date.toLocaleDateString(locale, { weekday: 'long' });
    const period = this.filter.period();
    const oneMonth = period.from !== null && period.to !== null && period.from.slice(0, 7) === period.to.slice(0, 7);
    let text = `${weekday} ${day}`;
    if (!oneMonth) text += locale.startsWith('es') ? ` de ${monthName(date, locale)}` : ` ${monthName(date, locale)}`;
    if (year !== new Date().getFullYear()) text += ` ${year}`;
    const today = this.today;
    const yesterday = shiftDay(today, -1);
    if (iso === today) return this.i18n.t('ui.today.day', { day: text });
    if (iso === yesterday) return this.i18n.t('ui.yesterday.day', { day: text });
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  /** "septiembre": the period, short, for the search's hint. */
  readonly shortLabel = computed(() => {
    const period = this.filter.period();
    return period.kind === 'month' ? this.label().split(' ')[0].toLowerCase() : this.label();
  });
}

function shiftDay(iso: string, days: number): string {
  const [year, month, day] = iso.split('-').map(Number);
  const date = new Date(year, month - 1, day + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** Today as an ISO day, in local time. */

