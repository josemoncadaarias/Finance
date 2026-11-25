import { Injectable, effect, inject, untracked } from '@angular/core';
import { registerPlugin } from '@capacitor/core';
import { DEVICE } from '../device/device';
import { App } from '@capacitor/app';

import { DatabaseService } from '../database/database.service';
import { I18nService } from '../i18n/i18n.service';
import { AssistantService } from '../assistant/assistant.service';
import { SaveShareService } from '../assistant/save-share.service';
import { PrivacyService } from '../ui/privacy.service';
import { isoDay } from '../filters/period';
import { widgetStateOf, type WidgetState } from './widget-state';

interface WidgetPlugin {
  update(options: { state: WidgetState }): Promise<void>;
}

const Native = registerPlugin<WidgetPlugin>('Widget');

/**
 * Keeps the home-screen widget (`SpendWidget`, mockup `59a`) in step with
 * Inicio's "Puedes gastar hoy" with every account: on every data change, new
 * day, change of language, savings share or "Ocultar montos al abrir", and
 * each time the app comes back. Its buttons open the app through the icon's
 * shortcuts (`ShortcutsService`). Android only.
 */
@Injectable({ providedIn: 'root' })
export class WidgetService {
  private readonly database = inject(DatabaseService);
  private readonly i18n = inject(I18nService);
  private readonly assistant = inject(AssistantService);
  private readonly share = inject(SaveShareService);
  private readonly privacy = inject(PrivacyService);
  private handed = '';

  constructor() {
    if (!DEVICE.homeWidget) return;

    effect(() => {
      const version = this.database.dataVersion();
      const lang = this.i18n.language();
      const pct = this.share.pct();
      const hidden = this.privacy.hideOnOpen();
      if (this.database.status() !== 'ready') return;
      untracked(() => void this.hand(`${version}:${lang}:${pct}:${hidden}`));
    });
    void App.addListener('appStateChange', ({ isActive }) => {
      if (isActive && this.database.status() === 'ready') void this.hand(this.handed.replace(/@.*$/, ''));
    });
  }

  private async hand(mark: string): Promise<void> {
    const key = `${mark}@${isoDay(new Date())}`;
    if (key === this.handed) return;
    this.handed = key;
    try {
      const accounts = await this.database.driver.queryOne<{ n: number }>('SELECT COUNT(*) AS n FROM accounts WHERE archived = 0');
      const room = (accounts?.n ?? 0) === 0 ? null : await this.assistant.spendRoom(await this.assistant.picture(), await this.share.load());
      const t = this.i18n.t.bind(this.i18n);
      const end = room ? this.day(room.monthEnd) : '';
      const state = widgetStateOf(room, {
        title: t('widget.title'),
        overTitle: t('widget.overTitle'),
        line: (left, endDay) => t('widget.line', { left, end: endDay }),
        lineOne: left => t('widget.lineOne', { left }),
        overLine: t('widget.overLine'),
        none: t('widget.none'),
        empty: t('widget.empty'),
        stale: t('widget.stale'),
        hiddenLine: t('widget.hiddenLine'),
        expense: t('widget.expense'),
        income: t('widget.income'),
        assistant: t('widget.assistant'),
        show: t('widget.show'),
        hide: t('widget.hide'),
      }, end, this.privacy.hideOnOpen());
      await Native.update({ state });
    } catch {
      // The widget keeps what it showed; read again on the next change.
      this.handed = '';
    }
  }

  /** "30 de noviembre". */
  private day(iso: string): string {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(this.i18n.dateLocale(), { day: 'numeric', month: 'long' });
  }
}
