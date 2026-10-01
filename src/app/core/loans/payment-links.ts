/**
 * A loan payment is several movements: the capital as a transfer into the
 * loan, and the interest, insurance and default interest as expenses. Removing
 * any one of them from anywhere in the app - Inicio, the loan's Cuotas - must
 * undo the whole payment, or the expenses would stay with nothing paid
 * (Jose, 2026-10-01).
 *
 * Raw SQL only, so both the transfers and the transactions repository can
 * call it without importing each other or the loans repository.
 */

import type { SqlDriver } from '../database/sql-driver';

interface PaymentLinks {
  id: number;
  transfer_id: number | null;
  interest_tx_id: number | null;
  insurance_tx_id: number | null;
  late_tx_id: number | null;
  uvr_adjust_tx_id: number | null;
}

/** The loan payment a transfer or a movement belongs to, if any. */
export async function loanPaymentOf(db: SqlDriver, link: { transferId?: number | null; transactionId?: number | null }): Promise<PaymentLinks | null> {
  try {
    if (link.transferId != null) {
      const row = await db.queryOne<PaymentLinks>(
        'SELECT id, transfer_id, interest_tx_id, insurance_tx_id, late_tx_id, uvr_adjust_tx_id FROM loan_payments WHERE transfer_id = ?',
        [link.transferId]);
      if (row) return row;
    }
    if (link.transactionId != null) {
      const id = link.transactionId;
      return await db.queryOne<PaymentLinks>(
        `SELECT id, transfer_id, interest_tx_id, insurance_tx_id, late_tx_id, uvr_adjust_tx_id FROM loan_payments
         WHERE interest_tx_id = ? OR insurance_tx_id = ? OR late_tx_id = ? OR uvr_adjust_tx_id = ?
            OR transfer_id = (SELECT transfer_id FROM transactions WHERE id = ?)`,
        [id, id, id, id, id]);
    }
    return null;
  } catch {
    // A database from before loans existed has no such table.
    return null;
  }
}

/**
 * Removes a payment's record and its expenses, and says which transfer is
 * left for the caller to delete (its capital). Call inside a transaction.
 */
export async function undoLoanPayment(db: SqlDriver, payment: PaymentLinks): Promise<number | null> {
  await db.run('DELETE FROM loan_payments WHERE id = ?', [payment.id]);
  for (const tx of [payment.interest_tx_id, payment.insurance_tx_id, payment.late_tx_id, payment.uvr_adjust_tx_id]) {
    if (tx !== null) await db.run('DELETE FROM transactions WHERE id = ?', [tx]);
  }
  return payment.transfer_id;
}
