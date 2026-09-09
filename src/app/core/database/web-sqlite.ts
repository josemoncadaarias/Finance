/**
 * Makes SQLite work in the browser, so `ionic serve` is a real development
 * environment rather than a demo.
 *
 * There is no SQLite in a browser. The plugin emulates one on top of
 * IndexedDB, and that emulation is delivered as a web component — `jeep-sqlite`
 * — which has to be defined and mounted in the page before any connection is
 * opened. On a phone none of this runs: the native SQLite is already there.
 *
 * Worth remembering while developing: the browser database and the phone
 * database are two different databases. Importing your CSV in the browser does
 * not put anything on the phone.
 */

import { Capacitor } from '@capacitor/core';

let ready: Promise<void> | null = null;

/**
 * Prepares the web SQLite implementation, once per page load.
 *
 * Returns immediately on a device. Concurrent callers share one setup rather
 * than each mounting their own element.
 */
export function prepareWebSqlite(): Promise<void> {
  if (Capacitor.getPlatform() !== 'web') {
    return Promise.resolve();
  }
  ready ??= mountJeepSqlite();
  return ready;
}

async function mountJeepSqlite(): Promise<void> {
  const { defineCustomElements } = await import('jeep-sqlite/loader');
  defineCustomElements(window);
  await customElements.whenDefined('jeep-sqlite');

  // The element has to be in the document, not merely defined: the plugin
  // looks it up by tag name when it initialises its store.
  if (!document.querySelector('jeep-sqlite')) {
    const element = document.createElement('jeep-sqlite');
    document.body.appendChild(element);
    // Give the component a tick to run its own connectedCallback before the
    // plugin asks it for anything.
    await new Promise(resolve => setTimeout(resolve, 0));
  }
}
