/**
 * The two icon columns of an account, a category or a product kind, as the
 * schema wants them: exactly one of the two filled.
 *
 * An image of one's own wins and clears the built-in icon; with neither, the
 * built-in fallback. Every writer goes through here, so a form that hands
 * both (the face editor remembers the last icon behind an image) can never
 * reach the CHECK (Jose, 2026-11-06: "Nueva cuenta" with a picture of its
 * own failed with "CHECK constraint failed").
 */
export function iconColumns(
  builtin: string | null | undefined,
  custom: number | null | undefined,
  fallback: string,
): { builtin_icon: string | null; custom_icon_id: number | null } {
  if (custom != null) return { builtin_icon: null, custom_icon_id: custom };
  return { builtin_icon: builtin ?? fallback, custom_icon_id: null };
}
