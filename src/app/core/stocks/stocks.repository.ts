/**
 * The stock market as stored (migration 063): trades, what is known of each
 * ticker, and the prices kept day by day. Read once and answered in memory by
 * `positions.ts`; a statement is written many rows per statement, never one
 * round trip per row (the phone's bridge is what costs).
 */
import type { SqlDriver } from '../database/sql-driver';
import type { IsoDate } from '../database/types';
import type { Quote, Trade } from './positions';
import { rowKey, type AssetKind, type BrokerRow, type TradeKind } from './read-broker';

interface TradeRow {
  id: number;
  account_id: number | null;
  kind: TradeKind;
  symbol: string | null;
  asset: AssetKind | null;
  traded_on: IsoDate;
  traded_at: string | null;
  quantity_e8: number | null;
  price_e6: number | null;
  amount_minor: number;
  currency: string;
  split_num: number | null;
  split_den: number | null;
  ref: string | null;
  source: 'manual' | 'statement';
  note: string | null;
}

/** What a person types, or a statement's row once it has an account and a currency. */
export interface TradeInput {
  accountId: number | null;
  kind: TradeKind;
  symbol: string | null;
  asset: AssetKind | null;
  day: IsoDate;
  time: string | null;
  quantityE8: number | null;
  priceE6: number | null;
  amountMinor: number;
  currency: string;
  ratio: [number, number] | null;
  ref: string | null;
  note: string | null;
}

export interface Instrument {
  symbol: string;
  name: string | null;
  /** How Google Finance writes it, once found or typed. */
  quote: string | null;
  facts: Facts | null;
}

/** The day's other figures, as Google Finance gives them. Any may be missing. */
export interface Facts {
  pe?: number;
  eps?: number;
  marketCap?: number;
  high52?: number;
  low52?: number;
  currency?: string;
}

export interface PriceRow {
  symbol: string;
  day: IsoDate;
  price_e6: number;
  previous_e6: number | null;
  source: 'sheet' | 'manual' | 'demo';
}

function fromRow(row: TradeRow): Trade {
  return {
    id: row.id, accountId: row.account_id, kind: row.kind, symbol: row.symbol, day: row.traded_on, time: row.traded_at,
    quantityE8: row.quantity_e8, priceE6: row.price_e6, amountMinor: row.amount_minor, currency: row.currency,
    ratio: row.split_num !== null && row.split_den !== null ? [row.split_num, row.split_den] : null,
    ref: row.ref, asset: row.asset, source: row.source, note: row.note,
  };
}

const COLUMNS = `account_id, kind, symbol, asset, traded_on, traded_at, quantity_e8, price_e6, amount_minor, currency,
                 split_num, split_den, ref, dedupe, source, batch, note, created_at, updated_at`;

export class StocksRepository {
  private readonly db: SqlDriver;
  private readonly now: () => string;

  constructor(db: SqlDriver, now: () => string = () => new Date().toISOString()) {
    this.db = db;
    this.now = now;
  }

  async trades(): Promise<Trade[]> {
    return (await this.db.query<TradeRow>(
      'SELECT * FROM stock_trades ORDER BY traded_on, traded_at, id')).map(fromRow);
  }

  async count(): Promise<number> {
    return (await this.db.queryOne<{ n: number }>('SELECT COUNT(*) AS n FROM stock_trades'))?.n ?? 0;
  }

  private values(input: TradeInput, source: 'manual' | 'statement', batch: string | null, t: string): unknown[] {
    return [
      input.accountId, input.kind, input.symbol, input.asset, input.day, input.time, input.quantityE8, input.priceE6,
      input.amountMinor, input.currency, input.ratio?.[0] ?? null, input.ratio?.[1] ?? null, input.ref,
      rowKey(input), source, batch, input.note, t, t,
    ];
  }

  async create(input: TradeInput): Promise<number> {
    const result = await this.db.run(
      `INSERT INTO stock_trades (${COLUMNS}) VALUES (${Array(19).fill('?').join(', ')})`,
      this.values(input, 'manual', null, this.now()));
    return Number(result.lastId);
  }

  async update(id: number, input: TradeInput): Promise<void> {
    await this.db.run(
      `UPDATE stock_trades SET account_id = ?, kind = ?, symbol = ?, asset = ?, traded_on = ?, traded_at = ?,
              quantity_e8 = ?, price_e6 = ?, amount_minor = ?, currency = ?, split_num = ?, split_den = ?, ref = ?,
              dedupe = ?, note = ?, updated_at = ? WHERE id = ?`,
      [input.accountId, input.kind, input.symbol, input.asset, input.day, input.time, input.quantityE8, input.priceE6,
        input.amountMinor, input.currency, input.ratio?.[0] ?? null, input.ratio?.[1] ?? null, input.ref,
        rowKey(input), input.note, this.now(), id]);
  }

  async remove(id: number): Promise<void> {
    await this.db.run('DELETE FROM stock_trades WHERE id = ?', [id]);
  }

  /** Everything read from statements for one account (or for none): to read them again from scratch. */
  async removeBatch(accountId: number | null): Promise<number> {
    const result = accountId === null
      ? await this.db.run(`DELETE FROM stock_trades WHERE source = 'statement' AND account_id IS NULL`)
      : await this.db.run(`DELETE FROM stock_trades WHERE source = 'statement' AND account_id = ?`, [accountId]);
    return result.changes;
  }

  /**
   * Which of a statement's rows are not on record yet for that account.
   *
   * One read of the keys already there, answered in memory.
   */
  async newOnes(accountId: number | null, rows: readonly BrokerRow[]): Promise<BrokerRow[]> {
    const have = new Set((await this.db.query<{ dedupe: string }>(
      accountId === null
        ? 'SELECT dedupe FROM stock_trades WHERE account_id IS NULL'
        : 'SELECT dedupe FROM stock_trades WHERE account_id = ?',
      accountId === null ? [] : [accountId])).map(row => row.dedupe));
    return rows.filter(row => !have.has(rowKey(row)));
  }

  /** Writes a statement's rows, many per statement. Answers how many went in. */
  async importRows(
    accountId: number | null, currency: string, batch: string, rows: readonly BrokerRow[],
  ): Promise<number> {
    const fresh = await this.newOnes(accountId, rows);
    if (fresh.length === 0) return 0;
    const t = this.now();
    await this.db.transaction(async () => {
      const PER = 40;
      for (let at = 0; at < fresh.length; at += PER) {
        const chunk = fresh.slice(at, at + PER);
        const one = `(${Array(19).fill('?').join(', ')})`;
        await this.db.run(
          `INSERT INTO stock_trades (${COLUMNS}) VALUES ${chunk.map(() => one).join(', ')}`,
          chunk.flatMap(row => this.values({
            accountId, kind: row.kind, symbol: row.symbol, asset: row.asset, day: row.day, time: row.time,
            quantityE8: row.quantityE8, priceE6: row.priceE6, amountMinor: row.amountMinor, currency,
            ratio: row.ratio, ref: row.ref, note: null,
          }, 'statement', batch, t)));
      }
    });
    return fresh.length;
  }

  // ---- Tickers -----------------------------------------------------------------

  async instruments(): Promise<Map<string, Instrument>> {
    const rows = await this.db.query<{ symbol: string; name: string | null; quote: string | null; facts: string | null }>(
      'SELECT symbol, name, quote, facts FROM stock_instruments');
    return new Map(rows.map(row => [row.symbol, {
      symbol: row.symbol, name: row.name, quote: row.quote, facts: parseFacts(row.facts),
    }]));
  }

  /** Only what is given changes: a name typed is not lost when a price arrives. */
  async saveInstrument(symbol: string, change: { name?: string | null; quote?: string | null; facts?: Facts | null }): Promise<void> {
    const t = this.now();
    await this.db.run(
      'INSERT INTO stock_instruments (symbol, updated_at) VALUES (?, ?) ON CONFLICT(symbol) DO NOTHING', [symbol, t]);
    if (change.name !== undefined) await this.db.run('UPDATE stock_instruments SET name = ?, updated_at = ? WHERE symbol = ?', [change.name, t, symbol]);
    if (change.quote !== undefined) await this.db.run('UPDATE stock_instruments SET quote = ?, updated_at = ? WHERE symbol = ?', [change.quote, t, symbol]);
    if (change.facts !== undefined) {
      await this.db.run('UPDATE stock_instruments SET facts = ?, updated_at = ? WHERE symbol = ?',
        [change.facts === null ? null : JSON.stringify(change.facts), t, symbol]);
    }
  }

  // ---- Prices ------------------------------------------------------------------

  /** The newest price of every ticker, on or before `asOf`. */
  async latestPrices(asOf: IsoDate): Promise<Map<string, Quote>> {
    const rows = await this.db.query<PriceRow>(
      `SELECT p.symbol, p.day, p.price_e6, p.previous_e6, p.source
       FROM stock_prices p
       JOIN (SELECT symbol, MAX(day) AS newest FROM stock_prices WHERE day <= ? GROUP BY symbol) n
         ON n.symbol = p.symbol AND n.newest = p.day`, [asOf]);
    return new Map(rows.map(row => [row.symbol, {
      priceE6: row.price_e6, previousE6: row.previous_e6, day: row.day, source: row.source,
    }]));
  }

  /** Every price kept, for the chart of what the holdings were worth. */
  async priceHistory(): Promise<PriceRow[]> {
    return this.db.query<PriceRow>('SELECT symbol, day, price_e6, previous_e6, source FROM stock_prices ORDER BY day');
  }

  /**
   * Keeps a day's price. A fetched one never writes over a price typed that
   * same day (rule 7: what the person wrote wins).
   */
  async setPrice(symbol: string, day: IsoDate, priceE6: number, previousE6: number | null, source: PriceRow['source']): Promise<void> {
    if (source !== 'manual') {
      const typed = await this.db.queryOne<{ source: string }>(
        'SELECT source FROM stock_prices WHERE symbol = ? AND day = ?', [symbol, day]);
      if (typed?.source === 'manual') return;
    }
    await this.db.run(
      `INSERT INTO stock_prices (symbol, day, price_e6, previous_e6, source, fetched_at) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(symbol, day) DO UPDATE SET price_e6 = excluded.price_e6, previous_e6 = excluded.previous_e6,
         source = excluded.source, fetched_at = excluded.fetched_at`,
      [symbol, day, priceE6, previousE6, source, this.now()]);
  }

  /** A typed price taken back: the last fetched one, if any, answers again. */
  async forgetPrice(symbol: string, day: IsoDate): Promise<void> {
    await this.db.run(`DELETE FROM stock_prices WHERE symbol = ? AND day = ? AND source = 'manual'`, [symbol, day]);
  }

  // ---- Settings ------------------------------------------------------------------

  async setting(key: string): Promise<string | null> {
    return (await this.db.queryOne<{ value: string }>('SELECT value FROM settings WHERE key = ?', [key]))?.value ?? null;
  }

  async setSetting(key: string, value: string | null): Promise<void> {
    if (value === null) {
      await this.db.run('DELETE FROM settings WHERE key = ?', [key]);
      return;
    }
    await this.db.run(
      `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      [key, value, this.now()]);
  }
}

function parseFacts(raw: string | null): Facts | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Facts;
  } catch {
    return null;
  }
}
