// Loans written and read (core/loans/loans.repository.ts): the account opened
// at what was owed, a payment written whole and undone whole.
//
//   node --import ./tools/db/register-ts.mjs --test tools/db/loans.test.mjs

import test from 'node:test';
import assert from 'node:assert/strict';

import { NodeSqlDriver } from './node-sql-driver.mjs';
import { migrate } from '../../src/app/core/database/migrations/migration-runner.ts';
import { MIGRATION_SOURCES } from '../../src/app/core/database/migrations/statements.generated.ts';
import { AccountsRepository } from '../../src/app/core/database/repositories/accounts.repository.ts';
import { TransfersRepository } from '../../src/app/core/database/repositories/transfers.repository.ts';
import { TransactionsRepository } from '../../src/app/core/database/repositories/transactions.repository.ts';
import { LoansRepository } from '../../src/app/core/loans/loans.repository.ts';
import { loanSchedule } from '../../src/app/core/loans/schedule.ts';

const NOW = () => '2026-10-01T12:00:00Z';
const CAR = {
  name: 'Crédito del carro', builtinIcon: 'car-sport-outline', color: '#4cb8f5',
  principalMinor: 60_000_000_00, annualRateScaled: 165_000, rateQuoted: 'ea', rateKind: 'fixed',
  system: 'fixed_installment', installments: 60, periodMonths: 1, disbursedOn: '2024-10-10', firstDueOn: '2024-11-10',
  insuranceKind: 'fixed', insuranceMinor: 42_000_00, insuranceRateScaled: 0, bankInstallmentMinor: null,
  paidFromAccountId: null, paidBefore: 23, balanceAfterBeforeMinor: null, disbursedIntoAccountId: null,
};

async function world() {
  const db = new NodeSqlDriver();
  await migrate(db, MIGRATION_SOURCES);
  const accounts = new AccountsRepository(db, NOW);
  const bank = await accounts.create({ name: 'Banco Azul', type: 'debit', currency_code: 'COP', builtin_icon: 'wallet', opening_balance_minor: 100_000_000_00, opened_on: '2024-01-01' });
  const loans = new LoansRepository(db, NOW);
  const id = await loans.create({ ...CAR, paidFromAccountId: bank });
  const balance = async account => (await accounts.balances({ includeArchived: true })).find(b => b.account.id === account).balance_minor;
  return { db, accounts, loans, bank, id, balance };
}

const payment = (w, extra) => ({
  loanAccountId: w.id, fromAccountId: w.bank, kind: 'installment', number: 24, paidOn: '2026-10-10',
  capitalMinor: 898_619_34, interestMinor: 540_446_62, insuranceMinor: 42_000_00, lateMinor: 0, extraMode: null,
  note: 'Cuota crédito del carro', interestCategory: 'Intereses', insuranceCategory: 'Seguros', ...extra,
});

test('a loan begun before the app opens its account at what is owed after the paid installments', async () => {
  const w = await world();
  assert.equal(await w.balance(w.id), -42_195_732_51);
  const [loan] = await w.loans.all();
  assert.equal(loan.account.opened_on, '2026-09-10');
  assert.equal(loan.terms.paidBefore, 23);
  assert.deepEqual(loan.terms.rates, [{ validFrom: '2024-10-10', annualRateScaled: 165_000 }]);
  assert.deepEqual(await w.loans.ids(), [w.id]);
});

test('an installment: the capital moves into the loan, interest and insurance are spent', async () => {
  const w = await world();
  await w.loans.recordPayment(payment(w));
  assert.equal(await w.balance(w.id), -41_297_113_17);
  assert.equal(await w.balance(w.bank), 100_000_000_00 - 1_481_065_96);
  const spent = await w.db.query(`SELECT c.name, t.amount_minor FROM transactions t JOIN categories c ON c.id = t.category_id WHERE t.account_id = ? ORDER BY c.name`, [w.bank]);
  assert.deepEqual(spent.map(r => ({ ...r })), [{ name: 'Intereses', amount_minor: -540_446_62 }, { name: 'Seguros', amount_minor: -42_000_00 }]);
  const [loan] = await w.loans.all();
  const s = loanSchedule(loan.terms, loan.payments, '2026-10-11');
  assert.equal(s.paidCount, 24);
  assert.equal(s.balanceMinor, 41_297_113_17);
});

test('a payment ahead, and the schedule after it', async () => {
  const w = await world();
  await w.loans.recordPayment(payment(w));
  await w.loans.recordPayment(payment(w, { kind: 'extra', number: null, capitalMinor: 5_000_000_00, interestMinor: 0, insuranceMinor: 0, extraMode: 'term' }));
  assert.equal(await w.balance(w.id), -36_297_113_17);
  const [loan] = await w.loans.all();
  assert.equal(loanSchedule(loan.terms, loan.payments, '2026-10-11').lastDueOn, '2029-05-10');
});

test('a payment undone takes every movement it wrote with it', async () => {
  const w = await world();
  const id = await w.loans.recordPayment(payment(w));
  await w.loans.deletePayment(id);
  assert.equal(await w.balance(w.id), -42_195_732_51);
  assert.equal(await w.balance(w.bank), 100_000_000_00);
  assert.equal((await w.loans.all())[0].payments.length, 0);
});

test('editing the terms moves the opening debt with them', async () => {
  const w = await world();
  await w.loans.update(w.id, { ...CAR, balanceAfterBeforeMinor: 42_000_000_00 });
  assert.equal(await w.balance(w.id), -42_000_000_00);
  await w.loans.setRateFrom(w.id, '2027-01-10', 180_000);
  const [loan] = await w.loans.all();
  assert.equal(loan.terms.rates.length, 2);
  await w.loans.removeRate(w.id, '2024-10-10');
  assert.equal((await w.loans.all())[0].terms.rates.length, 2, 'the agreed rate cannot be removed');
});

test('deleting the loan account takes its terms and payments', async () => {
  const w = await world();
  await w.accounts.deleteWithHistory(w.id);
  assert.equal((await w.loans.all()).length, 0);
});

// Item 1 of what loans did not do yet (Jose, 2026-10-01): a piece of a
// payment removed from Inicio removes the whole payment.
test('deleting the capital transfer of an installment from Inicio undoes the whole payment', async () => {
  const w = await world();
  await w.loans.recordPayment(payment(w));
  const transferId = (await w.loans.all())[0].payments[0].transferId;
  assert.deepEqual({ ...(await w.loans.paymentOf({ transferId })) }, { id: 1, loanName: 'Crédito del carro', kind: 'installment', number: 24 });
  await new TransfersRepository(w.db, NOW).delete(transferId);
  assert.equal(await w.balance(w.bank), 100_000_000_00, 'interest and insurance went too');
  assert.equal(await w.balance(w.id), -42_195_732_51);
  assert.equal((await w.loans.all())[0].payments.length, 0);
});

test('deleting the interest of an installment from Inicio undoes the whole payment', async () => {
  const w = await world();
  await w.loans.recordPayment(payment(w));
  const interest = await w.db.queryOne(`SELECT interest_tx_id AS id FROM loan_payments`);
  assert.equal((await w.loans.paymentOf({ transactionId: interest.id })).number, 24);
  await new TransactionsRepository(w.db, NOW).delete(interest.id);
  assert.equal(await w.balance(w.bank), 100_000_000_00);
  assert.equal(await w.balance(w.id), -42_195_732_51);
  assert.equal((await w.db.query('SELECT * FROM transfers')).length, 0);
});

test('a movement that is not a loan payment belongs to none', async () => {
  const w = await world();
  const id = await new TransactionsRepository(w.db, NOW).create({ account_id: w.bank, category_id: null, occurred_on: '2026-10-01', amount_minor: 1_00, source: 'manual' }).catch(() => null);
  assert.equal(await w.loans.paymentOf({ transactionId: id ?? 999 }), null);
});

// Item 2: where the money arrived.
test('a loan that records its disbursement starts at zero and the transfer makes the debt', async () => {
  const w = await world();
  const fresh = await w.loans.create({ ...CAR, name: 'Libre inversión', paidBefore: 0, disbursedOn: '2026-09-01', firstDueOn: '2026-10-01', disbursedIntoAccountId: w.bank });
  assert.equal(await w.balance(fresh), -60_000_000_00);
  assert.equal(await w.balance(w.bank), 160_000_000_00);
  const loan = (await w.loans.all()).find(l => l.account.id === fresh);
  assert.equal(loan.disbursedIntoAccountId, w.bank);

  // Changing the amount writes the transfer again; taking the account away removes it.
  await w.loans.update(fresh, { ...CAR, name: 'Libre inversión', paidBefore: 0, disbursedOn: '2026-09-01', firstDueOn: '2026-10-01', principalMinor: 50_000_000_00, disbursedIntoAccountId: w.bank });
  assert.equal(await w.balance(fresh), -50_000_000_00);
  assert.equal(await w.balance(w.bank), 150_000_000_00);
  await w.loans.update(fresh, { ...CAR, name: 'Libre inversión', paidBefore: 0, disbursedOn: '2026-09-01', firstDueOn: '2026-10-01', principalMinor: 50_000_000_00, disbursedIntoAccountId: null });
  assert.equal(await w.balance(fresh), -50_000_000_00);
  assert.equal(await w.balance(w.bank), 100_000_000_00);
  assert.equal((await w.loans.all()).find(l => l.account.id === fresh).disbursedIntoAccountId, null);
});

test('a loan begun before the app never records a disbursement', async () => {
  const w = await world();
  const old = await w.loans.create({ ...CAR, name: 'Viejo', disbursedIntoAccountId: w.bank });
  assert.equal(await w.balance(old), -42_195_732_51);
  assert.equal(await w.balance(w.bank), 100_000_000_00);
});
