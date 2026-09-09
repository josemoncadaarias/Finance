/**
 * What the keypad is holding while someone types an amount.
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

  /** The digits as typed, for showing back. Empty means nothing yet. */
  get text(): string {
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
