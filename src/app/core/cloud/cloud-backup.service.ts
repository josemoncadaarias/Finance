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

import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

import { DatabaseService } from '../database/database.service';
import { I18nService } from '../i18n/i18n.service';
import { exportBackup, toJson } from '../database/export/export-backup';
import { GoogleAccountService, SilentTimeout } from './google-account.service';
import { DriveError, findCopy, pruneRevisions, setAside, upload, type CloudCopy } from './drive-backup';

export type SaveState = 'idle' | 'working' | 'done' | 'failed';

/** Why a save in flight was given up on: a newer one, the person, or nothing moving. */
type GiveUp = 'newer' | 'cancelled' | 'stuck';

/**
 * How long a save may go without a step forward before it is called stuck.
 * Every stage moves well within it - Google's sign-in has 20 s, each question
 * to Drive 30 s, the upload 45 s without a byte - so this only catches what
 * none of them can: a promise that never settles at all.
 */
const STUCK_MS = 90_000;

/** The promise, unless the signal goes first: a save given up on stops waiting at once. */
function until<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(new DOMException('aborted', 'AbortError'));
  return new Promise<T>((resolve, reject) => {
    const stop = () => reject(new DOMException('aborted', 'AbortError'));
    signal.addEventListener('abort', stop, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', stop));
  });
}

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

/**
 * The copy in Drive this device is a continuation of.
 *
 * Holds the `modifiedTime` of the copy this device last uploaded, or last
 * restored from. If Drive now holds something else, then somebody else wrote
 * it and this device has never seen it - which is the one case where saving
 * destroys history. Kept in localStorage because it has to outlive the
 * process, the same reason as the mark above.
 */
const SEEN_KEY = 'finance.cloud.seen';

/**
 * This install's own name, written beside every copy it uploads
 * (`appProperties.writer`). A copy whose `modifiedTime` this device never
 * heard of is still its own when it carries this name: an upload whose answer
 * was lost - the network changed halfway, Jose 2026-10-08 - landed in Drive,
 * and the next save took it for another phone's. Random, kept on the device;
 * nothing about the network or the phone goes into it.
 */
const WRITER_KEY = 'finance.cloud.writer';

function writerId(): string {
  try {
    let id = localStorage.getItem(WRITER_KEY);
    if (!id) {
      id = typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
      localStorage.setItem(WRITER_KEY, id);
    }
    return id;
  } catch {
    return '';
  }
}

function readSeen(): string {
  try {
    return localStorage.getItem(SEEN_KEY) ?? '';
  } catch {
    return '';
  }
}

/**
 * Remembers which copy in Drive this device continues from.
 *
 * Called after an upload and after restoring FROM Drive - both leave the
 * device holding exactly what is up there. Called with '' after restoring
 * from a file, because then nobody knows how that file relates to Drive.
 */
export function rememberSeen(modifiedTime: string): void {
  try {
    if (modifiedTime) localStorage.setItem(SEEN_KEY, modifiedTime);
    else {
      localStorage.removeItem(SEEN_KEY);
      // Restored from a file: this install no longer continues what it wrote
      // to Drive, so it takes a new name and Drive's copy reads as another's.
      localStorage.removeItem(WRITER_KEY);
    }
  } catch {
    // Storage switched off: the mark holds for this run and no longer.
  }
}

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
  private readonly i18n = inject(I18nService);

  /** What Drive holds, as far as this session knows. */
  readonly copy = signal<CloudCopy | null>(null);

  readonly state = signal<SaveState>('idle');
  readonly detail = signal('');

  /**
   * How far a save has got, 0 to 1, and in which stage - read by the bar on
   * the Google screen. Reading the database is the first 40%, the upload the
   * rest, byte by byte (Jose, 2026-09-28: the bar sat still at one place and
   * nobody could tell whether anything was happening).
   */
  readonly progress = signal<{ stage: 'checking' | 'reading' | 'uploading'; fraction: number; detail: string } | null>(null);
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

  /** Whether the app is in front. Google is never asked for a token while it is not. */
  private active = true;

  /** When the save in flight last took a step, for the watchdog. */
  private lastMoved = 0;

  constructor() {
    // Leaving the app is the moment nobody is looking at the screen, so it is
    // the moment to spend a second reading the database out. It is also the
    // moment Android is free to freeze the page or end the process, so this
    // is an attempt and never a guarantee - which is what the mark below is
    // for. Coming back is the other half: a copy that did not finish last
    // time gets made now.
    if (Capacitor.isNativePlatform()) {
      void App.addListener('appStateChange', ({ isActive }) => {
        this.active = isActive;
        if (!isActive) this.saveIfBehind();
        else {
          // A save left hanging while the app was away must not lock every
          // later one out: give it up, and the copy is made again below.
          this.giveUpIfStuck();
          this.catchUp();
        }
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
    this.inFlight?.abort('newer' satisfies GiveUp);
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.save({ auto: true });
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
      void this.save({ auto: true });
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
    void this.save({ auto: true });
  }

  private stopWaiting(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.inFlight?.abort('newer' satisfies GiveUp);
    this.inFlight = null;
  }

  /**
   * The person's "Cancelar" under the bar. Nothing on the phone changes and
   * the copy in Drive stays as it was; the next change, or the next time the
   * app is opened, tries again.
   */
  cancel(): void {
    this.inFlight?.abort('cancelled' satisfies GiveUp);
  }

  /** A save that has not moved for too long is given up on, and said to have been. */
  private giveUpIfStuck(): void {
    if (this.state() === 'working' && Date.now() - this.lastMoved > STUCK_MS) {
      this.inFlight?.abort('stuck' satisfies GiveUp);
    }
  }

  /** A step of the save, on the bar and to the watchdog. */
  private step(stage: 'checking' | 'reading' | 'uploading', fraction: number, detail = ''): void {
    this.lastMoved = Date.now();
    this.progress.set({ stage, fraction, detail });
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
  /**
    * The copy in Drive that this device is about to write over without ever
    * having seen it.
    *
    * Nothing is uploaded while this is set. It is the one moment a whole
    * history can be lost: a device signed into the same account, carrying
    * something OLDER than what is up there, sending it automatically.
    *
    * Size is not the question, and was the first answer here - a copy
    * smaller than a tenth of the other. Jose said why it is wrong: his
    * second phone has been restoring backups to try things out, so it holds
    * far more than a tenth and is still months behind. What actually
    * separates the safe case from the dangerous one is not how much this
    * device holds but WHERE IT CAME FROM. A device that uploaded the copy in
    * Drive, or restored from it, continues it - whatever it has done since is
    * newer by definition. A device that has never seen it is a second branch
    * of the same history, and only a person can say which branch to keep.
    */
  readonly wouldReplace = signal<{ when: string; rows: number | null } | null>(null);

  /**
   * A copy in Drive the person has already chosen not to overwrite.
   *
   * Saving on its own must not ask the same question every ninety seconds.
   * Pressing the button asks again, because that is a deliberate act.
   */
  private declined = '';

  /**
   * The warning in words, said here because two screens ask it: the cloud
   * button in every toolbar and the account screen's own save button.
   */
  readonly replaceMessage = computed(() => {
    const other = this.wouldReplace();
    if (!other) return '';
    const when = new Date(other.when).toLocaleString(this.i18n.dateLocale(), {
      day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
    return this.i18n.t('cloud.replace.body', { when })
      + (other.rows === null ? '' : ' ' + this.i18n.t('cloud.replace.rows', { count: other.rows }))
      + ' ' + this.i18n.t('cloud.replace.kept');
  });

  /**
   * The name of the copy that was set aside rather than lost, when one was.
   *
   * Said on the screen afterwards, because a safety net nobody is told about
   * is not one: the person has just answered a question about losing data and
   * deserves to know the old copy is still in their Drive, and what it is
   * called.
   */
  readonly kept = signal('');

  /** Not overwriting that one, and stop asking about it. */
  decline(): void {
    this.declined = this.wouldReplace()?.when ?? '';
    this.wouldReplace.set(null);
  }

  async save(options: { anyway?: boolean; auto?: boolean } = {}): Promise<boolean> {
    if (this.state() === 'working' || !this.canSave()) return false;
    // Asking Google for a token is a sign-in, and Android may never answer
    // one for an app that is not in front. An automatic save with no token at
    // hand waits: the database stays marked as behind, and coming back to the
    // app makes the copy.
    if (options.auto && !this.active && !this.google.hasToken()) return false;

    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    const abort = new AbortController();
    this.inFlight = abort;
    // The version this copy is being made from, read before the export so a
    // change during it schedules another rather than being taken as covered.
    const version = this.database.dataVersion();

    this.state.set('working');
    this.failure.set('');
    this.step('checking', 0.02);
    const watchdog = setInterval(() => this.giveUpIfStuck(), 5_000);
    try {
      const token = await until(this.google.accessToken(), abort.signal);
      if (!token) throw new DriveError('signed out');

      /*
       * What Drive holds, read now rather than remembered: the guard below is
       * about the copy that is up there at this instant, and on the device
       * that most needs it nobody has ever looked.
       *
       * Then: is this device a continuation of that copy, or a second branch
       * of the same history? Written over without asking, a branch costs
       * everything the other one did since. Asked about, it costs one tap.
       * Answering yes sends it - it is the person's own copy and their own
       * decision - and the 25 MB export below is not even started until that
       * is settled.
       */
      this.step('checking', 0.03);
      const theirs = await until(findCopy(token), abort.signal);
      this.copy.set(theirs);

      const me = writerId();
      const strange = theirs !== null && theirs.modifiedTime !== readSeen() && !(me !== '' && theirs.writer === me);

      if (!options.anyway && strange) {
        if (!(options.auto && this.declined === theirs!.modifiedTime)) {
          this.wouldReplace.set({ when: theirs!.modifiedTime, rows: theirs!.rows });
        }
        this.settle('idle');
        return false;
      }
      this.wouldReplace.set(null);

      /*
       * Answering yes is the one irreversible moment in all of this, so it is
       * made reversible: the copy that is about to be written over is kept in
       * the same folder under a dated name of its own first. Drive copies it
       * itself, so nothing of the 25 MB crosses the phone's connection.
       *
       * Only here. Copying on every ordinary save would fill the folder with
       * a file an hour and say nothing that Drive's own version history does
       * not already say.
       */
      if (strange && theirs !== null) {
        this.step('checking', 0.04);
        this.kept.set(await until(setAside(token, theirs), abort.signal));
      }

      const backup = await until(exportBackup(this.database.driver, progress => {
        this.detail.set(`${progress.done} / ${progress.total}`);
        this.step('reading', 0.05 + 0.35 * (progress.total > 0 ? progress.done / progress.total : 0));
      }), abort.signal);
      const rows = Object.values(backup.tables)
        .reduce((sum, list) => sum + (Array.isArray(list) ? list.length : 0), 0);

      const json = toJson(backup);
      const send = () => upload(token, json, { schemaVersion: backup.schemaVersion, rows, writer: me }, abort.signal, sent => {
        this.step(
          'uploading',
          0.4 + 0.6 * (sent.total > 0 ? sent.loaded / sent.total : 0),
          this.i18n.t('cloud.progress.mb', { done: megabytes(sent.loaded, this.i18n.dateLocale()), total: megabytes(sent.total, this.i18n.dateLocale()) }),
        );
      });
      let written: CloudCopy;
      try {
        written = await send();
      } catch (error) {
        // A connection that dropped once is tried once more, after a breath:
        // on a phone that is most failures, and the person should not have to
        // press the button again for it.
        if (!(error instanceof DriveError) || (error.kind !== 'network' && error.kind !== 'stalled') || abort.signal.aborted) throw error;
        this.step('uploading', 0.4, this.i18n.t('cloud.progress.retry'));
        await until(new Promise(resolve => setTimeout(resolve, 3000)), abort.signal);
        written = await send();
      }
      this.copy.set(written);
      // From here on this device continues that copy, whatever it does next.
      rememberSeen(written.modifiedTime);
      this.declined = '';
      // Drive's older versions of the backup, past a few, go: each is a whole backup.
      void pruneRevisions(token, written.id);

      this.savedVersion = version;
      // Only now: a copy counts as made when Drive has answered, never before.
      if (this.database.dataVersion() === version) writeFlag(DIRTY_KEY, false);
      this.settle('done');
      return true;
    } catch (error) {
      // Given up on because a newer one is coming, or because the person
      // said so: not a failure, and saying so in red would be a lie about what
      // happened. Given up on because nothing moved: that one is said.
      if (abort.signal.aborted) {
        if (abort.signal.reason === ('stuck' satisfies GiveUp)) {
          this.failure.set(this.i18n.t('cloud.error.stuck'));
          this.settle('failed');
        } else {
          this.state.set('idle');
        }
        return false;
      }
      this.note(error);
      this.settle('failed');
      return false;
    } finally {
      clearInterval(watchdog);
      if (this.inFlight === abort) this.inFlight = null;
      this.detail.set('');
      this.progress.set(null);
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
    this.failure.set(this.say(error));
  }

  /** A failure in words: what happened, and that nothing on the phone was lost. */
  say(error: unknown): string {
    if (error instanceof SilentTimeout) return this.i18n.t('cloud.error.slowGoogle');
    if (error instanceof DriveError) {
      if (error.kind === 'network') return this.i18n.t('cloud.error.network');
      if (error.kind === 'stalled') return this.i18n.t('cloud.error.stalled');
      if (error.kind === 'auth') return this.i18n.t('cloud.error.auth');
      return this.i18n.t('cloud.error.server', { detail: error.message });
    }
    const text = error instanceof Error ? error.message : String(error);
    if (/failed to fetch|network|load failed/i.test(text)) return this.i18n.t('cloud.error.network');
    return text;
  }
}

/** "12,4" megabytes, for the line under the bar. */
function megabytes(bytes: number, locale: string): string {
  return (bytes / 1_048_576).toLocaleString(locale, { maximumFractionDigits: 1, minimumFractionDigits: 1 });
}
