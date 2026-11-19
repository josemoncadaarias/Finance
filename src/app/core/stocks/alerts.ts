/**
 * "Avísame cuando una de mis acciones suba o baje mucho" (Jose, 2026-11-19).
 *
 * Pure: which positions held moved past the person's threshold today,
 * against yesterday's close, and were not told yet. Only a price of today
 * fetched from Google counts: a price typed by hand or read off a statement
 * says nothing about today's move. Each ticker is told once a day per
 * direction, so a second refresh the same day rings again only if the move
 * turned the other way.
 */
import type { Valued } from './positions';

export interface AlertSettings {
  on: boolean;
  /** The move, in percent, that rings: 3, 5, 10... */
  pct: number;
}

export const ALERTS_OFF: AlertSettings = { on: false, pct: 5 };
export const ALERT_CHOICES = [3, 5, 10] as const;

export interface Alert {
  symbol: string;
  /** Since yesterday's close, in percent: positive up, negative down. */
  dayPct: number;
  dayMinor: number;
  currency: string;
  /** "SOLR|2026-11-19|up": what marks it told. */
  key: string;
}

export function alertSettingsOf(stored: string | null): AlertSettings {
  if (!stored) return ALERTS_OFF;
  try {
    const read = JSON.parse(stored) as Partial<AlertSettings>;
    const pct = typeof read.pct === 'number' && read.pct > 0 && read.pct <= 50 ? read.pct : ALERTS_OFF.pct;
    return { on: read.on === true, pct };
  } catch {
    return ALERTS_OFF;
  }
}

export function alertsFor(valued: readonly Valued[], settings: AlertSettings, today: string, told: ReadonlySet<string>): Alert[] {
  if (!settings.on) return [];
  // On a weekend a quote is Friday's close against Thursday's: Friday's move, already told.
  const weekday = new Date(`${today}T12:00:00Z`).getUTCDay();
  if (weekday === 0 || weekday === 6) return [];
  const out: Alert[] = [];
  for (const one of valued) {
    if (one.position.quantityE8 <= 0 || one.quote === null || one.dayPct === null || one.dayMinor === null) continue;
    if (one.quote.day !== today || one.quote.source !== 'sheet') continue;
    if (Math.abs(one.dayPct) < settings.pct) continue;
    const key = `${one.position.symbol}|${today}|${one.dayPct >= 0 ? 'up' : 'down'}`;
    if (told.has(key)) continue;
    out.push({ symbol: one.position.symbol, dayPct: one.dayPct, dayMinor: one.dayMinor, currency: one.position.currency, key });
  }
  // The biggest move first, whatever its direction.
  return out.sort((a, b) => Math.abs(b.dayPct) - Math.abs(a.dayPct));
}

/** The keys still worth keeping: today's only, so the list never grows. */
export function keptTold(told: Iterable<string>, today: string): string[] {
  return [...told].filter(key => key.split('|')[1] === today);
}
