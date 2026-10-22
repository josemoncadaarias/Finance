/**
 * Reports, ideas and questions to Jadex Labs (Jose, 2026-10-22): the sheet
 * mounted once in the shell (`app-feedback-sheet`) opens when `asking` is
 * set - from Más → Ayuda, or from the notice after a receipt is read, with
 * what the reader made of the photo kept in. Nothing is sent by the app: the
 * person's own mail app opens with the message written (`feedbackMail`).
 */

import { Injectable, signal } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';

import { lastPages } from '../statements/image-text';
import type { OcrPage } from '../statements/ocr-items';
import type { FeedbackKind } from './feedback-mail';

export interface FeedbackAsk {
  kind: FeedbackKind;
  /** Whether what was read from the last photo starts kept in. */
  withReading: boolean;
}

@Injectable({ providedIn: 'root' })
export class FeedbackService {
  readonly asking = signal<FeedbackAsk | null>(null);
  /** What the last photo gave (a receipt's total, day and shop), beside the pages it came from. */
  private read: { result: unknown; pages: OcrPage[] } | null = null;
  private version: string | null = null;

  constructor() {
    if (Capacitor.isNativePlatform()) {
      void App.getInfo().then(info => (this.version = info.version)).catch(() => undefined);
    }
  }

  open(kind: FeedbackKind = 'bug', withReading = false): void {
    this.asking.set({ kind, withReading: withReading && this.hasReading() });
  }

  /** What the app made of the photo just read, kept with it for a report. */
  noteRead(result: unknown): void {
    this.read = { result, pages: lastPages };
  }

  /** Whether a photo was read since the app opened. */
  hasReading(): boolean {
    return lastPages.length > 0;
  }

  /** The last photo as the phone's reader handed it back, and what came of it: no image, only text. */
  reading(): string | null {
    if (!this.hasReading()) return null;
    const result = this.read?.pages === lastPages ? this.read.result : null;
    return JSON.stringify({ read: result, pages: lastPages });
  }

  installed(): string | null {
    return this.version;
  }
}

/** Puts text on the clipboard, also where the clipboard API is refused. */
export async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const box = document.createElement('textarea');
    box.value = text;
    document.body.appendChild(box);
    box.select();
    document.execCommand('copy');
    box.remove();
  }
}
