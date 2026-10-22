/**
 * What the person registers most, offered in the "+" as one tap each (Jose,
 * 2026-10-22, idea F): the same kind of movement, on the same account, with
 * the same category and the same note, several times in the last weeks.
 *
 * Read from anybody's own movements, never from a list: a habit is a note
 * written the same way at least `MIN_USES` times in `WINDOW_DAYS`. Tapping one
 * opens the one movement form filled in, and nothing is saved by itself
 * (rule 22). The amount comes along only when it is steady (each of the last
 * times within `STEADY` of their middle value): a coffee always costs about
 * the same, a market never does, and a wrong figure typed for the person is
 * worse than none. Pure, tested in `frequent.test.mjs`.
 */

import { merchantKeyOf } from '../proposals/merchant';

export const WINDOW_DAYS = 90;
export const MIN_USES = 3;
export const SHOWN = 4;
/** At most this many of one kind while other kinds have habits too. */
export const PER_KIND = 2;
/** How far each of the last amounts may stray from their middle value. */
export const STEADY = 0.15;
/** How many of the latest amounts decide whether it is steady. */
const LAST_AMOUNTS = 5;

export type FrequentKind = 'expense' | 'income' | 'transfer';

/** One movement on record, as the "+" reads it. */
export interface PastMovement {
  kind: FrequentKind;
  accountId: number;
  /** The far end of a transfer. */
  toAccountId?: number | null;
  productId?: number | null;
  toProductId?: number | null;
  categoryId: number | null;
  note: string;
  /** Always positive, in the account's own currency. */
  amountMinor: number;
  onDate: string;
}

export interface Frequent {
  key: string;
  kind: FrequentKind;
  accountId: number;
  toAccountId: number | null;
  productId: number | null;
  toProductId: number | null;
  categoryId: number | null;
  /** The note in its latest spelling; empty when it has none. */
  note: string;
  uses: number;
  lastOn: string;
  /** The latest amount when the amounts are steady; null when they move. */
  amountMinor: number | null;
}

function fold(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/** The habit a movement belongs to. */
export function habitKey(m: Pick<PastMovement, 'kind' | 'accountId' | 'toAccountId' | 'categoryId' | 'note'>): string {
  return [m.kind, m.accountId, m.toAccountId ?? '', m.categoryId ?? '', fold(m.note)].join('|');
}

function minusDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const at = new Date(Date.UTC(y, m - 1, d - days));
  return at.toISOString().slice(0, 10);
}

function steadyAmount(latestFirst: number[]): number | null {
  const last = latestFirst.slice(0, LAST_AMOUNTS);
  const sorted = [...last].sort((a, b) => a - b);
  const middle = sorted[Math.floor(sorted.length / 2)];
  if (middle <= 0) return null;
  return last.every(a => Math.abs(a - middle) <= middle * STEADY) ? last[0] : null;
}

/**
 * The habits of the last `WINDOW_DAYS` up to `today`, most used first (the
 * latest winning a tie), at most `SHOWN`, and at most `PER_KIND` of one kind
 * while another kind has habits to fill the place. A movement with neither a note nor
 * a category says nothing to repeat and is left out; so is one whose note is
 * a shop in `skip` (the fixed payments the "+" already lists above).
 */
export function frequentOf(
  rows: readonly PastMovement[],
  today: string,
  skip: ReadonlySet<string> = new Set(),
  shown = SHOWN,
): Frequent[] {
  const from = minusDays(today, WINDOW_DAYS);
  const groups = new Map<string, PastMovement[]>();
  for (const row of rows) {
    if (row.onDate < from || row.onDate > today) continue;
    if (!row.note.trim() && row.categoryId === null && row.kind !== 'transfer') continue;
    if (row.note.trim() && skip.has(merchantKeyOf(row.note))) continue;
    const key = habitKey(row);
    const list = groups.get(key);
    if (list) list.push(row); else groups.set(key, [row]);
  }

  const found: Frequent[] = [];
  for (const [key, list] of groups) {
    if (list.length < MIN_USES) continue;
    list.sort((a, b) => (a.onDate < b.onDate ? 1 : a.onDate > b.onDate ? -1 : 0));
    const latest = list[0];
    found.push({
      key,
      kind: latest.kind,
      accountId: latest.accountId,
      toAccountId: latest.toAccountId ?? null,
      productId: latest.productId ?? null,
      toProductId: latest.toProductId ?? null,
      categoryId: latest.categoryId,
      note: latest.note.trim(),
      uses: list.length,
      lastOn: latest.onDate,
      amountMinor: steadyAmount(list.map(m => m.amountMinor)),
    });
  }
  found.sort((a, b) => b.uses - a.uses || (a.lastOn < b.lastOn ? 1 : a.lastOn > b.lastOn ? -1 : 0));
  // A mix: someone who moves money between pockets every day still sees the
  // spending they repeat. The most used of each kind first, the rest after.
  const picked: Frequent[] = [];
  const perKind = new Map<FrequentKind, number>();
  for (const f of found) {
    if (picked.length >= shown) break;
    if ((perKind.get(f.kind) ?? 0) >= PER_KIND) continue;
    picked.push(f);
    perKind.set(f.kind, (perKind.get(f.kind) ?? 0) + 1);
  }
  for (const f of found) {
    if (picked.length >= shown) break;
    if (!picked.includes(f)) picked.push(f);
  }
  return picked.sort((a, b) => b.uses - a.uses || (a.lastOn < b.lastOn ? 1 : a.lastOn > b.lastOn ? -1 : 0));
}
