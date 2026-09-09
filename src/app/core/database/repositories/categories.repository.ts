/** Categories. Same icon rule as accounts: exactly one of the two columns. */

import type { SqlDriver } from '../sql-driver';
import type { CategoryKind, CategoryRow, IsoDate } from '../types';

/** A category plus how often it has been used, for ordering by habit. */
export interface UsedCategory extends CategoryRow {
  times: number;
}

export interface NewCategory {
  name: string;
  kind: CategoryKind;
  builtin_icon?: string | null;
  custom_icon_id?: number | null;
  color?: string;
  parent_id?: number | null;
  sort_order?: number;
}

export type CategoryUpdate = Partial<NewCategory> & { archived?: boolean };

const COLUMNS = `id, name, kind, builtin_icon, custom_icon_id, color, parent_id,
  archived, sort_order, created_at, updated_at`;

export class CategoriesRepository {
  private readonly db: SqlDriver;
  private readonly now: () => string;

  constructor(db: SqlDriver, now: () => string = () => new Date().toISOString()) {
    this.db = db;
    this.now = now;
  }

  async list(options: { kind?: CategoryKind; includeArchived?: boolean } = {}): Promise<CategoryRow[]> {
    const conditions: string[] = [];
    const values: unknown[] = [];

    if (!options.includeArchived) conditions.push('archived = 0');
    if (options.kind) {
      conditions.push('kind = ?');
      values.push(options.kind);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    return this.db.query<CategoryRow>(
      `SELECT ${COLUMNS} FROM categories ${where} ORDER BY sort_order, name`,
      values,
    );
  }

  /**
   * Categories with how often each was used, most used first.
   *
   * Habit is heavily lopsided — five categories carry 76% of a year's
   * movements here — so a screen that offers them alphabetically buries the
   * ones actually needed. `since` limits the count to recent history, so a
   * category abandoned two years ago stops winning on old volume.
   */
  async listByUse(options: { kind?: CategoryKind; since?: IsoDate } = {}): Promise<UsedCategory[]> {
    const conditions = ['c.archived = 0'];
    const values: unknown[] = [];

    // The date filter belongs to the join: in WHERE it would drop every
    // category not used lately, which is exactly the set that still has to be
    // reachable.
    //
    // Its value is bound first because its "?" comes first in the statement —
    // SQLite matches parameters by position, not by name, so binding the kind
    // before the date silently asked for categories whose kind was a date.
    const recent = options.since ? 'AND t.occurred_on >= ?' : '';
    if (options.since) values.push(options.since);

    if (options.kind) {
      conditions.push('c.kind = ?');
      values.push(options.kind);
    }

    const columns = COLUMNS.split(',').map(column => 'c.' + column.trim()).join(', ');

    return this.db.query<UsedCategory>(
      `SELECT ${columns}, COUNT(t.id) AS times
       FROM categories c
       LEFT JOIN transactions t
         ON t.category_id = c.id AND t.transfer_id IS NULL ${recent}
       WHERE ${conditions.join(' AND ')}
       GROUP BY c.id
       ORDER BY times DESC, c.name`,
      values,
    );
  }

  async findById(id: number): Promise<CategoryRow | null> {
    return this.db.queryOne<CategoryRow>(`SELECT ${COLUMNS} FROM categories WHERE id = ?`, [id]);
  }

  /** Categories are unique per name and kind, which is how the importer matches them. */
  async findByName(name: string, kind: CategoryKind): Promise<CategoryRow | null> {
    return this.db.queryOne<CategoryRow>(
      `SELECT ${COLUMNS} FROM categories WHERE name = ? AND kind = ?`,
      [name, kind],
    );
  }

  async create(category: NewCategory): Promise<number> {
    const timestamp = this.now();
    const result = await this.db.run(
      `INSERT INTO categories (name, kind, builtin_icon, custom_icon_id, color, parent_id,
         sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        category.name,
        category.kind,
        category.builtin_icon ?? null,
        category.custom_icon_id ?? null,
        category.color ?? '#607D8B',
        category.parent_id ?? null,
        category.sort_order ?? 0,
        timestamp,
        timestamp,
      ],
    );
    return result.lastId!;
  }

  /** Returns the existing category or creates it. The importer leans on this. */
  async findOrCreate(category: NewCategory): Promise<number> {
    const existing = await this.findByName(category.name, category.kind);
    return existing ? existing.id : this.create(category);
  }

  async update(id: number, changes: CategoryUpdate): Promise<void> {
    const columns: string[] = [];
    const values: unknown[] = [];

    const set = (column: string, value: unknown) => {
      columns.push(`${column} = ?`);
      values.push(value);
    };

    if (changes.name !== undefined) set('name', changes.name);
    if (changes.kind !== undefined) set('kind', changes.kind);
    if (changes.color !== undefined) set('color', changes.color);
    if (changes.parent_id !== undefined) set('parent_id', changes.parent_id);
    if (changes.sort_order !== undefined) set('sort_order', changes.sort_order);
    if (changes.archived !== undefined) set('archived', changes.archived ? 1 : 0);

    if (changes.builtin_icon !== undefined || changes.custom_icon_id !== undefined) {
      const builtin = changes.builtin_icon ?? null;
      const custom = changes.custom_icon_id ?? null;
      if ((builtin === null) === (custom === null)) {
        throw new Error('A category needs exactly one of builtin_icon or custom_icon_id');
      }
      set('builtin_icon', builtin);
      set('custom_icon_id', custom);
    }

    if (columns.length === 0) return;

    set('updated_at', this.now());
    values.push(id);
    await this.db.run(`UPDATE categories SET ${columns.join(', ')} WHERE id = ?`, values);
  }

  async archive(id: number): Promise<void> {
    await this.update(id, { archived: true });
  }
}
