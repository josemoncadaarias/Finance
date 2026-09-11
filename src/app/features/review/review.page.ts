/**
 * Everything the importer had to assume, so it can be confirmed or corrected.
 *
 * The counts were already on the import screen; what was missing was the
 * ability to act on them. A number the app knows is uncertain, and that nobody
 * can look at, is worse than no number: it looks exact.
 *
 * Correcting a movement here goes through the ordinary entry screen, which
 * locks the row — so a later re-import of the Monefy backup leaves the
 * correction alone.
 */

import { Component, computed, effect, inject, signal } from '@angular/core';
import {
  IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonIcon,
  IonList, IonItem, IonLabel, IonNote, IonSpinner, IonMenuButton, IonModal, IonBadge,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import * as allIcons from 'ionicons/icons';

import { DatabaseService } from '../../core/database/database.service';
import { ReviewRepository, type ReviewGroup, type ReviewItem } from '../../core/database/repositories/review.repository';
import { TransactionsRepository } from '../../core/database/repositories/transactions.repository';
import { AccountsRepository } from '../../core/database/repositories/accounts.repository';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { LanguageButtonComponent } from '../../core/i18n/language-button.component';
import { MoneyPipe } from '../../shared/money.pipe';
import { EntryComponent, type EntryRequest } from '../entry/entry.component';
import { AccountEditorComponent } from '../accounts/account-editor.component';
import type { AccountRow } from '../../core/database/types';

/**
 * The kinds that are a statement rather than a question.
 *
 * These the importer handled correctly and is only telling you about; they can
 * be closed in one go without reading each one. Everything else is a real
 * assumption about your money and gets looked at individually.
 */
const INFORMATIONAL = new Set([
  'credit_limit_change',
  'multi_currency_split',
  'deleted_account',
]);

@Component({
  selector: 'app-review',
  templateUrl: './review.page.html',
  styleUrls: ['./review.page.scss'],
  imports: [
    TranslatePipe, MoneyPipe, LanguageButtonComponent, EntryComponent, AccountEditorComponent,
    IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonIcon,
    IonList, IonItem, IonLabel, IonNote, IonSpinner, IonMenuButton, IonModal, IonBadge,
  ],
})
export class ReviewPage {
  readonly database = inject(DatabaseService);
  readonly i18n = inject(I18nService);

  readonly status = this.database.status;
  readonly groups = signal<ReviewGroup[]>([]);
  readonly items = signal<ReviewItem[]>([]);
  readonly openKind = signal<string | null>(null);
  readonly loading = signal(false);
  readonly error = signal('');

  /** Open while a movement or an account is being corrected. */
  readonly entry = signal<EntryRequest | null>(null);
  readonly accountEditor = signal<AccountRow | null>(null);

  readonly total = computed(() => this.groups().reduce((sum, g) => sum + g.count, 0));
  readonly allClear = computed(() => !this.loading() && this.total() === 0);

  isInformational(kind: string): boolean {
    return INFORMATIONAL.has(kind);
  }

  constructor() {
    addIcons(allIcons as unknown as Record<string, string>);

    effect(() => {
      this.database.dataVersion();
      if (this.database.status() === 'ready') void this.load();
    });
  }

  async load(): Promise<void> {
    if (this.database.status() !== 'ready') return;
    this.loading.set(true);

    try {
      const reviews = new ReviewRepository(this.database.driver);
      this.groups.set(await reviews.openGroups());

      const kind = this.openKind();
      this.items.set(kind ? await reviews.open(kind) : []);
    } finally {
      this.loading.set(false);
    }
  }

  async openGroup(kind: string): Promise<void> {
    this.openKind.set(this.openKind() === kind ? null : kind);
    await this.load();
  }

  /** Opens whatever the item points at, in the screen that can correct it. */
  async fix(item: ReviewItem): Promise<void> {
    this.error.set('');

    try {
      if (item.entity_type === 'transaction' && item.entity_id !== null) {
        const transaction = await new TransactionsRepository(this.database.driver)
          .findById(item.entity_id);
        if (!transaction) throw new Error(this.i18n.t('review.gone'));

        this.entry.set({
          kind: transaction.transfer_id !== null
            ? 'transfer'
            : transaction.amount_minor >= 0 ? 'income' : 'expense',
          editing: transaction,
        });
        return;
      }

      if (item.entity_type === 'account' && item.entity_id !== null) {
        const account = await new AccountsRepository(this.database.driver)
          .findById(item.entity_id);
        if (!account) throw new Error(this.i18n.t('review.gone'));
        this.accountEditor.set(account);
        return;
      }

      // Nothing to open: the item is a statement about the import as a whole.
      await this.resolve(item);
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * Closes one item, and says so to the rest of the app.
   *
   * `load()` refreshes this screen and nothing else. The count on the drawer
   * is derived from the same data and watches `dataVersion`, so without the
   * announcement it kept showing the number it was built with - and the only
   * way to correct it was to reload the page, which is the report Jose made.
   */
  async resolve(item: ReviewItem): Promise<void> {
    await new ReviewRepository(this.database.driver).resolve(item.id);
    await this.load();
    this.database.dataChanged();
  }

  async resolveAll(kind: string): Promise<void> {
    await new ReviewRepository(this.database.driver)
      .resolveKind(kind, this.i18n.t('review.closedInBatch'));
    await this.load();
    this.database.dataChanged();
  }

  /**
   * A correction was saved, so the thing that was uncertain no longer is.
   *
   * Closing the item automatically is the right default: the user went in,
   * looked, and either changed it or confirmed it by saving. Leaving it open
   * would mean reviewing the same row twice.
   */
  async onFixed(item: ReviewItem | null): Promise<void> {
    this.entry.set(null);
    this.accountEditor.set(null);
    if (item) await this.resolve(item);
    else await this.load();
  }

  /** Which item a modal is currently correcting, so it can be closed after. */
  readonly correcting = signal<ReviewItem | null>(null);

  async startFix(item: ReviewItem): Promise<void> {
    this.correcting.set(item);
    await this.fix(item);
  }

  async finishFix(): Promise<void> {
    const item = this.correcting();
    this.correcting.set(null);
    await this.onFixed(item);
  }

  cancelFix(): void {
    this.correcting.set(null);
    this.entry.set(null);
    this.accountEditor.set(null);
  }
}
