/**
 * The cushion: money earned that was never counted on.
 *
 * Deliberately its own screen and not a line on the accounts page. What is
 * here is not net worth — it is interest and cashback that accumulated on the
 * side, that the ledger never recorded, and that only becomes real money when
 * it is moved into an account on purpose. Mixing it into a balance would make
 * every total on every other screen quietly wrong.
 *
 * The screen is built around the day, because that is the unit everything else
 * is made of: the rate is applied daily, the withholding rule is written
 * against the daily interest, and a figure that disagrees with a statement is
 * always wrong on some particular day. So the day is what you can see, open,
 * and correct.
 *
 * The accrual runs by itself when the screen opens. There was a button for it
 * and it was a bad idea: nobody should have to know that a total is stale, and
 * "why is this button here" is a worse question than any it answered. It is
 * cheap — one row per account per day, about five thousand rows a year — and
 * it never rewrites a day corrected by hand.
 */

import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import {
  IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonIcon,
  IonList, IonItem, IonCheckbox, IonLabel, IonNote, IonSpinner, IonMenuButton, IonModal,
  IonInput, IonTextarea, IonSelect, IonSelectOption, IonToggle, IonBadge, IonRadio, IonRadioGroup, IonDatetime,
} from '@ionic/angular';

import { DatabaseService } from '../../core/database/database.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { BusyOverlayComponent } from '../../shared/busy-overlay.component';
import type { Progress } from '../../core/database/export/progress';
import { LanguageButtonComponent } from '../../core/i18n/language-button.component';
import { I18nService } from '../../core/i18n/i18n.service';
import { AccountsRepository } from '../../core/database/repositories/accounts.repository';
import { CategoriesRepository } from '../../core/database/repositories/categories.repository';
import { TransactionsRepository } from '../../core/database/repositories/transactions.repository';
import { TransfersRepository } from '../../core/database/repositories/transfers.repository';
import { TaxParametersRepository } from '../../core/database/repositories/tax-parameters.repository';
import {
  YieldsRepository, type CushionBalance, type CushionEntry, type YieldDay,
  type YieldPocket, type YieldRate,
} from '../../core/database/repositories/yields.repository';
import { ProductKindsRepository, type ProductKind } from '../../core/database/repositories/product-kinds.repository';
import { AccrualEngine, paidOnFor } from '../../core/yields/accrual';
import { removePocketInto } from '../../core/yields/remove-pocket';
import { accrueAllAndSettle, accrueAndSettle, cdtMaturity, cdtPreview } from '../../core/yields/cdt';
import { EA_SCALE, parsePercentToScaled, scaledPercentToString, type WithholdingRule } from '../../core/yields/yield-math';
import { addDays, endOfMonth } from '../../core/yields/days';
import { parseTypedAmountToMinor } from '../../core/database/money';
import { groupTypedAmount, typedAmountOf } from '../../core/database/typed-amount';
import type { AccountRow, CategoryRow, IsoDate } from '../../core/database/types';
import { outlined } from '../../core/icons/icon-catalog';
import { CustomIconsService } from '../../core/icons/custom-icons.service';
import { IconComponent } from '../../core/icons/icon.component';
import { todayIso } from '../../core/yields/days';
import { CushionEntryComponent, type CushionEntryRequest } from './cushion-entry.component';
import { EntryComponent, type EntryRequest } from '../entry/entry.component';
import { movementTouches, productMovements, type ProductMovement } from '../../core/yields/product-movements';
import {
  PERIOD_KINDS, currentPeriod, includesToday, periodLabel, rangePeriod, shiftPeriod, type Period, type PeriodKind,
} from '../../core/filters/period';

/** One row of the list: an enrolled account and what its cushion is worth. */
interface CushionLine {
  account: AccountRow;
  cushion: CushionBalance;
  /** The rate in force today, for the subtitle. Null when none is recorded. */
  rate: YieldRate | null;
  /** False when the account is paused: kept, shown, not accrued. */
  enabled: boolean;
  /** The pots this account is split into. Always at least one. */
  pockets: YieldPocket[];
  /** What this account earned on the most recent day worked out, all pockets. */
  lastDayMinor: number;
  /**
   * What the account is actually earning on.
   *
   * The one figure someone checks against their bank, and the screen did
   * not show it anywhere: it was only derivable by opening a day. Zero
   * when nothing has been worked out yet.
   */
  /**
   * What the last day worked out was earned on: what the products held when
   * the day before it closed.
   */
  earnsOnMinor: number;
  /**
   * What they hold now, which is what the next day will earn on - and what
   * the bank's own app shows. This is the figure of the two that answers
   * "how much of my money is earning".
   */
  earnsNextMinor: number;
  /**
   * What each product holds today, by product id.
   *
   * An account's own figure is a summary of everything inside it, so it says
   * nothing about how the parts are doing. This is the part-by-part answer:
   * how much is in each one, what a move would be taking from, and what is
   * left afterwards.
   *
   * A negative one is a product that had money taken out of the account
   * against it and never had it moved in from the product that really held it
   * — worth seeing rather than hiding, because the negative is the reminder.
   */
  heldByPocket: ReadonlyMap<number, number>;
  /** What landed in each product's balance since it was stated: paid yields, income, expenses. */
  landedByPocket: ReadonlyMap<number, number>;
  /** Of that, only what the bank paid. */
  paidYieldByPocket: ReadonlyMap<number, number>;
  /**
   * The available yield: everything the products hold, paid yields included,
   * minus what the account itself says it holds on the summary. What sits in
   * the products that the account has not counted yet, and can be cashed in.
   * The one figure shown for the account everywhere on this screen.
   */
  availableMinor: number;
}

/** One thing the bank actually hands over: a day, or a whole month. */
interface Payment {
  key: string;
  /** Each product is its own payment, as the bank's app shows them. */
  pocketId: number;
  component: string;
  payout: 'daily' | 'monthly';
  on: IsoDate;
  netMinor: number;
  withheldMinor: number;
  pending: boolean;
  days: number;
  /** The last day the payment covers, and its rate and balance - what the day list reads. */
  lastOn: IsoDate;
  rateScaled: number;
  balanceMinor: number;
}

@Component({
  selector: 'app-cushion',
  templateUrl: './cushion.page.html',
  styleUrls: ['./cushion.page.scss'],
  imports: [
    BusyOverlayComponent,
    IconComponent, CushionEntryComponent, EntryComponent,
    TranslatePipe, LanguageButtonComponent,
    IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonIcon,
    IonList, IonItem, IonCheckbox, IonLabel, IonNote, IonSpinner, IonMenuButton, IonModal,
    IonInput, IonTextarea, IonSelect, IonSelectOption, IonToggle, IonBadge, IonRadio, IonRadioGroup, IonDatetime,
  ],
})
export class CushionPage {
  readonly database = inject(DatabaseService);
  private readonly i18n = inject(I18nService);
  readonly customIcons = inject(CustomIconsService);
  readonly status = this.database.status;

  readonly lines = signal<CushionLine[]>([]);
  readonly loading = signal(false);
  readonly working = signal(false);

  /**
   * What is happening while the screen cannot be used, for the overlay.
   *
   * Working five years of yields out again takes seconds on a phone, and a
   * screen that says nothing for seconds reads as one that has crashed.
   */
  readonly busyState = signal<{ label: string; detail: string; percent: number | null } | null>(null);
  readonly error = signal('');

  /** The last day the accrual reached, across every account. */
  readonly lastAccrued = signal<IsoDate | null>(null);

  /** The account whose detail sheet is open. */
  readonly openLine = signal<CushionLine | null>(null);
  readonly openDays = signal<YieldDay[]>([]);

  /** Which form is showing inside the detail sheet. */
  readonly form = signal<'none' | 'day' | 'rate' | 'pocket'>('none');

  readonly openDay = signal<YieldDay | null>(null);
  readonly amount = signal('');
  readonly note = signal('');
  readonly onDate = signal<IsoDate>(today());
  readonly categoryId = signal<number | null>(null);
  readonly incomeCategories = signal<CategoryRow[]>([]);
  readonly saving = signal(false);

  /** The settings form, filled from the account being edited. */
  readonly withholds = signal(true);
  private editingEnabled = true;
  readonly rates = signal<YieldRate[]>([]);
  readonly editablePockets = signal<YieldPocket[]>([]);

  /** Whether the product being edited is the account's usual one. */
  readonly pocketIsDefault = signal(false);

  /**
   * The balance row on screen, when one is being corrected rather than added.
   *
   * Without it a changed date wrote a second balance beside the first, and the
   * first went on winning - so the field looked like it was ignoring what was
   * typed into it.
   */
  readonly editingBalanceId = signal<number | null>(null);

  /** The date that balance had before it was edited, to redo the days between. */
  readonly editingBalanceFrom = signal<string | null>(null);

  /**
   * What has moved through this product since the date in the form.
   *
   * Read for the date being typed, not for today. The breakdown used to show
   * the figure in the field against what the engine works out for today, and
   * those two answer different questions: with a balance dated tomorrow the
   * engine is still describing today, so "moved since that date" showed a
   * payment made the day before the date it claimed to be counting from.
   */
  readonly pocketMoved = signal(0);

  private async readPocketMoved(): Promise<void> {
    const line = this.openLine();
    const pocket = this.editingPocket();
    if (!line || !pocket) { this.pocketMoved.set(0); return; }

    const { yields } = this.repos();
    this.pocketMoved.set(await yields.movedInPocketSince(
      line.account.id, pocket.id, this.pocketFrom(), pocket.id === line.pockets[0]?.id));
  }

  /** The date field changed, so the figure under it has to follow. */
  async setPocketFrom(date: string): Promise<void> {
    this.pocketFrom.set(date);
    await this.readPocketMoved();
  }

  /** What kind of money an entry is, and where it landed. */
  /** The income or expense screen for a product's yields, while it is open. */
  readonly cushionEntry = signal<CushionEntryRequest | null>(null);

  /** Everything that has landed in the open account's cushion by hand. */
  /** The account's movements: collapsed until asked for, and read then. */
  readonly showMovements = signal(false);
  readonly movements = signal<ProductMovement[]>([]);
  readonly movementsView = signal<'date' | 'category' | 'largest'>('date');
  /** One product's movements only, or every product's when null. */
  readonly movementsPocket = signal<number | null>(null);
  /** A movement of the account being corrected on the movement screen. */
  readonly movementEdit = signal<EntryRequest | null>(null);
  /** Groups closed by hand; every group starts open, as on the summary. */
  readonly collapsedGroups = signal<ReadonlySet<string>>(new Set());
  /** The two lists under the movements, closed until asked for. */
  readonly showPayments = signal(false);
  readonly showDays = signal(false);
  /** The summary's three views, with its icons and words. */
  readonly movementViews = [
    { id: 'date', label: 'summary.view.date', icon: 'calendar-outline' },
    { id: 'category', label: 'summary.view.category', icon: 'pie-chart-outline' },
    { id: 'largest', label: 'summary.view.largest', icon: 'trending-down-outline' },
  ] as const;
  /** A withdrawal left without its movement, being asked about. */
  readonly orphanWithdrawal = signal<{ id: number; on_date: IsoDate; amount_minor: number } | null>(null);

  /** Which stretch of time the movements cover, chosen the way the summary chooses it. */
  readonly movementsPeriod = signal<Period>(currentPeriod('month'));
  readonly periodKinds = PERIOD_KINDS;
  readonly showMovementsPeriodSheet = signal(false);
  readonly choosingMovementsRange = signal(false);

  /** Which end of the range the calendar is setting. One at a time. */
  readonly movementsRangeSide = signal<'from' | 'to'>('from');
  readonly movementsRangeStart = signal<string | null>(null);
  readonly movementsRangeEnd = signal<string | null>(null);
  /** Today, so a date picker opens somewhere useful. */
  readonly todayDay = today();
  /** The date pickers' language, following the app's. */
  readonly dateLocale = computed(() => this.i18n.dateLocale());

  readonly movementsPeriodLabel = computed(() =>
    periodLabel(this.movementsPeriod(), this.i18n.dateLocale(), this.i18n.t('period.all')));
  readonly movementsAtNewest = computed(() => includesToday(this.movementsPeriod()));
  readonly movementsCanStep = computed(() => {
    const kind = this.movementsPeriod().kind;
    return kind !== 'all' && kind !== 'range';
  });

  readonly shownMovements = computed(() => {
    const pocket = this.movementsPocket();
    const { from, to } = this.movementsPeriod();
    return this.movements().filter(movement =>
      (from === null || movement.on >= from)
      && (to === null || movement.on <= to)
      && (pocket === null || movementTouches(movement, pocket)));
  });

  /** Grouped as asked: by day, by category, or one list from the largest down. */
  readonly movementGroups = computed(() => {
    const view = this.movementsView();
    const items = this.shownMovements();
    if (view === 'largest') {
      return [{
        key: 'all', title: '', totalMinor: 0, flow: 'moved' as const, icon: null, customIconId: null,
        items: [...items].sort((a, b) => Math.abs(b.amountMinor) - Math.abs(a.amountMinor)),
      }];
    }
    const groups = new Map<string, { key: string; title: string; totalMinor: number; items: ProductMovement[] }>();
    for (const movement of items) {
      const [key, title]: [string, string] = view === 'date'
        ? [movement.on, this.longDayText(movement.on)]
        : this.categoryOf(movement);
      const group = groups.get(key) ?? { key, title, totalMinor: 0, items: [] };
      group.items.push(movement);
      // A transfer between two products takes nothing out of the account.
      if (movement.type !== 'transfer') group.totalMinor += movement.amountMinor;
      groups.set(key, group);
    }
    const list = [...groups.values()].map(group => {
      const first = group.items[0];
      const categoryRow = view === 'category' && first.type === 'transaction' && first.transaction.transfer_id === null
        ? first.transaction : null;
      return {
        ...group,
        // The colour of the rule down the group, as on the summary.
        flow: (group.totalMinor > 0 ? 'in' : group.totalMinor < 0 ? 'out' : 'moved') as 'in' | 'out' | 'moved',
        icon: categoryRow?.category_icon ?? null,
        customIconId: categoryRow?.category_custom_icon_id ?? null,
        // Within a category, largest first; within a day, newest first.
        items: view === 'category'
          ? [...group.items].sort((a, b) => Math.abs(b.amountMinor) - Math.abs(a.amountMinor))
          : group.items,
      };
    });
    // By category, what took the most out comes first.
    return view === 'category' ? list.sort((a, b) => a.totalMinor - b.totalMinor) : list;
  });

  /** The pocket form. */
  readonly editingPocket = signal<YieldPocket | null>(null);
  readonly pocketName = signal('');
  readonly pocketKind = signal<YieldPocket['kind']>('high_yield');

  /**
   * Where the product being edited was opened from: the account's own screen
   * or its settings. Leaving the product goes back there - it always went to
   * the settings, which read as being thrown somewhere else for someone who
   * had tapped the product straight from the account.
   */


  /** How a high-yield product is paid, as set on the product. */
  readonly pocketPayout = signal<'daily' | 'monthly'>('daily');
  readonly pocketMonths = signal('1');
  /** A new high-yield product's first rate, typed with it. */
  readonly pocketRate = signal('');

  /** A CDT's terms, as typed. Its amount is `pocketAmount`. */
  readonly cdtOpenedOn = signal<IsoDate>(today());
  readonly cdtTerm = signal('');
  readonly cdtRate = signal('');
  readonly cdtCategory = signal<number | null>(null);
  readonly cdtInto = signal<number | null>(null);
  /** The withholding rule in force, for the preview. */
  readonly cdtRule = signal<WithholdingRule | null>(null);

  /** The product being edited's own rate history, and its spending bonus if it has one. */
  readonly pocketBaseRates = computed(() => this.rates().filter(rate =>
    rate.pocket_id === this.editingPocket()?.id && rate.requires_monthly_spend_minor === null));
  readonly pocketBonusRates = computed(() => this.rates().filter(rate =>
    rate.pocket_id === this.editingPocket()?.id && rate.requires_monthly_spend_minor !== null));

  /** The products a CDT can mature into: any other that is not itself a CDT. */
  readonly cdtTargets = computed(() => this.editablePockets().filter(pocket =>
    pocket.id !== this.editingPocket()?.id && pocket.kind !== 'cdt'));
  readonly cdtTargetName = computed(() =>
    this.cdtTargets().find(pocket => pocket.id === this.cdtInto())?.name ?? '');

  /** What the CDT being typed will pay, or null until enough of it is typed. */
  readonly cdtPreviewNow = computed(() => {
    const capital = parseOrNull(this.pocketAmount());
    const term = Number(this.cdtTerm().trim());
    const opened = this.cdtOpenedOn();
    if (capital === null || capital <= 0 || !Number.isInteger(term) || term < 1 || !opened) return null;
    let rate: number;
    try {
      rate = parsePercentToScaled(this.cdtRate());
    } catch {
      return null;
    }
    return cdtPreview({
      capitalMinor: capital, annualRateScaled: rate, openedOn: opened, termMonths: term,
      rule: this.cdtRule(), withholds: this.pocketWithholds(),
    });
  });
  readonly pocketAmount = signal('');
  readonly pocketFrom = signal<IsoDate>(today());

  /** Removing the product being edited, once asked for: where its balance goes, and how much it is. */
  readonly confirmingPocketDelete = signal(false);
  readonly pocketDeleteTo = signal<number | null>(null);
  readonly pocketDeleteHeld = signal(0);
  /** Which product becomes the usual one when the usual one is removed. */
  readonly pocketNewUsual = signal<number | null>(null);
  /** How many movements and earned days name the product being removed. */
  readonly pocketDeleteHistory = signal(0);

  /**
   * Where a new product's money comes from: out of another product, which is
   * nearly always the truth now that products exist, or typed in by hand, as
   * an adjustment. Out of another product it is recorded as a transfer, so
   * both balances and the history agree.
   */
  readonly pocketFunding = signal<'pocket' | 'manual'>('pocket');
  readonly pocketFundingFrom = signal<number | null>(null);

  /** Only a new product with money in it has anything to ask; a CDT always has. */
  readonly fundingAsked = computed(() =>
    !this.editingPocket() && (this.pocketKind() === 'cdt' || (parseOrNull(this.pocketAmount()) ?? 0) > 0));
  /** Whether the product being edited has its yield withheld at all. */
  readonly pocketWithholds = signal(true);
  /** Whether the product being edited counts towards the account's balance and net worth. */
  readonly pocketCounts = signal(true);
  /** Yields landed in the product being edited since its balance was stated. */
  readonly pocketYieldIn = signal(0);

  /** A new product earning nothing has no payday to ask about. */
  readonly pocketRateAboveZero = computed(() => {
    try {
      return parsePercentToScaled(this.pocketRate()) > 0;
    } catch {
      return false;
    }
  });

  /** The products a removed one can hand its balance to. */
  readonly otherPockets = computed(() =>
    this.editablePockets().filter(pocket => pocket.id !== this.editingPocket()?.id));

  /** The name of the product that receives it, for the confirmation. */
  readonly pocketDeleteTargetName = computed(() =>
    this.otherPockets().find(pocket => pocket.id === this.pocketDeleteTo())?.name ?? '');

  /** The rate form: a rate of the product being edited, or its spending bonus. */
  readonly rateIsBonus = signal(false);
  readonly rateUntil = signal<IsoDate | ''>('');

  /** Armed once, acted on twice: a destructive button should ask first. */
  readonly confirmingStop = signal(false);
  readonly editingRate = signal<YieldRate | null>(null);
  readonly ratePercent = signal('');
  readonly rateFrom = signal<IsoDate>(today());
  readonly rateSpend = signal('');
  /** Months of spending a bonus is judged on, and paid at the end of. */
  readonly rateMonths = signal('1');

  /**
   * The next three paydays of a product paid every so many months, as dates.
   *
   * Worked out by the same rule the engine pays by, from what is typed in the
   * form, so "every 3 months from July" reads as "30 sep, 31 dic, 31 mar"
   * instead of a sentence about how months are counted.
   */
  readonly paydayPreview = computed(() => {
    if (this.pocketPayout() !== 'monthly') return '';
    const months = Number(this.pocketMonths().trim());
    const from = this.pocketBaseRates().at(-1)?.valid_from ?? this.pocketFrom();
    if (!Number.isInteger(months) || months < 1 || !from) return '';

    const dates: string[] = [];
    let payday = paidOnFor('monthly', months, from, from > today() ? from : today());
    for (let count = 0; count < 3; count++) {
      dates.push(this.dayText(payday));
      payday = paidOnFor('monthly', months, from, addDays(payday, 1));
    }
    return this.i18n.t('cushion.payout.nextPaydays', { dates: dates.join(', ') });
  });

  /** Accounts that could be enrolled but are not. */
  readonly candidates = signal<AccountRow[]>([]);
  readonly picking = signal(false);

  /**
   * The peso total, and only the peso total.
   *
   * A dollar cushion and a peso cushion do not add up without choosing a rate,
   * and choosing one here would be inventing a figure. The foreign ones are
   * listed on their own instead — the same rule net worth follows.
   */
  readonly copTotalMinor = computed(() => this.copLines()
    .reduce((sum, line) => sum + line.availableMinor, 0));

  /** What every peso account earned on the last day worked out. */
  readonly earnedLastDayMinor = computed(() => this.copLines()
    .reduce((sum, line) => sum + line.lastDayMinor, 0));

  readonly copLines = computed(() =>
    this.lines().filter(line => line.account.currency_code === 'COP'));

  readonly foreignLines = computed(() =>
    this.lines().filter(line => line.account.currency_code !== 'COP'));

  /** Days the withholding could not be worked out, across every account. */
  readonly unknownWithholdingDays = computed(() =>
    this.lines().reduce((sum, line) => sum + line.cushion.daysWithUnknownWithholding, 0));

  /**
   * Re-entrancy guard. A plain field and not a signal, on purpose.
   *
   * The effect below reads whatever signals the synchronous start of
   * `refresh()` touches, and `refresh()` also writes them — so a signal here
   * made the effect depend on a value it sets, and the screen recomputed
   * forever with "calculating" on it. A plain boolean is invisible to the
   * reactive graph, which is exactly what a guard should be.
   */
  private busy = false;

  constructor() {
    // A message belongs to the form it was raised on. Leaving that form - or
    // the account, or opening an entry screen - clears it; an error from the
    // product form used to stay on every screen visited after it.
    effect(() => {
      this.form();
      this.openLine();
      this.cushionEntry();
      untracked(() => this.error.set(''));
    });

    effect(() => {
      // Read the two things that should re-run this, and nothing else.
      const version = this.database.dataVersion();
      const ready = this.database.status() === 'ready';

      // Everything inside runs outside the tracking context: refresh() writes
      // signals, and any of them read on its way in would become a dependency
      // of this effect and start it again as soon as it finished.
      untracked(() => {
        // A change this screen made itself has already been taken care of, on
        // the one account it touched. Reading the other twelve again is what
        // made moving money between two products take seconds on the phone.
        if (ready && version !== this.selfVersion) void this.refresh();
      });
    });
  }

  // ---------------------------------------------------------------------------
  // Reading
  // ---------------------------------------------------------------------------

  private repos() {
    const db = this.database.driver;
    return {
      db,
      accounts: new AccountsRepository(db),
      categories: new CategoriesRepository(db),
      transactions: new TransactionsRepository(db),
      transfers: new TransfersRepository(db),
      yields: new YieldsRepository(db),
      tax: new TaxParametersRepository(db),
    };
  }

  /**
   * Brings every account up to today and then reads the result.
   *
   * One call, because the two halves are never wanted apart: a screen showing
   * yesterday's total is a screen showing a wrong total.
   */
  async refresh(): Promise<void> {
    // A refresh asked for while one is running is not dropped: it waits, and
    // one more runs afterwards. Dropping it is what left a deleted movement's
    // product showing the old balance - the movement screen announced the
    // change, which started a refresh, and the reopen that followed returned
    // at once and read the figures from before the delete.
    if (this.refreshing) {
      this.refreshAgain = true;
      return this.refreshing;
    }
    this.refreshing = (async () => {
      do {
        this.refreshAgain = false;
        await this.refreshOnce();
      } while (this.refreshAgain);
    })().finally(() => {
      this.refreshing = null;
    });
    return this.refreshing;
  }

  /**
   * The data version this screen wrote itself.
   *
   * Its own edits already refresh the account they touched, so the effect
   * watching the database has nothing to do about them - and what it would do
   * is read every other account for no reason.
   */
  private selfVersion = 0;

  private refreshing: Promise<void> | null = null;
  private refreshAgain = false;

  private async refreshOnce(): Promise<void> {
    this.working.set(true);
    this.error.set('');
    try {
      const { db, yields, tax } = this.repos();

      // Only when something it depends on has changed. Opening this screen
      // worked five years of yields out again every time, which is what made
      // it take seconds on the phone - for an answer already in the database.
      if (await yields.needsAccrual(today())) {
        await accrueAllAndSettle(db, yields, tax, today(), progress => this.report('busy.yields', progress));
        await yields.markAccrued(today());
      }
      await this.report('busy.reading');
      await this.load();
    } catch (error) {
      this.error.set(messageOf(error));
    } finally {
      this.working.set(false);
      this.busyState.set(null);
    }
  }

  /** Recomputes from scratch, for after a rate or an opening figure changed. */
  async recalculate(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.working.set(true);
    this.error.set('');
    try {
      const { db, yields, tax } = this.repos();
      for (const entry of await yields.accounts()) {
        await yields.clearDays(entry.account_id);
      }
      await accrueAllAndSettle(db, yields, tax, today(), progress => this.report('busy.yields', progress));
      await yields.markAccrued(today());
      await this.report('busy.reading');
      await this.load();
    } catch (error) {
      this.error.set(messageOf(error));
    } finally {
      this.working.set(false);
      this.busyState.set(null);
      this.busy = false;
    }
  }

  /**
   * Says how far along it is, and hands the screen back long enough to draw
   * it. Without the pause the bar would appear only once the work had
   * finished, which is the one moment it is of no use.
   */
  private async report(label: string, progress?: Progress): Promise<void> {
    const percent = progress && progress.total > 0
      ? Math.min(100, Math.round((progress.done / progress.total) * 100))
      : null;
    this.busyState.set({
      label: this.i18n.t(label as never),
      detail: progress && progress.total > 0
        ? this.i18n.t('busy.steps', { done: progress.done, total: progress.total })
        : '',
      percent,
    });
    await new Promise(resolve => setTimeout(resolve));
  }

  /**
   * Rebuilds one account's line, in place.
   *
   * Everything on this screen was read again whenever anything changed - all
   * thirteen accounts, two hundred and forty-five questions - because moving
   * money between two products of ONE account is a change like any other as
   * far as a screen watching the database can tell. It is not: the other
   * twelve are exactly as they were, and asking after them is what made a
   * transfer between products take seconds to show on the phone.
   */
  private async refreshOne(accountId: number): Promise<void> {
    const { db, accounts, yields, tax } = this.repos();
    const engine = new AccrualEngine(db, yields, tax);

    const entry = (await yields.accounts()).find(row => row.account_id === accountId);
    const account = (await accounts.balance(accountId))?.account;
    if (!entry || !account) { await this.refresh(); return; }

    const pockets = await yields.pockets(accountId);
    const last = await yields.lastAccruedDay(accountId);
    const bands = await yields.bandsInForce(accountId, today());
    const daysOfLast = last ? await yields.days(accountId, last, last) : [];
    const paidThatDay = last ? await yields.paidOn(accountId, last) : [];
    const landed = await yields.landedByPocket(accountId, today(), pockets);
    const held = await engine.heldByPocket(accountId, today(), pockets);
    const productsMinor = pockets.reduce(
      (sum, pocket) => sum + (held.get(pocket.id) ?? 0) + (landed.total.get(pocket.id) ?? 0), 0);
    const accountMinor = (await accounts.balance(accountId))?.balance_minor ?? 0;

    const line: CushionLine = {
      account,
      cushion: await yields.cushion(accountId),
      rate: bands[0] ?? null,
      enabled: entry.enabled !== 0,
      pockets,
      lastDayMinor: paidThatDay.reduce((sum, day) => sum + netOf(day), 0),
      earnsOnMinor: [...new Map(daysOfLast.map(day => [day.pocket_id, day])).values()]
        .reduce((sum, day) => sum + day.balance_minor, 0),
      heldByPocket: held,
      earnsNextMinor: productsMinor,
      availableMinor: productsMinor - accountMinor,
      landedByPocket: landed.total,
      paidYieldByPocket: landed.yields,
    };

    this.lines.update(lines => lines
      .map(row => (row.account.id === accountId ? line : row))
      .sort((a, b) => b.availableMinor - a.availableMinor));
    if (last && (this.lastAccrued() === null || last > this.lastAccrued()!)) this.lastAccrued.set(last);

    // The sheet is showing this account: it shows the line just rebuilt.
    if (this.openLine()?.account.id === accountId) await this.open(line);
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    try {
      const { db, accounts, categories, yields, tax } = this.repos();
      const engine = new AccrualEngine(db, yields, tax);
      const enrolled = await yields.accounts();
      const all = await accounts.list({ includeArchived: true });
      const byId = new Map(all.map(account => [account.id, account]));

      // Asked once for every account rather than once per account: on a
      // phone each question crosses into the native side, and thirteen
      // accounts asking ten questions each is what made this screen slow.
      const cushions = await yields.cushions();
      const balances = new Map((await accounts.balances({ includeArchived: true }))
        .map(entry => [entry.account.id, entry.balance_minor]));
      const pocketsOf = new Map<number, YieldPocket[]>();
      for (const pocket of await yields.allPockets()) {
        pocketsOf.set(pocket.account_id, [...(pocketsOf.get(pocket.account_id) ?? []), pocket]);
      }

      const lines: CushionLine[] = [];
      let newest: IsoDate | null = null;

      for (const entry of enrolled) {
        const account = byId.get(entry.account_id);
        if (!account) continue;

        const last = await yields.lastAccruedDay(entry.account_id);
        if (last && (newest === null || last > newest)) newest = last;

        const bands = await yields.bandsInForce(entry.account_id, today());
        const pockets = pocketsOf.get(entry.account_id) ?? [];
        const daysOfLast = last ? await yields.days(entry.account_id, last, last) : [];
        // What was actually handed over that day. A product paid at the end of
        // the month earns every day too, but nothing of it arrives until then.
        const paidThatDay = last ? await yields.paidOn(entry.account_id, last) : [];
        const landed = await yields.landedByPocket(entry.account_id, today(), pockets);
        const held = await engine.heldByPocket(entry.account_id, today(), pockets);
        // Every movement counts on both sides - the products' balances and the
        // account's - so the difference is only what the products hold beyond it.
        const productsMinor = pockets.reduce(
          (sum, pocket) => sum + (held.get(pocket.id) ?? 0) + (landed.total.get(pocket.id) ?? 0), 0);
        const accountMinor = balances.get(entry.account_id) ?? 0;

        lines.push({
          account,
          cushion: cushions.get(entry.account_id) ?? await yields.cushion(entry.account_id),
          rate: bands[0] ?? null,
          enabled: entry.enabled !== 0,
          pockets,
          lastDayMinor: paidThatDay.reduce((sum, day) => sum + netOf(day), 0),
          // One figure per POCKET, not per row. A day of an account with two
          // rate components is two rows carrying the same base, and adding
          // them showed Uala earning on twice what it holds.
          earnsOnMinor: [...new Map(daysOfLast.map(day => [day.pocket_id, day])).values()]
            .reduce((sum, day) => sum + day.balance_minor, 0),
          heldByPocket: held,
          earnsNextMinor: productsMinor,
          availableMinor: productsMinor - accountMinor,
          landedByPocket: landed.total,
          paidYieldByPocket: landed.yields,
        });
      }

      lines.sort((a, b) => b.availableMinor - a.availableMinor);
      this.lines.set(lines);
      this.lastAccrued.set(newest);
      this.incomeCategories.set(await categories.list({ kind: 'income' }));
      // The kinds a product's own movement can be, which the user keeps.
      this.productKinds.set(await new ProductKindsRepository(db).list({ includeArchived: true }));
      await this.customIcons.load();

      // What could still be added. An archived account is history and is
      // never offered; anything else can be added, deliberately, by name.
      const enrolledIds = new Set(enrolled.map(entry => entry.account_id));
      this.candidates.set(all.filter(account =>
        account.archived === 0 && !enrolledIds.has(account.id)));
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * What the bank actually hands over, which is not the same as what the app
   * works out day by day.
   *
   * A daily component pays every day, so a day IS a payment. A monthly one
   * works out a figure every day and pays the lot at the end of the month,
   * so a month is one payment and the days inside it are only how it got
   * there. Showing the daily figures as though they were payments is what
   * made a monthly account look like it had already been paid in the middle
   * of September.
   *
   * This is the list to hold beside the bank app: same date, same rate, same
   * figure - or a difference worth chasing.
   */
  readonly payments = computed(() => {
    const out = new Map<string, Payment>();

    const todayIso = today();

    for (const day of this.openDays()) {
      const monthly = day.payout === 'monthly';
      // The day it is handed over, as written when the day was worked out.
      // Older days fall back to the rule they were computed under.
      const on = day.paid_on ?? (monthly ? endOfMonth(day.on_date) : day.on_date);
      // Per product: the bank pays each one apart, and its app is read product
      // by product. Adding them up gave a figure no screen of the bank shows.
      const key = `${day.pocket_id}|${day.component}|${on}`;

      const payment = out.get(key) ?? {
        key, pocketId: day.pocket_id, component: day.component, payout: day.payout, on,
        netMinor: 0, withheldMinor: 0, pending: monthly && on > todayIso, days: 0,
        lastOn: day.on_date, rateScaled: day.annual_rate_scaled, balanceMinor: day.balance_minor,
      };
      payment.netMinor += netOf(day);
      payment.withheldMinor += day.withholding_minor;
      payment.days += 1;
      // The rate and balance of the last day it covers, as the day list shows them.
      if (day.on_date >= payment.lastOn) {
        payment.lastOn = day.on_date;
        payment.rateScaled = day.annual_rate_scaled;
        payment.balanceMinor = day.balance_minor;
      }
      out.set(key, payment);
    }

    return [...out.values()].sort((a, b) => b.on.localeCompare(a.on) || a.pocketId - b.pocketId);
  });

  /** Payments grouped by month, so a year of daily ones stays readable. */
  readonly paymentsByMonth = computed(() => {
    const months = new Map<string, {
      key: string; payments: Payment[]; netMinor: number;
    }>();

    for (const payment of this.payments()) {
      const key = payment.on.slice(0, 7);
      const month = months.get(key) ?? { key, payments: [], netMinor: 0 };
      month.payments.push(payment);
      month.netMinor += payment.netMinor;
      months.set(key, month);
    }
    return [...months.values()];
  });

  /** Months of the working-out that the user has opened. */
  readonly openWorkings = signal<ReadonlySet<string>>(new Set());

  isWorkingOpen(key: string): boolean {
    return this.openWorkings().has(key);
  }

  toggleWorking(key: string): void {
    this.openWorkings.update(current => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }
  /** Months the user has opened in the day list. */
  readonly openMonths = signal<ReadonlySet<string>>(new Set());

  /**
   * The days gathered by month, newest first.
   *
   * A year of an account with two pockets is seven hundred rows, and they
   * are all the same shape. Nobody scrolls that. The month is the unit a
   * bank statement uses and the unit a monthly payer is paid in, so it is
   * the one worth opening.
   */
  readonly daysByMonth = computed(() => {
    const months = new Map<string, {
      key: string; days: YieldDay[]; netMinor: number; dayCount: number;
    }>();

    for (const day of this.openDays()) {
      const key = day.on_date.slice(0, 7);
      const month = months.get(key) ?? { key, days: [], netMinor: 0, dayCount: 0 };
      month.days.push(day);
      month.netMinor += netOf(day);
      months.set(key, month);
    }

    // Days, not rows. One day of an account with two rate components is two
    // rows, and the header said "2 days" for a single Wednesday.
    for (const month of months.values()) {
      month.dayCount = new Set(month.days.map(day => day.on_date)).size;
    }
    return [...months.values()];
  });

  isMonthOpen(key: string): boolean {
    return this.openMonths().has(key);
  }

  toggleMonth(key: string): void {
    this.openMonths.update(current => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  /** `2026-09` as a month someone reads, in their own language. */
  monthText(key: string): string {
    const [year, month] = key.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString(
      this.i18n.language() === 'en' ? 'en-GB' : 'es-CO',
      { month: 'long', year: 'numeric', timeZone: 'UTC' });
  }

  /** The pocket a day belongs to, for a list that mixes several. */
  pocketNameOf(line: CushionLine, day: YieldDay): string {
    return line.pockets.find(pocket => pocket.id === day.pocket_id)?.name ?? '';
  }

  // ---------------------------------------------------------------------------
  // The detail sheet
  // ---------------------------------------------------------------------------

  async open(line: CushionLine): Promise<void> {
    const sameAccount = this.openLine()?.account.id === line.account.id;
    this.openLine.set(line);
    this.form.set('none');
    this.resetForm();
    if (!sameAccount) {
      // Another account: its movements start collapsed, every product shown.
      this.showMovements.set(false);
      this.movementsPocket.set(null);
      this.movementsPeriod.set(currentPeriod('month'));
      this.movementsRangeStart.set(null);
      this.movementsRangeEnd.set(null);
      this.movements.set([]);
      this.collapsedGroups.set(new Set());
      this.showPayments.set(false);
      this.showDays.set(false);
    }
    // The products list says each product's rate, so the rates are read here
    // too, not only when the settings open.
    this.rates.set(await this.repos().yields.rateHistory(line.account.id));
    const { yields } = this.repos();
    // Newest first: the day someone came here to check is almost always a
    // recent one, and the list can run to thousands.
    const days = (await yields.days(line.account.id)).reverse();
    this.openDays.set(days);
    // The month someone came here to look at is almost always this one.
    this.openMonths.set(new Set(days.length > 0 ? [days[0].on_date.slice(0, 7)] : []));
    // The payments open on their latest month, as the day list does.
    this.openWorkings.set(new Set(days.length > 0 ? [days[0].on_date.slice(0, 7)] : []));
    // Open already, as after a correction: read again, so it shows the change.
    if (this.showMovements()) await this.loadMovements(line);
  }

  closeDetail(): void {
    this.openLine.set(null);
    this.openDays.set([]);
    this.openDay.set(null);
    this.form.set('none');
  }

  /**
   * One step back rather than all the way out.
   *
   * Back from a rate is the product it belongs to; back from a product is
   * wherever the product was opened from. Closing outright is the X's job, and
   * conflating the two is how someone loses a form they were filling in.
   */
  async back(): Promise<void> {
    const where = this.form();
    if (where === 'rate') {
      await this.openPocket(this.editingPocket());
    } else if (where === 'pocket') {
      await this.closePocket();
    } else {
      this.form.set('none');
    }
  }

  /** Leaves a product without saving, back to the account it belongs to. */
  async closePocket(): Promise<void> {
    this.form.set('none');
  }

  /** After a product was saved or removed: its account read again, and shown. */
  private async returnFromPocket(line: CushionLine): Promise<void> {
    await this.afterOwnChange(line.account.id);
    this.form.set('none');
  }

  /** Opens the income or expense screen for the yields of the account on screen. */
  openEntry(line: CushionLine, kind: 'income' | 'expense'): void {
    this.cushionEntry.set({ kind, account: line.account, pockets: line.pockets });
  }

  /** Saved and worked out again; the account shows the new figures. */
  async entrySaved(): Promise<void> {
    this.cushionEntry.set(null);
    const line = this.openLine();
    if (!line) return;
    await this.afterOwnChange(line.account.id);
  }

  /**
   * One account changed, by something this screen did: only that account is
   * read again, and the effect watching the database is told to stand down.
   */
  private async afterOwnChange(accountId: number): Promise<void> {
    this.selfVersion = this.database.dataVersion();
    await this.refreshOne(accountId);
  }

  /**
   * Opens the form for moving money from one product to another.
   *
   * Emptying an alcancia into the savings account, opening a CDT with part of
   * it: the bank calls these withdrawals and top-ups, and from the account's
   * point of view nothing happens at all - the same money is still there. So
   * it is written as a transfer whose two legs are in the same account and
   * differ only in the product, which sums to zero and leaves the balance
   * untouched while moving what each product earns on.
   */
  /** Opens the transfer screen, between two products of the account on screen. */
  openMove(line: CushionLine): void {
    if (line.pockets.length < 2) return;
    this.cushionEntry.set({ kind: 'transfer', account: line.account, pockets: line.pockets });
  }

  /** Opens one day so it can be checked against a statement and corrected. */
  openDayForm(day: YieldDay): void {
    this.resetForm();
    this.openDay.set(day);
    this.amount.set(decimalOf(day.actual_net_minor ?? day.net_minor));
    this.form.set('day');
  }

  /**
   * Reads the account's own figures again - its rates, its products, whether
   * it is still earning - for the sheet that shows them.
   *
   * This was a screen of its own, "Ajustes de la cuenta", which by the end
   * showed only figures the account's sheet already showed and products that
   * are edited from it. Jose, 2026-09-16: there is nothing left in it.
   */
  async readAccount(): Promise<void> {
    const line = this.openLine();
    if (!line) return;

    const { yields } = this.repos();
    const entry = await yields.account(line.account.id);
    this.editingEnabled = entry?.enabled !== 0;
    this.rates.set(await yields.rateHistory(line.account.id));
    this.editablePockets.set(await yields.pockets(line.account.id));
  }

  async stopAccruing(): Promise<void> {
    const line = this.openLine();
    if (!line) return;

    // Two taps, not one. Stopping an account is easy to hit by accident and
    // silent when it happens: the figures simply stop moving.
    if (!this.confirmingStop()) { this.confirmingStop.set(true); return; }
    this.confirmingStop.set(false);

    this.saving.set(true);
    try {
      const { yields } = this.repos();
      await yields.setEnabled(line.account.id, false);
      await this.afterOwnChange(line.account.id);
    } catch (error) {
      this.error.set(messageOf(error));
    } finally {
      this.saving.set(false);
    }
  }

  /** Starts an account up again, from where it left off. */
  async resumeAccruing(): Promise<void> {
    const line = this.openLine();
    if (!line) return;

    this.saving.set(true);
    try {
      const { yields } = this.repos();
      await yields.setEnabled(line.account.id, true);
      await this.afterOwnChange(line.account.id);
    } catch (error) {
      this.error.set(messageOf(error));
    } finally {
      this.saving.set(false);
    }
  }

  /**
   * Opens one pocket to be named, given a balance, or removed.
   *
   * The name is free text on purpose: every bank calls these something
   * different - alcancias, bolsillos, metas, espacios - and inventing one
   * word for all of them would only be right for one bank.
   */
  async openPocket(pocket: YieldPocket | null): Promise<void> {
    const line = this.openLine();
    if (!line) return;
    const { yields, tax } = this.repos();

    // Coming back from one of its rates keeps the origin the product had.

    this.editingPocket.set(pocket);
    this.confirmingPocketDelete.set(false);
    this.error.set('');

    // The account's products and rates, fresh. Only the settings screen used
    // to load them, so a product opened straight from the account's list never
    // showed its delete button - the form believed the account had no other
    // product.
    this.editablePockets.set(await yields.pockets(line.account.id));
    this.rates.set(await yields.rateHistory(line.account.id));
    this.withholds.set((await yields.account(line.account.id))?.withholding !== 0);
    // A new product starts with the account's answer; an existing one has its own.
    this.pocketWithholds.set(pocket ? pocket.withholding === 1 : this.withholds());
    this.pocketCounts.set(pocket ? pocket.include_in_net_worth !== 0 : true);

    this.pocketName.set(pocket?.name ?? '');
    this.pocketKind.set(pocket?.kind ?? 'high_yield');
    this.pocketPayout.set(pocket?.payout ?? 'daily');
    this.pocketMonths.set(String(pocket?.payout_months ?? 1));
    // Zero until told otherwise: a product with no rate earns nothing.
    this.pocketRate.set('0');
    // A brand new product is not the usual one unless the account has none.
    this.pocketIsDefault.set(pocket
      ? pocket.is_default === 1
      : line.pockets.every(other => other.is_default !== 1));

    // A CDT's terms. It matures into the usual product unless it was told
    // otherwise, and its yield is recorded under the first income category
    // until another is chosen.
    const targets = this.cdtTargets();
    this.cdtOpenedOn.set(pocket?.opened_on ?? today());
    this.cdtTerm.set(pocket?.term_months ? String(pocket.term_months) : '');
    const cdtRate = pocket?.kind === 'cdt' ? this.rates().find(rate => rate.pocket_id === pocket.id) : undefined;
    this.cdtRate.set(cdtRate ? scaledPercentToString(cdtRate.annual_rate_scaled) : '');
    this.cdtCategory.set(pocket?.income_category_id ?? this.incomeCategories()[0]?.id ?? null);
    this.cdtInto.set(pocket?.matures_into_pocket_id
      ?? (targets.find(target => target.is_default === 1) ?? targets[0])?.id ?? null);
    this.cdtRule.set(await tax.withholdingRule(today()));

    if (pocket) {
      const history = await yields.pocketBalances(pocket.id);

      // The last balance recorded, whatever date it carries - NOT the last one
      // in force today.
      //
      // Filtering to today is what the engine does, and it is right there: a
      // balance dated next week does not describe this week. It is wrong here.
      // An editor has to show what is stored, and this one hid anything dated
      // ahead - so setting a date in the future saved correctly, showed the
      // previous balance on reopening, and read exactly like a form that
      // ignores what is typed into it.
      const current = history.at(-1);
      // A product that followed the account balance has no figure of its own
      // yet: it starts from what it holds today, so saving keeps its balance.
      // A CDT's amount is its capital: the figure stated plus the transfer that
      // funded it, which is how its balance reads the day it opens.
      const funding = pocket.kind === 'cdt' && pocket.opened_on && pocket.term_months
        ? await yields.cdtFunding(pocket.id, pocket.opened_on, cdtMaturity(pocket.opened_on, pocket.term_months))
        : 0;
      this.pocketAmount.set(decimalOf(current ? current.amount_minor + funding : Math.max(0, this.heldIn(line, pocket.id))));
      this.pocketFrom.set(current?.valid_from ?? today());
      this.editingBalanceId.set(current?.id ?? null);
      this.editingBalanceFrom.set(current?.valid_from ?? null);
      await this.readPocketMoved();
      this.pocketYieldIn.set(
        (await yields.landedByPocket(line.account.id, today())).total.get(pocket?.id ?? -1) ?? 0);
    } else {
      this.pocketAmount.set('0');
      this.pocketFunding.set('pocket');
      this.pocketFundingFrom.set((line.pockets.find(other => other.is_default === 1) ?? line.pockets[0])?.id ?? null);
      this.pocketFrom.set(today());
      this.editingBalanceId.set(null);
      this.editingBalanceFrom.set(null);
      this.pocketMoved.set(0);
      this.pocketYieldIn.set(0);
    }
    this.form.set('pocket');
  }

  /**
   * Saves a product: a high-yield one with its balance and how it is paid, or
   * a CDT with its terms.
   *
   * A high-yield product's figure is what the bank says it holds today, which
   * already includes every yield the bank has paid into it. That is why it
   * replaces the base rather than adding to it.
   */
  async savePocket(): Promise<void> {
    const line = this.openLine();
    if (!line) return;

    const name = this.pocketName().trim();
    if (name.length === 0) {
      this.error.set(this.i18n.t('cushion.error.name'));
      return;
    }
    if (this.pocketKind() === 'cdt') {
      await this.saveCdt(line, name);
      return;
    }

    // Every product holds the balance the person types in; income, expenses
    // and transfers keep it square from there.
    const amount = parseOrNull(this.pocketAmount());
    if (amount === null || amount < 0) {
      this.error.set(this.i18n.t('cushion.error.amount'));
      return;
    }

    const payout = this.pocketPayout();
    const months = payout === 'monthly' ? Number(this.pocketMonths().trim()) : 1;
    if (!Number.isInteger(months) || months < 1) {
      this.error.set(this.i18n.t('cushion.error.months'));
      return;
    }

    // A new product with money in it says where that money came from.
    const funded = !this.editingPocket() && amount > 0 && this.pocketFunding() === 'pocket';
    if (funded && this.pocketFundingFrom() === null) {
      this.error.set(this.i18n.t('cushion.error.fundingFrom'));
      return;
    }

    // A new product can be given its first rate in the same form.
    let firstRate: number | null = null;
    if (!this.editingPocket() && this.pocketRate().trim().length > 0) {
      try {
        firstRate = parsePercentToScaled(this.pocketRate());
      } catch {
        this.error.set(this.i18n.t('cushion.error.rate'));
        return;
      }
    }

    this.saving.set(true);
    try {
      const { db, yields, tax } = this.repos();
      await db.transaction(async () => {
        const existing = this.editingPocket();
        const id = existing
          ? existing.id
          : await yields.addPocket({
              account_id: line.account.id,
              name,
              source: 'manual',
              kind: 'high_yield',
              sort_order: line.pockets.length,
              payout,
              payout_months: months,
            });

        if (existing) {
          await yields.renamePocket(id, name);
          // A product that used to follow the account balance holds what was
          // typed from now on.
          await yields.setPocketSource(id, 'manual');
        }
        await yields.setPocketPayout(id, payout, months);
        if ((existing?.withholding ?? -1) !== (this.pocketWithholds() ? 1 : 0)) {
          await yields.setPocketWithholding(id, this.pocketWithholds());
          // Every day it earned is withheld differently now.
          if (existing) await yields.clearDays(line.account.id);
        }
        // A rate of zero is no rate: nothing is recorded for it.
        if (firstRate !== null && firstRate > 0) {
          await yields.setRate({
            account_id: line.account.id, pocket_id: id, component: 'base',
            payout, payout_months: months, valid_from: this.pocketFrom(), annual_rate_scaled: firstRate,
          });
        }

        // Correcting the balance on screen, or recording a new one. The first
        // moves the row that is being looked at, date included; the second
        // adds one, which is what a balance read on a later day is.
        const balanceId = this.editingBalanceId();
        if (balanceId !== null) {
          await yields.movePocketBalance(balanceId, {
            valid_from: this.pocketFrom(), amount_minor: amount,
          });
        } else if (funded) {
          await this.fundFromPocket(line, id, this.pocketFundingFrom()!, this.pocketFrom(), amount, name);
        } else {
          await yields.setPocketBalance({
            pocket_id: id, valid_from: this.pocketFrom(), amount_minor: amount,
          });
        }

        // Unticking is not a way to leave an account without one: every
        // account needs somewhere for money to land.
        if (this.pocketIsDefault()) {
          await yields.setDefaultPocket(line.account.id, id);
        }
        await this.saveNetWorthSwitch(yields, existing, id);

        // Every pocket of the account is worked out again from that date: a
        // figure moving between pockets changes what the others earn on too.
        //
        // From the EARLIER of the two dates when one is being moved. Moving a
        // balance forward leaves the days between the old date and the new one
        // standing on a figure that no longer applies to them.
        const wasFrom = this.editingBalanceFrom();
        let redoFrom = wasFrom !== null && wasFrom < this.pocketFrom()
          ? wasFrom : this.pocketFrom();

        // Being paid differently changes every day the product has earned, so
        // those days are worked out again from its first rate - or from the day
        // the account started, if it has none.
        if (existing && (existing.payout !== payout || existing.payout_months !== months)) {
          const first = this.pocketBaseRates()[0]?.valid_from
            ?? (await yields.account(line.account.id))?.opening_on;
          if (first && first < redoFrom) redoFrom = first;
        }
        await yields.clearDays(line.account.id, redoFrom);
      });

      await accrueAndSettle(db, yields, tax, line.account.id, today());
      // Only this account changed and it has just been worked out, so opening
      // the screen afterwards has nothing left to do.
      await yields.markAccrued(today(), { onlyIfKnown: true });
      // The summary and the accounts screen show the account without what is set aside.
      this.database.dataChanged();
      await this.returnFromPocket(line);
    } catch (error) {
      this.error.set(messageOf(error));
    } finally {
      this.saving.set(false);
    }
  }

  /**
   * Records whether the product counts towards net worth, when that changed.
   * The usual product always does, whatever the switch said.
   */
  private async saveNetWorthSwitch(yields: YieldsRepository, existing: YieldPocket | null, id: number): Promise<void> {
    const counts = this.pocketIsDefault() || existing?.is_default === 1 || this.pocketCounts();
    if ((existing?.include_in_net_worth ?? 1) !== (counts ? 1 : 0)) {
      await yields.setPocketNetWorth(id, counts);
    }
  }

  /**
   * Saves a CDT: its amount from the day it opened, its one rate, and its terms.
   *
   * A CDT holds one figure at one rate for its whole term, so saving it again
   * replaces both rather than adding a history. It is worked out again from the
   * day it opened - or the day it used to open, if that was earlier - and, if
   * that day has already come, it matures and closes straight away.
   */
  private async saveCdt(line: CushionLine, name: string): Promise<void> {
    const capital = parseOrNull(this.pocketAmount());
    if (capital === null || capital <= 0) {
      this.error.set(this.i18n.t('cushion.error.amount'));
      return;
    }
    const term = Number(this.cdtTerm().trim());
    if (!Number.isInteger(term) || term < 1) {
      this.error.set(this.i18n.t('cushion.error.months'));
      return;
    }
    let rate: number;
    try {
      rate = parsePercentToScaled(this.cdtRate());
    } catch {
      this.error.set(this.i18n.t('cushion.error.rate'));
      return;
    }
    const category = this.cdtCategory();
    if (category === null) {
      this.error.set(this.i18n.t('cushion.error.category'));
      return;
    }
    const opened = this.cdtOpenedOn();
    const into = this.cdtInto();
    const funded = !this.editingPocket() && this.pocketFunding() === 'pocket';
    if (funded && this.pocketFundingFrom() === null) {
      this.error.set(this.i18n.t('cushion.error.fundingFrom'));
      return;
    }

    this.saving.set(true);
    try {
      const { db, yields, tax } = this.repos();
      const existing = this.editingPocket();
      await db.transaction(async () => {
        const id = existing
          ? existing.id
          : await yields.addPocket({
              account_id: line.account.id,
              name,
              source: 'manual',
              kind: 'cdt',
              sort_order: line.pockets.length,
              payout: 'monthly',
              payout_months: term,
              opened_on: opened,
              term_months: term,
              matures_into_pocket_id: into,
              income_category_id: category,
            });

        if (existing) {
          await yields.renamePocket(id, name);
          await yields.setCdtTerms(id, {
            opened_on: opened, term_months: term, matures_into_pocket_id: into, income_category_id: category,
          });
          for (const old of this.rates().filter(candidate => candidate.pocket_id === id)) {
            await yields.removeRate(old.id);
          }
        }

        if (funded) {
          await this.fundFromPocket(line, id, this.pocketFundingFrom()!, opened, capital, name);
        } else {
          // Minus the transfer that funded it, if one did: that money is already in.
          await yields.setCdtCapital(id, {
            opened_on: opened, matures_on: cdtMaturity(opened, term), capital_minor: capital,
          });
        }
        await yields.setPocketWithholding(id, this.pocketWithholds());
        await this.saveNetWorthSwitch(yields, existing, id);
        await yields.setRate({
          account_id: line.account.id, pocket_id: id, component: 'base',
          payout: 'monthly', payout_months: term, valid_from: opened, annual_rate_scaled: rate,
        });

        const redoFrom = existing?.opened_on && existing.opened_on < opened ? existing.opened_on : opened;
        await yields.clearDays(line.account.id, redoFrom);
      });

      await accrueAndSettle(db, yields, tax, line.account.id, today());
      // Only this account changed and it has just been worked out, so opening
      // the screen afterwards has nothing left to do.
      await yields.markAccrued(today(), { onlyIfKnown: true });
      this.database.dataChanged();
      await this.returnFromPocket(line);
    } catch (error) {
      this.error.set(messageOf(error));
    } finally {
      this.saving.set(false);
    }
  }

  /**
   * Asks before removing a product, and where its balance should go.
   *
   * It used to remove it on the first tap, taking every day it earned with it.
   * The usual product is chosen by default - it is where unassigned money
   * already lands - unless the one being removed is the usual one, and then
   * the first of the others.
   */
  async startDeletePocket(): Promise<void> {
    const line = this.openLine();
    const pocket = this.editingPocket();
    if (!line || !pocket) return;

    if (line.pockets.length <= 1) {
      this.error.set(this.i18n.t('cushion.error.lastPocket'));
      return;
    }

    const others = this.otherPockets();
    const usual = others.find(other => other.is_default === 1) ?? others[0];
    this.pocketDeleteTo.set(usual?.id ?? null);
    this.pocketNewUsual.set(usual?.id ?? null);

    const { db, yields, tax } = this.repos();
    const held = await new AccrualEngine(db, yields, tax).heldByPocket(line.account.id, today());
    const landed = await yields.landedByPocket(line.account.id, today());
    // The balance as the product shows it: that is what has to go somewhere.
    this.pocketDeleteHeld.set((held.get(pocket.id) ?? 0) + (landed.total.get(pocket.id) ?? 0));
    this.pocketDeleteHistory.set(await yields.pocketHistoryCount(pocket.id));
    this.confirmingPocketDelete.set(true);
  }

  /**
   * Opens a new product with money out of another one.
   *
   * The new product starts empty the day before, and a transfer carries the
   * money in on the day itself: a balance counts movements from the day after
   * it is stated when working out what a day earns, so this is what makes the
   * money earn from its first day - and the other product's balance goes down
   * by the same, with the transfer in both products' history.
   */
  private async fundFromPocket(
    line: CushionLine, pocketId: number, fromId: number, on: IsoDate, amount: number, name: string,
  ): Promise<void> {
    const { yields, transfers } = this.repos();
    await yields.setPocketBalance({ pocket_id: pocketId, valid_from: addDays(on, -1), amount_minor: 0 });
    await transfers.create({
      occurred_on: on,
      description: this.i18n.t('cushion.pocket.fundedNote', { name }),
      from: { account_id: line.account.id, pocket_id: fromId, amount_minor: amount },
      to: { account_id: line.account.id, pocket_id: pocketId, amount_minor: amount },
    });
  }

  /** Set while a removal was started from the settings list, not the product's form. */
  private deletingFromList = false;

  /** Removal straight from the settings list, asking the same question. */
  async deleteFromList(pocket: YieldPocket): Promise<void> {
    await this.openPocket(pocket);
    this.deletingFromList = true;
    await this.startDeletePocket();
    if (!this.confirmingPocketDelete()) this.deletingFromList = false;
  }

  /** The question closed. Cancelled after starting from the list, it goes back to the list. */
  pocketDeleteClosed(): void {
    this.confirmingPocketDelete.set(false);
    if (!this.deletingFromList) return;
    this.deletingFromList = false;
    if (this.form() === 'pocket') void this.closePocket();
  }

  /** Removes the product, handing its balance, movements and earnings to the one chosen. */
  async deletePocket(): Promise<void> {
    const line = this.openLine();
    const pocket = this.editingPocket();
    const into = this.pocketDeleteTo();
    if (!line || !pocket || into === null) return;

    this.saving.set(true);
    try {
      const { db, yields, tax } = this.repos();
      await removePocketInto(db, yields, tax, line.account.id, pocket.id, into, today(),
        this.i18n.t('cushion.pocket.removedNote', { name: pocket.name }));
      // Removing the usual product needs a new one: the one chosen, which is
      // not necessarily where the balance went.
      const usual = this.pocketNewUsual();
      if (pocket.is_default === 1 && usual !== null && usual !== into) {
        await yields.setDefaultPocket(line.account.id, usual);
      }
      // Done, not cancelled: the screen it returns to is decided below.
      this.deletingFromList = false;
      this.confirmingPocketDelete.set(false);
      this.database.dataChanged();
      // The whole account again, not just the settings: the products' figures
      // on screen were read before the balance moved, and reopening only the
      // settings left the destination showing its old balance until a refresh.
      await this.returnFromPocket(line);
    } catch (error) {
      this.error.set(messageOf(error));
    } finally {
      this.saving.set(false);
    }
  }

  /**
   * Opens a rate of the product being edited: one to correct, a new one from a
   * date, or - with `bonus` - a spending bonus.
   *
   * A rate belongs to its product and has no name to type. The product's own
   * rates are one line, one after another in time; a spending bonus is a second
   * line beside it, judged on each month and paid at its end.
   */
  startRateForm(rate: YieldRate | null = null, bonus = false): void {
    this.error.set('');
    this.editingRate.set(rate);
    this.rateIsBonus.set(rate ? rate.requires_monthly_spend_minor !== null : bonus);
    this.rateUntil.set(rate?.valid_to ?? '');
    this.ratePercent.set(rate ? scaledPercentToString(rate.annual_rate_scaled) : '');
    this.rateFrom.set(rate?.valid_from ?? today());
    this.rateSpend.set(rate?.requires_monthly_spend_minor ? decimalOf(rate.requires_monthly_spend_minor) : '');
    this.rateMonths.set(String(rate?.payout_months ?? 1));
    this.form.set('rate');
  }

  /**
   * Records a rate of the product being edited. A change is a new row from a date.
   *
   * Editing the old one would rewrite what was true last month, and the days
   * already computed under it would stop being explainable. The rate in force
   * on a day is the most recent row on or before it, so a rate dated in the
   * future simply waits its turn - which is how Plata's drop to 9% on
   * 2026-11-09 was recorded two months early.
   */
  async saveRate(): Promise<void> {
    const line = this.openLine();
    const pocket = this.editingPocket();
    if (!line || !pocket) return;

    const bonus = this.rateIsBonus();
    let scaled: number;
    try {
      scaled = parsePercentToScaled(this.ratePercent());
    } catch {
      this.error.set(this.i18n.t('cushion.error.rate'));
      return;
    }

    const spend = bonus ? parseOrNull(this.rateSpend().trim()) : null;
    if (bonus && (spend === null || spend <= 0)) {
      this.error.set(this.i18n.t('cushion.error.amount'));
      return;
    }
    const bonusMonths = Number(this.rateMonths().trim());
    if (bonus && (!Number.isInteger(bonusMonths) || bonusMonths < 1)) {
      this.error.set(this.i18n.t('cushion.error.months'));
      return;
    }

    // Which line of the product this rate belongs to. Names already on record
    // are kept, because the days of yield are filed under them.
    const existing = this.editingRate();
    const component = existing?.component
      ?? (bonus
        ? this.pocketBonusRates()[0]?.component ?? this.i18n.t('cushion.rate.bonusName')
        : this.pocketBaseRates()[0]?.component ?? 'base');

    this.saving.set(true);
    try {
      const { db, yields, tax } = this.repos();
      await db.transaction(async () => {
        if (existing) await yields.removeRate(existing.id);
        await yields.setRate({
          account_id: line.account.id,
          pocket_id: pocket.id,
          component,
          // A bonus is judged on the spending of its period and paid at its
          // end, or not at all; the product's own rate is paid the way the
          // product is.
          payout: bonus ? 'monthly' : pocket.payout,
          payout_months: bonus ? bonusMonths : pocket.payout_months,
          valid_from: this.rateFrom(),
          valid_to: this.rateUntil() || null,
          annual_rate_scaled: scaled,
          requires_monthly_spend_minor: spend,
          fallback_annual_rate_scaled: null,
        });
        // From the earliest day either version of the rate touches. Moving
        // a rate backwards has to redo the days it now covers as well.
        const redoFrom = existing && existing.valid_from < this.rateFrom()
          ? existing.valid_from : this.rateFrom();
        await yields.clearDays(line.account.id, redoFrom);
      });

      await accrueAndSettle(db, yields, tax, line.account.id, today());
      // Only this account changed and it has just been worked out, so opening
      // the screen afterwards has nothing left to do.
      await yields.markAccrued(today(), { onlyIfKnown: true });
      await this.backToPocket(line, pocket.id);
    } catch (error) {
      this.error.set(messageOf(error));
    } finally {
      this.saving.set(false);
    }
  }

  async removeRate(rate: YieldRate): Promise<void> {
    const line = this.openLine();
    if (!line) return;

    this.saving.set(true);
    try {
      const { db, yields, tax } = this.repos();
      await db.transaction(async () => {
        await yields.removeRate(rate.id);
        await yields.clearDays(line.account.id, rate.valid_from);
      });
      await accrueAndSettle(db, yields, tax, line.account.id, today());
      // Only this account changed and it has just been worked out, so opening
      // the screen afterwards has nothing left to do.
      await yields.markAccrued(today(), { onlyIfKnown: true });
      this.database.dataChanged();
      if (rate.pocket_id !== null) await this.backToPocket(line, rate.pocket_id);
      else await this.afterOwnChange(line.account.id);
    } catch (error) {
      this.error.set(messageOf(error));
    } finally {
      this.saving.set(false);
    }
  }

  /** Back to a product's form, with the account and its figures read again. */
  private async backToPocket(line: CushionLine, pocketId: number): Promise<void> {
    await this.afterOwnChange(line.account.id);
    await this.readAccount();
    const pocket = this.editablePockets().find(candidate => candidate.id === pocketId);
    if (pocket) await this.openPocket(pocket);
  }

  /**
   * One line about a product, for the settings list: the rate it earns and how
   * it is paid, or the day a CDT matures.
   */
  pocketSummary(pocket: YieldPocket): string {
    if (pocket.kind === 'cdt') {
      return pocket.opened_on && pocket.term_months
        ? this.i18n.t('cushion.pocket.cdtMatures', {
            date: this.longDayText(cdtMaturity(pocket.opened_on, pocket.term_months)),
          })
        : this.i18n.t('cushion.pocket.kind.cdt');
    }

    const current = this.rates().filter(rate =>
      rate.pocket_id === pocket.id && rate.requires_monthly_spend_minor === null
      && this.rateStatus(rate) === 'current').at(-1);
    // With no rate there is nothing paid, so no payday to mention.
    if (!current || current.annual_rate_scaled <= 0) return this.i18n.t('cushion.pocket.noRate');
    const rate = this.rateText(current.annual_rate_scaled);
    const paid = pocket.payout === 'daily' ? this.i18n.t('cushion.payout.daily')
      : pocket.payout_months === 1 ? this.i18n.t('cushion.payout.monthly')
      : this.i18n.t('cushion.payout.everyMonths', { count: pocket.payout_months });
    return `${rate} · ${paid}`;
  }

  /** How a rate is paid, in words: every day, every month, or every so many months. */
  payoutText(rate: YieldRate): string {
    if (rate.payout === 'daily') return this.i18n.t('cushion.payout.daily');
    const months = rate.payout_months ?? 1;
    return months === 1
      ? this.i18n.t('cushion.payout.monthly')
      : this.i18n.t('cushion.payout.everyMonths', { count: months });
  }

  /** Adds an account to the module, with nothing accrued and no rate yet. */
  async enrol(account: AccountRow): Promise<void> {
    this.saving.set(true);
    try {
      const { db, yields, tax } = this.repos();
      await yields.enrol({
        account_id: account.id,
        default_pocket_name: this.i18n.t('cushion.pocket.defaultName'),
        opening_cushion_minor: 0,
        opening_on: today(),
        withholding: account.currency_code === 'COP',
        // Most banks pay monthly. Claiming daily would credit interest on
        // money the bank has not handed over.
        payout: 'monthly',
      });

      // Every product holds a balance the person states. The one an account
      // starts with begins at what the account holds today, to be corrected
      // against the bank - not as a product that follows the account.
      const [first] = await yields.pockets(account.id);
      if (first && first.source === 'ledger') {
        const held = (await new AccrualEngine(db, yields, tax).heldByPocket(account.id, today())).get(first.id) ?? 0;
        await db.transaction(async () => {
          await yields.setPocketSource(first.id, 'manual');
          await yields.setPocketBalance({ pocket_id: first.id, valid_from: today(), amount_minor: Math.max(0, held) });
        });
      }
      this.picking.set(false);
      this.database.dataChanged();

      // Straight into the new account's settings, where its products are
      // added: an account just started has only the one it began with.
      await this.refresh();
      const fresh = this.lines().find(row => row.account.id === account.id);
      if (fresh) await this.open(fresh);
    } catch (error) {
      this.error.set(messageOf(error));
    } finally {
      this.saving.set(false);
    }
  }

  private resetForm(): void {
    this.error.set('');
    this.confirmingStop.set(false);
    this.amount.set('');
    this.note.set('');
    this.onDate.set(today());
    this.categoryId.set(null);
    this.openDay.set(null);
    this.saving.set(false);
  }

  /**
   * Records what the bank really paid on one day.
   *
   * What the app worked out stays exactly where it is, in `net_minor`; the
   * correction goes beside it. The day is then locked, so a recompute leaves
   * it alone — the same protection a hand-edited movement gets from a
   * re-import.
   */
  async saveDay(): Promise<void> {
    const line = this.openLine();
    const day = this.openDay();
    if (!line || !day) return;

    const minor = this.parsed();
    if (minor === null || minor < 0) {
      this.error.set(this.i18n.t('cushion.error.amount'));
      return;
    }

    this.saving.set(true);
    try {
      const { yields } = this.repos();
      await yields.correctDay(day.pocket_id, day.on_date, minor);
      this.database.dataChanged();
      await this.afterOwnChange(line.account.id);
    } catch (error) {
      this.error.set(messageOf(error));
    } finally {
      this.saving.set(false);
    }
  }

  /** Gives a corrected day back to the engine. */
  async undoDay(): Promise<void> {
    const line = this.openLine();
    const day = this.openDay();
    if (!line || !day) return;

    this.saving.set(true);
    try {
      const { yields } = this.repos();
      await yields.unlockDay(day.pocket_id, day.on_date);
      this.database.dataChanged();
      await this.afterOwnChange(line.account.id);
    } catch (error) {
      this.error.set(messageOf(error));
    } finally {
      this.saving.set(false);
    }
  }

  /** Deletes an entry and works the days out again without it. */

  /** The name of the pocket a rate belongs to, or the account itself. */
  pocketNameById(id: number | null): string {
    if (id === null) return this.i18n.t('cushion.rate.everyPocket');
    return this.editablePockets().find(pocket => pocket.id === id)?.name ?? '';
  }

  /** What an entry is called on the screen. */
  readonly allGroupsCollapsed = computed(() => {
    const groups = this.movementGroups();
    return groups.length > 0 && groups.every(group => this.collapsedGroups().has(group.key));
  });

  isGroupCollapsed(key: string): boolean {
    return this.collapsedGroups().has(key);
  }

  toggleGroup(key: string): void {
    this.collapsedGroups.update(current => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  toggleAllGroups(): void {
    this.collapsedGroups.set(this.allGroupsCollapsed()
      ? new Set()
      : new Set(this.movementGroups().map(group => group.key)));
  }

  /** In, out, or only moved between products - the dot and colour of a row. */
  movementFlow(movement: ProductMovement): 'in' | 'out' | 'moved' {
    if (movement.type === 'transfer') return 'moved';
    return movement.amountMinor < 0 ? 'out' : 'in';
  }

  stepMovementsPeriod(steps: number): void {
    this.movementsPeriod.update(period => shiftPeriod(period, steps));
  }

  chooseMovementsPeriod(kind: string): void {
    if (kind === 'range') {
      // The sheet stays open: a range needs two dates, and starts from the
      // period on screen, as on the summary.
      const current = this.movementsPeriod();
      this.movementsRangeStart.set(this.movementsRangeStart() ?? current.from ?? this.todayDay);
      this.movementsRangeEnd.set(this.movementsRangeEnd() ?? current.to ?? this.todayDay);
      this.choosingMovementsRange.set(true);
      return;
    }
    this.choosingMovementsRange.set(false);
    this.movementsPeriod.set(currentPeriod(kind as PeriodKind));
    this.showMovementsPeriodSheet.set(false);
  }

  applyMovementsRange(): void {
    const from = this.movementsRangeStart();
    const to = this.movementsRangeEnd();
    if (!from || !to) return;
    // Picked back to front is swapped rather than refused.
    const [start, end] = [from.slice(0, 10), to.slice(0, 10)].sort();
    this.movementsPeriod.set(rangePeriod(start, end));
    this.choosingMovementsRange.set(false);
    this.showMovementsPeriodSheet.set(false);
  }

  movementsRangeLabel(): string {
    const from = this.movementsRangeStart();
    const to = this.movementsRangeEnd();
    if (!from || !to) return '';
    const [start, end] = [from.slice(0, 10), to.slice(0, 10)].sort();
    return `${this.longDayText(start)} – ${this.longDayText(end)}`;
  }

  /** Opens or closes the account's movements, reading them when it opens. */
  async toggleMovements(line: CushionLine): Promise<void> {
    const open = !this.showMovements();
    this.showMovements.set(open);
    if (open) await this.loadMovements(line);
  }

  private async loadMovements(line: CushionLine): Promise<void> {
    const { yields, transactions } = this.repos();
    const rows = await transactions.listDetailed({ accountIds: [line.account.id] });
    const entries = await yields.adjustments(line.account.id);
    const withdrawals = await yields.withdrawals(line.account.id);
    const startDays = await yields.pocketStartDays(line.account.id, today());
    this.movements.set(productMovements({
      accountId: line.account.id, pockets: line.pockets, startDays, transactions: rows, entries, withdrawals,
    }));
  }

  /**
   * Opens a movement where it can be seen, corrected or deleted: one of the
   * account on the movement screen - the same the summary uses, products and
   * all - and an entry on the product alone on its income or expense screen.
   */
  openMovement(line: CushionLine, movement: ProductMovement): void {
    if (movement.type === 'entry') {
      this.cushionEntry.set({
        kind: movement.amountMinor < 0 ? 'expense' : 'income',
        account: line.account, pockets: line.pockets, editing: movement.entry as CushionEntry,
      });
      return;
    }
    if (movement.type === 'withdrawal') {
      // Nothing to correct on a movement screen: its movement is gone.
      this.orphanWithdrawal.set(movement.withdrawal);
      return;
    }
    const row = movement.transaction;
    this.movementEdit.set({
      kind: row.transfer_id !== null ? 'transfer' : row.amount_minor < 0 ? 'expense' : 'income',
      editing: row,
    });
  }

  /**
   * Deletes a withdrawal whose movement was deleted.
   *
   * A cash-in is a movement plus a withdrawal. Before the two were deleted
   * together, deleting the movement from the summary left the withdrawal
   * behind, still taking its amount off the product's balance.
   */
  async removeOrphanWithdrawal(): Promise<void> {
    const line = this.openLine();
    const withdrawal = this.orphanWithdrawal();
    if (!line || !withdrawal) return;
    this.saving.set(true);
    try {
      const { db, yields, tax } = this.repos();
      await this.report('busy.deletingMovement');
      await db.transaction(async () => {
        await yields.removeWithdrawal(withdrawal.id);
        await yields.clearDays(line.account.id, withdrawal.on_date);
      });
      await accrueAndSettle(db, yields, tax, line.account.id, today());
      // Only this account changed and it has just been worked out, so opening
      // the screen afterwards has nothing left to do.
      await yields.markAccrued(today(), { onlyIfKnown: true });
      this.orphanWithdrawal.set(null);
      this.database.dataChanged();
      await this.afterOwnChange(line.account.id);
    } catch (error) {
      this.error.set(messageOf(error));
    } finally {
      this.saving.set(false);
    }
  }

  /** Movements shown for one product, or every product's for 0. */
  setMovementsPocket(value: number): void {
    this.movementsPocket.set(value > 0 ? value : null);
  }

  /** Corrected or deleted on the movement screen: the account is worked out again. */
  async movementSaved(): Promise<void> {
    await this.report('busy.yields');
    this.movementEdit.set(null);
    const line = this.openLine();
    if (!line) return;
    // A correction can move a movement to any day, so every day is redone;
    // days corrected by hand stay, as always.
    const { db, yields, tax } = this.repos();
    await yields.clearDays(line.account.id);
    await accrueAndSettle(db, yields, tax, line.account.id, today());
    await yields.markAccrued(today(), { onlyIfKnown: true });
    this.database.dataChanged();
    await this.afterOwnChange(line.account.id);
  }

  movementTitle(line: CushionLine, movement: ProductMovement): string {
    switch (movement.type) {
      case 'transfer':
        return `${this.pocketLabel(line, movement.fromPocketId)} → ${this.pocketLabel(line, movement.toPocketId)}`;
      case 'entry':
        return this.kindLabel(movement.entry as CushionEntry);
      case 'withdrawal':
        return this.i18n.t('cushion.movements.withdrawal');
      default: {
        const row = movement.transaction;
        if (row.transfer_id !== null) {
          return this.i18n.t(row.amount_minor < 0 ? 'cushion.movements.transferTo' : 'cushion.movements.transferFrom',
            { account: row.other_account_name ?? '' });
        }
        return row.category_name ?? this.i18n.t('cushion.movements.noCategory');
      }
    }
  }

  /** The line under a movement: its day, its product, how it was made, its note. */
  movementDetail(line: CushionLine, movement: ProductMovement): string {
    const parts: string[] = [];
    if (this.movementsView() !== 'date') parts.push(this.dayText(movement.on));
    if (movement.type === 'transfer') {
      parts.push(this.i18n.t('cushion.movements.betweenProducts'));
    } else {
      if (line.pockets.length > 1) parts.push(this.pocketLabel(line, movement.pocketId));
      if (movement.type === 'entry') parts.push(this.i18n.t('cushion.entry.scope.product'));
      if (movement.type === 'transaction' && movement.cashIn) {
        parts.push(this.i18n.t(movement.amountMinor < 0
          ? 'cushion.entry.scope.netWorthExpense' : 'cushion.entry.scope.netWorthIncome'));
      }
    }
    const note = movement.type === 'entry' ? movement.entry.note
      : movement.type === 'withdrawal' ? movement.withdrawal.note
      : movement.transaction.description;
    if (note) parts.push(note);
    return parts.join(' · ');
  }

  movementIcon(movement: ProductMovement): string {
    if (movement.type === 'entry') {
      const kind = this.kindsById().get(movement.entry.product_kind_id ?? -1);
      if (kind?.builtin_icon) return kind.builtin_icon;
      if (kind) return 'pricetag-outline';
      return movement.entry.kind === 'cashback' ? 'pricetag-outline'
        : movement.entry.kind === 'correction' ? 'build-outline' : 'ellipsis-horizontal-circle-outline';
    }
    return movement.type === 'withdrawal' ? 'arrow-forward-outline' : 'swap-horizontal-outline';
  }

  private categoryOf(movement: ProductMovement): [string, string] {
    switch (movement.type) {
      case 'transfer': return ['between', this.i18n.t('cushion.movements.betweenProducts')];
      case 'entry': return [
        `kind:${movement.entry.product_kind_id ?? movement.entry.kind}`,
        this.kindLabel(movement.entry as CushionEntry),
      ];
      case 'withdrawal': return ['withdrawal', this.i18n.t('cushion.movements.withdrawal')];
      default: {
        const row = movement.transaction;
        if (row.transfer_id !== null) return [`account:${row.other_account_id}`, row.other_account_name ?? ''];
        return [`category:${row.category_id ?? 'none'}`, row.category_name ?? this.i18n.t('cushion.movements.noCategory')];
      }
    }
  }

  pocketLabel(line: CushionLine, pocketId: number): string {
    return line.pockets.find(pocket => pocket.id === pocketId)?.name ?? '';
  }

  /**
   * What an entry is called: the kind it was filed under, by name.
   *
   * An entry written before the kinds were rows of their own has none, and
   * falls back to the coarse word its column has always carried.
   */
  kindLabel(entry: CushionEntry): string {
    const kind = this.kindsById().get(entry.product_kind_id ?? -1);
    if (kind) return kind.name;
    if (entry.kind === 'cashback') return this.i18n.t('cushion.kind.cashback');
    if (entry.kind === 'other') return this.i18n.t('cushion.kind.other');
    return this.i18n.t('cushion.kind.correction');
  }

  /** The kinds themselves, for the name and the picture on a row. */
  readonly productKinds = signal<ProductKind[]>([]);
  readonly kindsById = computed(() => new Map(this.productKinds().map(kind => [kind.id, kind])));

  /** The image a kind wears, when it wears one of the user's own. */
  kindIconId(entry: CushionEntry): number | null {
    return this.kindsById().get(entry.product_kind_id ?? -1)?.custom_icon_id ?? null;
  }

  /**
   * Reloads the sheet in place, so a correction is visible immediately.
   *
   * `openLine` holds a snapshot taken when the sheet opened. Reloading the
   * list underneath does not touch it, so going back from the settings still
   * showed the figure from before the edit until the whole screen was left
   * and re-entered.
   */
  private parsed(): number | null {
    const raw = this.amount().trim();
    if (raw.length === 0) return null;
    try {
      // An adjustment may be negative; the other two are checked above.
      const negative = raw.startsWith('-');
      // The tolerant parser, for the same reason the product editor uses it:
      // the figure being typed is usually the one this app just displayed, in
      // Colombian format, and the strict parser rejects its own output.
      const minor = parseTypedAmountToMinor(negative ? raw.slice(1) : raw);
      return negative ? -minor : minor;
    } catch {
      return null;
    }
  }

  // ---------------------------------------------------------------------------
  // Formatting
  //
  // Intl directly rather than Angular's number pipe: the pipe formats in the
  // app's locale, which is en-US, and would print 3,116.47 for a figure a
  // Colombian reads as 3.116,47.
  // ---------------------------------------------------------------------------

  /** Everything the products hold, which is the account plus its yields. */
  totalHeld(line: CushionLine): number {
    return line.pockets.reduce((sum, pocket) => sum + this.balanceIn(line, pocket.id), 0);
  }
  /**
   * The figure typed into the form right now, in minor units.
   *
   * Read from the field rather than from the database so the breakdown
   * below it follows what is being typed: change the balance and the sum
   * re-adds itself, which is how it can be checked against the bank while
   * the correction is still being made.
   */
  statedNow(): number {
    return parseOrNull(this.pocketAmount()) ?? 0;
  }
  /** What one product holds today. Zero when nothing is known about it. */
  heldIn(line: CushionLine, pocketId: number): number {
    return line.heldByPocket.get(pocketId) ?? 0;
  }

  /**
   * How much of the product's balance is yield the bank paid, for the line
   * under it. An income or expense someone enters is not a yield. Never more
   * than the balance: money moved out takes its share with it.
   */
  yieldIn(line: CushionLine, pocketId: number): number {
    const paid = line.paidYieldByPocket.get(pocketId) ?? 0;
    return Math.max(0, Math.min(paid, this.balanceIn(line, pocketId)));
  }

  /**
   * A money field: what was typed, regrouped as it is typed - dots between
   * thousands, a comma before the cents - so six million reads as six million.
   */
  amountTyped(target: unknown, allowNegative = false): string {
    const input = target as { value?: string | number | null } | null;
    const grouped = groupTypedAmount(String(input?.value ?? ''), { allowNegative });
    if (input && String(input.value ?? '') !== grouped) input.value = grouped;
    return grouped;
  }

  /** What was typed, minus signs taken out: a rate or a balance is never negative. */
  unsigned(target: unknown): string {
    const input = target as { value?: string | number | null } | null;
    const clean = String(input?.value ?? '').replace(/-/g, '');
    if (input && String(input.value ?? '') !== clean) input.value = clean;
    return clean;
  }

  /** The product's balance as its bank shows it: what it holds plus the yields paid into it. */
  balanceIn(line: CushionLine, pocketId: number): number {
    return this.heldIn(line, pocketId) + (line.landedByPocket.get(pocketId) ?? 0);
  }
  /** The size of a difference, without its direction. */
  abs(value: number): number {
    return Math.abs(value);
  }

  money(minor: number, currency = 'COP'): string {
    const formatted = new Intl.NumberFormat('es-CO', {
      minimumFractionDigits: 2, maximumFractionDigits: 2,
    }).format(minor / 100);
    return currency === 'COP' ? formatted : `${formatted} ${currency}`;
  }

  /** `90000` -> `9,00 %`. */
  rateText(scaled: number | null | undefined): string {
    if (scaled === null || scaled === undefined) return '—';
    return `${new Intl.NumberFormat('es-CO', {
      minimumFractionDigits: 2, maximumFractionDigits: 4,
    }).format((scaled / EA_SCALE) * 100)} % E.A.`;
  }

  /** One end of a range, as it reads on its button. */
  dayShown(iso: string | null): string {
    return iso ? this.longDayText(iso.slice(0, 10) as IsoDate) : '—';
  }

  dayText(iso: IsoDate): string {
    const [year, month, day] = iso.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString(
      this.i18n.language() === 'en' ? 'en-GB' : 'es-CO',
      { day: 'numeric', month: 'short', timeZone: 'UTC' });
  }

  longDayText(iso: IsoDate): string {
    const [year, month, day] = iso.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString(
      this.i18n.language() === 'en' ? 'en-GB' : 'es-CO',
      { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  }

  netOf(day: YieldDay | null): number {
    return netOf(day);
  }

  /** The image an account wears, when it wears one rather than an icon. */
  imageOf(account: AccountRow): string | undefined {
    return this.customIcons.urlFor(account.custom_icon_id);
  }

  iconOf(account: AccountRow): string {
    return outlined(account.builtin_icon);
  }

  /**
   * Where a rate stands today: running, not started, or over.
   *
   * The screen used to say "no longer applies" for anything with a rate
   * dated after it, which is wrong whenever that next rate starts in the
   * future: 6.5% from September with 5% announced for November is the rate
   * in force, not an expired one. Three states, told apart by today.
   */
  rateStatus(rate: YieldRate): 'future' | 'current' | 'ended' {
    const now = today();
    if (rate.valid_from > now) return 'future';
    if (rate.valid_to !== null && rate.valid_to < now) return 'ended';

    const replaced = this.endedOn(rate);
    return replaced !== null && replaced < now ? 'ended' : 'current';
  }

  /** The day a rate stops, whether it was given an end or superseded. */
  rateEndsOn(rate: YieldRate): IsoDate | null {
    const superseded = this.endedOn(rate);
    if (rate.valid_to === null) return superseded;
    if (superseded === null) return rate.valid_to;
    return rate.valid_to < superseded ? rate.valid_to : superseded;
  }

  /**
   * When a rate stopped applying, or null while it still does.
   *
   * There is no end date stored, and deliberately: the next rate for the
   * same component ends the previous one, so the history can never
   * contradict itself. But a screen that does not say so leaves someone
   * looking at a 7.5% that stopped yesterday wondering whether it still
   * counts - which is exactly what happened with Lulo.
   */
  endedOn(rate: YieldRate): IsoDate | null {
    const next = this.rates()
      .filter(other => other.component === rate.component
        // Same product, or both belonging to the account. A rate of the
        // account does not end a rate of a product: they are different
        // scopes, and the engine already keeps them apart — a product with
        // rates of its own uses only those. Without this the 6.5% set on
        // Plata's savings product read as "from 8 Sept to 8 Sept", ended by
        // an account-wide rate that never applied to it.
        && (other.pocket_id ?? null) === (rate.pocket_id ?? null)
        && other.min_balance_minor === rate.min_balance_minor
        && other.valid_from > rate.valid_from)
      .sort((a, b) => a.valid_from.localeCompare(b.valid_from))[0];

    return next ? addDays(next.valid_from, -1) : null;
  }

}

/** An amount as typed, or null when it is not one. An empty field is zero. */
/**
   * An amount typed on this screen, or null when it is not one.
   *
   * Empty used to come back as zero, so a field left blank - or one whose
   * contents had failed to load - saved a balance of nothing at all without a
   * word. That is the worst possible default here: a product silently set to
   * zero stops earning and takes its history with it.
   *
   * And the parsing is the tolerant one. The strict parser takes a plain
   * decimal and nothing else, which meant the figure this app had just
   * displayed - 4.917.434,98 - was rejected when typed back into its own form.
   */
function parseOrNull(raw: string): number | null {
  if (raw.trim().length === 0) return null;
  try {
    return parseTypedAmountToMinor(raw);
  } catch {
    return null;
  }
}

/** What a day actually added to the cushion: the correction if there is one. */
function netOf(day: YieldDay | null): number {
  if (!day) return 0;
  return day.actual_net_minor ?? day.net_minor;
}

/** A stored amount as a money field shows it: "6.000.000,50", not "6000000.50". */
function decimalOf(minor: number): string {
  return typedAmountOf(minor);
}

/** Today where the user is, never the UTC day. See `todayIso`. */
function today(): IsoDate {
  return todayIso();
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
