/**
 * A question that goes on from the one before it (Jose, 2026-11-06, mockups
 * `55a`-`55g`): "¿y el mes pasado?", "¿y en mercado?", "¿y en total?",
 * "¿por qué?", "y 12 mil en la panadería", "con la Coral". What the sentence
 * does not say is taken from the last question; what it says replaces it.
 *
 * Pure, like `read-phrase.ts`: the sentence's own reading and what was asked
 * before come in, and what to answer comes out, with each piece saying
 * whether it was said now or taken from before - the screen says the whole
 * question it understood, so the person always knows what was answered.
 *
 * Nothing is guessed across topics: a sentence that is a whole question of
 * its own is that question, and a follow-up that cannot be placed is asked
 * back rather than answered.
 */

import type { Period } from '../filters/period';
import { fold, type Intent, type Reading, type Side } from './read-phrase';

/** The questions a follow-up can go on from. */
export const FOLLOWABLE: ReadonlySet<Intent> = new Set<Intent>([
  'spentIn', 'howAmI', 'topSpending', 'biggest', 'whyMore', 'yields', 'have', 'paid', 'income',
]);

/** What a question or a movement asked, kept to answer the next sentence. */
export interface Asked {
  intent: Intent;
  /** The question as it was typed, offered back when a follow-up is not clear. */
  said: string;
  /** "¿Cuánto llevo en...?": one category, or several added together. */
  categoryIds: number[];
  accountId: number | null;
  /** Null: the month that is running. */
  period: Period | null;
  /** A movement registered: its side and day, for "y 12 mil en la panadería". */
  side?: Side | null;
  onDate?: string;
}

export type PieceKind = 'question' | 'category' | 'period' | 'account' | 'day';

/** One piece of the question understood, and where it came from. */
export interface Piece {
  what: PieceKind;
  from: 'before' | 'now';
}

export type FollowUp =
  /** Not a follow-up: the sentence is answered on its own. */
  | { kind: 'none' }
  /** A question completed with what was asked before. */
  | { kind: 'ask'; asked: Asked; pieces: Piece[] }
  /** Another movement like the last one: its account and day unless said. */
  | { kind: 'register'; reading: Reading; pieces: Piece[] }
  /** "Con la Coral": the last movement not saved yet moves to that account. */
  | { kind: 'moveTo'; accountId: number }
  /** It goes on from something, and nothing says from what. */
  | { kind: 'unclear' };

const OPENER = /^(y|e|and|tambien|also)\b/;
const WHY = /^(y\s+)?(eso\s+)?(por ?que|why)(\s+(fue|paso|sera|subio|tanto))?$/;
const TOGETHER = /\b(juntos|juntas|sumados|sumadas|los dos|las dos|ambos|ambas|together|both|combined)\b/;
const ALL = /\b(total|todas (mis |las )?cuentas|todo junto|all (my )?accounts|everything|overall)\b/;
/** Up to this many words, a sentence that understands nothing may go on from the last one. */
const SHORT = 6;

function clean(text: string): string {
  return fold(text).replace(/[¿?¡!.,;:]/g, ' ').replace(/\s+/g, ' ').trim();
}

function understood(reading: Reading): boolean {
  return reading.intent !== 'unknown' && reading.intent !== 'unsure';
}

/**
 * What the sentence asks, read with the questions before it (`history`, the
 * newest first). `fresh` is the sentence's own reading.
 */
export function followUp(text: string, fresh: Reading, history: readonly Asked[]): FollowUp {
  const last = history[0];
  if (!last) return { kind: 'none' };
  const said = clean(text);
  const opener = OPENER.test(said);
  const words = said.split(' ').filter(Boolean).length;

  // "¿Por qué?" after a summary: why the spending moved, over the same period.
  if (WHY.test(said)) {
    if (!['howAmI', 'spentIn', 'topSpending', 'biggest', 'whyMore', 'paid'].includes(last.intent)) return { kind: 'none' };
    return {
      kind: 'ask',
      asked: { intent: 'whyMore', said: text, categoryIds: [], accountId: null, period: last.period },
      pieces: [{ what: 'question', from: 'now' }, { what: 'period', from: 'before' }],
    };
  }

  // "¿Y los dos juntos?": the two categories asked one after the other, added.
  if (TOGETHER.test(said) && last.intent === 'spentIn') {
    const before = history.slice(1).find(h => h.intent === 'spentIn' && samePeriod(h.period, last.period));
    const ids = [...new Set([...(before?.categoryIds ?? []), ...last.categoryIds])];
    if (ids.length >= 2) {
      return {
        kind: 'ask',
        asked: { intent: 'spentIn', said: text, categoryIds: ids, accountId: null, period: last.period },
        pieces: [{ what: 'question', from: 'before' }, { what: 'category', from: 'before' }, { what: 'period', from: 'before' }],
      };
    }
  }

  if (!opener && (words > SHORT || understood(fresh))) return { kind: 'none' };
  // A whole question of its own is that question: "y ¿cuánto debo?".
  if (understood(fresh) && fresh.intent !== 'register' && fresh.intent !== last.intent) return { kind: 'none' };

  // Another movement like the one before.
  if (last.intent === 'register') {
    if (fresh.amountMinor !== null && (fresh.intent === 'register' || fresh.intent === 'unsure' || fresh.intent === 'unknown')) {
      if (fresh.side === 'transfer') return { kind: 'none' };
      const accountId = fresh.accountId ?? (fresh.accountChoices.length > 0 ? null : last.accountId ?? null);
      // "hoy" leaves no word of its own in the reading: the sentence says it.
      const daySaid = fresh.dayWord !== null || /\b(hoy|today)\b/.test(said);
      const onDate = daySaid ? fresh.onDate : last.onDate ?? fresh.onDate;
      return {
        kind: 'register',
        reading: { ...fresh, intent: 'register', side: fresh.side ?? last.side ?? 'expense', accountId, onDate },
        pieces: [
          { what: 'account', from: fresh.accountId !== null ? 'now' : 'before' },
          { what: 'day', from: daySaid ? 'now' : 'before' },
        ],
      };
    }
    if (fresh.amountMinor === null && fresh.accountId !== null && !understood(fresh)) {
      return { kind: 'moveTo', accountId: fresh.accountId };
    }
    return opener ? { kind: 'unclear' } : { kind: 'none' };
  }

  // After a question that has no pieces to change ("¿qué pagos tengo?"), "¿y el
  // otro?" is asked back; an amount is a movement of its own.
  if (!FOLLOWABLE.has(last.intent)) return opener && fresh.amountMinor === null ? { kind: 'unclear' } : { kind: 'none' };

  const all = ALL.test(said);
  const category = fresh.categoryId;
  const period = fresh.period;
  const account = fresh.accountId;
  if (category === null && period === null && account === null && !all) {
    return opener ? { kind: 'unclear' } : { kind: 'none' };
  }

  let intent = last.intent;
  // "¿Y en mercado?" after "¿cómo voy?": what went to that category, that period.
  if (category !== null && intent !== 'spentIn') intent = 'spentIn';
  // An account means something only to what one account holds or earned.
  const byAccount = intent === 'have' || intent === 'yields';
  if ((account !== null || all) && !byAccount && category === null && period === null) {
    return opener ? { kind: 'unclear' } : { kind: 'none' };
  }
  const categoryIds = intent === 'spentIn' ? (category !== null ? [category] : last.categoryIds) : [];
  if (intent === 'spentIn' && categoryIds.length === 0) return { kind: 'unclear' };

  const pieces: Piece[] = [{ what: 'question', from: intent === last.intent ? 'before' : 'now' }];
  if (intent === 'spentIn') pieces.push({ what: 'category', from: category !== null ? 'now' : 'before' });
  if (intent !== 'have') pieces.push({ what: 'period', from: period !== null ? 'now' : 'before' });
  if (byAccount) pieces.push({ what: 'account', from: account !== null || all ? 'now' : 'before' });
  return {
    kind: 'ask',
    asked: {
      intent,
      said: text,
      categoryIds,
      accountId: byAccount ? (all ? null : account ?? last.accountId) : null,
      period: period ?? (intent === 'have' ? null : last.period),
    },
    pieces,
  };
}

function samePeriod(a: Period | null, b: Period | null): boolean {
  return (a?.from ?? null) === (b?.from ?? null) && (a?.to ?? null) === (b?.to ?? null);
}
