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

import { Injectable, effect, inject, signal, untracked } from '@angular/core';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

import { DatabaseService } from '../database/database.service';
import { exportBackup, toJson } from '../database/export/export-backup';
import { GoogleAccountService } from './google-account.service';
import { DriveError, findCopy, upload, type CloudCopy } from './drive-backup';

export type SaveState = 'idle' | 'working' | 'done' | 'failed';

/** Where the "save on its own" choice is remembered. */
const AUTO_KEY = 'finance.cloud.auto';

/**
 * Whether the database has changed since the copy in Drive was made.
 *
 * In localStorage rather than in memory, and that is the whole point: the app
 * being put away is the moment to save, and it is also the moment Android is
 * free to freeze the page or kill the process outright. Then the save never
 * finishes and nothing knows. A mark that outlives the process does: the next
 * time the app opens, it sees the copy is behind and makes it.
 */
const DIRTY_KEY = 'finance.cloud.dirty';

function readFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === 'yes';
  } catch {
    return false;
  }
}

function writeFlag(key: string, on: boolean): void {
  try {
    if (on) localStorage.setItem(key, 'yes');
    else localStorage.removeItem(key);
  } catch {
    // Storage switched off: the mark holds for this run and no longer.
  }
}

function readAuto(): boolean {
  try {
    return localStorage.getItem(AUTO_KEY) !== 'no';
  } catch {
    return true;
  }
}

@Injectable({ providedIn: 'root' })
export class CloudBackupService {
  private readonly google = inject(GoogleAccountService);
  private readonly database = inject(DatabaseService);

  /** What Drive holds, as far as this session knows. */
  readonly copy = signal<CloudCopy | null>(null);

  readonly state = signal<SaveState>('idle');
  readonly detail = signal('');
  readonly failure = signal('');

  /**
   * Whether the copy goes up on its own after a change.
   *
   * On, because Jose asked for it and because a copy nobody remembers to make
   * is not a copy. It is a switch and not a rule, though: every upload is the
   * WHOLE database - about 25 MB of his - so on a metered connection this is
   * a real cost, and the person paying for the data is the one who should
   * decide. Kept beside the language and the theme, for the same reason: it
   * has to be known before anything is read from the database.
   */
  readonly auto = signal(readAuto());

  setAuto(on: boolean): void {
    this.auto.set(on);
    try {
      localStorage.setItem(AUTO_KEY, on ? 'yes' : 'no');
    } catch {
      // Storage switched off: the choice holds for this run and no longer.
    }
    if (!on) this.stopWaiting();
  }

  /**
   * Waiting out a burst of changes.
   *
   * Entering five movements is five changes and one copy worth making, so the
   * clock restarts on every change and only a quiet stretch actually uploads.
   *
   * Long on purpose. Making the copy means reading the whole database out and
   * turning it into 25 MB of text, and that work happens on the same thread
   * that draws the screen - do it while someone is typing and they feel it.
   * The usual moment to save is not this timer at all but the one below: the
   * app being put away. This is the fallback for a screen left open.
   */
  private static readonly QUIET_MS = 90_000;
  private timer: ReturnType<typeof setTimeout> | null = null;

  /** The upload in flight, so a newer change can give up on it. */
  private inFlight: AbortController | null = null;

  /** The data version the copy in Drive was made from. */
  private savedVersion = -1;

  constructor() {
    // Leaving the app is the moment nobody is looking at the screen, so it is
    // the moment to spend a second reading the database out. It is also the
    // moment Android is free to freeze the page or end the process, so this
    // is an attempt and never a guarantee - which is what the mark below is
    // for. Coming back is the other half: a copy that did not finish last
    // time gets made now.
    if (Capacitor.isNativePlatform()) {
      void App.addListener('appStateChange', ({ isActive }) => {
        if (!isActive) this.saveIfBehind();
        else this.catchUp();
      });
    }
    this.catchUp();

    effect(() => {
      const version = this.database.dataVersion();
      const ready = this.database.status() === 'ready';
      const signedIn = this.google.user() !== null;
      const auto = this.auto();

      untracked(() => {
        if (!ready) return;
        // The database moved, whatever the account is doing: the mark is about
        // the data, not about whether anyone is signed in to save it.
        if (version !== this.savedVersion) writeFlag(DIRTY_KEY, true);

        if (!signedIn || !auto) return;
        if (version === this.savedVersion) return;
        this.waitThenSave();
      });
    });
  }

  /**
   * A newer database makes the upload in flight pointless: it is given up on
   * rather than raced, which is what Jose asked for - "que cancele la anterior
   * y suba la más nueva". The file in Drive is one file that gets replaced, so
   * neither his Drive nor his quota fills up with dated copies.
   */
  private waitThenSave(): void {
    this.inFlight?.abort();
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.save();
    }, CloudBackupService.QUIET_MS);
  }

  /**
   * The copy Drive holds is behind and the app is running: make it.
   *
   * Waits a little first. Opening the app is its busiest second - migrations,
   * the first screen, the icons - and reading the whole database out in the
   * middle of that is exactly the stutter this is all meant to avoid.
   */
  private catchUp(): void {
    if (!readFlag(DIRTY_KEY)) return;
    setTimeout(() => {
      if (!readFlag(DIRTY_KEY) || !this.auto() || !this.canSave()) return;
      void this.save();
    }, 8_000);
  }

  /**
   * Saves now, if anything has changed since the copy in Drive was made.
   *
   * Called as the app goes away. It may not finish - Android can stop a
   * backgrounded app - and that is fine: the copy only counts as made when the
   * upload returns, so an interrupted one leaves the database looking unsaved
   * and the next attempt does it again.
   */
  private saveIfBehind(): void {
    if (!this.auto() || !this.canSave()) return;
    if (!readFlag(DIRTY_KEY) && this.database.dataVersion() === this.savedVersion) return;
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    void this.save();
  }

  private stopWaiting(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.inFlight?.abort();
    this.inFlight = null;
  }

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

    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    const abort = new AbortController();
    this.inFlight = abort;
    // The version this copy is being made from, read before the export so a
    // change during it schedules another rather than being taken as covered.
    const version = this.database.dataVersion();

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
      }, abort.signal));

      this.savedVersion = version;
      // Only now: a copy counts as made when Drive has answered, never before.
      if (this.database.dataVersion() === version) writeFlag(DIRTY_KEY, false);
      this.settle('done');
      return true;
    } catch (error) {
      // Given up on because a newer one is coming: not a failure, and saying
      // so in red would be a lie about what happened.
      if (abort.signal.aborted) {
        this.state.set('idle');
        return false;
      }
      this.note(error);
      this.settle('failed');
      return false;
    } finally {
      if (this.inFlight === abort) this.inFlight = null;
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
