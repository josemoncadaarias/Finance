/**
 * Más → Tus datos → Borrar todos los datos (mockup 21f).
 *
 * What goes, counted; a copy offered first; the copy in Drive said to stay;
 * and the word BORRAR typed before the button does anything. Afterwards the
 * app is as it was installed - the welcome of Inicio (21a) is where it lands.
 */

import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { Location } from '@angular/common';
import { Router } from '@angular/router';
import { IonContent, IonIcon } from '@ionic/angular';

import { DatabaseService } from '../../core/database/database.service';
import { DemoService, type WhatWouldGo } from '../../core/demo/demo.service';
import { I18nService } from '../../core/i18n/i18n.service';
import type { TranslationKey } from '../../core/i18n/translations';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { exportBackup, toJson } from '../../core/database/export/export-backup';
import { exportFileName } from '../../core/database/export/export-csv';
import { saveFile } from '../../core/files/save-file';
import { ToastService } from '../../shared/ui/toast.service';

@Component({
  selector: 'app-erase',
  imports: [IonContent, IonIcon, TranslatePipe],
  template: `
    <ion-content [fullscreen]="true">
      <header class="ui-titlebar">
        <button type="button" class="back" (click)="back()" [attr.aria-label]="'ui.back' | t">
          <ion-icon name="close"></ion-icon>
        </button>
        <h1>{{ 'erase.title' | t }}</h1>
      </header>

      <div class="ui-main">
        <div class="top">
          <span class="bin"><ion-icon name="trash-outline"></ion-icon></span>
          <p>{{ 'erase.lead' | t }}</p>
        </div>

        @if (counts(); as c) {
          <div class="ui-list">
            @for (line of lines(); track line.icon) {
              <div class="ui-row">
                <span class="sq" [style.color]="line.color" [style.background]="line.tint"><ion-icon [name]="line.icon"></ion-icon></span>
                <span class="ui-tx"><b class="wrap">{{ line.title }}</b>@if (line.hint) { <small>{{ line.hint }}</small> }</span>
              </div>
            }
          </div>
        }

        <div class="ui-banner good drive"><ion-icon name="cloud-done-outline"></ion-icon><span>{{ 'erase.drive' | t }}</span></div>

        <button type="button" class="ui-btn ghost" [disabled]="saving()" (click)="saveCopy()">
          <ion-icon name="download-outline"></ion-icon>{{ 'erase.copy' | t }}
        </button>

        <p class="ask">{{ 'erase.type' | t }} <b>{{ word() }}</b></p>
        <input class="word" [class.right]="typed().trim().toUpperCase() === word()" autocomplete="off" autocapitalize="characters"
               [value]="typed()" (input)="typed.set($any($event.target).value)" />

        @if (error()) { <div class="ui-banner bad"><ion-icon name="alert-circle-outline"></ion-icon><span>{{ error() }}</span></div> }

        <button type="button" class="ui-btn danger go" [disabled]="!ready() || erasing()" (click)="erase()">
          <ion-icon name="trash-outline"></ion-icon>{{ (erasing() ? 'erase.erasing' : 'erase.go') | t }}
        </button>
      </div>
    </ion-content>
  `,
  styles: [`
    .top { text-align: center; margin: 6px 0 12px; }
    .bin { width: 60px; height: 60px; border-radius: 50%; display: grid; place-items: center; margin: 0 auto 10px;
      background: rgba(var(--app-red-rgb), .16); color: var(--app-red); font-size: 30px; }
    .top p { color: var(--app-mu); font-size: 14px; margin: 0; }
    .sq { width: 36px; height: 36px; border-radius: 11px; display: grid; place-items: center; flex: none; font-size: 19px; }
    .drive { margin-top: 12px; }
    .ui-btn.ghost { margin-top: 12px; }
    .ask { color: var(--app-mu); font-size: 13px; margin: 18px 0 6px; }
    .ask b { color: var(--app-tx); }
    .word { width: 100%; height: 48px; border-radius: 14px; background: var(--app-s1); border: 1px solid var(--app-border);
      color: var(--app-tx); padding: 0 14px; font: inherit; font-size: 16px; letter-spacing: .06em; box-sizing: border-box; }
    .word.right { border-color: var(--app-red); }
    .ui-banner.bad { margin-top: 10px; }
    .go { margin-top: 12px; }
  `],
})
export class ErasePage {
  private readonly database = inject(DatabaseService);
  private readonly demo = inject(DemoService);
  private readonly i18n = inject(I18nService);
  private readonly location = inject(Location);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  readonly counts = signal<WhatWouldGo | null>(null);
  readonly typed = signal('');
  readonly saving = signal(false);
  readonly erasing = signal(false);
  readonly error = signal('');

  /** The word to type, in the app's language. */
  readonly word = computed(() => this.i18n.t('erase.word'));
  readonly ready = computed(() => this.typed().trim().toUpperCase() === this.word());

  readonly lines = computed(() => {
    const c = this.counts();
    if (!c) return [];
    const t = (key: string, values?: Record<string, string | number>) => this.i18n.t(key as TranslationKey, values);
    const n = (value: number) => value.toLocaleString(this.i18n.language() === 'es' ? 'es-CO' : 'en-US');
    const since = c.since
      ? new Date(`${c.since}T12:00:00Z`).toLocaleDateString(this.i18n.language() === 'es' ? 'es-CO' : 'en-US', { month: 'long', year: 'numeric' })
      : '';
    return [
      { icon: 'wallet-outline', color: '#6378ff', tint: 'rgba(99,120,255,.16)', title: t('erase.accounts', { n: n(c.accounts) }),
        hint: c.cards + c.loans > 0 ? t('erase.accountsHint', { cards: n(c.cards), loans: n(c.loans) }) : '' },
      { icon: 'list-outline', color: '#4cb8f5', tint: 'rgba(76,184,245,.16)', title: t('erase.movements', { n: n(c.movements) }),
        hint: since ? t('erase.since', { when: since }) : '' },
      { icon: 'trending-up-outline', color: '#34c98b', tint: 'rgba(52,201,139,.16)', title: t('erase.yieldDays', { n: n(c.yieldDays) }),
        hint: t('erase.products', { n: n(c.products) }) },
      { icon: 'pie-chart-outline', color: '#f6b93b', tint: 'rgba(246,185,59,.16)', title: t('erase.plans', { limits: n(c.limits), goals: n(c.goals) }), hint: '' },
    ];
  });

  constructor() {
    effect(() => {
      this.database.dataVersion();
      if (this.database.status() !== 'ready') return;
      untracked(() => void this.demo.whatWouldGo().then(c => this.counts.set(c)).catch(() => undefined));
    });
  }

  back(): void {
    this.location.back();
  }

  async saveCopy(): Promise<void> {
    this.saving.set(true);
    this.error.set('');
    try {
      const backup = await exportBackup(this.database.driver);
      const name = exportFileName(new Date(), 'json');
      if (await saveFile(new Blob([toJson(backup)], { type: 'application/json' }), name)) {
        this.toast.say(this.i18n.t('ui.export.saved', { file: name }));
      }
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : String(error));
    } finally {
      this.saving.set(false);
    }
  }

  async erase(): Promise<void> {
    if (!this.ready()) return;
    this.erasing.set(true);
    this.error.set('');
    try {
      await this.demo.eraseAll({ messages: true });
      this.typed.set('');
      await this.router.navigateByUrl('/movements', { replaceUrl: true });
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : String(error));
    } finally {
      this.erasing.set(false);
    }
  }
}
