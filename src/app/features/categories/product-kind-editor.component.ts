/**
 * A product's own category: a name and a picture.
 *
 * These are the categories of a movement that touches only what a product
 * gathered - a cashback the bank paid in, a correction against what it says.
 * They were three words fixed in the schema until 2026-09-16 and are rows now,
 * so they are edited the way any other category is: the same screen, the same
 * order of questions, the same words.
 *
 * Two differences from the category editor next door, both because of what
 * these are. There is no side to choose - a product's movement is not filed as
 * spending or income - and a category with movements under it is archived
 * rather than deleted, so what was already recorded keeps its name.
 *
 * One editor, used from the two places these are met: the product's own
 * movement form, and the categories screen.
 */

import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import {
  IonButton, IonButtons, IonHeader, IonIcon, IonInput, IonItem, IonLabel, IonList, IonNote, IonToggle,
  IonToolbar,
} from '@ionic/angular';

import { DatabaseService } from '../../core/database/database.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { I18nService } from '../../core/i18n/i18n.service';
import { IconPickerComponent } from '../../core/icons/icon-picker.component';
import { CATEGORY_ICONS_CATALOG } from '../../core/icons/icon-catalog';
import {
  ProductKindsRepository, type ProductKind,
} from '../../core/database/repositories/product-kinds.repository';

@Component({
  selector: 'app-product-kind-editor',
  standalone: true,
  imports: [
    TranslatePipe, IconPickerComponent,
    IonHeader, IonToolbar, IonButtons, IonButton, IonIcon, IonItem, IonLabel,
    IonInput, IonList, IonNote, IonToggle,
  ],
  templateUrl: './product-kind-editor.component.html',
  // The category editor's own styles: these are categories, and a screen that
  // looks like a different thing says they are a different thing.
  styleUrls: ['./category-editor.component.scss'],
})
export class ProductKindEditorComponent {
  private readonly database = inject(DatabaseService);
  readonly i18n = inject(I18nService);

  /** The one being corrected, or null while one is being made. */
  readonly editing = input<ProductKind | null>(null);

  /** Saved, with its id, so a caller can select what was just made. */
  readonly saved = output<number>();
  readonly cancelled = output<void>();

  readonly catalog = CATEGORY_ICONS_CATALOG;

  readonly name = signal('');
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
    effect(() => {
      const kind = this.editing();
      this.error.set('');
      this.name.set(kind?.name ?? '');
      this.builtinIcon.set(kind?.builtin_icon ?? 'pricetag');
      this.customIconId.set(kind?.custom_icon_id ?? null);
      this.archived.set(kind?.archived === 1);
      this.usedBy.set(0);
      if (kind) void this.countUses(kind.id);
    });
  }

  private async countUses(id: number): Promise<void> {
    if (this.database.status() !== 'ready') return;
    this.usedBy.set(await new ProductKindsRepository(this.database.driver).timesUsed(id));
  }

  onIcon(choice: { builtin_icon: string | null; custom_icon_id: number | null }): void {
    this.builtinIcon.set(choice.builtin_icon);
    this.customIconId.set(choice.custom_icon_id);
  }

  async save(): Promise<void> {
    if (!this.canSave() || this.saving()) return;
    this.saving.set(true);
    this.error.set('');

    try {
      const repository = new ProductKindsRepository(this.database.driver);
      const changes = {
        name: this.name().trim(),
        builtin_icon: this.builtinIcon(),
        custom_icon_id: this.customIconId(),
        archived: this.archived(),
      };

      const existing = this.editing();
      let id: number;
      if (existing) {
        await repository.update(existing.id, changes);
        id = existing.id;
      } else {
        id = await repository.create(changes);
      }

      this.database.dataChanged();
      this.saved.emit(id);
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : String(error));
    } finally {
      this.saving.set(false);
    }
  }
}
