/**
 * Goals written and read (migration 054), and what their places hold on a
 * day - the only thing a goal's progress is made of.
 *
 * Every figure handed out is in pesos at the rate in force on `rateDay`
 * (today, for everything on screen), so the pace a goal shows is money that
 * came in, never a dollar that moved.
 */

import type { SqlDriver } from '../database/sql-driver';
import type { IsoDate } from '../database/types';
import { AccountsRepository } from '../database/repositories/accounts.repository';
import { RatesRepository, convertAt, type Rate } from '../database/repositories/rates.repository';
import { YieldsRepository } from '../database/repositories/yields.repository';
import { TaxParametersRepository } from '../database/repositories/tax-parameters.repository';
import { AccrualEngine } from '../yields/accrual';
import type { SpendRow } from '../limits/limits';
import { placeCount, type GoalKind, type GoalPlace, type GoalTerms, type PlaceCounts } from './goals';

const BASE = 'COP';

export interface GoalInput {
  name: string;
  icon: string;
  color: string | null;
  amountMinor: number;
  dueMonth: string | null;
  kind: GoalKind;
  months: number | null;
  allAccounts: boolean;
  places: { accountId: number; productId: number | null; counts: PlaceCounts }[];
}

interface GoalSql {
  id: number; name: string; builtin_icon: string; color: string | null; amount_minor: number;
  due_month: string | null; kind: GoalKind; months: number | null; all_accounts: number;
  started_on: string; reached_on: string | null; archived: number;
}

interface PlaceSql {
  id: number; goal_id: number; account_id: number; product_id: number | null; counts: PlaceCounts; start_minor: number;
}

/** A place's key: the account, and the product or 0 for the whole account. */
export const placeKey = (accountId: number, productId: number | null) => `${accountId}:${productId ?? 0}`;

export class GoalsRepository {
  private readonly db: SqlDriver;
  private readonly now: () => string;

  constructor(db: SqlDriver, now: () => string = () => new Date().toISOString()) {
    this.db = db;
    this.now = now;
  }

  async all(): Promise<GoalTerms[]> {
    const goals = await this.db.query<GoalSql>('SELECT * FROM goals ORDER BY id');
    const places = await this.db.query<PlaceSql>('SELECT * FROM goal_places ORDER BY id');
    return goals.map(g => ({
      id: g.id, name: g.name, icon: g.builtin_icon, color: g.color, amountMinor: g.amount_minor,
      dueMonth: g.due_month, kind: g.kind, months: g.months, allAccounts: g.all_accounts === 1,
      startedOn: g.started_on, reachedOn: g.reached_on, archived: g.archived === 1,
      places: places.filter(p => p.goal_id === g.id).map(p => ({
        id: p.id, accountId: p.account_id, productId: p.product_id, counts: p.counts, startMinor: p.start_minor,
      })),
    }));
  }

  async create(input: GoalInput, today: IsoDate): Promise<number> {
    return this.db.transaction(async () => {
      const at = this.now();
      const { lastId } = await this.db.run(
        `INSERT INTO goals (name, builtin_icon, color, amount_minor, due_month, kind, months, all_accounts,
                            started_on, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [input.name, input.icon, input.color, input.amountMinor, input.dueMonth, input.kind, input.months,
          input.allAccounts ? 1 : 0, today, at, at]);
      const id = Number(lastId);
      await this.placeAll(id, input, [], today);
      return id;
    });
  }

  /** A place kept keeps the figure it started from; a new one starts from today. */
  async update(id: number, input: GoalInput, today: IsoDate): Promise<void> {
    await this.db.transaction(async () => {
      await this.db.run(
        `UPDATE goals SET name = ?, builtin_icon = ?, color = ?, amount_minor = ?, due_month = ?, kind = ?,
                months = ?, all_accounts = ?, updated_at = ? WHERE id = ?`,
        [input.name, input.icon, input.color, input.amountMinor, input.dueMonth, input.kind, input.months,
          input.allAccounts ? 1 : 0, this.now(), id]);
      const before = await this.db.query<PlaceSql>('SELECT * FROM goal_places WHERE goal_id = ?', [id]);
      await this.db.run('DELETE FROM goal_places WHERE goal_id = ?', [id]);
      await this.placeAll(id, input, before, today);
    });
  }

  private async placeAll(id: number, input: GoalInput, before: readonly PlaceSql[], today: IsoDate): Promise<void> {
    if (input.allAccounts) return;
    for (const place of input.places) {
      const kept = before.find(p => p.account_id === place.accountId && (p.product_id ?? null) === place.productId);
      let start = 0;
      if (place.counts === 'from_start') {
        start = kept && kept.counts === 'from_start' ? kept.start_minor
          : (await this.holdsOn([{ accountId: place.accountId, productId: place.productId }], today)).get(placeKey(place.accountId, place.productId)) ?? 0;
      }
      await this.db.run(
        'INSERT INTO goal_places (goal_id, account_id, product_id, counts, start_minor) VALUES (?, ?, ?, ?, ?)',
        [id, place.accountId, place.productId, place.counts, start]);
    }
  }

  async setAmount(id: number, amountMinor: number): Promise<void> {
    await this.db.run('UPDATE goals SET amount_minor = ?, updated_at = ? WHERE id = ?', [amountMinor, this.now(), id]);
  }

  async setDueMonth(id: number, dueMonth: string | null): Promise<void> {
    await this.db.run('UPDATE goals SET due_month = ?, updated_at = ? WHERE id = ?', [dueMonth, this.now(), id]);
  }

  async setReached(id: number, day: IsoDate | null): Promise<void> {
    await this.db.run('UPDATE goals SET reached_on = ?, updated_at = ? WHERE id = ?', [day, this.now(), id]);
  }

  async setArchived(id: number, archived: boolean): Promise<void> {
    await this.db.run('UPDATE goals SET archived = ?, updated_at = ? WHERE id = ?', [archived ? 1 : 0, this.now(), id]);
  }

  async remove(id: number): Promise<void> {
    await this.db.run('DELETE FROM goals WHERE id = ?', [id]);
  }

  /** What each place held at the close of `day`, in its own currency. */
  async holdsOn(places: readonly { accountId: number; productId: number | null }[], day: IsoDate): Promise<Map<string, number>> {
    const out = new Map<string, number>();
    const accounts = new AccountsRepository(this.db);
    const withProducts = [...new Set(places.filter(p => p.productId !== null).map(p => p.accountId))];
    const yields = new YieldsRepository(this.db);
    const engine = new AccrualEngine(this.db, yields, new TaxParametersRepository(this.db));
    for (const accountId of withProducts) {
      const products = await yields.products(accountId);
      const held = await engine.heldByProduct(accountId, day, products);
      const landed = await yields.landedByProduct(accountId, day, products);
      for (const product of products) {
        out.set(placeKey(accountId, product.id), (held.get(product.id) ?? 0) + (landed.total.get(product.id) ?? 0));
      }
    }
    for (const place of places) {
      if (place.productId === null) out.set(placeKey(place.accountId, null), await accounts.balanceOn(place.accountId, day));
    }
    return out;
  }

  /** The rates in force on a day, to turn every place into pesos. */
  async rates(day: IsoDate): Promise<Map<string, Rate>> {
    return new RatesRepository(this.db).allInForce(BASE, day);
  }

  /** Each account's currency, and whether it counts for "Todas tus cuentas". */
  async accountFacts(): Promise<Map<number, { currency: string; inAll: boolean }>> {
    const rows = await this.db.query<{ id: number; currency_code: string; type: string; include_in_net_worth: number; archived: number; loan: number }>(
      `SELECT a.id, a.currency_code, a.type, a.include_in_net_worth, a.archived,
              EXISTS (SELECT 1 FROM loans l WHERE l.account_id = a.id) AS loan
         FROM accounts a`);
    return new Map(rows.map(r => [r.id, {
      currency: r.currency_code,
      // Money held: counted in net worth, live, and neither a card nor a loan - debts are not savings.
      inAll: r.include_in_net_worth === 1 && r.archived === 0 && r.type !== 'credit' && r.loan === 0,
    }]));
  }

  /** Products set outside net worth: their money is not part of "Todas tus cuentas". */
  async setAsideProducts(): Promise<Set<number>> {
    const rows = await this.db.query<{ id: number }>('SELECT id FROM products WHERE include_in_net_worth = 0');
    return new Set(rows.map(r => r.id));
  }

  /**
   * What every account counted for "Todas tus cuentas" held at the close of
   * `day`, by account, in its own currency - the balance the summary shows,
   * products set outside net worth left out.
   */
  async allAccountsOn(day: IsoDate): Promise<Map<number, number>> {
    const facts = await this.accountFacts();
    const lines = (await new AccountsRepository(this.db).netWorth({ asOf: day })).lines;
    return new Map(lines.filter(l => facts.get(l.account_id)?.inAll).map(l => [l.account_id, l.balance_minor]));
  }

  /** Every expense from `since`, all categories, for the emergency fund's average. */
  async spendRows(since: IsoDate): Promise<SpendRow[]> {
    const rows = await this.db.query<{ id: number; category_id: number; account_id: number; type: string;
      include_in_net_worth: number; occurred_on: string; amount_base_minor: number; description: string | null }>(
      `SELECT t.id, t.category_id, t.account_id, a.type, a.include_in_net_worth, t.occurred_on,
              t.amount_base_minor, t.description
         FROM transactions t JOIN accounts a ON a.id = t.account_id
        WHERE t.transfer_id IS NULL AND t.category_id IS NOT NULL AND t.occurred_on >= ?`, [since]);
    return rows.map(r => ({
      id: r.id, categoryId: r.category_id, accountId: r.account_id, accountType: r.type,
      inNetWorth: r.include_in_net_worth === 1, occurredOn: r.occurred_on, amountMinor: r.amount_base_minor,
      description: r.description,
    }));
  }
}

/** A figure in an account's currency, in pesos at the given rates; null with no rate. */
export function inPesos(minor: number, currency: string, rates: ReadonlyMap<string, Rate>): number | null {
  if (currency === BASE) return minor;
  const rate = rates.get(currency);
  return rate ? convertAt(minor, rate.rate_scaled) : null;
}

/**
 * What every goal has on a day, in pesos: its places, or for "Todas tus
 * cuentas" what the counted accounts hold less what the other goals' places
 * inside them hold - so no peso counts in two goals.
 */
export async function savedOn(
  repo: GoalsRepository, goals: readonly GoalTerms[], day: IsoDate, rates: ReadonlyMap<string, Rate>,
): Promise<{ saved: Map<number, number>; byPlace: Map<string, number> }> {
  const facts = await repo.accountFacts();
  const places = goals.flatMap(g => g.places);
  const holds = await repo.holdsOn(places, day);
  const byPlace = new Map<string, number>();
  const saved = new Map<number, number>();
  const placePesos = (place: GoalPlace) =>
    inPesos(placeCount(place, holds.get(placeKey(place.accountId, place.productId)) ?? 0),
      facts.get(place.accountId)?.currency ?? BASE, rates) ?? 0;

  for (const goal of goals) {
    if (goal.allAccounts) continue;
    let total = 0;
    for (const place of goal.places) {
      const pesos = placePesos(place);
      byPlace.set(placeKey(place.accountId, place.productId), pesos);
      total += pesos;
    }
    saved.set(goal.id, total);
  }

  if (goals.some(g => g.allAccounts)) {
    const setAside = await repo.setAsideProducts();
    const all = await repo.allAccountsOn(day);
    let everything = 0;
    for (const [accountId, minor] of all) everything += inPesos(minor, facts.get(accountId)!.currency, rates) ?? 0;
    // What the specific goals hold inside those same accounts is theirs already.
    let others = 0;
    for (const goal of goals) {
      if (goal.allAccounts) continue;
      for (const place of goal.places) {
        if (!all.has(place.accountId) || (place.productId !== null && setAside.has(place.productId))) continue;
        others += Math.max(0, byPlace.get(placeKey(place.accountId, place.productId)) ?? 0);
      }
    }
    for (const goal of goals.filter(g => g.allAccounts)) saved.set(goal.id, everything - others);
  }
  return { saved, byPlace };
}
