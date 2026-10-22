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

import { periodContaining, shiftPeriod, type Period } from '../filters/period';

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
  /** "¿Cómo voy este mes?": the period in figures, against the one before. */
  | 'howAmI'
  /** "¿En qué gasté más?": the categories, largest first. */
  | 'topSpending'
  /** "¿Cuánto debo?": every debt, what it costs. */
  | 'debts'
  /** "¿Qué deuda pago primero?" */
  | 'payFirst'
  /** "¿Y si abono 500 mil al mes?" */
  | 'payMore'
  /** "¿Qué pagos tengo este mes?" */
  | 'due'
  /** "¿Cuánto tengo?", "¿cuánto hay en Nequi?" */
  | 'have'
  /** "¿Cómo van mis topes y mis metas?" */
  | 'plans'
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
  /**
   * A sentence, its figures and its day left out, and where the movement it
   * asked for was finally saved: the next time it is said the same way it
   * goes there (Jose, 2026-10-22: corrected once, asked again, the same
   * wrong account came back).
   */
  phrases?: Record<string, LearnedRoute>;
}

/** Where a sentence's movement was saved. */
export interface LearnedRoute {
  side: Side;
  accountId: number | null;
  productId: number | null;
  toAccountId: number | null;
  toProductId: number | null;
  categoryId: number | null;
}

export const NOTHING_LEARNED: Learned = { accounts: {}, shapes: {}, phrases: {} };

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
  /** A transfer's products, when named: "del bolsillo principal a la cuenta de ahorros". */
  fromProductId: number | null;
  toProductId: number | null;
  categoryId: number | null;
  /** How the category was found, for the card's word under it. */
  categoryFrom: 'name' | 'learned' | 'common' | null;
  /** What the sentence was about, in its own words: "tenis", "Éxito", "almuerzo". */
  thing: string | null;
  /** The shape of a sentence with no verb, to learn what it meant. */
  shape: string | null;
  /** The period a question is about ("en septiembre", "este año"); null when none was said. */
  period: Period | null;
  /** The sentence without its figures and its day, to learn where it was saved. */
  phraseKey: string | null;
  /** The route came from what was saved for this same sentence before. */
  fromMemory: boolean;
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

const HOW_GOALS = /\bmetas?\b.*\b(calcul\w*|aporte\w*|cuota\w*)|\b(calcul\w*|aporte\w*|cuota\w*)\b.*\bmetas?\b|\bhow\b.*\bgoals?\b.*\b(work|calculat\w*)\b|\bhow\b.*\b(work|calculat\w*)\b.*\bgoals?\b/;
// The questions about the whole picture (mockups 40a-40j): said any way a
// person says them, never one person's sentences.
const PAY_MORE = /\b(si|y si|que pasa si|cuanto (me )?ahorro si|what if|if i)\b.*\b(abon\w*|pag[oau]\w*|met[oie]\w*|pongo|pusiera|extra|adicional|pay|paid)\b/;
const PAY_FIRST = /\b(que|cual|cuales)\b.*\b(deudas?|prestamos?|credito|tarjeta)?\b.*\b(pago|pagar|abono|abonar|cancelo|cancelar|liquido|salgo)\b.*\b(primero|antes|primera|de primeras)\b|\b(que|cual)\b.*\b(deudas?|prestamos?)\b.*\b(me conviene|conviene|mas cara|cuesta mas|cobra mas|mas interes\w*|primero)\b|\b(which|what)\b.*\b(debt|loan)\b.*\bfirst\b|\bpay\b.*\bfirst\b/;
const DEBTS = /\b(cuanto|cuanta plata|cuanto dinero)\b.*\b(debo|adeudo)\b|\b(cuantas|cuales|que|mis)\b.*\b(deudas|prestamos|creditos)\b|\b(que|a quien)\b.*\bdebo\b|\bhow much\b.*\bowe\b|\bmy debts\b/;
const DUE = /\b(que|cuales|cuantos)\b.*\b(pagos|cuotas|facturas|cuentas por pagar)\b|\b(que|cuando)\b.*\b(tengo que pagar|me toca pagar|debo pagar|vence\w*|hay que pagar)\b|\bproximos pagos\b|\b(what|which)\b.*\b(payments|bills)\b|\bwhat do i have to pay\b/;
const PLANS = /\b(como|que tal)\b.*\b(van?|voy|estan?|llevo)\b.*\b(topes?|metas?|presupuestos?|ahorros?)\b|\bmis (topes|metas|presupuestos)\b|\b(how)\b.*\b(caps?|goals?|budgets?)\b/;
const HOW_AM_I = /\b(como)\b.*\b(voy|me va|estoy|vamos|me fue|me ha ido|van mis finanzas|van mis cuentas|ando)\b|\b(resumen|balance)\b.*\b(mes|semana|ano|periodo)\b|\bhow am i doing\b|\bhow did i do\b|\bhow (is|was|did)\b.*\b(month|year|week|going|go)\b/;
const TOP_SPENDING = /\b(en que|en donde|donde|a que|que)\b.*\b(gast\w*|se me va\w*|se me fue|se fue|se me esta yendo|se va)\b|\b(mayores?|mas grandes?|principales)\b.*\bgastos?\b|\b(en que|que)\b.*\bcategorias?\b|\bwhat did i spend\b.*\bmost\b|\bwhere\b.*\bmoney\b.*\bgo\w*\b/;
const HAVE = /\b(cuanto|cuanta plata|cuanto dinero)\b.*\b(tengo|hay|tiene|me queda)\b|\b(mi|cual es mi)\b.*\b(patrimonio|saldo)\b|\bsaldo\b|\bhow much\b.*\b(do i have|is in|have i got)\b|\bmy (net worth|balance)\b/;
const FREE_NOW = /\bcuanto\b.*\b(me queda|tengo|hay)\b.*\blibre\b|\bcuanto puedo gastar\b|\bhow much\b.*\bfree\b/;
const PER_DAY = /\b(cuanto|que tanto)\b.*\b(puedo gastar|me queda|tengo)\b.*\b(dia|diario|hoy|semana|mes)\b|\bal dia\b.*\bcuanto\b|\bhow much\b.*\b(can i spend|left)\b/;
const SPENT_IN = /\b(cuanto|que tanto)\b.*\b(llevo|he gastado|gaste|gastado|va|van|voy)\b|\bhow much\b.*\b(spent|have i spent|did i spend)\b/;
const AFFORD = /\b(alcanza|alcanzaria|me puedo|puedo (gastar|comprar|pagar|darme|permitirme)\w*|podria (gastar|comprar|pagar)\w*|can i (afford|spend|buy|pay)|afford)\b/;
const EXPENSE = /\b(gaste|gastamos|me gaste|pague|pagamos|compre|compramos|me compre|me costo|costo|spent|paid|bought|gasto de|un gasto)\b/;
const INCOME = /\b(me llego|llego|me llegaron|llegaron|recibi|me pagaron|me consignaron|me transfirieron|me depositaron|gane|cobre|ingreso|ingresaron|received|got paid|earned|got)\b/;
/**
 * Money moving between one's own places, said any way a person says it: any
 * tense or person of the verbs people use for it, and their nouns - never a
 * list of one person's sentences. "pasé", "pásale", "voy a pasar", "le paso",
 * "trasladamos", "consigné", "transferencia", "un giro", "saqué", "metí",
 * "guardé en el bolsillo", "moved", "sent"...
 */
const AR_ENDS = '(?:o|as|a|amos|an|ais|e|es|en|emos|aste|asteis|aron|ar|arle|arlo|arla|arles|arte|arme|ando|ado|ada|ados|adas|ale|alo|ame|ara|aria|are)';
const ER_ENDS = '(?:o|es|e|emos|en|i|io|imos|ieron|iste|er|erlo|erla|erle|iendo|ido|ida|a|ia)';
export const TRANSFER_WORD = new RegExp('^(?:'
  + `(?:pas|traslad|traspas|mand|envi|consign|recarg|abon|deposit|gir|fonde|guard|separ|retir|apart|ahorr|reserv)${AR_ENDS}`
  + '|(?:sac|saq)(?:o|as|a|amos|an|ue|ues|uen|aste|aron|ar|arle|arlo|ando|ado|ada)'
  + `|(?:mov|muev|met|devolv|devuelv)${ER_ENDS}`
  + '|transf(?:er|ier|ir)\\w*'
  + '|transferencias?|traslados?|traspasos?|giros?|envios?|consignacion(?:es)?|recargas?|abonos?|depositos?|retiros?'
  + '|transfers?|transferred|transferring|move|moved|moving|send|sent|sending|withdr(?:ew|aw|awn)|deposited|topped|top'
  + ')$');
/** Paying a card or a loan is money moving to it, not spending. */
const PAY_WORD = /^(?:pag|abon|cancel)(?:o|as|a|amos|an|e|ue|es|ues|aste|aron|ar|arle|arla|ando|ado|ada)$|^paid$|^pay$/;
/** Taking cash out: with no destination, it lands in the cash account. */
const CASH_OUT_WORD = /^(?:retir|sac|saq)\w*$|^cajeros?$|^atm$|^withdr\w*$/;
/** "me pasaron", "nos consignó", "me devolvieron": money that came in from someone. */
const CAME_IN = /\b(?:me|nos)\s+(\w+(?:aron|ieron|io|o))\b/;

/** Words that join a sentence and say nothing about its money. */
const FILLER = new Set([
  'de', 'del', 'la', 'el', 'los', 'las', 'lo', 'un', 'una', 'unos', 'unas', 'en', 'con', 'para', 'por', 'a', 'al',
  'mi', 'mis', 'me', 'te', 'se', 'le', 'les', 'nos', 'y', 'o', 'que', 'pesos', 'peso', 'plata', 'dinero', 'hoy', 'ayer', 'antier',
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
  'transferencia', 'transferir', 'traslado', 'traslade', 'trasladar', 'pasar', 'paso', 'mover', 'muevo', 'entre',
  'recargue', 'otra', 'otro', 'mismo', 'misma', 'producto', 'productos',
]);

const DAYS_ES = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
const DAYS_EN = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const MONTHS_EN = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
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

/**
 * How a word sounds, the way a phone's dictation may write it: "Rappi" heard
 * as "rapi" or "rap y", "Nequi" as "neki", "Davivienda" as "dabibienda".
 * Letters that sound alike are one, doubled letters one, spaces none.
 */
export function soundOf(text: string): string {
  return fold(text).replace(/[^a-z0-9ñ]+/g, '')
    .replace(/qu/g, 'k').replace(/c([ei])/g, 's$1').replace(/c/g, 'k')
    .replace(/z/g, 's').replace(/v/g, 'b').replace(/ll/g, 'y').replace(/y/g, 'i')
    .replace(/(^|[^c])h/g, '$1').replace(/w/g, 'u')
    .replace(/([a-z])\1+/g, '$1');
}

/** Words a person may put inside a name that the name does not carry. */
const INSIDE_NAME = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'para', 'of', 'the']);

/** Two sounds that are one name, allowing one slip in a long one. */
function soundsAlike(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.min(a.length, b.length) < 7 || Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  while (i < a.length && a[i] === b[i]) i++;
  let j = 0;
  while (j < a.length - i && j < b.length - i && a[a.length - 1 - j] === b[b.length - 1 - j]) j++;
  return Math.max(a.length, b.length) - i - j <= 1;
}

/**
 * Where a name sits in the sentence: word for word first, then by sound over
 * one to a few running words ("rap y cuenta" for "Rappi cuenta"). Answers
 * where it starts and how many words of the sentence it took.
 */
function findName(tokens: Token[], run: readonly string[]): { at: number; length: number } | null {
  const exact = findRun(tokens, run);
  if (exact >= 0) return { at: exact, length: run.length };
  const sound = soundOf(run.join(''));
  if (sound.length < 4) return null;
  for (let i = 0; i < tokens.length; i++) {
    let joined = '';
    for (let k = i; k < tokens.length && k < i + run.length + 3; k++) {
      if (tokens[k].used) break;
      // "bolsillo de viajes" for "Bolsillo Viajes": a joining word inside is skipped.
      if (k > i && INSIDE_NAME.has(tokens[k].word) && !run.includes(tokens[k].word)) continue;
      joined += tokens[k].word;
      const heard = soundOf(joined);
      if (heard.length > sound.length + 2) break;
      // The first word must sound like the start of the name: "y cuenta" is no "Rappi cuenta".
      if (k === i && !sound.startsWith(soundOf(tokens[i].word).slice(0, 2))) break;
      if (soundsAlike(heard, sound)) return { at: i, length: k - i + 1 };
    }
  }
  return null;
}

interface Found<T> { item: T; at: number; length: number }

/**
 * Names said in the sentence: a whole name first, then a word only one of
 * them carries. Several names sharing the word said are all handed back.
 */
/** Words that come before an account's name: "con la", "desde", "a mi". */
const BEFORE_NAME = new Set(['con', 'desde', 'de', 'del', 'en', 'a', 'al', 'para', 'entre', 'hacia', 'from', 'with', 'to', 'into', 'on', 'in', 'between']);
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

function namesIn<T>(tokens: Token[], items: readonly T[], nameOf: (item: T) => string, generic: ReadonlySet<string> = GENERIC): Found<T>[] {
  const whole: Found<T>[] = [];
  for (const item of [...items].sort((a, b) => wordsOf(nameOf(b)).length - wordsOf(nameOf(a)).length)) {
    const found = findName(tokens, wordsOf(nameOf(item)));
    if (!found) continue;
    const { at, length } = found;
    // The same words may name several (a "Cuenta de ahorros" in two banks): all are handed back.
    const clash = (f: Found<T>) => at < f.at + f.length && f.at < at + length && !(f.at === at && f.length === length);
    if (!whole.some(clash)) whole.push({ item, at, length });
  }
  if (whole.length > 0) return whole;

  // A word of its name that is distinctive: no other item carries it.
  const count = new Map<string, number>();
  for (const item of items) for (const w of new Set(wordsOf(nameOf(item)))) count.set(w, (count.get(w) ?? 0) + 1);
  const partial: Found<T>[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.used || t.word.length < 3 || generic.has(t.word)) continue;
    const heard = soundOf(t.word);
    const carrying = items.filter(item => wordsOf(nameOf(item)).some(w => w === t.word
      || (w.length >= 4 && !generic.has(w) && soundsAlike(soundOf(w), heard))));
    for (const item of carrying) partial.push({ item, at: i, length: 1 });
    if (carrying.length > 0 && count.get(t.word) === carrying.length) continue;
  }
  return partial;
}

// ---------------------------------------------------------------------------
// The reading
// ---------------------------------------------------------------------------

/**
 * The period a question names: "este mes", "el mes pasado", "en septiembre",
 * "septiembre del 2025", "esta semana", "la semana pasada", "este año", "el año
 * pasado", "hoy", "ayer". Null when none is said; its words are marked used.
 */
function periodIn(tokens: Token[], today: string): Period | null {
  const [y, m, d] = today.split('-').map(Number);
  const now = new Date(Date.UTC(y, m - 1, d));
  const words = tokens.map(t => t.word);
  const at = (run: string[]) => {
    for (let i = 0; i + run.length <= words.length; i++) {
      if (run.every((w, k) => words[i + k] === w)) return i;
    }
    return -1;
  };
  const take = (i: number, n: number) => { for (let k = i; k < i + n && k < tokens.length; k++) tokens[k].used = true; };
  const kinds: [string[], 'week' | 'month' | 'year', number][] = [
    [['semana', 'pasada'], 'week', -1], [['semana', 'anterior'], 'week', -1], [['last', 'week'], 'week', -1],
    [['mes', 'pasado'], 'month', -1], [['mes', 'anterior'], 'month', -1], [['last', 'month'], 'month', -1],
    [['ano', 'pasado'], 'year', -1], [['ano', 'anterior'], 'year', -1], [['last', 'year'], 'year', -1],
    [['esta', 'semana'], 'week', 0], [['this', 'week'], 'week', 0],
    [['este', 'mes'], 'month', 0], [['this', 'month'], 'month', 0],
    [['este', 'ano'], 'year', 0], [['this', 'year'], 'year', 0], [['el', 'ano'], 'year', 0],
  ];
  for (const [run, kind, steps] of kinds) {
    const i = at(run);
    if (i >= 0) { take(i, run.length); return shiftPeriod(periodContaining(kind, now), steps); }
  }
  // A month by its name, with its year or the latest one that has begun.
  for (let i = 0; i < words.length; i++) {
    const month = MONTHS.indexOf(words[i]) >= 0 ? MONTHS.indexOf(words[i]) : MONTHS_EN.indexOf(words[i]);
    if (month < 0) continue;
    let year = y;
    let used = 1;
    const next = words[i + 1] === 'de' || words[i + 1] === 'del' ? i + 2 : i + 1;
    if (/^(19|20)\d\d$/.test(words[next] ?? '')) { year = Number(words[next]); used = next - i + 1; }
    else if (month + 1 > m) year -= 1;
    take(i, used);
    return periodContaining('month', new Date(Date.UTC(year, month, 1)));
  }
  const day = at(['hoy']) >= 0 ? 0 : at(['today']) >= 0 ? 0 : at(['ayer']) >= 0 || at(['yesterday']) >= 0 ? -1 : null;
  if (day !== null) return shiftPeriod(periodContaining('day', now), day);
  return null;
}

interface Places {
  hits: { ids: number[]; at: number; length: number }[];
  productEnds: { at: number; product: PhraseProduct }[];
  productsAt: Map<number, PhraseProduct[]>;
  /** Accounts a word could mean, when it means more than one. */
  choices: number[];
}

/** Words of a product's name that say nothing on their own: "la cuenta". */
const PRODUCT_GENERIC = new Set(['cuenta', 'cuentas', 'de', 'del', 'la', 'el', 'los', 'las', 'mi', 'mis', 'y', 'en',
  'para', 'con', 'producto', 'account', 'my', 'the', 'of']);

/**
 * The accounts and products the sentence names, marking their words used.
 * `relaxed`: a name counts with nothing in front ("pasé 200 ahorros"), as in
 * a transfer, where dictation drops the "a"; otherwise only when said as a
 * place ("con la", "desde", "a"), so "un viaje" stays a trip.
 */
function placesIn(tokens: Token[], ctx: PhraseContext, relaxed: boolean): Places {
  const accountWords = new Set(ctx.accounts.flatMap(a => wordsOf(a.name)));
  const productHits = namesIn(tokens, ctx.products, p => p.name, PRODUCT_GENERIC)
    .filter(f => relaxed || saidAsPlace(tokens, f.at))
    .filter(f => f.length > 1 || wordsOf(f.item.name).length === 1 || !accountWords.has(tokens[f.at].word));
  for (const f of productHits) for (let k = 0; k < f.length; k++) tokens[f.at + k].used = true;

  // Accounts: learned words first ("la rappi"), then their names.
  const hits: Places['hits'] = [];
  for (const [phrase, id] of Object.entries(ctx.learned.accounts)) {
    if (!ctx.accounts.some(a => a.id === id)) continue;
    const at = findRun(tokens, phrase.split(' '));
    if (at >= 0) hits.push({ ids: [id], at, length: phrase.split(' ').length });
  }
  const named = namesIn(tokens, ctx.accounts, a => a.name).filter(f => relaxed || saidAsPlace(tokens, f.at));
  for (const f of named) {
    if (hits.some(h => h.at === f.at)) continue;
    const same = named.filter(o => o.at === f.at).map(o => o.item.id);
    hits.push({ ids: same, at: f.at, length: f.length });
  }
  hits.sort((a, b) => a.at - b.at);
  for (const hit of hits) for (let k = 0; k < hit.length; k++) tokens[hit.at + k].used = true;
  const namedAccounts = new Set(hits.flatMap(h => h.ids));

  // Each place a product was named: the one product, or, when the name is in
  // several accounts, the one in an account the sentence also names - or,
  // failing that, the only one in the account a single name pointed at.
  // A product's words may also be part of a longer name: "bolsillo" is Plata's
  // "Bolsillo" and Rappi's "Bolsillo Principal". With the account said, the
  // product in it wins over the one whose name is exactly those words.
  const productsAt = new Map<number, PhraseProduct[]>();
  const wider = new Map<number, PhraseProduct[]>();
  for (const f of productHits) {
    productsAt.set(f.at, [...(productsAt.get(f.at) ?? []), f.item]);
    const said = tokens.slice(f.at, f.at + f.length).map(t => t.word).filter(w => !PRODUCT_GENERIC.has(w));
    if (said.length === 0) continue;
    const also = ctx.products.filter(p => {
      const words = wordsOf(p.name);
      return said.every(w => words.includes(w));
    });
    wider.set(f.at, [...new Set([...(wider.get(f.at) ?? []), ...also])]);
  }
  const productEnds: Places['productEnds'] = [];
  for (const [at, list] of productsAt) {
    const all = [...new Set([...list, ...(wider.get(at) ?? [])])];
    const inNamed = all.filter(p => namedAccounts.has(p.accountId));
    const pick = inNamed.length === 1 ? inNamed : list.length === 1 ? list : [];
    if (pick.length === 1) productEnds.push({ at, product: pick[0] });
  }
  productEnds.sort((a, b) => a.at - b.at);
  return { hits, productEnds, productsAt, choices: [] };
}

interface End { at: number; account: number; product: number | null; dir: 'to' | 'from' | 'none' }

/** Words that say money arrives there, or leaves from there. */
const INTO = new Set(['a', 'al', 'hacia', 'para', 'hasta', 'to', 'into', 'towards']);
const OUT_OF = new Set(['de', 'del', 'desde', 'entre', 'con', 'por', 'from', 'between', 'with', 'out', 'of']);

/**
 * The places as ends of a movement, each with the way money goes by the word
 * before it. The account a named product is in only says where it is.
 */
function endsOf(tokens: Token[], places: Places, ctx: PhraseContext): End[] {
  const dirOf = (at: number): End['dir'] => {
    let i = at - 1;
    while (i >= 0 && ARTICLES.has(tokens[i].word)) i--;
    const w = tokens[i]?.word ?? '';
    // "el pago de la tarjeta": what is paid, not where the money comes from.
    if ((w === 'de' || w === 'del') && PAY_WORD.test(tokens[i - 1]?.word ?? '')) return 'none';
    return INTO.has(w) ? 'to' : OUT_OF.has(w) ? 'from' : 'none';
  };
  const ends: End[] = places.productEnds.map(e => ({ at: e.at, account: e.product.accountId, product: e.product.id, dir: dirOf(e.at) }));
  for (const hit of places.hits) {
    if (hit.ids.some(id => ends.some(e => e.account === id && e.product !== null))) continue;
    if (hit.ids.length !== 1) { places.choices = hit.ids; continue; }
    ends.push({ at: hit.at, account: hit.ids[0], product: null, dir: dirOf(hit.at) });
  }
  void ctx;
  // One place said in two pieces ("bolsillo ... viajes") is one end, with the
  // first way that was said.
  const one: End[] = [];
  for (const e of ends.sort((a, b) => a.at - b.at)) {
    const same = one.find(o => o.account === e.account && o.product === e.product);
    if (!same) one.push(e);
    else if (same.dir === 'none') same.dir = e.dir;
  }
  return one;
}

/** A card named as what is paid - "pagué la tarjeta", "abono a la Visa" -, not what pays. */
function paidCard(end: End, ctx: PhraseContext): boolean {
  return end.product === null && end.dir !== 'from'
    && ctx.accounts.find(a => a.id === end.account)?.type === 'credit';
}

export function readPhrase(text: string, ctx: PhraseContext): Reading {
  const folded = fold(text).replace(/[¿?¡!]/g, ' ');
  const tokens = tokensOf(text);
  const amount = amountIn(tokens);
  const day = dayIn(tokens, ctx.today);
  const phraseKey = keyOf(tokens);

  // Words that belong to a name are no verb: "Ahorro Verde" is an account.
  const nameWords = new Set([...ctx.accounts.map(a => a.name), ...ctx.products.map(p => p.name)].flatMap(wordsOf));
  const said = (test: RegExp) => tokens.some(t => !t.used && !nameWords.has(t.word) && test.test(t.word));
  const cameIn = (() => {
    const m = CAME_IN.exec(folded);
    return !!m && (TRANSFER_WORD.test(m[1]) || PAY_WORD.test(m[1]) || /^(?:dier|deposit|consign|gir|abon)/.test(m[1]));
  })();

  let intent: Intent;
  let side: Side | null = null;
  if (has(folded, HOW_GOALS)) intent = 'howGoals';
  else if (amount && has(folded, PAY_MORE)) intent = 'payMore';
  else if (has(folded, PAY_FIRST)) intent = 'payFirst';
  else if (has(folded, AFFORD) && amount) intent = 'afford';
  else if (has(folded, PER_DAY) || has(folded, FREE_NOW) || (!amount && has(folded, AFFORD))) intent = 'perDay';
  else if (!amount && has(folded, DUE)) intent = 'due';
  else if (!amount && has(folded, DEBTS)) intent = 'debts';
  else if (!amount && has(folded, PLANS)) intent = 'plans';
  else if (has(folded, SPENT_IN) && !amount) intent = 'spentIn';
  else if (!amount && has(folded, TOP_SPENDING)) intent = 'topSpending';
  else if (!amount && has(folded, HOW_AM_I)) intent = 'howAmI';
  else if (!amount && has(folded, HAVE)) intent = 'have';
  else if (amount && cameIn && !has(folded, EXPENSE)) { intent = 'register'; side = 'income'; }
  else if (amount && said(TRANSFER_WORD) && !has(folded, EXPENSE)) { intent = 'register'; side = 'transfer'; }
  else if (amount && has(folded, INCOME) && !has(folded, EXPENSE)) { intent = 'register'; side = 'income'; }
  else if (amount && has(folded, EXPENSE)) { intent = 'register'; side = 'expense'; }
  else if (amount) intent = 'unsure';
  else intent = 'unknown';
  if (intent === 'afford') side = 'expense';

  // Whatever the verb, two of one's own places with money between them is a
  // transfer: "pagué la tarjeta desde Bancolombia", "200 mil del bolsillo a
  // la cuenta". So is paying a card with no other place said.
  if (amount && (intent === 'register' || intent === 'unsure') && side !== 'transfer') {
    const probe = tokens.map(t => ({ ...t }));
    const ends = endsOf(probe, placesIn(probe, ctx, true), ctx);
    const distinct = new Set(ends.map(e => `${e.account}:${e.product ?? ''}`));
    if (distinct.size >= 2 && ends.some(e => e.dir !== 'none')) { intent = 'register'; side = 'transfer'; }
    else if (side === 'expense' && said(PAY_WORD) && ends.some(e => paidCard(e, ctx))) { intent = 'register'; side = 'transfer'; }
  }

  const period = periodIn(tokens, ctx.today);
  const transfer = side === 'transfer';
  const found = placesIn(tokens, ctx, transfer);
  const { hits, productEnds, productsAt } = found;

  let accountId: number | null = null;
  let toAccountId: number | null = null;
  let accountChoices: number[] = [];
  let productId: number | null = null;
  let fromProductId: number | null = null;
  let toProductId: number | null = null;

  if (transfer) {
    const ends = endsOf(tokens, found, ctx);
    accountChoices = found.choices;
    let from = ends.find(e => e.dir === 'from') ?? null;
    let to = ends.find(e => e.dir === 'to' && e !== from) ?? null;
    const rest = ends.filter(e => e !== from && e !== to);
    rest.forEach((e, i) => {
      const more = i < rest.length - 1;
      if (!from && (to || more)) from = e;
      else if (!to) to = e;
      else if (!from) from = e;
    });
    // "Pagué la tarjeta": the card is where the money goes, whatever the order.
    const card = said(PAY_WORD) ? ends.find(e => paidCard(e, ctx)) ?? null : null;
    if (card && to !== card) {
      if (from === card) from = to && to !== card ? to : null;
      to = card;
      if (!from) from = ends.find(e => e !== card && e.account !== card.account) ?? null;
    }
    // A product alone: the money moves inside its account.
    if (to && !from && to.product !== null) from = { at: -1, account: to.account, product: null, dir: 'from' };
    if (from && !to && from.product !== null) to = { at: -1, account: from.account, product: null, dir: 'to' };
    // Cash taken out with nowhere said: the one cash account, when there is one.
    if (from && !to && said(CASH_OUT_WORD)) {
      const cash = ctx.accounts.filter(a => a.type === 'cash' && a.id !== from!.account);
      if (cash.length === 1) to = { at: -1, account: cash[0].id, product: null, dir: 'to' };
    }
    accountId = from?.account ?? null;
    toAccountId = to?.account ?? null;
    fromProductId = from?.product ?? null;
    toProductId = to?.product ?? null;
  } else {
    const product = productEnds.length === 1 && productsAt.size === 1 ? productEnds[0].product : null;
    if (product) { productId = product.id; accountId = product.accountId; }
    if (accountId === null && hits.length > 0) {
      if (hits[0].ids.length === 1) accountId = hits[0].ids[0];
      else accountChoices = hits[0].ids;
    }
  }

  // "¿Cuánto me queda en Nequi?": what that account holds, not the month's free money.
  if (intent === 'perDay' && accountId !== null && !has(folded, PER_DAY)) intent = 'have';

  // What is left says what it was about.
  const left = tokens.filter(t => !t.used && !FILLER.has(t.word) && !/^\d+$/.test(t.word)
    && !EXPENSE.test(t.word) && !INCOME.test(t.word) && !(side === 'transfer' && TRANSFER_WORD.test(t.word)));
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

  // Said the same way before, and saved: where it went then (only while those
  // accounts, products and category still exist).
  let fromMemory = false;
  const route = phraseKey && amount && (intent === 'register' || intent === 'unsure')
    ? ctx.learned.phrases?.[phraseKey] : undefined;
  if (route) {
    const account = (id: number | null) => id !== null && ctx.accounts.some(a => a.id === id) ? id : null;
    const product = (id: number | null, of: number | null) =>
      id !== null && ctx.products.some(p => p.id === id && p.accountId === of) ? id : null;
    const from = account(route.accountId);
    if (from !== null) {
      fromMemory = true;
      intent = 'register';
      side = route.side;
      accountId = from;
      accountChoices = [];
      if (side === 'transfer') {
        toAccountId = account(route.toAccountId);
        fromProductId = product(route.productId, from);
        toProductId = product(route.toProductId, toAccountId);
        productId = null;
        categoryId = null;
        categoryFrom = null;
      } else {
        toAccountId = null;
        fromProductId = null;
        toProductId = null;
        productId = product(route.productId, from);
        const kind = side === 'income' ? 'income' : 'expense';
        if (route.categoryId !== null && ctx.categories.some(c => c.id === route.categoryId && c.kind === kind)) {
          categoryId = route.categoryId;
          categoryFrom = 'learned';
        } else if (categoryId !== null && ctx.categories.find(c => c.id === categoryId)?.kind !== kind) {
          categoryId = null;
          categoryFrom = null;
        }
      }
    }
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
    accountId, accountChoices, toAccountId, productId, fromProductId, toProductId,
    categoryId, categoryFrom, thing, shape, period, phraseKey, fromMemory,
  };
}

/**
 * A sentence as a key: its words once the amount and the day are taken out,
 * so "50 mil" and "200 mil" said the same way are one sentence.
 */
function keyOf(tokens: Token[]): string | null {
  const words = tokens.filter(t => !t.used && !/^\d+$/.test(t.word)).map(t => t.word);
  return words.length > 0 ? words.join(' ') : null;
}

