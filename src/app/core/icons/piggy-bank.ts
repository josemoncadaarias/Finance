/**
 * A piggy bank, drawn here because Ionicons has none.
 *
 * The products and yields screen is about money set aside to earn, and every
 * other name for that - a bed, a wallet, a coin - says something else. Jose
 * asked for an alcancía, so there is one.
 *
 * Drawn to Ionicons' own outline conventions so it sits beside the rest of
 * the drawer without looking borrowed: a 512 viewBox, no fill, `currentColor`
 * for the stroke so it takes the colour of whatever it is in, and a stroke
 * width of 32, which is the 1.5px their outline set comes out at.
 *
 * **Written as a data URI, which is what `addIcons` takes.** Every value
 * Ionicons exports is one - `data:image/svg+xml;utf8,<svg ...>` - and a raw
 * `<svg>` string handed to `addIcons` is treated as a URL to fetch instead.
 * The fetch fails, nothing is drawn, and nothing is reported: the first
 * version of this file was raw markup and the icon simply was not there.
 * Attributes are single-quoted for the same reason, and it is one line,
 * because a newline inside a URI ends it.
 */
export const PIGGY_BANK = 'data:image/svg+xml;utf8,'
  + "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 512 512'>"
  + "<g fill='none' stroke='currentColor' stroke-width='32'"
  + " stroke-linecap='round' stroke-linejoin='round'>"
  + "<ellipse cx='288' cy='280' rx='144' ry='112'/>"
  + "<rect x='88' y='248' width='56' height='64' rx='24'/>"
  + "<path d='M232 180l28-64 56 44'/>"
  + "<path d='M216 388v52M360 388v52'/>"
  + "<path d='M300 192h68'/>"
  + "</g>"
  + "<circle cx='212' cy='252' r='16' fill='currentColor'/>"
  + "</svg>";
