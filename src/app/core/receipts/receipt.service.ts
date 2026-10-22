/**
 * A photo of a receipt becomes the spending form, filled in (Jose,
 * 2026-10-22): the total, the day and the shop read on the phone
 * (`textOfImages`, `readReceipt`), and what the app already learned about
 * that shop - its category, its account and the note written for it - from
 * the merchant dictionary (`merchant_categories`); for a shop never seen, the
 * ordinary words of its name may suggest a starter category. Nothing is
 * saved by itself (rule 22): the form opens, and the person checks and saves.
 * Free, as typing a movement is (rule 21).
 */

import { Injectable, inject } from '@angular/core';

import { DatabaseService } from '../database/database.service';
import { ProposalsRepository } from '../database/repositories/proposals.repository';
import { I18nService } from '../i18n/i18n.service';
import { ComposeService } from '../ui/compose.service';
import { ToastService } from '../../shared/ui/toast.service';
import { isoDay } from '../filters/period';
import { merchantKeyOf } from '../proposals/merchant';
import { ReaderNotReady, textOfImages } from '../statements/image-text';
import { readReceipt } from './read-receipt';

@Injectable({ providedIn: 'root' })
export class ReceiptService {
  private readonly database = inject(DatabaseService);
  private readonly compose = inject(ComposeService);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18nService);

  async fromPhoto(file: File): Promise<void> {
    this.toast.say(this.i18n.t('receipt.reading'), 20_000, { icon: 'receipt-outline' });
    const today = isoDay(new Date());
    let receipt;
    try {
      receipt = readReceipt(await textOfImages([file]), today);
    } catch (problem) {
      this.toast.say(this.i18n.t(problem instanceof ReaderNotReady ? 'receipt.notReady' : 'receipt.noText'), 7000, { icon: 'alert-circle' });
      return;
    }

    const db = this.database.driver;
    const key = merchantKeyOf(receipt.shop);
    const known = key
      ? await db.queryOne<{ category_id: number; account_id: number | null; note: string | null }>(
        'SELECT category_id, account_id, note FROM merchant_categories WHERE merchant = ?', [key])
      : null;
    const categoryId = known?.category_id
      ?? (receipt.shop ? await new ProposalsRepository(db).guessedCategoryOf(receipt.shop, -1) : null);

    this.compose.open('expense', {
      preferredAccountId: known?.account_id ?? null,
      start: {
        amountMinor: receipt.totalMinor ?? 0,
        onDate: receipt.onDate ?? today,
        note: known?.note?.trim() || receipt.shop || '',
        categoryId,
      },
    });

    const said = receipt.totalMinor === null ? 'receipt.noTotal'
      : !receipt.totalSure ? 'receipt.unsureTotal'
      : receipt.onDate === null ? 'receipt.noDate'
      : 'receipt.read';
    this.toast.say(this.i18n.t(said), 6000, { icon: said === 'receipt.read' ? 'checkmark-circle' : 'alert-circle' });
  }
}
