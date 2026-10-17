/**
 * Turns the bank messages the phone kept into proposals, by itself.
 *
 * When the app opens and every time it comes back to the front - never in
 * the background (rule 22: "nothing working in the background"). One pass
 * reads what Android kept, what was already proposed and what the person
 * answered before, each once, works the rest out in memory
 * (`proposalsFrom`), and writes the new proposals one batch per app. A
 * message already proposed, accepted or thrown away is never proposed again.
 *
 * Nothing here is felt: on a phone with no messages kept it is one call to
 * Android that answers an empty list, and everywhere else (the browser, an
 * iPhone) the plugin answers "not supported" and nothing else happens.
 */

import { Injectable, effect, inject, signal, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

import { DatabaseService } from '../database/database.service';
import { DemoService } from '../demo/demo.service';
import { AccountsRepository } from '../database/repositories/accounts.repository';
import { ProposalsRepository } from '../database/repositories/proposals.repository';
import { BankNotifications } from '../notifications/bank-notifications';
import { quietForPhone } from './molds';
import { noticeKey, noticeSource, readNotices, type KeptNotice } from './notice-proposals';

@Injectable({ providedIn: 'root' })
export class NoticeInboxService {
  private readonly database = inject(DatabaseService);
  private readonly router = inject(Router);
  private readonly demo = inject(DemoService);
  private running: Promise<number> | null = null;
  private started = false;
  /** What "Movimiento detectado" asked to open, taken from the phone once. */
  private asked = '';
  private openingTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * While a tapped "Movimiento detectado" is being opened (Jose, 2026-10-17,
   * mockup 36 option A): opening the data, reading the bank's message, then
   * opening Por revisar on it. Null when nothing is being opened.
   */
  readonly opening = signal<'data' | 'read' | 'review' | null>(null);
  /** Set when the movement could not be found within the time allowed. */
  readonly openingFailed = signal(false);

  constructor() {
    effect(() => {
      if (this.database.status() !== 'ready' || this.started) return;
      this.started = true;
      // A moment after opening, past the first screen - at once when a
      // tapped notice is waiting to be opened.
      untracked(() => {
        if (this.asked) void this.read();
        else setTimeout(() => void this.read(), 2500);
      });
    });
    if (Capacitor.isNativePlatform()) {
      void this.lookForAsked();
      void App.addListener('appStateChange', ({ isActive }) => {
        if (!isActive) return;
        void this.lookForAsked();
        if (this.database.status() === 'ready') void this.read();
      });
    }
  }

  /**
   * Was the app opened from "Movimiento detectado"? Then say so on screen at
   * once and read the message without waiting.
   */
  private async lookForAsked(): Promise<void> {
    try {
      const { open } = await BankNotifications.takeOpen();
      if (!open) return;
      this.asked = open;
      this.startOpening(this.database.status() === 'ready' ? 'read' : 'data');
      if (this.database.status() === 'ready') void this.read();
    } catch {
      // Nothing asked: the app opens as usual.
    }
  }

  private startOpening(step: 'data' | 'read' | 'review'): void {
    this.openingFailed.set(false);
    this.opening.set(step);
    if (this.openingTimer) clearTimeout(this.openingTimer);
    // Never a screen that waits for ever: past 20 s it says where to look.
    this.openingTimer = setTimeout(() => {
      if (!this.opening()) return;
      this.opening.set(null);
      this.openingFailed.set(true);
    }, 20_000);
  }

  /** Por revisar opened the movement, or there was nothing more to open. */
  openingDone(): void {
    if (this.openingTimer) clearTimeout(this.openingTimer);
    this.openingTimer = null;
    this.opening.set(null);
  }

  /** Reads what is new; how many proposals it wrote. One pass at a time. */
  read(): Promise<number> {
    if (this.opening() === 'data') this.opening.set('read');
    if (!this.running) {
      this.running = this.pass().finally(() => { this.running = null; void this.openAsked(); });
    }
    return this.running;
  }

  /**
   * "Movimiento detectado" tapped: once its message is a proposal, Por
   * revisar opens on it ("review" for several opens the screen).
   */
  private async openAsked(): Promise<void> {
    try {
      const open = this.asked || (await BankNotifications.takeOpen()).open;
      this.asked = '';
      if (!open) return;
      if (!this.opening()) this.startOpening('review');
      this.opening.set('review');
      await this.router.navigate(['/review'], open === 'review' ? {} : { queryParams: { notice: open } });
      // The whole list was asked for: it is open.
      if (open === 'review') this.openingDone();
    } catch {
      // Nothing asked, or nowhere to go: the app opens as usual.
      this.openingDone();
    }
  }

  private async pass(): Promise<number> {
    try {
      // Real messages never land among the sample's invented accounts: they
      // wait on the phone until it is erased.
      if (this.demo.active()) return 0;
      const { supported } = await BankNotifications.isSupported();
      if (!supported) return 0;
      const db = this.database.driver;
      const proposals = new ProposalsRepository(db);
      // "No es movimiento" on the phone's notice teaches before anything is read.
      const { marked } = await BankNotifications.takeNotMovements().catch(() => ({ marked: [] }));
      await proposals.notMovementsFromPhone(marked);
      const [quiet, molds] = await Promise.all([proposals.quiet(), proposals.molds()]);
      // The phone's notice learns it too, and does not ring for it.
      void BankNotifications.setQuiet({ json: quietForPhone(quiet, molds) }).catch(() => undefined);
      const { caught } = await BankNotifications.caught();
      // Whatever was waiting is about to be in Por revisar: the phone's notice goes.
      void BankNotifications.clearAlerts().catch(() => undefined);
      if (caught.length === 0) return 0;
      const { dismissed } = await BankNotifications.dismissed();

      const [known, answers, accounts, recent, assigned] = await Promise.all([
        proposals.noticeKeys(), proposals.noticeAnswers(), new AccountsRepository(db).list(),
        proposals.recentNotices(), proposals.sourceAccounts(),
      ]);
      // "Descartar" on the phone's notice: those messages are never proposed.
      for (const notice of thrownAway(caught, dismissed)) known.add(noticeKey(notice));
      // One purchase told by an SMS and by the bank's app is one proposal:
      // a later message joins the one already written.
      const { fresh: made, joining } = readNotices(caught, known, answers, accounts, recent, { molds, assigned, quiet });
      const joined = await proposals.join(joining);
      if (made.length === 0) {
        // Halves of a transfer between two banks already waiting apart.
        const paired = await proposals.pairWaitingMessages();
        if (joined > 0 || paired > 0) this.database.dataChanged();
        return 0;
      }

      const byBatch = new Map<string, typeof made>();
      for (const one of made) byBatch.set(one.batch, [...(byBatch.get(one.batch) ?? []), one]);
      let written = 0;
      for (const [batch, ones] of byBatch) {
        written += (await proposals.propose(batch, ones.map(one => one.proposal))).ids.length;
      }
      if (written > 0 || joined > 0) this.database.dataChanged();
      return written;
    } catch {
      // A message that could not be read today is read on the next pass;
      // nothing about it is worth stopping the app for.
      return 0;
    }
  }
}

/**
 * The kept messages the person threw away from the phone's notice: the same
 * source and words, within five minutes (the SMS receiver's clock and the
 * inbox's may differ by seconds).
 */
export function thrownAway(
  caught: readonly KeptNotice[], dismissed: readonly { source: string; text: string; at: number }[],
): KeptNotice[] {
  if (dismissed.length === 0) return [];
  return caught.filter(notice => dismissed.some(one => one.source === noticeSource(notice)
    && one.text.trim() === notice.text.trim() && Math.abs(one.at - notice.postedAt) < 5 * 60_000));
}

