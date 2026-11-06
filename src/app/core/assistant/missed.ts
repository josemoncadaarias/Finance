/**
 * The sentences the assistant did not understand, kept on the device only
 * (Jose, 2026-11-06: "hay que mejorar mucho más esa base de conocimientos").
 * Nothing leaves the phone by itself: "Reportar un fallo" can carry them,
 * when the person leaves its switch on, so the next version of the app
 * learns to read them. Every figure of 4 digits or more is covered, as the
 * error log does, so no amount travels.
 */

export interface Missed {
  text: string;
  at: number;
}

const KEY = 'finance.assistant.missed';
/** The newest kept, and for how long. */
export const MISSED_KEPT = 20;
const DAYS = 30;

/** A sentence as it is kept: its figures covered, its spaces tidied. */
export function coverFigures(text: string): string {
  return text.replace(/\d[\d.,]{3,}/g, '#').replace(/\s+/g, ' ').trim().slice(0, 200);
}

/** The list with this sentence added, newest last, the same one never twice, old ones gone. */
export function withMissed(list: readonly Missed[], text: string, now: number): Missed[] {
  const kept = coverFigures(text);
  if (!kept) return [...list];
  const since = now - DAYS * 86_400_000;
  const rest = list.filter(m => m.at >= since && m.text.toLowerCase() !== kept.toLowerCase());
  return [...rest, { text: kept, at: now }].slice(-MISSED_KEPT);
}

/** The list as the mail carries it, one sentence a line, with its day. */
export function missedText(list: readonly Missed[]): string {
  return list.map(m => `${new Date(m.at).toISOString().slice(0, 10)} · ${m.text}`).join('\n');
}

export function keptMissed(now = Date.now()): Missed[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]') as Missed[];
    const since = now - DAYS * 86_400_000;
    return Array.isArray(raw) ? raw.filter(m => typeof m?.text === 'string' && typeof m.at === 'number' && m.at >= since) : [];
  } catch {
    return [];
  }
}

export function noteMissed(text: string, now = Date.now()): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(withMissed(keptMissed(now), text, now)));
  } catch { /* the device keeps nothing: the chat still works */ }
}

/** Forgotten once they were sent, so the same ones are not sent again. */
export function forgetMissed(): void {
  try { localStorage.removeItem(KEY); } catch { /* nothing to forget */ }
}
