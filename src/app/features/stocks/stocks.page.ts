/**
 * Bolsa de valores (Jose, 2026-11-12): what was bought at a broker, what it
 * is worth today and how it has gone, from the broker's own statement.
 *
 * It stands apart from the rest of the app: nothing here writes a movement
 * or changes a balance. A statement is read, shown and only then saved
 * (rule 22); every price can be typed (rule 7); and with no network the last
 * prices kept answer, with their day (rule 1).
 */
import { Component, computed, effect, inject, signal, untracked, viewChild, type ElementRef } from '@angular/core';
import { Location } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { IonContent, IonIcon, IonModal, IonSpinner } from '@ionic/angular';

import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { I18nService } from '../../core/i18n/i18n.service';
import type { TranslationKey } from '../../core/i18n/translations';
import { DatabaseService } from '../../core/database/database.service';
import { AccountsRepository } from '../../core/database/repositories/accounts.repository';
import type { AccountRow, IsoDate } from '../../core/database/types';
import { amountsHidden, formatMoney, HIDDEN_AMOUNT } from '../../core/database/money';
import { fromIsoDay, isoDay } from '../../core/filters/period';
import { ReaderNotReady, canReadImages, lastPages, statementAccept, statementFiles, textOfImages } from '../../core/statements/image-text';
import { readPosition } from '../../core/stocks/read-position';
import { currencyName, flagOf } from '../../core/currencies/catalog';
import { foldText } from '../../core/text/fold-text';
import { JumpComponent } from '../../shared/ui/jump.component';
import { StatementFlowService } from '../../core/statements/statement-flow.service';
import { StocksService, type StockImport } from '../../core/stocks/stocks.service';
import {
  formatQuantity, monthsOf, sameDayPairs, spreadOf, worthByDay, worthOf, type Trade, type Valued,
} from '../../core/stocks/positions';
import { PRICE_SCALE, QUANTITY_SCALE, scaledOf, type AssetKind, type BrokerRow, type TradeKind } from '../../core/stocks/read-broker';
import type { TradeInput } from '../../core/stocks/stocks.repository';
import { AmountBuffer } from '../entry/amount-buffer';
import { AmountInputDirective } from '../../shared/ui/amount-input.directive';
import { DateFieldComponent } from '../../shared/ui/date-field.component';
import { BadgeComponent } from '../../shared/ui/badge.component';
import { AskButtonComponent } from '../../shared/ui/ask-button.component';
import { AmountsEyeComponent } from '../../shared/ui/amounts-eye.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { ConfirmComponent } from '../../shared/confirm/confirm.component';
import { AccountPickerComponent } from '../../shared/account-picker/account-picker.component';
import { ToastService } from '../../shared/ui/toast.service';
import { PaywallService } from '../../core/paywall/paywall.service';
import { MainCurrencyService } from '../../core/currencies/main-currency.service';
import { ReturnsChartComponent } from './returns-chart.component';

type Face = 'positions' | 'charts' | 'history';
type HistoryFilter = 'all' | 'trades' | 'dividends' | 'cash' | 'sameDay';
type HistoryGroup = 'month' | 'day' | 'symbol' | 'asset';

const DETAIL_KEY = 'finance.stocks.detail';
const GROUP_KEY = 'finance.stocks.group';

const ASSET_ICON: Record<AssetKind, string> = { stock: 'business-outline', etf: 'layers-outline', crypto: 'logo-bitcoin', other: 'shapes-outline' };
const ASSET_COLOR: Record<AssetKind, string> = { stock: '#6378ff', etf: '#34c98b', crypto: '#f6b93b', other: '#9b7bff' };

function kept(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function keep(key: string, value: string): void {
  try { localStorage.setItem(key, value); } catch { /* a private window: the choice lasts while the screen is open */ }
}

/** The chart's own colours, told apart on the dark and the light card. */
const PALETTE = ['#6378ff', '#34c98b', '#f6b93b', '#f2709c', '#2ec4b6', '#9b7bff', '#ff8a4c', '#4aa3ff'];
const OTHERS = '#8a93a8';

const KIND_ICON: Record<TradeKind, string> = {
  buy: 'arrow-down-circle-outline', sell: 'arrow-up-circle-outline', dividend: 'gift-outline', tax: 'receipt-outline',
  fee: 'pricetag-outline', interest: 'trending-up-outline', split: 'git-branch-outline', deposit: 'wallet-outline',
  withdrawal: 'exit-outline',
};
const KIND_COLOR: Record<TradeKind, string> = {
  buy: '#6378ff', sell: '#f6b93b', dividend: '#34c98b', tax: '#ef5b66', fee: '#ef5b66', interest: '#34c98b',
  split: '#9b7bff', deposit: '#2ec4b6', withdrawal: '#ff8a4c',
};

/** What a person typed as a number, with a comma or a full stop: "0,1203", "1.234,5". */
function typedNumber(text: string): string | null {
  const raw = text.trim().replace(/\s/g, '');
  if (!/^\d[\d.,]*$/.test(raw)) return null;
  const lastDot = raw.lastIndexOf('.');
  const lastComma = raw.lastIndexOf(',');
  const mark = Math.max(lastDot, lastComma);
  if (mark < 0) return raw;
  const whole = raw.slice(0, mark).replace(/[.,]/g, '');
  const fraction = raw.slice(mark + 1);
  if (!/^\d*$/.test(fraction)) return null;
  return fraction.length > 0 ? `${whole || '0'}.${fraction}` : whole;
}

function colorOf(symbol: string): string {
  let hash = 0;
  for (const letter of symbol) hash = (hash * 31 + letter.charCodeAt(0)) % 9973;
  return PALETTE[hash % PALETTE.length];
}

interface Bar { label: string; long: string; minor: number; height: number; }

@Component({
  selector: 'app-stocks',
  templateUrl: './stocks.page.html',
  styleUrls: ['./stocks.page.scss'],
  imports: [TranslatePipe, IonContent, IonIcon, IonModal, IonSpinner, BadgeComponent, AskButtonComponent, AmountsEyeComponent,
    EmptyStateComponent, ConfirmComponent, AccountPickerComponent, DateFieldComponent, AmountInputDirective, ReturnsChartComponent, JumpComponent],
})
export class StocksPage {
  readonly stocks = inject(StocksService);
  readonly i18n = inject(I18nService);
  private readonly database = inject(DatabaseService);
  private readonly flow = inject(StatementFlowService);
  private readonly toast = inject(ToastService);
  private readonly location = inject(Location);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  readonly pro = inject(PaywallService);
  private readonly mainCurrency = inject(MainCurrencyService);

  private readonly file = viewChild.required<ElementRef<HTMLInputElement>>('file');
  private readonly photo = viewChild.required<ElementRef<HTMLInputElement>>('photo');
  readonly accept = statementAccept();
  readonly images = canReadImages();

  readonly face = signal<Face>('positions');
  readonly accounts = signal<AccountRow[]>([]);
  private readonly accountNames = computed(() => new Map(this.accounts().map(account => [account.id, account.name])));

  // ---- What is on view ----------------------------------------------------------

  /** The currency on view, when what is held is in more than one. */
  private readonly chosenCurrency = signal<string | null>(null);
  readonly currencies = computed(() => this.stocks.totals().map(total => total.currency));
  readonly currency = computed(() => {
    const all = this.currencies();
    const chosen = this.chosenCurrency();
    return chosen !== null && all.includes(chosen) ? chosen : all[0] ?? 'USD';
  });
  readonly total = computed(() => this.stocks.totals().find(total => total.currency === this.currency()) ?? null);

  /** Whether any position held has a price: without one there is only what was paid. */
  readonly priced = computed(() => {
    const total = this.total();
    return total !== null && total.held > 0 && total.unquoted < total.held;
  });

  /**
   * What is held, in the person's main currency (pesos unless another was
   * chosen in Monedas y TRM), at today's rate. Shown only here: the market
   * moves every day, so this never joins net worth (Jose, 2026-11-12).
   */
  readonly inMain = computed(() => {
    const total = this.total();
    const main = this.mainCurrency.code();
    const pesos = this.stocks.pesosPer();
    const [from, to] = [pesos.get(this.currency()), pesos.get(main)];
    if (!total || !from || !to || this.currency() === main) return null;
    return { amount: this.money(Math.round(total.valueMinor * from / to), main), name: main };
  });

  /** The ticker the returns chart is about; everything held when null. */
  readonly returnsSymbol = signal<string | null>(null);
  readonly chartSymbols = computed(() => [...this.held().map(one => one.position.symbol), ...this.sold().map(one => one.position.symbol)]);

  readonly held = computed(() => this.stocks.valued()
    .filter(one => one.position.quantityE8 > 0 && one.position.currency === this.currency())
    .sort((a, b) => b.valueMinor - a.valueMinor));
  /** Bought and sold again the same day: the broker undoing an order, not a sale somebody decided. */
  readonly pairs = computed(() => sameDayPairs(this.stocks.trades()));
  /** Tickers whose every purchase and sale was undone the same day: nothing was ever really held. */
  private readonly undoneOnly = computed(() => {
    const pairs = this.pairs();
    const all = new Map<string, boolean>();
    for (const trade of this.stocks.trades()) {
      if (trade.symbol === null || (trade.kind !== 'buy' && trade.kind !== 'sell')) continue;
      all.set(trade.symbol, (all.get(trade.symbol) ?? true) && pairs.has(trade.id));
    }
    return new Set([...all.entries()].filter(([, only]) => only).map(([symbol]) => symbol));
  });
  readonly undoneCount = computed(() => this.stocks.trades()
    .filter(trade => trade.kind === 'sell' && trade.currency === this.currency() && this.pairs().has(trade.id)).length);
  readonly sold = computed(() => this.stocks.valued()
    .filter(one => one.position.quantityE8 === 0 && one.position.currency === this.currency()
      && !this.undoneOnly().has(one.position.symbol)
      && (one.position.soldMinor > 0 || one.position.dividendsMinor !== 0))
    .sort((a, b) => b.position.lastDay.localeCompare(a.position.lastDay)));
  readonly soldOpen = signal(false);

  private readonly shares = computed(() => new Map(spreadOf(this.stocks.valued(), this.currency()).map(slice => [slice.symbol, slice.share])));

  /** When the prices on show are from, in words. */
  readonly pricesLine = computed(() => {
    const quotes = this.held().map(one => one.quote).filter(quote => quote !== null);
    if (quotes.length === 0) return this.i18n.t('stocks.prices.none');
    const day = quotes.map(quote => quote.day).sort()[0];
    const today = isoDay(new Date());
    const typed = quotes.every(quote => quote.source === 'manual');
    const demo = quotes.some(quote => quote.source === 'demo');
    if (demo) return this.i18n.t('stocks.prices.demo');
    const at = this.stocks.pricesAt();
    if (day === today && !typed && at) {
      const time = new Intl.DateTimeFormat(this.i18n.dateLocale(), { hour: 'numeric', minute: '2-digit' }).format(new Date(at));
      return this.i18n.t('stocks.prices.today', { time });
    }
    if (day !== today && quotes.some(quote => quote.source === 'statement' && quote.day === day)) return this.i18n.t('stocks.prices.fromStatement', { day: this.dayWords(day) });
    return this.i18n.t(day === today ? 'stocks.prices.typedToday' : 'stocks.prices.from', { day: this.dayWords(day) });
  });
  readonly pricesOld = computed(() => {
    const quotes = this.held().map(one => one.quote).filter(quote => quote !== null);
    return quotes.length > 0 && quotes.some(quote => quote.day !== isoDay(new Date()));
  });

  /** The state of the prices in three words, as Monedas y TRM says its own. */
  readonly pricesChip = computed((): { tone: 'good' | 'warn' | 'none' | 'info'; icon: string; text: string } => {
    if (this.stocks.pricesState() === 'working') return { tone: 'info', icon: 'sync-outline', text: this.i18n.t('stocks.chip.working') };
    const quotes = this.held().map(one => one.quote).filter(quote => quote !== null);
    if (quotes.length === 0) return { tone: 'none', icon: 'help-circle-outline', text: this.i18n.t('stocks.chip.none') };
    if (quotes.some(quote => quote.source === 'demo')) return { tone: 'info', icon: 'flask-outline', text: this.i18n.t('stocks.chip.demo') };
    const day = quotes.map(quote => quote.day).sort()[0];
    const today = isoDay(new Date());
    if (day !== today) return { tone: 'warn', icon: 'time-outline', text: this.i18n.t('stocks.chip.from', { day: this.shortDay(day) }) };
    const at = this.stocks.pricesAt();
    const total = this.total();
    if (total && total.unquoted > 0) return { tone: 'warn', icon: 'alert-circle-outline', text: this.i18n.t('stocks.chip.some', { count: total.unquoted }) };
    if (at && quotes.some(quote => quote.source === 'sheet')) {
      const time = new Intl.DateTimeFormat(this.i18n.dateLocale(), { hour: 'numeric', minute: '2-digit' }).format(new Date(at));
      return { tone: 'good', icon: 'checkmark-circle', text: this.i18n.t('stocks.chip.today', { time }) };
    }
    return { tone: 'good', icon: 'checkmark-circle', text: this.i18n.t('stocks.chip.todayPlain') };
  });

  /** "1 USD = 3.182,99 COP": the rate the value in the main currency was worked out at. */
  readonly rateLine = computed(() => {
    const main = this.mainCurrency.code();
    const pesos = this.stocks.pesosPer();
    const [from, to] = [pesos.get(this.currency()), pesos.get(main)];
    if (!from || !to || this.currency() === main) return null;
    const rate = new Intl.NumberFormat(this.i18n.dateLocale(), { minimumFractionDigits: 2, maximumFractionDigits: from / to < 10 ? 4 : 2 }).format(from / to);
    return `1 ${this.currency()} = ${rate} ${main}`;
  });

  readonly detailOpen = signal(kept(DETAIL_KEY) === '1');
  toggleDetail(): void {
    this.detailOpen.set(!this.detailOpen());
    keep(DETAIL_KEY, this.detailOpen() ? '1' : '0');
  }
  readonly pricesSheet = signal(false);
  readonly addSheet = signal(false);

  // ---- Charts ---------------------------------------------------------------------

  /** How what is held is spread: the seven largest and the rest together. */
  readonly donut = computed(() => {
    const slices = spreadOf(this.stocks.valued(), this.currency());
    const top = slices.slice(0, 7).map((slice, at) => ({ ...slice, color: PALETTE[at % PALETTE.length], name: slice.symbol }));
    const rest = slices.slice(7);
    if (rest.length > 0) {
      top.push({
        symbol: '', name: this.i18n.t('stocks.chart.others', { count: rest.length }), color: OTHERS,
        valueMinor: rest.reduce((all, slice) => all + slice.valueMinor, 0), share: rest.reduce((all, slice) => all + slice.share, 0),
      });
    }
    const around = 2 * Math.PI * 52;
    let before = 0;
    return top.map(slice => {
      const length = around * slice.share / 100;
      const arc = { ...slice, dash: `${Math.max(length - 1.5, 0.5)} ${around - Math.max(length - 1.5, 0.5)}`, offset: -before };
      before += length;
      return arc;
    });
  });

  /** Gain or loss of each position with a price, the best first. */
  readonly gains = computed(() => {
    const rows = this.held().filter(one => one.gainMinor !== null && one.gainPct !== null)
      .sort((a, b) => (b.gainPct ?? 0) - (a.gainPct ?? 0));
    const most = Math.max(1, ...rows.map(one => Math.abs(one.gainPct ?? 0)));
    return rows.map(one => ({
      symbol: one.position.symbol, minor: one.gainMinor ?? 0, pct: one.gainPct ?? 0,
      width: Math.max(2, Math.abs(one.gainPct ?? 0) / most * 100),
    }));
  });

  private readonly months = computed(() => monthsOf(this.stocks.trades(), this.currency(), isoDay(new Date()) as IsoDate));

  private bars(pick: (point: ReturnType<typeof monthsOf>[number]) => number): Bar[] {
    const points = this.months().slice(-12);
    const most = Math.max(1, ...points.map(point => Math.abs(pick(point))));
    return points.map(point => {
      const date = fromIsoDay(`${point.month}-01`);
      return {
        label: new Intl.DateTimeFormat(this.i18n.dateLocale(), { month: 'short' }).format(date).replace('.', ''),
        long: new Intl.DateTimeFormat(this.i18n.dateLocale(), { month: 'long', year: 'numeric' }).format(date),
        minor: pick(point),
        height: Math.max(pick(point) === 0 ? 0 : 3, Math.abs(pick(point)) / most * 100),
      };
    });
  }
  readonly boughtBars = computed(() => this.bars(point => point.boughtMinor));
  readonly dividendBars = computed(() => this.bars(point => point.dividendsMinor));
  readonly hasDividends = computed(() => this.months().some(point => point.dividendsMinor !== 0));
  readonly tappedBought = signal<number | null>(null);
  readonly tappedDividend = signal<number | null>(null);

  /** Dividends less withholding, by year. */
  readonly dividendYears = computed(() => {
    const years = new Map<string, number>();
    for (const point of this.months()) years.set(point.month.slice(0, 4), (years.get(point.month.slice(0, 4)) ?? 0) + point.dividendsMinor);
    return [...years.entries()].filter(([, minor]) => minor !== 0).sort((a, b) => b[0].localeCompare(a[0]));
  });

  /** What everything held had cost, month by month, as a line. */
  readonly investedLine = computed(() => {
    const points = this.months();
    if (points.length < 2) return null;
    const most = Math.max(1, ...points.map(point => point.investedMinor));
    const step = 300 / (points.length - 1);
    const xy = points.map((point, at) => `${(at * step).toFixed(1)},${(104 - point.investedMinor / most * 96).toFixed(1)}`);
    const first = fromIsoDay(`${points[0].month}-01`);
    return {
      line: xy.join(' '),
      area: `0,108 ${xy.join(' ')} 300,108`,
      from: new Intl.DateTimeFormat(this.i18n.dateLocale(), { month: 'short', year: 'numeric' }).format(first),
      now: points[points.length - 1].investedMinor,
    };
  });

  /** Value against cost on each day a price was kept: grows from the first day prices were asked. */
  readonly worthLine = computed(() => {
    const days = worthByDay(this.stocks.trades(), this.stocks.history(), this.currency());
    if (days.length < 2) return null;
    const most = Math.max(...days.map(day => Math.max(day.valueMinor, day.costMinor)));
    const least = Math.min(...days.map(day => Math.min(day.valueMinor, day.costMinor)));
    const span = Math.max(1, most - least);
    const step = 300 / (days.length - 1);
    const line = (pick: (day: typeof days[number]) => number) =>
      days.map((day, at) => `${(at * step).toFixed(1)},${(102 - (pick(day) - least) / span * 92).toFixed(1)}`).join(' ');
    return {
      value: line(day => day.valueMinor), cost: line(day => day.costMinor),
      from: this.dayWords(days[0].day), to: this.dayWords(days[days.length - 1].day),
    };
  });

  /** Shares against funds, as one bar. */
  readonly kinds = computed(() => {
    const byKind = new Map<AssetKind | 'unknown', number>();
    for (const one of this.held()) {
      const kind = one.position.asset ?? 'unknown';
      byKind.set(kind, (byKind.get(kind) ?? 0) + one.valueMinor);
    }
    const all = [...byKind.values()].reduce((sum, minor) => sum + minor, 0);
    if (all === 0 || byKind.size < 2) return [];
    const colors: Record<string, string> = { stock: '#6378ff', etf: '#34c98b', crypto: '#f6b93b', other: '#9b7bff', unknown: OTHERS };
    return [...byKind.entries()].sort((a, b) => b[1] - a[1]).map(([kind, minor]) => ({
      name: this.i18n.t(`stocks.kind.${kind}` as 'stocks.kind.stock'), share: minor / all * 100, minor, color: colors[kind],
    }));
  });

  // ---- History --------------------------------------------------------------------

  readonly filter = signal<HistoryFilter>('all');
  readonly group = signal<HistoryGroup>((['month', 'day', 'symbol', 'asset'] as const).find(one => one === kept(GROUP_KEY)) ?? 'month');
  readonly search = signal('');
  readonly searching = signal(false);
  readonly filterSheet = signal(false);
  /** The sections the person opened or closed; null while only the first is open. */
  private readonly openSections = signal<Set<string> | null>(null);
  readonly filters: HistoryFilter[] = ['all', 'trades', 'dividends', 'cash', 'sameDay'];
  readonly groups: HistoryGroup[] = ['month', 'day', 'symbol', 'asset'];
  readonly filterIcons: Record<HistoryFilter, string> = {
    all: 'list-outline', trades: 'swap-vertical-outline', dividends: 'gift-outline', cash: 'wallet-outline', sameDay: 'repeat-outline',
  };
  readonly groupIcons: Record<HistoryGroup, string> = {
    month: 'calendar-outline', day: 'today-outline', symbol: 'pricetag-outline', asset: 'shapes-outline',
  };

  /** What each row says, folded once: the search reads it on every key. */
  private readonly searchable = computed(() => new Map(this.stocks.trades().map(trade => [trade.id, foldText([
    trade.symbol ?? '', this.nameOf(trade.symbol ?? '') ?? '', this.i18n.t(`stocks.trade.${trade.kind}` as 'stocks.trade.buy'),
    trade.note ?? '', this.dayWords(trade.day), trade.day, String(Math.abs(trade.amountMinor) / 100), formatMoney(Math.abs(trade.amountMinor), trade.currency, { shown: true }),
  ].join(' '))])));

  private readonly historyRows = computed(() => {
    const filter = this.filter();
    const pairs = this.pairs();
    const words = foldText(this.search().trim()).split(/\s+/).filter(word => word !== '');
    const said = this.searchable();
    return this.stocks.trades().filter(trade => trade.currency === this.currency() && (
      filter === 'all' ? true
        : filter === 'trades' ? (trade.kind === 'buy' || trade.kind === 'sell' || trade.kind === 'split') && !pairs.has(trade.id)
          : filter === 'sameDay' ? pairs.has(trade.id)
            : filter === 'dividends' ? trade.kind === 'dividend' || trade.kind === 'tax'
              : trade.kind === 'deposit' || trade.kind === 'withdrawal' || trade.kind === 'fee' || trade.kind === 'interest')
      && words.every(word => (said.get(trade.id) ?? '').includes(word)));
  });
  readonly historyCount = computed(() => this.historyRows().length);

  /** The history in folding sections: by month, by day, by ticker or by kind of asset. */
  readonly historySections = computed(() => {
    const group = this.group();
    const assets = new Map(this.stocks.valued().map(one => [one.position.symbol, one.position.asset ?? null]));
    const sections = new Map<string, Trade[]>();
    for (const trade of [...this.historyRows()].reverse()) {
      const key = group === 'month' ? trade.day.slice(0, 7)
        : group === 'day' ? trade.day
          : group === 'symbol' ? trade.symbol ?? ''
            : trade.symbol === null ? '' : assets.get(trade.symbol) ?? trade.asset ?? 'unknown';
      sections.set(key, [...(sections.get(key) ?? []), trade]);
    }
    const title = (key: string): string => group === 'month'
      ? new Intl.DateTimeFormat(this.i18n.dateLocale(), { month: 'long', year: 'numeric' }).format(fromIsoDay(`${key}-01`))
      : group === 'day' ? new Intl.DateTimeFormat(this.i18n.dateLocale(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(fromIsoDay(key))
        : key === '' ? this.i18n.t('stocks.history.noSymbol')
          : group === 'symbol' ? key : this.i18n.t(`stocks.kind.${key}` as 'stocks.kind.stock');
    const list = [...sections.entries()].map(([key, trades]) => ({ key, title: title(key), trades }));
    // By ticker or kind: the one with most movements first; what names no ticker last.
    if (group === 'symbol' || group === 'asset') list.sort((a, b) => (a.key === '' ? 1 : 0) - (b.key === '' ? 1 : 0) || b.trades.length - a.trades.length);
    return list;
  });

  isSectionOpen(key: string): boolean {
    if (this.search().trim() !== '') return true;
    const open = this.openSections();
    return open === null ? this.historySections()[0]?.key === key : open.has(key);
  }

  toggleSection(key: string): void {
    const open = new Set(this.openSections() ?? [this.historySections()[0]?.key ?? '']);
    if (open.has(key)) open.delete(key); else open.add(key);
    this.openSections.set(open);
  }

  readonly allFolded = computed(() => {
    const open = this.openSections();
    const sections = this.historySections();
    return open === null ? sections.length === 0 : !sections.some(section => open.has(section.key));
  });

  foldAll(): void {
    this.openSections.set(this.allFolded() ? new Set(this.historySections().map(section => section.key)) : new Set());
  }

  chooseFilter(filter: HistoryFilter): void {
    this.filter.set(filter);
    this.openSections.set(null);
  }

  chooseGroup(group: HistoryGroup): void {
    this.group.set(group);
    keep(GROUP_KEY, group);
    this.openSections.set(null);
  }

  showUndone(): void {
    this.face.set('history');
    this.chooseFilter('sameDay');
  }

  startSearch(): void {
    this.searching.set(true);
  }

  endSearch(): void {
    this.search.set('');
    this.searching.set(false);
  }

  // ---- One position ---------------------------------------------------------------

  readonly openSymbol = signal<string | null>(null);
  readonly position = computed(() => {
    const symbol = this.openSymbol();
    return symbol === null ? null : this.stocks.valued().find(one => one.position.symbol === symbol) ?? null;
  });
  readonly positionTrades = computed(() => {
    const symbol = this.openSymbol();
    return symbol === null ? [] : this.stocks.trades().filter(trade => trade.symbol === symbol).reverse();
  });
  readonly instrument = computed(() => this.stocks.instruments().get(this.openSymbol() ?? '') ?? null);
  /** Where today's price sits between the year's lowest and highest. */
  readonly range = computed(() => {
    const facts = this.instrument()?.facts;
    const quote = this.position()?.quote;
    if (!facts?.low52 || !facts.high52 || !quote || facts.high52 <= facts.low52) return null;
    const price = quote.priceE6 / PRICE_SCALE;
    return {
      low: this.price(Math.round(facts.low52 * PRICE_SCALE), this.position()!.position.currency),
      high: this.price(Math.round(facts.high52 * PRICE_SCALE), this.position()!.position.currency),
      at: Math.min(100, Math.max(0, (price - facts.low52) / (facts.high52 - facts.low52) * 100)),
    };
  });
  readonly typingPrice = signal(false);
  readonly priceText = signal('');
  readonly typingQuote = signal(false);
  readonly quoteText = signal('');
  readonly nameText = signal('');

  // ---- A statement read, waiting for a yes ------------------------------------------

  readonly pending = signal<StockImport | null>(null);
  readonly pendingAccount = signal<number | null>(null);
  readonly pendingCurrency = signal('USD');
  readonly pendingNew = signal<BrokerRow[]>([]);
  readonly pickingAccount = signal<'import' | 'form' | null>(null);
  readonly saving = signal(false);
  readonly unreadOpen = signal(false);

  readonly pendingKinds = computed(() => {
    const order: TradeKind[] = ['buy', 'sell', 'dividend', 'tax', 'deposit', 'withdrawal', 'fee', 'interest', 'split'];
    const rows = this.pendingNew();
    return order.map(kind => {
      const mine = rows.filter(row => row.kind === kind);
      return { kind, count: mine.length, minor: mine.reduce((sum, row) => sum + Math.abs(row.amountMinor), 0) };
    }).filter(one => one.count > 0);
  });
  readonly pendingOff = computed(() => this.pendingNew().filter(row => row.check === 'off'));
  readonly pendingSymbols = computed(() => [...new Set(this.pendingNew().map(row => row.symbol).filter(symbol => symbol !== null))]);
  readonly pendingKnown = computed(() => (this.pending()?.reading.rows.length ?? 0) - this.pendingNew().length);

  // ---- The form: one trade by hand -----------------------------------------------------

  readonly editing = signal<number | 'new' | null>(null);
  readonly formKind = signal<'buy' | 'sell' | 'dividend'>('buy');
  readonly formSymbol = signal('');
  readonly formAsset = signal<AssetKind>('stock');
  readonly formDay = signal<string>(isoDay(new Date()));
  readonly formQuantity = signal('');
  readonly formPrice = signal('');
  readonly formAmount = signal(new AmountBuffer());
  /** The total was typed by hand: it no longer follows quantity times price. */
  private readonly amountTouched = signal(false);
  readonly formAccount = signal<number | null>(null);
  readonly formCurrency = signal('USD');
  readonly formNote = signal('');
  readonly tried = signal(false);
  /** Account, currency and note: folded until wanted. */
  readonly moreOpen = signal(false);
  readonly assetSheet = signal(false);
  readonly currencySheet = signal<'form' | 'import' | null>(null);
  readonly assets: AssetKind[] = ['stock', 'etf', 'crypto', 'other'];
  /** What a photo of a position could not say: the form marks it. */
  readonly fromPhoto = signal<string | null>(null);
  readonly erasing = signal(false);
  readonly deleting = signal<Trade | null>(null);
  /** A row read from a statement, opened: it is shown, and can only be deleted. */
  readonly viewing = signal<Trade | null>(null);

  readonly formWorked = computed(() => {
    const quantity = typedNumber(this.formQuantity());
    const price = typedNumber(this.formPrice());
    if (quantity === null || price === null) return null;
    return worthOf(scaledOf(quantity, QUANTITY_SCALE), scaledOf(price, PRICE_SCALE));
  });
  readonly formMissing = computed(() => {
    if (!/^[A-Z0-9][A-Z0-9.]{0,9}$/.test(this.formSymbol().trim().toUpperCase())) return 'symbol';
    if (this.formKind() === 'dividend') return this.formAmount().minor > 0 ? null : 'amount';
    const quantity = typedNumber(this.formQuantity());
    if (quantity === null || Number(quantity) <= 0) return 'quantity';
    const price = typedNumber(this.formPrice());
    if (price === null || Number(price) <= 0) return 'price';
    return null;
  });

  constructor() {
    effect(() => {
      const ready = this.database.status() === 'ready';
      this.database.dataVersion();
      if (ready) untracked(() => { void this.loadAccounts(); });
    });
    // Prices by themselves on opening, once the person turned them on.
    effect(() => {
      const loaded = this.stocks.loaded();
      const auto = this.stocks.auto();
      const open = this.pro.unlocked();
      if (loaded && auto && open) untracked(() => { if (this.stocks.stale()) void this.stocks.refreshPrices(); });
    });
    // "?import=1" from another screen opens the file chooser's sheet at once.
    const asked = this.route.snapshot.queryParamMap.get('new');
    if (asked === 'trade') queueMicrotask(() => { void this.newTrade(); });
  }

  private async loadAccounts(): Promise<void> {
    const all = await new AccountsRepository(this.database.driver).list();
    this.accounts.set(all.filter(account => !account.archived));
  }

  back(): void {
    if (window.history.length > 1) this.location.back();
    else void this.router.navigate(['/more']);
  }

  chooseCurrency(code: string): void {
    this.chosenCurrency.set(code);
    this.openSections.set(null);
  }

  assetIcon(kind: AssetKind): string { return ASSET_ICON[kind]; }
  assetColor(kind: AssetKind): string { return ASSET_COLOR[kind]; }
  flag(code: string): string { return flagOf(code); }
  currencyWords(code: string): string { return currencyName(code, code, this.i18n.language() === 'en' ? 'en' : 'es'); }

  /** The currencies offered: the one chosen, those the app has a rate for, and the usual ones. */
  readonly currencyOptions = computed(() => [...new Set([
    this.currencySheet() === 'import' ? this.pendingCurrency() : this.formCurrency(), ...this.currencies(), 'USD', 'EUR', 'GBP', 'COP',
    ...this.stocks.pesosPer().keys(),
  ])]);

  chooseMoney(code: string): void {
    if (this.currencySheet() === 'import') this.pendingCurrency.set(code); else this.formCurrency.set(code);
    this.currencySheet.set(null);
  }

  shortDay(day: string): string {
    return new Intl.DateTimeFormat(this.i18n.dateLocale(), { day: 'numeric', month: 'short' }).format(fromIsoDay(day)).replace('.', '');
  }

  // ---- Words ------------------------------------------------------------------------

  /** A key put together in the template ("stocks.kind." and the kind). */
  word(key: string, values?: Record<string, string | number>): string {
    return this.i18n.t(key as TranslationKey, values);
  }

  money(minor: number, currency: string = this.currency()): string {
    return formatMoney(minor, currency);
  }

  signed(minor: number, currency: string = this.currency()): string {
    const text = formatMoney(Math.abs(minor), currency);
    return amountsHidden() ? text : `${minor < 0 ? '−' : '+'}${text}`;
  }

  /** A price: two decimals from one unit of money up, more below it. */
  price(priceE6: number, currency: string): string {
    if (amountsHidden()) return HIDDEN_AMOUNT;
    if (priceE6 >= PRICE_SCALE) return formatMoney(Math.round(priceE6 / (PRICE_SCALE / 100)), currency, { shown: true });
    const value = new Intl.NumberFormat(this.i18n.dateLocale(), { maximumFractionDigits: 6 }).format(priceE6 / PRICE_SCALE);
    return `${value} ${currency}`;
  }

  pct(value: number): string {
    const text = new Intl.NumberFormat(this.i18n.dateLocale(), { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(Math.abs(value));
    return `${value < 0 ? '−' : '+'}${text} %`;
  }

  share(symbol: string): number {
    return this.shares().get(symbol) ?? 0;
  }

  sharePct(symbol: string): string {
    return `${new Intl.NumberFormat(this.i18n.dateLocale(), { maximumFractionDigits: 1 }).format(this.share(symbol))} %`;
  }

  quantity(quantityE8: number): string {
    return formatQuantity(quantityE8, this.i18n.dateLocale());
  }

  dayWords(day: string): string {
    return new Intl.DateTimeFormat(this.i18n.dateLocale(), { day: 'numeric', month: 'short', year: 'numeric' }).format(fromIsoDay(day));
  }

  nameOf(symbol: string): string | null {
    return this.stocks.instruments().get(symbol)?.name ?? null;
  }

  colorOf = colorOf;
  kindIcon(kind: TradeKind): string { return KIND_ICON[kind]; }
  kindColor(kind: TradeKind): string { return KIND_COLOR[kind]; }

  accountName(id: number | null): string {
    return id === null ? this.i18n.t('stocks.account.none') : this.accountNames().get(id) ?? this.i18n.t('stocks.account.none');
  }

  tradeTitle(trade: Trade): string {
    const kind = this.i18n.t(`stocks.trade.${trade.kind}` as 'stocks.trade.buy');
    return trade.symbol ? `${kind} · ${trade.symbol}` : kind;
  }

  tradeLine(trade: Trade): string {
    const day = this.dayWords(trade.day);
    if ((trade.kind === 'buy' || trade.kind === 'sell') && trade.quantityE8 !== null && trade.priceE6 !== null) {
      return this.i18n.t('stocks.trade.line', {
        quantity: this.quantity(trade.quantityE8), price: this.price(trade.priceE6, trade.currency), day,
      });
    }
    if (trade.kind === 'split' && trade.ratio) return this.i18n.t('stocks.trade.splitLine', { num: trade.ratio[0], den: trade.ratio[1], day });
    return day;
  }

  sourceWords(valued: Valued): string {
    const quote = valued.quote;
    if (!quote) return this.i18n.t('stocks.position.noPrice');
    const key = quote.source === 'sheet' ? 'stocks.position.fromGoogle' : quote.source === 'manual' ? 'stocks.position.typed'
      : quote.source === 'statement' ? 'stocks.position.fromStatement' : 'stocks.position.demoPrice';
    return this.i18n.t(key, { day: this.dayWords(quote.day) });
  }

  factNumber(value: number | undefined, compact = false): string | null {
    if (value === undefined) return null;
    return new Intl.NumberFormat(this.i18n.dateLocale(), compact
      ? { notation: 'compact', maximumFractionDigits: 1 }
      : { maximumFractionDigits: 2 }).format(value);
  }

  stateWords(): { tone: 'info' | 'warn' | 'bad' | 'good'; icon: string; title: string; text: string; action?: string } | null {
    const state = this.stocks.pricesState();
    const t = (key: string) => this.i18n.t(key as 'stocks.state.working');
    if (state === 'working') return { tone: 'info', icon: 'sync-outline', title: t('stocks.state.working'), text: t('stocks.state.working.text') };
    if (state === 'demo') return { tone: 'info', icon: 'flask-outline', title: t('stocks.state.demo'), text: t('stocks.state.demo.text') };
    if (state === 'unavailable') return { tone: 'info', icon: 'phone-portrait-outline', title: t('stocks.state.unavailable'), text: t('stocks.state.unavailable.text') };
    if (state === 'declined') return { tone: 'warn', icon: 'key-outline', title: t('stocks.state.declined'), text: t('stocks.state.declined.text'), action: t('stocks.state.retry') };
    if (state === 'offline') return { tone: 'warn', icon: 'cloud-offline-outline', title: t('stocks.state.offline'), text: t('stocks.state.offline.text'), action: t('stocks.state.retry') };
    if (state === 'disabled') return { tone: 'bad', icon: 'construct-outline', title: t('stocks.state.disabled'), text: t('stocks.state.disabled.text') };
    if (state === 'failed') return { tone: 'bad', icon: 'alert-circle-outline', title: t('stocks.state.failed'), text: t('stocks.state.failed.text'), action: t('stocks.state.retry') };
    const missing = this.stocks.missing();
    if (state === 'done' && missing.length > 0) {
      return { tone: 'warn', icon: 'help-circle-outline', title: this.i18n.t('stocks.state.missing', { count: missing.length }),
        text: this.i18n.t('stocks.state.missing.text', { symbols: missing.join(', ') }) };
    }
    return null;
  }

  // ---- Prices -------------------------------------------------------------------------

  /** Bolsa de valores is part of Finance Pro: what is on record stays in view, anything new asks (rule 21). */
  private allowed(): Promise<boolean> {
    return this.pro.allow('stocks');
  }

  async refresh(): Promise<void> {
    if (!(await this.allowed())) return;
    this.pricesSheet.set(false);
    void this.stocks.refreshPrices({ ask: true });
  }

  openPosition(symbol: string): void {
    this.typingPrice.set(false);
    this.typingQuote.set(false);
    this.openSymbol.set(symbol);
  }

  async startPrice(): Promise<void> {
    if (!(await this.allowed())) return;
    const quote = this.position()?.quote;
    this.priceText.set(quote ? String(quote.priceE6 / PRICE_SCALE).replace('.', ',') : '');
    this.typingPrice.set(true);
  }

  async savePrice(): Promise<void> {
    const symbol = this.openSymbol();
    const plain = typedNumber(this.priceText());
    if (symbol === null || plain === null || Number(plain) <= 0) return;
    await this.stocks.typePrice(symbol, scaledOf(plain, PRICE_SCALE));
    this.typingPrice.set(false);
    this.toast.say(this.i18n.t('stocks.price.saved', { symbol }));
  }

  async forgetPrice(): Promise<void> {
    const symbol = this.openSymbol();
    if (symbol === null) return;
    await this.stocks.forgetTypedPrice(symbol);
    this.toast.say(this.i18n.t('stocks.price.forgotten', { symbol }));
  }

  startQuote(): void {
    const instrument = this.instrument();
    this.quoteText.set(instrument?.quote ?? this.openSymbol() ?? '');
    this.nameText.set(instrument?.name ?? '');
    this.typingQuote.set(true);
  }

  async saveQuote(): Promise<void> {
    const symbol = this.openSymbol();
    if (symbol === null) return;
    const quote = this.quoteText().trim().toUpperCase();
    await this.stocks.nameInstrument(symbol, { quote: quote === '' ? null : quote, name: this.nameText().trim() || null });
    this.typingQuote.set(false);
    this.toast.say(this.i18n.t('stocks.quote.saved', { symbol }));
  }

  // ---- Importing ----------------------------------------------------------------------

  async chooseFile(): Promise<void> {
    this.addSheet.set(false);
    if (!(await this.allowed())) return;
    this.file().nativeElement.click();
  }

  /** A photo or a screenshot of one position: its purchase, in the form, to check and save. */
  async choosePhoto(): Promise<void> {
    this.addSheet.set(false);
    if (!(await this.allowed())) return;
    this.photo().nativeElement.click();
  }

  async pickedPhoto(input: HTMLInputElement): Promise<void> {
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.toast.say(this.i18n.t('stocks.photo.reading'), 20_000, { icon: 'camera-outline' });
    let read;
    try {
      await textOfImages([file]);
      read = readPosition(lastPages);
    } catch (problem) {
      this.toast.say(this.i18n.t(problem instanceof ReaderNotReady ? 'receipt.notReady' : 'stocks.photo.noText'), 7000, { icon: 'alert-circle' });
      return;
    }
    if (read.found.length === 0) {
      this.toast.say(this.i18n.t('stocks.photo.nothing'), 8000, { icon: 'alert-circle' });
      return;
    }
    await this.newTrade(read.symbol);
    if (this.editing() !== 'new') return;
    const plain = (value: number, scale: number): string => String(value / scale).replace('.', ',');
    if (read.day) this.formDay.set(read.day);
    if (read.currency) this.formCurrency.set(read.currency);
    if (read.quantityE8 !== null) this.formQuantity.set(plain(read.quantityE8, QUANTITY_SCALE));
    if (read.priceE6 !== null) this.formPrice.set(plain(read.priceE6, PRICE_SCALE));
    if (read.amountMinor !== null) {
      this.formAmount.set(AmountBuffer.from(read.amountMinor));
      this.amountTouched.set(read.found.includes('amount'));
    }
    const missing = (['symbol', 'quantity', 'price', 'day'] as const).filter(one => !read.found.includes(one))
      .map(one => this.i18n.t(`stocks.photo.part.${one}` as 'stocks.photo.part.symbol'));
    this.fromPhoto.set(missing.length === 0 ? this.i18n.t('stocks.photo.check') : this.i18n.t('stocks.photo.missing', { parts: missing.join(', ') }));
    this.toast.say(this.i18n.t('stocks.photo.read'), 5000, { icon: 'camera-outline' });
  }

  async eraseAll(): Promise<void> {
    this.erasing.set(false);
    const gone = await this.stocks.erase('all');
    this.face.set('positions');
    this.toast.say(this.i18n.t('stocks.erase.done', { count: gone }));
  }

  async picked(input: HTMLInputElement): Promise<void> {
    const files = statementFiles(input.files);
    input.value = '';
    if (files.length === 0) return;
    const read = await this.flow.run(files, (password, watch) => this.stocks.read(files, password, watch));
    if (read === 'again') { void this.chooseFile(); return; }
    if (read === null) return;

    // The broker is the one investment account, when there is exactly one.
    const investment = this.accounts().filter(account => account.type === 'investment');
    const account = investment.length === 1 ? investment[0] : null;
    this.pendingAccount.set(account?.id ?? null);
    this.pendingCurrency.set(read.reading.currency ?? account?.currency_code ?? 'USD');
    this.unreadOpen.set(false);
    this.pendingNew.set(await this.stocks.newRows(this.pendingAccount(), read.reading.rows));
    this.pending.set(read);
  }

  async chooseAccount(account: AccountRow | null): Promise<void> {
    const where = this.pickingAccount();
    this.pickingAccount.set(null);
    if (where === 'form') {
      this.formAccount.set(account?.id ?? null);
      if (account) this.formCurrency.set(account.currency_code);
      return;
    }
    const pending = this.pending();
    if (!pending) return;
    this.pendingAccount.set(account?.id ?? null);
    if (pending.reading.currency === null && account) this.pendingCurrency.set(account.currency_code);
    this.pendingNew.set(await this.stocks.newRows(account?.id ?? null, pending.reading.rows));
  }

  async saveImport(): Promise<void> {
    const pending = this.pending();
    if (!pending || this.saving()) return;
    this.saving.set(true);
    try {
      const written = await this.stocks.save(this.pendingAccount(), this.pendingCurrency(), pending);
      this.pending.set(null);
      this.chosenCurrency.set(this.pendingCurrency());
      this.toast.say(this.i18n.t('stocks.import.saved', { count: written }));
      if (this.stocks.canAskGoogle && !this.stocks.auto()) this.face.set('positions');
    } catch (failure) {
      this.toast.say(this.i18n.t('stocks.import.failed', { detail: failure instanceof Error ? failure.message : String(failure) }), 8000);
    } finally {
      this.saving.set(false);
    }
  }

  // ---- By hand ------------------------------------------------------------------------

  async newTrade(symbol: string | null = null): Promise<void> {
    this.addSheet.set(false);
    if (!(await this.allowed())) return;
    this.editing.set('new');
    this.tried.set(false);
    this.moreOpen.set(false);
    this.fromPhoto.set(null);
    this.formKind.set('buy');
    this.formSymbol.set(symbol ?? '');
    const position = symbol ? this.stocks.valued().find(one => one.position.symbol === symbol)?.position : null;
    this.formAsset.set(position?.asset ?? 'stock');
    this.formDay.set(isoDay(new Date()));
    this.formQuantity.set('');
    this.formPrice.set('');
    this.formAmount.set(new AmountBuffer());
    this.amountTouched.set(false);
    this.formNote.set('');
    const last = [...this.stocks.trades()].reverse().find(trade => symbol === null || trade.symbol === symbol);
    const investment = this.accounts().filter(account => account.type === 'investment');
    this.formAccount.set(last?.accountId ?? (investment.length === 1 ? investment[0].id : null));
    this.formCurrency.set(position?.currency ?? last?.currency ?? this.currency());
  }

  openTrade(trade: Trade): void {
    if (trade.source === 'statement' || !['buy', 'sell', 'dividend'].includes(trade.kind)) {
      this.viewing.set(trade);
      return;
    }
    this.editing.set(trade.id);
    this.tried.set(false);
    this.moreOpen.set(trade.note !== null && trade.note !== '');
    this.fromPhoto.set(null);
    this.formKind.set(trade.kind as 'buy' | 'sell' | 'dividend');
    this.formSymbol.set(trade.symbol ?? '');
    this.formAsset.set(trade.asset ?? 'stock');
    this.formDay.set(trade.day);
    this.formQuantity.set(trade.quantityE8 === null ? '' : String(trade.quantityE8 / QUANTITY_SCALE).replace('.', ','));
    this.formPrice.set(trade.priceE6 === null ? '' : String(trade.priceE6 / PRICE_SCALE).replace('.', ','));
    this.formAmount.set(AmountBuffer.from(Math.abs(trade.amountMinor)));
    this.amountTouched.set(true);
    this.formAccount.set(trade.accountId);
    this.formCurrency.set(trade.currency);
    this.formNote.set(trade.note ?? '');
  }

  /** Quantity or price typed: the total follows them until it is typed by hand. */
  typed(what: 'quantity' | 'price', text: string): void {
    if (what === 'quantity') this.formQuantity.set(text); else this.formPrice.set(text);
    const worked = this.formWorked();
    if (!this.amountTouched() && worked !== null) this.formAmount.set(AmountBuffer.from(worked));
  }

  typedAmount(buffer: AmountBuffer): void {
    this.formAmount.set(buffer);
    this.amountTouched.set(true);
  }

  async saveTrade(): Promise<void> {
    this.tried.set(true);
    if (this.formMissing() !== null) return;
    const kind = this.formKind();
    const quantity = kind === 'dividend' ? null : scaledOf(typedNumber(this.formQuantity())!, QUANTITY_SCALE);
    const price = kind === 'dividend' ? null : scaledOf(typedNumber(this.formPrice())!, PRICE_SCALE);
    const amount = this.formAmount().minor > 0 ? this.formAmount().minor : this.formWorked() ?? 0;
    const input: TradeInput = {
      accountId: this.formAccount(), kind, symbol: this.formSymbol().trim().toUpperCase(), asset: this.formAsset(),
      day: this.formDay() as IsoDate, time: null, quantityE8: quantity, priceE6: price,
      amountMinor: kind === 'buy' ? -amount : amount, currency: this.formCurrency(), ratio: null, ref: null,
      note: this.formNote().trim() || null,
    };
    const id = this.editing();
    if (id === 'new') await this.stocks.addTrade(input);
    else if (typeof id === 'number') await this.stocks.changeTrade(id, input);
    this.editing.set(null);
    this.chosenCurrency.set(input.currency);
    this.toast.say(this.i18n.t(`stocks.form.saved.${kind}` as 'stocks.form.saved.buy', { symbol: input.symbol ?? '' }));
  }

  askDelete(trade: Trade): void {
    this.viewing.set(null);
    this.editing.set(null);
    this.deleting.set(trade);
  }

  async remove(): Promise<void> {
    const trade = this.deleting();
    this.deleting.set(null);
    if (!trade) return;
    await this.stocks.removeTrade(trade.id);
    this.toast.say(this.i18n.t('stocks.trade.deleted'));
  }

  editingTrade(): Trade | null {
    const id = this.editing();
    return typeof id === 'number' ? this.stocks.trades().find(trade => trade.id === id) ?? null : null;
  }
}
