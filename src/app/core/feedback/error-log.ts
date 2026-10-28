/**
 * The app's last errors, kept on the phone to go with a report (idea 11,
 * Jose 2026-10-28: crash reports with no outside service). Only what broke
 * and where - the error's name, its message with every figure of four or
 * more digits blanked, the first frames of where it happened - never a
 * movement, an amount or an account. Nothing leaves the phone unless the
 * person sends it in "Reportar un fallo", where it is a switch of its own.
 * Google Play's own Android vitals still counts crashes of the app itself.
 * Pure but for the device's storage; tested in `error-log.test.mjs`.
 */

export interface LoggedError {
  /** When it happened, ISO. */
  at: string;
  name: string;
  message: string;
  /** Where: the first frames, file names and lines only. */
  where: string[];
}

const KEY = 'finance.errors';
/** How many are kept, and for how long. */
const KEEP = 5;
const DAYS = 14;

/** The error made safe to send: no figure, no long text, no path but the file. */
export function describe(error: unknown, at: Date = new Date()): LoggedError {
  const e = error as { name?: unknown; message?: unknown; stack?: unknown; rejection?: unknown } | null;
  const inner = e && typeof e === 'object' && 'rejection' in e ? e.rejection as typeof e : e;
  const name = typeof inner?.name === 'string' ? inner.name : typeof error;
  const raw = typeof inner?.message === 'string' ? inner.message : String(error);
  const message = raw.replace(/\d[\d.,]{3,}/g, '#').replace(/\s+/g, ' ').slice(0, 200);
  const stack = typeof inner?.stack === 'string' ? inner.stack : '';
  const where = stack.split('\n').slice(1)
    .map(line => /([\w.-]+\.(?:js|mjs|ts)):(\d+)(?::\d+)?/.exec(line))
    .filter((m): m is RegExpExecArray => m !== null)
    .slice(0, 4)
    .map(m => `${m[1]}:${m[2]}`);
  return { at: at.toISOString(), name, message, where };
}

/** The errors kept, newest last, the old ones dropped. */
export function keptErrors(now: Date = new Date()): LoggedError[] {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) ?? '[]') as LoggedError[];
    const since = now.getTime() - DAYS * 86_400_000;
    return Array.isArray(list) ? list.filter(e => Date.parse(e.at) >= since).slice(-KEEP) : [];
  } catch {
    return [];
  }
}

/** Keeps one more error; the same one again only updates its time. */
export function noteError(error: unknown, now: Date = new Date()): void {
  const one = describe(error, now);
  const list = keptErrors(now).filter(e => e.name !== one.name || e.message !== one.message);
  list.push(one);
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(-KEEP)));
  } catch { /* storage blocked: nothing kept */ }
}

/** The errors as the report's text. */
export function errorsText(list: readonly LoggedError[]): string {
  return list.map(e => `${e.at} ${e.name}: ${e.message}${e.where.length ? `\n  ${e.where.join(' < ')}` : ''}`).join('\n');
}
