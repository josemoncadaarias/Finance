/**
 * The categories, in the order they are actually used.
 *
 * Spending and income are two separate lists rather than one with a label,
 * because they are never chosen together: recording an expense offers one set
 * and recording income offers the other. Showing them mixed here would be a
 * different shape from the one the rest of the app uses.
 *
 * Each row carries how many movements are filed under it — the number that
 * makes archiving an informed decision rather than a guess.
 */

import { Component, computed, effect, inject, signal } from '@angular/core';
import {
  IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonIcon,
  IonList, IonItem, IonLabel, IonNote, IonSpinner, IonMenuButton, IonModal, IonBadge,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import * as allIcons from 'ionicons/icons';

import { DatabaseService } from '../../core/database/database.service';
import {
  CategoriesRepository, type UsedCategory,
} from '../../core/database/repositories/categories.repository';
import { CustomIconsRepository, iconDataUrl } from '../../core/database/repositories/custom-icons.repository';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { LanguageButtonComponent } from '../../core/i18n/language-button.component';
import { CategoryEditorComponent } from './category-editor.component';
import { ProductKindsRepository, type ProductKind } from '../../core/database/repositories/product-kinds.repository';
import { ProductKindEditorComponent } from './product-kind-editor.component';
import type { CategoryKind, CategoryRow } from '../../core/database/types';
import { outlined } from '../../core/icons/icon-catalog';
import { IconComponent } from '../../core/icons/icon.component';
import { CustomIconsService } from '../../core/icons/custom-icons.service';

@Component({
  selector: 'app-categories',
  templateUrl: './categories.page.html',
  styleUrls: ['./categories.page.scss'],
  imports: [
    IconComponent,
    TranslatePipe, LanguageButtonComponent, CategoryEditorComponent, ProductKindEditorComponent,
    IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonIcon,
    IonList, IonItem, IonLabel, IonNote, IonSpinner, IonMenuButton, IonModal, IonBadge,
  ],
})
export class CategoriesPage {
  readonly database = inject(DatabaseService);
  readonly status = this.database.status;

  readonly expenses = signal<UsedCategory[]>([]);
  readonly incomes = signal<UsedCategory[]>([]);
  readonly archived = signal<CategoryRow[]>([]);

  /**
   * The categories of a product's own movement.
   *
   * They live in a table of their own because a movement that only touches
   * what a product gathered is not a movement of the account - it has no
   * amount in the ledger to classify. They are kept here all the same: this is
   * the screen someone opens looking for a list of categories.
   */
  readonly productKinds = signal<ProductKind[]>([]);
  readonly kindEditor = signal<{ kind: ProductKind | null } | null>(null);

  /**
   * The name of the third list, as a field rather than a literal in the
   * template: a quoted word inside a bound attribute reads as an icon name
   * to the test that checks every icon in a template exists.
   */
  readonly productsSide = 'products';
  readonly showArchived = signal(false);

  /** Icon names arrive with or without their suffix; this settles it. */
  readonly outlined = outlined;
  readonly loading = signal(false);

  /** Non-null while the editor is open; the category is null when creating. */
  readonly editor = signal<{ category: CategoryRow | null; kind: CategoryKind } | null>(null);

  private readonly iconUrls = signal<Map<number, string>>(new Map());

  readonly archivedCount = computed(() => this.archived().length);

  constructor() {
    addIcons(allIcons as unknown as Record<string, string>);

    effect(() => {
      this.database.dataVersion();
      if (this.database.status() === 'ready') void this.load();
    });
  }

  /**
   * Which of the two lists are open. Both, to begin with.
   *
   * There are only two, so hiding them by default would mean the screen
   * opens showing nothing at all. Folding is for putting one aside while
   * the other is being worked through.
   */
  readonly openSides = signal<ReadonlySet<string>>(new Set(['expense', 'income']));

  isOpen(kind: string): boolean {
    return this.openSides().has(kind);
  }

  toggle(kind: string): void {
    this.openSides.update(current => {
      const next = new Set(current);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });
  }

  /** The product categories were changed: read them again and close the sheet. */
  async kindSaved(): Promise<void> {
    this.kindEditor.set(null);
    await this.load();
  }

  async load(): Promise<void> {
    if (this.database.status() !== 'ready') return;
    this.loading.set(true);

    try {
      const categories = new CategoriesRepository(this.database.driver);

      // Counted over the whole history here, not the last year: this screen is
      // about what exists, and a category used heavily years ago is still a
      // category with a past worth seeing before archiving it.
      const [expenses, incomes, all, kinds] = await Promise.all([
        categories.listByUse({ kind: 'expense' }),
        categories.listByUse({ kind: 'income' }),
        categories.list({ includeArchived: true }),
        new ProductKindsRepository(this.database.driver).list(),
      ]);

      this.expenses.set(expenses);
      this.incomes.set(incomes);
      this.productKinds.set(kinds);
      this.archived.set(all.filter(category => category.archived === 1));
      await this.loadIcons();
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * The images, from the one service that holds them.
   *
   * This screen used to keep its own copy of the read-the-blobs loop, which is
   * the duplication `CustomIconsService` exists to end - and now that the
   * icons are drawn by <app-icon>, which reads that service, a private copy
   * would have left this screen showing fallbacks while holding the right
   * images in a map nothing looks at.
   */
  private readonly customIcons = inject(CustomIconsService);

  private async loadIcons(): Promise<void> {
    await this.customIcons.load();
  }

  add(kind: CategoryKind): void {
    this.editor.set({ category: null, kind });
  }

  edit(category: CategoryRow): void {
    this.editor.set({ category, kind: category.kind });
  }

  onSaved(): void {
    this.editor.set(null);
  }

  toggleArchived(): void {
    this.showArchived.update(shown => !shown);
  }
}
