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
  IonList, IonItem, IonLabel, IonNote, IonSpinner, IonMenuButton, IonModal,
  IonInput, IonTextarea, IonSelect, IonSelectOption, IonToggle,
} from '@ionic/angular';

import { DatabaseService } from '../../core/database/database.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { LanguageButtonComponent } from '../../core/i18n/language-button.component';
import { I18nService } from '../../core/i18n/i18n.service';
import { AccountsRepository } from '../../core/database/repositories/accounts.repository';
import { CategoriesRepository } from '../../core/database/repositories/categories.repository';
import { TransactionsRepository } from '../../core/database/repositories/transactions.repository';
import { TaxParametersRepository } from '../../core/database/repositories/tax-parameters.repository';
import {
  YieldsRepository, type CushionBalance, type CushionEntry, type YieldDay,
  type YieldPocket, type YieldRate,
} from '../../core/database/repositories/yields.repository';
import { AccrualEngine } from '../../core/yields/accrual';
import { EA_SCALE, parsePercentToScaled, scaledPercentToString } from '../../core/yields/yield-math';
import { addDays, endOfMonth } from '../../core/yields/days';
import { parseTypedAmountToMinor } from '../../core/database/money';
import type { AccountRow, CategoryRow, IsoDate } from '../../core/database/types';
import { outlined } from '../../core/icons/icon-catalog';
import { CustomIconsService } from '../../core/icons/custom-icons.service';
import { IconComponent } from '../../core/icons/icon.component';

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
  earnsOnMinor: number;
  /**
   * What the products say they hold, minus what the account holds.
   *
   * Zero when they agree. A product's balance is a figure read off the bank
   * and it stays that figure until another is entered, so moving money from
   * one product to another leaves this non-zero until both are updated -
   * which is the only warning there can be, since a movement never says which
   * product inside an account it came from.
   */
  driftMinor: number;
}

/** One thing the bank actually hands over: a day, or a whole month. */
interface Payment {
  key: string;
  component: string;
  payout: 'daily' | 'monthly';
  on: IsoDate;
  netMinor: number;
  withheldMinor: number;
  pending: boolean;
  days: number;
}

@Component({
  selector: 'app-cushion',
  templateUrl: './cushion.page.html',
  styleUrls: ['./cushion.page.scss'],
  imports: [
    IconComponent,
    TranslatePipe, LanguageButtonComponent,
    IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonIcon,
    IonList, IonItem, IonLabel, IonNote, IonSpinner, IonMenuButton, IonModal,
    IonInput, IonTextarea, IonSelect, IonSelectOption, IonToggle,
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
  readonly error = signal('');

  /** The last day the accrual reached, across every account. */
  readonly lastAccrued = signal<IsoDate | null>(null);

  /** The account whose detail sheet is open. */
  readonly openLine = signal<CushionLine | null>(null);
  readonly openDays = signal<YieldDay[]>([]);

  /** Which form is showing inside the detail sheet. */
  readonly form = signal<'none' | 'adjust' | 'withdraw' | 'day' | 'settings' | 'rate' | 'pocket'>('none');
  readonly openDay = signal<YieldDay | null>(null);
  readonly amount = signal('');
  readonly note = signal('');
  readonly onDate = signal<IsoDate>(today());
  readonly categoryId = signal<number | null>(null);
  readonly incomeCategories = signal<CategoryRow[]>([]);
  readonly saving = signal(false);

  /** The settings form, filled from the account being edited. */
  readonly openingAmount = signal('');
  readonly openingDate = signal<IsoDate>(today());
  readonly withholds = signal(true);
  readonly payout = signal<'daily' | 'monthly'>('daily');
  private editingEnabled = true;
  readonly rates = signal<YieldRate[]>([]);
  readonly editablePockets = signal<YieldPocket[]>([]);

  /** What kind of money an entry is, and where it landed. */
  readonly entryKind = signal<'cashback' | 'correction' | 'other'>('cashback');
  readonly entryPocket = signal<number | null>(null);

  /** Everything that has landed in the open account's cushion by hand. */
  readonly entries = signal<CushionEntry[]>([]);

  /** The pocket form. */
  readonly editingPocket = signal<YieldPocket | null>(null);
  readonly pocketName = signal('');
  readonly pocketSource = signal<'ledger' | 'manual'>('manual');
  readonly pocketAmount = signal('');
  readonly pocketFrom = signal<IsoDate>(today());

  /** The rate form. */
  /**
   * Whether a new rate replaces one that is running or joins it.
   *
   * The engine decides this by the component name - same name supersedes,
   * different name adds up - and that rule was invisible: the only way to
   * get a second rate running alongside was to guess that the free-text
   * name was load-bearing. Uala's two rates exist because a migration
   * named them apart, which nobody could have worked out from the screen.
   */
  readonly rateMode = signal<'replace' | 'add'>('replace');
  /**
   * Which products a rate applies to. Empty means all of them.
   *
   * One rate covering several products is the ordinary case, not a special
   * one: Dale pays 10.5% on Principal and on Complemento but not on the
   * savings account beside them. It used to be one product or all of them,
   * which left "these two" unsayable — the rate had to be typed twice, and
   * then corrected twice, and the second copy was the one that got forgotten.
   *
   * Stored as one row per product, which the schema already allowed. Rates
   * that agree on everything but the product are shown and edited as one.
   */
  readonly ratePockets = signal<ReadonlySet<number>>(new Set());

  toggleRatePocket(id: number): void {
    this.ratePockets.update(current => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  isRatePocket(id: number): boolean {
    return this.ratePockets().has(id);
  }
  readonly rateUntil = signal<IsoDate | ''>('');

  /** Armed once, acted on twice: a destructive button should ask first. */
  readonly confirmingStop = signal(false);
  readonly editingRate = signal<YieldRate | null>(null);
  readonly rateComponent = signal('base');
  readonly ratePayout = signal<'daily' | 'monthly'>('daily');
  readonly ratePercent = signal('');
  readonly rateFrom = signal<IsoDate>(today());
  readonly rateSpend = signal('');
  readonly rateFallback = signal('');

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
    .reduce((sum, line) => sum + line.cushion.totalMinor, 0));

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
    effect(() => {
      // Read the two things that should re-run this, and nothing else.
      this.database.dataVersion();
      const ready = this.database.status() === 'ready';

      // Everything inside runs outside the tracking context: refresh() writes
      // signals, and any of them read on its way in would become a dependency
      // of this effect and start it again as soon as it finished.
      untracked(() => {
        if (ready) void this.refresh();
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
    if (this.busy) return;
    this.busy = true;
    this.working.set(true);
    this.error.set('');
    try {
      const { db, yields, tax } = this.repos();
      await new AccrualEngine(db, yields, tax).accrueAll(today());
      await this.load();
    } catch (error) {
      this.error.set(messageOf(error));
    } finally {
      this.working.set(false);
      this.busy = false;
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
      await new AccrualEngine(db, yields, tax).accrueAll(today());
      await this.load();
    } catch (error) {
      this.error.set(messageOf(error));
    } finally {
      this.working.set(false);
      this.busy = false;
    }
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    try {
      const { db, accounts, categories, yields, tax } = this.repos();
      const engine = new AccrualEngine(db, yields, tax);
      const enrolled = await yields.accounts();
      const all = await accounts.list({ includeArchived: true });
      const byId = new Map(all.map(account => [account.id, account]));

      const lines: CushionLine[] = [];
      let newest: IsoDate | null = null;

      for (const entry of enrolled) {
        const account = byId.get(entry.account_id);
        if (!account) continue;

        const last = await yields.lastAccruedDay(entry.account_id);
        if (last && (newest === null || last > newest)) newest = last;

        const bands = await yields.bandsInForce(entry.account_id, today());
        const pockets = await yields.pockets(entry.account_id);
        const daysOfLast = last ? await yields.days(entry.account_id, last, last) : [];

        lines.push({
          account,
          cushion: await yields.cushion(entry.account_id),
          rate: bands[0] ?? null,
          enabled: entry.enabled !== 0,
          pockets,
          lastDayMinor: daysOfLast.reduce((sum, day) => sum + netOf(day), 0),
          // One figure per POCKET, not per row. A day of an account with two
          // rate components is two rows carrying the same base, and adding
          // them showed Uala earning on twice what it holds.
          earnsOnMinor: [...new Map(daysOfLast.map(day => [day.pocket_id, day])).values()]
            .reduce((sum, day) => sum + day.balance_minor, 0),
          driftMinor: await engine.drift(entry.account_id, today()),
        });
      }

      lines.sort((a, b) => b.cushion.totalMinor - a.cushion.totalMinor);
      this.lines.set(lines);
      this.lastAccrued.set(newest);
      this.incomeCategories.set(await categories.list({ kind: 'income' }));
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
      const on = monthly ? endOfMonth(day.on_date) : day.on_date;
      const key = `${day.component}|${on}`;

      const payment = out.get(key) ?? {
        key, component: day.component, payout: day.payout, on,
        netMinor: 0, withheldMinor: 0, pending: monthly && on > todayIso, days: 0,
      };
      payment.netMinor += netOf(day);
      payment.withheldMinor += day.withholding_minor;
      payment.days += 1;
      out.set(key, payment);
    }

    return [...out.values()].sort((a, b) => b.on.localeCompare(a.on));
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
    this.openLine.set(line);
    this.form.set('none');
    this.resetForm();
    const { yields } = this.repos();
    // Newest first: the day someone came here to check is almost always a
    // recent one, and the list can run to thousands.
    const days = (await yields.days(line.account.id)).reverse();
    this.openDays.set(days);
    // The month someone came here to look at is almost always this one.
    this.openMonths.set(new Set(days.length > 0 ? [days[0].on_date.slice(0, 7)] : []));
    this.openWorkings.set(new Set());
    this.entries.set((await yields.adjustments(line.account.id)).reverse());
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
   * A rate and a pocket are opened from the settings, so back from either
   * is the settings, not the account. Closing outright is the X's job, and
   * conflating the two is how someone loses a form they were filling in.
   */
  async back(): Promise<void> {
    const where = this.form();
    if (where === 'rate' || where === 'pocket') {
      await this.openSettings();
    } else {
      this.form.set('none');
    }
  }

  startForm(which: 'adjust' | 'withdraw'): void {
    this.resetForm();
    this.form.set(which);
  }

  /** Opens one day so it can be checked against a statement and corrected. */
  openDayForm(day: YieldDay): void {
    this.resetForm();
    this.openDay.set(day);
    this.amount.set(decimalOf(day.actual_net_minor ?? day.net_minor));
    this.form.set('day');
  }

  /**
   * Opens the settings of the account, filled with what is stored.
   *
   * Everything here was written by a migration until now, which meant every
   * rate change went through a developer. A bank changes its rate by email on
   * a Tuesday; this is the screen that has to keep up with that.
   */
  async openSettings(): Promise<void> {
    const line = this.openLine();
    if (!line) return;

    const { yields } = this.repos();
    const entry = await yields.account(line.account.id);
    this.openingAmount.set(decimalOf(entry?.opening_cushion_minor ?? 0));
    this.openingDate.set(entry?.opening_on ?? today());
    this.withholds.set(entry?.withholding !== 0);
    this.payout.set(entry?.payout ?? 'daily');
    this.editingEnabled = entry?.enabled !== 0;
    this.rates.set(await yields.rateHistory(line.account.id));
    this.editablePockets.set(await yields.pockets(line.account.id));
    this.form.set('settings');
  }

  /**
   * Saves the opening figure, the withholding switch and what is not earning.
   *
   * Changing any of them changes every day computed since, so the days are
   * thrown away and worked out again - except the ones corrected by hand,
   * which are a statement's word against a formula's and always win.
   */
  async saveSettings(): Promise<void> {
    const line = this.openLine();
    if (!line) return;

    const opening = parseOrNull(this.openingAmount());
    if (opening === null || opening < 0) {
      this.error.set(this.i18n.t('cushion.error.amount'));
      return;
    }

    this.saving.set(true);
    try {
      const { db, yields, tax } = this.repos();
      await db.transaction(async () => {
        await yields.enrol({
          account_id: line.account.id,
          default_pocket_name: this.i18n.t('cushion.pocket.defaultName'),
          opening_cushion_minor: opening,
          opening_on: this.openingDate(),
          withholding: this.withholds(),
          payout: this.payout(),
          // Saving settings must not quietly restart an account that was paused.
          enabled: this.editingEnabled,
        });
        await yields.clearDays(line.account.id);
      });

      await new AccrualEngine(db, yields, tax).accrue(line.account.id, today());
      await this.reopen(line);
    } catch (error) {
      this.error.set(messageOf(error));
    } finally {
      this.saving.set(false);
    }
  }

  /** Stops accruing an account, keeping everything already worked out. */
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
      await this.reopen(line);
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
      await this.reopen(line);
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

    this.editingPocket.set(pocket);
    this.pocketName.set(pocket?.name ?? '');
    this.pocketSource.set(pocket?.source ?? 'manual');

    if (pocket) {
      const { yields } = this.repos();
      const history = await yields.pocketBalances(pocket.id);
      const current = history.filter(row => row.valid_from <= today()).at(-1);

      // Both halves of what was recorded, not just the figure. The date was
      // reset to today every time this opened, so the screen said the balance
      // had been read today whatever the truth was - and saving again wrote a
      // fresh entry dated today, quietly moving a figure Jose had deliberately
      // dated to the day he read it off the bank.
      this.pocketAmount.set(current ? decimalOf(current.amount_minor) : '');
      this.pocketFrom.set(current?.valid_from ?? today());
    } else {
      this.pocketAmount.set('');
      this.pocketFrom.set(today());
    }
    this.form.set('pocket');
  }

  /**
   * Saves a pocket and the figure it holds.
   *
   * The figure is what the bank says that pocket holds today, which already
   * includes every yield the bank has paid into it. That is why it replaces
   * the base rather than adding to it.
   */
  async savePocket(): Promise<void> {
    const line = this.openLine();
    if (!line) return;

    const name = this.pocketName().trim();
    if (name.length === 0) {
      this.error.set(this.i18n.t('cushion.error.name'));
      return;
    }

    const manual = this.pocketSource() === 'manual';
    const amount = manual ? parseOrNull(this.pocketAmount()) : 0;
    if (amount === null || amount < 0) {
      this.error.set(this.i18n.t('cushion.error.amount'));
      return;
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
              source: manual ? 'manual' : 'ledger',
              sort_order: line.pockets.length,
            });

        if (existing) {
          await yields.renamePocket(id, name);
          await yields.setPocketSource(id, manual ? 'manual' : 'ledger');
        }
        if (manual) {
          await yields.setPocketBalance({
            pocket_id: id, valid_from: this.pocketFrom(), amount_minor: amount,
          });
        }

        // Every pocket of the account is worked out again from that date: a
        // figure moving between pockets changes what the others earn on too.
        await yields.clearDays(line.account.id, this.pocketFrom());
      });

      await new AccrualEngine(db, yields, tax).accrue(line.account.id, today());
      await this.reopen(line, true);
    } catch (error) {
      this.error.set(messageOf(error));
    } finally {
      this.saving.set(false);
    }
  }

  /** Removes a pocket, and the days it earned with it. */
  async deletePocket(): Promise<void> {
    const line = this.openLine();
    const pocket = this.editingPocket();
    if (!line || !pocket) return;

    if (line.pockets.length <= 1) {
      this.error.set(this.i18n.t('cushion.error.lastPocket'));
      return;
    }

    this.saving.set(true);
    try {
      const { db, yields, tax } = this.repos();
      await db.transaction(async () => {
        await yields.removePocket(pocket.id);
        await yields.clearDays(line.account.id);
      });
      await new AccrualEngine(db, yields, tax).accrue(line.account.id, today());
      this.database.dataChanged();
      await this.openSettings();
    } catch (error) {
      this.error.set(messageOf(error));
    } finally {
      this.saving.set(false);
    }
  }

  /**
   * The products carrying a rate identical to this one.
   *
   * Same component, same dates, same figures - that is one rate the bank pays
   * on several products, written as several rows because the schema stores a
   * rate against one product. Grouping them back together is what lets the
   * screen show and correct it as the single thing it is.
   */
  private pocketsSharingRows(rate: YieldRate): YieldRate[] {
    return this.rates().filter(other =>
      other.component === rate.component
      && other.valid_from === rate.valid_from
      && (other.valid_to ?? null) === (rate.valid_to ?? null)
      && other.annual_rate_scaled === rate.annual_rate_scaled);
  }

  private pocketsSharing(rate: YieldRate): Set<number> {
    const same = this.rates().filter(other =>
      other.component === rate.component
      && other.valid_from === rate.valid_from
      && (other.valid_to ?? null) === (rate.valid_to ?? null)
      && other.annual_rate_scaled === rate.annual_rate_scaled
      && other.pocket_id !== null);

    return new Set(same.map(other => other.pocket_id as number));
  }

  /**
   * The components an account already has, each with the rate in force.
   *
   * What a new rate can replace, and what it would sit beside.
   */
  readonly components = computed(() => {
    const newest = new Map<string, YieldRate>();
    for (const rate of this.rates()) {
      if (rate.pocket_id !== null && !this.ratePockets().has(rate.pocket_id)) continue;
      const current = newest.get(rate.component);
      if (!current || rate.valid_from > current.valid_from) newest.set(rate.component, rate);
    }
    return [...newest.values()];
  });

  /** A new rate from a date, or an existing one opened to be corrected. */
  startRateForm(rate: YieldRate | null = null): void {
    this.editingRate.set(rate);
    this.rateMode.set(this.components().length > 0 ? 'replace' : 'add');
    this.ratePockets.set(rate ? this.pocketsSharing(rate) : new Set<number>());
    this.rateUntil.set(rate?.valid_to ?? '');
    this.rateComponent.set(rate?.component ?? this.components()[0]?.component ?? 'base');
    this.ratePayout.set(rate?.payout ?? 'daily');
    this.ratePercent.set(rate ? scaledPercentToString(rate.annual_rate_scaled) : '');
    this.rateFrom.set(rate?.valid_from ?? today());
    this.rateSpend.set(rate?.requires_monthly_spend_minor ? decimalOf(rate.requires_monthly_spend_minor) : '');
    this.rateFallback.set(rate?.fallback_annual_rate_scaled != null
      ? scaledPercentToString(rate.fallback_annual_rate_scaled) : '');
    this.form.set('rate');
  }

  /**
   * Records a rate from a date. A change is always a new row.
   *
   * Editing the old one would rewrite what was true last month, and the days
   * already computed under it would stop being explainable. The rate in force
   * on a day is the most recent row on or before it, so a rate dated in the
   * future simply waits its turn - which is how Plata's drop to 9% on
   * 2026-11-09 was recorded two months early.
   */
  async saveRate(): Promise<void> {
    const line = this.openLine();
    if (!line) return;

    const name = this.rateComponent().trim();
    if (name.length === 0) {
      this.error.set(this.i18n.t('cushion.error.name'));
      return;
    }
    if (!this.editingRate() && this.rateMode() === 'add'
        && this.components().some(rate => rate.component === name)) {
      // Same name means "this replaces that one", which is the other button.
      this.error.set(this.i18n.t('cushion.error.componentTaken'));
      return;
    }

    let scaled: number;
    let fallback: number | null = null;
    try {
      scaled = parsePercentToScaled(this.ratePercent());
      if (this.rateFallback().trim().length > 0) {
        fallback = parsePercentToScaled(this.rateFallback());
      }
    } catch {
      this.error.set(this.i18n.t('cushion.error.rate'));
      return;
    }

    const typedSpend = this.rateSpend().trim();
    const spend = typedSpend.length > 0 ? parseOrNull(typedSpend) : null;
    if (typedSpend.length > 0 && (spend === null || spend <= 0)) {
      this.error.set(this.i18n.t('cushion.error.amount'));
      return;
    }

    this.saving.set(true);
    try {
      const { db, yields, tax } = this.repos();
      const existing = this.editingRate();
      await db.transaction(async () => {
        const common = {
          component: name,
          payout: this.ratePayout(),
          valid_from: this.rateFrom(),
          valid_to: this.rateUntil() || null,
          annual_rate_scaled: scaled,
          requires_monthly_spend_minor: spend,
          fallback_annual_rate_scaled: fallback,
        };

        // One row per product the rate covers, or a single row covering the
        // whole account when none is named. Correcting replaces the old set
        // outright rather than editing it: which products a rate covers is
        // part of what is being corrected, so the products dropped from it
        // have to lose the rate, and the ones added have to gain it.
        const chosen = [...this.ratePockets()];
        const rows = chosen.length > 0
          ? chosen.map(pocket_id => ({ ...common, pocket_id }))
          : [{ ...common, pocket_id: null }];

        if (existing) {
          for (const other of this.pocketsSharingRows(existing)) {
            await yields.removeRate(other.id);
          }
          if (this.pocketsSharing(existing).size === 0) await yields.removeRate(existing.id);
        }
        for (const row of rows) {
          await yields.setRate({ account_id: line.account.id, ...row });
        }
        // From the earliest day either version of the rate touches. Moving
        // a rate backwards has to redo the days it now covers as well.
        const redoFrom = existing && existing.valid_from < this.rateFrom()
          ? existing.valid_from : this.rateFrom();
        await yields.clearDays(line.account.id, redoFrom);
      });

      await new AccrualEngine(db, yields, tax).accrue(line.account.id, today());
      await this.reopen(line, true);
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
      await new AccrualEngine(db, yields, tax).accrue(line.account.id, today());
      this.database.dataChanged();
      await this.openSettings();
    } catch (error) {
      this.error.set(messageOf(error));
    } finally {
      this.saving.set(false);
    }
  }

  /** Adds an account to the module, with nothing accrued and no rate yet. */
  async enrol(account: AccountRow): Promise<void> {
    this.saving.set(true);
    try {
      const { yields } = this.repos();
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
      this.picking.set(false);
      this.database.dataChanged();
    } catch (error) {
      this.error.set(messageOf(error));
    } finally {
      this.saving.set(false);
    }
  }

  private resetForm(): void {
    this.error.set('');
    this.confirmingStop.set(false);
    this.entryKind.set('cashback');
    this.entryPocket.set(null);
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
      await this.reopen(line);
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
      await this.reopen(line);
    } catch (error) {
      this.error.set(messageOf(error));
    } finally {
      this.saving.set(false);
    }
  }

  /** Deletes an entry and works the days out again without it. */
  async removeEntry(entry: CushionEntry): Promise<void> {
    const line = this.openLine();
    if (!line) return;

    this.saving.set(true);
    try {
      const { db, yields, tax } = this.repos();
      await db.transaction(async () => {
        await yields.removeAdjustment(entry.id);
        await yields.clearDays(line.account.id, entry.on_date);
      });
      await new AccrualEngine(db, yields, tax).accrue(line.account.id, today());
      this.database.dataChanged();
      await this.reopen(line);
    } catch (error) {
      this.error.set(messageOf(error));
    } finally {
      this.saving.set(false);
    }
  }

  /** The name of the pocket a rate belongs to, or the account itself. */
  pocketNameById(id: number | null): string {
    if (id === null) return this.i18n.t('cushion.rate.everyPocket');
    return this.editablePockets().find(pocket => pocket.id === id)?.name ?? '';
  }

  /** What an entry is called on the screen. */
  kindLabel(entry: CushionEntry): string {
    if (entry.kind === 'cashback') return this.i18n.t('cushion.kind.cashback');
    if (entry.kind === 'other') return this.i18n.t('cushion.kind.other');
    return this.i18n.t('cushion.kind.correction');
  }

  /**
   * Reloads the sheet in place, so a correction is visible immediately.
   *
   * `openLine` holds a snapshot taken when the sheet opened. Reloading the
   * list underneath does not touch it, so going back from the settings still
   * showed the figure from before the edit until the whole screen was left
   * and re-entered.
   */
  private async reopen(line: CushionLine, keepForm = false): Promise<void> {
    const form = this.form();
    await this.refresh();

    const fresh = this.lines().find(row => row.account.id === line.account.id);
    if (!fresh) { this.closeDetail(); return; }

    await this.open(fresh);
    if (keepForm) await this.openSettings();
    else if (form === 'day') this.form.set('none');
  }

  /**
   * Records the gap between what the app worked out and what the bank paid.
   *
   * For when the difference belongs to no particular day — a monthly deposit
   * that came in short, a condition nobody wrote down. The daily history is
   * left as it is: it is the evidence of what was computed and why.
   */
  async saveAdjustment(): Promise<void> {
    const line = this.openLine();
    if (!line) return;

    const minor = this.parsed();
    if (minor === null || minor === 0) {
      this.error.set(this.i18n.t('cushion.error.amount'));
      return;
    }

    this.saving.set(true);
    try {
      const { db, yields, tax } = this.repos();
      await db.transaction(async () => {
        await yields.adjust({
          account_id: line.account.id,
          on_date: this.onDate(),
          amount_minor: minor,
          kind: this.entryKind(),
          pocket_id: this.entryPocket(),
          note: this.note().trim() || null,
        });

        // Money that lands on a day changes what every day after it earns
        // on, so those days are worked out again. Anything corrected by
        // hand is left alone, as always.
        await yields.clearDays(line.account.id, this.onDate());
      });

      await new AccrualEngine(db, yields, tax).accrue(line.account.id, today());
      await this.reopen(line);
    } catch (error) {
      this.error.set(messageOf(error));
    } finally {
      this.saving.set(false);
    }
  }

  /**
   * Moves part of the cushion into the account, where it becomes real money.
   *
   * Two things are written together and neither makes sense alone: an income
   * movement in the ledger, and the withdrawal that records the cushion going
   * down. The withdrawal points at the movement, which is what stops the same
   * money being counted twice — once as cushion and once as balance.
   */
  async saveWithdrawal(): Promise<void> {
    const line = this.openLine();
    if (!line) return;

    const minor = this.parsed();
    if (minor === null || minor <= 0) {
      this.error.set(this.i18n.t('cushion.error.amount'));
      return;
    }
    if (minor > line.cushion.totalMinor) {
      this.error.set(this.i18n.t('cushion.error.tooMuch'));
      return;
    }

    this.saving.set(true);
    try {
      const { db, yields, transactions } = this.repos();
      await db.transaction(async () => {
        const transactionId = await transactions.create({
          account_id: line.account.id,
          category_id: this.categoryId(),
          occurred_on: this.onDate(),
          amount_minor: minor,
          description: this.note().trim() || null,
          source: 'manual',
          // Typed by a person, so a re-import must never touch it.
          locked: true,
        });

        await yields.withdraw({
          account_id: line.account.id,
          on_date: this.onDate(),
          amount_minor: minor,
          transaction_id: transactionId,
          note: this.note().trim() || null,
        });
      });

      await this.reopen(line);
    } catch (error) {
      this.error.set(messageOf(error));
    } finally {
      this.saving.set(false);
    }
  }

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

function decimalOf(minor: number): string {
  return (minor / 100).toFixed(2);
}

function today(): IsoDate {
  return new Date().toISOString().slice(0, 10);
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
