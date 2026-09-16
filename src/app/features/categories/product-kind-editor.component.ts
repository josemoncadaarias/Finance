/**
 * A product's own category: a name and a picture, nothing else.
 *
 * These are the categories of a movement that touches only what a product
 * gathered - a cashback the bank paid in, a correction against what it says.
 * They were three words fixed in the schema until 2026-09-16 and are rows now,
 * so they are edited the way any other category is.
 *
 * One editor, used from the two places they are met: the product's own
 * movement form, and the categories screen, where someone goes looking for a
 * list of categories to keep.
 */

import { Component, effect, inject, input, output, signal } from '@angular/core';
import { IonButton, IonIcon, IonInput, IonItem, IonList } from '@ionic/angular';

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
  imports: [TranslatePipe, IconPickerComponent, IonButton, IonIcon, IonInput, IonItem, IonList],
  template: `
    <div class="confirm-dialog kind-editor">
      <h2>{{ (kind() ? 'cushion.kinds.editTitle' : 'cushion.kinds.newTitle') | t }}</h2>

      <ion-list [inset]="true">
        <ion-item>
          <ion-input [label]="'cushion.kinds.name' | t" labelPlacement="stacked"
                     [value]="name()" (ionInput)="name.set($any($event.target).value ?? '')"></ion-input>
        </ion-item>
      </ion-list>

      <app-icon-picker [catalog]="catalog" [builtin]="icon().builtin_icon"
                       [custom]="icon().custom_icon_id" (chosen)="icon.set($event)"></app-icon-picker>

      @if (error()) { <p class="error">{{ error() }}</p> }

      <div class="buttons">
        <ion-button fill="clear" color="medium" (click)="cancelled.emit()">
          {{ 'entry.cancel' | t }}
        </ion-button>
        <ion-button [disabled]="working()" (click)="save()">{{ 'entry.save' | t }}</ion-button>
      </div>

      @if (kind()) {
        <ion-button expand="block" fill="clear" color="danger" [disabled]="working()" (click)="remove()">
          <ion-icon slot="start" name="trash-outline"></ion-icon>
          {{ 'cushion.kinds.delete' | t }}
        </ion-button>
      }
    </div>
  `,
})
export class ProductKindEditorComponent {
  private readonly database = inject(DatabaseService);
  private readonly i18n = inject(I18nService);

  /** The one being edited, or null while one is being made. */
  readonly kind = input<ProductKind | null>(null);

  /** Saved, with the id, so a caller can select what was just made. */
  readonly saved = output<number>();
  readonly cancelled = output<void>();

  readonly catalog = CATEGORY_ICONS_CATALOG;
  readonly name = signal('');
  readonly icon = signal<{ builtin_icon: string | null; custom_icon_id: number | null }>(
    { builtin_icon: 'pricetag-outline', custom_icon_id: null });
  readonly error = signal('');
  readonly working = signal(false);

  constructor() {
    // Opens on what it is editing, and starts clean for a new one.
    effect(() => {
      const kind = this.kind();
      this.error.set('');
      this.name.set(kind?.name ?? '');
      this.icon.set({
        builtin_icon: kind?.builtin_icon ?? 'pricetag-outline',
        custom_icon_id: kind?.custom_icon_id ?? null,
      });
    });
  }

  async save(): Promise<void> {
    const name = this.name().trim();
    if (name === '') {
      this.error.set(this.i18n.t('cushion.kinds.needName'));
      return;
    }

    this.working.set(true);
    try {
      const repository = new ProductKindsRepository(this.database.driver);
      const existing = this.kind();
      const changes = {
        name,
        builtin_icon: this.icon().builtin_icon,
        custom_icon_id: this.icon().custom_icon_id,
      };

      const id = existing ? (await repository.update(existing.id, changes), existing.id)
        : await repository.create(changes);
      this.database.dataChanged();
      this.saved.emit(id);
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : String(error));
    } finally {
      this.working.set(false);
    }
  }

  /**
   * Removes it, unless movements are filed under it - then it says how many,
   * and the repository offers archiving instead of losing their category.
   */
  async remove(): Promise<void> {
    const existing = this.kind();
    if (!existing) return;

    this.working.set(true);
    try {
      await new ProductKindsRepository(this.database.driver).delete(existing.id);
      this.database.dataChanged();
      this.saved.emit(existing.id);
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : String(error));
    } finally {
      this.working.set(false);
    }
  }
}
