/**
 * Loads what the movements screen shows, and keeps it in step with the filter.
 *
 * The page stays a template: it reads signals and renders. Everything about
 * which rows to fetch and what they mean lives here.
 */

import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';

import { DatabaseService } from '../../core/database/database.service';
import { AccountsRepository } from '../../core/database/repositories/accounts.repository';
import {
  TransactionsRepository, type DetailedTransaction,
} from '../../core/database/repositories/transactions.repository';
import type { Period } from '../../core/filters/period';
import { FilterService } from '../../core/filters/filter.service';
import { I18nService } from '../../core/i18n/i18n.service';
import type { AccountRow } from '../../core/database/types';
import { formatMoney as money } from '../../core/database/money';
import {
  flowOf, groupMovements, matchesSearch, slicesOf, totalsOf,
  type AmountBasis, type Movement, type MovementGroup, type Slice, type Totals,
} from './group-movements';

@Injectable({ providedIn: 'root' })
export class MovementsStore {
  private readonly database = inject(DatabaseService);
  private readonly filter = inject(FilterService);
  private readonly i18n = inject(I18nService);

  readonly accounts = signal<AccountRow[]>([]);
  readonly loading = signal(false);

  /**
   * What the selected account holds right now, and net worth when the
   * selection is all of them.
   *
   * Deliberately not tied to the period. Looking at March does not change how
   * much money there is today, and "how much do I have" is the question
   * someone opens a finance app with — Monefy answers it at the top of the
   * screen and it is the one figure this app was still missing.
   */
  readonly standing = signal<Standing | null>(null);

  /** Everything in scope for the period, before search or category filtering. */
  private readonly rows = signal<Movement[]>([]);

  /** Groups the user has collapsed, by key. */
  private readonly collapsed = signal<ReadonlySet<string>>(new Set());

  readonly selectedAccount = computed(() => {
    const id = this.filter.accountId();
    return id === null ? null : this.accounts().find(a => a.id === id) ?? null;
  });

  /** How many accounts "all" is currently hiding, so the UI can offer them. */
  readonly hiddenCount = computed(() =>
    this.accounts().filter(a => !a.archived && a.include_in_net_worth === 0).length,
  );

  /** Products set outside net worth in the accounts being looked at. */
  readonly setAsideProducts = signal(0);

  /**
   * The period and the accounts chosen, and nothing else applied.
   *
   * What the donut adds up, and what the financial summary reports on. A word
   * typed in the search box or a slice tapped on the ring narrows what is
   * LISTED - they are ways of looking through the period, not a smaller
   * period - and a report of "September" that quietly left out everything not
   * matching "didi" would be wrong without looking wrong.
   */
  readonly inScope = computed<readonly Movement[]>(() => this.rows());

  /** After the search box and any category picked from the donut. */
  readonly visible = computed(() => {
    const search = this.filter.search();
    const category = this.filter.categoryFilter();

    return this.rows()
      .filter(movement => category === null || movement.label === category)
      .filter(movement => matchesSearch(movement, search));
  });

  /**
   * Whether the figures on screen are in one account's own currency.
   *
   * True when a single account is selected: everything in it is already
   * denominated the same way. False for "all accounts", where dollars and
   * euros are in play and pesos are the only thing they share.
   */
  readonly basis = computed<AmountBasis>(() =>
    this.selectedAccount() === null ? 'base' : 'own');

  readonly totals = computed<Totals>(() => totalsOf(this.visible(), this.basis()));
  readonly slices = computed<Slice[]>(() => slicesOf(this.rows(), this.basis()));

  readonly groups = computed<MovementGroup[]>(() =>
    groupMovements(this.visible(), this.filter.grouping(), this.filter.sortWithin(),
      this.i18n.dateLocale(), this.i18n.t('summary.allMovements'), this.basis()),
  );

  /** True when every group is collapsed, so one control can do both jobs. */
  readonly allCollapsed = computed(() => {
    const groups = this.groups();
    return groups.length > 0 && groups.every(group => this.collapsed().has(group.key));
  });

  readonly currency = computed(() => this.selectedAccount()?.currency_code ?? 'COP');

  constructor() {
    // Groups arrive closed. Reading `groups()` here is what makes this fire
    // on a new question and not on someone opening one of them: the collapse
    // set is written, never read, by this effect.
    effect(() => this.closeNewGroups());

    effect(() => {
      // Reruns whenever the database opens, the data changes, or the filter
      // moves. Everything downstream is derived, so this is the only load.
      this.database.dataVersion();
      this.i18n.language();
      this.filter.accountId();
      this.filter.period();
      this.filter.includeExcluded();

      if (this.database.status() === 'ready') void this.load();
    });
  }

  /**
   * What the collapse state was last set up for.
   *
   * Every new question - another account, another period, another way of
   * grouping - starts closed. Landing on four hundred rows is not useful;
   * landing on twelve categories with their totals is, and opening one is
   * a tap. It also means the expensive part of a long list is never paid
   * for until someone asks to see it.
   *
   * Saving an edit is NOT a new question. It was treated as one, because the
   * only thing watched was the list of group keys and correcting a movement's
   * category or date changes those - so every correction shut the list you
   * were reading and put you back at the top of it. The question is watched
   * directly now, and on a reload only groups that were not there before
   * arrive closed.
   */
  private lastQuestion = '';
  private knownKeys: ReadonlySet<string> = new Set();

  private closeNewGroups(): void {
    const groups = this.groups();
    const keys = groups.map(group => group.key);

    // Mid-reload the list is briefly whatever it was; acting on that would
    // discard the collapse state and then re-close everything when the real
    // rows land.
    if (this.loading()) return;

    const question = [
      this.filter.accountId(),
      this.filter.period().kind, this.filter.period().from, this.filter.period().to,
      this.filter.grouping(), this.filter.search(), this.filter.includeExcluded(),
    ].join('|');

    untracked(() => {
      if (question !== this.lastQuestion) {
        this.lastQuestion = question;
        this.knownKeys = new Set(keys);
        this.collapsed.set(new Set(keys));
        return;
      }

      const fresh = keys.filter(key => !this.knownKeys.has(key));
      const gone = keys.length !== this.knownKeys.size;
      if (fresh.length === 0 && !gone) return;

      const surviving = new Set(keys);
      this.knownKeys = surviving;
      this.collapsed.update(current => {
        const next = new Set([...current].filter(key => surviving.has(key)));
        for (const key of fresh) next.add(key);
        return next;
      });
    });
  }

  isCollapsed(key: string): boolean {
    return this.collapsed().has(key);
  }

  toggleGroup(key: string): void {
    this.collapsed.update(current => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  collapseAll(): void {
    this.collapsed.set(new Set(this.groups().map(group => group.key)));
  }

  expandAll(): void {
    this.collapsed.set(new Set());
  }

  toggleAll(): void {
    if (this.allCollapsed()) this.expandAll();
    else this.collapseAll();
  }

  /** Only asked once: after that the filter has an answer of its own. */
  private startResolved = false;

  /**
   * Starts on the account the spending actually happens on.
   *
   * "Todas las cuentas" is a summary of everything, which is rarely the
   * question being asked when the app is opened — the answer wanted is
   * usually about the account money is spent from. Most used over the last
   * year, so a rare purchase somewhere else does not move where the app
   * opens. Choosing any account by hand, "todas" included, ends the guessing
   * for good.
   */
  private async openOnBusiestAccount(accounts: readonly AccountRow[]): Promise<void> {
    if (this.startResolved) return;
    this.startResolved = true;

    const since = aYearAgo();
    const ranked = await this.database.driver.query<{ account_id: number }>(
      `SELECT account_id, COUNT(*) AS times
       FROM transactions
       WHERE transfer_id IS NULL AND amount_minor < 0 AND occurred_on >= ?
       GROUP BY account_id
       ORDER BY times DESC
       LIMIT 5`,
      [since],
    );

    const busiest = ranked.find(row => accounts.some(a => a.id === row.account_id && !a.archived));
    this.filter.startOn(busiest?.account_id ?? null);
  }

  /**
   * The figure that answers "how much do I have", for whatever is selected.
   *
   * A credit card holds a debt rather than money, so it says what is owed and
   * how much room is left — the two numbers that matter about a card and that
   * Monefy mixed into one.
   */
  private async loadStanding(accounts: AccountsRepository): Promise<void> {
    const selected = this.filter.accountId();

    if (selected === null) {
      this.standing.set({
        kind: 'net-worth',
        label: this.i18n.t('summary.netWorthToday'),
        amountMinor: await accounts.netWorthMinor(),
        currency: 'COP',
        detail: null,
      });
      return;
    }

    // What a product set aside holds is not the account's to spend, unless
    // the switch to include what is set aside is on.
    const balance = await accounts.balance(selected, { leaveOutSetAside: !this.filter.includeExcluded() });
    if (balance === null) {
      this.standing.set(null);
      return;
    }

    const currency = balance.account.currency_code;
    if (balance.account.type === 'credit') {
      const limit = balance.account.credit_limit_minor;
      this.standing.set({
        kind: 'credit',
        label: this.i18n.t('summary.owedToday'),
        amountMinor: balance.balance_minor,
        currency,
        detail: balance.available_credit_minor === null || limit === null
          ? null
          : this.i18n.t('summary.available', {
              available: money(balance.available_credit_minor, currency, { withSymbol: false }),
              limit: money(limit, currency, { withSymbol: false }),
            }),
      });
      return;
    }

    this.standing.set({
      kind: 'balance',
      label: this.i18n.t('summary.balanceToday'),
      amountMinor: balance.balance_minor,
      currency,
      detail: null,
    });
  }

  async load(): Promise<void> {
    const driver = this.database.driver;
    this.loading.set(true);

    try {
      const accountsRepo = new AccountsRepository(driver);
      const accounts = await accountsRepo.list({ includeArchived: true });
      this.accounts.set(accounts);

      await this.openOnBusiestAccount(accounts);
      await this.loadStanding(accountsRepo);

      const scope = this.filter.scopeFor(accounts);

      const setAside = await driver.queryOne<{ total: number }>(
        `SELECT COUNT(*) AS total FROM yield_pockets
         WHERE include_in_net_worth = 0 AND account_id IN (${scope.map(() => '?').join(', ') || 'NULL'})`,
        [...scope]);
      this.setAsideProducts.set(setAside?.total ?? 0);

      this.rows.set(await this.movementsFor(this.filter.period(), accounts));
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * The movements of any stretch of time, filtered exactly as this screen
   * filters them.
   *
   * Shared with the financial summary, which needs an earlier period to
   * compare against. It has to come through here and not through a query of
   * its own: the rules below about transfers and products set aside are what
   * decide the figures, and a comparison whose two sides were filtered
   * differently would invent a change that never happened.
   */
  async movementsFor(period: Period, accounts?: readonly AccountRow[]): Promise<Movement[]> {
    const driver = this.database.driver;
    const scope = this.filter.scopeFor(accounts ?? this.accounts());

    const detailed = await new TransactionsRepository(driver).listDetailed({
      accountIds: scope,
      from: period.from ?? undefined,
      to: period.to ?? undefined,
    });

    // A transfer is only invisible when both of its ends are inside what is
    // being looked at: moving money between two accounts you are counting
    // changes nothing. Moving it to an account outside the scope - eToro,
    // Pibank para renta, an archived one - really is money leaving, and
    // hiding it would lose it.
    //
    // A product set outside net worth is outside the scope in the same way,
    // even inside the same account: its own movements are hidden, and the
    // transfer that fed it - Pibank's savings into a tax CDT - is money gone.
    const inScope = new Set(scope);
    const leaveOut = !this.filter.includeExcluded();

    const visible = detailed.filter(row => {
      if (leaveOut && row.pocket_set_aside === 1) return false;
      return row.transfer_id === null ||
        row.other_account_id === null ||
        !inScope.has(row.other_account_id) ||
        (leaveOut && row.other_pocket_set_aside === 1);
    });

    return visible.map(row => toMovement(row, this.i18n));
  }
}

/**
 * Turns a database row into something the screen can label.
 *
 * A transfer leg has no category, so it is labelled by where the money went or
 * came from — which is what it means — rather than left blank.
 */
function toMovement(row: DetailedTransaction, i18n: I18nService): Movement {
  const isTransfer = row.transfer_id !== null;
  // The account's own name is data and stays as it was typed; only the "to"
  // and "from" around it are the app speaking.
  // Money moved into a product set aside is named by that product: "a Pibank"
  // says nothing when both ends are Pibank.
  const setAsideProduct = row.other_pocket_set_aside === 1 ? row.other_pocket_name : null;
  const other = setAsideProduct !== null
    ? (row.other_account_id === row.account_id ? setAsideProduct : `${row.other_account_name} · ${setAsideProduct}`)
    : row.other_account_name ?? i18n.t('movement.otherAccount');

  return {
    transaction: row,
    accountName: row.account_name,
    accountType: row.account_type,
    currency: row.currency_code,
    label: isTransfer
      ? i18n.t(row.transfer_leg === 'from' ? 'movement.toAccount' : 'movement.fromAccount',
               { account: other })
      : row.category_name ?? i18n.t('movement.noCategory'),
    // A transfer wears the far account's face. The generic swap arrow said
    // only "this is a transfer", which the colour and the wording already say.
    // It falls back to the arrow when the far account is outside what is being
    // looked at and there is no row to read an icon from.
    icon: isTransfer
      ? row.other_account_builtin_icon ?? (row.other_account_custom_icon_id === null
          ? 'swap-horizontal-outline'
          : null)
      : row.category_icon,
    customIconId: isTransfer ? row.other_account_custom_icon_id : row.category_custom_icon_id,
    accountIcon: row.account_builtin_icon,
    accountCustomIconId: row.account_custom_icon_id,
    flow: flowOf(row, row.account_type),
  };
}

/** Today, one year back. Text dates compare in the same order as real ones. */
function aYearAgo(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear() - 1}-${month}-${day}`;
}

/**
 * What the account holds today, however the period is set.
 *
 * `kind` exists so the screen can colour a debt differently from a balance
 * without re-deriving why the figure is negative.
 */
export interface Standing {
  kind: 'balance' | 'credit' | 'net-worth';
  label: string;
  amountMinor: number;
  currency: string;
  /** A second line, when one figure is not the whole answer. */
  detail: string | null;
}
