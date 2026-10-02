// A credit card's statement, worked out from its movements (core/cards/).
//
//   node --import ./tools/db/register-ts.mjs --test tools/db/card-statement.test.mjs
//
// Debts, part 1 (Jose, 2026-10-01): a card with a cut-off day and a payment
// day says what the last statement holds, what is left of it and until when.

import test from 'node:test';
import assert from 'node:assert/strict';

import { NodeSqlDriver } from './node-sql-driver.mjs';
import { migrate } from '../../src/app/core/database/migrations/migration-runner.ts';
import { MIGRATION_SOURCES } from '../../src/app/core/database/migrations/statements.generated.ts';
import { AccountsRepository } from '../../src/app/core/database/repositories/accounts.repository.ts';
import { TransfersRepository } from '../../src/app/core/database/repositories/transfers.repository.ts';
import { cardStatement, lastCutBefore, dueAfter } from '../../src/app/core/cards/statement.ts';
import { bankFigures, cardMovements, clearBankFigure, loadCards, setBankFigure, usualPayer } from '../../src/app/core/cards/card-data.ts';

const buy = (onDate, pesos) => ({ onDate, amountMinor: -pesos * 100 });
const pay = (onDate, pesos) => ({ onDate, amountMinor: pesos * 100 });
const card = (today, movements, days = [25, 10]) => cardStatement({
  statementDay: days[0], dueDay: days[1], today, openingMinor: 0, movements,
});

// Cut-off on the 25th, paid by the 10th: 598,400 owed at the close of 25 Sep,
// 143,900 bought after it.
const SEPT = [buy('2026-09-03', 400_000), buy('2026-09-25', 198_400), buy('2026-09-28', 143_900)];

test('the cut-off day is still open until it ends', () => {
  assert.equal(lastCutBefore(25, '2026-09-25'), '2026-08-25');
  assert.equal(lastCutBefore(25, '2026-09-26'), '2026-09-25');
  assert.equal(lastCutBefore(25, '2026-01-10'), '2025-12-25');
});

test('a day past the end of a short month is its last day', () => {
  assert.equal(lastCutBefore(31, '2026-10-05'), '2026-09-30');
  assert.equal(lastCutBefore(30, '2026-03-05'), '2026-02-28');
  assert.equal(dueAfter('2026-01-31', 30), '2026-02-28');
});

test('the payment day is the first one after the cut-off', () => {
  assert.equal(dueAfter('2026-09-25', 10), '2026-10-10');
  assert.equal(dueAfter('2026-09-05', 20), '2026-09-20');
  assert.equal(dueAfter('2026-09-15', 15), '2026-10-15');
});

test('due: the statement, what went after it, and the days left', () => {
  const s = card('2026-10-01', SEPT);
  assert.equal(s.state, 'due');
  assert.equal(s.cutOn, '2026-09-25');
  assert.equal(s.dueOn, '2026-10-10');
  assert.equal(s.nextCutOn, '2026-10-25');
  assert.equal(s.statementMinor, 598_400_00, 'a purchase on the cut-off day itself is in it');
  assert.equal(s.afterCutMinor, 143_900_00);
  assert.equal(s.debtMinor, 742_300_00);
  assert.equal(s.remainingMinor, 598_400_00);
  assert.equal(s.daysLeft, 9);
});

test('paid in part: what is left', () => {
  const s = card('2026-10-02', [...SEPT, pay('2026-10-02', 400_000)]);
  assert.equal(s.state, 'partial');
  assert.equal(s.paidMinor, 400_000_00);
  assert.equal(s.remainingMinor, 198_400_00);
  assert.equal(s.lastPaidOn, '2026-10-02');
});

test('paid in full, even with purchases after the cut-off', () => {
  const s = card('2026-10-06', [...SEPT, pay('2026-10-06', 598_400)]);
  assert.equal(s.state, 'paid');
  assert.equal(s.remainingMinor, 0);
  assert.equal(s.debtMinor, 143_900_00);
});

test('overdue once the payment day has passed with something left', () => {
  const s = card('2026-10-12', [...SEPT, pay('2026-10-02', 400_000)]);
  assert.equal(s.state, 'overdue');
  assert.equal(s.remainingMinor, 198_400_00);
  assert.equal(s.daysLeft, -2);
  assert.equal(card('2026-10-10', SEPT).state, 'due', 'the payment day itself is still in time');
});

test('a payment before the cut-off is already inside the statement', () => {
  const s = card('2026-10-01', [buy('2026-09-03', 500_000), pay('2026-09-20', 500_000), buy('2026-09-28', 50_000)]);
  assert.equal(s.state, 'nothingDue');
  assert.equal(s.statementMinor, 0);
  assert.equal(s.debtMinor, 50_000_00);
});

test('nothing owed', () => {
  assert.equal(card('2026-10-01', []).state, 'clear');
  assert.equal(card('2026-10-01', [buy('2026-09-03', 1_000), pay('2026-09-04', 1_000)]).state, 'clear');
});

test('without both days there is no statement, only the debt', () => {
  const s = card('2026-10-01', SEPT, [25, null]);
  assert.equal(s.state, 'noDates');
  assert.equal(s.debtMinor, 742_300_00);
  assert.equal(s.cutOn, null);
});

test('a movement dated after today is not counted yet', () => {
  const s = card('2026-10-01', [...SEPT, pay('2026-10-05', 598_400)]);
  assert.equal(s.state, 'due');
});

test('the card is paid from the account that pays it most, the newest winning a tie', async () => {
  const db = new NodeSqlDriver();
  await migrate(db, MIGRATION_SOURCES);
  const NOW = () => '2026-10-01T12:00:00Z';
  const accounts = new AccountsRepository(db, NOW);
  const make = (name, type = 'debit') => accounts.create({
    name, type, currency_code: 'COP', builtin_icon: 'card', opened_on: '2024-01-01',
  });
  const a = await make('Banco A');
  const b = await make('Banco B');
  const c = await make('Tarjeta', 'credit');
  await accounts.update(c, { statement_day: 25, due_day: 10 });
  const transfers = new TransfersRepository(db, NOW);
  const move = (from, to, on) => transfers.create({
    occurred_on: on, from: { account_id: from, amount_minor: 10_00 }, to: { account_id: to, amount_minor: 10_00 },
  });
  assert.equal(await usualPayer(db, c), null);
  await move(a, c, '2026-08-01');
  await move(b, c, '2026-09-01');
  assert.equal(await usualPayer(db, c), b, 'a tie: the latest');
  await move(a, c, '2026-09-02');
  await move(c, b, '2026-09-03');
  assert.equal(await usualPayer(db, c), a, 'money leaving the card does not count');
  assert.deepEqual((await cardMovements(db, c)).map(m => m.amountMinor), [10_00, 10_00, 10_00, -10_00]);
  const saved = await accounts.findById(c);
  assert.equal(saved.statement_day, 25);
  assert.equal(saved.due_day, 10);
});

// Jose's Rappi Card, 30 September 2026: the bank's statement says 34,591.00,
// the movements 98,606.99 - two purchases of the cut-off day the bank posted
// on the next statement (Claro 40,799.99 and Didi 23,216.00).
const RAPPI = [
  buy('2026-09-29', 1_034_591), pay('2026-09-30', 1_000_000),
  { onDate: '2026-09-30', amountMinor: -4_079_999 }, buy('2026-09-30', 23_216),
  buy('2026-10-01', 32_999),
];
const rappi = (today, figures) => cardStatement({
  statementDay: 30, dueDay: 10, today, openingMinor: 0, movements: RAPPI, bankFigures: figures,
});

test('without the bank\'s figure the statement is what the movements say', () => {
  const s = rappi('2026-10-02');
  assert.equal(s.statementMinor, 9_860_699);
  assert.equal(s.computedMinor, 9_860_699);
  assert.equal(s.bankMinor, null);
  assert.equal(s.differenceMinor, 0);
  assert.equal(s.cutDayCount, 2);
  assert.equal(s.cutDayMinor, 6_401_599);
});

test('the bank\'s figure is the statement, and the app\'s is kept beside it', () => {
  const s = rappi('2026-10-02', new Map([['2026-09-30', 3_459_100]]));
  assert.equal(s.statementMinor, 3_459_100);
  assert.equal(s.remainingMinor, 3_459_100);
  assert.equal(s.computedMinor, 9_860_699);
  assert.equal(s.differenceMinor, 6_401_599, 'exactly the two purchases of the cut-off day');
  assert.equal(s.cutDayMinor, s.differenceMinor);
  assert.equal(s.state, 'due');
  // Owed today: 98,606.99 + 32,999 = 131,605.99; of it 34,591 is this statement, the rest the next.
  assert.equal(s.debtMinor, 13_160_599);
  assert.equal(s.afterCutMinor, 13_160_599 - 3_459_100);
});

test('paying the bank\'s figure pays the statement', () => {
  const movements = [...RAPPI, pay('2026-10-05', 34_591)];
  const s = cardStatement({ statementDay: 30, dueDay: 10, today: '2026-10-06', openingMinor: 0, movements,
    bankFigures: new Map([['2026-09-30', 3_459_100]]) });
  assert.equal(s.state, 'paid');
  assert.equal(s.remainingMinor, 0);
});

test('a figure belongs to its statement only: the next cut-off goes back to the movements', () => {
  const s = rappi('2026-11-02', new Map([['2026-09-30', 3_459_100]]));
  assert.equal(s.cutOn, '2026-10-30');
  assert.equal(s.bankMinor, null);
});

test('the bank\'s figure is kept, replaced, travels to the card and can be cleared', async () => {
  const db = new NodeSqlDriver();
  await migrate(db, MIGRATION_SOURCES);
  const id = await new AccountsRepository(db).create({
    name: 'Tarjeta', type: 'credit', currency_code: 'COP', builtin_icon: 'card', opened_on: '2026-01-01',
    opening_balance_minor: 0, statement_day: 30, due_day: 10,
  });
  await setBankFigure(db, id, '2026-09-30', 100);
  await setBankFigure(db, id, '2026-09-30', 3_459_100);
  assert.equal((await bankFigures(db)).get(id).get('2026-09-30'), 3_459_100);
  const [summary] = await loadCards(db, '2026-10-02');
  assert.equal(summary.statement.bankMinor, 3_459_100);
  await clearBankFigure(db, id, '2026-09-30');
  assert.equal((await bankFigures(db)).size, 0);
  const { TABLES } = await import('../../src/app/core/database/export/export-backup.ts');
  assert.ok(TABLES.includes('card_statements'));
});
