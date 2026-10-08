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
 *
 * **An SMS is its sender's, not its app's** (Jose, 2026-10-02): a message
 * kept from a messaging app carries who sent it, and everything above - the
 * batch, the account learned, the name matched - is about that sender inside
 * that app. Two banks texting through the same messaging app are two sources.
 */

import type { AccountRow, IsoDate } from '../database/types';
import type { NewProposal } from '../database/repositories/proposals.repository';
import { merchantKeyOf } from '../proposals/merchant';
import { foldText } from '../text/fold-text';
import { readNotice, type NoticeReading } from './read-notice';
import { readWithMolds, type Mold } from './molds';

/** One message as the phone kept it. */
export interface KeptNotice {
  package: string;
  app: string;
  title: string;
  text: string;
  postedAt: number;
  /** Who sent it, for a message of a messaging app. */
  sender?: string;
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
  /** The source: an app's package, or `package|sender` for a message. */
  package: string;
  app: string;
  /** Who sent it, for a message of a messaging app. */
  sender: string | null;
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
  /** True when a mold the person taught read it (amount, shop, direction). */
  molded?: boolean;
  /**
   * The person saved this shape of message as a transfer before: the
   * account at the other end, so it is proposed as a transfer again.
   */
  transferTo?: number | null;
  /**
   * The other messages that reported this same movement - an SMS and the
   * bank app's own notification of one purchase - each kept whole, so the
   * proposal can be split back into them ("Separar").
   */
  sightings?: Sighting[];
  /**
   * A message from another source that may be this same movement but did not
   * prove it (same amount, minutes apart, nothing else to go on): the screen
   * asks rather than merging. Where it came from and when.
   */
  twin?: { key: string; file: string; postedAt: number } | null;
}

/** One message folded into another's proposal, with what it alone would have proposed. */
export interface Sighting {
  evidence: NoticeEvidence;
  account_id: number | null;
  occurred_on: IsoDate;
  amount_minor: number;
  description: string | null;
}

/** A proposal already made from a message, for a later one to join. */
export interface RecentNotice {
  id: number;
  account_id: number | null;
  amount_minor: number | null;
  description: string | null;
  evidence: NoticeEvidence;
}

/** A later message joining a proposal already written. */
export interface Joining {
  id: number;
  sightings: Sighting[];
  /** An account the later message knew and the proposal did not. */
  accountId: number | null;
}

/**
 * How far apart two sources may report one movement. A bank's push and its
 * SMS land within a minute or two; some SMS gateways take several.
 */
export const SAME_MOVEMENT_WINDOW = 20 * 60_000;

/** The same message, whenever it is read: the app, when, and what it said. */
export function noticeKey(notice: KeptNotice): string {
  return `${noticeSource(notice)}|${notice.postedAt}|${notice.text.length}`;
}

/** Where a message came from: its app, or its sender inside a messaging app. */
export function noticeSource(notice: Pick<KeptNotice, 'package' | 'sender'>): string {
  return notice.sender ? `${notice.package}|${notice.sender}` : notice.package;
}

/** Proposals from one source share a batch: one card per app or sender on the review screen. */
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
  assigned: ReadonlyMap<string, number> = new Map(),
): { accountId: number | null; from: 'learned' | 'name' | null } {
  const open = accounts.filter(account => !account.archived);
  const alive = new Set(open.map(account => account.id));
  const source = noticeSource(notice);
  const mine = answers.filter(answer => answer.package === source && alive.has(answer.account_id));

  // Learned: the same app and the same card digits.
  if (reading.digits) {
    const same = mostOf(mine.filter(answer => answer.digits === reading.digits).map(answer => answer.account_id));
    if (same !== null) return { accountId: same, from: 'learned' };
  }
  // Signed by the bank: several banks text through one short code (899979
  // carries Rappi's and Bold's), and each starts its message with its own
  // name - "BoldCF: Realizaste...". The first word naming exactly one
  // account says whose it is, ahead of what the short code meant before
  // (Jose, 2026-10-08). Only the first word: a name later on is usually
  // where the money went ("Transferiste a Nequi").
  const signed = signedBy(notice.text, open);
  if (signed !== null) return { accountId: signed, from: 'name' };
  // Said by the person on the notifications screen: "this sender is Ualá".
  const told = assigned.get(source);
  if (told !== undefined && alive.has(told)) return { accountId: told, from: 'learned' };
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
  // Or the app's name in the account's: "Nequi" for the Nequi app - or, for
  // a message, the sender's: "Bancolombia" texting through Mensajes.
  const appWords = new Set(notice.sender
    ? wordsOf(notice.sender)
    : [...wordsOf(notice.app), ...wordsOf(notice.title)]);
  if (appWords.size > 0) {
    const named = pool.filter(account => wordsOf(account.name).some(word => appWords.has(word)));
    if (named.length === 1) return { accountId: named[0].id, from: 'name' };
  }
  return { accountId: null, from: null };
}

/** The account whose name the message's first word starts with, when only one. */
export function signedBy(text: string, accounts: readonly AccountRow[]): number | null {
  // The first word with letters, among the first three: a short code or a
  // date may come before the bank's name.
  const first = foldText(text).split(/[^a-z0-9]+/).filter(Boolean).slice(0, 3)
    .find(word => /[a-z]/.test(word)) ?? '';
  if (first.length < 4) return null;
  const named = accounts.filter(account =>
    wordsOf(account.name).some(word => word.length >= 4 && first.startsWith(word)));
  return named.length === 1 ? named[0].id : null;
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
 * Kept for callers that only want the new proposals.
 */
export function proposalsFrom(
  kept: readonly KeptNotice[],
  known: ReadonlySet<string>,
  answers: readonly NoticeAnswer[],
  accounts: readonly AccountRow[],
): { batch: string; proposal: NewProposal }[] {
  return readNotices(kept, known, answers, accounts).fresh;
}

/** One message read, before it is told apart from the others. */
interface Read {
  key: string;
  /** The category a mold carries, when its message names no shop. */
  categoryId: number | null;
  postedAt: number;
  source: string;
  batch: string;
  sighting: Sighting;
  direction: 'in' | 'out' | null;
}

/** A movement and every message seen reporting it. */
interface Movement {
  /** Set when the movement is a proposal already written. */
  id: number | null;
  sources: Set<string>;
  first: number;
  last: number;
  lead: Read | null;
  joined: Sighting[];
  account: number | null;
  amount: number;
  direction: 'in' | 'out' | null;
  digits: string | null;
  currency: string | null;
  merchant: string;
  key: string;
  file: string;
}

/**
 * What the kept messages make: new proposals, and later messages joining a
 * proposal already written.
 *
 * Only a message that moved money becomes one - a code, an offer, a
 * reminder, a refused purchase or a balance alone does not. Android re-posts
 * a notification when it is updated, so the same app saying the same thing
 * within three minutes is read once.
 *
 * **One movement, several messages** (Jose, 2026-10-08: an Ualá purchase
 * arrives as an SMS and as the Ualá app's notification). Two messages are one
 * movement when they come from DIFFERENT sources, within
 * `SAME_MOVEMENT_WINDOW`, for the same amount to the cent, nothing they both
 * state disagrees (direction, currency, card digits, account), and
 * something besides the amount agrees: the same shop, the same card digits
 * or the same account. A source never reports one movement twice, so two
 * messages of one source are two movements - a real second identical
 * purchase stays two proposals. Where only the amount and the minute agree,
 * or the shops read differently, the later one is proposed apart with the
 * other named as a possible twin:
 * the person decides, the app never drops it silently.
 */
export function readNotices(
  kept: readonly KeptNotice[],
  known: ReadonlySet<string>,
  answers: readonly NoticeAnswer[],
  accounts: readonly AccountRow[],
  recent: readonly RecentNotice[] = [],
  learned: { molds?: readonly Mold[]; assigned?: ReadonlyMap<string, number> } = {},
): { fresh: { batch: string; proposal: NewProposal }[]; joining: Joining[] } {
  const molds = learned.molds ?? [];
  const assigned = learned.assigned ?? new Map<string, number>();
  const reads: Read[] = [];
  const repeat = new Map<string, number>();
  for (const notice of [...kept].sort((a, b) => a.postedAt - b.postedAt)) {
    const key = noticeKey(notice);
    const said = `${noticeSource(notice)}|${notice.title}|${notice.text}`;
    const before = repeat.get(said);
    repeat.set(said, notice.postedAt);
    if (before !== undefined && notice.postedAt - before < 3 * 60_000) continue;
    if (known.has(key)) continue;

    const arrived = localDay(notice.postedAt);
    let reading = readNotice(notice.text, notice.title, arrived);
    // What the person taught for this source reads it first, and exactly.
    const molded = readWithMolds(noticeSource(notice), notice.text, molds);
    if (molded) {
      reading = {
        ...reading, kind: 'movement', amountMinor: molded.amountMinor, direction: molded.direction,
        merchant: molded.merchant || reading.merchant,
      };
    }
    if (reading.kind !== 'movement' && reading.kind !== 'unclear') continue;
    if (reading.amountMinor === null) continue;

    let { accountId, from } = accountFor(notice, reading, answers, accounts, assigned);
    if (accountId === null && molded?.accountId != null && accounts.some(a => a.id === molded.accountId && !a.archived)) {
      accountId = molded.accountId;
      from = 'learned';
    }
    const signed = reading.direction === 'in' ? reading.amountMinor : -reading.amountMinor;
    const evidence: NoticeEvidence = {
      kind: 'notification',
      key,
      package: noticeSource(notice),
      app: notice.app,
      sender: notice.sender ?? null,
      file: notice.sender ? `${notice.sender} · ${notice.app}` : notice.app,
      title: notice.title,
      text: notice.text,
      postedAt: notice.postedAt,
      digits: reading.digits,
      balanceMinor: reading.balanceMinor,
      currency: reading.currency,
      confidence: reading.direction === null ? 'low' : null,
      accountFrom: from,
      ...(molded ? { molded: true } : {}),
      ...(molded?.otherAccountId != null && accounts.some(a => a.id === molded.otherAccountId && !a.archived)
        ? { transferTo: molded.otherAccountId } : {}),
    };
    reads.push({
      key,
      postedAt: notice.postedAt,
      source: noticeSource(notice),
      batch: noticeBatch(noticeSource(notice)),
      direction: reading.direction,
      categoryId: molded?.categoryId ?? null,
      sighting: {
        evidence,
        account_id: accountId,
        // A date written in the message wins; a future one is not believed.
        occurred_on: reading.date && reading.date <= arrived ? reading.date : arrived,
        amount_minor: signed,
        description: reading.merchant || null,
      },
    });
  }

  const movements: Movement[] = recent
    .filter(one => one.amount_minor !== null && typeof one.evidence?.postedAt === 'number')
    .map(one => {
      const all = [one.evidence, ...(one.evidence.sightings ?? []).map(s => s.evidence)];
      const times = all.map(e => e.postedAt);
      return {
        id: one.id,
        sources: new Set(all.map(e => e.package)),
        first: Math.min(...times),
        last: Math.max(...times),
        lead: null,
        joined: [],
        account: one.account_id,
        amount: Math.abs(one.amount_minor!),
        direction: one.evidence.confidence === 'low' ? null : one.amount_minor! > 0 ? 'in' : 'out',
        digits: one.evidence.digits ?? null,
        currency: one.evidence.currency ?? null,
        merchant: merchantKeyOf(one.description),
        key: one.evidence.key,
        file: one.evidence.file,
      };
    });

  const fresh: Movement[] = [];
  for (const read of reads) {
    const s = read.sighting;
    const merchant = merchantKeyOf(s.description);
    let best: Movement | null = null;
    let twin: Movement | null = null;
    for (const movement of movements) {
      if (movement.sources.has(read.source)) continue;
      if (read.postedAt - movement.last > SAME_MOVEMENT_WINDOW || movement.first - read.postedAt > SAME_MOVEMENT_WINDOW) continue;
      if (movement.amount !== Math.abs(s.amount_minor)) continue;
      const verdict = alike(movement, {
        direction: read.direction, currency: s.evidence.currency, digits: s.evidence.digits,
        account: s.account_id, merchant,
      });
      if (verdict === 'differ') continue;
      const nearer = (one: Movement | null) =>
        one === null || Math.abs(read.postedAt - movement.last) < Math.abs(read.postedAt - one.last);
      if (verdict === 'same' && nearer(best)) best = movement;
      if (verdict === 'maybe' && nearer(twin)) twin = movement;
    }

    if (best) {
      best.sources.add(read.source);
      best.last = Math.max(best.last, read.postedAt);
      best.first = Math.min(best.first, read.postedAt);
      best.joined.push(s);
      best.account ??= s.account_id;
      best.digits ??= s.evidence.digits;
      best.currency ??= s.evidence.currency;
      best.direction ??= read.direction;
      if (!best.merchant) best.merchant = merchant;
      continue;
    }
    if (twin) s.evidence.twin = { key: twin.key, file: twin.file, postedAt: twin.last };
    const movement: Movement = {
      id: null,
      sources: new Set([read.source]),
      first: read.postedAt,
      last: read.postedAt,
      lead: read,
      joined: [],
      account: s.account_id,
      amount: Math.abs(s.amount_minor),
      direction: read.direction,
      digits: s.evidence.digits,
      currency: s.evidence.currency,
      merchant,
      key: read.key,
      file: s.evidence.file,
    };
    movements.push(movement);
    fresh.push(movement);
  }

  return {
    fresh: fresh.map(movement => {
      const lead = movement.lead!;
      const s = lead.sighting;
      const joined = movement.joined;
      // The lead says it; where it said nothing, a message that joined it does.
      const description = s.description ?? joined.find(one => one.description)?.description ?? null;
      const signed = movement.direction === 'in' ? Math.abs(s.amount_minor) : -Math.abs(s.amount_minor);
      const evidence: NoticeEvidence = joined.length
        ? {
          ...s.evidence,
          digits: movement.digits,
          currency: movement.currency,
          confidence: movement.direction === null ? 'low' : null,
          accountFrom: s.account_id !== null ? s.evidence.accountFrom
            : joined.find(one => one.account_id !== null)?.evidence.accountFrom ?? null,
          sightings: joined,
        }
        : s.evidence;
      return {
        batch: lead.batch,
        proposal: {
          source: 'notification' as const,
          account_id: movement.account,
          occurred_on: s.occurred_on,
          amount_minor: signed,
          description,
          ...(lead.categoryId !== null ? { category_id: lead.categoryId } : {}),
          evidence,
        },
      };
    }),
    joining: movements
      .filter(movement => movement.id !== null && movement.joined.length > 0)
      .map(movement => ({
        id: movement.id!,
        sightings: movement.joined,
        accountId: movement.joined.find(one => one.account_id !== null)?.account_id ?? null,
      })),
  };
}

/**
 * Whether a message is the movement: 'differ' when something both state
 * disagrees, 'same' when something besides the amount agrees, 'maybe' when
 * only the amount and the minute do, or the shops read differently.
 */
function alike(
  movement: Movement,
  read: { direction: 'in' | 'out' | null; currency: string | null; digits: string | null; account: number | null; merchant: string },
): 'same' | 'maybe' | 'differ' {
  const both = <T>(a: T | null, b: T | null) => a !== null && b !== null;
  if (both(movement.direction, read.direction) && movement.direction !== read.direction) return 'differ';
  if (both(movement.currency, read.currency) && movement.currency !== read.currency) return 'differ';
  if (both(movement.digits, read.digits) && movement.digits !== read.digits) return 'differ';
  if (both(movement.account, read.account) && movement.account !== read.account) return 'differ';
  // Two wordings of one shop can share no word ("TIENDAS D1" against "D1
  // SAS"), so shops that look different are a question, never a "no".
  const shop = sameShop(movement.merchant, read.merchant);
  if (shop === false) return 'maybe';
  if (shop === true) return 'same';
  if (both(movement.digits, read.digits)) return 'same';
  if (both(movement.account, read.account)) return 'same';
  return 'maybe';
}

/** True when two shops share a word, false when both are named and share none, null when one is not named. */
function sameShop(one: string, other: string): boolean | null {
  if (!one || !other) return null;
  const words = new Set(one.split(' ').filter(word => word.length >= 3));
  const theirs = other.split(' ').filter(word => word.length >= 3);
  if (words.size === 0 || theirs.length === 0) return null;
  return theirs.some(word => words.has(word));
}
