/**
 * Icons the user supplied: a real bank logo instead of a generic wallet.
 *
 * The image lives inside the database as a BLOB rather than as a file beside
 * it. A finance app's whole value is that the data can be carried off the
 * phone in one piece; an icon that lives outside the file would go missing on
 * the first restore, and an account would silently lose its face.
 *
 * The schema caps an image at 100 kB. That is generous for something drawn at
 * 40 pixels, and the cap is enforced here too so the failure is a sentence
 * rather than a constraint violation.
 */

import type { SqlDriver } from '../sql-driver';

export interface CustomIcon {
  id: number;
  name: string;
  mime_type: string;
  created_at: string;
}

export interface CustomIconWithData extends CustomIcon {
  data: Uint8Array;
}

/** What the schema will accept. Anything else is refused before the insert. */
export const ICON_TYPES = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'] as const;

export const MAX_ICON_BYTES = 100_000;

export class CustomIconsRepository {
  private readonly db: SqlDriver;
  private readonly now: () => string;

  constructor(db: SqlDriver, now: () => string = () => new Date().toISOString()) {
    this.db = db;
    this.now = now;
  }

  /** Every icon, without its bytes: enough to list them. */
  async list(): Promise<CustomIcon[]> {
    return this.db.query<CustomIcon>(
      'SELECT id, name, mime_type, created_at FROM custom_icons ORDER BY created_at DESC, id DESC',
    );
  }

  async findById(id: number): Promise<CustomIconWithData | null> {
    return this.db.queryOne<CustomIconWithData>(
      'SELECT id, name, mime_type, data, created_at FROM custom_icons WHERE id = ?',
      [id],
    );
  }

  async create(icon: { name: string; mime_type: string; data: Uint8Array }): Promise<number> {
    if (!ICON_TYPES.includes(icon.mime_type as (typeof ICON_TYPES)[number])) {
      throw new Error(`${icon.mime_type} is not an image this app can store`);
    }
    if (icon.data.byteLength === 0) {
      throw new Error('The image is empty');
    }
    if (icon.data.byteLength > MAX_ICON_BYTES) {
      throw new Error(
        `The image is ${Math.round(icon.data.byteLength / 1000)} kB; the limit is ` +
        `${MAX_ICON_BYTES / 1000} kB. Scale it down first.`);
    }

    const result = await this.db.run(
      'INSERT INTO custom_icons (name, mime_type, data, created_at) VALUES (?, ?, ?, ?)',
      [icon.name, icon.mime_type, icon.data, this.now()],
    );
    return result.lastId!;
  }

  /**
   * Removes an icon, unless something is still wearing it.
   *
   * The schema says ON DELETE RESTRICT, so the database would refuse anyway;
   * this turns that refusal into a sentence naming what is using it.
   */
  async delete(id: number): Promise<void> {
    const users = await this.db.query<{ name: string }>(
      `SELECT name FROM accounts WHERE custom_icon_id = ?
       UNION ALL
       SELECT name FROM categories WHERE custom_icon_id = ?
       UNION ALL
       SELECT name FROM account_groups WHERE custom_icon_id = ?`,
      [id, id, id],
    );

    if (users.length > 0) {
      throw new Error(`That icon is still used by ${users.map(u => u.name).join(', ')}`);
    }
    await this.db.run('DELETE FROM custom_icons WHERE id = ?', [id]);
  }
}

/**
 * A `data:` URL for showing an icon in an `<img>`.
 *
 * Built once per icon and cached by the caller: turning 100 kB of bytes into
 * base64 on every change detection cycle would be felt.
 */
export function iconDataUrl(icon: CustomIconWithData): string {
  let binary = '';
  for (const byte of icon.data) binary += String.fromCharCode(byte);
  return `data:${icon.mime_type};base64,${btoa(binary)}`;
}
