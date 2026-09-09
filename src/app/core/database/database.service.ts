/**
 * Owns the database connection for the whole app.
 *
 * Call `initialize()` once at startup: it opens the connection and brings the
 * schema up to date. Everything else asks for `driver` and gets a database
 * that is already migrated, or an error saying why it is not.
 */

import { Injectable, signal } from '@angular/core';

import { CapacitorSqlDriver } from './capacitor-sql-driver';
import { prepareWebSqlite } from './web-sqlite';
import type { SqlDriver } from './sql-driver';
import { migrate, targetVersion, type MigrationResult } from './migrations/migration-runner';
import { MIGRATION_SOURCES } from './migrations/statements.generated';

export type DatabaseStatus = 'closed' | 'opening' | 'ready' | 'failed';

@Injectable({ providedIn: 'root' })
export class DatabaseService {
  private sqlDriver: SqlDriver | null = null;
  private opening: Promise<SqlDriver> | null = null;

  readonly status = signal<DatabaseStatus>('closed');

  /**
   * Bumped whenever something writes enough to change what a screen shows.
   *
   * Pages read it alongside the status, so an import refreshes the balances
   * without the user having to reload the app — which is exactly what they had
   * to do before this existed.
   */
  readonly dataVersion = signal(0);
  readonly lastMigration = signal<MigrationResult | null>(null);
  readonly error = signal<Error | null>(null);

  /**
   * Opens and migrates the database. Safe to call more than once: concurrent
   * callers share the same in-flight open rather than racing to create two
   * connections.
   */
  initialize(): Promise<SqlDriver> {
    if (this.sqlDriver) {
      return Promise.resolve(this.sqlDriver);
    }
    if (this.opening) {
      return this.opening;
    }

    this.status.set('opening');
    this.opening = this.openAndMigrate()
      .then(driver => {
        this.sqlDriver = driver;
        this.status.set('ready');
        this.error.set(null);
        return driver;
      })
      .catch((error: unknown) => {
        this.status.set('failed');
        this.error.set(error instanceof Error ? error : new Error(String(error)));
        throw error;
      })
      .finally(() => {
        this.opening = null;
      });

    return this.opening;
  }

  /**
   * The live connection. Throws rather than returning null: a caller reaching
   * for the database before startup finished is a bug, and a null would only
   * surface it somewhere less useful.
   */
  get driver(): SqlDriver {
    if (!this.sqlDriver) {
      throw new Error('Database is not initialized yet. Await DatabaseService.initialize() first.');
    }
    return this.sqlDriver;
  }

  /** Schema version this build expects. Useful in a diagnostics screen. */
  get expectedVersion(): number {
    return targetVersion(MIGRATION_SOURCES);
  }

  /** Tells every screen watching that the data underneath them has changed. */
  dataChanged(): void {
    this.dataVersion.update(version => version + 1);
  }

  async close(): Promise<void> {
    if (this.sqlDriver) {
      await this.sqlDriver.close();
      this.sqlDriver = null;
      this.status.set('closed');
    }
  }

  private async openAndMigrate(): Promise<SqlDriver> {
    // Preparing the browser's SQLite emulation belongs here rather than in the
    // caller: when it fails it is a failure to open the database, and it has to
    // land in the same `error` signal the pages already render. On a device it
    // returns immediately.
    await prepareWebSqlite();

    const driver = await CapacitorSqlDriver.open();
    const result = await migrate(driver, MIGRATION_SOURCES);
    this.lastMigration.set(result);
    return driver;
  }
}
