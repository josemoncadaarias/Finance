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

export class DriveError extends Error {
  /** True when Google refused the token rather than the request. */
  readonly unauthorised: boolean;

  constructor(message: string, unauthorised = false) {
    super(message);
    this.name = 'DriveError';
    this.unauthorised = unauthorised;
  }
}

async function check(response: Response): Promise<Response> {
  if (response.ok) return response;
  const body = await response.text().catch(() => '');
  throw new DriveError(
    `Drive ${response.status}: ${body.slice(0, 200)}`,
    response.status === 401 || response.status === 403,
  );
}

/** The copy Drive holds, or null when there is none yet. */
export async function findCopy(token: string): Promise<CloudCopy | null> {
  const query = new URLSearchParams({
    spaces: 'appDataFolder',
    fields: 'files(id,name,modifiedTime,size,appProperties)',
    pageSize: '10',
  });

  const response = await check(await fetch(`${FILES}?${query}`, {
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

  const response = await check(await fetch(url, {
    method: existing ? 'PATCH' : 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body,
    signal: abort,
  }));

  const written = await response.json() as { id: string; modifiedTime: string; size?: string };
  return {
    id: written.id,
    modifiedTime: written.modifiedTime,
    size: Number.parseInt(written.size ?? String(json.length), 10),
    schemaVersion: about.schemaVersion,
    rows: about.rows,
  };
}

/** The text of the copy Drive holds, ready for the ordinary restore. */
export async function download(token: string, id: string): Promise<string> {
  const response = await check(await fetch(`${FILES}/${id}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  }));
  return response.text();
}
