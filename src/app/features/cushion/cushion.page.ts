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
  YieldsRepository, type CushionBalance, type YieldDay, type YieldPocket, type YieldRate,
} from '../../core/database/repositories/yields.repository';
import { AccrualEngine } from '../../core/yields/accrual';
import { EA_SCALE, parsePercentToScaled, scaledPercentToString } from '../../core/yields/yield-math';
import { parseAmountToMinor } from '../../core/database/money';
import type { AccountRow, CategoryRow, IsoDate } from '../../core/database/types';
import { outlined } from '../../core/icons/icon-catalog';

/** One row of the list: an enrolled account and what its cushion is worth. */
interface CushionLine {
  account: AccountRow;
  cushion: CushionBalance;
  /** The rate in force today, for the subtitle. Null when none is recorded. */
  rate: YieldRate | null;
  notEarningMinor: number;
  /** False when the account is paused: kept, shown, not accrued. */
  enabled: boolean;
  /** The pots this account is split into. Always at least one. */
  pockets: YieldPocket[];
  /**
   * What the pockets say the account holds, against what the ledger says.
   *
   * They can disagree: a movement never says which pocket it landed in, so a
   * hand-entered figure goes stale as money comes and goes. Null when there is
   * nothing to compare - an account whose only pocket follows the ledger can
   * never drift.
   */
  driftMinor: number | null;
  /** What this account earned on the most recent day worked out, all pockets. */
  lastDayMinor: number;
}

@Component({
  selector: 'app-cushion',
  templateUrl: './cushion.page.html',
  styleUrls: ['./cushion.page.scss'],
  imports: [
    TranslatePipe, LanguageButtonComponent,
    IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonIcon,
    IonList, IonItem, IonLabel, IonNote, IonSpinner, IonMenuButton, IonModal,
    IonInput, IonTextarea, IonSelect, IonSelectOption, IonToggle,
  ],
})
export class CushionPage {
  readonly database = inject(DatabaseService);
  private readonly i18n = inject(I18nService);
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
  private editingEnabled = true;
  readonly notEarning = signal('');
  readonly notEarningFrom = signal<IsoDate>(today());
  readonly rates = signal<YieldRate[]>([]);
  readonly editablePockets = signal<YieldPocket[]>([]);

  /** The pocket form. */
  readonly editingPocket = signal<YieldPocket | null>(null);
  readonly pocketName = signal('');
  readonly pocketSource = signal<'ledger' | 'manual'>('manual');
  readonly pocketAmount = signal('');
  readonly pocketFrom = signal<IsoDate>(today());

  /** The rate form. */
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
      const { accounts, categories, yields } = this.repos();
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
        const excluded = await yields.excludedHistory(entry.account_id);
        const inForce = excluded.filter(row => row.valid_from <= today()).at(-1);

        const pockets = await yields.pockets(entry.account_id);
        const daysOfLast = last ? await yields.days(entry.account_id, last, last) : [];

        lines.push({
          account,
          cushion: await yields.cushion(entry.account_id),
          rate: bands[0] ?? null,
          notEarningMinor: inForce?.amount_minor ?? 0,
          enabled: entry.enabled !== 0,
          pockets,
          driftMinor: await yields.pocketDrift(entry.account_id),
          lastDayMinor: daysOfLast.reduce((sum, day) => sum + netOf(day), 0),
        });
      }

      lines.sort((a, b) => b.cushion.totalMinor - a.cushion.totalMinor);
      this.lines.set(lines);
      this.lastAccrued.set(newest);
      this.incomeCategories.set(await categories.list({ kind: 'income' }));

      // What could still be added. An archived account is history and is
      // never offered; anything else can be added, deliberately, by name.
      const enrolledIds = new Set(enrolled.map(entry => entry.account_id));
      this.candidates.set(all.filter(account =>
        account.archived === 0 && !enrolledIds.has(account.id)));
    } finally {
      this.loading.set(false);
    }
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
    this.openDays.set((await yields.days(line.account.id)).reverse());
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
    const excluded = await yields.excludedHistory(line.account.id);
    const current = excluded.filter(row => row.valid_from <= today()).at(-1);

    this.openingAmount.set(decimalOf(entry?.opening_cushion_minor ?? 0));
    this.openingDate.set(entry?.opening_on ?? today());
    this.withholds.set(entry?.withholding !== 0);
    this.editingEnabled = entry?.enabled !== 0;
    this.notEarning.set(decimalOf(current?.amount_minor ?? 0));
    this.notEarningFrom.set(today());
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
    const excluded = parseOrNull(this.notEarning());
    if (opening === null || opening < 0 || excluded === null || excluded < 0) {
      this.error.set(this.i18n.t('cushion.error.amount'));
      return;
    }

    this.saving.set(true);
    try {
      const { db, yields, tax } = this.repos();
      await db.transaction(async () => {
        await yields.enrol({
          account_id: line.account.id,
          opening_cushion_minor: opening,
          opening_on: this.openingDate(),
          withholding: this.withholds(),
          // Saving settings must not quietly restart an account that was paused.
          enabled: this.editingEnabled,
        });
        await yields.setExcluded({
          account_id: line.account.id,
          valid_from: this.notEarningFrom(),
          amount_minor: excluded,
        });
        await yields.clearDays(line.account.id);
      });

      await new AccrualEngine(db, yields, tax).accrue(line.account.id, today());
      this.database.dataChanged();
      this.closeDetail();
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

    this.saving.set(true);
    try {
      const { yields } = this.repos();
      await yields.setEnabled(line.account.id, false);
      this.database.dataChanged();
      this.closeDetail();
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
      this.database.dataChanged();
      this.closeDetail();
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
    this.pocketFrom.set(today());

    if (pocket) {
      const { yields } = this.repos();
      const history = await yields.pocketBalances(pocket.id);
      const current = history.filter(row => row.valid_from <= today()).at(-1);
      this.pocketAmount.set(current ? decimalOf(current.amount_minor) : '');
    } else {
      this.pocketAmount.set('');
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
      this.database.dataChanged();
      await this.openSettings();
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

  startRateForm(): void {
    this.ratePercent.set('');
    this.rateFrom.set(today());
    this.rateSpend.set('');
    this.rateFallback.set('');
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
      await db.transaction(async () => {
        await yields.setRate({
          account_id: line.account.id,
          valid_from: this.rateFrom(),
          annual_rate_scaled: scaled,
          requires_monthly_spend_minor: spend,
          fallback_annual_rate_scaled: fallback,
        });
        // Only from the day the new rate starts: earlier days were computed
        // under a rate that has not changed.
        await yields.clearDays(line.account.id, this.rateFrom());
      });

      await new AccrualEngine(db, yields, tax).accrue(line.account.id, today());
      this.database.dataChanged();
      this.closeDetail();
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
        opening_cushion_minor: 0,
        opening_on: today(),
        withholding: account.currency_code === 'COP',
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

  /** Reloads the sheet in place, so a correction is visible immediately. */
  private async reopen(line: CushionLine): Promise<void> {
    await this.load();
    const fresh = this.lines().find(row => row.account.id === line.account.id);
    if (fresh) await this.open(fresh);
    else this.closeDetail();
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
      const { yields } = this.repos();
      await yields.adjust({
        account_id: line.account.id,
        on_date: this.onDate(),
        amount_minor: minor,
        note: this.note().trim() || null,
      });
      this.database.dataChanged();
      this.closeDetail();
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

      this.database.dataChanged();
      this.closeDetail();
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
      const minor = parseAmountToMinor(negative ? raw.slice(1) : raw);
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
    }).format((scaled / EA_SCALE) * 100)} %`;
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

  iconOf(account: AccountRow): string {
    return outlined(account.builtin_icon);
  }

  percentOf(scaled: number): string {
    return scaledPercentToString(scaled);
  }
}

/** An amount as typed, or null when it is not one. An empty field is zero. */
function parseOrNull(raw: string): number | null {
  const text = raw.trim();
  if (text.length === 0) return 0;
  try {
    return parseAmountToMinor(text);
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
