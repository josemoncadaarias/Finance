/**
 * The stock market module, as the screens see it: what is on record, what it
 * is worth, reading a broker's statement and asking for today's prices.
 *
 * It stands apart from the rest of the app, like the tax simulator: a trade
 * is not a movement, nothing here changes a balance or net worth, and no
 * other screen depends on it.
 */
import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';

import { DatabaseService } from '../database/database.service';
import { RatesRepository, RATE_SCALE } from '../database/repositories/rates.repository';
import type { IsoDate } from '../database/types';
import { isoDay } from '../filters/period';
import { GoogleAccountService } from '../cloud/google-account.service';
import { DemoService } from '../demo/demo.service';
import { I18nService } from '../i18n/i18n.service';
import { noteError } from '../feedback/error-log';
import { StatementUnreadable, stopIfCancelled } from '../statements/pdf-text';
import { nameOf, textOf, type ReadingWatch } from '../statements/statements.service';
import { bookOf, totalsOf, valueOf, type Quote, type Trade } from './positions';
import { readBroker, type BrokerReading, type BrokerRow } from './read-broker';
import { candidatesFor, inCurrency, quotesFrom, toE6 } from './quotes';
import { SheetsError, askSheet, createSheet } from './sheets-client';
import { StocksRepository, type Instrument, type PriceRow, type TradeInput } from './stocks.repository';

/** Only files this app itself made in the person's Drive: one spreadsheet. */
const SHEET_SCOPE = 'https://www.googleapis.com/auth/drive.file';

const SHEET_ID = 'stocks.sheet';
const PRICES_AT = 'stocks.pricesAt';
const AUTO = 'stocks.auto';

/** Google delays prices about twenty minutes: asking more often brings nothing new. */
const FRESH_MS = 20 * 60 * 1000;

export type PricesState =
  | 'idle' | 'working' | 'done'
  /** Sample data: its prices are invented and Google is never asked. */
  | 'demo'
  /** No Google sign-in here (a browser). */
  | 'unavailable'
  /** The person did not give the permission. */
  | 'declined'
  | 'offline'
  /** The Sheets API is off for the app's Google project. */
  | 'disabled'
  | 'failed';

/** A statement read and not saved yet: what the person looks at before saying yes. */
export interface StockImport {
  name: string;
  reading: BrokerReading;
}

@Injectable({ providedIn: 'root' })
export class StocksService {
  private readonly database = inject(DatabaseService);
  private readonly google = inject(GoogleAccountService);
  private readonly demo = inject(DemoService);
  private readonly i18n = inject(I18nService);

  readonly loaded = signal(false);
  readonly trades = signal<Trade[]>([]);
  readonly instruments = signal<Map<string, Instrument>>(new Map());
  readonly quotes = signal<Map<string, Quote>>(new Map());
  readonly history = signal<PriceRow[]>([]);
  /** Pesos per unit of each currency on record, pesos as 1. */
  readonly pesosPer = signal<Map<string, number>>(new Map([['COP', 1]]));

  readonly pricesState = signal<PricesState>('idle');
  /** When Google was last asked and answered. */
  readonly pricesAt = signal<string | null>(null);
  /** The person turned automatic prices on. */
  readonly auto = signal(false);
  /** Tickers held that Google did not answer for, the last time it was asked. */
  readonly missing = signal<string[]>([]);
  /** What went wrong, as Google said it, for "Reportar un fallo". */
  readonly failure = signal('');

  readonly book = computed(() => bookOf(this.trades()));
  readonly valued = computed(() => {
    const quotes = this.quotes();
    return this.book().positions.map(position => valueOf(position, quotes.get(position.symbol) ?? null));
  });
  readonly totals = computed(() => totalsOf(this.book(), this.valued()));
  readonly held = computed(() => this.valued().filter(one => one.position.quantityE8 > 0));
  readonly canAskGoogle = this.google.available;

  private generation = 0;

  constructor() {
    effect(() => {
      // The triggers, read here; the work, untracked (an async call inside an
      // effect is tracked only up to its first await).
      const ready = this.database.status() === 'ready';
      this.database.dataVersion();
      if (ready) untracked(() => { void this.load(); });
    });
  }

  private repository(): StocksRepository {
    return new StocksRepository(this.database.driver);
  }

  async load(): Promise<void> {
    const mine = ++this.generation;
    const repository = this.repository();
    const today = isoDay(new Date()) as IsoDate;
    try {
      const count = await repository.count();
      if (count === 0) {
        if (mine !== this.generation) return;
        this.trades.set([]);
        this.quotes.set(new Map());
        this.history.set([]);
        this.instruments.set(new Map());
        this.loaded.set(true);
        return;
      }
      const [trades, instruments, quotes, history, rates, at, auto] = await Promise.all([
        repository.trades(), repository.instruments(), repository.latestPrices(today), repository.priceHistory(),
        new RatesRepository(this.database.driver).allInForce('COP', today),
        repository.setting(PRICES_AT), repository.setting(AUTO),
      ]);
      if (mine !== this.generation) return;
      const pesos = new Map<string, number>([['COP', 1]]);
      for (const [code, rate] of rates) pesos.set(code, rate.rate_scaled / RATE_SCALE);
      this.trades.set(trades);
      this.instruments.set(instruments);
      this.quotes.set(quotes);
      this.history.set(history);
      this.pesosPer.set(pesos);
      this.pricesAt.set(at);
      this.auto.set(auto === '1');
      this.loaded.set(true);
    } catch (failure) {
      noteError(failure);
      this.loaded.set(true);
    }
  }

  // ---- A broker's statement ------------------------------------------------------

  /** Reads a statement and writes nothing: the person sees it first (rule 22). */
  async read(chosen: File | File[], password?: string, watch: ReadingWatch = {}): Promise<StockImport> {
    const files = Array.isArray(chosen) ? chosen : [chosen];
    const items = await textOf(files, password, watch);
    watch.onProgress?.({ part: 0.8, stage: 'reading' });
    const reading = readBroker(items);
    if (reading.rows.length === 0) throw new StatementUnreadable(this.i18n.t('stocks.import.nothing'));
    stopIfCancelled(watch.signal);
    watch.onProgress?.({ part: 1, stage: 'writing' });
    return { name: nameOf(files), reading };
  }

  /** Which of a statement's rows are not on record yet for that account. */
  newRows(accountId: number | null, rows: readonly BrokerRow[]): Promise<BrokerRow[]> {
    return this.repository().newOnes(accountId, rows);
  }

  async save(accountId: number | null, currency: string, pending: StockImport): Promise<number> {
    const repository = this.repository();
    const written = await repository.importRows(accountId, currency, pending.name, pending.reading.rows);
    await repository.keepStatedPrices(pending.reading.prices);
    this.database.dataChanged();
    return written;
  }

  /** Deletes every trade, or one account's, so a statement can be imported again. */
  async erase(scope: 'all' | { accountId: number | null }): Promise<number> {
    const gone = await this.repository().eraseTrades(scope);
    this.missing.set([]);
    this.pricesState.set('idle');
    this.database.dataChanged();
    return gone;
  }

  // ---- By hand ---------------------------------------------------------------------

  async addTrade(input: TradeInput): Promise<void> {
    await this.repository().create(input);
    this.database.dataChanged();
  }

  async changeTrade(id: number, input: TradeInput): Promise<void> {
    await this.repository().update(id, input);
    this.database.dataChanged();
  }

  async removeTrade(id: number): Promise<void> {
    await this.repository().remove(id);
    this.database.dataChanged();
  }

  /** A price typed for today, in the position's own currency. */
  async typePrice(symbol: string, priceE6: number): Promise<void> {
    await this.repository().setPrice(symbol, isoDay(new Date()) as IsoDate, priceE6, null, 'manual');
    await this.load();
  }

  /** Today's typed price taken back: the fetched one answers again. */
  async forgetTypedPrice(symbol: string): Promise<void> {
    await this.repository().forgetPrice(symbol, isoDay(new Date()) as IsoDate);
    await this.load();
  }

  async nameInstrument(symbol: string, change: { name?: string | null; quote?: string | null }): Promise<void> {
    await this.repository().saveInstrument(symbol, change);
    await this.load();
  }

  // ---- Today's prices ----------------------------------------------------------------

  /** True when prices are worth asking for again by themselves. */
  stale(): boolean {
    const at = this.pricesAt();
    return at === null || Date.now() - new Date(at).getTime() > FRESH_MS;
  }

  /**
   * Asks Google Finance for the price of everything held, through the
   * person's own spreadsheet.
   *
   * `ask` is the person pressing the button: only then may Google's screen
   * come up, to sign in or to give the permission. By itself (on opening) it
   * runs only once the person turned it on, and shows nothing.
   */
  async refreshPrices(options: { ask?: boolean } = {}): Promise<void> {
    if (this.pricesState() === 'working') return;
    const held = this.held();
    if (held.length === 0) return;
    if (this.demo.active()) { this.pricesState.set('demo'); return; }
    if (!this.google.available) { this.pricesState.set('unavailable'); return; }
    if (!options.ask && !this.auto()) return;

    this.pricesState.set('working');
    this.failure.set('');
    const repository = this.repository();
    try {
      let token = await this.google.scopedToken(SHEET_SCOPE, { ask: options.ask });
      if (!token) { this.pricesState.set(options.ask ? 'declined' : 'idle'); return; }

      const instruments = this.instruments();
      const asked = held.map(one => {
        const known = instruments.get(one.position.symbol)?.quote;
        return {
          symbol: one.position.symbol,
          currency: one.position.currency,
          candidates: known ? [known] : candidatesFor(one.position.symbol, one.position.asset, one.position.currency),
        };
      });
      const candidates = [...new Set(asked.flatMap(one => one.candidates))];

      let sheetId = await repository.setting(SHEET_ID);
      let values: unknown[][] | null = null;
      for (let attempt = 0; attempt < 3 && values === null; attempt += 1) {
        try {
          if (!sheetId) {
            sheetId = await createSheet(token, this.i18n.t('stocks.sheet.title'));
            await repository.setSetting(SHEET_ID, sheetId);
          }
          values = await askSheet(token, sheetId, candidates);
        } catch (failure) {
          if (!(failure instanceof SheetsError)) throw failure;
          if (failure.kind === 'gone') {
            // The person deleted the spreadsheet from their Drive: another is made.
            sheetId = null;
            await repository.setSetting(SHEET_ID, null);
          } else if (failure.kind === 'auth' && attempt === 0) {
            this.google.forgetScoped(SHEET_SCOPE);
            token = await this.google.scopedToken(SHEET_SCOPE, { ask: options.ask });
            if (!token) { this.pricesState.set(options.ask ? 'declined' : 'idle'); return; }
          } else {
            throw failure;
          }
        }
      }
      if (values === null) throw new SheetsError('server', 'no answer');

      const answered = quotesFrom(values);
      const pesos = this.pesosPer();
      const today = isoDay(new Date()) as IsoDate;
      const missing: string[] = [];
      await this.database.driver.transaction(async () => {
        for (const one of asked) {
          const found = one.candidates.map(candidate => answered.get(candidate)).find(quote => quote !== undefined);
          const price = found ? inCurrency(found.price, found.currency, one.currency, pesos) : null;
          if (!found || price === null) { missing.push(one.symbol); continue; }
          const previous = found.previous === null ? null : inCurrency(found.previous, found.currency, one.currency, pesos);
          await repository.setPrice(one.symbol, today, toE6(price), previous === null ? null : toE6(previous), 'sheet');
          const known = instruments.get(one.symbol);
          await repository.saveInstrument(one.symbol, {
            quote: found.quote, facts: found.facts, ...(known?.name ? {} : { name: found.name }),
          });
        }
        await repository.setSetting(PRICES_AT, new Date().toISOString());
        await repository.setSetting(AUTO, '1');
      });
      this.missing.set(missing);
      await this.load();
      this.pricesState.set('done');
    } catch (failure) {
      noteError(failure);
      this.failure.set(failure instanceof Error ? failure.message.slice(0, 300) : String(failure));
      const kind = failure instanceof SheetsError ? failure.kind : 'server';
      this.pricesState.set(kind === 'network' ? (navigator.onLine ? 'failed' : 'offline') : kind === 'disabled' ? 'disabled' : 'failed');
    }
  }

  /** Stops asking Google by itself. The prices kept stay; the sheet stays in the person's Drive. */
  async stopAuto(): Promise<void> {
    await this.repository().setSetting(AUTO, null);
    this.auto.set(false);
  }
}
