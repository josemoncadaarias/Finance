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
import { sameMovementAs, transferPairs, type LedgerMovement } from '../../proposals/matching';

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
  category_from: 'learned' | 'typed' | null;
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
    const seen = await this.alreadyReadOf(readings);
    const taken = new Set<number>();

    return this.db.transaction(async () => {
      const ids: number[] = [];
      let knownAlready = 0;
      for (const reading of readings) {
        const twin = sameMovementAs({
          account_id: reading.account_id ?? null,
          occurred_on: reading.occurred_on ?? null,
          amount_minor: reading.amount_minor ?? null,
          description: reading.description ?? null,
        }, seen, taken);
        if (twin !== null) {
          taken.add(twin);
          knownAlready += 1;
          continue;
        }
        const category = await this.learnedCategoryOf(reading.description ?? null);
        const result = await this.db.run(
          `INSERT INTO movement_proposals
             (source, account_id, occurred_on, amount_minor, description, category_id, category_from,
              evidence, status, batch, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)`,
          [
            reading.source,
            reading.account_id ?? null,
            reading.occurred_on ?? null,
            reading.amount_minor ?? null,
            reading.description ?? null,
            category,
            category === null ? null : 'learned',
            JSON.stringify(reading.evidence ?? null),
            batch, timestamp, timestamp,
          ],
        );
        ids.push(result.lastId!);
      }

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
  private async alreadyReadOf(readings: readonly NewProposal[]): Promise<LedgerMovement[]> {
    const dated = readings.filter(reading => reading.account_id != null && reading.occurred_on != null);
    if (dated.length === 0) return [];

    const days = dated.map(reading => reading.occurred_on!).sort();
    const accounts = [...new Set(dated.map(reading => reading.account_id!))];
    return this.db.query<LedgerMovement>(
      `SELECT id, account_id, occurred_on, amount_minor, description
       FROM movement_proposals
       WHERE account_id IN (${accounts.map(() => '?').join(', ')})
         AND occurred_on BETWEEN date(?, '-7 day') AND date(?, '+7 day')
         AND amount_minor IS NOT NULL`,
      [...accounts, days[0], days[days.length - 1]]);
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
    let learned = 0;
    await this.db.transaction(async () => {
      for (const [merchant, seen] of counted) {
        const [categoryId, times] = [...seen.categories.entries()]
          .sort((a, b) => (b[1] - a[1]) || (a[0] - b[0]))[0];
        const result = await this.db.run(
          `INSERT INTO merchant_categories
             (merchant, category_id, sample, times, last_seen_on, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(merchant) DO NOTHING`,
          [merchant, categoryId, seen.sample, times, seen.last, timestamp, timestamp]);
        if ((result.changes ?? 0) > 0) learned += 1;
      }
    });
    return learned;
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
