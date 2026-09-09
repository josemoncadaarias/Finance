/**
 * Brings a Monefy export into the app.
 *
 * The same importer the command-line tool uses, driven by a file picker. That
 * matters on the phone, where there is no command line: this is how the
 * history gets in, and how it stays up to date as Monefy keeps being exported.
 *
 * Running it twice is safe. Rows already stored are recognised and skipped,
 * and anything corrected by hand is left alone.
 */

import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonContent, IonHeader, IonToolbar, IonTitle, IonIcon, IonSpinner,
  IonList, IonItem, IonLabel, IonNote,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { documentAttachOutline, checkmarkCircleOutline, alertCircleOutline } from 'ionicons/icons';

import { DatabaseService } from '../../core/database/database.service';
import { importMonefy, type ImportSummary } from '../../core/database/import/import-monefy';

type Phase = 'idle' | 'reading' | 'done' | 'failed';

interface ReviewCount {
  kind: string;
  label: string;
  count: number;
}

/** Plain-language names for what the importer flags. */
const REVIEW_LABELS: Record<string, string> = {
  reconstructed_transfer: 'Transferencias con una pata reconstruida',
  estimated_amount: 'Montos en dólares estimados',
  assumed_account: 'Cuentas cuya moneda se dedujo',
  deleted_account: 'Cuentas borradas de Monefy, recreadas',
  multi_currency_split: 'Reparto de cuentas multimoneda',
  ambiguous_category: 'Categorías usadas como ingreso y gasto',
  credit_limit_change: 'Aumentos de cupo, fuera del saldo',
  credit_limit_mismatch: 'El cupo no coincide con el archivo',
  near_date_transfer: 'Transferencias emparejadas con días de diferencia',
};

@Component({
  selector: 'app-import',
  templateUrl: './import.page.html',
  styleUrls: ['./import.page.scss'],
  imports: [
    CommonModule,
    IonContent, IonHeader, IonToolbar, IonTitle, IonIcon, IonSpinner,
    IonList, IonItem, IonLabel, IonNote,
  ],
})
export class ImportPage {
  private readonly database = inject(DatabaseService);

  readonly phase = signal<Phase>('idle');
  readonly fileName = signal('');
  readonly summary = signal<ImportSummary | null>(null);
  readonly reviews = signal<ReviewCount[]>([]);
  readonly errorMessage = signal('');

  readonly status = this.database.status;

  constructor() {
    addIcons({ documentAttachOutline, checkmarkCircleOutline, alertCircleOutline });
  }

  async onFileChosen(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.phase.set('reading');
    this.fileName.set(file.name);
    this.summary.set(null);
    this.errorMessage.set('');

    try {
      // Read as bytes, not text: the export is Windows-1252 and the parser
      // does the decoding. Handing it a string would already have mangled
      // every accent, and account names feed the import fingerprint.
      const bytes = new Uint8Array(await file.arrayBuffer());

      const summary = await importMonefy(this.database.driver, bytes, {
        fileName: file.name,
        fileHash: await sha256(bytes),
      });

      this.summary.set(summary);
      this.reviews.set(await this.loadReviewCounts());
      this.phase.set('done');

      // Wakes the other screens. Without this the balances stay as they were
      // until the app is reloaded by hand.
      this.database.dataChanged();
    } catch (error) {
      this.errorMessage.set(error instanceof Error ? error.message : String(error));
      this.phase.set('failed');
    } finally {
      // Let the same file be picked again after a fix.
      input.value = '';
    }
  }

  private async loadReviewCounts(): Promise<ReviewCount[]> {
    const rows = await this.database.driver.query<{ kind: string; n: number }>(
      'SELECT kind, COUNT(*) AS n FROM review_queue WHERE resolved = 0 GROUP BY kind ORDER BY n DESC',
    );
    return rows.map(row => ({
      kind: row.kind,
      label: REVIEW_LABELS[row.kind] ?? row.kind,
      count: row.n,
    }));
  }
}

/** Identifies a file, so the same export is recognisable in the batch log. */
async function sha256(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes as unknown as ArrayBuffer);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}
