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
import { Location } from '@angular/common';
import { IonContent, IonIcon, IonSpinner, IonModal } from '@ionic/angular';
import { addIcons } from 'ionicons';
import * as allIcons from 'ionicons/icons';

import { DatabaseService } from '../../core/database/database.service';
import {
  CategoriesRepository, type UsedCategory,
} from '../../core/database/repositories/categories.repository';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { I18nService } from '../../core/i18n/i18n.service';
import { BadgeComponent } from '../../shared/ui/badge.component';
import { JumpComponent } from '../../shared/ui/jump.component';
import { CategoryEditorComponent } from './category-editor.component';
import { ProductKindsRepository, type ProductKind } from '../../core/database/repositories/product-kinds.repository';
import { ProductKindEditorComponent } from './product-kind-editor.component';
import type { CategoryKind, CategoryRow } from '../../core/database/types';
import { outlined } from '../../core/icons/icon-catalog';
import { CustomIconsService } from '../../core/icons/custom-icons.service';

/** The order last chosen, wherever it was chosen. */
function readOrder(): 'use' | 'name' {
  try {
    return localStorage.getItem('finance.categoryOrder') === 'name' ? 'name' : 'use';
  } catch {
    return 'use';
  }
}

@Component({
  selector: 'app-categories',
  templateUrl: './categories.page.html',
  styleUrls: ['./categories.page.scss'],
  imports: [
    TranslatePipe, CategoryEditorComponent, ProductKindEditorComponent, BadgeComponent, JumpComponent,
    IonContent, IonIcon, IonSpinner, IonModal,
  ],
})
export class CategoriesPage {
  readonly database = inject(DatabaseService);
  readonly status = this.database.status;

  private readonly rawExpenses = signal<UsedCategory[]>([]);
  private readonly rawIncomes = signal<UsedCategory[]>([]);

  /**
   * Most used, or A to Z.
   *
   * The same question the category sheet asks while a movement is being
   * typed, so it is the same preference: one key, `finance.categoryOrder`,
   * because it is one list and it would be strange for it to be sorted two
   * ways on two screens. Asked for by Jose on 2026-09-24, who met this screen
   * sorted one way and the picker sorted another.
   */
  readonly order = signal<'use' | 'name'>(readOrder());

  setOrder(order: 'use' | 'name'): void {
    this.order.set(order);
    try {
      localStorage.setItem('finance.categoryOrder', order);
    } catch {
      // Storage switched off: the order holds for this visit and no longer.
    }
  }

  /** Ignores case and accents, the way the picker's search does. */
  private byName(rows: readonly UsedCategory[]): UsedCategory[] {
    return [...rows].sort((one, other) => one.name.localeCompare(other.name, 'es'));
  }

  readonly expenses = computed(() =>
    this.order() === 'name' ? this.byName(this.rawExpenses()) : this.rawExpenses());
  readonly incomes = computed(() =>
    this.order() === 'name' ? this.byName(this.rawIncomes()) : this.rawIncomes());
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
   * Which lists are open. None, to begin with.
   *
   * They started open, back when there were two of them and a closed screen
   * would have shown nothing at all. There are three now and the expenses
   * alone run past a screen and a half, which pushed the third heading off
   * the bottom edge - Jose could not find it. Closed, the three headings and
   * their counts are the whole screen, and opening one is a tap.
   */
  readonly openSides = signal<ReadonlySet<string>>(new Set());

  /** The three headings, in the order they are drawn. */
  private readonly sides = ['expense', 'income'];

  readonly allCollapsed = computed(() => this.openSides().size === 0);

  private readonly i18n = inject(I18nService);
  private readonly location = inject(Location);

  /** Opens both or closes both, whichever the screen is not. */
  foldAll(): void {
    const open = this.allCollapsed();
    this.openSides.set(new Set(open ? this.sides : []));
  }

  back(): void {
    this.location.back();
  }

  /** "16 categorías": a count says what it counts. */
  countOf(count: number): string {
    return count === 1 ? this.i18n.t('ui.count.category') : this.i18n.t('ui.count.categories', { count });
  }

  usedIn(times: number): string {
    if (times === 0) return this.i18n.t('ui.unused');
    return times === 1 ? this.i18n.t('categories.inUse.one') : this.i18n.t('categories.inUse', { count: times.toLocaleString(this.i18n.dateLocale()) });
  }

  readonly archivedLabel = computed(() => {
    const count = this.archivedCount();
    const key = this.showArchived()
      ? (count === 1 ? 'categories.hideArchived.one' : 'categories.hideArchived')
      : (count === 1 ? 'categories.showArchived.one' : 'categories.showArchived');
    return this.i18n.t(key as 'categories.showArchived', { count });
  });

  /** Open while the one "new category" button is asking which list. */
  readonly choosingList = signal(false);

  /**
   * One way in, wherever the category belongs.
   *
   * Each list used to carry its own button, which meant the way to add a
   * category was wherever that list happened to have scrolled to - and the
   * products one, last of three, was off the bottom of the screen. This one
   * is held above all of them and asks which list, which is a question with
   * three short answers and is asked far less often than a category is
   * looked for.
   */
  startNew(): void {
    this.choosingList.set(true);
  }

  newIn(kind: string): void {
    this.choosingList.set(false);
    if (kind === this.productsSide) this.kindEditor.set({ kind: null });
    else this.add(kind as CategoryKind);
  }

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

      this.rawExpenses.set(expenses);
      this.rawIncomes.set(incomes);
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
