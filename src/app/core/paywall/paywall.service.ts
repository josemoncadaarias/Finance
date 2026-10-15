/**
 * "Is this paid for?" - the one question, answered in one place (rule 21).
 *
 * Today there is no store behind it: everything answers unlocked, so nothing
 * changes for anybody. `finance.paywall.preview` = 'free' on the device shows
 * the app as somebody who has not paid sees it, to try the locks. When Google
 * Play (through RevenueCat) is plugged in, it changes here and nowhere else;
 * what was last read is kept, so no lock is ever felt offline.
 */
import { Injectable, computed, signal } from '@angular/core';

import { canUse, freeLeft, reportSectionFree, type Feature } from './plan';

const PREVIEW_KEY = 'finance.paywall.preview';

@Injectable({ providedIn: 'root' })
export class PaywallService {
  /** Set while the free version is being looked at. */
  readonly previewFree = signal(readPreview());

  /** Whether everything is open: paid, in the trial, or no store yet. */
  readonly unlocked = computed(() => !this.previewFree());

  can(feature: Feature, used = 0): boolean {
    return canUse(feature, used, this.unlocked());
  }

  left(feature: Feature, used: number): number {
    return this.unlocked() ? Infinity : freeLeft(feature, used);
  }

  sectionOpen(id: string): boolean {
    return this.unlocked() || reportSectionFree(id);
  }

  setPreviewFree(on: boolean): void {
    this.previewFree.set(on);
    try {
      if (on) localStorage.setItem(PREVIEW_KEY, 'free');
      else localStorage.removeItem(PREVIEW_KEY);
    } catch { /* storage blocked: the switch holds for this opening only */ }
  }
}

function readPreview(): boolean {
  try {
    return localStorage.getItem(PREVIEW_KEY) === 'free';
  } catch {
    return false;
  }
}
