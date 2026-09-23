/**
 * Choosing a category, wherever the question is asked.
 *
 * It was the movement form's, and only the movement form's: a searchbar, the
 * two orders, every category with its icon and how often it has been used.
 * The review screen asked the same question with a bare `ion-select` - a short
 * list of names, no pictures, nothing to search - and Jose said so at once:
 * "me gustaria que fuera el mismo estilo al querer seleccionar una categoria
 * en un movimiento".
 *
 * So it lives here, and both screens open the same sheet. The rule this obeys
 * is already written down: a control that appears on two screens has one
 * definition.
 *
 * The order is remembered under `finance.categoryOrder`, which is the key the
 * movement form has always used - it is one preference about one list, and it
 * would be strange for the same question to be sorted two ways on two screens.
 */

import { Component, computed, inject, input, output, signal } from '@angular/core';
import {
  IonModal, IonHeader, IonToolbar, IonButtons, IonButton, IonContent,
  IonSearchbar, IonList, IonItem, IonLabel, IonNote, IonIcon,
} from '@ionic/angular';

import { DatabaseService } from '../../core/database/database.service';
import { CategoriesRepository, type UsedCategory } from '../../core/database/repositories/categories.repository';
import { IconComponent } from '../../core/icons/icon.component';
import { TranslatePipe } from '../../core/i18n/translate.pipe';

/** Ignores case and accents: nobody types an accent while hurrying. */
function fold(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/** How far back 'most used' looks: a year, as the movement form does. */
function aYearAgo(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear() - 1, now.getMonth(), now.getDate()))
    .toISOString().slice(0, 10) as string;
}

function readOrder(): 'use' | 'name' {
  try {
    return localStorage.getItem('finance.categoryOrder') === 'name' ? 'name' : 'use';
  } catch {
    return 'use';
  }
}

@Component({
  selector: 'app-category-sheet',
  imports: [
    TranslatePipe, IconComponent,
    IonModal, IonHeader, IonToolbar, IonButtons, IonButton, IonContent,
    IonSearchbar, IonList, IonItem, IonLabel, IonNote, IonIcon,
  ],
  templateUrl: './category-sheet.component.html',
  styleUrls: ['./category-sheet.component.scss'],
})
export class CategorySheetComponent {
  private readonly database = inject(DatabaseService);

  readonly open = input(false);
  /** The one already chosen, ticked in the list. */
  readonly chosen = input<number | null>(null);
  /**
   * Which half of the list to show: what money goes out on, or what it comes
   * in as. A movement is one or the other and offering both would be offering
   * an answer that cannot be right.
   */
  readonly kind = input<'expense' | 'income'>('expense');

  readonly picked = output<number>();
  readonly cancelled = output<void>();

  readonly categories = signal<UsedCategory[]>([]);
  readonly search = signal('');
  readonly order = signal<'use' | 'name'>(readOrder());

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    if (this.database.status() !== 'ready') return;
    this.categories.set(await new CategoriesRepository(this.database.driver)
      .listByUse({ kind: this.kind(), since: aYearAgo() }));
  }

  setOrder(order: 'use' | 'name'): void {
    this.order.set(order);
    try {
      localStorage.setItem('finance.categoryOrder', order);
    } catch {
      // A browser with site data blocked still gets the order for this visit.
    }
  }

  readonly found = computed<UsedCategory[]>(() => {
    const term = fold(this.search());
    const found = term === ''
      ? this.categories()
      : this.categories().filter(category => fold(category.name).includes(term));

    if (this.order() === 'use') return found;
    // `localeCompare` so "Éxito" files under E and not after Z.
    return [...found].sort((a, b) => a.name.localeCompare(b.name, 'es'));
  });

  /** Reads the list again whenever the sheet is opened on a screen. */
  async opened(): Promise<void> {
    this.search.set('');
    await this.load();
  }

  choose(id: number): void {
    this.search.set('');
    this.picked.emit(id);
  }
}
