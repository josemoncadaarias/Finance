/**
 * Creating a category, and correcting one.
 *
 * A category is a name, a face and a side: spending or income. The side can
 * be changed even once used (Jose, 2026-10-14: it was locked, and a category
 * set up on the wrong side had no way out). Everything filed under it turns
 * over with it - never silently: it is asked first, saying how many
 * movements change and that the balances change with them
 * (`changeCategoryKind`).
 */

import {
  Component, HostListener, computed, inject, input, output, signal, type OnInit,
} from '@angular/core';
import { IonIcon, IonModal } from '@ionic/angular';
import { addIcons } from 'ionicons';
import * as allIcons from 'ionicons/icons';

import { DatabaseService } from '../../core/database/database.service';
import { CategoriesRepository } from '../../core/database/repositories/categories.repository';
import { changeCategoryKind, kindChangeReach, KindTaken } from '../../core/categories/change-kind';
import { ConfirmComponent } from '../../shared/confirm/confirm.component';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { BadgeComponent } from '../../shared/ui/badge.component';
import { FaceEditorComponent, type FaceChoice } from '../../shared/ui/face-editor.component';
import { CATEGORY_ICONS_CATALOG } from '../../core/icons/icon-catalog';
import type { CategoryKind, CategoryRow } from '../../core/database/types';

@Component({
  selector: 'app-category-editor',
  imports: [TranslatePipe, BadgeComponent, FaceEditorComponent, ConfirmComponent, IonIcon, IonModal],
  templateUrl: './category-editor.component.html',
  styleUrls: ['./category-editor.component.scss'],
})
export class CategoryEditorComponent implements OnInit {
  private readonly database = inject(DatabaseService);
  readonly i18n = inject(I18nService);

  /** The category being corrected, or null when creating one. */
  readonly editing = input<CategoryRow | null>(null);
  /** Which side a new category starts on, from the list it was created in. */
  readonly startKind = input<CategoryKind>('expense');

  readonly saved = output<void>();
  readonly cancelled = output<void>();

  readonly catalog = CATEGORY_ICONS_CATALOG;
  readonly kinds: CategoryKind[] = ['expense', 'income'];

  readonly name = signal('');
  readonly kind = signal<CategoryKind>('expense');
  readonly builtinIcon = signal<string | null>('pricetag');
  readonly customIconId = signal<number | null>(null);
  readonly archived = signal(false);
  readonly countsAsReturn = signal(false);
  readonly color = signal<string | null>(null);
  readonly editingFace = signal(false);
  readonly pickingKind = signal(false);
  readonly nameFocused = signal(false);

  /** How many movements are filed under it, so archiving is an informed act. */
  readonly usedBy = signal(0);
  readonly saving = signal(false);
  readonly error = signal('');

  readonly isNew = computed(() => this.editing() === null);

  /** What a change of side would turn over: movements, and products' own. */
  readonly reach = signal({ movements: 0, entries: 0 });
  readonly reachCount = computed(() => this.reach().movements + this.reach().entries);
  readonly kindChanges = computed(() => {
    const category = this.editing();
    return category !== null && category.kind !== this.kind();
  });
  readonly confirmingKind = signal(false);

  /** "¿Pasar Arriendo a Gasto?" */
  readonly kindQuestion = computed(() => this.i18n.t('categories.kind.ask', {
    name: this.name().trim() || this.editing()?.name || '',
    kind: this.i18n.t(this.kind() === 'expense' ? 'categories.kind.expense' : 'categories.kind.income'),
  }));

  /** How many turn over, and which way. */
  readonly kindBody = computed(() => {
    const one = this.reachCount() === 1 ? 'One' : '';
    return this.i18n.t(
      `categories.kind.${this.kind() === 'expense' ? 'toExpense' : 'toIncome'}${one}` as 'categories.kind.toExpense',
      { count: this.reachCount().toLocaleString(this.i18n.dateLocale()) });
  });

  readonly title = computed(() =>
    this.i18n.t(this.isNew() ? 'categories.new' : 'categories.edit'));

  readonly missing = computed<string | null>(() =>
    this.name().trim() === '' ? this.i18n.t('categories.need.name') : null);

  readonly canSave = computed(() => this.missing() === null);

  constructor() {
    addIcons(allIcons as unknown as Record<string, string>);
  }

  ngOnInit(): void {
    void this.load();
  }

  private async load(): Promise<void> {
    const category = this.editing();
    if (!category) {
      this.kind.set(this.startKind());
      return;
    }

    this.name.set(category.name);
    this.kind.set(category.kind);
    this.builtinIcon.set(category.builtin_icon);
    this.customIconId.set(category.custom_icon_id);
    this.color.set(category.color);
    this.archived.set(category.archived === 1);
    this.countsAsReturn.set(category.counts_as_return === 1);

    if (this.database.status() !== 'ready') return;
    const row = await this.database.driver.queryOne<{ n: number }>(
      'SELECT COUNT(*) AS n FROM transactions WHERE category_id = ?', [category.id]);
    this.usedBy.set(row?.n ?? 0);
    this.reach.set(await kindChangeReach(this.database.driver, category.id));
  }

  @HostListener('document:keydown', ['$event'])
  onKey(event: KeyboardEvent): void {
    if (event.defaultPrevented || event.ctrlKey || event.altKey || event.metaKey) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      this.cancelled.emit();
    } else if (event.key === 'Enter' && this.canSave()) {
      event.preventDefault();
      void this.save();
    }
  }

  onFace(choice: FaceChoice): void {
    this.builtinIcon.set(choice.builtin_icon ?? (choice.custom_icon_id === null ? 'pricetag' : this.builtinIcon()));
    this.customIconId.set(choice.custom_icon_id);
    this.color.set(choice.color);
    this.editingFace.set(false);
  }

  /** "112 movimientos", or nothing yet. */
  readonly usedLine = computed(() => {
    const count = this.usedBy();
    if (count === 0) return this.i18n.t('ui.unused');
    return count === 1 ? this.i18n.t('ui.count.movement') : this.i18n.t('ui.count.movements', { count: count.toLocaleString(this.i18n.dateLocale()) });
  });

  async save(confirmed = false): Promise<void> {
    if (!this.canSave() || this.saving()) return;
    // A used category changing side is asked first, saying how many.
    if (this.kindChanges() && this.reachCount() > 0 && !confirmed) {
      this.confirmingKind.set(true);
      return;
    }
    this.confirmingKind.set(false);
    this.saving.set(true);
    this.error.set('');

    try {
      const categories = new CategoriesRepository(this.database.driver);
      const category = this.editing();

      const shared = {
        name: this.name().trim(),
        builtin_icon: this.builtinIcon(),
        custom_icon_id: this.customIconId(),
        ...(this.color() !== null ? { color: this.color()! } : {}),
        counts_as_return: this.countsAsReturn(),
      };

      if (category) {
        if (this.kindChanges()) await changeCategoryKind(this.database.driver, category.id, this.kind());
        await categories.update(category.id, { ...shared, archived: this.archived() });
      } else {
        await categories.create({ ...shared, kind: this.kind() });
      }

      this.database.dataChanged();
      this.saved.emit();
    } catch (error) {
      this.error.set(error instanceof KindTaken
        ? this.i18n.t('categories.kind.taken', { name: error.categoryName })
        : error instanceof Error ? error.message : String(error));
    } finally {
      this.saving.set(false);
    }
  }
}
