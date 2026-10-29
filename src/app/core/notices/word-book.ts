/**
 * What the app learned, by itself, about which messages are money that moved
 * and which are adverts (Jose, 2026-10-29: "la app debe aprender TODO POR SI
 * SOLA ... una base de conocimiento que todo el tiempo vaya aprendiendo").
 *
 * Every message the person SAVED from a source is an example of a movement;
 * every one they answered "No es un movimiento" is an example of the other
 * kind. From them each word (and each pair of words side by side) gets a
 * weight: how much more often it shows up in one kind than in the other.
 * A new message is judged by adding the weights of the words it carries.
 *
 * Each source is judged on its own examples first, and on everybody's - every
 * source of this phone - with a smaller weight, so a bank never answered yet
 * still benefits from what the person taught about the others. A few generic
 * examples of both kinds start the book, so it is never empty; they name no
 * bank, no shop and no country, and the person's answers soon outweigh them.
 *
 * Pure. The same book is handed to the phone's own notice (`quietForPhone`),
 * whose Java adds the weights in the same way (`MovementAlert.verdict`).
 */

export interface Example {
  source: string;
  text: string;
  move: boolean;
}

/** One source's weights: the starting lean and each word's. */
export interface Table {
  prior: number;
  words: Record<string, number>;
  /** How many "No es un movimiento" answers stand behind it, its own and everybody's. */
  marked: number;
  /** How many of this source's own messages the person saved. */
  ownMoves: number;
}

export interface WordBook {
  /** A table for each source with examples of its own. */
  sources: Record<string, Table>;
  /** For a source with none: everybody's examples. */
  all: Table;
}

export type Verdict = 'movement' | 'advert' | null;

/** How far the sum must lean before the book says anything. */
export const LEAN = 2.5;

/** How much everybody's examples count beside a source's own. */
const OTHERS = 0.35;

/** How much each starting example counts. */
const SEED_WEIGHT = 0.5;

/** At most this many words per table go to the phone, the strongest first. */
const WORDS_PER_TABLE = 400;

/**
 * Generic examples to start from: what a movement and an advert usually say.
 * Invented, in both languages, no bank, shop or country in them.
 */
const SEED: readonly Example[] = [
  ...[
    'Compraste por $ 45.900 en TIENDA con tu tarjeta terminada en 1234',
    'Tu compra en COMERCIO por $ 23.000 fue exitosa',
    'Pagaste $ 120.000 a SERVICIO desde tu cuenta',
    'Recibiste una transferencia de $ 50.000 de PERSONA',
    'Transferiste $ 10.000 a PERSONA desde tu cuenta de ahorros',
    'Retiro en cajero por $ 200.000. Saldo disponible $ 1.000.000',
    'Te consignaron $ 300.000 en tu cuenta',
    'Pago aprobado por $ 35.000 en COMERCIO',
    'Se debito $ 89.000 de tu cuenta por compra en COMERCIO',
    'You paid $ 12.50 at STORE with your card ending in 1234',
    'You received $ 40.00 from PERSON',
  ].map(text => ({ source: '', text, move: true })),
  ...[
    'Aprovecha 20% de descuento en tu proxima compra. Aplican terminos y condiciones',
    'Paga a 0% de interes hasta 6 cuotas con tu tarjeta. Aplican T&C',
    'Llevate dos por uno solo por hoy. Pide ya',
    'Conoce nuestra nueva tarjeta sin cuota de manejo. Solicitala ya',
    'Tienes un credito preaprobado hasta por $ 5.000.000. Solicitalo aqui',
    'Gana premios participando en nuestro sorteo',
    'Envio gratis en tu primer pedido con el cupon BIENVENIDA',
    'Descubre las nuevas rutas desde $ 0 y viaja con nosotros',
    'Limited time offer: 30% off on your next order',
  ].map(text => ({ source: '', text, move: false })),
];

/** The words of a message, folded, with no figures: single words of three letters or more, and pairs. */
export function wordsOf(text: string): string[] {
  const plain = text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-zñ&%]+/g, ' ').trim();
  if (!plain) return [];
  const parts = plain.split(' ').filter(one => one.length >= 2);
  const words = new Set<string>();
  for (let i = 0; i < parts.length; i += 1) {
    if (parts[i].length >= 3) words.add(parts[i]);
    if (i + 1 < parts.length) words.add(`${parts[i]} ${parts[i + 1]}`);
  }
  return [...words];
}

interface Counts { moves: number; notMoves: number; inMoves: Map<string, number>; inNot: Map<string, number> }

function count(examples: readonly { words: string[]; move: boolean; weight: number }[]): Counts {
  const counts: Counts = { moves: 0, notMoves: 0, inMoves: new Map(), inNot: new Map() };
  for (const one of examples) {
    const side = one.move ? counts.inMoves : counts.inNot;
    if (one.move) counts.moves += one.weight; else counts.notMoves += one.weight;
    for (const word of one.words) side.set(word, (side.get(word) ?? 0) + one.weight);
  }
  return counts;
}

function tableOf(own: Counts | null, all: Counts, ownMarked: number, allMarked: number, ownMoves: number): Table {
  const share = own ? OTHERS : 1;
  const moves = (own?.moves ?? 0) + share * all.moves;
  const notMoves = (own?.notMoves ?? 0) + share * all.notMoves;
  const words: Record<string, number> = {};
  const every = new Set([...all.inMoves.keys(), ...all.inNot.keys()]);
  for (const word of every) {
    const m = (own?.inMoves.get(word) ?? 0) + share * (all.inMoves.get(word) ?? 0);
    const n = (own?.inNot.get(word) ?? 0) + share * (all.inNot.get(word) ?? 0);
    const weight = Math.log((m + 0.5) / (moves + 1)) - Math.log((n + 0.5) / (notMoves + 1));
    if (Math.abs(weight) >= 0.2) words[word] = Math.round(weight * 100) / 100;
  }
  const strongest = Object.entries(words).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, WORDS_PER_TABLE);
  return {
    prior: Math.round(Math.log((moves + 1) / (notMoves + 1)) * 100) / 100,
    words: Object.fromEntries(strongest),
    marked: ownMarked + (own ? 0 : allMarked),
    ownMoves,
  };
}

/** The book, from the person's examples (and the generic ones it starts from). */
export function buildWordBook(examples: readonly Example[]): WordBook {
  const mine = examples.map(one => ({ ...one, words: wordsOf(one.text), weight: 1 }));
  const seeded = [...SEED.map(one => ({ ...one, words: wordsOf(one.text), weight: SEED_WEIGHT })), ...mine];
  const all = count(seeded);
  const allMarked = mine.filter(one => !one.move).length;
  const bySource = new Map<string, typeof mine>();
  for (const one of mine) {
    if (!one.source) continue;
    bySource.set(one.source, [...(bySource.get(one.source) ?? []), one]);
  }
  const sources: Record<string, Table> = {};
  for (const [source, own] of bySource) {
    sources[source] = tableOf(count(own), all, own.filter(one => !one.move).length + allMarked, allMarked,
      own.filter(one => one.move).length);
  }
  return { sources, all: tableOf(null, all, 0, allMarked, 0) };
}

/** The sum of a message's weights for its source. */
export function scoreOf(book: WordBook, source: string, text: string): number {
  const table = book.sources[source] ?? book.all;
  let score = table.prior;
  for (const word of wordsOf(text)) score += table.words[word] ?? 0;
  return score;
}

/**
 * What the book says of a message. A movement whenever it leans that way. An
 * advert only once the person answered "No es un movimiento" at least once
 * (so the generic examples alone never hide anything), and - while nothing
 * of this source was ever saved - only for a message that names no direction
 * of money ("compra", "recibiste"...): a source known only by its adverts
 * shares its own name and sign-off with its real messages, and those words
 * alone must not hide a purchase. Its first saved movement lifts that.
 */
export function verdictOf(book: WordBook, source: string, text: string, saysWhichWay = false): Verdict {
  const table = book.sources[source] ?? book.all;
  const score = scoreOf(book, source, text);
  if (score >= LEAN) return 'movement';
  if (score <= -LEAN && table.marked > 0 && (table.ownMoves > 0 || !saysWhichWay)) return 'advert';
  return null;
}
