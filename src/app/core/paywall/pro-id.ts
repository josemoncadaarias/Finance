/**
 * The id a person carries in the store (RevenueCat's app user id), the same
 * on every phone and every install: made from the Google account they sign
 * in with, never the address itself (Jose, 2026-10-28: he and the people he
 * chooses keep Finance Pro for good, granted from RevenueCat's dashboard to
 * this id). Without a Google account, the store's own anonymous id stands,
 * and a reinstall gives a new one.
 */

/** "fp-" and the first 24 hex digits of the address's SHA-256, folded first. */
export async function proIdOf(email: string): Promise<string | null> {
  const plain = email.trim().toLowerCase();
  if (!plain.includes('@')) return null;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(plain));
  const hex = [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
  return `fp-${hex.slice(0, 24)}`;
}

/** Whether an id is the store's anonymous one, which a reinstall loses. */
export function isAnonymous(id: string | null): boolean {
  return !id || id.startsWith('$RCAnonymousID');
}
