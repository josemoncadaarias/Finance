/**
 * Keeps a second copy of the browser database, so a reload cannot empty it.
 *
 * jeep-sqlite saves the whole database after every write, in two steps:
 *
 *     await store.removeItem(dbName);
 *     await store.setItem(dbName, data);
 *
 * Two IndexedDB transactions, not one. A page that reloads between them - a
 * live reload while developing, or a person pressing F5 - leaves no database
 * at all, and the next start does what the plugin does with a missing one:
 * creates an empty database, migrates it, and saves it over the gap. That is
 * how every account and movement disappeared on 2026-09-11, at 11:33, while
 * the tab reloaded six times in fourteen seconds.
 *
 * So a copy lives in an IndexedDB database of its own, written with a single
 * `put` (it is either the old copy or the new one, never neither). Before the
 * connection opens, a missing database is put back from that copy. The copy
 * follows the real one a few seconds after the writes stop, and only ever from
 * a database that is there - never from the gap.
 *
 * Browser only. On a phone the database is a real file and none of this runs.
 */

/** Where jeep-sqlite keeps its databases, through localforage. */
const PLUGIN_STORE = { database: 'jeepSqliteStore', objectStore: 'databases' };
const COPY_STORE = { database: 'financeSafeCopy', objectStore: 'copies' };

/** How long the writes must have stopped before the copy is refreshed. */
const COPY_DELAY_MS = 3_000;

let copyTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Puts the database back from the copy if the plugin's store has lost it.
 * Call after the web store is open and before the connection is created.
 * Returns true when it had to.
 */
export async function recoverWebDatabase(fileName: string): Promise<boolean> {
  const current = await readBytes(PLUGIN_STORE, fileName);
  if (current) {
    await writeBytes(COPY_STORE, fileName, current);
    return false;
  }
  const copy = await readBytes(COPY_STORE, fileName);
  if (!copy) return false;
  await writeBytes(PLUGIN_STORE, fileName, copy);
  console.warn(`The browser database was missing and was put back from its copy (${copy.length} bytes).`);
  return true;
}

/** Refreshes the copy once the writes have been quiet for a moment. */
export function scheduleWebCopy(fileName: string): void {
  if (copyTimer) clearTimeout(copyTimer);
  copyTimer = setTimeout(() => {
    copyTimer = null;
    void refreshCopy(fileName).catch(error => console.warn('Could not refresh the database copy:', error));
  }, COPY_DELAY_MS);
}

async function refreshCopy(fileName: string): Promise<void> {
  const current = await readBytes(PLUGIN_STORE, fileName);
  // Missing means a save is between its two steps: keep the copy we have.
  if (current) await writeBytes(COPY_STORE, fileName, current);
}

interface Store { database: string; objectStore: string }

async function readBytes(store: Store, key: string): Promise<Uint8Array | null> {
  const db = await openStore(store);
  if (!db) return null;
  try {
    const value = await request(db.transaction(store.objectStore, 'readonly').objectStore(store.objectStore).get(key));
    return value instanceof Uint8Array && value.length > 0 ? value : null;
  } finally {
    db.close();
  }
}

async function writeBytes(store: Store, key: string, bytes: Uint8Array): Promise<void> {
  const db = await openStore(store);
  if (!db) return;
  try {
    const transaction = db.transaction(store.objectStore, 'readwrite');
    transaction.objectStore(store.objectStore).put(bytes, key);
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    db.close();
  }
}

/**
 * Opens a store without disturbing the plugin's: its database is only ever
 * opened when it already has the object store, and only ours is created here.
 */
function openStore(store: Store): Promise<IDBDatabase | null> {
  const ours = store.database === COPY_STORE.database;
  return new Promise((resolve, reject) => {
    const opening = indexedDB.open(store.database);
    opening.onupgradeneeded = () => {
      if (ours) opening.result.createObjectStore(store.objectStore);
    };
    opening.onerror = () => reject(opening.error);
    opening.onsuccess = () => {
      const db = opening.result;
      if (db.objectStoreNames.contains(store.objectStore)) {
        resolve(db);
      } else {
        db.close();
        resolve(null);
      }
    };
  });
}

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
