/**
 * The copy that lives off the phone: one file in the user's own Drive.
 *
 * It is the same backup the "Importar y exportar" screen writes, byte for
 * byte, kept in Drive's `appDataFolder` - a hidden folder that belongs to this
 * app inside the user's own Drive. Three things follow from that choice, and
 * all three were the reason for it:
 *
 *   - There is no server of ours. The data go from the phone to the user's
 *     Drive and nowhere else, so there is nothing to run, nothing to pay for
 *     and nobody else holding a copy of somebody's finances.
 *   - It is the file format that already exists and is already tested, so
 *     what comes back from Drive restores through exactly the code path a
 *     file from Descargas restores through.
 *   - Deleting the app's Drive data is one switch in the user's own Google
 *     account, not a request to us.
 *
 * What this is NOT is a sync engine. It uploads a whole database and
 * downloads a whole database; it never merges two. Two devices that both
 * changed something cannot be reconciled row by row - that is rule 1 of the
 * restore code and it is just as true here - so the screen shows what each
 * side holds and the person decides. Silently keeping the newer one is how a
 * day of entries disappears.
 */

const FILES = 'https://www.googleapis.com/drive/v3/files';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';

/** The one file this app keeps. A name, so it is recognisable if ever seen. */
const NAME = 'finance-backup.json';

/** What Drive holds right now, as much of it as the screen needs. */
export interface CloudCopy {
  id: string;
  /** When it was written, as Drive recorded it. */
  modifiedTime: string;
  /** Its size in bytes, for the "is this the big one or an empty one" question. */
  size: number;
  /** What the app wrote beside it: schema version and how many rows. */
  schemaVersion: number | null;
  rows: number | null;
}

/** What went wrong, so the screen can say it in words a person reads. */
export type DriveFailure = 'network' | 'stalled' | 'auth' | 'server';

export class DriveError extends Error {
  /** True when Google refused the token rather than the request. */
  readonly unauthorised: boolean;
  readonly kind: DriveFailure;

  constructor(message: string, unauthorised = false, kind: DriveFailure = unauthorised ? 'auth' : 'server') {
    super(message);
    this.name = 'DriveError';
    this.unauthorised = unauthorised;
    this.kind = kind;
  }
}

/**
 * How long a question to Drive may take before it is given up on. The small
 * ones (is there a copy, set one aside) answer in a second; a minute of
 * silence is a connection that has gone, and the screen must not sit there
 * saying "saving" for ever.
 */
const ASK_TIMEOUT_MS = 30_000;

/**
 * And how long the big transfer may go without moving a single byte. Not a
 * limit on the whole: 25 MB on a slow connection legitimately takes minutes,
 * and it is fine as long as it keeps moving.
 */
const STALL_MS = 45_000;

/** A fetch that gives up after a while, and says "no connection" as one. */
async function ask(url: string, init: RequestInit = {}): Promise<Response> {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(ASK_TIMEOUT_MS) });
  } catch (error) {
    throw asNetworkError(error);
  }
}

/** "Failed to fetch" and its cousins, as the one thing they mean. */
function asNetworkError(error: unknown): DriveError {
  if (error instanceof DriveError) return error;
  const name = error instanceof Error ? error.name : '';
  if (name === 'TimeoutError') return new DriveError('timeout', false, 'stalled');
  return new DriveError(error instanceof Error ? error.message : String(error), false, 'network');
}

/** How far a transfer has got, in bytes. */
export interface Transfer {
  loaded: number;
  total: number;
}

/**
 * The big transfer, over XMLHttpRequest because fetch cannot say how far an
 * upload has got - and a bar that cannot move is exactly what Jose saw sit at
 * the same place for minutes. Given up on when no byte has moved for
 * `STALL_MS`, or when the caller aborts.
 */
function transfer(
  method: string,
  url: string,
  headers: Record<string, string>,
  body: string | null,
  options: { signal?: AbortSignal; onUpload?: (t: Transfer) => void; onDownload?: (t: Transfer) => void },
): Promise<{ status: number; text: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url);
    for (const [name, value] of Object.entries(headers)) xhr.setRequestHeader(name, value);

    let stalled = false;
    let watchdog: ReturnType<typeof setTimeout> | null = null;
    const moved = () => {
      if (watchdog) clearTimeout(watchdog);
      watchdog = setTimeout(() => { stalled = true; xhr.abort(); }, STALL_MS);
    };
    const finish = () => {
      if (watchdog) clearTimeout(watchdog);
      options.signal?.removeEventListener('abort', onAbort);
    };
    const onAbort = () => xhr.abort();
    options.signal?.addEventListener('abort', onAbort);

    xhr.upload.onprogress = event => {
      moved();
      if (event.lengthComputable) options.onUpload?.({ loaded: event.loaded, total: event.total });
    };
    xhr.onprogress = event => {
      moved();
      if (event.lengthComputable) options.onDownload?.({ loaded: event.loaded, total: event.total });
    };
    xhr.onload = () => { finish(); resolve({ status: xhr.status, text: xhr.responseText }); };
    xhr.onerror = () => { finish(); reject(new DriveError('network', false, 'network')); };
    xhr.onabort = () => {
      finish();
      if (stalled) reject(new DriveError('stalled', false, 'stalled'));
      else reject(new DOMException('aborted', 'AbortError'));
    };

    moved();
    xhr.send(body);
  });
}

async function check(response: Response): Promise<Response> {
  if (response.ok) return response;
  const body = await response.text().catch(() => '');
  throw new DriveError(
    `Drive ${response.status}: ${body.slice(0, 200)}`,
    response.status === 401 || response.status === 403,
  );
}

/** The same check as `check`, for what `transfer` answered. */
function checked(answer: { status: number; text: string }): string {
  if (answer.status >= 200 && answer.status < 300) return answer.text;
  throw new DriveError(
    `Drive ${answer.status}: ${answer.text.slice(0, 200)}`,
    answer.status === 401 || answer.status === 403,
  );
}

/** The copy Drive holds, or null when there is none yet. */
export async function findCopy(token: string): Promise<CloudCopy | null> {
  const query = new URLSearchParams({
    spaces: 'appDataFolder',
    // By name, because the folder also holds the copies set aside below, and
    // asking for the first ten files would one day not include this one.
    q: `name = '${NAME}' and trashed = false`,
    fields: 'files(id,name,modifiedTime,size,appProperties)',
    pageSize: '10',
  });

  const response = await check(await ask(`${FILES}?${query}`, {
    headers: { Authorization: `Bearer ${token}` },
  }));

  const body = await response.json() as {
    files?: {
      id: string; name: string; modifiedTime: string; size?: string;
      appProperties?: { schemaVersion?: string; rows?: string };
    }[];
  };

  const found = (body.files ?? []).find(file => file.name === NAME);
  if (!found) return null;

  const number = (value: string | undefined) =>
    value === undefined ? null : Number.parseInt(value, 10);

  return {
    id: found.id,
    modifiedTime: found.modifiedTime,
    size: Number.parseInt(found.size ?? '0', 10),
    schemaVersion: number(found.appProperties?.schemaVersion),
    rows: number(found.appProperties?.rows),
  };
}

/**
 * Keeps the copy that is up there under a dated name of its own.
 *
 * Called before a device writes over a copy it has never seen. Jose's own
 * idea, in the form it belongs in: he asked for one file per phone so nothing
 * would ever be overwritten, which does stop the overwrite and costs
 * something worse - two files both looking current, and the person having to
 * remember which one is the real one. This keeps the single file everything
 * syncs to, and makes the one dangerous moment reversible.
 *
 * Copied by Drive itself: no download, no upload, nothing of the 25 MB
 * crosses the phone's connection.
 */
export async function setAside(token: string, copy: CloudCopy): Promise<string> {
  const stamp = copy.modifiedTime.slice(0, 16).replace(/[:T]/g, '-');
  const name = `finance-backup-replaced-${stamp}.json`;

  const response = await check(await ask(`${FILES}/${copy.id}/copy?fields=id,name`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name, parents: ['appDataFolder'] }),
  }));

  const written = await response.json() as { name?: string };
  return written.name ?? name;
}

/**
 * Writes the backup, replacing the one that is there.
 *
 * Drive keeps its own versions of a file, so replacing rather than adding
 * means one file that can be rolled back inside Drive instead of a folder
 * filling up with dated copies nobody prunes.
 */
export async function upload(
  token: string,
  json: string,
  about: { schemaVersion: number; rows: number },
  /** Aborted when a newer copy is on its way: no point finishing a stale one. */
  abort?: AbortSignal,
  /** How far the bytes have got, for the bar on the screen. */
  onProgress?: (t: Transfer) => void,
): Promise<CloudCopy> {
  const existing = await findCopy(token);

  const metadata = {
    name: NAME,
    ...(existing ? {} : { parents: ['appDataFolder'] }),
    appProperties: {
      schemaVersion: String(about.schemaVersion),
      rows: String(about.rows),
    },
  };

  const boundary = `finance-${Date.now()}`;
  const body =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`
    + `${JSON.stringify(metadata)}\r\n`
    + `--${boundary}\r\nContent-Type: application/json\r\n\r\n`
    + `${json}\r\n`
    + `--${boundary}--`;

  const url = existing
    ? `${UPLOAD}/${existing.id}?uploadType=multipart&fields=id,modifiedTime,size`
    : `${UPLOAD}?uploadType=multipart&fields=id,modifiedTime,size`;

  const text = checked(await transfer(existing ? 'PATCH' : 'POST', url, {
    Authorization: `Bearer ${token}`,
    'Content-Type': `multipart/related; boundary=${boundary}`,
  }, body, { signal: abort, onUpload: onProgress }));

  const written = JSON.parse(text) as { id: string; modifiedTime: string; size?: string };
  return {
    id: written.id,
    modifiedTime: written.modifiedTime,
    size: Number.parseInt(written.size ?? String(json.length), 10),
    schemaVersion: about.schemaVersion,
    rows: about.rows,
  };
}

/** The text of the copy Drive holds, ready for the ordinary restore. */
export async function download(token: string, id: string, onProgress?: (t: Transfer) => void): Promise<string> {
  return checked(await transfer('GET', `${FILES}/${id}?alt=media`, {
    Authorization: `Bearer ${token}`,
  }, null, { onDownload: onProgress }));
}
