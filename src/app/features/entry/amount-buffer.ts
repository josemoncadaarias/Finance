/**
 * What the amount field is holding while someone types an amount.
 *
 * Kept as the digits typed rather than as a number, for the same reason the
 * rest of the app stores integers: a running `value = value * 10 + digit` on a
 * float loses the last cent long before anyone notices, and the amount being
 * typed is exactly where that would be least forgivable.
 *
 * Pesos are typed first and cents only if wanted — `50200` is fifty thousand
 * two hundred pesos, not five hundred and two. Colombian amounts are usually
 * whole pesos, and making every entry cost two extra taps to say ",00" is the
 * kind of friction that sends someone back to the app they came from.
 */

import { parseAmountToMinor } from '../../core/database/money';

/** Digits before the separator. More than this is not a real amount. */
const MAX_WHOLE = 12;

export class AmountBuffer {
  private whole = '';
  private fraction = '';
  private typingFraction = false;

  /**
   * The digits as typed, for showing back. Empty means nothing yet.
   *
   * Grouped in thousands, because Colombian amounts run long: 975894,47 has
   * to be counted digit by digit to be read, and someone correcting an amount
   * needs to see at a glance whether it says nine hundred thousand or nine
   * million. Grouping is display only — `minor` never sees it.
   */
  get text(): string {
    if (this.whole === '' && !this.typingFraction) return '';
    const whole = groupThousands(this.whole === '' ? '0' : this.whole);
    return this.typingFraction ? `${whole},${this.fraction}` : whole;
  }

  /** The digits without grouping, for anything that has to parse them back. */
  get raw(): string {
    if (this.whole === '' && !this.typingFraction) return '';
    const whole = this.whole === '' ? '0' : this.whole;
    return this.typingFraction ? `${whole},${this.fraction}` : whole;
  }

  get isEmpty(): boolean {
    return this.whole === '' && this.fraction === '';
  }

  /** The amount in minor units. Zero while nothing has been typed. */
  get minor(): number {
    if (this.isEmpty) return 0;
    const whole = this.whole === '' ? '0' : this.whole;
    const fraction = this.fraction.padEnd(2, '0');
    return parseAmountToMinor(`${whole}.${fraction}`);
  }

  push(digit: string): void {
    if (!/^[0-9]$/.test(digit)) return;

    if (this.typingFraction) {
      if (this.fraction.length < 2) this.fraction += digit;
      return;
    }

    // A leading zero means nothing, and lets someone type 0,50 naturally.
    if (this.whole === '0') this.whole = '';
    if (this.whole.length < MAX_WHOLE) this.whole += digit;
  }

  /** Starts the cents. Pressing it twice does nothing. */
  separator(): void {
    if (this.typingFraction) return;
    if (this.whole === '') this.whole = '0';
    this.typingFraction = true;
  }

  backspace(): void {
    if (this.typingFraction) {
      if (this.fraction.length > 0) {
        this.fraction = this.fraction.slice(0, -1);
      } else {
        this.typingFraction = false;
      }
      return;
    }
    this.whole = this.whole.slice(0, -1);
  }

  clear(): void {
    this.whole = '';
    this.fraction = '';
    this.typingFraction = false;
  }

  /** The same digits in a new object, so a signal holding it notices. */
  copy(): AmountBuffer {
    return Object.assign(new AmountBuffer(), this);
  }

  /** Fills the buffer from an existing amount, for editing. */
  static from(minor: number): AmountBuffer {
    const buffer = new AmountBuffer();
    const magnitude = Math.abs(minor);
    buffer.whole = String(Math.trunc(magnitude / 100));

    const cents = magnitude % 100;
    if (cents !== 0) {
      buffer.typingFraction = true;
      buffer.fraction = String(cents).padStart(2, '0');
    }
    return buffer;
  }
}

/**
 * What the phone's keyboard did to the amount field, read back as a buffer.
 *
 * The field always shows `before.text` with the caret at its end, so what the
 * keyboard did is plain from the new value: one character added at the end is
 * typed (a digit, or a comma or a full stop starting the cents - the phone's
 * decimal keyboard offers one or the other by its language), characters gone
 * from the end are erased. Anything else - a paste, the whole selected and
 * typed over - is read afresh: the digits, and a comma, or a full stop
 * followed by one or two digits at the end, as the cents. Thousands
 * separators are only ever the app's own, so they are skipped.
 */
export function typedInto(before: AmountBuffer, value: string): AmountBuffer {
  const shown = before.text;
  const next = before.copy();
  if (value.startsWith(shown) && value.length === shown.length + 1) {
    for (const character of value.slice(shown.length)) {
      if (/[0-9]/.test(character)) next.push(character);
      else if (character === ',' || character === '.') next.separator();
    }
    return next;
  }
  if (shown.startsWith(value)) {
    for (let i = value.length; i < shown.length; i++) {
      // An erased grouping dot erases the digit before it too.
      if (shown[i] !== '.') next.backspace();
    }
    return next;
  }
  const fresh = new AmountBuffer();
  const comma = value.lastIndexOf(',');
  const point = /\.\d{0,2}$/.test(value) ? value.lastIndexOf('.') : -1;
  const cents = comma >= 0 ? comma : point;
  [...value].forEach((character, i) => {
    if (i === cents) fresh.separator();
    else if (/[0-9]/.test(character)) fresh.push(character);
  });
  return fresh;
}

/** 1234567 -> 1.234.567, the Colombian way round. */
function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}
