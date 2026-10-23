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
  /** The last different amounts, latest first, offered as chips (mockup 42c). */
  lastAmounts: number[];
  /**
   * True for a spending or an income repeated on one account and category
   * with a different note each time (mockup 42d): `note` is the one written
   * most, and `otherNotes` the rest, most used first.
   */
  loose: boolean;
  otherNotes: string[];
  /** Fixed on top by the person (mockups 42e, 42f). */
  pinned: boolean;
}

/** A habit fixed on top: its whole shape, so it shows even when not used lately. */
export interface PinnedHabit {
  key: string;
  kind: FrequentKind;
  accountId: number;
  toAccountId: number | null;
  productId: number | null;
  toProductId: number | null;
  categoryId: number | null;
  note: string;
  loose: boolean;
}

/** How many different amounts are offered as chips. */
export const LAST_SHOWN = 3;
/** How many other notes a loose habit offers. */
const OTHER_NOTES = 4;

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

function lastDifferent(latestFirst: number[]): number[] {
  const out: number[] = [];
  for (const a of latestFirst) {
    if (a > 0 && !out.includes(a)) out.push(a);
    if (out.length >= LAST_SHOWN) break;
  }
  return out;
}

/** The key of a spending or an income on one account and category, whatever its note. */
export function looseKey(m: Pick<PastMovement, 'kind' | 'accountId' | 'categoryId'>): string {
  return ['loose', m.kind, m.accountId, m.categoryId ?? ''].join('|');
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
  const latestFirst = (a: PastMovement, b: PastMovement) => (a.onDate < b.onDate ? 1 : a.onDate > b.onDate ? -1 : 0);
  // What is not an exact habit may still be one by its account and category
  // (mockup 42d): the same spending, with another note each time.
  const loose = new Map<string, PastMovement[]>();
  for (const [key, list] of groups) {
    list.sort(latestFirst);
    if (list.length < MIN_USES) {
      const first = list[0];
      if (first.kind === 'transfer' || first.categoryId === null) continue;
      const lk = looseKey(first);
      loose.set(lk, [...(loose.get(lk) ?? []), ...list]);
      continue;
    }
    found.push(habitOf(key, list, false));
  }
  for (const [key, list] of loose) {
    if (list.length < MIN_USES) continue;
    list.sort(latestFirst);
    found.push(habitOf(key, list, true));
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

/** A habit out of its movements, latest first. */
function habitOf(key: string, list: PastMovement[], isLoose: boolean): Frequent {
  const latest = list[0];
  let note = latest.note.trim();
  let otherNotes: string[] = [];
  if (isLoose) {
    // Notes by how often they are written, the latest spelling of each; the
    // one written most is offered when it was written at least twice.
    const byNote = new Map<string, { text: string; uses: number }>();
    for (const m of list) {
      const text = m.note.trim();
      if (!text) continue;
      const k = fold(text);
      const seen = byNote.get(k);
      if (seen) seen.uses++; else byNote.set(k, { text, uses: 1 });
    }
    const ranked = [...byNote.values()].sort((a, b) => b.uses - a.uses);
    note = ranked[0] && ranked[0].uses >= 2 ? ranked[0].text : '';
    otherNotes = ranked.map(r => r.text).filter(t => t !== note).slice(0, OTHER_NOTES);
  }
  const amounts = list.map(m => m.amountMinor);
  return {
    key,
    kind: latest.kind,
    accountId: latest.accountId,
    toAccountId: latest.toAccountId ?? null,
    productId: latest.productId ?? null,
    toProductId: latest.toProductId ?? null,
    categoryId: latest.categoryId,
    note,
    uses: list.length,
    lastOn: latest.onDate,
    amountMinor: steadyAmount(amounts),
    lastAmounts: lastDifferent(amounts),
    loose: isLoose,
    otherNotes,
    pinned: false,
  };
}

export interface Habits {
  /** Fixed on top by the person, in the order they were fixed. */
  pinned: Frequent[];
  /** The rest, most used first, none of them pinned or hidden. */
  frequent: Frequent[];
}

/**
 * The habits as the person sees them: the pinned first - built from their
 * saved shape, with what the last weeks say about them (uses, amounts) - and
 * then `frequentOf` without the pinned and without what the person hid.
 */
export function habitsOf(
  rows: readonly PastMovement[],
  today: string,
  options: { skip?: ReadonlySet<string>; pins?: readonly PinnedHabit[]; hidden?: ReadonlySet<string>; shown?: number } = {},
): Habits {
  const pins = options.pins ?? [];
  const hidden = options.hidden ?? new Set<string>();
  const every = frequentOf(rows, today, options.skip, Number.MAX_SAFE_INTEGER);
  const from = minusDays(today, WINDOW_DAYS);
  const pinned = pins.map(pin => {
    const seen = every.find(f => f.key === pin.key);
    if (seen) return { ...seen, pinned: true };
    const mine = rows
      .filter(m => m.onDate >= from && m.onDate <= today && (pin.loose ? looseKey(m) === pin.key : habitKey(m) === pin.key))
      .sort((a, b) => (a.onDate < b.onDate ? 1 : a.onDate > b.onDate ? -1 : 0));
    return {
      key: pin.key, kind: pin.kind, accountId: pin.accountId, toAccountId: pin.toAccountId,
      productId: pin.productId, toProductId: pin.toProductId, categoryId: pin.categoryId, note: pin.note,
      uses: mine.length, lastOn: mine[0]?.onDate ?? '', amountMinor: mine.length >= 2 ? steadyAmount(mine.map(m => m.amountMinor)) : null,
      lastAmounts: lastDifferent(mine.map(m => m.amountMinor)), loose: pin.loose, otherNotes: [], pinned: true,
    } satisfies Frequent;
  });
  const out = new Set([...pins.map(p => p.key), ...hidden]);
  const rest = frequentOf(rows.filter(m => !out.has(habitKey(m))), today, options.skip, options.shown ?? SHOWN)
    .filter(f => !out.has(f.key));
  return { pinned, frequent: rest };
}

/** What a habit keeps when it is pinned. */
export function pinOf(f: Frequent): PinnedHabit {
  return {
    key: f.key, kind: f.kind, accountId: f.accountId, toAccountId: f.toAccountId, productId: f.productId,
    toProductId: f.toProductId, categoryId: f.categoryId, note: f.note, loose: f.loose,
  };
}
