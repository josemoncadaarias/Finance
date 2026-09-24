/**
 * Getting the data out.
 *
 * Two files, for two different jobs, and the screen says which is which
 * because getting that wrong is expensive: someone who keeps only the CSV
 * believes they have a backup and finds out otherwise on the day the phone
 * is gone.
 *
 *   - The **backup** is everything, and can be read back.
 *   - The **CSV** is for reading — a spreadsheet, an accountant, a check
 *     against the bank — and cannot restore anything.
 */

import { Component, computed, effect, inject, signal } from '@angular/core';
import {
  IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonIcon,
  IonList, IonItem, IonLabel, IonNote, IonSpinner, IonMenuButton,
} from '@ionic/angular';

import { DatabaseService } from '../../core/database/database.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { LanguageButtonComponent } from '../../core/i18n/language-button.component';
import { CloudButtonComponent } from '../../core/cloud/cloud-button.component';
import {
  exportMovements, toCsv, exportFileName, type CsvWords,
} from '../../core/database/export/export-csv';
import { I18nService } from '../../core/i18n/i18n.service';
import { exportBackup, backupSummary, toJson } from '../../core/database/export/export-backup';
import { parseBackup, restoreBackup } from '../../core/database/export/restore-backup';
import { MIGRATION_SOURCES } from '../../core/database/migrations/statements.generated';
import { rememberSeen } from '../../core/cloud/cloud-backup.service';
import { saveFile } from '../../core/files/save-file';
import type { Progress } from '../../core/database/export/progress';
import { BusyOverlayComponent } from '../../shared/busy-overlay.component';

@Component({
  selector: 'app-export',
  templateUrl: './export.page.html',
  styleUrls: ['./export.page.scss'],
  imports: [
    TranslatePipe, LanguageButtonComponent, CloudButtonComponent, BusyOverlayComponent,
    IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonIcon,
    IonList, IonItem, IonLabel, IonNote, IonSpinner, IonMenuButton,
  ],
})
export class ExportPage {
  readonly database = inject(DatabaseService);
  private readonly i18n = inject(I18nService);
  readonly status = this.database.status;

  readonly working = signal<'csv' | 'backup' | 'restore' | null>(null);

  /**
   * What is happening while the screen cannot be used.
   *
   * Reading five years of history, or writing it back, runs for seconds on a
   * phone - Jose watched a minute of a screen that said nothing while a backup
   * restored. Null when nothing is running.
   */
  readonly busy = signal<{ label: string; detail: string; percent: number | null } | null>(null);
  readonly error = signal('');
  readonly lastFile = signal('');

  /** The file picked to restore, held until it is confirmed. */
  readonly picked = signal<File | null>(null);
  readonly pickedSummary = signal('');
  readonly restored = signal('');

  /** What the database holds, so the screen can say what is being saved. */
  readonly counts = signal<{ movements: number; accounts: number; categories: number }>({
    movements: 0, accounts: 0, categories: 0,
  });

  readonly hasData = computed(() => this.counts().movements > 0);

  constructor() {
    effect(() => {
      this.database.dataVersion();
      if (this.database.status() === 'ready') void this.load();
    });
  }

  private async load(): Promise<void> {
    const row = await this.database.driver.queryOne<{
      movements: number; accounts: number; categories: number;
    }>(
      `SELECT
         (SELECT COUNT(*) FROM transactions) AS movements,
         (SELECT COUNT(*) FROM accounts WHERE archived = 0) AS accounts,
         (SELECT COUNT(*) FROM categories WHERE archived = 0) AS categories`,
    );
    if (row) this.counts.set(row);
  }

  /**
   * Says how far along the work is, and hands the screen back long enough to
   * draw it. Without the pause the bar would only appear once everything had
   * finished, which is the one moment it is of no use.
   */
  private async report(label: string, progress?: Progress): Promise<void> {
    const percent = progress && progress.total > 0
      ? Math.min(100, Math.round((progress.done / progress.total) * 100))
      : null;
    this.busy.set({
      label: this.i18n.t(label as never),
      detail: progress && progress.total > 0
        ? this.i18n.t('busy.steps', {
            done: progress.done.toLocaleString('es-CO'),
            total: progress.total.toLocaleString('es-CO'),
          })
        : '',
      percent,
    });
    await new Promise(resolve => setTimeout(resolve));
  }

  async downloadCsv(): Promise<void> {
    await this.produce('csv', async () => {
      await this.report('busy.reading');
      const rows = await exportMovements(this.database.driver);
      return {
        text: toCsv(rows, this.csvWords()),
        // Excel needs the byte-order mark to read UTF-8; without it every
        // accent in "Pañales" arrives mangled.
        bom: true,
        type: 'text/csv;charset=utf-8',
        name: exportFileName(new Date(), 'csv'),
      };
    });
  }

  /** The file's own words, in whichever language the app is speaking. */
  private csvWords(): CsvWords {
    const t = (key: string) => this.i18n.t(key as never);
    return {
      headers: [
        'csv.date', 'csv.account', 'csv.currency', 'csv.category', 'csv.amount',
        'csv.amountInPesos', 'csv.rate', 'csv.note', 'csv.kind', 'csv.counterpart',
        'csv.correctedByHand', 'csv.source', 'csv.confidence',
      ].map(t),
      transfer: t('csv.transfer'),
      movement: t('csv.movement'),
      transferLeg: leg => `${t('csv.transferLeg')} (${leg})`,
      yes: t('csv.yes'),
      no: t('csv.no'),
    };
  }

  async downloadBackup(): Promise<void> {
    await this.produce('backup', async () => {
      const backup = await exportBackup(
        this.database.driver, progress => this.report('busy.reading', progress));
      return {
        text: toJson(backup),
        bom: false,
        type: 'application/json',
        name: exportFileName(new Date(), 'json'),
      };
    });
  }

  private async produce(
    which: 'csv' | 'backup',
    build: () => Promise<{ text: string; bom: boolean; type: string; name: string }>,
  ): Promise<void> {
    if (this.working() !== null) return;
    this.working.set(which);
    this.error.set('');

    try {
      const file = await build();

      // Turning it into text is one call that holds the thread; there is
      // nothing to measure inside it, so the bar says so by moving.
      await this.report('busy.building');
      const parts = file.bom ? ['﻿', file.text] : [file.text];
      const blob = new Blob(parts, { type: file.type });

      await this.report('busy.saving');
      // On the phone the share sheet can be closed without choosing anywhere,
      // and writing it there goes in pieces, which is what the bar counts.
      const saved = await saveFile(blob, file.name, progress => this.report('busy.saving', progress));
      if (saved) this.lastFile.set(file.name);
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : String(error));
    } finally {
      this.working.set(null);
      this.busy.set(null);
    }
  }

  /** What the backup would carry, for showing before it is made. */
  async previewBackup(): Promise<{ table: string; rows: number }[]> {
    return backupSummary(await exportBackup(this.database.driver));
  }
  /**
   * Reads a file and says what is in it, without touching anything yet.
   *
   * Restoring replaces five years of history, so the file is parsed and
   * described first and the user confirms against that description. Picking
   * the wrong file is the easiest mistake here and the only one that cannot
   * be undone.
   */
  async pick(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    input.value = '';

    this.error.set('');
    this.restored.set('');
    this.picked.set(null);
    if (!file) return;

    try {
      // Reading twenty-odd megabytes of JSON is itself a wait worth showing.
      await this.report('busy.opening');
      const backup = parseBackup(await file.text());
      const counts = backupSummary(backup)
        .slice(0, 3)
        .map(entry => `${entry.rows} ${entry.table}`)
        .join(', ');

      this.pickedSummary.set(this.i18n.t('restore.picked', {
        date: backup.exportedAt.slice(0, 10),
        counts,
      }));
      this.picked.set(file);
    } catch (error) {
      this.error.set(messageOf(error));
    } finally {
      this.busy.set(null);
    }
  }

  /** Replaces everything. Only reachable after the file has been described. */
  async restore(): Promise<void> {
    const file = this.picked();
    if (!file) return;

    this.working.set('restore');
    this.error.set('');
    try {
      await this.report('busy.opening');
      const backup = parseBackup(await file.text());
      const result = await restoreBackup(
        this.database.driver, backup, MIGRATION_SOURCES,
        progress => this.report('busy.restoring', progress));

      const rows = result.restored.reduce((sum, entry) => sum + entry.rows, 0);
      // A file from anywhere: nobody knows how it relates to the copy in
      // Drive, so this device stops claiming to continue it and the next save
      // asks before writing over it.
      rememberSeen('');
      this.restored.set(this.i18n.t('restore.done', { rows, version: result.toVersion }));
      this.picked.set(null);
      this.database.dataChanged();
    } catch (error) {
      this.error.set(messageOf(error));
    } finally {
      this.working.set(null);
      this.busy.set(null);
    }
  }

}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
