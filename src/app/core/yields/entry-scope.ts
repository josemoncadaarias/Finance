/**
 * "¿Qué cambia?": what an income or a spending on an account with products
 * changes, asked the same way wherever the movement is made.
 *
 *   - `both`: the product and net worth - an ordinary movement of the
 *     account, filed on the product. A salary, a purchase.
 *   - `product`: the product alone - a `product_entries` row and no movement,
 *     so net worth does not move. A cashback or a gain the person does not
 *     want counted yet (rule 15).
 *   - `netWorth`: net worth alone - money the product already holds, cashed
 *     into the account: a movement plus its other half on the product, so the
 *     product's balance stays where it was.
 *
 * Jose, 2026-09-28: the question used to live only in the products screen's
 * form, where an income started on "the product alone"; the movement form of
 * Inicio and Cuentas never asked, and counted everything in net worth. Now
 * both forms ask whenever the account has products, and the answer starts on
 * the person's habit - the answer they gave last for the same account,
 * category and side - or on `both` where there is none. So a salary costs no
 * tap, and a cashback is answered once and then remembered.
 *
 * Generic: it reads only the person's own rows, whatever anything is called.
 */

import type { SqlDriver } from '../database/sql-driver';
import { TransactionsRepository } from '../database/repositories/transactions.repository';
import type { YieldsRepository } from '../database/repositories/yields.repository';
import type { TranslationKey } from '../i18n/translations';

export type EntryScope = 'product' | 'both' | 'netWorth';

/** With no habit to follow: an ordinary movement, counted in net worth. */
export const DEFAULT_SCOPE: EntryScope = 'both';

/** How many of the latest answers the habit is read from. */
const LATEST = 5;

/** The words of each answer, as translation keys, in the order they are offered. */
export function scopeOptionKeys(kind: 'income' | 'expense'): readonly { id: EntryScope; name: TranslationKey; detail: TranslationKey }[] {
  const expense = kind === 'expense';
  return [
    { id: 'product', name: 'products.entry.scope.product', detail: 'products.entry.scope.product.hint' },
    { id: 'both', name: 'products.entry.scope.both', detail: 'products.entry.scope.both.hint' },
    {
      id: 'netWorth',
      name: expense ? 'products.entry.scope.netWorthExpense' : 'products.entry.scope.netWorthIncome',
      detail: expense ? 'products.entry.scope.netWorthExpense.hint' : 'products.entry.scope.netWorthIncome.hint',
    },
  ];
}

/**
 * The answer this person usually gives for the same account, category and
 * side: the commonest of their latest few, the newest winning a tie. One
 * answer is already a habit - it was a deliberate choice, and the next one is
 * one tap away. `DEFAULT_SCOPE` with no category or no history.
 *
 * Each past row says its own answer by its shape:
 *   - a product entry with no movement is `product`;
 *   - a movement whose other half is on the product (a cash-out for an
 *     income, an entry for a spending) is `netWorth`;
 *   - any other income or spending of the account is `both`.
 */
export async function usualScope(
  db: SqlDriver,
  context: { accountId: number; side: 'in' | 'out'; categoryId: number | null },
): Promise<EntryScope> {
  if (context.categoryId === null) return DEFAULT_SCOPE;
  const sign = context.side === 'in' ? '>' : '<';
  const halves = `SELECT transaction_id FROM product_entries WHERE transaction_id IS NOT NULL
                  UNION SELECT transaction_id FROM product_cashouts WHERE transaction_id IS NOT NULL`;
  const rows = await db.query<{ scope: EntryScope }>(
    `SELECT scope FROM (
       SELECT 'product' AS scope, on_date AS day, created_at AS at FROM product_entries
        WHERE account_id = ? AND category_id = ? AND transaction_id IS NULL AND amount_minor ${sign} 0
       UNION ALL
       SELECT CASE WHEN id IN (${halves}) THEN 'netWorth' ELSE 'both' END, occurred_on, created_at
         FROM transactions
        WHERE account_id = ? AND category_id = ? AND transfer_id IS NULL AND amount_minor ${sign} 0
     ) ORDER BY day DESC, at DESC LIMIT ${LATEST}`,
    [context.accountId, context.categoryId, context.accountId, context.categoryId],
  );
  if (rows.length === 0) return DEFAULT_SCOPE;
  const times = new Map<EntryScope, number>();
  for (const row of rows) times.set(row.scope, (times.get(row.scope) ?? 0) + 1);
  // Newest first, so the first to reach the most is the newest of a tie.
  const most = Math.max(...times.values());
  return rows.find(row => times.get(row.scope) === most)!.scope;
}

/**
 * Writes a NEW income or spending with its answer. The caller runs it inside
 * a transaction and then works the account's days out again from `onDate`.
 * Shared by the movement form and the products screen's form, so the three
 * shapes are written one way.
 */
export async function writeScoped(db: SqlDriver, yields: YieldsRepository, input: {
  scope: EntryScope;
  kind: 'income' | 'expense';
  accountId: number;
  categoryId: number | null;
  /** The product it lands in or leaves from. */
  productId: number | null;
  /** The product the movement names: null on an account with one product. */
  movementProductId: number | null;
  onDate: string;
  amountMinor: number;
  note: string | null;
}): Promise<void> {
  // The sign comes from the button pressed, never from what was typed.
  const signed = input.kind === 'expense' ? -input.amountMinor : input.amountMinor;

  if (input.scope === 'product') {
    await yields.adjust({
      account_id: input.accountId, on_date: input.onDate, amount_minor: signed,
      kind: 'other', category_id: input.categoryId, product_id: input.productId, note: input.note,
    });
    return;
  }

  const transactionId = await new TransactionsRepository(db).create({
    account_id: input.accountId,
    category_id: input.categoryId,
    product_id: input.movementProductId,
    occurred_on: input.onDate,
    amount_minor: signed,
    description: input.note,
    source: 'manual',
  });
  if (input.scope !== 'netWorth') return;

  // The movement put the money in the product; it was already there. So the
  // same amount leaves what the product had gathered - or, for a spending,
  // goes back into it - and its balance does not move.
  if (input.kind === 'income') {
    await yields.withdraw({
      account_id: input.accountId, on_date: input.onDate, amount_minor: input.amountMinor,
      transaction_id: transactionId, product_id: input.productId, note: input.note,
    });
  } else {
    await yields.adjust({
      account_id: input.accountId, on_date: input.onDate, amount_minor: input.amountMinor,
      kind: 'other', product_id: input.productId, note: input.note, transaction_id: transactionId,
    });
  }
}

/**
 * The answer a movement already on record carries, read off its rows: one
 * with its other half on a product (a cash-out or an entry naming it) is
 * `netWorth`, any other one `both`. A product's own entry, with no movement,
 * is `product` and is corrected from the products screen.
 */
export async function scopeOfMovement(db: SqlDriver, transactionId: number): Promise<EntryScope> {
  const half = await db.queryOne<{ n: number }>(
    `SELECT (SELECT COUNT(*) FROM product_cashouts WHERE transaction_id = ?)
          + (SELECT COUNT(*) FROM product_entries WHERE transaction_id = ?) AS n`,
    [transactionId, transactionId]);
  return (half?.n ?? 0) > 0 ? 'netWorth' : 'both';
}

/**
 * A movement corrected into another shape (Jose, 2026-10-06: "¿Qué cambia?"
 * could not be changed afterwards). It is written again from scratch, the
 * way the products screen corrects its own: the movement goes with its half,
 * and the new shape is written. The caller runs it inside a transaction and
 * works the days out again from the earlier of the two dates.
 */
export async function rewriteScoped(
  db: SqlDriver, yields: YieldsRepository, transactionId: number, input: Parameters<typeof writeScoped>[2],
): Promise<void> {
  await new TransactionsRepository(db).delete(transactionId);
  await writeScoped(db, yields, input);
}
