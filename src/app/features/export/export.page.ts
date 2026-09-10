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
import {
  exportMovements, toCsv, exportFileName, type CsvWords,
} from '../../core/database/export/export-csv';
import { I18nService } from '../../core/i18n/i18n.service';
import { exportBackup, backupSummary, toJson } from '../../core/database/export/export-backup';

@Component({
  selector: 'app-export',
  templateUrl: './export.page.html',
  styleUrls: ['./export.page.scss'],
  imports: [
    TranslatePipe, LanguageButtonComponent,
    IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonIcon,
    IonList, IonItem, IonLabel, IonNote, IonSpinner, IonMenuButton,
  ],
})
export class ExportPage {
  readonly database = inject(DatabaseService);
  private readonly i18n = inject(I18nService);
  readonly status = this.database.status;

  readonly working = signal<'csv' | 'backup' | null>(null);
  readonly error = signal('');
  readonly lastFile = signal('');

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

  async downloadCsv(): Promise<void> {
    await this.produce('csv', async () => {
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
      const backup = await exportBackup(this.database.driver);
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
      const parts = file.bom ? ['﻿', file.text] : [file.text];
      const blob = new Blob(parts, { type: file.type });

      // A link clicked from code: the browser saves it wherever the user's
      // downloads go, and on Android the same call hands it to the system's
      // save dialog.
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = file.name;
      document.body.appendChild(link);
      link.click();
      link.remove();

      // Revoked on the next tick: revoking immediately cancels the download in
      // some browsers before it has started.
      setTimeout(() => URL.revokeObjectURL(url), 1000);

      this.lastFile.set(file.name);
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : String(error));
    } finally {
      this.working.set(null);
    }
  }

  /** What the backup would carry, for showing before it is made. */
  async previewBackup(): Promise<{ table: string; rows: number }[]> {
    return backupSummary(await exportBackup(this.database.driver));
  }
}
