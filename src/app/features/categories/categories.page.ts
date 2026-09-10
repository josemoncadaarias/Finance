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
import type { CategoryKind, CategoryRow } from '../../core/database/types';
import { outlined } from '../../core/icons/icon-catalog';

@Component({
  selector: 'app-categories',
  templateUrl: './categories.page.html',
  styleUrls: ['./categories.page.scss'],
  imports: [
    TranslatePipe, LanguageButtonComponent, CategoryEditorComponent,
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

  async load(): Promise<void> {
    if (this.database.status() !== 'ready') return;
    this.loading.set(true);

    try {
      const categories = new CategoriesRepository(this.database.driver);

      // Counted over the whole history here, not the last year: this screen is
      // about what exists, and a category used heavily years ago is still a
      // category with a past worth seeing before archiving it.
      const [expenses, incomes, all] = await Promise.all([
        categories.listByUse({ kind: 'expense' }),
        categories.listByUse({ kind: 'income' }),
        categories.list({ includeArchived: true }),
      ]);

      this.expenses.set(expenses);
      this.incomes.set(incomes);
      this.archived.set(all.filter(category => category.archived === 1));
      await this.loadIcons();
    } finally {
      this.loading.set(false);
    }
  }

  private async loadIcons(): Promise<void> {
    const repository = new CustomIconsRepository(this.database.driver);
    const urls = new Map(this.iconUrls());

    for (const icon of await repository.list()) {
      if (urls.has(icon.id)) continue;
      const full = await repository.findById(icon.id);
      if (full) urls.set(icon.id, iconDataUrl(full));
    }
    this.iconUrls.set(urls);
  }

  iconUrl(id: number | null): string | undefined {
    return id === null ? undefined : this.iconUrls().get(id);
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
