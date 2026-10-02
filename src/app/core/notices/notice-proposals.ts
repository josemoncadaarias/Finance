/**
 * From a bank's message to a proposal waiting in "Movimientos por revisar".
 *
 * Pure: what the phone kept, what was already proposed, and what the person
 * answered before go in; the proposals come out. Rule 22 - a proposal is not
 * a movement until a person says so.
 *
 * **The app learns from the person, and from nothing else** (Jose,
 * 2026-10-02: "toda la ayuda posible para que la app pueda aprender lo que el
 * usuario va registrando"). Nothing here names a bank:
 *
 *   - **Which account**: what the person answered for earlier messages of the
 *     same app - with the same card digits first, then the app alone when it
 *     only ever meant one account. Before any answer, an account whose own
 *     name carries the app's name or the card's digits ("Nequi", "Visa
 *     1234"), when exactly one does. Otherwise it is asked.
 *   - **Which category**: the proposals repository already answers that from
 *     what this person filed the same shop under (and teaches itself on every
 *     save), so it is not repeated here.
 *   - **What it says** is read by `readNotice`, by shape, for anybody.
 */

import type { AccountRow, IsoDate } from '../database/types';
import type { NewProposal } from '../database/repositories/proposals.repository';
import { foldText } from '../text/fold-text';
import { readNotice, type NoticeReading } from './read-notice';

/** One message as the phone kept it. */
export interface KeptNotice {
  package: string;
  app: string;
  title: string;
  text: string;
  postedAt: number;
}

/** What the person answered for an earlier message: the account it went to. */
export interface NoticeAnswer {
  package: string;
  digits: string | null;
  account_id: number;
}

/** The evidence a proposal from a message keeps, never thrown away. */
export interface NoticeEvidence {
  kind: 'notification';
  key: string;
  package: string;
  app: string;
  /** Shown as where the batch came from, like a statement's file. */
  file: string;
  title: string;
  text: string;
  postedAt: number;
  digits: string | null;
  balanceMinor: number | null;
  currency: string | null;
  /** 'low' when the message did not say whether money came in or went out. */
  confidence: 'low' | null;
  /** How the account was chosen, to say so on screen. */
  accountFrom: 'learned' | 'name' | null;
}

/** The same message, whenever it is read: the app, when, and what it said. */
export function noticeKey(notice: KeptNotice): string {
  return `${notice.package}|${notice.postedAt}|${notice.text.length}`;
}

/** Proposals from one app share a batch: one card per app on the review screen. */
export function noticeBatch(pkg: string): string {
  return `notice:${pkg}`;
}

/** A day in the phone's own time zone. */
function localDay(at: number): IsoDate {
  const d = new Date(at);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` as IsoDate;
}

/** Words in a name that never tell one bank from another. */
const PLAIN = new Set([
  'banco', 'bank', 'app', 'apps', 'mobile', 'movil', 'cuenta', 'cuentas', 'ahorro', 'ahorros', 'tarjeta',
  'credito', 'debito', 'card', 'pay', 'digital', 'mensajes', 'messages', 'sms', 'online', 'financiera',
]);

function wordsOf(text: string): string[] {
  return foldText(text).split(/[^a-z0-9]+/).filter(word => word.length >= 3 && !PLAIN.has(word));
}

/**
 * Which account a message is about, or null to ask.
 *
 * What the person answered before always wins over a name that looks alike.
 */
export function accountFor(
  notice: KeptNotice,
  reading: NoticeReading,
  answers: readonly NoticeAnswer[],
  accounts: readonly AccountRow[],
): { accountId: number | null; from: 'learned' | 'name' | null } {
  const open = accounts.filter(account => !account.archived);
  const alive = new Set(open.map(account => account.id));
  const mine = answers.filter(answer => answer.package === notice.package && alive.has(answer.account_id));

  // Learned: the same app and the same card digits.
  if (reading.digits) {
    const same = mostOf(mine.filter(answer => answer.digits === reading.digits).map(answer => answer.account_id));
    if (same !== null) return { accountId: same, from: 'learned' };
  }
  // Learned: the accounts this app's messages went to, leaving out answers
  // that named other card digits. One account is an answer; several, a question.
  if (mine.length > 0) {
    const fitting = mine.filter(answer => !answer.digits || !reading.digits || answer.digits === reading.digits);
    const ever = [...new Set(fitting.map(answer => answer.account_id))];
    return ever.length === 1 ? { accountId: ever[0], from: 'learned' } : { accountId: null, from: null };
  }

  // Before any answer: the digits written in an account's own name.
  const byCurrency = reading.currency
    ? open.filter(account => account.currency_code === reading.currency)
    : open;
  const pool = byCurrency.length ? byCurrency : open;
  if (reading.digits) {
    const named = pool.filter(account => account.name.includes(reading.digits!));
    if (named.length === 1) return { accountId: named[0].id, from: 'name' };
  }
  // Or the app's name in the account's: "Nequi" for the Nequi app.
  const appWords = new Set([...wordsOf(notice.app), ...wordsOf(notice.title)]);
  if (appWords.size > 0) {
    const named = pool.filter(account => wordsOf(account.name).some(word => appWords.has(word)));
    if (named.length === 1) return { accountId: named[0].id, from: 'name' };
  }
  return { accountId: null, from: null };
}

function mostOf(ids: readonly number[]): number | null {
  if (ids.length === 0) return null;
  const count = new Map<number, number>();
  for (const id of ids) count.set(id, (count.get(id) ?? 0) + 1);
  const sorted = [...count.entries()].sort((a, b) => b[1] - a[1]);
  // A tie between two accounts is a question, not an answer.
  return sorted.length > 1 && sorted[0][1] === sorted[1][1] ? null : sorted[0][0];
}

/**
 * The proposals the kept messages make, leaving out what was proposed before.
 *
 * Only a message that moved money becomes one - a code, an offer, a
 * reminder, a refused purchase or a balance alone does not. Android re-posts
 * a notification when it is updated, so the same app saying the same thing
 * within three minutes is read once.
 */
export function proposalsFrom(
  kept: readonly KeptNotice[],
  known: ReadonlySet<string>,
  answers: readonly NoticeAnswer[],
  accounts: readonly AccountRow[],
): { batch: string; proposal: NewProposal }[] {
  const out: { batch: string; proposal: NewProposal }[] = [];
  const recent = new Map<string, number>();
  for (const notice of [...kept].sort((a, b) => a.postedAt - b.postedAt)) {
    const key = noticeKey(notice);
    const said = `${notice.package}|${notice.title}|${notice.text}`;
    const before = recent.get(said);
    recent.set(said, notice.postedAt);
    if (before !== undefined && notice.postedAt - before < 3 * 60_000) continue;
    if (known.has(key)) continue;

    const arrived = localDay(notice.postedAt);
    const reading = readNotice(notice.text, notice.title, arrived);
    if (reading.kind !== 'movement' && reading.kind !== 'unclear') continue;
    if (reading.amountMinor === null) continue;

    const { accountId, from } = accountFor(notice, reading, answers, accounts);
    const signed = reading.direction === 'in' ? reading.amountMinor : -reading.amountMinor;
    const evidence: NoticeEvidence = {
      kind: 'notification',
      key,
      package: notice.package,
      app: notice.app,
      file: notice.app,
      title: notice.title,
      text: notice.text,
      postedAt: notice.postedAt,
      digits: reading.digits,
      balanceMinor: reading.balanceMinor,
      currency: reading.currency,
      confidence: reading.direction === null ? 'low' : null,
      accountFrom: from,
    };
    out.push({
      batch: noticeBatch(notice.package),
      proposal: {
        source: 'notification',
        account_id: accountId,
        // A date written in the message wins; a future one is not believed.
        occurred_on: reading.date && reading.date <= arrived ? reading.date : arrived,
        amount_minor: signed,
        description: reading.merchant || null,
        evidence,
      },
    });
  }
  return out;
}
