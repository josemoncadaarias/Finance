/**
 * The questions the assistant knows that look most like a sentence it did
 * not understand (Jose, 2026-11-06): instead of only "¿te referías a...?"
 * about the notes, it offers the closest of everything it can answer, by the
 * words they share. A word is compared by its root - its first five letters,
 * accents and case left out - so "pagué", "pagado" and "pagos" meet, and the
 * words every question has ("qué", "cuánto", "mi") count for nothing.
 * Pure: the catalog of questions comes in.
 */

import { fold } from './read-phrase';

const EMPTY = new Set([
  'que', 'cual', 'cuales', 'cuanto', 'cuanta', 'cuantos', 'cuantas', 'como', 'cuando', 'donde', 'por', 'para', 'con',
  'los', 'las', 'del', 'una', 'uno', 'unos', 'unas', 'mis', 'mio', 'tus', 'este', 'esta', 'esto', 'eso', 'ese', 'esa',
  'hay', 'hoy', 'ver', 'muy', 'mas', 'menos', 'algo', 'todo', 'todos', 'toda', 'todas', 'tengo', 'tiene', 'sus',
  'what', 'how', 'much', 'many', 'the', 'did', 'does', 'have', 'this', 'that', 'my', 'for', 'and', 'with', 'when',
]);

/** The roots of a sentence's meaningful words. */
export function rootsOf(text: string): Set<string> {
  const words = fold(text).replace(/[^a-z0-9ñ ]+/g, ' ').split(/\s+/).filter(w => w.length >= 3 && !EMPTY.has(w) && !/^\d+$/.test(w));
  return new Set(words.map(w => w.slice(0, 5)));
}

/**
 * The questions of the catalog sharing most roots with the sentence, best
 * first, at most `count`; none share nothing. A tie keeps the catalog's order.
 */
export function nearQuestions(text: string, catalog: readonly string[], count = 3): string[] {
  const asked = rootsOf(text);
  if (asked.size === 0) return [];
  const scored = catalog.map((q, i) => {
    const roots = rootsOf(q);
    let shared = 0;
    for (const r of roots) if (asked.has(r)) shared++;
    return { q, i, shared, size: roots.size };
  }).filter(x => x.shared > 0);
  scored.sort((a, b) => b.shared - a.shared || a.size - b.size || a.i - b.i);
  const out: string[] = [];
  for (const x of scored) {
    if (!out.some(q => fold(q) === fold(x.q))) out.push(x.q);
    if (out.length >= count) break;
  }
  return out;
}
