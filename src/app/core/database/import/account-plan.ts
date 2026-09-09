/**
 * Works out which accounts to create, in which currency, before anything is
 * written.
 *
 * The backup cannot answer this on its own. Every row says `COP` even for the
 * dollar accounts, and a deleted account leaves nothing but its name. So what
 * is actually known is written down here as a table, with each entry marked
 * **confirmed** — Jose said so — or **assumed** — inferred from the data and
 * needing review.
 *
 * The importer never guesses silently. Anything not confirmed goes into the
 * review queue alongside the account it created, so a wrong assumption is
 * visible rather than buried in 12,898 rows.
 */

import type { AccountType } from '../types';
import type { MonefyCsvResult, MonefyRow } from './monefy-csv';
import type { GhostAccount } from './pair-transfers';

export interface KnownAccount {
  /** Currency of the account, or of the row the history should land in. */
  currency: string;
  type: AccountType;
  /** Present when the real account holds more than one currency. */
  group?: KnownGroup;
  /** Credit cards only, in minor units. */
  creditLimitMinor?: number;
  /**
   * False for an account Jose does not count towards his net worth.
   *
   * The backup cannot say: Monefy exports eight columns and none of them is
   * this flag. It only ever comes from Jose.
   */
  includeInNetWorth?: boolean;
  /** True when Jose stated it; false when inferred from the data. */
  confirmed: boolean;
  note?: string;
}

export interface KnownGroup {
  name: string;
  /** Every currency the real account holds. */
  currencies: string[];
  /**
   * The currency the imported history lands in. The backup flattened
   * everything to COP, so which side a historical row belongs to cannot be
   * read off the file; this is a decision, and it is reviewed.
   */
  importInto: string;
}

const ARQ: KnownGroup = {
  name: 'ARQ',
  currencies: ['USD', 'EUR'],
  // Nothing in the backup mentions euros; the EUR side appears to be recent.
  importInto: 'USD',
};

const GLOBAL66: KnownGroup = {
  name: 'Global66',
  currencies: ['COP', 'USD'],
  // Only 2 of its 27 rows mention a dollar amount, so the history is
  // overwhelmingly the peso side.
  importInto: 'COP',
};

/**
 * What is known about each account in the backup.
 *
 * Anything absent from this table is treated as COP and `debit`, and flagged.
 * That default is right for most of the list — Nequi, Ualá, Lulo, Nu, Dale,
 * Bold, Plata — but it is still an assumption and says so.
 */
export const KNOWN_ACCOUNTS: Readonly<Record<string, KnownAccount>> = {
  // Confirmed by Jose, 2026-09-08.
  'eToro': { currency: 'USD', type: 'investment', includeInNetWorth: false, confirmed: true, note: 'Broker: movements only, never reconciled against market value' },
  'XTB': { currency: 'USD', type: 'investment', includeInNetWorth: false, confirmed: true, note: 'Broker: movements only, never reconciled against market value' },
  'Plenti': { currency: 'USD', type: 'investment', confirmed: true },
  'ARQ': { currency: 'USD', type: 'investment', group: ARQ, confirmed: true, note: 'DolarApp' },
  'Global66': { currency: 'COP', type: 'debit', group: GLOBAL66, confirmed: true },
  'Plata': { currency: 'COP', type: 'debit', confirmed: true },
  'Tarjeta crédito rappi': {
    currency: 'COP',
    type: 'credit',
    creditLimitMinor: 110_000_000,
    confirmed: true,
    note: 'Limit confirmed 2026-09-08. The 800,000 opening balance in the backup was the old limit, not money',
  },

  // Assumed from the data. Reviewed, not trusted.
  'Efectivo': { currency: 'COP', type: 'cash', confirmed: false },
  'Fiducuenta': { currency: 'COP', type: 'investment', confirmed: false, note: 'Bancolombia fund' },
  'Multinversion': { currency: 'COP', type: 'investment', confirmed: false, note: 'Bancolombia fund' },
  'Pibank para renta': { currency: 'COP', type: 'investment', includeInNetWorth: false, confirmed: true, note: 'Set aside for the tax bill; Jose keeps it out of net worth' },
};

/** Every account absent from the table starts here. */
const DEFAULT_ACCOUNT: KnownAccount = { currency: 'COP', type: 'debit', confirmed: false };

/** A ghost is COP and archived; its type is anybody's guess. */
const DEFAULT_GHOST: KnownAccount = { currency: 'COP', type: 'debit', confirmed: false };

/**
 * Deleted accounts whose nature is legible from the name. Still unconfirmed —
 * these are read off a label, which is exactly the sort of inference that
 * belongs in the review queue.
 */
const KNOWN_GHOSTS: Readonly<Record<string, Partial<KnownAccount>>> = {
  'Tarjeta de crédito mastercard': { type: 'credit' },
  'Renta Fija Plazo': { type: 'investment' },
  'Renta sostenible global': { type: 'investment' },
  'Renta alta convicción': { type: 'investment' },
  'Tyba comprar vivienda': { type: 'investment' },
  'Tyba portafolio 8': { type: 'investment' },
  'Balanceado': { type: 'investment' },
  'Hapi': { type: 'investment' },
};

export interface PlannedAccount {
  /** Name in the backup, and the key the importer maps rows by. */
  sourceName: string;
  /** Name to create. For a grouped account it carries the currency. */
  name: string;
  currency: string;
  type: AccountType;
  groupName: string | null;
  creditLimitMinor: number | null;
  /** False keeps the account out of the net worth total. */
  includeInNetWorth: boolean;
  openingBalanceMinor: number;
  openedOn: string;
  archived: boolean;
  /** True when this row receives the imported history for its source name. */
  receivesHistory: boolean;
  /** True for an account reconstructed from a deleted one. */
  isGhost: boolean;
  confirmed: boolean;
  note?: string;
}

export interface PlannedGroup {
  name: string;
  currencies: string[];
}

export interface PlanReview {
  kind: string;
  account: string;
  reason: string;
}

export interface AccountPlan {
  accounts: PlannedAccount[];
  groups: PlannedGroup[];
  reviews: PlanReview[];
}

/**
 * The opening balance declared for each account, with the credit card fixed.
 *
 * `Initial balance 'X'` is a pseudo-category, not a movement. Only 8 of the 22
 * accounts declare one; the rest start at zero.
 *
 * The credit card is the exception that has to be undone. Monefy stored its
 * balance as `limit − debt`, so it opens at +800,000 — the limit as it stood
 * in 2021, which was never money. Dropping that opening leaves the balance as
 * the plain negative of the debt, which is what the schema wants: every
 * purchase since then already subtracts.
 *
 * Dropping the opening is only half of it. The two `Aumento cupo` rows are
 * limit increases wearing the costume of deposits, and they have to come out
 * of the ledger too — see `isCreditLimitChange`. With all three removed the
 * card's rows sum to −826,492.27, the debt, leaving 273,507.73 of the
 * 1,100,000 limit: exactly the figure Monefy shows.
 */
export function openingBalances(rows: readonly MonefyRow[]): Map<string, { amountMinor: number; on: string }> {
  const openings = new Map<string, { amountMinor: number; on: string }>();

  for (const row of rows) {
    if (row.kind !== 'initial_balance') continue;

    const known = KNOWN_ACCOUNTS[row.account];
    const amountMinor = known?.type === 'credit' ? 0 : row.amountMinor;
    openings.set(row.account, { amountMinor, on: row.occurredOn });
  }

  return openings;
}

/** The first date each account appears on, which is when it opened. */
function firstSeen(rows: readonly MonefyRow[]): Map<string, string> {
  const dates = new Map<string, string>();
  for (const row of rows) {
    const current = dates.get(row.account);
    if (current === undefined || row.occurredOn < current) {
      dates.set(row.account, row.occurredOn);
    }
  }
  return dates;
}

/**
 * Decides every account to create, before a single row is written.
 *
 * Grouped accounts produce one row per currency: ARQ becomes `ARQ USD` and
 * `ARQ EUR`, and only the one named by `importInto` receives the history.
 * The other starts empty, which is correct — the backup holds no evidence of
 * it at all.
 */
export function planAccounts(parsed: MonefyCsvResult, ghosts: readonly GhostAccount[]): AccountPlan {
  const openings = openingBalances(parsed.rows);
  const opened = firstSeen(parsed.rows);

  const accounts: PlannedAccount[] = [];
  const groups = new Map<string, PlannedGroup>();
  const reviews: PlanReview[] = [];

  for (const sourceName of parsed.accounts) {
    const known = KNOWN_ACCOUNTS[sourceName] ?? DEFAULT_ACCOUNT;
    const opening = openings.get(sourceName);
    const openedOn = opening?.on ?? opened.get(sourceName) ?? parsed.rows[0].occurredOn;

    if (known.group) {
      groups.set(known.group.name, { name: known.group.name, currencies: known.group.currencies });

      for (const currency of known.group.currencies) {
        const receivesHistory = currency === known.group.importInto;
        accounts.push({
          sourceName,
          name: `${sourceName} ${currency}`,
          currency,
          type: known.type,
          groupName: known.group.name,
          creditLimitMinor: known.creditLimitMinor ?? null,
          includeInNetWorth: known.includeInNetWorth !== false,
          openingBalanceMinor: receivesHistory ? opening?.amountMinor ?? 0 : 0,
          openedOn,
          archived: false,
          receivesHistory,
          isGhost: false,
          confirmed: known.confirmed,
          note: known.note,
        });
      }

      reviews.push({
        kind: 'multi_currency_split',
        account: sourceName,
        reason:
          `${sourceName} holds ${known.group.currencies.join(' and ')}, but the backup flattened everything to COP. ` +
          `All of its history was imported into the ${known.group.importInto} side. Confirm, or move the rows that belong elsewhere.`,
      });
      continue;
    }

    accounts.push({
      sourceName,
      name: sourceName,
      currency: known.currency,
      type: known.type,
      groupName: null,
      creditLimitMinor: known.creditLimitMinor ?? null,
      includeInNetWorth: known.includeInNetWorth !== false,
      openingBalanceMinor: opening?.amountMinor ?? 0,
      openedOn,
      archived: false,
      receivesHistory: true,
      isGhost: false,
      confirmed: known.confirmed,
      note: known.note,
    });

    if (!known.confirmed) {
      reviews.push({
        kind: 'assumed_account',
        account: sourceName,
        reason: `Assumed ${known.currency} and type '${known.type}'. Nothing in the backup states either.`,
      });
    }
  }

  // Accounts that Monefy no longer has. Recreated archived so the transfers
  // that reference them can be made whole without cluttering the live list.
  for (const ghost of ghosts) {
    const known = { ...DEFAULT_GHOST, ...KNOWN_GHOSTS[ghost.name] };

    accounts.push({
      sourceName: ghost.name,
      name: ghost.name,
      currency: known.currency,
      type: known.type,
      groupName: null,
      creditLimitMinor: null,
      // A closed account still counted while it held money.
      includeInNetWorth: true,
      openingBalanceMinor: 0,
      openedOn: ghost.firstSeen,
      archived: true,
      receivesHistory: true,
      isGhost: true,
      confirmed: false,
      note: 'Reconstructed: deleted from Monefy, still referenced by transfers',
    });

    reviews.push({
      kind: 'deleted_account',
      account: ghost.name,
      reason:
        `Deleted from Monefy but still referenced by ${ghost.receivedRows + ghost.sentRows} transfer halves ` +
        `between ${ghost.firstSeen} and ${ghost.lastSeen}. Recreated as an archived ${known.currency} '${known.type}' account; ` +
        'currency and type are assumptions.',
    });
  }

  return { accounts, groups: [...groups.values()], reviews };
}

/**
 * Where the rows of a given backup account should be written.
 *
 * One lookup, so the row-writing loop never has to reason about groups.
 */
export function historyTargets(plan: AccountPlan): Map<string, PlannedAccount> {
  const targets = new Map<string, PlannedAccount>();
  for (const account of plan.accounts) {
    if (account.receivesHistory) targets.set(account.sourceName, account);
  }
  return targets;
}

/**
 * A row that raises or lowers a credit limit rather than moving money.
 *
 * Monefy has no concept of a credit limit. Modelling a card as an account
 * whose balance is `limit − debt` means the only way to record a limit
 * increase is to add money to it, so Jose logged both of his as ordinary
 * deposits captioned `Aumento cupo`.
 *
 * Left alone they are read as payments and understate the debt. There are two
 * in the real backup — 200,000 in 2023 and 100,000 in 2024 — which together
 * take the card from the 800,000 it opened with to the 1,100,000 it has today.
 * That the three numbers add up exactly is what confirms this reading.
 */
export const CREDIT_LIMIT_CHANGE = /\b(aumento|incremento|reducci[oó]n|disminuci[oó]n)\s+(?:de\s+|del\s+)?cupo\b/i;

export function isCreditLimitChange(description: string, accountType: AccountType): boolean {
  return accountType === 'credit' && CREDIT_LIMIT_CHANGE.test(description);
}

/**
 * The credit limit the backup itself implies: what the card opened with, plus
 * every recorded change.
 *
 * Compared against the limit Jose confirmed, this is a cross-check rather than
 * a source. If the two disagree, one of them is wrong and the importer says so
 * instead of silently preferring either.
 */
export function derivedCreditLimit(rows: readonly MonefyRow[], accountName: string): number | null {
  const known = KNOWN_ACCOUNTS[accountName];
  if (known?.type !== 'credit') return null;

  let limit = 0;
  let sawOpening = false;

  for (const row of rows) {
    if (row.account !== accountName) continue;
    if (row.kind === 'initial_balance') {
      limit += row.amountMinor;
      sawOpening = true;
    } else if (isCreditLimitChange(row.description, 'credit')) {
      limit += row.amountMinor;
    }
  }

  return sawOpening ? limit : null;
}

export interface CreditLimitPoint {
  effectiveOn: string;
  /** The limit as of that day, not the size of the change. */
  limitMinor: number;
  note: string | null;
}

/**
 * The credit limit over time, as the backup tells it.
 *
 * Same walk as `derivedCreditLimit`, but keeping every step instead of only
 * the total: the opening row is the limit the card started with, and each
 * `Aumento cupo` row moves it. Monefy logged these as deposits because it had
 * nowhere else to put them; here they become what they actually are.
 */
export function creditLimitHistory(
  rows: readonly MonefyRow[],
  accountName: string,
): CreditLimitPoint[] {
  const known = KNOWN_ACCOUNTS[accountName];
  if (known?.type !== 'credit') return [];

  const points: CreditLimitPoint[] = [];
  let limit = 0;

  for (const row of rows) {
    if (row.account !== accountName) continue;

    if (row.kind === 'initial_balance') {
      limit += row.amountMinor;
      points.push({ effectiveOn: row.occurredOn, limitMinor: limit, note: 'Cupo inicial' });
    } else if (isCreditLimitChange(row.description, 'credit')) {
      limit += row.amountMinor;
      points.push({ effectiveOn: row.occurredOn, limitMinor: limit, note: row.description });
    }
  }

  // Two changes on the same day are one answer: the last one stated wins, the
  // same rule the unique index enforces.
  const byDay = new Map<string, CreditLimitPoint>();
  for (const point of points) byDay.set(point.effectiveOn, point);

  return [...byDay.values()].sort((a, b) => a.effectiveOn.localeCompare(b.effectiveOn));
}
