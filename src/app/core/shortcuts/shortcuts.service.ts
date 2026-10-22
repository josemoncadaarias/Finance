import { Injectable, effect, inject, signal, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { App } from '@capacitor/app';

import { DatabaseService } from '../database/database.service';
import { I18nService } from '../i18n/i18n.service';
import type { TranslationKey } from '../i18n/translations';
import { ComposeService } from '../ui/compose.service';

interface ShortcutsPlugin {
  set(options: { items: { id: string; short: string; long: string }[] }): Promise<void>;
  take(): Promise<{ id: string }>;
}

const Native = registerPlugin<ShortcutsPlugin>('Shortcuts');

/** What a long press on the app's icon offers, in this order. */
export const SHORTCUTS = ['expense', 'income', 'assistant', 'review'] as const;
export type ShortcutId = (typeof SHORTCUTS)[number];

/**
 * The shortcuts of the app's icon (Jose, 2026-10-22): a long press on Finance
 * offers a new spending, a new income, the assistant and Por revisar.
 *
 * Handed to Android on every opening and every change of language, so their
 * words are the app's, not the phone's. The one tapped is taken once, as the
 * app opens or comes back, and acted on as soon as the data is ready: the
 * movement form opens as the "+" opens it, and nothing is saved by itself.
 * Android only; elsewhere nothing happens.
 */
@Injectable({ providedIn: 'root' })
export class ShortcutsService {
  private readonly i18n = inject(I18nService);
  private readonly database = inject(DatabaseService);
  private readonly compose = inject(ComposeService);
  private readonly router = inject(Router);

  /** The shortcut tapped, waiting for the data to be ready. */
  private readonly asked = signal<ShortcutId | null>(null);

  constructor() {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') return;

    effect(() => {
      this.i18n.language();
      untracked(() => void this.hand());
    });

    effect(() => {
      const asked = this.asked();
      if (!asked || this.database.status() !== 'ready') return;
      untracked(() => {
        this.asked.set(null);
        this.go(asked);
      });
    });

    void this.take();
    void App.addListener('appStateChange', ({ isActive }) => { if (isActive) void this.take(); });
  }

  private async hand(): Promise<void> {
    try {
      await Native.set({
        items: SHORTCUTS.map(id => ({
          id,
          short: this.i18n.t(`shortcut.${id}` as TranslationKey),
          long: this.i18n.t(`shortcut.${id}.long` as TranslationKey),
        })),
      });
    } catch {
      // A launcher without shortcuts: the app works the same.
    }
  }

  private async take(): Promise<void> {
    try {
      const { id } = await Native.take();
      if ((SHORTCUTS as readonly string[]).includes(id)) this.asked.set(id as ShortcutId);
    } catch {
      // Opened from its icon, as usual.
    }
  }

  private go(id: ShortcutId): void {
    switch (id) {
      case 'expense':
      case 'income':
        this.compose.open(id);
        break;
      case 'assistant':
        void this.router.navigateByUrl('/assistant');
        break;
      case 'review':
        void this.router.navigateByUrl('/review');
        break;
    }
  }
}
