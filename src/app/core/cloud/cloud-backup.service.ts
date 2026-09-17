/**
 * Saving the database to Drive, from wherever the person happens to be.
 *
 * The account screen had this inside it, and then Jose asked for a button on
 * every screen - "no hay servidor, así que dame la forma de subir la copia sin
 * ir a buscarla". Two callers means the work belongs in neither of them: the
 * screen and the button both ask this, and both read the same state back, so
 * a save started from the toolbar is the same save the account screen is
 * showing.
 *
 * Only saving lives here. Restoring replaces everything on the phone, and a
 * thing that dangerous does not belong on a button that is one tap away on
 * every screen - it stays where it can be read about first.
 */

import { Injectable, inject, signal } from '@angular/core';

import { DatabaseService } from '../database/database.service';
import { exportBackup, toJson } from '../database/export/export-backup';
import { GoogleAccountService } from './google-account.service';
import { DriveError, findCopy, upload, type CloudCopy } from './drive-backup';

export type SaveState = 'idle' | 'working' | 'done' | 'failed';

@Injectable({ providedIn: 'root' })
export class CloudBackupService {
  private readonly google = inject(GoogleAccountService);
  private readonly database = inject(DatabaseService);

  /** What Drive holds, as far as this session knows. */
  readonly copy = signal<CloudCopy | null>(null);

  readonly state = signal<SaveState>('idle');
  readonly detail = signal('');
  readonly failure = signal('');

  /** True when there is an account signed in and a database to save. */
  canSave(): boolean {
    return this.google.user() !== null && this.database.status() === 'ready';
  }

  /** What Drive holds, without changing anything. */
  async look(): Promise<void> {
    if (!this.canSave()) return;
    try {
      const token = await this.google.accessToken();
      if (!token) return;
      this.copy.set(await findCopy(token));
    } catch (error) {
      this.note(error);
    }
  }

  /**
   * The phone's database, written over whatever Drive holds.
   *
   * Returns true when it worked, so a caller can say so in its own words. The
   * state it leaves behind settles back to idle on its own: a tick that stays
   * on screen for ever stops meaning "just now".
   */
  async save(): Promise<boolean> {
    if (this.state() === 'working' || !this.canSave()) return false;

    this.state.set('working');
    this.failure.set('');
    try {
      const token = await this.google.accessToken();
      if (!token) throw new DriveError('signed out');

      const backup = await exportBackup(this.database.driver, progress => {
        this.detail.set(`${progress.done} / ${progress.total}`);
      });
      const rows = Object.values(backup.tables)
        .reduce((sum, list) => sum + (Array.isArray(list) ? list.length : 0), 0);

      this.copy.set(await upload(token, toJson(backup), {
        schemaVersion: backup.schemaVersion, rows,
      }));
      this.settle('done');
      return true;
    } catch (error) {
      this.note(error);
      this.settle('failed');
      return false;
    } finally {
      this.detail.set('');
    }
  }

  private settle(state: SaveState): void {
    this.state.set(state);
    setTimeout(() => {
      if (this.state() === state) this.state.set('idle');
    }, state === 'done' ? 2500 : 6000);
  }

  private note(error: unknown): void {
    if (error instanceof DriveError && error.unauthorised) {
      // The token went stale; the next thing asked for fetches a new one.
      this.google.forgetToken();
    }
    this.failure.set(error instanceof Error ? error.message : String(error));
  }
}
