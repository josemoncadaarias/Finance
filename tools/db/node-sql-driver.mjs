// A SqlDriver backed by Node's built-in SQLite, for tests and for the
// Phase 2 importer, which runs on a desktop rather than on the phone.
//
// It implements the same interface the app uses on the device, so the code
// under test is the real code, not a stand-in.

import { DatabaseSync } from 'node:sqlite';
import { BaseSqlDriver, SqlError } from '../../src/app/core/database/sql-driver.ts';

export class NodeSqlDriver extends BaseSqlDriver {
  #db;

  constructor(location = ':memory:') {
    super();
    this.#db = new DatabaseSync(location);
    // Foreign keys are off by default in SQLite and are enabled per
    // connection, so this belongs with opening the connection, not in the
    // schema. WAL keeps a long import from blocking reads.
    this.#db.exec('PRAGMA foreign_keys = ON;');
    if (location !== ':memory:') {
      this.#db.exec('PRAGMA journal_mode = WAL;');
    }
  }

  async execute(sql) {
    try {
      this.#db.exec(sql);
    } catch (error) {
      throw new SqlError(error.message, sql, error);
    }
  }

  async run(sql, params = []) {
    try {
      const result = this.#db.prepare(sql).run(...params);
      return {
        changes: Number(result.changes),
        lastId: result.lastInsertRowid === undefined ? undefined : Number(result.lastInsertRowid),
      };
    } catch (error) {
      throw new SqlError(error.message, sql, error);
    }
  }

  async query(sql, params = []) {
    try {
      return this.#db.prepare(sql).all(...params);
    } catch (error) {
      throw new SqlError(error.message, sql, error);
    }
  }

  async close() {
    this.#db.close();
  }
}
