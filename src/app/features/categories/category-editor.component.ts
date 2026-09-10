/**
 * Creating a category, and correcting one.
 *
 * A category is a name, a face and a side: spending or income. The side is
 * locked once the category exists, for the same reason an account's currency
 * is — every movement already filed under it was filed as one or the other,
 * and flipping the label would silently turn a year of expenses into income.
 * A category on the wrong side is fixed by making the right one and moving its
 * movements across, which leaves a trail.
 */

import {
  Component, HostListener, computed, inject, input, output, signal, type OnInit,
} from '@angular/core';
import {
  IonContent, IonHeader, IonToolbar, IonButtons, IonButton, IonIcon, IonItem,
  IonInput, IonLabel, IonList, IonNote, IonToggle, IonFooter, IonSelect, IonSelectOption,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import * as allIcons from 'ionicons/icons';

import { DatabaseService } from '../../core/database/database.service';
import { CategoriesRepository } from '../../core/database/repositories/categories.repository';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { IconPickerComponent, type IconChoice } from '../../core/icons/icon-picker.component';
import { CATEGORY_ICONS_CATALOG } from '../../core/icons/icon-catalog';
import type { CategoryKind, CategoryRow } from '../../core/database/types';

@Component({
  selector: 'app-category-editor',
  imports: [
    TranslatePipe, IconPickerComponent,
    IonContent, IonHeader, IonToolbar, IonButtons, IonButton, IonIcon, IonItem,
    IonInput, IonLabel, IonList, IonNote, IonToggle, IonFooter, IonSelect, IonSelectOption,
  ],
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

  /** How many movements are filed under it, so archiving is an informed act. */
  readonly usedBy = signal(0);
  readonly saving = signal(false);
  readonly error = signal('');

  readonly isNew = computed(() => this.editing() === null);

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
    this.archived.set(category.archived === 1);

    if (this.database.status() !== 'ready') return;
    const row = await this.database.driver.queryOne<{ n: number }>(
      'SELECT COUNT(*) AS n FROM transactions WHERE category_id = ?', [category.id]);
    this.usedBy.set(row?.n ?? 0);
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

  onIcon(choice: IconChoice): void {
    this.builtinIcon.set(choice.builtin_icon);
    this.customIconId.set(choice.custom_icon_id);
  }

  async save(): Promise<void> {
    if (!this.canSave() || this.saving()) return;
    this.saving.set(true);
    this.error.set('');

    try {
      const categories = new CategoriesRepository(this.database.driver);
      const category = this.editing();

      const shared = {
        name: this.name().trim(),
        builtin_icon: this.builtinIcon(),
        custom_icon_id: this.customIconId(),
      };

      if (category) {
        await categories.update(category.id, { ...shared, archived: this.archived() });
      } else {
        await categories.create({ ...shared, kind: this.kind() });
      }

      this.database.dataChanged();
      this.saved.emit();
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : String(error));
    } finally {
      this.saving.set(false);
    }
  }
}
