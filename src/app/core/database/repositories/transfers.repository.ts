/**
 * Transfers between accounts, including transfers across currencies.
 *
 * A transfer is a header plus two legs in `transactions`. Both legs are always
 * written in one transaction: a transfer that lost half of itself would show
 * up as money vanishing from one account, which is worse than no transfer.
 */

import type { SqlDriver } from '../sql-driver';
import type { IsoDate, RateSource, TransactionRow, TransferRow } from '../types';
import { TransactionsRepository } from './transactions.repository';

export interface TransferLegInput {
  account_id: number;
  /** Positive; the sign is applied per leg. */
  amount_minor: number;
  rate_scaled?: number | null;
  amount_base_minor?: number;
  rate_source?: RateSource | null;
}

export interface NewTransfer {
  occurred_on: IsoDate;
  description?: string | null;
  from: TransferLegInput;
  to: TransferLegInput;
  confidence?: 'high' | 'low';
  source?: 'manual' | 'monefy';
  fingerprints?: { from?: { value: string; seq: number }; to?: { value: string; seq: number } };
}

export interface TransferWithLegs {
  transfer: TransferRow;
  from: TransactionRow;
  to: TransactionRow;
}

export class TransfersRepository {
  private readonly db: SqlDriver;
  private readonly transactions: TransactionsRepository;
  private readonly now: () => string;

  constructor(db: SqlDriver, now: () => string = () => new Date().toISOString()) {
    this.db = db;
    this.now = now;
    this.transactions = new TransactionsRepository(db, now);
  }

  /**
   * Creates a transfer and both its legs atomically.
   *
   * The two amounts are given separately rather than derived from one another,
   * because across currencies they genuinely differ: 100,000 COP left Rappi
   * and 23.73 USD arrived at ARQ. Each leg keeps the rate that produced it.
   */
  async create(transfer: NewTransfer): Promise<number> {
    if (transfer.from.amount_minor <= 0 || transfer.to.amount_minor <= 0) {
      throw new Error('Transfer amounts are given as positive values; the sign is applied per leg');
    }

    return this.db.transaction(async () => {
      const timestamp = this.now();
      const header = await this.db.run(
        `INSERT INTO transfers (occurred_on, description, created_at, updated_at) VALUES (?, ?, ?, ?)`,
        [transfer.occurred_on, transfer.description ?? null, timestamp, timestamp],
      );
      const transferId = header.lastId!;

      const common = {
        occurred_on: transfer.occurred_on,
        description: transfer.description ?? null,
        transfer_id: transferId,
        confidence: transfer.confidence ?? 'high',
        source: transfer.source ?? 'manual',
        category_id: null,
      } as const;

      await this.transactions.create({
        ...common,
        account_id: transfer.from.account_id,
        amount_minor: -transfer.from.amount_minor,
        rate_scaled: transfer.from.rate_scaled ?? null,
        amount_base_minor:
          transfer.from.amount_base_minor === undefined ? undefined : -Math.abs(transfer.from.amount_base_minor),
        rate_source: transfer.from.rate_source ?? null,
        transfer_leg: 'from',
        import_fingerprint: transfer.fingerprints?.from?.value ?? null,
        import_seq: transfer.fingerprints?.from?.seq ?? null,
      });

      await this.transactions.create({
        ...common,
        account_id: transfer.to.account_id,
        amount_minor: transfer.to.amount_minor,
        rate_scaled: transfer.to.rate_scaled ?? null,
        amount_base_minor:
          transfer.to.amount_base_minor === undefined ? undefined : Math.abs(transfer.to.amount_base_minor),
        rate_source: transfer.to.rate_source ?? null,
        transfer_leg: 'to',
        import_fingerprint: transfer.fingerprints?.to?.value ?? null,
        import_seq: transfer.fingerprints?.to?.seq ?? null,
      });

      return transferId;
    });
  }

  async findById(id: number): Promise<TransferWithLegs | null> {
    const transfer = await this.db.queryOne<TransferRow>(
      'SELECT id, occurred_on, description, created_at, updated_at FROM transfers WHERE id = ?',
      [id],
    );
    if (!transfer) return null;

    const legs = await this.db.query<TransactionRow>(
      `SELECT * FROM transactions WHERE transfer_id = ? ORDER BY transfer_leg`,
      [id],
    );
    const from = legs.find(leg => leg.transfer_leg === 'from');
    const to = legs.find(leg => leg.transfer_leg === 'to');

    // A header without both legs means something wrote around this repository.
    if (!from || !to) {
      throw new Error(`Transfer ${id} is missing a leg; the ledger is inconsistent`);
    }
    return { transfer, from, to };
  }

  async list(filter: { from?: IsoDate; to?: IsoDate; limit?: number } = {}): Promise<TransferRow[]> {
    const conditions: string[] = [];
    const values: unknown[] = [];

    if (filter.from) {
      conditions.push('occurred_on >= ?');
      values.push(filter.from);
    }
    if (filter.to) {
      conditions.push('occurred_on <= ?');
      values.push(filter.to);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    let sql = `SELECT id, occurred_on, description, created_at, updated_at
               FROM transfers ${where} ORDER BY occurred_on DESC, id DESC`;
    if (filter.limit !== undefined) {
      sql += ' LIMIT ?';
      values.push(filter.limit);
    }
    return this.db.query<TransferRow>(sql, values);
  }

  /** Deleting the header takes both legs with it, via ON DELETE CASCADE. */
  async delete(id: number): Promise<void> {
    await this.db.run('DELETE FROM transfers WHERE id = ?', [id]);
  }
}
