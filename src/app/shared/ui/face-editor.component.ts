/**
 * What an account or a category looks like: "Ícono y color" (mockups `2l`,
 * `2m`, `2n`, `2q`, `2r`, `3g`, `3h`, `3i`).
 *
 * Three tabs of one editor - Ícono, Color, Imagen propia, in that order - and
 * "Así se verá" on top showing the real row as it will be drawn. Every colour
 * swatch is the thing itself in that colour; with an image of one's own the
 * colour fills behind it, and stays the row's colour everywhere else.
 *
 * Nothing is written from here: "Listo" hands the three values back to the
 * form that opened it, and that form saves them with everything else.
 */

import { Component, computed, inject, input, output, signal } from '@angular/core';
import { IonIcon, IonModal } from '@ionic/angular';

import { DatabaseService } from '../../core/database/database.service';
import { CustomIconsRepository, MAX_ICON_BYTES } from '../../core/database/repositories/custom-icons.repository';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { I18nService } from '../../core/i18n/i18n.service';
import { CustomIconsService } from '../../core/icons/custom-icons.service';
import { bareIcon, type IconGroup } from '../../core/icons/icon-catalog';
import { PALETTE, PALETTE_FAMILIES, displayColor } from '../../core/theme/palette';
import { BadgeComponent } from './badge.component';

export interface FaceChoice {
  builtin_icon: string | null;
  custom_icon_id: number | null;
  color: string;
}

type Tab = 'icon' | 'color' | 'image';

@Component({
  selector: 'app-face-editor',
  standalone: true,
  imports: [IonModal, IonIcon, TranslatePipe, BadgeComponent],
  template: `
    <ion-modal class="entry-sheet" [isOpen]="open()" (willPresent)="begin()" (didDismiss)="cancelled.emit()">
      <ng-template>
        <div class="face">
          <header class="ui-titlebar">
            <button type="button" class="x" (click)="cancelled.emit()" [attr.aria-label]="'entry.cancel' | t">
              <ion-icon name="close"></ion-icon>
            </button>
            <h1>{{ 'face.title' | t }}</h1>
            <button type="button" class="link" (click)="finish()">{{ 'ui.done' | t }}</button>
          </header>

          <div class="scroll">
            <div class="ui-card preview">
              <app-badge [shape]="shape()" [size]="56" [builtin]="builtin()" [customId]="customId()"
                         [fixed]="shownColor()" [fallback]="shape() === 'ci' ? 'wallet' : 'pricetag'"></app-badge>
              <div class="who">
                <span class="ui-lab">{{ 'face.preview' | t }}</span>
                <b class="ui-one">{{ name() || ('face.noName' | t) }}</b>
                @if (line()) { <small class="ui-one">{{ line() }}</small> }
              </div>
              @if (amount()) { <span class="amount" [class.owes]="amountTone() === 'owes'">{{ amount() }}</span> }
            </div>

            <div class="tabs" role="tablist">
              <button type="button" role="tab" [class.on]="tab() === 'icon'" (click)="tab.set('icon')">{{ 'face.tab.icon' | t }}</button>
              <button type="button" role="tab" [class.on]="tab() === 'color'" (click)="tab.set('color')">{{ 'face.tab.color' | t }}</button>
              <button type="button" role="tab" [class.on]="tab() === 'image'" (click)="tab.set('image')">{{ 'face.tab.image' | t }}</button>
            </div>

            @switch (tab()) {
              @case ('icon') {
                <div class="ui-search">
                  <ion-icon name="search-outline"></ion-icon>
                  <input type="search" [placeholder]="'face.search' | t" [value]="search()"
                         (input)="search.set($any($event.target).value ?? '')">
                </div>
                @for (group of groups(); track group.key) {
                  <h3 class="ui-h">{{ $any(group.key) | t }}</h3>
                  <div class="grid">
                    @for (icon of group.icons; track icon) {
                      <button type="button" class="swatch" [class.sq]="shape() === 'sq'" [class.on]="customId() === null && bare(builtin()) === icon"
                              [style.--ring]="shownColor()" (click)="pickIcon(icon)" [attr.aria-label]="icon">
                        <app-badge [shape]="shape()" [size]="48" [builtin]="icon"
                                   [fixed]="customId() === null && bare(builtin()) === icon ? shownColor() : '#8e9ab2'"></app-badge>
                      </button>
                    }
                  </div>
                } @empty {
                  <p class="quiet">{{ 'face.noIcon' | t }}</p>
                }
              }
              @case ('color') {
                @for (family of families; track family.family) {
                  <h3 class="ui-h">{{ $any('face.family.' + family.family) | t }}</h3>
                  <div class="grid">
                    @for (hex of family.colors; track hex) {
                      <button type="button" class="swatch" [class.sq]="shape() === 'sq'" [class.on]="shownColor() === hex" [style.--ring]="hex"
                              (click)="color.set(hex)">
                        <app-badge [shape]="shape()" [size]="48" [builtin]="builtin()" [customId]="customId()"
                                   [fixed]="hex" [fallback]="shape() === 'ci' ? 'wallet' : 'pricetag'"></app-badge>
                        @if (shownColor() === hex) { <span class="check"><ion-icon name="checkmark"></ion-icon></span> }
                      </button>
                    }
                  </div>
                }
                @if (customId() !== null) {
                  <p class="quiet">{{ (shape() === 'ci' ? 'face.imageColor.account' : 'face.imageColor.category') | t }}</p>
                }
              }
              @case ('image') {
                @if (error()) { <div class="ui-banner bad">{{ error() }}</div> }
                <label class="upload" [class.busy]="uploading()">
                  <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml"
                         (change)="onFile($event)" [disabled]="uploading()">
                  <app-badge shape="ci" [size]="44" builtin="cloud-upload" [fixed]="accent"></app-badge>
                  <span class="ui-tx">
                    <b class="wrap">{{ 'face.upload' | t }}</b>
                    <small>{{ 'icons.uploadHint' | t }}</small>
                  </span>
                </label>
                @if (images().length > 0) {
                  <h3 class="ui-h">{{ 'icons.yours' | t }}</h3>
                  <div class="grid">
                    @for (image of images().slice(0, shown()); track image.id) {
                      <button type="button" class="swatch" [class.sq]="shape() === 'sq'" [class.on]="customId() === image.id" [style.--ring]="accent"
                              (click)="pickImage(image.id)" [title]="image.name">
                        <app-badge [shape]="shape()" [size]="48" [customId]="image.id" [fixed]="shownColor()"></app-badge>
                        @if (customId() === image.id) { <span class="check blue"><ion-icon name="checkmark"></ion-icon></span> }
                      </button>
                    }
                  </div>
                  @if (shown() < images().length) {
                    <button type="button" class="more" (click)="shown.set(shown() + 48)">
                      {{ 'icons.more' | t:{ count: images().length - shown() } }}
                    </button>
                  }
                }
                <p class="quiet">{{ 'face.images.kept' | t }}</p>
              }
            }
          </div>
        </div>
      </ng-template>
    </ion-modal>
  `,
  styles: [`
    :host { display: contents; }
    .face { display: flex; flex-direction: column; height: 100%; background: var(--app-bg); color: var(--app-tx); }
    .scroll { flex: 1; min-height: 0; overflow-y: auto; padding: 12px 16px 32px; }
    .preview { display: flex; align-items: center; gap: 14px; }
    .preview .who { flex: 1; min-width: 0; display: flex; flex-direction: column; }
    .preview .ui-lab { letter-spacing: 1.2px; }
    .preview b { font-size: 17px; font-weight: 700; }
    .preview small { color: var(--app-mu); font-size: 13px; }
    .preview .amount { font-weight: 700; font-size: 15.5px; flex: none; }
    .preview .amount.owes { color: var(--app-yel); }
    .tabs { display: flex; gap: 18px; border-bottom: 1px solid var(--app-line); margin: 14px -16px 12px; padding: 0 16px; }
    .tabs button {
      border: 0; background: none; color: var(--app-mu); font: inherit; font-size: 15px; font-weight: 500;
      padding: 10px 0 9px; border-bottom: 2px solid transparent; cursor: pointer;
    }
    .tabs button.on { color: var(--app-tx); border-bottom-color: var(--app-pr); }
    .grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 6px; justify-items: center; }
    .swatch {
      position: relative; border: 0; background: none; padding: 3px; border-radius: 50%; cursor: pointer;
      box-shadow: 0 0 0 2px transparent; display: grid; place-items: center;
    }
    .swatch.sq { border-radius: 32%; }
    .swatch.on { box-shadow: 0 0 0 2px var(--ring); }
    .check {
      position: absolute; top: -2px; right: -2px; width: 18px; height: 18px; border-radius: 50%;
      background: var(--ring); color: #0b1222; display: grid; place-items: center; font-size: 12px;
    }
    .check.blue { background: var(--app-pr); color: #fff; }
    .upload {
      position: relative; display: flex; align-items: center; gap: 14px; padding: 14px;
      border: 1.5px dashed var(--app-s3); border-radius: 18px; background: var(--app-s1); cursor: pointer;
    }
    .upload input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
    .upload.busy { opacity: 0.5; }
    .more { display: block; border: 0; background: none; color: var(--app-pr); font: inherit; font-size: 14px; padding: 12px 0 0; cursor: pointer; }
    .quiet { color: var(--app-mu); font-size: 13.5px; line-height: 1.45; margin: 14px 2px 0; }
    .ui-banner { margin-bottom: 12px; }
  `],
})
export class FaceEditorComponent {
  private readonly database = inject(DatabaseService);
  private readonly icons = inject(CustomIconsService);
  private readonly i18n = inject(I18nService);

  readonly open = input(false);
  /** Accounts in circles, categories in rounded squares. */
  readonly shape = input<'ci' | 'sq'>('ci');
  readonly catalog = input.required<IconGroup[]>();
  readonly name = input('');
  /** The grey line under the name in "Así se verá". */
  readonly line = input('');
  readonly amount = input('');
  readonly amountTone = input<'plain' | 'owes'>('plain');
  readonly seed = input<number | null>(0);
  readonly startBuiltin = input<string | null>(null);
  readonly startCustom = input<number | null>(null);
  readonly startColor = input<string | null>(null);
  /** Opens on a tab of its own: the pencil over an image opens on the image. */
  readonly startTab = input<Tab>('icon');

  readonly done = output<FaceChoice>();
  readonly cancelled = output<void>();

  readonly tab = signal<Tab>('icon');
  readonly builtin = signal<string | null>(null);
  readonly customId = signal<number | null>(null);
  readonly color = signal<string | null>(null);
  readonly search = signal('');
  readonly shown = signal(24);
  readonly uploading = signal(false);
  readonly error = signal('');

  readonly images = this.icons.icons;
  readonly accent = '#6378ff';
  readonly bare = bareIcon;

  readonly families = PALETTE_FAMILIES.map(family => ({
    family: family.family,
    colors: family.names.map(name => PALETTE[name] as string),
  }));

  /** The colour the row is drawn in now: the chosen one, or the one it wears. */
  readonly shownColor = computed(() => displayColor(this.color(), this.seed()));

  readonly groups = computed(() => {
    const typed = this.search().trim().toLowerCase();
    return this.catalog()
      .map(group => ({
        key: group.key,
        icons: typed === '' ? group.icons : group.icons.filter(icon =>
          icon.includes(typed) || this.i18n.t(group.key as 'icons.money').toLowerCase().includes(typed)),
      }))
      .filter(group => group.icons.length > 0);
  });

  begin(): void {
    this.builtin.set(this.startBuiltin());
    this.customId.set(this.startCustom());
    this.color.set(this.startColor());
    this.tab.set(this.startTab());
    this.search.set('');
    this.error.set('');
    void this.icons.load();
  }

  pickIcon(icon: string): void {
    this.builtin.set(icon);
    this.customId.set(null);
  }

  pickImage(id: number): void {
    this.customId.set(id);
  }

  finish(): void {
    this.done.emit({
      builtin_icon: this.customId() === null ? this.builtin() : this.builtin() ?? null,
      custom_icon_id: this.customId(),
      color: this.color() ?? this.startColor() ?? '#607D8B',
    });
  }

  /** Stores the chosen image and picks it; too large is refused, never resized. */
  async onFile(event: Event): Promise<void> {
    const field = event.target as HTMLInputElement;
    const file = field.files?.[0];
    if (!file) return;
    this.uploading.set(true);
    this.error.set('');
    try {
      if (file.size > MAX_ICON_BYTES) {
        throw new Error(this.i18n.t('icons.tooBig', { size: Math.round(file.size / 1000) }));
      }
      const id = await new CustomIconsRepository(this.database.driver).create({
        name: file.name.replace(/\.[^.]+$/, ''),
        mime_type: file.type,
        data: new Uint8Array(await file.arrayBuffer()),
      });
      await this.icons.refresh();
      this.pickImage(id);
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : String(error));
    } finally {
      this.uploading.set(false);
      field.value = '';
    }
  }
}
