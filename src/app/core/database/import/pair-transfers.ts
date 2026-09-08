/**
 * Rebuilds transfers from the two mirror rows Monefy leaves behind.
 *
 * Monefy has no transfer entity. Moving money writes two rows with fake
 * categories — `To 'B'` on account A, and `From 'A'` on account B — and
 * nothing links them. Pairing them back up is guesswork constrained by the
 * data, so this module reports how it matched each pair and leaves anything
 * doubtful unpaired rather than inventing a link.
 *
 * Two passes, most confident first:
 *
 *   1. **exact** — same day, the accounts name each other, same amount.
 *   2. **near_date** — everything matches but the day, within a few days of
 *      each other. Real transfers between banks land on different dates.
 *
 * Whatever survives both passes is left alone. A wrong pairing is worse than
 * an unpaired row: it silently moves money between the wrong accounts.
 *
 * On the real backup this leaves 88 rows unpaired, and all 88 turn out to name
 * an account that never appears in the account column — see
 * `findGhostAccounts` below. They are not failures of the matching.
 */

import type { MonefyRow } from './monefy-csv';

/** How confident the pairing is, and therefore how it should be reviewed. */
export type PairingMethod = 'exact' | 'near_date';

export interface TransferPair {
  out: MonefyRow;
  into: MonefyRow;
  method: PairingMethod;
  /** Days between the two halves. Zero for an exact match. */
  dayGap: number;
}

export interface PairingResult {
  pairs: TransferPair[];
  /** `To 'X'` rows with no counterpart. */
  unpairedOut: MonefyRow[];
  /** `From 'Y'` rows with no counterpart. */
  unpairedIn: MonefyRow[];
}

/** How far apart two halves may sit before the pairing is refused. */
const MAX_DAY_GAP = 3;

function daysBetween(a: string, b: string): number {
  const millis = Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`);
  return Math.abs(Math.round(millis / 86_400_000));
}

/**
 * A key both halves of the same transfer agree on.
 *
 * The outgoing row knows its own account and names the destination; the
 * incoming row knows the destination and names the source. Ordering the pair
 * of names the same way from either side makes the two keys identical.
 */
function pairKey(from: string, to: string, amountMinor: number): string {
  return `${from}${to}${Math.abs(amountMinor)}`;
}

function outKey(row: MonefyRow): string {
  return pairKey(row.account, row.counterparty ?? '', row.amountMinor);
}

function inKey(row: MonefyRow): string {
  return pairKey(row.counterparty ?? '', row.account, row.amountMinor);
}

/**
 * Pairs the transfer halves in a parsed export.
 *
 * Rows are consumed in file order, so when several identical transfers happen
 * on one day — and the real backup has such pairs — the first outgoing row
 * takes the first incoming one. That keeps the result stable between exports,
 * for the same reason `import_seq` does.
 */
export function pairTransfers(rows: readonly MonefyRow[]): PairingResult {
  const outgoing = rows.filter(row => row.kind === 'transfer_out');
  const incoming = rows.filter(row => row.kind === 'transfer_in');

  const pairs: TransferPair[] = [];
  const claimed = new Set<MonefyRow>();

  // Bucket the incoming rows so a match is a lookup rather than a scan. With
  // 2,635 of them, scanning per outgoing row would be seven million compares.
  const byKeyAndDate = new Map<string, MonefyRow[]>();
  const byKey = new Map<string, MonefyRow[]>();

  for (const row of incoming) {
    const key = inKey(row);
    const dated = `${key}${row.occurredOn}`;
    (byKeyAndDate.get(dated) ?? byKeyAndDate.set(dated, []).get(dated)!).push(row);
    (byKey.get(key) ?? byKey.set(key, []).get(key)!).push(row);
  }

  const takeFirstUnclaimed = (candidates: MonefyRow[] | undefined): MonefyRow | null => {
    if (!candidates) return null;
    for (const candidate of candidates) {
      if (!claimed.has(candidate)) return candidate;
    }
    return null;
  };

  // Pass 1: same day, same accounts, same amount.
  for (const row of outgoing) {
    const match = takeFirstUnclaimed(byKeyAndDate.get(`${outKey(row)}${row.occurredOn}`));
    if (match) {
      claimed.add(match);
      pairs.push({ out: row, into: match, method: 'exact', dayGap: 0 });
    }
  }

  const pairedOut = new Set(pairs.map(pair => pair.out));

  // Pass 2: the same transfer recorded on slightly different days.
  for (const row of outgoing) {
    if (pairedOut.has(row)) continue;

    const candidates = (byKey.get(outKey(row)) ?? [])
      .filter(candidate => !claimed.has(candidate))
      .map(candidate => ({ candidate, gap: daysBetween(candidate.occurredOn, row.occurredOn) }))
      .filter(entry => entry.gap <= MAX_DAY_GAP)
      // Nearest in time wins; ties go to whichever came first in the file.
      .sort((a, b) => a.gap - b.gap);

    const best = candidates[0];
    if (best) {
      claimed.add(best.candidate);
      pairedOut.add(row);
      pairs.push({ out: row, into: best.candidate, method: 'near_date', dayGap: best.gap });
    }
  }

  return {
    // File order, so a re-import produces the same transfers in the same order.
    pairs: pairs.sort((a, b) => a.out.lineNumber - b.out.lineNumber),
    unpairedOut: outgoing.filter(row => !pairedOut.has(row)),
    unpairedIn: incoming.filter(row => !claimed.has(row)),
  };
}

/**
 * An account that Monefy no longer has, but that the history still refers to.
 *
 * Deleting an account in Monefy removes its rows, but the surviving half of
 * every transfer keeps its category text — `To 'Renta Fija Plazo'` stays behind
 * on Bancolombia long after the fund itself is gone. Those halves can never be
 * paired, because the other side was deleted.
 *
 * On the real backup this accounts for **every** unpaired row: 88 of 88, across
 * 12 vanished accounts, mostly investment funds closed in 2021 and 2022.
 *
 * They are worth reconstructing rather than discarding. The money genuinely
 * left Bancolombia, and the name, date and amount are all right there. The
 * importer recreates each as an archived account and synthesises the missing
 * leg, so the transfer is whole and the history balances — then flags it for
 * review, because the account's currency and type cannot be known from a name.
 */
export interface GhostAccount {
  name: string;
  /** Rows where money moved into it. */
  receivedRows: number;
  /** Rows where money moved back out of it. */
  sentRows: number;
  firstSeen: string;
  lastSeen: string;
  /**
   * The balance it would end with once its side of each orphaned row is
   * reconstructed. Near zero means the account was emptied before deletion,
   * which is the expected shape for a closed fund.
   */
  netMinor: number;
}

/**
 * Finds the accounts referred to by pseudo-categories that never appear as
 * accounts in their own right.
 *
 * `knownAccounts` is the account list from the parse, not a hand-written one:
 * whether a name is a ghost is a fact about the file, not a judgement.
 */
export function findGhostAccounts(
  rows: readonly MonefyRow[],
  knownAccounts: readonly string[],
): GhostAccount[] {
  const known = new Set(knownAccounts);
  const ghosts = new Map<string, GhostAccount>();

  for (const row of rows) {
    if (row.counterparty === null || known.has(row.counterparty)) continue;
    if (row.kind !== 'transfer_out' && row.kind !== 'transfer_in') continue;

    const ghost = ghosts.get(row.counterparty) ?? {
      name: row.counterparty,
      receivedRows: 0,
      sentRows: 0,
      firstSeen: row.occurredOn,
      lastSeen: row.occurredOn,
      netMinor: 0,
    };

    if (row.kind === 'transfer_out') ghost.receivedRows += 1;
    else ghost.sentRows += 1;

    // The ghost's side is the mirror of the surviving row's.
    ghost.netMinor -= row.amountMinor;
    if (row.occurredOn < ghost.firstSeen) ghost.firstSeen = row.occurredOn;
    if (row.occurredOn > ghost.lastSeen) ghost.lastSeen = row.occurredOn;

    ghosts.set(row.counterparty, ghost);
  }

  return [...ghosts.values()].sort((a, b) => a.firstSeen.localeCompare(b.firstSeen));
}
