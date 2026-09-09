/**
 * The thin seam between the app and whatever SQLite engine is underneath.
 *
 * Everything above this file — migrations, repositories, features — talks only
 * to `SqlDriver`. That buys two things:
 *
 *   - The app runs on `@capacitor-community/sqlite` on the device and on
 *     plain `node:sqlite` in tests, with no test doubles and no mocking.
 *   - The plugin's API surface is pinned to one file, so if it moves, one file
 *     changes.
 */

export interface SqlParams {
  [index: number]: unknown;
}

export interface SqlRunResult {
  /** Rows added, changed or deleted. */
  changes: number;
  /** Rowid of the row an INSERT just created, when there was one. */
  lastId?: number;
}

export interface SqlDriver {
  /**
   * Runs one or more statements for their effect, with no parameters.
   * Used for schema changes and transaction control.
   */
  execute(sql: string): Promise<void>;

  /** Runs a single parameterised statement that changes data. */
  run(sql: string, params?: readonly unknown[]): Promise<SqlRunResult>;

  /** Runs a single parameterised query and returns every row. */
  query<T>(sql: string, params?: readonly unknown[]): Promise<T[]>;

  /** Runs a query expected to match at most one row. */
  queryOne<T>(sql: string, params?: readonly unknown[]): Promise<T | null>;

  /**
   * Runs `work` inside a transaction, committing on success and rolling back
   * if it throws. Importing 12,890 rows one autocommit at a time is
   * unbearably slow, and a half-finished import is worse than none.
   */
  transaction<T>(work: () => Promise<T>): Promise<T>;

  close(): Promise<void>;
}

/**
 * Thrown when the database rejects a statement. Carries the SQL for context.
 *
 * Fields are declared and assigned rather than written as constructor
 * parameter properties: Node runs these files by stripping types only, and
 * parameter properties would need a real compiler. Keeping to strippable
 * syntax is what lets the tests run with no build step.
 */
export class SqlError extends Error {
  readonly sql: string;
  override readonly cause?: unknown;

  constructor(message: string, sql: string, cause?: unknown) {
    super(message);
    this.name = 'SqlError';
    this.sql = sql;
    this.cause = cause;
  }
}

/**
 * Shared transaction logic. SQLite has no nested transactions, so a nested
 * call joins the one already running rather than starting a second: the
 * outermost caller owns the commit.
 */
export abstract class BaseSqlDriver implements SqlDriver {
  private depth = 0;

  /** True while a transaction is open, for drivers that need to know. */
  protected get inTransaction(): boolean {
    return this.depth > 0;
  }

  abstract execute(sql: string): Promise<void>;
  abstract run(sql: string, params?: readonly unknown[]): Promise<SqlRunResult>;
  abstract query<T>(sql: string, params?: readonly unknown[]): Promise<T[]>;
  abstract close(): Promise<void>;

  /**
   * How a transaction is opened and closed.
   *
   * Plain SQL by default, which is what an in-process engine wants. A driver
   * whose engine manages transactions itself overrides these — issuing `BEGIN`
   * as a statement through such an engine either nests inside a transaction it
   * already opened, or is discarded before the matching `COMMIT` arrives.
   */
  protected begin(): Promise<void> {
    return this.execute('BEGIN');
  }

  protected commit(): Promise<void> {
    return this.execute('COMMIT');
  }

  protected rollback(): Promise<void> {
    return this.execute('ROLLBACK');
  }

  async queryOne<T>(sql: string, params: readonly unknown[] = []): Promise<T | null> {
    const rows = await this.query<T>(sql, params);
    return rows.length > 0 ? rows[0] : null;
  }

  async transaction<T>(work: () => Promise<T>): Promise<T> {
    if (this.depth > 0) {
      this.depth += 1;
      try {
        return await work();
      } finally {
        this.depth -= 1;
      }
    }

    this.depth = 1;
    await this.begin();
    try {
      const result = await work();
      await this.commit();
      return result;
    } catch (error) {
      try {
        await this.rollback();
      } catch {
        // A failed rollback must not hide the error that caused it.
      }
      throw error;
    } finally {
      this.depth = 0;
    }
  }
}
