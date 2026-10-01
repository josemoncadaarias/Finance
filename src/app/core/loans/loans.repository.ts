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
import { theoreticalBalance, type ExtraMode, type LoanPayment, type LoanSystem, type LoanTerms } from './schedule';

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
}

export interface LoanRow {
  account: AccountRow;
  rateQuoted: 'ea' | 'mv';
  rateKind: 'fixed' | 'variable';
  paidFromAccountId: number | null;
  terms: LoanTerms;
  payments: (LoanPayment & { id: number; transferId: number | null })[];
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
    const [terms, rates, payments, accounts] = await Promise.all([
      this.db.query<TermsRow>('SELECT * FROM loans'),
      this.db.query<{ account_id: number; valid_from: string; annual_rate_scaled: number }>(
        'SELECT account_id, valid_from, annual_rate_scaled FROM loan_rates ORDER BY valid_from'),
      this.db.query<{
        id: number; account_id: number; kind: LoanPayment['kind']; number: number | null; paid_on: string;
        capital_minor: number; interest_minor: number; insurance_minor: number; late_minor: number;
        extra_mode: ExtraMode | null; transfer_id: number | null;
      }>('SELECT * FROM loan_payments ORDER BY paid_on, id'),
      new AccountsRepository(this.db).list({ includeArchived: true }),
    ]);
    const accountOf = new Map(accounts.map(a => [a.id, a]));
    return terms.filter(t => accountOf.has(t.account_id)).map(t => ({
      account: accountOf.get(t.account_id)!,
      rateQuoted: t.rate_quoted,
      rateKind: t.rate_kind,
      paidFromAccountId: t.paid_from_account_id,
      terms: {
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
      })),
    }));
  }

  async create(input: LoanInput): Promise<number> {
    return this.db.transaction(async () => {
      const start = startOf(input);
      const accountId = await new AccountsRepository(this.db, this.now).create({
        name: input.name.trim(),
        type: 'debit',
        currency_code: 'COP',
        builtin_icon: input.builtinIcon,
        color: input.color,
        opening_balance_minor: -start.balanceMinor,
        opening_balance_base_minor: -start.balanceMinor,
        opened_on: start.on,
      });
      const timestamp = this.now();
      await this.db.run(
        `INSERT INTO loans (account_id, principal_minor, system, rate_quoted, rate_kind, installments, period_months,
           disbursed_on, first_due_on, insurance_kind, insurance_minor, insurance_rate_scaled, bank_installment_minor,
           paid_from_account_id, paid_before, balance_after_before_minor, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [accountId, ...termValues(input), timestamp, timestamp],
      );
      await this.db.run(
        'INSERT INTO loan_rates (account_id, valid_from, annual_rate_scaled, created_at) VALUES (?, ?, ?, ?)',
        [accountId, input.disbursedOn, input.annualRateScaled, timestamp],
      );
      return accountId;
    });
  }

  /** The terms, the base rate and the account's name, face and opening debt. */
  async update(accountId: number, input: LoanInput): Promise<void> {
    await this.db.transaction(async () => {
      const start = startOf(input);
      await new AccountsRepository(this.db, this.now).update(accountId, {
        name: input.name.trim(),
        builtin_icon: input.builtinIcon,
        color: input.color,
        opening_balance_minor: -start.balanceMinor,
        opening_balance_base_minor: -start.balanceMinor,
        opened_on: start.on,
      });
      const timestamp = this.now();
      await this.db.run(
        `UPDATE loans SET principal_minor = ?, system = ?, rate_quoted = ?, rate_kind = ?, installments = ?,
           period_months = ?, disbursed_on = ?, first_due_on = ?, insurance_kind = ?, insurance_minor = ?,
           insurance_rate_scaled = ?, bank_installment_minor = ?, paid_from_account_id = ?, paid_before = ?,
           balance_after_before_minor = ?, updated_at = ?
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
      const result = await this.db.run(
        `INSERT INTO loan_payments (account_id, kind, number, paid_on, capital_minor, interest_minor, insurance_minor,
           late_minor, extra_mode, transfer_id, interest_tx_id, insurance_tx_id, late_tx_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [p.loanAccountId, p.kind, p.number, p.paidOn, p.capitalMinor, p.interestMinor, p.insuranceMinor,
          p.lateMinor, p.extraMode, transferId, interestTx, insuranceTx, lateTx, this.now()],
      );
      return result.lastId!;
    });
  }

  /** A payment undone: its record and every movement it wrote. */
  async deletePayment(id: number): Promise<void> {
    await this.db.transaction(async () => {
      const row = await this.db.queryOne<{ transfer_id: number | null; interest_tx_id: number | null; insurance_tx_id: number | null; late_tx_id: number | null }>(
        'SELECT transfer_id, interest_tx_id, insurance_tx_id, late_tx_id FROM loan_payments WHERE id = ?', [id]);
      if (!row) return;
      await this.db.run('DELETE FROM loan_payments WHERE id = ?', [id]);
      for (const tx of [row.interest_tx_id, row.insurance_tx_id, row.late_tx_id]) {
        if (tx !== null) await this.db.run('DELETE FROM transactions WHERE id = ?', [tx]);
      }
      if (row.transfer_id !== null) await new TransfersRepository(this.db, this.now).delete(row.transfer_id);
    });
  }

  /** The expense category of that name, made if it is missing. */
  private async categoryId(name: string, icon: string): Promise<number> {
    const categories = new CategoriesRepository(this.db, this.now);
    const found = await categories.findByName(name, 'expense');
    if (found) return found.id;
    return categories.create({ name, kind: 'expense', builtin_icon: icon, color: '#f6b93b' });
  }
}

/** Where the app starts following a loan: at the disbursement, or after the installments already paid. */
function startOf(input: LoanInput): { on: string; balanceMinor: number } {
  if (input.paidBefore <= 0) return { on: input.disbursedOn, balanceMinor: input.principalMinor };
  const terms: LoanTerms = {
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
  return { on, balanceMinor: input.balanceAfterBeforeMinor ?? theoreticalBalance(terms, input.paidBefore) };
}

function termValues(input: LoanInput): unknown[] {
  return [
    input.principalMinor, input.system, input.rateQuoted, input.rateKind, input.installments, input.periodMonths,
    input.disbursedOn, input.firstDueOn, input.insuranceKind, input.insuranceMinor, input.insuranceRateScaled,
    input.bankInstallmentMinor, input.paidFromAccountId, input.paidBefore, input.balanceAfterBeforeMinor,
  ];
}
