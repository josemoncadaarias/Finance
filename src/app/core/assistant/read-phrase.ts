/**
 * What a sentence typed or spoken to the assistant asks for (Jose,
 * 2026-10-19, mockups `39a`-`39l`): a movement to register, or a question.
 *
 * No AI behind it, on purpose - costs per use are what Jose wants to avoid -
 * and nothing burned in for one person: it reads by shape, the way
 * `read-notice.ts` reads a bank's message. An amount looks like money ("45
 * mil", "$45.000", "dos millones", "50 lucas"); what is asked is said by the
 * ordinary words of both languages ("gasté", "me llegó", "¿me alcanza?");
 * accounts, products and categories are the person's own names; and every
 * word it cannot place is handed back, so the screen asks once and the answer
 * is kept (`Learned`, the merchant dictionary).
 *
 * Pure: everything it needs comes in, nothing is read or written here.
 */

export type Intent =
  /** "Gasté 45 mil en almuerzo": a movement to confirm. */
  | 'register'
  /** "¿Me alcanza para unos tenis de 300 mil?" */
  | 'afford'
  /** "¿Cuánto llevo en restaurantes?" */
  | 'spentIn'
  /** "¿Cuánto puedo gastar al día?" */
  | 'perDay'
  /** "¿Cómo calculas lo de mis metas?" */
  | 'howGoals'
  /** An amount and a thing, and nothing saying which of the two above it is. */
  | 'unsure'
  | 'unknown';

export type Side = 'expense' | 'income' | 'transfer';

export interface PhraseAccount { id: number; name: string; type: string }
export interface PhraseProduct { id: number; accountId: number; name: string }
export interface PhraseCategory { id: number; name: string; kind: 'income' | 'expense' }

/** What the person taught the assistant, kept in the database (`settings`). */
export interface Learned {
  /** A word that means an account: "la rappi" → Rappi Card. Folded. */
  accounts: Record<string, number>;
  /** A shape of sentence with no verb, and what it turned out to mean. */
  shapes: Record<string, 'register' | 'afford'>;
}

export const NOTHING_LEARNED: Learned = { accounts: {}, shapes: {} };

export interface PhraseContext {
  accounts: readonly PhraseAccount[];
  products: readonly PhraseProduct[];
  categories: readonly PhraseCategory[];
  /** The merchant dictionary: a folded word or name to its category. */
  merchants: ReadonlyMap<string, number>;
  /** A common word to a starter category's name, by side (`common-words.ts`). */
  commonWord?: (word: string, side: 'income' | 'expense') => string | null;
  learned: Learned;
  today: string;
}

export interface Reading {
  intent: Intent;
  side: Side | null;
  amountMinor: number | null;
  /** A bare "250" read as 250 mil: said back to the person. */
  amountGuessed: boolean;
  /** The figure as it was written, for "Tomé 250 como $ 250.000". */
  amountText: string | null;
  onDate: string;
  /** Said in words ("ayer"), so the card can say it back. */
  dayWord: string | null;
  accountId: number | null;
  /** Accounts the words could mean, when more than one could. */
  accountChoices: number[];
  /** A transfer's other end. */
  toAccountId: number | null;
  productId: number | null;
  categoryId: number | null;
  /** How the category was found, for the card's word under it. */
  categoryFrom: 'name' | 'learned' | 'common' | null;
  /** What the sentence was about, in its own words: "tenis", "Éxito", "almuerzo". */
  thing: string | null;
  /** The shape of a sentence with no verb, to learn what it meant. */
  shape: string | null;
}

/** Lower case, no accents, the way every comparison here is made. */
export function fold(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

// ---------------------------------------------------------------------------
// Amounts
// ---------------------------------------------------------------------------

const UNITS: Record<string, number> = {
  cero: 0, un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9,
  diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17,
  dieciocho: 18, diecinueve: 19, veinte: 20, veintiun: 21, veintiuno: 21, veintiuna: 21, veintidos: 22,
  veintitres: 23, veinticuatro: 24, veinticinco: 25, veintiseis: 26, veintisiete: 27, veintiocho: 28,
  veintinueve: 29, treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80,
  noventa: 90, cien: 100, ciento: 100, doscientos: 200, doscientas: 200, trescientos: 300, trescientas: 300,
  cuatrocientos: 400, cuatrocientas: 400, quinientos: 500, quinientas: 500, seiscientos: 600, seiscientas: 600,
  setecientos: 700, setecientas: 700, ochocientos: 800, ochocientas: 800, novecientos: 900, novecientas: 900,
  medio: 0.5, media: 0.5,
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11,
  twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18,
  nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
  half: 0.5,
};

/** Words that multiply what came before them. */
const TIMES: Record<string, number> = {
  mil: 1_000, k: 1_000, luca: 1_000, lucas: 1_000, thousand: 1_000,
  millon: 1_000_000, millones: 1_000_000, palo: 1_000_000, palos: 1_000_000, million: 1_000_000,
  millions: 1_000_000, m: 1_000_000,
};

/** "45.000", "1.250.000", "45,5", "1.5": the number a run of digits is. */
function digitsValue(raw: string): number | null {
  const text = raw.replace(/^\$/, '');
  if (!/^\d[\d.,]*$/.test(text)) return null;
  const marks = text.match(/[.,]/g) ?? [];
  if (marks.length === 0) return Number(text);
  const last = Math.max(text.lastIndexOf('.'), text.lastIndexOf(','));
  const after = text.length - last - 1;
  // One mark with one or two digits after it is the decimals; anything else groups thousands.
  if (marks.length === 1 && after <= 2 && after > 0) return Number(text.replace(/[.,]/, '.'));
  if (marks.length > 1 && after <= 2 && after > 0) {
    return Number(text.slice(0, last).replace(/[.,]/g, '') + '.' + text.slice(last + 1));
  }
  return Number(text.replace(/[.,]/g, ''));
}

interface Token { raw: string; word: string; used: boolean }

function tokensOf(text: string): Token[] {
  // "$45.000", "45mil", "45k" come apart into the figure and its word.
  const spaced = text
    .replace(/(\d)(mil|k|m|lucas?|palos?)\b/gi, '$1 $2')
    .replace(/\$\s+/g, '$');
  return spaced.split(/[\s¿?¡!;:"()]+/).filter(Boolean).map(raw => {
    const cleaned = raw.replace(/^[^\p{L}\p{N}$]+|[^\p{L}\p{N}]+$/gu, '');
    return { raw: cleaned, word: fold(cleaned), used: false };
  }).filter(token => token.raw.length > 0);
}

interface Amount { value: number; text: string; withUnit: boolean; pesosSaid: boolean }

/**
 * The first amount in the sentence: a run of figures and number words with
 * what multiplies them - "dos millones quinientos mil", "1,5 millones",
 * "45 mil", "50 lucas". Its tokens are marked used.
 */
function amountIn(tokens: Token[]): Amount | null {
  for (let start = 0; start < tokens.length; start++) {
    const first = tokens[start];
    const startsNumber = digitsValue(first.word) !== null || (first.word in UNITS && first.word !== 'un' && first.word !== 'una' && first.word !== 'medio' && first.word !== 'media')
      || ((first.word === 'un' || first.word === 'una' || first.word === 'medio' || first.word === 'media')
        && tokens[start + 1] !== undefined && tokens[start + 1].word in TIMES);
    if (!startsNumber) continue;

    let total = 0;
    let current = 0;
    let withUnit = false;
    let end = start;
    for (let i = start; i < tokens.length; i++) {
      const w = tokens[i].word;
      const digits = digitsValue(w);
      if (digits !== null) {
        if (i > start && current !== 0 && !(tokens[i - 1].word in TIMES)) break;
        current += digits;
      } else if (w in UNITS) {
        current += UNITS[w];
      } else if (w === 'hundred') {
        current = (current || 1) * 100;
      } else if (w in TIMES) {
        if (w === 'm' && i === start) break;
        const times = TIMES[w];
        if (times === 1_000_000) {
          total = (total + (current || 1)) * times;
        } else {
          total += (current || 1) * times;
        }
        current = 0;
        withUnit = true;
      } else if ((w === 'y' || w === 'and') && i > start && tokens[i + 1] && (tokens[i + 1].word in UNITS || digitsValue(tokens[i + 1].word) !== null)) {
        // "cuarenta y cinco mil"
      } else {
        break;
      }
      end = i;
    }
    const value = total + current;
    if (value <= 0) continue;
    const pesosSaid = tokens[end + 1]?.word === 'pesos' || tokens[end + 1]?.word === 'peso' || first.raw.startsWith('$');
    if (tokens[end + 1]?.word === 'pesos' || tokens[end + 1]?.word === 'peso') end++;
    for (let i = start; i <= end; i++) tokens[i].used = true;
    return {
      value, withUnit, pesosSaid,
      text: tokens.slice(start, end + 1).map(t => t.raw).join(' '),
    };
  }
  return null;
}

// ---------------------------------------------------------------------------
// What is asked
// ---------------------------------------------------------------------------

const has = (folded: string, pattern: RegExp) => pattern.test(folded);

const HOW_GOALS = /\bmetas?\b.*\b(calcul\w*|como|aporte\w*|cuota\w*)|\b(calcul\w*|como)\b.*\bmetas?\b|\bhow\b.*\bgoals?\b/;
const PER_DAY = /\b(cuanto|que tanto)\b.*\b(puedo gastar|me queda|tengo)\b.*\b(dia|diario|hoy|semana|mes)\b|\bal dia\b.*\bcuanto\b|\bhow much\b.*\b(can i spend|left)\b/;
const SPENT_IN = /\b(cuanto|que tanto)\b.*\b(llevo|he gastado|gaste|gastado|va|van|voy)\b|\bhow much\b.*\b(spent|have i spent|did i spend)\b/;
const AFFORD = /\b(alcanza|alcanzaria|me puedo|puedo (gastar|comprar|pagar|darme|permitirme)\w*|podria (gastar|comprar|pagar)\w*|can i (afford|spend|buy|pay)|afford)\b/;
const EXPENSE = /\b(gaste|gastamos|me gaste|pague|pagamos|compre|compramos|me compre|me costo|costo|spent|paid|bought|gasto de|un gasto)\b/;
const INCOME = /\b(me llego|llego|me llegaron|llegaron|recibi|me pagaron|me consignaron|me transfirieron|me depositaron|gane|cobre|ingreso|ingresaron|received|got paid|earned|got)\b/;
const TRANSFER = /\b(pase|pasamos|transferi|movi|mande|envie|consigne|meti|ahorre|transferred|moved|sent)\b/;

/** Words that join a sentence and say nothing about its money. */
const FILLER = new Set([
  'de', 'del', 'la', 'el', 'los', 'las', 'lo', 'un', 'una', 'unos', 'unas', 'en', 'con', 'para', 'por', 'a', 'al',
  'mi', 'mis', 'me', 'te', 'se', 'y', 'o', 'que', 'pesos', 'peso', 'plata', 'dinero', 'hoy', 'ayer', 'antier',
  'anteayer', 'si', 'es', 'esta', 'este', 'esto', 'eso', 'ese', 'algo', 'cosa', 'cosas', 'tengo', 'gastar',
  'comprar', 'comprarme', 'pagar', 'gaste', 'gastamos', 'pague', 'compre', 'me', 'llego', 'recibi', 'pagaron',
  'puedo', 'alcanza', 'cuanto', 'llevo', 'va', 'ya', 'casi', 'como', 'mas', 'menos', 'desde', 'hacia',
  'pase', 'transferi', 'movi', 'mande', 'envie', 'consigne', 'gasto', 'compra', 'pago', 'pagos', 'costo',
  'ingreso', 'the', 'an', 'for', 'on', 'at', 'with', 'my', 'i', 'of', 'to', 'from', 'in', 'some',
  'spent', 'paid', 'bought', 'can', 'afford', 'buy', 'spend', 'today', 'yesterday', 'how', 'much', 'llegaron',
  'consignaron', 'transfirieron', 'depositaron', 'gane', 'cobre', 'got', 'received', 'earned', 'costaron',
  'gastado', 'he', 'dia', 'al', 'quiero', 'voy', 'iba', 'necesito', 'darme', 'permitirme', 'podria', 'ahi',
  'aqui', 'eh', 'bueno', 'pues', 'ok', 'gastarme', 'meti', 'ahorre', 'cuenta', 'tarjeta', 'cuentas',
  'aproximadamente', 'masomenos', 'mil', 'luca', 'lucas', 'pasamos', 'compramos', 'pagamos', 'gastos',
]);

const DAYS_ES = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
const DAYS_EN = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function shift(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().slice(0, 10);
}

/** The day the sentence names, today when it names none. */
function dayIn(tokens: Token[], today: string): { onDate: string; word: string | null } {
  for (let i = 0; i < tokens.length; i++) {
    const w = tokens[i].word;
    if (w === 'hoy' || w === 'today') { tokens[i].used = true; return { onDate: today, word: null }; }
    if (w === 'ayer' || w === 'yesterday') { tokens[i].used = true; return { onDate: shift(today, -1), word: tokens[i].raw }; }
    if (w === 'antier' || w === 'anteayer' || w === 'antes de ayer') { tokens[i].used = true; return { onDate: shift(today, -2), word: tokens[i].raw }; }
    const weekday = DAYS_ES.indexOf(w) >= 0 ? DAYS_ES.indexOf(w) : DAYS_EN.indexOf(w);
    if (weekday >= 0) {
      const [y, m, d] = today.split('-').map(Number);
      const now = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
      const back = (now - weekday + 7) % 7;
      tokens[i].used = true;
      return { onDate: shift(today, -back), word: tokens[i].raw };
    }
    // "el 15", "el 15 de octubre"
    if ((w === 'el' || w === 'on') && tokens[i + 1] && /^\d{1,2}$/.test(tokens[i + 1].word)) {
      const day = Number(tokens[i + 1].word);
      if (day < 1 || day > 31) continue;
      let month = Number(today.slice(5, 7));
      let year = Number(today.slice(0, 4));
      let used = 2;
      if (tokens[i + 2]?.word === 'de' && tokens[i + 3] && MONTHS.includes(tokens[i + 3].word)) {
        month = MONTHS.indexOf(tokens[i + 3].word) + 1;
        used = 4;
      }
      let iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      if (iso > today) {
        if (used === 4) year -= 1; else month -= 1;
        if (month === 0) { month = 12; year -= 1; }
        iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      }
      for (let k = i; k < i + used; k++) tokens[k].used = true;
      return { onDate: iso, word: tokens.slice(i, i + used).map(t => t.raw).join(' ') };
    }
  }
  return { onDate: today, word: null };
}

// ---------------------------------------------------------------------------
// The person's own names
// ---------------------------------------------------------------------------

/** Words too common in names of accounts to tell one from another. */
const GENERIC = new Set(['cuenta', 'cuentas', 'tarjeta', 'credito', 'debito', 'de', 'del', 'la', 'el', 'cop', 'usd',
  'eur', 'mi', 'banco', 'bank', 'card', 'account', 'savings', 'ahorro', 'principal', 'bolsillo', 'alcancia',
  'cajita', 'producto', 'y', 'en', 'para', 'con', 'los', 'las']);

function wordsOf(name: string): string[] {
  return fold(name).split(/[^a-z0-9ñ]+/).filter(Boolean);
}

/** Where a run of folded words sits in the sentence's unused tokens, or -1. */
function findRun(tokens: Token[], run: readonly string[]): number {
  if (run.length === 0) return -1;
  outer: for (let i = 0; i + run.length <= tokens.length; i++) {
    for (let k = 0; k < run.length; k++) {
      if (tokens[i + k].used || tokens[i + k].word !== run[k]) continue outer;
    }
    return i;
  }
  return -1;
}

interface Found<T> { item: T; at: number; length: number }

/**
 * Names said in the sentence: a whole name first, then a word only one of
 * them carries. Several names sharing the word said are all handed back.
 */
/** Words that come before an account's name: "con la", "desde", "a mi". */
const BEFORE_NAME = new Set(['con', 'desde', 'de', 'del', 'en', 'a', 'al', 'para', 'from', 'with', 'to', 'into', 'on', 'in']);
const ARTICLES = new Set(['la', 'el', 'los', 'las', 'mi', 'mis', 'tu', 'the', 'my']);

/**
 * Whether a name at `at` is said as a place money comes from or goes to -
 * "con la Rappi", "desde Bancolombia", "a Ahorros" - and not as the thing
 * itself: "un viaje" is a trip, even with a pocket called Viaje.
 */
function saidAsPlace(tokens: Token[], at: number): boolean {
  let i = at - 1;
  while (i >= 0 && ARTICLES.has(tokens[i].word)) i--;
  return i < 0 || BEFORE_NAME.has(tokens[i].word);
}

function namesIn<T>(tokens: Token[], items: readonly T[], nameOf: (item: T) => string): Found<T>[] {
  const whole: Found<T>[] = [];
  for (const item of [...items].sort((a, b) => wordsOf(nameOf(b)).length - wordsOf(nameOf(a)).length)) {
    const run = wordsOf(nameOf(item));
    const at = findRun(tokens, run);
    if (at >= 0 && !whole.some(f => at < f.at + f.length && f.at < at + run.length)) whole.push({ item, at, length: run.length });
  }
  if (whole.length > 0) return whole;

  // A word of its name that is distinctive: no other item carries it.
  const count = new Map<string, number>();
  for (const item of items) for (const w of new Set(wordsOf(nameOf(item)))) count.set(w, (count.get(w) ?? 0) + 1);
  const partial: Found<T>[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.used || t.word.length < 3 || GENERIC.has(t.word)) continue;
    const carrying = items.filter(item => wordsOf(nameOf(item)).includes(t.word));
    for (const item of carrying) partial.push({ item, at: i, length: 1 });
    if (carrying.length > 0 && count.get(t.word) === carrying.length) continue;
  }
  return partial;
}

// ---------------------------------------------------------------------------
// The reading
// ---------------------------------------------------------------------------

export function readPhrase(text: string, ctx: PhraseContext): Reading {
  const folded = fold(text).replace(/[¿?¡!]/g, ' ');
  const tokens = tokensOf(text);
  const amount = amountIn(tokens);
  const day = dayIn(tokens, ctx.today);

  let intent: Intent;
  let side: Side | null = null;
  if (has(folded, HOW_GOALS)) intent = 'howGoals';
  else if (has(folded, AFFORD) && amount) intent = 'afford';
  else if (has(folded, PER_DAY) || (!amount && has(folded, AFFORD))) intent = 'perDay';
  else if (has(folded, SPENT_IN) && !amount) intent = 'spentIn';
  else if (amount && has(folded, TRANSFER) && !has(folded, EXPENSE)) { intent = 'register'; side = 'transfer'; }
  else if (amount && has(folded, INCOME) && !has(folded, EXPENSE)) { intent = 'register'; side = 'income'; }
  else if (amount && has(folded, EXPENSE)) { intent = 'register'; side = 'expense'; }
  else if (amount) intent = 'unsure';
  else intent = 'unknown';
  if (intent === 'afford') side = 'expense';

  // A product names its account too: "del bolsillo viajes".
  const accountWords = new Set(ctx.accounts.flatMap(a => wordsOf(a.name)));
  const products = namesIn(tokens, ctx.products, p => p.name)
    .filter(f => saidAsPlace(tokens, f.at))
    .filter(f => f.length > 1 || wordsOf(f.item.name).length === 1 || !accountWords.has(tokens[f.at].word));
  let productId: number | null = null;
  let productAccount: number | null = null;
  if (products.length === 1) {
    productId = products[0].item.id;
    productAccount = products[0].item.accountId;
    for (let k = 0; k < products[0].length; k++) tokens[products[0].at + k].used = true;
  }

  // Accounts: learned words first ("la rappi"), then their names.
  let accountId: number | null = productAccount;
  let toAccountId: number | null = null;
  let accountChoices: number[] = [];
  const learnedHits: Found<number>[] = [];
  for (const [phrase, id] of Object.entries(ctx.learned.accounts)) {
    if (!ctx.accounts.some(a => a.id === id)) continue;
    const at = findRun(tokens, phrase.split(' '));
    if (at >= 0) learnedHits.push({ item: id, at, length: phrase.split(' ').length });
  }
  const named = namesIn(tokens, ctx.accounts, a => a.name).filter(f => saidAsPlace(tokens, f.at));
  const hits: { ids: number[]; at: number; length: number }[] = [
    ...learnedHits.map(h => ({ ids: [h.item], at: h.at, length: h.length })),
  ];
  for (const f of named) {
    if (hits.some(h => h.at === f.at)) continue;
    const same = named.filter(o => o.at === f.at).map(o => o.item.id);
    hits.push({ ids: same, at: f.at, length: f.length });
  }
  hits.sort((a, b) => a.at - b.at);
  for (const hit of hits) for (let k = 0; k < hit.length; k++) tokens[hit.at + k].used = true;

  if (side === 'transfer') {
    // "pasé 200 mil de Bancolombia a Ahorros": "a" before the destination.
    for (const hit of hits) {
      const before = tokens[hit.at - 1]?.word ?? '';
      const into = before === 'a' || before === 'al' || before === 'hacia' || before === 'to' || before === 'para';
      if (hit.ids.length !== 1) { accountChoices = hit.ids; continue; }
      if (into && toAccountId === null) toAccountId = hit.ids[0];
      else if (accountId === null) accountId = hit.ids[0];
      else if (toAccountId === null) toAccountId = hit.ids[0];
    }
  } else if (accountId === null && hits.length > 0) {
    if (hits[0].ids.length === 1) accountId = hits[0].ids[0];
    else accountChoices = hits[0].ids;
  }

  // What is left says what it was about.
  const left = tokens.filter(t => !t.used && !FILLER.has(t.word) && !/^\d+$/.test(t.word)
    && !EXPENSE.test(t.word) && !INCOME.test(t.word) && !TRANSFER.test(t.word));
  const thing = left.length > 0 ? left.map(t => t.raw).join(' ') : null;

  // The category: its own name said, the person's dictionary, then a common word.
  const wanted: 'income' | 'expense' = side === 'income' ? 'income' : 'expense';
  let categoryId: number | null = null;
  let categoryFrom: Reading['categoryFrom'] = null;
  if (side !== 'transfer') {
    const cats = ctx.categories.filter(c => c.kind === wanted || intent === 'unsure' || intent === 'spentIn');
    const byName = namesIn(left.map(t => ({ ...t })), cats, c => c.name)
      .filter(f => wordsOf(f.item.name).every(w => w.length >= 3 || wordsOf(f.item.name).length > 1));
    const exact = byName.filter(f => wordsOf(f.item.name).join(' ') === left.slice(f.at, f.at + f.length).map(t => t.word).join(' '));
    const pick = (exact.length > 0 ? exact : byName);
    const ids = [...new Set(pick.map(f => f.item.id))];
    if (ids.length === 1) { categoryId = ids[0]; categoryFrom = 'name'; }
    // Plurals and singulars: "restaurantes" for "Restaurante".
    if (categoryId === null) {
      for (const t of left) {
        if (t.word.length < 3) continue;
        const plural = (a: string, b: string) => a === b || a === `${b}s` || a === `${b}es` || b === `${a}s` || b === `${a}es`;
        const match = cats.filter(c => wordsOf(c.name).some(w => plural(t.word, w)));
        if (match.length === 1) { categoryId = match[0].id; categoryFrom = 'name'; break; }
      }
    }
    if (categoryId === null && thing) {
      const whole = fold(thing).replace(/[^a-z0-9ñ ]+/g, ' ').trim().toUpperCase();
      const learned = ctx.merchants.get(whole)
        ?? left.map(t => ctx.merchants.get(t.word.toUpperCase())).find(id => id !== undefined);
      if (learned !== undefined && ctx.categories.some(c => c.id === learned)) { categoryId = learned; categoryFrom = 'learned'; }
    }
    if (categoryId === null && ctx.commonWord) {
      for (const t of left) {
        const name = ctx.commonWord(t.word.toUpperCase(), wanted);
        const match = name ? ctx.categories.filter(c => c.kind === wanted && fold(c.name) === fold(name)) : [];
        if (match.length === 1) { categoryId = match[0].id; categoryFrom = 'common'; break; }
      }
    }
  }

  // A sentence with no verb: what it meant last time it had this shape.
  let shape: string | null = null;
  if (intent === 'unsure') {
    shape = ['amount', categoryId !== null || thing ? 'thing' : '', accountId !== null ? 'account' : '']
      .filter(Boolean).join('+');
    const meant = ctx.learned.shapes[shape];
    if (meant === 'register') { intent = 'register'; side = 'expense'; }
    else if (meant === 'afford') { intent = 'afford'; side = 'expense'; }
    else if (categoryId !== null && ctx.categories.find(c => c.id === categoryId)?.kind === 'income') side = 'income';
  }

  // A bare "250" is 250 mil in a country where nothing costs 250 pesos.
  let amountMinor: number | null = null;
  let guessed = false;
  if (amount) {
    let pesos = amount.value;
    if (!amount.withUnit && !amount.pesosSaid && pesos < 1000 && Number.isInteger(pesos)) {
      pesos *= 1000;
      guessed = true;
    }
    amountMinor = Math.round(pesos * 100);
  }

  return {
    intent, side, amountMinor, amountGuessed: guessed, amountText: amount?.text ?? null,
    onDate: day.onDate, dayWord: day.word,
    accountId, accountChoices, toAccountId, productId,
    categoryId, categoryFrom, thing, shape,
  };
}
