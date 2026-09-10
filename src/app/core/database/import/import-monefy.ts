/**
 * Writes a parsed Monefy export into the database.
 *
 * Everything happens in one transaction: an import that stopped halfway would
 * leave a ledger that looks plausible and is wrong, which is worse than one
 * that plainly did not run.
 *
 * The importer is **repeatable**. Rows already stored are recognised by their
 * fingerprint and skipped, so re-running it against a newer export adds only
 * what is new. Rows the user has edited by hand are `locked` and never
 * touched, because a hand correction is the true version by definition.
 *
 * Nothing doubtful is written silently. Every assumption — an account's
 * currency, a reconstructed deleted account, a dollar figure that could not be
 * confirmed — lands in `review_queue` next to the row it affected.
 */

import type { SqlDriver } from '../sql-driver';
import type { AccountType } from '../types';
import { AccountsRepository } from '../repositories/accounts.repository';
import { AccountGroupsRepository } from '../repositories/account-groups.repository';
import { CategoriesRepository } from '../repositories/categories.repository';
import { TransactionsRepository } from '../repositories/transactions.repository';
import { TransfersRepository } from '../repositories/transfers.repository';
import { CreditLimitsRepository } from '../repositories/credit-limits.repository';


import { parseMonefyCsv, type MonefyCsvResult, type MonefyRow } from './monefy-csv';
import { pairTransfers, findGhostAccounts, type TransferPair } from './pair-transfers';
import { planAccounts, isCreditLimitChange, derivedCreditLimit, creditLimitHistory, type AccountPlan, type PlannedAccount } from './account-plan';
import { assessUsdMention, type UsdCandidate } from './extract-usd';
import { iconForCategory } from '../category-icons';

/** The currency everything is measured against; rows in it need no review. */
const BASE_CURRENCY = 'COP';

export interface ImportOptions {
  fileName: string;
  /** Identifies the file, so the same export is recognisable later. */
  fileHash: string;
  now?: () => string;
  /** Icon given to accounts and categories the importer creates. */
  defaultIcon?: string;
}

export interface ImportSummary {
  batchId: number;
  rowsRead: number;
  rowsInserted: number;
  /** Already present from an earlier import. */
  rowsSkipped: number;
  reviewsRaised: number;
  accountsCreated: number;
  groupsCreated: number;
  categoriesCreated: number;
  transfersCreated: number;
  /** Transfer halves whose counterpart was deleted from Monefy. */
  synthesizedLegs: number;
  /** Rows given a dollar amount recovered from their description. */
  usdRecovered: number;
  /** Rows in a dollar account whose amount had to be estimated. */
  usdEstimated: number;
  /** Rows that changed a credit limit instead of moving money. */
  creditLimitChanges: number;
}

interface ResolvedAmount {
  amountMinor: number;
  rateScaled: number | null;
  amountBaseMinor: number;
  rateSource: 'manual' | 'derived' | 'trm' | 'cached' | null;
  confidence: 'high' | 'low';
  review?: string;
}

const DEFAULT_ICON = 'wallet';

/**
 * Reads and writes a Monefy export in one go.
 *
 * `bytes` rather than text: the file is Windows-1252 and the decoding belongs
 * with the parser, not with every caller.
 */
export async function importMonefy(
  db: SqlDriver,
  bytes: Uint8Array,
  options: ImportOptions,
): Promise<ImportSummary> {
  const parsed = parseMonefyCsv(bytes);
  const ghosts = findGhostAccounts(parsed.rows, parsed.accounts);
  const plan = planAccounts(parsed, ghosts);
  const pairing = pairTransfers(parsed.rows);

  const now = options.now ?? (() => new Date().toISOString());
  const icon = options.defaultIcon ?? DEFAULT_ICON;

  return db.transaction(async () => {
    const writer = new ImportWriter(db, parsed, plan, now, icon);
    return writer.run(pairing, options);
  });
}

class ImportWriter {
  private readonly accounts: AccountsRepository;
  private readonly groups: AccountGroupsRepository;
  private readonly categories: CategoriesRepository;
  private readonly transactions: TransactionsRepository;
  private readonly transfers: TransfersRepository;

  /** Backup account name to the id of the row its history goes to. */
  private readonly accountIds = new Map<string, number>();
  /** Backup account name to the currency that row holds. */
  private readonly currencies = new Map<string, string>();
  /** Backup account name to the type of the row its history goes to. */
  private readonly accountTypes = new Map<string, AccountType>();
  private readonly categoryIds = new Map<string, number>();
  /** Fingerprints already in the database, and the highest sequence of each. */
  private seen = new Map<string, number>();
  /** Accepted dollar rates by date, for estimating the rows that lack one. */
  private readonly knownRates: { on: string; rateScaled: number }[] = [];

  private batchId = 0;
  private reviewsRaised = 0;
  private rowsInserted = 0;
  private rowsSkipped = 0;
  private accountsCreated = 0;
  private groupsCreated = 0;
  private categoriesCreated = 0;
  private transfersCreated = 0;
  private synthesizedLegs = 0;
  private usdRecovered = 0;
  private usdEstimated = 0;
  /** Rows that changed a credit limit rather than moving money. */
  private limitChanges = 0;

  // Declared and assigned rather than written as constructor parameter
  // properties: Node runs these files by stripping types only, and parameter
  // properties would need a real compiler.
  private readonly db: SqlDriver;
  private readonly parsed: MonefyCsvResult;
  private readonly plan: AccountPlan;
  private readonly now: () => string;
  private readonly icon: string;

  constructor(
    db: SqlDriver,
    parsed: MonefyCsvResult,
    plan: AccountPlan,
    now: () => string,
    icon: string,
  ) {
    this.db = db;
    this.parsed = parsed;
    this.plan = plan;
    this.now = now;
    this.icon = icon;

    this.accounts = new AccountsRepository(db, now);
    this.groups = new AccountGroupsRepository(db, now);
    this.categories = new CategoriesRepository(db, now);
    this.transactions = new TransactionsRepository(db, now);
    this.transfers = new TransfersRepository(db, now);
  }

  async run(pairing: ReturnType<typeof pairTransfers>, options: ImportOptions): Promise<ImportSummary> {
    this.seen = await this.transactions.importedFingerprints();

    await this.openBatch(options);
    await this.createGroups();
    await this.createAccounts();
    await this.createCategories();
    await this.checkCreditLimits();
    await this.recordCreditLimitHistory();
    this.collectKnownRates();

    // Transfers first, so both halves are consumed before the loose rows are
    // walked and none is written twice.
    const consumed = new Set<MonefyRow>();
    for (const pair of pairing.pairs) {
      await this.writeTransfer(pair);
      consumed.add(pair.out);
      consumed.add(pair.into);
    }

    // Halves whose counterpart Monefy deleted: the transfer is still real, so
    // the missing leg is reconstructed against the recreated account.
    for (const row of [...pairing.unpairedOut, ...pairing.unpairedIn]) {
      await this.writeOrphanedTransfer(row);
      consumed.add(row);
    }

    for (const row of this.parsed.rows) {
      if (row.kind !== 'transaction' || consumed.has(row)) continue;
      await this.writeTransaction(row);
    }

    for (const review of this.plan.reviews) {
      await this.raiseReview(review.kind, review.reason, 'account', this.accountIds.get(review.account) ?? null);
    }

    await this.closeBatch();

    return {
      batchId: this.batchId,
      rowsRead: this.parsed.rows.length,
      rowsInserted: this.rowsInserted,
      rowsSkipped: this.rowsSkipped,
      reviewsRaised: this.reviewsRaised,
      accountsCreated: this.accountsCreated,
      groupsCreated: this.groupsCreated,
      categoriesCreated: this.categoriesCreated,
      transfersCreated: this.transfersCreated,
      synthesizedLegs: this.synthesizedLegs,
      usdRecovered: this.usdRecovered,
      usdEstimated: this.usdEstimated,
      creditLimitChanges: this.limitChanges,
    };
  }

  private async openBatch(options: ImportOptions): Promise<void> {
    const result = await this.db.run(
      `INSERT INTO import_batches (file_name, file_hash, imported_at, rows_read) VALUES (?, ?, ?, ?)`,
      [options.fileName, options.fileHash, this.now(), this.parsed.rows.length],
    );
    this.batchId = result.lastId!;
  }

  private async closeBatch(): Promise<void> {
    await this.db.run(
      `UPDATE import_batches SET rows_inserted = ?, rows_skipped = ?, rows_flagged = ? WHERE id = ?`,
      [this.rowsInserted, this.rowsSkipped, this.reviewsRaised, this.batchId],
    );
  }

  private async createGroups(): Promise<void> {
    for (const group of this.plan.groups) {
      const existing = await this.groups.findByName(group.name);
      if (existing) continue;
      await this.groups.create({ name: group.name, builtin_icon: this.icon });
      this.groupsCreated += 1;
    }
  }

  private async createAccounts(): Promise<void> {
    const groupIds = new Map<string, number>();
    for (const group of await this.groups.list()) {
      groupIds.set(group.name, group.id);
    }

    for (const account of this.plan.accounts) {
      const id = await this.ensureAccount(account, groupIds);
      if (account.receivesHistory) {
        this.accountIds.set(account.sourceName, id);
        this.currencies.set(account.sourceName, account.currency);
        this.accountTypes.set(account.sourceName, account.type);
      }
    }
  }

  private async ensureAccount(account: PlannedAccount, groupIds: Map<string, number>): Promise<number> {
    const existing = await this.accounts.findByName(account.name);
    if (existing) {
      // Whether an account counts towards net worth is something Jose states,
      // never something the backup carries — Monefy exports eight columns and
      // none of them is this flag. So the plan is the authority for it, and an
      // account created by an earlier import gets corrected rather than being
      // left with a stale answer that only a re-import from scratch would fix.
      const wanted = account.includeInNetWorth ? 1 : 0;
      if (existing.include_in_net_worth !== wanted) {
        await this.accounts.update(existing.id, { include_in_net_worth: account.includeInNetWorth });
      }
      return existing.id;
    }

    const id = await this.accounts.create({
      name: account.name,
      type: account.type,
      currency_code: account.currency,
      group_id: account.groupName ? groupIds.get(account.groupName) ?? null : null,
      builtin_icon: this.icon,
      credit_limit_minor: account.creditLimitMinor,
      include_in_net_worth: account.includeInNetWorth,
      opening_balance_minor: account.openingBalanceMinor,
      // The backup states opening balances in pesos, so for a dollar account
      // the two differ. Only the peso accounts have a meaningful figure here,
      // and every account that declares one is a peso account.
      opening_balance_base_minor: account.currency === 'COP' ? account.openingBalanceMinor : 0,
      opened_on: account.openedOn,
    });

    if (account.archived) {
      await this.accounts.archive(id);
    }
    this.accountsCreated += 1;
    return id;
  }

  private async createCategories(): Promise<void> {
    for (const name of this.parsed.categories) {
      // Monefy does not record whether a category is income or expense, so it
      // is taken from the sign of the rows that use it. A category used both
      // ways lands as an expense and is flagged.
      const rows = this.parsed.rows.filter(row => row.category === name);
      const positives = rows.filter(row => row.amountMinor > 0).length;
      const negatives = rows.filter(row => row.amountMinor < 0).length;
      const kind = positives > negatives ? 'income' : 'expense';

      const existing = await this.categories.findByName(name, kind);
      const id = existing ? existing.id : await this.categories.create({ name, kind, builtin_icon: iconForCategory(name) });
      this.categoryIds.set(name, id);
      if (!existing) this.categoriesCreated += 1;

      if (positives > 0 && negatives > 0) {
        await this.raiseReview(
          'ambiguous_category',
          `"${name}" is used for both income (${positives} rows) and expenses (${negatives} rows). ` +
            `Imported as '${kind}'; split it if the two are really different things.`,
          'category',
          id,
        );
      }
    }
  }

  /**
   * without one can borrow the nearest in time.
   */
  private collectKnownRates(): void {
    for (const row of this.parsed.rows) {
      if (this.currencies.get(row.account) !== 'USD') continue;
      const candidate = assessUsdMention(row.description, row.amountMinor);
      if (candidate.verdict === 'accepted' && candidate.impliedRateScaled !== null) {
        this.knownRates.push({ on: row.occurredOn, rateScaled: candidate.impliedRateScaled });
      }
    }
    this.knownRates.sort((a, b) => a.on.localeCompare(b.on));
  }

  /**
   *
   * Used only to estimate rows whose dollar amount was never written down.
   * The official TRM would be better and arrives in Phase 4; until then, rates
   * taken from Jose's own transactions beat a made-up number, and everything
   * derived this way is marked low confidence.
   */
  private nearestRate(on: string): number | null {
    if (this.knownRates.length === 0) return null;

    let best = this.knownRates[0];
    let bestGap = Math.abs(Date.parse(best.on) - Date.parse(on));
    for (const rate of this.knownRates) {
      const gap = Math.abs(Date.parse(rate.on) - Date.parse(on));
      if (gap < bestGap) {
        best = rate;
        bestGap = gap;
      }
    }
    return best.rateScaled;
  }

  /**
   * lands in.
   *
   * A peso row is trivial. A dollar row is not: the file states pesos, and the
   * dollars have to come from the description or from a rate.
   */
  private resolveAmount(row: MonefyRow, currency: string): ResolvedAmount {
    if (currency === 'COP') {
      return {
        amountMinor: row.amountMinor,
        rateScaled: null,
        amountBaseMinor: row.amountMinor,
        rateSource: null,
        confidence: 'high',
      };
    }

    const candidate: UsdCandidate = assessUsdMention(row.description, row.amountMinor);

    if (candidate.verdict === 'accepted' && candidate.usdMinor !== null) {
      // The dollars are what Jose actually saw; the pesos were his estimate,
      // so the dollars win and the peso figure is kept as the frozen base.
      this.usdRecovered += 1;
      const signed = row.amountMinor < 0 ? -candidate.usdMinor : candidate.usdMinor;
      return {
        amountMinor: signed,
        rateScaled: candidate.impliedRateScaled,
        amountBaseMinor: row.amountMinor,
        rateSource: 'manual',
        confidence: 'high',
      };
    }

    const rateScaled = this.nearestRate(row.occurredOn);
    this.usdEstimated += 1;

    if (rateScaled === null) {
      // No rate anywhere in the file. Rather than invent one, the row keeps
      // its peso figure and is flagged loudly.
      return {
        amountMinor: row.amountMinor,
        rateScaled: null,
        amountBaseMinor: row.amountMinor,
        rateSource: null,
        confidence: 'low',
        review: 'No dollar amount and no rate to estimate one; the amount shown is the peso figure and is wrong',
      };
    }

    // amount = base / rate, so the dollars come from dividing the pesos.
    const amountMinor = Math.round((row.amountMinor * 10_000) / rateScaled);
    return {
      amountMinor,
      rateScaled,
      amountBaseMinor: row.amountMinor,
      rateSource: 'derived',
      confidence: 'low',
      review:
        candidate.verdict === 'absent'
          ? `Estimated from the nearest confirmed rate; the peso figure it came from was an eyeballed estimate`
          : `${candidate.reason}. Estimated from the nearest confirmed rate instead`,
    };
  }

  /** True when this row is already stored from an earlier import. */
  private alreadyStored(row: MonefyRow): boolean {
    const highest = this.seen.get(row.fingerprint);
    return highest !== undefined && row.importSeq <= highest;
  }

  private async writeTransaction(row: MonefyRow): Promise<void> {
    if (this.alreadyStored(row)) {
      this.rowsSkipped += 1;
      return;
    }

    // A limit increase is not money arriving. Monefy had no way to express one,
    // so it was logged as a deposit; taken literally it understates the debt by
    // exactly the amount the limit grew.
    if (isCreditLimitChange(row.description, this.accountTypes.get(row.account) ?? 'debit')) {
      this.limitChanges += 1;
      await this.raiseReview(
        'credit_limit_change',
        `"${row.description}" on ${row.occurredOn} raises the credit limit by ` +
          `${(row.amountMinor / 100).toLocaleString('es-CO', { minimumFractionDigits: 2 })}; ` +
          'it is kept out of the ledger because it is not money moving.',
        'account',
        this.accountIds.get(row.account) ?? null,
      );
      return;
    }

    const accountId = this.accountIds.get(row.account);
    const categoryId = row.category !== null ? this.categoryIds.get(row.category) : undefined;
    if (accountId === undefined || categoryId === undefined) return;

    const currency = this.currencies.get(row.account) ?? 'COP';
    const resolved = this.resolveAmount(row, currency);

    const id = await this.transactions.create({
      account_id: accountId,
      category_id: categoryId,
      occurred_on: row.occurredOn,
      amount_minor: resolved.amountMinor,
      rate_scaled: resolved.rateScaled,
      amount_base_minor: resolved.amountBaseMinor,
      rate_source: resolved.rateSource,
      confidence: resolved.confidence,
      description: row.description || null,
      source: 'monefy',
      import_fingerprint: row.fingerprint,
      import_seq: row.importSeq,
      import_batch_id: this.batchId,
    });
    this.rowsInserted += 1;

    if (resolved.review) {
      await this.raiseReview('estimated_amount', resolved.review, 'transaction', id);
    }

    await this.flagForeign(id, row, currency);
  }

  /**
   * Every new row in a foreign-currency account is put up for review.
   *
   * Monefy only ever stored pesos, so a dollar movement's real figure is
   * either buried in its description or gone entirely — the importer's best
   * effort is a reading or an estimate, and Jose has been correcting those by
   * hand to figures that are more exact than Monefy could hold.
   *
   * Those corrections must survive, and they do: a row already stored is
   * recognised by its fingerprint and skipped, and a row edited by hand is
   * locked besides. What this adds is the other half — a genuinely new
   * movement in one of those accounts arrives flagged, so it is corrected
   * straight away instead of sitting in the ledger as an approximation
   * nobody was told about.
   *
   * Peso accounts are untouched: there the CSV figure is the real one.
   */
  private async flagForeign(id: number, row: MonefyRow, currency: string): Promise<void> {
    if (currency === BASE_CURRENCY) return;

    await this.raiseReview(
      'foreign_new_movement',
      `New movement in ${row.account}, which is held in ${currency}. Monefy stored ` +
        `only the peso figure, so the ${currency} amount here is a reading or an ` +
        `estimate. Confirm or correct it.`,
      'transaction',
      id,
    );
  }

  /**
   * Flags the legs of a new transfer that landed in a foreign account.
   *
   * The legs are found by the transfer they belong to rather than returned by
   * the writer: the transfer is what was created, and asking for it back keeps
   * this from depending on the order its two halves were written in.
   */
  private async flagForeignLegs(transferId: number, accounts: string[]): Promise<void> {
    const foreign = accounts.filter(
      account => (this.currencies.get(account) ?? BASE_CURRENCY) !== BASE_CURRENCY);
    if (foreign.length === 0) return;

    const legs = await this.db.query<{ id: number; account_id: number }>(
      'SELECT id, account_id FROM transactions WHERE transfer_id = ?', [transferId]);

    for (const account of foreign) {
      const accountId = this.accountIds.get(account);
      const leg = legs.find(row => row.account_id === accountId);
      if (!leg) continue;

      const currency = this.currencies.get(account) ?? BASE_CURRENCY;
      await this.raiseReview(
        'foreign_new_movement',
        `New transfer leg in ${account}, held in ${currency}. Monefy stored only ` +
          `the peso figure, so the ${currency} amount is a reading or an estimate. ` +
          `Confirm or correct it.`,
        'transaction',
        leg.id,
      );
    }
  }

  private async writeTransfer(pair: TransferPair): Promise<void> {
    if (this.alreadyStored(pair.out) && this.alreadyStored(pair.into)) {
      this.rowsSkipped += 2;
      return;
    }

    const fromId = this.accountIds.get(pair.out.account);
    const toId = this.accountIds.get(pair.into.account);
    if (fromId === undefined || toId === undefined) return;

    const fromResolved = this.resolveAmount(pair.out, this.currencies.get(pair.out.account) ?? 'COP');
    const toResolved = this.resolveAmount(pair.into, this.currencies.get(pair.into.account) ?? 'COP');

    const transferId = await this.transfers.create({
      occurred_on: pair.out.occurredOn,
      description: pair.out.description || pair.into.description || null,
      from: {
        account_id: fromId,
        amount_minor: Math.abs(fromResolved.amountMinor),
        rate_scaled: fromResolved.rateScaled,
        amount_base_minor: Math.abs(fromResolved.amountBaseMinor),
        rate_source: fromResolved.rateSource,
      },
      to: {
        account_id: toId,
        amount_minor: Math.abs(toResolved.amountMinor),
        rate_scaled: toResolved.rateScaled,
        amount_base_minor: Math.abs(toResolved.amountBaseMinor),
        rate_source: toResolved.rateSource,
      },
      confidence: fromResolved.confidence === 'low' || toResolved.confidence === 'low' ? 'low' : 'high',
      source: 'monefy',
      fingerprints: {
        from: { value: pair.out.fingerprint, seq: pair.out.importSeq },
        to: { value: pair.into.fingerprint, seq: pair.into.importSeq },
      },
    });

    this.transfersCreated += 1;
    this.rowsInserted += 2;

    await this.flagForeignLegs(transferId, [pair.out.account, pair.into.account]);

    if (pair.method !== 'exact') {
      await this.raiseReview(
        'near_date_transfer',
        `The two halves were recorded ${pair.dayGap} day(s) apart and were paired on the strength of matching accounts and amount.`,
        'transaction',
        null,
      );
    }
  }

  /**
   *
   * The money really moved, and the surviving row states the date, the amount
   * and the other account's name, so the missing leg is reconstructed against
   * the recreated account rather than the row being dropped.
   */
  private async writeOrphanedTransfer(row: MonefyRow): Promise<void> {
    if (this.alreadyStored(row)) {
      this.rowsSkipped += 1;
      return;
    }

    const knownId = this.accountIds.get(row.account);
    const ghostId = row.counterparty !== null ? this.accountIds.get(row.counterparty) : undefined;
    if (knownId === undefined || ghostId === undefined) return;

    const resolved = this.resolveAmount(row, this.currencies.get(row.account) ?? 'COP');
    const amount = Math.abs(resolved.amountMinor);
    const base = Math.abs(resolved.amountBaseMinor);
    const movingOut = row.kind === 'transfer_out';

    await this.transfers.create({
      occurred_on: row.occurredOn,
      description: row.description || null,
      from: movingOut
        ? { account_id: knownId, amount_minor: amount, rate_scaled: resolved.rateScaled, amount_base_minor: base, rate_source: resolved.rateSource }
        : { account_id: ghostId, amount_minor: amount, amount_base_minor: base },
      to: movingOut
        ? { account_id: ghostId, amount_minor: amount, amount_base_minor: base }
        : { account_id: knownId, amount_minor: amount, rate_scaled: resolved.rateScaled, amount_base_minor: base, rate_source: resolved.rateSource },
      confidence: 'low',
      source: 'monefy',
      // Only the surviving half carries a fingerprint. The reconstructed leg
      // has none, so a re-import matches on the real row and leaves the
      // synthesised one alone.
      fingerprints: movingOut
        ? { from: { value: row.fingerprint, seq: row.importSeq } }
        : { to: { value: row.fingerprint, seq: row.importSeq } },
    });

    this.transfersCreated += 1;
    this.synthesizedLegs += 1;
    this.rowsInserted += 1;

    await this.raiseReview(
      'reconstructed_transfer',
      `The other half of this transfer was deleted from Monefy along with "${row.counterparty}". ` +
        'The missing leg was reconstructed from this one, so the amounts balance.',
      'transaction',
      null,
    );
  }


  /**
   * Cross-checks each credit limit against the one the file implies.
   *
   * The backup states a card's limit twice over: once as the opening balance,
   * and again through every `Aumento cupo` row. Adding them up should land on
   * the limit Jose confirmed, and for the Rappi card it does exactly —
   * 800,000 + 200,000 + 100,000 = 1,100,000. When the two disagree one of them
   * is stale, and saying so is more useful than quietly preferring either.
   */
  /**
   * Keeps the limit changes the backup describes, as history rather than as
   * money.
   *
   * They are dropped from the ledger — an `Aumento cupo` row is not a deposit
   * — but the dates and figures are real and exist nowhere else, so throwing
   * them away would lose the only record of what the limit was in 2024. A day
   * that already has an answer is left alone, so re-importing never overwrites
   * a limit corrected by hand.
   */
  private async recordCreditLimitHistory(): Promise<void> {
    const limits = new CreditLimitsRepository(this.db, this.now);

    for (const account of this.plan.accounts) {
      if (account.type !== 'credit') continue;

      const accountId = this.accountIds.get(account.sourceName);
      if (accountId === undefined) continue;

      for (const point of creditLimitHistory(this.parsed.rows, account.sourceName)) {
        await limits.addIfMissing({
          account_id: accountId,
          limit_minor: point.limitMinor,
          effective_on: point.effectiveOn,
          note: point.note,
          source: 'import',
        });
      }
    }
  }

  private async checkCreditLimits(): Promise<void> {
    for (const account of this.plan.accounts) {
      if (account.type !== 'credit' || account.creditLimitMinor === null) continue;

      const derived = derivedCreditLimit(this.parsed.rows, account.sourceName);
      if (derived === null || derived === account.creditLimitMinor) continue;

      await this.raiseReview(
        'credit_limit_mismatch',
        `The configured limit for ${account.name} is ` +
          `${(account.creditLimitMinor / 100).toLocaleString('es-CO', { minimumFractionDigits: 2 })}, ` +
          `but the backup implies ${(derived / 100).toLocaleString('es-CO', { minimumFractionDigits: 2 })} ` +
          '(its opening balance plus every recorded limit change). One of the two is out of date.',
        'account',
        this.accountIds.get(account.sourceName) ?? null,
      );
    }
  }
  /**
   * Adds an item to the review queue, unless the same one is already waiting.
   *
   * Without the check, every re-import would raise the same 29 account-level
   * items again — an account's currency is still assumed on the second run —
   * and the queue would fill with noise instead of things to act on. Items the
   * user has resolved stay resolved and are not raised again either.
   */
  private async raiseReview(
    kind: string,
    reason: string,
    entityType: 'transaction' | 'transfer' | 'account' | 'category' | 'cashback' | null,
    entityId: number | null,
  ): Promise<void> {
    const duplicate = await this.db.queryOne<{ id: number }>(
      `SELECT id FROM review_queue WHERE kind = ? AND reason = ?
         AND entity_type IS ? AND entity_id IS ? LIMIT 1`,
      [kind, reason, entityType, entityId],
    );
    if (duplicate) return;

    await this.db.run(
      `INSERT INTO review_queue (kind, entity_type, entity_id, batch_id, reason, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [kind, entityType, entityId, this.batchId, reason, this.now()],
    );
    this.reviewsRaised += 1;
  }
}
