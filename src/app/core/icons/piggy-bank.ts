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
  /*
   * The viewBox is cropped to the drawing, not left at the full 512.
   *
   * The pig only ever used the middle of that square, so beside icons that
   * fill theirs it came out visibly smaller - which is what Jose saw in the
   * drawer. Cropping to what is drawn, with a margin of Ionicons' own size,
   * makes it the same weight as the rest. The stroke comes down to 25
   * because the crop scales everything up by about a quarter, and 32 through
   * that would be a fatter line than any icon beside it.
   */
  + "<svg xmlns='http://www.w3.org/2000/svg' viewBox='60 78 400 400'>"
  + "<g fill='none' stroke='currentColor' stroke-width='25'"
  + " stroke-linecap='round' stroke-linejoin='round'>"
  + "<ellipse cx='288' cy='280' rx='144' ry='112'/>"
  + "<rect x='88' y='248' width='56' height='64' rx='24'/>"
  + "<path d='M232 180l28-64 56 44'/>"
  + "<path d='M216 388v52M360 388v52'/>"
  + "<path d='M300 192h68'/>"
  + "</g>"
  + "<circle cx='212' cy='252' r='16' fill='currentColor'/>"
  + "</svg>";
