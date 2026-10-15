/**
 * When a card's payment day is said on the phone (Jose, 2026-10-15): on the
 * day itself, at a fixed hour, for a card whose two days are set and whose
 * statement still has something left. A card paid in full gets nothing, and a
 * reminder already on its way is taken back the moment the payment is saved.
 * Pure: the service turns these into the phone's notifications.
 */
import type { CardStatement } from './statement';

/** The hour of the payment day the reminder rings at, local time. */
export const DUE_HOUR = 8;

export interface DueCard {
  accountId: number;
  statement: CardStatement;
}

export interface DuePlan {
  accountId: number;
  dueOn: string;
  cutOn: string;
  remainingMinor: number;
  paidMinor: number;
  /** Ring at DUE_HOUR of `dueOn`, or right now (the hour has passed today). */
  when: 'later' | 'now';
}

/** Every reminder there should be, given the cards today at `hour` o'clock. */
export function duePlans(cards: readonly DueCard[], today: string, hour: number): DuePlan[] {
  const plans: DuePlan[] = [];
  for (const { accountId, statement: s } of cards) {
    if (s.state !== 'due' && s.state !== 'partial') continue;
    if (!s.dueOn || !s.cutOn || s.remainingMinor <= 0 || s.dueOn < today) continue;
    plans.push({
      accountId,
      dueOn: s.dueOn,
      cutOn: s.cutOn,
      remainingMinor: s.remainingMinor,
      paidMinor: s.paidMinor,
      when: s.dueOn > today || hour < DUE_HOUR ? 'later' : 'now',
    });
  }
  return plans;
}

/** The notification's own id for a card: one per card, so a new plan replaces the old. */
export function dueNoticeId(accountId: number): number {
  return 7_000_000 + accountId;
}
