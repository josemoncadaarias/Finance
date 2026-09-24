/**
 * An account being edited: a card with a pencil across its corner.
 *
 * Asked for by Jose on 2026-09-24. The summary screen had Ionicons' pencil in
 * a box beside the balance, which says "edit" and nothing about what - and
 * what it opens is the account itself: its name, its icon, its opening
 * balance. A card is how every banking app draws an account, so the pencil
 * goes on one.
 *
 * Drawn to the same conventions as the piggy bank beside it (see
 * piggy-bank.ts, which explains each of them): a data URI, single-quoted
 * attributes on one line, no fill, `currentColor`, round caps and joins, and
 * Ionicons' stroke of 32 on a 512 box. The card stops short of the pencil
 * rather than running under it: two outlines crossing read as a scribble at
 * the size of a button.
 */
export const ACCOUNT_EDIT = 'data:image/svg+xml;utf8,'
  + "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 512 512'>"
  + "<g fill='none' stroke='currentColor' stroke-width='32'"
  + " stroke-linecap='round' stroke-linejoin='round'>"
  // The card, and the stripe every card has.
  + "<rect x='32' y='96' width='336' height='224' rx='36'/>"
  + "<path d='M32 164h336'/>"
  // What would be its number, short, so the card is not mistaken for a box.
  + "<path d='M88 256h72'/>"
  // The pencil, body and point, lying across the corner the card left free.
  + "<path d='M433 289l46 46-144 144-57 11 11-57z'/>"
  + "<path d='M405 318l45 45'/>"
  + "</g>"
  + "</svg>";
