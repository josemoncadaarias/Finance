/**
 * A category moved to the other side - spending to income or back - with
 * everything filed under it (Jose, 2026-10-14: a category set up on the wrong
 * side was locked once it had movements, and the only way out was a new one
 * and moving each movement by hand). It is asked first, saying how many.
 *
 * What moves with it, and nothing else:
 * - every movement filed under it changes sign (its peso value too), and is
 *   marked as corrected by hand;
 * - a product's own movement under it ("Solo el producto") changes sign;
 * - a movement saved as "Solo el patrimonio" keeps that answer: its other
 *   half on the product turns over with it - a cash-out where it is now an
 *   income, an entry back into the product where it is now a spending - so
 *   the product's figure still does not move.
 *
 * The yields of an account with products are worked out again by the next
 * pass on their own: each month's mark holds the sum of its movements, which
 * this changes.
 */
import type { SqlDriver } from '../database/sql-driver';
import type { CategoryKind } from '../database/types';
import { YieldsRepository } from '../database/repositories/yields.repository';

/** How many rows a change of side would turn over. */
export async function kindChangeReach(db: SqlDriver, categoryId: number): Promise<{ movements: number; entries: number }> {
  const row = await db.queryOne<{ movements: number; entries: number }>(
    `SELECT (SELECT COUNT(*) FROM transactions WHERE category_id = ?) AS movements,
            (SELECT COUNT(*) FROM product_entries WHERE category_id = ? AND transaction_id IS NULL) AS entries`,
    [categoryId, categoryId]);
  return { movements: row?.movements ?? 0, entries: row?.entries ?? 0 };
}

/**
 * Turns the category and what is filed under it to `kind`, in one
 * transaction. Throws `KindTaken` when the other side already has a category
 * of that name (names are unique per side).
 */
export async function changeCategoryKind(
  db: SqlDriver, categoryId: number, kind: CategoryKind, now: () => string = () => new Date().toISOString(),
): Promise<void> {
  const category = await db.queryOne<{ name: string; kind: CategoryKind }>(
    'SELECT name, kind FROM categories WHERE id = ?', [categoryId]);
  if (!category || category.kind === kind) return;
  const taken = await db.queryOne<{ id: number }>(
    'SELECT id FROM categories WHERE name = ? AND kind = ? AND id <> ?', [category.name, kind, categoryId]);
  if (taken) throw new KindTaken(category.name);

  const stamp = now();
  const yields = new YieldsRepository(db, now);
  await db.transaction(async () => {
    await db.run('UPDATE categories SET kind = ?, updated_at = ? WHERE id = ?', [kind, stamp, categoryId]);

    // "Solo el patrimonio": the half on the product turns over with its movement.
    const cashouts = await db.query<{ id: number; account_id: number; on_date: string; amount_minor: number; transaction_id: number; product_id: number | null; note: string | null }>(
      `SELECT c.id, c.account_id, c.on_date, c.amount_minor, c.transaction_id, c.product_id, c.note
       FROM product_cashouts c JOIN transactions t ON t.id = c.transaction_id WHERE t.category_id = ?`, [categoryId]);
    const halves = await db.query<{ id: number; account_id: number; on_date: string; amount_minor: number; transaction_id: number; product_id: number | null; note: string | null }>(
      `SELECT e.id, e.account_id, e.on_date, e.amount_minor, e.transaction_id, e.product_id, e.note
       FROM product_entries e JOIN transactions t ON t.id = e.transaction_id WHERE t.category_id = ?`, [categoryId]);
    for (const half of cashouts) {
      // Was an income cashed in; now a spending: the money goes back into the product.
      await yields.removeWithdrawal(half.id);
      await yields.adjust({
        account_id: half.account_id, on_date: half.on_date, amount_minor: half.amount_minor,
        kind: 'other', product_id: half.product_id, note: half.note, transaction_id: half.transaction_id,
      });
    }
    for (const half of halves) {
      // Was a spending put back; now an income: it leaves what the product gathered.
      await yields.removeAdjustment(half.id);
      await yields.withdraw({
        account_id: half.account_id, on_date: half.on_date, amount_minor: half.amount_minor,
        transaction_id: half.transaction_id, product_id: half.product_id, note: half.note,
      });
    }

    await db.run(
      `UPDATE transactions SET amount_minor = -amount_minor, amount_base_minor = -amount_base_minor,
              locked = 1, updated_at = ? WHERE category_id = ?`, [stamp, categoryId]);
    await db.run(
      `UPDATE product_entries SET amount_minor = -amount_minor, updated_at = ?
       WHERE category_id = ? AND transaction_id IS NULL`, [stamp, categoryId]);
  });
}

export class KindTaken extends Error {
  readonly categoryName: string;
  constructor(categoryName: string) {
    super(`A category named ${categoryName} already exists on the other side`);
    this.categoryName = categoryName;
  }
}
