/**
 * Starts opening the database as the app boots.
 *
 * Deliberately does **not** block the first render. An app initializer that
 * awaits leaves the screen black for as long as the database takes, which in
 * the browser means waiting on a web component and a wasm download — long
 * enough to look broken. Instead the shell paints immediately and each page
 * watches `DatabaseService.status`, showing a spinner or the reason it failed.
 */

import { inject, provideAppInitializer } from '@angular/core';
import type { EnvironmentProviders } from '@angular/core';

import { DatabaseService } from './database.service';

export function provideDatabase(): EnvironmentProviders {
  return provideAppInitializer(() => {
    const database = inject(DatabaseService);

    // Not awaited: the service records success or failure in its own signals,
    // and every page reads them.
    void database.initialize().catch((error: unknown) => {
      console.error('The database could not be opened', error);
    });
  });
}
