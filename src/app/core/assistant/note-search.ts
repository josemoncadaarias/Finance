/**
 * Finding movements by the words of their notes (Jose, 2026-10-23, mockups
 * `41b`-`41f`): "¿cuándo fue el último mantenimiento de la moto?", "¿cuándo
 * pagué el SOAT?", "¿cuánto me ha costado la moto?".
 *
 * No AI, the way Inicio's search works: the words of the question that say
 * what is looked for are compared with the words of each movement's note and
 * its category. A word is found when it is nearly the same word - its plural,
 * the same root ("odontólogo" and "odontología"), one or two letters off for a
 * long word (a typo, dictation) - or one of the few ordinary synonyms below.
 * Generic words only: nothing here names a shop, a bank or a person.
 *
 * Pure: the rows come in, nothing is read here.
 */

import { fold } from './read-phrase';

/** Words of a question that say nothing about what is looked for. */
const STOP = new Set([
  // the question itself
  'cuando', 'cuanto', 'cuanta', 'cuantos', 'cuantas', 'que', 'cual', 'cuales', 'donde', 'como', 'fue', 'fueron', 'era',
  'ultima', 'ultimo', 'ultimas', 'ultimos', 'vez', 'veces', 'anterior', 'pasada', 'pasado', 'reciente',
  'last', 'time', 'when', 'did', 'was', 'how', 'much', 'many', 'what',
  // verbs of buying and paying, in their usual forms
  'pague', 'pagaste', 'pago', 'pagamos', 'pagar', 'compre', 'compramos', 'comprar', 'gaste', 'gastamos', 'gastado',
  'gastar', 'gasto', 'gastos', 'hice', 'hicimos', 'hacer', 'fui', 'fuimos', 'ir', 'lleve', 'llevamos', 'tuve', 'tuvimos',
  'cuesta', 'costo', 'costado', 'cuestan', 'costaron', 'ha', 'han', 'he', 'hemos', 'me', 'nos', 'se', 'le', 'les',
  'paid', 'pay', 'bought', 'buy', 'spent', 'spend', 'went', 'go', 'cost', 'costs', 'had', 'have', 'got',
  // joining words
  'de', 'del', 'la', 'el', 'los', 'las', 'lo', 'un', 'una', 'unos', 'unas', 'en', 'a', 'al', 'con', 'por', 'para',
  'mi', 'mis', 'tu', 'su', 'sus', 'y', 'o', 'es', 'son', 'este', 'esta', 'ese', 'esa', 'eso', 'esto', 'todo', 'toda',
  'the', 'a', 'an', 'my', 'of', 'to', 'for', 'in', 'on', 'at', 'i', 'we', 'and', 'or', 'is',
  // money and time, said around what is looked for
  'plata', 'dinero', 'pesos', 'peso', 'money', 'ano', 'mes', 'semana', 'hoy', 'ayer', 'year', 'month', 'week',
  'movimiento', 'movimientos', 'nota', 'notas', 'registro', 'registre',
]);

/**
 * A few ordinary words that mean the same thing, so a question in one finds a
 * note written in the other. Generic, both languages; folded, no accents.
 */
const SAME = [
  ['odontologo', 'odontologia', 'dentista', 'dental', 'dentist'],
  ['medico', 'doctor', 'consulta', 'cita', 'doctor'],
  ['gasolina', 'combustible', 'tanqueo', 'tanquear', 'tanquee', 'gas', 'fuel'],
  ['mercado', 'supermercado', 'groceries', 'grocery'],
  // Not "renta": in Colombia it is also the income tax.
  ['arriendo', 'alquiler', 'canon', 'rent'],
  ['peluqueria', 'barberia', 'corte', 'haircut'],
  ['mantenimiento', 'revision', 'servicio', 'arreglo', 'reparacion', 'taller', 'maintenance', 'repair'],
  ['moto', 'motocicleta', 'motorcycle'],
  ['carro', 'auto', 'automovil', 'vehiculo', 'car'],
  ['veterinario', 'veterinaria', 'vet'],
  ['farmacia', 'drogueria', 'medicamentos', 'remedios', 'pharmacy'],
  ['luz', 'energia', 'electricidad', 'electricity'],
  ['celular', 'telefono', 'movil', 'phone'],
  ['gimnasio', 'gym'],
  ['almuerzo', 'comida', 'lunch'],
  ['regalo', 'obsequio', 'gift'],
];
const SYNONYMS = new Map<string, Set<string>>();
for (const group of SAME) for (const w of group) SYNONYMS.set(w, new Set([...(SYNONYMS.get(w) ?? []), ...group]));

/** The words of a text, folded, without what joins them. */
export function wordsIn(text: string): string[] {
  return fold(text).split(/[^a-z0-9ñ]+/).filter(Boolean);
}

/** The words of a question that say what is looked for. */
export function termsOf(text: string, alsoLeaveOut: ReadonlySet<string> = new Set()): string[] {
  return [...new Set(wordsIn(text).filter(w => !STOP.has(w) && !alsoLeaveOut.has(w) && !/^\d+$/.test(w) && w.length >= 2))];
}

/** How many single-letter changes turn one word into the other (Levenshtein). */
function distance(a: string, b: string): number {
  if (a === b) return 0;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = row;
  }
  return prev[b.length];
}

/**
 * Whether a word of a question is nearly a word of a note: the same, its
 * plural, the same root (all but the last letters of the shorter one, at
 * least five letters in common: "odontolog-o" and "odontolog-ia",
 * "mantenimiento" and "mantenimientos"), one letter off from five letters on
 * and two from nine (a typo, dictation), or a synonym.
 */
export function nearWord(asked: string, written: string): boolean {
  if (asked === written) return true;
  if (asked.length < 3 || written.length < 3) return false;
  const plural = (a: string, b: string) => a === `${b}s` || a === `${b}es`;
  if (plural(asked, written) || plural(written, asked)) return true;
  const shorter = Math.min(asked.length, written.length);
  let common = 0;
  while (common < shorter && asked[common] === written[common]) common++;
  if (common >= 5 && common >= shorter - 2) return true;
  const allowed = shorter >= 9 ? 2 : shorter >= 5 ? 1 : 0;
  if (allowed > 0 && Math.abs(asked.length - written.length) <= allowed && distance(asked, written) <= allowed) return true;
  return SYNONYMS.get(asked)?.has(written) ?? false;
}

export interface NoteRow {
  id: number;
  onDate: string;
  note: string;
  category: string;
}

export interface NoteMatches<T extends NoteRow> {
  /** Every word asked is in the note or the category, newest first. */
  all: T[];
  /** Nothing has them all: those with the most, newest first ("¿Te referías a...?"). */
  some: T[];
  /** The words of each row that matched, to light them. */
  hits: Map<number, string[]>;
}

/** The rows whose note or category carries the words asked, nearly or exactly. */
export function matchNotes<T extends NoteRow>(rows: readonly T[], terms: readonly string[]): NoteMatches<T> {
  const hits = new Map<number, string[]>();
  if (terms.length === 0) return { all: [], some: [], hits };
  const scored: { row: T; found: number }[] = [];
  for (const row of rows) {
    const noteWords = wordsIn(row.note);
    const words = [...noteWords, ...wordsIn(row.category)];
    let found = 0;
    const lit: string[] = [];
    for (const t of terms) {
      const w = words.find(x => nearWord(t, x));
      if (w === undefined) continue;
      found++;
      const inNote = noteWords.find(x => nearWord(t, x));
      if (inNote) lit.push(inNote);
    }
    if (found === 0) continue;
    scored.push({ row, found });
    hits.set(row.id, lit);
  }
  const newest = (a: { row: T }, b: { row: T }) => b.row.onDate.localeCompare(a.row.onDate) || b.row.id - a.row.id;
  const whole = new Set(scored.filter(s => s.found === terms.length).map(s => s.row));
  for (const row of byCategory(rows, terms)) {
    whole.add(row);
    if (!hits.has(row.id)) hits.set(row.id, []);
  }
  const all = [...whole].map(row => ({ row })).sort(newest).map(s => s.row);
  if (all.length > 0) return { all, some: [], hits };
  const best = Math.max(0, ...scored.map(s => s.found));
  // At least half the words, and never one word of a long question by chance.
  const some = best * 2 >= terms.length && best > 0 ? scored.filter(s => s.found === best).sort(newest).map(s => s.row) : [];
  return { all: [], some, hits };
}

/**
 * A word of the question that names a category stands for the whole category
 * (Jose, 2026-10-23: "¿cuándo pagué factura EPM?" answered September because
 * October's EPM movement had another note, without "factura"). The other words
 * still narrow it, but only when they tell its movements apart: a word written
 * in half the category's notes or more ("factura" in nearly every EPM note)
 * says nothing more than the category does, so it is not required. A word few
 * of them carry ("mantenimiento" in a category Carro) still is.
 */
function byCategory<T extends NoteRow>(rows: readonly T[], terms: readonly string[]): T[] {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const key = fold(row.category);
    if (!key) continue;
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  }
  const found: T[] = [];
  for (const list of groups.values()) {
    const catWords = wordsIn(list[0].category);
    const naming = terms.filter(t => catWords.some(w => nearWord(t, w)));
    if (naming.length === 0) continue;
    const notes = list.map(r => wordsIn(r.note));
    const has = (words: string[], t: string) => words.some(w => nearWord(t, w));
    const telling = terms
      .filter(t => !naming.includes(t))
      .filter(t => notes.filter(words => has(words, t)).length * 2 < list.length);
    list.forEach((row, i) => {
      if (telling.every(t => has(notes[i], t))) found.push(row);
    });
  }
  return found;
}

/**
 * How often it happens, from its days newest first: the average gap in
 * months, rounded; null with fewer than two, or gaps under a month.
 */
export function everyMonths(days: readonly string[]): number | null {
  if (days.length < 2) return null;
  const ms = (iso: string) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));
  const span = (ms(days[0]) - ms(days[days.length - 1])) / 86_400_000;
  const months = Math.round(span / (days.length - 1) / 30.44);
  return months >= 1 ? months : null;
}

/**
 * "Próximo ... 6 meses" written in a note: the months it says until the next
 * one, so the answer can say whether that time has come. Null when the note
 * says no such thing.
 */
export function nextInMonths(note: string): number | null {
  const f = fold(note);
  const m = /(proxim\w*|siguiente|next)[^.\n]{0,60}?(\d{1,2})\s*(mes(?:es)?|months?)\b/.exec(f);
  if (!m) return null;
  const n = Number(m[2]);
  return n >= 1 && n <= 36 ? n : null;
}

/** Whole months from one day to another (the day of the month counted). */
export function monthsBetween(from: string, to: string): number {
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);
  return (ty - fy) * 12 + (tm - fm) - (td < fd ? 1 : 0);
}
