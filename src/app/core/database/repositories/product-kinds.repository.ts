/**
 * What a product's own movement is: cashback, a correction against the bank,
 * or whatever else its owner decides to call it.
 *
 * These were three words fixed in the schema until Jose asked for them to be
 * his, on 2026-09-16 - renamed, given an icon, added to, the way the
 * categories of an ordinary movement already are.
 *
 * A name and a picture, and nothing else the user has to think about. The
 * `counts_as` column is carried from the day this table was added and is not
 * asked for anywhere: it was a tax question inside a category editor, which
 * is not where a tax question belongs.
 */

import type { SqlDriver } from '../sql-driver';

export interface ProductKind {
  id: number;
  name: string;
  builtin_icon: string | null;
  custom_icon_id: number | null;
  /** How the tax module should read it: as a yield, or as cashback. */
  counts_as: 'yield' | 'cashback';
  archived: 0 | 1;
  sort_order: number;
}

export interface NewProductKind {
  name: string;
  builtin_icon?: string | null;
  custom_icon_id?: number | null;
  counts_as?: 'yield' | 'cashback';
  sort_order?: number;
}

const COLUMNS = 'id, name, builtin_icon, custom_icon_id, counts_as, archived, sort_order';

export class ProductKindsRepository {
  private readonly db: SqlDriver;
  private readonly now: () => string;

  constructor(db: SqlDriver, now: () => string = () => new Date().toISOString()) {
    this.db = db;
    this.now = now;
  }

  /** The ones on offer, in the order they are shown. */
  async list(options: { includeArchived?: boolean } = {}): Promise<ProductKind[]> {
    const where = options.includeArchived ? '' : 'WHERE archived = 0';
    return this.db.query<ProductKind>(
      `SELECT ${COLUMNS} FROM product_kinds ${where} ORDER BY sort_order, id`);
  }

  async findById(id: number): Promise<ProductKind | null> {
    return this.db.queryOne<ProductKind>(`SELECT ${COLUMNS} FROM product_kinds WHERE id = ?`, [id]);
  }

  /** How many entries are filed under it, so archiving is an informed act. */
  async timesUsed(id: number): Promise<number> {
    const row = await this.db.queryOne<{ total: number }>(
      'SELECT COUNT(*) AS total FROM product_entries WHERE product_kind_id = ?', [id]);
    return row?.total ?? 0;
  }

  async create(kind: NewProductKind): Promise<number> {
    const name = kind.name.trim();
    if (name === '') throw new Error('A kind needs a name');

    const now = this.now();
    const result = await this.db.run(
      `INSERT INTO product_kinds (name, builtin_icon, custom_icon_id, counts_as, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        name,
        kind.custom_icon_id == null ? kind.builtin_icon ?? 'pricetag-outline' : null,
        kind.custom_icon_id ?? null,
        kind.counts_as ?? 'yield',
        kind.sort_order ?? (await this.nextOrder()),
        now, now,
      ]);
    return result.lastId!;
  }

  async update(id: number, changes: Partial<NewProductKind> & { archived?: boolean }): Promise<void> {
    const sets: string[] = [];
    const values: unknown[] = [];
    const set = (column: string, value: unknown) => { sets.push(`${column} = ?`); values.push(value); };

    if (changes.name !== undefined) {
      const name = changes.name.trim();
      if (name === '') throw new Error('A kind needs a name');
      set('name', name);
    }
    // One or the other, never both: the schema says so and so does the picker.
    if (changes.custom_icon_id !== undefined || changes.builtin_icon !== undefined) {
      const custom = changes.custom_icon_id ?? null;
      set('custom_icon_id', custom);
      set('builtin_icon', custom === null ? changes.builtin_icon ?? 'pricetag-outline' : null);
    }
    if (changes.counts_as !== undefined) set('counts_as', changes.counts_as);
    if (changes.sort_order !== undefined) set('sort_order', changes.sort_order);
    if (changes.archived !== undefined) set('archived', changes.archived ? 1 : 0);
    if (sets.length === 0) return;

    set('updated_at', this.now());
    values.push(id);
    await this.db.run(`UPDATE product_kinds SET ${sets.join(', ')} WHERE id = ?`, values);
  }

  /**
   * Removes one, unless entries are filed under it.
   *
   * The schema would let it go and leave those entries pointing at nothing -
   * `ON DELETE SET NULL` - so this refuses instead and says how many there
   * are. Archiving is the way to retire a kind that has been used: it stops
   * being offered and every entry keeps its name.
   */
  async delete(id: number): Promise<void> {
    const used = await this.db.queryOne<{ total: number }>(
      'SELECT COUNT(*) AS total FROM product_entries WHERE product_kind_id = ?', [id]);
    if ((used?.total ?? 0) > 0) {
      throw new Error(`That kind is used by ${used!.total} entries; archive it instead`);
    }
    await this.db.run('DELETE FROM product_kinds WHERE id = ?', [id]);
  }

  private async nextOrder(): Promise<number> {
    const row = await this.db.queryOne<{ last: number | null }>(
      'SELECT MAX(sort_order) AS last FROM product_kinds');
    return (row?.last ?? -1) + 1;
  }
}
