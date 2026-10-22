/**
 * Importing a statement: read the file, propose what it says.
 *
 * Deliberately thin. The reading is `readStatement`, the questions asked of
 * each row are the repository's, and what a person does about them is the
 * review screen's. This only joins the three, and gives the screen back
 * everything it needs to explain what happened - including the statement's own
 * balances, which are what say whether the reading can be trusted at all.
 */

import { Injectable, inject, signal } from '@angular/core';

import { DatabaseService } from '../database/database.service';
import { ProposalsRepository } from '../database/repositories/proposals.repository';
import { AccountsRepository } from '../database/repositories/accounts.repository';
import { DEFAULT_MINOR_UNITS } from '../database/money';
import { accountIn, readStatement, type StatementAccount, type StatementReading } from './statement';
import { textOfPdf, stopIfCancelled, StatementUnreadable, type ReadingProgress } from './pdf-text';
import { isImage, textOfImages } from './image-text';
import type { TextItem } from './tokens';
import { I18nService } from '../i18n/i18n.service';

/** What a caller passes to watch a reading, and to stop it. */
export interface ReadingWatch {
  onProgress?: (progress: ReadingProgress) => void;
  signal?: AbortSignal;
}

/** A statement read before there is an account for it to belong to. */
export interface ReadStatement {
  reading: StatementReading;
  /** What it says about the account itself, for the form being filled in. */
  account: StatementAccount;
  file: File;
  /** What the batch is called: the file's name, or the first image's and how many more. */
  name: string;
}

export interface ImportedStatement {
  /** What ties these proposals together, and what the screen asks back for. */
  batch: string;
  /** The account it was read for, so the screen can compare it with the bank. */
  accountId: number;
  reading: StatementReading;
  /** How many rows became proposals. */
  proposed: number;
  /** How many were already on the review screen, or thrown away once. */
  knownAlready: number;
}

@Injectable({ providedIn: 'root' })
export class StatementsService {
  private readonly database = inject(DatabaseService);
  private readonly i18n = inject(I18nService);

  /**
   * What the last statement said, for the screen that opens next.
   *
   * The reading is worth a sentence - how many movements, how many were
   * already there, and above all whether the statement's own balances agree
   * with what was read. Dropping somebody onto a list without that is
   * dropping them onto a list they have no reason to trust.
   */
  readonly lastImport = signal<ImportedStatement | null>(null);

  /**
   * A statement read from the "+" for an account that does not exist yet,
   * waiting for the account form to open with it (mockups `2g`, `2h`).
   */
  readonly pendingNewAccount = signal<ReadStatement | null>(null);

  /**
   * Reads a statement without writing anything.
   *
   * For the account that does not exist yet: the form is filled in from what
   * the statement says - the bank's name, the day the period began and what
   * the account held then - and the movements wait until there is an account
   * to belong to. Nothing is proposed here, because a proposal has to point
   * at an account.
   */
  async read(chosen: File | File[], password?: string, watch: ReadingWatch = {}): Promise<ReadStatement> {
    const files = Array.isArray(chosen) ? chosen : [chosen];
    const file = files[0];
    const items = await textOf(files, password, watch);
    watch.onProgress?.({ part: 0.7, stage: 'reading' });
    const reading = readStatement(items, DEFAULT_MINOR_UNITS);
    if (reading.rows.length === 0) throw new StatementUnreadable(this.i18n.t('ui.import.noRows'));
    stopIfCancelled(watch.signal);
    watch.onProgress?.({ part: 1, stage: 'writing' });
    return { reading, account: accountIn(reading, items), file, name: nameOf(files) };
  }

  /**
   * Proposes a reading already made, now that it has an account.
   *
   * The other half of `read`: the same rows, written down against the account
   * the form just created.
   */
  async proposeRead(accountId: number, read: ReadStatement): Promise<ImportedStatement> {
    const proposals = new ProposalsRepository(this.database.driver);
    await proposals.learnFromLedger();
    return this.write(accountId, read.name, read.reading, proposals);
  }

  /**
   * Reads a statement into proposals for one account.
   *
   * The account decides what the numbers mean: a statement is read in the
   * currency of the account it belongs to, never in one guessed from the page.
   */
  async importInto(
    accountId: number, chosen: File | File[], password?: string, watch: ReadingWatch = {},
  ): Promise<ImportedStatement> {
    const files = Array.isArray(chosen) ? chosen : [chosen];
    const db = this.database.driver;
    const accounts = new AccountsRepository(db);
    const proposals = new ProposalsRepository(db);

    const account = await accounts.findById(accountId);
    if (!account) throw new Error(`No account ${accountId}`);

    const items = await textOf(files, password, watch);

    watch.onProgress?.({ part: 0.68, stage: 'reading' });
    // Both currencies this app holds keep two, and the table says so per
    // currency; the default is what every one of them uses today.
    // The account says whether it is a card, which decides which way its
    // statement's signs run.
    const reading = readStatement(items, DEFAULT_MINOR_UNITS, { card: account.type === 'credit' });
    if (reading.rows.length === 0) throw new StatementUnreadable(this.i18n.t('ui.import.noRows'));
    stopIfCancelled(watch.signal);

    // What the person has already filed, before anything is proposed: without
    // it, somebody with years of movements typed in would be asked again
    // about every shop they have answered for a hundred times.
    watch.onProgress?.({ part: 0.78, stage: 'writing' });
    await proposals.learnFromLedger();
    stopIfCancelled(watch.signal);

    watch.onProgress?.({ part: 0.9, stage: 'writing' });
    const written = await this.write(accountId, nameOf(files), reading, proposals);
    watch.onProgress?.({ part: 1, stage: 'writing' });
    return written;
  }

  /** Writing a reading down, wherever it was read. */
  private async write(
    accountId: number,
    fileName: string,
    reading: StatementReading,
    proposals: ProposalsRepository,
  ): Promise<ImportedStatement> {
    const file = { name: fileName };
    const batch = `${file.name} ${new Date().toISOString()}`;
    const proposed = await proposals.propose(batch, reading.rows.map(row => ({
      source: 'statement' as const,
      account_id: accountId,
      occurred_on: row.occurred_on,
      amount_minor: row.amount_minor,
      description: row.description,
      evidence: {
        file: file.name,
        line: row.line,
        page: row.page,
        confidence: row.confidence,
        balance_minor: row.balance_minor,
        ...(row.summary ? { summary: true } : {}),
      },
    })));

    const imported = {
      batch, accountId, reading,
      proposed: proposed.ids.length, knownAlready: proposed.knownAlready,
    };
    this.lastImport.set(imported);
    return imported;
  }
}

/**
 * The text of what was chosen: one PDF, or one or more photos or screenshots
 * of a statement (read on the phone, `image-text.ts`), the pages in the order
 * they were chosen.
 */
async function textOf(files: readonly File[], password: string | undefined, watch: ReadingWatch): Promise<TextItem[]> {
  const images = files.filter(isImage);
  if (images.length > 0) return textOfImages(images, watch);
  return textOfPdf(await files[0].arrayBuffer(), password, undefined, watch);
}

/** "captura.jpg", or "captura.jpg (+2)" for three images. */
export function nameOf(files: readonly File[]): string {
  return files.length > 1 ? `${files[0].name} (+${files.length - 1})` : files[0].name;
}
