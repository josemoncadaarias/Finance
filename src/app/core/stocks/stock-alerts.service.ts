/**
 * "Tu acción subió o bajó mucho hoy" (Jose, 2026-11-19).
 *
 * When the alerts are on, each time the app opens or comes back to the
 * front it asks Google for today's prices (if the last answer is over 20
 * minutes old) and rings on the phone for every position held that moved
 * past the threshold since yesterday's close. Nothing runs with the app
 * closed: the phone is asked nothing in the background, and the screen says
 * so. Told once a day per ticker and direction, kept on the device. Never
 * with the sample data, and only with Finance Pro, as the module itself.
 */
import { Injectable, effect, inject, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { App } from '@capacitor/app';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { LocalNotifications, type ActionPerformed } from '@capacitor/local-notifications';

import { formatMoney } from '../database/money';
import { DatabaseService } from '../database/database.service';
import { DemoService } from '../demo/demo.service';
import { isoDay } from '../filters/period';
import { I18nService } from '../i18n/i18n.service';
import { PaywallService } from '../paywall/paywall.service';
import { alertsFor, keptTold, type Alert } from './alerts';
import { StocksService } from './stocks.service';
import { GoogleAccountService } from '../cloud/google-account.service';

/** The background check (`StockWatch.java`): what to watch, and the moves told by either side. */
const Watch = registerPlugin<{
  configure(options: { config: Record<string, unknown> }): Promise<void>;
  told(): Promise<{ keys: string[]; lastRun: number }>;
  markTold(options: { keys: string[] }): Promise<void>;
}>('StockWatch');

const TOLD_KEY = 'finance.stocks.alertsTold';
const KIND = 'stockMove';
const CHANNEL = 'stock_moves';
/** One notice on the phone at a time, always this id: a new one replaces it. */
const NOTICE_ID = 7_400_001;

@Injectable({ providedIn: 'root' })
export class StockAlertsService {
  private readonly database = inject(DatabaseService);
  private readonly demo = inject(DemoService);
  private readonly i18n = inject(I18nService);
  private readonly pro = inject(PaywallService);
  private readonly router = inject(Router);
  private readonly stocks = inject(StocksService);
  private readonly google = inject(GoogleAccountService);

  constructor() {
    if (!Capacitor.isNativePlatform()) return;
    void LocalNotifications.addListener('localNotificationActionPerformed', action => this.tapped(action));
    void App.addListener('resume', () => void this.askPrices());
    // Once the trades are read on opening, ask for prices; every time new prices come, look.
    effect(() => {
      const loaded = this.stocks.loaded();
      const on = this.stocks.alerts().on;
      if (loaded && on) untracked(() => void this.askPrices());
    });
    effect(() => {
      this.stocks.quotes();
      const on = this.stocks.alerts().on;
      if (on) untracked(() => void this.look());
    });
    // What the background check watches, handed over again on every change.
    effect(() => {
      const config = this.watchConfig();
      untracked(() => { void Watch.configure({ config }).catch(() => undefined); });
    });
  }

  /**
   * Only tickers Google already answered for (their way of writing is kept),
   * only with Finance Pro, never with the sample data, and only with the
   * Google account and its sheet known.
   */
  private watchConfig(): Record<string, unknown> {
    const settings = this.stocks.alerts();
    const user = this.google.user();
    const sheet = this.stocks.sheetId();
    const instruments = this.stocks.instruments();
    const rows = this.stocks.heldValuedEverywhere()
      .map(one => ({ symbol: one.position.symbol, quote: instruments.get(one.position.symbol)?.quote ?? null }))
      .filter((row): row is { symbol: string; quote: string } => !!row.quote);
    const on = settings.on && this.pro.unlocked() && !this.demo.active() && !!user && !!sheet && rows.length > 0;
    const t = (key: Parameters<I18nService['t']>[0]) => this.i18n.t(key);
    return {
      on, pct: settings.pct, email: user?.email ?? '', sheet: sheet ?? '', rows,
      locale: this.i18n.dateLocale(),
      up: this.i18n.t('stocks.alerts.upShort', { symbol: '{symbol}', pct: '{pct}' }),
      down: this.i18n.t('stocks.alerts.downShort', { symbol: '{symbol}', pct: '{pct}' }),
      many: this.i18n.t('stocks.alerts.many', { count: '{count}' }),
      body: t('stocks.alerts.body'), channel: t('stocks.alerts.channel'), channelAbout: t('stocks.alerts.channel.about'),
    };
  }

  /** Turning the alerts on asks the phone for its notices, once. */
  async allow(): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) return true;
    const now = (await LocalNotifications.checkPermissions()).display;
    if (now === 'granted') return true;
    return (await LocalNotifications.requestPermissions()).display === 'granted';
  }

  private async askPrices(): Promise<void> {
    if (this.database.status() !== 'ready' || this.demo.active() || !this.pro.unlocked()) return;
    if (!this.stocks.alerts().on || !this.stocks.auto() || !this.stocks.stale()) return;
    await this.stocks.refreshPrices();
  }

  /** The moves already told today, by the app or by the background check. */
  private async told(): Promise<Set<string>> {
    let kept: string[] = [];
    try { kept = JSON.parse(localStorage.getItem(TOLD_KEY) ?? '[]') as string[]; } catch { /* none */ }
    try { kept = kept.concat((await Watch.told()).keys); } catch { /* no background check on this phone */ }
    return new Set(kept);
  }

  private async keep(told: Iterable<string>, today: string, fresh: string[]): Promise<void> {
    try { localStorage.setItem(TOLD_KEY, JSON.stringify(keptTold(told, today))); } catch { /* told again, at worst */ }
    try { await Watch.markTold({ keys: fresh }); } catch { /* no background check on this phone */ }
  }

  private async look(): Promise<void> {
    if (this.demo.active() || !this.pro.unlocked()) return;
    const today = isoDay(new Date());
    const told = await this.told();
    const alerts = alertsFor(this.stocks.heldValuedEverywhere(), this.stocks.alerts(), today, told);
    if (alerts.length === 0) return;
    if ((await LocalNotifications.checkPermissions()).display !== 'granted') return;
    try {
      await LocalNotifications.createChannel({
        id: CHANNEL, name: this.i18n.t('stocks.alerts.channel'), description: this.i18n.t('stocks.alerts.channel.about'),
        importance: 4, visibility: 0,
      });
      const [title, body] = this.words(alerts);
      await LocalNotifications.schedule({
        notifications: [{
          id: NOTICE_ID, title, body, largeBody: body,
          channelId: CHANNEL, smallIcon: 'ic_stat_movement', largeIcon: 'ic_notice_logo', iconColor: '#6378FF',
          autoCancel: true,
          extra: { kind: KIND, symbol: alerts.length === 1 ? alerts[0].symbol : null },
        }],
      });
      for (const alert of alerts) told.add(alert.key);
      await this.keep(told, today, alerts.map(alert => alert.key));
    } catch {
      // Not told: the next look tries again.
    }
  }

  private pct(value: number): string {
    return `${new Intl.NumberFormat(this.i18n.dateLocale(), { maximumFractionDigits: 1 }).format(Math.abs(value))} %`;
  }

  /** "📈 SOLR subió 6,2 % hoy" for one; "3 de tus acciones se movieron mucho hoy" for several. */
  private words(alerts: readonly Alert[]): [string, string] {
    const line = (a: Alert) => this.i18n.t(a.dayPct >= 0 ? 'stocks.alerts.up' : 'stocks.alerts.down',
      { symbol: a.symbol, pct: this.pct(a.dayPct), amount: formatMoney(Math.abs(a.dayMinor), a.currency, { shown: true }) });
    if (alerts.length === 1) {
      const a = alerts[0];
      return [`${a.dayPct >= 0 ? '📈' : '📉'} ${line(a)}`, this.i18n.t('stocks.alerts.body')];
    }
    return [this.i18n.t('stocks.alerts.many', { count: alerts.length }), alerts.map(line).join('\n')];
  }

  private tapped(action: ActionPerformed): void {
    const extra = action.notification.extra as { kind?: string; symbol?: string | null } | undefined;
    if (extra?.kind !== KIND) return;
    const go = () => void this.router.navigate(['/stocks'], extra.symbol ? { queryParams: { symbol: extra.symbol } } : {});
    if (this.database.status() === 'ready') go();
    else setTimeout(go, 1500);
  }
}
