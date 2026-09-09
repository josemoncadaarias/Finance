/**
 * `SqlDriver` backed by `@capacitor-community/sqlite`. This is the driver that
 * runs on the phone, and in the browser during `ionic serve`.
 *
 * UNVERIFIED: the plugin is not installed yet, so the calls below are written
 * from its documented API and have not been run. Everything above this file is
 * covered by tests against a real SQLite engine; this is the one file to
 * check first if the app misbehaves on device but the tests are green.
 *
 * On the web there is no native SQLite. The plugin emulates it on top of
 * IndexedDB, which needs `initWebStore()` and the `jeep-sqlite` element on the
 * page, and needs `saveToStore()` after writes or they are lost on reload.
 * The browser database and the phone database are different databases.
 */

import { CapacitorSQLite, SQLiteConnection, type SQLiteDBConnection } from '@capacitor-community/sqlite';
import { Capacitor } from '@capacitor/core';

import { BaseSqlDriver, SqlError, type SqlRunResult } from './sql-driver';

export const DATABASE_NAME = 'finance';

export class CapacitorSqlDriver extends BaseSqlDriver {
  private readonly connection: SQLiteConnection;
  private readonly db: SQLiteDBConnection;
  private readonly isWeb: boolean;

  private constructor(connection: SQLiteConnection, db: SQLiteDBConnection, isWeb: boolean) {
    super();
    this.connection = connection;
    this.db = db;
    this.isWeb = isWeb;
  }

  static async open(databaseName: string = DATABASE_NAME): Promise<CapacitorSqlDriver> {
    const connection = new SQLiteConnection(CapacitorSQLite);
    const isWeb = Capacitor.getPlatform() === 'web';

    if (isWeb) {
      await connection.initWebStore();
    }

    // Reuse a connection left behind by a hot reload rather than failing.
    const existing = (await connection.isConnection(databaseName, false)).result;
    const db = existing
      ? await connection.retrieveConnection(databaseName, false)
      : await connection.createConnection(databaseName, false, 'no-encryption', 1, false);

    await db.open();

    // Foreign keys are off by default in SQLite and are a per-connection
    // setting, so this has to happen on every open, not once in the schema.
    await db.execute('PRAGMA foreign_keys = ON;');

    return new CapacitorSqlDriver(connection, db, isWeb);
  }

  async execute(sql: string): Promise<void> {
    try {
      // `false` turns off the plugin's own transaction. Without it every call
      // is wrapped in one, and the explicit BEGIN this driver issues for a real
      // transaction lands inside it: "cannot start a transaction within a
      // transaction". Transaction control belongs to one layer, and that layer
      // is BaseSqlDriver, which the Node tests exercise.
      await this.db.execute(sql, false);
      await this.persist();
    } catch (error) {
      throw new SqlError(messageOf(error), sql, error);
    }
  }

  async run(sql: string, params: readonly unknown[] = []): Promise<SqlRunResult> {
    try {
      const result = await this.db.run(sql, [...params], false);
      await this.persist();
      return {
        changes: result.changes?.changes ?? 0,
        lastId: result.changes?.lastId,
      };
    } catch (error) {
      throw new SqlError(messageOf(error), sql, error);
    }
  }

  async query<T>(sql: string, params: readonly unknown[] = []): Promise<T[]> {
    try {
      const result = await this.db.query(sql, [...params]);
      return (result.values ?? []) as T[];
    } catch (error) {
      throw new SqlError(messageOf(error), sql, error);
    }
  }

  async close(): Promise<void> {
    await this.db.close();
    await this.connection.closeConnection(DATABASE_NAME, false);
  }

  // The plugin owns transaction state; asking it directly is the only way to
  // open one that survives across calls. A BEGIN sent as a statement is gone by
  // the time the matching COMMIT arrives, which surfaces as
  // "cannot commit - no transaction is active".
  protected override async begin(): Promise<void> {
    await this.db.beginTransaction();
  }

  protected override async commit(): Promise<void> {
    await this.db.commitTransaction();
    // Saves unconditionally: the transaction is over, but the base class only
    // clears its depth counter after this returns, so `persist()` would still
    // think one is open and skip the write that makes the whole thing durable.
    await this.saveNow();
  }

  protected override async rollback(): Promise<void> {
    await this.db.rollbackTransaction();
  }

  /**
   * Flushes to IndexedDB after a statement that ran on its own.
   *
   * Skipped inside a transaction, and that is the point. Saving **exports the
   * database**, and exporting ends the transaction underneath it — which
   * surfaced as "cannot commit - no transaction is active" on the very first
   * migration. The commit saves instead, once, when the work is really done.
   */
  private async persist(): Promise<void> {
    if (!this.inTransaction) {
      await this.saveNow();
    }
  }

  private async saveNow(): Promise<void> {
    if (this.isWeb) {
      await CapacitorSQLite.saveToStore({ database: DATABASE_NAME });
    }
  }
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
