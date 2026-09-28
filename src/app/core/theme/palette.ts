/**
 * The colours an account or a category wears.
 *
 * Sixteen colours at one lightness, so no category shouts over another
 * (docs/mockups/src/lib.mjs, `PALETTE`). Categories are drawn in rounded
 * squares and accounts in circles, each in its own colour on a tint of it.
 *
 * Every row in the schema carries a colour, and the schema's default is
 * `#607D8B` - which is what every account and category on record holds,
 * because until the redesign no screen let anybody choose one. Drawn as it
 * is, the whole app would be one grey. So a row still wearing the default is
 * DRAWN in a colour of the palette picked by its id, and nothing is written:
 * the moment someone chooses a colour in the editor, that one is used. Looks
 * only, as the redesign promised (CLAUDE.md, "The redesign touches looks and
 * access only").
 */

export const PALETTE = {
  coral: '#ff6b6b', mandarina: '#ff9152', ambar: '#f6b93b', oro: '#e8c15a',
  lima: '#a3d65c', esmeralda: '#34c98b', menta: '#5fd8bf', turquesa: '#2ec4b6',
  cielo: '#4cb8f5', zafiro: '#6378ff', violeta: '#9b7bff', orquidea: '#d07bf0',
  rosa: '#f2709c', cereza: '#e0525e', arena: '#d4a373', pizarra: '#8c9bb5',
} as const;

export type PaletteName = keyof typeof PALETTE;

/** The palette in the order the colour editor offers it, by family. */
export const PALETTE_FAMILIES: { family: 'warm' | 'cool' | 'violet'; names: PaletteName[] }[] = [
  { family: 'warm', names: ['coral', 'cereza', 'mandarina', 'ambar', 'oro', 'arena'] },
  { family: 'cool', names: ['lima', 'esmeralda', 'menta', 'turquesa', 'cielo', 'zafiro'] },
  { family: 'violet', names: ['violeta', 'orquidea', 'rosa', 'pizarra'] },
];

/** What the schema writes when nobody chose a colour. */
export const DEFAULT_COLOR = '#607D8B';

/**
 * The order colours are handed out to rows still on the default: neighbours
 * in id tend to be neighbours in a list, so this jumps around the wheel
 * rather than walking it, and two rows side by side rarely match.
 */
const HANDED_OUT: PaletteName[] = [
  'zafiro', 'mandarina', 'esmeralda', 'rosa', 'cielo', 'ambar', 'violeta', 'coral',
  'turquesa', 'oro', 'orquidea', 'lima', 'cereza', 'menta', 'arena', 'pizarra',
];

/** The colour a row is drawn in: its own, or one of the palette by its id. */
export function displayColor(color: string | null | undefined, id: number | null | undefined): string {
  if (color && color.toUpperCase() !== DEFAULT_COLOR && /^#[0-9a-f]{6}$/i.test(color)) return color;
  const index = Math.abs(Number(id ?? 0)) % HANDED_OUT.length;
  return PALETTE[HANDED_OUT[index]];
}

/** `#rrggbb` at an alpha, for the tinted plate behind an icon. */
export function tint(hex: string, alpha = 0.16): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}
