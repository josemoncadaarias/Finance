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

import { Injectable, effect, inject, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

import { DatabaseService } from '../database/database.service';
import { AccountsRepository } from '../database/repositories/accounts.repository';
import { ProposalsRepository } from '../database/repositories/proposals.repository';
import { BankNotifications } from '../notifications/bank-notifications';
import { noticeKey, noticeSource, readNotices, type KeptNotice } from './notice-proposals';

@Injectable({ providedIn: 'root' })
export class NoticeInboxService {
  private readonly database = inject(DatabaseService);
  private readonly router = inject(Router);
  private running: Promise<number> | null = null;
  private started = false;

  constructor() {
    effect(() => {
      if (this.database.status() !== 'ready' || this.started) return;
      this.started = true;
      // A moment after opening, past the first screen.
      untracked(() => setTimeout(() => void this.read(), 2500));
    });
    if (Capacitor.isNativePlatform()) {
      void App.addListener('appStateChange', ({ isActive }) => {
        if (isActive && this.database.status() === 'ready') void this.read();
      });
    }
  }

  /** Reads what is new; how many proposals it wrote. One pass at a time. */
  read(): Promise<number> {
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
      const { open } = await BankNotifications.takeOpen();
      if (!open) return;
      await this.router.navigate(['/review'], open === 'review' ? {} : { queryParams: { notice: open } });
    } catch {
      // Nothing asked, or nowhere to go: the app opens as usual.
    }
  }

  private async pass(): Promise<number> {
    try {
      const { supported } = await BankNotifications.isSupported();
      if (!supported) return 0;
      const { caught } = await BankNotifications.caught();
      // Whatever was waiting is about to be in Por revisar: the phone's notice goes.
      void BankNotifications.clearAlerts().catch(() => undefined);
      if (caught.length === 0) return 0;
      const { dismissed } = await BankNotifications.dismissed();

      const db = this.database.driver;
      const proposals = new ProposalsRepository(db);
      const [known, answers, accounts, recent, molds, assigned] = await Promise.all([
        proposals.noticeKeys(), proposals.noticeAnswers(), new AccountsRepository(db).list(),
        proposals.recentNotices(), proposals.molds(), proposals.sourceAccounts(),
      ]);
      // "Descartar" on the phone's notice: those messages are never proposed.
      for (const notice of thrownAway(caught, dismissed)) known.add(noticeKey(notice));
      // One purchase told by an SMS and by the bank's app is one proposal:
      // a later message joins the one already written.
      const { fresh: made, joining } = readNotices(caught, known, answers, accounts, recent, { molds, assigned });
      const joined = await proposals.join(joining);
      if (made.length === 0) {
        if (joined > 0) this.database.dataChanged();
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
