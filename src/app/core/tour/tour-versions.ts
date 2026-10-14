/**
 * Which steps of a guided tour a person is shown (Jose, 2026-10-14: every
 * update brings its guide). Pure, so it is tested without a browser
 * (`tools/db/tour-versions.test.mjs`).
 */

/** A tour's version: the newest `since` among its steps, 1 when none says. */
export function versionOf(tour: { steps: readonly { since?: number }[] }): number {
  return Math.max(1, ...tour.steps.map(step => step.since ?? 1));
}

/** What a person who saw version `seen` (0: never) is shown, or null for nothing. */
export function stepsToShow<S extends { since?: number }>(tour: { steps: readonly S[] }, seen: number): { steps: S[]; news: boolean } | null {
  if (seen >= versionOf(tour)) return null;
  if (seen === 0) return { steps: [...tour.steps], news: false };
  const fresh = tour.steps.filter(step => (step.since ?? 1) > seen);
  return fresh.length > 0 ? { steps: fresh, news: true } : null;
}

/** "home@1,review@2"; a tour stored without its version (before versions) is version 1. */
export function parseSeenVersions<Id extends string>(raw: string | null, known: Record<string, unknown>): Map<Id, number> {
  const out = new Map<Id, number>();
  for (const one of (raw ?? '').split(',')) {
    const [id, v] = one.split('@');
    if (id in known) out.set(id as Id, Math.max(1, Number(v) || 1));
  }
  return out;
}
