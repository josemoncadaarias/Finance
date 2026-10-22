/**
 * A photo of a receipt becomes the spending form, filled in (Jose,
 * 2026-10-22): the total, the day and the shop read on the phone
 * (`textOfImages`, `readReceipt`), and what the app already learned about
 * that shop - its category, its account and the note written for it - from
 * the person's own data (`shopMatch`: the shop learned, the same chain at
 * another branch, a category named by its words, notes naming it); for a
 * shop never seen, the ordinary words of its name may suggest a starter
 * category. Nothing is
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
import { ReaderNotReady, lastPages, textOfImages } from '../statements/image-text';
import { readReceipt, receiptSteps } from './read-receipt';
import { leadingWord, shopMatch, type KnownShop, type NamedCategory, type PastNote } from './shop-category';

@Injectable({ providedIn: 'root' })
export class ReceiptService {
  private readonly database = inject(DatabaseService);
  private readonly compose = inject(ComposeService);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18nService);
  /** What the last photo gave the form, copied with the reading (`copyRead`). */
  private lastRead: unknown = null;

  async fromPhoto(file: File): Promise<void> {
    this.toast.say(this.i18n.t('receipt.reading'), 20_000, { icon: 'receipt-outline' });
    const today = isoDay(new Date());
    let receipt;
    try {
      const items = await textOfImages([file]);
      receipt = readReceipt(items, today);
      this.lastRead = { phone: navigator.userAgent, receipt, steps: receiptSteps(items) };
    } catch (problem) {
      this.toast.say(this.i18n.t(problem instanceof ReaderNotReady ? 'receipt.notReady' : 'receipt.noText'), 7000, { icon: 'alert-circle' });
      return;
    }

    const db = this.database.driver;
    // The person's own shops, categories and notes, read once (shopMatch).
    const known = receipt.shop ? await db.query<KnownShop>(
      `SELECT m.merchant, m.category_id AS categoryId, m.account_id AS accountId, m.note, m.times
         FROM merchant_categories m JOIN categories c ON c.id = m.category_id
        WHERE c.kind = 'expense' AND c.archived = 0`) : [];
    const categories = receipt.shop ? await db.query<NamedCategory>(
      `SELECT id, name FROM categories WHERE kind = 'expense' AND archived = 0`) : [];
    const lead = receipt.shop ? leadingWord(receipt.shop) : null;
    const notes = lead ? await db.query<PastNote>(
      `SELECT t.description AS text, t.category_id AS categoryId
         FROM transactions t JOIN categories c ON c.id = t.category_id
        WHERE t.amount_minor < 0 AND c.kind = 'expense' AND c.archived = 0 AND t.description LIKE ?
        ORDER BY t.occurred_on DESC LIMIT 300`,
        // Without its first letter, so an accent on it ("Éxito") still matches;
        // shopMatch keeps only the notes that really name the shop.
        [`%${(lead.length >= 5 ? lead.slice(1) : lead).toLowerCase()}%`]) : [];
    const match = shopMatch(receipt.shop, known, categories, notes);
    const categoryId = match?.categoryId
      ?? (receipt.shop ? await new ProposalsRepository(db).guessedCategoryOf(receipt.shop, -1) : null);

    this.lastRead = { ...(this.lastRead as object), categoryId, accountId: match?.accountId ?? null };
    this.compose.open('expense', {
      preferredAccountId: match?.accountId ?? null,
      start: {
        amountMinor: receipt.totalMinor ?? 0,
        onDate: receipt.onDate ?? today,
        note: match?.note?.trim() || receipt.shop || '',
        categoryId,
      },
    });

    const said = receipt.totalMinor === null ? 'receipt.noTotal'
      : !receipt.totalSure ? 'receipt.unsureTotal'
      : receipt.onDate === null ? 'receipt.noDate'
      : 'receipt.read';
    this.toast.say(this.i18n.t(said), 8000, {
      icon: said === 'receipt.read' ? 'checkmark-circle' : 'alert-circle',
      action: { label: this.i18n.t('receipt.copyRead'), run: () => void this.copyRead() },
    });
  }

  /**
   * What the phone read, copied as it came, so a misread total can be sent
   * and replayed exactly - lines and their boxes, never the image.
   */
  private async copyRead(): Promise<void> {
    const text = JSON.stringify({ read: this.lastRead, pages: lastPages });
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const box = document.createElement('textarea');
      box.value = text;
      document.body.appendChild(box);
      box.select();
      document.execCommand('copy');
      box.remove();
    }
    this.toast.say(this.i18n.t('receipt.copied'), 4000, { icon: 'copy-outline' });
  }
}
