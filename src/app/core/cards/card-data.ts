/**
 * What a card's page reads: its movements, for the statement, and the
 * account it is usually paid from, for "Pagar" (Jose, 2026-10-01: the
 * transfer opens from the account most used to pay that card, to the card,
 * with the usual note - which the form already offers for that route).
 *
 * Two queries, whatever the card holds.
 */

import type { SqlDriver } from '../database/sql-driver';
import type { AccountRow } from '../database/types';
import { AccountsRepository } from '../database/repositories/accounts.repository';
import { cardStatement, type CardMovement, type CardStatement } from './statement';

export async function cardMovements(db: SqlDriver, cardId: number): Promise<CardMovement[]> {
  return (await db.query<{ occurred_on: string; amount_minor: number }>(
    `SELECT occurred_on, amount_minor FROM transactions WHERE account_id = ? ORDER BY occurred_on, id`,
    [cardId],
  )).map(row => ({ onDate: row.occurred_on, amountMinor: row.amount_minor }));
}

/**
 * The live account that has sent the card the most transfers, the latest
 * winning a tie; null when nothing has paid it yet.
 */
export async function usualPayer(db: SqlDriver, cardId: number): Promise<number | null> {
  const row = await db.queryOne<{ account_id: number }>(
    `SELECT f.account_id
     FROM transactions f
     JOIN transactions t ON t.transfer_id = f.transfer_id AND t.id <> f.id
     JOIN accounts a ON a.id = f.account_id
     WHERE f.transfer_leg = 'from' AND t.account_id = ? AND f.account_id <> ? AND a.archived = 0
     GROUP BY f.account_id
     ORDER BY COUNT(*) DESC, MAX(f.occurred_on) DESC
     LIMIT 1`,
    [cardId, cardId],
  );
  return row?.account_id ?? null;
}

/** The figures typed from the bank's statements, by card and cut-off day. */
export async function bankFigures(db: SqlDriver): Promise<Map<number, Map<string, number>>> {
  const out = new Map<number, Map<string, number>>();
  for (const row of await db.query<{ account_id: number; cut_on: string; amount_minor: number }>(
    'SELECT account_id, cut_on, amount_minor FROM card_statements')) {
    const card = out.get(row.account_id) ?? new Map<string, number>();
    card.set(row.cut_on, row.amount_minor);
    out.set(row.account_id, card);
  }
  return out;
}

/** Keeps what the bank's statement says a card owes at a cut-off, replacing an earlier figure. */
export async function setBankFigure(
  db: SqlDriver, accountId: number, cutOn: string, amountMinor: number, now = new Date().toISOString(),
): Promise<void> {
  await db.run(
    `INSERT INTO card_statements (account_id, cut_on, amount_minor, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(account_id, cut_on) DO UPDATE SET amount_minor = excluded.amount_minor, updated_at = excluded.updated_at`,
    [accountId, cutOn, amountMinor, now, now]);
}

/** Back to what the movements say for that statement. */
export async function clearBankFigure(db: SqlDriver, accountId: number, cutOn: string): Promise<void> {
  await db.run('DELETE FROM card_statements WHERE account_id = ? AND cut_on = ?', [accountId, cutOn]);
}

/** Every live card with what it owes and its statement, for Deudas and Más. */
export interface CardSummary {
  account: AccountRow;
  balanceMinor: number;
  availableMinor: number | null;
  statement: CardStatement;
}

export async function loadCards(db: SqlDriver, today: string): Promise<CardSummary[]> {
  const balances = await new AccountsRepository(db).balances();
  const cards = balances.filter(b => b.account.type === 'credit' && !b.account.archived);
  const typed = await bankFigures(db);
  return Promise.all(cards.map(async balance => ({
    account: balance.account,
    balanceMinor: balance.balance_minor,
    availableMinor: balance.available_credit_minor,
    statement: cardStatement({
      statementDay: balance.account.statement_day,
      dueDay: balance.account.due_day,
      today,
      openingMinor: balance.account.opening_balance_minor,
      movements: await cardMovements(db, balance.account.id),
      bankFigures: typed.get(balance.account.id),
    }),
  })));
}
