/**
 * The import fingerprint: how a row from a Monefy CSV export is recognised as
 * one already stored.
 *
 * The backup is re-exported regularly and carries the whole history again plus
 * whatever is new, so the importer needs to tell old rows from new ones. The
 * CSV has no id column, so identity has to come from the content.
 *
 * The fingerprint is the normalised fields joined by a separator — a readable
 * string, not a hash. Hashing was the first plan and was dropped:
 *
 *   - SHA-256 in a browser is `crypto.subtle`, which is async and would make
 *     every call site async for no benefit.
 *   - A readable fingerprint can be shown in the review queue and understood
 *     at a glance, instead of being 64 characters of hex.
 *   - Equality becomes exact rather than merely very likely.
 *
 * The cost is roughly 80 bytes per row — about 1 MB across the whole backup,
 * against a database already several MB in size. Worth it.
 */

/** The field separator. `` cannot appear in a CSV field. */
const SEPARATOR = '';

export interface FingerprintFields {
  /** ISO day, already converted from the file's `dd/mm/yyyy`. */
  occurredOn: string;
  /** Account name exactly as the file spells it. */
  account: string;
  /** Raw category, including pseudo-categories such as `To 'ARQ'`. */
  category: string;
  /** Amount in minor units, already parsed to an integer. */
  amountMinor: number;
  description: string | null | undefined;
}

/**
 * Normalises one field.
 *
 * Whitespace is trimmed and runs of it collapsed, because a stray double space
 * is not a different transaction. Case and accents are deliberately left
 * alone: renaming an account in Monefy, or fixing its spelling, *should* be
 * visible rather than quietly papered over.
 */
export function normalizeField(value: string | null | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

/**
 * Builds the fingerprint for one CSV row.
 *
 * The amount is normalised to minor units before it goes in, so `-51,774.09`
 * and `-51774.09` produce the same fingerprint. Callers must therefore parse
 * the amount first — passing a raw string would defeat the point.
 */
export function fingerprintOf(fields: FingerprintFields): string {
  if (!Number.isInteger(fields.amountMinor)) {
    throw new Error(`Fingerprint needs an integer amount in minor units, got ${fields.amountMinor}`);
  }

  return [
    normalizeField(fields.occurredOn),
    normalizeField(fields.account),
    normalizeField(fields.category),
    String(fields.amountMinor),
    normalizeField(fields.description),
  ].join(SEPARATOR);
}

/** Renders a fingerprint for a human: separators become pipes. */
export function formatFingerprint(fingerprint: string): string {
  return fingerprint.split(SEPARATOR).join(' | ');
}

/**
 * Assigns each row its `import_seq`: 1 for the first row with a given
 * fingerprint, 2 for the next, and so on, in file order.
 *
 * This is what keeps legitimately identical rows apart. The real backup holds
 * six such pairs — the same 2,600 bus fare twice on the same day, two
 * identical transfers — and collapsing them would silently lose money.
 *
 * It assumes Monefy exports rows in a stable order, so that a row lands on the
 * same slot in every export. Compare two exports with
 * `tools/db/compare-exports.mjs` to check that.
 */
export function assignSequences(fingerprints: readonly string[]): number[] {
  const seen = new Map<string, number>();
  return fingerprints.map(fingerprint => {
    const next = (seen.get(fingerprint) ?? 0) + 1;
    seen.set(fingerprint, next);
    return next;
  });
}
