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
 */
export const PIGGY_BANK = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <g fill="none" stroke="currentColor" stroke-width="32"
     stroke-linecap="round" stroke-linejoin="round">
    <ellipse cx="288" cy="280" rx="144" ry="112"/>
    <rect x="88" y="248" width="56" height="64" rx="24"/>
    <path d="M232 180l28-64 56 44"/>
    <path d="M216 388v52M360 388v52"/>
    <path d="M300 192h68"/>
  </g>
  <circle cx="212" cy="252" r="16" fill="currentColor"/>
</svg>`;
