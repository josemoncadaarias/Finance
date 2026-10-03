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
import { loanPaymentOf, undoLoanPayment } from '../../loans/payment-links';

export interface TransferLegInput {
  account_id: number;
  /**
   * Which product of that account this end of the transfer touches.
   *
   * Both ends may be in the SAME account: moving money from one product to
   * another is a real act the bank calls a withdrawal or a top-up, and from
   * the account's point of view nothing happens - the two legs sum to zero
   * and the balance is exactly what it was. What changes is which product
   * each figure belongs to, and so what each one earns on.
   */
  product_id?: number | null;
  /** Positive; the sign is applied per leg. */
  amount_minor: number;
  rate_scaled?: number | null;
  amount_base_minor?: number;
  rate_source?: RateSource | null;
  /**
   * What this end changes (migration 056), for an end on an account with
   * products in a transfer between two different accounts: `both` (the
   * default, every transfer before 2026-10-03) is a leg as always;
   * `netWorth` is the leg plus its other half on the product; `product` is no
   * leg, only a `product_entries` row on the product.
   */
  scope?: TransferScope;
}

/** What one end of a transfer changes. The same three answers as an income or a spending. */
export type TransferScope = 'both' | 'product' | 'netWorth';

/** One end as it stands, whether it is a leg of the ledger or a product's own entry. */
export interface TransferEnd {
  scope: TransferScope;
  account_id: number;
  product_id: number | null;
  /** Positive, in the account's own currency. */
  amount_minor: number;
  /** The leg, when this end has one (`both`, `netWorth`). */
  leg: TransactionRow | null;
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
  /** Null at an end that changes its product only (migration 056). */
  from: TransactionRow | null;
  to: TransactionRow | null;
  /** Both ends, legs or not: what the form shows. */
  fromEnd: TransferEnd;
  toEnd: TransferEnd;
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
    if (scopeOf(transfer.from) !== 'both' || scopeOf(transfer.to) !== 'both') {
      if (transfer.from.account_id === transfer.to.account_id) {
        throw new Error('Only a transfer between two different accounts can change one end alone');
      }
    }

    return this.db.transaction(async () => {
      const timestamp = this.now();
      const header = await this.db.run(
        `INSERT INTO transfers (occurred_on, description, from_scope, to_scope, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [transfer.occurred_on, transfer.description ?? null, scopeOf(transfer.from), scopeOf(transfer.to),
         timestamp, timestamp],
      );
      const transferId = header.lastId!;
      await this.writeEnd(transferId, transfer, 'from');
      await this.writeEnd(transferId, transfer, 'to');
      return transferId;
    });
  }

  /**
   * One end, in the shape its scope says: a leg (and its other half on the
   * product, for `netWorth`), or a product's own entry (`product`).
   */
  private async writeEnd(transferId: number, transfer: NewTransfer, side: 'from' | 'to', legId?: number): Promise<void> {
    const end = transfer[side];
    const scope = scopeOf(end);
    const sign = side === 'from' ? -1 : 1;
    const timestamp = this.now();
    const note = transfer.description ?? null;

    if (scope === 'product') {
      await this.db.run(
        `INSERT INTO product_entries
           (account_id, source, kind, product_id, on_date, amount_minor, note, transfer_id, transfer_leg, created_at, updated_at)
         VALUES (?, 'yield', 'other', ?, ?, ?, ?, ?, ?, ?, ?)`,
        [end.account_id, end.product_id ?? null, transfer.occurred_on, sign * end.amount_minor, note,
         transferId, side, timestamp, timestamp]);
      return;
    }

    const leg = {
      occurred_on: transfer.occurred_on,
      description: note,
      account_id: end.account_id,
      product_id: end.product_id ?? null,
      amount_minor: sign * end.amount_minor,
      rate_scaled: end.rate_scaled ?? null,
      rate_source: end.rate_source ?? null,
    };
    let id: number;
    if (legId !== undefined) {
      await this.transactions.update(legId, {
        ...leg,
        amount_base_minor: end.amount_base_minor === undefined
          ? sign * end.amount_minor
          : sign * Math.abs(end.amount_base_minor),
      });
      id = legId;
    } else {
      id = await this.transactions.create({
        ...leg,
        amount_base_minor: end.amount_base_minor === undefined ? undefined : sign * Math.abs(end.amount_base_minor),
        transfer_id: transferId,
        transfer_leg: side,
        category_id: null,
        confidence: transfer.confidence ?? 'high',
        source: transfer.source ?? 'manual',
        import_fingerprint: transfer.fingerprints?.[side]?.value ?? null,
        import_seq: transfer.fingerprints?.[side]?.seq ?? null,
      });
    }
    if (scope !== 'netWorth') return;

    // The leg moved the product too; it was not meant to. Its other half puts
    // the product back where it was - the shapes a spending and an income
    // take for "net worth alone" (`writeScoped`).
    if (side === 'from') {
      await this.db.run(
        `INSERT INTO product_entries
           (account_id, source, kind, product_id, on_date, amount_minor, note, transaction_id, created_at, updated_at)
         VALUES (?, 'yield', 'other', ?, ?, ?, ?, ?, ?, ?)`,
        [end.account_id, end.product_id ?? null, transfer.occurred_on, end.amount_minor, note, id, timestamp, timestamp]);
    } else {
      await this.db.run(
        `INSERT INTO product_cashouts (account_id, source, on_date, amount_minor, transaction_id, note, product_id, created_at)
         VALUES (?, 'yield', ?, ?, ?, ?, ?, ?)`,
        [end.account_id, transfer.occurred_on, end.amount_minor, id, note, end.product_id ?? null, timestamp]);
    }
  }

  /** Removes what the scopes added beside the legs: the halves and the product-only entries. */
  private async clearScopeRows(found: TransferWithLegs): Promise<void> {
    await this.db.run('DELETE FROM product_entries WHERE transfer_id = ?', [found.transfer.id]);
    // A half is there only where the end is `netWorth`; a leg of an ordinary
    // transfer may be named by rows the products screen wrote, and those stay.
    if (found.fromEnd.scope === 'netWorth' && found.from) {
      await this.db.run('DELETE FROM product_entries WHERE transaction_id = ?', [found.from.id]);
    }
    if (found.toEnd.scope === 'netWorth' && found.to) {
      await this.db.run('DELETE FROM product_cashouts WHERE transaction_id = ?', [found.to.id]);
    }
  }

  async findById(id: number): Promise<TransferWithLegs | null> {
    const transfer = await this.db.queryOne<TransferRow>(
      `SELECT id, occurred_on, description, from_scope, to_scope, created_at, updated_at FROM transfers WHERE id = ?`,
      [id],
    );
    if (!transfer) return null;

    const legs = await this.db.query<TransactionRow>(
      `SELECT * FROM transactions WHERE transfer_id = ? ORDER BY transfer_leg`,
      [id],
    );
    const entries = await this.db.query<{ account_id: number; product_id: number | null; amount_minor: number; transfer_leg: 'from' | 'to' }>(
      'SELECT account_id, product_id, amount_minor, transfer_leg FROM product_entries WHERE transfer_id = ?',
      [id],
    );
    const endOf = (side: 'from' | 'to'): TransferEnd => {
      const scope = (side === 'from' ? transfer.from_scope : transfer.to_scope) ?? 'both';
      const leg = legs.find(row => row.transfer_leg === side) ?? null;
      if (leg) {
        return { scope, account_id: leg.account_id, product_id: leg.product_id ?? null, amount_minor: Math.abs(leg.amount_minor), leg };
      }
      const entry = entries.find(row => row.transfer_leg === side);
      // An end with neither means something wrote around this repository.
      if (!entry) throw new Error(`Transfer ${id} is missing its ${side} end; the ledger is inconsistent`);
      return { scope, account_id: entry.account_id, product_id: entry.product_id, amount_minor: Math.abs(entry.amount_minor), leg: null };
    };
    const fromEnd = endOf('from');
    const toEnd = endOf('to');
    return { transfer, from: fromEnd.leg, to: toEnd.leg, fromEnd, toEnd };
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

  /**
   * Rewrites a transfer: both legs and the header, in one transaction.
   *
   * Everything is given, not patched. A transfer is one act described by three
   * rows, and letting a caller change the destination account without the
   * amount — or one leg without the other — is how a ledger ends up with money
   * leaving one account and a different sum arriving at another. Passing the
   * whole thing makes that impossible to express.
   *
   * Both legs are locked, like any hand edit, so a later re-import of the
   * later pass leaves the correction alone.
   */
  async update(id: number, transfer: NewTransfer): Promise<void> {
    if (transfer.from.amount_minor <= 0 || transfer.to.amount_minor <= 0) {
      throw new Error('Transfer amounts are given as positive values; the sign is applied per leg');
    }
    if ((scopeOf(transfer.from) !== 'both' || scopeOf(transfer.to) !== 'both')
        && transfer.from.account_id === transfer.to.account_id) {
      throw new Error('Only a transfer between two different accounts can change one end alone');
    }

    const existing = await this.findById(id);
    if (!existing) throw new Error(`Transfer ${id} does not exist`);

    await this.db.transaction(async () => {
      await this.db.run(
        'UPDATE transfers SET occurred_on = ?, description = ?, from_scope = ?, to_scope = ?, updated_at = ? WHERE id = ?',
        [transfer.occurred_on, transfer.description ?? null, scopeOf(transfer.from), scopeOf(transfer.to), this.now(), id],
      );
      await this.clearScopeRows(existing);
      for (const side of ['from', 'to'] as const) {
        const leg = existing[side];
        if (scopeOf(transfer[side]) === 'product') {
          // This end no longer touches the ledger: its leg goes.
          if (leg) await this.db.run('DELETE FROM transactions WHERE id = ?', [leg.id]);
          await this.writeEnd(id, transfer, side);
        } else {
          // The leg keeps its id wherever there was one, so whatever points
          // at it (a loan's payment, a proposal) still does.
          await this.writeEnd(id, transfer, side, leg?.id);
        }
      }
    });
  }

  /**
   * Deleting the header takes both legs with it, via ON DELETE CASCADE. The
   * capital of a loan payment takes the rest of that payment too - its
   * interest, insurance and default interest - so no expense is left paying
   * an installment that is no longer paid.
   */
  async delete(id: number): Promise<void> {
    await this.db.transaction(async () => {
      const payment = await loanPaymentOf(this.db, { transferId: id });
      if (payment) await undoLoanPayment(this.db, payment);
      const found = await this.findById(id).catch(() => null);
      if (found) await this.clearScopeRows(found);
      await this.db.run('DELETE FROM product_entries WHERE transfer_id = ?', [id]);
      await this.db.run('DELETE FROM transfers WHERE id = ?', [id]);
    });
  }
}

function scopeOf(end: TransferLegInput): TransferScope {
  return end.scope ?? 'both';
}
