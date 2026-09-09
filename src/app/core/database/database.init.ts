/**
 * Opens and migrates the database before the first screen renders.
 *
 * Registered as an app initializer, so no page ever has to wonder whether the
 * database is ready: by the time a component exists, it is — or startup failed
 * loudly and the shell says so.
 */

import { inject, provideAppInitializer } from '@angular/core';
import type { EnvironmentProviders } from '@angular/core';

import { DatabaseService } from './database.service';
import { prepareWebSqlite } from './web-sqlite';

export function provideDatabase(): EnvironmentProviders {
  return provideAppInitializer(async () => {
    const database = inject(DatabaseService);
    await prepareWebSqlite();
    try {
      await database.initialize();
    } catch (error) {
      // Swallowed on purpose: the service records the failure in its `error`
      // signal and the shell renders it. Rethrowing here would blank the page
      // and hide the reason.
      console.error('The database could not be opened', error);
    }
  });
}
