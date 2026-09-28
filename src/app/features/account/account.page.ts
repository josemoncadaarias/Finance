/**
 * The account, and the copy it keeps.
 *
 * Signing in is optional and the screen says so first, because it is true:
 * the database is on the phone and the app works with no network at all. What
 * an account buys is one thing - a copy of that database in the user's own
 * Google Drive, in a folder only this app can see.
 *
 * Nothing here happens on its own. Saving is a button and restoring is a
 * button, and restoring says what it is about to replace before it does it.
 * A whole database cannot be merged with another one row by row - the restore
 * code has said so since it was written - so the screen shows what each side
 * holds and the person decides. Keeping whichever is newer, quietly, is how a
 * day of entries disappears.
 */

import { Component, computed, effect, inject, signal } from '@angular/core';
import { Location } from '@angular/common';
import { IonContent, IonSpinner, IonIcon, IonModal } from '@ionic/angular';
import { addIcons } from 'ionicons';
import * as allIcons from 'ionicons/icons';

import { DatabaseService } from '../../core/database/database.service';
import { GoogleAccountService } from '../../core/cloud/google-account.service';
import { CloudBackupService, rememberSeen } from '../../core/cloud/cloud-backup.service';
import { DriveError, download } from '../../core/cloud/drive-backup';
import { parseBackup, restoreBackup } from '../../core/database/export/restore-backup';
import { MIGRATION_SOURCES } from '../../core/database/migrations/statements.generated';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { I18nService } from '../../core/i18n/i18n.service';
import { BadgeComponent } from '../../shared/ui/badge.component';
import { ConfirmComponent } from '../../shared/confirm/confirm.component';
import { ToastService } from '../../shared/ui/toast.service';
import { BusyOverlayComponent } from '../../shared/busy-overlay.component';
import { AvatarComponent } from '../../core/cloud/avatar.component';

@Component({
  selector: 'app-account',
  templateUrl: './account.page.html',
  styleUrls: ['./account.page.scss'],
  imports: [
    TranslatePipe, BusyOverlayComponent, AvatarComponent, BadgeComponent, ConfirmComponent,
    IonContent, IonSpinner, IonIcon, IonModal,
  ],
})
export class AccountPage {
  readonly google = inject(GoogleAccountService);
  /** Saving lives in the service, because the toolbar button asks for it too. */
  readonly cloud = inject(CloudBackupService);
  private readonly database = inject(DatabaseService);
  readonly i18n = inject(I18nService);
  private readonly location = inject(Location);
  private readonly toast = inject(ToastService);
  readonly info = signal<string | null>(null);

  back(): void {
    this.location.back();
  }

  /** Another Google account: out of this one, then Android's own chooser (8q). */
  async changeAccount(): Promise<void> {
    this.clear();
    await this.google.signOut();
    this.cloud.copy.set(null);
    this.looked.set(false);
    if (await this.google.signIn()) await this.look();
  }

  /** "Hoy 8:12 a. m.", or the day. */
  whenShort(iso: string): string {
    const at = new Date(iso);
    const locale = this.i18n.dateLocale();
    const time = at.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' });
    if (at.toDateString() === new Date().toDateString()) {
      const today = this.i18n.t('ui.today');
      return `${today.charAt(0).toUpperCase() + today.slice(1)} ${time}`;
    }
    return `${at.toLocaleDateString(locale, { day: 'numeric', month: 'short' }).replace('.', '')} ${time}`;
  }

  readonly restoreBody = computed(() => {
    const held = this.copy();
    if (!held) return this.i18n.t('cloud.restore.sure');
    return this.i18n.t('ui.drive.bring.body', {
      when: this.whenShort(held.modifiedTime).toLowerCase(),
      rows: held.rows === null ? this.size(held.size) : this.i18n.t('cloud.rows', { count: held.rows.toLocaleString(this.i18n.dateLocale()) }),
    });
  });

  readonly replaceBody = computed(() => {
    const other = this.cloud.wouldReplace();
    if (!other) return '';
    const when = new Date(other.when).toLocaleString(this.i18n.dateLocale(), { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
    return this.i18n.t('cloud.replace.body', { when });
  });

  /** The old copy set aside, said as a short notice (8p). */
  private readonly sayKept = effect(() => {
    const name = this.cloud.kept();
    if (name) this.toast.say(this.i18n.t('cloud.kept', { name }));
  });

  /** What Drive holds. The service owns it, so both agree on one answer. */
  readonly copy = this.cloud.copy;
  readonly looked = signal(false);

  readonly busy = signal('');
  readonly busyDetail = signal('');
  /** How far a download has got, 0 to 1, or null while it cannot be told. */
  readonly busyFraction = signal<number | null>(null);
  readonly failure = signal('');
  readonly done = signal('');

  /** Asking to replace everything on the phone, and waiting for a yes. */
  readonly confirmingRestore = signal(false);

  readonly signedIn = computed(() => this.google.user() !== null);

  constructor() {
    addIcons(allIcons as unknown as Record<string, string>);
  }

  async ionViewWillEnter(): Promise<void> {
    if (this.signedIn()) await this.look();
  }

  async signIn(): Promise<void> {
    this.clear();
    if (await this.google.signIn()) await this.look();
  }

  async signOut(): Promise<void> {
    this.clear();
    await this.google.signOut();
    this.cloud.copy.set(null);
    this.looked.set(false);
  }

  /** What is in Drive right now. Quiet: it runs on entering the screen. */
  private async look(): Promise<void> {
    await this.cloud.look();
    if (this.cloud.failure()) this.failure.set(this.cloud.failure());
    this.looked.set(true);
  }

  /** The phone's database, written over whatever Drive holds. */
  async save(): Promise<void> {
    this.clear();
    this.busy.set(this.i18n.t('cloud.saving'));
    try {
      if (await this.cloud.save()) {
        this.looked.set(true);
        this.done.set(this.i18n.t('cloud.saved'));
      } else {
        this.failure.set(this.cloud.failure());
      }
    } finally {
      this.busy.set('');
      this.busyDetail.set('');
    }
  }

  /** Replaces the copy in Drive despite the warning: it is their decision. */
  async saveAnyway(): Promise<void> {
    this.cloud.wouldReplace.set(null);
    this.busy.set(this.i18n.t('cloud.saving'));
    try {
      if (await this.cloud.save({ anyway: true })) {
        this.done.set(this.i18n.t('cloud.saved'));
        await this.cloud.look();
      } else {
        this.failure.set(this.cloud.failure());
      }
    } finally {
      this.busy.set('');
      this.busyDetail.set('');
    }
  }

  /** Whatever Drive holds, written over the phone's database. */
  async restore(): Promise<void> {
    this.confirmingRestore.set(false);
    this.clear();
    const held = this.copy();
    if (!held) return;

    this.busy.set(this.i18n.t('cloud.restoring'));
    try {
      const token = await this.google.accessToken();
      if (!token) throw new DriveError(this.i18n.t('cloud.error.signedOut'));

      this.busyDetail.set(this.i18n.t('cloud.downloading'));
      const text = await download(token, held.id, got => {
        this.busyFraction.set(got.total > 0 ? got.loaded / got.total : 0);
      });
      this.busyFraction.set(null);

      const backup = parseBackup(text);
      await restoreBackup(this.database.driver, backup, MIGRATION_SOURCES, progress => {
        this.busyDetail.set(`${progress.done} / ${progress.total}`);
      });
      // This device now holds exactly what Drive holds, so from here on it
       // continues that copy and saving over it is never a question.
      rememberSeen(held.modifiedTime);
      this.database.dataChanged();
      this.toast.say(this.i18n.t('cloud.restored'));
    } catch (error) {
      this.report(error);
    } finally {
      this.busy.set('');
      this.busyDetail.set('');
    }
  }

  /** The date Drive recorded, in the reader's own language. */
  when(iso: string): string {
    const at = new Date(iso);
    return at.toLocaleString(this.i18n.dateLocale(), {
      day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  }

  /**
   * How big an upload is, said in the hint that warns about mobile data.
   *
   * Taken from the copy that is actually up there rather than stated as a
   * number in the words: whoever reads this should see their own size, not
   * mine.
   */
  autoSize(): string {
    const held = this.copy();
    return held ? this.size(held.size) : '25 MB';
  }

  size(bytes: number): string {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  private clear(): void {
    this.failure.set('');
    this.done.set('');
  }

  private report(error: unknown): void {
    if (error instanceof DriveError && error.unauthorised) {
      // The token went stale; the next thing asked for will fetch a new one.
      this.google.forgetToken();
    }
    this.failure.set(this.cloud.say(error));
  }

  percentOf(fraction: number): string {
    return `${Math.floor(Math.min(Math.max(fraction, 0), 1) * 100)} %`;
  }

  /** The bar under the copy: what stage, how far, and the megabytes. */
  readonly bar = computed(() => {
    const now = this.cloud.progress();
    if (now) return { label: this.i18n.t(`cloud.progress.${now.stage}`), fraction: now.fraction, detail: now.detail };
    return { label: this.busy(), fraction: this.busyFraction(), detail: this.busyDetail() };
  });
}
