/**
 * What falls due soon, for Inicio's "Esta semana" (mockup `11o`; Jose,
 * 2026-10-02): a card's statement and a loan's installment that are late, or
 * due within the next seven days. Pure: it reads what the card's statement
 * and the loan's schedule already worked out, and stores nothing.
 *
 * A card without its two days says nothing here - the app does not know when
 * it is due - and a statement already paid, or with nothing to pay, neither.
 */

import type { CardStatement } from '../cards/statement';
import type { InstallmentRow } from '../loans/schedule';

/** How many days ahead count as "this week". */
export const DUE_SOON_DAYS = 7;

export interface DueCard {
  id: number;
  currency: string;
  statement: CardStatement;
}

export interface DueLoan {
  id: number;
  installments: number;
  /** The installment due next, late or not, as the schedule says. */
  next: InstallmentRow | null;
  done: boolean;
}

export interface DueItem {
  kind: 'card' | 'loan';
  id: number;
  currency: string;
  amountMinor: number;
  dueOn: string;
  /** Days from today to the due day; negative once it has passed. */
  daysLeft: number;
  overdue: boolean;
  /** A loan's installment number and how many there are. */
  number?: number;
  of?: number;
}

export function daysBetween(from: string, to: string): number {
  const at = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
  return Math.round((at(to) - at(from)) / 86_400_000);
}

export function dueSoon(cards: readonly DueCard[], loans: readonly DueLoan[], today: string, days = DUE_SOON_DAYS): DueItem[] {
  const items: DueItem[] = [];
  for (const card of cards) {
    const s = card.statement;
    if (s.state !== 'due' && s.state !== 'partial' && s.state !== 'overdue') continue;
    if (!s.dueOn || s.remainingMinor <= 0) continue;
    const left = daysBetween(today, s.dueOn);
    const overdue = s.state === 'overdue' || left < 0;
    if (!overdue && left > days) continue;
    items.push({ kind: 'card', id: card.id, currency: card.currency, amountMinor: s.remainingMinor, dueOn: s.dueOn, daysLeft: left, overdue });
  }
  for (const loan of loans) {
    const n = loan.next;
    if (loan.done || !n || (n.state !== 'next' && n.state !== 'overdue')) continue;
    const left = daysBetween(today, n.dueOn);
    const overdue = n.state === 'overdue' || left < 0;
    if (!overdue && left > days) continue;
    items.push({
      kind: 'loan', id: loan.id, currency: 'COP', amountMinor: n.totalMinor, dueOn: n.dueOn, daysLeft: left, overdue,
      number: n.number, of: loan.installments,
    });
  }
  return items.sort((a, b) => a.dueOn.localeCompare(b.dueOn) || a.kind.localeCompare(b.kind) || a.id - b.id);
}
