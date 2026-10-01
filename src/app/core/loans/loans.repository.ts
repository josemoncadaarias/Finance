/**
 * Loans (debts, part 2): their terms, their rate history and what was paid.
 *
 * A loan is an account whose balance is the debt, so creating one writes the
 * account too, opened at what was owed when the app started following it. A
 * payment is written whole, in one transaction: the capital as a transfer
 * from the account it was paid from into the loan, and the interest, the
 * insurance and any default interest as expenses of that same account - so
 * the report counts the interest as spending and never the capital.
 */

import type { SqlDriver } from '../database/sql-driver';
import { AccountsRepository } from '../database/repositories/accounts.repository';
import { CategoriesRepository } from '../database/repositories/categories.repository';
import { TransactionsRepository } from '../database/repositories/transactions.repository';
import { TransfersRepository } from '../database/repositories/transfers.repository';
import type { AccountRow } from '../database/types';
import { loanPaymentOf, undoLoanPayment } from './payment-links';
import { loanSchedule, theoreticalBalance, UVR_MICRO, type ExtraMode, type LoanPayment, type LoanSystem, type LoanTerms } from './schedule';
import { uvrLookup, type UvrLookup } from './uvr';

export interface LoanInput {
  name: string;
  builtinIcon: string;
  color: string;
  principalMinor: number;
  /** Always E.A., scaled by 1,000,000; the quoted form is only remembered. */
  annualRateScaled: number;
  rateQuoted: 'ea' | 'mv';
  rateKind: 'fixed' | 'variable';
  system: LoanSystem;
  installments: number;
  periodMonths: number;
  disbursedOn: string;
  firstDueOn: string;
  insuranceKind: 'fixed' | 'balance';
  insuranceMinor: number;
  insuranceRateScaled: number;
  bankInstallmentMinor: number | null;
  paidFromAccountId: number | null;
  paidBefore: number;
  balanceAfterBeforeMinor: number | null;
  /**
   * The account the money arrived in, for a loan the app follows from its
   * disbursement: the debt then comes from that transfer. Null records none.
   */
  disbursedIntoAccountId: number | null;
  /** 'UVR' for a loan denominated in UVR; then balanceAfterBeforeMinor and bankInstallmentMinor are millionths of a UVR. */
  unit?: 'COP' | 'UVR';
  /** The cyclic system's yearly decrease, scaled by 1,000,000; null for every other. */
  decreaseScaled?: number | null;
  /** The UVR of the disbursement day as the contract states it, scaled by 10,000: kept as typed. */
  disbursementUvrScaled?: number | null;
}

export interface LoanRow {
  account: AccountRow;
  rateQuoted: 'ea' | 'mv';
  rateKind: 'fixed' | 'variable';
  paidFromAccountId: number | null;
  disbursedIntoAccountId: number | null;
  /** The loan account's balance in the ledger: minus the debt as of the last movement. */
  ledgerMinor: number;
  terms: LoanTerms;
  payments: (LoanPayment & { id: number; transferId: number | null; uvrAdjustMinor: number })[];
}

/** A payment as the form writes it. */
export interface PaymentInput {
  loanAccountId: number;
  fromAccountId: number;
  kind: 'installment' | 'extra' | 'payoff';
  number: number | null;
  paidOn: string;
  capitalMinor: number;
  interestMinor: number;
  insuranceMinor: number;
  lateMinor: number;
  extraMode: ExtraMode | null;
  note: string | null;
  /** The category names to file interest and insurance under, in the app's language. */
  interestCategory: string;
  insuranceCategory: string;
  /** For a loan in UVR: the category the growth of the debt by the UVR is filed under. */
  uvrCategory?: string;
}

interface TermsRow {
  account_id: number;
  principal_minor: number;
  system: LoanSystem;
  rate_quoted: 'ea' | 'mv';
  rate_kind: 'fixed' | 'variable';
  installments: number;
  period_months: number;
  disbursed_on: string;
  first_due_on: string;
  insurance_kind: 'fixed' | 'balance';
  insurance_minor: number;
  insurance_rate_scaled: number;
  bank_installment_minor: number | null;
  paid_from_account_id: number | null;
  paid_before: number;
  balance_after_before_minor: number | null;
  disbursement_transfer_id: number | null;
  disbursed_into: number | null;
  unit: 'COP' | 'UVR';
  decrease_scaled: number | null;
}

export class LoansRepository {
  private readonly db: SqlDriver;
  private readonly now: () => string;

  constructor(db: SqlDriver, now: () => string = () => new Date().toISOString()) {
    this.db = db;
    this.now = now;
  }

  /** Every loan's account id, for the screens that only need to know which accounts are loans. */
  async ids(): Promise<number[]> {
    return (await this.db.query<{ account_id: number }>('SELECT account_id FROM loans')).map(r => r.account_id);
  }

  /** Every loan with its terms, rates and payments: four queries, whatever there is. */
  async all(): Promise<LoanRow[]> {
    const [terms, rates, payments, accounts, ledger] = await Promise.all([
      this.db.query<TermsRow>(
        `SELECT l.*, (SELECT t.account_id FROM transactions t
                       WHERE t.transfer_id = l.disbursement_transfer_id AND t.transfer_leg = 'to') AS disbursed_into
         FROM loans l`),
      this.db.query<{ account_id: number; valid_from: string; annual_rate_scaled: number }>(
        'SELECT account_id, valid_from, annual_rate_scaled FROM loan_rates ORDER BY valid_from'),
      this.db.query<{
        id: number; account_id: number; kind: LoanPayment['kind']; number: number | null; paid_on: string;
        capital_minor: number; interest_minor: number; insurance_minor: number; late_minor: number;
        extra_mode: ExtraMode | null; transfer_id: number | null; capital_uvr_micro: number | null; uvr_adjust_minor: number;
      }>('SELECT * FROM loan_payments ORDER BY paid_on, id'),
      new AccountsRepository(this.db).list({ includeArchived: true }),
      this.db.query<{ account_id: number; total: number }>(
        `SELECT l.account_id, a.opening_balance_minor + COALESCE((SELECT SUM(t.amount_minor) FROM transactions t WHERE t.account_id = l.account_id), 0) AS total
         FROM loans l JOIN accounts a ON a.id = l.account_id`),
    ]);
    const accountOf = new Map(accounts.map(a => [a.id, a]));
    const ledgerOf = new Map(ledger.map(r => [r.account_id, r.total]));
    const uvr = terms.some(t => t.unit === 'UVR') ? await this.uvr() : undefined;
    return terms.filter(t => accountOf.has(t.account_id)).map(t => ({
      account: accountOf.get(t.account_id)!,
      rateQuoted: t.rate_quoted,
      rateKind: t.rate_kind,
      paidFromAccountId: t.paid_from_account_id,
      disbursedIntoAccountId: t.disbursed_into ?? null,
      ledgerMinor: ledgerOf.get(t.account_id) ?? 0,
      terms: {
        unit: t.unit ?? 'COP',
        decreaseScaled: t.decrease_scaled ?? null,
        uvr: t.unit === 'UVR' ? uvr : undefined,
        principalMinor: t.principal_minor,
        system: t.system,
        installments: t.installments,
        periodMonths: t.period_months,
        disbursedOn: t.disbursed_on,
        firstDueOn: t.first_due_on,
        insuranceKind: t.insurance_kind,
        insuranceMinor: t.insurance_minor,
        insuranceRateScaled: t.insurance_rate_scaled,
        bankInstallmentMinor: t.bank_installment_minor,
        paidBefore: t.paid_before,
        balanceAfterBeforeMinor: t.balance_after_before_minor,
        rates: rates.filter(r => r.account_id === t.account_id)
          .map(r => ({ validFrom: r.valid_from, annualRateScaled: r.annual_rate_scaled })),
      },
      payments: payments.filter(p => p.account_id === t.account_id).map(p => ({
        id: p.id,
        transferId: p.transfer_id,
        kind: p.kind,
        number: p.number,
        paidOn: p.paid_on,
        capitalMinor: p.capital_minor,
        interestMinor: p.interest_minor,
        insuranceMinor: p.insurance_minor,
        lateMinor: p.late_minor,
        extraMode: p.extra_mode,
        capitalUvrMicro: p.capital_uvr_micro ?? null,
        uvrAdjustMinor: p.uvr_adjust_minor ?? 0,
      })),
    }));
  }

  async create(input: LoanInput): Promise<number> {
    return this.db.transaction(async () => {
      await this.keepTypedUvr(input);
      const start = startOf(input, input.unit === 'UVR' ? await this.uvr() : undefined);
      const opening = disburses(input) ? 0 : -start.balanceMinor;
      const accountId = await new AccountsRepository(this.db, this.now).create({
        name: input.name.trim(),
        type: 'debit',
        currency_code: 'COP',
        builtin_icon: input.builtinIcon,
        color: input.color,
        opening_balance_minor: opening,
        opening_balance_base_minor: opening,
        opened_on: start.on,
      });
      const timestamp = this.now();
      await this.db.run(
        `INSERT INTO loans (account_id, principal_minor, system, rate_quoted, rate_kind, installments, period_months,
           disbursed_on, first_due_on, insurance_kind, insurance_minor, insurance_rate_scaled, bank_installment_minor,
           paid_from_account_id, paid_before, balance_after_before_minor, unit, decrease_scaled, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [accountId, ...termValues(input), timestamp, timestamp],
      );
      await this.db.run(
        'INSERT INTO loan_rates (account_id, valid_from, annual_rate_scaled, created_at) VALUES (?, ?, ?, ?)',
        [accountId, input.disbursedOn, input.annualRateScaled, timestamp],
      );
      await this.setDisbursement(accountId, input);
      return accountId;
    });
  }

  /**
   * The disbursement transfer as the input says: written again from scratch
   * (amount, day and account may all have changed), or removed.
   */
  private async setDisbursement(accountId: number, input: LoanInput): Promise<void> {
    const row = await this.db.queryOne<{ disbursement_transfer_id: number | null }>(
      'SELECT disbursement_transfer_id FROM loans WHERE account_id = ?', [accountId]);
    const transfers = new TransfersRepository(this.db, this.now);
    if (row?.disbursement_transfer_id != null) await transfers.delete(row.disbursement_transfer_id);
    let transferId: number | null = null;
    if (disburses(input)) {
      transferId = await transfers.create({
        occurred_on: input.disbursedOn,
        description: input.name.trim() || null,
        from: { account_id: accountId, amount_minor: input.principalMinor },
        to: { account_id: input.disbursedIntoAccountId!, amount_minor: input.principalMinor },
        source: 'manual',
      });
    }
    await this.db.run('UPDATE loans SET disbursement_transfer_id = ? WHERE account_id = ?', [transferId, accountId]);
  }

  /** The terms, the base rate and the account's name, face and opening debt. */
  async update(accountId: number, input: LoanInput): Promise<void> {
    await this.db.transaction(async () => {
      await this.keepTypedUvr(input);
      const start = startOf(input, input.unit === 'UVR' ? await this.uvr() : undefined);
      await new AccountsRepository(this.db, this.now).update(accountId, {
        name: input.name.trim(),
        builtin_icon: input.builtinIcon,
        color: input.color,
        opening_balance_minor: disburses(input) ? 0 : -start.balanceMinor,
        opening_balance_base_minor: disburses(input) ? 0 : -start.balanceMinor,
        opened_on: start.on,
      });
      const timestamp = this.now();
      await this.db.run(
        `UPDATE loans SET principal_minor = ?, system = ?, rate_quoted = ?, rate_kind = ?, installments = ?,
           period_months = ?, disbursed_on = ?, first_due_on = ?, insurance_kind = ?, insurance_minor = ?,
           insurance_rate_scaled = ?, bank_installment_minor = ?, paid_from_account_id = ?, paid_before = ?,
           balance_after_before_minor = ?, unit = ?, decrease_scaled = ?, updated_at = ?
         WHERE account_id = ?`,
        [...termValues(input), timestamp, accountId],
      );
      // The first rate is the agreed one; later rows are changes and stay.
      const first = await this.db.queryOne<{ id: number }>(
        'SELECT id FROM loan_rates WHERE account_id = ? ORDER BY valid_from LIMIT 1', [accountId]);
      if (first) {
        await this.db.run('UPDATE loan_rates SET valid_from = ?, annual_rate_scaled = ? WHERE id = ?',
          [input.disbursedOn, input.annualRateScaled, first.id]);
      }
      await this.setDisbursement(accountId, input);
    });
  }

  /** A variable rate changed from a day on. */
  async setRateFrom(accountId: number, validFrom: string, annualRateScaled: number): Promise<void> {
    await this.db.run(
      `INSERT INTO loan_rates (account_id, valid_from, annual_rate_scaled, created_at) VALUES (?, ?, ?, ?)
       ON CONFLICT (account_id, valid_from) DO UPDATE SET annual_rate_scaled = excluded.annual_rate_scaled`,
      [accountId, validFrom, annualRateScaled, this.now()],
    );
  }

  async removeRate(accountId: number, validFrom: string): Promise<void> {
    await this.db.run('DELETE FROM loan_rates WHERE account_id = ? AND valid_from = ? AND valid_from > (SELECT MIN(valid_from) FROM loan_rates WHERE account_id = ?)',
      [accountId, validFrom, accountId]);
  }

  /**
   * One payment, whole: the capital as a transfer into the loan, the rest as
   * expenses of the account it came from, and the record that ties them.
   */
  async recordPayment(p: PaymentInput): Promise<number> {
    return this.db.transaction(async () => {
      const description = p.note?.trim() || null;
      // A loan in UVR: the capital in UVR, and the debt's growth by the UVR
      // since the last movement, worked out before anything is written.
      const loan = (await this.all()).find(l => l.account.id === p.loanAccountId);
      let capitalUvr: number | null = null;
      let adjust = 0;
      if (loan?.terms.unit === 'UVR' && loan.terms.uvr) {
        const value = loan.terms.uvr(p.paidOn)?.value ?? null;
        if (value) capitalUvr = Math.round(p.capitalMinor / 100 / value * UVR_MICRO);
        adjust = uvrAdjustmentOf(loan, p.paidOn);
      }
      let transferId: number | null = null;
      if (p.capitalMinor > 0) {
        transferId = await new TransfersRepository(this.db, this.now).create({
          occurred_on: p.paidOn,
          description,
          from: { account_id: p.fromAccountId, amount_minor: p.capitalMinor },
          to: { account_id: p.loanAccountId, amount_minor: p.capitalMinor },
          source: 'manual',
        });
      }
      const spend = async (amount: number, category: string, icon: string): Promise<number | null> => {
        if (amount <= 0) return null;
        return new TransactionsRepository(this.db, this.now).create({
          account_id: p.fromAccountId,
          category_id: await this.categoryId(category, icon),
          occurred_on: p.paidOn,
          amount_minor: -amount,
          description,
          source: 'manual',
        });
      };
      const interestTx = await spend(p.interestMinor, p.interestCategory, 'trending-up-outline');
      const insuranceTx = await spend(p.insuranceMinor, p.insuranceCategory, 'shield-checkmark-outline');
      const lateTx = await spend(p.lateMinor, p.interestCategory, 'trending-up-outline');
      // The debt grew (or, rarely, shrank) with the UVR: a movement of the loan's own account.
      let adjustTx: number | null = null;
      if (adjust !== 0) {
        adjustTx = await new TransactionsRepository(this.db, this.now).create({
          account_id: p.loanAccountId,
          category_id: await this.categoryId(p.uvrCategory ?? 'UVR', 'trending-up-outline'),
          occurred_on: p.paidOn,
          amount_minor: -adjust,
          description,
          source: 'manual',
        });
      }
      const result = await this.db.run(
        `INSERT INTO loan_payments (account_id, kind, number, paid_on, capital_minor, interest_minor, insurance_minor,
           late_minor, extra_mode, transfer_id, interest_tx_id, insurance_tx_id, late_tx_id, capital_uvr_micro,
           uvr_adjust_minor, uvr_adjust_tx_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [p.loanAccountId, p.kind, p.number, p.paidOn, p.capitalMinor, p.interestMinor, p.insuranceMinor,
          p.lateMinor, p.extraMode, transferId, interestTx, insuranceTx, lateTx, capitalUvr, adjust, adjustTx, this.now()],
      );
      return result.lastId!;
    });
  }

  /** A payment undone: its record and every movement it wrote. */
  async deletePayment(id: number): Promise<void> {
    await this.db.transaction(async () => {
      const row = await this.db.queryOne<{ id: number; transfer_id: number | null; interest_tx_id: number | null; insurance_tx_id: number | null; late_tx_id: number | null; uvr_adjust_tx_id: number | null }>(
        'SELECT id, transfer_id, interest_tx_id, insurance_tx_id, late_tx_id, uvr_adjust_tx_id FROM loan_payments WHERE id = ?', [id]);
      if (!row) return;
      const transferId = await undoLoanPayment(this.db, row);
      if (transferId !== null) await this.db.run('DELETE FROM transfers WHERE id = ?', [transferId]);
    });
  }

  /** The payment a movement or a transfer belongs to: which loan, which installment. */
  async paymentOf(link: { transferId?: number | null; transactionId?: number | null }): Promise<{ id: number; loanName: string; kind: LoanPayment['kind']; number: number | null } | null> {
    const found = await loanPaymentOf(this.db, link);
    if (!found) return null;
    return this.db.queryOne<{ id: number; loanName: string; kind: LoanPayment['kind']; number: number | null }>(
      `SELECT p.id, a.name AS loanName, p.kind, p.number FROM loan_payments p
       JOIN accounts a ON a.id = p.account_id WHERE p.id = ?`, [found.id]);
  }

  /** The UVR of any day: the values published or typed, and the IPC for the rest. */
  async uvr(): Promise<UvrLookup> {
    const [known, ipc] = await Promise.all([
      this.db.query<{ day: string; value_scaled: number; source: 'official' | 'typed' }>('SELECT day, value_scaled, source FROM uvr_values'),
      this.db.query<{ month: string; index_scaled: number }>('SELECT month, index_scaled FROM inflation_months'),
    ]);
    return uvrLookup({
      known: known.map(k => ({ day: k.day, valueScaled: k.value_scaled, source: k.source })),
      ipc: ipc.map(r => ({ month: r.month, index: r.index_scaled })),
    });
  }

  /** A UVR typed from a contract or a statement; it wins over what is worked out for that day. */
  async setUvr(day: string, valueScaled: number): Promise<void> {
    await this.db.run(
      `INSERT INTO uvr_values (day, value_scaled, source, created_at) VALUES (?, ?, 'typed', ?)
       ON CONFLICT (day) DO UPDATE SET value_scaled = excluded.value_scaled, source = 'typed'
       WHERE uvr_values.source = 'typed' OR uvr_values.value_scaled <> excluded.value_scaled`,
      [day, valueScaled, this.now()],
    );
  }

  private async keepTypedUvr(input: LoanInput): Promise<void> {
    if (input.unit === 'UVR' && input.disbursementUvrScaled) await this.setUvr(input.disbursedOn, input.disbursementUvrScaled);
  }

  /** For a loan in UVR: how much its debt in pesos grew by the UVR, up to `paidOn`, beyond what its account already says. */
  async uvrAdjustment(accountId: number, paidOn: string): Promise<number> {
    const loan = (await this.all()).find(l => l.account.id === accountId);
    return loan ? uvrAdjustmentOf(loan, paidOn) : 0;
  }

  /** The expense category of that name, made if it is missing. */
  private async categoryId(name: string, icon: string): Promise<number> {
    const categories = new CategoriesRepository(this.db, this.now);
    const found = await categories.findByName(name, 'expense');
    if (found) return found.id;
    return categories.create({ name, kind: 'expense', builtin_icon: icon, color: '#f6b93b' });
  }
}

/**
 * A loan in UVR: what is owed in UVR, at the UVR of `paidOn`, against the
 * debt its account carries. The difference is how much the UVR moved the
 * debt since the last movement. Nothing for a loan in pesos.
 */
export function uvrAdjustmentOf(loan: LoanRow, paidOn: string): number {
  if (loan.terms.unit !== 'UVR' || !loan.terms.uvr) return 0;
  const value = loan.terms.uvr(paidOn)?.value;
  if (!value) return 0;
  const owedUvr = loanSchedule(loan.terms, loan.payments, paidOn).balanceUvr ?? 0;
  return Math.round(owedUvr * value * 100) - -loan.ledgerMinor;
}

/** Where the app starts following a loan: at the disbursement, or after the installments already paid. */
function startOf(input: LoanInput, uvr?: UvrLookup): { on: string; balanceMinor: number } {
  if (input.paidBefore <= 0) return { on: input.disbursedOn, balanceMinor: input.principalMinor };
  const terms: LoanTerms = {
    unit: input.unit ?? 'COP', decreaseScaled: input.decreaseScaled ?? null, uvr,
    principalMinor: input.principalMinor, system: input.system, installments: input.installments,
    periodMonths: input.periodMonths, disbursedOn: input.disbursedOn, firstDueOn: input.firstDueOn,
    insuranceKind: input.insuranceKind, insuranceMinor: input.insuranceMinor,
    insuranceRateScaled: input.insuranceRateScaled, bankInstallmentMinor: input.bankInstallmentMinor,
    paidBefore: 0, balanceAfterBeforeMinor: null,
    rates: [{ validFrom: input.disbursedOn, annualRateScaled: input.annualRateScaled }],
  };
  const [y, m, d] = input.firstDueOn.split('-').map(Number);
  const at = new Date(Date.UTC(y, m - 1 + (input.paidBefore - 1) * input.periodMonths, 1));
  const last = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth() + 1, 0)).getUTCDate();
  const on = `${at.getUTCFullYear()}-${String(at.getUTCMonth() + 1).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`;
  if (input.unit === 'UVR' && input.balanceAfterBeforeMinor !== null) {
    // Stated in UVR: in pesos at that day's UVR.
    return { on, balanceMinor: Math.round(input.balanceAfterBeforeMinor / UVR_MICRO * (uvr?.(on)?.value ?? 0) * 100) };
  }
  return { on, balanceMinor: input.balanceAfterBeforeMinor ?? theoreticalBalance(terms, input.paidBefore) };
}

/** Whether the loan records its disbursement: only one the app follows from the start. */
function disburses(input: LoanInput): boolean {
  return input.disbursedIntoAccountId !== null && input.paidBefore <= 0;
}

function termValues(input: LoanInput): unknown[] {
  return [
    input.principalMinor, input.system, input.rateQuoted, input.rateKind, input.installments, input.periodMonths,
    input.disbursedOn, input.firstDueOn, input.insuranceKind, input.insuranceMinor, input.insuranceRateScaled,
    input.bankInstallmentMinor, input.paidFromAccountId, input.paidBefore, input.balanceAfterBeforeMinor,
    input.unit ?? 'COP', input.unit === 'UVR' && input.system === 'fixed_installment' ? (input.decreaseScaled ?? null) : null,
  ];
}
