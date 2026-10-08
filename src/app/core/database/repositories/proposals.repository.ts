/**
 * Movements the app has read and nobody has answered yet.
 *
 * A proposal is not a movement. It is what a statement or a bank's
 * notification said, kept with the evidence it was read from, until a person
 * accepts it, corrects it or throws it away. Accepting is the only thing that
 * writes to the ledger, and it goes through the ordinary repository, so a
 * movement born here is a movement like any other afterwards.
 *
 * Rule 22, and the reason it exists: an import that decides by itself is what
 * put Jose's own corrections at risk and got the old importer deleted.
 */

import type { SqlDriver } from '../sql-driver';
import type { IsoDate } from '../types';
import { merchantKeyOf, merchantSampleOf } from '../../proposals/merchant';
import { noticeBatch, type Joining, type NoticeEvidence, type RecentNotice } from '../../notices/notice-proposals';
import { learnMold, moldFrom, type Mold } from '../../notices/molds';

const MOLDS = 'notices.molds';
const SOURCE_ACCOUNTS = 'notices.sourceAccounts';
import { wordCategoryOf } from '../../proposals/common-words';
import { todayIso } from '../../yields/days';
import { sameMovementAnywhere, sameMovementAs, transferPairs, type LedgerMovement } from '../../proposals/matching';

export type ProposalSource = 'statement' | 'notification';
export type ProposalStatus = 'pending' | 'accepted' | 'rejected';

export interface MovementProposal {
  id: number;
  source: ProposalSource;
  account_id: number | null;
  occurred_on: IsoDate | null;
  amount_minor: number | null;
  description: string | null;
  category_id: number | null;
  category_from: 'learned' | 'guessed' | 'typed' | null;
  /** What it was read from, as JSON. Never thrown away. */
  evidence: string;
  status: ProposalStatus;
  transaction_id: number | null;
  maybe_same_as: number | null;
  pairs_with: number | null;
  batch: string;
}

/** What a batch of readings did. */
export interface Proposed {
  /** The ones now waiting for a person. */
  ids: number[];
  /**
   * The ones not asked about again: already on this screen from an earlier
   * import of the same statement, or already thrown away once.
   */
  knownAlready: number;
}

/** One reading, before it is written down. */
export interface NewProposal {
  source: ProposalSource;
  account_id?: number | null;
  occurred_on?: IsoDate | null;
  amount_minor?: number | null;
  description?: string | null;
  /** A category already known (a mold the person taught); the dictionary is not asked. */
  category_id?: number | null;
  evidence: unknown;
}

const COLUMNS =
  `id, source, account_id, occurred_on, amount_minor, description, category_id, category_from,
   evidence, status, transaction_id, maybe_same_as, pairs_with, batch`;

export class ProposalsRepository {
  private readonly db: SqlDriver;
  private readonly now: () => string;

  constructor(db: SqlDriver, now: () => string = () => new Date().toISOString()) {
    this.db = db;
    this.now = now;
  }

  /**
   * Writes a batch of readings, each one asked the two questions first.
   *
   * Everything happens here rather than at the call site so that a second
   * source - the notifications, when they come - gets the same treatment for
   * free: what the category probably is, whether the ledger already holds it,
   * and which of them are the two halves of one transfer.
   */
  async propose(batch: string, readings: readonly NewProposal[]): Promise<Proposed> {
    if (readings.length === 0) return { ids: [], knownAlready: 0 };
    const timestamp = this.now();

    // What this screen already holds for these accounts, whatever was decided
    // about it. Importing the same statement twice is an ordinary thing to
    // do - Jose did it within a minute of the screen existing - and the second
    // time must not ask every question again. A row thrown away once does not
    // come back either: that is what keeps a rejection meaning something.
    // Messages are told apart from one another before they get here
    // (`readNotices`): a source never reports one movement twice, so a
    // second identical purchase texted by the same bank is real and must
    // not be swallowed by the first one's proposal.
    const read = await this.alreadyReadOf(readings);
    const seenByAll = read.map(({ source: _source, ...row }) => row);
    const seenByStatements = read.filter(row => row.source !== 'notification')
      .map(({ source: _source, ...row }) => row);
    const taken = new Set<number>();

    // The two tables every row is going to be asked about, read once each.
    // Asking per row was three trips across the bridge for each line of the
    // statement; on a phone that is most of a minute for a long one.
    const dictionary = await this.dictionary();
    const starters = await this.starterCategories();

    // What was there before, so the ids handed back are this call's alone: a
    // batch of notifications is one per app and grows over many calls.
    const before = (await this.db.queryOne<{ top: number | null }>(
      'SELECT MAX(id) AS top FROM movement_proposals'))?.top ?? 0;

    return this.db.transaction(async () => {
      let knownAlready = 0;
      const rows: unknown[][] = [];
      for (const reading of readings) {
        const twin = sameMovementAs({
          account_id: reading.account_id ?? null,
          occurred_on: reading.occurred_on ?? null,
          amount_minor: reading.amount_minor ?? null,
          description: reading.description ?? null,
        }, reading.source === 'notification' ? seenByStatements : seenByAll, taken);
        if (twin !== null) {
          taken.add(twin);
          knownAlready += 1;
          continue;
        }
        // What this person has filed before, first. Only where that says
        // nothing does a word in the description get to suggest anything.
        let category = reading.category_id ?? dictionary.categoryOf(reading.description ?? null);
        let from: 'learned' | 'guessed' | null = category === null ? null : 'learned';
        if (category === null) {
          const word = wordCategoryOf(reading.description ?? null, reading.amount_minor ?? null);
          category = word === null
            ? null
            : starters.get(`${word.kind}:${word.es}`) ?? starters.get(`${word.kind}:${word.en}`) ?? null;
          if (category !== null) from = 'guessed';
        }
        rows.push([
          reading.source,
          reading.account_id ?? null,
          reading.occurred_on ?? null,
          reading.amount_minor ?? null,
          reading.description ?? null,
          category,
          from,
          JSON.stringify(reading.evidence ?? null),
          batch, timestamp, timestamp,
        ]);
      }

      await this.insertMany(
        `INSERT INTO movement_proposals
           (source, account_id, occurred_on, amount_minor, description, category_id,
            category_from, evidence, batch, created_at, updated_at)
         VALUES `, 11, rows);
      // What was just written, asked for by the batch rather than one id at a
      // time: a multi-row insert reports only the last of them.
      const ids = (await this.db.query<{ id: number }>(
        'SELECT id FROM movement_proposals WHERE batch = ? AND id > ? ORDER BY id', [batch, before]))
        .map(row => row.id);

      await this.markKnownAgain(ids);
      await this.markTransfers(ids);
      return { ids, knownAlready };
    });
  }

  /**
   * The readings this screen has already held, in the shape the check wants.
   *
   * Only around the days the new readings speak about, and only for their
   * accounts, so this asks for a handful of rows rather than for everything
   * ever proposed.
   */
  private async alreadyReadOf(readings: readonly NewProposal[]): Promise<(LedgerMovement & { source: string })[]> {
    const dated = readings.filter(reading => reading.account_id != null && reading.occurred_on != null);
    if (dated.length === 0) return [];

    const days = dated.map(reading => reading.occurred_on!).sort();
    const accounts = [...new Set(dated.map(reading => reading.account_id!))];
    return this.db.query<LedgerMovement & { source: string }>(
      `SELECT id, account_id, occurred_on, amount_minor, description, source
       FROM movement_proposals
       WHERE account_id IN (${accounts.map(() => '?').join(', ')})
         AND occurred_on BETWEEN date(?, '-7 day') AND date(?, '+7 day')
         AND amount_minor IS NOT NULL`,
      [...accounts, days[0], days[days.length - 1]]);
  }

  /**
   * Files every waiting reading of one merchant under the same category.
   *
   * The same shop turns up half a dozen times in a month, and answering for
   * each of them in turn is the work this screen exists to save. Jose asked
   * for it as soon as he saw a statement: settle the repeated ones at the
   * top, then read down the rest.
   *
   * It teaches the dictionary too, so the next statement proposes it.
   */
  async fileAllAs(merchant: string, categoryId: number, batch?: string): Promise<number> {
    // One origin's rows when it is named: the shop is answered where it repeats.
    const waiting = await this.db.query<{ id: number; description: string | null; occurred_on: IsoDate | null }>(
      batch === undefined
        ? "SELECT id, description, occurred_on FROM movement_proposals WHERE status = 'pending'"
        : "SELECT id, description, occurred_on FROM movement_proposals WHERE status = 'pending' AND batch = ?",
      batch === undefined ? [] : [batch]);
    const mine = waiting.filter(one => merchantKeyOf(one.description) === merchant);
    if (mine.length === 0) return 0;

    const timestamp = this.now();
    await this.db.transaction(async () => {
      for (const one of mine) {
        await this.db.run(
          "UPDATE movement_proposals SET category_id = ?, category_from = 'typed', updated_at = ? WHERE id = ?",
          [categoryId, timestamp, one.id]);
      }
    });
    await this.learn(mine[0].description, categoryId, mine[0].occurred_on ?? todayIso());
    return mine.length;
  }

  /**
   * Files the chosen readings under one category, in one statement.
   *
   * What a person selected by hand on the review screen, whatever their
   * shop. Nothing is learned here: saving a movement is what teaches the
   * dictionary, and these are not saved yet. Only pending ones are touched.
   */
  async fileThese(ids: readonly number[], categoryId: number): Promise<number> {
    if (ids.length === 0) return 0;
    const result = await this.db.run(
      `UPDATE movement_proposals SET category_id = ?, category_from = 'typed', updated_at = ?
       WHERE status = 'pending' AND id IN (${ids.map(() => '?').join(', ')})`,
      [categoryId, this.now(), ...ids]);
    return result.changes ?? 0;
  }

  /**
   * Every bank message already turned into a proposal, whatever was decided
   * about it, so the same message is never proposed twice - and one thrown
   * away never comes back.
   */
  async noticeKeys(): Promise<Set<string>> {
    const rows = await this.db.query<{ evidence: string }>(
      "SELECT evidence FROM movement_proposals WHERE source = 'notification'");
    const keys = new Set<string>();
    for (const row of rows) {
      try {
        const read = JSON.parse(row.evidence) as { key?: unknown; sightings?: { evidence?: { key?: unknown } }[] };
        if (typeof read?.key === 'string') keys.add(read.key);
        // A message folded into another's proposal is spoken for too.
        for (const one of Array.isArray(read?.sightings) ? read.sightings : []) {
          if (typeof one?.evidence?.key === 'string') keys.add(one.evidence.key);
        }
      } catch {
        // A row that will not read is not a key; it cannot match anything.
      }
    }
    return keys;
  }

  /**
   * What the person answered for messages before: which account each app's
   * message - and each card's digits - turned out to be. Read from the
   * proposals they accepted, so nothing new is stored and a correction made
   * on the review screen is what is remembered.
   */
  async noticeAnswers(): Promise<{ package: string; digits: string | null; account_id: number }[]> {
    const rows = await this.db.query<{ evidence: string; account_id: number | null }>(
      `SELECT evidence, account_id FROM movement_proposals
       WHERE source = 'notification' AND status = 'accepted' AND account_id IS NOT NULL
       ORDER BY id DESC LIMIT 500`);
    const answers: { package: string; digits: string | null; account_id: number }[] = [];
    for (const row of rows) {
      try {
        const read = JSON.parse(row.evidence) as {
          package?: unknown; digits?: unknown; sightings?: { evidence?: { package?: unknown; digits?: unknown } }[];
        };
        // Every message that reported it learns the answer: the SMS sender
        // and the bank's app alike.
        const said = [read, ...(Array.isArray(read.sightings) ? read.sightings.map(one => one?.evidence ?? {}) : [])];
        for (const one of said) {
          if (typeof one.package !== 'string') continue;
          answers.push({
            package: one.package,
            digits: typeof one.digits === 'string' ? one.digits : null,
            account_id: row.account_id!,
          });
        }
      } catch {
        // Skip it rather than lose the rest.
      }
    }
    return answers;
  }

  /**
   * The proposals made from messages in the last two days, whatever was
   * decided about them, for a later message of the same movement to join
   * (`readNotices`). One thrown away still swallows its other messages:
   * the same purchase must not come back by another channel.
   */
  async recentNotices(): Promise<RecentNotice[]> {
    const rows = await this.db.query<{
      id: number; account_id: number | null; amount_minor: number | null; description: string | null; evidence: string;
    }>(
      `SELECT id, account_id, amount_minor, description, evidence FROM movement_proposals
       WHERE source = 'notification' AND created_at >= ?`,
      [new Date(Date.parse(this.now()) - 2 * 24 * 3_600_000).toISOString()]);
    const recent: RecentNotice[] = [];
    for (const row of rows) {
      try {
        const evidence = JSON.parse(row.evidence) as NoticeEvidence;
        if (evidence && typeof evidence.postedAt === 'number' && typeof evidence.package === 'string') {
          recent.push({ ...row, evidence });
        }
      } catch {
        // A row that will not read cannot be joined.
      }
    }
    return recent;
  }

  /**
   * Later messages of a movement already proposed, folded into its proposal.
   * An account the later message knew fills one the proposal lacked, while
   * it waits.
   */
  async join(joining: readonly Joining[]): Promise<number> {
    if (joining.length === 0) return 0;
    const timestamp = this.now();
    let joined = 0;
    await this.db.transaction(async () => {
      for (const one of joining) {
        const row = await this.db.queryOne<{ evidence: string; status: string; account_id: number | null }>(
          'SELECT evidence, status, account_id FROM movement_proposals WHERE id = ?', [one.id]);
        if (!row) continue;
        let evidence: NoticeEvidence;
        try { evidence = JSON.parse(row.evidence) as NoticeEvidence; } catch { continue; }
        evidence.sightings = [...(evidence.sightings ?? []), ...one.sightings];
        const account = row.status === 'pending' && row.account_id === null ? one.accountId : row.account_id;
        await this.db.run(
          'UPDATE movement_proposals SET evidence = ?, account_id = ?, updated_at = ? WHERE id = ?',
          [JSON.stringify(evidence), account, timestamp, one.id]);
        joined += one.sightings.length;
      }
    });
    return joined;
  }

  /**
   * Undoes a merge: the messages folded into a waiting proposal become
   * proposals of their own again, each in its own source's batch, and the
   * proposal keeps only its first message. Never touches one already
   * answered. Returns how many came apart.
   */
  async separate(id: number): Promise<number> {
    const row = await this.db.queryOne<{ evidence: string; status: string }>(
      'SELECT evidence, status FROM movement_proposals WHERE id = ?', [id]);
    if (!row || row.status !== 'pending') return 0;
    let evidence: NoticeEvidence;
    try { evidence = JSON.parse(row.evidence) as NoticeEvidence; } catch { return 0; }
    const sightings = evidence.sightings ?? [];
    if (sightings.length === 0) return 0;
    delete evidence.sightings;
    await this.db.run('UPDATE movement_proposals SET evidence = ?, updated_at = ? WHERE id = ?',
      [JSON.stringify(evidence), this.now(), id]);
    const twin = { key: evidence.key, file: evidence.file, postedAt: evidence.postedAt };
    for (const one of sightings) {
      await this.propose(noticeBatch(one.evidence.package), [{
        source: 'notification',
        account_id: one.account_id,
        occurred_on: one.occurred_on,
        amount_minor: one.amount_minor,
        description: one.description,
        // Said apart now, still pointing at the one it was taken for.
        evidence: { ...one.evidence, twin },
      }]);
    }
    return sightings.length;
  }

  /**
   * What became of every message proposed, by its key: waiting, saved or
   * thrown away with its amount - or folded into another message's proposal
   * (the same movement from another source). For the notifications screen's
   * "what happened to each message".
   */
  async noticeOutcomes(): Promise<Map<string, { status: ProposalStatus | 'joined'; amount: number | null }>> {
    const rows = await this.db.query<{ evidence: string; status: ProposalStatus; amount_minor: number | null }>(
      "SELECT evidence, status, amount_minor FROM movement_proposals WHERE source = 'notification'");
    const out = new Map<string, { status: ProposalStatus | 'joined'; amount: number | null }>();
    for (const row of rows) {
      try {
        const read = JSON.parse(row.evidence) as NoticeEvidence;
        if (typeof read.key === 'string') out.set(read.key, { status: row.status, amount: row.amount_minor });
        for (const one of read.sightings ?? []) {
          if (typeof one?.evidence?.key === 'string') out.set(one.evidence.key, { status: 'joined', amount: row.amount_minor });
        }
      } catch {
        // Skip it rather than lose the rest.
      }
    }
    return out;
  }

  /** Everything still waiting, oldest first. */
  async pending(): Promise<MovementProposal[]> {
    return this.db.query<MovementProposal>(
      `SELECT ${COLUMNS} FROM movement_proposals
       WHERE status = 'pending' ORDER BY COALESCE(occurred_on, ''), id`);
  }

  async ofBatch(batch: string): Promise<MovementProposal[]> {
    return this.db.query<MovementProposal>(
      `SELECT ${COLUMNS} FROM movement_proposals WHERE batch = ? ORDER BY COALESCE(occurred_on, ''), id`,
      [batch]);
  }

  async byId(id: number): Promise<MovementProposal | null> {
    return this.db.queryOne<MovementProposal>(
      `SELECT ${COLUMNS} FROM movement_proposals WHERE id = ?`, [id]);
  }

  /** How many are waiting, for the badge that stops them piling up unseen. */
  async pendingCount(): Promise<number> {
    const row = await this.db.queryOne<{ total: number }>(
      `SELECT COUNT(*) AS total FROM movement_proposals WHERE status = 'pending'`);
    return row?.total ?? 0;
  }

  /**
   * Corrects a reading before it is accepted.
   *
   * A person changing the category here is the app being taught: that answer
   * is what the next movement from the same merchant will be proposed as.
   */
  async correct(id: number, fields: {
    account_id?: number | null;
    occurred_on?: IsoDate | null;
    amount_minor?: number | null;
    description?: string | null;
    category_id?: number | null;
  }): Promise<void> {
    const sets: string[] = [];
    const values: unknown[] = [];
    for (const [column, value] of Object.entries(fields)) {
      if (value === undefined) continue;
      sets.push(`${column} = ?`);
      values.push(value);
    }
    if (fields.category_id !== undefined) sets.push(`category_from = 'typed'`);
    if (sets.length === 0) return;

    sets.push('updated_at = ?');
    values.push(this.now(), id);
    await this.db.run(`UPDATE movement_proposals SET ${sets.join(', ')} WHERE id = ?`, values);
  }

  /** Marks one as written, against the movement it became. */
  async accepted(id: number, transactionId: number): Promise<void> {
    await this.db.run(
      `UPDATE movement_proposals SET status = 'accepted', transaction_id = ?, updated_at = ? WHERE id = ?`,
      [transactionId, this.now(), id]);
    await this.learnMoldsFrom(id);
  }

  // ---------------------------------------------------------------------------
  // What the person taught about each source (rule 22, the molds)
  // ---------------------------------------------------------------------------

  private async setting<T>(key: string, fallback: T): Promise<T> {
    const row = await this.db.queryOne<{ value: string }>('SELECT value FROM settings WHERE key = ?', [key]);
    if (!row) return fallback;
    try { return JSON.parse(row.value) as T; } catch { return fallback; }
  }

  private async keep(key: string, value: unknown): Promise<void> {
    await this.db.run(
      `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      [key, JSON.stringify(value), this.now()]);
  }

  /** Every mold learned so far (`core/notices/molds.ts`). */
  async molds(): Promise<Mold[]> {
    const molds = await this.setting<Mold[]>(MOLDS, []);
    return Array.isArray(molds) ? molds : [];
  }

  /** The account the person said each source is ("¿De qué cuenta es?"). */
  async sourceAccounts(): Promise<Map<string, number>> {
    const said = await this.setting<Record<string, number>>(SOURCE_ACCOUNTS, {});
    return new Map(Object.entries(said ?? {}).filter(([, id]) => typeof id === 'number'));
  }

  async assignSource(source: string, accountId: number | null): Promise<void> {
    const said = Object.fromEntries(await this.sourceAccounts());
    if (accountId === null) delete said[source];
    else said[source] = accountId;
    await this.keep(SOURCE_ACCOUNTS, said);
    // What it already proposed and still waits with no account takes it now.
    if (accountId !== null) {
      await this.db.run(
        `UPDATE movement_proposals SET account_id = ?, updated_at = ?
         WHERE source = 'notification' AND status = 'pending' AND account_id IS NULL AND batch = ?`,
        [accountId, this.now(), noticeBatch(source)]);
    }
  }

  /**
   * A saved proposal from a message teaches its source's mold: the message
   * and the sightings folded into it, with the amount, shop, account and
   * category the person saved. A row from a statement teaches nothing here.
   */
  private async learnMoldsFrom(id: number): Promise<void> {
    const row = await this.db.queryOne<{
      source: string; evidence: string; amount_minor: number | null; description: string | null;
      account_id: number | null; category_id: number | null;
    }>('SELECT source, evidence, amount_minor, description, account_id, category_id FROM movement_proposals WHERE id = ?', [id]);
    if (!row || row.source !== 'notification' || !row.amount_minor) return;
    let evidence: NoticeEvidence;
    try { evidence = JSON.parse(row.evidence) as NoticeEvidence; } catch { return; }
    const said = [evidence, ...(evidence.sightings ?? []).map(one => one.evidence)];
    let molds = await this.molds();
    let learned = false;
    for (const one of said) {
      if (typeof one?.text !== 'string' || typeof one.package !== 'string') continue;
      const mold = moldFrom({
        source: one.package, text: one.text, amountMinor: row.amount_minor, merchant: row.description,
        accountId: row.account_id, categoryId: row.category_id, at: Date.parse(this.now()) || Date.now(),
      });
      if (!mold) continue;
      molds = learnMold(molds, mold);
      learned = true;
    }
    if (learned) await this.keep(MOLDS, molds);
  }

  /**
   * Thrown away, and it does not come back.
   *
   * The row stays where it is rather than being deleted: that is what keeps
   * the same statement, imported again, from proposing it a second time.
   */
  async reject(id: number): Promise<void> {
    await this.db.run(
      `UPDATE movement_proposals SET status = 'rejected', updated_at = ? WHERE id = ?`,
      [this.now(), id]);
  }

  /** Rejects several in one statement: one trip over the bridge, not one each. */
  /**
   * "No ver más" for rows chosen by hand: the same answer as for a whole
   * batch - a message is kept as thrown away so it never comes back, a
   * statement's row simply goes and returns if the file is read again.
   */
  async forgetThese(ids: readonly number[]): Promise<number> {
    if (ids.length === 0) return 0;
    const marks = ids.map(() => '?').join(', ');
    const kept = await this.db.run(
      `UPDATE movement_proposals SET status = 'rejected', updated_at = ?
       WHERE status = 'pending' AND source = 'notification' AND id IN (${marks})`, [this.now(), ...ids]);
    const gone = await this.db.run(
      `DELETE FROM movement_proposals WHERE status = 'pending' AND id IN (${marks})`, [...ids]);
    return (kept.changes ?? 0) + (gone.changes ?? 0);
  }

  async rejectThese(ids: readonly number[]): Promise<number> {
    if (ids.length === 0) return 0;
    const result = await this.db.run(
      `UPDATE movement_proposals SET status = 'rejected', updated_at = ?
       WHERE status = 'pending' AND id IN (${ids.map(() => '?').join(', ')})`,
      [this.now(), ...ids]);
    return result.changes ?? 0;
  }

  /**
   * What this description was filed under before.
   *
   * Only where one category has been the answer often enough to be worth
   * proposing: a merchant filed two ways is a merchant the person should be
   * asked about again.
   */
  async learnedCategoryOf(description: string | null): Promise<number | null> {
    const merchant = merchantKeyOf(description);
    if (merchant.length === 0) return null;

    const exact = await this.db.queryOne<{ category_id: number }>(
      'SELECT category_id FROM merchant_categories WHERE merchant = ?', [merchant]);
    if (exact) return exact.category_id;

    // The banks abbreviate, and they do not agree with each other: the same
    // shop is "EXITO POBLADO" on one line and "EXITO POB 4471" on the next,
    // which are two different names by every exact test. The first word is
    // what survives that, so a merchant is looked for by it too - and only
    // where everything found under it was filed the same way. A first word
    // covering two categories is a question, not an answer.
    const head = merchant.split(' ')[0];
    // Two letters is enough: D1 is a chain of supermarkets, and the words
    // that are short by accident - la, el, por - are noise and never reach here.
    if (head.length < 2) return null;
    const family = await this.db.query<{ category_id: number; weight: number }>(
      `SELECT category_id, SUM(times) AS weight FROM merchant_categories
       WHERE merchant = ? OR merchant LIKE ? || ' %'
       GROUP BY category_id`, [head, head]);
    return family.length === 1 ? family[0].category_id : null;
  }

  /**
   * The whole merchant dictionary, in memory, answering the way the two
   * queries of `learnedCategoryOf` answer.
   *
   * Same rules exactly: the folded description first, then its first word,
   * and a first word that covers two categories is a question rather than an
   * answer. It is a small table - one row per shop somebody has ever filed -
   * and reading it whole once beats reading it twice per line of a statement.
   */
  private async dictionary(): Promise<{ categoryOf(description: string | null): number | null }> {
    const rows = await this.db.query<{ merchant: string; category_id: number; times: number }>(
      'SELECT merchant, category_id, times FROM merchant_categories');

    const exact = new Map<string, number>();
    const family = new Map<string, Set<number>>();
    for (const row of rows) {
      exact.set(row.merchant, row.category_id);
      const head = row.merchant.split(' ')[0];
      const under = family.get(head) ?? new Set<number>();
      under.add(row.category_id);
      family.set(head, under);
    }

    return {
      categoryOf(description: string | null): number | null {
        const merchant = merchantKeyOf(description);
        if (merchant.length === 0) return null;
        const found = exact.get(merchant);
        if (found !== undefined) return found;
        const head = merchant.split(' ')[0];
        if (head.length < 2) return null;
        const under = family.get(head);
        return under && under.size === 1 ? [...under][0] : null;
      },
    };
  }

  /** The categories a guessed word may land on, keyed `kind:name`. */
  private async starterCategories(): Promise<Map<string, number>> {
    const rows = await this.db.query<{ id: number; name: string; kind: string }>(
      'SELECT id, name, kind FROM categories WHERE archived = 0');
    const found = new Map<string, number>();
    for (const row of rows) {
      const key = `${row.kind}:${row.name}`;
      if (!found.has(key)) found.set(key, row.id);
    }
    return found;
  }

  /**
   * What an ordinary word in the description suggests, or null.
   *
   * Only a category that came with the app can be landed on this way. Somebody
   * who has renamed "Mercado" to something of their own has said what their
   * list is, and a word out of a table is not going to argue with them - it
   * simply finds nothing and the row is asked about, as before.
   */
  async guessedCategoryOf(description: string | null, signed: number | null): Promise<number | null> {
    const match = wordCategoryOf(description, signed);
    if (match === null) return null;
    const found = await this.db.queryOne<{ id: number }>(
      `SELECT id FROM categories
        WHERE kind = ? AND archived = 0 AND (name = ? OR name = ?)
        ORDER BY id LIMIT 1`,
      [match.kind, match.es, match.en]);
    return found?.id ?? null;
  }

  /**
   * Remembers what a description was filed under.
   *
   * Called when a movement is saved with a category, wherever it came from -
   * a proposal accepted here, or one typed by hand on the summary screen.
   * Teaching it from hand-typed movements is what makes it useful from the
   * first week rather than the third.
   */
  async learn(description: string | null, categoryId: number | null, on: IsoDate): Promise<void> {
    const merchant = merchantKeyOf(description);
    if (merchant.length === 0 || categoryId === null) return;
    const timestamp = this.now();
    await this.db.run(
      `INSERT INTO merchant_categories (merchant, category_id, sample, times, last_seen_on, created_at, updated_at)
       VALUES (?, ?, ?, 1, ?, ?, ?)
       ON CONFLICT(merchant) DO UPDATE SET
         -- A merchant filed somewhere else now follows the newest answer, and
         -- the count starts again: the person changed their mind, and the app
         -- is not going to argue with them about it.
         times        = CASE WHEN category_id = excluded.category_id THEN times + 1 ELSE 1 END,
         category_id  = excluded.category_id,
         sample       = excluded.sample,
         last_seen_on = excluded.last_seen_on,
         updated_at   = excluded.updated_at`,
      [merchant, categoryId, merchantSampleOf(description), on, timestamp, timestamp]);
  }

  /**
   * Learns from the movements already on record.
   *
   * Without this the dictionary starts empty, and somebody with five years of
   * their own history typed in would be asked again about every shop they
   * have already filed a hundred times. Everything that carries a description
   * and a category is read once, folded to its merchant, and the category
   * that merchant was filed under most often wins.
   *
   * What a person has taught by hand is never overruled: this only fills in
   * the merchants nobody has answered for yet.
   */
  async learnFromLedger(): Promise<number> {
    // What is already known, asked for once. On Jose's phone this used to be
    // one INSERT per merchant - some three thousand of them, each its own
    // trip across the bridge to the native plugin - and it ran on EVERY
    // import. It is the single biggest reason reading a statement took forty
    // seconds there and a moment in the browser.
    const known = new Set((await this.db.query<{ merchant: string }>(
      'SELECT merchant FROM merchant_categories')).map(row => row.merchant));

    const movements = await this.db.query<{
      description: string; category_id: number; occurred_on: IsoDate;
    }>(`SELECT description, category_id, occurred_on FROM transactions
        WHERE description IS NOT NULL AND description <> '' AND category_id IS NOT NULL
        ORDER BY occurred_on`);

    const counted = new Map<string, {
      sample: string; last: IsoDate; categories: Map<number, number>;
    }>();
    for (const movement of movements) {
      const merchant = merchantKeyOf(movement.description);
      if (merchant.length === 0) continue;
      const seen = counted.get(merchant)
        ?? { sample: merchantSampleOf(movement.description), last: movement.occurred_on, categories: new Map() };
      seen.categories.set(movement.category_id, (seen.categories.get(movement.category_id) ?? 0) + 1);
      seen.last = movement.occurred_on;
      seen.sample = merchantSampleOf(movement.description);
      counted.set(merchant, seen);
    }
    if (counted.size === 0) return 0;

    const timestamp = this.now();
    const rows: unknown[][] = [];
    for (const [merchant, seen] of counted) {
      // Already answered for, by hand or by an earlier pass: never overruled,
      // and never written again either. After the first import this leaves
      // nothing to do at all.
      if (known.has(merchant)) continue;
      const [categoryId, times] = [...seen.categories.entries()]
        .sort((a, b) => (b[1] - a[1]) || (a[0] - b[0]))[0];
      rows.push([merchant, categoryId, seen.sample, times, seen.last, timestamp, timestamp]);
    }
    if (rows.length === 0) return 0;

    await this.db.transaction(async () => {
      await this.insertMany(
        `INSERT INTO merchant_categories
           (merchant, category_id, sample, times, last_seen_on, created_at, updated_at)
         VALUES `, 7, rows, ' ON CONFLICT(merchant) DO NOTHING');
    });
    return rows.length;
  }

  /**
   * Many rows in as few statements as the engine will take.
   *
   * SQLite allows 999 parameters in one statement by default, so the rows are
   * sent in chunks that stay under it. One statement per chunk rather than
   * one per row is the difference between a phone that answers and a phone
   * that looks broken: every call crosses into the native plugin, and on
   * Android that crossing costs far more than the write itself.
   */
  private async insertMany(
    head: string, width: number, rows: readonly unknown[][], tail = '',
  ): Promise<void> {
    const perChunk = Math.max(1, Math.floor(900 / width));
    const one = `(${Array.from({ length: width }, () => '?').join(', ')})`;
    for (let from = 0; from < rows.length; from += perChunk) {
      const chunk = rows.slice(from, from + perChunk);
      await this.db.run(
        head + chunk.map(() => one).join(', ') + tail,
        chunk.flat());
    }
  }

  /**
   * Takes a batch off the screen without deciding anything about it.
   *
   * Jose, 2026-09-23: "y que pasa si no queria hacer nada con ese archivo?
   * es decir no descartarlos, pero tampoco hacer algo, solo limpiar la
   * pantalla". Throwing away is a decision and it is remembered; this is the
   * absence of one, so the rows are deleted outright and the same statement
   * imported again proposes them afresh.
   *
   * Only what is still waiting: a movement already written, and a rejection
   * already made, are answers and they stay.
   */
  async forget(batch: string): Promise<number> {
    // A bank's message is still on the phone after this, and would be read
    // again: put away, it is kept as thrown away so it never comes back.
    const kept = await this.db.run(
      `UPDATE movement_proposals SET status = 'rejected', updated_at = ?
       WHERE batch = ? AND status = 'pending' AND source = 'notification'`, [this.now(), batch]);
    const result = await this.db.run(
      "DELETE FROM movement_proposals WHERE batch = ? AND status = 'pending'", [batch]);
    return (kept.changes ?? 0) + (result.changes ?? 0);
  }

  /** The dictionary, for the screen that shows what the app has learned. */
  async learned(): Promise<{ merchant: string; sample: string; category_id: number; times: number }[]> {
    return this.db.query(
      `SELECT merchant, sample, category_id, times FROM merchant_categories
       ORDER BY times DESC, merchant`);
  }

  // ---------------------------------------------------------------------
  // The two questions
  // ---------------------------------------------------------------------

  /**
   * Points each reading at the movement it may already be.
   *
   * The window is the dates the readings themselves cover, widened by the
   * tolerance, so this asks the database for a handful of rows rather than
   * for five years of them.
   */
  private async markKnownAgain(ids: readonly number[]): Promise<void> {
    const readings = await this.someOf(ids);
    await this.markKnownAnywhere(readings);
    const dated = readings.filter(reading => reading.occurred_on !== null && reading.account_id !== null);
    if (dated.length === 0) return;

    const days = dated.map(reading => reading.occurred_on!).sort();
    const accounts = [...new Set(dated.map(reading => reading.account_id!))];
    const ledger = await this.db.query<LedgerMovement>(
      `SELECT id, account_id, occurred_on, amount_minor, description
       FROM transactions
       WHERE account_id IN (${accounts.map(() => '?').join(', ')})
         AND occurred_on BETWEEN date(?, '-7 day') AND date(?, '+7 day')`,
      [...accounts, days[0], days[days.length - 1]]);
    if (ledger.length === 0) return;

    // A movement already claimed by one reading cannot answer for another:
    // two identical bus fares on one day are two movements, not one.
    const taken = new Set<number>();
    for (const reading of dated) {
      const same = sameMovementAs(reading, ledger, taken);
      if (same === null) continue;
      taken.add(same);
      await this.db.run(
        'UPDATE movement_proposals SET maybe_same_as = ?, updated_at = ? WHERE id = ?',
        [same, this.now(), reading.id]);
    }
  }

  /**
   * A message whose account is not known yet, already typed by hand.
   *
   * A bank's SMS from a sender ticked for the first time says nothing about
   * which account it is, so the check above never ran and every purchase
   * Jose had already typed came back as new (2026-10-05). Here the same
   * check runs over every account: the same amount to the cent, a few days
   * apart, the same merchant preferred. Found, the reading points at that
   * movement and takes its account - it is a question on the screen, never
   * a decision.
   */
  private async markKnownAnywhere(readings: readonly MovementProposal[]): Promise<void> {
    const loose = readings.filter(reading => reading.account_id === null
      && reading.occurred_on !== null && reading.amount_minor !== null && reading.amount_minor !== 0);
    if (loose.length === 0) return;
    const days = loose.map(reading => reading.occurred_on!).sort();
    const amounts = [...new Set(loose.map(reading => reading.amount_minor!))];
    const ledger = await this.db.query<LedgerMovement>(
      `SELECT id, account_id, occurred_on, amount_minor, description
       FROM transactions
       WHERE amount_minor IN (${amounts.map(() => '?').join(', ')})
         AND occurred_on BETWEEN date(?, '-7 day') AND date(?, '+7 day')`,
      [...amounts, days[0], days[days.length - 1]]);
    if (ledger.length === 0) return;
    const taken = new Set<number>();
    for (const reading of loose) {
      const same = sameMovementAnywhere(reading, ledger, taken);
      if (same === null) continue;
      taken.add(same.id);
      await this.db.run(
        'UPDATE movement_proposals SET maybe_same_as = ?, account_id = ?, updated_at = ? WHERE id = ?',
        [same.id, same.account_id, this.now(), reading.id]);
    }
  }

  /** Ties the two halves of a transfer to each other. */
  private async markTransfers(ids: readonly number[]): Promise<void> {
    const readings = await this.someOf(ids);
    for (const [leaving, arriving] of transferPairs(readings)) {
      const timestamp = this.now();
      await this.db.run('UPDATE movement_proposals SET pairs_with = ?, updated_at = ? WHERE id = ?',
        [arriving, timestamp, leaving]);
      await this.db.run('UPDATE movement_proposals SET pairs_with = ?, updated_at = ? WHERE id = ?',
        [leaving, timestamp, arriving]);
    }
  }

  private async someOf(ids: readonly number[]): Promise<MovementProposal[]> {
    if (ids.length === 0) return [];
    return this.db.query<MovementProposal>(
      `SELECT ${COLUMNS} FROM movement_proposals WHERE id IN (${ids.map(() => '?').join(', ')})`,
      [...ids]);
  }
}
