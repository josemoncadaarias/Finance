/**
 * Importing a statement: read the file, propose what it says.
 *
 * Deliberately thin. The reading is `readStatement`, the questions asked of
 * each row are the repository's, and what a person does about them is the
 * review screen's. This only joins the three, and gives the screen back
 * everything it needs to explain what happened - including the statement's own
 * balances, which are what say whether the reading can be trusted at all.
 */

import { Injectable, inject } from '@angular/core';

import { DatabaseService } from '../database/database.service';
import { ProposalsRepository } from '../database/repositories/proposals.repository';
import { AccountsRepository } from '../database/repositories/accounts.repository';
import { DEFAULT_MINOR_UNITS } from '../database/money';
import { readStatement, type StatementReading } from './statement';
import { textOfPdf } from './pdf-text';

export interface ImportedStatement {
  /** What ties these proposals together, and what the screen asks back for. */
  batch: string;
  reading: StatementReading;
  /** How many rows became proposals. Fewer than read when some were rejected before. */
  proposed: number;
}

@Injectable({ providedIn: 'root' })
export class StatementsService {
  private readonly database = inject(DatabaseService);

  /**
   * Reads a statement into proposals for one account.
   *
   * The account decides what the numbers mean: a statement is read in the
   * currency of the account it belongs to, never in one guessed from the page.
   */
  async importInto(accountId: number, file: File, password?: string): Promise<ImportedStatement> {
    const db = this.database.driver;
    const accounts = new AccountsRepository(db);
    const proposals = new ProposalsRepository(db);

    const account = await accounts.findById(accountId);
    if (!account) throw new Error(`No account ${accountId}`);

    const items = await textOfPdf(await file.arrayBuffer(), password);
    // Both currencies this app holds keep two, and the table says so per
    // currency; the default is what every one of them uses today.
    const reading = readStatement(items, DEFAULT_MINOR_UNITS);

    // What the person has already filed, before anything is proposed: without
    // it, somebody with years of movements typed in would be asked again
    // about every shop they have answered for a hundred times.
    await proposals.learnFromLedger();

    const batch = `${file.name} ${new Date().toISOString()}`;
    const ids = await proposals.propose(batch, reading.rows.map(row => ({
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
      },
    })));

    return { batch, reading, proposed: ids.length };
  }
}
