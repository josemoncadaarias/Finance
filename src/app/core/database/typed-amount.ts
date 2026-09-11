/**
 * An amount of money as it is being typed into a field.
 *
 * A field that shows "6000000.00" reads as a plain number, and a figure in the
 * millions is easy to get wrong by a zero. So a money field regroups what is
 * typed on every keystroke, the way the rest of the app shows money: a dot
 * between thousands and a comma before the cents - "6.000.000,50".
 *
 * Whatever this produces is read back by `parseTypedAmountToMinor`.
 */

/** Regroups an amount as it is typed. */
export function groupTypedAmount(raw: string, options: { allowNegative?: boolean } = {}): string {
  const negative = options.allowNegative === true && raw.trim().startsWith('-');
  let text = raw.replace(/[^\d.,]/g, '');

  // Dots in the field are the grouping this function wrote, never followed by
  // nothing - so a dot at the very end was just typed, by a keyboard whose
  // decimal key is a dot. It starts the cents, as a comma does.
  if (!text.includes(',') && text.endsWith('.')) {
    text = `${text.slice(0, -1)},`;
  }

  const comma = text.indexOf(',');
  const integerPart = (comma === -1 ? text : text.slice(0, comma)).replace(/\D/g, '');
  const cents = comma === -1 ? null : text.slice(comma + 1).replace(/\D/g, '').slice(0, 2);

  if (integerPart.length === 0 && cents === null) return negative ? '-' : '';

  const digits = integerPart.replace(/^0+(?=\d)/, '') || '0';
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${negative ? '-' : ''}${grouped}${cents === null ? '' : `,${cents}`}`;
}

/** A stored amount, written the way a money field shows it. Cents only when there are some. */
export function typedAmountOf(minor: number): string {
  const negative = minor < 0;
  const absolute = Math.abs(minor);
  const whole = Math.floor(absolute / 100);
  const cents = absolute % 100;
  const grouped = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${negative ? '-' : ''}${grouped}${cents === 0 ? '' : `,${String(cents).padStart(2, '0')}`}`;
}
