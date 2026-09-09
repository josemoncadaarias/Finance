/**
 * Makes SQLite work in the browser, so `ionic serve` is a real development
 * environment rather than a demo.
 *
 * There is no SQLite in a browser. The plugin emulates one on top of IndexedDB,
 * delivered as a web component — `jeep-sqlite` — which has to be defined,
 * mounted, and **finished opening its store** before any connection is opened.
 * On a phone none of this runs: the native SQLite is already there.
 *
 * That last step is the one worth being careful about. `initWebStore()` does
 * not fail when the component is not ready yet; it just records `false`:
 *
 *     if (!this.isWebStoreOpen) {
 *       this.isWebStoreOpen = await this.jeepSqliteElement.isStoreOpen();
 *     }
 *
 * The failure then surfaces much later, on the first write, as
 * "WebStore is not open yet". So this module waits for the component to report
 * an open store before letting anything else proceed, rather than waiting a
 * tick and hoping.
 *
 * Worth remembering while developing: the browser database and the phone
 * database are two different databases. Importing your CSV in the browser puts
 * nothing on the phone.
 */

import { Capacitor } from '@capacitor/core';

/** How long to wait for the store to open before giving up. */
const STORE_TIMEOUT_MS = 15_000;
const POLL_INTERVAL_MS = 50;

interface JeepSqliteElement extends HTMLElement {
  componentOnReady(): Promise<unknown>;
  isStoreOpen(): Promise<boolean>;
}

let ready: Promise<void> | null = null;

/**
 * Prepares the web SQLite implementation, once per page load.
 *
 * Resolves immediately on a device. Concurrent callers share one setup rather
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
  // looks it up with document.querySelector when it initialises its store.
  let element = document.querySelector<JeepSqliteElement>('jeep-sqlite');
  if (!element) {
    element = document.createElement('jeep-sqlite') as JeepSqliteElement;
    document.body.appendChild(element);
  }

  // Stencil resolves this once the component has rendered and its methods are
  // callable. Without it, isStoreOpen() is being asked of a shell.
  await element.componentOnReady();

  await waitForOpenStore(element);
}

/**
 * Polls until the component reports its store open.
 *
 * There is no event to listen for, so polling is what is available. The
 * interval is short and the whole thing normally settles in well under a
 * second; the timeout exists so a broken setup fails with a sentence someone
 * can act on instead of hanging on a blank screen.
 */
async function waitForOpenStore(element: JeepSqliteElement): Promise<void> {
  const deadline = Date.now() + STORE_TIMEOUT_MS;

  while (Date.now() < deadline) {
    if (await element.isStoreOpen()) {
      return;
    }
    await delay(POLL_INTERVAL_MS);
  }

  throw new Error(
    `The browser database did not finish opening within ${STORE_TIMEOUT_MS / 1000} seconds. ` +
      'The jeep-sqlite component is mounted but its store never reported ready — ' +
      'check that assets/sql-wasm.wasm is being served, and that the browser allows IndexedDB ' +
      '(private windows often do not).',
  );
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
