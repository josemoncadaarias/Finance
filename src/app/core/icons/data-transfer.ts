/**
 * Bringing data in and taking it out: Importar y exportar.
 *
 * Ionicons' two arrows side by side (swap-vertical) said "swap" and nothing
 * about data (Jose, 2026-11-12). Here one arrow goes down INTO a tray and the
 * other comes up OUT of it, which is what the screen does with a backup.
 *
 * Drawn to the conventions of piggy-bank.ts: a data URI, no fill,
 * `currentColor`, round caps and joins, Ionicons' stroke of 32 on a 512 box.
 */
export const DATA_TRANSFER = 'data:image/svg+xml;utf8,'
  + "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 512 512'>"
  + "<g fill='none' stroke='currentColor' stroke-width='32'"
  + " stroke-linecap='round' stroke-linejoin='round'>"
  // The tray the data sits in.
  + "<path d='M64 336v80a32 32 0 0032 32h320a32 32 0 0032-32v-80'/>"
  // In: an arrow down into it.
  + "<path d='M176 64v272'/>"
  + "<path d='M104 264l72 72 72-72'/>"
  // Out: an arrow up from it.
  + "<path d='M336 336V64'/>"
  + "<path d='M264 136l72-72 72 72'/>"
  + "</g>"
  + "</svg>";
