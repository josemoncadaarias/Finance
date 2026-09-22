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
import { CustomIconsService } from './custom-icons.service';
import { bareIcon, outlined, type IconGroup } from './icon-catalog';

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
        <ion-icon [name]="outlined(builtin() ?? 'wallet')"></ion-icon>
      }
      <span class="change">{{ 'icons.change' | t }}</span>
    </button>

    <!-- Full height from the start. A sheet that opens at a fraction of the
         screen has to be dragged bigger before it will scroll, which is the
         one thing someone reaching for an icon should not have to learn. -->
    <ion-modal [isOpen]="open()" (didDismiss)="open.set(false)">
      <ng-template>
        <ion-header>
          <ion-toolbar>
            <ion-buttons slot="start">
              <ion-button (click)="open.set(false)">{{ 'entry.cancel' | t }}</ion-button>
            </ion-buttons>
          </ion-toolbar>
        </ion-header>

        <ion-content class="sheet">
          <!-- At the top, always. It used to sit under the images, which meant
               that with thirty logos the reason an upload was refused was two
               screens below the button that refused it. -->
          @if (error()) { <p class="error">{{ error() }}</p> }

          <!-- The user's own images first: they are the specific answer, and
               scrolling past 60 generic icons to reach them would be backwards. -->
          <section class="mine">
            <button type="button" class="head" (click)="toggle('mine')">
              <ion-icon [name]="isOpen('mine') ? 'chevron-down-outline' : 'chevron-forward-outline'"></ion-icon>
              <h3>{{ 'icons.yours' | t }}</h3>
              <span class="count">{{ customIcons().length }}</span>
            </button>

            @if (isOpen('mine')) {
            <div class="grid wide">
              <label class="upload" [class.busy]="uploading()">
                <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml"
                       (change)="onFile($event)" [disabled]="uploading()">
                <ion-icon name="add-outline"></ion-icon>
                <span>{{ 'icons.upload' | t }}</span>
              </label>

              @for (icon of customIcons().slice(0, shownCustom()); track icon.id) {
                <button type="button" class="option photo"
                        [class.on]="custom() === icon.id"
                        (click)="chooseCustom(icon.id)" [title]="icon.name">
                  <span class="plate">
                    <img [src]="urlFor(icon.id)" [alt]="icon.name">
                  </span>
                  <span class="caption">{{ icon.name }}</span>
                </button>
              }
            </div>

            @if (shownCustom() < customIcons().length) {
              <div class="more">
                <button type="button" (click)="showMoreImages()">
                  {{ 'icons.more' | t:{ count: customIcons().length - shownCustom() } }}
                </button>
              </div>
            }

            <p class="hint">{{ 'icons.uploadHint' | t }}</p>
            }
          </section>

          @for (group of catalog(); track group.key) {
            <section>
              <button type="button" class="head" (click)="toggle(group.key)">
                <ion-icon [name]="isOpen(group.key) ? 'chevron-down-outline' : 'chevron-forward-outline'"></ion-icon>
                <h3>{{ $any(group.key) | t }}</h3>
                <span class="count">{{ group.icons.length }}</span>
              </button>

              @if (isOpen(group.key)) {
              <div class="grid">
                @for (name of group.icons; track name) {
                  <button type="button" class="option"
                          [class.on]="bareIcon(builtin()) === name && custom() === null"
                          (click)="chooseBuiltin(name)">
                    <ion-icon [name]="name + '-outline'"></ion-icon>
                  </button>
                }
              </div>
              }
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
      --padding-bottom: calc(2rem + var(--ion-safe-area-bottom, 0px));

      section { margin-bottom: 1.25rem; }

      h3 {
        flex: 1;
        margin: 0;
        font-size: 0.75rem;
        letter-spacing: 0.09em;
        text-transform: uppercase;
        color: var(--ion-color-medium);
        text-align: left;
      }

      /* The heading is the control that opens the section, so it looks like
         one: a chevron, the name, and how many are inside. */
      .head {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        width: 100%;
        padding: 0.7rem 0;
        border: none;
        background: none;
        cursor: pointer;

        ion-icon { color: var(--ion-color-primary); font-size: 0.95rem; }

        .count {
          padding: 0.05rem 0.45rem;
          border-radius: 999px;
          background: var(--ion-color-light);
          color: var(--ion-color-medium-shade);
          font-size: 0.68rem;
          font-weight: 600;
        }
      }

      /* Impossible to miss, whatever is below it. */
      .error {
        margin: 0.75rem 0 0;
        padding: 0.6rem 0.8rem;
        border-radius: 8px;
        background: rgba(var(--ion-color-danger-rgb), 0.14);
        color: var(--ion-color-danger);
        font-size: 0.8rem;
      }

      .more {
        display: flex;
        justify-content: center;
        padding-top: 0.75rem;

        button {
          padding: 0.45rem 1rem;
          border: 1px solid var(--ion-color-light-shade);
          border-radius: 999px;
          background: none;
          color: var(--ion-color-primary);
          font-size: 0.76rem;
          font-weight: 600;
          cursor: pointer;
        }
      }

      .hint { margin: 0.5rem 0 0; font-size: 0.75rem; color: var(--ion-color-medium); }
      .error { margin: 0.5rem 0 0; font-size: 0.8rem; color: var(--ion-color-danger); }
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(3rem, 1fr));
      gap: 0.4rem;
    }

    /* Bigger cells for the user's own images. A bank logo is a picture with
       detail in it, and at 3rem shared with the glyph catalog it was a smudge
       that could not be told from the next one. */
    .grid.wide {
      grid-template-columns: repeat(auto-fill, minmax(4.75rem, 1fr));
      gap: 0.6rem;
    }

    .mine h3 {
      font-size: 0.78rem;
      letter-spacing: 0.06em;
      color: var(--ion-text-color);
      opacity: 0.75;
    }

    .option.photo {
      flex-direction: column;
      gap: 0.3rem;
      aspect-ratio: auto;
      padding: 0.4rem 0.3rem 0.35rem;
      background: none;
      border-color: transparent;
    }

    /* The plate the logo sits on is white in BOTH themes, on purpose. A logo is
       drawn to be put on white; on the dark tile the picker used, every logo
       with dark lettering in it disappeared. A border keeps a white-on-white
       logo from floating. */
    .option.photo .plate {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      aspect-ratio: 1;
      border-radius: 10px;
      background: #ffffff;
      border: 1px solid var(--ion-color-light-shade);
      overflow: hidden;
    }

    .option.photo img {
      width: 78%;
      height: 78%;
      object-fit: contain;
    }

    .option.photo .caption {
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: 0.62rem;
      line-height: 1.2;
      color: var(--ion-color-medium);
    }

    .option.photo.on {
      background: none;

      .plate {
        border-color: var(--ion-color-primary);
        border-width: 2px;
      }

      .caption { color: var(--ion-color-primary); font-weight: 600; }
    }

    /* The tile that adds one is the same size and shape as the images beside
       it, with a word on it: an empty dashed square with a plus is a guess. */
    .grid.wide .upload {
      flex-direction: column;
      gap: 0.2rem;
      aspect-ratio: 1;
      font-size: 0.6rem;
      text-align: center;
      line-height: 1.15;
      padding: 0.25rem;
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
  /** The one place the user's own images live, read once for the whole app. */
  private readonly icons = inject(CustomIconsService);
  private readonly i18n = inject(I18nService);

  /** The catalog to offer: accounts and categories want different icons. */
  readonly catalog = input.required<IconGroup[]>();
  readonly builtin = input<string | null>(null);
  readonly custom = input<number | null>(null);

  readonly chosen = output<IconChoice>();

  /** Both helpers are used by the template. */
  readonly outlined = outlined;
  readonly bareIcon = bareIcon;

  readonly open = signal(false);

  /**
   * The user's own images, from the one place that holds them.
   *
   * This read its own copy, one icon at a time, every time an account was
   * opened for editing - fifty crossings into the native side on a phone,
   * which is why the account's own logo took a moment to appear: it was
   * queued behind a gallery nobody had asked for yet.
   */
  readonly customIcons = this.icons.icons;
  readonly uploading = signal(false);

  /**
   * Which sections are open. None, to begin with.
   *
   * Sixty icons and thirty logos all drawn at once made the sheet taller
   * than it could scroll until it was dragged bigger, and put the upload
   * error two screens below the button that produced it. Closed, the sheet
   * is a short list of headings with counts, and opening one is a tap.
   */
  readonly openSections = signal<ReadonlySet<string>>(new Set());

  /** How many of the images belonging to the user are drawn. */
  readonly shownCustom = signal(24);

  isOpen(key: string): boolean {
    return this.openSections().has(key);
  }

  toggle(key: string): void {
    this.openSections.update(current => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  showMoreImages(): void {
    this.shownCustom.update(shown => shown + 48);
  }
  readonly error = signal('');

  readonly customUrl = computed(() => {
    const id = this.custom();
    return id === null ? null : this.icons.urlFor(id) ?? null;
  });

  constructor() {
    addIcons(allIcons as unknown as Record<string, string>);
  }

  ngOnInit(): void {
    void this.loadCustom();
  }

  urlFor(id: number): string | undefined {
    return this.icons.urlFor(id);
  }

  private async loadCustom(): Promise<void> {
    await this.icons.load();
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

      await this.icons.refresh();
      this.chooseCustom(id);
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : String(error));
    } finally {
      this.uploading.set(false);
      input.value = '';
    }
  }
}
