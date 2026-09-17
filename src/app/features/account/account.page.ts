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

import { Component, computed, inject, signal } from '@angular/core';
import {
  IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonMenuButton,
  IonSpinner, IonIcon, IonButton,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import * as allIcons from 'ionicons/icons';

import { DatabaseService } from '../../core/database/database.service';
import { GoogleAccountService } from '../../core/cloud/google-account.service';
import { CloudBackupService } from '../../core/cloud/cloud-backup.service';
import { DriveError, download } from '../../core/cloud/drive-backup';
import { parseBackup, restoreBackup } from '../../core/database/export/restore-backup';
import { MIGRATION_SOURCES } from '../../core/database/migrations/statements.generated';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { I18nService } from '../../core/i18n/i18n.service';
import { LanguageButtonComponent } from '../../core/i18n/language-button.component';
import { BusyOverlayComponent } from '../../shared/busy-overlay.component';

@Component({
  selector: 'app-account',
  templateUrl: './account.page.html',
  styleUrls: ['./account.page.scss'],
  imports: [
    TranslatePipe, LanguageButtonComponent, BusyOverlayComponent,
    IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonMenuButton,
    IonSpinner, IonIcon, IonButton,
  ],
})
export class AccountPage {
  readonly google = inject(GoogleAccountService);
  /** Saving lives in the service, because the toolbar button asks for it too. */
  readonly cloud = inject(CloudBackupService);
  private readonly database = inject(DatabaseService);
  private readonly i18n = inject(I18nService);

  /** What Drive holds. The service owns it, so both agree on one answer. */
  readonly copy = this.cloud.copy;
  readonly looked = signal(false);

  readonly busy = signal('');
  readonly busyDetail = signal('');
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
      const text = await download(token, held.id);

      const backup = parseBackup(text);
      await restoreBackup(this.database.driver, backup, MIGRATION_SOURCES, progress => {
        this.busyDetail.set(`${progress.done} / ${progress.total}`);
      });
      this.database.dataChanged();
      this.done.set(this.i18n.t('cloud.restored'));
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
    this.failure.set(error instanceof Error ? error.message : String(error));
  }
}
