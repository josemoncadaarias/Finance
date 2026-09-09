/**
 * Choosing what an account or a category looks like.
 *
 * Two sources, side by side: the built-in catalog, and images the user brought
 * in. The second is the point — a generic wallet next to another generic
 * wallet is exactly the problem Jose raised at the start of the project, and
 * a real Bancolombia logo is what fixes it.
 *
 * An uploaded image is stored in the database and stays available to every
 * other account afterwards, so a bank's logo is added once.
 */

import { Component, computed, inject, input, output, signal, type OnInit } from '@angular/core';
import {
  IonIcon, IonModal, IonContent, IonHeader, IonToolbar, IonButtons, IonButton,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import * as allIcons from 'ionicons/icons';

import { DatabaseService } from '../database/database.service';
import {
  CustomIconsRepository, iconDataUrl, MAX_ICON_BYTES,
  type CustomIcon,
} from '../database/repositories/custom-icons.repository';
import { TranslatePipe } from '../i18n/translate.pipe';
import { I18nService } from '../i18n/i18n.service';
import type { IconGroup } from './icon-catalog';

/** What the picker hands back: exactly one of the two is set. */
export interface IconChoice {
  builtin_icon: string | null;
  custom_icon_id: number | null;
}

@Component({
  selector: 'app-icon-picker',
  imports: [
    IonIcon, IonModal, IonContent, IonHeader, IonToolbar, IonButtons, IonButton,
    TranslatePipe,
  ],
  template: `
    <!-- What is chosen now, and the way in -->
    <button type="button" class="current" (click)="open.set(true)">
      @if (customUrl(); as url) {
        <img [src]="url" alt="">
      } @else {
        <ion-icon [name]="(builtin() ?? 'wallet') + '-outline'"></ion-icon>
      }
      <span class="change">{{ 'icons.change' | t }}</span>
    </button>

    <ion-modal [isOpen]="open()" (didDismiss)="open.set(false)"
               [initialBreakpoint]="0.85" [breakpoints]="[0, 0.85, 1]">
      <ng-template>
        <ion-header>
          <ion-toolbar>
            <ion-buttons slot="start">
              <ion-button (click)="open.set(false)">{{ 'entry.cancel' | t }}</ion-button>
            </ion-buttons>
          </ion-toolbar>
        </ion-header>

        <ion-content class="sheet">
          <!-- The user's own images first: they are the specific answer, and
               scrolling past 60 generic icons to reach them would be backwards. -->
          <section>
            <h3>{{ 'icons.yours' | t }}</h3>
            <div class="grid">
              <label class="upload" [class.busy]="uploading()">
                <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml"
                       (change)="onFile($event)" [disabled]="uploading()">
                <ion-icon name="add-outline"></ion-icon>
              </label>

              @for (icon of customIcons(); track icon.id) {
                <button type="button" class="option"
                        [class.on]="custom() === icon.id"
                        (click)="chooseCustom(icon.id)" [title]="icon.name">
                  <img [src]="urlFor(icon.id)" [alt]="icon.name">
                </button>
              }
            </div>
            @if (error()) { <p class="error">{{ error() }}</p> }
            <p class="hint">{{ 'icons.uploadHint' | t }}</p>
          </section>

          @for (group of catalog(); track group.key) {
            <section>
              <h3>{{ $any(group.key) | t }}</h3>
              <div class="grid">
                @for (name of group.icons; track name) {
                  <button type="button" class="option"
                          [class.on]="builtin() === name && custom() === null"
                          (click)="chooseBuiltin(name)">
                    <ion-icon [name]="name + '-outline'"></ion-icon>
                  </button>
                }
              </div>
            </section>
          }
        </ion-content>
      </ng-template>
    </ion-modal>
  `,
  styles: [`
    :host { display: block; }

    .current {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.3rem;
      padding: 0.5rem;
      border: none;
      background: none;
      cursor: pointer;

      ion-icon { font-size: 2.2rem; color: var(--ion-color-primary); }
      img { width: 2.6rem; height: 2.6rem; object-fit: contain; border-radius: 6px; }
      .change { font-size: 0.72rem; color: var(--ion-color-primary); }
    }

    .sheet {
      --padding-start: 1rem;
      --padding-end: 1rem;
      --padding-bottom: 2rem;

      section { margin-bottom: 1.25rem; }

      h3 {
        margin: 0 0 0.5rem;
        font-size: 0.72rem;
        letter-spacing: 0.09em;
        text-transform: uppercase;
        color: var(--ion-color-medium);
      }

      .hint { margin: 0.5rem 0 0; font-size: 0.75rem; color: var(--ion-color-medium); }
      .error { margin: 0.5rem 0 0; font-size: 0.8rem; color: var(--ion-color-danger); }
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(3rem, 1fr));
      gap: 0.4rem;
    }

    .option, .upload {
      display: flex;
      align-items: center;
      justify-content: center;
      aspect-ratio: 1;
      border: 1px solid var(--ion-color-light-shade);
      border-radius: 10px;
      background: var(--ion-color-light);
      color: var(--ion-color-medium);
      cursor: pointer;

      ion-icon { font-size: 1.5rem; }
      img { width: 70%; height: 70%; object-fit: contain; }

      &.on {
        border-color: var(--ion-color-primary);
        border-width: 2px;
        background: rgba(var(--ion-color-primary-rgb), 0.12);
        color: var(--ion-color-primary);
      }
    }

    .upload {
      border-style: dashed;
      color: var(--ion-color-primary);
      position: relative;

      input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
      &.busy { opacity: 0.5; }
    }
  `],
})
export class IconPickerComponent implements OnInit {
  private readonly database = inject(DatabaseService);
  private readonly i18n = inject(I18nService);

  /** The catalog to offer: accounts and categories want different icons. */
  readonly catalog = input.required<IconGroup[]>();
  readonly builtin = input<string | null>(null);
  readonly custom = input<number | null>(null);

  readonly chosen = output<IconChoice>();

  readonly open = signal(false);
  readonly customIcons = signal<CustomIcon[]>([]);
  readonly uploading = signal(false);
  readonly error = signal('');

  /** Data URLs, built once per icon: base64 on every render would be felt. */
  private readonly urls = signal<Map<number, string>>(new Map());

  readonly customUrl = computed(() => {
    const id = this.custom();
    return id === null ? null : this.urls().get(id) ?? null;
  });

  constructor() {
    addIcons(allIcons as unknown as Record<string, string>);
  }

  ngOnInit(): void {
    void this.loadCustom();
  }

  urlFor(id: number): string | undefined {
    return this.urls().get(id);
  }

  private async loadCustom(): Promise<void> {
    if (this.database.status() !== 'ready') return;

    const repository = new CustomIconsRepository(this.database.driver);
    const icons = await repository.list();
    this.customIcons.set(icons);

    const urls = new Map(this.urls());
    for (const icon of icons) {
      if (urls.has(icon.id)) continue;
      const full = await repository.findById(icon.id);
      if (full) urls.set(icon.id, iconDataUrl(full));
    }
    this.urls.set(urls);
  }

  chooseBuiltin(name: string): void {
    this.chosen.emit({ builtin_icon: name, custom_icon_id: null });
    this.open.set(false);
  }

  chooseCustom(id: number): void {
    this.chosen.emit({ builtin_icon: null, custom_icon_id: id });
    this.open.set(false);
  }

  /**
   * Stores a chosen image and selects it.
   *
   * The file is read as bytes and handed straight to the repository, which
   * refuses anything too large. No resizing here: silently changing someone's
   * image is worse than telling them it will not fit.
   */
  async onFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.uploading.set(true);
    this.error.set('');

    try {
      if (file.size > MAX_ICON_BYTES) {
        throw new Error(this.i18n.t('icons.tooBig', { size: Math.round(file.size / 1000) }));
      }

      const bytes = new Uint8Array(await file.arrayBuffer());
      const id = await new CustomIconsRepository(this.database.driver).create({
        name: file.name.replace(/\.[^.]+$/, ''),
        mime_type: file.type,
        data: bytes,
      });

      await this.loadCustom();
      this.chooseCustom(id);
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : String(error));
    } finally {
      this.uploading.set(false);
      input.value = '';
    }
  }
}
